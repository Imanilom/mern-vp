import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';

/// Mockup halaman 4 – Gejala & perasaan ("Catat Hari Ini").
class SymptomInputScreen extends StatefulWidget {
  const SymptomInputScreen({super.key});

  @override
  State<SymptomInputScreen> createState() => _SymptomInputScreenState();
}

class _SymptomInputScreenState extends State<SymptomInputScreen> {
  late MoodRating _mood;
  late List<String> _symptoms;
  late double _level;

  @override
  void initState() {
    super.initState();
    final s = context.read<AppState>();
    _mood = s.mood;
    _symptoms = List.from(s.symptoms);
    _level = s.symptomLevel;
  }

  Future<void> _save() async {
    final s = context.read<AppState>();
    s.update(() {
      s.mood = _mood;
      s.symptoms = List.from(_symptoms);
      s.symptomLevel = _level;
      s.confirmDailySection('symptoms');
    });
    final saved = await s.submitDaily();
    if (!mounted) return;
    if (!saved) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.dataError ?? 'Catatan gejala gagal disimpan ke server.')),
      );
      return;
    }
    showSaved(context, 'Gejala dan perasaan tersimpan di server');
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();

    return MockupScaffold(
      title: 'Catat Hari Ini',
      subtitle: DateLine(date: s.logDate, centered: true),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionTitle('Bagaimana perasaan Anda?', padding: EdgeInsets.only(top: 8, bottom: 10)),
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
              value: _level,
              min: 0,
              max: 2,
              divisions: 2,
              onChanged: (v) => setState(() => _level = v),
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
                          weight: (_level.round() == e.key) ? FontWeight.w700 : FontWeight.w500,
                          color: (_level.round() == e.key) ? AppTheme.primaryDark : AppTheme.textMuted,
                        ),
                      ))
                  .toList(),
            ),
          ),
          const SizedBox(height: 10),
        ],
      ),
      bottom: ElevatedButton(
        onPressed: s.isSubmittingDaily ? null : _save,
        child: s.isSubmittingDaily
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Text('Simpan'),
      ),
    );
  }
}
