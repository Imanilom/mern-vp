import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool notificationsEnabled = true;

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
                'Profil & Privasi',
                style: TextStyle(
                  fontFamily: 'Plus Jakarta Sans',
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 2),
              const Text(
                'Identitas partisipan & pengaturan data',
                style: TextStyle(fontSize: 12, color: AppColors.gray),
              ),
              const SizedBox(height: 20),

              // Participant Header Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.line),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: const BoxDecoration(
                        color: AppColors.navy,
                        shape: BoxShape.circle,
                      ),
                      child: const Center(
                        child: Text(
                          'P07',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15),
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Partisipan P-2026-014',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.navy),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Consent v2.1 · Aktif dalam Cohort Pilot-01',
                          style: TextStyle(fontSize: 11, color: AppColors.gray),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Settings List
              _buildSettingCard(
                icon: Icons.bluetooth,
                title: 'Perangkat Sensor',
                value: 'Polar H10 (#A21F)',
                onTap: () => Navigator.pushNamed(context, '/pairing'),
              ),
              const SizedBox(height: 10),

              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.line),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.notifications, size: 16, color: AppColors.gray),
                    const SizedBox(width: 12),
                    const Text('Notifikasi EMA & State', style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.ink)),
                    const Spacer(),
                    Switch(
                      value: notificationsEnabled,
                      activeThumbColor: AppColors.teal,
                      onChanged: (val) => setState(() => notificationsEnabled = val),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),

              _buildSettingCard(
                icon: Icons.sync,
                title: 'Sinkronisasi Data',
                value: 'Up to date (12:21 WIB)',
                valueColor: AppColors.green,
                onTap: () {},
              ),

              const SizedBox(height: 30),

              // Actions
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('✓ Perubahan profil berhasil disimpan.')),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.teal,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Simpan Perubahan', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
              const SizedBox(height: 10),

              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () {
                    _showRevokeConsentDialog(context);
                  },
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.red,
                    side: const BorderSide(color: AppColors.red),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Cabut Consent', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSettingCard({
    required IconData icon,
    required String title,
    required String value,
    Color valueColor = AppColors.gray,
    required VoidCallback onTap,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.line),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppColors.gray),
          const SizedBox(width: 12),
          Text(title, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: AppColors.ink)),
          const Spacer(),
          Text(value, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: valueColor)),
        ],
      ),
    );
  }

  void _showRevokeConsentDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cabut Consent & Keluar Studi?'),
        content: const Text(
          'Pencabutan persetujuan akan menghentikan pengunggahan data sinyal dan menandai sesi Anda sebagai non-aktif. Data yang sudah terkumpul akan ditangani sesuai protokol privasi.',
          style: TextStyle(fontSize: 12, color: AppColors.gray),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Batal'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false);
            },
            child: const Text('Ya, Cabut Consent', style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}
