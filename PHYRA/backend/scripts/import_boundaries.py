"""
PHYRA - Boundary Importer Script (Integrasi Batas Wilayah Kecamatan)

Skrip ini digunakan untuk memproses, memvalidasi, dan mengimpor dataset batas wilayah
administrasi kecamatan (GeoJSON) ke tabel `districts` di PostgreSQL/PostGIS.

Mendukung dataset dari:
1. GADM v4.1 (Level 3 - Kecamatan / Sub-district)
2. Badan Informasi Geospasial (BIG) / BPS (KDPKEC, WADMKC, WADMKK, WADMPR)
3. Kemendagri (Kode Wilayah Administrasi Pemerintahan)

Fitur Validasi:
- Validasi CRS EPSG:4326 (WGS84 decimal degrees).
- Deteksi koordinat di luar jangkauan (bukan UTM/Mercator) dan deteksi koordinat tertukar.
- Pemisahan dan pemetaan kode GADM (gid_3) vs kode resmi Kemendagri (kemendagri_code).
- Validasi geometri PostGIS ST_IsValid dan koreksi otomatis ST_MakeValid jika memungkinkan.
- Filter opsional untuk 5 provinsi Kalimantan (--kalimantan-only / --province).

Penggunaan:
    python backend/scripts/import_boundaries.py --file path/to/kalimantan_districts.geojson --dry-run
    python backend/scripts/import_boundaries.py --file path/to/kalimantan_districts.geojson
    python backend/scripts/import_boundaries.py --file path/to/indonesia_level3.geojson --kalimantan-only
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path

# Pastikan folder backend masuk ke sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(BASE_DIR / ".env")

DATABASE_URL = os.getenv("DATABASE_URL")

KALIMANTAN_PROVINCES = [
    "kalimantan barat",
    "kalimantan tengah",
    "kalimantan selatan",
    "kalimantan timur",
    "kalimantan utara",
]

# Kandidat nama atribut dari berbagai standar
GADM_ID_KEYS = ["GID_3", "gid_3"]
KEMENDAGRI_CODE_KEYS = ["KDPKEC", "kode_kecamatan", "kd_kec", "id_kecamatan", "kode_wilayah", "kemendagri_code"]
GENERIC_ID_KEYS = ["id", "ID", "code", "CODE"]

NAME_KEYS = ["name", "NAME_3", "kecamatan", "WADMKC", "nama_kecamatan", "NAMA_KEC", "nm_kec"]
REGENCY_KEYS = ["regency", "NAME_2", "kabupaten", "kota", "WADMKK", "kab_kota", "KAB_KOTA", "nm_kab", "KDPKAB"]
PROVINCE_KEYS = ["province", "NAME_1", "provinsi", "WADMPR", "nama_provinsi", "PROVINSI", "nm_prov", "KDPPUM"]


def get_engine():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL belum diatur di file .env")
    return create_engine(DATABASE_URL, pool_pre_ping=True)


def find_attribute(properties: dict, candidates: list):
    for c in candidates:
        if c in properties and properties[c] is not None:
            val = str(properties[c]).strip()
            if val:
                return val
    return None


def extract_sample_coords(geom: dict):
    """Mengambil beberapa pasang koordinat [lon, lat] pertama untuk validasi koordinat dan CRS."""
    gtype = geom.get("type")
    coords = geom.get("coordinates", [])
    try:
        if gtype == "Polygon" and coords and coords[0]:
            return coords[0][:5]
        elif gtype == "MultiPolygon" and coords and coords[0] and coords[0][0]:
            return coords[0][0][:5]
    except Exception:
        pass
    return []


def validate_coordinates_sanity(sample_pts):
    """
    Memastikan koordinat berupa derajat desimal WGS84 (bukan UTM/WebMercator)
    dan mendeteksi jika lintang/bujur tertukar.
    """
    if not sample_pts:
        return True, "Geometri kosong"

    for pt in sample_pts:
        if len(pt) < 2:
            return False, "Format titik tidak valid"
        lon, lat = pt[0], pt[1]

        # Cek kemungkinan tertukar (latitude ditaruh di posisi bujur: lon -11..6 dan lat 95..141)
        if -11.0 <= lon <= 6.0 and 95.0 <= lat <= 141.0:
            return False, f"Koordinat terbalik: latitude ({lon}) berada di posisi longitude, dan longitude ({lat}) berada di posisi latitude."

        # Cek jika dalam meter (UTM / Web Mercator)
        if abs(lon) > 180 or abs(lat) > 90:
            return False, f"Koordinat ({lon}, {lat}) di luar batas derajat WGS84 [-180..180, -90..90]. Kemungkinan berproyeksi UTM/Web Mercator."

    return True, "WGS84 OK"


def is_kalimantan_province(prov_str: str):
    if not prov_str:
        return False
    lower = prov_str.lower()
    return any(k in lower for k in ["kalimantan", "kalbar", "kalteng", "kalsel", "kaltim", "kaltara"])


def validate_and_import_geojson(
    file_path: str,
    dry_run: bool = False,
    limit: int = None,
    kalimantan_only: bool = False,
    target_province: str = None,
):
    path = Path(file_path)
    if not path.is_file():
        print(f"[ERROR] File dataset tidak ditemukan: {file_path}")
        print("\nPetunjuk Pengadaan Dataset Batas Wilayah Kecamatan:")
        print("1. Unduh dataset batas wilayah resmi:")
        print("   - GADM v4.1 (Level 3 - Sub-district): https://gadm.org/download_country.html")
        print("   - Badan Informasi Geospasial (BIG) / BPS: Peta batas administrasi kecamatan (KDPKEC, WADMKC).")
        print("   - UN OCHA HDX: https://data.humdata.org/ (Indonesia Subnational Boundaries Level 3).")
        print("2. Simpan file dalam format GeoJSON dengan CRS EPSG:4326 (WGS84 decimal degrees).")
        print("3. Letakkan file di folder misal 'backend/data/boundaries/kalimantan_districts.geojson'.")
        print("4. Jalankan: python backend/scripts/import_boundaries.py --file <path_file.geojson> [--kalimantan-only]\n")
        return False

    print(f"[*] Membaca file GeoJSON: {file_path}")
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"[ERROR] Gagal membaca GeoJSON: {e}")
        return False

    # Validasi elemen CRS jika ada di file
    crs_info = data.get("crs")
    if crs_info:
        crs_name = str(crs_info).lower()
        if "4326" in crs_name or "crs84" in crs_name:
            print("[OK] CRS dideklarasikan: WGS 84 (EPSG:4326)")
        else:
            print(f"[!] PERINGATAN: CRS file mendeklarasikan non-4326 ({crs_info}). Verifikasi ulang proyeksi.")

    features = data.get("features", [])
    if not features:
        print("[ERROR] GeoJSON tidak memiliki elemen 'features' yang valid.")
        return False

    if limit and limit > 0:
        print(f"[*] Membatasi pengujian pada {limit} fitur pertama.")
        features = features[:limit]

    engine = get_engine()
    stats = {
        "total": len(features),
        "valid_geom": 0,
        "repaired_geom": 0,
        "invalid_geom": 0,
        "missing_attrs": 0,
        "skipped_province": 0,
        "gadm_scheme": 0,
        "kemendagri_scheme": 0,
        "imported": 0,
    }

    print(f"[*] Total fitur yang akan diperiksa: {stats['total']} fitur")
    if dry_run:
        print("[*] Mode DRY-RUN AKTIF: seluruh validasi dilakukan tanpa menyimpan ke database.")

    with engine.begin() as conn:
        for idx, feat in enumerate(features, 1):
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})

            name = find_attribute(props, NAME_KEYS)
            regency = find_attribute(props, REGENCY_KEYS) or "Tidak diketahui"
            province = find_attribute(props, PROVINCE_KEYS) or "Kalimantan"

            # Filter provinsi jika diminta
            if target_province and target_province.lower() not in province.lower():
                stats["skipped_province"] += 1
                continue

            if kalimantan_only and not is_kalimantan_province(province):
                stats["skipped_province"] += 1
                continue

            # Identifikasi ID Wilayah: GADM vs Kemendagri
            gadm_val = find_attribute(props, GADM_ID_KEYS)
            kemendagri_val = find_attribute(props, KEMENDAGRI_CODE_KEYS)
            generic_id = find_attribute(props, GENERIC_ID_KEYS)

            gid_3 = None
            kemendagri_code = None

            if gadm_val and kemendagri_val:
                gid_3 = gadm_val
                kemendagri_code = kemendagri_val
                stats["gadm_scheme"] += 1
                stats["kemendagri_scheme"] += 1
            elif gadm_val:
                gid_3 = gadm_val
                stats["gadm_scheme"] += 1
            elif kemendagri_val:
                gid_3 = kemendagri_val
                kemendagri_code = kemendagri_val
                stats["kemendagri_scheme"] += 1
            elif generic_id:
                # Periksa pola generic_id
                if generic_id.startswith("IDN."):
                    gid_3 = generic_id
                    stats["gadm_scheme"] += 1
                elif re.match(r"^\d{2}(\.\d{2})*$", generic_id) or generic_id.isdigit():
                    gid_3 = generic_id
                    kemendagri_code = generic_id
                    stats["kemendagri_scheme"] += 1
                else:
                    gid_3 = generic_id

            if not gid_3 or not name:
                stats["missing_attrs"] += 1
                print(f"[!] Fitur #{idx} dilewati: atribut wajib ID ('gid_3'/'KDPKEC') atau Nama ('name'/'WADMKC') tidak ditemukan.")
                continue

            if not geom or geom.get("type") not in ("Polygon", "MultiPolygon"):
                stats["invalid_geom"] += 1
                print(f"[!] Fitur #{idx} ({gid_3} - {name}) dilewati: geometri bukan Polygon/MultiPolygon.")
                continue

            # Validasi derajat koordinat WGS84
            sample_coords = extract_sample_coords(geom)
            coords_ok, coords_msg = validate_coordinates_sanity(sample_coords)
            if not coords_ok:
                stats["invalid_geom"] += 1
                print(f"[!] Fitur #{idx} ({gid_3} - {name}) koordinat tidak valid: {coords_msg}")
                continue

            geom_str = json.dumps(geom)

            # Validasi geometri di PostGIS ST_IsValid
            try:
                is_valid = conn.execute(
                    text("SELECT ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326))"),
                    {"geom": geom_str}
                ).scalar()
            except Exception:
                is_valid = False

            needs_repair = False
            if not is_valid:
                # Upaya perbaikan geometri menggunakan ST_MakeValid
                try:
                    repaired_valid = conn.execute(
                        text("SELECT ST_IsValid(ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326)))"),
                        {"geom": geom_str}
                    ).scalar()
                    if repaired_valid:
                        needs_repair = True
                        stats["repaired_geom"] += 1
                    else:
                        stats["invalid_geom"] += 1
                        print(f"[!] Fitur #{idx} ({gid_3} - {name}) geometri tidak valid dan gagal diperbaiki oleh ST_MakeValid.")
                        continue
                except Exception:
                    stats["invalid_geom"] += 1
                    continue
            else:
                stats["valid_geom"] += 1

            if not dry_run:
                try:
                    insert_sql = """
                        INSERT INTO districts (gid_3, kemendagri_code, name, regency, province, geom)
                        VALUES (
                            :gid_3,
                            :kemendagri_code,
                            :name,
                            :regency,
                            :province,
                            ST_Multi(""" + ("ST_MakeValid(" if needs_repair else "") + """ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326)""" + (")" if needs_repair else "") + """)
                        )
                        ON CONFLICT (gid_3) DO UPDATE
                        SET kemendagri_code = EXCLUDED.kemendagri_code,
                            name = EXCLUDED.name,
                            regency = EXCLUDED.regency,
                            province = EXCLUDED.province,
                            geom = EXCLUDED.geom
                    """
                    with conn.begin_nested():
                        conn.execute(
                            text(insert_sql),
                            {
                                "gid_3": gid_3,
                                "kemendagri_code": kemendagri_code,
                                "name": name,
                                "regency": regency,
                                "province": province,
                                "geom": geom_str,
                            }
                        )
                    stats["imported"] += 1
                except Exception as e:
                    print(f"[ERROR] Gagal menyimpan #{idx} ({gid_3} - {name}): {e}")
            else:
                stats["imported"] += 1

    print("\n==================================================")
    print("    LAPORAN HASIL VALIDASI & IMPOR BATAS WILAYAH   ")
    print("==================================================")
    print(f"Total Fitur Diproses           : {stats['total']}")
    print(f"Geometri Valid Asli            : {stats['valid_geom']}")
    print(f"Geometri Diperbaiki ST_MakeValid: {stats['repaired_geom']}")
    print(f"Geometri Tidak Valid (Dilewati): {stats['invalid_geom']}")
    print(f"Atribut Kurang (Dilewati)      : {stats['missing_attrs']}")
    print(f"Provinsi Luar Target (Dilewati): {stats['skipped_province']}")
    print(f"Format Kode GADM Dikenali      : {stats['gadm_scheme']}")
    print(f"Format Kode Kemendagri Dikenali: {stats['kemendagri_scheme']}")
    print(f"Berhasil Diproses/Diimpor      : {stats['imported']} (Mode: {'DRY-RUN' if dry_run else 'DATABASE'})")
    return stats["imported"] > 0


def main():
    parser = argparse.ArgumentParser(
        description="PHYRA Boundary Importer - Mengimpor dan memvalidasi batas wilayah kecamatan ke PostGIS.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--file", help="Path ke file GeoJSON batas wilayah kecamatan", default=None)
    parser.add_argument("--dry-run", action="store_true", help="Uji validasi tanpa menulis ke database")
    parser.add_argument("--limit", type=int, default=None, help="Batasi jumlah fitur untuk pengujian")
    parser.add_argument("--kalimantan-only", action="store_true", help="Hanya proses fitur dari 5 provinsi Kalimantan")
    parser.add_argument("--province", help="Filter nama provinsi tertentu (contoh: 'Kalimantan Timur')", default=None)
    args = parser.parse_args()

    if not args.file:
        print("[INFO] Tidak ada file dataset yang ditentukan.")
        print("Penggunaan: python backend/scripts/import_boundaries.py --file <path_file.geojson> [--dry-run] [--kalimantan-only]")
        validate_and_import_geojson("data/boundaries/kalimantan_districts.geojson", dry_run=True)
        return

    validate_and_import_geojson(
        args.file,
        dry_run=args.dry_run,
        limit=args.limit,
        kalimantan_only=args.kalimantan_only,
        target_province=args.province,
    )


if __name__ == "__main__":
    main()
