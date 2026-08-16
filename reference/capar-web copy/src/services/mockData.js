// CAPAR Predictive State System - Mock Data & Domain Engine

export const INITIAL_ROLE = {
  name: "Dr. Rina S.",
  role: "Reviewer",
  email: "rina.s@capar-research.id",
  avatar: "RS",
  lastLogin: "2026-08-08 14:30 WIB",
  permissions: ["view_cohort", "review_episode", "simulate_model", "export_data", "view_audit"]
};

export const COHORTS = [
  { id: "pilot-01", label: "Cohort: Pilot-01 (Participant N=28)" },
  { id: "general-02", label: "Cohort: General-02 (Participant N=45)" },
  { id: "clinical-trial-a", label: "Cohort: Clinical Trial A (Participant N=15)" },
];

export const PARTICIPANTS = [
  {
    id: "P-014",
    name: "Participant P-014",
    device: "Polar H10 (A8:B9:3C)",
    battery: 76,
    clockDrift: "+0.4 s",
    context: "sitting",
    contextConfidence: 0.91,
    evidenceState: "EVALUABLE",
    physiologicalState: "PERSISTENT_DEVIATION",
    anomalyScore: 2.64,
    hrMean: 88,
    rmssd: 18.4,
    dfaAlpha1: 0.62,
    tauIn: 1.86,
    tauOut: 1.18,
    tauNormal: 0.80,
    lastUpdate: "13:06:42",
    baselineMaturity: "READY (21 days)",
    activeEpisodeId: "EP-240530-02",
    pinned: true,
  },
  {
    id: "P-027",
    name: "Participant P-027",
    device: "Polar H10 (F1:02:88)",
    battery: 92,
    clockDrift: "-0.1 s",
    context: "working",
    contextConfidence: 0.88,
    evidenceState: "EVALUABLE",
    physiologicalState: "RECOVERY",
    anomalyScore: 0.94,
    hrMean: 74,
    rmssd: 32.1,
    dfaAlpha1: 0.95,
    tauIn: 1.75,
    tauOut: 1.10,
    tauNormal: 0.75,
    lastUpdate: "13:06:39",
    baselineMaturity: "READY (18 days)",
    activeEpisodeId: "EP-260808-07",
    pinned: true,
  },
  {
    id: "P-031",
    name: "Participant P-031",
    device: "Polar H10 (CC:44:11)",
    battery: 45,
    clockDrift: "+1.2 s",
    context: "walking",
    contextConfidence: 0.42,
    evidenceState: "QUALITY_WARNING",
    physiologicalState: "UNRESOLVED",
    anomalyScore: null,
    hrMean: 104,
    rmssd: null,
    dfaAlpha1: null,
    tauIn: 1.80,
    tauOut: 1.15,
    tauNormal: 0.70,
    lastUpdate: "13:06:35",
    baselineMaturity: "READY (30 days)",
    activeEpisodeId: "EP-260808-08",
    pinned: false,
  },
  {
    id: "P-042",
    name: "Participant P-042",
    device: "Polar H10 (12:FE:99)",
    battery: 88,
    clockDrift: "0.0 s",
    context: "resting",
    contextConfidence: 0.95,
    evidenceState: "INSUFFICIENT_BASELINE",
    physiologicalState: "BASELINE_COMPATIBLE",
    anomalyScore: 0.41,
    hrMean: 62,
    rmssd: 48.0,
    dfaAlpha1: 1.12,
    tauIn: 1.90,
    tauOut: 1.20,
    tauNormal: 0.85,
    lastUpdate: "13:06:31",
    baselineMaturity: "PROVISIONAL (4 days)",
    activeEpisodeId: null,
    pinned: false,
  },
  {
    id: "P-056",
    name: "Participant P-056",
    device: "Polar H10 (90:AA:55)",
    battery: 64,
    clockDrift: "+0.8 s",
    context: "sitting",
    contextConfidence: 0.96,
    evidenceState: "EVALUABLE",
    physiologicalState: "BASELINE_COMPATIBLE",
    anomalyScore: 0.31,
    hrMean: 68,
    rmssd: 42.5,
    dfaAlpha1: 1.05,
    tauIn: 1.86,
    tauOut: 1.18,
    tauNormal: 0.80,
    lastUpdate: "13:06:28",
    baselineMaturity: "READY (25 days)",
    activeEpisodeId: null,
    pinned: false,
  },
  {
    id: "P-088",
    name: "Participant P-088",
    device: "Polar H10 (33:77:BE)",
    battery: 15,
    clockDrift: "+3.4 s",
    context: "sitting",
    contextConfidence: 0.60,
    evidenceState: "UNCERTAIN_CONTEXT",
    physiologicalState: "DEVIATION_CANDIDATE",
    anomalyScore: 1.68,
    hrMean: 82,
    rmssd: 26.0,
    dfaAlpha1: 0.78,
    tauIn: 1.82,
    tauOut: 1.12,
    tauNormal: 0.78,
    lastUpdate: "13:04:10",
    baselineMaturity: "READY (14 days)",
    activeEpisodeId: null,
    pinned: false,
  }
];

