# AquaMine AI - Task Breakdown & Timeline (5-Person Team)

**Competition:** ISMC XV - Water Management Innovation  
**Final Submission:** 7 February 2026  
**Final Presentation:** 10 February 2026  
**Start Date:** 22 January 2026  
**Total Days:** 16 days to submission

---

## Team Structure

| Role | Person | Primary Responsibilities |
|------|--------|-------------------------|
| **ML/AI #1** | TBD | Forecasting (TimeGPT-only) + Anomaly Detection |
| **ML/AI #2** | TBD | Computer Vision (Yellow Boy Detection) + Dataset |
| **Backend** | TBD | API + TimescaleDB + WebSocket + Redis |
| **IoT/Integration** | TBD | Simulator + Data Contract + E2E Testing |
| **Frontend** | TBD | Dashboard + Charts + Map + Realtime UI |

---

## Critical Path & Dependencies

```
Day 1-3: Foundation (Parallel Setup)
├─ DB Schema (BE) ──┬──> API Endpoints (BE) ──┬──> WebSocket (BE) ──┬──> Realtime UI (FE)
├─ Data Contract (IoT) ─┤                     │                     │
├─ Mockup UI (FE) ──────┴─────────────────────┤                     │
└─ ML Baseline (ML1+ML2) ─────────────────────┴─────────────────────┘

Day 4-7: MVP Integration
├─ Ingest Pipeline (BE+IoT) ──> Live Data (FE)
├─ Anomaly API (ML1) ──────────> Alert UI (FE)
└─ CV Pipeline (ML2) ──────────> Visual Outputs (FE)

Day 8-10: Polish
├─ Refine Models (ML1+ML2)
├─ Alert Management (BE+FE)
└─ End-to-End Flow (All)

Day 11-14: Demo Ready
├─ Demo Scenarios (IoT)
├─ Dashboard Polish (FE)
└─ Video Script (All)

Day 15-16: Buffer + Final Submission
├─ QA + Bugfix (All)
├─ Video Recording (All)
└─ Source + Video Upload (All)
```

---

## Detailed Task Breakdown by Role

### **ML/AI #1: Forecasting + Anomaly Detection**

#### Week 1 (22-28 Jan)

**Day 1-2 (22-23 Jan): Baseline Forecasting**
- [x] Setup Python env (FastAPI integration ready)
- [x] TimeGPT API integration
  - [x] Provide `NIXTLA_API_KEY` in `.env` for live forecasts (falls back to mock if missing)
  - [x] Test API call with dummy pH time-series
  - [x] Handle API errors/rate limits (mock forecast fallback)
- [x] ~~XGBoost fallback model~~ **SKIPPED: TimeGPT-only**
  - [x] ~~Feature engineering: lag features (t-1, t-7), rolling mean/std~~
  - [x] ~~Train on synthetic data (create 100-day pH simulation)~~
  - [x] ~~Serialize model (pickle/joblib)~~
- [x] Output endpoints: `/api/v1/forecast`, `/api/v1/forecast/{sensor_id}`, `/api/v1/forecast/generate`
- **Deliverable:** Working forecast function + stored predictions
- **Dependency:** None (parallel with others)

**Day 3 (24 Jan): Anomaly Detection Rules**
- [x] Implement threshold-based detection
  - [x] pH < 5.5 → warning
  - [x] pH < 4.5 → critical
  - [x] Turbidity > 50 NTU → warning
  - [x] Temperature > 35 C → warning, > 40 C → critical
- [x] ~~Isolation Forest anomaly scoring~~ **SKIPPED: Threshold-only detector**
  - [x] ~~Train on synthetic normal data~~
  - [x] ~~Output anomaly score (0-10)~~
- [x] Alert severity logic (threshold score 5 = warning, 10 = critical)
- **Deliverable:** Anomaly detection function + unit tests
- **Dependency:** None

