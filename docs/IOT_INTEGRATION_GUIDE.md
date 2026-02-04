# IoT Integration Guide

This guide provides technical instructions for integrating hardware sensors (e.g., ESP32, Arduino, Raspberry Pi) with the AquaMine AI platform.

## Overview

AquaMine AI ingestion pipeline is designed to receive environmental telemetry data from field devices. We support two primary integration methods:

1.  **MQTT (Recommended)**: For real-time, low-latency, and persistent connections.
2.  **HTTP REST API**: For simpler, stateless integrations or devices that cannot maintain a persistent connection.

Both methods use the same **JSON Data Schema** and support **Sensor Auto-Registration**.

For more detailed technical specifications of the data interface, refer to the [Telemetry Data Contract](./DATA_CONTRACT.md).

---

## Data Schema

All telemetry data must follow the `SensorDataIngest` schema.

### Fields

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `sensor_id` | `string` | **Yes** | Unique identifier for the hardware sensor (e.g., `SN-001`). |
| `timestamp` | `string` | **Yes** | UTC timestamp in ISO 8601 format (e.g., `2026-02-04T10:00:00Z`). |
| `readings` | `object` | **Yes** | Map of environmental readings. Keys: `ph`, `turbidity`, `temperature`. |
| `location` | `object` | No | Geolocation with `lat` and `lon` (floats). |
| `metadata` | `object` | No | Diagnostic data: `battery_voltage` (float), `signal_strength` (int). |

### Example Payloads

**Minimal Payload:**
```json
{
  "sensor_id": "SN-001",
  "timestamp": "2026-02-04T10:00:00Z",
  "readings": {
    "ph": 7.2
  }
}
```

**Full Payload:**
```json
{
  "sensor_id": "SN-001",
  "timestamp": "2026-02-04T10:00:00Z",
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

> [!NOTE]
> Timestamps MUST be in UTC. Use `null` if a specific reading is unavailable.

---

## 1. MQTT Integration (Recommended)

MQTT is preferred for industrial deployments as it reduces overhead and enables real-time updates.

### Configuration
The MQTT bridge is configured via environment variables:
- `MQTT_BROKER`: The broker address (default: `broker.hivemq.com`)
- `MQTT_PORT`: The broker port (default: `1883`)
- `MQTT_TOPIC_PREFIX`: The prefix for all sensor topics (default: `aquamine/sensors`)
- `MQTT_USERNAME` / `MQTT_PASSWORD`: Credentials for the broker (if required)

### Topic Structure
The platform subscribes to `MQTT_TOPIC_PREFIX/#`. It is recommended to publish to:
`{prefix}/{sensor_id}` (e.g., `aquamine/sensors/SN-001`)

### ESP32/Arduino Example (PubSubClient)
Requires `PubSubClient` and `ArduinoJson` libraries.

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* mqtt_server = "broker.hivemq.com";
const char* topic = "aquamine/sensors/SN-001";

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  WiFi.begin(ssid, password);
  client.setServer(mqtt_server, 1883);
}

void loop() {
  if (!client.connected()) {
    client.connect("ESP32-SN-001");
  }
  client.loop();

  // Create JSON payload
  StaticJsonDocument<256> doc;
  doc["sensor_id"] = "SN-001";
  doc["timestamp"] = "2026-02-04T10:00:00Z"; // In production, use NTP to get real time
  
  JsonObject readings = doc.createNestedObject("readings");
  readings["ph"] = 7.2;
  readings["temperature"] = 25.5;

  char buffer[256];
  serializeJson(doc, buffer);
  
  client.publish(topic, buffer);
  delay(60000); // Send every minute
}
```

---

## 2. HTTP REST API Integration

Ideal for devices with limited memory or those behind strict firewalls.

### Details
- **Endpoint**: `POST /api/v1/sensors/ingest`
- **Content-Type**: `application/json`
- **Authentication**: Required via `X-Ingest-Key` header.

### Authentication
The `X-Ingest-Key` must match the `INGEST_API_KEY` defined in the platform's `.env` file.

### Code Examples

**cURL:**
```bash
curl -X POST http://your-api-url/api/v1/sensors/ingest \
  -H "Content-Type: application/json" \
  -H "X-Ingest-Key: your_secret_key" \
  -d '{
    "sensor_id": "SN-001",
    "timestamp": "2026-02-04T10:00:00Z",
    "readings": {"ph": 7.2}
  }'
```

**Python:**
```python
import requests
import datetime

url = "http://your-api-url/api/v1/sensors/ingest"
headers = {
    "X-Ingest-Key": "your_secret_key",
    "Content-Type": "application/json"
}
payload = {
    "sensor_id": "SN-001",
    "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "readings": {"ph": 7.2, "temperature": 24.5}
}

response = requests.post(url, json=payload, headers=headers)
print(response.status_code, response.json())
```

**ESP32 (HTTPClient):**
```cpp
#include <HTTPClient.h>
#include <ArduinoJson.h>

void sendData() {
  HTTPClient http;
  http.begin("http://your-api-url/api/v1/sensors/ingest");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Ingest-Key", "your_secret_key");

  StaticJsonDocument<200> doc;
  doc["sensor_id"] = "SN-001";
  doc["timestamp"] = "2026-02-04T10:00:00Z";
  JsonObject readings = doc.createNestedObject("readings");
  readings["ph"] = 7.2;

  String payload;
  serializeJson(doc, payload);
  int httpResponseCode = http.POST(payload);
  http.end();
}
```

---

## Sensor Auto-Registration

The platform supports **automatic registration**. When a message from a new `sensor_id` is received:
1.  The platform checks if the ID exists in the database.
2.  If not found, it creates a new sensor record automatically.
3.  **Default Naming**: The sensor will be named `Sensor {sensor_id}`.
4.  **Location**: If the payload includes `location`, the sensor's coordinates will be updated.

---

## Troubleshooting

### Common Issues
- **401 Unauthorized**: Missing or incorrect `X-Ingest-Key`.
- **422 Unprocessable Entity**: Payload does not match the schema (check field names and data types).
- **Time Sync Errors**: The platform rejects or ignores data with incorrect timestamps. Ensure your IoT devices use **NTP** to synchronize with UTC time.
- **MQTT Connection Refused**: Check if `MQTT_BROKER` and `MQTT_PORT` are correct and accessible from the device's network.

### Verification
- **Logs**: Check the API container logs: `docker compose logs -f api`
- **Dashboard**: New sensors should appear on the Map and Sensor Status list immediately after the first successful data ingestion.
- **Health Check**: Verify the API is up at `http://your-url/health`.

---

## Quick Start Checklist
1. [ ] Identify your `sensor_id` (e.g., MAC address or Serial Number).
2. [ ] Obtain the `INGEST_API_KEY` from your administrator.
3. [ ] Synchronize your device clock via NTP.
4. [ ] Format your data into the JSON schema.
5. [ ] Send a test packet via cURL or MQTT.
6. [ ] Verify the sensor appears on the AquaMine Dashboard.