export const EPISODES = [
  {
    id: "EP-240530-02",
    participantId: "P-014",
    context: "duduk-berdiri acak",
    onset: "08:24",
    confirmedTime: "08:26",
    recoveryStart: "08:56",
    recoveredTime: "09:02",
    durationMinutes: 38,
    peakScore: 2.87,
    auc: 141.8,
    severity: "High",
    status: "RESOLVED",
    reviewStatus: "Confirmed",
    reviewerNote: "Valid physiological strain confirmed during unexpected presentation. EMA 2 completed.",
    evidenceExplanation: [
      "HR +2.1 SD vs personal sitting baseline",
      "RMSSD -2.6 SD (significant vagal withdrawal)",
      "DFA α1 +1.4 SD",
      "Context confidence: 0.96",
      "Quality score: 0.94"
    ],
    emaResponses: [
      { type: "EMA 1 (Context)", status: "Completed", time: "08:25", answer: "Sedang rapat & presentasi (Unplanned)" },
      { type: "EMA 2 (Symptom)", status: "Completed", time: "08:27", answer: "Jantung berdebar, cemas (Intensitas: 6/10)" },
      { type: "EMA 3 (Recovery)", status: "Completed", time: "08:57", answer: "Mulai membaik setelah duduk & minum air" },
      { type: "EMA 4 (Reflection)", status: "Completed", time: "09:04", answer: "Pemicu: Stres emosional/beban kerja" }
    ],
    trajectory: [
      { time: "08:20", score: 0.45, state: "BASELINE_COMPATIBLE" },
      { time: "08:22", score: 1.12, state: "BASELINE_COMPATIBLE" },
      { time: "08:24", score: 1.95, state: "DEVIATION_CANDIDATE" },
      { time: "08:26", score: 2.40, state: "PERSISTENT_DEVIATION" },
      { time: "08:30", score: 2.87, state: "PERSISTENT_DEVIATION" },
      { time: "08:40", score: 2.65, state: "PERSISTENT_DEVIATION" },
      { time: "08:50", score: 2.10, state: "PERSISTENT_DEVIATION" },
      { time: "08:56", score: 1.15, state: "RECOVERY" },
      { time: "09:02", score: 0.65, state: "RECOVERED" },
    ]
  },
  {
    id: "EP-240527-01",
    participantId: "P-014",
    context: "kegiatan anak",
    onset: "14:10",
    confirmedTime: "14:13",
    recoveryStart: "14:40",
    recoveredTime: "14:47",
    durationMinutes: 37,
    peakScore: 2.40,
    auc: 98.4,
    severity: "Moderate",
    status: "RESOLVED",
    reviewStatus: "Confirmed",
    reviewerNote: "Physical strain mixed with exertion.",
    evidenceExplanation: [
      "HR +1.8 SD vs active baseline",
      "RMSSD -1.9 SD",
      "Context confidence: 0.92"
    ],
    emaResponses: [
      { type: "EMA 1 (Context)", status: "Completed", time: "14:11", answer: "Bermain dengan anak" },
      { type: "EMA 2 (Symptom)", status: "Completed", time: "14:14", answer: "Napas cepat, lelah (Intensitas: 4/10)" },
    ],
    trajectory: [
      { time: "14:05", score: 0.30, state: "BASELINE_COMPATIBLE" },
      { time: "14:10", score: 1.88, state: "DEVIATION_CANDIDATE" },
      { time: "14:13", score: 2.40, state: "PERSISTENT_DEVIATION" },
      { time: "14:30", score: 2.10, state: "PERSISTENT_DEVIATION" },
      { time: "14:40", score: 1.05, state: "RECOVERY" },
      { time: "14:47", score: 0.55, state: "RECOVERED" },
    ]
  },
  {
    id: "EP-260808-07",
    participantId: "P-027",
    context: "kerja / kantor",
    onset: "11:20",
    confirmedTime: "11:23",
    recoveryStart: "11:35",
    recoveredTime: null,
    durationMinutes: 18,
    peakScore: 2.11,
    auc: 42.0,
    severity: "Moderate",
    status: "RECOVERY",
    reviewStatus: "Under Review",
    reviewerNote: "Ongoing recovery trajectory being observed.",
    evidenceExplanation: [
      "HR +1.6 SD vs sitting baseline",
      "RMSSD -1.8 SD"
    ],
    emaResponses: [
      { type: "EMA 1 (Context)", status: "Completed", time: "11:21", answer: "Coding & debugging deadline" }
    ],
    trajectory: [
      { time: "11:15", score: 0.35, state: "BASELINE_COMPATIBLE" },
      { time: "11:20", score: 1.82, state: "DEVIATION_CANDIDATE" },
      { time: "11:23", score: 2.11, state: "PERSISTENT_DEVIATION" },
      { time: "11:35", score: 0.94, state: "RECOVERY" },
    ]
  },
  {
    id: "EP-260808-08",
    participantId: "P-031",
    context: "berjalan",
    onset: "09:15",
    confirmedTime: "09:20",
    recoveryStart: null,
    recoveredTime: null,
    durationMinutes: 90,
    peakScore: 2.42,
    auc: 185.0,
    severity: "High",
    status: "UNRESOLVED",
    reviewStatus: "Needs Follow-up",
    reviewerNote: "Device signal quality dropped during episode. Needs sensor check.",
    evidenceExplanation: [
      "Quality score warning: artifact fraction > 0.35",
      "Unresolved episode horizon exceeded (>90 min)"
    ],
    emaResponses: [
      { type: "EMA 1 (Context)", status: "Skipped", time: "-", answer: "No response (Timeout)" }
    ],
    trajectory: [
      { time: "09:10", score: 0.50, state: "BASELINE_COMPATIBLE" },
      { time: "09:15", score: 1.90, state: "DEVIATION_CANDIDATE" },
      { time: "09:20", score: 2.42, state: "PERSISTENT_DEVIATION" },
      { time: "10:15", score: 2.15, state: "UNRESOLVED" }
    ]
  }
];

