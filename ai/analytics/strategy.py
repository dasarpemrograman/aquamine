from dataclasses import dataclass, field
from typing import List, Optional, Literal
from datetime import datetime

# ============================================================================
# KONFIGURASI SISTEM — Parameter Operasional & Risiko (Dapat Dikonfigurasi)
# ============================================================================

@dataclass
class ParameterMetadata:
    """Metadata untuk transparansi parameter dalam UI"""
    label: str
    unit: str
    description: str
    source_note: str

@dataclass
class OperationalConfig:
    """
    Konfigurasi parameter operasional untuk perhitungan biaya treatment.
    Semua nilai bersifat site-specific dan dapat disesuaikan dengan kondisi lapangan.
    """
    harga_kapur_per_kg: float = 2500  # IDR
    konstanta_asiditas: float = 1.2  # Koefisien kalibrasi site-specific
    target_ph: float = 7.0
    flow_rate_default_m3_per_jam: float = 250.0
    
    # Metadata untuk UI
    metadata: dict[str, ParameterMetadata] = field(default_factory=lambda: {
        "harga_kapur_per_kg": ParameterMetadata(
            label="Harga Kapur per Kg",
            unit="IDR/kg",
            description="Harga kapur tohor (quicklime) untuk netralisasi",
            source_note="Estimasi harga pasar regional Q1 2026"
        ),
        "konstanta_asiditas": ParameterMetadata(
            label="Konstanta Asiditas",
            unit="dimensionless",
            description="Koefisien kalibrasi untuk perhitungan dosis kapur berdasarkan deviasi pH",
            source_note="Dikalibrasi berdasarkan karakteristik air tambang site-specific"
        ),
        "flow_rate_default_m3_per_jam": ParameterMetadata(
            label="Laju Alir Default",
            unit="m³/jam",
            description="Rata-rata debit air tambang yang masuk ke sistem treatment",
            source_note="Data historis operasional 12 bulan terakhir"
        ),
    })

@dataclass
class RiskConfig:
    """
    Konfigurasi parameter risiko untuk estimasi eksposur kepatuhan dan lingkungan.
    
    PENTING: Semua nilai finansial di sini adalah ESTIMASI PROKSI untuk analisis risiko,
    bukan nilai denda resmi atau biaya pasti. Nilai aktual bergantung pada kondisi
    lapangan, durasi pelanggaran, dan kebijakan regulator.
    """
    # Tarif risiko per menit pelanggaran (proksi)
    risk_rate_per_minute_idr: float = 1_000_000
    
    # Biaya remediasi lingkungan per m³ (estimasi teknis)
    biaya_remediasi_per_m3: float = 150_000
    
    # Estimasi denda baseline (proksi, bukan nilai resmi)
    estimasi_denda_baseline_idr: float = 500_000_000
    
    # Threshold untuk enforcement probability
    threshold_violation_minutes: float = 60  # Minimum durasi untuk risiko denda
    threshold_event_count: int = 3  # Minimum jumlah kejadian untuk risiko meningkat
    
    # Biaya perbaikan infrastruktur (worst-case scenario)
    biaya_perbaikan_holding_pond_idr: float = 750_000_000
    threshold_severe_ph: float = 4.0  # pH di bawah ini dianggap merusak infrastruktur
    threshold_severe_duration_minutes: float = 120  # Durasi minimum untuk risiko infrastruktur
    
    # Metadata untuk UI
    metadata: dict[str, ParameterMetadata] = field(default_factory=lambda: {
        "risk_rate_per_minute_idr": ParameterMetadata(
            label="Tarif Risiko per Menit",
            unit="IDR/menit",
            description="Estimasi eksposur risiko finansial per menit pelanggaran baku mutu",
            source_note="Proksi risiko berdasarkan analisis historis kasus serupa — bukan nilai denda resmi"
        ),
        "biaya_remediasi_per_m3": ParameterMetadata(
            label="Biaya Remediasi per m³",
            unit="IDR/m³",
            description="Estimasi biaya teknis pemulihan kualitas air per meter kubik",
            source_note="Asumsi teknis pemulihan sedimentasi/flokulasi berdasarkan praktik industri"
        ),
        "estimasi_denda_baseline_idr": ParameterMetadata(
            label="Estimasi Denda Baseline",
            unit="IDR",
            description="Estimasi denda administratif minimum (nilai proksi untuk analisis risiko)",
            source_note="Referensi PP 22/2021 — nilai aktual bervariasi berdasarkan kasus dan durasi"
        ),
        "threshold_violation_minutes": ParameterMetadata(
            label="Threshold Durasi Pelanggaran",
            unit="menit",
            description="Durasi minimum pelanggaran untuk memicu risiko enforcement",
            source_note="Asumsi konservatif berdasarkan waktu respons operasional"
        ),
    })

