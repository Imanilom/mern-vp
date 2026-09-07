import 'package:flutter/material.dart';
import '../../theme/app_colors.dart';
import '../../services/api_service.dart';

class BehavioralInputSheet extends StatefulWidget {
  const BehavioralInputSheet({super.key});

  static void show(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => const BehavioralInputSheet(),
    );
  }

  @override
  State<BehavioralInputSheet> createState() => _BehavioralInputSheetState();
}

class _BehavioralInputSheetState extends State<BehavioralInputSheet> {
  String _selectedFactor = 'physical_activity';
  String _intensity = 'moderate';
  int _durationMinutes = 30;
  final TextEditingController _notesController = TextEditingController();
  bool _isSubmitting = false;

  final List<Map<String, dynamic>> _factors = [
    {
      'key': 'physical_activity',
      'title': 'Aktivitas Fisik / Latihan',
      'icon': Icons.directions_run_rounded,
      'color': const Color(0xFF10B981),
      'desc': 'Olahraga, jalan cepat, naik tangga',
    },
    {
      'key': 'mental_stress',
      'title': 'Stres Mental / Emosional Akut',
      'icon': Icons.psychology_rounded,
      'color': const Color(0xFF8B5CF6),
      'desc': 'Beban kerja tinggi, tenggat waktu, marah',
    },
    {
      'key': 'posture_change',
      'title': 'Perubahan Postur (Orthostatik)',
      'icon': Icons.accessibility_new_rounded,
      'color': const Color(0xFF3B82F6),
      'desc': 'Bangkit berdiri mendadak',
    },
    {
      'key': 'caffeine_alcohol',
      'title': 'Konsumsi Alkohol / Kafein',
      'icon': Icons.local_cafe_rounded,
      'color': const Color(0xFF92400E),
      'desc': 'Kopi, teh pekat, minuman keras',
    },
    {
      'key': 'poor_sleep',
      'title': 'Kurang Tidur',
      'icon': Icons.bedtime_rounded,
      'color': const Color(0xFF6366F1),
      'desc': 'Begadang, kualitas tidur buruk semalam',
    },
    {
      'key': 'smoking',
      'title': 'Merokok / Vaping',
      'icon': Icons.smoking_rooms_rounded,
      'color': const Color(0xFF64748B),
      'desc': 'Konsumsi nikotin',
    },
    {
      'key': 'poor_diet',
      'title': 'Diet Ultra Processed / Tinggi Natrium',
      'icon': Icons.fastfood_rounded,
      'color': const Color(0xFFEC4899),
      'desc': 'Makan makanan cepat saji, tinggi garam',
    },
    {
      'key': 'cognitive_load',
      'title': 'Beban Kognitif Tinggi',
      'icon': Icons.memory_rounded,
      'color': const Color(0xFFF59E0B),
      'desc': 'Fokus intens, ujian, presentasi',
    },
  ];

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _submitEvent() async {
    setState(() => _isSubmitting = true);
    try {
      final now = DateTime.now().millisecondsSinceEpoch;
      final start = now - (_durationMinutes * 60000);
      
      final payload = {
        'behavior_type': _selectedFactor,
        'intensity': _intensity,
        'value': _durationMinutes,
        'unit': 'minutes',
        'timestamp_start': start,
        'timestamp_end': now,
        'notes': _notesController.text.trim(),
        'source': 'user_reported',
      };

      final res = await ApiService.submitBehaviorEvent(payload);
      if (!mounted) return;
      setState(() => _isSubmitting = false);

      if (res?['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Data perilaku berhasil dicatat.'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
        Navigator.pop(context, true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Gagal menyimpan data perilaku.'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Terjadi kesalahan: $e'), backgroundColor: Colors.redAccent),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        top: 20,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 4.5,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const Row(
              children: [
                Icon(Icons.edit_note_rounded, color: AppColors.teal, size: 22),
                SizedBox(width: 8),
                Text(
                  'Input Data Perilaku Harian',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            const Text(
              'Pilih aktivitas atau perilaku yang baru saja Anda alami untuk memperbarui model CAPAR Engine.',
              style: TextStyle(fontSize: 12, color: AppColors.gray, height: 1.3),
            ),
            const SizedBox(height: 16),
            const Text(
              '1. Jenis Perilaku',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 8),
            ...List.generate(_factors.length, (idx) {
              final f = _factors[idx];
              final isSel = _selectedFactor == f['key'];
              final color = f['color'] as Color;

              return InkWell(
                onTap: () => setState(() => _selectedFactor = f['key']),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isSel ? color.withValues(alpha: 0.08) : const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSel ? color : const Color(0xFFE2E8F0),
                      width: isSel ? 1.8 : 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: color.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Icon(f['icon'] as IconData, color: color, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              f['title'] as String,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: isSel ? color : const Color(0xFF1E293B),
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              f['desc'] as String,
                              style: const TextStyle(fontSize: 11, color: AppColors.gray),
                            ),
                          ],
                        ),
                      ),
                      if (isSel)
                        Icon(Icons.check_circle_rounded, color: color, size: 20)
                      else
                        const Icon(Icons.radio_button_unchecked_rounded, color: Color(0xFFCBD5E1), size: 20),
                    ],
                  ),
                ),
              );
            }),
            const SizedBox(height: 12),
            const Text(
              '2. Intensitas Beban',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _buildIntensityOption('low', 'Ringan', Colors.green),
                const SizedBox(width: 8),
                _buildIntensityOption('moderate', 'Sedang', Colors.orange),
                const SizedBox(width: 8),
                _buildIntensityOption('high', 'Berat / Tinggi', Colors.red),
              ],
            ),
            const SizedBox(height: 14),
            const Text(
              '3. Estimasi Durasi (Menit)',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [10, 20, 30, 45, 60, 90, 120].map((d) {
                final isSel = _durationMinutes == d;
                return ChoiceChip(
                  label: Text('$d mnt', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: isSel ? Colors.white : Colors.black87)),
                  selected: isSel,
                  selectedColor: AppColors.teal,
                  backgroundColor: const Color(0xFFF1F5F9),
                  showCheckmark: false,
                  onSelected: (val) {
                    if (val) setState(() => _durationMinutes = d);
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 14),
            const Text(
              '4. Catatan (Opsional)',
              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: Color(0xFF1E293B)),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _notesController,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: 'Tambahkan detail spesifik...',
                hintStyle: const TextStyle(fontSize: 11.5, color: AppColors.gray),
                contentPadding: const EdgeInsets.all(12),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: Color(0xFFCBD5E1)),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: AppColors.teal, width: 1.5),
                ),
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
              ),
              style: const TextStyle(fontSize: 12),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submitEvent,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.teal,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Text(
                        'Simpan Data Perilaku',
                        style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIntensityOption(String key, String label, Color color) {
    final isSel = _intensity == key;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _intensity = key),
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 9),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: isSel ? color.withValues(alpha: 0.12) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSel ? color : const Color(0xFFE2E8F0),
              width: isSel ? 1.8 : 1,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              fontWeight: FontWeight.w800,
              color: isSel ? color : const Color(0xFF475569),
            ),
          ),
        ),
      ),
    );
  }
}
