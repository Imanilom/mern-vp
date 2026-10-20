import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../input/guided_daily_flow_screen.dart';
import '../profile/profile_screen.dart';
import '../scenarios/guided_baseline_session_screen.dart';

class ProfileSnapshotCard extends StatelessWidget {
  const ProfileSnapshotCard({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final profile = state.userProfile;
    final checkIns = state.dailySummaryData?['check_ins'];
    final latest =
        checkIns is List && checkIns.isNotEmpty && checkIns.last is Map
            ? checkIns.last as Map
            : null;
    bool isToday(dynamic timestamp) {
      final recordedAt =
          DateTime.tryParse(timestamp?.toString() ?? '')?.toLocal();
      return recordedAt != null &&
          DateUtils.isSameDay(recordedAt, DateTime.now());
    }

    final hasTodayCheckIn = checkIns is List &&
        checkIns.any((item) => item is Map && isToday(item['recorded_at']));
    final hasTodayWearableSample = state.wearableSamples.any((sample) =>
        sample['is_simulated'] != true && isToday(sample['recorded_at']));
    final dailyProgress = [
      hasTodayCheckIn,
      hasTodayWearableSample,
    ].where((complete) => complete).length;
    final sleep = latest?['sleep'] is Map
        ? Map<String, dynamic>.from(latest!['sleep'] as Map)
        : <String, dynamic>{};
    final fields = <(String, bool)>[
      ('Tanggal lahir', profile.birthDate != null),
      ('Jenis kelamin', profile.gender != null),
      ('Tinggi badan', profile.heightCm != null),
      ('Berat badan', profile.weightKg != null),
      ('Catatan tidur', sleep['duration_minutes'] is num),
      (
        'Data wearable',
        state.wearable.hasServerSamples || state.hasCaparRecords
      ),
    ];
    final completed = fields.where((field) => field.$2).length;
    final missing = fields.where((field) => !field.$2).toList();
    final sleepMinutes = sleep['duration_minutes'];
    final profileStats = <(String, String, IconData)>[
      if (profile.age != null)
        ('Usia', '${profile.age} th', Icons.cake_outlined),
      if (profile.gender != null)
        (
          'Profil',
          profile.gender == Gender.female ? 'Perempuan' : 'Laki-laki',
          Icons.person_outline_rounded,
        ),
      if (profile.heightCm != null)
        ('Tinggi', '${profile.heightCm!.round()} cm', Icons.height_rounded),
      if (profile.weightKg != null)
        (
          'Berat',
          '${profile.weightKg!.toStringAsFixed(0)} kg',
          Icons.monitor_weight_outlined
        ),
      if (sleepMinutes is num)
        (
          'Tidur tercatat',
          '${sleepMinutes ~/ 60}j ${sleepMinutes.round() % 60}m',
          Icons.bedtime_outlined,
        ),
      if (state.wearable.heartRate > 0)
        (
          'Detak terakhir',
          '${state.wearable.heartRate} bpm',
          Icons.favorite_border_rounded,
        ),
    ];
    return Card(
      margin: const EdgeInsets.only(top: 12),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const CircleAvatar(
                  backgroundColor: AppTheme.primarySoft,
                  child: Icon(Icons.accessibility_new_rounded,
                      color: AppTheme.primary),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Gambaran diri Anda',
                          style:
                              AppTheme.font(size: 14, weight: FontWeight.w800)),
                      Text(
                        'Profil terisi $completed dari ${fields.length} bagian',
                        style: AppTheme.font(
                            size: 11, color: AppTheme.textSecondary),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: 'Lengkapi profil',
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const ProfileScreen()),
                  ),
                  icon: const Icon(Icons.edit_outlined),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: LinearProgressIndicator(
                value: completed / fields.length,
                minHeight: 6,
                backgroundColor: AppTheme.fieldFill,
                color: AppTheme.primary,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              'Setiap bagian yang dilengkapi membantu membentuk gambaran personal Anda.',
              style: AppTheme.font(
                  size: 10.5, color: AppTheme.textMuted, height: 1.3),
            ),
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: AppTheme.fieldFill,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text('Progres pemantauan hari ini',
                            style: AppTheme.font(
                                size: 11.5, weight: FontWeight.w700)),
                      ),
                      Text('$dailyProgress/2',
                          style: AppTheme.font(
                              size: 11.5,
                              weight: FontWeight.w800,
                              color: AppTheme.primary)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: LinearProgressIndicator(
                      value: dailyProgress / 2,
                      minHeight: 5,
                      backgroundColor: Colors.white,
                      color: AppTheme.accent,
                    ),
                  ),
                  const SizedBox(height: 7),
                  Wrap(
                    spacing: 10,
                    runSpacing: 2,
                    children: [
                      _DailyProgressStep(
                        label: 'Catatan harian',
                        complete: hasTodayCheckIn,
                      ),
                      _DailyProgressStep(
                        label: 'Sampel wearable',
                        complete: hasTodayWearableSample,
                      ),
                    ],
                  ),
                  if (!hasTodayCheckIn || !hasTodayWearableSample)
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () {
                          state.update(() {
                            state.logDate = DateUtils.dateOnly(DateTime.now());
                          });
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => !hasTodayCheckIn
                                  ? const GuidedDailyFlowScreen()
                                  : const GuidedBaselineSessionScreen(),
                            ),
                          );
                        },
                        child: Text(
                            !hasTodayCheckIn ? 'Catat hari ini' : 'Rekam data'),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 10),
            if (profileStats.isEmpty)
              Text(
                'Tambahkan beberapa informasi dasar agar catatan dan wawasan bisa ditampilkan dengan konteks yang sesuai.',
                style: AppTheme.font(
                    size: 11.5, color: AppTheme.textSecondary, height: 1.4),
              )
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: profileStats
                    .map((item) => _ProfileFact(
                          label: item.$1,
                          value: item.$2,
                          icon: item.$3,
                        ))
                    .toList(),
              ),
            if (missing.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(11),
                decoration: BoxDecoration(
                  color: AppTheme.primarySoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Lengkapi data yang masih kosong',
                        style:
                            AppTheme.font(size: 11.5, weight: FontWeight.w700)),
                    const SizedBox(height: 3),
                    Text(
                      missing.map((field) => field.$1).join(' · '),
                      style: AppTheme.font(
                          size: 10.5,
                          color: AppTheme.textSecondary,
                          height: 1.3),
                    ),
                    const SizedBox(height: 6),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton.icon(
                        onPressed: () {
                          final needsProfile = missing.any((item) =>
                              item.$1 == 'Tanggal lahir' ||
                              item.$1 == 'Jenis kelamin' ||
                              item.$1 == 'Tinggi badan' ||
                              item.$1 == 'Berat badan');
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => needsProfile
                                  ? const ProfileScreen()
                                  : const GuidedDailyFlowScreen(),
                            ),
                          );
                        },
                        icon: const Icon(Icons.add_circle_outline, size: 17),
                        label: const Text('Lengkapi'),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Sesi perekaman sukarela membantu mengumpulkan data untuk baseline.',
                    style: AppTheme.font(
                        size: 10.5, color: AppTheme.textMuted, height: 1.3),
                  ),
                ),
                TextButton(
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const GuidedBaselineSessionScreen(),
                    ),
                  ),
                  child: const Text('Mulai'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _DailyProgressStep extends StatelessWidget {
  const _DailyProgressStep({
    required this.label,
    required this.complete,
  });

  final String label;
  final bool complete;

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            complete ? Icons.check_circle : Icons.circle_outlined,
            size: 14,
            color: complete ? AppTheme.statusGreen : AppTheme.textMuted,
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: AppTheme.font(
              size: 10.5,
              color: complete ? AppTheme.textPrimary : AppTheme.textMuted,
            ),
          ),
        ],
      );
}

class _ProfileFact extends StatelessWidget {
  const _ProfileFact({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFFF5F8F7),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppTheme.borderLight),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: AppTheme.primary),
            const SizedBox(width: 5),
            Text('$label · $value',
                style: AppTheme.font(size: 10.5, weight: FontWeight.w600)),
          ],
        ),
      );
}
