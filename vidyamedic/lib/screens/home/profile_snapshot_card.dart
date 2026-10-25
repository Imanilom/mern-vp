import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../profile/profile_screen.dart';

class ProfileSnapshotCard extends StatelessWidget {
  const ProfileSnapshotCard({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final profile = state.userProfile;
    final fields = <(String, bool)>[
      ('Tanggal lahir', profile.birthDate != null),
      ('Jenis kelamin', profile.gender != null),
      ('Tinggi badan', profile.heightCm != null),
      ('Berat badan', profile.weightKg != null),
    ];
    final completed = fields.where((field) => field.$2).length;
    final missing = fields.where((field) => !field.$2).toList();
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
                          final firstMissing = missing.first.$1;
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) =>
                                  ProfileScreen(openEditorFor: firstMissing),
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
          ],
        ),
      ),
    );
  }
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