**Day 4-5 (25-26 Jan): API Integration**
- [x] Integrate forecast endpoints `/api/v1/forecast`, `/api/v1/forecast/{sensor_id}`, `/api/v1/forecast/generate`
- [x] Integrate anomaly summary `/api/v1/anomaly` + anomaly list `/api/v1/anomalies`
- [x] Response format:
  ```json
  {
    "forecast": [{"timestamp": "...", "value": 6.2, "lower": 5.9, "upper": 6.6, "confidence": 0.85}],
    "anomaly": {"score": 5, "severity": "warning", "reason": "pH anomaly detected"}
  }
  ```
- [x] Error handling + logging
- **Deliverable:** Live API endpoints
- **Dependency:** Backend API scaffold ready (Day 2)

**Day 6-7 (27-28 Jan): Model Refinement**
- [x] Test with realistic synthetic data (normal/warning/critical scenarios in `ai/data_generator/synthetic.py`)
- [x] Calibrate confidence intervals (TimeGPT 90% bounds)
- [x] Add model versioning (`timegpt-1`)
- [x] Document model parameters + accuracy metrics (`docs/ml1-model-card.md`)
- **Deliverable:** Model card (accuracy, limitations, inputs/outputs) in `docs/ml1-model-card.md`

#### Week 2 (29 Jan - 4 Feb)

**Day 8-9 (29-30 Jan): Error Handling + Fallback**
- [x] ~~TimeGPT failure → auto-fallback to XGBoost~~ **SKIPPED: TimeGPT-only (mock forecast fallback)**
- [x] Missing data handling (interpolation up to 6h, forward-fill up to 12h)
- [x] Data requirements check (warn if < 168 hourly points)
- [x] ~~Add prediction explanation (SHAP for XGBoost)~~ **SKIPPED: TimeGPT-only**
- **Deliverable:** Robust inference pipeline

**Day 10-11 (31 Jan - 1 Feb): Demo Scenarios**
- [x] Create 3 demo datasets:
  - [x] Normal operation (pH 6-7)
  - [x] Gradual degradation (pH 7→5 over 5 days)
  - [x] Sudden spike (pH 7→4 in 1 day)
- [ ] Pre-run predictions for demo consistency (optional; not implemented)
- **Deliverable:** Demo data + expected outputs

**Day 12-14 (2-4 Feb): Final Polish**
- [x] Performance expectation: TimeGPT latency depends on external API (no local < 500ms budget)
- [x] API documentation (FastAPI OpenAPI schema available)
- [x] Unit + integration tests in place (coverage not measured)
- **Deliverable:** Production-ready model service

#### Week 3 (5-7 Feb): Buffer + Video

**Day 15-16 (5-6 Feb): QA + Video Support**
- [ ] Fix bugs from integration testing
- [ ] Support video recording (explain model outputs)
- [ ] Prepare model explanation for Q&A

---

### **ML/AI #2: Computer Vision + Dataset**

#### Week 1 (22-28 Jan)

**Day 1-2 (22-23 Jan): CV Pipeline Setup**
- [x] Setup OpenCV + PyTorch environment (using ultralytics YOLO + PIL)
- [x] Collect reference images:
  - [x] Yellow Boy (iron hydroxide) samples from Google Images/papers
  - [x] Normal water samples
  - [x] Turbid water samples
- [x] YOLOv8 object detection (replaced RGB threshold approach for better accuracy)
  - [x] Trained YOLOv8n model on ~150 images
  - [x] Model file: `ai/models/best.pt`
- [x] Output: bounding box + confidence score
- **Deliverable:** Basic CV detection function ✅
- **Dependency:** None

**Day 3 (24 Jan): Dataset Labeling**
- [x] Create 50 labeled samples (Yellow Boy: yes/no) — achieved 112 original images
- [x] Augmentation (brightness, contrast, rotation) via Roboflow
- [x] Save as dataset (YOLO format with .txt labels) at `ai/dataset/yellow-boy-detection.v2i.yolov8/`
- **Deliverable:** Dataset v1.0 ✅
- **Dependency:** None

