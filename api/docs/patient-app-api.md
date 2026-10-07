# Patient app API

Patient-facing endpoints are isolated under `/api/patient-app`. Authenticated
endpoints accept the existing `access_token` cookie or
`Authorization: Bearer <token>` header. Patient records are always scoped to
the verified account and any explicitly linked User/Patient counterpart;
clients must not submit account IDs.
Registration creates a standard `User` (`role: "user"`) and a one-to-one
`PatientAppProfile` extension. The `User.patient_profile` Mongoose virtual
resolves this extension by `account_id`. Legacy `Patient` accounts are also
supported by the same patient APIs and can be linked to a same-email `User`
account to share CAPAR analysis data.
Patient-app accounts use the existing `POST /api/auth/signin` endpoint for
subsequent logins.
Registration checks for an exact email match in both `User` and legacy
`Patient` collections without regard to letter case before creating either
account or profile document.
When deployed behind the VPS Nginx reverse proxy and Docker bridge, the API
trusts only loopback, link-local, and private-network proxy addresses for
`X-Forwarded-For`; do not replace this with unrestricted `trust proxy: true`.

## Register

`POST /api/patient-app/register` creates a standard patient-app account and
returns a bearer token. Five registration attempts are allowed per 15 minutes.

```json
{
  "name": "Ani Setiawan",
  "email": "ani@example.com",
  "password": "at-least-10-characters",
  "phone_number": "+628123456789"
}
```

## Profile and preferences

- `GET /api/patient-app/profile`
- `PATCH /api/patient-app/profile`
- `GET /api/patient-app/overview`

Profile patch fields: `date_of_birth` (ISO date or null), `timezone` (IANA, e.g.
`Asia/Jakarta`), `sex` (`female`, `male`, `other`, or null), `height_cm`,
`weight_kg`, `conditions`, `allergies`, `special_conditions` (string lists),
`blood_type` (`A+`, `A-`, `B+`, `B-`, `AB+`, `AB-`, `O+`, `O-`, or empty),
`emergency_contact_name`, `emergency_contact_phone`,
`clinical_note`, `medications` (`[{ "name", "dosage", "schedule" }]`),
`medication_reviewed`, `allergies_reviewed`, `goal`
(`daily_monitoring`, `early_awareness`, `fitness`, `other`),
`wearable_provider` (`none`, `polar_h10`, `apple_watch`, `garmin`, `fitbit`,
`other`), and `notification_preferences` (`morning_summary`,
`important_alerts`, `health_education`, `quiet_start`, `quiet_end`). Notification
times use `HH:mm`. `data_sharing` records explicit opt-in flags for clinician or
family sharing; both default to `false`.

## Daily check-ins

- `POST /api/patient-app/check-ins`
- `GET /api/patient-app/check-ins?from=<ISO>&to=<ISO>&limit=30&before=<ISO>`
- `GET /api/patient-app/check-ins/:checkInId`
- `DELETE /api/patient-app/check-ins/:checkInId`
- `GET /api/patient-app/daily-summary?date=YYYY-MM-DD`

Example request:

```json
{
  "recorded_at": "2026-10-05T08:00:00.000Z",
  "feeling": "fair",
  "activity": "walking",
  "posture": "standing",
  "sleep": {
    "duration_minutes": 420,
    "quality": "good",
    "bedtime": "22:30",
    "wake_time": "05:30",
    "disturbances": {
      "woke_frequently": false,
      "difficulty_falling_asleep": false,
      "nightmares": false
    }
  },
  "symptoms": ["fatigue"],
  "symptom_severity": 4,
  "stress_level": 2,
  "hydration_ml": 500,
  "lifestyle": {
    "meal": true,
    "caffeine": false,
    "alcohol": false,
    "smoking": false
  },
  "medication_taken": true,
  "medication_name": "Medication X",
  "medication_dosage": "1 tablet",
  "medication_taken_at": "2026-10-05T07:30:00.000Z",
  "medication_note": "",
  "measurements": {
    "systolic_bp": 120,
    "diastolic_bp": 80,
    "temperature_c": 36.6,
    "weight_kg": 58,
    "spo2_pct": 97,
    "glucose_mg_dl": 105
  },
  "note": "Merasa lebih lelah setelah bekerja."
}
```

