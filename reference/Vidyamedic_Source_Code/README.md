# VIDYAMEDIC — Web + Android/iOS + Backend (SOURCE CODE)

**Versi:** prototype 1.0 | Semua nilai dan profil merupakan **data sintetis**. Aplikasi **bukan** perangkat medis, tidak membuat diagnosis, dan belum layak menyimpan data pasien.

## Paket

| Folder | Isi |
|---|---|
| `backend/` | FastAPI REST API, generator data wearable sintetis, SQLite check-in dan daftar tindakan, unduh CSV, pengujian |
| `web/` | 8 halaman web dari mockup sebelumnya + penghubung ke API |
| `mobile/` | Aplikasi Expo React Native: Beranda, Hari Ini, Insight, Tanya AI, Profil |

## Persyaratan

- Python 3.10+ dan Node.js 22.13+ (untuk Expo SDK 57)
- Android: Expo Go atau Android emulator; iOS: Expo Go atau simulator di macOS
- Telepon dan laptop berada pada jaringan Wi-Fi/LAN yang sama jika menggunakan Expo Go di perangkat nyata.

## 1. Jalankan backend dan web

Buka terminal di root folder ZIP ini:

```bash
cd backend
python -m venv .venv
# macOS / Linux:
source .venv/bin/activate
# Windows PowerShell:
# .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Buka:
- **Web dashboard:** `http://localhost:8000/`
- **API documentation (Swagger):** `http://localhost:8000/docs`
- **Status server:** `http://localhost:8000/api/health`

Web mempertahankan 8 menu interaktif dari mockup. Data klinis di seluruh widget asli mockup tetap contoh; indikator **API terhubung** menampilkan nilai API. Klarifikasi konteks, percakapan AI, penandaan tindakan, dan unduh CSV telah menggunakan backend.

## 2. Jalankan aplikasi Android/iOS

Buka **terminal kedua**, tanpa mematikan backend:

```bash
cd mobile
npm install
```

Edit file `mobile/.env` (salin dari `.env.example`) lalu isi alamat backend:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000
```

Ganti `192.168.1.10` dengan IP LAN komputer yang menjalankan backend. Cara menemukan IP: `ipconfig` (Windows), `ipconfig getifaddr en0` (Mac dengan Wi-Fi), atau `hostname -I` (Linux).

Jika memakai **Android emulator** pada komputer yang sama, gunakan `http://10.0.2.2:8000`. Jika memakai **iOS simulator**, gunakan `http://localhost:8000`. **Jangan menggunakan `localhost` di HP fisik**, karena itu mengarah ke telepon sendiri.

```bash
npm run start
```

Pindai QR yang tampil dengan Expo Go (atau pilih Android/iOS simulator). Jika alamat API diubah, restart Expo.

## 3. Uji backend

Dari `backend/` ketika environment aktif:

```bash
pytest -q
```

## Arsitektur dan alur

```text
Wearable generator (SYNTHETIC)
       │
       ▼
FastAPI /api/... ── SQLite (check-in, tindakan)
       ├── Web: 8 halaman interaktif
       └── Expo Mobile: 5 layar, interaksi AI & konfirmasi konteks

L1 Sensing → L2 Personal baseline & BI → L3 Evidence & AI rules → L4 Recommendation + Human feedback
                                                                  └─────────┘
```

**REST API:** GET `/api/dashboard`, `/api/profile`, `/api/monitoring`, `/api/bi?days=7|30|90`, `/api/ai/insights`, `/api/recommendations`, `/api/admin/status`, `/api/reports/export.csv`; POST `/api/checkins`, `/api/ai/chat`, `/api/recommendations/{id}/complete`.

## Menggunakan wearable asli (pengembangan berikutnya)

Ganti `generate_series()` pada `backend/main.py` dengan service ingest terautentikasi; lakukan *timestamp alignment*, kontrol kualitas RR/IBI, provenance, consent, dan koneksi SDK perangkat (misalnya Polar BLE native/mobile bridge atau API wearable yang diizinkan). **Belum ada integrasi Bluetooth wearable sebenarnya dalam source ini.**

## Batasan kritis

1. **Tidak untuk produksi atau data pasien.** API belum memiliki login, otorisasi, enkripsi tingkat aplikasi, audit keamanan, atau manajemen persetujuan nyata. Database SQLite menyimpan check-in lokal tanpa enkripsi tingkat aplikasi.
2. **AI adalah aturan penjelasan demonstrasi**, bukan LLM klinis, model diagnosis, atau rekomendasi terapi.
3. Baseline, recovery, skor dan episode belum tervalidasi; jangan digunakan untuk keputusan medis.
4. CORS disetel untuk origin pengembangan localhost. Gunakan HTTPS, autentikasi, validasi sumber dan standar perlindungan data sebelum deployment.
5. Untuk penggunaan nyata, diperlukan verifikasi klinis, uji keselamatan, akses berbasis peran, audit dan dokumentasi regulatori.

## Debugging

- Mobile **Network request failed** → backend belum aktif, IP salah, ponsel berbeda Wi-Fi, atau firewall memblokir port 8000.
- Jika web dibuka melalui `file://`, fitur backend tidak aktif. Jalankan dan buka via `http://localhost:8000/`.
- `expo` dependency mismatch → jalankan `npx expo install --fix` dan `npx expo-doctor` untuk menyelaraskan paket sesuai SDK.
