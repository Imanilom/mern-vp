import json

with open('capar_event_6a90023d_simulation.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

for cell in nb.get('cells', []):
    if cell.get('cell_type') == 'code':
        source = cell['source']
        new_source = []
        i = 0
        while i < len(source):
            line = source[i]
            if 'ax1.set_title' in line:
                pass # skip
            elif "ax1.annotate('1. Candidate Onset" in line:
                new_source.append("    ax1.annotate('A', xy=(1, y_scores[1]), xytext=(0, 10), textcoords='offset points', ha='center', fontweight='bold', fontsize=12)\n")
                new_source.append("    ax1.plot([], [], ' ', label='A: Candidate Onset (Score >= tau_in)')\n")
                i += 1 # skip next line
            elif "ax1.annotate('2. PERSISTENT" in line:
                new_source.append("    ax1.annotate('B', xy=(2, y_scores[2]), xytext=(0, 10), textcoords='offset points', ha='center', fontweight='bold', fontsize=12)\n")
                new_source.append("    ax1.plot([], [], ' ', label='B: PERSISTENT (2 windows >= tau_in)')\n")
                i += 1
            elif "ax1.annotate('3. RECOVERY ENTRY" in line:
                new_source.append("    ax1.annotate('C', xy=(4, y_scores[4]), xytext=(0, 15), textcoords='offset points', ha='center', fontweight='bold', fontsize=12)\n")
                new_source.append("    ax1.plot([], [], ' ', label='C: RECOVERY ENTRY (< tau_out)')\n")
                i += 1
            elif "ax1.annotate('4. RESOLVED" in line:
                new_source.append("    ax1.annotate('D', xy=(5, y_scores[5]), xytext=(0, 10), textcoords='offset points', ha='center', fontweight='bold', fontsize=12)\n")
                new_source.append("    ax1.plot([], [], ' ', label='D: RESOLVED (< tau_normal)')\n")
                i += 1
            elif "Waktu Deteksi" in line:
                new_source.append(line.replace('Waktu Deteksi (Timeline)', 'Time Episodic (Window)'))
            else:
                new_source.append(line)
            i += 1
        cell['source'] = new_source

with open('capar_event_6a90023d_simulation.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print('Notebook updated successfully.')
