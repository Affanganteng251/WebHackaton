import os
import secrets
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.database import (
    create_subscription_db,
    delete_subscription_db,
    get_district_summary_db,
    get_districts_count_db,
    get_districts_geojson_db,
    get_hotspots as get_hotspots_db,
    get_kill_switch_db,
    get_latest_hotspot_timestamp,
    get_subscription_by_id_db,
    get_subscriptions_db,
    init_db_schema,
    set_kill_switch_db,
)
from app.simulation_data import (
    get_simulation_deforestation_alerts,
    get_simulation_district_summary,
    get_simulation_hotspots,
    get_simulation_risk,
    get_simulation_status,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        init_db_schema()
    except Exception as error:
        print(f"Warning: inisialisasi skema database gagal: {error}")
    yield


app = FastAPI(
    title="API Pemantauan Titik Api Kalimantan (PHYRA)",
    description=(
        "API pemantauan titik api dan kualitas udara di Kalimantan. "
        "Hotspots, subscriptions, dan system settings telah terhubung secara persisten ke PostgreSQL."
    ),
    version="0.2.0",
    lifespan=lifespan,
)


# CORS untuk frontend lokal yang dijalankan melalui VS Code Live Server.
# Jika Live Server memakai port lain, tambahkan origin yang sesuai.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

NOW = datetime.now(timezone.utc)

# DATA DUMMY: koordinat, waktu, dan nilai dibuat untuk pengujian API saja.
HOTSPOTS = [
    {
        "id": "HS-DUMMY-001",
        "latitude": -0.502,
        "longitude": 117.153,
        "detected_at": (NOW - timedelta(hours=3)).isoformat(),
        "satellite": "VIIRS-DUMMY",
        "confidence": "nominal",
        "frp": 8.4,
        "district": "Samarinda (dummy)",
        "is_peatland": True,
        "data_source": "dummy",
    },
    {
        "id": "HS-DUMMY-002",
        "latitude": 1.265,
        "longitude": 116.831,
        "detected_at": (NOW - timedelta(hours=8)).isoformat(),
        "satellite": "VIIRS-DUMMY",
        "confidence": "high",
        "frp": 12.1,
        "district": "Balikpapan (dummy)",
        "is_peatland": False,
        "data_source": "dummy",
    },
    {
        "id": "HS-DUMMY-003",
        "latitude": -1.240,
        "longitude": 116.910,
        "detected_at": (NOW - timedelta(days=2)).isoformat(),
        "satellite": "VIIRS-DUMMY",
        "confidence": "nominal",
        "frp": 5.7,
        "district": "Penajam (dummy)",
        "is_peatland": True,
        "data_source": "dummy",
    },
]

DEFORESTATION_ALERTS = [
    {
        "id": "DF-DUMMY-001",
        "latitude": -0.650,
        "longitude": 117.400,
        "detected_at": (NOW - timedelta(days=1)).isoformat(),
        "source": "GLAD-DUMMY",
        "confidence": "medium",
        "data_source": "dummy",
    },
    {
        "id": "DF-DUMMY-002",
        "latitude": 1.100,
        "longitude": 116.700,
        "detected_at": (NOW - timedelta(days=4)).isoformat(),
        "source": "RADD-DUMMY",
        "confidence": "high",
        "data_source": "dummy",
    },
]

RISK_DATA = {
    7: [
        {"cell_id": "CELL-DUMMY-001", "latitude": -0.50, "longitude": 117.15, "probability": 0.78, "category": "high", "top_factors_id": ["curah_hujan_rendah", "suhu_permukaan_tinggi", "lahan_gambut"]},
        {"cell_id": "CELL-DUMMY-002", "latitude": 1.26, "longitude": 116.83, "probability": 0.42, "category": "medium", "top_factors_id": ["kelembapan_tanah_menurun", "anomali_vegetasi"]},
        {"cell_id": "CELL-DUMMY-003", "latitude": -1.24, "longitude": 116.91, "probability": 0.18, "category": "low", "top_factors_id": ["curah_hujan_cukup", "tutupan_hutan_lebat"]},
    ],
    14: [
        {"cell_id": "CELL-DUMMY-001", "latitude": -0.50, "longitude": 117.15, "probability": 0.81, "category": "high", "top_factors_id": ["tren_kekeringan_berlanjut", "suhu_permukaan_tinggi"]},
        {"cell_id": "CELL-DUMMY-002", "latitude": 1.26, "longitude": 116.83, "probability": 0.55, "category": "medium", "top_factors_id": ["penurunan_kelembapan_tanah"]},
        {"cell_id": "CELL-DUMMY-003", "latitude": -1.24, "longitude": 116.91, "probability": 0.25, "category": "low", "top_factors_id": ["tutupan_hutan_stabil"]},
    ],
    30: [
        {"cell_id": "CELL-DUMMY-001", "latitude": -0.50, "longitude": 117.15, "probability": 0.63, "category": "medium", "top_factors_id": ["proyeksi_musim_kemarau"]},
        {"cell_id": "CELL-DUMMY-002", "latitude": 1.26, "longitude": 116.83, "probability": 0.37, "category": "medium", "top_factors_id": ["variasi_iklim_regional"]},
        {"cell_id": "CELL-DUMMY-003", "latitude": -1.24, "longitude": 116.91, "probability": 0.12, "category": "low", "top_factors_id": ["curah_hujan_musiman"]},
    ],
}

class SubscriptionCreate(BaseModel):
    device_id: str = Field(min_length=1, max_length=100)
    district_id: Optional[str] = Field(default=None, max_length=100)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    radius_km: Optional[float] = Field(default=None, gt=0, le=500)



@app.get("/v1")
def root():
    return {
        "message": "API Pemantauan Titik Api Kalimantan aktif",
        "data_mode": "database",
        "docs": "/docs",
        "warning": "Gunakan mode Realtime atau Simulasi untuk visualisasi titik api dan risiko kebakaran.",
    }


@app.get("/health")
def health():
    return {"status": "ok", "data_mode": "dummy", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/v1/meta/status")
def meta_status():
    hotspot_age_hours = None
    latest_detected_iso = None
    try:
        latest_dt = get_latest_hotspot_timestamp()
        if latest_dt:
            now = datetime.now(timezone.utc)
            if latest_dt.tzinfo is None:
                latest_dt = latest_dt.replace(tzinfo=timezone.utc)
            delta_hours = (now - latest_dt).total_seconds() / 3600
            hotspot_age_hours = round(max(0.0, delta_hours), 1)
            latest_detected_iso = latest_dt.isoformat()
    except Exception:
        pass

    return {
        "schema_version": "1.0",
        "status": "ok",
        "data_mode": "database",
        "model_version": None,
        "model_status": "not_connected",
        "data_age_hours": {
            "hotspots": hotspot_age_hours,
            "deforestation_alerts": 24,
            "weather": None,
        },
        "latest_detected_at": latest_detected_iso,
        "message": "Umur data hotspot dihitung dari database PostgreSQL.",
    }


def parse_bbox_bounds(bbox: Optional[str]):
    if not bbox or not isinstance(bbox, str):
        return None, None, None, None
    try:
        parts = [float(value.strip()) for value in bbox.split(",")]
        if len(parts) != 4:
            raise ValueError
        min_lon, min_lat, max_lon, max_lat = parts
        if min_lon > max_lon or min_lat > max_lat:
            raise ValueError
        return min_lon, min_lat, max_lon, max_lat
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="bbox harus berformat min_lon,min_lat,max_lon,max_lat",
        )


def parse_since_datetime(since: Optional[str]):
    if not since or not isinstance(since, str):
        return None
    try:
        since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        if since_dt.tzinfo is None:
            since_dt = since_dt.replace(tzinfo=timezone.utc)
        return since_dt
    except ValueError:
        raise HTTPException(status_code=400, detail="since harus berupa tanggal ISO 8601")



def filter_bbox(items, bbox):
    """bbox format: min_lon,min_lat,max_lon,max_lat"""
    if not bbox or not isinstance(bbox, str):
        return items
    try:
        parts = [float(value.strip()) for value in bbox.split(",")]
        if len(parts) != 4:
            raise ValueError
        min_lon, min_lat, max_lon, max_lat = parts
        if min_lon > max_lon or min_lat > max_lat:
            raise ValueError
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="bbox harus berformat min_lon,min_lat,max_lon,max_lat",
        )

    return [
        item for item in items
        if min_lon <= item["longitude"] <= max_lon
        and min_lat <= item["latitude"] <= max_lat
    ]


