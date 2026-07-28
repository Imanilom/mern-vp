# Panduan Deploy ke Server setelah `git pull`

> Jalankan langkah-langkah ini secara berurutan di **VPS/server** via SSH.

---

## ⚠️ Penting: Perubahan yang Memerlukan Aksi Manual

Setelah `git pull`, terdapat perubahan yang **tidak bisa otomatis** karena menyangkut file secret:

| Perubahan | Dampak |
|-----------|--------|
| `docker-compose.yml` kini pakai `env_file: .env.production` | File `.env.production` **wajib ada** di server |
| `api/.env` dihapus dari Git | Server mungkin kehilangan file `.env` jika sebelumnya bergantung padanya |
| `Dockerfile` multi-stage + non-root user | Perlu `docker compose build --no-cache` |
| Paket baru: `helmet`, `express-rate-limit` | Sudah ada di `package.json`, ikut ter-build |

---

## Langkah 1 — SSH ke Server

```bash
ssh user@your-server-ip
cd /path/to/mern-vp
```

---

## Langkah 2 — Buat `.env.production` di Server

> [!CAUTION]
> File ini **WAJIB ada** sebelum menjalankan `docker compose up`. Tanpa file ini, Docker akan error karena variabel environment tidak terdefinisi.

```bash
# Buat file .env.production dari template
cp .env.example .env.production

# Edit dengan nilai yang sebenarnya
nano .env.production
```

**Isi wajib yang harus diubah dari placeholder:**

```bash
# MongoDB credentials untuk Docker internal
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=GantiDenganPasswordKuat123!

# Connection string (sesuaikan dengan password di atas)
MONGO=mongodb://admin:GantiDenganPasswordKuat123!@mongodb:27017/healthdevice?authSource=admin

# JWT Secret — generate dulu dengan perintah ini:
# node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=hasil_generate_di_atas

# CORS: domain frontend yang diizinkan
ALLOWED_ORIGINS=https://domain-kamu.com,http://localhost:3031

# Internal Key — generate dulu:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
INTERNAL_KEY=hasil_generate_di_atas
```

---

## Langkah 3 — `git pull`

```bash
git pull origin main
```

---

## Langkah 4 — Stop Container yang Berjalan

```bash
docker compose down
```

---

## Langkah 5 — Rebuild Docker (wajib karena Dockerfile berubah)

```bash
# --no-cache penting agar layer lama tidak dipakai
docker compose build --no-cache
```

> Proses ini memakan waktu 3–10 menit karena kompilasi native module (`canvas`).

---

## Langkah 6 — Jalankan Container

```bash
docker compose up -d
```

---

## Langkah 7 — Verifikasi

```bash
# Cek semua container berjalan
docker compose ps

# Cek log backend (pastikan tidak ada error)
docker compose logs backend --tail=50

# Cek health endpoint
curl http://localhost:3030/api/health
# Expected: {"success":true,"status":"OK","timestamp":"..."}
```

---

## Checklist Sebelum Selesai

- [ ] File `.env.production` sudah dibuat dan diisi dengan nilai asli
- [ ] `MONGO_INITDB_ROOT_PASSWORD` sudah diganti dari placeholder
- [ ] `JWT_SECRET` sudah di-generate ulang (bukan nilai lama yang bocor)
- [ ] `INTERNAL_KEY` sudah di-generate ulang
- [ ] `ALLOWED_ORIGINS` sudah diisi domain frontend
- [ ] `docker compose ps` menunjukkan semua container `Up`
- [ ] `curl http://localhost:3030/api/health` mengembalikan `{"success":true}`

---

## Catatan Keamanan — Ganti Credentials Lama!

Karena `api/.env` sebelumnya ter-commit ke Git, credentials lama sudah bocor:
- MongoDB password lama: `Imam123imam!`
- JWT Secret lama: `asnjkKkjsnklnly1xcx?23r`
- Internal Key lama: `mern-vp-internal-systemd-2026`

Wajib ganti semua nilai ini dengan yang baru di `.env.production`.
