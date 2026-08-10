import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../../services/api_service.dart';

class EmaDialogs {
  static void showEma1(BuildContext context) {
    showModalBottomSheet(context: context, isScrollControlled: true, backgroundColor: Colors.transparent, builder: (ctx) => const _Ema1Sheet());
  }
  static void showEma2(BuildContext context) {
    showModalBottomSheet(context: context, isScrollControlled: true, backgroundColor: Colors.transparent, builder: (ctx) => const _Ema2Sheet());
  }
  static void showEma3(BuildContext context) {
    showModalBottomSheet(context: context, isScrollControlled: true, backgroundColor: Colors.transparent, builder: (ctx) => const _Ema3Sheet());
  }
  static void showEma4(BuildContext context) {
    showModalBottomSheet(context: context, isScrollControlled: true, backgroundColor: Colors.transparent, builder: (ctx) => const _Ema4Sheet());
  }
}

// ---------------------------------------------------------
// REUSABLE UI COMPONENTS
// ---------------------------------------------------------

Widget _buildHeader(String title, String subtitle, int step) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(title, style: const TextStyle(fontFamily: 'Plus Jakarta Sans', fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.navy)),
      const SizedBox(height: 2),
      Text(subtitle, style: const TextStyle(fontSize: 11, color: AppColors.gray)),
      const SizedBox(height: 12),
      Row(
        children: List.generate(4, (i) => Expanded(
          child: Container(
            height: 4,
            margin: const EdgeInsets.only(right: 4),
            decoration: BoxDecoration(
              color: i == (step - 1) ? AppColors.teal : (i < step ? AppColors.tealSoft : AppColors.graySoft),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        )),
      ),
      const SizedBox(height: 16),
    ],
  );
}

Widget _buildQuestionLabel(String label) {
  return Padding(
    padding: const EdgeInsets.only(top: 16, bottom: 8),
    child: Text(label.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray)),
  );
}

Widget _buildRadioGroup(List<String> options, String? selected, Function(String) onChanged) {
  return Column(
    children: options.map((opt) => GestureDetector(
      onTap: () => onChanged(opt),
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: selected == opt ? AppColors.tealSoft : AppColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: selected == opt ? AppColors.teal : AppColors.line),
        ),
        child: Row(
          children: [
            Container(
              width: 16, height: 16,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: selected == opt ? AppColors.teal : AppColors.gray, width: 4),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(child: Text(opt, style: TextStyle(fontSize: 12, fontWeight: selected == opt ? FontWeight.w700 : FontWeight.w500, color: selected == opt ? AppColors.teal : AppColors.ink))),
          ],
        ),
      ),
    )).toList(),
  );
}

Widget _buildMultiSelectGroup(List<String> options, List<String> selected, Function(String, bool) onChanged, {String exclusiveOption = "Tidak ada"}) {
  return Wrap(
    spacing: 8,
    runSpacing: 8,
    children: options.map((opt) {
      final isSelected = selected.contains(opt);
      final isExclusiveSelected = selected.contains(exclusiveOption);
      final isDisabled = isExclusiveSelected && opt != exclusiveOption;

      return FilterChip(
        label: Text(opt, style: TextStyle(fontSize: 11, color: isSelected ? AppColors.teal : (isDisabled ? AppColors.line : AppColors.ink))),
        selected: isSelected,
        onSelected: isDisabled ? null : (val) {
          if (opt == exclusiveOption && val) {
            // If exclusive option selected, clear others
            onChanged(exclusiveOption, true);
          } else {
            onChanged(opt, val);
          }
        },
        selectedColor: AppColors.tealSoft,
        backgroundColor: AppColors.surface,
        checkmarkColor: AppColors.teal,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: BorderSide(color: isSelected ? AppColors.teal : (isDisabled ? AppColors.line : AppColors.line))),
      );
    }).toList(),
  );
}

