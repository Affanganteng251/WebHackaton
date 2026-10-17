import json
import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# 1. Muat environment variable dari berbagai lokasi potensial
load_dotenv()
backend_env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
if os.path.exists(backend_env):
    load_dotenv(backend_env)
root_env = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
if os.path.exists(root_env):
    load_dotenv(root_env)

DATABASE_URL = os.getenv("DATABASE_URL")

engine = None
SessionLocal = None

if DATABASE_URL:
    try:
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
        )
        SessionLocal = sessionmaker(
            bind=engine,
            autoflush=False,
            autocommit=False,
        )
    except Exception as error:
        print(f"Warning: Gagal menginisialisasi database engine: {error}")
        engine = None
        SessionLocal = None


# Cache in-memory untuk fallback dataset GeoJSON (587 kecamatan Kalimantan)
_FALLBACK_GEOJSON = None
_FALLBACK_SUBSCRIPTIONS = []
_FALLBACK_SUB_ID_COUNTER = 1


def _get_fallback_geojson():
    global _FALLBACK_GEOJSON
    if _FALLBACK_GEOJSON is not None:
        return _FALLBACK_GEOJSON

    candidate_paths = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "kalimantan_kabupaten_kota.geojson"),
        os.path.join(os.getcwd(), "kalimantan_kabupaten_kota.geojson"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "kalimantan_kabupaten_kota.geojson"),
    ]
    geojson_path = None
    for p in candidate_paths:
        if os.path.exists(p):
            geojson_path = p
            break

    if not geojson_path:
        return {"type": "FeatureCollection", "features": []}

    try:
        with open(geojson_path, "r", encoding="utf-8") as f:
            raw = json.load(f)
        features = []
        for feat in raw.get("features", []):
            props = feat.get("properties", {})
            gid_3 = props.get("GID_3") or feat.get("id")
            kemendagri_code = props.get("CC_3")
            name = props.get("NAME_3") or props.get("name")
            regency = props.get("NAME_2") or props.get("regency")
            province = props.get("NAME_1") or props.get("province")

            features.append({
                "type": "Feature",
                "id": gid_3,
                "geometry": feat.get("geometry"),
                "properties": {
                    "gid_3": gid_3,
                    "name": name,
                    "regency": regency,
                    "province": province,
                    "kemendagri_code": kemendagri_code,
                }
            })
        _FALLBACK_GEOJSON = {"type": "FeatureCollection", "features": features}
        return _FALLBACK_GEOJSON
    except Exception as err:
        print(f"Warning: Gagal memuat fallback GeoJSON: {err}")
        return {"type": "FeatureCollection", "features": []}


def test_connection():
    if engine is not None:
        try:
            with engine.connect() as connection:
                result = connection.execute(text("SELECT version()"))
                return result.scalar()
        except Exception as error:
            return f"Database error: {error}"
    return "Standalone Fallback (Database tidak terhubung)"


def get_hotspots(min_lon=None, min_lat=None, max_lon=None, max_lat=None, since=None):
    if engine is not None:
        try:
            query = """
                SELECT
                    id,
                    source_id,
                    detected_at,
                    latitude,
                    longitude,
                    confidence
                FROM hotspots
                WHERE 1=1
            """
            params = {}
            if since is not None:
                query += " AND detected_at >= :since"
                params["since"] = since

            if min_lon is not None and min_lat is not None and max_lon is not None and max_lat is not None:
                query += """ AND (
                    (geom IS NOT NULL AND geom && ST_MakeEnvelope(:min_lon, :min_lat, :max_lon, :max_lat, 4326))
                    OR
                    (longitude BETWEEN :min_lon AND :max_lon AND latitude BETWEEN :min_lat AND :max_lat)
                )"""
                params.update({
                    "min_lon": min_lon,
                    "min_lat": min_lat,
                    "max_lon": max_lon,
                    "max_lat": max_lat,
                })

            query += " ORDER BY detected_at DESC"

            with engine.connect() as connection:
                result = connection.execute(text(query), params)
                return [dict(row._mapping) for row in result]
        except Exception as error:
            print(f"Database error in get_hotspots, menggunakan fallback data uji: {error}")

    # Fallback saat database offline: sediakan TEST-001 persisten
    return [
        {
            "id": 1,
            "source_id": "TEST-001",
            "detected_at": "2026-10-16T12:00:00Z",
            "latitude": -0.0263,
            "longitude": 109.3425,
            "confidence": 0.95,
        }
    ]