**Day 4-5 (25-26 Jan): API Integration**
- [x] Integrate into `/api/v1/cv/analyze` endpoint
- [x] Input: image upload (multipart, 10MB limit)
- [x] Output:
  ```json
  {
    "detected": true,
    "confidence": 0.78,
    "bbox": {"x": 120, "y": 80, "width": 200, "height": 150, "confidence": 0.78},
    "bboxes": [...],
    "severity": "moderate",
    "latency_ms": 45,
    "model_version": "yolov8n-yellowboy-v1",
    "image_width": 640,
    "image_height": 480,
    "warnings": []
  }
  ```
- [x] Error handling (MISSING_FILE, INVALID_FILE_TYPE, IMAGE_DECODE_FAILED, FILE_TOO_LARGE)
- **Deliverable:** Live CV API ✅
- **Dependency:** Backend API scaffold (Day 2)

**Day 6-7 (27-28 Jan): Confidence Calibration**
- [x] Test on diverse samples (different lighting, angles) — documented in cv-test-results.md
- [x] Tune threshold parameters (none < 0.5, mild 0.5-0.65, moderate 0.65-0.8, severe >= 0.8)
- [x] Detection threshold set to 0.65; response includes `detected` boolean
- [x] Inference params tuned (conf=0.65, iou=0.6, max_det=20)
- **Deliverable:** Calibrated CV model ✅

#### Week 2 (29 Jan - 4 Feb)

**Day 8-9 (29-30 Jan): Advanced Features**
- [x] Add severity estimation (mild/moderate/severe based on confidence thresholds)
- [ ] ~~Multi-frame analysis (if video input)~~ — deferred, not needed for MVP
- [ ] ~~Add preprocessing (noise reduction, contrast enhancement)~~ — model works well without
- **Deliverable:** Enhanced CV pipeline ✅

**Day 10-11 (31 Jan - 1 Feb): Demo Visuals**
- [x] Create demo images with annotations — frontend renders bboxes with overlay
- [x] Side-by-side comparison (before/after detection) — live in ImageUploader.tsx
- [x] Export detection results as overlayed images — frontend displays bbox overlay on uploaded image
- [x] Live Camera + Video File modes — LiveCameraView.tsx, VideoFileView.tsx
- **Deliverable:** Demo visual assets ✅

**Day 12-14 (2-4 Feb): Integration Testing**
- [x] ~~Test CV + drone telemetry flow~~ — drone telemetry not in scope
- [x] Performance optimization (inference < 2s per image) — achieved ~45ms
- [x] Unit tests + edge cases (corrupted, small, large, invalid file type)
- **Deliverable:** Production-ready CV service ✅

#### Week 3 (5-7 Feb): Buffer + Video

**Day 15-16 (5-6 Feb): QA + Video Support**
- [x] Fix bugs
- [x] Prepare demo images for video — frontend CV page ready
- [x] Explain CV logic for Q&A — documented in cv-test-results.md

---

### **Backend: API + Database + Realtime**

#### Week 1 (22-28 Jan)

**Day 1-2 (22-23 Jan): Database Schema** ⚠️ **BLOCKING TASK**
- [x] Install TimescaleDB (no PostGIS)
- [x] Design schema:
  ```sql
  CREATE TABLE sensors (
    id SERIAL PRIMARY KEY,
    sensor_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    latitude FLOAT,
    longitude FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
  );
  
  CREATE TABLE readings (
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

  SELECT create_hypertable('readings', 'timestamp', chunk_time_interval => INTERVAL '7 days');
  
  CREATE TABLE predictions (
    id SERIAL PRIMARY KEY,
    sensor_id INTEGER REFERENCES sensors(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    forecast_start TIMESTAMPTZ NOT NULL,
    forecast_end TIMESTAMPTZ NOT NULL,
    parameter VARCHAR(20) NOT NULL,
    forecast_values JSONB NOT NULL,
    model_version VARCHAR(50)
  );

  CREATE TABLE anomalies (
    id SERIAL PRIMARY KEY,
    sensor_id INTEGER REFERENCES sensors(id),
    timestamp TIMESTAMPTZ NOT NULL,
    parameter VARCHAR(20) NOT NULL,
    value FLOAT NOT NULL,
    anomaly_score FLOAT,
    detection_method VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    sensor_id INTEGER REFERENCES sensors(id),
    severity VARCHAR(20) NOT NULL,
    previous_state VARCHAR(20),
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by VARCHAR(100)
  );

  CREATE TABLE notification_recipients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    notify_warning BOOLEAN DEFAULT TRUE,
    notify_critical BOOLEAN DEFAULT TRUE
  );

  CREATE TABLE sensor_alert_state (
    sensor_id INTEGER PRIMARY KEY REFERENCES sensors(id),
    current_state VARCHAR(20) DEFAULT 'normal',
    last_alert_at TIMESTAMPTZ,
    last_notification_at TIMESTAMPTZ
  );
  ```