def filter_since(items, since):
    if not since or not isinstance(since, str):
        return items
    try:
        since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        if since_dt.tzinfo is None:
            since_dt = since_dt.replace(tzinfo=timezone.utc)
    except ValueError:
        raise HTTPException(status_code=400, detail="since harus berupa tanggal ISO 8601")
    filtered = []
    for item in items:
        detected_at = item["detected_at"]
        if isinstance(detected_at, str):
            detected_at = datetime.fromisoformat(detected_at.replace("Z", "+00:00"))
        if detected_at.tzinfo is None:
            detected_at = detected_at.replace(tzinfo=timezone.utc)
        if detected_at >= since_dt:
            filtered.append(item)
    return filtered


@app.get("/v1/hotspots")
def get_hotspots(
    bbox: Optional[str] = Query(default=None, description="min_lon,min_lat,max_lon,max_lat"),
    since: Optional[str] = Query(default=None, description="ISO 8601, contoh 2026-10-01T00:00:00Z"),
):
    """Mengambil hotspot dari PostgreSQL menggunakan filter PostGIS dan SQL."""
    min_lon, min_lat, max_lon, max_lat = parse_bbox_bounds(bbox)
    since_dt = parse_since_datetime(since)

    try:
        rows = get_hotspots_db(
            min_lon=min_lon,
            min_lat=min_lat,
            max_lon=max_lon,
            max_lat=max_lat,
            since=since_dt,
        )
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Gagal mengambil data hotspot dari database. Periksa koneksi PostgreSQL.",
        ) from error

    # Samakan nama field database dengan bentuk respons API yang digunakan frontend.
    items = []
    for row in rows:
        detected_at = row["detected_at"]
        if isinstance(detected_at, datetime):
            detected_at = detected_at.isoformat()
        items.append({
            "id": row["source_id"] or str(row["id"]),
            "database_id": row["id"],
            "latitude": row["latitude"],
            "longitude": row["longitude"],
            "detected_at": detected_at,
            "confidence": row["confidence"],
            "data_source": "postgresql",
        })

    return {
        "data_mode": "database",
        "count": len(items),
        "items": items,
    }