`recorded_at`, `sleep` (an empty object is valid when no sleep data is known),
and `symptoms` are required; send `symptoms: []` to explicitly report no
symptoms. `feeling` accepts `good`, `fair`, `poor`, or `very_poor`. `activity` accepts
`rest`, `sitting`, `standing`, `walking`, `exercise`, `work`, `meal`, or `other`.
Symptoms accept `fatigue`, `dizziness`, `palpitations`, `breathlessness`,
`chest_pain`, `headache`, `pain`, `nausea`, `weakness`, `fever`, or `other`.
When no symptom is present, send `symptoms: []`.
The list endpoint is newest-first and caps `limit` at 100; its `pagination.next_before` can be passed
as the next `before` value. `daily-summary` returns patient check-ins, event
markers, and wearable samples recorded on the requested UTC calendar day.

## Event markers

- `POST /api/patient-app/events`
- `GET /api/patient-app/events?from=<ISO>&to=<ISO>&limit=30&before=<ISO>`

The `event_type` enum is `exercise_started`, `exercise_ended`, `sleep_started`,
`woke_up`, `meal`, `medication`, `stress`, `symptom`, `caffeine`, `alcohol`,
`smoking`, `hydration`, `illness`, `posture_change`, `menstruation`, or `other`.
Each event requires `occurred_at` (ISO date) and accepts `details` (up to 300
characters), and optional scalar `value`, `intensity`, and `unit`.

## Wearable bridge

- `POST /api/patient-app/wearable/samples`
- `GET /api/patient-app/wearable/samples?from=<ISO>&to=<ISO>&limit=30&before=<ISO>`
- `GET /api/patient-app/wearable/history?from=<ISO>&to=<ISO>&bucket_minutes=60`
- `POST /api/patient-app/wearable/stream`

The history endpoint returns bounded time buckets (15, 30, 60, 120, or 360
minutes) for a maximum 31-day range. It aggregates both patient-app wearable
samples and linked CAPAR PolarData, identifying them with `source:
"patient_app"` or `source: "capar_polar"` respectively. Heart-rate min/max,
average, sample count, and available signal-quality/HRV measures are returned
per bucket for charting without sending every raw sample to the mobile app.

The mobile app submits `provider`, `device_id`, `recorded_at`, `heart_rate_bpm`,
10-256 `rr_intervals_ms`, `activity`, 10-512 `acceleration_g` triplets
(`[x,y,z]` in g), `sensor_contact`, and `signal_confidence` (0-1). This is the
minimum physiological/context input; timestamp, activity and device provenance
are mandatory. Optional values include `expected_rr_count`, `activity_intensity`,
`posture`, `sleep_duration_minutes`, `sleep_quality`, `spo2_pct`, `steps`, and
`skin_temperature_c`. Client-supplied SDNN, RMSSD, pNN50, HR delta/slope, and
DFA are not accepted as derived truth: the backend derives them from RR/IBI and
tri-axial acceleration. DFA alpha1 is only available with at least 64 RR
intervals. The provider and timestamp are retained as provenance. Vidyamedic
pairs with a Polar H10 over BLE and submits real HR/RR and accelerometer
windows through these authenticated endpoints. No simulator readings or
client-side broker credentials are used.

`POST /wearable/stream` accepts authenticated Polar H10 reading batches (up to
100 readings per request), validates contact, timestamp, HR, RR/IBI, activity,
and measured acceleration, then publishes them to the configured RabbitMQ
`Sensor` queue. Vidyamedic flushes this stream every 10 seconds. The response
is `202` with `published` and `reading_count`; if RabbitMQ is unavailable the
endpoint returns `503` without claiming success. The CAPAR consumer stores
accepted readings in the shared CAPAR data collection.