- [x] Setup SQLAlchemy models
- [x] No Alembic; schema managed by SQLAlchemy + `scripts/init-db.sql`
- [x] Seed database via simulator or first ingest (auto-registers sensor)
- **Deliverable:** Working database + connection
- **Dependency:** None (CRITICAL PATH START)

**Day 3 (24 Jan): Core API Endpoints**
- [x] POST `/api/v1/sensors/ingest` - accept telemetry
  - [x] Validation (Pydantic models)
  - [x] Insert into `readings` table
  - [x] Return 201 Created
- [x] GET `/api/v1/sensors` - list sensors
- [x] GET `/api/v1/sensors/{sensor_id}/readings` - latest readings (default 24h)
- [x] Health check `/health` (check DB connection)
- **Deliverable:** Working CRUD API
- **Dependency:** DB schema (Day 1-2) ✅

**Day 4 (25 Jan): WebSocket Realtime Stream** ⚠️ **BLOCKING FRONTEND**
- [x] Setup WebSocket endpoint `/ws/realtime`
- [x] Redis pub/sub for broadcasting
  - [x] Channel: `aquamine:updates`
- [x] On new reading → publish to Redis → broadcast to WS clients
- [x] Connection management (heartbeat, reconnect logic)
- **Deliverable:** Live data streaming
- **Dependency:** Core API (Day 3) ✅

**Day 5 (26 Jan): Alert Endpoints**
- [x] Alerts created internally from anomaly pipeline
- [x] GET `/api/v1/alerts` - list alerts (filter by severity, time range)
- [x] POST `/api/v1/alerts/{id}/acknowledge`
- [x] Manage notification recipients (admin UI optional)
  - [x] GET/POST `/api/v1/recipients`
  - [x] PATCH/DELETE `/api/v1/recipients/{recipient_id}`
- **Deliverable:** Alert management API
- **Dependency:** Core API (Day 3) ✅

**Day 6-7 (27-28 Jan): Integration with ML**
- [x] Integrate ML forecast endpoints
- [x] Integrate ML anomaly endpoints
- [x] Integrate CV endpoint
- [x] No Celery/RQ; use FastAPI background tasks + manual forecast trigger
- **Deliverable:** Full ML-integrated API
- **Dependency:** ML APIs ready (ML Day 4-5) ✅

#### Week 2 (29 Jan - 4 Feb)

**Day 8-9 (29-30 Jan): Aggregation Endpoints**
- [ ] GET `/api/v1/analytics/summary` - 24h summary (avg pH, alert count)
- [ ] GET `/api/v1/analytics/heatmap` - geospatial aggregation
- [ ] Add caching (Redis) for expensive queries
- **Deliverable:** Analytics API

**Day 10-11 (31 Jan - 1 Feb): Performance Optimization**
- [ ] Add database indexes (sensor_id, timestamp)
- [ ] Connection pooling (SQLAlchemy)
- [ ] Rate limiting (per IP)
- [ ] API response time monitoring (Prometheus/logs)
- **Deliverable:** Optimized API (p95 < 200ms)

**Day 12-14 (2-4 Feb): E2E Testing**
- [ ] Integration tests (pytest)
  - [ ] Test ingest → store → retrieve flow
  - [ ] Test WebSocket broadcast
  - [ ] Test alert creation
- [ ] Load testing (100 req/s for 1 min)
- **Deliverable:** Test coverage > 80%

