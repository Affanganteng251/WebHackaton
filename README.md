# PHYRA — Pemantauan Titik Api dan Risiko Kebakaran Kalimantan

PHYRA adalah prototipe sistem pemantauan kebakaran hutan dan lahan (karhutla) di Kalimantan. Sistem menggabungkan peta geospasial, API backend, database spasial, antarmuka pemantauan, fitur laporan warga, dan notebook machine learning untuk prakiraan risiko.

> **Status integrasi penting:** Notebook ML menyiapkan pipeline pengambilan data, rekayasa fitur, pelatihan/evaluasi, serta keluaran risiko 7, 14, dan 30 hari. Namun, berdasarkan implementasi backend yang ada, hasil notebook **belum terhubung sebagai prediksi ML aktual ke endpoint FastAPI**. Endpoint risiko utama masih menggunakan data dummy, dan ringkasan kecamatan pada mode database dapat mengembalikan probabilitas `null`. Data hotspot di database juga belum merupakan feed satelit aktual. Data contoh/simulasi tidak boleh dianggap sebagai kondisi kebakaran nyata.

## Daftar Isi

- [Tujuan](#tujuan)
- [Arsitektur Sistem](#arsitektur-sistem)
- [Bagaimana Data ML Diproses](#bagaimana-data-ml-diproses)
- [Bagaimana Data Dikirim ke Frontend](#bagaimana-data-dikirim-ke-frontend)
- [Fitur PHYRA](#fitur-phyra)
- [Teknologi](#teknologi)
- [Struktur Folder](#struktur-folder)
- [Menjalankan Aplikasi](#menjalankan-aplikasi)
- [Konfigurasi](#konfigurasi)
- [Endpoint API](#endpoint-api)
- [Status Integrasi](#status-integrasi)
- [Langkah Integrasi Model ke Backend](#langkah-integrasi-model-ke-backend)
- [Catatan](#catatan)

## Tujuan

PHYRA dirancang untuk:
1. Memantau sebaran titik panas dan batas administrasi wilayah di Kalimantan.
2. Menampilkan status serta kesegaran data yang diterima backend.
3. Menyediakan prakiraan risiko kebakaran untuk horizon 7, 14, dan 30 hari setelah model ML diintegrasikan.
4. Menampilkan ringkasan wilayah dan layer risiko pada peta.
5. Menyediakan materi edukasi kualitas udara dan formulir laporan warga.

## Arsitektur Sistem

```mermaid
flowchart TD
    A[Google Earth Engine] --> D[Notebook ML di Google Colab]
    B[NASA FIRMS / VIIRS] --> D
    C[KHG BIG, Dynamic World, SRTM, OSM, data iklim] --> D
    G[GeoJSON batas administrasi] --> D
    D --> E[Preprocessing dan feature engineering]
    E --> F[Pelatihan, evaluasi, kalibrasi model]
    F --> H[Bundle model 7d / 14d / 30d]
    F --> I[Payload JSON prediksi per kecamatan]
    H -. belum dimuat otomatis .-> J[Integrasi/publikasi prediksi yang perlu dibuat]
    I -. belum di-ingest otomatis .-> J
    K[PostgreSQL + PostGIS] --> L[FastAPI]
    J -. setelah integrasi .-> L
    L --> M[REST API JSON / GeoJSON]
    M --> N[Frontend JavaScript + Leaflet]
    N --> O[Peta, ringkasan wilayah, risiko, interaksi pengguna]
```

Diagram ini menggambarkan desain yang dituju. Jalur notebook ML menuju database/API masih memerlukan proses publikasi atau ingestion yang eksplisit.

### Peran komponen

- **Notebook ML:** mengumpulkan dan mengolah data, membentuk fitur, melatih serta mengevaluasi model, kemudian menghasilkan bundle dan payload JSON.
- **PostgreSQL/PostGIS:** menyimpan geometri wilayah dan data backend serta mendukung kueri spasial.
- **FastAPI:** menyediakan endpoint REST, membaca database, memvalidasi parameter, dan mengembalikan JSON/GeoJSON.
- **Frontend:** mengambil data API melalui JavaScript dan menampilkannya di peta Leaflet serta komponen UI.
- **Mode simulasi/contoh:** membantu pengembangan dan pengujian tampilan; bukan sumber prediksi aktual.

## Bagaimana Data ML Diproses

Notebook utama: [`model_risiko_titik_api_kalimantan_integrated.ipynb`](./model_risiko_titik_api_kalimantan_integrated.ipynb).

### 1. Persiapan lingkungan dan kredensial

Notebook menggunakan Python beserta pustaka pengolahan data, geospasial, machine learning, dan validasi JSON. Notebook mengharapkan dua secret:

- `GEE_PROJECT_ID`: Google Cloud Project ID untuk Google Earth Engine.
- `NASA_FIRMS_MAP_KEY`: key NASA FIRMS.

Tambahkan keduanya melalui **Colab Secrets** atau environment variable. Jangan menuliskan key di notebook, frontend, README, atau commit Git.

File GeoJSON batas wilayah Kalimantan juga dibutuhkan. Jalankan sel notebook secara berurutan sesuai petunjuk yang ada di dalam notebook.

### 2. Pengambilan sumber data

Pipeline notebook menggunakan atau menyiapkan integrasi dengan sumber berikut:

- **NASA FIRMS / VIIRS:** observasi titik api. Label pelatihan difokuskan pada VIIRS S-NPP agar definisi target historis lebih konsisten.
- **Google Earth Engine:** koleksi historis dan variabel lingkungan/permukaan, termasuk data hujan, cuaca, vegetasi, serta koleksi terkait deforestasi yang digunakan oleh pipeline.
- **KHG BIG:** informasi Kesatuan Hidrologis Gambut.
- **Dynamic World:** kelas tutupan lahan.
- **SRTM:** elevasi.
- **OSM/Geofabrik:** jaringan jalan dan fitur kedekatan akses.
- **NOAA CPC dan BoM:** indeks iklim seperti ONI dan DMI.
- **Open-Meteo:** prakiraan hujan untuk fitur prediksi jangka dekat.
- **GeoJSON GADM:** batas administratif yang dipakai untuk mengaitkan grid dengan kabupaten/kecamatan.

Koneksi ke GEE tidak otomatis menjamin semua koleksi berhasil diunduh. Periksa log kolektor, rentang tanggal, jumlah observasi, nilai kosong, dan status ekspor sebelum menafsirkan hasil.

### 3. Pembentukan grid dan data historis

Notebook membagi area menjadi sel grid sekitar `0,05°` (kurang lebih 5,5 km). Data dengan resolusi dan frekuensi berbeda diringkas atau digabungkan ke unit grid dan waktu yang sama. Pipeline dirancang menggunakan data historis multi-tahun untuk mempelajari variasi musiman serta pola kejadian kebakaran.

Untuk ekstraksi besar dari Google Earth Engine, notebook menyediakan ekspor batch ke Google Drive. Pastikan task ekspor selesai dan seluruh batch yang dibutuhkan tersedia sebelum pelatihan.

### 4. Preprocessing dan rekayasa fitur

Pipeline `FeaturePipelineKalimantan` menyiapkan fitur dengan mempertimbangkan waktu ketersediaan data (*point-in-time correctness*) untuk mencegah kebocoran data masa depan. Kelompok fitur mencakup:

- riwayat jumlah hotspot dan *Fire Radiative Power* (FRP);
- persistensi serta tren kejadian;
- curah hujan, hari kering berturut-turut, indikator kekeringan, suhu, dan kelembapan tanah;
- variabel gambut dan interaksi kondisi gambut/kekeringan;
- aktivitas hotspot pada sel tetangga;
- indeks iklim musiman;
- tutupan lahan, elevasi, jarak jalan, dan indikator deforestasi;
- indikator nilai yang hilang untuk variabel yang belum tersedia.

Target dibangun untuk horizon 7, 14, dan 30 hari. Hari yang tidak memiliki observasi lengkap tidak boleh otomatis dianggap sebagai hari tanpa kebakaran.

### 5. Pelatihan dan evaluasi

Notebook membandingkan baseline klimatologi, baseline persistensi, aturan kekeringan + gambut (B2), regresi logistik, model boosting/LightGBM, serta baseline Random Forest. Validasi dirancang secara temporal dan spasial, termasuk evaluasi tahun demi tahun, *embargo* sesuai horizon prediksi, validasi per wilayah, dan uji akhir tahun 2025.

Metrik yang digunakan antara lain PR-AUC, ROC-AUC, Brier Score, recall/presisi pada sel dengan risiko tertinggi, dan tingkat false alarm. Penilaian juga dapat dipilah berdasarkan tahun, musim, wilayah, kondisi gambut, serta horizon.

### 6. Koreksi probabilitas dan kategori risiko

Karena pelatihan menggunakan *negative downsampling*, probabilitas mentah dikoreksi terhadap prior kemudian dikalibrasi. Probabilitas sel selanjutnya dikelompokkan menjadi `low`, `medium`, atau `high` untuk setiap horizon.

Notebook juga menerapkan *release gates*. Jika model pada horizon tertentu tidak memenuhi kriteria, sistem yang dirancang dapat memakai aturan fallback B2 dan memberi label `indicative`, bukan menyatakan hasil sebagai prediksi ML tervalidasi.

### 7. Keluaran model

Notebook membuat bundle per horizon di direktori `bundles/`:

- `model_bundle_7d.pkl`
- `model_bundle_14d.pkl`
- `model_bundle_30d.pkl`

Bundle menyimpan model, nama fitur, parameter koreksi prior, kalibrator, ambang, versi/snapshot, dan metrik evaluasi. Notebook kemudian menghitung prediksi untuk tanggal operasional terakhir, menentukan kategori risiko, serta membuat penjelasan faktor utama per sel.

Hasil risiko juga diagregasikan ke tingkat kecamatan (`gid_3`), termasuk probabilitas maksimum, kategori risiko, jumlah sel berisiko tinggi, versi model, waktu pembuatan, dan status confidence. Payload divalidasi dengan `jsonschema`. Contoh keluaran disimpan sebagai `data/api_v1_kecamatan_bengkayang_summary.json`.

**Penting:** artefak lokal tersebut tidak otomatis dibaca FastAPI. Harus ada langkah tambahan untuk mengirim atau memublikasikan bundle/payload ke penyimpanan yang dapat diakses backend.

## Bagaimana Data Dikirim ke Frontend

### Alur API saat ini

1. Konfigurasi endpoint frontend berada di `frontend/js/data.js`.
2. Fungsi `fetchFireData()` mengambil hotspot dari endpoint FastAPI menggunakan `fetch()`.
3. FastAPI menjalankan validasi dan query database melalui modul backend, termasuk query spasial pada PostgreSQL/PostGIS.
4. Backend mengembalikan data dalam bentuk JSON atau GeoJSON.
5. `frontend/js/script.js` mengolah respons dan menggambar titik/layer menggunakan Leaflet.
6. Frontend memuat batas wilayah dari `/v1/districts/geojson`.
7. Ketika pengguna memilih poligon kecamatan, frontend meminta `/v1/kecamatan/{gid_3}/summary` dan menampilkan ringkasannya.
8. Mode simulasi memakai endpoint `/v1/simulation/*` untuk menguji tampilan risiko secara terpisah.

### Tiga jenis data yang harus dibedakan

- **Database:** berasal dari PostgreSQL/PostGIS. Laporan integrasi proyek menyebut database memiliki batas kecamatan dan data hotspot uji, tetapi feed satelit aktual belum terhubung.
- **Simulasi:** data buatan untuk pengujian visualisasi risiko dan alur aplikasi.
- **Data contoh frontend:** objek `SAMPLE` dalam JavaScript, yang koordinat dan nilainya dapat berupa ilustrasi.
- **Prediksi notebook ML:** dihasilkan oleh pipeline offline/batch, tetapi belum menjadi sumber endpoint risiko produksi.

Backend menggunakan kueri spasial untuk menghubungkan titik hotspot dengan poligon kecamatan. Ringkasan kecamatan dapat mengembalikan jumlah hotspot dan metadata, tetapi jika prediksi belum tersedia, probabilitas risiko seharusnya tetap `null` atau `unknown`, bukan diisi angka perkiraan.

## Fitur PHYRA

### Fitur pada antarmuka web

1. **Peta interaktif Kalimantan** dengan Leaflet.
2. **Visualisasi titik hotspot** berdasarkan data yang sedang dimuat.
3. **Layer batas administrasi kecamatan** dari GeoJSON.
4. **Ringkasan kecamatan** melalui endpoint backend.
5. **Pencarian/filter wilayah** untuk membantu navigasi peta.
6. **Layer risiko simulasi** dengan horizon 7, 14, dan 30 hari.
7. **Papan peringatan dini** berdasarkan indikator pada dataset frontend.
8. **Pemeriksaan jarak lokasi pengguna** melalui geolocation browser atau lokasi manual.
9. **Bagian berita/topik karhutla** berupa tautan referensi yang tersedia di dataset UI.
10. **Edukasi kualitas udara** yang membahas polutan dan dampak kesehatan/lingkungan.
11. **Form laporan warga** untuk jenis kejadian, lokasi, deskripsi, dan foto.
12. **Penyimpanan antrean laporan di browser** saat endpoint pengiriman belum diatur.
13. **Tampilan status laporan demo** untuk memperlihatkan alur pelaporan.
14. **Status data dan pemuatan ulang** untuk membantu pengguna mengetahui apakah request berhasil.
15. **Metadata status API** melalui endpoint backend.

Sebagian fitur menggunakan dataset contoh atau simulasi. Jika `REPORT_URL` masih `null`, formulir laporan belum mengirim laporan ke server petugas; status lanjutan hanya simulasi UI.

### Fitur yang disiapkan oleh notebook ML

- Prakiraan risiko hotspot untuk 7, 14, dan 30 hari.
- Agregasi probabilitas grid ke tingkat kecamatan.
- Kategori risiko `low`, `medium`, dan `high`.
- Penjelasan faktor utama yang berkontribusi pada risiko per sel.
- Pemeriksaan gerbang rilis dan fallback berbasis kekeringan/gambut.
- Evaluasi kinerja model dan pemantauan pergeseran fitur menggunakan PSI serta uji KS.

Kemampuan ini **belum boleh disebut sebagai prediksi live pada website** sebelum payload hasil notebook terhubung ke backend dan diverifikasi.

## Teknologi

| Lapisan | Teknologi |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Peta | Leaflet |
| Backend | Python, FastAPI, Uvicorn, Pydantic |
| Database | PostgreSQL, PostGIS, SQLAlchemy |
| ML dan geospasial | Pandas, NumPy, GeoPandas, Shapely, Earth Engine API, LightGBM/boosting dan utilitas evaluasi |
| Validasi payload | JSON Schema / `jsonschema` |
| Sumber eksternal notebook | Google Earth Engine, NASA FIRMS, KHG BIG, Dynamic World, SRTM, OSM/Geofabrik, NOAA/BoM, Open-Meteo |

## Struktur Folder

```text
PHYRA/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── data.js
│   ├── script.js
│   ├── peringatan.js
│   └── lapor.js
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── data.js
│       ├── script.js
│       ├── peringatan.js
│       └── lapor.js
├── backend/
│   ├── README.md
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   └── simulation_data.py
│   ├── migrations/
│   │   └── 001_create_tables.sql
│   └── scripts/
│       └── import_boundaries.py
├── docs/
│   └── kontrak_integrasi_sementara.md
├── kalimantan_kabupaten_kota.geojson
├── model_risiko_titik_api_kalimantan_integrated.ipynb
└── laporan_kondisi_dan_rencana_integrasi.md
```

Terdapat aset frontend di root folder dan di `frontend/`. Jalankan versi yang memang digunakan saat deployment, dan pastikan konfigurasi endpoint diperbarui pada folder yang benar.

## Menjalankan Aplikasi

### Prasyarat

- Python 3.10 atau lebih baru, sesuai kompatibilitas dependensi.
- PostgreSQL dengan ekstensi PostGIS untuk mode database.
- Browser modern.
- Google Earth Engine yang telah diaktifkan untuk pipeline ML.
- Akses NASA FIRMS bila menjalankan kolektor terkait.

### 1. Backend

Dari root repositori:

```bash
cd PHYRA/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Pada Windows PowerShell, aktifkan environment dengan:

```powershell
.venv\Scripts\Activate.ps1
```

Buat file `.env` di folder backend dan isi URL database yang sesuai:

```dotenv
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/DATABASE
```

Ganti placeholder sesuai konfigurasi sendiri. Jangan commit `.env`. Pastikan driver PostgreSQL dan semua dependensi yang diimpor kode backend sudah terpasang; `requirements.txt` backend saat ini hanya mencantumkan FastAPI dan Uvicorn, sehingga paket database mungkin perlu ditambahkan sesuai environment.

Jalankan API:

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Health check: http://127.0.0.1:8000/health
- Dokumentasi interaktif: http://127.0.0.1:8000/docs
- Status data: http://127.0.0.1:8000/v1/meta/status

### 2. Frontend

Jalankan frontend statis menggunakan VS Code Live Server atau server web lokal dari folder `PHYRA/frontend/`. Konfigurasi default frontend mengarah ke `http://127.0.0.1:8000`.

Jika backend berjalan pada host/port berbeda, ubah konfigurasi di `frontend/js/data.js` dan sesuaikan CORS backend. Hindari membuka HTML melalui `file://` apabila browser membatasi request lintas origin.

### 3. Notebook ML

1. Buka notebook di Google Colab.
2. Unggah/sediakan file GeoJSON yang sesuai.
3. Tambahkan `GEE_PROJECT_ID` dan `NASA_FIRMS_MAP_KEY` di Colab Secrets.
4. Selesaikan autentikasi Earth Engine.
5. Jalankan sel secara berurutan dan tunggu ekspor batch selesai.
6. Periksa log sumber data, rentang tanggal, jumlah fitur, nilai kosong, metrik, status gerbang rilis, dan payload JSON.
7. Publikasikan artefak keluaran ke backend melalui mekanisme integrasi yang disepakati.

Menjalankan notebook saja **tidak otomatis memperbarui database atau API**.

## Konfigurasi

| Konfigurasi | Kegunaan |
|---|---|
| `DATABASE_URL` | Koneksi PostgreSQL/PostGIS backend |
| `GEE_PROJECT_ID` | Google Cloud Project untuk Earth Engine |
| `NASA_FIRMS_MAP_KEY` | Akses kolektor NASA FIRMS |
| `CONFIG.API_URL` | Endpoint hotspot frontend |
| `CONFIG.DISTRICTS_GEOJSON_URL` | Endpoint GeoJSON batas kecamatan |
| `CONFIG.KECAMATAN_SUMMARY_URL` | Endpoint ringkasan kecamatan |
| `CONFIG.DATA_MODE` | Mode `database` atau `simulation` |
| `CONFIG.USE_SAMPLE` | Mengaktifkan dataset contoh frontend |
| `REPORT_URL` | Endpoint pengiriman laporan warga; saat ini belum aktif jika `null` |

Jangan menaruh API key di JavaScript frontend karena dapat dibaca publik. Pengambilan data yang memerlukan secret harus dijalankan dari backend atau job ingest server-side.

## Endpoint API

Periksa dokumentasi aktual melalui `/docs`. Endpoint yang tersedia dalam implementasi backend meliputi:

| Method | Endpoint | Fungsi | Status data |
|---|---|---|---|
| GET | `/health` | Pemeriksaan API | Status layanan |
| GET | `/v1/meta/status` | Metadata dan status data/model | Model belum terhubung |
| GET | `/v1/hotspots` | Membaca hotspot | Database; isi perlu diverifikasi |
| GET | `/v1/hotspots?bbox=108,-5,120,5` | Filter hotspot berdasarkan bounding box | Bergantung pada database |
| GET | `/v1/hotspots?since=2026-10-01T00:00:00Z` | Filter berdasarkan waktu | Bergantung pada database |
| GET | `/v1/districts/geojson` | Batas wilayah GeoJSON | Database |
| GET | `/v1/kecamatan/{gid_3}/summary` | Ringkasan kecamatan | Risiko ML dapat belum tersedia |
| GET | `/v1/risk/latest?horizon=7` | Risiko 7 hari | Dummy saat ini |
| GET | `/v1/risk/latest?horizon=14` | Risiko 14 hari | Dummy saat ini |
| GET | `/v1/risk/latest?horizon=30` | Risiko 30 hari | Dummy saat ini |
| GET | `/v1/deforestation-alerts` | Peringatan deforestasi | Dummy saat ini |
| GET | `/v1/simulation/status` | Status mode simulasi | Simulasi |
| GET | `/v1/simulation/hotspots` | Hotspot simulasi | Simulasi |
| GET | `/v1/simulation/risk?horizon=7` | Risiko simulasi | Simulasi |
| GET | `/v1/simulation/kecamatan/{gid_3}/summary` | Ringkasan simulasi | Simulasi |
| POST | `/v1/subscriptions` | Membuat langganan wilayah/perangkat | Bergantung pada konfigurasi backend |
| GET | `/v1/subscriptions` | Membaca langganan | Bergantung pada konfigurasi backend |
| DELETE | `/v1/subscriptions/{id}` | Menghapus langganan | Bergantung pada konfigurasi backend |

Contoh pemeriksaan API:

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/v1/meta/status
curl "http://127.0.0.1:8000/v1/hotspots?bbox=108,-5,120,5"
curl "http://127.0.0.1:8000/v1/risk/latest?horizon=7"
```

Jika risiko belum tersedia, frontend sebaiknya menampilkan “Belum tersedia” atau kategori `unknown`, bukan mengubah nilai `null` menjadi risiko rendah atau nol.

## Status Integrasi

| Komponen | Status berdasarkan kode/dokumen proyek |
|---|---|
| Frontend dan peta Leaflet | Tersedia |
| Frontend memanggil API | Tersedia |
| FastAPI dan endpoint hotspot | Tersedia |
| Query PostgreSQL/PostGIS | Tersedia dengan konfigurasi database |
| Batas kecamatan | Laporan integrasi menyebut 587 kecamatan telah diimpor |
| Feed hotspot aktual NASA FIRMS | Belum terhubung sebagai feed backend |
| Prediksi ML pada endpoint produksi | Belum terhubung |
| Bundle model dari notebook | Dihasilkan ketika notebook dijalankan, tetapi belum dimuat otomatis oleh API |
| Pengiriman laporan warga ke petugas | Belum aktif jika `REPORT_URL` masih `null` |
| Status laporan nyata | Simulasi UI jika belum ada endpoint |
| Data kualitas udara live | Tidak boleh diasumsikan live hanya dari dataset contoh frontend |

## Langkah Integrasi Model ke Backend

Agar prediksi notebook benar-benar muncul pada peta, langkah berikut masih diperlukan:

1. **Tetapkan kontrak JSON.** Samakan struktur payload, versi model, timestamp, `gid_3`, horizon, probabilitas, kategori, jumlah sel berisiko tinggi, dan status confidence.
2. **Publikasikan keluaran notebook.** Setelah semua gerbang rilis selesai, kirim payload ke tabel prediksi PostgreSQL/PostGIS atau penyimpanan JSON berversi yang dapat dibaca backend.
3. **Tambahkan proses ingestion.** Validasi skema, versi, timestamp, kelengkapan batch, dan duplikasi sebelum data dianggap sebagai prediksi terbaru.
4. **Hubungkan endpoint risiko.** Ubah `/v1/risk/latest` agar membaca batch prediksi terbaru, bukan data dummy.
5. **Hubungkan ringkasan kecamatan.** Endpoint `/v1/kecamatan/{gid_3}/summary` harus membaca ringkasan yang tervalidasi atau mengagregasikan grid dengan aturan yang konsisten dengan notebook.
6. **Integrasikan frontend.** Tampilkan layer risiko berdasarkan horizon 7/14/30 hari, probabilitas, waktu pembaruan, versi model, umur data, dan status `normal`/`indicative`.
7. **Tangani kegagalan dengan aman.** Jika data basi, batch hilang, atau model gagal gerbang, tampilkan status yang jelas dan jangan mengarang nilai.
8. **Uji end-to-end.** Cocokkan sampel keluaran notebook dengan respons API, uji skema JSON, kelengkapan grid, agregasi kecamatan, pergantian horizon, data stale, serta kegagalan database.
9. **Jadwalkan pembaruan data.** Ingest NASA FIRMS dan pembaruan fitur perlu dijadwalkan secara terpisah. Koneksi GEE saja tidak membuat backend otomatis diperbarui.

## Catatan

- PHYRA adalah alat bantu pemantauan, bukan pengganti informasi resmi BPBD, BMKG, atau instansi terkait.
- Probabilitas model bukan kepastian bahwa kebakaran akan terjadi.
- Beri label jelas pada data contoh, data uji, dan simulasi.
- Lindungi API key, password, dan file `.env`.
- Periksa lisensi serta ketentuan penggunaan setiap sumber data eksternal sebelum distribusi.