Accepted samples are converted into CAPAR `Segment` records with
`window_type: "1min"` and left for the existing CAPAR Layer 3-RR pipeline to
analyze. The response indicates `pending_layer3_analysis`; samples failing
signal/contact/quality checks are retained as a quality warning and are not
fed into the baseline. Sensor contact, signal confidence, RR artifacts and
missingness are included in the quality audit. These 1-minute feature windows
are stored as patient-app samples and CAPAR segments; the separate stream
endpoint carries the live per-reading messages. RabbitMQ credentials remain
server-side in `RABBITMQ_URI`.

The overview also reports `input_readiness` for demographic profile,
medication/allergy review, the minimum wearable record, and patient context.
`ready_for_personal_analysis` remains false until profile, wearable, and patient
context minimums are present. It does not diagnose, classify emergencies, or
claim a wearable is connected just because a provider has been selected.
`capar-insights` uses only CAPAR segments that have been analyzed and passed
its quality gate.

## CAPAR insights and scientific evidence

- `POST /api/patient-app/link-capar-account`
- `GET /api/patient-app/capar-insights`

### Decision policy provenance

Patient action guidance, reported-symptom escalation, persistence/recovery
summaries, patient analytics quality gates, Mahalanobis references, and CAPAR
fallback thresholds include policy metadata. Each policy rule reports
`policy_id`, `rule_id`, `version`, `source`, `rationale`, `effective_date`,
`confidence`, `status`, and its configured `value`. The current rules are
`NON-CLINICAL / PLACEHOLDER`: they preserve existing demonstration behavior
only and are not clinically validated or suitable for clinical decision-making.
They are centrally configured in `api/config/patientDecisionPolicies.js`.
Rule overrides supplied to policy-aware functions must include the full
provenance fields; incomplete overrides fail explicitly. Learned patient or
CAPAR statistics do not thereby become clinical cutoffs.

The link endpoint accepts an authenticated legacy `Patient` account, or an
authenticated `User` account with `patient_password` in the request body. It
connects only records with the exact same normalized email; a User must also
prove knowledge of the legacy Patient password. A User cannot be linked to
multiple Patient records. If no same-email User exists, the endpoint returns
`404`; create the User account first. The link stores `Patient.user_id`,
without changing the patient's login or doctor relationship. Once linked,
check-ins, event markers, wearable samples, and patient-app profile data are
visible to both account sessions; new patient-app records are stored under the
canonical User owner. Older records under either account ID remain readable
without rewriting their provenance.

### Longitudinal reasoning pipeline

`capar.reasoning_pipeline` makes the MVP processing sequence explicit:
`sensing` → `quality_gate` → `feature_engine` → `personal_baseline` →
`evidence_fusion` → `latent_state_estimation` → `temporal_reasoning` →
`resilience` → `decision_policy` → `patient_pedagogy` → `feedback`. Each stage
reports its availability/status and the evidence counts or outputs actually
used by the existing CAPAR/statistical pipeline. `evidence_fusion.sources`
separates wearable, patient-reported symptoms, patient context, and clinical
records. `clinical_records.status` is `not_integrated` until a governed
clinical/laboratory source is connected; missing evidence is never synthesized.

The `latent_state_estimation` stage exposes an available personal-baseline
wearable statistical state (and its distance) only when a matching
quality-gated Mahalanobis result exists. Patient context may inform explanation
and safety/action policy, but is not represented as an input to this state
estimate. The requested notation `P(X_t | T(t))` is included
under `probabilistic_posterior` as a design target, but its `distribution` is
`null` and its status is `not_calibrated`. Feature contributions, literature,
or context proximity are not converted into probabilities or diagnostic
confidence. State references and decisions retain their existing
`NON-CLINICAL / PLACEHOLDER` policy metadata. The feedback stage distinguishes
a completed patient follow-up from optional patient-reported `action_taken` and
`response_after_action` fields. These fields describe what the patient says they
did and felt afterward; they do not establish intervention effectiveness or
causality. The API makes no treatment recommendation from these free-text
responses. Each is optional (`action_taken`: up to 300 characters;
`response_after_action`: up to 500 characters), stored with the check-in
timestamp, and scoped to the authenticated patient.

