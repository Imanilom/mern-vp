import mongoose from 'mongoose';

const ResilienceStateSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    participant_id: {
      type: String,
      default: '',
      index: true,
    },
    session_id: {
      type: String,
      default: () => `crs-sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      index: true,
    },
    // ── 1. ALL INPUT PARAMETERS (Cleveland 13 + CAD + Telemetry + Behavior) ──
    inputs: {
      has_heart_disease: { type: Boolean, default: false },
      dataset_source: { type: String, default: 'Cleveland / Statlog / Live Telemetry' },
      cleveland_13_features: {
        age: { type: Number, default: 55 },
        sex: { type: Number, default: 1 },
        cp: { type: Number, default: 0 },
        trestbps: { type: Number, default: 130 },
        chol: { type: Number, default: 240 },
        fbs: { type: Number, default: 0 },
        restecg: { type: Number, default: 0 },
        thalach: { type: Number, default: 116 },
        exang: { type: Number, default: 0 },
        oldpeak: { type: Number, default: 0.5 },
        slope: { type: Number, default: 1 },
        ca: { type: Number, default: 0 },
        thal: { type: Number, default: 1 },
      },
      telemetry_features: {
        mean_hr: { type: Number, default: 89.9 },
        min_hr: { type: Number, default: 56.9 },
        max_hr: { type: Number, default: 115.5 },
        rmssd: { type: Number, default: 40.5 },
        sdnn: { type: Number, default: 46.2 },
        mean_rr: { type: Number, default: 717 },
        dfa_alpha1: { type: Number, default: 1.10 },
        dfa_alpha2: { type: Number, default: 1.16 },
        lf: { type: Number, default: 1978 },
        hf: { type: Number, default: 672 },
        lf_hf_ratio: { type: Number, default: 2.94 },
        acc_motion: { type: Number, default: 0.08 },
      },
      behavioral_context: {
        activity_context: { type: String, default: 'Duduk / Istirahat' },
        stress_level: { type: String, default: 'Normal' },
        c_ctx: { type: Number, default: 0.85 },
        u_unexp: { type: Number, default: 0.12 },
        confirmed_by_patient: { type: Boolean, default: false },
      },
      fsm_thresholds: {
        tau_in: { type: Number, default: 1.86 },
        tau_out: { type: Number, default: 1.18 },
        tau_normal: { type: Number, default: 0.85 },
      },
    },

    // ── 2. Q1 - Q10 PHENOTYPING VECTOR Φ ──
    phenotype_q1_q10: {
      q1: {
        code: { type: String, default: 'Q1' },
        title: { type: String, default: 'Deviasi Anomali Transien vs Persisten' },
        score: { type: Number, default: 85 },
        unit: { type: String, default: 'episode/jam' },
        raw_val: { type: Number, default: 0.31 },
        formula: { type: String, default: 'f_dev = N_episodes / T_hours' },
        status: { type: String, default: 'Optimal' },
        interpretation: { type: String, default: 'Frekuensi deviasi otonomik dalam batas normal.' },
      },
      q2: {
        code: { type: String, default: 'Q2' },
        title: { type: String, default: 'Beban Area Under Curve (AUC) & Residual Deviation' },
        score: { type: Number, default: 78 },
        unit: { type: String, default: 'AUC unit' },
        raw_val: { type: Number, default: 1.82 },
        formula: { type: String, default: 'm_dev = ∫ (S(t) - tau_out) dt' },
        status: { type: String, default: 'Optimal' },
        interpretation: { type: String, default: 'Beban anomali residual teredam dengan baik di bawah tau_normal.' },
      },
      q3: {
        code: { type: String, default: 'Q3' },
        title: { type: String, default: 'Histeresis Vagal & Parasimpatis' },
        score: { type: Number, default: 80 },
        unit: { type: String, default: 'ms' },
        raw_val: { type: Number, default: 40.5 },
        status: { type: String, default: 'Optimal' },
      },
      q4: {
        code: { type: String, default: 'Q4' },
        title: { type: String, default: 'Fraktal Otonomik DFA α1 Integritas 1/f' },
        score: { type: Number, default: 82 },
        unit: { type: String, default: 'α1' },
        raw_val: { type: Number, default: 1.10 },
        status: { type: String, default: 'Optimal' },
      },
      q5: {
        code: { type: String, default: 'Q5' },
        title: { type: String, default: 'Coupling Kardiovaskular - Akselerometer ACC' },
        score: { type: Number, default: 75 },
        unit: { type: String, default: 'ratio' },
        raw_val: { type: Number, default: 0.88 },
        status: { type: String, default: 'Optimal' },
      },
      q6: {
        code: { type: String, default: 'Q6' },
        title: { type: String, default: 'Diurnal Circadian Dip & Sleep Recovery' },
        score: { type: Number, default: 88 },
        unit: { type: String, default: '%' },
        raw_val: { type: Number, default: 14.2 },
        status: { type: String, default: 'Optimal' },
      },
      q7: {
        code: { type: String, default: 'Q7' },
        title: { type: String, default: 'Asimetri Ejection - Filling Rate' },
        score: { type: Number, default: 70 },
        unit: { type: String, default: 'index' },
        raw_val: { type: Number, default: 0.76 },
        status: { type: String, default: 'Moderate' },
      },
      q8: {
        code: { type: String, default: 'Q8' },
        title: { type: String, default: 'Barorefleks Sensitivitas Estimator' },
        score: { type: Number, default: 84 },
        unit: { type: String, default: 'ms/mmHg' },
        raw_val: { type: Number, default: 12.4 },
        status: { type: String, default: 'Optimal' },
      },
      q9: {
        code: { type: String, default: 'Q9' },
        title: { type: String, default: 'Resiliensi Stres Kognitif / Emosional' },
        score: { type: Number, default: 79 },
        unit: { type: String, default: 'score' },
        raw_val: { type: Number, default: 79.0 },
        status: { type: String, default: 'Optimal' },
      },
      q10: {
        code: { type: String, default: 'Q10' },
        title: { type: String, default: 'Progresi Trajektori Kerentanan Longitudinal' },
        score: { type: Number, default: 86 },
        unit: { type: String, default: 'k_day' },
        raw_val: { type: Number, default: 0.85 },
        status: { type: String, default: 'Optimal' },
      },
      phenotype_vector_phi: {
        f_dev: { type: Number, default: 0.31 },
        m_dev: { type: Number, default: 1.82 },
        d_dev: { type: Number, default: 7.5 },
        v_rec: { type: Number, default: 0.65 },
        r_rel: { type: Number, default: 0 },
        c_ctx: { type: Number, default: 0.85 },
        delta_diurnal: { type: Number, default: 14.2 },
        k_day: { type: Number, default: 0.85 },
        u_unexp: { type: Number, default: 0.12 },
      },
      candidate_signature: { type: String, default: 'Efficient / Stable Regulation' },
    },

    // ── 3. 5-DIMENSION CRS CALCULATED OUTPUTS ──
    resilience_dimensions: {
      cv: {
        score: { type: Number, default: 80.0 }, // 0 - 100
        raw_risk_fraction: { type: Number, default: 0.20 },
        risk_level: { type: String, default: 'Low Risk' },
        band: { type: String, default: 'Low Risk (Score >= 70)' },
        cleveland_z: { type: Number, default: -1.24 },
        cleveland_prob: { type: Number, default: 0.22 },
        description: { type: String, default: 'Clinical Vulnerability: Skor kerentanan klinis deterministik berdasarkan CAD + 13 parameter Statlog/Cleveland.' },
      },
      cr: {
        score: { type: Number, default: 74.5 },
        hr_response: { type: Number, default: 58.6 },
        hrr_slope: { type: Number, default: 0.45 },
        description: { type: String, default: 'Cardiac Reserve: Cadangan inotropik & kronotropik jantung.' },
      },
      ar: {
        score: { type: Number, default: 78.2 },
        rmssd: { type: Number, default: 40.5 },
        sdnn: { type: Number, default: 46.2 },
        dfa_alpha1: { type: Number, default: 1.10 },
        description: { type: String, default: 'Autonomic Reserve: Kekuatan tonus vagal dan regulasi otonom parasimpatis.' },
      },
      rc: {
        score: { type: Number, default: 72.8 },
        ttr_minutes: { type: Number, default: 15.0 },
        recovery_slope: { type: Number, default: 0.65 },
        residual_deviation: { type: Number, default: 0.20 },
        relapse_count: { type: Number, default: 0 },
        description: { type: String, default: 'Recovery Capacity: Kecepatan dan kelancaran sistem kembali ke baseline.' },
      },
      rs: {
        score: { type: Number, default: 82.0 },
        fsm_stability: { type: Number, default: 0.88 },
        baseline_consistency: { type: Number, default: 0.85 },
        description: { type: String, default: 'Regulation Stability: Konsistensi homeostasis dan stabilitas FSM state.' },
      },
    },

    // ── 4. CRS GLOBAL STATE ESTIMATION ──
    crs_global: {
      score: { type: Number, default: 77.5 },
      tier: { type: String, default: 'Robust / Resilient' },
      color: { type: String, default: '#059669' },
      formula: { type: String, default: 'CRS = 0.20*CV + 0.20*CR + 0.25*AR + 0.20*RC + 0.15*RS' },
      vulnerability_band: { type: String, default: 'Low Risk' },
      relapse_risk_prob_percent: { type: Number, default: 8.5 },
      early_warning_level: { type: String, default: 'Normal Trajectory' },
    },

    // ── 5. XAI 4-QUADRANT EVIDENCE TRACE & RAG CITATIONS ──
    xai_evidence_trace: {
      supporting_features: [
        {
          feature: { type: String, default: '' },
          delta: { type: String, default: '' },
          clinical_meaning: { type: String, default: '' },
          weight: { type: String, default: '' },
        },
      ],
      contradicting_features: [
        {
          feature: { type: String, default: '' },
          actual_val: { type: String, default: '' },
          protective_meaning: { type: String, default: '' },
          weight: { type: String, default: '' },
        },
      ],
      trigger_context: {
        activity: { type: String, default: 'Duduk' },
        acc_magnitude: { type: String, default: '0.08 g (Resting)' },
        motion_artifact_filtered: { type: Boolean, default: true },
        causality_status: { type: String, default: 'Faktor Fisik Terkonfirmasi' },
      },
      uncertainty_estimation: {
        confidence_pct: { type: Number, default: 94 },
        epistemic_uncertainty: { type: Number, default: 0.06 },
        aleatoric_noise: { type: Number, default: 0.08 },
        residual_norm: { type: Number, default: 0.14 },
      },
      rag_evidence_citations: [
        {
          id: { type: String, default: '' },
          title: { type: String, default: '' },
          journal: { type: String, default: '' },
          year: { type: Number, default: 2023 },
          doi: { type: String, default: '' },
          relevance: { type: String, default: '' },
        },
      ],
    },

    // ── 6. AUDIT TRAIL, PROVENANCE & METADATA ──
    metadata: {
      model_version: { type: String, default: 'CAPAR-CRS-v2.2-DCS' },
      pipeline_name: { type: String, default: '7-Block State Estimation + Damped FSM + Evidence-Based DCS' },
      execution_time_ms: { type: Number, default: 28 },
      calculated_at: { type: Date, default: Date.now },
      ip_address: { type: String, default: '' },
      user_agent: { type: String, default: '' },
      evaluated_by: { type: String, default: 'System Algorithm' },
      doctor_reviewed: { type: Boolean, default: false },
      doctor_review_notes: { type: String, default: '' },
      doctor_validation_label: { type: String, default: 'Pending' },
    },
  },
  {
    timestamps: true,
  }
);

ResilienceStateSchema.index({ user_id: 1, createdAt: -1 });
ResilienceStateSchema.index({ participant_id: 1, createdAt: -1 });

export default mongoose.model('ResilienceState', ResilienceStateSchema);
