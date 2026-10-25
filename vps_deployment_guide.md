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

### 1. Siapkan `.env`
File environment ini tidak ikut di-*commit*. Buat dari template dan isi
kredensial yang sudah digunakan di server:
```bash
cd /opt/apps/mern-vp
test -f .env || cp .env.example .env
nano .env
```
Konfigurasikan variabel aplikasi berikut. Agar API memakai MongoDB lokal VPS
(service Compose `mongodb`) dan bukan Atlas, atur `MONGO` ke URI database lokal
yang memang sudah berisi data/aplikasi. Gunakan kredensial MongoDB yang sudah
berlaku dan database yang benar; jangan mengubah service, kredensial, atau
volume MongoDB di `docker-compose.yml`:
```env
PORT=3030
NODE_ENV=production
MONGO=mongodb://<user-lokal>:<password-URL-encoded>@mongodb:27017/<database-lokal>?authSource=admin
JWT_SECRET=<secret-acak-minimal-32-karakter>
INTERNAL_KEY=<kunci-acak>
ALLOWED_ORIGINS=https://vidyamedic.my.id,https://www.vidyamedic.my.id
```
Jangan gunakan `localhost` sebagai host Mongo pada URI API karena `localhost`
di dalam container API bukan container MongoDB. Host `mongodb` mengarah ke
service MongoDB VPS pada jaringan Compose. Jangan jalankan `docker compose
down -v`; volume database harus tetap dipertahankan.

### 2. Jalankan Docker Compose
Kembali ke folder utama proyek dan nyalakan Docker:
```bash
docker compose up -d --build --remove-orphans
docker compose ps
```
Frontend Vidyamedic dan API hanya dipublikasikan di loopback VPS:
`127.0.0.1:8080` dan `127.0.0.1:3030`. Host Nginx menjadi satu-satunya jalur
akses publik dan meneruskan domain web/API ke kedua port tersebut.

Untuk mengganti container `capar-web` lama, gunakan `--remove-orphans` agar
Compose menghentikan container frontend lama yang tidak lagi didefinisikan.

### Memperbarui backend setelah perubahan kode
Setelah perubahan backend wearable tersedia di branch yang dipakai VPS, jalankan:
```bash
cd ~/mern-vp
git pull
docker compose up -d --build api
docker compose logs --tail=100 api
```
Endpoint stream Polar menyimpan bacaan nyata ke MongoDB `PolarData` sebelum
meneruskannya ke RabbitMQ. Log backend akan mencatat jumlah bacaan baru yang
tersimpan; bila RabbitMQ tidak tersedia, respons tetap menyatakan bahwa bacaan
sudah tersimpan tetapi pemrosesan lanjutan belum menerima batch.

---

## TAHAP 5: Domain Vidyamedic & SSL

DNS A record untuk `vidyamedic.my.id`, `www.vidyamedic.my.id`, dan
`api.vidyamedic.my.id` harus mengarah ke `202.10.42.153`. Pastikan firewall VPS
membuka port 80 dan 443.

### 1. Pasang konfigurasi reverse proxy
Setelah container menyala, salin konfigurasi HTTP yang disediakan:
```bash
sudo cp ~/mern-vp/deploy/nginx/vidyamedic.conf /etc/nginx/sites-available/vidyamedic
sudo ln -s /etc/nginx/sites-available/vidyamedic /etc/nginx/sites-enabled/vidyamedic
sudo nginx -t
sudo systemctl reload nginx
```
Konfigurasi meneruskan web `vidyamedic.my.id` dan `www` ke port loopback 8080,
serta API `api.vidyamedic.my.id` ke port loopback 3030 (termasuk Socket.IO).

### 2. Aktifkan HTTPS
Tunggu sampai ketiga DNS A record dapat di-resolve ke IP VPS, kemudian jalankan:
```bash
sudo certbot --nginx --redirect \
  -d vidyamedic.my.id \
  -d www.vidyamedic.my.id \
  -d api.vidyamedic.my.id
sudo nginx -t
sudo systemctl reload nginx
```
Certbot memasang sertifikat dan redirect HTTP ke HTTPS. API publik kemudian
tersedia di `https://api.vidyamedic.my.id/api`.

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
*Pastikan Docker Compose sudah berjalan (Tahap 4) sebelum menjalankan script ini,
karena timer memanggil API pada port loopback VPS 3030.*

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

**Selesai!** Aplikasi tersedia di `https://vidyamedic.my.id` dan API di
`https://api.vidyamedic.my.id`, serta otomatis memproses data sesuai jadwal.
