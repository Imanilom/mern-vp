# Episode dataset export

The Python exporter reads the API's MongoDB collections for participants `P0001` through `P0016`, including both scenario `B` (One-way Feedback) and scenario `C` (Human in the loop):

- `scenario_comparison.xlsx`: a workbook with separate `B` and `C` sheets. Each sheet includes a summary row for every participant P0001-P0016, plus that scenario's timestamped interaction events and interpretation records.
- `episodes.csv`: one row per episode for the cohort. The episode collections do not include a scenario/run reference, so these rows are not assigned to B or C.
- `events.csv`: timestamped episode nodes and B/C interaction logs.
- `interpretations.jsonl`: B/C interpretations, including participant ID, stored input, output, evidence, and version metadata.

Participants without data for a scenario still appear in that scenario's sheet with zero counts. Scenario interaction/interpretation rows are filtered directly by scenario code.

Run from the repository root:

```powershell
python api\scripts\export_episode_dataset.py
```

The exporter reads `MONGO` from the process environment or `api\.env`. If neither is set, it uses the API's local MongoDB fallback. Override the database or destination as needed:

```powershell
python api\scripts\export_episode_dataset.py --database healthdevice --output-dir api\exports\episode_dataset
```

Install `pymongo` and `openpyxl` in the Python environment if they are not already available. Prompt and model versions are written as JSON `null` when the source records do not contain them; the exporter does not infer missing version metadata.

## Audit empty fields

To list empty cells and values in `interpretations.jsonl`, `events.csv`, and
`episodes.csv`, run:

```powershell
python api\scripts\audit_missing_fields.py
```

The default output is `simulation\missing_fields.csv`. Each row identifies the
source file, line, record, field path, and whether the value is an empty CSV
cell, an empty string, `null`, or a missing key. JSON values nested inside the
CSV exports are checked as well. To use another input directory or output path:

```powershell
python api\scripts\audit_missing_fields.py --input-dir path\to\exports --output path\to\missing_fields.csv
```