Widget _buildSlider(double value, Function(double) onChanged, double min, double max, int divisions, String minLabel, String maxLabel) {
  return Column(
    children: [
      SliderTheme(
        data: SliderThemeData(
          activeTrackColor: AppColors.teal,
          inactiveTrackColor: AppColors.graySoft,
          thumbColor: AppColors.teal,
          overlayColor: AppColors.tealSoft,
          valueIndicatorTextStyle: const TextStyle(color: Colors.white, fontSize: 10),
        ),
        child: Slider(
          value: value,
          min: min,
          max: max,
          divisions: divisions,
          label: value.round().toString(),
          onChanged: onChanged,
        ),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(minLabel, style: const TextStyle(fontSize: 10, color: AppColors.gray)),
            Text(maxLabel, style: const TextStyle(fontSize: 10, color: AppColors.gray)),
          ],
        ),
      )
    ],
  );
}

// ---------------------------------------------------------
// EMA 1: Konfirmasi Saat Alarm
// ---------------------------------------------------------
class _Ema1Sheet extends StatefulWidget { const _Ema1Sheet(); @override State<_Ema1Sheet> createState() => _Ema1SheetState(); }
class _Ema1SheetState extends State<_Ema1Sheet> {
  String? q1Activity;
  String? q2Posture;
  double q3Exertion = 0;
  double q4Stress = 0;
  List<String> q5Symptoms = [];
  List<String> q6Triggers = [];
  String? q7Transition;
  String? q8Sensor;
  double q9Confidence = 100;
  String? q10Attribution;
  final TextEditingController q11Notes = TextEditingController();

  final List<String> acts = ['Tidur', 'Berbaring/istirahat', 'Duduk santai', 'Bekerja/belajar', 'Berdiri', 'Berjalan', 'Pekerjaan rumah tangga', 'Makan/minum', 'Berkendara', 'Berolahraga', 'Lainnya'];
  final List<String> postures = ['Berbaring', 'Duduk', 'Berdiri', 'Bergerak', 'Tidak yakin'];
  final List<String> symptoms = ['Tidak ada', 'Jantung berdebar', 'Sesak napas', 'Pusing', 'Nyeri dada', 'Mual', 'Lemas', 'Berkeringat berlebihan', 'Nyeri tubuh', 'Cemas/panik'];
  final List<String> triggers = ['Tidak ada', 'Aktivitas fisik', 'Naik tangga', 'Makan', 'Minuman berkafein', 'Merokok', 'Mengonsumsi obat', 'Emosi kuat', 'Rasa sakit', 'Perubahan suhu', 'Baru bangun tidur'];
  final List<String> transitions = ['Tidak berubah', 'Dari istirahat ke aktivitas', 'Dari aktivitas ke istirahat', 'Intensitas meningkat', 'Intensitas menurun', 'Tidak yakin'];
  final List<String> sensors = ['Ya', 'Terasa longgar', 'Bergeser', 'Sempat dilepas', 'Kulit sangat berkeringat', 'Tidak yakin'];
  final List<String> attributions = ['Ya', 'Mungkin', 'Tidak', 'Tidak yakin'];

  void _onSymptomChanged(String opt, bool val) {
    setState(() {
      if (opt == 'Tidak ada' && val) {
        q5Symptoms = ['Tidak ada'];
      } else {
        q5Symptoms.remove('Tidak ada');
        if (val) q5Symptoms.add(opt); else q5Symptoms.remove(opt);
      }
    });
  }

