import numpy as np
import matplotlib.pyplot as plt
from fpdf import FPDF
import os

def generate_signals(t_end=300, dt=1):
    time = np.arange(0, t_end, dt)
    n = len(time)
    
    # 1. Normal Recovery (Exponential decay)
    normal = 100 * np.exp(-time / 50) + np.random.normal(0, 2, n)
    
    # 2. Relapse (Decay, then sudden spike)
    relapse = 100 * np.exp(-time / 50)
    relapse[150:] += 80 * np.exp(-(time[150:] - 150) / 40)
    relapse += np.random.normal(0, 2, n)
    
    # 3. Fragmentasi (Unstable, multiple state switches)
    fragmentasi = np.zeros(n)
    state = 100
    for i in range(n):
        if np.random.rand() < 0.05: # 5% chance to switch state
            state = 100 if state < 50 else 0
        fragmentasi[i] = state
    # Smooth it slightly
    fragmentasi = np.convolve(fragmentasi, np.ones(5)/5, mode='same') + np.random.normal(0, 5, n)
    
    # 4. Drift (Recovery but baseline shifts)
    drift = 100 * np.exp(-time / 50) + (time * 0.2) + np.random.normal(0, 2, n)
    
    return time, normal, relapse, fragmentasi, drift

def apply_1d_cnn_filter(signal, window_size=10):
    # Simulate a 1D Convolution filter (e.g., edge detector / change detector)
    # A simple [-1, -1, 0, 1, 1] kernel to detect trends
    kernel = np.array([-1, -1, 0, 1, 1]) / 2.0
    convolved = np.convolve(signal, kernel, mode='same')
    return convolved

def simulate_and_plot():
    time, normal, relapse, fragmentasi, drift = generate_signals()
    
    signals = [
        ("Normal Recovery", normal),
        ("Relapse (Recovery then deviate)", relapse),
        ("Fragmentasi (Unstable switching)", fragmentasi),
        ("Drift (Baseline shift)", drift)
    ]
    
    fig, axes = plt.subplots(4, 2, figsize=(14, 12))
    
    for i, (title, sig) in enumerate(signals):
        # Raw Signal
        axes[i, 0].plot(time, sig, label='Raw Trajectory', color='blue')
        axes[i, 0].set_title(f"{title} - Raw Window (5 min)")
        axes[i, 0].set_ylabel('Fisiologis')
        axes[i, 0].grid(True)
        
        # Convolved Signal (CNN Feature)
        conv_sig = apply_1d_cnn_filter(sig)
        axes[i, 1].plot(time, conv_sig, label='CNN Filter Output', color='orange')
        axes[i, 1].set_title(f"{title} - 1D Conv Feature")
        axes[i, 1].set_ylabel('Feature Activation')
        axes[i, 1].grid(True)
        
    axes[3, 0].set_xlabel('Waktu (detik)')
    axes[3, 1].set_xlabel('Waktu (detik)')
    
    plt.tight_layout()
    img_path = 'simulation_plot.png'
    plt.savefig(img_path, dpi=150)
    plt.close()
    
    return img_path

def generate_pdf_report(img_path, output_pdf='Laporan_Simulasi_Recovery.pdf'):
    pdf = FPDF()
    pdf.add_page()
    
    # Set up fonts
    # Try to use Arial, fallback to built-in Helvetica if error
    pdf.set_font("Helvetica", style="B", size=16)
    
    # Title
    pdf.cell(0, 10, "Laporan Simulasi: Dinamika Recovery Cardiovascular", ln=True, align='C')
    pdf.ln(5)
    
    pdf.set_font("Helvetica", size=11)
    
    # Content based on user's prompt
    text = """Berikut penjelasan gambar tersebut dalam bentuk teks yang dapat digunakan sebagai definisi konsep dan panduan bagi agent/model dalam membedakan Relapse, Fragmentasi, dan Drift pada dinamika recovery cardiovascular.

# Konsep Relapse, Fragmentasi, dan Drift pada Recovery Cardiovascular

Dalam analisis recovery fisiologis, perubahan lintasan setelah suatu deviasi tidak selalu memiliki makna yang sama. Terdapat tiga pola temporal yang perlu dibedakan, yaitu:

1. Relapse -> recovery sudah terjadi atau hampir tercapai, kemudian sistem kembali menyimpang.
2. Fragmentasi -> recovery berlangsung tidak stabil dan terputus-putus dengan banyak perpindahan state.
3. Drift -> baseline atau operating point fisiologis bergeser secara perlahan dalam jangka waktu tertentu.

Simulasi berikut menunjukkan bagaimana window 5-menit (300 detik) dari trajectory recovery dapat diproses oleh Convolutional Neural Network (CNN) 1D. CNN mengekstrak fitur lokal (seperti perubahan mendadak, osilasi, atau tren) untuk membedakan kelas-kelas ini."""
    
    # Multi-cell for wrapping text
    pdf.multi_cell(0, 6, text)
    pdf.ln(5)
    
    # Insert Image
    pdf.image(img_path, x=10, w=190)
    
    # Conclusion
    pdf.add_page()
    pdf.set_font("Helvetica", style="B", size=14)
    pdf.cell(0, 10, "Analisis CNN 1D pada Window 5 Menit", ln=True)
    pdf.set_font("Helvetica", size=11)
    
    analysis_text = """Berdasarkan hasil konvolusi 1D (CNN Feature) di atas:
- Normal Recovery: Aktivasi filter mengecil seiring berjalannya waktu menunjukkan stabilisasi.
- Relapse: Terdapat lonjakan aktivasi sekunder yang kuat pada saat sistem kembali menyimpang (detik 150).
- Fragmentasi: Aktivasi filter terus-menerus tinggi dan berfluktuasi sepanjang waktu, mendeteksi ketidakstabilan.
- Drift: Terdapat pergeseran aktivasi dasar yang konsisten (bias konstan) akibat perubahan baseline.

Fitur-fitur spasio-temporal inilah yang akan dipelajari oleh model CNN untuk membedakan keempat state ini secara akurat di dalam pipeline CAPAR (Blok 4)."""
    
    pdf.multi_cell(0, 6, analysis_text)
    
    # Save PDF
    pdf.output(output_pdf)
    print(f"PDF berhasil dibuat: {output_pdf}")

if __name__ == "__main__":
    print("Memulai simulasi...")
    img_path = simulate_and_plot()
    print(f"Plot disimpan di {img_path}")
    generate_pdf_report(img_path, "Laporan_Simulasi_Recovery.pdf")
    print("Selesai.")