#### Week 3 (5-7 Feb): Buffer + Deployment

**Day 15 (5 Feb): Deployment Prep**
- [ ] Docker image optimization
- [ ] Environment variable validation
- [ ] Database migration scripts tested
- **Deliverable:** Deployment-ready

**Day 16 (6 Feb): QA + Video Support**
- [ ] Fix critical bugs
- [ ] Support demo recording (show API responses)

---

### **IoT/Integration: Simulator + Data Contract + E2E**

#### Week 1 (22-28 Jan)

**Day 1-2 (22-23 Jan): Data Contract Definition** ⚠️ **BLOCKING TASK**
- [ ] Define telemetry payload schema:
  ```json
  {
    "sensor_id": "ESP32_AMD_001",
    "timestamp": "ISO8601",
    "location": {"lat": float, "lon": float},
    "readings": {
      "ph": float,
      "turbidity": float,
      "temperature": float
    },
    "metadata": {
      "battery_voltage": float,
      "signal_strength": int
    }
  }
  ```
- [ ] Location and metadata are optional; no conductivity field in payload
- [ ] Document in OpenAPI spec
- [ ] Share with Backend + Frontend teams
- **Deliverable:** Data contract doc
- **Dependency:** None (CRITICAL PATH)

**Day 3 (24 Jan): Realistic Simulator v1**
- [ ] Implement AMD progression model:
  - [ ] Normal: pH 6.5-7.2 (random walk)
  - [ ] Warning: pH gradual decline (7 → 5.5 over 3 days)
  - [ ] Critical: pH spike (7 → 4.2 in 6 hours)
- [ ] Add noise + outliers (realistic variance)
- [ ] Scenario-based turbidity bands (no conductivity in payload)
- [ ] Generate 3 sensors (Settling Pond, Drainage, Outlet)
- **Deliverable:** Working simulator script
- **Dependency:** Data contract (Day 1-2) ✅

**Day 4 (25 Jan): Integration with Backend**
- [x] POST telemetry to `/api/v1/sensors/ingest` (MQTT bridge)
- [x] Simulator inserts directly to DB for demos; real IoT should use ingest endpoint
- [x] Handle API errors (retry logic, exponential backoff)
- [x] Log successful ingestion
- **Deliverable:** Live data flowing to backend
- **Dependency:** Backend ingest endpoint (BE Day 3) ✅

**Day 5-6 (26-27 Jan): Demo Scenarios**
- [ ] **Scenario 1:** Normal operation (2 days of stable data)
- [ ] **Scenario 2:** Early warning (pH decline detected, alert triggered)
- [ ] **Scenario 3:** Critical event (rapid pH drop, multiple alerts)
- [ ] Add scenario switching (CLI flag: `--scenario=critical`)
- **Deliverable:** 3 pre-scripted demo flows
- **Dependency:** Alert API (BE Day 5) ✅