  void _onTriggerChanged(String opt, bool val) {
    setState(() {
      if (opt == 'Tidak ada' && val) {
        q6Triggers = ['Tidak ada'];
      } else {
        q6Triggers.remove('Tidak ada');
        if (val) q6Triggers.add(opt); else q6Triggers.remove(opt);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return _wrapSheet(
      context,
      children: [
        _buildHeader('EMA 1 — Konfirmasi Saat Alarm', 'Deviasi persisten telah terkonfirmasi.', 1),
        _buildQuestionLabel('1. Apa aktivitas utama yang sedang Anda lakukan saat ini?'),
        _buildRadioGroup(acts, q1Activity, (v) => setState(() => q1Activity = v)),

        _buildQuestionLabel('2. Bagaimana posisi tubuh Anda saat ini?'),
        _buildRadioGroup(postures, q2Posture, (v) => setState(() => q2Posture = v)),

        _buildQuestionLabel('3. Seberapa berat aktivitas fisik yang Anda rasakan?'),
        _buildSlider(q3Exertion, (v) => setState(() => q3Exertion = v), 0, 10, 10, '0 = Tidak ada', '10 = Sangat berat'),

        _buildQuestionLabel('4. Seberapa tegang/tertekan perasaan Anda saat ini?'),
        _buildSlider(q4Stress, (v) => setState(() => q4Stress = v), 0, 10, 10, '0 = Tenang', '10 = Tertekan'),

        _buildQuestionLabel('5. Apakah Anda mengalami keluhan saat ini?'),
        _buildMultiSelectGroup(symptoms, q5Symptoms, _onSymptomChanged),

        _buildQuestionLabel('6. Dalam 30 menit terakhir, apakah terdapat kondisi berikut?'),
        _buildMultiSelectGroup(triggers, q6Triggers, _onTriggerChanged),

        _buildQuestionLabel('7. Apakah aktivitas Anda berubah dalam 10 menit terakhir?'),
        _buildRadioGroup(transitions, q7Transition, (v) => setState(() => q7Transition = v)),

        _buildQuestionLabel('8. Apakah perangkat atau sensor terpasang dengan baik?'),
        _buildRadioGroup(sensors, q8Sensor, (v) => setState(() => q8Sensor = v)),

        _buildQuestionLabel('9. Seberapa yakin Anda bahwa jawaban aktivitas saat ini benar?'),
        _buildSlider(q9Confidence, (v) => setState(() => q9Confidence = v), 0, 100, 10, '0%', '100%'),

        _buildQuestionLabel('10. Apakah perubahan ini dapat dijelaskan oleh situasi saat ini?'),
        _buildRadioGroup(attributions, q10Attribution, (v) => setState(() => q10Attribution = v)),

        _buildQuestionLabel('11. Keterangan tambahan (Opsional)'),
        TextField(
          controller: q11Notes,
          decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'Ketik di sini...', hintStyle: TextStyle(fontSize: 12)),
          style: const TextStyle(fontSize: 12),
          maxLines: 2,
        ),
        
        const SizedBox(height: 24),
        _buildSubmitButton(context, () async {
          if (q5Symptoms.contains('Nyeri dada') || q5Symptoms.contains('Sesak napas')) {
             ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('PERHATIAN KESELAMATAN: Keluhan berisiko terdeteksi. Harap hubungi tim medis jika keluhan memburuk.', style: TextStyle(color: Colors.redAccent))));
          }
          await ApiService.annotateEvent('EVT-SIM', {
            'ema_stage': 1,
            'self_reported_activity': q1Activity,
            'posture': q2Posture,
            'perceived_exertion': q3Exertion,
            'stress_level': q4Stress,
            'symptom_codes': q5Symptoms,
            'recent_trigger_codes': q6Triggers,
            'activity_transition': q7Transition,
            'sensor_condition': q8Sensor,
            'activity_confidence': q9Confidence,
            'user_attribution': q10Attribution,
            'free_text_note': q11Notes.text,
            'submitted_at': DateTime.now().toIso8601String()
          });
        }),
      ],
    );
  }
}

