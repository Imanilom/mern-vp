import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../api_service.dart';
import '../auth_service.dart';

class ActivityScreen extends StatefulWidget {
  const ActivityScreen({Key? key}) : super(key: key);

  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  final List<String> activities = [
    'Tidur', 'Bangun tidur', 'Duduk', 'Duduk bekerja',
    'Berdiri', 'Berjalan', 'Berkendara', 'Makan',
    'Olahraga', 'Istirahat setelah olahraga', 'Bekerja', 'Aktivitas mendadak'
  ];
  String _selectedActivity = 'Duduk bekerja';

  @override
  void initState() {
    super.initState();
    _loadActivity();
  }

  Future<void> _loadActivity() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString('current_activity');
    if (saved != null && mounted) {
      setState(() => _selectedActivity = saved);
    }
  }

  Future<void> _setActivity(String act) async {
    setState(() => _selectedActivity = act);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('current_activity', act);
  }

  double _symptomLevel = 0;
  final Map<String, bool> _symptoms = {
    'Nyeri dada': false,
    'Pusing': false,
    'Sesak napas': false,
    'Lelah': false,
    'Jantung berdebar': false,
    'Tidak ada gejala': true,
  };
  final TextEditingController _notesController = TextEditingController();
  bool _isSubmitting = false;

  Future<void> _submitSymptom() async {
    final userId = await AuthService.getUserId();
    if (userId == null) return;

    setState(() => _isSubmitting = true);

    try {
      // Find the latest active event to annotate
      final events = await ApiService.getEvents(userId, limit: 1);
      if (events.isNotEmpty) {
        final eventId = events.first['_id'];
        
        List<String> selectedSymptoms = _symptoms.entries
          .where((e) => e.value && e.key != 'Tidak ada gejala')
          .map((e) => e.key).toList();
          
        String noteText = 'Gejala: ${selectedSymptoms.isEmpty ? 'Tidak ada' : selectedSymptoms.join(", ")} | Tingkat: ${_symptomLevel.round()}/10';
        if (_notesController.text.isNotEmpty) {
          noteText += ' | Catatan: ${_notesController.text}';
        }

        final success = await ApiService.annotateEvent(eventId, noteText);
        
        if (success && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Gejala berhasil dilaporkan'), backgroundColor: Colors.green));
          // Reset form
          setState(() {
            _symptoms.updateAll((k, v) => false);
            _symptoms['Tidak ada gejala'] = true;
            _symptomLevel = 0;
            _notesController.clear();
          });
        }
      } else {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Tidak ada event aktif untuk dilaporkan')));
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Gagal mengirim: $e')));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F6),
      appBar: AppBar(
        backgroundColor: const Color(0xFF073B4C),
        title: const Text('Aktivitas & Gejala', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Current Activity Banner
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF073B4C), Color(0xFF118AB2)]),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [BoxShadow(color: const Color(0xFF118AB2).withOpacity(0.3), blurRadius: 15, offset: const Offset(0, 8))],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Aktivitas Saat Ini', style: TextStyle(color: Colors.white70, fontSize: 12)),
                  const SizedBox(height: 8),
                  Text(_selectedActivity, style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900, letterSpacing: 1)),
                  const SizedBox(height: 16),
                  const Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Waktu: Saat ini', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Pilihan Aktivitas
            const Text('Ubah Aktivitas', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF073B4C))),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: activities.map((act) => ChoiceChip(
                label: Text(act),
                selected: act == _selectedActivity,
                onSelected: (val) {
                  if (val) _setActivity(act);
                },
                selectedColor: const Color(0xFF073B4C),
                labelStyle: TextStyle(
                  color: act == _selectedActivity ? Colors.white : Colors.grey.shade700,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
                backgroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade300)),
              )).toList(),
            ),
            const SizedBox(height: 32),

            // Form Gejala
            const Text('Catat Gejala yang Dirasakan', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF073B4C))),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _symptoms.keys.map((symptom) => FilterChip(
                      label: Text(symptom),
                      selected: _symptoms[symptom]!,
                      onSelected: (val) {
                        setState(() {
                          if (symptom == 'Tidak ada gejala') {
                            _symptoms.updateAll((key, value) => false);
                            _symptoms['Tidak ada gejala'] = true;
                          } else {
                            _symptoms['Tidak ada gejala'] = false;
                            _symptoms[symptom] = val;
                          }
                        });
                      },
                      selectedColor: Colors.red.shade100,
                      checkmarkColor: Colors.red.shade700,
                      labelStyle: TextStyle(
                        color: _symptoms[symptom]! ? Colors.red.shade900 : Colors.grey.shade700,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                      backgroundColor: Colors.grey.shade50,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: _symptoms[symptom]! ? Colors.red.shade200 : Colors.grey.shade300)),
                    )).toList(),
                  ),
                  const SizedBox(height: 24),
                  
                  const Text('Tingkat Gejala (0 - 10)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)),
                  Slider(
                    value: _symptomLevel,
                    min: 0,
                    max: 10,
                    divisions: 10,
                    activeColor: Colors.red,
                    label: _symptomLevel.round().toString(),
                    onChanged: (val) => setState(() => _symptomLevel = val),
                  ),
                  
                  const SizedBox(height: 16),
                  TextField(
                    controller: _notesController,
                    decoration: InputDecoration(
                      labelText: 'Catatan Tambahan',
                      alignLabelWithHint: true,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    maxLines: 3,
                  ),
                  const SizedBox(height: 24),
                  
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _isSubmitting ? null : _submitSymptom,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF073B4C),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: _isSubmitting 
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Kirim Laporan Gejala', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
