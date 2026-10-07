import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';

/// Guided step-by-step wizard through the mobile daily input pipeline
/// (Mockup Halaman 2, 4, 5, 6 - Langkah 5 sampai 11):
/// Step 5: Aktivitas & Gaya Hidup
/// Step 6: Gejala & Perasaan (Catat Hari Ini)
/// Step 7: Input Tidur (Tidur Malam Ini)
/// Step 8: Pengukuran Manual
/// Step 9: Event Marker
/// Step 10: Catatan Saya
/// Step 11: Ringkasan Hari Ini
class GuidedDailyFlowScreen extends StatefulWidget {
  final int initialStep;
  const GuidedDailyFlowScreen({super.key, this.initialStep = 5});

  @override
  State<GuidedDailyFlowScreen> createState() => _GuidedDailyFlowScreenState();
}

class _GuidedDailyFlowScreenState extends State<GuidedDailyFlowScreen> {
  late int _step; // 5 to 11
  final _pageController = PageController();

  // Temporary / working state for Step 5
  late String _activity;
  StressLevel? _stress;
  final TextEditingController _mealCountCtrl = TextEditingController();
  late bool _kafein;
  late bool _alkohol;
  late bool _merokok;
  late bool _minumObat;

  // Temporary / working state for Step 6
  late MoodRating _mood;
  late List<String> _symptoms;
  late double _symptomLevel;

  // Temporary / working state for Step 7
  late SleepQuality _sleepQuality;
  late TimeOfDay _bedTime;
  late TimeOfDay _wakeTime;
  late bool _wakeOften;
  late bool _hardToSleep;
  late bool _nightmare;

  // Step 9
  String _selectedEvent = 'Mulai olahraga';
  bool _isSavingEvent = false;
  bool _isSubmitting = false;

  // Step 10
  late final TextEditingController _noteCtrl;

  @override
  void initState() {
    super.initState();
    _step = widget.initialStep.clamp(5, 11);
    final s = context.read<AppState>();

    _activity = s.activity;
    _stress = s.stress;
    _mealCountCtrl.text = s.mealCount?.toString() ?? '';
    _kafein = s.habitCaffeine;
    _alkohol = s.habitAlcohol;
    _merokok = s.habitSmoking;
    _minumObat = s.habitMedication;

    _mood = s.mood;
    _symptoms = List.from(s.symptoms);
    _symptomLevel = s.symptomLevel;

    _sleepQuality = s.sleepQuality;
    _bedTime = s.bedTime;
    _wakeTime = s.wakeTime;
    _wakeOften = s.sleepWakeOften;
    _hardToSleep = s.sleepHardToSleep;
    _nightmare = s.sleepNightmare;

    _noteCtrl = TextEditingController(text: s.note);
  }

  @override
  void dispose() {
    _pageController.dispose();
    _noteCtrl.dispose();
    _mealCountCtrl.dispose();
    super.dispose();
  }

  void _saveCurrentStepToState() {
    final s = context.read<AppState>();
    s.update(() {
      // Step 5
      s.activity = _activity;
      s.stress = _stress;
      final mealCount = int.tryParse(_mealCountCtrl.text.trim());
      if (mealCount != null && mealCount >= 0 && mealCount <= 20) {
        s.mealCount = mealCount;
        s.habitMeal = mealCount > 0;
      }
      s.habitCaffeine = _kafein;
      s.habitAlcohol = _alkohol;
      s.habitSmoking = _merokok;
      s.habitMedication = _minumObat;

      // Step 6
      s.mood = _mood;
      s.symptoms = List.from(_symptoms);
      s.symptomLevel = _symptomLevel;

      // Step 7
      s.sleepMinutes = calculateSleepDurationMinutes(_bedTime, _wakeTime);
      s.sleepQuality = _sleepQuality;
      s.bedTime = _bedTime;
      s.wakeTime = _wakeTime;
      s.sleepWakeOften = _wakeOften;
      s.sleepHardToSleep = _hardToSleep;
      s.sleepNightmare = _nightmare;

      // Step 10
      s.note = _noteCtrl.text.trim();
    });
  }