// ---------------------------------------------------------
// EMA 2: Deviasi Masih Persisten
// ---------------------------------------------------------
class _Ema2Sheet extends StatefulWidget { const _Ema2Sheet(); @override State<_Ema2Sheet> createState() => _Ema2SheetState(); }
class _Ema2SheetState extends State<_Ema2Sheet> {
  String? q1Cont; String? q2Act; String? q3Intens; double q4Stress = 0; String? q5SympChg;
  List<String> q6Symp = []; List<String> q7Action = []; double q8Rec = 0; String? q9Sens; double q10Conf = 100;

  void _onSympChange(String o, bool v) { setState(() { if (o=='Tidak ada'&&v) q6Symp=['Tidak ada']; else { q6Symp.remove('Tidak ada'); if(v)q6Symp.add(o); else q6Symp.remove(o); } }); }
  void _onActChange(String o, bool v) { setState(() { if (o=='Tidak melakukan apa pun'&&v) q7Action=['Tidak melakukan apa pun']; else { q7Action.remove('Tidak melakukan apa pun'); if(v)q7Action.add(o); else q7Action.remove(o); } }); }

  @override
  Widget build(BuildContext context) {
    return _wrapSheet(context, children: [
      _buildHeader('EMA 2 — Deviasi Masih Persisten', 'Episode masih aktif setelah durasi tindak lanjut.', 2),
      _buildQuestionLabel('1. Apakah Anda masih melakukan aktivitas yang sama?'),
      _buildRadioGroup(['Ya', 'Tidak', 'Aktivitas berubah', 'Tidak yakin'], q1Cont, (v) => setState(() => q1Cont = v)),
      _buildQuestionLabel('2. Apa aktivitas utama Anda sekarang?'),
      _buildRadioGroup(['Berbaring', 'Duduk tenang', 'Bekerja/belajar', 'Berdiri', 'Berjalan', 'Berkendara', 'Berolahraga', 'Lainnya'], q2Act, (v) => setState(() => q2Act = v)),
      _buildQuestionLabel('3. Bagaimana intensitas aktivitas sekarang?'),
      _buildRadioGroup(['Lebih ringan', 'Sama', 'Lebih berat', 'Tidak yakin'], q3Intens, (v) => setState(() => q3Intens = v)),
      _buildQuestionLabel('4. Tingkat stres/ketegangan sekarang?'),
      _buildSlider(q4Stress, (v) => setState(() => q4Stress = v), 0, 10, 10, '0', '10'),
      _buildQuestionLabel('5. Bagaimana kondisi keluhan dibandingkan sebelumnya?'),
      _buildRadioGroup(['Sejak awal tidak ada', 'Sudah hilang', 'Berkurang', 'Tetap', 'Bertambah', 'Muncul keluhan baru'], q5SympChg, (v) => setState(() => q5SympChg = v)),
      _buildQuestionLabel('6. Keluhan apa yang masih dirasakan?'),
      _buildMultiSelectGroup(['Tidak ada', 'Jantung berdebar', 'Sesak napas', 'Pusing', 'Nyeri dada', 'Mual', 'Lemas', 'Berkeringat berlebihan', 'Cemas/panik'], q6Symp, _onSympChange),
      _buildQuestionLabel('7. Tindakan pemulihan yang dilakukan?'),
      _buildMultiSelectGroup(['Tidak melakukan apa pun', 'Berhenti beraktivitas', 'Duduk', 'Berbaring', 'Mengatur napas', 'Minum air', 'Mengonsumsi obat', 'Meminta bantuan'], q7Action, _onActChange, exclusiveOption: 'Tidak melakukan apa pun'),
      _buildQuestionLabel('8. Seberapa pulih kondisi Anda saat ini?'),
      _buildSlider(q8Rec, (v) => setState(() => q8Rec = v), 0, 10, 10, '0=Belum pulih', '10=Normal'),
      _buildQuestionLabel('9. Apakah sensor terpasang baik?'),
      _buildRadioGroup(['Ya', 'Tidak', 'Tidak yakin'], q9Sens, (v) => setState(() => q9Sens = v)),
      _buildQuestionLabel('10. Confidence jawaban EMA ini?'),
      _buildSlider(q10Conf, (v) => setState(() => q10Conf = v), 0, 100, 10, '0%', '100%'),
      const SizedBox(height: 24),
      _buildSubmitButton(context, () async {
        await ApiService.annotateEvent('EVT-SIM', {'ema_stage': 2, 'continuity': q1Cont, 'activity': q2Act, 'intensity': q3Intens, 'stress': q4Stress, 'symptom_change': q5SympChg, 'symptoms': q6Symp, 'actions': q7Action, 'recovery_score': q8Rec, 'sensor': q9Sens, 'confidence': q10Conf});
      }),
    ]);
  }
}

