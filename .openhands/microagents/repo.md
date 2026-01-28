# AquaMine AI - Project Overview

## Description
AquaMine AI is an early warning system for Acid Mine Drainage (AMD) that combines IoT telemetry, time-series forecasting, anomaly detection, computer vision, and a real-time dashboard. The system monitors water quality parameters (pH, turbidity, etc.) to detect potential AMD events and provide alerts.

## File Structure
- `/ai/` - Backend API and ML services (FastAPI, Python 3.11)
  - `main.py` - Main FastAPI application
  - `alerts/` - Alert state machine and notification system
  - `anomaly/` - Anomaly detection algorithms
  - `forecasting/` - Time-series forecasting (TimeGPT + XGBoost)
  - `cv/` - Computer vision for visual AMD detection (YOLOv8)
  - `iot/` - MQTT bridge for IoT sensor data ingestion
  - `db/` - Database models and connection (PostgreSQL + PostGIS)
  - `tests/` - Backend test suite
- `/dashboard/` - Frontend dashboard (Next.js + TypeScript + Tailwind CSS)
  - Real-time monitoring interface with charts and maps
- `/docs/` - Project documentation and guides
- `/deploy/` - Deployment configurations
- `/scripts/` - Utility scripts
- `docker-compose.yml` - Development environment
- `docker-compose.prod.yml` - Production deployment

## Development Commands

### Backend (AI Service)
```bash
cd ai
# Install dependencies (using uv/poetry)
uv pip install -e .[dev]

# Run tests
pytest

# Start development server
uvicorn ai.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend (Dashboard)
```bash
cd dashboard
# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Run tests
npm run test
```

### Full Stack with Docker
```bash
# Copy environment file
cp .env.example .env

# Start all services (development)
docker compose up -d

# Verify services
# API: http://localhost:8000/health
# Dashboard: http://localhost:3000
```

## Key Features
- **IoT Integration**: MQTT-based sensor data ingestion
- **Real-time Monitoring**: WebSocket connections for live updates
- **Anomaly Detection**: Threshold-based and ML-based detection
- **Forecasting**: TimeGPT API integration for predictive analytics
- **Computer Vision**: YOLOv8 model for visual AMD detection
- **Alert System**: State-based alert management with notifications
- **Dashboard**: Real-time visualization with charts and maps

## Technology Stack
- **Backend**: Python 3.11, FastAPI, SQLAlchemy 2.0, Pydantic v2
- **Database**: PostgreSQL + PostGIS (TimescaleDB optional)
- **ML/AI**: TimeGPT, XGBoost, Isolation Forest, YOLOv8
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Infrastructure**: Docker, Nginx, Redis, MQTT

## Getting Started
1. Clone the repository
2. Copy `.env.example` to `.env` and configure environment variables
3. Run `docker compose up -d` for development
4. Access the dashboard at `http://localhost:3000`
5. API documentation available at `http://localhost:8000/docs`

## Testing
- Backend tests: `pytest` in `/ai` directory
- Frontend tests: `npm run test` in `/dashboard` directory
- E2E tests available in `/ai/tests/test_e2e.py`