# Research dataset export

Run from the repository root:

```powershell
python simulation\research_dataset\export_research_datasets.py
```

Generated CSV files are written to `simulation\research_dataset\output`. To
choose another output directory:

```powershell
python simulation\research_dataset\export_research_datasets.py --output-dir path\to\output
```

The exporter uses only local files: `simulation\events.csv`,
`simulation\episodes.csv`, and `data\data.csv`. It uses Python's standard
library and does not query MongoDB.

Participant IDs already present as `P0001` etc. are retained. IDs derived from
the legacy `data.csv` device identifiers use a separate `RAWnnnnn` namespace
and cannot be linked to the episode participant IDs from these exports.
Episode and HITL run identifiers are replaced with deterministic `E` and `R`
IDs; account IDs and device identifiers are not written.

An empty field means the source export did not provide that value. In
particular, `mean_RR_ms` is a window feature, not a beat-level RR interval;
`RR_interval_ms` is populated only from the source `RR` column. No ACC,
baseline HRV, activity-transition times, participant characteristics, or
independent ground-truth labels are fabricated. See `dataset_availability.csv`
for known limitations.

The reference-label export preserves recorded review labels but marks
independent reference status as unestablished. Do not use these records as
independent ground truth without separate adjudication.
