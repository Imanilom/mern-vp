import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import '../services/api_service.dart';

class ClinicalProfileSheet extends StatefulWidget {
  const ClinicalProfileSheet({super.key});

  @override
  State<ClinicalProfileSheet> createState() => _ClinicalProfileSheetState();
}

class _ClinicalProfileSheetState extends State<ClinicalProfileSheet> {
  bool _isLoading = false;

  // 11 Cleveland Features controllers/values
  final _cpController = TextEditingController(text: '0');
  final _trestbpsController = TextEditingController(text: '120');
  final _cholController = TextEditingController(text: '200');
  final _fbsController = TextEditingController(text: '0');
  final _restecgController = TextEditingController(text: '0');
  final _thalachController = TextEditingController(text: '116');
  final _exangController = TextEditingController(text: '0');
  final _oldpeakController = TextEditingController(text: '0.0');
  final _slopeController = TextEditingController(text: '1');
  final _caController = TextEditingController(text: '0');
  final _thalController = TextEditingController(text: '1');

  @override
  void dispose() {
    _cpController.dispose();
    _trestbpsController.dispose();
    _cholController.dispose();
    _fbsController.dispose();
    _restecgController.dispose();
    _thalachController.dispose();
    _exangController.dispose();
    _oldpeakController.dispose();
    _slopeController.dispose();
    _caController.dispose();
    _thalController.dispose();
    super.dispose();
  }

  Future<void> _submitProfile() async {
    setState(() {
      _isLoading = true;
    });

    final payload = {
      'cp': int.tryParse(_cpController.text) ?? 0,
      'trestbps': int.tryParse(_trestbpsController.text) ?? 120,
      'chol': int.tryParse(_cholController.text) ?? 200,
      'fbs': int.tryParse(_fbsController.text) ?? 0,
      'restecg': int.tryParse(_restecgController.text) ?? 0,
      'thalach': int.tryParse(_thalachController.text) ?? 116,
      'exang': int.tryParse(_exangController.text) ?? 0,
      'oldpeak': double.tryParse(_oldpeakController.text) ?? 0.0,
      'slope': int.tryParse(_slopeController.text) ?? 1,
      'ca': int.tryParse(_caController.text) ?? 0,
      'thal': int.tryParse(_thalController.text) ?? 1,
    };

    final success = await ApiService.updateClinicalProfile(payload);

    if (!mounted) return;
    setState(() {
      _isLoading = false;
    });

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profil Klinis berhasil diperbarui!'), backgroundColor: AppColors.teal),
      );
      Navigator.pop(context, true);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Gagal memperbarui profil klinis.'), backgroundColor: AppColors.red),
      );
    }
  }

  Widget _buildField(String label, TextEditingController controller, String hint) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: controller,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        style: const TextStyle(fontSize: 13),
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      padding: EdgeInsets.only(
        top: 24,
        left: 20,
        right: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Lengkapi Profil Klinis',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.navy),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: AppColors.gray),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Lengkapi 11 variabel Cleveland berikut agar sistem Digital Twin dapat mensimulasikan Resilience State secara akurat.',
            style: TextStyle(fontSize: 12.5, color: AppColors.gray, height: 1.4),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: ListView(
              children: [
                _buildField('Chest Pain Type (0-3)', _cpController, 'Contoh: 0 (Asymptomatic)'),
                _buildField('Resting Blood Pressure (mm Hg)', _trestbpsController, 'Contoh: 120'),
                _buildField('Serum Cholestoral (mg/dl)', _cholController, 'Contoh: 200'),
                _buildField('Fasting Blood Sugar > 120 mg/dl (1 = true; 0 = false)', _fbsController, 'Contoh: 0'),
                _buildField('Resting Electrocardiographic Results (0-2)', _restecgController, 'Contoh: 0'),
                _buildField('Maximum Heart Rate Achieved', _thalachController, 'Contoh: 150'),
                _buildField('Exercise Induced Angina (1 = yes; 0 = no)', _exangController, 'Contoh: 0'),
                _buildField('ST Depression Induced by Exercise', _oldpeakController, 'Contoh: 0.5'),
                _buildField('Slope of Peak Exercise ST Segment (0-2)', _slopeController, 'Contoh: 1'),
                _buildField('Number of Major Vessels (0-3)', _caController, 'Contoh: 0'),
                _buildField('Thalassemia (0-3)', _thalController, 'Contoh: 1 (Normal)'),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _submitProfile,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.teal,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isLoading
                  ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Simpan Profil Klinis', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
            ),
          ),
        ],
      ),
    );
  }
}