@dataclass
class RegulationLimits:
    """
    Batas baku mutu berdasarkan regulasi yang berlaku.
    """
    ph_min: float = 6.0
    ph_max: float = 9.0
    turbidity_max_ntu: float = 400.0
    
    # Referensi regulasi
    regulation_references: List[str] = field(default_factory=lambda: [
        "PP No. 22/2021 - Baku Mutu Air Limbah Pertambangan",
        "PP No. 78/2010 - Reklamasi & Pascatambang",
        "Kepmen ESDM No. 1827 K/30/MEM/2018 - Good Mining Practice",
        "UU No. 32/2009 - Perlindungan dan Pengelolaan Lingkungan Hidup"
    ])

# Konfigurasi default sistem
DEFAULT_OPERATIONAL_CONFIG = OperationalConfig()
DEFAULT_RISK_CONFIG = RiskConfig()
DEFAULT_REGULATION_LIMITS = RegulationLimits()

# ============================================================================
# DATA MODELS — Output Structures
# ============================================================================

RiskLevel = Literal["rendah", "sedang", "tinggi", "kritis"]

@dataclass
class ViolationStats:
    """Statistik pelanggaran berbasis durasi dan kejadian"""
    violation_minutes: float
    event_count: int
    max_severity_ph: Optional[float]
    min_severity_ph: Optional[float]
    affected_volume_m3: float

@dataclass
class FinancialImpact:
    """
    Output perhitungan finansial dan risiko.
    
    Membedakan antara:
    - Biaya aktual (treatment_cost_hourly)
    - Eksposur risiko (regulatory_fine_risk, ecosystem_remediation_risk, dll)
    """
    # Biaya aktual operasional
    treatment_cost_hourly: float
    
    # Eksposur risiko (estimasi proksi)
    regulatory_fine_risk: float
    ecosystem_remediation_risk: float
    holding_pond_cost_risk: float
    risk_exposure: float
    potential_savings: float
    
    # Rekomendasi operasional
    recommended_lime_dosage_kg_h: float
    estimated_recovery_time_minutes: float
    
    # Transparansi: violation stats (untuk window-based analysis)
    violation_stats: Optional[ViolationStats] = None
    
    # Transparansi: parameter yang digunakan dalam perhitungan (ringkas)
    risk_parameters_used: Optional[dict] = None

@dataclass
class RegulatoryMapping:
    is_compliant: bool
    status_label: str
    violated_regulations: List[str] = field(default_factory=list)
    action_plan: List[str] = field(default_factory=list)

# ============================================================================
# FUNGSI UTILITAS — Perhitungan Biaya dan Statistik Pelanggaran
# ============================================================================

def calculate_treatment_cost(
    current_ph: float,
    flow_rate: float,
    config: OperationalConfig = DEFAULT_OPERATIONAL_CONFIG
) -> tuple[float, float]:
    """
    Menghitung kebutuhan dosis kapur dan biaya operasional treatment per jam.
    
    Args:
        current_ph: Nilai pH aktual dari sensor
        flow_rate: Laju alir air tambang (m³/jam)
        config: Konfigurasi parameter operasional
    
    Returns:
        tuple (biaya_per_jam_idr, kebutuhan_kapur_kg_jam)
    
    Catatan:
        - Perhitungan berbasis deviasi pH dari target dan flow rate
        - KONSTANTA_ASIDITAS adalah koefisien kalibrasi site-specific yang
          menghubungkan deviasi pH dengan kebutuhan kapur aktual di lapangan
        - Jika pH sudah memenuhi baku mutu minimum, tidak ada biaya treatment
        - Jika pH > pH_max (terlalu basa), fungsi mengembalikan 0 (stop dosing)
    """
    if current_ph >= config.target_ph:
        # Jika pH sudah di atas target, tidak perlu dosing kapur
        return 0.0, 0.0
    
    # Hitung deviasi dari target
    ph_diff = config.target_ph - current_ph
    
    # Rumus: Dosis = (Target - Current) × Flow Rate × Konstanta Kalibrasi
    # Konstanta kalibrasi menghubungkan deviasi pH dengan kebutuhan kapur aktual
    kebutuhan_kapur_kg_jam = ph_diff * flow_rate * config.konstanta_asiditas
    biaya_per_jam_idr = kebutuhan_kapur_kg_jam * config.harga_kapur_per_kg
    
    return biaya_per_jam_idr, kebutuhan_kapur_kg_jam


