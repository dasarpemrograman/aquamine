from typing import Final

# PP No. 22/2021: Baku Mutu Air Limbah
PH_MIN: Final[float] = 6.0
PH_MAX: Final[float] = 9.0
PH_TARGET: Final[float] = 7.0

# Stoichiometry Constants for CaO (Kapur Tohor)
MOLAR_MASS_CaO: Final[float] = 56.07  # g/mol
LIME_PRICE_MIN: Final[int] = 2500  # IDR/kg
LIME_PRICE_MAX: Final[int] = 3500  # IDR/kg
LIME_PRICE_AVG: Final[int] = 3000  # IDR/kg for estimation

# Legal References
REF_PP_22_2021: Final[str] = "PP No. 22/2021 Lampiran VI"
REF_KEPMEN_1827: Final[str] = "Kepmen ESDM No. 1827 K/30/MEM/2018"
REF_PP_78_2010: Final[str] = "PP No. 78/2010"

# Risk Calculation Constants
# Estimated remediation cost per m3 of polluted water (Rough estimate based on industrial standards)
REMEDIATION_COST_PER_M3: Final[int] = 15000  # IDR
# Administrative fine per day for non-compliance (Pasal 506-515 PP 22/2021 range varies, taking a base for calculation)
BASE_ADMINISTRATIVE_FINE_DAILY: Final[int] = 5000000

DEFAULT_FLOW_RATE_LPH: Final[float] = 100000.0

# Financial Constants (OpEx)
ELECTRICITY_COST_PER_KWH: Final[float] = 1444.70  # Tarif Listrik Industri (Golongan I-3/TM)
AVG_PUMP_POWER_KW: Final[float] = 15.0  # Asumsi pompa dosing & transfer 15 kW
LABOR_COST_HOURLY: Final[float] = 35000.0  # Upah operator + overhead safety
MAINTENANCE_COST_HOURLY: Final[float] = 15000.0  # Depresiasi & maintenance alat dosing

# Infrastructure Constants (CapEx)
EXISTING_POND_CAPACITY_LPH: Final[float] = 120000.0  # Kapasitas maksimal kolam saat ini (L/hour)
NEW_POND_CONSTRUCTION_COST_PER_M3: Final[float] = 250000.0  # Biaya land clearing, excavasi, lining

# Detailed Risk Constants
FINE_ADMINISTRATIVE_LIGHT: Final[float] = 5000000.0  # Denda ringan
FINE_ADMINISTRATIVE_SEVERE: Final[float] = 25000000.0  # Denda berat/progresif
RESTORATION_COST_PER_M3: Final[float] = 35000.0  # Biaya pemulihan ekosistem standar KLHK
CRITICAL_PH_THRESHOLD: Final[float] = 4.0  # Batas untuk eskalasi ke Pidana Lingkungan
