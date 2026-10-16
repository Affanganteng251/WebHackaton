# PHYRA — Kontrak Integrasi Sementara (Provisional Integration Contract)
**Dokumen Penyelarasan Tim Data Engineering, Tim ML, dan Tim Frontend/Backend**  
**Versi:** 0.1-draft (Provisional)  
**Tanggal:** 16 Oktober 2026  
**Status:** Menunggu Konfirmasi Tim Data & ML

---

> [!IMPORTANT]
> **Prinsip Utama Rekayasa PHYRA:**
> 1. **Tidak Mengarang Skema Final:** Kolom yang belum disepakati secara resmi oleh tim diberi label jelas `[MENUNGGU KONFIRMASI TIM]`.
> 2. **Tanpa Perubahan DDL Database Sepihak:** Tidak membuat migrasi database, mengubah struktur tabel produksi, atau mengganti endpoint aktif sebelum spesifikasi ini disetujui bersama.
> 3. **Non-Konflasi Data:** Data uji (`TEST-001`), data ilustratif dummy, dan data aktual wajib dipisahkan secara tegas di tingkat basis data, API, dan antarmuka Leaflet.
> 4. **Penanganan Ketiadaan Data:** Atribut yang belum dihasilkan oleh model ML atau sensor satelit wajib bernilai `null` pada JSON dan direpresentasikan sebagai **"Belum tersedia"** di antarmuka pengguna, bukan angka 0 atau kategori risiko rendah.

---

## 1. Arsitektur dan Baseline Produksi Saat Ini

Sistem PHYRA saat ini beroperasi dengan komponen inti berikut:
- **Basis Data:** PostgreSQL 16 + PostGIS 3.4.
- **Backend:** FastAPI (Python 3.13) berjalan pada port `8000`.
- **Frontend:** HTML5, CSS3 kustom, Vanilla JavaScript, dan Leaflet JS berjalan pada port `5500`.

### 1.1 Tabel Database Produksi Aktif

| Nama Tabel | Jumlah Baris Saat Ini | Status Produksi | Deskripsi |
|---|:---:|:---:|---|
| **`districts`** | **587** | **Aktif (Produksi)** | Poligon batas administrasi Level 3 (Kecamatan) seluruh Kalimantan dari GADM v4.1 (SRID 4326 MultiPolygon). |
| **`hotspots`** | **1** | **Aktif (Data Uji)** | Titik benchmark `TEST-001` (-1.2654, 116.8312 di Balikpapan Selatan). Belum memuat feed satelit riil. |
| **`subscriptions`** | **0** | **Aktif (Produksi)** | Manajemen langganan notifikasi per perangkat/kecamatan/radius. |
| **`system_settings`** | **1** | **Aktif (Produksi)** | Konfigurasi sistem termasuk sakelar darurat kill-switch notifikasi publik. |

---

## 2. Kontrak Sementara 1: Data Titik Panas (Hotspot Satelit)

Sumber acuan: **NASA FIRMS (MODIS & VIIRS)** dan/atau **SiPongi (Kemenhut / BMKG)**.

### 2.1 Skema Tabel `hotspots` Saat Ini (Aktif)
```sql
CREATE TABLE IF NOT EXISTS hotspots (
    id SERIAL PRIMARY KEY,
    source_id VARCHAR(100),
    latitude NUMERIC(9, 6) NOT NULL,
    longitude NUMERIC(9, 6) NOT NULL,
    geom GEOMETRY(Point, 4326),
    confidence NUMERIC(4, 3),        -- Nilai 0.000 s.d. 1.000 (atau persentase 0-100%)
    detected_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    data_source VARCHAR(50) DEFAULT 'dummy'
);
```

### 2.2 Usulan Kolom Tambahan [MENUNGGU KONFIRMASI TIM]
Kolom-kolom berikut diusulkan untuk mendukung analisis lanjutan tim ML dan pemantauan satelit, namun **belum diimplementasikan dalam DDL** hingga ada kesepakatan:

