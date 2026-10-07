import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';
import '../input/symptom_input_screen.dart';

/// Halaman Ringkasan Catatan Harian Pasien
class DailySummaryScreen extends StatelessWidget {
  const DailySummaryScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final rawCheckIns = s.dailySummaryData?['check_ins'];
    final latest = rawCheckIns is List && rawCheckIns.isNotEmpty && rawCheckIns.last is Map
        ? Map<String, dynamic>.from(rawCheckIns.last as Map)
        : <String, dynamic>{};
    final sleep = latest['sleep'] is Map
        ? Map<String, dynamic>.from(latest['sleep'] as Map)
        : <String, dynamic>{};
    final lifestyle = latest['lifestyle'] is Map
        ? Map<String, dynamic>.from(latest['lifestyle'] as Map)
        : <String, dynamic>{};
    final measurements = latest['measurements'] is Map
        ? Map<String, dynamic>.from(latest['measurements'] as Map)
        : <String, dynamic>{};
    final symptomCodes = latest['symptoms'] is List ? latest['symptoms'] as List : const [];
    String value(dynamic item) => item == null || item.toString().isEmpty ? 'Belum dicatat' : item.toString();
    final bp = measurements['systolic_bp'] == null || measurements['diastolic_bp'] == null
        ? 'Belum dicatat'
        : '${measurements['systolic_bp']}/${measurements['diastolic_bp']} mmHg';
    final symptoms = symptomCodes.isEmpty
        ? (latest.isEmpty ? 'Belum dicatat' : 'Tidak ada gejala yang dicatat')
        : symptomCodes.map((e) => mapApiToSymptomLabel(e.toString())).join(', ');
    final sleepDuration = sleep['duration_minutes'] is num
        ? '${(sleep['duration_minutes'] as num) ~/ 60}j ${((sleep['duration_minutes'] as num).round() % 60)}m'
        : 'Belum dicatat';
    final stressValue = latest['stress_level'];
    final recordedStress = StressLevel.fromApiValue(
      stressValue is num
          ? stressValue
          : num.tryParse(stressValue?.toString() ?? ''),
    );

    return MockupScaffold(
      title: 'Ringkasan Hari Ini',
      subtitle: DateLine(date: s.logDate, centered: true),
      trailing: TextButton.icon(
        onPressed: () => Navigator.push(
          context,
          MaterialPageRoute(builder: (_) => const SymptomInputScreen()),
        ),
        icon: const Icon(Icons.edit_outlined, size: 15, color: AppTheme.primary),
        label: Text('Ubah', style: AppTheme.font(size: 12.5, weight: FontWeight.w600, color: AppTheme.primary)),
      ),
      body: Column(
        children: [
          if (latest.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: AppTheme.fieldFill,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                s.dataError ?? 'Belum ada check-in untuk tanggal ini di server.',
                style: AppTheme.font(size: 12.5, color: AppTheme.textSecondary),
              ),
            ),
          _SummaryCard(
            rows: [
              _SummaryRowData(
                icon: Icons.groups_2_outlined,
                label: 'Perasaan',
                trailing: Text(value(latest['feeling']), style: AppTheme.font(size: 13, weight: FontWeight.w600)),
              ),
              _SummaryRowData(
                icon: Icons.coronavirus_outlined,
                label: 'Gejala',
                trailing: Text(
                  symptoms,
                  style: AppTheme.font(
                    size: 13,
                    color: symptomCodes.isNotEmpty ? AppTheme.faceRed : AppTheme.textPrimary,
                    weight: symptomCodes.isNotEmpty ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ),
              _SummaryRowData(
                icon: Icons.directions_run_outlined,
                label: 'Aktivitas',
                trailing: Text(value(latest['activity'] == null ? null : mapApiToActivity(latest['activity'].toString())), style: AppTheme.font(size: 13)),
              ),
              _SummaryRowData(
                icon: Icons.psychology_outlined,
                label: 'Tingkat Stres',
                trailing: Text(
                  recordedStress?.label ?? 'Belum dicatat',
                  style: AppTheme.font(size: 13, weight: FontWeight.w600),
                ),
              ),
              _SummaryRowData(
                icon: Icons.restaurant_outlined,
                label: 'Makan',
                trailing: Text(value(lifestyle['meal']), style: AppTheme.font(size: 13)),
              ),
              _SummaryRowData(
                icon: Icons.medication_outlined,
                label: 'Minum Obat Rutin',
                trailing: Text(value(latest['medication_taken']), style: AppTheme.font(size: 13)),
              ),
              _SummaryRowData(
                icon: Icons.bedtime_outlined,
                label: 'Tidur Semalam',
                trailing: Text('$sleepDuration (${value(sleep['quality'])})', style: AppTheme.font(size: 13)),
              ),
              _SummaryRowData(
                icon: Icons.thermostat_outlined,
                label: 'Pengukuran Mandiri',
                trailing: Text('TD $bp • Suhu ${value(measurements['temperature_c'])}', style: AppTheme.font(size: 13)),
              ),
              _SummaryRowData(
                icon: Icons.description_outlined,
                label: 'Catatan Pribadi',
                trailing: Text(value(latest['note']),
                    maxLines: 2, overflow: TextOverflow.ellipsis, style: AppTheme.font(size: 13)),
              ),
            ],
          ),
          const SizedBox(height: 14),
        ],
      ),
      bottom: ElevatedButton(
        onPressed: () async {
          if (!s.isDailyDraftDirty) {
            await s.fetchDailySummary();
            if (context.mounted) showSaved(context, 'Ringkasan diperbarui dari server');
            return;
          }
          final ok = await s.submitDaily();
          if (context.mounted) {
            if (ok) {
              showSaved(context, 'Check-in berhasil disimpan ke server.');
            } else {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(s.dataError ?? 'Check-in gagal disimpan ke server.')),
              );
            }
          }
        },
        child: Text(s.isDailyDraftDirty ? 'Kirim catatan ke server' : 'Perbarui ringkasan dari server'),
      ),
    );
  }
}

class _SummaryRowData {
  final IconData icon;
  final String label;
  final Widget trailing;
  _SummaryRowData({required this.icon, required this.label, required this.trailing});
}

class _SummaryCard extends StatelessWidget {
  final List<_SummaryRowData> rows;
  const _SummaryCard({required this.rows});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppTheme.borderLight),
        boxShadow: AppTheme.shadowSoft,
      ),
      child: Column(
        children: rows.asMap().entries.map((e) {
          final isLast = e.key == rows.length - 1;
          final r = e.value;
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    Icon(r.icon, size: 18, color: AppTheme.primaryDark),
                    const SizedBox(width: 10),
                    Text(r.label, style: AppTheme.font(size: 13, color: AppTheme.textSecondary)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Align(
                        alignment: Alignment.centerRight,
                        child: r.trailing,
                      ),
                    ),
                  ],
                ),
              ),
              if (!isLast) const Divider(height: 1, indent: 14, endIndent: 14),
            ],
          );
        }).toList(),
      ),
    );
  }
}