@app.get("/v1/deforestation-alerts")
def get_deforestation_alerts(
    bbox: Optional[str] = Query(default=None, description="min_lon,min_lat,max_lon,max_lat"),
    since: Optional[str] = Query(default=None, description="Tanggal ISO 8601"),
    format: Optional[str] = Query(default="default", description="Format respons: 'default' atau 'geojson'"),
):
    items = filter_since(filter_bbox(DEFORESTATION_ALERTS, bbox), since)
    if format == "geojson":
        features = [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [item["longitude"], item["latitude"]],
                },
                "properties": {
                    "id": item["id"],
                    "detected_at": item["detected_at"],
                    "source": item["source"],
                    "confidence": item["confidence"],
                    "data_source": item["data_source"],
                },
            }
            for item in items
        ]
        return {
            "type": "FeatureCollection",
            "data_mode": "dummy",
            "warning": "Peringatan berikut adalah data dummy.",
            "features": features,
        }

    return {
        "data_mode": "dummy",
        "count": len(items),
        "warning": "Peringatan berikut adalah data dummy.",
        "items": items,
    }


@app.get("/v1/risk/latest")
def get_latest_risk(
    horizon: int = Query(default=7, description="Horizon prediksi: 7, 14, atau 30 hari")
):
    if horizon not in RISK_DATA:
        raise HTTPException(status_code=400, detail="horizon harus 7, 14, atau 30")
    return {
        "data_mode": "dummy",
        "horizon_days": horizon,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_version": None,
        "confidence": "indicative",
        "warning": "Probabilitas ini ilustrasi dummy, bukan prediksi model ML.",
        "count": len(RISK_DATA[horizon]),
        "items": RISK_DATA[horizon],
    }


