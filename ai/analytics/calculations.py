from typing import Any
from ai.constants.compliance import (
    PH_MIN,
    PH_MAX,
    PH_TARGET,
    MOLAR_MASS_CaO,
    LIME_PRICE_AVG,
    REF_PP_22_2021,
    REF_KEPMEN_1827,
    ELECTRICITY_COST_PER_KWH,
    AVG_PUMP_POWER_KW,
    LABOR_COST_HOURLY,
    MAINTENANCE_COST_HOURLY,
    EXISTING_POND_CAPACITY_LPH,
    NEW_POND_CONSTRUCTION_COST_PER_M3,
    FINE_ADMINISTRATIVE_LIGHT,
    FINE_ADMINISTRATIVE_SEVERE,
    RESTORATION_COST_PER_M3,
    CRITICAL_PH_THRESHOLD,
    TURBIDITY_MAX_NTU
)

def calculate_empirical_treatment(current_pH: float, flow_rate_lph: float) -> dict[str, float]:
    """
    Calculate Acidity, CaO dosage, and detailed OpEx breakdown.
    """
    # 1. Chemical Cost (Variable Cost)
    if current_pH >= PH_TARGET:
        chem_cost = 0.0
        kg_ph = 0.0
        acidity = 0.0
    else:
        excess_h_dataset = (10**(-current_pH)) - (10**(-PH_TARGET))
        moles_h_excess_per_liter = excess_h_dataset
        moles_cao_required_per_liter = 0.5 * moles_h_excess_per_liter
        mass_cao_g_per_liter = moles_cao_required_per_liter * MOLAR_MASS_CaO
        total_mass_cao_g_ph = mass_cao_g_per_liter * flow_rate_lph
        kg_ph = total_mass_cao_g_ph / 1000.0
        chem_cost = kg_ph * LIME_PRICE_AVG
        acidity = excess_h_dataset

    # 2. Energy Cost (Fixed/Semi-variable)
    # Asumsi pompa bekerja 100% jika ada flow, atau proporsional? Kita asumsi 1 jam operasi penuh.
    energy_cost = AVG_PUMP_POWER_KW * ELECTRICITY_COST_PER_KWH

    # 3. Labor & Maintenance (Fixed Cost per hour)
    labor_cost = LABOR_COST_HOURLY
    maint_cost = MAINTENANCE_COST_HOURLY

    total_opex = chem_cost + energy_cost + labor_cost + maint_cost

    return {
        "acidity_deficit": acidity,
        "cao_dosage_kg_ph": kg_ph,
        "cost_chemical": chem_cost,
        "cost_energy": energy_cost,
        "cost_labor": labor_cost,
        "cost_maintenance": maint_cost,
        "total_estimated_cost_idr_ph": total_opex
    }

