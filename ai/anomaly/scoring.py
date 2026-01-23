"""Severity scoring for water quality anomalies - SINGLE SOURCE OF TRUTH."""


def calculate_severity_score(parameter: str, value: float) -> tuple[int, str]:
    """
    Calculate severity score and state for a water quality parameter.

    Args:
        parameter: The parameter name (ph, turbidity, conductivity, temperature)
        value: The measured value

    Returns:
        Tuple of (score 0-10, state: 'normal'|'warning'|'critical')

    Score to state mapping:
        0-3 → normal
        4-6 → warning
        7-10 → critical
    """
    if parameter == "ph":
        if value >= 6.5:
            return (1, "normal")  # pH normal: 6.5-14
        elif value >= 5.5:
            return (5, "warning")  # pH warning: 5.5-6.5
        elif value >= 4.5:
            return (6, "warning")  # pH high-warning: 4.5-5.5 (score 6, still warning)
        else:
            return (9, "critical")  # pH critical: <4.5

    elif parameter == "turbidity":
        if value <= 25:
            return (1, "normal")  # Turbidity normal: 0-25 NTU
        elif value <= 50:
            return (5, "warning")  # Turbidity warning: 25-50 NTU
        else:
            return (6, "warning")  # Turbidity high: >50 NTU (score 6, warning only)

    elif parameter == "conductivity":
        if value <= 500:
            return (1, "normal")  # Conductivity normal: 0-500 µS/cm
        elif value <= 1000:
            return (5, "warning")  # Conductivity warning: 500-1000 µS/cm
        else:
            return (8, "critical")  # Conductivity critical: >1000 µS/cm

    elif parameter == "temperature":
        # Temperature is informational, doesn't trigger alerts
        return (0, "normal")

    return (0, "normal")