def compute_violation_stats(
    timestamp_ph_series: List[tuple[datetime, float]],
    ph_min: float,
    ph_max: float,
    flow_rate: float
) -> ViolationStats:
    """
    Menghitung statistik pelanggaran berdasarkan time-series data pH.
    
    Fungsi ini menganalisis durasi pelanggaran, jumlah kejadian (events),
    dan volume air yang terdampak untuk perhitungan risiko yang lebih akurat.
    
    Args:
        timestamp_ph_series: List of (timestamp, pH_value) tuples, sorted by time
        ph_min: Batas bawah pH sesuai regulasi
        ph_max: Batas atas pH sesuai regulasi
        flow_rate: Laju alir air (m³/jam)
    
    Returns:
        ViolationStats dengan durasi, jumlah kejadian, severity, dan volume terdampak
    
    Logika Event Counting:
        - Event baru dihitung saat transisi dari "compliant" ke "violation"
        - Pelanggaran berkelanjutan dihitung sebagai satu event
    """
    if len(timestamp_ph_series) < 2:
        return ViolationStats(
            violation_minutes=0.0,
            event_count=0,
            max_severity_ph=None,
            min_severity_ph=None,
            affected_volume_m3=0.0
        )
    
    sorted_series = sorted(timestamp_ph_series, key=lambda x: x[0])
    
    total_violation_minutes = 0.0
    event_count = 0
    max_severity_ph = None
    min_severity_ph = None
    
    # Track state untuk event counting
    previous_was_violation = False
    
    for i in range(len(sorted_series) - 1):
        t0, ph0 = sorted_series[i]
        t1, ph1 = sorted_series[i + 1]
        
        # Ensure both timestamps have consistent timezone handling
        if t0.tzinfo is None or t1.tzinfo is None:
            raise ValueError("Timestamps must be timezone-aware for accurate duration calculations")
        
        dt_hours = (t1 - t0).total_seconds() / 3600.0
        if dt_hours <= 0:
            continue
        
        avg_ph = (ph0 + ph1) / 2.0
        is_violation = avg_ph < ph_min or avg_ph > ph_max
        
        if is_violation:
            # Accumulate violation duration
            total_violation_minutes += (dt_hours * 60.0)
            
            # Event counting: count transition from compliant to violation
            if not previous_was_violation:
                event_count += 1
            
            # Track severity (min/max pH during violations)
            if max_severity_ph is None or avg_ph > max_severity_ph:
                max_severity_ph = avg_ph
            if min_severity_ph is None or avg_ph < min_severity_ph:
                min_severity_ph = avg_ph
        
        previous_was_violation = is_violation
    
    # Calculate affected volume
    affected_volume_m3 = flow_rate * (total_violation_minutes / 60.0)
    
    return ViolationStats(
        violation_minutes=total_violation_minutes,
        event_count=event_count,
        max_severity_ph=max_severity_ph,
        min_severity_ph=min_severity_ph,
        affected_volume_m3=affected_volume_m3
    )