export const PERSONAL_EXPERIENCE_MODELS = [
  {
    participantId: "P-014",
    context: "sitting",
    resolvedEpisodesCount: 12,
    medianRecoveryMinutes: 18,
    p25RecoveryMinutes: 11,
    p75RecoveryMinutes: 27,
    phenotype: "Moderate Recovery Profile",
    confidenceScore: 0.85,
    adaptiveThresholds: {
      tauIn: 1.86,
      tauOut: 1.18,
      tauNormal: 0.70
    },
    learnedTransitions: [
      { from: "PERSISTENT_DEVIATION", to: "RECOVERY", probability: 0.63, count: 8 },
      { from: "PERSISTENT_DEVIATION", to: "PERSISTENT_DEVIATION", probability: 0.23, count: 3 },
      { from: "RECOVERY", to: "RECOVERED", probability: 0.78, count: 10 },
      { from: "RECOVERY", to: "PERSISTENT_DEVIATION", probability: 0.14, count: 2 }
    ]
  },
  {
    participantId: "P-027",
    context: "working",
    resolvedEpisodesCount: 19,
    medianRecoveryMinutes: 14,
    p25RecoveryMinutes: 9,
    p75RecoveryMinutes: 20,
    phenotype: "Fast Recovery Profile",
    confidenceScore: 0.92,
    adaptiveThresholds: {
      tauIn: 1.75,
      tauOut: 1.10,
      tauNormal: 0.75
    },
    learnedTransitions: [
      { from: "PERSISTENT_DEVIATION", to: "RECOVERY", probability: 0.75, count: 15 },
      { from: "PERSISTENT_DEVIATION", to: "PERSISTENT_DEVIATION", probability: 0.15, count: 3 },
      { from: "RECOVERY", to: "RECOVERED", probability: 0.89, count: 17 },
      { from: "RECOVERY", to: "PERSISTENT_DEVIATION", probability: 0.05, count: 1 }
    ]
  }
];

