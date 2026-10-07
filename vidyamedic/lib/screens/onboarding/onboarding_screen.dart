import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';
import '../home/home_screen.dart';

/// Halaman Pendaftaran & Onboarding 4 Langkah
/// 1/4 Profil Saya & Akun -> 2/4 Riwayat Kesehatan -> 3/4 Hubungkan Wearable -> 4/4 Preferensi
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  static const _titles = [
    'Profil & Akun',
    'Riwayat Kesehatan',
    'Hubungkan Wearable',
    'Preferensi Saya'
  ];
  int _step = 1;
  bool _isBusy = false;
  String? _stepError;

  late final TextEditingController _name;
  late final TextEditingController _email;
  late final TextEditingController _password;
  late final TextEditingController _phone;
  late final TextEditingController _height;
  late final TextEditingController _weight;
  late final TextEditingController _otherCondition;
  late final TextEditingController _allergy;
  DateTime? _birth;
  Gender? _gender;
  late String _timeZone;
  String _device = '';

  @override
  void initState() {
    super.initState();
    final s = context.read<AppState>();
    _name = TextEditingController(text: s.userProfile.name);
    _email = TextEditingController();
    _password = TextEditingController();
    _phone = TextEditingController();
    _height = TextEditingController(
        text: s.userProfile.heightCm?.toStringAsFixed(0) ?? '');
    _weight = TextEditingController(
        text: s.userProfile.weightKg?.toStringAsFixed(0) ?? '');
    _otherCondition = TextEditingController(text: s.otherCondition);
    _allergy = TextEditingController(text: s.allergies);
    _birth = s.userProfile.birthDate;
    _gender = s.userProfile.gender;
    _timeZone = s.userProfile.timeZone.isEmpty
        ? 'Asia/Jakarta'
        : s.userProfile.timeZone;
  }

  @override
  void dispose() {
    for (final c in [
      _name,
      _email,
      _password,
      _phone,
      _height,
      _weight,
      _otherCondition,
      _allergy
    ]) {
      c.dispose();
    }
    super.dispose();
  }

  void _back() => _step > 1
      ? setState(() {
          _step--;
          _stepError = null;
        })
      : Navigator.pop(context);

  Future<void> _next() async {
    final s = context.read<AppState>();
    setState(() => _stepError = null);

    switch (_step) {
      case 1:
        final name = _name.text.trim();
        final email = _email.text.trim();
        final pass = _password.text;
        final phone = _phone.text.trim();

        if (name.isEmpty || email.isEmpty || pass.isEmpty || phone.length < 6) {
          setState(() => _stepError =
              'Nama, email, kata sandi, dan nomor telepon wajib diisi.');
          return;
        }

        s.update(() {
          s.userProfile = UserProfile(
            name: name,
            birthDate: _birth,
            gender: _gender,
            heightCm: double.tryParse(_height.text) ?? s.userProfile.heightCm,
            weightKg: double.tryParse(_weight.text) ?? s.userProfile.weightKg,
            timeZone: _timeZone,
          );
        });

        // If not yet authenticated, try to register
        if (!s.isAuthenticated && email.isNotEmpty && pass.isNotEmpty) {
          setState(() => _isBusy = true);
          final ok = await s.register(
            name: name,
            email: email,
            password: pass,
            phoneNumber: phone,
          );
          setState(() => _isBusy = false);
          if (!ok) {
            if (s.authErrorStatusCode == 409) {
              setState(() => _stepError =
                  'Email sudah terdaftar. Silakan masuk menggunakan akun tersebut.');
              return;
            }
            setState(
                () => _stepError = s.authError ?? 'Gagal mendaftarkan akun.');
            return;
          }
        }
        s.update(() {
          s.userProfile = UserProfile(
            name: name,
            birthDate: _birth,
            gender: _gender,
            heightCm: double.tryParse(_height.text),
            weightKg: double.tryParse(_weight.text),
            timeZone: _timeZone,
          );
        });
        if (!await s.saveProfileToServer()) {
          setState(() =>
              _stepError = s.dataError ?? 'Profil gagal disimpan ke server.');
          return;
        }

      case 2:
        s.update(() {
          s.otherCondition = _otherCondition.text.trim();
          s.allergies = _allergy.text.trim();
        });
        if (!await s.saveProfileToServer()) {
          setState(() =>
              _stepError = s.dataError ?? 'Profil gagal disimpan ke server.');
          return;
        }

      case 3:
        if (_device.isNotEmpty && !await s.connectWearable(_device)) {
          setState(() => _stepError =
              s.dataError ?? 'Preferensi wearable gagal disimpan ke server.');
          return;
        }

      case 4:
        if (!await s.saveProfileToServer()) {
          setState(() => _stepError =
              s.dataError ?? 'Preferensi gagal disimpan ke server.');
          return;
        }
        _finish();
        return;
    }
    setState(() => _step++);
  }

  void _finish() {
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const HomeScreen()),
      (_) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _step == 1,
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
                      onPressed: _back),
                  title: Text(_titles[_step - 1],
                      style: AppTheme.font(size: 16, weight: FontWeight.w700)),
                ),
                body: SafeArea(
                  top: false,
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                        child: StepProgress(step: _step, total: 4),
                      ),
                      if (_stepError != null)
                        Container(
                          margin: const EdgeInsets.symmetric(
                              horizontal: 20, vertical: 6),
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFDECEC),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                                color:
                                    AppTheme.statusRed.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.error_outline,
                                  size: 18, color: AppTheme.statusRed),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(_stepError!,
                                    style: AppTheme.font(
                                        size: 12,
                                        color: AppTheme.statusRed,
                                        weight: FontWeight.w500)),
                              ),
                            ],
                          ),
                        ),
                      Expanded(
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 280),
                          transitionBuilder: (child, a) => FadeTransition(
                            opacity: a,
                            child: SlideTransition(
                              position: Tween(
                                      begin: const Offset(0.06, 0),
                                      end: Offset.zero)
                                  .animate(a),
                              child: child,
                            ),
                          ),
                          child: SingleChildScrollView(
                            key: ValueKey(_step),
                            padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                            child: switch (_step) {
                              1 => _profile(),
                              2 => _health(),
                              3 => _wearable(),
                              _ => _preferences(),
                            },
                          ),
                        ),
                      ),
                      Padding(
                          padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
                          child: _actions()),
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

  Widget _actions() {
    if (_isBusy) {
      return const Center(
          child: Padding(
              padding: EdgeInsets.all(12), child: CircularProgressIndicator()));
    }

    switch (_step) {
      case 2:
        return Row(children: [
          Expanded(
              child: OutlinedButton(
                  onPressed: _back, child: const Text('Kembali'))),
          const SizedBox(width: 12),
          Expanded(
              child: ElevatedButton(
                  onPressed: _next, child: const Text('Lanjut'))),
        ]);
      case 3:
        return ElevatedButton(
            onPressed: _next, child: const Text('Hubungkan & Lanjut'));
      case 4:
        return Column(mainAxisSize: MainAxisSize.min, children: [
          ElevatedButton(onPressed: _next, child: const Text('Selesai')),
          TextButton(
            onPressed: _finish,
            child: Text('Lewati dulu',
                style: AppTheme.font(
                    size: 13,
                    weight: FontWeight.w600,
                    color: AppTheme.primary)),
          ),
        ]);
      default:
        return ElevatedButton(onPressed: _next, child: const Text('Lanjut'));
    }
  }

  // ---------------- 1/4 Profil Saya ----------------
  Widget _profile() {
    final s = context.watch<AppState>();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
            'Data dasar Anda membantu kami memahami kondisi tubuh dengan lebih baik.',
            style: AppTheme.font(
                size: 13, color: AppTheme.textSecondary, height: 1.4)),
        const SizedBox(height: 12),
        const FieldLabel('Nama Lengkap'),
        TextField(
          controller: _name,
          style: AppTheme.font(size: 14, weight: FontWeight.w500),
          decoration: const InputDecoration(
            hintText: 'Nama lengkap',
            prefixIcon: Icon(Icons.person_outline_rounded, size: 20),
          ),
        ),
        if (!s.isAuthenticated) ...[
          const FieldLabel('Email Pasien'),
          TextField(
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            style: AppTheme.font(size: 14),
            decoration: const InputDecoration(
              hintText: 'nama@example.com',
              prefixIcon: Icon(Icons.email_outlined, size: 20),
            ),
          ),
          const FieldLabel('Kata Sandi Akun'),
          TextField(
            controller: _password,
            obscureText: true,
            style: AppTheme.font(size: 14),
            decoration: const InputDecoration(
              hintText: 'Minimal 10 karakter',
              prefixIcon: Icon(Icons.lock_outline, size: 20),
            ),
          ),
          const FieldLabel('Nomor WhatsApp / HP'),
          TextField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            style: AppTheme.font(size: 14),
            decoration: const InputDecoration(
              hintText: '+628123456789',
              prefixIcon: Icon(Icons.phone_outlined, size: 20),
            ),
          ),
        ],
        const FieldLabel('Tanggal Lahir'),
        _PickerField(
          text: _birth == null
              ? 'Pilih tanggal lahir'
              : DateFormat('d MMM yyyy', 'id_ID').format(_birth!),
          icon: Icons.calendar_month_outlined,
          onTap: () async {
            final d = await showDatePicker(
              context: context,
              initialDate: _birth ??
                  DateTime.now().subtract(const Duration(days: 365 * 30)),
              firstDate: DateTime(1920),
              lastDate: DateTime.now(),
            );
            if (d != null) setState(() => _birth = d);
          },
        ),
        const FieldLabel('Jenis Kelamin'),
        Row(children: [
          Expanded(child: _segment('Perempuan', Gender.female)),
          const SizedBox(width: 10),
          Expanded(child: _segment('Laki-laki', Gender.male)),
        ]),
        const FieldLabel('Tinggi Badan'),
        TextField(
          controller: _height,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(suffixText: 'cm'),
        ),
        const FieldLabel('Berat Badan'),
        TextField(
          controller: _weight,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(suffixText: 'kg'),
        ),
        const FieldLabel('Zona Waktu'),
        DropdownButtonFormField<String>(
          initialValue: _timeZone,
          icon: const Icon(Icons.expand_more_rounded),
          style: AppTheme.font(size: 14),
          items: const ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura']
              .map((z) => DropdownMenuItem(value: z, child: Text(z)))
              .toList(),
          onChanged: (v) => setState(() => _timeZone = v ?? _timeZone),
        ),
      ],
    );
  }

  Widget _segment(String label, Gender g) {
    final sel = _gender == g;
    return GestureDetector(
      onTap: () => setState(() => _gender = g),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        height: 46,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: sel ? AppTheme.primary : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: sel ? AppTheme.primary : AppTheme.border),
        ),
        child: Text(label,
            style: AppTheme.font(
                size: 14,
                weight: FontWeight.w600,
                color: sel ? Colors.white : AppTheme.textPrimary)),
      ),
    );
  }

  // ---------------- 2/4 Riwayat Kesehatan ----------------
  Widget _health() {
    final s = context.watch<AppState>();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Apakah Anda memiliki kondisi kesehatan berikut?',
            style: AppTheme.font(
                size: 13.5, color: AppTheme.textSecondary, height: 1.4)),
        const SizedBox(height: 6),
        ...s.conditionOptions.map((c) => InkWell(
              onTap: () => s.toggleCondition(c),
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(children: [
                  Checkbox(
                    value: s.medicalConditions.contains(c),
                    onChanged: (_) => s.toggleCondition(c),
                    visualDensity: VisualDensity.compact,
                  ),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      c,
                      style: AppTheme.font(size: 13.5, height: 1.25),
                    ),
                  ),
                ]),
              ),
            )),
        const SizedBox(height: 6),
        TextField(
          controller: _otherCondition,
          decoration: const InputDecoration(hintText: 'Tulis kondisi lain...'),
        ),
        const SizedBox(height: 10),
        TextField(
          controller: _allergy,
          decoration: const InputDecoration(
              hintText: 'Alergi (opsional, cth: Penicillin)'),
        ),
        const SizedBox(height: 18),
        Row(children: [
          Expanded(
              child: Text('Obat Rutin',
                  style: AppTheme.font(size: 14, weight: FontWeight.w700))),
          InkWell(
            onTap: () => _addMedication(context),
            borderRadius: BorderRadius.circular(20),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                  color: AppTheme.primarySoft,
                  borderRadius: BorderRadius.circular(20)),
              child: Text('+ Tambah Obat',
                  style: AppTheme.font(
                      size: 12,
                      weight: FontWeight.w600,
                      color: AppTheme.primary)),
            ),
          ),
        ]),
        const SizedBox(height: 10),
        if (s.routineMedications.isEmpty)
          Text('Belum ada obat rutin.',
              style: AppTheme.font(size: 12.5, color: AppTheme.textMuted)),
        ...s.routineMedications.asMap().entries.map((e) => Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.borderLight),
                boxShadow: AppTheme.shadowSoft,
              ),
              child: Row(children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                      color: const Color(0xFFFDECEC),
                      borderRadius: BorderRadius.circular(10)),
                  child: const Icon(Icons.medication,
                      size: 18, color: AppTheme.faceRed),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${e.value.name} ${e.value.dosage}',
                            style: AppTheme.font(
                                size: 13, weight: FontWeight.w600)),
                        Text(e.value.frequency,
                            style: AppTheme.font(
                                size: 11.5, color: AppTheme.textSecondary)),
                      ]),
                ),
                IconButton(
                  icon: const Icon(Icons.edit_outlined,
                      size: 18, color: AppTheme.textSecondary),
                  onPressed: () => _addMedication(context, editIndex: e.key),
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline,
                      size: 18, color: AppTheme.textSecondary),
                  onPressed: () => s.removeMedication(e.key),
                ),
              ]),
            )),
      ],
    );
  }

  void _addMedication(BuildContext context, {int? editIndex}) {
    final s = context.read<AppState>();
    final isEdit = editIndex != null;
    final med = isEdit ? s.routineMedications[editIndex] : null;

    final nameCtrl = TextEditingController(text: med?.name ?? '');
    final doseCtrl = TextEditingController(text: med?.dosage ?? '');
    final freqCtrl = TextEditingController(text: med?.frequency ?? '1x sehari');

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isEdit ? 'Edit Obat Rutin' : 'Tambah Obat Rutin',
            style: AppTheme.font(size: 16, weight: FontWeight.w700)),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(
              controller: nameCtrl,
              decoration: const InputDecoration(
                  hintText: 'Nama obat (cth: Bisoprolol)')),
          const SizedBox(height: 10),
          TextField(
              controller: doseCtrl,
              decoration: const InputDecoration(hintText: 'Dosis (cth: 5 mg)')),
          const SizedBox(height: 10),
          TextField(
              controller: freqCtrl,
              decoration: const InputDecoration(
                  hintText: 'Frekuensi (cth: 1x sehari)')),
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
          ElevatedButton(
            onPressed: () {
              if (nameCtrl.text.trim().isEmpty) return;
              final newMed = Medication(
                name: nameCtrl.text.trim(),
                dosage: doseCtrl.text.trim(),
                frequency: freqCtrl.text.trim(),
              );
              s.update(() {
                if (isEdit) {
                  s.routineMedications[editIndex] = newMed;
                } else {
                  s.addMedication(newMed);
                }
              });
              Navigator.pop(ctx);
            },
            child: const Text('Simpan'),
          ),
        ],
      ),
    );
  }

  // ---------------- 3/4 Hubungkan Wearable ----------------
  Widget _wearable() {
    final devices = [
      ('Apple Watch', 'apple_watch', Icons.watch, 'Preferensi jenis perangkat'),
      (
        'Polar H10',
        'polar_h10',
        Icons.monitor_heart_outlined,
        'Preferensi jenis perangkat'
      ),
      (
        'Garmin Watch',
        'garmin',
        Icons.watch_outlined,
        'Preferensi jenis perangkat'
      ),
      (
        'Fitbit',
        'fitbit',
        Icons.fitness_center_outlined,
        'Preferensi jenis perangkat'
      ),
      (
        'Lainnya / Manual',
        'other',
        Icons.devices_other,
        'Preferensi jenis perangkat'
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
            'Simpan jenis perangkat yang Anda gunakan. Pemilihan perangkat tidak menghubungkan sensor; data hanya tampil setelah dikirim perangkat nyata ke backend.',
            style: AppTheme.font(
                size: 13.5, color: AppTheme.textSecondary, height: 1.4)),
        const SizedBox(height: 14),
        ...devices.map((d) {
          final sel = _device == d.$1;
          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => setState(() => _device = d.$1),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: sel ? AppTheme.primarySoft : Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                      color: sel ? AppTheme.primary : AppTheme.borderLight,
                      width: sel ? 1.5 : 1),
                  boxShadow: AppTheme.shadowSoft,
                ),
                child: Row(children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: sel ? AppTheme.primary : AppTheme.fieldFill,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(d.$3,
                        color: sel ? Colors.white : AppTheme.primary, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(d.$1,
                              style: AppTheme.font(
                                  size: 14, weight: FontWeight.w700)),
                          const SizedBox(height: 2),
                          Text(d.$4,
                              style: AppTheme.font(
                                  size: 12, color: AppTheme.textSecondary)),
                        ]),
                  ),
                  Icon(
                    sel ? Icons.radio_button_checked : Icons.radio_button_off,
                    color: sel ? AppTheme.primary : AppTheme.textMuted,
                    size: 22,
                  ),
                ]),
              ),
            ),
          );
        }),
      ],
    );
  }

  // ---------------- 4/4 Preferensi Saya ----------------
  Widget _preferences() {
    final s = context.watch<AppState>();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Atur target kesehatan dan preferensi notifikasi Anda.',
            style: AppTheme.font(
                size: 13.5, color: AppTheme.textSecondary, height: 1.4)),
        const FieldLabel('Target Utama'),
        DropdownButtonFormField<String>(
          initialValue: s.primaryGoal,
          icon: const Icon(Icons.expand_more_rounded),
          style: AppTheme.font(size: 14),
          items: s.goalOptions
              .map((g) => DropdownMenuItem(value: g, child: Text(g)))
              .toList(),
          onChanged: (v) => s.update(() => s.primaryGoal = v ?? s.primaryGoal),
        ),
        const SizedBox(height: 18),
        Text('Preferensi Notifikasi',
            style: AppTheme.font(size: 14, weight: FontWeight.w700)),
        const SizedBox(height: 6),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('Ringkasan Pagi Hari',
              style: AppTheme.font(size: 13.5, weight: FontWeight.w500)),
          subtitle: Text('Rangkuman tidur dan kesiapan harian',
              style: AppTheme.font(size: 11.5, color: AppTheme.textSecondary)),
          value: s.notifDailySummary,
          onChanged: (v) => s.update(() => s.notifDailySummary = v),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('Notifikasi Peringatan Penting',
              style: AppTheme.font(size: 13.5, weight: FontWeight.w500)),
          subtitle: Text('Pengingat saat deviasi membutuhkan perhatian',
              style: AppTheme.font(size: 11.5, color: AppTheme.textSecondary)),
          value: s.notifCriticalAlerts,
          onChanged: (v) => s.update(() => s.notifCriticalAlerts = v),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('Edukasi & Pedoman Fisiologis',
              style: AppTheme.font(size: 13.5, weight: FontWeight.w500)),
          subtitle: Text('Artikel ilmiah dan wawasan fisiologis singkat',
              style: AppTheme.font(size: 11.5, color: AppTheme.textSecondary)),
          value: s.notifHealthEducation,
          onChanged: (v) => s.update(() => s.notifHealthEducation = v),
        ),
        const Divider(height: 24),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text('Berbagi Data dengan Dokter & Keluarga',
              style: AppTheme.font(size: 13.5, weight: FontWeight.w600)),
          subtitle: Text('Izinkan dokter klinisi melihat tren CAPAR Anda',
              style: AppTheme.font(size: 11.5, color: AppTheme.textSecondary)),
          value: s.allowDataSharing,
          onChanged: (v) => s.update(() {
            s.allowDataSharing = v;
            s.userProfile.clinicianSharing = v;
          }),
        ),
      ],
    );
  }
}

class _PickerField extends StatelessWidget {
  final String text;
  final IconData icon;
  final VoidCallback onTap;
  const _PickerField(
      {required this.text, required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 48,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: AppTheme.fieldFill,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.borderLight),
        ),
        child: Row(children: [
          Icon(icon, size: 20, color: AppTheme.textSecondary),
          const SizedBox(width: 10),
          Expanded(
              child: Text(text,
                  style: AppTheme.font(size: 14, weight: FontWeight.w500))),
          const Icon(Icons.expand_more_rounded,
              size: 20, color: AppTheme.textSecondary),
        ]),
      ),
    );
  }
}
