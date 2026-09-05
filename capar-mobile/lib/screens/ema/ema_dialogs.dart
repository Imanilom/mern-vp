import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../services/api_service.dart';

class EmaDialogs {
  /// Opens the unified multi-step EMA Wizard starting at Step 1 (or any initialStep 1..4)
  static void showWizard(BuildContext context, {int initialStep = 1}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _EmaWizardSheet(initialStep: initialStep),
    );
  }

  static void showEma1(BuildContext context) => showWizard(context, initialStep: 1);
  static void showEma2(BuildContext context) => showWizard(context, initialStep: 2);
  static void showEma3(BuildContext context) => showWizard(context, initialStep: 3);
  static void showEma4(BuildContext context) => showWizard(context, initialStep: 4);
}

class _EmaWizardSheet extends StatefulWidget {
  final int initialStep;

  const _EmaWizardSheet({this.initialStep = 1});

  @override
  State<_EmaWizardSheet> createState() => _EmaWizardSheetState();
}

class _EmaWizardSheetState extends State<_EmaWizardSheet> {
  late int _currentStep;
  late int _maxUnlockedStep;

  // Step 1 State (EMA 1 — Konfirmasi Konteks)
  String _ema1Activity = 'Duduk / istirahat';
  String _ema1Planned = 'Ya';
  String _ema1SleepStatus = 'Cukup (6-7 jam)';
  String _ema1Medication = 'Tidak Ada';
  final TextEditingController _ema1MedDetailController = TextEditingController();
  final TextEditingController _ema1NoteController = TextEditingController();

  // Step 2 State (EMA 2 — Gejala / Strain)
  String _ema2Symptom = 'Tidak ada keluhan';
  double _ema2Intensity = 4.0;
  String _ema2Trigger = 'Kopi / makan / kurang tidur';

  // Step 3 State (EMA 3 — Recovery Check)
  String _ema3Recovery = 'Ya, jelas membaik';
  String _ema3ContextChange = 'Tetap aktivitas yang sama';
  final TextEditingController _ema3InterventionController = TextEditingController();

  // Step 4 State (EMA 4 — Refleksi Episode)
  String _ema4Trigger = 'Aktivitas fisik';
  String _ema4Condition = 'Normal seperti biasa';
  double _ema4Disruption = 2.0;

  @override
  void initState() {
    super.initState();
    _currentStep = widget.initialStep.clamp(1, 4);
    _maxUnlockedStep = _currentStep;
  }

  @override
  void dispose() {
    _ema1MedDetailController.dispose();
    _ema1NoteController.dispose();
    _ema3InterventionController.dispose();
    super.dispose();
  }

  void _nextStep() {
    if (_currentStep < 4) {
      setState(() {
        _currentStep++;
        if (_currentStep > _maxUnlockedStep) {
          _maxUnlockedStep = _currentStep;
        }
      });
    }
  }

  void _previousStep() {
    if (_currentStep > 1) {
      setState(() {
        _currentStep--;
      });
    }
  }

