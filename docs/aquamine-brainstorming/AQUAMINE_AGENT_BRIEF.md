# AquaMine AI - Agent Briefing Document

> **INSTRUKSI UNTUK AI AGENT**: Dokumen ini berisi semua konteks yang kamu butuhkan untuk memahami dan mengerjakan proyek AquaMine AI. Baca seluruh dokumen ini sebelum mulai bekerja. Jika ada yang tidak jelas, tanyakan sebelum mengerjakan.

---

## 1. RINGKASAN PROYEK

**Nama Proyek:** AquaMine AI  
**Tipe:** Hackathon Competition Entry  
**Kompetisi:** ISMC XV (Indonesian Students Mining Competition)  
**Subtheme:** Water Management and Recycling Innovation in Mining Industry  
**Deadline Proposal:** 14 Januari 2026  
**Deadline Final:** 7 Februari 2026  
**Presentasi:** 10 Februari 2026  

**One-liner:**
> AquaMine AI adalah sistem early warning berbasis AI untuk mendeteksi dan memprediksi Acid Mine Drainage (AMD) di area pertambangan Indonesia.

---

## 2. MASALAH YANG DISELESAIKAN

### Apa itu Acid Mine Drainage (AMD)?
AMD adalah air asam yang terbentuk ketika batuan sulfida di tambang terekspos udara dan air. Reaksi kimia menghasilkan:
- Air dengan pH sangat rendah (bisa sampai 2-3)
- Kandungan logam berat tinggi (Fe, Mn, Cu, Zn)
- "Yellow Boy" - endapan kuning-oranye iron hydroxide yang merupakan tanda visual AMD

### Dampak di Indonesia
- **2,000+ km sungai** tercemar AMD di Kalimantan dan Sulawesi
- **$13 miliar** kerusakan lingkungan dari Freeport saja
- **90%** pemegang izin tambang tidak bayar dana reklamasi
- **24 anak** tenggelam di bekas tambang terbengkalai sekitar Samarinda

### Masalah dengan Sistem Monitoring Saat Ini
```
CURRENT STATE (Reaktif):
1. Sampling manual setiap 1-2 minggu
2. Kirim ke lab
3. Tunggu hasil 24-48 jam
4. Terima hasil → AMD sudah terjadi → Kerusakan sudah terlanjur

PROBLEM: Ketika hasil lab keluar, ribuan kubik air asam sudah mencemari lingkungan
```

---

## 3. SOLUSI: AquaMine AI

### Konsep Utama
Mengubah pendekatan dari **REAKTIF** menjadi **PREDIKTIF**

```
AQUAMINE AI (Prediktif):
1. Sensor IoT monitoring real-time 24/7
2. Drone survey untuk visual coverage
3. AI mendeteksi anomaly + prediksi 7 hari ke depan
4. Alert dalam MENIT, bukan hari
5. Tim punya waktu untuk PREVENTIVE action
```

### Dual-Layer Detection System

