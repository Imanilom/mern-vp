# Dokumentasi API - VidyaMedic

Dokumen ini memuat daftar lengkap rute API (*endpoints*) yang tersedia di backend proyek **VidyaMedic**, beserta fungsi, metode HTTP, dan status verifikasi keamanannya.

Seluruh rute dasar (*base URL*) diarahkan ke: `http://<host>:<port>/api` (Default lokal: `http://localhost:3030/api` atau domain ngrok terkonfigurasi).

---

## Ringkasan Modul API

| Modul | Endpoint Utama | Deskripsi |
| :--- | :--- | :--- |
| [1. Autentikasi (`Auth`)](#1-autentikasi-auth) | `/api/auth` | Manajemen pendaftaran, login, logout, dan integrasi Google Sign-In. |
| [2. Pengguna & Metrik (`User`)](#2-pengguna--metrik-user) | `/api/user` | Profil pengguna, histori aktivitas, metrik harian, dan riwayat deteksi DFA. |
| [3. Integrasi Garmin (`Garmin`)](#3-integrasi-garmin-garmin) | `/api/garmin` | Webhook receiver untuk sinkronisasi otomatis berbagai data dari ekosistem Garmin. |
| [4. Aktivitas (`Activity`)](#4-aktivitas-activity) | `/api/activity` | CRUD pencatatan aktivitas fisik pasien. |
| [5. Rekomendasi Medis (`Recommendation`)](#5-rekomendasi-medis-recommendation) | `/api/recomendation` | Pembuatan dan pengelolaan rekomendasi medis oleh dokter kepada pasien. |
| [6. Aksi Rekomendasi (`Action`)](#6-aksi-rekomendasi-action) | `/api/action/recomendation` | Pelacakan penyelesaian tugas/tindakan rekomendasi medis oleh pasien. |
| [7. Anamnesa & Riwayat Medis](#7-anamnesa--riwayat-medis) | `/api/anamnesa` | Manajemen rekam medis pasien, anamnesa, dan catatan klinis. |
| [8. Manajemen Pasien (`Patient`)](#8-manajemen-pasien-patient) | `/api/patient` | Pengelolaan data pasien yang terdaftar di bawah pengawasan klinis. |
| [9. Janji Temu (`Appointment`)](#9-janji-temu-appointment) | `/api/appointment` | Manajemen jadwal konsultasi dan alur persetujuan janji temu. |
| [10. Faktor Prediksi (`Prediction`)](#10-faktor-prediksi-prediction) | `/api/predictionfactor` | Pengelolaan data prediksi faktor risiko kesehatan pasien. |
| [11. Rencana Perawatan (`Treatment`)](#11-rencana-perawatan-treatment) | `/api/treatment` | Penyusunan, pengaktifan, dan pembaruan rencana perawatan medis. |
| [12. Pengambilan Data Fisiologis (`Data`)](#12-pengambilan-data-fisiologis-data) | `/api/data` | Akses data sensor mentah (*raw*) dan tersaring (*filtered*). |
| [13. Faktor Risiko Lab (`Risk Factors`)](#13-faktor-risiko-lab-risk-factors) | `/api/faktorresiko` | Pencatatan hasil pemeriksaan lab dan pengunggahan berkas penunjang. |
| [14. Upload Log Wearable (`Logs`)](#14-upload-log-wearable-logs) | `/api/log` | Endpoint pengunggahan berkas CSV rekaman sensor perangkat wearable (detak jantung). |
| [15. Dashboard Analisis (`Analysis`)](#15-dashboard-analisis-analysis) | `/api/analysis` | Engine utama visualisasi grafik detak jantung, event anomali, baseline klinis, dan metrik evaluasi. |
| [16. Manajemen Pipeline (`Pipeline`)](#16-manajemen-pipeline-pipeline) | `/api/pipeline` | Monitoring status pemrosesan data real-time, RabbitMQ, dan kontrol antrean (*queue*). |

---

## Detail Rute per Modul

### 1. Autentikasi (`Auth`)
Mengelola alur registrasi, login, dan autentikasi pengguna.

*   **`POST /auth/signup`**
    *   **Deskripsi:** Mendaftarkan akun pengguna baru.
    *   **Token/Verifikasi:** Tidak.
*   **`POST /auth/signin`**
    *   **Deskripsi:** Masuk log (*login*) menggunakan username/email & password.
    *   **Token/Verifikasi:** Tidak (menghasilkan cookie/token JWT).
*   **`GET /auth/signout`**
    *   **Deskripsi:** Keluar log (*logout*) dan menghapus token JWT.
    *   **Token/Verifikasi:** Tidak.
*   **`POST /auth/google`**
    *   **Deskripsi:** Masuk log menggunakan metode Google Sign-In.
    *   **Token/Verifikasi:** Tidak.

---

### 2. Pengguna & Metrik (`User`)
Mengatur manajemen data profil pengguna dan kalkulasi metrik/DFA.

*   **`GET /user/testLogActivity`**
    *   **Deskripsi:** Mengambil riwayat log aktivitas fisik pengguna.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`POST /user/pushActivity`**
    *   **Deskripsi:** Mengirimkan/menyimpan aktivitas olahraga baru.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /user/logdfa`**
    *   **Deskripsi:** Mendapatkan hasil perhitungan DFA (*Detrended Fluctuation Analysis*) dari log sensor.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /user/dfa/activity`**
    *   **Deskripsi:** Mengambil metrik DFA berdasarkan tipe aktivitas spesifik.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /user/metrics/:device`**
    *   **Deskripsi:** Mengambil metrik harian berdasarkan ID perangkat wearable.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /user/riwayatdeteksi/:userId`**
    *   **Deskripsi:** Mengambil histori hasil analisis deteksi anomali dengan DFA.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`POST /user/update/:id`**
    *   **Deskripsi:** Memperbarui informasi profil pengguna.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`DELETE /user/delete/:id`**
    *   **Deskripsi:** Menghapus akun pengguna dari sistem.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /user/:id`**
    *   **Deskripsi:** Mengambil data profil lengkap pengguna tertentu.
    *   **Token/Verifikasi:** Ya (Token JWT).

---

### 3. Integrasi Garmin (`Garmin`)
Kumpulan webhook receiver untuk menerima sinkronisasi data dari Garmin. Seluruh endpoint menggunakan metode **`POST`** dan **tidak memerlukan token otentikasi internal** (karena dipanggil secara langsung oleh server Garmin).

| Rute Endpoint | Fungsi / Sumber Data Garmin |
| :--- | :--- |
| `/garmin/getPingbodycomposition` | Menerima data komposisi tubuh (berat badan, lemak, dll.). |
| `/garmin/getPingdailies` | Menerima ringkasan data aktivitas harian. |
| `/garmin/getPingderegistration` | Menerima notifikasi penghapusan integrasi akun Garmin oleh pengguna. |
| `/garmin/getPingepochs` | Menerima data aktivitas resolusi tinggi (epoch data). |
| `/garmin/getPingpulseox` | Menerima data saturasi oksigen (Pulse Oximetry). |
| `/garmin/getPingrespiration` | Menerima data laju pernapasan (Respiration). |
| `/garmin/getPingsleeps` | Menerima data analisis tidur pengguna. |
| `/garmin/getPingstress` | Menerima tingkat stres harian pengguna. |
| `/garmin/getPingthirdpartydailies` | Menerima ringkasan aktivitas dari aplikasi pihak ketiga terhubung. |
| `/garmin/getPinguser` | Menerima notifikasi perubahan info profil user Garmin. |
| `/garmin/getPingusermetrics` | Menerima statistik metrik khusus pengguna. |
| `/garmin/getPingbloodpressure` | Menerima data tekanan darah. |
| `/garmin/getPinghrvsummary` | Menerima ringkasan data HRV (Heart Rate Variability). |
| `/garmin/getPinghealthsanpshot` | Menerima data Health Snapshot (rekaman instan kondisi tubuh). |
| `/garmin/getPingactivites` | Menerima log daftar aktivitas/olahraga. |
| `/garmin/getPingactivitesdetails` | Menerima rincian per-aktivitas (koordinat GPS, rincian lap). |
| `/garmin/getPingactivitesfiles` | Mengunduh file mentah aktivitas (format FIT/TCX). |
| `/garmin/getPingactivitesmovelQ` | Menerima aktivitas Move IQ (deteksi olahraga otomatis). |
| `/garmin/getPingmanuallyupdatedactivites`| Menerima pembaruan log aktivitas yang diubah manual oleh pengguna. |

---

### 4. Aktivitas (`Activity`)
Manajemen pencatatan aktivitas fisik klinis maupun mandiri.

*   **`GET /activity/getActivity`**
    *   **Deskripsi:** Mengambil semua daftar aktivitas pengguna bersangkutan.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /activity/getActivity/:patient`**
    *   **Deskripsi:** Mengambil riwayat aktivitas pasien tertentu (diakses oleh Dokter).
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /activity/get/:id`**
    *   **Deskripsi:** Mengambil detail lengkap satu data aktivitas berdasarkan ID.
    *   **Token/Verifikasi:** Tidak.
*   **`POST /activity/create`**
    *   **Deskripsi:** Membuat entri pencatatan aktivitas baru.
    *   **Token/Verifikasi:** Tidak.
*   **`POST /activity/update/:id`**
    *   **Deskripsi:** Mengubah data pencatatan aktivitas tertentu.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`DELETE /activity/delete/:id`**
    *   **Deskripsi:** Menghapus data pencatatan aktivitas.
    *   **Token/Verifikasi:** Ya (Token JWT).

---

### 5. Rekomendasi Medis (`Recommendation`)
Fasilitas dokter untuk memberikan anjuran medis/kegiatan kepada pasien.

*   **`POST /recomendation/create`**
    *   **Deskripsi:** Membuat rekomendasi medis baru untuk pasien.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`POST /recomendation/update/:id`**
    *   **Deskripsi:** Mengubah isi rekomendasi medis yang sudah dibuat.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /recomendation/getAll/:patient`**
    *   **Deskripsi:** Mengambil semua rekomendasi yang terdaftar untuk satu pasien tertentu.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /recomendation/getOne/:id`**
    *   **Deskripsi:** Mengambil detail isi satu rekomendasi medis secara spesifik.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`DELETE /recomendation/delete/:id/:pasient_id`**
    *   **Deskripsi:** Menghapus rekomendasi medis dari daftar pasien.
    *   **Token/Verifikasi:** Ya (Token JWT).

---

### 6. Aksi Rekomendasi (`Action`)
Pelacakan pelaksanaan instruksi dokter oleh pasien.

*   **`POST /action/recomendation/check`**
    *   **Deskripsi:** Menandai aksi rekomendasi tertentu telah diselesaikan oleh pasien.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`POST /action/recomendation/uncheck`**
    *   **Deskripsi:** Membatalkan status penyelesaian aksi rekomendasi.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /action/recomendation/listPatient/:activity_id`**
    *   **Deskripsi:** Menampilkan daftar pasien yang melakukan aksi berdasarkan tipe aktivitas tertentu.
    *   **Token/Verifikasi:** Ya (Token JWT).

---

### 7. Anamnesa & Riwayat Medis
Pencatatan klinis mengenai keluhan dan riwayat kesehatan pasien.

*   **`POST /anamnesa/riwayatmedis`**
    *   **Deskripsi:** Membuat data induk riwayat medis baru untuk pasien.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /anamnesa/getanamnesa/:id`**
    *   **Deskripsi:** Mengambil daftar riwayat medis/anamnesa dari pasien berdasarkan ID pasien.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`DELETE /anamnesa/deleteriwayat/:id`**
    *   **Deskripsi:** Menghapus data riwayat medis pasien.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /anamnesa/getOneAnamnesa/:id`**
    *   **Deskripsi:** Mengambil detail rinci satu catatan anamnesa (diakses Admin/Dokter).
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`POST /anamnesa/createAnamnesa/:riwayatid`**
    *   **Deskripsi:** Menambahkan catatan anamnesa baru di bawah riwayat medis tertentu.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`POST /anamnesa/updateAnamnesa/:id`**
    *   **Deskripsi:** Mengubah isi catatan anamnesa yang telah dibuat.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`DELETE /anamnesa/deleteAnamnesa/:id`**
    *   **Deskripsi:** Menghapus entri catatan anamnesa.
    *   **Token/Verifikasi:** Ya (Token JWT).

---

### 8. Manajemen Pasien (`Patient`)
Hubungan pengawasan antara Dokter dengan pengguna aplikasi (Pasien).

*   **`GET /patient/all`**
    *   **Deskripsi:** Mengambil semua daftar pasien terdaftar di sistem.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /patient/add/pasient`**
    *   **Deskripsi:** Mengambil daftar pengguna terdaftar yang statusnya belum diubah menjadi pasien.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`POST /patient/add/pasient`**
    *   **Deskripsi:** Mengaitkan/mendaftarkan akun pengguna menjadi pasien baru.
    *   **Token/Verifikasi:** Ya (Token JWT).

---

### 9. Janji Temu (`Appointment`)
Sistem pemesanan jadwal pertemuan antara pasien dan dokter.

*   **`POST /appointment/requestAppointment`**
    *   **Deskripsi:** Diajukan oleh Pasien untuk memesan jadwal janji temu dengan Dokter.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`POST /appointment/acceptAppointment`**
    *   **Deskripsi:** Dipanggil oleh Dokter untuk menyetujui sekaligus mengesahkan jadwal janji temu.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`POST /appointment/endedAppointment`**
    *   **Deskripsi:** Menutup janji temu yang telah selesai dilaksanakan secara klinis.
    *   **Token/Verifikasi:** Ya (Token JWT).

---

### 10. Faktor Prediksi (`Prediction`)
Alat prediksi indikator risiko kesehatan pasien.

*   **`GET /predictionfactor/getinfo`**
    *   **Deskripsi:** Mengambil rangkuman informasi faktor prediksi kesehatan pasien.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`POST /predictionfactor/sendinfo`**
    *   **Deskripsi:** Membuat/mengirim data hasil pengujian faktor prediksi.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`DELETE /predictionfactor/deleteinfo/:id`**
    *   **Deskripsi:** Menghapus catatan faktor prediksi tertentu.
    *   **Token/Verifikasi:** Ya (Token JWT).

---

### 11. Rencana Perawatan (`Treatment`)
Siklus perawatan jangka panjang bagi pasien kronis/pemantauan.

*   **`GET /treatment/getTreatment/:patient`**
    *   **Deskripsi:** Mengambil riwayat rencana perawatan dari satu pasien.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /treatment/:id`**
    *   **Deskripsi:** Mengambil detail isi dari satu rencana perawatan spesifik.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`POST /treatment/createTreatment`**
    *   **Deskripsi:** Menyusun dan membuat rencana perawatan baru.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`POST /treatment/switchTreatment`**
    *   **Deskripsi:** Mengaktifkan atau menonaktifkan status rencana perawatan (aktif/selesai).
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`POST /treatment/UpdateTreatment`**
    *   **Deskripsi:** Mengubah konten instruksi dalam rencana perawatan.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`DELETE /treatment/:id`**
    *   **Deskripsi:** Menghapus rencana perawatan dari database.
    *   **Token/Verifikasi:** Ya (Token JWT).

---

### 12. Pengambilan Data Fisiologis (`Data`)
Pengambilan rekaman detak jantung langsung dari database.

*   **`GET /data/filtered-raw`**
    *   **Deskripsi:** Mengambil gabungan data sensor yang telah difilter beserta data mentahnya.
    *   **Token/Verifikasi:** Tidak.
*   **`GET /data/daily-data`**
    *   **Deskripsi:** Mengambil statistik data kesehatan harian.
    *   **Token/Verifikasi:** Tidak.

---

### 13. Faktor Risiko Lab (`Risk Factors`)
Modul rekam medis untuk pemeriksaan laboratorium.

*   **`GET /faktorresiko/labs/:patientid`**
    *   **Deskripsi:** Mengambil semua riwayat pemeriksaan laboratorium pasien.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /faktorresiko/docs/:lab`**
    *   **Deskripsi:** Mengambil lampiran dokumen/berkas hasil lab spesifik.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`POST /faktorresiko/createLab`**
    *   **Deskripsi:** Mencatat entri pemeriksaan lab baru.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`POST /faktorresiko/fillDoc`**
    *   **Deskripsi:** Mengunggah file berkas PDF/Gambar hasil laboratorium ke server.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`DELETE /faktorresiko/lab/:id`**
    *   **Deskripsi:** Menghapus baris rekam pemeriksaan lab.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`DELETE /faktorresiko/lab/doc/:id`**
    *   **Deskripsi:** Menghapus berkas dokumen lab dari sistem.
    *   **Token/Verifikasi:** Ya (Token JWT).

---

### 14. Upload Log Wearable (`Logs`)
Endpoint untuk sinkronisasi data dari aplikasi mobile.

*   **`POST /log/logs`**
    *   **Deskripsi:** Menerima pengunggahan file CSV rekaman sensor Polar/wearables dari aplikasi mobile.
    *   **Format Request:** Multipart Form Data (nama key file: `file`).
    *   **Struktur Kolom CSV:** Wajib berisi data `user_id`, `timestamp`, `hr` (Heart Rate), dan `rr` (RR-intervals).
    *   **Token/Verifikasi:** Tidak.

---

### 15. Dashboard Analisis (`Analysis`)
Sistem analitik untuk pemantauan klinis, baseline, dan metrik pengujian.

*   **`GET /analysis/reports`**
    *   **Deskripsi:** Menghasilkan data rekapitulasi laporan klinis secara agregat.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /analysis/segments/:userId`**
    *   **Deskripsi:** Mengambil daftar segmen hasil analisis IQR (klasifikasi detak jantung normal/anomali beserta skor anomalinya).
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /analysis/events/:userId`**
    *   **Deskripsi:** Mengambil log kejadian (*event log*) anomali yang dialami pengguna.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /analysis/events/details/:eventId`**
    *   **Deskripsi:** Mengambil detail lengkap kejadian anomali beserta segmen-segmen detak jantung pendukungnya.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`POST /analysis/events/:eventId/annotate`**
    *   **Deskripsi:** Menambahkan catatan kaki / anotasi klinis pada kejadian anomali tertentu.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`PATCH /analysis/events/:eventId/status`**
    *   **Deskripsi:** Mengubah status pengerjaan penanganan anomali (misal: *Reviewed*, *In-Progress*, *Resolved*).
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`PATCH /analysis/events/:eventId/validate`**
    *   **Deskripsi:** Dokter melakukan validasi apakah anomali tersebut valid atau alarm palsu (*False Alarm*).
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`PATCH /analysis/events/:eventId/escalate`**
    *   **Deskripsi:** Mengeskalasikan status kegawatan insiden anomali ke tim medis tingkat lanjut.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`PATCH /analysis/events/:eventId/assign`**
    *   **Deskripsi:** Menetapkan reviewer/dokter penanggung jawab untuk menangani event anomali.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /analysis/baseline/:userId`**
    *   **Deskripsi:** Mengambil rentang detak jantung dasar (baseline) dari pengguna bersangkutan.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`PATCH /analysis/baseline/:baselineId/freeze`**
    *   **Deskripsi:** Mengunci (*freeze*) atau membuka kunci (*unfreeze*) data baseline agar tidak terpengaruh kalkulasi baru.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`PATCH /analysis/baseline/:baselineId/approve`**
    *   **Deskripsi:** Dokter menyetujui profil baseline pengguna.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`POST /analysis/baseline/:baselineId/recalculate`**
    *   **Deskripsi:** Memaksa sistem untuk menghitung ulang profil baseline detak jantung pengguna dari awal.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /analysis/metrics/:userId`**
    *   **Deskripsi:** Mengambil ringkasan metrik statistik (Precision, Recall, F1-Score, FPR, Accuracy, Detection Delay).
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /analysis/metrics/:userId/roc`**
    *   **Deskripsi:** Mengambil titik koordinat kurva ROC dan skor AUC (Area Under Curve) untuk performa algoritma deteksi.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /analysis/metrics/:userId/h1a`**
    *   **Deskripsi:** Mengambil metrik Uji Hipotesis H1a (TCR, MER, TCI).
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /analysis/metrics/:userId/h2a`**
    *   **Deskripsi:** Mengambil metrik Uji Hipotesis H2a (CFPR).
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /analysis/metrics/:userId/h3a`**
    *   **Deskripsi:** Mengambil metrik Uji Hipotesis H3a (TRS).
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`PATCH /analysis/segments/:segmentId/label`**
    *   **Deskripsi:** Mengubah label data pembanding (*ground truth label*) pada segmen tertentu untuk evaluasi algoritma (anomaly/normal).
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`PATCH /analysis/events/:eventId/label`**
    *   **Deskripsi:** Menentukan waktu onset aktual (*actual onset time*) anomali untuk menghitung durasi keterlambatan deteksi (*detection delay*).
    *   **Token/Verifikasi:** Ya (Token JWT).

---

### 16. Manajemen Pipeline (`Pipeline`)
Mengatur sinkronisasi antrean pesan pada message broker (RabbitMQ) dan status pipeline.

*   **`GET /pipeline/status`**
    *   **Deskripsi:** Mengambil status operasional pipeline pemrosesan data real-time, beserta statistik RabbitMQ secara langsung.
    *   **Token/Verifikasi:** Ya (Token JWT).
*   **`GET /pipeline/nodes`**
    *   **Deskripsi:** Mengambil daftar node pada klaster RabbitMQ.
    *   **Token/Verifikasi:** Ya (Khusus peran Operator, Administrator, Admin, dan Dokter).
*   **`DELETE /pipeline/queue/:queueName/purge`**
    *   **Deskripsi:** Membersihkan seluruh antrean pesan pada antrean tertentu (misal: membersihkan *dead-letter queue*).
    *   **Token/Verifikasi:** Ya (Khusus peran Operator, Administrator, Admin, dan Dokter).
*   **`POST /pipeline/queue/:queueName/pause`**
    *   **Deskripsi:** Menangguhkan (*pause*) pemrosesan antrean tertentu sementara waktu.
    *   **Token/Verifikasi:** Ya (Khusus peran Operator, Administrator, Admin, dan Dokter).
*   **`POST /pipeline/queue/:queueName/messages`**
    *   **Deskripsi:** Mengintip (*peek*) daftar pesan yang sedang berada di dalam antrean.
    *   **Token/Verifikasi:** Ya (Khusus peran Operator, Administrator, Admin, dan Dokter).


.env
# MONGO=mongodb://healthdevice:UAVqoi07o5EP4IT@nosql.smartsystem.id:27017/healthdevice
# MONGO='mongodb+srv://memerlin90:Imam123imam@iot.3pl56rn.mongodb.net/?retryWrites=true&w=majority'
JWT_SECRET='asnjkKkjsnklnly1xcx?23r'
MONGO="mongodb+srv://memerlin90:LYyX217FP02iuCqV@pak.21cks.mongodb.net/?retryWrites=true&w=majority&appName=pak"
# MONGO="mongodb://localhost:27017/healthdevice"
RABBITMQ_URI="amqp://rmq2.pptik.id:15672"
QUEUE_NAME="Sensor"

PORT = 3030

CLIENT_ID="512a889e-af52-4575-90fe-4b58313f2a04"
CLIENT_SECRET="0Rfm7a636xd9JpizLA58HprXe8URsK7maxs"

UAT = "907211bd-de4e-49c7-836e-997d39b8e92d"
UAT_SECRET ="1qh5EHLKdLeoTxPqg6eVKRM2o07IutX5I6z"

NONCE = "VPwnsifewmko213%3Fasrwg"

UserAccessToken = "907211bd-de4e-49c7-836e-997d39b8e92d"
UserId = "719b2e07-5f39-4f4e-9ebf-802bb55dde8e"

# FTP
FTP_HOST="ftp5.pptik.id"
FTP_USER="healthdevice-ftp"
FTP_PASSWORD="3a!xQAfizb"
FTP_SECURE=false
FTP_PORT=2121
