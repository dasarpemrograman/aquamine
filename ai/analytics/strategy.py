from dataclasses import dataclass, field
from typing import List, Optional

from datetime import datetime, timedelta

# Constants Business & Operation
HARGA_KAPUR_PER_KG = 2500  # IDR
KONSTANTA_ASIDITAS = 1.2
RATA_RATA_DEBIT_AIR_M3_JAM = 250.0  # Flow Rate
TARGET_PH = 7.0
RISK_RATE_PER_MINUTE_IDR = 1_000_000  # Placeholder configurable risk rate

# Regulatory Constants
REGULASI_CONFIG = {
    "PP_22_2021": {
        "nama": "PP No. 22/2021 (Baku Mutu Air Limbah)",
        "ph_min": 6.0,
        "ph_max": 9.0,
        "estimasi_denda_min": 500_000_000, # Base fine estimate (Estimasi Minimal Denda)
        "biaya_remediasi_m3": 150_000, # Asumsi teknis pemulihan per m3
    },
    "PP_78_2010": {
        "nama": "PP No. 78 Tahun 2010 (Reklamasi & Pascatambang)"
    },
    "KEPMEN_1827": {
        "nama": "Kepmen ESDM No. 1827 K/30/MEM/2018 (Good Mining Practice)"
    },
    "UU_32_2009": {
        "nama": "UU No. 32 Tahun 2009 (PPLH - Pasal 98-99)"
    }
}

@dataclass
class FinancialImpact:
    treatment_cost_hourly: float
    regulatory_fine_risk: float
    ecosystem_remediation_risk: float
    risk_exposure: float
    potential_savings: float
    recommended_lime_dosage_kg_h: float
    estimated_recovery_time_minutes: float
    holding_pond_cost_risk: float = 0.0

@dataclass
class RegulatoryMapping:
    is_compliant: bool
    status_label: str
    violated_regulations: List[str] = field(default_factory=list)
    action_plan: List[str] = field(default_factory=list)

def calculate_treatment_cost(current_ph: float, flow_rate: float = RATA_RATA_DEBIT_AIR_M3_JAM) -> tuple[float, float]:
    """
    Menghitung kebutuhan dosis kapur (kg/jam) dan estimasi biaya operasional.
    """
    if current_ph >= REGULASI_CONFIG["PP_22_2021"]["ph_min"]:
        return 0.0, 0.0

    ph_diff = TARGET_PH - current_ph
    # Rumus: (Target - Current) * Flow * Konstanta
    kebutuhan_kapur_kg_jam = ph_diff * flow_rate * KONSTANTA_ASIDITAS
    biaya_per_jam_idr = kebutuhan_kapur_kg_jam * HARGA_KAPUR_PER_KG
    
    return biaya_per_jam_idr, kebutuhan_kapur_kg_jam

def evaluate_compliance_risk(current_ph: float, current_turbidity: Optional[float] = None) -> RegulatoryMapping:
    violations = []
    actions = []
    ph_min = REGULASI_CONFIG["PP_22_2021"]["ph_min"]
    ph_max = REGULASI_CONFIG["PP_22_2021"]["ph_max"]
    
    # pH Logic
    if current_ph < ph_min:
        violations.append(f"{REGULASI_CONFIG['PP_22_2021']['nama']} - pH {current_ph} di bawah baku mutu ({ph_min}-{ph_max})")
        violations.append(f"{REGULASI_CONFIG['KEPMEN_1827']['nama']} - Pengelolaan air asam tambang tidak efektif")
        
        # Add UU 32/2009 for severe cases (Potensi Pidana)
        if current_ph < 4.0:
             violations.append(f"{REGULASI_CONFIG['UU_32_2009']['nama']} - Potensi Pidana Lingkungan akibat kelalaian berat")

        actions.append("Lakukan netralisasi segera dengan Kapur Tohor (Quick Lime).")
        actions.append("Periksa debit air masuk (inlet flow) untuk deteksi lonjakan asam.")
    elif current_ph > ph_max:
         violations.append(f"{REGULASI_CONFIG['PP_22_2021']['nama']} - pH {current_ph} di atas baku mutu")
         actions.append("Kurangi dosis kapur injeksi.")

    # Turbidity Logic
    if current_turbidity and current_turbidity > 400:
        violations.append(f"{REGULASI_CONFIG['PP_78_2010']['nama']} - Indikasi erosi & kegagalan pengendapan")
        actions.append("Cek kapasitas kolam pengendap (settling pond).")
        actions.append("Pertimbangkan penambahan tawas/flokulan.")

    is_compliant = len(violations) == 0
    # Status label in Indonesian
    status_label = "Patuh (Compliant)" if is_compliant else "Terancam Sanksi & Denda"

    return RegulatoryMapping(
        is_compliant=is_compliant,
        status_label=status_label,
        violated_regulations=violations,
        action_plan=actions
    )