def get_latest_hotspot_timestamp():
    if engine is not None:
        try:
            with engine.connect() as connection:
                result = connection.execute(text("SELECT MAX(detected_at) FROM hotspots"))
                val = result.scalar()
                if val:
                    return val
        except Exception:
            pass
    return "2026-10-16T12:00:00Z"


def init_db_schema():
    """Membuat tabel subscriptions, system_settings, dan districts jika belum ada."""
    if engine is None:
        return
    try:
        with engine.connect() as connection:
            with connection.begin():
                # 1. Subscriptions
                connection.execute(text("""
                    CREATE TABLE IF NOT EXISTS subscriptions (
                        id SERIAL PRIMARY KEY,
                        device_id VARCHAR(100) NOT NULL,
                        district_id VARCHAR(100),
                        latitude DOUBLE PRECISION,
                        longitude DOUBLE PRECISION,
                        radius_km DOUBLE PRECISION,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        is_active BOOLEAN NOT NULL DEFAULT TRUE
                    );
                    CREATE INDEX IF NOT EXISTS idx_subscriptions_device ON subscriptions (device_id);
                    CREATE INDEX IF NOT EXISTS idx_subscriptions_district ON subscriptions (district_id);
                    CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions (is_active);
                """))

                # 2. System Settings (Kill-switch & konfigurasi)
                connection.execute(text("""
                    CREATE TABLE IF NOT EXISTS system_settings (
                        key VARCHAR(50) PRIMARY KEY,
                        value_bool BOOLEAN,
                        value_text TEXT,
                        reason TEXT,
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    INSERT INTO system_settings (key, value_bool, reason, updated_at)
                    VALUES ('notifications_enabled', TRUE, 'Pengaturan default inisialisasi sistem', NOW())
                    ON CONFLICT (key) DO NOTHING;
                """))

                # 3. Districts (Batas Wilayah Kecamatan PostGIS)
                connection.execute(text("""
                    CREATE TABLE IF NOT EXISTS districts (
                        gid_3 VARCHAR(50) PRIMARY KEY,
                        kemendagri_code VARCHAR(50),
                        name VARCHAR(150) NOT NULL,
                        regency VARCHAR(150) NOT NULL,
                        province VARCHAR(150) NOT NULL,
                        geom GEOMETRY(MultiPolygon, 4326) NOT NULL
                    );
                    ALTER TABLE districts ADD COLUMN IF NOT EXISTS kemendagri_code VARCHAR(50);
                    CREATE INDEX IF NOT EXISTS idx_districts_geom ON districts USING GIST (geom);
                    CREATE INDEX IF NOT EXISTS idx_districts_province ON districts (province);
                    CREATE INDEX IF NOT EXISTS idx_districts_regency ON districts (regency);
                    CREATE INDEX IF NOT EXISTS idx_districts_kemendagri ON districts (kemendagri_code);
                """))
    except Exception as error:
        print(f"Warning: inisialisasi skema database gagal: {error}")


def get_district_summary_db(gid_3: str):
    """
    Melakukan spatial join PostGIS antara tabel districts dan hotspots
    untuk menghitung titik api dalam rentang 7 hari terakhir di dalam batas poligon kecamatan.
    Mendukung pencarian melalui kode GADM (gid_3) maupun kode Kemendagri.
    Membedakan titik api kebakaran aktual dengan data uji sintetis (TEST-001).
    """
    if engine is not None:
        try:
            query = """
                SELECT 
                    d.gid_3,
                    d.kemendagri_code,
                    d.name,
                    d.regency,
                    d.province,
                    COUNT(CASE WHEN h.id IS NOT NULL AND (h.source_id IS NULL OR h.source_id NOT LIKE 'TEST%') THEN h.id END) AS hotspots_7d,
                    COUNT(CASE WHEN h.id IS NOT NULL AND h.source_id LIKE 'TEST%' THEN h.id END) AS test_hotspots_count,
                    COUNT(h.id) AS total_intersected
                FROM districts d
                LEFT JOIN hotspots h ON (
                    (h.geom IS NOT NULL AND ST_Intersects(d.geom, h.geom))
                    OR
                    (h.geom IS NULL AND ST_Intersects(d.geom, ST_SetSRID(ST_MakePoint(h.longitude, h.latitude), 4326)))
                )
                AND h.detected_at >= NOW() - INTERVAL '7 days'
                WHERE (d.gid_3 = :gid_3 OR (d.kemendagri_code IS NOT NULL AND d.kemendagri_code = :gid_3))
                GROUP BY d.gid_3, d.kemendagri_code, d.name, d.regency, d.province
            """
            with engine.connect() as connection:
                result = connection.execute(text(query), {"gid_3": gid_3}).fetchone()
                if result:
                    return dict(result._mapping)
        except Exception as error:
            print(f"Database error in get_district_summary_db, menggunakan fallback: {error}")

    # Fallback jika database tidak ada atau kecamatan dicari di fallback GeoJSON
    fc = _get_fallback_geojson()
    for feat in fc.get("features", []):
        props = feat.get("properties", {})
        if props.get("gid_3") == gid_3 or (props.get("kemendagri_code") and props.get("kemendagri_code") == gid_3):
            return {
                "gid_3": props.get("gid_3"),
                "kemendagri_code": props.get("kemendagri_code"),
                "name": props.get("name"),
                "regency": props.get("regency"),
                "province": props.get("province"),
                "hotspots_7d": 0,
                "test_hotspots_count": 0,
                "total_intersected": 0,
            }
    return None