```
┌─────────────────────────────────────────────────────────────┐
│                  AQUAMINE AI ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  LAYER 1: IoT SENSOR NETWORK (Primary)                     │
│  ─────────────────────────────────────                     │
│  • Sensor pH, turbidity, conductivity                       │
│  • Dipasang di checkpoint kritis (settling pond, outlet)   │
│  • Monitoring 24/7 real-time                                │
│  • Data setiap 30 detik - 5 menit                          │
│                                                             │
│  LAYER 2: DRONE + COMPUTER VISION (Secondary)              │
│  ─────────────────────────────────────────                 │
│  • Survey visual 1-2x per hari                              │
│  • Deteksi "Yellow Boy" (early visual indicator AMD)       │
│  • Coverage area yang tidak ada sensor                      │
│  • Identifikasi SUMBER kontaminasi                         │
│                                                             │
│  WHY BOTH?                                                  │
│  • IoT = depth (presisi tinggi, real-time)                 │
│  • Drone = breadth (coverage luas, visual verification)    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Komponen AI

| Komponen | Fungsi | Teknologi |
|----------|--------|-----------|
| **Anomaly Detection** | Alert ketika parameter abnormal | Rule-based + Isolation Forest |
| **Prediction Model** | Prediksi pH 7 hari ke depan | LSTM + XGBoost ensemble |
| **Computer Vision** | Deteksi Yellow Boy dari gambar | CNN (ResNet/MobileNet) |
| **GenAI Assistant** | Chatbot untuk query bahasa Indonesia | OpenAI API / Claude API |

---

## 4. OUTPUT SISTEM

Ketika sistem mendeteksi anomaly (misal: Yellow Boy atau pH drop), output yang dihasilkan:

### 4.1 Alert Notification
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🟡 PERINGATAN AMD - AquaMine AI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 Lokasi    : Drainage Channel Sektor 3
⏰ Waktu     : 02 Jan 2026, 06:32 WIB
🎯 Deteksi   : Yellow Boy / pH Drop
📊 Severity  : MEDIUM (Score: 6.5/10)

📈 Kondisi Saat Ini:
   • pH         : 5.8 (normal: 6.5-7.5)
   • Turbidity  : 45 NTU (normal: <25)

⚠️ Prediksi: pH akan turun ke 4.5 dalam 3-5 hari

✅ Rekomendasi:
   • Tambah lime dosing 200kg di Pond A
   • Inspeksi visual ke lokasi
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4.2 Dashboard Update
- Heatmap dengan zona hijau/kuning/merah
- Grafik trend pH (historis + prediksi)
- Lokasi anomaly di-highlight di peta

### 4.3 Recommended Actions
Berdasarkan severity score, sistem generate checklist aksi yang harus dilakukan.

### 4.4 Compliance Log
JSON log dengan cryptographic hashing (SHA-256) dan append-only log untuk audit trail (PROPER, ESG compliance).

---

## 5. ARSITEKTUR TEKNIS

```
┌─────────────────────────────────────────────────────────────┐
│                     DATA SOURCES                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  IoT Sensors │  │    Drone     │  │   Manual     │      │
│  │  (pH, turb,  │  │  (RGB/Multi  │  │   Input      │      │
│  │  conductivity)│  │   spectral)  │  │              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │              │
│         └────────────┬────┴─────────────────┘              │
│                      │                                      │
│                      ▼                                      │
├─────────────────────────────────────────────────────────────┤
│                   INGESTION LAYER                           │
├─────────────────────────────────────────────────────────────┤
│                 ┌───────────────┐                          │
│                 │  MQTT Broker  │                          │
│                 │  (Mosquitto)  │                          │
│                 └───────┬───────┘                          │
│                         │                                   │
│                         ▼                                   │
├─────────────────────────────────────────────────────────────┤
│                    BACKEND (FastAPI)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   API ENDPOINTS                      │   │
│  │  POST /api/v1/sensors/data    - Receive telemetry   │   │
│  │  GET  /api/v1/sensors/latest  - Get latest data     │   │
│  │  GET  /api/v1/predictions     - Get predictions     │   │
│  │  GET  /api/v1/alerts          - Get active alerts   │   │
│  │  POST /api/v1/chat            - GenAI query         │   │
│  │  WS   /ws/realtime            - WebSocket stream    │   │
│  └─────────────────────────────────────────────────────┘   │
│                         │                                   │
│         ┌───────────────┼───────────────┐                  │
│         ▼               ▼               ▼                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │  Anomaly   │  │ Prediction │  │  Computer  │           │
│  │ Detection  │  │   Model    │  │   Vision   │           │
│  │            │  │(LSTM+XGB)  │  │   (CNN)    │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│                         │                                   │
│                         ▼                                   │
│              ┌─────────────────────┐                       │
│              │  PostgreSQL + PostGIS│                       │
│              │  (Time-series data)  │                       │
│              └─────────────────────┘                       │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                     FRONTEND (React)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  • Real-time Dashboard (WebSocket)                   │   │
│  │  • Heatmap Visualization (Leaflet/Mapbox)           │   │
│  │  • Alert Management                                  │   │
│  │  • Prediction Charts (Recharts/Plotly)              │   │
│  │  • GenAI Chat Interface                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                   NOTIFICATION LAYER                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   WhatsApp   │  │    Email     │  │     SMS      │      │
│  │   (Twilio)   │  │  (SendGrid)  │  │   (Twilio)   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. TECH STACK

