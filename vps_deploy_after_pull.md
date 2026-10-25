# Deploy Vidyamedic setelah `git pull`

Jalankan perintah berikut di VPS dari root repository.

## 1. Siapkan environment produksi

File `.env.production` berisi secret dan tidak boleh dimasukkan ke Git. Buat
dari template hanya jika belum ada; jika sudah ada, pertahankan secret dan
volume MongoDB yang sedang digunakan.

```bash
cd ~/mern-vp
test -f .env.production || cp .env.example .env.production
nano .env.production
```

Pastikan nilai berikut sudah diisi:

```dotenv
MONGO_INITDB_ROOT_USERNAME=<user-mongodb>
MONGO_INITDB_ROOT_PASSWORD=<password-kuat>
MONGO=mongodb://<user-mongodb>:<password-url-encoded>@mongodb:27017/healthdevice?authSource=admin
PORT=3030
NODE_ENV=production
JWT_SECRET=<secret-acak-minimal-32-karakter>
INTERNAL_KEY=<kunci-acak>
ALLOWED_ORIGINS=https://vidyamedic.my.id,https://www.vidyamedic.my.id
```

Jangan mengganti kredensial MongoDB jika volume data yang sudah ada
diinisialisasi dengan user/password berbeda. Jika password berisi karakter
khusus, URL-encode nilainya pada `MONGO`.

## 2. Perbarui dan jalankan container

```bash
git pull origin main
docker compose --env-file .env.production up -d --build --remove-orphans
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail=100 api
```

Compose mengikat API pada `127.0.0.1:3030` dan web pada `127.0.0.1:8080`.
Jangan mengubah bind address menjadi `0.0.0.0`; trafik publik harus masuk
melalui Nginx VPS dan HTTPS.

## 3. Konfigurasi Nginx dan HTTPS

Pastikan DNS A record berikut menunjuk ke IP VPS `202.10.42.153`:

- `vidyamedic.my.id`
- `www.vidyamedic.my.id`
- `api.vidyamedic.my.id`

Pasang reverse proxy yang disediakan repository:

```bash
sudo cp ~/mern-vp/deploy/nginx/vidyamedic.conf /etc/nginx/sites-available/vidyamedic
sudo ln -s /etc/nginx/sites-available/vidyamedic /etc/nginx/sites-enabled/vidyamedic
sudo nginx -t
sudo systemctl reload nginx
```

Setelah DNS terpropagasi dan port 80/443 terbuka:

```bash
sudo certbot --nginx --redirect \
  -d vidyamedic.my.id \
  -d www.vidyamedic.my.id \
  -d api.vidyamedic.my.id
sudo nginx -t
sudo systemctl reload nginx
```

## 4. Verifikasi

```bash
curl --fail https://api.vidyamedic.my.id/api/health
curl --fail https://vidyamedic.my.id/
docker compose --env-file .env.production ps
```

Health check yang diharapkan berisi `"success":true` dan `"status":"OK"`.
Endpoint aplikasi/API tersedia melalui `https://api.vidyamedic.my.id/api`;
web menggunakan API lewat reverse proxy HTTPS.

Jika aplikasi Flutter masih menyimpan URL backend lama secara manual, versi
Vidyamedic yang diperbarui akan memigrasikannya ke subdomain API yang baru.
