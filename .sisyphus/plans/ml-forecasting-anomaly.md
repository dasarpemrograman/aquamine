# ML/AI #1: Forecasting + Anomaly Detection

## Context

### Original Request
Implement ML/AI #1 features from TASK_BREAKDOWN_TIMELINE.md for AquaMine AI hackathon entry (ISMC XV). Core features: TimeGPT forecasting for water quality parameters, anomaly detection, alert notifications (WhatsApp + Email), synthetic data generator, and basic frontend visualization.

### Interview Summary
**Key Discussions**:
- Data source: Synthetic generator (new, in ai/ folder)
- Frontend: Include basic forecast chart + alert list
- TimeGPT: User has API key, primary forecasting method
- XGBoost: Skip for now, focus on TimeGPT only
- Notifications: Fonnte (WhatsApp) + Resend (Email), credentials ready
- Test strategy: TDD with pytest
- Forecast parameters: All 4 (pH, turbidity, conductivity, temperature)
- Data cadence: Per 5 minutes
- Alert dedup: On state change only (both directions: escalation AND recovery)
- API auth: None (demo mode)
- Forecast endpoint: Accept data payload directly

**Research Findings**:
- TimeGPT by Nixtla: Zero-shot forecasting + built-in `detect_anomalies()`, Python SDK
- Fonnte: POST to `https://api.fonnte.com/send` with Authorization token header
- Resend: `resend.Emails.send()` with typed params, domain: draftanakitb.tech
- Frontend: Next.js 16.1.4, React 19.2.3, no chart library yet (need Recharts)

### Metis Review
**Identified Gaps** (addressed):
- Data cadence: Fixed at 5-minute intervals
- Alert dedup: Implemented as state-change-only notifications (both escalation and recovery)
- API auth: Deferred, open access for demo
- Forecast endpoint design: Accept payload, not pull from storage

**Guardrails Applied**:
- No database persistence (in-memory for demo)
- No real-time streaming (batch on request)
- No changes to existing CV/YOLO pipeline
- Keep charting minimal; no extra UI pages
- No XGBoost or alternate methods

---

## Work Objectives

### Core Objective
Build a TimeGPT-powered forecasting and anomaly detection system for water quality monitoring with WhatsApp/Email alert notifications and basic dashboard visualization.

### Concrete Deliverables
1. `ai/forecasting/` module with TimeGPT integration
2. `ai/anomaly/` module with detection logic
3. `ai/notifications/` module with Fonnte + Resend integration
4. `ai/data_generator/` module for synthetic AMD scenarios
5. API endpoints: `/api/v1/forecast`, `/api/v1/anomaly`, `/api/v1/alerts`
6. Frontend: Forecast chart component + Alert list component
7. Tests for all modules (TDD)

### Definition of Done
- [x] `pytest ai/tests/` passes with all tests green (98 tests)
- [x] `POST /api/v1/forecast` returns 7-day forecast for all 4 parameters
- [x] `POST /api/v1/anomaly` returns anomaly detection with severity
- [x] Alerts trigger WhatsApp + Email on state change
- [x] Frontend shows forecast chart and alert list without errors
- [x] All code linted with ruff (no errors)

### Must Have
- TimeGPT API integration (forecasting + anomaly detection)
- 7-day forecast horizon with 5-minute data cadence
- Threshold-based fallback for anomaly (pH < 6.5 warning, < 4.5 critical)
- WhatsApp notification via Fonnte
- Email notification via Resend
- Synthetic data generator with 3 scenarios (normal, warning, critical)
- Basic Recharts visualization
- pytest tests with TDD approach

### Must NOT Have (Guardrails)
- XGBoost fallback model (explicitly deferred)
- SHAP explainability
- Database persistence for alerts
- Real-time WebSocket streaming
- GenAI chatbot features
- Complex alert management (mute, history filters)
- Multiple notification channels beyond WhatsApp/Email
- Changes to existing CV/YOLO pipeline
- Authentication/authorization

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES (pytest in ai/tests/)
- **User wants tests**: TDD (Red-Green-Refactor)
- **Framework**: pytest

### TDD Pattern
Each TODO follows RED-GREEN-REFACTOR:
1. **RED**: Write failing test first
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping green

### Test Commands
```bash
cd ai && uv run pytest tests/ -v
cd ai && uv run ruff check .
```

---

## Task Flow

```
1. Synthetic Data Generator
       ↓
2. TimeGPT Forecasting Module
       ↓
3. Anomaly Detection Module
       ↓
4. Alert State Machine
       ↓
5. Notification Service (Fonnte + Resend)
       ↓
6. API Endpoints (forecast, anomaly, alerts)
       ↓
7. Frontend Components (chart + alert list)
       ↓
8. Integration Testing
       ↓
9. Create PR to main
```

## Parallelization

| Group | Tasks | Reason |
|-------|-------|--------|
| A | 1 (data gen) | Foundation, no deps |
| B | 2, 3, 4, 5 | Can be developed with mock data |
| C | 6 | Depends on 2-5 |
| D | 7 | Depends on 6 (API) |
| E | 8, 9 | Final integration |

| Task | Depends On | Reason |
|------|------------|--------|
| 2-5 | 1 | Need synthetic data for testing |
| 6 | 2-5 | API exposes modules |
| 7 | 6 | Frontend calls API |
| 8 | 7 | E2E testing |
| 9 | 8 | PR after all tests pass |

---

## TODOs

### 1. Synthetic Data Generator Module

**What to do**:
- Create `ai/data_generator/` module
- Implement `SyntheticDataGenerator` class with scenarios:
  - `normal`: pH 6.5-7.2 with random walk, other params stable
  - `warning`: pH gradual decline 7→5.5 over 3 days
  - `critical`: pH spike 7→4.2 in 6 hours
- Generate all 4 parameters with realistic correlations:
  - pH ↓ correlates with conductivity ↑
  - Turbidity has independent noise pattern
  - Temperature follows diurnal cycle
- Output: pandas DataFrame with columns `[timestamp, sensor_id, ph, turbidity, conductivity, temperature]`
- 5-minute intervals, configurable duration

**Deterministic Seeding Strategy (for testability):**
```python
class SyntheticDataGenerator:
    def __init__(self, seed: int | None = None):
        """
        Args:
            seed: Random seed for reproducibility. If None, uses random seed.
        """
        self.rng = np.random.default_rng(seed)
    
    def generate(self, scenario: str, hours: int, sensor_id: str = "sensor-1") -> pd.DataFrame:
        """
        Generate synthetic AMD data.
        
        Noise bounds by scenario:
        - normal: pH += rng.uniform(-0.1, 0.1) per step (bounded to 6.5-7.2)
        - warning: pH follows linear decline 7→5.5 + noise ±0.05
        - critical: pH follows exponential decay 7→4.2 + noise ±0.03
        
        Returns DataFrame with exact row count = hours * 12 (5-min intervals)
        """
```

**Multi-sensor generation:**
```python
def generate(self, scenario: str, hours: int, sensor_id: str = "sensor-1") -> pd.DataFrame:
    """Single sensor per call. For 3 sensors, caller loops:"""

# Caller pattern for multi-sensor data:
def generate_multi_sensor(scenario: str, hours: int) -> pd.DataFrame:
    gen = SyntheticDataGenerator(seed=42)
    dfs = []
    for sensor_id in ["sensor-1", "sensor-2", "sensor-3"]:
        df = gen.generate(scenario, hours, sensor_id=sensor_id)
        dfs.append(df)
    return pd.concat(dfs, ignore_index=True)

# This keeps the generator simple while allowing multi-sensor use cases.
```