@app.get("/v1/kecamatan/{gid_3}/summary")
def get_kecamatan_summary(
    gid_3: str,
    mode: Optional[str] = Query(default="database", description="Mode data: 'database' atau 'simulation'"),
):
    """
    Mengambil ringkasan kecamatan dan menghitung hotspot 7 hari terakhir
    menggunakan spatial join PostGIS terhadap batas wilayah kecamatan di tabel districts.
    Jika batas wilayah belum tersedia di database atau kecamatan tidak ditemukan,
    mengembalikan status ketersediaan eksplisit dengan hotspots_7d dan probabilitas risiko bernilai null.
    Jika mode == 'simulation', mengembalikan komparasi data aktual dan simulasi.
    """
    district_data = None
    districts_count = 0
    try:
        districts_count = get_districts_count_db()
        district_data = get_district_summary_db(gid_3)
    except Exception:
        pass

    if mode == "simulation":
        return get_simulation_district_summary(gid_3, actual_data=district_data)

    if district_data:
        actual_hs = int(district_data["hotspots_7d"])
        test_hs = int(district_data.get("test_hotspots_count", 0))

        warning_msg = "hotspots_7d dihitung melalui spatial join PostGIS batas wilayah kecamatan aktual. Prediksi risiko belum tersedia dari model ML (probabilitas bernilai null)."
        if test_hs > 0:
            warning_msg += f" Catatan: Terdeteksi {test_hs} titik data uji (TEST-001) dalam wilayah ini yang tidak dihitung sebagai hotspot kebakaran aktual."

        return {
            "data_mode": "partial",
            "boundary_status": "available",
            "schema_version": "1.0",
            "gid_3": district_data["gid_3"],
            "name": district_data["name"],
            "regency": district_data["regency"],
            "province": district_data["province"],
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "model_version": None,
            "hotspots_7d": actual_hs,
            "test_hotspots_7d": test_hs,
            "risk": {
                "7d": {"category": "unknown", "max_probability": None, "high_risk_cells": 0},
                "14d": {"category": "unknown", "max_probability": None, "high_risk_cells": 0},
                "30d": {"category": "unknown", "max_probability": None, "high_risk_cells": 0},
            },
            "confidence": "indicative",
            "warning": warning_msg,
        }

    # Kondisi: Tabel districts belum memiliki data (dataset belum diimpor)
    if districts_count == 0:
        return {
            "data_mode": "unavailable",
            "boundary_status": "dataset_empty",
            "schema_version": "1.0",
            "gid_3": gid_3,
            "name": None,
            "regency": None,
            "province": None,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "model_version": None,
            "hotspots_7d": None,
            "risk": {
                "7d": {"category": "unknown", "max_probability": None, "high_risk_cells": None},
                "14d": {"category": "unknown", "max_probability": None, "high_risk_cells": None},
                "30d": {"category": "unknown", "max_probability": None, "high_risk_cells": None},
            },
            "confidence": None,
            "warning": "Dataset batas wilayah belum diimpor ke tabel districts. Nilai hotspots_7d dan estimasi risiko belum tersedia (null).",
        }

    # Kondisi: Tabel districts telah terisi, tetapi ID kecamatan tidak ditemukan
    return {
        "data_mode": "unavailable",
        "boundary_status": "not_found",
        "schema_version": "1.0",
        "gid_3": gid_3,
        "name": None,
        "regency": None,
        "province": None,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_version": None,
        "hotspots_7d": None,
        "risk": {
            "7d": {"category": "unknown", "max_probability": None, "high_risk_cells": None},
            "14d": {"category": "unknown", "max_probability": None, "high_risk_cells": None},
            "30d": {"category": "unknown", "max_probability": None, "high_risk_cells": None},
        },
        "confidence": None,
        "warning": f"Batas wilayah untuk kecamatan dengan kode '{gid_3}' tidak ditemukan di tabel districts. Nilai hotspots_7d dan estimasi risiko belum tersedia (null).",
    }


@app.get("/v1/districts/geojson")
def get_districts_geojson(
    province: Optional[str] = Query(default=None, description="Filter nama provinsi (misal: 'Kalimantan Timur')"),
    regency: Optional[str] = Query(default=None, description="Filter nama kabupaten/kota (misal: 'Balikpapan')"),
):
    """
    Mengembalikan data poligon batas wilayah kecamatan Kalimantan
    dalam format GeoJSON FeatureCollection langsung dari database PostgreSQL/PostGIS.
    """
    return get_districts_geojson_db(province=province, regency=regency)


