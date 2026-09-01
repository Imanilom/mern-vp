import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../services/api_service.dart';
import '../../services/ble_service.dart';
import '../../services/telemetry_controller.dart';
import '../../theme/app_colors.dart';
import 'autonomic_profile_screen.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool evidenceQualityPrompts = true;
  bool emaPrompts = true;
  bool badgeNotifications = true;
  bool predictionNotifications = false;

  String _userId = '–';
  String _userEmail = '–';

  @override
  void initState() {
    super.initState();
    _loadUserInfo();
  }

  Future<void> _loadUserInfo() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) {
      setState(() {
        _userId = prefs.getString('user_id') ?? '–';
        _userEmail = prefs.getString('user_email') ?? '–';
      });
    }
  }

  void _syncPreferences() {
    ApiService.updateUserPreferences({
      'evidenceQualityPrompts': evidenceQualityPrompts,
      'emaPrompts': emaPrompts,
      'badgeNotifications': badgeNotifications,
      'predictionNotifications': predictionNotifications,
    });
  }

  @override
  Widget build(BuildContext context) {
    final ble = ref.watch(bleServiceProvider);
    final telemetry = ref.watch(telemetryControllerProvider);

    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Header ───────────────────────────────────────────────────────
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Profile & Device',
                        style: TextStyle(
                          fontFamily: 'Plus Jakarta Sans',
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppColors.navy,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Consent, connection, and privacy controls',
                        style: TextStyle(fontSize: 12, color: AppColors.gray),
                      ),
                    ],
                  ),
                  // Tombol ke halaman Device Pairing
                  IconButton(
                    tooltip: 'Pairing Perangkat',
                    icon: const Icon(Icons.bluetooth_searching_rounded, color: AppColors.teal, size: 28),
                    onPressed: () => Navigator.pushNamed(context, '/pairing'),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // ── Peta Data Log & XAI Phenotype Card ───────────────────────────
              InkWell(
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const AutonomicProfileScreen()),
                  );
                },
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF0F2027), Color(0xFF203A43), Color(0xFF2C5364)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.1),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.teal.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.teal.withValues(alpha: 0.5)),
                        ),
                        child: const Icon(Icons.fingerprint_rounded, color: Color(0xFF4EECD6), size: 24),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Peta Data Log & XAI (Q1–Q10)',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13.5),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Autonomic Regulation Phenotype Framework',
                              style: TextStyle(color: Color(0xFFCBD5E1), fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white70, size: 14),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // ── Akun Peserta ─────────────────────────────────────────────────
              _buildSection(
                title: 'Akun Peserta',
                children: [
                  _buildRow('ID Peserta (Pseudonym)', _userId),
                  _buildRow('Email', _userEmail),
                  _buildRow('Protokol IRB', 'CAPAR-ETH-2024-v2.1'),
                  _buildRow('Consent', 'Aktif (v2.1)'),
                ],
              ),
              const SizedBox(height: 14),

              // ── Polar H10 Device ─────────────────────────────────────────────
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: ble.isConnected ? AppColors.teal : AppColors.line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Polar H10',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: AppColors.navy),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: ble.isConnected ? AppColors.greenSoft : AppColors.graySoft,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            ble.isConnected ? 'CONNECTED' : 'DISCONNECTED',
                            style: TextStyle(
                              fontSize: 9.5,
                              fontWeight: FontWeight.w800,
                              color: ble.isConnected ? AppColors.green : AppColors.gray,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _buildRow('Device Name', ble.isConnected ? ble.deviceName : '–'),
                    _buildRow('Battery', ble.isConnected ? '${ble.batteryLevel}%' : '–'),
                    _buildRow('Signal Quality', ble.isConnected ? '${ble.signalQuality}%' : '–'),
                    _buildRow('Konteks Aktivitas', ble.motionState),
                    _buildRow('Streaming', telemetry.isStreaming ? 'Aktif (${telemetry.pendingCount} pending)' : 'Tidak Aktif'),
                    const SizedBox(height: 10),
                    // Tombol pairing jika belum terhubung
                    if (!ble.isConnected)
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton.icon(
                          onPressed: () => Navigator.pushNamed(context, '/pairing'),
                          icon: const Icon(Icons.bluetooth_rounded, size: 16),
                          label: const Text('Hubungkan Perangkat'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.teal,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      )
                    else
                      SizedBox(
                        width: double.infinity,
                        child: OutlinedButton.icon(
                          onPressed: () => Navigator.pushNamed(context, '/pairing'),
                          icon: const Icon(Icons.settings_rounded, size: 14),
                          label: const Text('Ganti Perangkat / Aktivitas'),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: AppColors.teal),
                            foregroundColor: AppColors.teal,
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // ── Research Participation ────────────────────────────────────────
              _buildSection(
                title: 'Research Participation',
                children: [
                  _buildRow('EMA Reminders', 'Aktif'),
                  _buildRow('Quiet Hours', '22:00 – 06:00'),
                  _buildRow('Offline Storage', 'Encrypted'),
                ],
              ),
              const SizedBox(height: 14),

              // ── Notifications ─────────────────────────────────────────────────
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Notifications',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy),
                    ),
                    const SizedBox(height: 12),
                    _buildSwitch('Evidence quality prompts', evidenceQualityPrompts, (val) {
                      setState(() => evidenceQualityPrompts = val);
                      _syncPreferences();
                    }),
                    _buildSwitch('EMA prompts', emaPrompts, (val) {
                      setState(() => emaPrompts = val);
                      _syncPreferences();
                    }),
                    _buildSwitch('Badge notifications', badgeNotifications, (val) {
                      setState(() => badgeNotifications = val);
                      _syncPreferences();
                    }),
                    _buildSwitch('Prediction notifications', predictionNotifications, (val) {
                      setState(() => predictionNotifications = val);
                      _syncPreferences();
                    }),
                  ],
                ),
              ),
              const SizedBox(height: 14),

              // ── Privacy & Data ────────────────────────────────────────────────
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Privacy & Data',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => _showPrivacyCertificateModal(context),
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(color: AppColors.teal),
                              backgroundColor: AppColors.tealSoft,
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            child: const Text(
                              'View Consent Certificate',
                              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: AppColors.teal),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('✓ Data export requested (JSON/CSV bundle)')),
                              );
                            },
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(color: AppColors.line),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            child: const Text(
                              'Export my data',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.navy),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: () => _showRevokeConsentDialog(context),
                        style: OutlinedButton.styleFrom(
                          backgroundColor: AppColors.redSoft,
                          side: BorderSide.none,
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: const Text(
                          'Withdraw participation',
                          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.red),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Sensitive EMA content is stored in the research data store only. Gamification receives completion status only.',
                      style: TextStyle(fontSize: 10, color: AppColors.gray, fontStyle: FontStyle.italic),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  Widget _buildSection({required String title, required List<Widget> children}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy)),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.gray)),
          Flexible(
            child: Text(
              value,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.ink),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSwitch(String label, bool value, ValueChanged<bool> onChanged) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.ink)),
          Switch(
            value: value,
            activeThumbColor: AppColors.teal,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  void _showPrivacyCertificateModal(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.shield_outlined, color: AppColors.teal, size: 22),
            SizedBox(width: 8),
            Text(
              'Sertifikat Privasi Data',
              style: TextStyle(fontFamily: 'Plus Jakarta Sans', fontSize: 16, fontWeight: FontWeight.w800, color: AppColors.navy),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('PROTOKOL PRIVASI & INFORMED CONSENT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.gray, letterSpacing: 0.5)),
            const SizedBox(height: 8),
            Text('• ID Peserta: $_userId (Pseudonim Terenkripsi)', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.navy)),
            const SizedBox(height: 4),
            const Text('• Protokol IRB: CAPAR-ETH-2024-v2.1', style: TextStyle(fontSize: 11.5, color: AppColors.gray)),
            const SizedBox(height: 4),
            const Text('• Telemetri: Sinyal RR & HR (Polar H10)', style: TextStyle(fontSize: 11.5, color: AppColors.gray)),
            const SizedBox(height: 4),
            const Text(
              '• Jaminan Keamanan: Data audio mentah & lokasi GPS presisi TIDAK PERNAH DIREKAM.',
              style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.teal),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Tutup', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.teal)),
          ),
        ],
      ),
    );
  }

  void _showRevokeConsentDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Withdraw Participation?'),
        content: const Text(
          'Withdrawal will stop data collection and mark your study session as inactive. Your raw identifiers will remain protected under research protocol governance.',
          style: TextStyle(fontSize: 12, color: AppColors.gray),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false);
            },
            child: const Text('Yes, Withdraw', style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}