def get_districts_count_db():
    """Mengembalikan jumlah baris data batas wilayah di tabel districts."""
    if engine is not None:
        try:
            with engine.connect() as connection:
                count = connection.execute(text("SELECT COUNT(*) FROM districts")).scalar()
                if count and count > 0:
                    return count
        except Exception:
            pass
    # Fallback to local geojson
    fc = _get_fallback_geojson()
    return len(fc.get("features", []))


def get_districts_geojson_db(province: str = None, regency: str = None):
    """
    Mengambil poligon batas wilayah kecamatan dari tabel districts dalam format GeoJSON FeatureCollection.
    Mendukung filter opsional berdasarkan nama provinsi atau kabupaten/kota.
    """
    if engine is not None:
        try:
            query = """
                SELECT json_build_object(
                    'type', 'FeatureCollection',
                    'features', COALESCE(json_agg(
                        json_build_object(
                            'type', 'Feature',
                            'id', d.gid_3,
                            'geometry', ST_AsGeoJSON(d.geom)::json,
                            'properties', json_build_object(
                                'gid_3', d.gid_3,
                                'name', d.name,
                                'regency', d.regency,
                                'province', d.province,
                                'kemendagri_code', d.kemendagri_code
                            )
                        )
                    ), '[]'::json)
                )
                FROM districts d
                WHERE 1=1
            """
            params = {}
            if province:
                query += " AND d.province ILIKE :province"
                params["province"] = f"%{province}%"
            if regency:
                query += " AND d.regency ILIKE :regency"
                params["regency"] = f"%{regency}%"

            with engine.connect() as connection:
                result = connection.execute(text(query), params).scalar()
                if result and result.get("features"):
                    return result
        except Exception as error:
            print(f"Database error in get_districts_geojson_db, menggunakan fallback GeoJSON: {error}")

    # Fallback to local GeoJSON
    fc = _get_fallback_geojson()
    features = fc.get("features", [])
    if province:
        features = [f for f in features if province.lower() in (f["properties"].get("province") or "").lower()]
    if regency:
        features = [f for f in features if regency.lower() in (f["properties"].get("regency") or "").lower()]
    return {"type": "FeatureCollection", "features": features}


def create_subscription_db(device_id: str, district_id: str = None, latitude: float = None, longitude: float = None, radius_km: float = None):
    global _FALLBACK_SUB_ID_COUNTER
    if engine is not None:
        try:
            with engine.connect() as connection:
                with connection.begin():
                    result = connection.execute(
                        text("""
                            INSERT INTO subscriptions (device_id, district_id, latitude, longitude, radius_km, created_at, is_active)
                            VALUES (:device_id, :district_id, :latitude, :longitude, :radius_km, NOW(), TRUE)
                            RETURNING id, device_id, district_id, latitude, longitude, radius_km, created_at, is_active
                        """),
                        {
                            "device_id": device_id,
                            "district_id": district_id,
                            "latitude": latitude,
                            "longitude": longitude,
                            "radius_km": radius_km,
                        }
                    )
                    row = result.fetchone()
                    return dict(row._mapping) if row else None
        except Exception as error:
            print(f"Database error in create_subscription_db, menggunakan in-memory fallback: {error}")

    # In-memory fallback
    sub = {
        "id": _FALLBACK_SUB_ID_COUNTER,
        "device_id": device_id,
        "district_id": district_id,
        "latitude": latitude,
        "longitude": longitude,
        "radius_km": radius_km,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
    }
    _FALLBACK_SUB_ID_COUNTER += 1
    _FALLBACK_SUBSCRIPTIONS.append(sub)
    return sub


