import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';
import '../input/symptom_input_screen.dart';

/// Halaman Ringkasan Catatan Harian Pasien
class DailySummaryScreen extends StatefulWidget {
  const DailySummaryScreen({super.key});

  @override
  State<DailySummaryScreen> createState() => _DailySummaryScreenState();
}

class _DailySummaryScreenState extends State<DailySummaryScreen> {
  late DateTime _selectedDate;
  bool _loadingDate = false;

  @override
  void initState() {
    super.initState();
    _selectedDate = DateUtils.dateOnly(DateTime.now());
  }

  Future<void> _selectDate() async {
    final selected = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2000),
      lastDate: DateUtils.dateOnly(DateTime.now()),
      helpText: 'Pilih tanggal catatan',
    );
    if (selected == null || !mounted) return;
    setState(() {
      _selectedDate = DateUtils.dateOnly(selected);
      _loadingDate = true;
    });
    await context.read<AppState>().fetchDailySummary(_selectedDate);
    if (mounted) setState(() => _loadingDate = false);
  }

  Future<void> _moveDate(int days) async {
    final date = _selectedDate.add(Duration(days: days));
    if (date.isAfter(DateUtils.dateOnly(DateTime.now()))) return;
    setState(() {
      _selectedDate = date;
      _loadingDate = true;
    });
    await context.read<AppState>().fetchDailySummary(_selectedDate);
    if (mounted) setState(() => _loadingDate = false);
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final rawCheckIns = s.dailySummaryData?['check_ins'];
    final latest =
        rawCheckIns is List && rawCheckIns.isNotEmpty && rawCheckIns.last is Map
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
    final symptomCodes =
        latest['symptoms'] is List ? latest['symptoms'] as List : const [];
    bool hasValue(dynamic item) =>
        item != null && (item is! String || item.trim().isNotEmpty);
    String value(dynamic item) =>
        !hasValue(item) ? 'Belum dicatat' : item.toString();
    final measurementValues = <String>[
      if (hasValue(measurements['systolic_bp']) &&
          hasValue(measurements['diastolic_bp']))
        'TD ${measurements['systolic_bp']}/${measurements['diastolic_bp']} mmHg',
      if (hasValue(measurements['temperature_c']))
        'Suhu ${measurements['temperature_c']}°C',
      if (hasValue(measurements['spo2_pct']))
        'SpO₂ ${measurements['spo2_pct']}%',
      if (hasValue(measurements['weight_kg']))
        'Berat ${measurements['weight_kg']} kg',
      if (hasValue(measurements['glucose_mg_dl']))
        'Glukosa ${measurements['glucose_mg_dl']} mg/dL',
      if (measurements['additional'] is List)
        ...(measurements['additional'] as List)
            .whereType<Map>()
            .where(
                (entry) => hasValue(entry['name']) && hasValue(entry['value']))
            .map((entry) =>
                '${entry['name']}: ${entry['value']}${hasValue(entry['unit']) ? ' ${entry['unit']}' : ''}'),
    ];
    final symptoms = symptomCodes.isEmpty
        ? (latest.isEmpty ? 'Belum dicatat' : 'Tidak ada gejala yang dicatat')
        : symptomCodes
            .map((e) => mapApiToSymptomLabel(e.toString()))
            .join(', ');
    final sleepDuration = sleep['duration_minutes'] is num
        ? '${(sleep['duration_minutes'] as num) ~/ 60}j ${((sleep['duration_minutes'] as num).round() % 60)}m'
        : 'Belum dicatat';
    final stressValue = latest['stress_level'];
    final recordedStress = StressLevel.fromApiValue(
      stressValue is num
          ? stressValue
          : num.tryParse(stressValue?.toString() ?? ''),
    );
    final sleepValues = <String>[
      if (sleep['duration_minutes'] is num) sleepDuration,
      if (hasValue(sleep['quality']))
        SleepQuality.fromApiValue(sleep['quality'].toString()).label,
      if (hasValue(sleep['bedtime'])) 'Tidur ${sleep['bedtime']}',
      if (hasValue(sleep['wake_time'])) 'Bangun ${sleep['wake_time']}',
      if (sleep['disturbances'] is Map)
        ...Map<String, dynamic>.from(sleep['disturbances'] as Map)
            .entries
            .where((entry) => entry.value is bool)
            .map((entry) {
          const labels = {
            'woke_frequently': 'Sering terbangun',
            'difficulty_falling_asleep': 'Sulit mulai tidur',
            'nightmares': 'Mimpi buruk',
          };
          return (entry.value as bool ? '' : 'Tidak ') +
              (labels[entry.key] ?? entry.key);
        }),
    ];
    const lifestyleLabels = {
      'caffeine': 'Kafein',
      'alcohol': 'Alkohol',
      'smoking': 'Merokok',
    };
    final medicationTime =
        DateTime.tryParse(latest['medication_taken_at']?.toString() ?? '');
    final lifestyleValues = <String>[
      if (hasValue(lifestyle['meal']))
        'Makan: ${lifestyle['meal'] is bool ? ((lifestyle['meal'] as bool) ? 'Ya' : 'Tidak') : value(lifestyle['meal'])}',
      if (hasValue(lifestyle['meal_count']))
        '${lifestyle['meal_count']} kali makan',
      for (final key in ['caffeine', 'alcohol', 'smoking'])
        if (lifestyle[key] is bool)
          '${lifestyleLabels[key]}: ${(lifestyle[key] as bool) ? 'Ya' : 'Tidak'}',
    ];
    final medicationValues = <String>[
      if (hasValue(latest['medication_taken']))
        latest['medication_taken'] is bool
            ? ((latest['medication_taken'] as bool)
                ? 'Obat diminum'
                : 'Obat tidak diminum')
            : value(latest['medication_taken']),
      if (hasValue(latest['medication_name']))
        'Obat: ${latest['medication_name']}',
      if (hasValue(latest['medication_dosage']))
        'Dosis: ${latest['medication_dosage']}',
      if (medicationTime != null)
        'Waktu: ${DateFormat('HH:mm').format(medicationTime.toLocal())}',
      if (hasValue(latest['medication_note']))
        'Catatan: ${latest['medication_note']}',
    ];
    final activityValues = <String>[
      if (hasValue(latest['activity']))
        mapApiToActivity(latest['activity'].toString()),
      if (hasValue(latest['posture']))
        'Posisi ${mapApiToActivity(latest['posture'].toString())}',
    ];
    final summaryRows = <_SummaryRowData>[
      if (hasValue(latest['feeling']))
        _SummaryRowData(
          icon: Icons.groups_2_outlined,
          label: 'Perasaan',
          trailing: Text(
              MoodRating.fromApiValue(latest['feeling'].toString()).label,
              style: AppTheme.font(size: 13, weight: FontWeight.w600)),
        ),
      if (latest['symptoms'] is List)
        _SummaryRowData(
          icon: Icons.coronavirus_outlined,
          label: 'Gejala',
          trailing: Text(
            symptoms,
            style: AppTheme.font(
              size: 13,
              color: symptomCodes.isNotEmpty
                  ? AppTheme.faceRed
                  : AppTheme.textPrimary,
              weight:
                  symptomCodes.isNotEmpty ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ),
      if (hasValue(latest['symptom_severity']))
        _SummaryRowData(
          icon: Icons.tune_rounded,
          label: 'Tingkat Gejala',
          trailing: Text('${latest['symptom_severity']}/10',
              style: AppTheme.font(size: 13)),
        ),
      if (activityValues.isNotEmpty)
        _SummaryRowData(
          icon: Icons.directions_run_outlined,
          label: 'Aktivitas & posisi',
          trailing: Text(
            activityValues.join(' · '),
            style: AppTheme.font(size: 13),
          ),
        ),
      if (recordedStress != null)
        _SummaryRowData(
          icon: Icons.psychology_outlined,
          label: 'Tingkat Stres',
          trailing: Text(recordedStress.label,
              style: AppTheme.font(size: 13, weight: FontWeight.w600)),
        ),
      if (lifestyleValues.isNotEmpty)
        _SummaryRowData(
          icon: Icons.restaurant_outlined,
          label: 'Kebiasaan harian',
          trailing: Text(
            lifestyleValues.join(' · '),
            style: AppTheme.font(size: 13),
          ),
        ),
      if (medicationValues.isNotEmpty)
        _SummaryRowData(
          icon: Icons.medication_outlined,
          label: 'Obat rutin',
          trailing: Text(
            medicationValues.join(' · '),
            style: AppTheme.font(size: 13),
          ),
        ),
      if (hasValue(latest['hydration_ml']))
        _SummaryRowData(
          icon: Icons.water_drop_outlined,
          label: 'Asupan air',
          trailing: Text('${latest['hydration_ml']} ml',
              style: AppTheme.font(size: 13)),
        ),
      if (sleepValues.isNotEmpty)
        _SummaryRowData(
          icon: Icons.bedtime_outlined,
          label: 'Tidur Semalam',
          trailing:
              Text(sleepValues.join(' · '), style: AppTheme.font(size: 13)),
        ),
      if (measurementValues.isNotEmpty)
        _SummaryRowData(
          icon: Icons.thermostat_outlined,
          label: 'Pengukuran Mandiri',
          trailing: Text(measurementValues.join(' · '),
              style: AppTheme.font(size: 13)),
        ),
      if (hasValue(latest['note']))
        _SummaryRowData(
          icon: Icons.description_outlined,
          label: 'Catatan Pribadi',
          trailing: Text(value(latest['note']),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTheme.font(size: 13)),
        ),
    ];

    return MockupScaffold(
      title: 'Ringkasan Catatan Harian',
      subtitle: Text(
        DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(_selectedDate),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          IconButton(
            tooltip: 'Pilih tanggal catatan',
            onPressed: _selectDate,
            icon: const Icon(Icons.calendar_month_outlined,
                color: AppTheme.primary),
          ),
          TextButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const SymptomInputScreen()),
            ),
            icon: const Icon(Icons.edit_outlined,
                size: 15, color: AppTheme.primary),
            label: Text('Ubah',
                style: AppTheme.font(
                    size: 12.5,
                    weight: FontWeight.w600,
                    color: AppTheme.primary)),
          ),
        ],
      ),
      body: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                tooltip: 'Hari sebelumnya',
                onPressed: () => _moveDate(-1),
                icon: const Icon(Icons.chevron_left_rounded),
              ),
              TextButton.icon(
                onPressed: _selectDate,
                icon: const Icon(Icons.event_outlined, size: 18),
                label: Text(
                    DateFormat('d MMM yyyy', 'id_ID').format(_selectedDate)),
              ),
              IconButton(
                tooltip: 'Hari berikutnya',
                onPressed: DateUtils.isSameDay(_selectedDate, DateTime.now())
                    ? null
                    : () => _moveDate(1),
                icon: const Icon(Icons.chevron_right_rounded),
              ),
            ],
          ),
          if (_loadingDate) const LinearProgressIndicator(),
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
                s.dataError ??
                    'Belum ada check-in untuk tanggal ini di server.',
                style: AppTheme.font(size: 12.5, color: AppTheme.textSecondary),
              ),
            ),
          if (summaryRows.isNotEmpty) _SummaryCard(rows: summaryRows),
          if (latest.isNotEmpty && summaryRows.isEmpty)
            Text(
              'Check-in tersimpan, tetapi tidak memiliki rincian untuk ditampilkan.',
              style: AppTheme.font(size: 12, color: AppTheme.textSecondary),
            ),
          const SizedBox(height: 14),
        ],
      ),
      bottom: ElevatedButton(
        onPressed: s.isSubmittingDaily
            ? null
            : () async {
                if (!s.isDailyDraftDirty) {
                  await s.fetchDailySummary();
                  if (context.mounted) {
                    showSaved(context, 'Ringkasan diperbarui dari server');
                  }
                  return;
                }
                final ok = await s.submitDaily();
                if (context.mounted) {
                  if (ok) {
                    showSaved(context, 'Check-in berhasil disimpan ke server.');
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                          content: Text(s.dataError ??
                              'Check-in gagal disimpan ke server.')),
                    );
                  }
                }
              },
        child: s.isSubmittingDaily
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Text(s.isDailyDraftDirty
                ? 'Kirim catatan ke server'
                : 'Perbarui ringkasan dari server'),
      ),
    );
  }
}

class _SummaryRowData {
  final IconData icon;
  final String label;
  final Widget trailing;
  _SummaryRowData(
      {required this.icon, required this.label, required this.trailing});
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
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Row(
                  children: [
                    Icon(r.icon, size: 18, color: AppTheme.primaryDark),
                    const SizedBox(width: 10),
                    Text(r.label,
                        style: AppTheme.font(
                            size: 13, color: AppTheme.textSecondary)),
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
