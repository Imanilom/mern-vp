# CAPAR graph API

The doctor-authenticated endpoint `GET /api/doctor/capar-visualization/graph` projects CAPAR sources into a directed graph. A vertex represents a patient, device, monitoring day, CAPAR window, activity episode, or physiological episode. Physiological measurements remain vertex attributes; they are not separate vertices and do not determine vertex size. Raw samples, wearable samples, and stream logs are intentionally excluded from graph requests to keep graph loading focused and lightweight.

All requests require `patient_id` and accept either `date=YYYY-MM-DD` or `all_dates=true`, plus an optional `device_id`. A date and `all_dates=true` cannot be combined. The patient is resolved through the authenticated doctor's patient accounts.

## Page vertices and internal edges

```text
GET /api/doctor/capar-visualization/graph?patient_id=...&date=2026-11-26&limit=200&offset=0
```

`operation` defaults to `page`. `limit` is 1–500; `offset` is 0–500000. The response includes the selected vertices, edges whose endpoints are both on that page, total counts, `has_more`, `next_offset`, and source `truncated` flags. Use the neighbors operation to retrieve edges crossing page boundaries.

## Expand a vertex

```text
GET /api/doctor/capar-visualization/graph?patient_id=...&date=2026-11-26&operation=neighbors&node_id=window%3A...
```

The response contains the center vertex and a paged set of adjacent vertices and connecting relationships. `limit` and `offset` have the same bounds as page requests.

## Find a directed path

```text
GET /api/doctor/capar-visualization/graph?patient_id=...&date=2026-11-26&operation=path&start_id=...&target_id=...
```

Path search returns the shortest directed path by hop count. Set `weighted=true` to find the minimum elapsed-time path using only `NEXT` edges. A valid request with no path returns `path: null`.

## Relationship semantics

- `NEXT` records chronological order within a source stream; its weight is elapsed seconds. It does not imply causality.
- `HAS_RAW_DATA`, `HAS_WINDOW`, `HAS_DAY`, `HAS_SESSION`, and other typed edges represent source lineage or observed association.
- Edges with `metadata.inferred=true` are inferred from available evidence and are visually distinguished from directly sourced relationships. Missing observations are not interpreted as device removal.
- `truncated` describes limits on the underlying timeline sources; paths or neighborhoods may be incomplete when a source is truncated.
- Graph responses set `detail_included: false`; retrieve timeline details separately when raw rows or sensor evidence are needed.

## Timeline detail loading

`GET /api/doctor/capar-visualization/timeline` accepts `include_detail=true|false`. It defaults to `true` for compatibility with table, timeline, and CSV export views. With `include_detail=false`, it returns windows, activity summaries, physiological episodes, and baselines, while skipping raw rows, wearable samples, stream logs, sensor anchors, and temporal-edge construction. The graph and dynamic-analysis views use this lighter response; CSV export explicitly requests full detail.

## Browser dynamic analysis

The CAPAR visualization page also analyzes the selected timeline's `windows`, `baselines`, `activities`, and physiological `episodes`. This analysis is separate from semantic graph edges:

- The state is `x = [zHR, baseline lnRMSSD − lnRMSSD, baseline DFA α1 − DFA α1]`, standardized by the matching mature baseline for activity and time period.
- A window must be valid, have signal quality and completeness of at least 0.95, have complete HR/RMSSD/DFA α1 features, and have a valid timestamp. Completeness comes from `q_complete` or `1 − missing_ratio`; confidence scores are not used as a substitute.
- A transition requires consecutive windows, an unchanged baseline, and an interval compatible with the recorded 1-minute or 5-minute window type. Sampling interval is displayed from the data, not forced to 3 minutes.
- Matrix estimation is withheld unless there are at least 18 pairs, rank 3, condition number at most 100, and intervals are sufficiently uniform. Eigenmode time constants use `τ = −Δt / ln(|λ|)` for stable modes. Estimates are exploratory and are not causal or clinical findings.
- Observational TTR uses standardized distance `D ≤ 1.5` for two consecutive eligible windows. It is not a clinical recovery threshold.

The **Impor CSV CAPAR** control accepts the timeline CSV export when it includes window, quality, and matching baseline columns. Imported files are analyzed in browser memory only; they are not sent to or stored by the API.

## Persist a dynamic profile

The doctor UI calculates the profile from CAPAR windows and baseline data, then saves the result with `POST /api/doctor/capar-visualization/dynamic-profile`. The endpoint accepts the patient, scope, selected date/activity/episode/window, and the computed profile graph/model/history. It upserts one MongoDB document per selected context in `capar_dynamic_profiles`, so revisiting the same context refreshes that snapshot rather than creating duplicate records. Profiles imported from CSV/demo are not sent to MongoDB.

The saved graph always includes person, day, activity, model, eigenmode/audit, and dynamic-profile nodes. When the quality or identifiability gate fails, context and audit relationships remain visible and the model node records the reason instead of rendering an empty graph.
