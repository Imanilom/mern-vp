import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/functional_colors.dart';
import '../../core/theme/htm_colors.dart';
import '../../core/theme/htm_typography.dart';
import '../../core/notifications/notification_service.dart';
import '../../core/ble/mock_ble_service.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import '../../core/network/api_client.dart';

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {

  // Local settings state to make all widgets fully functional
  bool _notificationEnabled = true;
  bool _batterySaverEnabled = false;
  String _syncFrequency = "Tiap 5 Menit";

  bool _bluetoothPermission = true;
  bool _activityPermission = true;
  bool _notificationPermission = true;

  @override
  void initState() {
    super.initState();
  }

  @override
  Widget build(BuildContext context) {
    final colors =
        Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;
    final htmColors = HtmColors.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final profileAsync = ref.watch(profileProvider);
    final bleService = ref.watch(bleServiceProvider);
    final isSensorConnected = bleService.isConnected;
    final deviceName = bleService.deviceName;
    final batteryLevel = bleService.batteryLevel;

    return Scaffold(
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text("Gagal memuat profil: $err")),
        data: (p) {
          return Scaffold(
            appBar: AppBar(
              toolbarHeight: 90,
              backgroundColor: Colors.transparent,
              elevation: 0,
              flexibleSpace: Container(
                decoration: BoxDecoration(
                  color: htmColors.surface,
                  border: Border(bottom: BorderSide(color: htmColors.hairline, width: 1)),
                ),
              ),
              foregroundColor: htmColors.ink,
              title: Row(
                children: [
                  // Avatar
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          colors.dataBlue,
                          const Color(0xFF6366F1),
                        ],
                      ),
                      shape: BoxShape.circle,
                      border: Border.all(
                          color: Colors.white.withValues(alpha: 0.3),
                          width: 2.0),
                    ),
                    child: Center(
                      child: Text(
                        // Inisial diambil dari nama nyata pengguna, bukan hardcoded 'P1'
                        p.name.isNotEmpty
                            ? p.name
                                .trim()
                                .split(RegExp(r'\s+'))
                                .take(2)
                                .map((w) => w[0].toUpperCase())
                                .join()
                            : "P",
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          p.name,
                          style: HtmTypography.titleMedium?.copyWith(color: htmColors.ink),
                          overflow: TextOverflow.ellipsis,
                          maxLines: 1,
                        ),
                        Text(
                          "${p.id} • ${p.studyCode}",
                          style: HtmTypography.labelSmall.copyWith(color: htmColors.muted),
                          overflow: TextOverflow.ellipsis,
                          maxLines: 1,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            body: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
              children: [
                // Device card
                const _SectionHeader(label: "Perangkat Sensor"),
                const SizedBox(height: 8),
                _buildDeviceCard(colors, isDark, isSensorConnected, deviceName, batteryLevel),

                const SizedBox(height: 24),

                const _SectionHeader(label: "Informasi Peserta"),
                const SizedBox(height: 8),
                _InfoCard(isDark: isDark, children: [
                  _InfoRow(
                      "Tahun Lahir & Gender",
                      // Tampilkan 'Belum diisi' jika data tidak tersedia dari backend
                      (p.birthYear > 0 || p.gender.isNotEmpty)
                          ? "${p.birthYear > 0 ? p.birthYear.toString() : '-'} • ${p.gender.isNotEmpty ? p.gender : '-'}"
                          : "Belum diisi"),
                  _InfoRow(
                      "Tinggi & Berat Badan",
                      (p.heightCm > 0 || p.weightKg > 0)
                          ? "${p.heightCm > 0 ? '${p.heightCm.toStringAsFixed(0)} cm' : '-'} • ${p.weightKg > 0 ? '${p.weightKg.toStringAsFixed(1)} kg' : '-'}"
                          : "Belum diisi"),
                  _InfoRow("Kondisi Relevan", p.relevantCondition.isNotEmpty ? p.relevantCondition : "Belum diisi"),
                  _InfoRow(
                      "Kontak Petugas",
                      p.staffContact.isNotEmpty ? p.staffContact : "Belum tersedia",
                      color: p.staffContact.isNotEmpty ? colors.dataBlue : null),
                ]),

                const SizedBox(height: 24),

                const _SectionHeader(label: "Pengaturan Sistem & Sinkronisasi"),
                const SizedBox(height: 8),
                _SettingsCard(isDark: isDark, children: [
                  _SettingsTile(
                    icon: Icons.notifications_outlined,
                    label: "Notifikasi Peringatan",
                    subtitle: _notificationEnabled ? "Aktif" : "Nonaktif",
                    isSwitch: true,
                    switchValue: _notificationEnabled,
                    onSwitchChanged: (val) {
                      setState(() => _notificationEnabled = val);
                    },
                  ),
                  _SettingsTile(
                    icon: Icons.battery_saver_outlined,
                    label: "Mode Hemat Baterai",
                    subtitle: _batterySaverEnabled ? "BLE sampling dikurangi" : "Normal",
                    isSwitch: true,
                    switchValue: _batterySaverEnabled,
                    onSwitchChanged: (val) {
                      setState(() => _batterySaverEnabled = val);
                    },
                  ),
                  _SettingsTile(
                    icon: Icons.sync_rounded,
                    label: "Frekuensi Sinkronisasi",
                    subtitle: _syncFrequency,
                    isSwitch: false,
                    onTap: () => _showSyncFreqDialog(context),
                    isLast: true,
                  ),
                ]),

                const SizedBox(height: 24),

                const _SectionHeader(label: "Izin Perangkat & Privasi"),
                const SizedBox(height: 8),
                _SettingsCard(isDark: isDark, children: [
                  _SettingsTile(
                    icon: Icons.bluetooth_rounded,
                    label: "Izin Bluetooth",
                    subtitle: _bluetoothPermission ? "Dikehendaki untuk Polar H10 (Aktif)" : "Ditolak / Nonaktif",
                    isSwitch: true,
                    switchValue: _bluetoothPermission,
                    onSwitchChanged: (val) {
                      setState(() => _bluetoothPermission = val);
                    },
                  ),
                  _SettingsTile(
                    icon: Icons.directions_run_rounded,
                    label: "Izin Aktivitas Fisik",
                    subtitle: _activityPermission ? "Deteksi sensor gerak & akselerometer" : "Ditolak / Nonaktif",
                    isSwitch: true,
                    switchValue: _activityPermission,
                    onSwitchChanged: (val) {
                      setState(() => _activityPermission = val);
                    },
                  ),
                  _SettingsTile(
                    icon: Icons.notification_add_outlined,
                    label: "Izin Notifikasi",
                    subtitle: _notificationPermission ? "Peringatan lonjakan & anomali" : "Ditolak / Nonaktif",
                    isSwitch: true,
                    switchValue: _notificationPermission,
                    onSwitchChanged: (val) {
                      setState(() => _notificationPermission = val);
                    },
                  ),
                  _SettingsTile(
                    icon: Icons.privacy_tip_outlined,
                    label: "Privasi Data",
                    subtitle: "Kebijakan studi & enkripsi data",
                    isSwitch: false,
                    onTap: () => _showPrivacyDialog(context),
                    isLast: true,
                  ),
                ]),

                const SizedBox(height: 24),

                // Bantuan & Informasi
                const _SectionHeader(label: "Bantuan & Informasi"),
                const SizedBox(height: 8),
                _SettingsCard(isDark: isDark, children: [
                  _SettingsTile(
                    icon: Icons.help_outline_rounded,
                    label: "Bantuan & Dukungan",
                    subtitle: "FAQ & panduan penggunaan",
                    isSwitch: false,
                    onTap: () => _showHelpDialog(context),
                  ),
                  _SettingsTile(
                    icon: Icons.contact_support_outlined,
                    label: "Hubungi Admin Studi",
                    subtitle: "Pertanyaan atau masalah teknis",
                    isSwitch: false,
                    onTap: () => _showContactAdminDialog(context, p.staffContact),
                  ),
                  _SettingsTile(
                    icon: Icons.info_outline_rounded,
                    label: "Tentang Aplikasi",
                    subtitle: "HTM Research System v1.0.0",
                    isSwitch: false,
                    onTap: () => _showAboutDialog(context),
                    isLast: true,
                  ),
                ]),

                const SizedBox(height: 24),

                // Logout button
                _LogoutButton(colors: colors),
                const SizedBox(height: 8),
                Center(
                  child: Text(
                    "HTM Research System • v1.0.0",
                    style: TextStyle(
                        fontSize: 10, color: Colors.grey[400]),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  // --- Dynamic UI Helper Methods ---

  Widget _buildDeviceCard(
      FunctionalColors colors,
      bool isDark,
      bool isSensorConnected,
      String deviceName,
      int batteryLevel) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: isDark
            ? []
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: (isSensorConnected ? colors.stableGreen : Colors.grey).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  isSensorConnected ? Icons.bluetooth_connected_rounded : Icons.bluetooth_disabled_rounded,
                  color: isSensorConnected ? colors.stableGreen : Colors.grey,
                  size: 24,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      deviceName,
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Container(
                          width: 7,
                          height: 7,
                          decoration: BoxDecoration(
                            color: isSensorConnected ? colors.stableGreen : Colors.grey,
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          isSensorConnected ? "Terhubung" : "Terputus",
                          style: TextStyle(
                            fontSize: 11,
                            color: isSensorConnected ? colors.stableGreen : Colors.grey,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (isSensorConnected)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      "$batteryLevel%",
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: colors.stableGreen,
                      ),
                    ),
                    const Text(
                      "baterai",
                      style: TextStyle(fontSize: 10, color: Colors.grey),
                    ),
                  ],
                ),
            ],
          ),
          OutlinedButton.icon(
            onPressed: () => _showPairDeviceDialog(context),
            icon: const Icon(Icons.add_rounded, size: 16),
            label: const Text("Cari & Pasang Baru", style: TextStyle(fontSize: 13)),
            style: OutlinedButton.styleFrom(
              foregroundColor: colors.dataBlue,
              side: BorderSide(color: colors.dataBlue.withValues(alpha: 0.4)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              padding: const EdgeInsets.symmetric(vertical: 12),
              minimumSize: const Size(double.infinity, 44),
            ),
          ),
        ],
      ),
    );
  }

  void _showPairDeviceDialog(BuildContext context) {
    // Start scanning
    ref.read(bleServiceProvider).startScan();

    showDialog(
      context: context,
      builder: (ctx) {
        return Consumer(
          builder: (context, ref, child) {
            final bleService = ref.watch(bleServiceProvider);
            
            return AlertDialog(
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              title: Row(
                children: [
                  const Icon(Icons.bluetooth_audio_rounded, color: Colors.blue, size: 20),
                  const SizedBox(width: 8),
                  const Text("Cari Perangkat Baru", style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  const Spacer(),
                  StreamBuilder<bool>(
                    stream: bleService.isScanning,
                    initialData: false,
                    builder: (context, snap) {
                      if (snap.data == true) {
                        return const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        );
                      }
                      return IconButton(
                        icon: const Icon(Icons.refresh_rounded, size: 16),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        onPressed: () => bleService.startScan(),
                      );
                    },
                  ),
                ],
              ),
              content: SizedBox(
                width: double.maxFinite,
                child: StreamBuilder<List<ScanResult>>(
                  stream: bleService.scanResults,
                  initialData: const [],
                  builder: (context, snapshot) {
                    final list = snapshot.data ?? [];
                    final filteredList = list.where((r) => r.device.platformName.isNotEmpty).toList();
                    
                    if (filteredList.isEmpty) {
                      return const Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          SizedBox(height: 24),
                          Text(
                            "Memindai sensor dada Polar H10 terdekat...",
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12, color: Colors.grey),
                          ),
                          SizedBox(height: 24),
                        ],
                      );
                    }
                    
                    return ListView.builder(
                      shrinkWrap: true,
                      itemCount: filteredList.length,
                      itemBuilder: (context, index) {
                        final result = filteredList[index];
                        final name = result.device.platformName;
                        final address = result.device.remoteId.toString();
                        
                        return ListTile(
                          leading: const Icon(Icons.bluetooth_connected_rounded, color: Colors.blue),
                          title: Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                          subtitle: Text(address, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                          trailing: Text("${result.rssi} dBm", style: const TextStyle(fontSize: 11)),
                          onTap: () async {
                            Navigator.pop(ctx);
                            bleService.stopScan();
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text("Menghubungkan ke $name..."),
                                behavior: SnackBarBehavior.floating,
                              ),
                            );
                            
                            final ok = await bleService.connectToDevice(result.device);
                            if (context.mounted) {
                              if (ok) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text("Berhasil terhubung ke $name!"),
                                    behavior: SnackBarBehavior.floating,
                                    backgroundColor: Colors.green,
                                  ),
                                );
                                NotificationService().showDeviceConnected(name);
                              } else {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text("Gagal terhubung ke $name"),
                                    behavior: SnackBarBehavior.floating,
                                    backgroundColor: Colors.red,
                                  ),
                                );
                              }
                            }
                          },
                        );
                      },
                    );
                  },
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    bleService.stopScan();
                    Navigator.pop(ctx);
                  },
                  child: const Text("Batal"),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showSyncFreqDialog(BuildContext context) {
    final intervals = ["Tiap 1 Menit", "Tiap 5 Menit", "Tiap 15 Menit", "Tiap 30 Menit", "Hanya via Wi-Fi"];
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text("Frekuensi Sinkronisasi", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: intervals.map((interval) {
            return RadioListTile<String>(
              title: Text(interval, style: const TextStyle(fontSize: 13)),
              value: interval,
              groupValue: _syncFrequency,
              onChanged: (val) {
                if (val != null) {
                  setState(() => _syncFrequency = val);
                  Navigator.pop(ctx);
                }
              },
            );
          }).toList(),
        ),
      ),
    );
  }

  void _showPrivacyDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text("Data & Privasi Studi", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        content: const SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                "Keamanan Data Penelitian",
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
              SizedBox(height: 6),
              Text(
                "Semua data denyut jantung dan HRV dienkripsi langsung secara lokal di memori sandboxed aplikasi sebelum ditransmisikan. Identitas Anda disamarkan menggunakan kode Participant ID anonim.",
                style: TextStyle(fontSize: 11, height: 1.5),
              ),
              SizedBox(height: 12),
              Text(
                "Pengumpulan Latar Belakang",
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
              ),
              SizedBox(height: 6),
              Text(
                "Aplikasi akan mengumpulkan metrik dari Polar H10 di latar belakang saat sesi aktif untuk memastikan lintasan trajectory kesehatan (trajectory health) terekam utuh tanpa terputus.",
                style: TextStyle(fontSize: 11, height: 1.5),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Tutup"),
          ),
        ],
      ),
    );
  }

  void _showContactAdminDialog(BuildContext context, String fallbackContact) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text("Hubungi Admin Studi", style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "Jika Anda mengalami gangguan pada sensor Polar H10 atau kendala pengiriman data, silakan hubungi tim peneliti:",
              style: TextStyle(fontSize: 12, height: 1.4),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                const Icon(Icons.phone_rounded, size: 16, color: Colors.blue),
                const SizedBox(width: 8),
                Text(fallbackContact, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.email_outlined, size: 16, color: Colors.blue),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    "support@healthtrajectory.cloud",
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Selesai"),
          ),
        ],
      ),
    );
  }

  void _showHelpDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text("Bantuan & Dukungan",
            style: TextStyle(fontWeight: FontWeight.w700)),
        content: const SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text("Cara Menggunakan Aplikasi",
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              SizedBox(height: 6),
              Text(
                "1. Pastikan sensor Polar H10 terpasang dengan benar di dada.\n"
                "2. Aktifkan Bluetooth di perangkat Anda.\n"
                "3. Buka halaman Monitoring dan tunggu koneksi otomatis.\n"
                "4. Pilih aktivitas yang sedang Anda lakukan.\n"
                "5. Data akan dikirim ke sistem secara otomatis.",
                style: TextStyle(fontSize: 12, height: 1.6),
              ),
              SizedBox(height: 16),
              Text("Masalah Umum",
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              SizedBox(height: 6),
              Text(
                "• Sensor tidak terhubung: Pastikan baterai sensor > 20%.\n"
                "• Data tidak terkirim: Periksa koneksi internet.\n"
                "• Aplikasi lambat: Restart aplikasi dan pastikan tidak ada app lain yang berjalan.",
                style: TextStyle(fontSize: 12, height: 1.6),
              ),
            ],
          ),
        ),
        actions: [
          FilledButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text("Tutup"),
          ),
        ],
      ),
    );
  }

  void _showAboutDialog(BuildContext context) {
    showAboutDialog(
      context: context,
      applicationName: "Health Trajectory Monitor",
      applicationVersion: "1.0.0",
      applicationLegalese:
          "© 2026 HTM Research System\nAplikasi ini digunakan untuk keperluan penelitian kesehatan.",
      children: [
        const SizedBox(height: 12),
        const Text(
          "HTM adalah aplikasi pengumpulan data kesehatan real-time yang menggunakan sensor wearable Polar H10 untuk memonitor heart rate, HRV, dan trajectory kesehatan peserta penelitian.",
          style: TextStyle(fontSize: 12, height: 1.5),
        ),
      ],
    );
  }
}
class _SectionHeader extends StatelessWidget {
  final String label;
  const _SectionHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(
      label.toUpperCase(),
      style: TextStyle(
        fontSize: 10,
        fontWeight: FontWeight.w700,
        letterSpacing: 1.2,
        color: Colors.grey[500],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final bool isDark;
  final List<Widget> children;
  const _InfoCard({required this.isDark, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: isDark
            ? []
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
      ),
      child: Column(
        children: List.generate(children.length * 2 - 1, (i) {
          if (i.isOdd) {
            return Divider(
              height: 1,
              indent: 16,
              endIndent: 16,
              color: Colors.grey.withValues(alpha: 0.1),
            );
          }
          return children[i ~/ 2];
        }),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? color;
  const _InfoRow(this.label, this.value, {this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 13, color: Colors.grey)),
          Flexible(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: color,
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingsCard extends StatelessWidget {
  final bool isDark;
  final List<Widget> children;
  const _SettingsCard({required this.isDark, required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: isDark
            ? []
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
      ),
      child: Column(children: children),
    );
  }
}

class _SettingsTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String subtitle;
  final bool isSwitch;
  final bool? switchValue;
  final ValueChanged<bool>? onSwitchChanged;
  final VoidCallback? onTap;
  final bool isLast;

  const _SettingsTile({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.isSwitch,
    this.switchValue,
    this.onSwitchChanged,
    this.onTap,
    this.isLast = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors =
        Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;
    Widget tile = Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: colors.dataBlue.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 18, color: colors.dataBlue),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 13)),
                const SizedBox(height: 1),
                Text(subtitle,
                    style: const TextStyle(
                        fontSize: 11, color: Colors.grey)),
              ],
            ),
          ),
          if (isSwitch)
            Switch.adaptive(
              value: switchValue ?? false,
              onChanged: onSwitchChanged,
              activeThumbColor: colors.dataBlue,
              activeTrackColor: colors.dataBlue.withValues(alpha: 0.4),
            )
          else
            Icon(Icons.chevron_right_rounded,
                size: 20, color: Colors.grey[400]),
        ],
      ),
    );

    return Column(
      children: [
        isSwitch
            ? tile
            : InkWell(
                onTap: onTap,
                borderRadius: isLast
                    ? const BorderRadius.vertical(
                        bottom: Radius.circular(18))
                    : BorderRadius.zero,
                child: tile,
              ),
        if (!isLast)
          Divider(
            height: 1,
            indent: 66,
            color: Colors.grey.withValues(alpha: 0.1),
          ),
      ],
    );
  }
}

