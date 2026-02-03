# Telemetry Data Contract

This document defines the interface for telemetry data ingestion into the AquaMine AI platform. 

## Overview

The telemetry ingestion endpoint receives environmental sensor data from field devices (e.g., ESP32, industrial gateways) and stores it for analysis, forecasting, and alerting.

- **Endpoint**: `POST /api/v1/sensors/ingest`
- **Authentication**: Required via `X-Ingest-Key` header.
- **Content-Type**: `application/json`

## Schema Definition

The payload is governed by the `SensorDataIngest` Pydantic model located in `ai/schemas/sensor.py`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sensor_id` | `string` | Yes | Unique identifier for the hardware sensor. |
| `timestamp` | `ISO8601 string` | Yes | UTC timestamp of the measurement. |
| `location` | `object` | No | Geolocation of the sensor. Contains `lat` and `lon` (floats). |
| `readings` | `object` | Yes | Map of environmental readings. Keys: `ph`, `turbidity`, `temperature`. |
| `metadata` | `object` | No | Diagnostic data. Keys: `battery_voltage`, `signal_strength`. |

### Sensor Semantics
- **Timestamps**: All timestamps MUST be in UTC. Use ISO 8601 format (e.g., `2026-02-03T10:00:00Z`).
- **Readings**: Values are floating-point numbers. Use `null` if a specific sensor in a multi-sensor array fails or is missing.
- **Conductivity**: Note that `conductivity` is currently NOT supported in the ingest schema or downstream analytics.

## Authentication

All requests to the ingest endpoint must include the `X-Ingest-Key` header.

```http
X-Ingest-Key: your_service_token_here
```

### Recommended Flow
For production environments, it is recommended to use a service-token flow where each gateway or device group uses a unique token provided during provisioning. The platform currently validates this against a configured `INGEST_API_KEY`.

## Example Payloads

### Minimal Payload
```json
{
  "sensor_id": "SN-001",
  "timestamp": "2026-02-03T10:00:00Z",
  "readings": {
    "ph": 7.2
  }
}
```

### Full Payload
```json
{
  "sensor_id": "SN-001",
  "timestamp": "2026-02-03T10:00:00Z",
  "location": {
    "lat": -6.2,
    "lon": 106.8
  },
  "readings": {
    "ph": 7.2,
    "turbidity": 15.5,
    "temperature": 24.3
  },
  "metadata": {
    "battery_voltage": 3.7,
    "signal_strength": -65
  }
}
```

## Versioning

The current contract version is **v1**. Breaking changes (e.g., making optional fields required or renaming keys) will result in a path increment to `/api/v2/`.
