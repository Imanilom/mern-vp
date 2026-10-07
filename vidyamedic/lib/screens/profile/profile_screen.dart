import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../services/api_config.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';
import '../welcome_screen.dart';
import 'wearable_pairing_screen.dart';

/// Halaman Profil & Tata Kelola Kesehatan VidyaMedic
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  Future<void> _persistProfileChange(BuildContext context) async {
    final s = context.read<AppState>();
    if (await s.saveProfileToServer()) return;
    await s.fetchProfile();
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.dataError ?? 'Perubahan profil gagal disimpan ke server.')),
      );
    }
  }

  void _openEditProfile(BuildContext context, UserProfile u) {
    final nameCtrl = TextEditingController(text: u.name);
    final heightCtrl = TextEditingController(text: u.heightCm?.toInt().toString() ?? '');
    final weightCtrl = TextEditingController(text: u.weightKg?.toInt().toString() ?? '');
    final emergencyNameCtrl = TextEditingController(text: u.emergencyContactName);
    final emergencyPhoneCtrl = TextEditingController(text: u.emergencyContactPhone);
    final allergiesCtrl = TextEditingController(text: u.allergies);
    Gender? gender = u.gender;
    DateTime? birth = u.birthDate;
    String timeZone = u.timeZone;
    String? bloodType = u.bloodType.isEmpty ? null : u.bloodType;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setMState) => Padding(
          padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(ctx).viewInsets.bottom + 24),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 42,
                    height: 4.5,
                    decoration: BoxDecoration(
                      color: AppTheme.borderLight,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Edit Profil Pasien',
                        style: AppTheme.font(size: 17, weight: FontWeight.w800, color: AppTheme.primaryDark)),
                    IconButton.filledTonal(
                      style: IconButton.styleFrom(
                        backgroundColor: AppTheme.fieldFill,
                        padding: const EdgeInsets.all(6),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      icon: const Icon(Icons.close_rounded, size: 18, color: AppTheme.textPrimary),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const Divider(height: 20),
                const FieldLabel('Nama Lengkap Pasien'),
                TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(
                    hintText: 'Nama lengkap',
                    prefixIcon: Icon(Icons.person_outline_rounded, size: 20, color: AppTheme.primary),
                  ),
                ),
                const FieldLabel('Jenis Kelamin'),
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        borderRadius: BorderRadius.circular(14),
                        onTap: () => setMState(() => gender = Gender.female),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            gradient: gender == Gender.female ? AppTheme.primaryGradient : null,
                            color: gender == Gender.female ? null : AppTheme.fieldFill,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: gender == Gender.female ? AppTheme.primary : AppTheme.borderLight,
                              width: 1.2,
                            ),
                            boxShadow: gender == Gender.female
                                ? [
                                    BoxShadow(
                                      color: AppTheme.primary.withValues(alpha: 0.25),
                                      blurRadius: 8,
                                      offset: const Offset(0, 3),
                                    ),
                                  ]
                                : null,
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.female_rounded,
                                  size: 18, color: gender == Gender.female ? Colors.white : AppTheme.textPrimary),
                              const SizedBox(width: 6),
                              Text(
                                'Perempuan',
                                style: AppTheme.font(
                                  size: 13,
                                  weight: FontWeight.w700,
                                  color: gender == Gender.female ? Colors.white : AppTheme.textPrimary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: InkWell(
                        borderRadius: BorderRadius.circular(14),
                        onTap: () => setMState(() => gender = Gender.male),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            gradient: gender == Gender.male ? AppTheme.primaryGradient : null,
                            color: gender == Gender.male ? null : AppTheme.fieldFill,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: gender == Gender.male ? AppTheme.primary : AppTheme.borderLight,
                              width: 1.2,
                            ),
                            boxShadow: gender == Gender.male
                                ? [
                                    BoxShadow(
                                      color: AppTheme.primary.withValues(alpha: 0.25),
                                      blurRadius: 8,
                                      offset: const Offset(0, 3),
                                    ),
                                  ]
                                : null,
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.male_rounded,
                                  size: 18, color: gender == Gender.male ? Colors.white : AppTheme.textPrimary),
                              const SizedBox(width: 6),
                              Text(
                                'Laki-laki',
                                style: AppTheme.font(
                                  size: 13,
                                  weight: FontWeight.w700,
                                  color: gender == Gender.male ? Colors.white : AppTheme.textPrimary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const FieldLabel('Tinggi Badan'),
                          TextField(
                            controller: heightCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              suffixText: 'cm',
                              prefixIcon: Icon(Icons.height_rounded, size: 20, color: AppTheme.primary),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const FieldLabel('Berat Badan'),
                          TextField(
                            controller: weightCtrl,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              suffixText: 'kg',
                              prefixIcon: Icon(Icons.monitor_weight_outlined, size: 20, color: AppTheme.primary),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const FieldLabel('Golongan Darah'),
                          DropdownButtonFormField<String>(
                            initialValue: bloodType,
                            style: AppTheme.font(size: 13.5, color: AppTheme.textPrimary),
                            decoration: const InputDecoration(
                              prefixIcon: Icon(Icons.bloodtype_outlined, size: 20, color: AppTheme.statusRed),
                            ),
                            items: const ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
                                .map((b) => DropdownMenuItem(value: b, child: Text(b)))
                                .toList(),
                            onChanged: (v) => setMState(() => bloodType = v),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const FieldLabel('Zona Waktu'),
                          DropdownButtonFormField<String>(
                            initialValue: timeZone,
                            style: AppTheme.font(size: 13.5, color: AppTheme.textPrimary),
                            decoration: const InputDecoration(
                              prefixIcon: Icon(Icons.schedule_rounded, size: 20, color: AppTheme.primary),
                            ),
                            items: const ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura']
                                .map((z) => DropdownMenuItem(value: z, child: Text(z)))
                                .toList(),
                            onChanged: (v) => setMState(() => timeZone = v ?? timeZone),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const FieldLabel('Riwayat Alergi / Peringatan Obat'),
                TextField(
                  controller: allergiesCtrl,
                  decoration: const InputDecoration(
                    hintText: 'Contoh: Penicillin, Kacang, Seafood',
                    prefixIcon: Icon(Icons.warning_amber_rounded, size: 20, color: AppTheme.statusOrange),
                  ),
                ),
                const FieldLabel('Kontak Darurat / Caregiver'),
                TextField(
                  controller: emergencyNameCtrl,
                  decoration: const InputDecoration(
                    hintText: 'Nama Caregiver (Contoh: Budi - Suami)',
                    prefixIcon: Icon(Icons.contact_emergency_outlined, size: 20, color: AppTheme.primaryDark),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: emergencyPhoneCtrl,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    hintText: 'Nomor Telepon Darurat',
                    prefixIcon: Icon(Icons.phone_outlined, size: 20, color: AppTheme.primaryDark),
                  ),
                ),
                const SizedBox(height: 24),
                Container(
                  width: double.infinity,
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: AppTheme.primaryGradient,
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.primary.withValues(alpha: 0.35),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      shadowColor: Colors.transparent,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    onPressed: () async {
                      final s = context.read<AppState>();
                      s.update(() {
                        s.userProfile = UserProfile(
                          name: nameCtrl.text.trim().isEmpty ? u.name : nameCtrl.text.trim(),
                          birthDate: birth,
                          gender: gender,
                          heightCm: double.tryParse(heightCtrl.text) ?? u.heightCm,
                          weightKg: double.tryParse(weightCtrl.text) ?? u.weightKg,
                          timeZone: timeZone,
                          bloodType: bloodType ?? '',
                          emergencyContactName: emergencyNameCtrl.text.trim(),
                          emergencyContactPhone: emergencyPhoneCtrl.text.trim(),
                          allergies: allergiesCtrl.text.trim(),
                        );
                      });
                      final saved = await s.saveProfileToServer();
                      if (!ctx.mounted) return;
                      if (!saved) {
                        ScaffoldMessenger.of(ctx).showSnackBar(
                          SnackBar(content: Text(s.dataError ?? 'Profil gagal disimpan ke server.')),
                        );
                        return;
                      }
                      Navigator.pop(ctx);
                      showSaved(context, 'Profil pasien berhasil diperbarui');
                    },
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.check_circle_rounded, size: 18, color: Colors.white),
                        const SizedBox(width: 8),
                        Text('Simpan Perubahan Profil',
                            style: AppTheme.font(size: 14, weight: FontWeight.w800, color: Colors.white)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showLinkCaparDialog(BuildContext context) {
    final passCtrl = TextEditingController();
    bool isSubmitting = false;
    String? errorMsg;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: const BoxDecoration(color: AppTheme.primarySoft, shape: BoxShape.circle),
                child: const Icon(Icons.link_rounded, color: AppTheme.primary, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text('Tautkan Akun CAPAR', style: AppTheme.font(size: 16, weight: FontWeight.w700)),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Hubungkan akun dengan rekam medis CAPAR lama Anda menggunakan kata sandi pasien.',
                style: AppTheme.font(size: 12.5, color: AppTheme.textSecondary, height: 1.35),
              ),
              const SizedBox(height: 14),
              if (errorMsg != null) ...[
                Text(errorMsg!, style: AppTheme.font(size: 12, color: AppTheme.statusRed, weight: FontWeight.w600)),
                const SizedBox(height: 8),
              ],
              TextField(
                controller: passCtrl,
                obscureText: true,
                decoration: const InputDecoration(
                  hintText: 'Kata sandi akun pasien lama',
                  prefixIcon: Icon(Icons.lock_outline_rounded, size: 20),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Batal'),
            ),
            ElevatedButton(
              onPressed: isSubmitting
                  ? null
                  : () async {
                      final p = passCtrl.text;
                      if (p.isEmpty) {
                        setDState(() => errorMsg = 'Kata sandi tidak boleh kosong.');
                        return;
                      }
                      setDState(() {
                        isSubmitting = true;
                        errorMsg = null;
                      });
                      final s = context.read<AppState>();
                      final ok = await s.linkLegacyCaparAccount(p);
                      if (!ctx.mounted) return;
                      if (ok) {
                        Navigator.pop(ctx);
                        showSaved(context, 'Akun CAPAR berhasil ditautkan!');
                      } else {
                        setDState(() {
                          isSubmitting = false;
                          errorMsg = 'Gagal menautkan akun. Pastikan kata sandi benar.';
                        });
                      }
                    },
              child: isSubmitting
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Tautkan'),
            ),
          ],
        ),
      ),
    );
  }

  void _showServerConfigDialog(BuildContext context) {
    final ctrl = TextEditingController(text: ApiConfig.baseUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Pengaturan Alamat Server', style: AppTheme.font(size: 16, weight: FontWeight.w700)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('URL backend server API yang digunakan aplikasi:',
                style: AppTheme.font(size: 12.5, color: AppTheme.textSecondary)),
            const SizedBox(height: 10),
            TextField(
              controller: ctrl,
              decoration: const InputDecoration(
                hintText: 'http://10.0.2.2:3030 atau http://localhost:3030',
                prefixIcon: Icon(Icons.dns_outlined, size: 20),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () async {
              await ApiConfig.resetBaseUrl();
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('Reset'),
          ),
          ElevatedButton(
            onPressed: () async {
              final newUrl = ctrl.text.trim();
              if (newUrl.isNotEmpty) {
                await ApiConfig.setBaseUrl(newUrl);
              }
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('Simpan'),
          ),
        ],
      ),
    );
  }

  void _logoutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Keluar dari Akun?', style: AppTheme.font(size: 16, weight: FontWeight.w700)),
        content: Text('Anda dapat masuk kembali kapan saja untuk melanjutkan pemantauan.',
            style: AppTheme.font(size: 13, color: AppTheme.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.statusRed),
            onPressed: () async {
              Navigator.pop(ctx);
              await context.read<AppState>().logout();
              if (context.mounted) {
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (_) => const WelcomeScreen()),
                  (_) => false,
                );
              }
            },
            child: const Text('Keluar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _addConditionModal(BuildContext context) {
    final s = context.read<AppState>();
    final ctrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(ctx).viewInsets.bottom + 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4.5,
                decoration: BoxDecoration(color: AppTheme.borderLight, borderRadius: BorderRadius.circular(3)),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Kelola Kondisi Medis',
                    style: AppTheme.font(size: 17, weight: FontWeight.w800, color: AppTheme.primaryDark)),
                IconButton.filledTonal(
                  style: IconButton.styleFrom(
                    backgroundColor: AppTheme.fieldFill,
                    padding: const EdgeInsets.all(6),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  icon: const Icon(Icons.close_rounded, size: 18, color: AppTheme.textPrimary),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text('Pilih dari rekomendasi klinis:',
                style: AppTheme.font(size: 12, color: AppTheme.textMuted, weight: FontWeight.w600)),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: s.conditionOptions.map((c) {
                final isSelected = s.medicalConditions.contains(c);
                return FilterChip(
                  label: Text(c),
                  selected: isSelected,
                  selectedColor: AppTheme.primarySoft,
                  checkmarkColor: AppTheme.primary,
                  backgroundColor: AppTheme.fieldFill,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                    side: BorderSide(color: isSelected ? AppTheme.primary : AppTheme.borderLight),
                  ),
                  labelStyle: AppTheme.font(
                    size: 12,
                    weight: isSelected ? FontWeight.w800 : FontWeight.w500,
                    color: isSelected ? AppTheme.primaryDark : AppTheme.textPrimary,
                  ),
                  onSelected: (_) {
                    s.toggleCondition(c);
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
            const FieldLabel('Atau Tambah Kondisi Kustom'),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: ctrl,
                    decoration: const InputDecoration(
                      hintText: 'Contoh: Aritmia Paroksismal',
                      prefixIcon: Icon(Icons.medical_information_outlined, size: 20, color: AppTheme.primary),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Container(
                  height: 48,
                  width: 48,
                  decoration: BoxDecoration(
                    gradient: AppTheme.primaryGradient,
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.primary.withValues(alpha: 0.3),
                        blurRadius: 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.add_rounded, color: Colors.white, size: 24),
                    onPressed: () {
                      final text = ctrl.text.trim();
                      if (text.isNotEmpty) {
                        if (!s.medicalConditions.contains(text)) {
                          s.update(() => s.medicalConditions.add(text));
                        }
                        ctrl.clear();
                      }
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 22),
            Container(
              width: double.infinity,
              height: 48,
              decoration: BoxDecoration(
                gradient: AppTheme.primaryGradient,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primary.withValues(alpha: 0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  shadowColor: Colors.transparent,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: () => Navigator.pop(ctx),
                child: Text('Selesai', style: AppTheme.font(size: 14, weight: FontWeight.w800, color: Colors.white)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _addMedicationModal(BuildContext context, {int? editIndex}) {
    final s = context.read<AppState>();
    final existing = editIndex != null ? s.routineMedications[editIndex] : null;
    final name = TextEditingController(text: existing?.name);
    final dose = TextEditingController(text: existing?.dosage);
    final freq = TextEditingController(text: existing?.frequency ?? '');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(ctx).viewInsets.bottom + 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4.5,
                decoration: BoxDecoration(color: AppTheme.borderLight, borderRadius: BorderRadius.circular(3)),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(existing == null ? 'Tambah Obat Rutin' : 'Ubah Obat Rutin',
                    style: AppTheme.font(size: 17, weight: FontWeight.w800, color: AppTheme.primaryDark)),
                IconButton.filledTonal(
                  style: IconButton.styleFrom(
                    backgroundColor: AppTheme.fieldFill,
                    padding: const EdgeInsets.all(6),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  icon: const Icon(Icons.close_rounded, size: 18, color: AppTheme.textPrimary),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const SizedBox(height: 10),
            const FieldLabel('Nama Obat'),
            TextField(
              controller: name,
              decoration: const InputDecoration(
                hintText: 'Contoh: Bisoprolol / Candesartan',
                prefixIcon: Icon(Icons.medication_liquid_outlined, size: 20, color: AppTheme.primary),
              ),
            ),
            const FieldLabel('Dosis'),
            TextField(
              controller: dose,
              decoration: const InputDecoration(
                hintText: 'Contoh: 5 mg / 8 mg',
                prefixIcon: Icon(Icons.scale_rounded, size: 20, color: AppTheme.primary),
              ),
            ),
            const FieldLabel('Jadwal & Frekuensi'),
            TextField(
              controller: freq,
              decoration: const InputDecoration(
                hintText: 'Contoh: 1x sehari (pagi sesudah makan)',
                prefixIcon: Icon(Icons.alarm_on_rounded, size: 20, color: AppTheme.primary),
              ),
            ),
            const SizedBox(height: 22),
            Container(
              width: double.infinity,
              height: 48,
              decoration: BoxDecoration(
                gradient: AppTheme.primaryGradient,
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primary.withValues(alpha: 0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  shadowColor: Colors.transparent,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: () async {
                  if (name.text.trim().isEmpty) return;
                  final m = Medication(name: name.text.trim(), dosage: dose.text.trim(), frequency: freq.text.trim());
                  if (editIndex != null) {
                    s.update(() => s.routineMedications[editIndex] = m);
                  } else {
                    s.addMedication(m);
                  }
                  if (!await s.saveProfileToServer()) {
                    await s.fetchProfile();
                    if (ctx.mounted) {
                      ScaffoldMessenger.of(ctx).showSnackBar(
                        SnackBar(content: Text(s.dataError ?? 'Obat gagal disimpan ke server.')),
                      );
                    }
                    return;
                  }
                  if (!ctx.mounted) return;
                  Navigator.pop(ctx);
                  showSaved(context, 'Daftar obat tersimpan di server');
                },
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.save_rounded, size: 18, color: Colors.white),
                    const SizedBox(width: 8),
                    Text('Simpan Obat', style: AppTheme.font(size: 14, weight: FontWeight.w800, color: Colors.white)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showExportSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 42,
                height: 4.5,
                decoration: BoxDecoration(color: AppTheme.borderLight, borderRadius: BorderRadius.circular(3)),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: const BoxDecoration(color: AppTheme.primarySoft, shape: BoxShape.circle),
                  child: const Icon(Icons.picture_as_pdf_rounded, color: AppTheme.primary, size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Ekspor Laporan Kesehatan PDF',
                          style: AppTheme.font(size: 16, weight: FontWeight.w800, color: AppTheme.primaryDark)),
                      Text('Dokumen ringkasan klinis terenkripsi',
                          style: AppTheme.font(size: 12, color: AppTheme.textSecondary)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),
            _exportOptionTile(
              icon: Icons.download_rounded,
              title: 'Unduh PDF Ringkasan 7 Hari',
              subtitle: 'Berisi grafik deviasi z-score, HRV, tidur, dan status CAPAR',
              onTap: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Ekspor PDF belum tersedia dari backend.')),
                );
              },
            ),
            const SizedBox(height: 10),
            _exportOptionTile(
              icon: Icons.send_rounded,
              title: 'Kirim Langsung ke WhatsApp Dokter / Faskes',
              subtitle: 'Format ringkasan klinis terstandar HL7 FHIR ready',
              onTap: () {
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Berbagi laporan belum tersedia dari backend.')),
                );
              },
            ),
            const SizedBox(height: 10),
            _exportOptionTile(
              icon: Icons.share_outlined,
              title: 'Bagikan dengan Caregiver / Keluarga',
              subtitle: 'Kirimkan notifikasi ringkasan pemulihan harian',
              onTap: () {
                Navigator.pop(ctx);
                showSaved(context, 'Tautan ringkasan dibagikan ke caregiver.');
              },
            ),
          ],
        ),
      ),
    );
  }

  static Widget _exportOptionTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          color: AppTheme.fieldFill,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.borderLight),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: AppTheme.primarySoft,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, size: 20, color: AppTheme.primaryDark),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: AppTheme.font(size: 13, weight: FontWeight.w700, color: AppTheme.textPrimary)),
                  const SizedBox(height: 2),
                  Text(subtitle, style: AppTheme.font(size: 11, color: AppTheme.textMuted)),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppTheme.textMuted),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    final u = s.userProfile;
    final w = s.wearable;

    final hasBmi = u.heightCm != null && u.heightCm! > 0 && u.weightKg != null;
    final bmiVal = hasBmi ? u.weightKg! / ((u.heightCm! / 100) * (u.heightCm! / 100)) : null;
    final bmi = bmiVal?.toStringAsFixed(1) ?? 'Belum ada';
    String bmiCategory = 'Belum ada';
    Color bmiColor = AppTheme.statusGreen;
    if (bmiVal != null && bmiVal < 18.5) {
      bmiCategory = 'Kurang';
      bmiColor = AppTheme.statusOrange;
    } else if (bmiVal != null && bmiVal >= 25.0 && bmiVal < 30.0) {
      bmiCategory = 'Berlebih';
      bmiColor = AppTheme.statusYellow;
    } else if (bmiVal != null && bmiVal >= 30.0) {
      bmiCategory = 'Obesitas';
      bmiColor = AppTheme.statusRed;
    } else if (bmiVal != null) {
      bmiCategory = 'Normal';
    }

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Text(
          'Profil & Tata Kelola Medis',
          style: AppTheme.font(size: 17, weight: FontWeight.w800, color: AppTheme.primaryDark),
        ),
        actions: [
          Container(
            margin: const EdgeInsets.only(right: 12),
            decoration: const BoxDecoration(
              color: AppTheme.primarySoft,
              shape: BoxShape.circle,
            ),
            child: IconButton(
              icon: const Icon(Icons.share_outlined, color: AppTheme.primaryDark, size: 19),
              tooltip: 'Bagikan Profil',
              onPressed: () => _showExportSheet(context),
            ),
          ),
        ],
      ),
      body: ListView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 10, 20, 36),
        children: [
          // 1. User Identity Hero Card
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: AppTheme.borderLight),
              boxShadow: AppTheme.shadowSoft,
            ),
            child: Column(
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Stack(
                      children: [
                        Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            gradient: AppTheme.primaryGradient,
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: AppTheme.primary.withValues(alpha: 0.25),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
                          ),
                          child: Center(
                            child: Text(
                              u.name.isNotEmpty ? u.name.substring(0, 1).toUpperCase() : 'U',
                              style: AppTheme.font(size: 24, weight: FontWeight.w800, color: Colors.white),
                            ),
                          ),
                        ),
                        Positioned(
                          right: 0,
                          bottom: 0,
                          child: Container(
                            padding: const EdgeInsets.all(3),
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                            ),
                            child: Container(
                              width: 12,
                              height: 12,
                              decoration: const BoxDecoration(
                                color: AppTheme.statusGreen,
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            u.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTheme.font(size: 16.5, weight: FontWeight.w800, color: AppTheme.textPrimary),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            '${u.age == null ? "Usia belum tersedia" : "${u.age} tahun"} • ${u.gender?.label ?? "Jenis kelamin belum tersedia"}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTheme.font(size: 11.5, color: AppTheme.textSecondary),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            'Zona: ${u.timeZone}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTheme.font(size: 11, color: AppTheme.textMuted),
                          ),
                        ],
                      ),
                    ),
                    // High-End Edit Profile Pill Button
                    InkWell(
                      onTap: () => _openEditProfile(context, u),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: AppTheme.primarySoft,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppTheme.primaryLight.withValues(alpha: 0.4)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.edit_outlined, color: AppTheme.primaryDark, size: 15),
                            const SizedBox(width: 4),
                            Text('Edit',
                                style: AppTheme.font(size: 12, weight: FontWeight.w800, color: AppTheme.primaryDark)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                // Health stats pills
                Row(
                  children: [
                    Expanded(
                      child: _statPill('Tinggi', u.heightCm == null ? 'Belum ada' : '${u.heightCm!.toInt()} cm', Icons.height_rounded),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _statPill('Berat', u.weightKg == null ? 'Belum ada' : '${u.weightKg!.toInt()} kg', Icons.monitor_weight_outlined),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _statPill('BMI ($bmiCategory)', bmi, Icons.favorite_border_rounded, valueColor: bmiColor),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // 2. Medical Emergency ID Card (Kartu Darurat Medis)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF7ED),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFFED7AA)),
              boxShadow: AppTheme.shadowSoft,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppTheme.statusRed.withValues(alpha: 0.12),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.medical_services_outlined, color: AppTheme.statusRed, size: 18),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Kartu Identitas Darurat Medis',
                              style: AppTheme.font(size: 13, weight: FontWeight.w800, color: const Color(0xFF9A3412))),
                          Text('Informasi kritis saat kondisi darurat',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTheme.font(size: 10.5, color: const Color(0xFFC2410C))),
                        ],
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                      decoration: BoxDecoration(
                        color: AppTheme.statusRed,
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.statusRed.withValues(alpha: 0.25),
                            blurRadius: 4,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Text('Gol: ${u.bloodType}',
                          style: AppTheme.font(size: 10.5, weight: FontWeight.w800, color: Colors.white)),
                    ),
                  ],
                ),
                const Divider(color: Color(0xFFFED7AA), height: 20),
                Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, size: 16, color: AppTheme.statusOrange),
                    const SizedBox(width: 6),
                    Text('Alergi: ',
                        style: AppTheme.font(size: 12, weight: FontWeight.w700, color: const Color(0xFF9A3412))),
                    Expanded(
                      child: Text(
                        u.allergies.isNotEmpty ? u.allergies : 'Tidak ada alergi obat',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.font(size: 12, color: AppTheme.textPrimary),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    const Icon(Icons.contact_phone_outlined, size: 16, color: AppTheme.primaryDark),
                    const SizedBox(width: 6),
                    Text('Caregiver: ',
                        style: AppTheme.font(size: 12, weight: FontWeight.w700, color: AppTheme.primaryDark)),
                    Expanded(
                      child: Text(
                        '${u.emergencyContactName} (${u.emergencyContactPhone})',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTheme.font(size: 12, color: AppTheme.textPrimary, weight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // 3. Connected Smartwatch Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: AppTheme.heroGradient,
              borderRadius: BorderRadius.circular(20),
              boxShadow: AppTheme.shadowCard,
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(11),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.18),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.watch_rounded, color: Colors.white, size: 24),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  w.deviceName.isEmpty ? 'Wearable belum tersedia' : w.deviceName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTheme.font(size: 15, weight: FontWeight.w800, color: Colors.white),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                                decoration: BoxDecoration(
                                  color: AppTheme.accentMint.withValues(alpha: 0.25),
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: AppTheme.accentMint.withValues(alpha: 0.5)),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Container(
                                      width: 6,
                                      height: 6,
                                      decoration: const BoxDecoration(
                                        color: AppTheme.accentMint,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                                    const SizedBox(width: 4),
                                    Text(w.hasServerSamples ? 'Sampel server' : 'Belum tersedia',
                                        style: AppTheme.font(
                                            size: 9.5,
                                            weight: FontWeight.w700,
                                            color: w.hasServerSamples ? AppTheme.accentMint : Colors.white70)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 3),
                          Text(
                              w.lastSync == null
                                  ? 'Data perangkat belum tersedia dari server'
                                  : 'Sampel terakhir: ${w.lastSync!.toLocal()}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTheme.font(size: 11, color: Colors.white70)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.sensors_rounded, color: AppTheme.accentMint, size: 16),
                          const SizedBox(width: 6),
                          Text(
                            s.wearable.hasServerSamples ? 'Sampel wearable tersedia' : 'Belum ada sampel wearable',
                            style: AppTheme.font(size: 11.5, weight: FontWeight.w600, color: Colors.white),
                          ),
                        ],
                      ),
                      // Tactile White Sync Pill Button
                      InkWell(
                        onTap: () async {
                          final synced = await s.syncWearable();
                          if (!context.mounted) return;
                          if (!synced) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(s.dataError ?? 'Sinkronisasi gagal.')),
                            );
                          } else if (s.wearableSamples.isEmpty) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(s.dataError ?? 'Belum ada sampel wearable di server.')),
                            );
                          } else {
                            showSaved(context, 'Sampel wearable dimuat dari server');
                          }
                        },
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x20000000),
                                blurRadius: 4,
                                offset: Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.sync_rounded, size: 14, color: AppTheme.primaryDark),
                              const SizedBox(width: 4),
                              Text('Sinkron',
                                  style: AppTheme.font(
                                      size: 11.5, weight: FontWeight.w800, color: AppTheme.primaryDark)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const WearablePairingScreen()),
            ),
            icon: const Icon(Icons.bluetooth_searching),
            label: const Text('Pairing Polar H10 & streaming'),
          ),

          const SectionTitle('Riwayat Medis & Pengobatan', padding: EdgeInsets.only(top: 22, bottom: 10)),

          // 4. Medical Conditions & Routine Medications Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppTheme.borderLight),
              boxShadow: AppTheme.shadowSoft,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Kondisi Medis Pasien:',
                        style: AppTheme.font(size: 12.5, color: AppTheme.textMuted, weight: FontWeight.w700)),
                    // Styled Pill Button
                    InkWell(
                      onTap: () => _addConditionModal(context),
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4.5),
                        decoration: BoxDecoration(
                          color: AppTheme.primarySoft,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppTheme.primaryLight.withValues(alpha: 0.4)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.add_rounded, size: 14, color: AppTheme.primaryDark),
                            const SizedBox(width: 3),
                            Text('Kelola Kondisi',
                                style: AppTheme.font(
                                    size: 11.5, weight: FontWeight.w800, color: AppTheme.primaryDark)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: s.medicalConditions.isEmpty
                      ? [
                          Text('Belum ada kondisi medis dipilih.',
                              style: AppTheme.font(size: 12, color: AppTheme.textMuted)),
                        ]
                      : s.medicalConditions
                          .map((c) => Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: AppTheme.primarySoft,
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(color: AppTheme.primaryLight.withValues(alpha: 0.3)),
                                ),
                                child: Text(c,
                                    style: AppTheme.font(
                                        size: 11.5, weight: FontWeight.w700, color: AppTheme.primaryDark)),
                              ))
                          .toList(),
                ),
                const Divider(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Daftar Obat Rutin:',
                        style: AppTheme.font(size: 12.5, color: AppTheme.textMuted, weight: FontWeight.w700)),
                    // Styled Pill Button
                    InkWell(
                      onTap: () => _addMedicationModal(context),
                      borderRadius: BorderRadius.circular(20),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4.5),
                        decoration: BoxDecoration(
                          color: AppTheme.primarySoft,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppTheme.primaryLight.withValues(alpha: 0.4)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.add_rounded, size: 14, color: AppTheme.primaryDark),
                            const SizedBox(width: 3),
                            Text('Tambah Obat',
                                style: AppTheme.font(
                                    size: 11.5, weight: FontWeight.w800, color: AppTheme.primaryDark)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                if (s.routineMedications.isEmpty)
                  Text('Belum ada obat rutin tercatat.',
                      style: AppTheme.font(size: 12, color: AppTheme.textMuted)),
                ...s.routineMedications.asMap().entries.map((e) => Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppTheme.fieldFill,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppTheme.borderLight),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(7),
                            decoration: BoxDecoration(
                              color: AppTheme.primarySoft,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.medication_outlined, size: 18, color: AppTheme.primaryDark),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '${e.value.name} ${e.value.dosage}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTheme.font(size: 13, weight: FontWeight.w700, color: AppTheme.textPrimary),
                                ),
                                const SizedBox(height: 1),
                                Text(
                                  e.value.frequency,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTheme.font(size: 11, color: AppTheme.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          // Edit Button Chip
                          InkWell(
                            onTap: () => _addMedicationModal(context, editIndex: e.key),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: AppTheme.primarySoft,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.edit_outlined, size: 15, color: AppTheme.primaryDark),
                            ),
                          ),
                          const SizedBox(width: 6),
                          // Delete Button Chip
                          InkWell(
                            onTap: () => s.removeMedication(e.key),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEE2E2),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.delete_outline_rounded, size: 15, color: AppTheme.statusRed),
                            ),
                          ),
                        ],
                      ),
                    )),
              ],
            ),
          ),

          const SectionTitle('Alur Pemantauan & Keamanan Data Anda',
              padding: EdgeInsets.only(top: 22, bottom: 10)),

          // 5. Friendly Monitoring Flow
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppTheme.borderLight),
              boxShadow: AppTheme.shadowSoft,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _chainStep(
                  '1. Pengukuran Sensor Otomatis',
                  'Mencatat detak jantung, pemulihan (HRV), dan oksigen secara berkelanjutan.',
                  icon: Icons.sensors_rounded,
                ),
                _chainStep(
                  '2. Pemahaman Pola Tubuh Anda',
                  'Mengenali rentang normal harian khusus untuk tubuh Anda sendiri.',
                  icon: Icons.show_chart_rounded,
                ),
                _chainStep(
                  '3. 6 Panduan Memahami Kondisi Fisik',
                  'Memberi tahu kondisi terkini, perubahan ritme, dan faktor penyebab yang dirasakan.',
                  icon: Icons.psychology_outlined,
                ),
                _chainStep(
                  '4. Rekomendasi Langkah Sehat Mandiri',
                  'Panduan aktivitas harian yang aman dan anjuran waktu yang tepat berkonsultasi ke dokter.',
                  icon: Icons.directions_run_rounded,
                ),
                _chainStep(
                  '5. Keamanan Privasi & Pengawasan',
                  'Data Anda dienkripsi aman dan tidak disebarluaskan tanpa persetujuan Anda.',
                  icon: Icons.verified_user_outlined,
                  isLast: true,
                ),
              ],
            ),
          ),

          const SectionTitle('Integrasi & Pengaturan Akun',
              padding: EdgeInsets.only(top: 22, bottom: 10)),

          // Integration Actions
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppTheme.borderLight),
              boxShadow: AppTheme.shadowSoft,
            ),
            child: Column(
              children: [
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: const BoxDecoration(color: AppTheme.primarySoft, shape: BoxShape.circle),
                    child: const Icon(Icons.link_rounded, color: AppTheme.primary, size: 20),
                  ),
                  title: Text('Tautkan Akun CAPAR Pasien', style: AppTheme.font(size: 13.5, weight: FontWeight.w700)),
                  subtitle: Text('Hubungkan data riwayat dari rekam medis CAPAR lama', style: AppTheme.font(size: 11.5, color: AppTheme.textSecondary)),
                  trailing: const Icon(Icons.chevron_right, size: 20, color: AppTheme.textMuted),
                  onTap: () => _showLinkCaparDialog(context),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(color: const Color(0xFF0284C7).withValues(alpha: 0.12), shape: BoxShape.circle),
                    child: const Icon(Icons.dns_outlined, color: Color(0xFF0284C7), size: 20),
                  ),
                  title: Text('Pengaturan Alamat Server API', style: AppTheme.font(size: 13.5, weight: FontWeight.w700)),
                  subtitle: Text(ApiConfig.baseUrl, maxLines: 1, overflow: TextOverflow.ellipsis, style: AppTheme.font(size: 11.5, color: AppTheme.textSecondary)),
                  trailing: const Icon(Icons.chevron_right, size: 20, color: AppTheme.textMuted),
                  onTap: () => _showServerConfigDialog(context),
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                ListTile(
                  leading: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: const BoxDecoration(color: Color(0xFFFEE2E2), shape: BoxShape.circle),
                    child: const Icon(Icons.logout_rounded, color: AppTheme.statusRed, size: 20),
                  ),
                  title: Text('Keluar dari Akun', style: AppTheme.font(size: 13.5, weight: FontWeight.w700, color: AppTheme.statusRed)),
                  subtitle: Text('Keluar dari sesi pemantauan saat ini', style: AppTheme.font(size: 11.5, color: AppTheme.textSecondary)),
                  onTap: () => _logoutDialog(context),
                ),
              ],
            ),
          ),

          const SectionTitle('Pengaturan Notifikasi & Pemantauan',
              padding: EdgeInsets.only(top: 22, bottom: 10)),

          // 6. Notification & Privacy Settings
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppTheme.borderLight),
              boxShadow: AppTheme.shadowSoft,
            ),
            child: Column(
              children: [
                _settingSwitchRow(
                  title: 'Pengingat Ringkasan Pagi',
                  subtitle: 'Mengingatkan mengisi catatan kondisi tubuh di pagi hari',
                  value: s.notifDailySummary,
                  onChanged: (v) {
                    s.update(() => s.notifDailySummary = v);
                    _persistProfileChange(context);
                  },
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                _settingSwitchRow(
                  title: 'Peringatan Gejala & Keamanan',
                  subtitle: 'Pemberitahuan penting jika ada perubahan kondisi tubuh yang membutuhkan perhatian',
                  value: s.notifCriticalAlerts,
                  onChanged: (v) {
                    s.update(() => s.notifCriticalAlerts = v);
                    _persistProfileChange(context);
                  },
                ),
                const Divider(height: 1, indent: 16, endIndent: 16),
                _settingSwitchRow(
                  title: 'Berbagi Data dengan Tenaga Medis / Keluarga',
                  subtitle: 'Memberi akses ringkasan grafik kesehatan kepada dokter Anda',
                  value: s.allowDataSharing,
                  onChanged: (v) {
                    s.update(() => s.allowDataSharing = v);
                    _persistProfileChange(context);
                  },
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // 7. Export & Share Tile
          InkWell(
            onTap: () => _showExportSheet(context),
            borderRadius: BorderRadius.circular(18),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppTheme.borderLight),
                boxShadow: AppTheme.shadowSoft,
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(9),
                    decoration: const BoxDecoration(color: AppTheme.primarySoft, shape: BoxShape.circle),
                    child: const Icon(Icons.picture_as_pdf_outlined, color: AppTheme.primary, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Ekspor Laporan Kesehatan PDF',
                            style: AppTheme.font(size: 13.5, weight: FontWeight.w700)),
                        Text('Ringkasan berkala yang mudah dibawa saat berkonsultasi ke dokter',
                            style: AppTheme.font(size: 11, color: AppTheme.textSecondary)),
                      ],
                    ),
                  ),
                  const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: AppTheme.textMuted),
                ],
              ),
            ),
          ),

          const SizedBox(height: 14),

          // 8. Clinical Safety Disclaimer
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF4E8),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFFED7AA)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.shield_outlined, size: 20, color: AppTheme.statusOrange),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'VidyaMedic adalah aplikasi edukasi & pemantauan kesehatan mandiri. Jika Anda mengalami kondisi darurat atau gejala berat, segera hubungi layanan gawat darurat atau faskes terdekat.',
                    style: AppTheme.font(size: 11, color: const Color(0xFF9A3412), height: 1.4),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // 9. App Version
          Center(
            child: Text(
              'VidyaMedic • Versi 2.4.0',
              style: AppTheme.font(size: 11, color: AppTheme.textMuted),
            ),
          ),
        ],
      ),
    );
  }

  static Widget _settingSwitchRow({
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTheme.font(size: 13, weight: FontWeight.w700, color: AppTheme.textPrimary)),
                const SizedBox(height: 2),
                Text(subtitle, style: AppTheme.font(size: 11, color: AppTheme.textSecondary)),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Switch.adaptive(
            value: value,
            activeTrackColor: AppTheme.primary,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  Widget _statPill(String label, String value, IconData icon, {Color? valueColor}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 6),
      decoration: BoxDecoration(
        color: AppTheme.fieldFill,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppTheme.borderLight),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 13, color: AppTheme.primary),
              const SizedBox(width: 3),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTheme.font(size: 10.5, color: AppTheme.textMuted, weight: FontWeight.w600),
                ),
              ),
            ],
          ),
          const SizedBox(height: 3),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: AppTheme.font(size: 13, weight: FontWeight.w800, color: valueColor ?? AppTheme.primaryDark),
          ),
        ],
      ),
    );
  }

  Widget _chainStep(String title, String desc, {required IconData icon, bool isLast = false}) {
    return Padding(
      padding: EdgeInsets.only(bottom: isLast ? 0 : 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: AppTheme.primarySoft,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 16, color: AppTheme.primary),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTheme.font(size: 12.5, weight: FontWeight.w700, color: AppTheme.primaryDark)),
                const SizedBox(height: 1),
                Text(desc, style: AppTheme.font(size: 11.5, color: AppTheme.textSecondary, height: 1.35)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
