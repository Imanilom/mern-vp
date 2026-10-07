import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

enum Gender {
  female('female', 'Perempuan'),
  male('male', 'Laki-laki'),
  other('other', 'Lainnya');

  final String apiValue;
  final String label;
  const Gender(this.apiValue, this.label);

  static Gender fromString(String? val) {
    if (val == null || val.isEmpty) return Gender.other;
    final lower = val.toLowerCase();
    if (lower == 'male' || lower == 'laki-laki' || lower == 'pria') return Gender.male;
    if (lower == 'other' || lower == 'lainnya') return Gender.other;
    return Gender.female;
  }
}

/// Expression drawn by [FaceBadge].
enum FaceExpression { veryHappy, happy, neutral, sad, verySad }

enum MoodRating {
  baik('Baik', 'good', AppTheme.faceGreen, FaceExpression.happy),
  cukup('Cukup', 'fair', AppTheme.faceYellow, FaceExpression.neutral),
  kurangBaik('Kurang baik', 'poor', AppTheme.faceOrange, FaceExpression.sad),
  tidakBaik('Tidak baik', 'very_poor', AppTheme.faceRed, FaceExpression.verySad);

  final String label;
  final String apiValue;
  final Color color;
  final FaceExpression face;
  const MoodRating(this.label, this.apiValue, this.color, this.face);

  static MoodRating fromApiValue(String? val) {
    if (val == null) return MoodRating.baik;
    switch (val.toLowerCase()) {
      case 'good':
        return MoodRating.baik;
      case 'fair':
        return MoodRating.cukup;
      case 'poor':
        return MoodRating.kurangBaik;
      case 'very_poor':
        return MoodRating.tidakBaik;
      default:
        return MoodRating.baik;
    }
  }
}

enum StressLevel {
  rendah('Rendah', 1, AppTheme.faceGreen, FaceExpression.happy),
  sedang('Sedang', 3, AppTheme.faceYellow, FaceExpression.neutral),
  tinggi('Tinggi', 5, AppTheme.faceRed, FaceExpression.verySad);

  final String label;
  final int apiValue;
  final Color color;
  final FaceExpression face;
  const StressLevel(this.label, this.apiValue, this.color, this.face);

  static StressLevel? fromApiValue(num? val) {
    if (val == null) return null;
    if (val == StressLevel.rendah.apiValue) return StressLevel.rendah;
    if (val == StressLevel.sedang.apiValue) return StressLevel.sedang;
    if (val == StressLevel.tinggi.apiValue) return StressLevel.tinggi;
    return null;
  }
}

enum SleepQuality {
  sangatBaik('Sangat baik', 'excellent', Color(0xFF4CC9A0), FaceExpression.veryHappy),
  baik('Baik', 'good', AppTheme.faceGreen, FaceExpression.happy),
  cukup('Cukup', 'fair', AppTheme.faceYellow, FaceExpression.neutral),
  buruk('Buruk', 'poor', AppTheme.faceRed, FaceExpression.verySad);

  final String label;
  final String apiValue;
  final Color color;
  final FaceExpression face;
  const SleepQuality(this.label, this.apiValue, this.color, this.face);

  static SleepQuality fromApiValue(String? val) {
    if (val == null) return SleepQuality.baik;
    switch (val.toLowerCase()) {
      case 'excellent':
        return SleepQuality.sangatBaik;
      case 'good':
        return SleepQuality.baik;
      case 'fair':
        return SleepQuality.cukup;
      case 'poor':
      case 'very_poor':
        return SleepQuality.buruk;
      default:
        return SleepQuality.baik;
    }
  }
}

/// Symptom options shown in "Apakah ada gejala?" (mockup halaman 4).
class SymptomOption {
  final String label;
  final String apiCode;
  final IconData icon;
  final Color color;
  final bool redFlag;
  const SymptomOption(this.label, this.icon, this.color, {this.apiCode = 'other', this.redFlag = false});
}

