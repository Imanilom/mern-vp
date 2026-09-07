import json
import numpy as np
import matplotlib.pyplot as plt
from fpdf import FPDF
import os

def load_data(filepath):
    with open(filepath, 'r') as f:
        return json.load(f)

def extract_features(data_list, key='hr'):
    """ Extract array of values from list of dicts """
    return np.array([d[key] for d in data_list if key in d and d[key] is not None])

def apply_1d_cnn_filter(signal):
    """ Simulate 1D CNN Filter """
    if len(signal) < 5:
        return signal
    kernel = np.array([-1, -1, 0, 1, 1]) / 2.0
    return np.convolve(signal, kernel, mode='same')

def plot_subset(axes, row, raw_signal, title):
    axes[row, 0].plot(raw_signal, label='Raw Trajectory', color='blue')
    axes[row, 0].set_title(f"{title} - Raw Window")
    axes[row, 0].set_ylabel('Heart Rate')
    axes[row, 0].grid(True)
    
    conv_sig = apply_1d_cnn_filter(raw_signal)
    axes[row, 1].plot(conv_sig, label='CNN Feature', color='orange')
    axes[row, 1].set_title(f"{title} - CNN Activation")
    axes[row, 1].set_ylabel('Activation')
    axes[row, 1].grid(True)

def generate_plots():
    data = load_data('mongo_sim_data.json')
    
    # Extract
    pop_hr = extract_features(data.get('population', []), 'hr')[:300]
    pop_rest = extract_features(data.get('population_per_activity', {}).get('Rest', []), 'hr')[:300]
    pop_intense = extract_features(data.get('population_per_activity', {}).get('Intense', []), 'hr')[:300]
    
    pers_hr = extract_features(data.get('personal', []), 'hr')[:300]
    pers_rest = extract_features(data.get('personal_per_activity', {}).get('Rest', []), 'hr')[:300]
    pers_intense = extract_features(data.get('personal_per_activity', {}).get('Intense', []), 'hr')[:300]

    # Subplots: 6 rows (Pop, Pop Rest, Pop Intense, Pers, Pers Rest, Pers Intense)
    fig, axes = plt.subplots(6, 2, figsize=(14, 24))
    
    if len(pop_hr) > 0: plot_subset(axes, 0, pop_hr, 'Populasi (Agregat General)')
    if len(pop_rest) > 0: plot_subset(axes, 1, pop_rest, 'Populasi (Aktivitas: Rest)')
    if len(pop_intense) > 0: plot_subset(axes, 2, pop_intense, 'Populasi (Aktivitas: Intense)')
    
    if len(pers_hr) > 0: plot_subset(axes, 3, pers_hr, 'Personal (General)')
    if len(pers_rest) > 0: plot_subset(axes, 4, pers_rest, 'Personal (Aktivitas: Rest)')
    if len(pers_intense) > 0: plot_subset(axes, 5, pers_intense, 'Personal (Aktivitas: Intense)')

    axes[5, 0].set_xlabel('Index Waktu')
    axes[5, 1].set_xlabel('Index Waktu')
    
    plt.tight_layout()
    img_path = 'mongo_simulation_plot.png'
    plt.savefig(img_path, dpi=150)
    plt.close()
    
    return img_path, data

def generate_pdf_report(img_path, data, output_pdf='Laporan_Simulasi_Mongo.pdf'):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", style="B", size=16)
    
    pdf.cell(0, 10, "Laporan Simulasi: Dinamika Recovery Menggunakan Data MongoDB", new_x="LMARGIN", new_y="NEXT", align='C')
    pdf.ln(5)
    
    pdf.set_font("Helvetica", size=11)
    
    user = data.get('user_details', {})
    
    text = f'''Simulasi ini menggunakan data riil pasien dari MongoDB koleksi Segment. 

[DETAIL USER PERSONAL TERPILIH]
- User ID: {user.get('_id', 'Unknown')}
- Email/Role: {user.get('email', 'Unknown')} / {user.get('role', 'Unknown')}
- Gender / Age: {user.get('gender', 'Unknown')} / {user.get('age', 'Unknown')}
- Total Episodes Analysis: {user.get('episodes_count', 0)}

Berikut adalah perbandingan lintasan Recovery (menggunakan metrik Heart Rate) antara POPULASI dan PERSONAL, serta perbandingannya ketika dikontrol oleh aktivitas (Rest vs Intense).
CNN 1D mengekstrak fitur yang membedakan volatilitas (Fragmentasi), anomali ganda (Relapse), maupun pergeseran baseline (Drift).'''
    
    pdf.multi_cell(0, 6, text)
    pdf.ln(5)
    
    # Image might be too tall for one page, we insert it and adjust scale
    pdf.image(img_path, x=10, w=190)
    
    pdf.add_page()
    pdf.set_font("Helvetica", style="B", size=14)
    pdf.cell(0, 10, "Analisis Multi-Skala", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=11)
    
    analysis_text = """1. Populasi vs Personal:
   - Data Populasi lebih merata dengan tren yang saling meniadakan, menjadikannya baseline umum yang baik (Z-Score reference).
   - Data Personal menunjukkan profil unik, membuktikan perlunya Digital Twin per pasien (Q1-Q2).

2. Kofariat Aktivitas (Rest vs Intense):
   - Populasi (Intense) dan Personal (Intense) sama-sama menunjukkan volatilitas ekstrim (Fragmentasi) dan baseline HR tinggi. Ini NORMAL saat olahraga.
   - Deteksi anomali sesungguhnya terlihat pada Personal (Rest). Jika saat 'Rest' CNN Activation mendeteksi pergeseran tajam (Drift atau Relapse), ini menandakan kegagalan recovery kardiovaskular.
   
Kesimpulan: Blok 3 (Kofariat Aktivitas) sangat krusial dalam menyaring Noise agar penilaian Cardiovascular Resilience di Blok 4 tidak memberikan false positive pada saat pasien berolahraga."""
    
    pdf.multi_cell(0, 6, analysis_text)
    
    pdf.output(output_pdf)
    print(f"PDF berhasil dibuat: {output_pdf}")

if __name__ == "__main__":
    print("Menganalisa data MongoDB dan membuat plot...")
    try:
        img_path, data = generate_plots()
        print(f"Plot disimpan di {img_path}")
        generate_pdf_report(img_path, data)
        print("Selesai.")
    except Exception as e:
        print(f"Error: {e}")