export const MODEL_RULES_CONFIG = {
  activeVersion: "SR-1.4 (2026-08-01)",
  baselineVersion: "B-014-07",
  experienceVersion: "EXP-0.6",
  predictionVersion: "PRED-0.4",
  guardrails: "Strict Non-Diagnostic",
  parameters: [
    { key: "tau_in", label: "tau_in (Candidate Threshold)", activeValue: "1.86", source: "Personal Q99", guardrail: "1.2 - 3.5" },
    { key: "tau_out", label: "tau_out (Recovery Threshold)", activeValue: "1.18", source: "Hysteresis learned", guardrail: "< tau_in" },
    { key: "tau_normal", label: "tau_normal (Normal Band)", activeValue: "0.80", source: "Rule config", guardrail: "<= tau_out" },
    { key: "k_of_m", label: "k-of-m (Persistence Guard)", activeValue: "3 / 4 windows", source: "Protocol spec", guardrail: "2 <= k <= m" },
    { key: "r", label: "r (Recovery Confirmation)", activeValue: "2 windows", source: "Protocol spec", guardrail: "1 - 5" },
    { key: "q", label: "q (Unresolved Horizon)", activeValue: "3 windows (90 min)", source: "Protocol spec", guardrail: "2 - 6" },
    { key: "washout", label: "Washout Period", activeValue: "20 min", source: "Protocol spec", guardrail: ">= 0" }
  ],
  versionHistory: [
    { version: "SR-1.4", activatedAt: "2026-08-01 09:00", author: "Dr. Rina S.", status: "ACTIVE" },
    { version: "SR-1.3", activatedAt: "2026-07-15 11:20", author: "Eng. Budi T.", status: "SUPERSEDED" },
    { version: "SR-1.2", activatedAt: "2026-06-01 08:00", author: "Eng. Budi T.", status: "SUPERSEDED" }
  ]
};

export const EXPORT_JOBS = [
  { id: "EX-103", scope: "Episode + EMA + Experience", format: "CSV", status: "Ready", requester: "rina.s@capar-research.id", date: "2026-08-08 12:15", checksum: "sha256:8f9a2b..." },
  { id: "EX-102", scope: "State Timeline", format: "JSON", status: "Ready", requester: "budi.t@capar-research.id", date: "2026-08-07 16:40", checksum: "sha256:3c4d1e..." },
  { id: "EX-101", scope: "Audit Log & Provenance", format: "PDF", status: "Ready", requester: "rina.s@capar-research.id", date: "2026-08-05 09:10", checksum: "sha256:1a2b3c..." },
  { id: "EX-100", scope: "Feature Windows", format: "CSV", status: "Expired", requester: "admin@capar-research.id", date: "2026-07-20 14:00", checksum: "sha256:7e8f90..." }
];

export const AUDIT_TRAIL = [
  { id: "AUD-882", timestamp: "2026-08-08 13:06:42", actor: "System Engine", action: "STATE_TRANSITION", detail: "Participant P-014 state changed to PERSISTENT_DEVIATION (score 2.64 > tau_in 1.86)" },
  { id: "AUD-881", timestamp: "2026-08-08 12:15:00", actor: "rina.s@capar-research.id", action: "EXPORT_GENERATE", detail: "Generated EX-103 (Episode + EMA + Experience) scope: pilot-01" },
  { id: "AUD-880", timestamp: "2026-08-08 09:04:12", actor: "P-014 (User App)", action: "EMA_SUBMIT", detail: "Submitted EMA 4 Reflection for EP-240530-02" },
  { id: "AUD-879", timestamp: "2026-08-08 09:00:00", actor: "rina.s@capar-research.id", action: "REVIEWER_DECISION", detail: "Confirmed episode EP-240530-02 as valid physiological strain" },
  { id: "AUD-878", timestamp: "2026-08-01 09:00:00", actor: "budi.t@capar-research.id", action: "RULE_PROMOTE", detail: "Promoted Rule Config SR-1.4 to ACTIVE" }
];