const String kNoSymptom = 'Tidak ada';

const List<SymptomOption> kSymptoms = [
  SymptomOption(kNoSymptom, Icons.check_circle_outline, Color(0xFF14A38B), apiCode: 'none'),
  SymptomOption('Nyeri dada', Icons.favorite, Color(0xFFEB5757), apiCode: 'chest_pain', redFlag: true),
  SymptomOption('Sesak napas', Icons.air, Color(0xFFF2994A), apiCode: 'breathlessness', redFlag: true),
  SymptomOption('Pusing', Icons.sync, Color(0xFFF2994A), apiCode: 'dizziness'),
  SymptomOption('Jantung terasa berdebar/tidak teratur', Icons.favorite_border, Color(0xFFEB5757), apiCode: 'palpitations'),
  SymptomOption('Lelah', Icons.accessibility_new, Color(0xFF3B82F6), apiCode: 'fatigue'),
  SymptomOption('Mual', Icons.sick_outlined, Color(0xFF14A38B), apiCode: 'nausea'),
  SymptomOption('Lainnya', Icons.more_horiz, Color(0xFF6B7280), apiCode: 'other'),
];

String mapSymptomLabelToApi(String label) {
  final match = kSymptoms.firstWhere((s) => s.label == label, orElse: () => const SymptomOption('other', Icons.help, Colors.grey, apiCode: 'other'));
  return match.apiCode;
}

String mapApiToSymptomLabel(String apiCode) {
  final match = kSymptoms.firstWhere((s) => s.apiCode == apiCode, orElse: () => const SymptomOption('Lainnya', Icons.help, Colors.grey, apiCode: 'other'));
  return match.label;
}

/// Activity options (mockup halaman 4 – "Apa yang sedang Anda lakukan?").
const List<(String, IconData)> kActivities = [
  ('Istirahat', Icons.airline_seat_recline_normal),
  ('Duduk', Icons.chair_alt_outlined),
  ('Berdiri', Icons.man),
  ('Berjalan', Icons.directions_walk),
  ('Olahraga', Icons.directions_run),
  ('Bekerja', Icons.work_outline),
  ('Makan', Icons.restaurant),
  ('Lainnya', Icons.more_horiz),
];

const Map<String, String> _activityToApiMap = {
  'Istirahat': 'rest',
  'Duduk': 'sitting',
  'Berdiri': 'standing',
  'Berjalan': 'walking',
  'Olahraga': 'exercise',
  'Bekerja': 'work',
  'Makan': 'meal',
  'Lainnya': 'other',
};

String mapActivityToApi(String label) => _activityToApiMap[label] ?? 'other';

String mapApiToActivity(String apiCode) {
  for (final entry in _activityToApiMap.entries) {
    if (entry.value == apiCode) return entry.key;
  }
  return 'Lainnya';
}

/// Event marker options (mockup halaman 5 – "Tambah Event").
const List<(String, IconData, Color)> kEvents = [
  ('Mulai olahraga', Icons.directions_run, Color(0xFF0B7A5A)),
  ('Selesai olahraga', Icons.sports_gymnastics, Color(0xFF0B7A5A)),
  ('Mulai tidur', Icons.bedtime, Color(0xFF7C5CDB)),
  ('Bangun tidur', Icons.alarm, Color(0xFF7C5CDB)),
  ('Makan', Icons.restaurant, Color(0xFFF2994A)),
  ('Minum obat', Icons.medication_outlined, Color(0xFFB7791F)),
  ('Stres/emosi', Icons.sentiment_very_dissatisfied, Color(0xFFEB5757)),
  ('Gejala muncul', Icons.timer_outlined, Color(0xFF14A38B)),
  ('Lainnya', Icons.more_horiz, Color(0xFF6B7280)),
];

