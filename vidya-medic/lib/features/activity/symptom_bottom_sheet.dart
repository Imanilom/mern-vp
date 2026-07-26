import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/theme/functional_colors.dart';
import '../../core/network/api_client.dart';

class SymptomBottomSheet extends ConsumerStatefulWidget {
  const SymptomBottomSheet({super.key});

  @override
  ConsumerState<SymptomBottomSheet> createState() => _SymptomBottomSheetState();
}

class _SymptomBottomSheetState extends ConsumerState<SymptomBottomSheet> {
  final Map<String, bool> _symptoms = {
    "Nyeri dada": false,
    "Pusing": false,
    "Sesak napas": false,
    "Lelah": false,
    "Jantung berdebar": false,
    "Tidak ada gejala": true,
  };

  double _intensity = 0.0;
  final _notesController = TextEditingController();

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  void _toggleSymptom(String key, bool val) {
    setState(() {
      if (key == "Tidak ada gejala" && val) {
        _symptoms.updateAll((k, _) => k == "Tidak ada gejala");
      } else if (val) {
        _symptoms["Tidak ada gejala"] = false;
        _symptoms[key] = true;
      } else {
        _symptoms[key] = false;
      }
    });
  }

  Future<void> _submit() async {
    final selectedSymptoms = _symptoms.entries
        .where((e) => e.value)
        .map((e) => e.key)
        .toList();

    Navigator.pop(context);

    await ref.read(apiClientProvider).reportSymptom(
          symptoms: selectedSymptoms,
          intensity: _intensity,
          notes: _notesController.text,
        );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text("Laporan gejala berhasil disimpan ke server"),
          behavior: SnackBarBehavior.floating,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors =
        Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      margin: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF0F172A) : Colors.white,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle bar
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "Laporan Gejala",
                            style: TextStyle(
                                fontSize: 18, fontWeight: FontWeight.w800),
                          ),
                          Text(
                            "Catat kondisi yang Anda rasakan saat ini",
                            style: TextStyle(
                                fontSize: 11, color: Colors.grey[500]),
                          ),
                        ],
                      ),
                      IconButton(
                        icon: Container(
                          width: 30,
                          height: 30,
                          decoration: BoxDecoration(
                            color: Colors.grey.withValues(alpha: 0.1),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.close, size: 16),
                        ),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),

                  Text(
                    "GEJALA YANG DIRASAKAN",
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                      color: Colors.grey[500],
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Symptom chips
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _symptoms.keys.map((key) {
                      final isSelected = _symptoms[key] ?? false;
                      return GestureDetector(
                        onTap: () => _toggleSymptom(key, !isSelected),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? colors.dataBlue
                                : (isDark
                                    ? const Color(0xFF1E293B)
                                    : const Color(0xFFF1F5F9)),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            key,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: isSelected
                                  ? Colors.white
                                  : (isDark
                                      ? Colors.grey[400]
                                      : Colors.grey[700]),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),

                  const SizedBox(height: 24),

                  // Intensity slider
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        "TINGKAT INTENSITAS",
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                          color: Colors.grey[500],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: _intensity == 0
                              ? colors.stableGreen.withValues(alpha: 0.1)
                              : colors.deviationOrange.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          "${_intensity.toInt()} / 10",
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: _intensity == 0
                                ? colors.stableGreen
                                : colors.deviationOrange,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  SliderTheme(
                    data: SliderTheme.of(context).copyWith(
                      activeTrackColor: _intensity == 0
                          ? colors.stableGreen
                          : colors.deviationOrange,
                      inactiveTrackColor: Colors.grey.withValues(alpha: 0.15),
                      thumbColor: _intensity == 0
                          ? colors.stableGreen
                          : colors.deviationOrange,
                      overlayColor: (_intensity == 0
                              ? colors.stableGreen
                              : colors.deviationOrange)
                          .withValues(alpha: 0.1),
                      trackHeight: 4,
                      thumbShape:
                          const RoundSliderThumbShape(enabledThumbRadius: 10),
                    ),
                    child: Slider(
                      value: _intensity,
                      min: 0,
                      max: 10,
                      divisions: 10,
                      label: _intensity.toInt().toString(),
                      onChanged: (val) =>
                          setState(() => _intensity = val),
                    ),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text("Tidak ada",
                          style: TextStyle(
                              fontSize: 10, color: Colors.grey[500])),
                      Text("Sangat berat",
                          style: TextStyle(
                              fontSize: 10, color: Colors.grey[500])),
                    ],
                  ),

                  const SizedBox(height: 20),

                  Text(
                    "CATATAN TAMBAHAN",
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                      color: Colors.grey[500],
                    ),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _notesController,
                    decoration: InputDecoration(
                      hintText: "Tambahkan catatan opsional...",
                      hintStyle: TextStyle(
                          fontSize: 13, color: Colors.grey[500]),
                    ),
                    maxLines: 3,
                    style: const TextStyle(fontSize: 13),
                  ),

                  const SizedBox(height: 24),

                  // Submit button
                  _buildSubmitButton(colors),
                  const SizedBox(height: 28),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSubmitButton(FunctionalColors colors) {
    return GestureDetector(
      onTap: _submit,
      child: Container(
        width: double.infinity,
        height: 52,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              colors.dataBlue,
              colors.dataBlue.withValues(alpha: 0.8),
            ],
          ),
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: colors.dataBlue.withValues(alpha: 0.3),
              blurRadius: 16,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: const Center(
          child: Text(
            "Simpan Laporan Gejala",
            style: TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