def evaluate_legal_risk(current_pH: float, turbidity: float, flow_rate_lph: float) -> dict[str, Any]:
    """
    Evaluate legal risks, potential fines, restoration costs, and infrastructure needs.
    """
    violations = []
    
    # --- 1. Parameter Violations ---
    is_compliant = True
    severity_level = "Compliant"
    
    if current_pH < PH_MIN or current_pH > PH_MAX:
        is_compliant = False
        violations.append({
            "parameter": "pH",
            "value": current_pH,
            "reference": REF_PP_22_2021,
            "clause": "Pasal 506-515 (Pencemaran Lingkungan)"
        })
        
    if turbidity > TURBIDITY_MAX_NTU: 
        is_compliant = False
        violations.append({
            "parameter": "Turbidity",
            "value": turbidity,
            "reference": REF_KEPMEN_1827,
            "clause": "Pengelolaan Teknis Miniral (Sedimentasi)"
        })

    # --- 2. Risk Calculation ---
    risk_fine = 0.0
    risk_restoration = 0.0
    risk_infrastructure = 0.0
    
    if not is_compliant:
        # Fine Calculation (Progressive)
        if current_pH < PH_MIN or current_pH > PH_MAX:
            if current_pH < CRITICAL_PH_THRESHOLD:
                risk_fine = (FINE_ADMINISTRATIVE_SEVERE / 24.0)  # Hourly portion
                severity_level = "Pidana Lingkungan (UU PPLH)"
            else:
                risk_fine = (FINE_ADMINISTRATIVE_LIGHT / 24.0)
                severity_level = "Administratif"
        elif turbidity > TURBIDITY_MAX_NTU:
            risk_fine = (FINE_ADMINISTRATIVE_LIGHT / 24.0)
            severity_level = "Administratif"
            
        # Restoration Cost (KLHK Standard)
        # Cost to restore the volume of water occurring in this hour
        flow_rate_m3_ph = flow_rate_lph / 1000.0
        risk_restoration = flow_rate_m3_ph * RESTORATION_COST_PER_M3

    # --- 3. Infrastructure Evaluation (CapEx Risk) ---
    # Jika Flow Rate > Kapasitas Kolam, perlu ekspansi (CapEx Risk)
    if flow_rate_lph > EXISTING_POND_CAPACITY_LPH:
        excess_flow_lph = flow_rate_lph - EXISTING_POND_CAPACITY_LPH
        excess_flow_m3_ph = excess_flow_lph / 1000.0
        # Asumsi retention time 2 jam untuk sedimentasi -> butuh volume 2x flow per jam
        needed_volume_m3 = excess_flow_m3_ph * 2 
        risk_infrastructure = needed_volume_m3 * NEW_POND_CONSTRUCTION_COST_PER_M3
        
        violations.append({
            "parameter": "Flow Rate",
            "value": flow_rate_lph,
            "reference": "Internal Capacity Check",
            "clause": f"Overcapacity: {excess_flow_lph} L/h"
        })
    
    total_risk = risk_fine + risk_restoration + risk_infrastructure
    
    return {
        "compliant": is_compliant,
        "violations": violations,
        "risk_fine_idr": risk_fine,
        "risk_restoration_idr": risk_restoration,
        "risk_infrastructure_capex_idr": risk_infrastructure,
        "total_risk_exposure_idr": total_risk,
        "legal_risk_status": severity_level
    }
def generate_financial_narrative(
    treatment_res: dict[str, Any],
    risk_res: dict[str, Any],
    current_ph: float,
    flow_rate_lph: float
) -> dict[str, str]:
    """
    Generate narrative explanations for financial breakdown.
    """
    # 1. OpEx Narrative
    dosage = treatment_res.get("cao_dosage_kg_ph", 0)
    
    opex_narrative = (
        f"Biaya pengolahan Rp {treatment_res.get('total_estimated_cost_idr_ph', 0):,.0f} per jam terdiri dari: "
        f"Konsumsi Kapur Tohor ({dosage:.2f} kg/jam) untuk menetralkan pH {current_ph:.2f}, "
        f"Biaya energi pompa & agitator, serta alokasi labor operator."
    )

    # 2. Risk Narrative
    restoration = risk_res.get("risk_restoration_idr", 0)
    risk_status = risk_res.get("legal_risk_status", "Aman")
    
    risk_narrative = (
        f"Total risiko Rp {risk_res.get('total_risk_exposure_idr', 0):,.0f} mencakup: "
        f"Estimasi Denda ({risk_status} PP 22/2021) dan "
        f"Biaya Restorasi Lingkungan Rp {restoration:,.0f} per m3 air limbah yang dibuang."
    )

    # 3. CapEx Narrative
    infra_cost = risk_res.get("risk_infrastructure_capex_idr", 0)
    if infra_cost > 0:
        excess_flow = flow_rate_lph - EXISTING_POND_CAPACITY_LPH
        capex_narrative = (
            f"Kapasitas Settling Pond terlampaui sebesar {excess_flow:,.0f} L/jam. "
            f"Diperlukan investasi darurat Rp {infra_cost:,.0f} untuk pembangunan kolam tampungan tambahan."
        )
    else:
        capex_narrative = (
            f"Kapasitas infrastruktur Settling Pond (120 m3/jam) masih memadai untuk debit saat ini ({flow_rate_lph/1000:.1f} m3/jam). "
            "Tidak ada belanja modal mendesak."
        )
        
    # 4. Summary Highlight
    net_savings = risk_res.get("total_risk_exposure_idr", 0) - treatment_res.get("total_estimated_cost_idr_ph", 0)
    summary_highlight = (
        f"Tindakan preventif sekarang menghemat biaya perusahaan sebesar Rp {net_savings:,.0f} dibandingkan potensi beban denda dan pemulihan lingkungan."
    )

    return {
        "opex": opex_narrative,
        "risk": risk_narrative,
        "capex": capex_narrative,
        "summary_highlight": summary_highlight
    }