const Map<String, String> _eventToApiMap = {
  'Mulai olahraga': 'exercise_started',
  'Selesai olahraga': 'exercise_ended',
  'Mulai tidur': 'sleep_started',
  'Bangun tidur': 'woke_up',
  'Makan': 'meal',
  'Minum obat': 'medication',
  'Stres/emosi': 'stress',
  'Gejala muncul': 'symptom',
  'Kafein': 'caffeine',
  'Minum Air': 'hydration',
  'Merokok': 'smoking',
  'Alkohol': 'alcohol',
  'Lainnya': 'other',
};

String mapEventTitleToApi(String title) => _eventToApiMap[title] ?? 'other';

String mapApiToEventTitle(String apiCode) {
  for (final entry in _eventToApiMap.entries) {
    if (entry.value == apiCode) return entry.key;
  }
  return 'Lainnya';
}

enum ActionTriageLevel {
  unknown('DATA TERBATAS', 'unknown', 'Data belum cukup',
      'Data belum cukup untuk menentukan status. Ini bukan berarti ada deviasi; lanjutkan pengumpulan data.',
      AppTheme.textMuted, AppTheme.fieldFill, Icons.help_outline),
  green('HIJAU', 'green', 'Lanjutkan aktivitas',
      'Stabil sesuai baseline; tidak ada red flag; recovery baik.',
      AppTheme.statusGreen, AppTheme.statusGreenBg, Icons.check_circle),
  yellow('KUNING', 'yellow', 'Observasi & catat',
      'Perubahan ringan atau baru; pantau tren dan gejala.',
      AppTheme.statusYellow, AppTheme.statusYellowBg, Icons.visibility),
  orange('ORANYE', 'orange', 'Hubungi tenaga kesehatan',
      'Deviasi menetap/tidak pulih atau gejala yang memerlukan konsultasi.',
      AppTheme.statusOrange, AppTheme.statusOrangeBg, Icons.call),
  red('MERAH', 'red', 'Ke IGD / layanan darurat',
      'Red flag, gejala berat, atau kondisi memburuk cepat.',
      AppTheme.statusRed, AppTheme.statusRedBg, Icons.emergency);

  final String code;
  final String apiValue;
  final String title;
  final String description;
  final Color color;
  final Color bgColor;
  final IconData icon;
  const ActionTriageLevel(
      this.code, this.apiValue, this.title, this.description, this.color, this.bgColor, this.icon);

  static ActionTriageLevel fromString(String? val) {
    if (val == null) return ActionTriageLevel.unknown;
    switch (val.toLowerCase()) {
      case 'red':
      case 'merah':
        return ActionTriageLevel.red;
      case 'orange':
      case 'oranye':
        return ActionTriageLevel.orange;
      case 'yellow':
      case 'kuning':
        return ActionTriageLevel.yellow;
      case 'green':
        return ActionTriageLevel.green;
      case 'hijau':
        return ActionTriageLevel.green;
      default:
        return ActionTriageLevel.unknown;
    }
  }
}

class Medication {
  String name;
  String dosage;
  String frequency;
  String schedule;

  Medication({
    required this.name,
    required this.dosage,
    this.frequency = '',
    this.schedule = '',
  });

  Map<String, dynamic> toJson() => {
    'name': name,
    'dosage': dosage,
    'schedule': schedule.isNotEmpty ? schedule : frequency,
  };

  factory Medication.fromJson(Map<String, dynamic> json) {
    return Medication(
      name: json['name']?.toString() ?? '',
      dosage: json['dosage']?.toString() ?? '',
      frequency: json['schedule']?.toString() ?? '1x sehari',
      schedule: json['schedule']?.toString() ?? '',
    );
  }
}

class UserProfile {
  String name;
  DateTime? birthDate;
  Gender? gender;
  double? heightCm;
  double? weightKg;
  String timeZone;
  String bloodType;
  String emergencyContactName;
  String emergencyContactPhone;
  String allergies;
  List<String> conditions;
  List<String> specialConditions;
  String clinicalNote;
  List<Medication> medications;
  bool medicationReviewed;
  bool allergiesReviewed;
  String goal; // 'daily_monitoring', 'early_awareness', 'fitness', 'other'
  String wearableProvider; // 'none', 'polar_h10', 'apple_watch', 'garmin', 'fitbit', 'other'
  bool notifMorningSummary;
  bool notifImportantAlerts;
  bool notifHealthEducation;
  String notifQuietStart;
  String notifQuietEnd;
  bool clinicianSharing;
  bool familySharing;