**Value bounds by parameter (for test assertions):**
| Parameter | Normal Range | Warning Range | Critical Range |
|-----------|--------------|---------------|----------------|
| pH | 6.5-7.2 | 5.5-7.0 | 4.2-7.0 |
| Turbidity | 10-30 NTU | 10-35 NTU | 10-40 NTU |
| Conductivity | 400-500 µS/cm | 450-600 µS/cm | 500-800 µS/cm |
| Temperature | 26-30°C | 26-30°C | 26-30°C |

**Test pattern:**
```python
def test_generator_deterministic():
    gen1 = SyntheticDataGenerator(seed=42)
    gen2 = SyntheticDataGenerator(seed=42)
    df1 = gen1.generate("normal", hours=1)
    df2 = gen2.generate("normal", hours=1)
    pd.testing.assert_frame_equal(df1, df2)  # Identical outputs
```

**Must NOT do**:
- Real data ingestion
- Database storage
- Complex weather simulation

**Parallelizable**: NO (foundation task)

**References**:
- `docs/TASK_BREAKDOWN_TIMELINE.md:359-361` - AMD progression model (normal: pH 6.5-7.2, warning: 7→5.5 over 3 days, critical: 7→4.2 in 6 hours)
- `docs/TASK_BREAKDOWN_TIMELINE.md:362-364` - Parameter correlations and sensor locations

**Acceptance Criteria**:

**TDD:**
- [x] Test file: `ai/tests/test_data_generator.py`
- [x] Tests cover: normal/warning/critical scenarios, correct columns, 5-min intervals
- [x] `cd ai && uv run pytest tests/test_data_generator.py -v` → PASS (14 tests)

**Manual Verification:**
- [x] `cd ai && uv run python -c "from data_generator import SyntheticDataGenerator; g = SyntheticDataGenerator(); df = g.generate('normal', hours=1); print(df.head()); print(df.shape)"` → Shows DataFrame with expected columns and ~12 rows (60min/5min)

**Commit**: YES
- Message: `feat(ai): add synthetic data generator for AMD scenarios`
- Files: `ai/data_generator/__init__.py`, `ai/data_generator/generator.py`, `ai/tests/test_data_generator.py`
- Pre-commit: `cd ai && uv run pytest tests/test_data_generator.py -v`

---

### 2. TimeGPT Forecasting Module

**What to do**:
- Create `ai/forecasting/` module
- Implement `TimeGPTForecaster` class:
  - Initialize with `NixtlaClient` using `NIXTLA_API_KEY` env var
  - `forecast(df, horizon_days=7)` method
  - Handle all 4 parameters via `unique_id` column pattern
  - Return DataFrame with predictions + confidence intervals
- Error handling: API failures, rate limits, invalid data
- Configurable horizon (default 7 days)

**Must NOT do**:
- XGBoost fallback
- Model training/fine-tuning
- Caching predictions

**Parallelizable**: YES (with 3, 4, 5 - can use mock data)

**References**:
- TimeGPT docs via context7: `/nixtla/nixtla` - forecast API usage
- `docs/aquamine-brainstorming/RESEARCH_COMPILATION.md:197-208` - TimeGPT code example

**Acceptance Criteria**:

