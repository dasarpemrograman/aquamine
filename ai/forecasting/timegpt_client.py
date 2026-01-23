import os
from datetime import datetime, timedelta, timezone
from typing import Any

import pandas as pd
from sqlalchemy.orm import Session


class ForecastError(Exception):
    pass


class InsufficientDataError(Exception):
    pass


MINIMUM_DATA_POINTS = 168


class TimeGPTClient:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or os.getenv("NIXTLA_API_KEY")
        if not self.api_key:
            raise ValueError("NIXTLA_API_KEY not provided")

    def forecast(
        self,
        df: pd.DataFrame,
        horizon: int = 7,
        parameter: str = "ph",
        freq: str = "h",
    ) -> pd.DataFrame:
        unique_id = (
            f"sensor_{parameter}" if not df["unique_id"].str.contains(parameter).any() else None
        )
        if unique_id:
            filtered_df = df[df["unique_id"].str.contains(parameter)]
        else:
            filtered_df = df[df["unique_id"].str.contains(parameter)]

        if len(filtered_df) < MINIMUM_DATA_POINTS:
            raise InsufficientDataError(
                f"Need at least {MINIMUM_DATA_POINTS} data points, got {len(filtered_df)}"
            )

        horizon_hours = horizon * 24

        try:
            response = self._call_nixtla_api(filtered_df, horizon_hours, freq)
        except Exception as e:
            raise ForecastError(f"TimeGPT API error: {e}")

        return self._parse_response(response)

    def _call_nixtla_api(
        self,
        df: pd.DataFrame,
        horizon: int,
        freq: str,
    ) -> dict[str, Any]:
        try:
            from nixtla import NixtlaClient

            client = NixtlaClient(api_key=self.api_key)
            forecast_df = client.forecast(
                df=df,
                h=horizon,
                freq=freq,
                level=[90],
            )

            result = {
                "timestamp": forecast_df["ds"].tolist(),
                "value": forecast_df["TimeGPT"].tolist(),
            }

            if "TimeGPT-lo-90" in forecast_df.columns:
                result["lower"] = forecast_df["TimeGPT-lo-90"].tolist()
                result["upper"] = forecast_df["TimeGPT-hi-90"].tolist()

            return result

        except ImportError:
            raise ForecastError("nixtla package not installed. Run: pip install nixtla")

    def _parse_response(self, response: dict[str, Any]) -> pd.DataFrame:
        data = {
            "timestamp": pd.to_datetime(response["timestamp"]),
            "value": response["value"],
        }

        if "lower" in response:
            data["lower"] = response["lower"]
        if "upper" in response:
            data["upper"] = response["upper"]

        return pd.DataFrame(data)


def generate_all_forecasts(
    df: pd.DataFrame,
    api_key: str | None = None,
    horizon: int = 7,
) -> dict[str, pd.DataFrame]:
    client = TimeGPTClient(api_key=api_key)
    results = {}

    for parameter in ["ph", "turbidity", "temperature"]:
        try:
            forecast_df = client.forecast(df, horizon=horizon, parameter=parameter)
            results[parameter] = forecast_df
        except InsufficientDataError:
            continue
        except ForecastError as e:
            results[parameter] = pd.DataFrame()

    return results


def store_forecast(
    session: Session,
    sensor_id: int,
    parameter: str,
    forecast_df: pd.DataFrame,
    model_version: str = "timegpt-1",
) -> "Prediction":
    from db.models import Prediction

    forecast_values = []
    for _, row in forecast_df.iterrows():
        point = {
            "timestamp": row["timestamp"].isoformat()
            if hasattr(row["timestamp"], "isoformat")
            else str(row["timestamp"]),
            "value": float(row["value"]),
        }
        if "lower" in row and pd.notna(row["lower"]):
            point["lower"] = float(row["lower"])
        if "upper" in row and pd.notna(row["upper"]):
            point["upper"] = float(row["upper"])
        forecast_values.append(point)

    forecast_start = forecast_df["timestamp"].min()
    forecast_end = forecast_df["timestamp"].max()

    if hasattr(forecast_start, "to_pydatetime"):
        forecast_start = forecast_start.to_pydatetime()
    if hasattr(forecast_end, "to_pydatetime"):
        forecast_end = forecast_end.to_pydatetime()

    prediction = Prediction(
        sensor_id=sensor_id,
        parameter=parameter,
        forecast_start=forecast_start,
        forecast_end=forecast_end,
        forecast_values={"points": forecast_values},
        model_version=model_version,
    )

    session.add(prediction)
    session.commit()

    return prediction
