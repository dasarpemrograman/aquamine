# Simulator Scripts

Use the ESP32 simulator to generate realistic water quality readings for the dashboard.

Prerequisites:
- Start the backend stack so the database is reachable.
- Export `DATABASE_URL` if you are not using the default local connection string.

Backfill 7 days of hourly data:

```bash
python scripts/esp32_simulator.py --backfill --days=7
```

Stream data every 5 minutes:

```bash
python scripts/esp32_simulator.py --realtime --interval=300
```

Force a scenario:

```bash
python scripts/esp32_simulator.py --realtime --scenario warning
```

Stop after N readings (useful for quick tests):

```bash
python scripts/esp32_simulator.py --realtime --count=5
```