User-authenticated link request:

```json
{
  "patient_password": "legacy-patient-password"
}
```

For a linked legacy patient, `capar-insights` reads CAPAR baseline, segment,
episode, and transition-related data under both the linked User ID and the
legacy Patient ID. This lets NadiKu use historical CAPAR data regardless of
which of those IDs was used to store it. A patient that has not been linked
gets `capar.status: "link_required"` instead of an empty/ misleading analysis.
For a User account linked to a legacy Patient, the same combined CAPAR data is
used. An unlinked User account uses its own User ID.
It returns:

- Baseline contexts and feature statistics stored for the authenticated
  CAPAR user. A legacy baseline marked mature with at least 20 segments remains
  usable when its newer maturity-quality fields were never computed.
- Valid, analyzed CAPAR segments that passed the quality gate (or have both
  signal and completeness quality at least `0.7`): a 24-hour current-state
  trajectory and up to 500 historical windows from the last 30 days.
- Multivariate Mahalanobis distance over the CAPAR features available in both
  a quality-gated sample and its mature, matching activity/time-of-day
  baseline. The candidate features are mean HR, mean RR, HR delta/slope, SDNN,
  RMSSD, DFA alpha1, and motion intensity. Only features with at least 30
  baseline observations and at least 30 complete multivariate samples are used.
  Otherwise the result is `insufficient_data`.
- The latest 100 raw `PolarData` readings across the user's history, up to 100
  `EpisodeAnalysis`/`AnomalyEvent`/`EpisodeMeta` episode records, and up to 20
  `CognitiveMemory` records, all scoped to the authenticated CAPAR user.
- Episode recovery outcomes from the last 30 days. The observed recovery
  percentage is `recovered / (recovered + unresolved) * 100`; episodes without
  a documented outcome are excluded. The response includes its denominator
  and is `null` if no episode outcome is known. This is a historical observed
  proportion, not a predicted chance of recovery.
- Recovery progress only when a recent, contiguous, measured deviation
  trajectory is recovering or has returned to baseline. Gaps longer than ten
  minutes break trajectory continuity; baseline-only data does not produce a
  recovery percentage.
- Up to 20 recent CAPAR deviation events (last 30 days) with personalized
  signed z-scores, absolute change from baseline, direction, and Mahalanobis
  contribution decomposition. Feature contributions use
  `delta_i * (inverse_covariance * delta)_i`; absolute shares are normalized
  to sum to one.
- Patient-reported check-ins, events, and CAPAR BehaviorEvent records in the
  six hours before each deviation, returned as temporally associated context.
  A rule-based context-attribution summary ranks associations, not established
  causes.
- Up to five citations retrieved by CAPAR's local multi-axis scientific RAG
  knowledge base from recent self-reported behavior, available physiology, and
  observed recovery evidence. RAG citations explain relevant population-level
  literature; recovery percentages are computed from recorded CAPAR episode
  outcomes and are not generated by RAG.

Mahalanobis distance is a statistical difference from the patient's own
baseline; it is not a CAPAR anomaly score, diagnosis, or clinical-risk score.
The two reference thresholds in the response are theoretical chi-square
reference values, not patient-calibrated cutoffs. CAPAR state prediction is
intentionally not exposed until transition-history and confidence requirements
are validated for patient use.

Deviation factors report feature-wise personalized z-scores and the
Mahalanobis decomposition against the patient's matching personal baseline.
Nearby behavior/check-in records are fused with physiological evidence using
transparent rules (for example elevated motion with elevated HR is consistent
with activity); temporal proximity or rule agreement does not prove
individual causation. Literature summaries describe population-level evidence.
Explanations abstain when a quality-accepted segment, mature matching
baseline, or enough comparable multivariate features are unavailable.
Accepted patient-app wearable samples are transformed to raw-RR CAPAR segments
and are analyzed by the existing Layer 3-RR pipeline; samples that fail the
quality gate are retained as warnings and excluded from baseline analysis.

