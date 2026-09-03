import json
with open('capar_event_6a90023d_simulation.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

for cell in nb.get('cells', []):
    if cell.get('cell_type') == 'code':
        source = cell['source']
        for i, line in enumerate(source):
            if 'ax1.annotate' in line and "'A'" in line and line.startswith('    ax1'):
                source[i] = line.lstrip(' ')
            elif 'ax1.annotate' in line and "'B'" in line and line.startswith('    ax1'):
                source[i] = line.lstrip(' ')
            elif 'ax1.annotate' in line and "'C'" in line and line.startswith('    ax1'):
                source[i] = line.lstrip(' ')
            elif 'ax1.annotate' in line and "'D'" in line and line.startswith('    ax1'):
                source[i] = line.lstrip(' ')
            elif 'ax1.plot' in line and "label='" in line and line.startswith('    ax1'):
                source[i] = line.lstrip(' ')

with open('capar_event_6a90023d_simulation.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print('Indentation fixed.')