```yaml
Backend:
  Language: Python 3.11+
  Framework: FastAPI
  Database: PostgreSQL + PostGIS
  Message Broker: MQTT (Mosquitto) atau Redis Pub/Sub
  Task Queue: Celery (optional, untuk background jobs)

AI/ML:
  Anomaly Detection: scikit-learn (Isolation Forest)
  Prediction: TensorFlow/Keras (LSTM) + XGBoost
  Time-series Forecasting: TimeGPT (Nixtla)
  Computer Vision: OpenCV + PyTorch (jika pakai CNN)
  GenAI: OpenAI API atau Anthropic Claude API

Frontend:
  Framework: React 18+ dengan TypeScript
  Styling: Tailwind CSS
  Maps: Leaflet atau Mapbox GL
  Charts: Recharts atau Plotly
  Real-time: WebSocket (native atau Socket.io)

Infrastructure:
  Containerization: Docker + Docker Compose
  Deployment: Vercel (frontend) + Railway/Render (backend)
  
```

---

## 7. STATUS KODE SAAT INI

### Struktur Folder
```
aquamine_ai/
├── backend/
│   └── app/
│       └── main.py          # FastAPI backend (56 lines) - BASIC
└── data_generator/
    └── simulator.py         # Drone telemetry simulator (89 lines) - BASIC
```

### Yang Sudah Ada

**main.py:**
- ✅ FastAPI app skeleton
- ✅ Pydantic models: SensorMetrics, DroneTelemetry
- ✅ Endpoint POST /api/v1/sensors/data
- ✅ Endpoint GET /api/v1/sensors/latest
- ✅ Endpoint GET /api/v1/sensors/status

**simulator.py:**
- ✅ SyntheticDrone class
- ✅ Random pH drift simulation
- ✅ 3 lokasi dummy
- ✅ Basic status (normal/warning/critical)

### Yang BELUM Ada (Gap)

| Komponen | Priority | Status |
|----------|----------|--------|
| PostgreSQL connection | P1 | ❌ Tidak ada |
| WebSocket real-time | P1 | ❌ Tidak ada |
| Anomaly detection algorithm | P1 | ❌ Tidak ada |
| LSTM prediction model | P1 | ❌ Tidak ada |
| React dashboard | P1 | ❌ Tidak ada |
| Computer Vision module | P2 | ❌ Tidak ada |
| GenAI chatbot | P3 | ❌ Tidak ada |
| Alert notification (WA/Email) | P2 | ❌ Tidak ada |
| Authentication | P3 | ❌ Tidak ada |

---

## 8. TASK BREAKDOWN

### Phase 1: Core Backend (Priority 1)

```
TASK-BE-001: Setup PostgreSQL Database
├── Create database schema for sensor readings
├── TimescaleDB extension for time-series (optional)
├── Models: sensors, readings, alerts, predictions
└── SQLAlchemy ORM setup

TASK-BE-002: Improve Data Simulator
├── More realistic AMD progression model
├── Weather/rainfall correlation
├── Multi-parameter correlation (pH ↔ conductivity ↔ turbidity)
└── Configurable scenarios (normal, warning, critical)

TASK-BE-003: WebSocket Integration
├── Real-time data streaming endpoint
├── Broadcast new readings to connected clients
└── Connection management

TASK-BE-004: Anomaly Detection Service
├── Rule-based thresholds (pH < 5.5, turbidity > 50, etc.)
├── Isolation Forest untuk pattern anomaly
├── Severity scoring (1-10)
└── Alert generation logic
```