  void _next() {
    if (_step == 5) {
      final mealCount = int.tryParse(_mealCountCtrl.text.trim());
      if (mealCount == null || mealCount < 0 || mealCount > 20) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Masukkan jumlah makan hari ini (0 sampai 20 kali).'),
          ),
        );
        return;
      }
    }
    _saveCurrentStepToState();
    final s = context.read<AppState>();
    switch (_step) {
      case 5:
        s.confirmDailySection('activity');
        break;
      case 6:
        s.confirmDailySection('symptoms');
        break;
      case 7:
        s.confirmDailySection('sleep');
        break;
      case 8:
        s.confirmDailySection('measurements');
        break;
      case 10:
        s.confirmDailySection('note');
        break;
    }
    if (_step < 11) {
      setState(() => _step++);
    } else {
      _finish();
    }
  }

  void _back() {
    _saveCurrentStepToState();
    if (_step > 5) {
      setState(() => _step--);
    } else {
      Navigator.pop(context);
    }
  }

  Future<void> _finish() async {
    if (_isSubmitting) return;
    setState(() => _isSubmitting = true);
    final s = context.read<AppState>();
    _saveCurrentStepToState();
    for (final section in ['activity', 'symptoms', 'sleep', 'measurements', 'note']) {
      s.confirmDailySection(section);
    }
    final saved = await s.submitDaily();
    if (!mounted) return;
    setState(() => _isSubmitting = false);
    if (!saved) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.dataError ?? 'Data harian gagal disimpan ke server.')),
      );
      return;
    }
    showSaved(context, 'Semua data harian berhasil disimpan ke server.');
    Navigator.pop(context);
  }

  String get _title {
    switch (_step) {
      case 5:
        return 'Aktivitas & Gaya Hidup';
      case 6:
        return 'Catat Hari Ini';
      case 7:
        return 'Tidur Malam Ini';
      case 8:
        return 'Input Pengukuran';
      case 9:
        return 'Tambah Event';
      case 10:
        return 'Catatan Saya';
      case 11:
        return 'Ringkasan Hari Ini';
      default:
        return 'Input Harian';
    }

  }

  String _formatSleepDuration(int minutes) {
    final hours = minutes ~/ 60;
    final remainingMinutes = minutes % 60;
    return remainingMinutes == 0
        ? '$hours jam'
        : '$hours jam $remainingMinutes menit';
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();

    return PopScope(
      canPop: _step == 5,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _back();
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF6F9F8),
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Container(
              color: Colors.white,
              child: Scaffold(
                backgroundColor: Colors.white,
                appBar: AppBar(
                  leading: IconButton(
                    icon: const Icon(Icons.chevron_left_rounded, size: 30),
                    onPressed: _back,
                  ),
                  title: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_title, style: AppTheme.font(size: 16, weight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      DateLine(date: s.logDate, centered: true),
                    ],
                  ),
                  actions: [
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.only(right: 16),
                        child: Text(
                          'Langkah $_step/11',
                          style: AppTheme.font(
                            size: 12,
                            weight: FontWeight.w600,
                            color: AppTheme.primary,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                body: SafeArea(
                  top: false,
                  child: Column(
                    children: [
                      // Linear progress across 5-11
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: (_step - 4) / 7.0,
                            minHeight: 5,
                            backgroundColor: const Color(0xFFE6ECEA),
                            valueColor: const AlwaysStoppedAnimation(AppTheme.primary),
                          ),
                        ),
                      ),
                      Expanded(
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 260),
                          transitionBuilder: (child, a) => FadeTransition(
                            opacity: a,
                            child: SlideTransition(
                              position: Tween(
                                begin: const Offset(0.04, 0),
                                end: Offset.zero,
                              ).animate(a),
                              child: child,
                            ),
                          ),
                          child: SingleChildScrollView(
                            key: ValueKey(_step),
                            padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                            child: switch (_step) {
                              5 => _step5Activity(),
                              6 => _step6Symptoms(),
                              7 => _step7Sleep(),
                              8 => _step8Measurements(),
                              9 => _step9Event(),
                              10 => _step10Notes(),
                              _ => _step11Summary(),
                            },
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                        child: _bottomButtons(),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _bottomButtons() {
    if (_step == 11) {
      return Row(
        children: [
          Expanded(
            child: OutlinedButton(
              onPressed: () => setState(() => _step = 5),
              child: const Text('Ubah Data'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _finish,
              child: _isSubmitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Simpan Semua Data'),
            ),
          ),
        ],
      );
    }

    return Row(
      children: [
        if (_step > 5) ...[
          Expanded(
            child: OutlinedButton(
              onPressed: _back,
              child: const Text('Kembali'),
            ),
          ),
          const SizedBox(width: 12),
        ],
        Expanded(
          flex: _step > 5 ? 2 : 1,
          child: ElevatedButton(
            onPressed: _isSubmitting ? null : _next,
            child: Text(_step == 10 ? 'Lihat Ringkasan' : 'Simpan & Lanjut'),
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 5: Aktivitas & Gaya Hidup
  // ---------------------------------------------------------------------------
  Widget _step5Activity() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionTitle('Apa yang sedang Anda lakukan?', padding: EdgeInsets.only(top: 4, bottom: 12)),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            crossAxisSpacing: 8,
            mainAxisSpacing: 10,
            childAspectRatio: 0.95,
          ),
          itemCount: kActivities.length,
          itemBuilder: (context, i) {
            final a = kActivities[i];
            return ActivityTile(
              label: a.$1,
              icon: a.$2,
              selected: _activity == a.$1,
              onTap: () => setState(() => _activity = a.$1),
            );
          },
        ),
        const SectionTitle('Tingkat stres saat ini (opsional)'),
        Row(
          children: StressLevel.values
              .map((lvl) => Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: FaceChoiceTile(
                        label: lvl.label,
                        face: lvl.face,
                        color: lvl.color,
                        selected: _stress == lvl,
                        onTap: () => setState(() => _stress = lvl),
                      ),
                    ),
                  ))
              .toList(),
        ),
        const SectionTitle('Apakah Anda baru saja?'),
        const Text('Berapa kali Anda makan hari ini?'),
        const SizedBox(height: 6),
        TextField(
          controller: _mealCountCtrl,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(
            hintText: 'Contoh: 3',
            suffixText: 'kali',
          ),
        ),
        const SizedBox(height: 8),
        ToggleRow(
          icon: Icons.coffee,
          label: 'Minum kafein (kopi/teh)',
          value: _kafein,
          onChanged: (v) => setState(() => _kafein = v),
        ),
        ToggleRow(
          icon: Icons.local_bar,
          label: 'Minum alkohol',
          value: _alkohol,
          onChanged: (v) => setState(() => _alkohol = v),
        ),
        ToggleRow(
          icon: Icons.smoking_rooms,
          label: 'Merokok',
          value: _merokok,
          onChanged: (v) => setState(() => _merokok = v),
        ),
        ToggleRow(
          icon: Icons.medication_outlined,
          label: 'Minum obat',
          value: _minumObat,
          onChanged: (v) => setState(() => _minumObat = v),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 6: Gejala & Perasaan (Catat Hari Ini)
  // ---------------------------------------------------------------------------
  Widget _step6Symptoms() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionTitle('Bagaimana perasaan Anda?', padding: EdgeInsets.only(top: 4, bottom: 10)),
        Row(
          children: MoodRating.values
              .map((m) => Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: FaceChoiceTile(
                        label: m.label,
                        face: m.face,
                        color: m.color,
                        selected: _mood == m,
                        onTap: () => setState(() => _mood = m),
                      ),
                    ),
                  ))
              .toList(),
        ),
        const SectionTitle('Apakah ada gejala?'),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            crossAxisSpacing: 6,
            mainAxisSpacing: 10,
            childAspectRatio: 0.85,
          ),
          itemCount: kSymptoms.length,
          itemBuilder: (context, i) {
            final item = kSymptoms[i];
            final sel = _symptoms.contains(item.label);
            return IconChoiceTile(
              label: item.label,
              icon: item.icon,
              color: item.color,
              selected: sel,
              onTap: () {
                setState(() {
                  if (item.label == kNoSymptom) {
                    _symptoms = [kNoSymptom];
                    return;
                  }
                  _symptoms.remove(kNoSymptom);
                  _symptoms.contains(item.label)
                      ? _symptoms.remove(item.label)
                      : _symptoms.add(item.label);
                  if (_symptoms.isEmpty) _symptoms = [kNoSymptom];
                });
              },
            );
          },
        ),
        const SectionTitle('Tingkat gejala'),
        SliderTheme(
          data: SliderTheme.of(context).copyWith(
            activeTrackColor: AppTheme.primary,
            inactiveTrackColor: const Color(0xFFE2EBE7),
            thumbColor: AppTheme.primary,
            overlayColor: AppTheme.primary.withValues(alpha: 0.15),
            trackHeight: 4,
          ),
          child: Slider(
            value: _symptomLevel,
            min: 0,
            max: 2,
            divisions: 2,
            onChanged: (v) => setState(() => _symptomLevel = v),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: ['Ringan', 'Sedang', 'Berat']
                .asMap()
                .entries
                .map((e) => Text(
                      e.value,
                      style: AppTheme.font(
                        size: 12,
                        weight: (_symptomLevel.round() == e.key) ? FontWeight.w700 : FontWeight.w500,
                        color: (_symptomLevel.round() == e.key) ? AppTheme.primaryDark : AppTheme.textMuted,
                      ),
                    ))
                .toList(),
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 7: Input Tidur (Tidur Malam Ini)
  // ---------------------------------------------------------------------------
  Widget _step7Sleep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionTitle('Durasi tidur (dihitung dari waktu tidur dan bangun)'),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppTheme.border),
          ),
          child: Text(
            _formatSleepDuration(
                calculateSleepDurationMinutes(_bedTime, _wakeTime)),
            style: AppTheme.font(size: 16, weight: FontWeight.w700),
          ),
        ),
        const SectionTitle('Kualitas tidur'),
        Row(
          children: SleepQuality.values
              .map((q) => Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: FaceChoiceTile(
                        label: q.label,
                        face: q.face,
                        color: q.color,
                        selected: _sleepQuality == q,
                        onTap: () => setState(() => _sleepQuality = q),
                      ),
                    ),
                  ))
              .toList(),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _timeBox(
                'Waktu tidur',
                _bedTime,
                () async {
                  final t = await showTimePicker(context: context, initialTime: _bedTime);
                  if (t != null) {
                    setState(() {
                      _bedTime = t;
                    });
                  }
                },
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _timeBox(
                'Waktu bangun',
                _wakeTime,
                () async {
                  final t = await showTimePicker(context: context, initialTime: _wakeTime);
                  if (t != null) {
                    setState(() {
                      _wakeTime = t;
                    });
                  }
                },
              ),
            ),
          ],
        ),
        const SectionTitle('Gangguan tidur'),
        ToggleRow(
          icon: Icons.access_time_rounded,
          label: 'Sering terbangun',
          value: _wakeOften,
          onChanged: (v) => setState(() => _wakeOften = v),
        ),
        ToggleRow(
          icon: Icons.nightlight_outlined,
          label: 'Sulit tidur',
          value: _hardToSleep,
          onChanged: (v) => setState(() => _hardToSleep = v),
        ),
        ToggleRow(
          icon: Icons.psychology_outlined,
          label: 'Mimpi buruk',
          value: _nightmare,
          onChanged: (v) => setState(() => _nightmare = v),
        ),
      ],
    );
  }

  Widget _timeBox(String label, TimeOfDay time, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: AppTheme.font(size: 11.5, color: AppTheme.textMuted)),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(fmtTime(time), style: AppTheme.font(size: 15, weight: FontWeight.w700)),
                const Icon(Icons.access_time_rounded, size: 17, color: AppTheme.textSecondary),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 8: Pengukuran Manual
  // ---------------------------------------------------------------------------
  Widget _step8Measurements() {
    final s = context.watch<AppState>();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Catat parameter vital manual seperti tensimeter atau timbangan badan (opsional).',
          style: AppTheme.font(size: 13, color: AppTheme.textSecondary, height: 1.35),
        ),
        const SizedBox(height: 12),
        ...s.measurements.map((m) => Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.borderLight),
                boxShadow: AppTheme.shadowSoft,
              ),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(color: m.color.withValues(alpha: 0.12), shape: BoxShape.circle),
                    child: Icon(m.icon, color: m.color, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(m.label, style: AppTheme.font(size: 13, color: AppTheme.textSecondary)),
                        const SizedBox(height: 2),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(m.value ?? '-', style: AppTheme.font(size: 16, weight: FontWeight.w700)),
                            const SizedBox(width: 4),
                            Text(m.unit, style: AppTheme.font(size: 11.5, color: AppTheme.textMuted)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.edit_outlined, size: 18, color: AppTheme.textSecondary),
                    onPressed: () => _editMeasurement(context, m),
                  ),
                ],
              ),
            )),
      ],
    );
  }

  void _editMeasurement(BuildContext context, MeasurementEntry entry) {
    final s = context.read<AppState>();
    final valCtrl = TextEditingController(text: entry.value ?? '');
    TimeOfDay t = entry.time ?? TimeOfDay.now();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocalState) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Ubah ${entry.label}', style: AppTheme.font(size: 17, weight: FontWeight.w700)),
              const FieldLabel('Nilai pengukuran'),
              TextField(
                controller: valCtrl,
                keyboardType: TextInputType.text,
                decoration: InputDecoration(
                  hintText: 'Contoh: ${entry.key == "bp" ? "120/80" : "36.5"}',
                  suffixText: entry.unit,
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () {
                  s.update(() {
                    entry.value = valCtrl.text.trim().isEmpty ? null : valCtrl.text.trim();
                    entry.time = t;
                  });
                  Navigator.pop(ctx);
                },
                child: const Text('Simpan'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 9: Event Marker
  // ---------------------------------------------------------------------------
  Widget _step9Event() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Tandai peristiwa khusus yang berpotensi memengaruhi detak jantung Anda.',
          style: AppTheme.font(size: 13, color: AppTheme.textSecondary, height: 1.35),
        ),
        const SizedBox(height: 12),
        ...kEvents.map((e) {
          final sel = _selectedEvent == e.$1;
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: InkWell(
              onTap: _isSavingEvent
                  ? null
                  : () async {
                      setState(() => _isSavingEvent = true);
                      final s = context.read<AppState>();
                      final saved = await s.addEvent(
                        EventItem(title: e.$1, icon: e.$2, color: e.$3, timestamp: DateTime.now()),
                      );
                      if (!mounted) return;
                      setState(() {
                        _isSavingEvent = false;
                        if (saved) _selectedEvent = e.$1;
                      });
                      if (!saved) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(s.dataError ?? 'Event gagal disimpan ke server.')),
                        );
                      }
              },
              borderRadius: BorderRadius.circular(14),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: sel ? AppTheme.primarySoft : Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: sel ? AppTheme.primaryLight : AppTheme.borderLight,
                    width: sel ? 1.6 : 1,
                  ),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(color: e.$3.withValues(alpha: 0.13), shape: BoxShape.circle),
                      child: Icon(e.$2, color: e.$3, size: 20),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        e.$1,
                        style: AppTheme.font(
                          size: 14,
                          weight: sel ? FontWeight.w700 : FontWeight.w500,
                          color: sel ? AppTheme.primaryDark : AppTheme.textPrimary,
                        ),
                      ),
                    ),
                    if (sel) const Icon(Icons.check_circle, color: AppTheme.primary, size: 20),
                  ],
                ),
              ),
            ),
          );
        }),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 10: Catatan Saya
  // ---------------------------------------------------------------------------
  Widget _step10Notes() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppTheme.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              TextField(
                controller: _noteCtrl,
                maxLines: 6,
                maxLength: 500,
                buildCounter: (_, {required currentLength, required isFocused, maxLength}) =>
                    Text('$currentLength/$maxLength', style: AppTheme.font(size: 11, color: AppTheme.textMuted)),
                style: AppTheme.font(size: 13.5, height: 1.45),
                decoration: const InputDecoration(
                  hintText: 'Tulis catatan harian Anda di sini...',
                  filled: false,
                  contentPadding: EdgeInsets.zero,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Text('Contoh catatan:', style: AppTheme.font(size: 13, weight: FontWeight.w700, color: AppTheme.textSecondary)),
        const SizedBox(height: 8),
        ...[
          'Merasa lebih lelah dari biasanya',
          'Ada stres karena pekerjaan',
          'Baru pulang perjalanan jauh',
          'Mengonsumsi makanan berlemak',
          'Catatan saat kontrol berikutnya',
        ].map((t) => Padding(
              padding: const EdgeInsets.only(bottom: 5),
              child: Text('•  $t', style: AppTheme.font(size: 12.5, color: AppTheme.textSecondary)),
            )),
      ],
    );
  }

  // ---------------------------------------------------------------------------
  // STEP 11: Ringkasan Hari Ini
  // ---------------------------------------------------------------------------
  Widget _step11Summary() {
    final s = context.watch<AppState>();
    final bp = s.measurement('bp').value;
    final temp = s.measurement('temp').value;
    final measureSummary = [if (bp != null) 'TD $bp', if (temp != null) 'Suhu $temp°C'].join(', ');

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: AppTheme.primarySoft,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.primaryLight.withValues(alpha: 0.3)),
          ),
          child: Row(
            children: [
              const Icon(Icons.check_circle_outline, color: AppTheme.primary, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Data Anda lengkap dan siap diintegrasikan dengan sinyal wearable untuk analisis CAPAR.',
                  style: AppTheme.font(size: 12, color: AppTheme.textSecondary, height: 1.35),
                ),
              ),
            ],
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppTheme.borderLight),
            boxShadow: AppTheme.shadowSoft,
          ),
          child: Column(
            children: [
              _summaryRow(Icons.groups_2_outlined, 'Perasaan', Text(s.mood.label, style: AppTheme.font(size: 13, weight: FontWeight.w600))),
              const Divider(height: 1, indent: 42, color: AppTheme.borderLight),
              _summaryRow(
                Icons.coronavirus_outlined,
                'Gejala',
                Text(
                  s.symptoms.contains(kNoSymptom) ? 'Tidak ada gejala' : s.symptoms.join(', '),
                  style: AppTheme.font(
                    size: 13,
                    color: s.hasSymptoms ? AppTheme.faceRed : AppTheme.textPrimary,
                    weight: s.hasSymptoms ? FontWeight.w600 : FontWeight.w400,
                  ),
                ),
              ),
              const Divider(height: 1, indent: 42, color: AppTheme.borderLight),
              _summaryRow(Icons.directions_run_outlined, 'Aktivitas', Text(s.activity, style: AppTheme.font(size: 13))),
              const Divider(height: 1, indent: 42, color: AppTheme.borderLight),
              _summaryRow(Icons.psychology_outlined, 'Stres', Text(s.stress?.label ?? 'Belum dicatat', style: AppTheme.font(size: 13, weight: FontWeight.w600))),
              const Divider(height: 1, indent: 42, color: AppTheme.borderLight),
              _summaryRow(Icons.restaurant_outlined, 'Makan', Text('${s.mealCount ?? '-'} kali hari ini', style: AppTheme.font(size: 13))),
              const Divider(height: 1, indent: 42, color: AppTheme.borderLight),
              _summaryRow(Icons.medication_outlined, 'Minum obat', Text(s.habitMedication ? 'Ya' : 'Tidak', style: AppTheme.font(size: 13))),
              const Divider(height: 1, indent: 42, color: AppTheme.borderLight),
              _summaryRow(Icons.bedtime_outlined, 'Tidur', Text('${s.sleepShortLabel} (${s.sleepQuality.label})', style: AppTheme.font(size: 13))),
              const Divider(height: 1, indent: 42, color: AppTheme.borderLight),
              _summaryRow(Icons.thermostat_outlined, 'Pengukuran', Text(measureSummary.isEmpty ? '-' : measureSummary, style: AppTheme.font(size: 13))),
              const Divider(height: 1, indent: 42, color: AppTheme.borderLight),
              _summaryRow(Icons.description_outlined, 'Catatan', Text(s.note.isEmpty ? '-' : s.note, maxLines: 2, overflow: TextOverflow.ellipsis, style: AppTheme.font(size: 13))),
            ],
          ),
        ),
      ],
    );
  }

  Widget _summaryRow(IconData icon, String label, Widget trailing) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppTheme.primaryDark),
          const SizedBox(width: 10),
          Text(label, style: AppTheme.font(size: 13, color: AppTheme.textSecondary)),
          const SizedBox(width: 10),
          Expanded(
            child: Align(
              alignment: Alignment.centerRight,
              child: trailing,
            ),
          ),
        ],
      ),
    );
  }
}