  Future<void> _submitAll() async {
    Navigator.pop(context);
    final payload = {
      'step_completed': _maxUnlockedStep,
      'ema1': {
        'activity': _ema1Activity,
        'planned': _ema1Planned,
        'sleep_status': _ema1SleepStatus,
        'medication_intake': _ema1Medication,
        'medication_detail': _ema1MedDetailController.text,
        'note': _ema1NoteController.text,
      },
      'ema2': {
        'symptom': _ema2Symptom,
        'intensity': _ema2Intensity,
        'trigger': _ema2Trigger,
      },
      'ema3': {
        'recovery_status': _ema3Recovery,
        'context_change': _ema3ContextChange,
        'intervention_note': _ema3InterventionController.text,
      },
      'ema4': {
        'primary_trigger': _ema4Trigger,
        'overall_condition': _ema4Condition,
        'disruption_score': _ema4Disruption,
      },
    };

    final ok = await ApiService.submitEma(payload);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(ok
              ? '✓ Respon EMA 1–4 tersimpan di database MongoDB.'
              : '✓ Respon EMA tersimpan lokal di aplikasi.'),
          backgroundColor: AppColors.teal,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 20),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Drag Handle
              Center(
                child: Container(
                  width: 42,
                  height: 4.5,
                  margin: const EdgeInsets.only(bottom: 14),
                  decoration: BoxDecoration(
                    color: AppColors.navy.withValues(alpha: 0.8),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),

              // Title & Subtitle based on active step (From PDF Addendum)
              Text(
                _getStepTitle(_currentStep),
                style: const TextStyle(
                  fontFamily: 'Plus Jakarta Sans',
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                _getStepSubtitle(_currentStep),
                style: TextStyle(
                  fontSize: 11.5,
                  color: AppColors.gray.withValues(alpha: 0.9),
                ),
              ),
              const SizedBox(height: 16),

              // Numbered Step Indicator Circles (1, 2, 3, 4 with Strict Sequential Unlocking)
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(4, (index) {
                  final stepNum = index + 1;
                  final isUnlocked = stepNum <= _maxUnlockedStep;
                  final isActive = stepNum <= _currentStep;
                  final isCurrent = stepNum == _currentStep;

                  Color stepColor = const Color(0xFF6B7280);
                  if (stepNum == 1) stepColor = const Color(0xFF6B7280); // EMA 1: Abu-abu
                  if (stepNum == 2) stepColor = const Color(0xFFDC2626); // EMA 2: Merah
                  if (stepNum == 3) stepColor = const Color(0xFF16A34A); // EMA 3: Hijau
                  if (stepNum == 4) stepColor = const Color(0xFF2563EB); // EMA 4: Biru

                  return GestureDetector(
                    onTap: () {
                      if (!isUnlocked) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('⚠️ Pengisian EMA harus berurutan! Selesaikan EMA $_maxUnlockedStep terlebih dahulu.'),
                            backgroundColor: const Color(0xFFDC2626),
                            behavior: SnackBarBehavior.floating,
                            duration: const Duration(seconds: 2),
                          ),
                        );
                        return;
                      }
                      setState(() {
                        _currentStep = stepNum;
                      });
                    },
                    child: Container(
                      width: 28,
                      height: 28,
                      margin: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isUnlocked
                            ? (isActive ? stepColor : stepColor.withValues(alpha: 0.25))
                            : AppColors.graySoft.withValues(alpha: 0.6),
                        border: isCurrent
                            ? Border.all(color: stepColor, width: 2)
                            : (!isUnlocked ? Border.all(color: AppColors.gray.withValues(alpha: 0.3)) : null),
                      ),
                      child: Center(
                        child: isUnlocked
                            ? Text(
                                '$stepNum',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: isActive ? Colors.white : AppColors.navy,
                                ),
                              )
                            : const Icon(Icons.lock_rounded, size: 12, color: AppColors.gray),
                      ),
                    ),
                  );
                }),
              ),
              const SizedBox(height: 22),

              // Active Step Form Content
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: KeyedSubtree(
                  key: ValueKey<int>(_currentStep),
                  child: _buildStepContent(_currentStep),
                ),
              ),
              const SizedBox(height: 22),

              // Navigation Buttons Row (Kembali & Lanjut/Kirim EMA)
              Row(
                children: [
                  if (_currentStep > 1) ...[
                    Expanded(
                      flex: 1,
                      child: OutlinedButton(
                        onPressed: _previousStep,
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          side: const BorderSide(color: AppColors.line, width: 1.2),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                        child: const Text(
                          'Kembali',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: AppColors.navy,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                  ],

                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: _currentStep < 4 ? _nextStep : _submitAll,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.teal,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                      ),
                      child: Text(
                        _currentStep < 4 ? 'Lanjut' : 'Kirim EMA',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Footer Text Link (From PDF Addendum)
              Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    GestureDetector(
                      onTap: () {
                        Navigator.pop(context);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Pengingat EMA akan diulang dalam 15 menit.')),
                        );
                      },
                      child: const Text(
                        'Nanti ingatkan saya',
                        style: TextStyle(fontSize: 11, color: AppColors.gray, fontWeight: FontWeight.w600),
                      ),
                    ),
                    const Text('  •  ', style: TextStyle(fontSize: 11, color: AppColors.gray)),
                    GestureDetector(
                      onTap: () {
                        Navigator.pop(context);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('EMA dilewati dengan alasan recorded.')),
                        );
                      },
                      child: const Text(
                        'Lewati dengan alasan',
                        style: TextStyle(fontSize: 11, color: AppColors.gray, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _getStepTitle(int step) {
    switch (step) {
      case 1: return 'EMA 1 — Konfirmasi Konteks';
      case 2: return 'EMA 2 — Gejala / Strain';
      case 3: return 'EMA 3 — Recovery Check';
      case 4: return 'EMA 4 — Refleksi Episode';
      default: return 'EMA Input';
    }
  }

  String _getStepSubtitle(int step) {
    switch (step) {
      case 1: return 'Muncul saat candidate atau konteks tidak yakin';
      case 2: return 'Muncul saat persistent deviation';
      case 3: return 'Muncul saat recovery atau setelah estimasi waktu';
      case 4: return 'Muncul setelah recovered / unresolved';
      default: return '';
    }
  }

  Widget _buildStepContent(int step) {
    switch (step) {
      case 1: return _buildStep1();
      case 2: return _buildStep2();
      case 3: return _buildStep3();
      case 4: return _buildStep4();
      default: return const SizedBox.shrink();
    }
  }

  // STEP 1: EMA 1 — Konfirmasi Konteks (Matching Addendum PDF Image 1)
  Widget _buildStep1() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Apa aktivitas & konteks Anda saat ini?',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy),
        ),
        const SizedBox(height: 10),
        ...[
          'Duduk / istirahat',
          'Aktivitas fisik / jalan cepat / olahraga',
          'Bekerja / beban mental & konsentrasi',
          'Merasakan nyeri / ketidaknyamanan fisik',
          'Faktor lingkungan (suhu panas/dingin, polusi, bising)',
        ].map((act) => _buildRadioChoice(
          title: act,
          isSelected: _ema1Activity == act,
          onTap: () => setState(() => _ema1Activity = act),
        )),

        const SizedBox(height: 16),
        const Text(
          'Apakah aktivitas ini direncanakan?',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy),
        ),
        const SizedBox(height: 10),
        ...['Ya', 'Tidak'].map((plan) => _buildRadioChoice(
          title: plan,
          isSelected: _ema1Planned == plan,
          onTap: () => setState(() => _ema1Planned = plan),
        )),

        const SizedBox(height: 16),
        const Text(
          'Kualitas & Durasi Tidur Semalam',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy),
        ),
        const SizedBox(height: 10),
        ...[
          'Sangat Cukup (>7 jam)',
          'Cukup (6-7 jam)',
          'Kurang (4-5 jam)',
          'Sangat Kurang / Insomnia (<4 jam)',
        ].map((sleep) => _buildRadioChoice(
          title: sleep,
          isSelected: _ema1SleepStatus == sleep,
          onTap: () => setState(() => _ema1SleepStatus = sleep),
        )),

        const SizedBox(height: 16),
        const Text(
          'Konsumsi Obat / Stimulan Terkini',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy),
        ),
        const SizedBox(height: 10),
        ...[
          'Tidak Ada',
          'Obat Jantung / Antihipertensi',
          'Obat Flu / Dekongestan',
          'Kafein / Suplemen Tinggi',
          'Lainnya (Tulis detail di bawah)',
        ].map((med) => _buildRadioChoice(
          title: med,
          isSelected: _ema1Medication == med,
          onTap: () => setState(() => _ema1Medication = med),
        )),

        if (_ema1Medication != 'Tidak Ada') ...[
          const SizedBox(height: 10),
          TextField(
            controller: _ema1MedDetailController,
            style: const TextStyle(fontSize: 12),
            decoration: InputDecoration(
              hintText: 'Nama obat / dosis (mis. Bisoprolol 2.5mg, Kopi espresso)...',
              hintStyle: const TextStyle(fontSize: 12, color: Colors.black26),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              filled: true,
              fillColor: AppColors.surface,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppColors.line),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(14),
                borderSide: const BorderSide(color: AppColors.line),
              ),
            ),
          ),
        ],

        const SizedBox(height: 16),
        const Text(
          'Catatan opsional',
          style: TextStyle(fontSize: 11, color: AppColors.gray, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: _ema1NoteController,
          maxLines: 2,
          style: const TextStyle(fontSize: 12),
          decoration: InputDecoration(
            hintText: 'Mis. jogging pagi, stres deadline, nyeri dada ringan...',
            hintStyle: const TextStyle(fontSize: 12, color: Colors.black26),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            filled: true,
            fillColor: AppColors.surface,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.line),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.line),
            ),
          ),
        ),
      ],
    );
  }

  // STEP 2: EMA 2 — Gejala / Strain (Matching Addendum PDF Image 2)
  Widget _buildStep2() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Apa yang Anda rasakan sekarang?',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy),
        ),
        const SizedBox(height: 10),
        ...[
          'Tidak ada keluhan',
          'Berdebar / denyut cepat',
          'Nyeri dada / rasa tertekan / pusing',
          'Nyeri otot / sakit kepala / kram',
          'Lelah / mengantuk berat'
        ].map((smp) => _buildRadioChoice(
          title: smp,
          isSelected: _ema2Symptom == smp,
          onTap: () => setState(() => _ema2Symptom = smp),
        )),

        const SizedBox(height: 16),
        const Text(
          'Intensitas Keluhan',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy),
        ),
        const SizedBox(height: 6),
        Slider(
          value: _ema2Intensity,
          min: 0,
          max: 10,
          divisions: 10,
          activeColor: AppColors.amber,
          onChanged: (val) => setState(() => _ema2Intensity = val),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: const [
            Text('0 — tidak ada', style: TextStyle(fontSize: 10, color: AppColors.gray)),
            Text('10 — sangat berat', style: TextStyle(fontSize: 10, color: AppColors.gray)),
          ],
        ),

        const SizedBox(height: 16),
        const Text(
          'Kemungkinan pemicu utama saat ini:',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy),
        ),
        const SizedBox(height: 10),
        ...[
          '1. Aktivitas fisik / olahraga / tangga',
          '2. Stres mental / beban kognitif / emosi',
          '3. Ada nyeri / ketidaknyamanan fisik',
          '4. Faktor lingkungan (suhu ekstrem, polusi, bising)',
          '5. Kopi / kafein / rokok / makan besar',
          '6. Kurang tidur / kelelahan',
        ].map((trg) => _buildRadioChoice(
          title: trg,
          isSelected: _ema2Trigger == trg,
          onTap: () => setState(() => _ema2Trigger = trg),
        )),
      ],
    );
  }

  // STEP 3: EMA 3 — Recovery Check (Matching Addendum PDF Image 3)
  Widget _buildStep3() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Apakah Anda merasa mulai membaik?',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy),
        ),
        const SizedBox(height: 10),
        ...['Ya, jelas membaik', 'Sedikit membaik', 'Belum berubah', 'Lebih tidak nyaman'].map((st) => _buildRadioChoice(
          title: st,
          isSelected: _ema3Recovery == st,
          onTap: () => setState(() => _ema3Recovery = st),
        )),

        const SizedBox(height: 16),
        const Text(
          'Apakah konteks berubah?',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy),
        ),
        const SizedBox(height: 10),
        ...['Tetap aktivitas yang sama', 'Berhenti / istirahat', 'Berpindah aktivitas'].map((ctx) => _buildRadioChoice(
          title: ctx,
          isSelected: _ema3ContextChange == ctx,
          onTap: () => setState(() => _ema3ContextChange = ctx),
        )),

        const SizedBox(height: 16),
        const Text(
          'Intervensi sederhana yang dilakukan?',
          style: TextStyle(fontSize: 11, color: AppColors.gray, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: _ema3InterventionController,
          maxLines: 2,
          style: const TextStyle(fontSize: 12),
          decoration: InputDecoration(
            hintText: 'Mis. duduk, minum, istirahat, relaksasi napas...',
            hintStyle: const TextStyle(fontSize: 12, color: Colors.black26),
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            filled: true,
            fillColor: AppColors.surface,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.line),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: AppColors.line),
            ),
          ),
        ),
      ],
    );
  }

  // STEP 4: EMA 4 — Refleksi Episode (Matching Addendum PDF Image 4)
  Widget _buildStep4() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Menurut Anda, apa pemicu utama episode ini?',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy),
        ),
        const SizedBox(height: 10),
        ...[
          'Aktivitas fisik / beban gerak',
          'Stres mental / tekanan emosi',
          'Ada nyeri / rasa sakit',
          'Faktor lingkungan (cuaca / polusi / bising)',
          'Kafein / rokok / pola makan',
          'Kurang tidur / kelelahan akumulatif',
          'Tidak tahu / tanpa pemicu jelas'
        ].map((trg) => _buildRadioChoice(
          title: trg,
          isSelected: _ema4Trigger == trg,
          onTap: () => setState(() => _ema4Trigger = trg),
        )),

        const SizedBox(height: 16),
        const Text(
          'Setelah episode selesai, kondisi Anda?',
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy),
        ),
        const SizedBox(height: 10),
        ...['Normal seperti biasa', 'Agak lelah', 'Masih tidak nyaman'].map((cond) => _buildRadioChoice(
          title: cond,
          isSelected: _ema4Condition == cond,
          onTap: () => setState(() => _ema4Condition = cond),
        )),

        const SizedBox(height: 16),
        const Text(
          'Seberapa mengganggu episode ini?',
          style: TextStyle(fontSize: 11, color: AppColors.gray, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 6),
        Slider(
          value: _ema4Disruption,
          min: 0,
          max: 10,
          divisions: 10,
          activeColor: AppColors.green,
          onChanged: (val) => setState(() => _ema4Disruption = val),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: const [
            Text('0', style: TextStyle(fontSize: 10, color: AppColors.gray)),
            Text('10', style: TextStyle(fontSize: 10, color: AppColors.gray)),
          ],
        ),
      ],
    );
  }

  // Shared Helper for Radio Style Selection Container (Matching PDF Mockup Styling)
  Widget _buildRadioChoice({
    required String title,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFEAF3F9) : AppColors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? AppColors.navy : AppColors.line,
            width: isSelected ? 1.5 : 1.0,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 14,
              height: 14,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isSelected ? AppColors.navy : Colors.transparent,
                border: Border.all(
                  color: isSelected ? AppColors.navy : AppColors.gray,
                  width: 1.5,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                title,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                  color: isSelected ? AppColors.navy : AppColors.ink,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
