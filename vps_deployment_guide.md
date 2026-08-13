# Panduan Lengkap: Hosting MERN VPS (Dari Nol Hingga Domain)

Panduan ini dibuat secara berurutan langkah demi langkah (*step-by-step*) mulai dari cara koneksi dengan SSH, cloning *project* Git, hingga mengarahkan domain utama ke aplikasi Anda.

---

## TAHAP 1: Membuat SSH Key Lokal & Konek ke VPS

Agar lebih aman dan tidak perlu terus mengetik password saat login ke VPS, kita akan menggunakan SSH Key dari komputer lokal Anda.

### 1. Buat SSH Key di Komputer Anda (Lokal)
Buka terminal/Command Prompt/PowerShell di komputer lokal Anda, ketik:
```bash
ssh-keygen -t rsa -b 4096
```
Tekan **Enter** terus-menerus sampai proses selesai (gunakan lokasi dan password default).

### 2. Copy SSH Key ke VPS Anda
Ketik perintah ini di komputer lokal Anda (ganti `IP_VPS` dengan IP asli VPS Anda):
* **Untuk Windows (PowerShell):**
  ```powershell
  type $env:USERPROFILE\.ssh\id_rsa.pub | ssh root@IP_VPS "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
  ```
* **Untuk Mac/Linux:**
  ```bash
  ssh-copy-id root@IP_VPS
  ```

### 3. Login ke VPS
Sekarang coba login. Anda seharusnya akan langsung masuk tanpa diminta password VPS:
```bash
ssh root@IP_VPS
```

---

## TAHAP 2: Setup Awal & Install Aplikasi Dasar di VPS

Sekarang Anda sudah berada di dalam VPS. Kita perlu menginstal **Git** dan **Docker**. Jalankan baris perintah ini di VPS Anda (kopas baris per baris):

```bash
# 1. Update sistem
sudo apt update && sudo apt upgrade -y

# 2. Install Git & Nginx (Nginx untuk redirect domain nanti)
sudo apt install git nginx certbot python3-certbot-nginx -y

# 3. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 4. Install Docker Compose
sudo apt-get install docker-compose-plugin -y
```

---

## TAHAP 3: Setup SSH untuk GitHub & Clone Project

Jika repositori GitHub Anda bersifat *Private*, VPS memerlukan SSH key agar mendapatkan izin untuk men-clone.

### 1. Buat SSH Key di dalam VPS
*(Pastikan Anda sedang berada di dalam VPS)*
```bash
ssh-keygen -t rsa -b 4096 -C "vps-server"
```
Tekan **Enter** sampai selesai.

### 2. Tampilkan dan Copy SSH Key
```bash
cat ~/.ssh/id_rsa.pub
```
Akan muncul teks panjang (dimulai dengan `ssh-rsa ...`). **Blok dan Copy** teks tersebut.