# ==========================================
# ENDPOINT MODE SIMULASI (SIMULATION MODE)
# ==========================================

@app.get("/v1/simulation/status")
def get_sim_status():
    """Mengembalikan metadata dan status ketersediaan data simulasi."""
    return get_simulation_status()


@app.get("/v1/simulation/hotspots")
def get_sim_hotspots(
    bbox: Optional[str] = Query(default=None, description="min_lon,min_lat,max_lon,max_lat"),
    since: Optional[str] = Query(default=None, description="ISO 8601 string"),
):
    """Mengambil titik api simulasi sintetis dengan filter bbox dan temporal."""
    items = get_simulation_hotspots(bbox=bbox, since=since)
    return {
        "data_mode": "simulation",
        "is_simulation": True,
        "warning": "SIMULASI — BUKAN DATA AKTUAL. Titik api ini sintetis untuk pengujian antarmuka.",
        "count": len(items),
        "items": items,
    }


@app.get("/v1/simulation/risk")
def get_sim_risk(
    horizon: int = Query(default=7, description="Horizon prediksi simulasi: 7, 14, atau 30 hari")
):
    """Mengembalikan pemetaan risiko simulasi seluruh kecamatan untuk horizon yang diminta."""
    if horizon not in (7, 14, 30):
        raise HTTPException(status_code=400, detail="horizon harus 7, 14, atau 30")
    return get_simulation_risk(horizon=horizon)


@app.get("/v1/simulation/kecamatan/{gid_3}/summary")
def get_sim_kecamatan_summary(gid_3: str):
    """
    Mengembalikan komparasi data aktual (PostGIS) dan data simulasi (cuaca, risiko, faktor penjelasan demonstrasi)
    untuk kecamatan tertentu.
    """
    district_data = None
    try:
        district_data = get_district_summary_db(gid_3)
    except Exception:
        pass
    return get_simulation_district_summary(gid_3, actual_data=district_data)


@app.get("/v1/simulation/deforestation-alerts")
def get_sim_deforestation(
    bbox: Optional[str] = Query(default=None),
    since: Optional[str] = Query(default=None),
):
    """Peringatan deforestasi simulasi untuk pengujian UI."""
    items = get_simulation_deforestation_alerts(bbox=bbox, since=since)
    return {
        "data_mode": "simulation",
        "is_simulation": True,
        "warning": "SIMULASI — BUKAN DATA AKTUAL.",
        "count": len(items),
        "items": items,
    }




def verify_admin_key(x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key")):
    expected_key = os.getenv("ADMIN_API_KEY")
    if not expected_key:
        raise HTTPException(
            status_code=503,
            detail="Layanan admin belum diaktifkan: ADMIN_API_KEY belum dikonfigurasi pada server.",
        )
    if not x_admin_key or not secrets.compare_digest(x_admin_key, expected_key):
        raise HTTPException(
            status_code=401,
            detail="Autentikasi admin gagal: Header X-Admin-Key tidak valid atau tidak disertakan.",
        )
    return True


@app.post("/v1/subscriptions", status_code=201)
def create_subscription(payload: SubscriptionCreate):
    if not payload.device_id or len(payload.device_id.strip()) == 0:
        raise HTTPException(
            status_code=422,
            detail="device_id tidak boleh kosong.",
        )

    if payload.district_id is None and (payload.latitude is None or payload.longitude is None):
        raise HTTPException(
            status_code=422,
            detail="Isi district_id atau latitude dan longitude untuk wilayah langganan.",
        )

    try:
        sub = create_subscription_db(
            device_id=payload.device_id.strip(),
            district_id=payload.district_id,
            latitude=payload.latitude,
            longitude=payload.longitude,
            radius_km=payload.radius_km,
        )
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Gagal menyimpan langganan ke database PostgreSQL.",
        ) from error

    if not sub:
        raise HTTPException(status_code=500, detail="Gagal menyimpan langganan.")

    created_at = sub["created_at"]
    if hasattr(created_at, "isoformat"):
        created_at = created_at.isoformat()

    return {
        "id": sub["id"],
        "device_id": sub["device_id"],
        "district_id": sub["district_id"],
        "latitude": sub["latitude"],
        "longitude": sub["longitude"],
        "radius_km": sub["radius_km"],
        "created_at": created_at,
        "is_active": sub["is_active"],
        "data_mode": "database",
    }


