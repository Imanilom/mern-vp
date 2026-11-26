# CAPAR Temporal Visualization

## Data flow

The doctor-only endpoint `GET /api/doctor/capar-visualization/timeline` reads
the authorized patient's account and combines records from:

- `PolarData`: raw heart-rate, RR, acceleration, activity, and signal-quality rows.
- `Segment`: 1-minute and 5-minute CAPAR windows and their stored features.
- `capar_activity_time_series_aggregates`: persisted activity episodes and
  their window-level series.
- `PatientAppWearableSample`: wearable HR/RR/HRV, acceleration, contact, and
  quality evidence.
- `MobileStreamLog`: recent application streaming and MQTT evidence.
- `Baseline`: available patient metrics for comparison lanes.

All sources are restricted to the selected patient account, date range, and
optional device. Dates use `Asia/Jakarta`. The endpoint keeps source IDs and
source collection names on rows/anchors so details and exports retain
provenance. Raw rows can be linked to windows by timestamp overlap; windows can
be linked to episodes by `source_segment_ids`. Overlap is a temporal
relationship, not a claim that the upstream processor stored a foreign key.

## Time-series and backfill

Activity episodes are built by
`buildCaparActivityTimeSeries` from existing `Segment` documents. Runs split
when the Jakarta day, device, window type, activity, or expected time
continuity changes. The persisted collection is the existing
`capar_activity_time_series_aggregates`; this work extends its summary,
series-point, and state-transition fields rather than creating duplicate raw
or window collections.

Existing and new episodes can be rebuilt for an authorized patient/date via
`POST /api/doctor/capar-visualization/activities/rebuild`. Rebuilding is
idempotent by `(account_id, episode_key)` and updates the existing episode.
Deployments that disable Mongoose automatic index creation should explicitly
create the indexes declared by the activity, raw-data, wearable-sample, and
stream-log models during their normal database index rollout.

## Anchors and device evidence

Anchors are derived at request time from their source records; no separate
anchor/session collection is maintained. Calendar boundaries use Jakarta
days. Window and episode boundaries come from stored timestamps. Signal gaps
are marked as inferred and identify the source records on each side.

`sensor_contact: true` is evidence that sensor contact was recorded, not proof
of a physical device-wear action. A transition to `false` is shown as contact
loss, not device removal. `DEVICE_REMOVED` is intentionally not generated:
the current database sources do not record a reliable physical-removal event.
Streaming stop, MQTT failure, missing samples, and signal-quality rejection
are likewise not interpreted as device removal. Stream logs have a seven-day
TTL, so their absence outside that retention period is not evidence that
streaming did not occur.

Metrics are populated only when present in the source. RR shown for a wearable
sample is the mean of its recorded RR intervals; missing raw HRV features are
not synthesized. The activity summary averages valid stored window features.
The raw ACC visualization is derived from the recorded axis values; it is not
a replacement for a stored acceleration-magnitude feature.

## Limits and visualization

The timeline endpoint currently reads at most 50,000 records per source. It
reports source truncation explicitly rather than presenting a partial result
as complete. The UI paginates rendered nodes/anchors and limits SVG markers
for legibility, while preserving the selected time range and source data in
the payload. This is a per-source request cap, not backend cursor pagination;
very large all-date ranges require narrowing the date/device selection until
server-side cursor pagination is added.

The API response includes chronological predecessor/successor edges and
heart-rate direction where both adjacent values exist. Zoom changes the
visible time range/spacing. PNG/PDF export uses the active timeline range;
CSV export preserves the raw source values and IDs.
