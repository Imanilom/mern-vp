import 'package:flutter/material.dart';

import '../../theme/app_colors.dart';
import '../../widgets/evidence_chip.dart';

class DevicePairingScreen extends StatelessWidget {
  const DevicePairingScreen({super.key});

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
          'Langkah 2 dari 3',
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
                  value: 0.66,
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
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Polar H10',
                              style: TextStyle(
                                fontFamily: 'Plus Jakarta Sans',
                                fontSize: 24,
                                fontWeight: FontWeight.w800,
                                color: AppColors.navy,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Sistem sinyal RR beat-to-beat',
                              style: TextStyle(fontSize: 12, color: AppColors.gray),
                            ),
                          ],
                        ),
                        EvidenceChip.evaluable(),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Radar Sensor Graphic Card
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.teal.withValues(alpha: 0.15),
                              blurRadius: 30,
                              spreadRadius: 10,
                            ),
                          ],
                          border: Border.all(color: AppColors.tealSoft, width: 6),
                        ),
                        child: Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: AppColors.tealSoft,
                            shape: BoxShape.circle,
                            border: Border.all(color: AppColors.teal.withValues(alpha: 0.3), width: 2),
                          ),
                          child: const Icon(
                            Icons.bluetooth_connected_rounded,
                            size: 44,
                            color: AppColors.teal,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Status Checklist Card
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.line),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.03),
                            blurRadius: 10,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'TELEMETRI SENSOR REALT-TIME',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: AppColors.gray,
                              letterSpacing: 0.5,
                            ),
                          ),
                          const SizedBox(height: 14),
                          _buildTelemetryItem(Icons.check_circle_rounded, 'Kontak elektroda', 'Baik (100%)', AppColors.green),
                          const Divider(height: 20, color: AppColors.line),
                          _buildTelemetryItem(Icons.rss_feed_rounded, 'Aliran data RR', 'Aktif (1000 Hz)', AppColors.green),
                          const Divider(height: 20, color: AppColors.line),
                          _buildTelemetryItem(Icons.access_time_rounded, 'Sinkronisasi jam', '±0,4 s drift', AppColors.navy),
                          const Divider(height: 20, color: AppColors.line),
                          _buildTelemetryItem(Icons.battery_charging_full_rounded, 'Status baterai', '76% (Tercukupi)', AppColors.green),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Action Button Container
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
              child: Container(
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
                    Navigator.pushNamed(context, '/baseline');
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent,
                    shadowColor: Colors.transparent,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('Periksa Kesiapan Baseline', style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800, color: Colors.white)),
                      SizedBox(width: 8),
                      Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 18),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTelemetryItem(IconData icon, String label, String value, Color valueColor) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: valueColor),
            const SizedBox(width: 10),
            Text(
              label,
              style: const TextStyle(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: AppColors.navy,
              ),
            ),
          ],
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w800,
            color: valueColor,
          ),
        ),
      ],
    );
  }
}
