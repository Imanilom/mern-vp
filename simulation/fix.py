import json
with open('capar_episode_analysis_live_simulation.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)
for cell in nb.get('cells', []):
    if cell.get('cell_type') == 'code':
        for i, line in enumerate(cell['source']):
            if "df['sq_col'] = df['signal_quality'].map(color_map).fillna('#81C784')" in line:
                cell['source'][i] = line.replace(
                    "df['sq_col'] = df['signal_quality'].map(color_map).fillna('#81C784')",
                    "df['sq_col'] = df['signal_quality'].apply(lambda x: '#E57373' if isinstance(x, dict) and 'Artifact' in x.values() else color_map.get(x if isinstance(x, str) else 'Valid', '#81C784'))"
                )
with open('capar_episode_analysis_live_simulation.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)
print('Notebook updated successfully.')
