# AquaMine AI: Demo Runbook

Panduan ini berisi langkah-langkah praktis untuk menjalankan dan memverifikasi demo AquaMine secara lokal menggunakan Docker Compose.

## 1. Persiapan Stack

Pastikan Docker dan Docker Compose sudah terinstal di mesin Anda.

```bash
# 1. Salin konfigurasi environment
cp .env.example .env

# 2. Jalankan seluruh layanan
docker compose up -d
```

**Verifikasi akses:**
- **Dashboard:** [http://localhost:3000](http://localhost:3000)
- **API Health:** [http://localhost:8181/health](http://localhost:8181/health) (Gunakan port 8181!)

## 2. Simulasi Data (Seeding)

Simulator berjalan otomatis di latar belakang, namun Anda dapat memaksa pengisian data atau memicu alert tertentu.

### Backfill Data Historis
Gunakan perintah ini untuk mengisi data 7 hari terakhir agar grafik forecast dan tren muncul:

```bash
# Ambil Ingest Key dari .env
export KEY=$(grep INGEST_API_KEY .env | cut -d '=' -f2)

# Jalankan backfill melalui container simulator
docker compose exec simulator python scripts/esp32_simulator.py --backfill --days 7 --ingest-key $KEY
```

### Memicu Alert Kritis (Skenario AMD)
Untuk melihat bagaimana sistem menangani kondisi bahaya (pH rendah/Turbidity tinggi):

```bash
docker compose exec simulator python scripts/esp32_simulator.py --realtime --count 1 --scenario critical --ingest-key $KEY
```

## 3. Verifikasi Fitur via CLI

Anda dapat memverifikasi endpoint utama menggunakan `curl`:

### Alerts & Anomaly
Melihat daftar alert terbaru yang terdeteksi oleh sistem:
```bash
curl http://localhost:8181/api/v1/alerts
```

### Forecasting (Prediksi)
Picu pembuatan model prediksi pH untuk sensor ID 1:
```bash
curl -X POST "http://localhost:8181/api/v1/forecast/generate?sensor_id=1"
```
Lihat hasil prediksi (Data runtun waktu ke depan):
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"sensor_id": 1, "horizon_hours": 168}' \
  http://localhost:8181/api/v1/forecast
```

### Computer Vision (Deteksi Yellow Boy)
Kirim gambar untuk dianalisis oleh modul AI:
```bash
# Ganti path dengan file gambar asli Anda
curl -F "file=@/path/to/your/image.jpg" http://localhost:8181/api/v1/cv/analyze
```

### Analytics Insights
Dapatkan ringkasan cerdas berbasis LLM mengenai kondisi tambang:
```bash
curl http://localhost:8181/api/v1/analytics/insights
```

## 4. Verifikasi UI & Analytics

Setelah data terisi, verifikasi fitur analitik melalui antarmuka pengguna (UI).

### Dashboard & Analytics Flow
- **Analytics Widget:** Terletak di kolom kanan di bawah "Recent Alerts" pada [Dashboard Utama](http://localhost:3000). Widget ini memberikan ringkasan status sensor secara cepat.
- **Halaman Analytics:** Akses [http://localhost:3000/analytics](http://localhost:3000/analytics) untuk melihat:
  - **Summary Cards:** Statistik agregat parameter air.
  - **Trends Chart:** Grafik historis parameter dalam 24 jam terakhir.
  - **Compliance Bars:** Status kepatuhan terhadap regulasi.
  - **AI Insights:** Analisis otomatis berbasis AI mengenai kondisi tambang.

### Demo Mode Toggle
Di pojok kanan atas Dashboard, terdapat opsi **Demo Mode**.
- **Refresh Interval:** Jika diaktifkan, Dashboard akan memuat ulang data setiap **5 detik**.
- Gunakan mode ini saat presentasi untuk melihat perubahan data secara *real-time*.

### Urutan Demo (Recommended Sequence)
1. **Backfill:** Jalankan `scripts/esp32_simulator.py --backfill` (lihat Bagian 2).
2. **Dashboard:** Buka `http://localhost:3000/` dan aktifkan **Demo Mode**.
3. **Analytics:** Masuk ke `/analytics` untuk menunjukkan tren data dan AI Insights.
4. **Trigger Critical:** Jalankan skenario `critical` melalui CLI.
5. **Verify:** Amati munculnya alert baru dan pembaruan pada AI Insights.

### Verifikasi API Backend (Opsional)
Jika UI tidak muncul, pastikan backend merespons dengan benar:
- **Summary:** [http://localhost:8181/api/v1/analytics/summary](http://localhost:8181/api/v1/analytics/summary)
- **Insights:** [http://localhost:8181/api/v1/analytics/insights](http://localhost:8181/api/v1/analytics/insights)

## 5. Troubleshooting (Masalah Umum)

| Masalah | Penyebab Kemungkinan | Solusi |
| :--- | :--- | :--- |
| **Error 401: Invalid Ingest Key** | Header `X-Ingest-Key` hilang atau tidak cocok dengan `.env`. | Pastikan simulator menggunakan `--ingest-key` yang benar atau cek variabel `INGEST_API_KEY`. |
| **API Tidak Terjangkau** | Mencoba akses port 8000. | AquaMine menggunakan port **8181** untuk API backend. Pastikan URL Anda sudah benar. |
| **Data Tidak Muncul di Dashboard** | Redis berhenti atau WS tidak terhubung. | Jalankan `docker compose ps` untuk memastikan container `redis` berstatus `healthy`. |
| **WebSocket (WS) Gagal Connect** | Masalah Mixed Content di browser. | Jika menggunakan HTTPS di VPS, pastikan `NEXT_PUBLIC_WS_BASE_URL` menggunakan `wss://`. Untuk lokal, pastikan `ws://`. |
| **Dashboard Menunjukkan Error/Putih** | Clerk Key belum dikonfigurasi. | Periksa `.env`, pastikan `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` dan `CLERK_SECRET_KEY` sudah terisi dengan valid. |

---
*Dokumentasi ini dibuat untuk kebutuhan demo dan pengembangan lokal.*
