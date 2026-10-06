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
- `POST /api/patient-app/wearable/stream`

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
