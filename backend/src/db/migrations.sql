-- Aktifkan PostGIS untuk kalkulasi spasial rute navigasi
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================
-- PLATFORM ENTITIES: AGENT, ASSET, WIDGET
-- ============================================================

-- 1. Tabel Core Agents (Konektor Protokol Hardware: TCP USR, MQTT, Serial)
CREATE TABLE IF NOT EXISTS core_agents (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    protocol VARCHAR(50) NOT NULL DEFAULT 'TCP_CANET200',
    config JSONB NOT NULL DEFAULT '{"port": 20005, "host": "0.0.0.0"}',
    status VARCHAR(20) DEFAULT 'OFFLINE',
    last_seen TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel Core Assets (Representasi Fisik: Kapal / Objek Telemetri)
CREATE TABLE IF NOT EXISTS core_assets (
    id VARCHAR(64) PRIMARY KEY,
    agent_id VARCHAR(64) REFERENCES core_agents(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) DEFAULT 'VESSEL',
    metadata JSONB DEFAULT '{"mmsi": "", "callsign": "", "length": 0}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabel Core Asset Attributes (Mapping PGN / Telemetri ke Variabel Asset)
CREATE TABLE IF NOT EXISTS core_asset_attributes (
    id BIGSERIAL PRIMARY KEY,
    asset_id VARCHAR(64) REFERENCES core_assets(id) ON DELETE CASCADE,
    namespace VARCHAR(50) NOT NULL,
    key_name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100),
    unit VARCHAR(20),
    pointing_source VARCHAR(50),
    UNIQUE (asset_id, namespace, key_name)
);

-- 4. Tabel Core Widgets (Dashboard Modular Widgets)
CREATE TABLE IF NOT EXISTS core_widgets (
    id VARCHAR(64) PRIMARY KEY,
    dashboard_id VARCHAR(64) DEFAULT 'main',
    title VARCHAR(100) NOT NULL,
    widget_type VARCHAR(50) NOT NULL, -- 'MAP', 'COMPASS_TAPE', 'WIND_ROSE', 'SONAR', 'AIS_TARGETS', 'DIGITAL_HUD'
    asset_id VARCHAR(64) REFERENCES core_assets(id) ON DELETE CASCADE,
    config JSONB DEFAULT '{}',
    position JSONB DEFAULT '{"x": 0, "y": 0, "w": 1, "h": 1}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABEL HISTORI TELEMETRI (TERHUBUNG KE ASSET)
-- ============================================================

-- 5. Tabel Telemetri GPS (Posisi, Kecepatan, Geometri Spasial)
CREATE TABLE IF NOT EXISTS tbl_telemetry_gps (
    id BIGSERIAL PRIMARY KEY,
    asset_id VARCHAR(64) DEFAULT 'vessel_primary',
    timestamp_utc TIMESTAMPTZ NOT NULL,
    timestamp_local TIMESTAMP NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    geom GEOMETRY(Point, 4326),
    altitude_m REAL,
    sog_knots REAL,
    sog_kmh REAL,
    cog_deg REAL,
    satellites SMALLINT,
    hdop REAL,
    pdop REAL,
    gnss_fix VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_gps_time ON tbl_telemetry_gps (timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_gps_asset ON tbl_telemetry_gps (asset_id);
CREATE INDEX IF NOT EXISTS idx_gps_geom ON tbl_telemetry_gps USING GIST (geom);

-- 6. Tabel Orientasi & Kompas Kapal (Motion & Attitude)
CREATE TABLE IF NOT EXISTS tbl_telemetry_motion (
    id BIGSERIAL PRIMARY KEY,
    asset_id VARCHAR(64) DEFAULT 'vessel_primary',
    timestamp_utc TIMESTAMPTZ NOT NULL,
    timestamp_local TIMESTAMP NOT NULL,
    heading_deg REAL,
    heading_ref VARCHAR(10),
    rot_deg_s REAL,
    pitch_deg REAL,
    roll_deg REAL
);

CREATE INDEX IF NOT EXISTS idx_motion_time ON tbl_telemetry_motion (timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_motion_asset ON tbl_telemetry_motion (asset_id);

-- 7. Tabel Sensor Lingkungan, Angin & Kedalaman (Environment)
CREATE TABLE IF NOT EXISTS tbl_telemetry_environment (
    id BIGSERIAL PRIMARY KEY,
    asset_id VARCHAR(64) DEFAULT 'vessel_primary',
    timestamp_utc TIMESTAMPTZ NOT NULL,
    timestamp_local TIMESTAMP NOT NULL,
    wind_speed_kn REAL,
    wind_angle_deg REAL,
    wind_ref VARCHAR(20),
    depth_m REAL,
    water_temp_c REAL,
    air_temp_c REAL,
    baro_pressure_hpa REAL
);

CREATE INDEX IF NOT EXISTS idx_env_time ON tbl_telemetry_environment (timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_env_asset ON tbl_telemetry_environment (asset_id);

-- 8. Tabel Target AIS (Real-time AIS Vessels)
CREATE TABLE IF NOT EXISTS tbl_ais_targets (
    mmsi BIGINT PRIMARY KEY,
    vessel_name VARCHAR(100),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    geom GEOMETRY(Point, 4326),
    sog_knots REAL,
    cog_deg REAL,
    heading_deg REAL,
    last_updated TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ais_geom ON tbl_ais_targets USING GIST (geom);

-- ============================================================
-- SEED DATA DEFAULT (AGENT UTAMA & ASSET UTAMA)
-- ============================================================
INSERT INTO core_agents (id, name, protocol, config, status)
VALUES ('agent_7a3d9b1e', 'Agent TCP USR-CANET200 (Default)', 'TCP_CANET200', '{"port": 20005, "host": "0.0.0.0"}', 'ONLINE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO core_assets (id, agent_id, name, type, metadata)
VALUES ('vessel_c2e2cffb', 'agent_7a3d9b1e', 'KM Geo Tekno', 'VESSEL', '{"mmsi": "525015359", "type": "Cargo/Survey", "registration_code": "KM+Geo+Tekno"}')
ON CONFLICT (id) DO NOTHING;

-- Seed default widgets
INSERT INTO core_widgets (id, title, widget_type, asset_id, is_active)
VALUES 
  ('w_compass_01', 'Compass & Attitude', 'COMPASS_TAPE', 'vessel_c2e2cffb', TRUE),
  ('w_wind_01', 'Apparent Wind Rose', 'WIND_ROSE', 'vessel_c2e2cffb', TRUE),
  ('w_sonar_01', 'Sonar Sounder', 'SONAR', 'vessel_c2e2cffb', TRUE),
  ('w_ais_01', 'AIS Radar Targets', 'AIS_TARGETS', 'vessel_c2e2cffb', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Seed default attributes untuk kapal utama (hanya sinyal yang aktif pada payload sensor kapal)
INSERT INTO core_asset_attributes (asset_id, namespace, key_name, display_name, unit, pointing_source)
VALUES 
  ('vessel_c2e2cffb', 'navigation', 'position', 'GNSS Coordinates', 'Lat/Lng', 'PGN 129025 / 129029'),
  ('vessel_c2e2cffb', 'navigation', 'sog', 'Speed Over Ground', 'kn', 'PGN 129026'),
  ('vessel_c2e2cffb', 'navigation', 'cog', 'Course Over Ground', 'deg', 'PGN 129026'),
  ('vessel_c2e2cffb', 'navigation', 'hdop', 'Horizontal Dilution of Precision', 'HDOP', 'PGN 129029 GNSS'),
  ('vessel_c2e2cffb', 'motion', 'heading', 'Vessel Heading (Compass)', 'deg', 'PGN 127250'),
  ('vessel_c2e2cffb', 'motion', 'pitch', 'Vessel Pitch Angle', 'deg', 'PGN 127257 Attitude'),
  ('vessel_c2e2cffb', 'motion', 'roll', 'Vessel Roll Angle', 'deg', 'PGN 127257 Attitude'),
  ('vessel_c2e2cffb', 'environment', 'depth', 'Water Depth Below Keel', 'm', 'PGN 128267'),
  ('vessel_c2e2cffb', 'environment', 'wind_speed', 'Apparent Wind Speed', 'kn', 'PGN 130306'),
  ('vessel_c2e2cffb', 'environment', 'wind_angle', 'Apparent Wind Angle', 'deg', 'PGN 130306'),
  ('vessel_c2e2cffb', 'environment', 'water_temp', 'Sea Water Temperature', '°C', 'PGN 130310')
ON CONFLICT (asset_id, namespace, key_name) DO NOTHING;

-- ============================================================
-- AUTHENTICATION & FINE-GRAINED ACCESS CONTROL (RBAC & PBAC)
-- ============================================================

-- 9. Tabel Akun Pengguna
CREATE TABLE IF NOT EXISTS core_users (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(100) UNIQUE,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_superadmin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Tabel Hak Akses Resource Kapal (Per-Kapal)
CREATE TABLE IF NOT EXISTS user_vessel_assignments (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES core_users(id) ON DELETE CASCADE,
    vessel_id VARCHAR(64) NOT NULL,
    can_write BOOLEAN DEFAULT FALSE,
    UNIQUE (user_id, vessel_id)
);

-- 11. Tabel Hak Akses Granular Per-Halaman & Per-Fitur
CREATE TABLE IF NOT EXISTS user_permissions (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES core_users(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL,    -- 'PAGE' | 'FEATURE'
    resource_key VARCHAR(100) NOT NULL,    -- 'overview', 'marine_traffic', 'vessels', 'vessel.decoder', 'vessel.agent', etc.
    can_read BOOLEAN DEFAULT TRUE,
    can_write BOOLEAN DEFAULT FALSE,
    UNIQUE (user_id, resource_key)
);

-- 12. Tabel Refresh Token Session
CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES core_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    user_agent TEXT,
    ip_address VARCHAR(50),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Tabel Role Platform (RBAC)
CREATE TABLE IF NOT EXISTS core_roles (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Tabel Izin Akses Per-Role (Role Permissions)
CREATE TABLE IF NOT EXISTS core_role_permissions (
    id BIGSERIAL PRIMARY KEY,
    role_id VARCHAR(64) REFERENCES core_roles(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL, -- 'PAGE' | 'FEATURE'
    resource_key VARCHAR(100) NOT NULL,
    can_read BOOLEAN DEFAULT TRUE,
    can_write BOOLEAN DEFAULT FALSE,
    UNIQUE (role_id, resource_key)
);

-- Tambah foreign key role_id ke core_users
ALTER TABLE core_users ADD COLUMN IF NOT EXISTS role_id VARCHAR(64) REFERENCES core_roles(id) ON DELETE SET NULL;

-- Seed default roles
INSERT INTO core_roles (id, name, description, is_system)
VALUES 
    ('role_superadmin', 'Superadmin', 'Full administrative CRUD privileges across all modules and bypasses all restrictions.', TRUE),
    ('role_fleet_operator', 'Fleet Operator', 'Operational access to monitor navigation, radar traffic, and telemetry logs with write capability.', TRUE),
    ('role_viewer', 'Viewer / Analyst', 'Read-only access to view fleet status, charts, and marine traffic.', TRUE)
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- Seed default role permissions for Fleet Operator
INSERT INTO core_role_permissions (role_id, resource_type, resource_key, can_read, can_write)
VALUES 
    ('role_fleet_operator', 'PAGE', 'overview', TRUE, FALSE),
    ('role_fleet_operator', 'PAGE', 'marine_traffic', TRUE, FALSE),
    ('role_fleet_operator', 'PAGE', 'vessels', TRUE, TRUE),
    ('role_fleet_operator', 'PAGE', 'monitoring', TRUE, TRUE),
    ('role_fleet_operator', 'PAGE', 'logs', TRUE, FALSE),
    ('role_fleet_operator', 'FEATURE', 'vessel.decoder', TRUE, FALSE),
    ('role_fleet_operator', 'FEATURE', 'vessel.agent', TRUE, TRUE),
    ('role_fleet_operator', 'FEATURE', 'telemetry.export', TRUE, FALSE),
    ('role_fleet_operator', 'SECTION', 'section-nav', TRUE, TRUE),
    ('role_fleet_operator', 'SECTION', 'section-engine', TRUE, TRUE),
    ('role_fleet_operator', 'SECTION', '*', TRUE, TRUE)
ON CONFLICT (role_id, resource_key) DO NOTHING;

-- Seed default role permissions for Viewer
INSERT INTO core_role_permissions (role_id, resource_type, resource_key, can_read, can_write)
VALUES 
    ('role_viewer', 'PAGE', 'overview', TRUE, FALSE),
    ('role_viewer', 'PAGE', 'marine_traffic', TRUE, FALSE),
    ('role_viewer', 'PAGE', 'vessels', TRUE, FALSE),
    ('role_viewer', 'PAGE', 'monitoring', TRUE, FALSE),
    ('role_viewer', 'PAGE', 'logs', TRUE, FALSE),
    ('role_viewer', 'FEATURE', 'vessel.decoder', FALSE, FALSE),
    ('role_viewer', 'FEATURE', 'vessel.agent', FALSE, FALSE),
    ('role_viewer', 'FEATURE', 'telemetry.export', TRUE, FALSE),
    ('role_viewer', 'SECTION', 'section-nav', TRUE, FALSE),
    ('role_viewer', 'SECTION', 'section-engine', TRUE, FALSE),
    ('role_viewer', 'SECTION', '*', TRUE, FALSE)
ON CONFLICT (role_id, resource_key) DO NOTHING;

-- Seed default Superadmin (Password: AdminNav2026!)
INSERT INTO core_users (id, name, email, password_hash, is_superadmin, is_active, role_id)
VALUES (
    'usr_superadmin_01',
    'Superadmin',
    'admin@geotekno.id',
    '$2b$10$aYsVl8e9hNjrZlXzvDn41uFjio3YmlxBTh50ENJ1CFpyQ5MCnvBLe',
    TRUE,
    TRUE,
    'role_superadmin'
)
ON CONFLICT (email) DO UPDATE SET 
    name = EXCLUDED.name,
    password_hash = EXCLUDED.password_hash,
    is_superadmin = TRUE,
    is_active = TRUE,
    role_id = 'role_superadmin';

-- 15. Tabel Monitoring Dashboard Sections (Dynamic Sections & Layouts)
CREATE TABLE IF NOT EXISTS core_monitoring_sections (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    widgets JSONB DEFAULT '[]',
    layouts JSONB DEFAULT '{}',
    order_index INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO core_monitoring_sections (id, name, description, order_index)
VALUES 
    ('section-nav', 'Navigation & Maneuvering', 'Speed, heading, depth & navigation instruments', 1),
    ('section-engine', 'Engine & Machinery', 'Machinery status, propulsion RPM & fuel diagnostics', 2),
    ('section-bridge', 'Bridge Command Center', 'Consolidated command center navigation & radar console', 3)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    order_index = EXCLUDED.order_index;