def calculate_enforcement_probability(
    severity_ph: float,
    violation_minutes: float,
    ph_min: float,
    risk_config: RiskConfig = DEFAULT_RISK_CONFIG
) -> float:
    """
    Menghitung probabilitas enforcement berdasarkan severity dan durasi pelanggaran.
    
    Model sederhana:
    - Jika durasi < threshold, probabilitas rendah (< 0.3)
    - Semakin parah deviasi pH, probabilitas meningkat
    - Semakin lama durasi, probabilitas meningkat
    
    Returns:
        float antara 0.0 - 1.0 (probabilitas enforcement)
    """
    if violation_minutes < risk_config.threshold_violation_minutes:
        return 0.1  # Probabilitas sangat rendah untuk pelanggaran singkat
    
    # Hitung severity score berbasis deviasi
    severity_deviation = abs(ph_min - severity_ph)
    
    # Base probability meningkat dengan durasi
    duration_factor = min(1.0, violation_minutes / (risk_config.threshold_violation_minutes * 3))
    
    # Severity factor meningkat dengan deviasi
    severity_factor = min(1.0, severity_deviation / 2.0)  # Normalisasi untuk deviasi hingga 2 unit pH
    
    # Kombinasi kedua faktor
    probability = 0.2 + (0.4 * duration_factor) + (0.4 * severity_factor)
    
    return min(1.0, probability)

# ============================================================================
# FUNGSI EVALUASI KEPATUHAN — Regulatory Compliance Logic
# ============================================================================

def evaluate_compliance_risk(
    current_ph: float,
    current_turbidity: Optional[float] = None,
    regulation_limits: RegulationLimits = DEFAULT_REGULATION_LIMITS
) -> RegulatoryMapping:
    """
    Mengevaluasi status kepatuhan terhadap regulasi lingkungan berdasarkan parameter kualitas air.
    
    Args:
        current_ph: Nilai pH aktual
        current_turbidity: Nilai turbidity aktual (NTU), optional
        regulation_limits: Batas regulasi yang berlaku
    
    Returns:
        RegulatoryMapping dengan status kepatuhan, pelanggaran, dan rencana tindakan
    
    Catatan:
        - Fungsi ini hanya mengevaluasi status kepatuhan real-time
        - Tidak menghitung risiko finansial (itu dilakukan oleh fungsi terpisah)
        - Memberikan rekomendasi aksi operasional
    """
    violations = []
    actions = []
    
    # Referensi regulasi
    ref_pp22 = regulation_limits.regulation_references[0]  # PP 22/2021
    ref_kepmen = regulation_limits.regulation_references[2]  # Kepmen 1827
    ref_uu32 = regulation_limits.regulation_references[3]  # UU 32/2009
    ref_pp78 = regulation_limits.regulation_references[1]  # PP 78/2010
    
    # Evaluasi pH
    if current_ph < regulation_limits.ph_min:
        violations.append(
            f"{ref_pp22} - pH {current_ph:.2f} di bawah baku mutu "
            f"({regulation_limits.ph_min}-{regulation_limits.ph_max})"
        )
        violations.append(
            f"{ref_kepmen} - Pengelolaan air asam tambang tidak efektif"
        )
        
        # Untuk kasus sangat parah (pH < 4.0), tambahkan referensi pidana
        if current_ph < DEFAULT_RISK_CONFIG.threshold_severe_ph:
            violations.append(
                f"{ref_uu32} - Potensi pidana lingkungan akibat kelalaian berat "
                f"(pH sangat asam: {current_ph:.2f})"
            )
        
        actions.append("Lakukan netralisasi segera dengan Kapur Tohor (Quick Lime).")
        actions.append("Periksa debit air masuk (inlet flow) untuk deteksi lonjakan asam.")
        actions.append("Verifikasi sistem dosing dan pompa injeksi kapur.")
    
    elif current_ph > regulation_limits.ph_max:
        violations.append(
            f"{ref_pp22} - pH {current_ph:.2f} di atas baku mutu "
            f"({regulation_limits.ph_min}-{regulation_limits.ph_max})"
        )
        actions.append("Kurangi atau stop dosis kapur injeksi.")
        actions.append("Periksa sistem kontrol dosing untuk menghindari overdosing.")
    
    # Evaluasi Turbidity (jika tersedia)
    if current_turbidity is not None and current_turbidity > regulation_limits.turbidity_max_ntu:
        violations.append(
            f"{ref_pp78} - Turbiditas {current_turbidity:.1f} NTU melebihi batas "
            f"({regulation_limits.turbidity_max_ntu} NTU) - Indikasi erosi & kegagalan pengendapan"
        )
        actions.append("Cek kapasitas kolam pengendap (settling pond).")
        actions.append("Pertimbangkan penambahan tawas/flokulan untuk mempercepat sedimentasi.")
        actions.append("Evaluasi sistem overflow dan inlet velocity.")
    
    # Tentukan status kepatuhan
    is_compliant = len(violations) == 0
    status_label = "Patuh (Compliant)" if is_compliant else "Terancam Sanksi & Denda"
    
    return RegulatoryMapping(
        is_compliant=is_compliant,
        status_label=status_label,
        violated_regulations=violations,
        action_plan=actions
    )

