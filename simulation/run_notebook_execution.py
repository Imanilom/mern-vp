import json
import sys
import io
import os
import base64
import traceback
import matplotlib.pyplot as plt

def run_notebook(nb_path):
    with open(nb_path, "r", encoding="utf-8") as f:
        nb = json.load(f)

    # Execution namespace
    ns = {}
    exec_count = 1

    print(f"Executing notebook: {nb_path}...")
    for idx, cell in enumerate(nb["cells"]):
        if cell["cell_type"] != "code":
            continue

        code_text = "".join(cell["source"])
        # Handle ipython magics if any
        code_clean = "\n".join([line for line in code_text.splitlines() if not line.strip().startswith("%")])

        cell["outputs"] = []
        cell["execution_count"] = exec_count

        stdout_trap = io.StringIO()
        stderr_trap = io.StringIO()
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = stdout_trap
        sys.stderr = stderr_trap

        try:
            # Clear previous plots
            plt.close("all")
            
            exec(code_clean, ns)
            
            # Check if matplotlib created figures
            figs = [plt.figure(n) for n in plt.get_fignums()]
            
            stdout_val = stdout_trap.getvalue()
            stderr_val = stderr_trap.getvalue()

            if stdout_val:
                cell["outputs"].append({
                    "name": "stdout",
                    "output_type": "stream",
                    "text": [l + "\n" for l in stdout_val.splitlines()]
                })

            for fig in figs:
                buf = io.BytesIO()
                fig.savefig(buf, format="png", bbox_inches="tight", dpi=100)
                buf.seek(0)
                b64_img = base64.b64encode(buf.read()).decode("utf-8")
                cell["outputs"].append({
                    "data": {
                        "image/png": b64_img,
                        "text/plain": ["<Figure size ...>"]
                    },
                    "metadata": {},
                    "output_type": "display_data"
                })
                plt.close(fig)

            print(f" -> Executed code cell {idx + 1} successfully.")
        except Exception as e:
            stdout_val = stdout_trap.getvalue()
            stderr_val = stderr_trap.getvalue()
            err_msg = traceback.format_exc()
            print(f" [!] Error in cell {idx + 1}: {e}")
            if stdout_val:
                cell["outputs"].append({
                    "name": "stdout",
                    "output_type": "stream",
                    "text": [l + "\n" for l in stdout_val.splitlines()]
                })
            cell["outputs"].append({
                "ename": type(e).__name__,
                "evalue": str(e),
                "output_type": "error",
                "traceback": err_msg.splitlines()
            })
        finally:
            sys.stdout = old_stdout
            sys.stderr = old_stderr
            exec_count += 1

    with open(nb_path, "w", encoding="utf-8") as f:
        json.dump(nb, f, indent=1, ensure_ascii=False)

    print(f"All code cells executed and saved into {nb_path}!")

if __name__ == "__main__":
    run_notebook("simulation/heart_disease_prediction_cleveland_simulation.ipynb")