| Nama Kolom Usulan | Tipe Data Usulan | Deskripsi & Contoh | Status Konfirmasi |
|---|---|---|:---:|
| `satellite` | `VARCHAR(30)` | Satelit sensor: `'Terra'`, `'Aqua'`, `'Suomi-NPP'`, `'NOAA-20'`, `'NOAA-21'` | **[MENUNGGU KONFIRMASI TIM]** |
| `instrument` | `VARCHAR(20)` | Instrumen sensor: `'MODIS'` atau `'VIIRS'` | **[MENUNGGU KONFIRMASI TIM]** |
| `brightness` | `NUMERIC(6, 2)` | Suhu kecerahan kanal 21/22 dalam Kelvin (misal: `324.50`) | **[MENUNGGU KONFIRMASI TIM]** |
| `bright_t31` | `NUMERIC(6, 2)` | Suhu kecerahan kanal 31 dalam Kelvin (misal: `298.10`) | **[MENUNGGU KONFIRMASI TIM]** |
| `frp` | `NUMERIC(8, 2)` | Fire Radiative Power dalam Megawatt (MW, misal: `14.80`) | **[MENUNGGU KONFIRMASI TIM]** |
| `scan` | `NUMERIC(4, 2)` | Dimensi piksel spasial scan (misal: `0.38`) | **[MENUNGGU KONFIRMASI TIM]** |
| `track` | `NUMERIC(4, 2)` | Dimensi piksel spasial track (misal: `0.36`) | **[MENUNGGU KONFIRMASI TIM]** |
| `daynight` | `CHAR(1)` | Deteksi waktu siang (`'D'`) atau malam (`'N'`) | **[MENUNGGU KONFIRMASI TIM]** |
| `land_cover_type` | `VARCHAR(50)` | Jenis tutupan lahan: `'gambut'`, `'mineral'`, `'hutan_primer'` | **[MENUNGGU KONFIRMASI TIM]** |

### 2.3 Kontrak Format Pertukaran Data Ingestion (Batch/Stream)
```json
{
  "batch_id": "NASA-FIRMS-KAL-20261016-01",
  "source": "NASA_FIRMS_VIIRS_SNPP",
  "ingested_at": "2026-10-16T12:00:00Z",
  "items": [
    {
      "source_id": "VIIRS-SNPP-20261016-00123",
      "latitude": -1.2541,
      "longitude": 116.8421,
      "confidence": 0.92,
      "detected_at": "2026-10-16T10:45:00Z",
      "satellite": "Suomi-NPP",
      "frp": 12.4
    }
  ]
}
```

---

## 3. Kontrak Sementara 2: Data Cuaca & Iklim (Weather & Climate)

Sumber acuan: **Stasiun AWS BMKG Kalimantan** dan/atau **Reanalysis ERA5-Land ECMWF**.

### 3.1 Status Saat Ini
Saat ini **belum ada tabel cuaca di database PHYRA**. Data cuaca masih dalam tahap eksplorasi oleh tim modeling.