// ---------------------------------------------------------
// EMA 3: Konfirmasi Awal Pemulihan
// ---------------------------------------------------------
class _Ema3Sheet extends StatefulWidget { const _Ema3Sheet(); @override State<_Ema3Sheet> createState() => _Ema3SheetState(); }
class _Ema3SheetState extends State<_Ema3Sheet> {
  String? q1; double q2=0; String? q3; String? q4; List<String> q5=[]; double q6=100; final TextEditingController q7 = TextEditingController();
  void _onQ5(String o, bool v) { setState(() { if(o=='Tidak tahu'&&v) q5=['Tidak tahu']; else { q5.remove('Tidak tahu'); if(v)q5.add(o); else q5.remove(o); } }); }

  @override
  Widget build(BuildContext context) {
    return _wrapSheet(context, children: [
      _buildHeader('EMA 3 — Awal Pemulihan', 'Skor telah melewati ambang recovery.', 3),
      _buildQuestionLabel('1. Apakah Anda merasa kondisi mulai membaik?'),
      _buildRadioGroup(['Ya', 'Sedikit membaik', 'Belum', 'Memburuk', 'Tidak yakin'], q1, (v) => setState(() => q1 = v)),
      _buildQuestionLabel('2. Seberapa pulih kondisi Anda sekarang?'),
      _buildSlider(q2, (v) => setState(() => q2 = v), 0, 10, 10, '0=Belum', '10=Normal'),
      _buildQuestionLabel('3. Perubahan aktivitas sejak alarm pertama?'),
      _buildRadioGroup(['Tidak berubah', 'Berhenti beraktivitas', 'Intensitas menurun', 'Berpindah aktivitas', 'Intensitas meningkat'], q3, (v) => setState(() => q3 = v)),
      _buildQuestionLabel('4. Apakah keluhan masih ada?'),
      _buildRadioGroup(['Tidak ada', 'Ringan', 'Sedang', 'Berat', 'Tidak yakin'], q4, (v) => setState(() => q4 = v)),
      _buildQuestionLabel('5. Faktor yang paling membantu pemulihan?'),
      _buildMultiSelectGroup(['Tidak tahu', 'Istirahat', 'Berhenti aktivitas', 'Mengatur napas', 'Minum', 'Obat', 'Perubahan situasi/emosi', 'Dukungan orang lain'], q5, _onQ5, exclusiveOption: 'Tidak tahu'),
      _buildQuestionLabel('6. Confidence kondisi mulai normal?'),
      _buildSlider(q6, (v) => setState(() => q6 = v), 0, 100, 10, '0%', '100%'),
      _buildQuestionLabel('7. Keterangan (Opsional)'),
      TextField(controller: q7, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'Ketik di sini...'), maxLines: 2),
      const SizedBox(height: 24),
      _buildSubmitButton(context, () async {
        await ApiService.annotateEvent('EVT-SIM', {'ema_stage': 3, 'feeling_better': q1, 'recovery_score': q2, 'activity_change': q3, 'residual_symptoms': q4, 'helpful_factors': q5, 'confidence': q6, 'notes': q7.text});
      }),
    ]);
  }
}

