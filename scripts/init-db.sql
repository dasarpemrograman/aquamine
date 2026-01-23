-- AquaMine AI Database Initialization
-- TimescaleDB extension for time-series optimization

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Sensors table
CREATE TABLE IF NOT EXISTS sensors (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    latitude FLOAT,
    longitude FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Readings table (will be converted to hypertable)
CREATE TABLE IF NOT EXISTS readings (
    id SERIAL,
    sensor_id INTEGER REFERENCES sensors(id),
    timestamp TIMESTAMPTZ NOT NULL,
    ph FLOAT,
    turbidity FLOAT,
    temperature FLOAT,
    battery_voltage FLOAT,
    signal_strength INTEGER,
    PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('readings', 'timestamp', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);

-- Enable compression
ALTER TABLE readings SET (
    timescaledb.compress,
    timescaledb.compress_orderby = 'timestamp DESC',
    timescaledb.compress_segmentby = 'sensor_id'
);

SELECT add_compression_policy('readings', INTERVAL '3 days', if_not_exists => TRUE);

-- Predictions table
CREATE TABLE IF NOT EXISTS predictions (
    id SERIAL PRIMARY KEY,
    sensor_id INTEGER REFERENCES sensors(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    forecast_start TIMESTAMPTZ NOT NULL,
    forecast_end TIMESTAMPTZ NOT NULL,
    parameter VARCHAR(20) NOT NULL,
    forecast_values JSONB NOT NULL,
    model_version VARCHAR(50)
);

-- Anomalies table
CREATE TABLE IF NOT EXISTS anomalies (
    id SERIAL PRIMARY KEY,
    sensor_id INTEGER REFERENCES sensors(id),
    timestamp TIMESTAMPTZ NOT NULL,
    parameter VARCHAR(20) NOT NULL,
    value FLOAT NOT NULL,
    anomaly_score FLOAT,
    detection_method VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    sensor_id INTEGER REFERENCES sensors(id),
    severity VARCHAR(20) NOT NULL,
    previous_state VARCHAR(20),
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by VARCHAR(100)
);

-- Notification recipients table
CREATE TABLE IF NOT EXISTS notification_recipients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    notify_warning BOOLEAN DEFAULT TRUE,
    notify_critical BOOLEAN DEFAULT TRUE
);

-- Alert state tracking
CREATE TABLE IF NOT EXISTS sensor_alert_state (
    sensor_id INTEGER PRIMARY KEY REFERENCES sensors(id),
    current_state VARCHAR(20) DEFAULT 'normal',
    last_alert_at TIMESTAMPTZ,
    last_notification_at TIMESTAMPTZ
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_readings_sensor_timestamp ON readings (sensor_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_sensor_created ON alerts (sensor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_sensor_timestamp ON anomalies (sensor_id, timestamp DESC);
