# AquaMine AI

Early warning system for Acid Mine Drainage (AMD) using IoT telemetry, time-series forecasting, anomaly detection, computer vision, and a realtime dashboard.

## Stack (Final)

Backend:
- Python 3.11, FastAPI, Pydantic v2
- SQLAlchemy 2.0
- PostgreSQL + PostGIS (TimescaleDB optional)
- Redis (cache + pub/sub)

ML/AI:
- Forecasting: TimeGPT (primary) + XGBoost (fallback)
- Anomaly: Isolation Forest / robust z-score
- CV: OpenCV (YOLOv8 optional)

Frontend:
- Next.js (React + TypeScript)
- Tailwind CSS
- Recharts (charts), Leaflet (maps)

Infra:
- Docker + Docker Compose
- Nginx reverse proxy
- SSL via LetsEncrypt

Tooling:
- Backend: ruff
- Frontend: eslint + prettier

## P1 Verification Status (Jan 2026)

✅ **Completed:**
- Docker setup fixed (API hot-reload enabled)
- TimescaleDB integration (Hypertable created successfully)
- IoT Ingestion pipeline (MQTT → DB → WebSocket)
- Anomaly Detection (Threshold-based triggers for pH/Turbidity)
- Alert System (State machine + critical alerts)
- Dashboard connectivity

⏳ **Pending / Next Steps:**
- P2: Computer Vision integration (YOLOv8)
- P3: Advanced Forecasting (Integration with real TimeGPT key)
- Production deployment hardening

## Local Development

1) Copy env file:

```bash
cp .env.example .env
```

2) Start services (Hot Reload Enabled):

```bash
# Volume mount enables instant code changes without rebuilding
docker compose up -d
```

3) Verify:
- API: `http://localhost:8000/health`
- Dashboard: `http://localhost:3000`

## VPS Deployment (Ubuntu 22.04)

1) Install Docker + Compose on the VPS.
2) Copy project and create `.env` based on `.env.example`.
3) Start production stack:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### SSL (LetsEncrypt)

Recommended approach (host-based certbot + Nginx container):

1) Point domain DNS to the VPS.
2) Install certbot on the host:

```bash
sudo apt-get update
sudo apt-get install -y certbot
```

3) Stop nginx container, issue certs, then restart:

```bash
docker compose -f docker-compose.prod.yml stop nginx
sudo certbot certonly --standalone -d your-domain.com
docker compose -f docker-compose.prod.yml start nginx
```

4) Mount `/etc/letsencrypt` into nginx and add an HTTPS server block in `deploy/nginx/default.conf`.

## Notes

- TimescaleDB is optional. Start with Postgres + PostGIS, add TimescaleDB if time-series queries become heavy.
- TimeGPT is primary for fast forecasting; keep XGBoost as fallback if the API is unavailable.