# ============================================================================
# ANALISIS DAMPAK STRATEGIS — Real-time & Window-based
# ============================================================================

def classify_risk_level(
    current_ph: float,
    ph_min: float,
    ph_max: float,
    threshold_severe: float = 4.0
) -> RiskLevel:
    """
    Mengklasifikasikan tingkat risiko berdasarkan nilai pH real-time.
    
    Klasifikasi:
    - rendah: pH dalam baku mutu
    - sedang: pH sedikit di luar baku mutu (deviasi < 1.0)
    - tinggi: pH jauh di luar baku mutu (deviasi 1.0-2.0)
    - kritis: pH sangat parah (deviasi > 2.0 atau < threshold_severe)
    """
    if ph_min <= current_ph <= ph_max:
        return "rendah"
    
    deviation = min(abs(current_ph - ph_min), abs(current_ph - ph_max))
    
    # Kasus sangat parah
    if current_ph < threshold_severe:
        return "kritis"
    
    if deviation >= 2.0:
        return "kritis"
    elif deviation >= 1.0:
        return "tinggi"
    else:
        return "sedang"


def analyze_strategic_impact(
    current_ph: float,
    flow_rate: Optional[float] = None,
    operational_config: OperationalConfig = DEFAULT_OPERATIONAL_CONFIG,
    risk_config: RiskConfig = DEFAULT_RISK_CONFIG,
    regulation_limits: RegulationLimits = DEFAULT_REGULATION_LIMITS
) -> FinancialImpact:
    """
    Analisis dampak strategis untuk REAL-TIME (single data point).
    
    Untuk real-time analysis:
    - Fokus pada rekomendasi dosis dan status kepatuhan saat ini
    - Estimasi recovery time (heuristic)
    - Risk level indicator (rendah/sedang/tinggi/kritis) bukan rupiah besar
    
    PENTING: Untuk estimasi risiko finansial yang akurat, gunakan 
    analyze_financial_history() dengan time-series data.
    
    Args:
        current_ph: Nilai pH aktual dari sensor
        flow_rate: Laju alir air (m³/jam), jika None gunakan default dari config
        operational_config: Konfigurasi parameter operasional
        risk_config: Konfigurasi parameter risiko
        regulation_limits: Batas regulasi
    
    Returns:
        FinancialImpact dengan fokus pada treatment cost dan risk indicators
    """
    if flow_rate is None:
        flow_rate = operational_config.flow_rate_default_m3_per_jam
    
    # 1. Hitung biaya treatment aktual
    treatment_cost, dosage = calculate_treatment_cost(current_ph, flow_rate, operational_config)
    
    # 2. Klasifikasi tingkat risiko
    risk_level = classify_risk_level(
        current_ph,
        regulation_limits.ph_min,
        regulation_limits.ph_max,
        risk_config.threshold_severe_ph
    )
    
    # 3. Estimasi recovery time (heuristic)
    recovery_time = 0.0
    if current_ph < regulation_limits.ph_min:
        deviation = regulation_limits.ph_min - current_ph
        BASE_RECOVERY_MINUTES = 45
        recovery_time = BASE_RECOVERY_MINUTES * (1 + deviation)
    
    # 4. Eksposur risiko (indikasi, bukan nilai pasti)
    # Untuk real-time, gunakan indikasi risiko berbasis severity, bukan durasi
    reg_risk = 0.0
    env_risk = 0.0
    pond_risk = 0.0
    
    if risk_level in ["tinggi", "kritis"]:
        # Indikasi risiko per jam (rate-based, bukan total)
        # Ini adalah indikator untuk menunjukkan urgensi, bukan denda pasti
        hourly_risk_rate = risk_config.risk_rate_per_minute_idr * 60  # per jam
        
        # Environmental remediation risk (per jam)
        env_risk = flow_rate * risk_config.biaya_remediasi_per_m3
        
        # Regulatory risk indicator (bukan denda pasti, hanya indikator)
        if risk_level == "kritis":
            # Indikasi bahwa risiko enforcement meningkat
            reg_risk = hourly_risk_rate * 2  # Doubled for critical level
            
            # Pond infrastructure risk hanya muncul untuk kasus kritis
            if current_ph < risk_config.threshold_severe_ph:
                # Ini adalah worst-case scenario indicator
                pond_risk = risk_config.biaya_perbaikan_holding_pond_idr / 24.0  # Amortisasi per jam
        else:
            reg_risk = hourly_risk_rate
    
    total_risk = reg_risk + env_risk + pond_risk
    potential_savings = max(0, total_risk - treatment_cost)
    
    # Parameter yang digunakan (untuk transparansi)
    risk_params = {
        "risk_level": risk_level,
        "is_real_time": True,
        "note": "Nilai risiko adalah indikator rate per jam, bukan total denda. "
                "Untuk estimasi risiko akurat, gunakan analisis historis dengan durasi pelanggaran."
    }
    
    return FinancialImpact(
        treatment_cost_hourly=treatment_cost,
        regulatory_fine_risk=reg_risk,
        ecosystem_remediation_risk=env_risk,
        holding_pond_cost_risk=pond_risk,
        risk_exposure=total_risk,
        potential_savings=potential_savings,
        recommended_lime_dosage_kg_h=dosage,
        estimated_recovery_time_minutes=recovery_time,
        violation_stats=None,  # Tidak ada untuk real-time
        risk_parameters_used=risk_params
    )