### 3.2 Usulan Skema Tabel `weather_observations` [MENUNGGU KONFIRMASI TIM]
```sql
-- CATATAN: Kueri ini HANYA USULAN KONTRAK, JANGAN DIJALANKAN sebelum konfirmasi tim
CREATE TABLE IF NOT EXISTS weather_observations (
    id SERIAL PRIMARY KEY,
    district_gid_3 VARCHAR(50) REFERENCES districts(gid_3), -- Relasi kecamatan
    observation_time TIMESTAMPTZ NOT NULL,
    temperature_celsius NUMERIC(4, 2),                      -- Suhu udara (°C)
    relative_humidity_pct NUMERIC(5, 2),                    -- Kelembapan relatif (%)
    rainfall_mm_24h NUMERIC(6, 2),                          -- Akumulasi curah hujan 24 jam (mm)
    wind_speed_ms NUMERIC(5, 2),                            -- Kecepatan angin (m/s)
    wind_direction_deg NUMERIC(5, 2),                       -- Arah angin (derajat 0-360)
    surface_pressure_hpa NUMERIC(6, 2),                     -- Tekanan udara permukaan
    fwi_index NUMERIC(5, 2),                                -- Fire Weather Index (jika ada)
    data_source VARCHAR(50) DEFAULT 'bmkg',                 -- 'bmkg_aws' atau 'era5'
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 Pertanyaan Kunci yang Menunggu Konfirmasi Tim Cuaca:
1. Apakah data cuaca akan diagregasi per **kecamatan (`gid_3`)** atau berupa **titik stasiun cuaca berkoordinat (`lat, lon`)**?
2. Berapa resolusi temporal data: **per jam (hourly)**, **harian (daily)**, atau **prakiraan 3 harian**?
3. Apakah indeks kekeringan tanah gambut (*soil moisture deficit*) disediakan langsung oleh tim ML atau dihitung di database?

---

## 4. Kontrak Sementara 3: Prediksi Risiko Kebakaran Machine Learning

### 4.1 Status Saat Ini di Endpoint `/v1/kecamatan/{gid_3}/summary`
Saat ini endpoint ringkasan kecamatan telah mengimplementasikan spatial join PostGIS untuk menghitung hotspot, namun blok risiko ML secara eksplisit mengembalikan `null` dengan status `unknown`:

```json
{
  "data_mode": "partial",
  "boundary_status": "available",
  "schema_version": "1.0",
  "gid_3": "IDN.34.1.2_1",
  "name": "Balikpapan Selatan",
  "regency": "Balikpapan",
  "province": "Kalimantan Timur",
  "generated_at": "2026-10-16T12:00:00Z",
  "model_version": null,
  "hotspots_7d": 0,
  "test_hotspots_7d": 1,
  "risk": {
    "7d": {
      "category": "unknown",
      "max_probability": null,
      "high_risk_cells": 0
    },
    "14d": {
      "category": "unknown",
      "max_probability": null,
      "high_risk_cells": 0
    },
    "30d": {
      "category": "unknown",
      "max_probability": null,
      "high_risk_cells": 0
    }
  },
  "confidence": "indicative",
  "warning": "hotspots_7d dihitung melalui spatial join PostGIS batas wilayah kecamatan aktual. Prediksi risiko belum tersedia dari model ML (probabilitas bernilai null)."
}
```

### 4.2 Usulan Kontrak Target Ingestion Model ML [MENUNGGU KONFIRMASI TIM]
Ketika artefak model ML telah siap inferensi, tim ML akan menghasilkan luaran sesuai format berikut:

```json
{
  "model_id": "phyra-fire-risk-kalimantan",
  "model_version": "v1.0.0-rc1",
  "run_timestamp": "2026-10-16T06:00:00Z",
  "target_type": "district",
  "predictions": [
    {
      "gid_3": "IDN.34.1.2_1",
      "horizons": {
        "7d": {
          "probability": 0.42,
          "category": "medium",
          "top_factors_id": ["curah_hujan_rendah", "penurunan_kelembapan_tanah"]
        },
        "14d": {
          "probability": 0.58,
          "category": "high",
          "top_factors_id": ["tren_kekeringan", "suhu_permukaan_tinggi"]
        },
        "30d": {
          "probability": 0.35,
          "category": "medium",
          "top_factors_id": ["variasi_iklim_regional"]
        }
      }
    }
  ]
}
```

### 4.3 Kategori Risiko yang Disepakati (Standar Siaga Api):
- **`low` (Rendah):** Probabilitas `< 0.30`
- **`medium` (Sedang):** Probabilitas `0.30 - 0.60`
- **`high` (Tinggi):** Probabilitas `0.60 - 0.85`
- **`extreme` (Sangat Tinggi / Berbahaya):** Probabilitas `> 0.85`
- **`unknown` (Belum Tersedia):** Probabilitas `null`

---

## 5. Matriks Penyelarasan Status Data di Seluruh Lapisan Aplikasi

Untuk memastikan kepatuhan mutlak terhadap prinsip non-konflasi dan transparansi, seluruh lapisan antarmuka dan API PHYRA mengklasifikasikan data ke dalam **4 Kategori**:

| Kategori Data | Penanda Visual Antarmuka | Representasi Nilai API | Sumber Data Sebenarnya | Catatan Implementasi |
|---|---|---|---|---|
| 🟢 **Data Aktual** | Badge hijau / Layer biru | `data_mode: "database"` | Tabel PostgreSQL `districts` (587 poligon PostGIS) | Resmi terverifikasi dari dataset batas wilayah GADM v4.1. |
| 🟡 **Data Uji** | Marker oranye / Badge 🧪 | `source_id: "TEST-001"`, `test_hotspots_7d: 1` | Baris uji pada tabel `hotspots` | Diberi label eksplisit: *Bukan kebakaran aktual di lapangan*. |
| ⚪ **Belum Tersedia** | Teks *"Belum tersedia"* / Tanda `–` | `null` (bukan 0, bukan low) | Belum ada feed satelit live / model ML | Diterapkan pada luas terbakar (`ha-count`), risiko ML 7/14/30d, dan berita aktual. |
| 🟣 **Data Ilustratif** | Badge ungu / Label ilustrasi | `data_mode: "dummy"` | Mock generator internal (`/v1/risk/latest`, `/v1/deforestation-alerts`) | Hanya untuk demonstrasi tata letak dan pengujian UI, dilarang diklaim sebagai kejadian nyata. |

---

## 6. Tindakan Selanjutnya (Next Steps)
1. Menyerahkan dokumen kontrak sementara ini kepada perwakilan Tim Data Engineering dan Tim Machine Learning.
2. Memverifikasi format ekspor harian/mingguan dari pipeline cuaca BMKG dan satelit NASA FIRMS.
3. Setelah skema final disepakati, baru membuat berkas migrasi database resmi (misal `002_add_weather_and_predictions.sql`) tanpa memodifikasi tabel yang sudah berjalan.