### Phase 2: AI/ML Models (Priority 1)

```
TASK-ML-001: LSTM Prediction Model
├── Data preprocessing pipeline
├── Model architecture (Encoder-Decoder LSTM)
├── Training dengan synthetic data
├── Prediction endpoint: /api/v1/predictions
└── Target: 85-90% accuracy untuk 7-day forecast

TASK-ML-002: XGBoost Ensemble (Optional)
├── Feature engineering
├── Combine dengan LSTM untuk hybrid approach
└── Improve prediction robustness
```

### Phase 3: Frontend Dashboard (Priority 1)

```
TASK-FE-001: Project Setup
├── React + TypeScript + Vite
├── Tailwind CSS
├── Folder structure
└── API client setup (axios/fetch)

TASK-FE-002: Main Dashboard
├── Heatmap dengan Leaflet
├── Sensor readings cards
├── Status indicators (green/yellow/red)
└── WebSocket connection untuk real-time updates

TASK-FE-003: Charts & Visualization
├── pH trend chart (historis + prediksi)
├── Multi-parameter comparison
├── Alert timeline
└── Recharts atau Plotly integration

TASK-FE-004: Alert Management
├── Alert list dengan severity badges
├── Alert detail modal
├── Recommended actions checklist
└── Acknowledge/resolve functionality
```

### Phase 4: Additional Features (Priority 2-3)

```
TASK-CV-001: Computer Vision Module
├── Yellow Boy detection dari gambar
├── Color analysis (RGB → AMD indicator)
├── Integration dengan drone imagery
└── Confidence scoring

TASK-AI-001: GenAI Chatbot
├── OpenAI/Claude API integration
├── RAG dengan water chemistry knowledge base
├── Bahasa Indonesia support
└── Chat UI di dashboard

TASK-NOTIF-001: Notification Service
├── WhatsApp via Twilio
├── Email via SendGrid
├── Configurable alert recipients
└── Notification templates
```

---

## 9. DEVELOPMENT GUIDELINES

### Code Style
```python
# Python: Follow PEP 8
# Use type hints
# Docstrings untuk semua functions

def calculate_severity_score(
    ph: float, 
    turbidity: float, 
    conductivity: float
) -> float:
    """
    Calculate AMD severity score from sensor readings.
    
    Args:
        ph: pH value (0-14)
        turbidity: Turbidity in NTU
        conductivity: Conductivity in µS/cm
    
    Returns:
        Severity score (0-10, higher = more severe)
    """
    # Implementation...
```

```typescript
// TypeScript: Strict mode
// Interface untuk semua data types
// React: Functional components + hooks

interface SensorReading {
  timestamp: string;
  droneId: string;
  locationId: string;
  metrics: {
    ph: number;
    turbidity: number;
    conductivity: number;
    temperature: number;
  };
  status: 'normal' | 'warning' | 'critical';
}
```

### API Response Format
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2026-01-02T06:32:15+07:00"
}
```

### Error Handling
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "pH value must be between 0 and 14"
  },
  "timestamp": "2026-01-02T06:32:15+07:00"
}
```

---

## 10. CONSTRAINTS & GUIDELINES

### Yang HARUS Diikuti

1. **Klaim Realistis**
   - Akurasi prediksi: **85-90%** (BUKAN 95%)
   - Horizon prediksi: **7 hari** (BUKAN 14 hari)
   - Drone: **semi-autonomous dengan operator** (BUKAN full autonomous 24/7)

2. **Tidak Pakai Blockchain**
   - Riset menunjukkan EU tidak mewajibkan
   - Pakai cryptographic hashing + append-only log saja

3. **Referensi Akademik**
   - Semua klaim teknis harus ada paper/sumber
   - Paper utama: ArXiv 2409.02128 (AMD prediction, NSE=0.99)

### Yang TIDAK BOLEH Dilakukan

