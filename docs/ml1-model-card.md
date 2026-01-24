# ML1 Model Card: Water Quality Forecasting and Anomaly Detection

## Model Overview
ML1 combines TimeGPT forecasting (Nixtla API) with threshold-based anomaly detection to provide early warning signals for water quality drift. TimeGPT produces 7-day forecasts per sensor and parameter, while anomalies are triggered when measurements cross predefined safety thresholds for pH, turbidity, and temperature.

## Architecture
- Ingest sensor telemetry into a time-series dataframe with `unique_id`, `ds` (timestamp), and `y` (value).
- Call TimeGPT to generate 168-hour forecasts with 90% prediction intervals.
- Evaluate incoming readings against static thresholds to classify warning vs. critical anomalies.
- Derive confidence heuristics from interval widths to summarize forecast certainty.

## Inputs
- Historical time series for each sensor and parameter (pH, turbidity, temperature).
- Format: columns `unique_id`, `ds`, `y` per series; `unique_id` uses `sensor_id_parameter` naming.
- Minimum history: 7 days (168 points) per series recommended.
- Frequency: hourly ideal; lower frequencies supported but reduce forecast fidelity.

## Outputs
- Forecasts: 7-day horizon (168 points) per series with point estimates plus lower/upper bounds.
- Confidence intervals: 90% level from TimeGPT (`TimeGPT-lo-90`, `TimeGPT-hi-90`).
- Anomaly events: parameter, value, timestamp, severity score (warning=5, critical=10), detection method.

## Thresholds
| Parameter | Warning | Critical | Direction |
| --- | --- | --- | --- |
| pH | 5.5 | 4.5 | Below threshold |
| Turbidity | 50 | 100 | Above threshold |
| Temperature | 35 | 40 | Above threshold |

## Data Requirements
- Completeness: missing values should be imputed or filtered; large gaps reduce forecast quality.
- Sensors: 3+ sensors are recommended for stable monitoring across water bodies.
- Units: pH (unitless), turbidity (NTU), temperature (C).

## Confidence and Uncertainty
- Confidence is computed as a heuristic derived from prediction interval width: `1 - (upper - lower) / value`.
- If bounds are unavailable or value is near zero, a fixed fallback confidence of 0.7 is used.
- This score is intended as a comparative signal, not a calibrated probability.

## Limitations
- Requires the TimeGPT API (Nixtla); forecasts degrade to mock outputs if the API key is missing.
- No offline ML fallback model (XGBoost removed); anomaly detection is threshold-only.
- Evaluation is limited to synthetic datasets and sanity checks; no production accuracy claims.

## Evaluation Methodology
- Sanity checks on synthetic time-series data to validate forecast plumbing and anomaly triggers.
- Visual inspections of forecast smoothness and alert behavior for threshold crossings.
- No ground-truth labels or production benchmarks used at this stage.

## Model Versioning
- Forecasting: `timegpt-1` (Nixtla TimeGPT API).
- Thresholds: `v1.0` (static thresholds defined in code).

## Future Improvements
- Add a locally hosted forecasting fallback for offline operation.
- Introduce ML-based anomaly detection to complement threshold alerts.
- Calibrate confidence using real-world validation data once available.
