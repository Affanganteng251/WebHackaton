# Backend Dummy — Pemantauan Titik Api Kalimantan

API prototipe menggunakan FastAPI. **Semua data merupakan data dummy, bukan data kejadian nyata.**

## 1. Prasyarat
- Python 3.10 atau lebih baru
- Koneksi internet saat memasang dependensi

## 2. Instalasi

Buka terminal di folder proyek:

```bash
python -m venv .venv
```

Aktifkan environment:

**Windows CMD**
```bat
.venv\Scripts\activate
```

**Windows PowerShell**
```powershell
.venv\Scripts\Activate.ps1
```

Pasang dependensi dan jalankan server:

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Buka:
- API: http://127.0.0.1:8000
- Dokumentasi interaktif: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health

## 3. Endpoint

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/health` | Status API |
| GET | `/v1/meta/status` | Status dan umur data contoh |
| GET | `/v1/hotspots` | Titik api dummy |
| GET | `/v1/hotspots?bbox=116,-2,118,2` | Filter koordinat |
| GET | `/v1/hotspots?since=2026-10-01T00:00:00Z` | Filter waktu |
| GET | `/v1/deforestation-alerts` | Peringatan dummy |
| GET | `/v1/risk/latest?horizon=7` | Risiko 7 hari |
| GET | `/v1/risk/latest?horizon=14` | Risiko 14 hari |
| GET | `/v1/risk/latest?horizon=30` | Risiko 30 hari |
| GET | `/v1/kecamatan/CONTOH-001/summary` | Ringkasan dummy |
| GET | `/v1/kecamatan/CONTOH-001/history` | Riwayat bulanan dummy |
| POST | `/v1/subscriptions` | Buat langganan dummy |
| GET | `/v1/subscriptions` | Lihat langganan dummy |
| DELETE | `/v1/subscriptions/1` | Hapus langganan dummy |

## 4. Contoh request POST langganan

Kirim JSON ke `POST /v1/subscriptions`:

```json
{
  "device_id": "device-test-001",
  "district_id": "CONTOH-001"
}
```

## 5. Catatan penting
- Data disimpan di memori, bukan database. Data langganan hilang ketika server dimulai ulang.
- Endpoint ini belum terhubung ke NASA FIRMS, GLAD/RADD, model ML, PostgreSQL, atau PostGIS.
- Koordinat, nama wilayah, probabilitas, dan umur data adalah ilustrasi pengujian.
- Sebelum demo ke publik, tampilkan penanda bahwa data adalah dummy.
- Langkah berikutnya: sepakati kontrak data dengan tim ML, lalu pindahkan penyimpanan ke PostgreSQL + PostGIS.
