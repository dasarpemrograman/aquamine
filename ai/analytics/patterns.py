from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from math import sqrt
from typing import Iterable, Optional, Sequence, TypeVar


@dataclass(frozen=True)
class ComplianceStandardValues:
    source: str
    ph_min: float
    ph_max: float
    turbidity_max_ntu: float
    temperature_max_c: float


def _to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _epoch_seconds(dt: datetime) -> float:
    return _to_utc(dt).timestamp()


T = TypeVar("T")


def evenly_spaced_sample(items: Sequence[T], max_items: int) -> list[T]:
    if max_items <= 0:
        return []
    if len(items) <= max_items:
        return list(items)
    if max_items == 1:
        return [items[-1]]
    step = (len(items) - 1) / float(max_items - 1)
    sampled: list[T] = []
    for i in range(max_items):
        idx = int(round(i * step))
        if idx < 0:
            idx = 0
        if idx >= len(items):
            idx = len(items) - 1
        sampled.append(items[idx])
    return sampled


def slope_per_hour(
    points: Sequence[tuple[datetime, float]], min_points: int = 6
) -> Optional[float]:
    """Compute slope (units/hour) for a time series.

    Uses least-squares regression when we have enough points; otherwise falls back to
    first/last delta.
    """

    if len(points) < 2:
        return None

    pts = sorted(points, key=lambda p: p[0])
    t0, y0 = pts[0]
    t1, y1 = pts[-1]
    dt_hours = (_epoch_seconds(t1) - _epoch_seconds(t0)) / 3600.0
    if dt_hours <= 0:
        return None

    if len(pts) < max(3, min_points):
        return (y1 - y0) / dt_hours

    xs = [(_epoch_seconds(t) - _epoch_seconds(t0)) / 3600.0 for t, _ in pts]
    ys = [v for _, v in pts]

    x_mean = sum(xs) / len(xs)
    y_mean = sum(ys) / len(ys)
    num = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    den = sum((x - x_mean) ** 2 for x in xs)
    if den == 0:
        return (y1 - y0) / dt_hours
    return num / den


def pearson_correlation(
    xs: Sequence[float], ys: Sequence[float], min_points: int = 20
) -> Optional[float]:
    if len(xs) != len(ys):
        raise ValueError("xs and ys must have same length")
    if len(xs) < min_points:
        return None

    x_mean = sum(xs) / len(xs)
    y_mean = sum(ys) / len(ys)

    num = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, ys))
    den_x = sum((x - x_mean) ** 2 for x in xs)
    den_y = sum((y - y_mean) ** 2 for y in ys)
    den = sqrt(den_x * den_y)
    if den == 0:
        return None
    return num / den


def compliance_ph(value: float, standard: ComplianceStandardValues) -> bool:
    return standard.ph_min <= value <= standard.ph_max


def compliance_turbidity(value: float, standard: ComplianceStandardValues) -> bool:
    return value <= standard.turbidity_max_ntu


def compliance_temperature(value: float, standard: ComplianceStandardValues) -> bool:
    return value <= standard.temperature_max_c


def compliance_percent(
    values: Iterable[Optional[float]], predicate
) -> tuple[int, int, Optional[float]]:
    samples = 0
    violations = 0
    for v in values:
        if v is None:
            continue
        samples += 1
        if not predicate(v):
            violations += 1
    if samples == 0:
        return 0, 0, None
    pct = 100.0 * (samples - violations) / float(samples)
    return samples, violations, pct