def analyze_financial_history(
    timestamp_ph_series: List[tuple[datetime, float]],
    total_duration_hours: float,
    flow_rate: Optional[float] = None,
    operational_config: OperationalConfig = DEFAULT_OPERATIONAL_CONFIG,
    risk_config: RiskConfig = DEFAULT_RISK_CONFIG,
    regulation_limits: RegulationLimits = DEFAULT_REGULATION_LIMITS
) -> FinancialImpact:
    """
    Analisis dampak finansial berbasis WINDOW TIME-SERIES (historis).
    
    Fungsi ini menghitung:
    1. Biaya treatment aktual (rata-rata per jam)
    2. Statistik pelanggaran (durasi, kejadian, volume terdampak)
    3. Eksposur risiko berbasis durasi dan severity (estimasi proksi)
    
    Output adalah RATE per jam, sehingga dapat dikombinasikan dengan durasi window
    untuk mendapatkan total estimasi.
    
    Args:
        timestamp_ph_series: List of (timestamp, pH_value) tuples
        total_duration_hours: Total durasi window yang dianalisis (jam)
        flow_rate: Laju alir air (m³/jam), jika None gunakan default
        operational_config: Konfigurasi parameter operasional
        risk_config: Konfigurasi parameter risiko
        regulation_limits: Batas regulasi
    
    Returns:
        FinancialImpact dengan violation stats dan parameter transparansi
    
    Catatan Penting:
        - Nilai dapat lebih tinggi pada window lebih pendek jika pelanggaran bersifat intens
        - Output per jam adalah RATE, bukan total
        - Risk exposure berbasis durasi pelanggaran aktual, bukan asumsi flat
    """
    if flow_rate is None:
        flow_rate = operational_config.flow_rate_default_m3_per_jam
    
    # Validasi input
    if len(timestamp_ph_series) < 2 or total_duration_hours <= 0:
        return FinancialImpact(
            treatment_cost_hourly=0.0,
            regulatory_fine_risk=0.0,
            ecosystem_remediation_risk=0.0,
            risk_exposure=0.0,
            potential_savings=0.0,
            recommended_lime_dosage_kg_h=0.0,
            estimated_recovery_time_minutes=0.0,
            holding_pond_cost_risk=0.0,
            violation_stats=ViolationStats(0.0, 0, None, None, 0.0),
            risk_parameters_used={"note": "Data tidak cukup untuk analisis"}
        )
    
    sorted_series = sorted(timestamp_ph_series, key=lambda x: x[0])
    
    # Validate all timestamps are timezone-aware
    for t, _ in sorted_series:
        if t.tzinfo is None:
            raise ValueError(f"Timestamp {t} is timezone-naive. All timestamps must be timezone-aware.")

    # 1. Hitung statistik pelanggaran
    violation_stats = compute_violation_stats(
        sorted_series,
        regulation_limits.ph_min,
        regulation_limits.ph_max,
        flow_rate
    )
    
    # 2. Hitung biaya treatment aktual
    total_treatment_cost = 0.0
    for i in range(len(sorted_series) - 1):
        t0, ph0 = sorted_series[i]
        t1, ph1 = sorted_series[i + 1]
        
        dt_hours = (t1 - t0).total_seconds() / 3600.0
        if dt_hours <= 0:
            continue
        
        avg_ph = (ph0 + ph1) / 2.0
        cost_rate, _ = calculate_treatment_cost(avg_ph, flow_rate, operational_config)
        total_treatment_cost += cost_rate * dt_hours
    
    avg_treatment_cost_per_hour = total_treatment_cost / total_duration_hours
    
    # 3. Hitung eksposur risiko berbasis durasi pelanggaran
    reg_risk_per_hour = 0.0
    env_risk_per_hour = 0.0
    pond_risk_per_hour = 0.0
    
    if violation_stats.violation_minutes > 0:
        # 3a. Regulatory risk - berbasis durasi dan enforcement probability
        if (violation_stats.violation_minutes >= risk_config.threshold_violation_minutes or
            violation_stats.event_count >= risk_config.threshold_event_count):
            
            # Hitung enforcement probability
            enforcement_prob = calculate_enforcement_probability(
                violation_stats.min_severity_ph or regulation_limits.ph_min,
                violation_stats.violation_minutes,
                regulation_limits.ph_min,
                risk_config
            )
            
            # Expected regulatory fine (probabilistic)
            expected_fine = enforcement_prob * risk_config.estimasi_denda_baseline_idr
            reg_risk_per_hour = expected_fine / total_duration_hours
        
        # 3b. Environmental remediation risk - berbasis volume terdampak
        env_risk_total = violation_stats.affected_volume_m3 * risk_config.biaya_remediasi_per_m3
        env_risk_per_hour = env_risk_total / total_duration_hours
        
        # 3c. Infrastructure risk - hanya untuk kasus severe dan durasi panjang
        if (violation_stats.min_severity_ph is not None and
            violation_stats.min_severity_ph < risk_config.threshold_severe_ph and
            violation_stats.violation_minutes >= risk_config.threshold_severe_duration_minutes):
            
            # Worst-case scenario: pond infrastructure damage
            pond_risk_per_hour = risk_config.biaya_perbaikan_holding_pond_idr / total_duration_hours
    
    risk_per_hour = reg_risk_per_hour + env_risk_per_hour + pond_risk_per_hour
    savings_per_hour = max(0, risk_per_hour - avg_treatment_cost_per_hour)
    
    # 4. Parameter yang digunakan (untuk transparansi UI)
    risk_params = {
        "tarif_risiko_per_menit": risk_config.risk_rate_per_minute_idr,
        "biaya_remediasi_per_m3": risk_config.biaya_remediasi_per_m3,
        "threshold_durasi_menit": risk_config.threshold_violation_minutes,
        "threshold_event_count": risk_config.threshold_event_count,
        "enforcement_probability_applied": violation_stats.violation_minutes >= risk_config.threshold_violation_minutes,
        "note": "Nilai adalah estimasi proksi berbasis durasi pelanggaran aktual. "
                "Nilai pada window lebih pendek dapat lebih tinggi jika pelanggaran intens."
    }
    
    return FinancialImpact(
        treatment_cost_hourly=avg_treatment_cost_per_hour,
        regulatory_fine_risk=reg_risk_per_hour,
        ecosystem_remediation_risk=env_risk_per_hour,
        holding_pond_cost_risk=pond_risk_per_hour,
        risk_exposure=risk_per_hour,
        potential_savings=savings_per_hour,
        recommended_lime_dosage_kg_h=0.0,  # Tidak relevan untuk analisis historis
        estimated_recovery_time_minutes=0.0,  # Tidak relevan untuk analisis historis
        violation_stats=violation_stats,
        risk_parameters_used=risk_params
    )

