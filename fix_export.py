import json
with open('capar_event_6a90023d_simulation.ipynb', 'r', encoding='utf-8') as f:
    nb = json.load(f)

for cell in nb.get('cells', []):
    if cell.get('cell_type') == 'code':
        source = cell['source']
        if any('plt.show()' in line for line in source) and any('ax2.step' in line for line in source):
            new_source = []
            for line in source:
                if 'plt.show()' in line:
                    new_source.append("import json\n")
                    new_source.append("export_data = {\n")
                    new_source.append("    'x_ticks': x_ticks,\n")
                    new_source.append("    'y_scores': [float(s) for s in y_scores],\n")
                    new_source.append("    'fsm_states': fsm_states,\n")
                    new_source.append("    'thresholds': {\n")
                    new_source.append("        'TAU_IN': float(TAU_IN),\n")
                    new_source.append("        'TAU_OUT': float(TAU_OUT),\n")
                    new_source.append("        'TAU_NORMAL': float(TAU_NORMAL)\n")
                    new_source.append("    },\n")
                    new_source.append("    'state_vals': state_vals\n")
                    new_source.append("}\n")
                    new_source.append("with open('exported_graph_data.json', 'w') as f:\n")
                    new_source.append("    json.dump(export_data, f, indent=2)\n")
                    new_source.append("print('? Data exported to exported_graph_data.json')\n")
                    new_source.append(line)
                else:
                    new_source.append(line)
            cell['source'] = new_source

with open('capar_event_6a90023d_simulation.ipynb', 'w', encoding='utf-8') as f:
    json.dump(nb, f, indent=1)

print('Notebook updated successfully.')
