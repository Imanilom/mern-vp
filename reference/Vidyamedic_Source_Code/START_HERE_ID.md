# Cara Menjalankan VIDYAMEDIC (Panduan Singkat)

Paket ini memiliki **3 komponen**: backend API Python, web 8 halaman, dan app mobile 5 layar.

### Terminal 1 — Backend dan Web

```bash
cd backend
python -m venv .venv
source .venv/bin/activate       # Mac/Linux
# .venv\Scripts\Activate.ps1  # Windows PowerShell
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Buka **http://localhost:8000** untuk web dan **http://localhost:8000/docs** untuk menguji API.

### Terminal 2 — App Android/iOS

```bash
cd mobile
npm install
```

Salin `.env.example` menjadi `.env`, lalu ganti IP LAN:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.10:8000
```

Jalankan:

```bash
npm start
```

Pindai QR menggunakan Expo Go. Pastikan HP dan laptop memakai Wi-Fi yang sama. Emulator Android memakai `http://10.0.2.2:8000`.

### Yang bisa dicoba

1. Pilih menu Web **Rekomendasi & Keputusan**, klik **Klarifikasi aktivitas**, lalu simpan.
2. Buka aplikasi mobile **Hari Ini** dan lakukan refresh; status klarifikasi tersinkron melalui backend.
3. Buka **Tanya AI**, kirim *Mengapa HR naik?* (respons dari aturan demonstrasi API).
4. Buka **Business Intelligence** di web atau **Insight** di mobile, tinjau metrik simulasi.
5. Unduh CSV lewat menu Laporan web.

**Penting:** semua data wearable sintetis. Belum tersambung Bluetooth/API wearable nyata, belum ada autentikasi, bukan perangkat medis. Baca `README.md` untuk arsitektur dan batas keamanan.
