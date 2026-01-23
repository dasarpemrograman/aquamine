# Draft: ML/AI #1 - Forecasting + Anomaly Detection

## Context
- Task from TASK_BREAKDOWN_TIMELINE.md
- Competition: ISMC XV, Final submission Feb 7, 2026
- Role: ML/AI #1 person's responsibilities

## Research Findings

### TimeGPT (Nixtla)
- Zero-shot forecasting - no training required
- Built-in `detect_anomalies()` method
- API-based, needs NIXTLA_API_KEY
- Can handle multiple time series with `unique_id`
- Confidence levels configurable (level=80, 90, 99)

### XGBoost Fallback
- Feature engineering needed: lag features (t-1, t-7), rolling mean/std
- Good with missing data handling
- Trained model can be serialized (joblib)

### Anomaly Detection Approach
- **Threshold-based** (rule-based):
  - pH < 5.5 → warning
  - pH < 4.5 → critical  
  - Turbidity > 50 NTU → warning
- **Isolation Forest** (ML-based):
  - Anomaly scoring (0-10)
  - Multivariate detection
  - scikit-learn implementation

### Existing AI Stack
- Python 3.11, FastAPI, Pydantic v2
- ultralytics, PIL, Redis, SQLAlchemy already installed
- pytest with conftest.py pattern for testing
- Models stored in `ai/models/`

## Requirements (confirmed)

### From docs
- [x] Forecast endpoint: `/api/v1/forecast`
- [x] Anomaly endpoint: `/api/v1/anomaly`
- [x] 7-day forecast horizon (not 14)
- [x] 85-90% accuracy target (realistic)
- [x] TimeGPT primary, XGBoost fallback

### From interview (2026-01-23)
- [x] Data source: **Synthetic data generator** (AMD progression scenarios)
- [x] Frontend scope: **Include basic frontend** (chart + alert UI)
- [x] NIXTLA_API_KEY: **Sudah punya** ✓
- [x] Test strategy: **TDD (Red-Green-Refactor)**
- [x] Forecast parameters: **All 4** (pH, turbidity, conductivity, temperature)
- [x] XGBoost fallback: **Skip for now** - focus on TimeGPT
- [x] Alert delivery: **UI + External notifications** (WhatsApp/Email)
- [x] Data generator: **Extend existing** data_generator/simulator.py

### Additional decisions (2026-01-23)
- [x] Notification providers: **Fonnte** (WhatsApp) + **Resend** (Email)
- [x] Credentials: **Sudah punya** (Resend via draftanakitb.tech domain)
- [x] Data generator: **Buat baru** di ai/ folder

## Technical Decisions

### TimeGPT Integration
- Use Nixtla Python client
- `detect_anomalies()` for anomaly detection (built-in)
- `forecast()` for 7-day prediction
- Supports multiple sensors via `unique_id` column
- API key via env: `NIXTLA_API_KEY`

### Anomaly Detection Strategy
- **Primary**: TimeGPT `detect_anomalies()` with confidence level 90
- **Secondary**: Threshold-based rules as fallback
  - pH < 5.5 → warning
  - pH < 4.5 → critical
  - Turbidity > 50 NTU → warning
- **Severity scoring**: Combine both into 0-10 scale

### Notification Integration
- **Fonnte (WhatsApp)**: POST to `https://api.fonnte.com/send` with Authorization token
- **Resend (Email)**: `resend.Emails.send()` with API key, from draftanakitb.tech

### Synthetic Data Generator
- Create realistic AMD progression scenarios:
  - Normal: pH 6.5-7.2 (random walk)
  - Warning: pH gradual decline (7 → 5.5 over 3 days)
  - Critical: pH spike (7 → 4.2 in 6 hours)
- All 4 parameters with realistic correlations
- Output: Pandas DataFrame compatible with TimeGPT

### Frontend (Basic)
- Recharts for forecast chart
- Alert display component
- WebSocket for real-time updates (if time permits)

## Scope Boundaries

### INCLUDE
- TimeGPT forecasting integration (all 4 parameters)
- Anomaly detection (TimeGPT + threshold fallback)
- `/api/v1/forecast` endpoint
- `/api/v1/anomaly` endpoint  
- `/api/v1/alerts` endpoint (list + create + acknowledge)
- Synthetic data generator module
- Fonnte WhatsApp notification
- Resend Email notification
- Basic frontend: forecast chart + alert list
- TDD with pytest

### EXCLUDE
- XGBoost fallback model (defer)
- SHAP explainability (defer)
- WebSocket real-time streaming (optional if time)
- GenAI chatbot (separate task)
- Database persistence for alerts (use in-memory for demo)
- Complex frontend features (leave for FE person)