  UserProfile({
    this.name = '',
    this.birthDate,
    this.gender,
    this.heightCm,
    this.weightKg,
    this.timeZone = '',
    this.bloodType = '',
    this.emergencyContactName = '',
    this.emergencyContactPhone = '',
    this.allergies = '',
    this.conditions = const [],
    this.specialConditions = const [],
    this.clinicalNote = '',
    this.medications = const [],
    this.medicationReviewed = true,
    this.allergiesReviewed = true,
    this.goal = '',
    this.wearableProvider = '',
    this.notifMorningSummary = true,
    this.notifImportantAlerts = true,
    this.notifHealthEducation = true,
    this.notifQuietStart = '22:00',
    this.notifQuietEnd = '06:00',
    this.clinicianSharing = false,
    this.familySharing = false,
  });

  int? get age {
    final birth = birthDate;
    if (birth == null) return null;
    final now = DateTime.now();
    var a = now.year - birth.year;
    if (now.month < birth.month ||
        (now.month == birth.month && now.day < birth.day)) {
      a--;
    }
    return a;
  }

  Map<String, dynamic> toPatchJson() {
    return {
      if (birthDate != null) 'date_of_birth': birthDate!.toIso8601String(),
      if (timeZone.isNotEmpty) 'timezone': timeZone,
      if (gender != null) 'sex': gender!.apiValue,
      if (heightCm != null) 'height_cm': heightCm,
      if (weightKg != null) 'weight_kg': weightKg,
      'blood_type': bloodType,
      'emergency_contact_name': emergencyContactName,
      'emergency_contact_phone': emergencyContactPhone,
      'conditions': conditions,
      'allergies': allergies.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList(),
      'special_conditions': specialConditions,
      'clinical_note': clinicalNote,
      'medications': medications.map((m) => m.toJson()).toList(),
      'medication_reviewed': medicationReviewed,
      'allergies_reviewed': allergiesReviewed,
      if (goal.isNotEmpty) 'goal': goal,
      if (wearableProvider.isNotEmpty) 'wearable_provider': wearableProvider,
      'notification_preferences': {
        'morning_summary': notifMorningSummary,
        'important_alerts': notifImportantAlerts,
        'health_education': notifHealthEducation,
        'quiet_start': notifQuietStart,
        'quiet_end': notifQuietEnd,
      },
      'data_sharing': {
        'share_with_clinician': clinicianSharing,
        'share_with_family': familySharing,
      },
    };
  }