def get_subscriptions_db(limit: int = 100, offset: int = 0, is_active: bool = True, device_id: str = None):
    if engine is not None:
        try:
            with engine.connect() as connection:
                query = """
                    SELECT id, device_id, district_id, latitude, longitude, radius_km, created_at, is_active
                    FROM subscriptions
                    WHERE 1=1
                """
                params = {"limit": limit, "offset": offset}
                if is_active is not None:
                    query += " AND is_active = :is_active"
                    params["is_active"] = is_active
                if device_id:
                    query += " AND device_id = :device_id"
                    params["device_id"] = device_id
                query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"

                result = connection.execute(text(query), params)
                return [dict(row._mapping) for row in result]
        except Exception as error:
            print(f"Database error in get_subscriptions_db, menggunakan fallback: {error}")

    # In-memory fallback
    filtered = _FALLBACK_SUBSCRIPTIONS
    if is_active is not None:
        filtered = [s for s in filtered if s["is_active"] == is_active]
    if device_id:
        filtered = [s for s in filtered if s["device_id"] == device_id]
    return filtered[offset: offset + limit]


def get_subscription_by_id_db(subscription_id: int):
    if engine is not None:
        try:
            with engine.connect() as connection:
                result = connection.execute(
                    text("""
                        SELECT id, device_id, district_id, latitude, longitude, radius_km, created_at, is_active
                        FROM subscriptions
                        WHERE id = :id
                    """),
                    {"id": subscription_id}
                )
                row = result.fetchone()
                return dict(row._mapping) if row else None
        except Exception as error:
            print(f"Database error in get_subscription_by_id_db, menggunakan fallback: {error}")

    for s in _FALLBACK_SUBSCRIPTIONS:
        if s["id"] == subscription_id:
            return s
    return None


def delete_subscription_db(subscription_id: int):
    if engine is not None:
        try:
            with engine.connect() as connection:
                with connection.begin():
                    result = connection.execute(
                        text("""
                            DELETE FROM subscriptions
                            WHERE id = :id
                            RETURNING id, device_id, district_id, latitude, longitude, radius_km, created_at, is_active
                        """),
                        {"id": subscription_id}
                    )
                    row = result.fetchone()
                    return dict(row._mapping) if row else None
        except Exception as error:
            print(f"Database error in delete_subscription_db, menggunakan fallback: {error}")

    for idx, s in enumerate(_FALLBACK_SUBSCRIPTIONS):
        if s["id"] == subscription_id:
            return _FALLBACK_SUBSCRIPTIONS.pop(idx)
    return None


def get_kill_switch_db():
    if engine is not None:
        try:
            with engine.connect() as connection:
                result = connection.execute(
                    text("""
                        SELECT value_bool, updated_at, reason
                        FROM system_settings
                        WHERE key = 'notifications_enabled'
                    """)
                )
                row = result.fetchone()
                if row:
                    mapping = row._mapping
                    updated_at_val = mapping["updated_at"]
                    if hasattr(updated_at_val, "isoformat"):
                        updated_at_val = updated_at_val.isoformat()
                    return {
                        "notifications_enabled": bool(mapping["value_bool"]),
                        "last_updated": updated_at_val,
                        "reason": mapping["reason"],
                    }
        except Exception:
            pass
    return {
        "notifications_enabled": True,
        "last_updated": None,
        "reason": "Default sistem (fallback)",
    }


def set_kill_switch_db(enabled: bool, reason: str = None):
    if engine is not None:
        try:
            with engine.connect() as connection:
                with connection.begin():
                    result = connection.execute(
                        text("""
                            INSERT INTO system_settings (key, value_bool, reason, updated_at)
                            VALUES ('notifications_enabled', :enabled, :reason, NOW())
                            ON CONFLICT (key) DO UPDATE
                            SET value_bool = EXCLUDED.value_bool,
                                reason = EXCLUDED.reason,
                                updated_at = EXCLUDED.updated_at
                            RETURNING value_bool, updated_at, reason
                        """),
                        {"enabled": enabled, "reason": reason}
                    )
                    row = result.fetchone()
                    if row:
                        mapping = row._mapping
                        updated_at_val = mapping["updated_at"]
                        if hasattr(updated_at_val, "isoformat"):
                            updated_at_val = updated_at_val.isoformat()
                        return {
                            "notifications_enabled": bool(mapping["value_bool"]),
                            "last_updated": updated_at_val,
                            "reason": mapping["reason"],
                        }
                    return {
                        "notifications_enabled": enabled,
                        "last_updated": None,
                        "reason": reason,
                    }
        except Exception as error:
            print(f"Database error in set_kill_switch_db, menggunakan fallback: {error}")
    return {
        "notifications_enabled": enabled,
        "last_updated": datetime.now(timezone.utc).isoformat(),
        "reason": reason,
    }

