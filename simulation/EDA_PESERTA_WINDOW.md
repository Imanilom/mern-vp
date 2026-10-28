# EDA data peserta dalam satu window

`eda_peserta_window.py` mengambil data `polardatas` untuk satu Mongo ObjectId
dan rentang waktu WIB, lalu menyimpan ringkasan JSON dan tiga grafik lokal.
Rentang default: 28 Oktober 2026, 08:00 sampai sebelum 09:30 WIB. File CSV
per-bacaan hanya dibuat jika opsi `--export-csv` diminta.

## Jalankan melalui SSH tunnel

1. Pasang dependensi:

   ```powershell
   python -m pip install -r simulation\requirements_eda.txt
   ```

2. Dari terminal terpisah, buka tunnel SSH ke VPS (ganti user dan host sesuai
   akses Anda):

   ```powershell
   ssh -N -L 27018:127.0.0.1:27017 <ssh-user>@<vps-host>
   ```

   Jika MongoDB VPS mendengarkan pada host/port lain, sesuaikan alamat tujuan
   `127.0.0.1:27017` pada perintah tunnel.

3. Atur `SIM_MONGO_URI` di terminal yang akan menjalankan skrip. URI harus
   menunjuk ke port lokal `27018`, database `test`, dan konfigurasi auth yang
   sesuai. Gunakan secret store/environment lokal; jangan menyimpan kredensial
   di source code atau commit ke repository.

4. Jalankan:

   ```powershell
   python simulation\eda_peserta_window.py
   ```

Tanggal dan jam dapat diganti, tetap menggunakan WIB:

```powershell
python simulation\eda_peserta_window.py --date 2026-10-28 --start 08:00 --end 09:30
```

Keluaran default berada di `simulation\outputs\eda_6a8f9fab_20261028_0800_0930`.
Grafik dan ringkasan hanya memuat informasi agregat; data bacaan individual
tidak disimpan kecuali `--export-csv` ditentukan secara eksplisit.

## Backfill RMSSD ke MongoDB

`backfill_polar_rrms.py` menghitung RMSSD rolling 60 detik dari interval RR
berurutan untuk window peserta tersebut. Perhitungan di-reset bila aktivitas
berubah atau jeda antarbacaan lebih dari 30 detik. Ini berbeda dari agregat
per-menit yang digunakan pada EDA.

Skrip hanya menargetkan user dan rentang waktu yang diberikan, dan secara
default berjalan dalam mode dry-run:

```powershell
python simulation\backfill_polar_rrms.py
```

Tinjau jumlah kandidat, lalu tambahkan `--apply` untuk mengisi nilai `rrms`
yang masih null/hilang. Nilai yang sudah ada tidak ditimpa:

```powershell
python simulation\backfill_polar_rrms.py --apply
```