class _LogoutButton extends ConsumerWidget {
  final FunctionalColors colors;

  const _LogoutButton({required this.colors});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: () {
        showDialog(
          context: context,
          builder: (dialogCtx) => AlertDialog(
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: const Text("Konfirmasi Logout",
                style: TextStyle(fontWeight: FontWeight.w700)),
            content: const Text(
              "Apakah Anda yakin ingin keluar dari sesi ini?\nData buffered lokal tetap tersimpan.",
              style: TextStyle(fontSize: 13, height: 1.5),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogCtx),
                child: Text("Batal",
                    style: TextStyle(color: Colors.grey[600])),
              ),
              ElevatedButton(
                onPressed: () async {
                  Navigator.pop(dialogCtx);
                  await ref.read(apiClientProvider).logout();
                  if (context.mounted) {
                    context.go('/login');
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: colors.alertRed,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text("Logout"),
              ),
            ],
          ),
        );
      },
      child: Container(
        width: double.infinity,
        height: 52,
        decoration: BoxDecoration(
          color: colors.alertRed.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: colors.alertRed.withValues(alpha: 0.2), width: 1.5),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.logout_rounded, color: colors.alertRed, size: 18),
            const SizedBox(width: 8),
            Text(
              "Keluar Sesi (Logout)",
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: colors.alertRed,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