**TDD:**
- [x] Test file: `ai/tests/test_forecasting.py`
- [x] Tests cover: successful forecast, API error handling, empty data handling
- [x] Mock `NixtlaClient` for unit tests (don't hit real API in CI)
- [x] `cd ai && uv run pytest tests/test_forecasting.py -v` → PASS

**Manual Verification:**
- [x] With real API key: TimeGPT forecaster works with synthetic data

**Commit**: YES
- Message: `feat(ai): add TimeGPT forecasting module`
- Files: `ai/forecasting/__init__.py`, `ai/forecasting/forecaster.py`, `ai/tests/test_forecasting.py`
- Pre-commit: `cd ai && uv run pytest tests/test_forecasting.py -v`

---

### 3. Anomaly Detection Module

**What to do**:
- Create `ai/anomaly/` module
- Implement `AnomalyDetector` class:
  - Primary: TimeGPT `detect_anomalies()` with confidence level 90
  - Fallback: Threshold-based rules when TimeGPT unavailable
    - pH < 6.5 → warning, pH < 4.5 → critical (matches scoring.py)
    - Turbidity > 50 NTU → warning
    - Conductivity > 1000 µS/cm → critical
  - Severity scoring using `calculate_severity_score()` from Severity Scoring section
  - Detect anomalies for ALL 4 parameters (pH, turbidity, conductivity, temperature)
  - Temperature: informational only (score 0, no alerts)
- Return list of anomalies with: timestamp, parameter, value, severity, severity_score, reason

**Must NOT do**:
- Isolation Forest implementation
- Complex ML models
- Historical pattern analysis

**Parallelizable**: YES (with 2, 4, 5)

**References**:
- TimeGPT anomaly detection: `/nixtla/nixtla` context7 docs
- `docs/TASK_BREAKDOWN_TIMELINE.md:76-84` - Threshold definitions

**Acceptance Criteria**:

**TDD:**
- [x] Test file: `ai/tests/test_anomaly.py`
- [x] Tests cover: threshold detection, TimeGPT integration, severity scoring
- [x] `cd ai && uv run pytest tests/test_anomaly.py -v` → PASS

**Manual Verification:**
- [x] Anomaly detector detects anomalies in critical scenario data

**Commit**: YES
- Message: `feat(ai): add anomaly detection with TimeGPT + threshold fallback`
- Files: `ai/anomaly/__init__.py`, `ai/anomaly/detector.py`, `ai/tests/test_anomaly.py`
- Pre-commit: `cd ai && uv run pytest tests/test_anomaly.py -v`

---

### 4. Alert State Machine

**What to do**:
- Create `ai/alerts/` module
- Implement `AlertStateMachine` class:
  - Track state per sensor: normal → warning → critical
  - Only trigger notification on state CHANGE
  - In-memory state storage (dict)
  - Methods (see "Multi-Anomaly Aggregation Rules" section for implementation):
    - `aggregate_anomalies(anomalies: list[AnomalyItem]) → dict[sensor_id, AggregatedSensorData]`
    - `process_aggregated(aggregated: AggregatedSensorData) → tuple[bool, AlertInfo | None]`
- AlertInfo includes: sensor_id, old_state, new_state, severity_score, anomalies list

**Must NOT do**:
- Database persistence
- Alert history beyond current session
- Acknowledgment/mute features

**Parallelizable**: YES (with 2, 3, 5)

**References**:
- `docs/aquamine-brainstorming/AQUAMINE_AGENT_BRIEF.md:106-126` - Alert notification format

**Acceptance Criteria**:

**TDD:**
- [x] Test file: `ai/tests/test_alerts.py`
- [x] Tests cover: state transitions, dedup (no notify on same state), multi-sensor
- [x] `cd ai && uv run pytest tests/test_alerts.py -v` → PASS

**Manual Verification:**
- [x] AlertStateMachine correctly tracks state and triggers notifications on change

**Commit**: YES
- Message: `feat(ai): add alert state machine with deduplication`
- Files: `ai/alerts/__init__.py`, `ai/alerts/state_machine.py`, `ai/tests/test_alerts.py`
- Pre-commit: `cd ai && uv run pytest tests/test_alerts.py -v`

---

### 5. Notification Service (Fonnte + Resend)

**What to do**:
- Create `ai/notifications/` module
- Implement `NotificationService` class:
  - `__init__()`: Load recipients from env vars (ALERT_PHONE, ALERT_EMAIL)
  - `send_whatsapp(message)` via Fonnte API (uses self.phone from env)
  - `send_email(subject, html)` via Resend SDK (uses self.email from env)
  - `notify_alert(alert_info)` - sends both channels using env-configured recipients
- Env vars: `FONNTE_API_TOKEN`, `RESEND_API_KEY`, `ALERT_PHONE`, `ALERT_EMAIL`, `RESEND_FROM_EMAIL`
- Error handling: 
  - Missing env vars: log warning, skip that channel (don't crash)
  - API failures: log error, continue with other channel
  - Return result indicating which channels succeeded/failed
- Message templates for AMD alerts

**Must NOT do**:
- Retry logic (just log failures)
- Template management system
- Multiple phone formats

**Parallelizable**: YES (with 2, 3, 4)

**References**:
- Fonnte API: `https://api.fonnte.com/send` POST with Authorization header
- Resend SDK: `/resend/resend-python` context7 docs
- `docs/aquamine-brainstorming/AQUAMINE_AGENT_BRIEF.md:106-126` - Alert message format

**Acceptance Criteria**:

**TDD:**
- [x] Test file: `ai/tests/test_notifications.py`
- [x] Tests cover: Fonnte mock, Resend mock, error handling
- [x] Mock external APIs (httpx mock for Fonnte, mock resend module)
- [x] `cd ai && uv run pytest tests/test_notifications.py -v` → PASS

**Manual Verification (with real credentials):**
- [x] NotificationService properly sends alerts (mocked in tests, requires real creds for live test)

**Commit**: YES
- Message: `feat(ai): add notification service (Fonnte + Resend)`
- Files: `ai/notifications/__init__.py`, `ai/notifications/service.py`, `ai/tests/test_notifications.py`
- Pre-commit: `cd ai && uv run pytest tests/test_notifications.py -v`

---

### 6. API Endpoints

**What to do**:
- Add to `ai/main.py`:
  - `POST /api/v1/forecast` - Accept time-series data, return 7-day forecast
  - `POST /api/v1/anomaly` - Accept data, return anomaly detection
  - `POST /api/v1/alerts` - Trigger alert processing (anomaly → state machine → notify)
  - `GET /api/v1/alerts` - Get current alert states
- Pydantic schemas for request/response
- Error handling with proper HTTP status codes
- CORS already configured

**API Error Response Schema:**

```python
# ai/schemas/errors.py

from pydantic import BaseModel

class ErrorDetail(BaseModel):
    loc: list[str] | None = None  # Field path for validation errors
    msg: str
    type: str  # Error type code

class ErrorResponse(BaseModel):
    detail: str | list[ErrorDetail]

# HTTP Status Code Mapping:
# 200 OK - Success (including partial notification failures - see below)
# 400 Bad Request   - Validation errors (missing fields, wrong types)
# 422 Unprocessable Entity - Pydantic validation failures (auto from FastAPI)
# 500 Internal Server Error - Unrecoverable errors
# 503 Service Unavailable - TimeGPT completely unavailable AND no fallback possible

# DECISION: TimeGPT fallback = 200 OK with data (not 503)
# - /api/v1/anomaly: If TimeGPT fails, use threshold fallback, return 200 with results
# - /api/v1/forecast: If TimeGPT fails, return 503 (no fallback for forecasting)
# - /api/v1/alerts: Notification failures = 200 with partial success in response body
```

**Error Response Examples:**

```json
// 422 - Validation Error (missing required field)
{
  "detail": [
    {"loc": ["body", "data"], "msg": "field required", "type": "value_error.missing"}
  ]
}

// 503 - Forecast endpoint when TimeGPT unavailable (no fallback)
{
  "detail": "TimeGPT unavailable for forecasting"
}

// 200 - Anomaly endpoint with TimeGPT fallback (success, not error)
// Returns normal response with threshold-based results
{
  "anomalies": [...],
  "total_anomalies": 2,
  "method": "threshold_fallback"  // Optional: indicate fallback was used
}

// 200 - Alerts endpoint with partial notification failure
{
  "processed": 1,
  "notifications_sent": {
    "whatsapp": false,
    "email": true,
    "errors": ["WhatsApp: FONNTE_API_TOKEN not configured"]
  },
  "state_changes": [...]
}
```

**Error Handling Pattern:**
```python
from fastapi import HTTPException

@app.post("/api/v1/forecast")
async def forecast(request: ForecastRequest):
    try:
        result = forecaster.forecast(request.data, request.horizon_days)
        return result
    except NixtlaAPIError as e:
        raise HTTPException(status_code=503, detail=f"TimeGPT unavailable: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

**Must NOT do**:
- Authentication
- Rate limiting
- Alert persistence

**Parallelizable**: NO (depends on 2-5)

**References**:
- `ai/main.py` - Existing FastAPI app structure
- `ai/schemas/cv.py` - Schema pattern to follow
- See "API Schemas and Data Mapping" section above for exact request/response formats

**Acceptance Criteria**:

**TDD:**
- [x] Test file: `ai/tests/test_forecast_api.py`, `ai/tests/test_anomaly_api.py`, `ai/tests/test_alerts_api.py`
- [x] Tests cover: valid requests, validation errors, error responses, state machine integration
- [x] `cd ai && uv run pytest tests/test_forecast_api.py tests/test_anomaly_api.py tests/test_alerts_api.py -v` → PASS

**Manual Verification:**
- [x] API endpoints functional (tested via pytest TestClient)

**Commit**: YES
- Message: `feat(ai): add forecast and anomaly API endpoints`
- Files: `ai/main.py`, `ai/schemas/forecast.py`, `ai/schemas/anomaly.py`, `ai/schemas/alerts.py`, `ai/tests/test_forecast_api.py`, `ai/tests/test_anomaly_api.py`, `ai/tests/test_alerts_api.py`
- Pre-commit: `cd ai && uv run pytest tests/ -v`

---

### 7. Frontend Components

**What to do**:
- Install Recharts: `cd dashboard && npm install recharts`
- Create `dashboard/app/components/ForecastChart.tsx`:
  - Line chart showing pH (and optionally other params) over time
  - Historical + forecast with visual distinction
  - Confidence interval shading
- Create `dashboard/app/components/AlertList.tsx`:
  - List of current alerts with severity badges
  - Color coding: green=normal, yellow=warning, red=critical
- Create `dashboard/app/forecast/page.tsx`:
  - Page combining chart + alert list
  - **Data source on load**: Generate mock data client-side OR add backend endpoint
  - Option A (simpler): Static mock data in page for demo
  - Option B: Add `GET /api/v1/demo-data` endpoint that returns synthetic data
  - **CHOSEN: Option A** - Use static mock data matching API schema format
- Add API functions to `dashboard/lib/api.ts`

**Frontend Data Flow:**
```typescript
// dashboard/app/forecast/page.tsx

// Chart data shape for Recharts LineChart:
interface ChartDataPoint {
  timestamp: string;        // x-axis key (ISO format, displayed as local time)
  ph?: number;              // Historical pH value (undefined in forecast range)
  ph_forecast?: number;     // Forecasted pH (undefined in historical range)
  ph_lower?: number;        // 90% confidence lower bound
  ph_upper?: number;        // 90% confidence upper bound
  // Optionally add turbidity, conductivity, temperature with same pattern
}

// Example data structure:
const chartData: ChartDataPoint[] = [
  // Historical data (last 24 hours)
  { timestamp: "2026-01-29T10:00:00Z", ph: 6.8 },
  { timestamp: "2026-01-29T10:05:00Z", ph: 6.7 },
  // ... more historical
  
  // Forecast data (next 7 days) - overlaps at boundary
  { timestamp: "2026-01-30T10:00:00Z", ph_forecast: 6.5, ph_lower: 6.2, ph_upper: 6.8 },
  { timestamp: "2026-01-30T10:05:00Z", ph_forecast: 6.4, ph_lower: 6.1, ph_upper: 6.7 },
  // ... more forecast
];

// Recharts rendering:
<LineChart data={chartData}>
  <XAxis dataKey="timestamp" tickFormatter={formatTime} />
  <YAxis domain={[4, 8]} />
  
  {/* Historical line (solid) */}
  <Line type="monotone" dataKey="ph" stroke="#3b82f6" strokeWidth={2} dot={false} />
  
  {/* Forecast line (dashed) */}
  <Line type="monotone" dataKey="ph_forecast" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
  
  {/* Confidence interval (shaded area) */}
  <Area type="monotone" dataKey="ph_upper" stroke="none" fill="#3b82f6" fillOpacity={0.1} />
  <Area type="monotone" dataKey="ph_lower" stroke="none" fill="#ffffff" fillOpacity={1} />
</LineChart>
```

const MOCK_FORECAST_DATA = {
  forecasts: [
    { timestamp: "2026-01-30T10:00:00Z", sensor_id: "sensor-1", parameter: "ph", predicted: 6.5, lower_bound: 6.2, upper_bound: 6.8 },
    // ... more mock data points
  ]
};

const MOCK_ALERTS = {
  alert_states: { "sensor-1": "normal", "sensor-2": "warning" }
};

/**
 * OPTION A: Pre-transformed mock data for static rendering.
 * Since we're using static mock data, we pre-transform it at definition time.
 */
const MOCK_CHART_DATA: ChartDataPoint[] = [
  // Historical (last 24h) - in production, this would come from a separate endpoint
  { timestamp: "2026-01-29T10:00:00Z", ph: 6.8 },
  { timestamp: "2026-01-29T10:05:00Z", ph: 6.7 },
  { timestamp: "2026-01-29T10:10:00Z", ph: 6.9 },
  // ... more historical points
  
  // Forecast (next 7 days) - pre-transformed from API format
  { timestamp: "2026-01-30T10:00:00Z", ph_forecast: 6.5, ph_lower: 6.2, ph_upper: 6.8 },
  { timestamp: "2026-01-30T10:05:00Z", ph_forecast: 6.4, ph_lower: 6.1, ph_upper: 6.7 },
  // ... more forecast points
];

/**
 * Transform API forecast response to ChartDataPoint array.
 * 
 * For Option A (static mock), we use MOCK_CHART_DATA directly.
 * This function is implemented for Option B (real API) future use:
 */
function transformForecastToChartData(
  forecasts: ForecastPoint[],  // From API response
  sensorId: string,            // Filter to single sensor for chart
  parameter: string = "ph"     // Filter to single parameter
): ChartDataPoint[] {
  return forecasts
    .filter(f => f.sensor_id === sensorId && f.parameter === parameter)
    .map(f => ({
      timestamp: f.timestamp,
      [`${parameter}_forecast`]: f.predicted,
      [`${parameter}_lower`]: f.lower_bound,
      [`${parameter}_upper`]: f.upper_bound,
    }));
}

// For multi-sensor data: render one chart per sensor, or add sensor selector dropdown

/**
 * Component Props:
 */
interface ForecastChartProps {
  data: ChartDataPoint[];  // Pre-transformed chart data
}

interface AlertListProps {
  alerts: { alert_states: Record<string, string> };
}

export default function ForecastPage() {
  // Option A: Use pre-transformed mock data directly
  const chartData = MOCK_CHART_DATA;
  const alerts = MOCK_ALERTS;
  
  // For real API calls (Option B - when backend is ready):
  // const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  // useEffect(() => {
  //   fetchForecast(inputData).then(res => {
  //     const transformed = transformForecastToChartData(res.forecasts, "sensor-1", "ph");
  //     setChartData(transformed);
  //   });
  // }, []);
  
  return (
    <div>
      <ForecastChart data={chartData} />
      <AlertList alerts={alerts} />
    </div>
  );
}
```

**API Client Functions (implement in `dashboard/lib/api.ts`):**

Even with static mock data (Option A), implement API client stubs for future use:

```typescript
// dashboard/lib/api.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Stub - not called in Option A, but ready for real integration
export async function fetchForecast(data: ForecastRequest): Promise<ForecastResponse> {
  const res = await fetch(`${API_BASE}/api/v1/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

// Stub - not called in Option A
export async function fetchAlertStates(): Promise<AlertStatesResponse> {
  const res = await fetch(`${API_BASE}/api/v1/alerts`);
  return res.json();
}
```

**Must NOT do**:
- Real-time WebSocket updates
- Complex filtering/sorting
- Alert acknowledgment UI
- Multiple chart types

**Parallelizable**: NO (depends on 6)

**References**:
- `dashboard/app/components/ImageUploader.tsx` - Component pattern to follow
- `dashboard/lib/api.ts` - API client pattern
- Recharts docs for line chart with confidence intervals

**Acceptance Criteria**:

**Manual Verification (browser):**
- [x] `cd dashboard && npm run dev` → Opens at localhost:3000
- [x] Navigate to `/forecast` → Page loads without errors
- [x] Chart displays with mock/real data
- [x] Alert list shows severity badges with correct colors
- [x] Dashboard builds successfully

**Commit**: YES
- Message: `feat(dashboard): add forecast chart and alert list components`
- Files: `dashboard/app/components/ForecastChart.tsx`, `dashboard/app/components/AlertList.tsx`, `dashboard/app/forecast/page.tsx`, `dashboard/lib/api.ts`, `dashboard/package.json`
- Pre-commit: `cd dashboard && npm run lint`

---

### 8. Integration Testing

**What to do**:
- Create `ai/tests/test_integration.py`:
  - End-to-end flow: generate data → forecast → detect anomaly → trigger alert
  - Test all scenarios: normal (no alert), warning (alert), critical (alert)
- Verify notification mock calls match expected alerts
- Test API endpoints with synthetic data

**Must NOT do**:
- Load testing
- Real notification sending in tests

**Parallelizable**: NO (depends on 7)

**References**:
- `ai/tests/conftest.py` - Test fixture patterns
- All previous test files

**Test Mocking Strategy (MANDATORY for all tests):**

Create shared fixtures in `ai/tests/conftest.py`:

```python
# ai/tests/conftest.py

import pytest
from unittest.mock import MagicMock, patch
import pandas as pd

# --- TimeGPT Mock ---
@pytest.fixture
def mock_nixtla_client():
    """Mock NixtlaClient for all tests that don't need real API."""
    with patch("nixtla.NixtlaClient") as mock_class:
        mock_client = MagicMock()
        mock_class.return_value = mock_client
        
        # Mock forecast response
        mock_client.forecast.return_value = pd.DataFrame({
            "unique_id": ["sensor-1_ph"] * 5,
            "ds": pd.date_range("2026-01-30", periods=5, freq="5min"),
            "TimeGPT": [6.5, 6.4, 6.3, 6.2, 6.1],
            "TimeGPT-lo-90": [6.2, 6.1, 6.0, 5.9, 5.8],
            "TimeGPT-hi-90": [6.8, 6.7, 6.6, 6.5, 6.4],
        })
        
        # Mock anomaly detection response
        mock_client.detect_anomalies.return_value = pd.DataFrame({
            "unique_id": ["sensor-1_ph"],
            "ds": ["2026-01-23T10:00:00Z"],
            "y": [4.2],
            "anomaly": [True],
            "TimeGPT": [6.5],
        })
        
        yield mock_client

# --- Fonnte Mock ---
@pytest.fixture
def mock_fonnte(monkeypatch):
    """Mock httpx calls to Fonnte API."""
    import httpx
    mock_response = MagicMock()
    mock_response.json.return_value = {"status": True, "detail": "success"}
    mock_response.raise_for_status = MagicMock()
    
    mock_post = MagicMock(return_value=mock_response)
    monkeypatch.setattr(httpx, "post", mock_post)
    return mock_post

# --- Resend Mock ---
@pytest.fixture
def mock_resend(monkeypatch):
    """Mock Resend SDK."""
    import resend
    mock_emails = MagicMock()
    mock_emails.send.return_value = {"id": "test-email-id"}
    monkeypatch.setattr(resend, "Emails", mock_emails)
    return mock_emails

# --- Combined fixture for full integration tests ---
@pytest.fixture
def mock_external_services(mock_nixtla_client, mock_fonnte, mock_resend, monkeypatch):
    """Set up all external service mocks + env vars."""
    monkeypatch.setenv("NIXTLA_API_KEY", "test-key")
    monkeypatch.setenv("FONNTE_API_TOKEN", "test-token")
    monkeypatch.setenv("RESEND_API_KEY", "test-key")
    monkeypatch.setenv("ALERT_PHONE", "08123456789")
    monkeypatch.setenv("ALERT_EMAIL", "test@example.com")
    monkeypatch.setenv("RESEND_FROM_EMAIL", "alerts@test.com")
    
    return {
        "nixtla": mock_nixtla_client,
        "fonnte": mock_fonnte,
        "resend": mock_resend,
    }
```

**Usage in tests:**
```python
# ai/tests/test_integration.py

def test_full_flow(mock_external_services):
    """Test: generate → forecast → detect → alert → notify"""
    # All external services are mocked, test runs offline
    ...
```

**Acceptance Criteria**:

**TDD:**
- [x] Test file: `ai/tests/test_integration.py`
- [x] `cd ai && uv run pytest tests/test_integration.py -v` → PASS (14 tests)
- [x] All tests in `ai/tests/` pass: `cd ai && uv run pytest tests/ -v` → PASS (98 tests)

**Manual Verification:**
- [x] Full test suite: `cd ai && uv run pytest tests/ -v --tb=short` → All pass
- [x] Lint: `cd ai && uv run ruff check .` → No errors

**Commit**: YES
- Message: `test(ai): add integration tests for forecast + anomaly flow`
- Files: `ai/tests/test_integration.py`
- Pre-commit: `cd ai && uv run pytest tests/ -v`

---

### 9. Create PR to Main

**What to do**:
- Ensure all tests pass
- Ensure linting passes (ruff for Python, eslint for frontend)
- Create feature branch if not already on one
- Push to remote
- Create PR with summary of changes
- Use gh CLI: `gh pr create`

**Must NOT do**:
- Force push
- Skip CI checks

**Parallelizable**: NO (final task)

**References**:
- Project git workflow conventions (create branch, push, gh pr create)
- PR format: short summary, bullet points of changes, no file listing

**Acceptance Criteria**:
- [x] All tests pass locally (98 tests)
- [x] `git status` shows clean working tree (all committed)
- [x] PR created with descriptive title and body
- [x] PR URL returned to user: https://github.com/dasarpemrograman/aquamine/pull/3

**Commit**: N/A (PR creation)

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(ai): add synthetic data generator for AMD scenarios` | data_generator/*.py, tests/ | pytest |
| 2 | `feat(ai): add TimeGPT forecasting module` | forecasting/*.py, tests/ | pytest |
| 3 | `feat(ai): add anomaly detection with TimeGPT + threshold fallback` | anomaly/*.py, tests/ | pytest |
| 4 | `feat(ai): add alert state machine with deduplication` | alerts/*.py, tests/ | pytest |
| 5 | `feat(ai): add notification service (Fonnte + Resend)` | notifications/*.py, tests/ | pytest |
| 6 | `feat(ai): add forecast and anomaly API endpoints` | main.py, schemas/*.py, tests/ | pytest |
| 7 | `feat(dashboard): add forecast chart and alert list components` | dashboard/app/components/*.tsx | npm run lint |
| 8 | `test(ai): add integration tests for forecast + anomaly flow` | tests/ | pytest |
| 9 | N/A | PR creation | gh pr create |

---

## Success Criteria

### Verification Commands
```bash
# All Python tests pass
cd ai && uv run pytest tests/ -v

# Python linting passes
cd ai && uv run ruff check .

# Frontend linting passes
cd dashboard && npm run lint

# API server starts
cd ai && uv run uvicorn main:app --reload

# Frontend starts
cd dashboard && npm run dev
```

### Final Checklist
- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] All tests pass (98 tests)
- [x] API endpoints functional
- [x] Frontend renders without errors
- [x] Notifications work (tested with mocks)
- [x] PR created to main: https://github.com/dasarpemrograman/aquamine/pull/3

---

## Environment Variables Required

```bash
# TimeGPT
NIXTLA_API_KEY=xxx

# Fonnte (WhatsApp)
FONNTE_API_TOKEN=xxx

# Resend (Email)
RESEND_API_KEY=xxx

# Alert recipients (required for notifications)
ALERT_PHONE=08xxxxxxxxxx          # WhatsApp recipient
ALERT_EMAIL=operator@example.com  # Email recipient
RESEND_FROM_EMAIL=alerts@draftanakitb.tech  # Sender email (verified domain)
```

---

## Alert Recipients Configuration

**Recipients are sourced from environment variables:**
- `ALERT_PHONE`: WhatsApp recipient phone number (format: `08xxxxxxxxxx` or `628xxxxxxxxxx`)
- `ALERT_EMAIL`: Email recipient address
- `RESEND_FROM_EMAIL`: Sender email address (must be from verified Resend domain: `draftanakitb.tech`)

**NotificationService initialization:**
```python
class NotificationService:
    def __init__(self):
        self.phone = os.getenv("ALERT_PHONE")
        self.email = os.getenv("ALERT_EMAIL")
        self.from_email = os.getenv("RESEND_FROM_EMAIL", "alerts@draftanakitb.tech")
        
    def notify_alert(self, alert_info: dict) -> dict:
        """
        Send notifications for an alert.
        
        Args:
            alert_info: AlertInfo dict from process_aggregated():
                {sensor_id, old_state, new_state, severity_score, anomalies}
                Each anomaly has: sensor_id, parameter, value, severity, severity_score, reason
        
        Returns:
            {"whatsapp": bool, "email": bool, "errors": list[str]}
        """
        # Uses self.phone and self.email from env vars
        # Builds message from alert_info fields
```

**Location/Context in Alert Messages:**
- `sensor_id` is used directly as location identifier in alert messages
- Format: "Lokasi: {sensor_id}" (e.g., "Lokasi: sensor-1")
- No separate location mapping required for demo

---

## Sensor ID to Location Mapping

For demo purposes, sensor_id IS the location identifier:

| sensor_id | Display Name |
|-----------|--------------|
| sensor-1 | Sensor 1 (Settling Pond) |
| sensor-2 | Sensor 2 (Drainage Channel) |
| sensor-3 | Sensor 3 (Outlet) |

The synthetic data generator uses these sensor IDs. Alert messages use sensor_id directly.

---

## Dependencies to Add

### Python (ai/pyproject.toml)
```toml
dependencies = [
    # existing...
    "nixtla>=0.6.0",
    "resend>=2.0.0",
    "httpx>=0.27.0",  # for Fonnte API calls
    "pandas>=2.0.0",  # for data handling
]
```

### Frontend (dashboard/package.json)
```json
{
  "dependencies": {
    "recharts": "^2.15.0"
  }
}
```

---

## API Schemas and Data Mapping

### Forecast Request/Response

**Request (`POST /api/v1/forecast`):**
```json
{
  "data": [
    {"timestamp": "2026-01-23T10:00:00Z", "sensor_id": "sensor-1", "ph": 6.8, "turbidity": 25, "conductivity": 450, "temperature": 28.5},
    {"timestamp": "2026-01-23T10:05:00Z", "sensor_id": "sensor-1", "ph": 6.7, "turbidity": 26, "conductivity": 455, "temperature": 28.6}
  ],
  "horizon_days": 7
}
```

**TimeGPT Data Transformation:**
Input data is transformed to TimeGPT's required format with `unique_id` per parameter:
```python
# Transform: one row per parameter per timestamp
# unique_id = f"{sensor_id}_{parameter}"  e.g. "sensor-1_ph"
# ds = timestamp (ISO format)
# y = value

timegpt_df = pd.DataFrame([
    {"unique_id": "sensor-1_ph", "ds": "2026-01-23T10:00:00Z", "y": 6.8},
    {"unique_id": "sensor-1_turbidity", "ds": "2026-01-23T10:00:00Z", "y": 25},
    # ... repeat for all parameters and timestamps
])

# Forecast horizon calculation (lives in forecasting/forecaster.py):
# With 5-minute cadence, horizon_days maps to h as:
# h = horizon_days * 24 * 12  (12 data points per hour)
# Example: 7 days = 7 * 24 * 12 = 2016 forecast points

# TimeGPT call with confidence intervals:
forecast_df = nixtla_client.forecast(
    df=timegpt_df,
    h=horizon_days * 24 * 12,  # 2016 for 7 days
    freq='5min',
    level=[90]  # 90% confidence interval
)

# Output columns from TimeGPT:
# unique_id, ds, TimeGPT, TimeGPT-lo-90, TimeGPT-hi-90

# Column mapping to API response:
# TimeGPT → predicted
# TimeGPT-lo-90 → lower_bound
# TimeGPT-hi-90 → upper_bound
```

**Response:**
```json
{
  "forecasts": [
    {"timestamp": "2026-01-30T10:00:00Z", "sensor_id": "sensor-1", "parameter": "ph", "predicted": 6.5, "lower_bound": 6.2, "upper_bound": 6.8},
    {"timestamp": "2026-01-30T10:00:00Z", "sensor_id": "sensor-1", "parameter": "turbidity", "predicted": 28, "lower_bound": 22, "upper_bound": 34}
  ],
  "horizon_days": 7,
  "data_points": 2016
}
```

**Response field definitions:**
- `forecasts`: Array of forecast points, **ordered by timestamp ASC, then sensor_id, then parameter alphabetically**
- `data_points`: **Total count of forecast points in the response** (= h × num_sensors × num_parameters). For 7 days with 1 sensor and 4 parameters: 2016 × 1 × 4 = 8064
- `horizon_days`: Echo of request parameter
```

### Anomaly Request/Response

**Request (`POST /api/v1/anomaly`):**
```json
{
  "data": [
    {"timestamp": "2026-01-23T10:00:00Z", "sensor_id": "sensor-1", "ph": 4.2, "turbidity": 65, "conductivity": 850, "temperature": 28.5}
  ]
}
```

**Response:**
```json
{
  "anomalies": [
    {
      "timestamp": "2026-01-23T10:00:00Z",
      "sensor_id": "sensor-1",
      "parameter": "ph",
      "value": 4.2,
      "severity": "critical",
      "severity_score": 9,
      "reason": "pH below critical threshold (4.5)"
    },
    {
      "timestamp": "2026-01-23T10:00:00Z",
      "sensor_id": "sensor-1",
      "parameter": "turbidity",
      "value": 65,
      "severity": "warning",
      "severity_score": 5,
      "reason": "Turbidity above warning threshold (50 NTU)"
    }
  ],
  "total_anomalies": 2
}
```

**Anomaly Output Contract:**
- If ALL parameters are normal → return `{"anomalies": [], "total_anomalies": 0}` (empty array, 200 OK)
- Only abnormal values produce AnomalyItem entries
- Normal values are NOT included in anomalies array

**Recovery/Downgrade Handling:**
- `/api/v1/anomaly` only reports current state, not transitions
- `/api/v1/alerts` handles state transitions (recovery = state going DOWN)
- When sensor recovers (e.g., pH returns to 6.8), next `/api/v1/anomaly` call returns empty anomalies for that sensor
- `/api/v1/alerts` with empty anomalies for a sensor → state transitions to "normal" → triggers recovery notification
```

### Alerts Request/Response

**CANONICAL SCHEMAS (Single Source of Truth):**

```python
# ai/schemas/alerts.py

class AnomalyItem(BaseModel):
    """Individual anomaly from anomaly detection."""
    sensor_id: str
    parameter: str
    value: float
    severity: str           # "normal", "warning", "critical"
    severity_score: int     # 0-10, derived from calculate_severity_score()
    reason: str

class AlertRequest(BaseModel):
    """POST /api/v1/alerts request body."""
    anomalies: list[AnomalyItem]
    notify: bool = True

class AlertInfo(BaseModel):
    """Alert info for notifications (output from process_aggregated)."""
    sensor_id: str
    old_state: str          # "normal", "warning", "critical"
    new_state: str          # "normal", "warning", "critical"  
    severity_score: int     # Max score from aggregated anomalies
    anomalies: list[AnomalyItem]  # All anomalies for this sensor

class StateChange(BaseModel):
    """State change record in response."""
    sensor_id: str
    old_state: str
    new_state: str

class AlertResponse(BaseModel):
    """POST /api/v1/alerts response body."""
    processed: int
    notifications_sent: dict  # {"whatsapp": bool, "email": bool, "errors": list[str]}
    state_changes: list[StateChange]
```

**Request (`POST /api/v1/alerts`):**
```json
{
  "anomalies": [
    {
      "sensor_id": "sensor-1",
      "parameter": "ph",
      "value": 4.2,
      "severity": "critical",
      "severity_score": 9,
      "reason": "pH below critical threshold (4.5)"
    }
  ],
  "notify": true
}
```

**Response:**
```json
{
  "processed": 1,
  "notifications_sent": {
    "whatsapp": true,
    "email": true,
    "errors": []
  },
  "state_changes": [
    {"sensor_id": "sensor-1", "old_state": "warning", "new_state": "critical"}
  ]
}
```

**Response with partial failure:**
```json
{
  "processed": 1,
  "notifications_sent": {
    "whatsapp": false,
    "email": true,
    "errors": ["WhatsApp: FONNTE_API_TOKEN not configured"]
  },
  "state_changes": [
    {"sensor_id": "sensor-1", "old_state": "normal", "new_state": "warning"}
  ]
}
```

**Request (`GET /api/v1/alerts`):**
No body required.

**Response:**
```json
{
  "alert_states": {
    "sensor-1": "critical",
    "sensor-2": "normal",
    "sensor-3": "warning"
  },
  "last_updated": "2026-01-23T10:05:00Z"
}
```

**Response field definitions:**
- `alert_states`: Dict of sensor_id → current state (from in-memory `AlertStateMachine.sensor_states`)
- `last_updated`: **Timestamp of the most recent state change across all sensors.** Stored in `AlertStateMachine.last_updated: datetime | None`. Updated in `process_aggregated()` when a state change occurs. Returns `null` if no alerts have been processed yet.

**AlertStateMachine storage:**
```python
class AlertStateMachine:
    def __init__(self):
        self.sensor_states: dict[str, str] = {}  # sensor_id -> state
        self.last_updated: datetime | None = None  # Updated on state change
    
    def process_aggregated(self, aggregated: dict) -> tuple[bool, dict | None]:
        # ... existing logic ...
        if old_state != new_state:
            self.last_updated = datetime.now(timezone.utc)  # Update timestamp
            return True, {...}
        return False, None
```
```

---

## Severity Scoring and State Mapping

### Deterministic Severity Scoring

**SINGLE SOURCE OF TRUTH - Threshold-based scoring:**

**Ownership:** `ai/anomaly/scoring.py` - This is the ONLY file that defines severity scoring logic. All other modules import from here.

```python
# ai/anomaly/scoring.py

def calculate_severity_score(parameter: str, value: float) -> tuple[int, str]:
    """
    Returns (score 0-10, state: 'normal'|'warning'|'critical')
    
    RULE: Score determines state:
      0-3 → normal
      4-6 → warning  
      7-10 → critical
    """
    if parameter == "ph":
        if value >= 6.5:
            return (1, "normal")    # pH normal: 6.5-14
        elif value >= 5.5:
            return (5, "warning")   # pH warning: 5.5-6.5
        elif value >= 4.5:
            return (6, "warning")   # pH high-warning: 4.5-5.5 (score 6, still warning)
        else:
            return (9, "critical")  # pH critical: <4.5
    
    elif parameter == "turbidity":
        if value <= 25:
            return (1, "normal")    # Turbidity normal: 0-25 NTU
        elif value <= 50:
            return (5, "warning")   # Turbidity warning: 25-50 NTU
        else:
            return (6, "warning")   # Turbidity high: >50 NTU (score 6, warning only)
    
    elif parameter == "conductivity":
        if value <= 500:
            return (1, "normal")    # Conductivity normal: 0-500 µS/cm
        elif value <= 1000:
            return (5, "warning")   # Conductivity warning: 500-1000 µS/cm
        else:
            return (8, "critical")  # Conductivity critical: >1000 µS/cm
    
    elif parameter == "temperature":
        # Temperature is informational, doesn't trigger alerts
        return (0, "normal")
    
    return (0, "normal")
```

**Import pattern for other modules:**
```python
# In ai/anomaly/detector.py
from anomaly.scoring import calculate_severity_score

# In ai/alerts/state_machine.py
from anomaly.scoring import calculate_severity_score
```

### Score to State Mapping (CONSISTENT)

| Score Range | Alert State | Example |
|-------------|-------------|---------|
| 0-3 | `normal` | pH >= 6.5 (score 1) |
| 4-6 | `warning` | pH 4.5-6.5 (score 5-6), turbidity > 25 (score 5-6) |
| 7-10 | `critical` | pH < 4.5 (score 9), conductivity > 1000 (score 8) |

**INVARIANT:** Score determines state. No exceptions.

### State Transition and Notification Rules

**Transitions trigger notifications in BOTH directions:**
- Upward: `normal` → `warning` → `critical` (NOTIFY)
- Downward: `critical` → `warning` → `normal` (NOTIFY - recovery alert)

```python
def should_notify(old_state: str, new_state: str) -> bool:
    # Notify on ANY state change
    return old_state != new_state
```

**Downgrade behavior:**
- State IS updated on downgrade
- Notification IS sent (with message indicating recovery)
- Example: "⬇️ RECOVERY: Sensor-1 improved from CRITICAL to WARNING"

### Multi-Anomaly Aggregation Rules

**When multiple anomalies exist for one sensor in the same request:**

1. **State uses MAX severity**: If pH=critical and turbidity=warning, sensor state = critical
2. **One notification per sensor**: Not per-parameter
3. **All anomalies listed in notification**: Message includes all parameters that triggered

**Ownership:** `aggregate_anomalies()` lives in `ai/alerts/state_machine.py`

```python
# ai/alerts/state_machine.py

class AlertStateMachine:
    def __init__(self):
        self.sensor_states: dict[str, str] = {}  # sensor_id -> state
    
    def aggregate_anomalies(self, anomalies: list[dict]) -> dict[str, dict]:
        """
        Group anomalies by sensor_id and compute max severity.
        
        Args:
            anomalies: List of AnomalyItem dicts with keys: 
                       sensor_id, parameter, value, severity, severity_score, reason
        
        Returns:
            dict[sensor_id] -> {sensor_id, severity_score, state, anomalies}
        """
        by_sensor = defaultdict(list)
        for a in anomalies:
            by_sensor[a["sensor_id"]].append(a)
        
        result = {}
        for sensor_id, sensor_anomalies in by_sensor.items():
            max_score = max(a["severity_score"] for a in sensor_anomalies)
            max_state = self._score_to_state(max_score)
            result[sensor_id] = {
                "sensor_id": sensor_id,
                "severity_score": max_score,
                "state": max_state,
                "anomalies": sensor_anomalies
            }
        return result
    
    def process_aggregated(self, aggregated: dict) -> tuple[bool, dict | None]:
        """
        Process aggregated anomalies for a single sensor.
        
        Args:
            aggregated: Output from aggregate_anomalies for one sensor
                        {sensor_id, severity_score, state, anomalies}
        
        Returns:
            (should_notify, AlertInfo dict or None)
            AlertInfo: {sensor_id, old_state, new_state, severity_score, anomalies}
        """
        sensor_id = aggregated["sensor_id"]
        new_state = aggregated["state"]
        old_state = self.sensor_states.get(sensor_id, "normal")
        
        self.sensor_states[sensor_id] = new_state
        
        if old_state != new_state:
            return True, {
                "sensor_id": sensor_id,
                "old_state": old_state,
                "new_state": new_state,
                "severity_score": aggregated["severity_score"],
                "anomalies": aggregated["anomalies"]
            }
        return False, None
    
    def _score_to_state(self, score: int) -> str:
        if score <= 3:
            return "normal"
        elif score <= 6:
            return "warning"
        return "critical"
```

**API layer integration (in main.py):**
```python
from schemas.alerts import AlertRequest, AlertResponse, StateChange

@app.post("/api/v1/alerts", response_model=AlertResponse)
async def process_alerts(request: AlertRequest):
    # request.anomalies is list[AnomalyItem] with all fields including severity_score
    
    # 1. Aggregate anomalies by sensor (convert to dicts for state machine)
    anomaly_dicts = [a.model_dump() for a in request.anomalies]
    aggregated = alert_state_machine.aggregate_anomalies(anomaly_dicts)
    
    # 2. Process each sensor's aggregated state
    state_changes = []
    notify_result = {"whatsapp": False, "email": False, "errors": []}
    
    for sensor_id, agg in aggregated.items():
        should_notify, alert_info = alert_state_machine.process_aggregated(agg)
        if should_notify:
            state_changes.append(StateChange(
                sensor_id=sensor_id,
                old_state=alert_info["old_state"],
                new_state=alert_info["new_state"]
            ))
            if request.notify:
                result = notification_service.notify_alert(alert_info)
                notify_result["whatsapp"] = notify_result["whatsapp"] or result["whatsapp"]
                notify_result["email"] = notify_result["email"] or result["email"]
                notify_result["errors"].extend(result["errors"])
    
    return AlertResponse(
        processed=len(aggregated),
        notifications_sent=notify_result,
        state_changes=state_changes
    )
```

### TimeGPT Anomaly Integration

When TimeGPT is available:
1. Call `detect_anomalies()` with confidence level 90
2. If TimeGPT returns `anomaly=True`, use threshold-based scoring above to get score/state
3. If TimeGPT unavailable, fall back to threshold-based detection only

**TimeGPT `detect_anomalies()` Output Mapping:**

```python
# Input to TimeGPT (same format as forecast):
timegpt_df = pd.DataFrame([
    {"unique_id": "sensor-1_ph", "ds": "2026-01-23T10:00:00Z", "y": 4.2},
    {"unique_id": "sensor-1_turbidity", "ds": "2026-01-23T10:00:00Z", "y": 65},
    # ... one row per parameter per timestamp
])

# TimeGPT detect_anomalies() call:
anomaly_df = nixtla_client.detect_anomalies(
    df=timegpt_df,
    level=90  # 90% confidence level
)

# Output columns from TimeGPT:
# | unique_id       | ds                   | y    | anomaly | TimeGPT |
# |-----------------|----------------------|------|---------|---------|
# | sensor-1_ph     | 2026-01-23T10:00:00Z | 4.2  | True    | 6.5     |
# | sensor-1_turb.. | 2026-01-23T10:00:00Z | 65   | False   | 30      |

# Mapping to AnomalyItem:
def map_timegpt_anomaly(row: pd.Series) -> AnomalyItem | None:
    if not row["anomaly"]:
        return None
    
    # Parse unique_id back to sensor_id and parameter
    sensor_id, parameter = row["unique_id"].rsplit("_", 1)
    value = row["y"]
    
    # Get severity using shared scoring function
    from anomaly.scoring import calculate_severity_score
    score, state = calculate_severity_score(parameter, value)
    
    return AnomalyItem(
        sensor_id=sensor_id,
        parameter=parameter,
        value=value,
        severity=state,
        severity_score=score,
        reason=f"TimeGPT detected anomaly (expected: {row['TimeGPT']:.2f})"
    )
```

**No deviation formula needed** - we use the deterministic threshold scoring for all cases.

---

## Fonnte API Payload Details

**Endpoint:** `POST https://api.fonnte.com/send`

**Headers:**
```
Authorization: <FONNTE_API_TOKEN>
Content-Type: application/x-www-form-urlencoded
```

**Request Body (form-data):**

The notification service builds the message from AlertInfo fields:

```python
# ai/notifications/service.py

def _build_whatsapp_message(self, alert_info: dict) -> str:
    """
    Build WhatsApp message using ONLY AlertInfo fields:
    - sensor_id, old_state, new_state, severity_score, anomalies[]
    - Each anomaly has: sensor_id, parameter, value, severity, severity_score, reason
    """
    sensor_id = alert_info["sensor_id"]
    old_state = alert_info["old_state"].upper()
    new_state = alert_info["new_state"].upper()
    score = alert_info["severity_score"]
    anomalies = alert_info["anomalies"]
    
    # Build anomaly details
    details = []
    for a in anomalies:
        details.append(f"• {a['parameter']}: {a['value']} ({a['reason']})")
    details_str = "\n".join(details)
    
    # Determine emoji based on direction
    if new_state == "CRITICAL":
        emoji = "🚨"
        header = "PERINGATAN AMD"
    elif new_state == "WARNING":
        emoji = "⚠️"
        header = "PERINGATAN AMD"
    else:
        emoji = "✅"
        header = "RECOVERY"
    
    return f"""{emoji} {header} - AquaMine AI

📍 Lokasi: {sensor_id}
📊 Status: {old_state} → {new_state}
🎯 Severity: {score}/10

📈 Kondisi:
{details_str}

---
AquaMine AI Monitoring System"""
```

**Example Message (Critical):**
```
🚨 PERINGATAN AMD - AquaMine AI

📍 Lokasi: sensor-1
📊 Status: WARNING → CRITICAL
🎯 Severity: 9/10

📈 Kondisi:
• ph: 4.2 (pH below critical threshold (4.5))

---
AquaMine AI Monitoring System
```

**Example Message (Recovery):**
```
✅ RECOVERY - AquaMine AI

📍 Lokasi: sensor-1
📊 Status: CRITICAL → NORMAL
🎯 Severity: 1/10

📈 Kondisi:
• ph: 6.8 (pH within normal range)

---
AquaMine AI Monitoring System
```

**Request format:**
```
target=08xxxxxxxxxx
message=<message from _build_whatsapp_message()>
countryCode=62
```

**Success Response:**
```json
{
  "status": true,
  "detail": "success! message in queue",
  "id": ["80367170"],
  "process": "pending"
}
```

**Error Response:**
```json
{
  "status": false,
  "reason": "token invalid"
}
```

**Documentation:** https://docs.fonnte.com/api-send-message/

---

## Resend Email Template

**Email Subject:**
```python
def _build_email_subject(self, alert_info: dict) -> str:
    new_state = alert_info["new_state"].upper()
    sensor_id = alert_info["sensor_id"]
    
    if new_state == "CRITICAL":
        return f"🚨 CRITICAL: AMD Alert - {sensor_id}"
    elif new_state == "WARNING":
        return f"⚠️ WARNING: AMD Alert - {sensor_id}"
    else:
        return f"✅ RECOVERY: {sensor_id} returned to normal"
```

**Email HTML Body:**
```python
def _build_email_html(self, alert_info: dict) -> str:
    """
    Build HTML email using ONLY AlertInfo fields:
    - sensor_id, old_state, new_state, severity_score, anomalies[]
    """
    sensor_id = alert_info["sensor_id"]
    old_state = alert_info["old_state"].upper()
    new_state = alert_info["new_state"].upper()
    score = alert_info["severity_score"]
    anomalies = alert_info["anomalies"]
    
    # Build anomaly table rows
    rows = ""
    for a in anomalies:
        rows += f"""
        <tr>
            <td>{a['parameter']}</td>
            <td>{a['value']}</td>
            <td>{a['severity']}</td>
            <td>{a['reason']}</td>
        </tr>"""
    
    # Color based on state
    if new_state == "CRITICAL":
        color = "#dc2626"  # red
        header = "PERINGATAN AMD - CRITICAL"
    elif new_state == "WARNING":
        color = "#f59e0b"  # amber
        header = "PERINGATAN AMD - WARNING"
    else:
        color = "#22c55e"  # green
        header = "RECOVERY - Status Normal"
    
    return f"""
    <html>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
        <div style="background-color: {color}; color: white; padding: 15px; border-radius: 5px;">
            <h2 style="margin: 0;">{header}</h2>
        </div>
        
        <div style="padding: 20px 0;">
            <p><strong>Lokasi:</strong> {sensor_id}</p>
            <p><strong>Status:</strong> {old_state} → {new_state}</p>
            <p><strong>Severity Score:</strong> {score}/10</p>
        </div>
        
        <h3>Kondisi Terdeteksi:</h3>
        <table style="border-collapse: collapse; width: 100%;">
            <thead>
                <tr style="background-color: #f3f4f6;">
                    <th style="border: 1px solid #ddd; padding: 8px;">Parameter</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Value</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Severity</th>
                    <th style="border: 1px solid #ddd; padding: 8px;">Reason</th>
                </tr>
            </thead>
            <tbody>
                {rows}
            </tbody>
        </table>
        
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
            <p>AquaMine AI Monitoring System</p>
        </div>
    </body>
    </html>
    """
```

**Resend SDK Usage:**
```python
import resend

def send_email(self, subject: str, html: str) -> bool:
    if not os.getenv("RESEND_API_KEY"):
        logging.warning("RESEND_API_KEY not configured, skipping email")
        return False
    
    resend.api_key = os.getenv("RESEND_API_KEY")
    
    try:
        resend.Emails.send({
            "from": self.from_email,
            "to": [self.email],
            "subject": subject,
            "html": html
        })
        return True
    except Exception as e:
        logging.error(f"Email send failed: {e}")
        return False
```
