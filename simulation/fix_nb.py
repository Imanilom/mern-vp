import json

nb_path = 'simulation/simulasi_multi_peak_relapse_mongodb.ipynb'

with open(nb_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

for cell in nb['cells']:
    if cell.get('cell_type') == 'code':
        source = cell.get('source', [])
        source_text = "".join(source)
        if "score = float(s.get('anomaly_score'" in source_text or "df_telemetry" in source_text:
            new_source = []
            for line in source:
                if "score = float(s.get('anomaly_score'" in line:
                    new_source.append("    score = safe_float(s.get('anomaly_score'), 0.0)\n")
                elif "hr = float(feats.get('mean_hr')" in line:
                    new_source.append("    hr = safe_float(feats.get('mean_hr'), 72.0)\n")
                elif "rr = float(feats.get('mean_rr')" in line:
                    new_source.append("    rr = safe_float(feats.get('mean_rr'), 60000.0 / max(hr, 30.0))\n")
                elif "dfa = float(feats.get('dfa_alpha1')" in line:
                    new_source.append("    dfa = safe_float(feats.get('dfa_alpha1'), 1.05)\n")
                elif "lf = float(feats.get('lf')" in line:
                    new_source.append("    lf = safe_float(feats.get('lf'), 1200.0)\n")
                elif "hf = float(feats.get('hf')" in line:
                    new_source.append("    hf = safe_float(feats.get('hf'), 600.0)\n")
                elif "rmssd = float(feats.get('rmssd')" in line:
                    new_source.append("    rmssd = safe_float(feats.get('rmssd'), 28.5)\n")
                elif "z_hr = float(z_sc.get('z_hr')" in line:
                    new_source.append("    z_hr = safe_float(z_sc.get('z_hr'), (hr - 72.0) / 10.0)\n")
                elif "z_rr = float(z_sc.get('z_rr')" in line:
                    new_source.append("    z_rr = safe_float(z_sc.get('z_rr'), (rr - 833.0) / 120.0)\n")
                elif "z_dfa = float(z_sc.get('z_dfa')" in line:
                    new_source.append("    z_dfa = safe_float(z_sc.get('z_dfa'), (dfa - 1.0) / 0.2)\n")
                elif "z_lf_hf = float(z_sc.get('z_lf_hf')" in line:
                    new_source.append("    z_lf_hf = safe_float(z_sc.get('z_lf_hf'), (lf_hf - 2.0) / 1.1)\n")
                elif "records = []" in line:
                    new_source.append("def safe_float(val, default=0.0):\n")
                    new_source.append("    if val is None:\n")
                    new_source.append("        return float(default)\n")
                    new_source.append("    try:\n")
                    new_source.append("        return float(val)\n")
                    new_source.append("    except (ValueError, TypeError):\n")
                    new_source.append("        return float(default)\n\n")
                    new_source.append(line)
                else:
                    new_source.append(line)
            cell['source'] = new_source

with open(nb_path, 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1, ensure_ascii=False)

print("Notebook simulasi_multi_peak_relapse_mongodb.ipynb successfully updated with safe_float!")