Each explanation reports `explanation_status` (`available`,
`insufficient_data`, or `unexplained`), `main_deviation_factors` with personal
z-scores, baseline deltas, direction, and Mahalanobis contribution shares when
available, `temporally_associated_context` with source and time, and ranked
`candidate_context_contributors` with observed evidence level (not a calibrated
probability).
`scientific_evidence` contains the matching literature summaries. A UI should
present these as "factors observed around this deviation" and "possible
context", not as a definitive cause.

Each deviation also includes `reasoning_uncertainty`, with qualitative
`evidence_status` (`conflicting_evidence`, `insufficient_evidence`,
`limited_evidence`, or `evidence_available_with_limits`), evidence-dimension
availability, `reasons`, and a patient-readable `interpretation`.
`confidence` is `null`, `confidence_status` is `not_calibrated`, and
`numeric_probability_provided` is `false`: feature-contribution shares and
context-rule matches are not calibrated probabilities of an explanation.
`evidence_conflicts` retains the sources and values when patient/event activity
context and a quality-accepted sensor activity label indicate opposite
activity states; neither source is selected as authoritative. Missing context
is treated as missing evidence, not conflicting evidence.

`capar.pedagogy` provides the six patient-facing questions:

1. `where_am_i`: current state relative to the matching personal multivariate
   baseline, including Mahalanobis distance and reference thresholds when a
   usable estimate exists.
2. `what_changed`: current state, signed feature z-scores/deltas, recent trend,
   and multivariate deviation.
3. `why`: Mahalanobis feature contribution decomposition, rule-based context
   attribution from the prior six hours, and matching population-level
   literature.
4. `how_long`: latest episode and the k-of-m persistence summary (4 of the
   latest 5 quality-gated windows with no more than 10 minutes between
   observations), including dwell time and deviation AUC.
5. `recovery`: Mahalanobis distance trend/derivative, estimated recovery
   progress, time-to-recovery when available, and recorded relapse indicators.
6. `action`: rule-based `green`, `yellow`, `orange`, or `red` patient guidance,
   with reasons and the evidence-quality state.
7. `follow_up`: a structured prompt for the app to ask after a personal
   deviation. Moderate displacement asks about current symptoms and recent
   activity/context; strong displacement additionally asks which factors the
   patient thinks may be related, symptom timing, and optional notes. This is
   accompanied by `reasoning_uncertainty` and, where applicable, a message
   explaining why context is being requested and what the system cannot infer.
   The prompt does not claim that an uncertainty status is a clinical risk
   level or that patient answers establish causation. This is
   identified by CAPAR segment; the status changes to `already_answered` after
   the patient submits a response. Clients should show it when
   `status: "requested"` and submit the answers with the regular
   `POST /api/patient-app/check-ins` payload. The response's segment ID is
   verified against the authenticated patient's CAPAR data before saving.
   Patient-selected factors are subjective context, not algorithmically
   established causes. The strong-displacement threshold is a statistical
   reference, not a clinical severity or emergency threshold.

Patient-reported chest pain, severe breathlessness (severity >= 7), or any
symptom severity >= 9 bypasses wearable scoring and returns a red emergency
recommendation. After the red-flag check, insufficient-quality data return a
quality warning. Persistent deviation together with symptoms returns orange
clinician-contact guidance; persistence without symptoms, lack of recovery, or
relapse returns yellow observation/follow-up guidance. Stable quality-gated
data with no reported symptoms return green. These are conservative awareness
rules, not a validated medical triage system; the response does not diagnose.

The RAG response contains citation metadata and retrieval relevance only. It
does not generate individualized medical advice, establish causality, or send
patient data to an external model.
