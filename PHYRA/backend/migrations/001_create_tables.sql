-- Migrasi 001: Pembuatan tabel subscriptions, system_settings, dan districts
-- Aman dijalankan berulang kali (Idempotent)

-- 1. Tabel Subscriptions untuk langganan notifikasi warga/perangkat
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

-- 2. Tabel System Settings untuk persistensi sakelar darurat (kill-switch) dan konfigurasi sistem
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value_bool BOOLEAN,
    value_text TEXT,
    reason TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nilai awal sakelar darurat notifikasi (default: aktif / TRUE)
INSERT INTO system_settings (key, value_bool, reason, updated_at)
VALUES ('notifications_enabled', TRUE, 'Pengaturan default inisialisasi sistem', NOW())
ON CONFLICT (key) DO NOTHING;

-- 3. Tabel Districts untuk batas wilayah administrasi kecamatan berbasis PostGIS SRID 4326
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
