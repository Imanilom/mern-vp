import 'package:flutter/material.dart';

class Participant {
  final String id;
  final String name;
  final String studyCode;
  final String pin;
  final int birthYear;
  final String gender;
  final double heightCm;
  final double weightKg;
  final String relevantCondition;
  final String staffContact;

  const Participant({
    required this.id,
    required this.name,
    required this.studyCode,
    required this.pin,
    required this.birthYear,
    required this.gender,
    required this.heightCm,
    required this.weightKg,
    required this.relevantCondition,
    required this.staffContact,
  });
}

class SensorReading {
  final DateTime timestamp;
  final int heartRate;
  final int rrInterval;
  final double rmssd;
  final double dfaAlpha1;
  final int signalQuality;
  final int battery;
  final String motionState;

  const SensorReading({
    required this.timestamp,
    required this.heartRate,
    required this.rrInterval,
    required this.rmssd,
    required this.dfaAlpha1,
    required this.signalQuality,
    required this.battery,
    required this.motionState,
  });
}

class ActivityItem {
  final String id;
  final String name;
  final IconData icon;
  final DateTime? startedAt;
  final int durationMinutes;

  const ActivityItem({
    required this.id,
    required this.name,
    required this.icon,
    this.startedAt,
    this.durationMinutes = 0,
  });
}

class SymptomReport {
  final List<String> symptoms;
  final double intensity;
  final String notes;
  final DateTime timestamp;

  const SymptomReport({
    required this.symptoms,
    required this.intensity,
    required this.notes,
    required this.timestamp,
  });
}

class TrajectoryEvent {
  final String id;
  final String type; // 'stable', 'recovering', 'deviation', 'alert'
  final String title;
  final String description;
  final double magnitude;
  final int durationMinutes;
  final String recoveryStatus;
  final DateTime timestamp;
  final String activity;

  const TrajectoryEvent({
    required this.id,
    required this.type,
    required this.title,
    required this.description,
    required this.magnitude,
    required this.durationMinutes,
    required this.recoveryStatus,
    required this.timestamp,
    required this.activity,
  });
}