  factory UserProfile.fromJson(Map<String, dynamic> json, {String defaultName = ''}) {
    final bDate = DateTime.tryParse(json['date_of_birth']?.toString() ?? '');

    final notif = json['notification_preferences'] as Map<String, dynamic>? ?? {};
    final sharing = json['data_sharing'] as Map<String, dynamic>? ?? {};
    
    List<Medication> meds = [];
    if (json['medications'] is List) {
      meds = (json['medications'] as List).map((m) => Medication.fromJson(m as Map<String, dynamic>)).toList();
    }

    List<String> conds = [];
    if (json['conditions'] is List) {
      conds = (json['conditions'] as List).map((e) => e.toString()).toList();
    }

    String algText = '';
    if (json['allergies'] is List) {
      algText = (json['allergies'] as List).join(', ');
    } else if (json['allergies'] != null) {
      algText = json['allergies'].toString();
    }

    return UserProfile(
      name: json['name']?.toString() ?? defaultName,
      birthDate: bDate,
      gender: json['sex'] == null ? null : Gender.fromString(json['sex']?.toString()),
      heightCm: (json['height_cm'] as num?)?.toDouble(),
      weightKg: (json['weight_kg'] as num?)?.toDouble(),
      timeZone: json['timezone']?.toString() ?? '',
      conditions: conds,
      allergies: algText,
      specialConditions: (json['special_conditions'] as List?)?.map((e) => e.toString()).toList() ?? [],
      clinicalNote: json['clinical_note']?.toString() ?? '',
      medications: meds,
      medicationReviewed: json['medication_reviewed'] == true,
      allergiesReviewed: json['allergies_reviewed'] == true,
      goal: json['goal']?.toString() ?? '',
      wearableProvider: json['wearable_provider']?.toString() ?? '',
      notifMorningSummary: notif['morning_summary'] != false,
      notifImportantAlerts: notif['important_alerts'] != false,
      notifHealthEducation: notif['health_education'] != false,
      notifQuietStart: notif['quiet_start']?.toString() ?? '22:00',
      notifQuietEnd: notif['quiet_end']?.toString() ?? '06:00',
      bloodType: json['blood_type']?.toString() ?? '',
      emergencyContactName: json['emergency_contact_name']?.toString() ?? '',
      emergencyContactPhone: json['emergency_contact_phone']?.toString() ?? '',
      clinicianSharing: sharing['share_with_clinician'] == true,
      familySharing: sharing['share_with_family'] == true,
    );
  }
}

class WearableData {
  bool hasServerSamples;
  String deviceName;
  String provider;
  DateTime? lastSync;
  int heartRate;
  int baselineHr;
  int hrvRmssd;
  int steps;
  bool stepsEstimatedFromAcc;
  int spO2;
  double skinTemp;
  List<List<double>> recentAcceleration; // [ [x, y, z], ... ] in g

  WearableData({
    this.hasServerSamples = false,
    this.deviceName = '',
    this.provider = '',
    this.lastSync,
    this.heartRate = 0,
    this.baselineHr = 0,
    this.hrvRmssd = 0,
    this.steps = 0,
    this.stepsEstimatedFromAcc = false,
    this.spO2 = 0,
    this.skinTemp = 0,
    List<List<double>>? recentAcceleration,
  }) : recentAcceleration = recentAcceleration ?? [];

  /// Calculate estimated steps from tri-axial accelerometer magnitude peak detection
  static int calculateStepsFromAcc(List<List<double>> accSamples, {double peakThreshold = 1.15}) {
    if (accSamples.isEmpty) return 0;
    int stepCount = 0;
    bool isPeak = false;

    for (int i = 0; i < accSamples.length; i++) {
      final sample = accSamples[i];
      if (sample.length < 3) continue;
      final x = sample[0];
      final y = sample[1];
      final z = sample[2];
      // Vector magnitude |a| = sqrt(x^2 + y^2 + z^2)
      final magnitude = math.sqrt(x * x + y * y + z * z);

      if (magnitude > peakThreshold && !isPeak) {
        stepCount++;
        isPeak = true;
      } else if (magnitude < 1.05) {
        isPeak = false;
      }
    }
    return stepCount;
  }

  /// Calculates current motion intensity from tri-axial acceleration variance
  double get motionIntensity {
    if (recentAcceleration.isEmpty) return 0.0;
    double sumMag = 0.0;
    for (final s in recentAcceleration) {
      if (s.length >= 3) {
        sumMag += math.sqrt(s[0] * s[0] + s[1] * s[1] + s[2] * s[2]);
      }
    }
    final mean = sumMag / recentAcceleration.length;
    double sumSqDiff = 0.0;
    for (final s in recentAcceleration) {
      if (s.length >= 3) {
        final mag = math.sqrt(s[0] * s[0] + s[1] * s[1] + s[2] * s[2]);
        sumSqDiff += (mag - mean) * (mag - mean);
      }
    }
    return math.sqrt(sumSqDiff / recentAcceleration.length);
  }

