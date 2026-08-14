import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';

class ConsentScreen extends StatefulWidget {
  const ConsentScreen({super.key});

  @override
  State<ConsentScreen> createState() => _ConsentScreenState();
}

class _ConsentScreenState extends State<ConsentScreen> {
  bool bleAllowed = true;
  bool backgroundAllowed = true;
  bool notifAllowed = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.navy),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Langkah 1 dari 3',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.gray),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Top Stepper Line
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 24.0),
              child: ClipRRect(
                borderRadius: BorderRadius.all(Radius.circular(4)),
                child: LinearProgressIndicator(
                  value: 0.33,
                  minHeight: 4,
                  backgroundColor: AppColors.graySoft,
                  valueColor: AlwaysStoppedAnimation<Color>(AppColors.teal),
                ),
              ),
            ),
            const SizedBox(height: 16),

            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Persetujuan & Izin Akses',
                      style: TextStyle(
                        fontFamily: 'Plus Jakarta Sans',
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: AppColors.navy,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Persetujuan ini diperlukan sebelum menghubungkan perangkat Polar H10.',
                      style: TextStyle(fontSize: 12.5, color: AppColors.gray, height: 1.4),
                    ),
                    const SizedBox(height: 20),

                    // Permission Card 1: BLE
                    _buildInteractivePermissionCard(
                      icon: Icons.bluetooth_searching_rounded,
                      iconColor: AppColors.blue,
                      title: 'Koneksi Bluetooth (BLE)',
                      description: 'Membaca dan memproses aliran sinyal interval RR beat-to-beat dari Polar H10.',
                      value: bleAllowed,
                      onChanged: (v) => setState(() => bleAllowed = v),
                    ),
                    const SizedBox(height: 12),

                    // Permission Card 2: Background Sensing
                    _buildInteractivePermissionCard(
                      icon: Icons.sensors_rounded,
                      iconColor: AppColors.teal,
                      title: 'Komputasi Latar Belakang',
                      description: 'Merekam dan menghitung fitur fisiologis saat aplikasi berjalan di belakang layar.',
                      value: backgroundAllowed,
                      onChanged: (v) => setState(() => backgroundAllowed = v),
                    ),
                    const SizedBox(height: 12),

                    // Permission Card 3: Notifications
                    _buildInteractivePermissionCard(
                      icon: Icons.notifications_active_rounded,
                      iconColor: AppColors.amber,
                      title: 'Pemberitahuan EMA & State',
                      description: 'Memberikan permintaan pengisian kuesioner EMA saat sistem mendeteksi transisi state.',
                      value: notifAllowed,
                      onChanged: (v) => setState(() => notifAllowed = v),
                    ),
                    const SizedBox(height: 20),

                    // Pseudonym Guarantee Card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.purpleSoft,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.purple.withValues(alpha: 0.2)),
                      ),
                      child: const Row(
                        children: [
                          Icon(Icons.shield_outlined, color: AppColors.purple, size: 20),
                          SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Jaminan Privasi Pseudonim',
                                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.purple),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  'Sesi Anda terdaftar dengan ID Pseudonim (P-014). Nama atau identitas pribadi Anda tidak pernah disimpan.',
                                  style: TextStyle(fontSize: 11, color: AppColors.ink, height: 1.35),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Bottom Action Container
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.surface,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 10,
                    offset: const Offset(0, -3),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Container(
                    width: double.infinity,
                    height: 50,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.teal, Color(0xFF0F5F63)],
                      ),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: ElevatedButton(
                      onPressed: () {
                        Navigator.pushNamed(context, '/pairing');
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        shadowColor: Colors.transparent,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text('Setujui & Lanjutkan', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: Colors.white)),
                          SizedBox(width: 8),
                          Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 18),
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
    );
  }

  Widget _buildInteractivePermissionCard({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String description,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: value ? iconColor.withValues(alpha: 0.4) : AppColors.line),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: iconColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: iconColor, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: AppColors.navy,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  description,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.gray,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Switch(
            value: value,
            activeThumbColor: iconColor,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}