// ---------------------------------------------------------
// EMA 4: Konfirmasi Pemulihan Total
// ---------------------------------------------------------
class _Ema4Sheet extends StatefulWidget { const _Ema4Sheet(); @override State<_Ema4Sheet> createState() => _Ema4SheetState(); }
class _Ema4SheetState extends State<_Ema4Sheet> {
  String? q1; String? q2; double q3=0; String? q4; String? q5; double q6=100; String? q7; final TextEditingController q8 = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return _wrapSheet(context, children: [
      _buildHeader('EMA 4 — Pemulihan Total', 'Skor telah kembali stabil.', 4),
      _buildQuestionLabel('1. Kondisi tubuh sudah kembali seperti biasa?'),
      _buildRadioGroup(['Ya, sepenuhnya', 'Hampir sepenuhnya', 'Baru sebagian', 'Belum', 'Tidak yakin'], q1, (v) => setState(() => q1 = v)),
      _buildQuestionLabel('2. Keluhan sudah menghilang?'),
      _buildRadioGroup(['Ya', 'Sebagian', 'Belum', 'Sejak awal tidak ada', 'Tidak yakin'], q2, (v) => setState(() => q2 = v)),
      _buildQuestionLabel('3. Skor pemulihan sekarang?'),
      _buildSlider(q3, (v) => setState(() => q3 = v), 0, 10, 10, '0=Belum', '10=Normal'),
      _buildQuestionLabel('4. Sudah kembali ke aktivitas normal?'),
      _buildRadioGroup(['Ya', 'Belum', 'Masih beristirahat', 'Mengganti aktivitas', 'Tidak yakin'], q4, (v) => setState(() => q4 = v)),
      _buildQuestionLabel('5. Kira-kira sejak kapan kembali normal?'),
      _buildRadioGroup(['Baru saja', '5-10 menit lalu', '10-30 menit lalu', 'Lebih dari 30 menit lalu', 'Belum kembali normal'], q5, (v) => setState(() => q5 = v)),
      _buildQuestionLabel('6. Confidence recovered?'),
      _buildSlider(q6, (v) => setState(() => q6 = v), 0, 100, 10, '0%', '100%'),
      _buildQuestionLabel('7. Penyebab utama perubahan terjadi?'),
      _buildRadioGroup(['Aktivitas fisik', 'Stres/emosi', 'Nyeri/keluhan', 'Makan/minum/kafein', 'Obat', 'Lingkungan', 'Masalah sensor', 'Tidak tahu'], q7, (v) => setState(() => q7 = v)),
      _buildQuestionLabel('8. Keterangan akhir (Opsional)'),
      TextField(controller: q8, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: 'Ketik di sini...'), maxLines: 2),
      const SizedBox(height: 24),
      _buildSubmitButton(context, () async {
        await ApiService.annotateEvent('EVT-SIM', {'ema_stage': 4, 'fully_recovered': q1, 'symptoms_gone': q2, 'recovery_score': q3, 'back_to_normal_activity': q4, 'time_recovered': q5, 'confidence': q6, 'main_trigger': q7, 'notes': q8.text});
      }),
    ]);
  }
}

// ---------------------------------------------------------
// WRAPPERS & BUTTONS
// ---------------------------------------------------------
Widget _wrapSheet(BuildContext context, {required List<Widget> children}) {
  return Container(
    height: MediaQuery.of(context).size.height * 0.9,
    padding: const EdgeInsets.all(20),
    decoration: const BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
    child: SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: children,
      ),
    ),
  );
}

Widget _buildSubmitButton(BuildContext context, Future<void> Function() onSubmit) {
  return SizedBox(
    width: double.infinity,
    child: ElevatedButton(
      onPressed: () async {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Mengirim EMA...')));
        await onSubmit();
        if (context.mounted) {
          Navigator.pop(context);
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✓ EMA berhasil terkirim.')));
        }
      },
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.teal,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      child: const Text('Kirim EMA', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
    ),
  );
}
