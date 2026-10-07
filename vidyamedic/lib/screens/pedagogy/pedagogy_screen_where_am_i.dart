import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';
import 'pedagogy_screen_what_changed.dart';

class WhereAmIScreen extends StatelessWidget {
  const WhereAmIScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final profile = state.userProfile;
    final deviation = state.latestCaparMahalanobis;
    final checkIns = state.dailySummaryData?['check_ins'];
    final latestCheckIn = checkIns is List && checkIns.isNotEmpty && checkIns.last is Map
        ? Map<String, dynamic>.from(checkIns.last as Map)
        : <String, dynamic>{};
    final sleep = latestCheckIn['sleep'] is Map
        ? Map<String, dynamic>.from(latestCheckIn['sleep'] as Map)
        : <String, dynamic>{};
    final where = _whereAmI(state);
    final bool isAvailable = deviation != null && deviation['available'] == true;
    final displayName = profile.name.isEmpty ? 'Pasien' : profile.name;
    final caparState = isAvailable ? deviation['state']?.toString() ?? 'State CAPAR tersedia' : 'Belum cukup data untuk status personal';

    return MockupScaffold(
      title: 'Kondisi Saat Ini',
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Halo, $displayName', style: AppTheme.font(size: 17, weight: FontWeight.w800)),
          const SizedBox(height: 12),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isAvailable ? AppTheme.primarySoft : AppTheme.statusYellowBg,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: AppTheme.borderLight),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  caparState,
                  style: AppTheme.font(size: 14, weight: FontWeight.w800, color: AppTheme.primaryDark),
                ),
                const SizedBox(height: 5),
                Text(
                  where?['meaning']?.toString() ??
                      'Status akan tampil setelah data yang lolos quality gate tersedia di CAPAR.',
                  style: AppTheme.font(size: 12.5, color: AppTheme.textSecondary, height: 1.35),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _metricGrid([
            ('Detak jantung', state.wearable.heartRate > 0 ? '${state.wearable.heartRate} bpm' : 'Belum ada'),
            ('Jarak Mahalanobis', deviation?['distance']?.toString() ?? 'Belum ada'),
            (
              state.wearable.stepsEstimatedFromAcc
                  ? 'Perkiraan langkah dari ACC'
                  : 'Langkah',
              state.wearable.steps > 0
                  ? '${state.wearable.steps}'
                  : 'Belum ada',
            ),
            (
              'Tidur terakhir',
              sleep['duration_minutes'] is num
                  ? '${((sleep['duration_minutes'] as num) / 60).toStringAsFixed(1)} jam'
                  : 'Belum dicatat',
            ),
          ]),
          const SizedBox(height: 14),
          _metricGrid([
            ('HRV RMSSD', state.wearable.hrvRmssd > 0 ? '${state.wearable.hrvRmssd} ms' : 'Belum ada'),
            ('SpO₂', state.wearable.spO2 > 0 ? '${state.wearable.spO2}%' : 'Belum ada'),
            ('Baseline matang', _matureBaselineCount(state)),
            ('Kualitas data', deviation?['quality']?.toString() ?? 'Belum tersedia'),
          ]),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(13),
              border: Border.all(color: AppTheme.borderLight),
            ),
            child: Text(
              isAvailable
                  ? 'Pembanding Mahalanobis: baseline aktivitas ${deviation['activity'] ?? 'tidak diketahui'} • periode ${deviation['time_period'] ?? 'tidak diketahui'} • kematangan ${deviation['baseline_level'] ?? 'belum tersedia'}.'
                  : 'Jarak Mahalanobis menunggu baseline yang sesuai dengan aktivitas dan periode waktu.',
              style: AppTheme.font(
                  size: 11.5,
                  color: AppTheme.textSecondary,
                  height: 1.35),
            ),
          ),
          const SizedBox(height: 14),
          if (state.dataError != null)
            Text(state.dataError!, style: AppTheme.font(size: 11.5, color: AppTheme.statusRed)),
          OutlinedButton(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const WhatChangedScreen()),
            ),
            child: const Text('Lihat apa yang berubah'),
          ),
        ],
      ),
    );
  }

  Map<String, dynamic>? _whereAmI(AppState state) {
    final capar = state.rawCaparInsights?['capar'];
    final pedagogy = capar is Map ? capar['pedagogy'] : null;
    final where = pedagogy is Map ? pedagogy['where_am_i'] : null;
    return where is Map ? Map<String, dynamic>.from(where) : null;
  }

  String _matureBaselineCount(AppState state) {
    final baseline = (state.rawCaparInsights?['capar'] as Map?)?['baseline'];
    return baseline is Map ? baseline['mature_contexts']?.toString() ?? 'Belum ada' : 'Belum ada';
  }

  Widget _metricGrid(List<(String, String)> entries) => Row(
        children: entries.map((entry) {
          final index = entries.indexOf(entry);
          return Expanded(
            child: Container(
              margin: EdgeInsets.only(right: index == entries.length - 1 ? 0 : 8),
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(13),
                border: Border.all(color: AppTheme.borderLight),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(entry.$1, style: AppTheme.font(size: 10.5, color: AppTheme.textMuted)),
                  const SizedBox(height: 5),
                  Text(entry.$2, style: AppTheme.font(size: 12, weight: FontWeight.w700)),
                ],
              ),
            ),
          );
        }).toList(),
      );
}
