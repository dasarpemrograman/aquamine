# Simulator Scripts

Use the ESP32 simulator to generate realistic water quality readings for the dashboard.

## Prerequisites

- Start the backend stack (`docker compose up -d`) so the API is reachable at `http://localhost:8000`.
- Install dependencies: `pip install httpx` (if running locally outside the container).

## Usage

By default, the simulator sends data to the API ingest endpoint (`/api/v1/sensors/ingest`).

### Backfill

Backfill 7 days of hourly data:

```bash
python scripts/esp32_simulator.py --backfill --days=7
```

### Realtime Streaming

Stream data every 5 minutes:

```bash
python scripts/esp32_simulator.py --realtime --interval=300
```

### Options

**Force a scenario (auto, normal, warning, critical):**

```bash
python scripts/esp32_simulator.py --realtime --scenario warning
```

**Stop after N readings:**

```bash
python scripts/esp32_simulator.py --realtime --count=5
```

**Custom API URL:**

Override the default `http://localhost:8000`:

```bash
python scripts/esp32_simulator.py --realtime --api-base http://your-vps-ip:8000
```

**Direct Database Access (Legacy/Debug):**

If you need to bypass the API and write directly to the database (requires `DATABASE_URL` set):

```bash
python scripts/esp32_simulator.py --realtime --db-direct
```