  Map<String, dynamic> toSamplePayload() {
    throw StateError('Wearable samples must come from a connected device.');
  }
}

/// One manual measurement row (mockup halaman 5 – "Input Pengukuran").
class MeasurementEntry {
  final String key;
  final String label;
  final String unit;
  final IconData icon;
  final Color color;
  String? value;
  TimeOfDay? time;

  MeasurementEntry({
    required this.key,
    required this.label,
    required this.unit,
    required this.icon,
    required this.color,
    this.value,
    this.time,
  });
}

class EventItem {
  final String id;
  final String title;
  final String eventType;
  final IconData icon;
  final Color color;
  final DateTime timestamp;
  final String details;
  final num? value;
  final String? unit;

  EventItem({
    this.id = '',
    required this.title,
    this.eventType = 'other',
    required this.icon,
    required this.color,
    required this.timestamp,
    this.details = '',
    this.value,
    this.unit,
  });

  Map<String, dynamic> toJson() => {
    'event_type': eventType,
    'occurred_at': timestamp.toIso8601String(),
    'details': details.isNotEmpty ? details : title,
    if (value != null) 'value': value,
    if (unit != null) 'unit': unit,
  };

  factory EventItem.fromJson(Map<String, dynamic> json) {
    final type = json['event_type']?.toString() ?? 'other';
    final title = mapApiToEventTitle(type);
    final match = kEvents.firstWhere((e) => e.$1 == title, orElse: () => (title, Icons.event_note, Colors.teal));
    
    final time = DateTime.tryParse(json['occurred_at']?.toString() ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);

    return EventItem(
      id: json['_id']?.toString() ?? '',
      title: title,
      eventType: type,
      icon: match.$2,
      color: match.$3,
      timestamp: time,
      details: json['details']?.toString() ?? '',
      value: json['value'] as num?,
      unit: json['unit']?.toString(),
    );
  }
}

class PedagogyAnswer {
  final int number;
  final String question;
  final String algorithm;
  final String summary;
  final String detail;
  final String status;
  final Color statusColor;

  const PedagogyAnswer({
    required this.number,
    required this.question,
    required this.algorithm,
    required this.summary,
    required this.detail,
    required this.status,
    required this.statusColor,
  });
}

/// Scientific RAG citation returned by CAPAR insight
class ScientificCitation {
  final String title;
  final String summary;
  final String source;
  final String authors;
  final String year;
  final double relevance;

  const ScientificCitation({
    required this.title,
    required this.summary,
    required this.source,
    required this.authors,
    required this.year,
    required this.relevance,
  });

  factory ScientificCitation.fromJson(Map<String, dynamic> json) {
    return ScientificCitation(
      title: json['title']?.toString() ?? json['document_title']?.toString() ?? '',
      summary: json['evidence_summary']?.toString() ??
          json['summary']?.toString() ??
          json['snippet']?.toString() ??
          '',
      source: json['source']?.toString() ?? json['journal']?.toString() ?? '',
      authors: json['authors']?.toString() ?? '',
      year: json['year']?.toString() ?? '',
      relevance: (json['relevance'] as num?)?.toDouble() ??
          (json['relevance_score'] as num?)?.toDouble() ??
          0,
    );
  }
}

/// Structured follow-up prompt from CAPAR
class CaparFollowUpPrompt {
  final String status; // 'requested', 'already_answered', 'none'
  final String? segmentId;
  final String? message;
  final List<Map<String, dynamic>> questions;

  const CaparFollowUpPrompt({
    this.status = 'none',
    this.segmentId,
    this.message,
    this.questions = const [],
  });

  factory CaparFollowUpPrompt.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const CaparFollowUpPrompt();
    return CaparFollowUpPrompt(
      status: json['status']?.toString() ?? 'none',
      segmentId: json['triggered_by_segment_id']?.toString() ?? json['segment_id']?.toString(),
      message: json['message']?.toString(),
      questions: (json['questions'] as List?)
              ?.whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList() ??
          const [],
    );
  }
}
