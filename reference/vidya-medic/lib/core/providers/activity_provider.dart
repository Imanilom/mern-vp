import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../shared/models/models.dart';

final activeActivityProvider = StateProvider<ActivityItem>((ref) {
  return const ActivityItem(
    id: "4",
    name: "Duduk Bekerja",
    icon: Icons.computer,
  );
});

final activityStartTimeProvider = StateProvider<DateTime>((ref) {
  // Default to 1 hour 23 mins ago for presentation consistency
  return DateTime.now().subtract(const Duration(hours: 1, minutes: 23));
});

final isMonitoringActiveProvider = StateProvider<bool>((ref) => true);