**Day 7 (28 Jan): Data Replay Feature**
- [ ] Record real simulation → save to CSV
- [ ] Replay mode (for consistent demo)
- [ ] Add timestamp offset (replay yesterday's data as "today")
- **Deliverable:** Deterministic demo playback

#### Week 2 (29 Jan - 4 Feb)

**Day 8-10 (29-31 Jan): E2E Integration Testing** ⚠️ **CRITICAL INTEGRATION**
- [ ] Test full pipeline: Simulator → API → DB → WebSocket → Frontend
- [ ] Verify data consistency (same sensor_id across stack)
- [ ] Test alert flow: anomaly → API → frontend notification
- [ ] Test forecast flow: request → ML → API → frontend chart
- [ ] Test CV flow: upload image → CV → API → frontend display
- **Deliverable:** E2E test suite passing
- **Dependency:** All core features (BE Day 8, FE Day 8, ML Day 8) ✅

**Day 11-12 (1-2 Feb): Weather Correlation (Optional)**
- [ ] Add synthetic rainfall data
- [ ] Correlate rainfall → pH spike (simulated runoff)
- [ ] Display weather context in dashboard
- **Deliverable:** Enhanced realism

**Day 13-14 (3-4 Feb): Stress Testing**
- [ ] Test 10 sensors @ 1 msg/sec (10 msg/sec total)
- [ ] Monitor backend resource usage
- [ ] Test WebSocket with 50 concurrent clients
- **Deliverable:** Performance baseline report

#### Week 3 (5-7 Feb): Buffer + Video

**Day 15-16 (5-6 Feb): Demo Rehearsal + QA**
- [ ] Run demo scenario 10 times (ensure consistency)
- [ ] Fix edge cases (reconnection, data gaps)
- [ ] Support video recording (trigger scenarios on cue)

---

### **Frontend: Dashboard + Charts + Map + Realtime UI**

#### Week 1 (22-28 Jan)

**Day 1 (22 Jan): UI Mockup Day** 🎨 **DEDICATED MOCKUP**
- [ ] Wireframe in Figma/Excalidraw:
  - [ ] Top: Header (logo, status indicators)
  - [ ] Left: Sensor list (cards with latest pH)
  - [ ] Center: Map (Leaflet) with sensor markers (color-coded)
  - [ ] Right: Alert panel (scrollable list)
  - [ ] Bottom: Time-series chart (pH last 24h)
- [ ] Define color scheme:
  - [ ] Green (pH 6-8): Normal
  - [ ] Yellow (pH 5-6): Warning
  - [ ] Red (pH < 5): Critical
- [ ] Component structure:
  ```
  App
  ├── Header
  ├── SensorList (left sidebar)
  ├── Map (center)
  ├── AlertPanel (right sidebar)
  └── TimeSeriesChart (bottom)
  ```
- **Deliverable:** Mockup screenshot + component tree
- **Dependency:** None (CREATIVE DAY)

**Day 2-3 (23-24 Jan): Project Setup + Static UI**
- [ ] Setup Vite + React + TypeScript
- [ ] Install dependencies:
  - [ ] Tailwind CSS
  - [ ] Recharts
  - [ ] Leaflet + react-leaflet
- [ ] Implement static components (no API calls yet):
  - [ ] Header (static logo)
  - [ ] SensorList (mock 3 sensors)
  - [ ] Map (show 3 markers at dummy coordinates)
  - [ ] AlertPanel (mock 2 alerts)
  - [ ] TimeSeriesChart (mock pH data)
- **Deliverable:** Static dashboard (localhost:3000)
- **Dependency:** Mockup (Day 1) ✅

**Day 4-5 (25-26 Jan): API Integration** ⚠️ **BLOCKING BY BACKEND**
- [ ] Setup API client (fetch wrapper or axios)
- [ ] GET `/api/v1/sensors` → populate SensorList
- [ ] GET `/api/v1/sensors/{id}/readings` → populate chart
- [ ] GET `/api/v1/alerts` → populate AlertPanel
- [ ] Add loading states + error handling
- **Deliverable:** Dashboard with real data
- **Dependency:** Backend API (BE Day 3) ✅

**Day 6 (27 Jan): WebSocket Realtime** ⚠️ **BLOCKING BY BACKEND**
- [ ] Connect to `ws://localhost:8000/ws/realtime`
- [ ] On message → update SensorList cards
- [ ] On message → append to TimeSeriesChart (sliding window)
- [ ] Add connection status indicator (green dot = connected)
- [ ] Handle reconnection (auto-retry)
- **Deliverable:** Live-updating dashboard
- **Dependency:** Backend WebSocket (BE Day 4) ✅

**Day 7 (28 Jan): Map Markers + Heatmap**
- [ ] Color-code markers by pH:
  - [ ] Green circle: pH 6-8
  - [ ] Yellow circle: pH 5-6
  - [ ] Red circle: pH < 5
- [ ] Add popup on marker click (sensor details)
- [ ] Add heatmap layer (optional: interpolate pH across area)
- **Deliverable:** Interactive map
- **Dependency:** API integration (Day 4-5) ✅

#### Week 2 (29 Jan - 4 Feb)

**Day 8-9 (29-30 Jan): Alert Management UI**
- [ ] Alert list with severity badges
- [ ] Click alert → show detail modal:
  - [ ] Timestamp
  - [ ] Sensor location (mini-map)
  - [ ] Severity + reason
  - [ ] Recommended action
- [ ] Acknowledge button (PATCH `/api/v1/alerts/{id}/acknowledge`)
- [ ] Add sound notification (optional)
- **Deliverable:** Alert interaction flow
- **Dependency:** Alert API (BE Day 5) ✅

**Day 10 (31 Jan): Forecast Visualization**
- [ ] Add forecast chart (next 7 days pH prediction)
- [ ] Fetch from `/api/v1/forecast` (timeline) or `/api/v1/forecast/{sensor_id}` (stored)
- [ ] Show confidence interval (shaded area)
- [ ] Highlight forecast crossing warning threshold
- **Deliverable:** Forecast UI
- **Dependency:** ML forecast API (ML1 Day 4-5) ✅

**Day 11 (1 Feb): CV Results Display**
- [ ] Add "CV Analysis" tab
- [ ] Upload image button → POST to `/api/v1/cv/analyze`
- [ ] Display result:
  - [ ] Original image
  - [ ] Detection overlay (bounding box)
  - [ ] Confidence score + severity
- **Deliverable:** CV demo UI
- **Dependency:** ML CV API (ML2 Day 4-5) ✅

**Day 12-13 (2-3 Feb): Polish + Responsiveness**
- [ ] Mobile-responsive layout (Tailwind breakpoints)
- [ ] Add loading skeletons
- [ ] Error states (API down → show fallback message)
- [ ] Dark mode toggle (optional)
- **Deliverable:** Production-quality UI

**Day 14 (4 Feb): Demo Mode**
- [ ] Add "Demo Mode" toggle (use replay data)
- [ ] Speed up time (1 min = 1 hour in simulation)
- [ ] Add demo script overlay (show what's happening)
- **Deliverable:** Video-ready demo

#### Week 3 (5-7 Feb): Buffer + Video

**Day 15 (5 Feb): Screenshot + Video Prep**
- [ ] Capture high-res screenshots for proposal
- [ ] Record demo walkthrough (narration script)
- [ ] Export demo data snapshots
- **Deliverable:** Video assets

**Day 16 (6 Feb): QA + Final Polish**
- [ ] Fix visual bugs (alignment, colors)
- [ ] Test on different browsers (Chrome, Firefox, Safari)
- [ ] Optimize bundle size (code splitting)

---

## Weekly Checkpoints

### Week 1 Checkpoint (28 Jan, 18:00)
**Goal:** MVP end-to-end working

| Component | Must Have |
|-----------|-----------|
| Backend | ✅ DB + API + WebSocket live |
| IoT | ✅ Simulator pushing data |
| Frontend | ✅ Live dashboard with real data |
| ML1 | ✅ Forecast + anomaly API working |
| ML2 | ✅ CV API working |
| Integration | ✅ Can demo: data flowing → dashboard updates → alerts trigger |

**Gate:** If this checkpoint fails, reprioritize to P1 tasks only.

---

### Week 2 Checkpoint (4 Feb, 18:00)
**Goal:** Demo-ready system

| Component | Must Have |
|-----------|-----------|
| Backend | ✅ All endpoints stable + tested |
| IoT | ✅ 3 demo scenarios working |
| Frontend | ✅ All features (alerts, forecast, CV) implemented |
| ML1 | ✅ Model robust to edge cases |
| ML2 | ✅ CV results consistent |
| Integration | ✅ E2E tests passing |
| **Video** | ✅ Draft 20-min video recorded |

**Gate:** If video draft not ready, dedicate 7 Feb to video only.

---

## Buffer Days Allocation (5-6 Feb)

**Priority order for bugfixes:**
1. **P0 (Blocker):** Cannot demo core flow
   - WebSocket disconnects
   - API crashes
   - Data not flowing
2. **P1 (Critical):** Demo looks broken
   - Charts not updating
   - Alerts not showing
   - Wrong colors/values
3. **P2 (Important):** Polish issues
   - Slow performance
   - UI alignment
   - Missing error messages
4. **P3 (Nice-to-have):** Skip if time pressure
   - Dark mode
   - Advanced features

---

## Final Submission Checklist (7 Feb)

- [ ] **Source Code**
  - [ ] All code committed to GitHub
  - [ ] README updated (setup instructions)
  - [ ] .env.example provided
  - [ ] Docker compose working
- [ ] **Demo Video** (Max 20 minutes)
  - [ ] Uploaded to YouTube (unlisted)
  - [ ] Covers: problem → solution → demo → impact
  - [ ] Shows live dashboard + data flow
  - [ ] Explains ML predictions
- [ ] **Submission Portal**
  - [ ] Video URL submitted
  - [ ] Source code link submitted
  - [ ] Team info confirmed

---

## Presentation Prep (8-9 Feb)

**Pitch Structure (10 minutes):**
1. **Problem (2 min):** AMD crisis in Indonesia (deaths, pollution, cost)
2. **Solution (3 min):** AquaMine architecture + demo
3. **Innovation (2 min):** TimeGPT + CV + realtime
4. **Impact (2 min):** Early warning 7 days, PROPER compliance, zero-harm
5. **Q&A Prep (1 min):** Transition to questions

**Demo Flow (embedded in pitch):**
1. Show normal operation (green sensors)
2. Trigger warning scenario (pH declines → yellow alert)
3. Show forecast prediction (chart shows 7-day trend)
4. Trigger critical scenario (red alert → notification)
5. Show CV detection (upload image → Yellow Boy detected)

**Q&A Preparation:**
- Q: "What's your model accuracy?" → A: "No validated real-world accuracy yet; synthetic checks only and TimeGPT zero-shot."
- Q: "How do you handle sensor failures?" → A: "We have anomaly detection that flags..."
- Q: "What about regulatory compliance?" → A: "Audit trail + PROPER integration..."

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Backend DB issues | Medium | High | Use managed PostgreSQL (Railway/Render), test early |
| ML API rate limits (TimeGPT) | Medium | Medium | Use mock forecast fallback + cache last prediction; enforce min data checks |
| WebSocket stability | High | High | Add reconnection logic, test with 50 clients by Day 10 |
| Integration bugs | High | Medium | Daily standups, E2E tests by Day 10 |
| Video quality issues | Medium | High | Start draft by Day 12, allocate 2 full days |
| Scope creep | High | Medium | Stick to P1 tasks, defer P2/P3 if behind schedule |

---

## Daily Standup Template

**Time:** 9:00 AM (15 minutes max)

**Format:**
1. Each person: "Yesterday I completed X, today I'm working on Y, blocked by Z"
2. Identify dependencies: "I need X from Y person by EOD"
3. Update checkpoint tracker

**Blocker escalation:**
- If blocker > 2 hours → pair programming session
- If blocker > 4 hours → reprioritize or cut scope

---

## Dependency Matrix (Quick Reference)

| Task | Depends On | Blocks |
|------|------------|--------|
| DB Schema (BE Day 1-2) | None | API Endpoints, All integration |
| Data Contract (IoT Day 1-2) | None | Simulator, API design |
| Mockup UI (FE Day 1) | None | Frontend implementation |
| API Endpoints (BE Day 3) | DB Schema | ML integration, FE integration |
| WebSocket (BE Day 4) | API Endpoints | FE realtime |
| ML APIs (ML Day 4-5) | API Endpoints | FE ML features |
| Simulator (IoT Day 3) | Data Contract | Integration testing |
| FE API Integration (FE Day 4-5) | API Endpoints | FE features |
| E2E Testing (IoT Day 8-10) | All core features | Demo readiness |
| Demo Scenarios (IoT Day 5-6) | Simulator, Alert API | Video recording |
| Video Draft (All Day 12) | Demo scenarios, All features | Final submission |

---

**Last Updated:** 24 January 2026  
**Maintained By:** Project Lead  
**Review Frequency:** Daily during standup