- ❌ Klaim "95% accuracy" tanpa bukti
- ❌ Klaim "drone 24/7 autonomous"
- ❌ Klaim "cost savings 70%" tanpa studi
- ❌ Over-promise fitur yang tidak bisa di-demo
- ❌ Pakai blockchain (sudah diputuskan tidak pakai)

---

## 11. REFERENSI

### Paper Akademik

```
1. Abfertiawan, M.S., et al. (2024)
   "The Application of Artificial Neural Network Model to Predicting 
   the Acid Mine Drainage from Long-Term Lab Scale Kinetic Test"
   ArXiv: 2409.02128
   Akurasi: NSE = 0.99

2. Zhang, J., et al. (2024)
   "Critical operational parameters for metal removal efficiency 
   in acid mine drainage treated by constructed wetlands"
   GitHub: github.com/twelveminusone/ML-AMD-CWs
   Akurasi: R² > 0.8 (XGBoost)
```

### Open Source Resources

```
- OpenAcidMineDrainage: github.com/llamasearchai/OpenAcidMineDrainage
- DroneWQ (water quality): github.com/aewindle110/DroneWQ
- ArduPilot (drone): ardupilot.org
```

### Indonesian Context

```
- Reuters 2016: "Coal bust leaves Indonesia with abandoned mines"
- 90% pemegang izin tidak bayar dana reklamasi
- 24 anak tenggelam di bekas tambang Samarinda
```

---

## 12. TIMELINE

| Milestone | Deadline | Deliverable |
|-----------|----------|-------------|
| Proposal Final | 14 Jan 2026 | PDF 1000 kata |
| Backend MVP | 25 Jan 2026 | API + Database + Anomaly Detection |
| Frontend MVP | 30 Jan 2026 | Dashboard dengan heatmap |
| ML Model | 3 Feb 2026 | LSTM prediction working |
| Integration | 5 Feb 2026 | Full system connected |
| Demo Video | 7 Feb 2026 | 20-min YouTube video |
| Presentation | 10 Feb 2026 | 10-min pitch + 15-min Q&A |

---

## 13. QUICK START UNTUK DEVELOPMENT

### Setup Backend
```bash
cd aquamine_ai/backend
python -m venv venv
source venv/bin/activate  # atau venv\Scripts\activate di Windows
pip install fastapi uvicorn sqlalchemy psycopg2-binary pydantic
uvicorn app.main:app --reload
```

### Setup Database (Docker)
```bash
docker run -d \
  --name aquamine-postgres \
  -e POSTGRES_USER=aquamine \
  -e POSTGRES_PASSWORD=aquamine123 \
  -e POSTGRES_DB=aquamine_db \
  -p 5432:5432 \
  postgres:15
```

### Run Simulator
```bash
cd aquamine_ai/data_generator
python simulator.py
```

---

## 14. KONTAK & KOORDINASI

**Jika ada pertanyaan atau butuh klarifikasi:**
1. Baca ulang dokumen ini
2. Cek file `RESEARCH_COMPILATION.md` untuk riset lengkap
3. Tanyakan ke koordinator tim

**Files penting di repo:**
- `AQUAMINE_AGENT_BRIEF.md` - Dokumen ini
- `RESEARCH_COMPILATION.md` - Hasil riset lengkap
- `Innovation_Proposal_AquaMine_AI.md` - Draft proposal
- `Hackathon_Guidebook.md` - Aturan lomba

---

> **REMINDER UNTUK AI AGENT**: Setelah membaca dokumen ini, kamu seharusnya sudah paham:
> 1. AquaMine AI adalah early warning system untuk AMD di tambang
> 2. Pakai IoT sensor (primary) + drone CV (secondary)
> 3. Output: alert, dashboard, prediction, recommendations
> 4. Tech stack: FastAPI + PostgreSQL + React + LSTM/XGBoost
> 5. Status: baru ada skeleton, butuh development signifikan
> 6. Constraints: klaim realistis, no blockchain, ada referensi paper
>
> Jika sudah paham, kamu bisa langsung mulai mengerjakan task yang di-assign.