def analyze_strategic_impact(current_ph: float, flow_rate: float = RATA_RATA_DEBIT_AIR_M3_JAM) -> FinancialImpact:
    treatment_cost, dosage = calculate_treatment_cost(current_ph, flow_rate)
    
    reg_risk = 0.0
    env_risk = 0.0
    pond_risk = 0.0
    recovery_time = 0.0
    
    ph_min = REGULASI_CONFIG["PP_22_2021"]["ph_min"]

    if current_ph < ph_min:
        # Risk Calculation
        # Denda Administratif (Estimasi Minimal berdasarkan PP 22/2021)
        # Diset sebagai batas bawah, karena denda asli bersifat akumulatif variatif.
        reg_risk = REGULASI_CONFIG["PP_22_2021"]["estimasi_denda_min"]
        
        # Biaya Pemulihan Lingkungan (Remediation) - Pasal 523
        # Asumsi: Volume tidak sesuai baku mutu per hari = flow_rate * 24 jam
        # Biaya = Volume * Rp 150.000 (biaya teknis pemulihan sedimentasi/air per m3)
        daily_volume_m3 = flow_rate * 24
        env_risk = daily_volume_m3 * REGULASI_CONFIG["PP_22_2021"]["biaya_remediasi_m3"]
        
        # Tambahan risiko infrastruktur jika parah (biaya perbaikan kolam)
        if current_ph < 4.0:
             pond_risk = 750_000_000 # Estimasi perbaikan kolam liner yang rusak akibat asam tinggi
        
        # Recovery Time Estimation
        deviation = ph_min - current_ph
        BASE_RECOVERY_MINUTES = 45 
        recovery_time = BASE_RECOVERY_MINUTES * (1 + deviation)

    total_risk = reg_risk + env_risk + pond_risk
    potential_savings = total_risk - treatment_cost

    return FinancialImpact(
        treatment_cost_hourly=treatment_cost,
        regulatory_fine_risk=reg_risk,
        ecosystem_remediation_risk=env_risk,
        holding_pond_cost_risk=pond_risk,
        risk_exposure=total_risk,
        potential_savings=max(0, potential_savings),
        recommended_lime_dosage_kg_h=dosage,
        estimated_recovery_time_minutes=recovery_time
    )

def analyze_financial_history(
    timestamp_ph_series: List[tuple[datetime, float]],
    total_duration_hours: float
) -> FinancialImpact:
    total_treatment_cost = 0.0
    total_violation_minutes = 0.0
    
    if len(timestamp_ph_series) < 2 or total_duration_hours <= 0:
        return FinancialImpact(
            treatment_cost_hourly=0.0,
            regulatory_fine_risk=0.0,
            ecosystem_remediation_risk=0.0,
            risk_exposure=0.0,
            potential_savings=0.0,
            recommended_lime_dosage_kg_h=0.0,
            estimated_recovery_time_minutes=0.0,
            holding_pond_cost_risk=0.0
        )
    
    sorted_series = sorted(timestamp_ph_series, key=lambda x: x[0])
    ph_min = REGULASI_CONFIG["PP_22_2021"]["ph_min"]
    ph_max = REGULASI_CONFIG["PP_22_2021"]["ph_max"]

    for i in range(len(sorted_series) - 1):
        t0, ph0 = sorted_series[i]
        t1, ph1 = sorted_series[i+1]
        
        # Simple timezone naive/aware check or conversion could be needed in prod
        # Here assuming consistent objects from DB
        
        dt_hours = (t1 - t0).total_seconds() / 3600.0
        if dt_hours <= 0:
            continue
            
        avg_ph = (ph0 + ph1) / 2.0
        
        # 1. Treatment Cost
        cost_rate, _ = calculate_treatment_cost(avg_ph)
        total_treatment_cost += cost_rate * dt_hours
        
        # 2. Risk (Violation Duration)
        if avg_ph < ph_min or avg_ph > ph_max:
            total_violation_minutes += (dt_hours * 60.0)

    avg_treatment_cost_per_hour = total_treatment_cost / total_duration_hours
    risk_per_hour = (total_violation_minutes * RISK_RATE_PER_MINUTE_IDR) / total_duration_hours
    savings_per_hour = max(0, risk_per_hour - avg_treatment_cost_per_hour)

    return FinancialImpact(
        treatment_cost_hourly=avg_treatment_cost_per_hour,
        regulatory_fine_risk=0.0,
        ecosystem_remediation_risk=0.0,
        risk_exposure=risk_per_hour,
        potential_savings=savings_per_hour,
        recommended_lime_dosage_kg_h=0.0,
        estimated_recovery_time_minutes=0.0,
        holding_pond_cost_risk=0.0
    )
