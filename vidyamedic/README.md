# 🩺 VidyaMedic - Personal Health & Pedagogical Sensing Platform

[![Flutter](https://img.shields.io/badge/Flutter-3.x-02569B?logo=flutter)](https://flutter.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS%20%7C%20Web%20%7C%20macOS%20%7C%20Windows-teal)](#)

**VidyaMedic** adalah aplikasi pemantauan kesehatan personal berbasis *pedagogical health framework* (CAPAR) dan integrasi data sensor kontinu (*continuous wearable sensing*). Aplikasi ini dirancang dengan estetika modern bergaya Apple Health / Oura / WHOOP dengan palet warna emerald green yang elegan, responsif, dan intuitif.

---

## ✨ Fitur Utama

### 1. 🫀 Continuous Sensing & Live Vitals
- **Real-Time Heart Rate & Pulse Waveform**: Animasi denyut nadi dan visualisasi ECG/pulse.
- **5 Metrik Vital Kontinu**: Detak Jantung (HR), HRV (RMSSD), Langkah harian, Saturasi SpO₂, dan Suhu Kulit Basal.
- **Status Sinkronisasi Wearable**: Baterai, perangkat terhubung (BLE), dan timestamp sinkronisasi.

### 2. 🎯 Indeks Kesiapan & Pemulihan (Readiness Score)
- Pengukur radial dinamis (*circular score gauge*) dengan skor kesiapan pemulihan tubuh (0–100).
- Analisis variabilitas detak jantung (HRV) dan deteksi deviasi sistem otonom.

### 3. 🧠 6 Dimensi Pedagogi Kesehatan (CAPAR)
Kerangka evaluasi kesehatan holistik berbasis 6 pertanyaan kunci:
1. **Di mana posisi saya saat ini?** *(Where Am I?)* — Titik acuan baseline fisiologis.
2. **Apa yang sedang berubah?** *(What Changed?)* — Deteksi deviasi & tren temporal.
3. **Mengapa perubahan ini terjadi?** *(Why?)* — Korelasi beban kerja, stres, dan kebiasaan.
4. **Berapa lama proses pemulihan?** *(Recovery Time)* — Estimasi waktu kembali ke baseline.
5. **Bagaimana pola pemulihan saya?** *(Recovery Pattern)* — Pola lintasan pemulihan fisiologis.
6. **Tindakan apa yang harus diambil?** *(Action Guidance)* — Protokol triase terstruktur (Kategori I - IV).

### 4. 📝 Alur Input Harian Terpadu (Langkah 5 - 11)
- **Konteks Aktivitas & Gaya Hidup**: Durasi kerja, jenis aktivitas fisik, tingkat stres.
- **Gejala & Perasaan**: Mood picker interaktif, seleksi gejala klinis, skala keparahan visual.
- **Input Tidur**: Jam tidur/bangun, kualitas tidur, gangguan nokturnal.
- **Pengukuran Manual**: Tekanan darah (sistolik/diastolik), suhu tubuh, berat badan, gula darah.
- **Event Marker & Catatan Bebas**: Penandaan konsumsi obat, kafein, makanan berat, atau catatan khusus.
- **Ringkasan Harian**: Validasi komprehensif sebelum data dikirim ke engine analitik.

### 5. 🏥 Action Engine & Simulasi Patient Journey
- **Protokol Triase Otomatis**: Kategori I (Rujuk Segera) hingga Kategori IV (Edukasi Mandiri).
- **Simulasi 24 Jam**: Visualisasi garis waktu pemulihan (Baseline ➔ Deviasi ➔ Stabilisasi).

### 6. 👤 Profil Medis & Kartu Darurat
- Data demografis, BMI status calculator, dan golongan darah.
- Riwayat kondisi medis dan manajemen pengobatan aktif.
- Kontak darurat keluarga / caregiver.
- Ekspor laporan kesehatan ringkas (PDF & WhatsApp sharing).

---

## 🛠️ Arsitektur & Teknologi

- **Framework**: [Flutter](https://flutter.dev) (Dart SDK >=3.0.0)
- **State Management**: [Provider](https://pub.dev/packages/provider)
- **Desain & Tipografi**: Google Fonts (*Plus Jakarta Sans*), Custom Glassmorphism, Micro-animations
- **Struktur Kode**:
  ```
  lib/
  ├── models/        # Entitas data medis & model state
  ├── providers/     # AppState, kalkulasi skor, & simulasi sensor
  ├── screens/
  │   ├── home/      # Dashboard utama & CAPAR summary
  │   ├── input/     # Alur input wizard (Langkah 5-11)
  │   ├── pedagogy/  # Detail 6 pertanyaan pedagogi & patient journey
  │   ├── profile/   # Profil pengguna, kartu darurat, & pengaturan
  │   └── summary/   # Ringkasan harian & ekspor laporan
  ├── theme/         # Design system & palet tema emerald green
  └── widgets/       # Reusable UI components & visual gauges
  ```

---

## 🚀 Cara Menjalankan Aplikasi

### Prasyarat
- Flutter SDK (versi terbaru)
- Chrome Browser (untuk Flutter Web) atau Android Studio / Xcode

### Langkah Instalasi
1. Clone repositori ini:
   ```bash
   git clone https://github.com/<username>/vidyamedic.git
   cd vidyamedic
   ```

2. Unduh dependensi paket:
   ```bash
   flutter pub get
   ```

3. Jalankan aplikasi di browser web:
   ```bash
   flutter run -d chrome
   ```
   *Atau jalankan di emulator Android/iOS*:
   ```bash
   flutter run
   ```

4. Menjalankan pengujian:
   ```bash
   flutter test
   ```

---

## 📄 Lisensi
Didistribusikan di bawah Lisensi MIT. Lihat file `LICENSE` untuk informasi selengkapnya.