### 3. Masukkan Key ke Akun GitHub Anda
1. Buka browser di komputer lokal, pergi ke [GitHub SSH Settings](https://github.com/settings/keys).
2. Klik tombol **New SSH Key**.
3. Beri nama "Kunci VPS" dan paste teks yang tadi dicopy ke kolom *Key*.
4. Klik **Add SSH key**.

### 4. Clone Repositori ke VPS
Kembali ke terminal VPS, jalankan perintah clone (ganti dengan link SSH repo Anda):
```bash
git clone git@github.com:username-anda/mern-vp.git
cd mern-vp
```

---

## TAHAP 4: Jalankan Aplikasi MERN

### 1. Setup File .env (Environment Backend)
Karena `.env` biasanya tidak ikut di-*commit* ke GitHub, Anda perlu membuatnya manual di VPS:
```bash
cd api
nano .env
```
Isikan kredensial yang dibutuhkan (sesuaikan dengan lokal Anda):
```env
PORT=3030
MONGO=mongodb://mongodb:27017/healthdevice
JWT_SECRET=rahasiakita123
```
Tekan `Ctrl+X`, lalu `Y`, dan tekan `Enter` untuk menyimpan.

### 2. Jalankan Docker Compose
Kembali ke folder utama proyek dan nyalakan Docker:
```bash
cd ~/mern-vp
docker compose up -d --build
```
> Pada tahap ini, aplikasi Anda sedang berjalan di port `3031` di dalam VPS.

---

## TAHAP 5: Setup Domain & SSL (Redirect)

Agar orang bisa mengakses `https://domainanda.com` dan bukan mengetik IP, ikuti langkah ini:

### 1. Pointing A-Record di Provider Domain
1. Login ke tempat Anda membeli domain (Niagahoster, Rumahweb, dll).
2. Masuk ke menu **DNS Management**.
3. Tambahkan **A Record**:
   - Name/Host: `@`
   - Value/IP: Masukkan `IP_VPS` Anda.
4. Tambahkan satu lagi untuk **www**:
   - Name/Host: `www`
   - Value/IP: Masukkan `IP_VPS` Anda.
*(Tunggu sekitar 5-30 menit agar propagasi DNS berjalan).*

### 2. Buat Virtual Host Nginx di VPS
Kita harus memberitahu Nginx di VPS untuk menangkap *traffic* domain dan mengarahkannya ke Port Docker Anda (3031).
```bash
sudo nano /etc/nginx/sites-available/mern-vp
```
Masukkan konfigurasi berikut (Ganti `domainanda.com` dengan domain asli Anda):
```nginx
server {
    listen 80;
    server_name domainanda.com www.domainanda.com;

    location / {
        proxy_pass http://localhost:3031;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Simpan (`Ctrl+X` -> `Y` -> `Enter`).

### 3. Aktifkan Konfigurasi & Restart Nginx
```bash
sudo ln -s /etc/nginx/sites-available/mern-vp /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```
Sekarang `http://domainanda.com` sudah bisa diakses!

### 4. Install SSL (HTTPS Gratis) agar Aman
Agar gembok hijau muncul (HTTPS), jalankan Certbot:
```bash
sudo certbot --nginx -d domainanda.com -d www.domainanda.com
```
- Masukkan email Anda saat diminta.
- Ketik `Y` untuk menyetujui *Terms of Service*.
- Certbot akan otomatis mengedit konfigurasi Nginx dan me-restartnya.

---

## TAHAP 6: Setup Systemd Timer untuk Background Jobs (Cron)

Aplikasi MERN ini membutuhkan dua *cron job* yang berjalan di latar belakang untuk memproses pipeline data sensor:
- **Layer 2 (Preprocessing)**: Berjalan setiap 3 menit.
- **Layer 3 (Analysis)**: Berjalan setiap 5 menit.

Karena aplikasi dibungkus menggunakan Docker, kita akan memasang *timer* di level OS VPS (menggunakan Systemd) yang secara berkala akan memanggil fungsi di dalam aplikasi.

### 1. Jalankan Script Installer
Kami sudah menyediakan *script* otomatis untuk menginstal layanan ini di VPS. Jalankan dari folder proyek Anda:
```bash
cd ~/mern-vp
sudo bash api/systemd/install-systemd-timers.sh
```
*Pastikan Anda sudah menjalankan perintah `docker compose up -d` (Tahap 4) sebelum menjalankan script ini, karena timer akan mencoba memanggil API di port 3030.*

### 2. Cek Status Timer
Untuk memastikan bahwa timer sudah berhasil diinstal dan diatur jadwalnya:
```bash
systemctl list-timers --all | grep mern
```
Anda akan melihat jadwal eksekusi selanjutnya untuk `mern-pipeline-layer2.timer` dan `mern-pipeline-layer3.timer`.

### 3. Cek Log Eksekusi
Jika Anda ingin melihat aktivitas log pemrosesan dari sistem yang berjalan di latar belakang:
- Log Layer 2: `journalctl -u mern-pipeline-l2 -f`
- Log Layer 3: `journalctl -u mern-pipeline-l3 -f`

**Selesai!** Aplikasi Anda sekarang sudah bisa diakses secara publik menggunakan `https://domainanda.com` dan otomatis memproses data setiap saat.