@app.get("/v1/subscriptions")
def list_subscriptions(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    device_id: Optional[str] = Query(default=None, description="Filter berdasarkan ID perangkat"),
):
    try:
        items = get_subscriptions_db(limit=limit, offset=offset, device_id=device_id)
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Gagal mengambil data langganan dari PostgreSQL.",
        ) from error

    for item in items:
        created_at = item.get("created_at")
        if hasattr(created_at, "isoformat"):
            item["created_at"] = created_at.isoformat()

    return {
        "count": len(items),
        "items": items,
        "data_mode": "database",
    }


@app.delete("/v1/subscriptions/{subscription_id}")
def delete_subscription(subscription_id: int):
    try:
        deleted = delete_subscription_db(subscription_id)
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Gagal menghapus langganan dari PostgreSQL.",
        ) from error

    if not deleted:
        raise HTTPException(status_code=404, detail="ID langganan tidak ditemukan")

    created_at = deleted.get("created_at")
    if hasattr(created_at, "isoformat"):
        deleted["created_at"] = created_at.isoformat()

    return {
        "message": "Langganan berhasil dihapus",
        "item": deleted,
        "data_mode": "database",
    }


@app.get("/v1/kecamatan/{gid_3}/history")
def get_kecamatan_history(gid_3: str):
    months = []
    current = datetime.now(timezone.utc)
    for i in range(11, -1, -1):
        date = current.replace(day=1) - timedelta(days=i * 28)
        months.append({
            "month": date.strftime("%Y-%m"),
            "hotspots": (i * 3 + 2) % 17,
            "data_mode": "dummy",
        })
    return {
        "gid_3": gid_3,
        "history_months": months,
        "warning": "Riwayat bulanan ini data dummy untuk pengujian tampilan.",
    }


class KillSwitchPayload(BaseModel):
    enabled: bool = Field(description="True untuk mengaktifkan notifikasi publik, False untuk mematikan darurat")
    reason: Optional[str] = Field(default=None, description="Alasan pengubahan status sakelar darurat")


@app.post("/v1/admin/notifications/kill-switch")
def update_notification_kill_switch(
    payload: KillSwitchPayload,
    _auth: bool = Depends(verify_admin_key),
):
    try:
        res = set_kill_switch_db(enabled=payload.enabled, reason=payload.reason)
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Gagal memperbarui status kill-switch di PostgreSQL.",
        ) from error

    return {
        "status": "ok",
        "notifications_enabled": res["notifications_enabled"],
        "last_updated": res["last_updated"],
        "reason": res["reason"],
        "data_mode": "database",
    }


@app.get("/v1/admin/notifications/kill-switch")
def get_notification_kill_switch(_auth: bool = Depends(verify_admin_key)):
    try:
        res = get_kill_switch_db()
    except Exception as error:
        raise HTTPException(
            status_code=503,
            detail="Gagal membaca status kill-switch dari PostgreSQL.",
        ) from error

    return {
        "status": "ok",
        "notifications_enabled": res["notifications_enabled"],
        "last_updated": res["last_updated"],
        "reason": res["reason"],
        "data_mode": "database",
    }


# ==========================================
# MOUNT FRONTEND STATIC FILES
# ==========================================
frontend_candidates = [
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend"),
    os.path.join(os.getcwd(), "frontend"),
    os.path.abspath("frontend"),
]
frontend_path = None
for candidate in frontend_candidates:
    if os.path.exists(candidate) and os.path.isdir(candidate):
        frontend_path = candidate
        break

if frontend_path:
    # Mount sub-direktori frontend untuk direct URL /frontend/*
    app.mount("/frontend", StaticFiles(directory=frontend_path, html=True), name="frontend_sub")
    # Mount root untuk direct URL / (index.html, css/, js/, img/)
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend_root")

