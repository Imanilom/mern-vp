import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../widgets/custom_widgets.dart';

/// Mockup halaman 4 – Aktivitas & gaya hidup.
class ActivityInputScreen extends StatefulWidget {
  const ActivityInputScreen({super.key});

  @override
  State<ActivityInputScreen> createState() => _ActivityInputScreenState();
}

class _ActivityInputScreenState extends State<ActivityInputScreen> {
  late String _activity;
  StressLevel? _stress;
  late bool _makan;
  late bool _kafein;
  late bool _alkohol;
  late bool _merokok;
  late bool _minumObat;

  @override
  void initState() {
    super.initState();
    final s = context.read<AppState>();
    _activity = s.activity;
    _stress = s.stress;
    _makan = s.habitMeal;
    _kafein = s.habitCaffeine;
    _alkohol = s.habitAlcohol;
    _merokok = s.habitSmoking;
    _minumObat = s.habitMedication;
  }

  Future<void> _save() async {
    final s = context.read<AppState>();
    s.update(() {
      s.activity = _activity;
      s.stress = _stress;
      s.habitMeal = _makan;
      s.habitCaffeine = _kafein;
      s.habitAlcohol = _alkohol;
      s.habitSmoking = _merokok;
      s.habitMedication = _minumObat;
      s.confirmDailySection('activity');
    });
    final saved = await s.submitDaily();
    if (!mounted) return;
    if (!saved) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.dataError ?? 'Konteks aktivitas gagal disimpan ke server.')),
      );
      return;
    }
    showSaved(context, 'Aktivitas dan konteks tersimpan di server');
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final isSaving = context.watch<AppState>().isSubmittingDaily;
    return MockupScaffold(
      title: 'Aktivitas & Gaya Hidup',
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionTitle('Apa yang sedang Anda lakukan?', padding: EdgeInsets.only(top: 8, bottom: 12)),
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
          ToggleRow(
            icon: Icons.restaurant,
            label: 'Makan',
            value: _makan,
            onChanged: (v) => setState(() => _makan = v),
          ),
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
          const SizedBox(height: 10),
        ],
      ),
      bottom: ElevatedButton(
        onPressed: isSaving ? null : _save,
        child: isSaving
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
