import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';

import '../../theme/app_colors.dart';
import '../../services/api_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool evidenceQualityPrompts = true;
  bool emaPrompts = true;
  bool badgeNotifications = true;
  bool predictionNotifications = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Profile & Device',
                style: TextStyle(
                  fontFamily: 'Plus Jakarta Sans',
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 2),
              const Text(
                'Consent, connection, and privacy controls',
                style: TextStyle(fontSize: 12, color: AppColors.gray),
              ),
              const SizedBox(height: 20),

              // Polar H10 Telemetry Card
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
                            color: AppColors.greenSoft,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: const Text(
                            'CONNECTED',
                            style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: AppColors.green),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _buildTelemetryRow('Device ID', 'H10-***42'),
                    _buildTelemetryRow('Battery', '76%'),
                    _buildTelemetryRow('Last RR packet', '2 s ago'),
                    _buildTelemetryRow('Clock drift', '0.4 s'),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Research Participation Card
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
                      'Research participation',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.navy),
                    ),
                    const SizedBox(height: 12),
                    _buildTelemetryRow('Consent', 'Active (v2.1)'),
                    _buildTelemetryRow('EMA reminders', 'On'),
                    _buildTelemetryRow('Quiet hours', '22:00 - 06:00'),
                    _buildTelemetryRow('Offline storage', 'Encrypted'),
                    _buildTelemetryRow('Pseudonym', 'P-014'),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Notifications Switches Card
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
                    _buildSwitchRow(
                      'Evidence quality prompts',
                      evidenceQualityPrompts,
                      (val) => setState(() => evidenceQualityPrompts = val),
                    ),
                    _buildSwitchRow(
                      'EMA prompts',
                      emaPrompts,
                      (val) => setState(() => emaPrompts = val),
                    ),
                    _buildSwitchRow(
                      'Badge notifications',
                      badgeNotifications,
                      (val) => setState(() => badgeNotifications = val),
                    ),
                    _buildSwitchRow(
                      'Prediction notifications',
                      predictionNotifications,
                      (val) => setState(() => predictionNotifications = val),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Privacy & Data Card
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
                      'Privacy & data',
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
                            child: const Text('View Consent Certificate', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: AppColors.teal)),
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
                            child: const Text('Export my data', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.navy)),
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
                        child: const Text('Withdraw participation', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.red)),
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
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTelemetryRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 11.5, color: AppColors.gray)),
          Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.ink)),
        ],
      ),
    );
  }

  Widget _buildSwitchRow(String label, bool value, ValueChanged<bool> onChanged) {
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
        title: Row(
          children: const [
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
          children: const [
            Text('PROTOKOL PRIVASI & INFORMED CONSENT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.gray, letterSpacing: 0.5)),
            SizedBox(height: 8),
            Text('• ID Peserta: P-014 (Pseudonim Terenkripsi)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.navy)),
            SizedBox(height: 4),
            Text('• Protokol IRB: CAPAR-ETH-2024-v2.1', style: TextStyle(fontSize: 11.5, color: AppColors.gray)),
            SizedBox(height: 4),
            Text('• Telemetri: Sinyal RR & HR (Polar H10)', style: TextStyle(fontSize: 11.5, color: AppColors.gray)),
            SizedBox(height: 4),
            Text('• Jaminan Keamanan: Data audio mentah & lokasi GPS presisi TIDAK PERNAH DIREKAM.', style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: AppColors.teal)),
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
            onPressed: () async {
              Navigator.pop(ctx);
              await ApiService.logout();
              final service = FlutterBackgroundService();
              if (await service.isRunning()) {
                service.invoke('stopService');
              }
              if (context.mounted) {
                Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false);
              }
            },
            child: const Text('Yes, Withdraw', style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}
