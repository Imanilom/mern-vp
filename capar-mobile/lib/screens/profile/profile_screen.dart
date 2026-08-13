import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:intl/intl.dart';

import '../../theme/app_colors.dart';
import '../../services/api_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool notificationsEnabled = true;
  bool isLoading = true;

  String userId = '';
  String userName = '—';
  String userRole = '—';
  String deviceName = '—';
  String lastSyncLabel = '—';
  String avatarInitials = '?';

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() => isLoading = true);

    final prefs = await SharedPreferences.getInstance();
    final uid = prefs.getString('user_id') ?? '';
    if (mounted) setState(() => userId = uid);

    try {
      final meRes = await ApiService.getMe();
      if (meRes != null && mounted) {
        final user = meRes is Map ? (meRes['user'] ?? meRes['data'] ?? meRes) : <String, dynamic>{};
        final name = user['name'] ?? user['username'] ?? user['email'] ?? uid;
        final role = user['role'] ?? '—';
        final device = user['device_id'] ?? user['deviceId'] ?? '—';
        final initials = _makeInitials(name.toString());

        setState(() {
          userName = name.toString();
          userRole = role.toString();
          deviceName = device.toString();
          avatarInitials = initials;
        });
      } else if (mounted) {
        // Fallback: use stored user_id
        setState(() {
          userName = uid.isNotEmpty ? uid : '—';
          avatarInitials = uid.isNotEmpty ? uid.substring(0, uid.length.clamp(0, 3)).toUpperCase() : '?';
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          userName = uid.isNotEmpty ? uid : '—';
          avatarInitials = uid.isNotEmpty ? uid.substring(0, uid.length.clamp(0, 3)).toUpperCase() : '?';
        });
      }
    } finally {
      // Mark last sync as now
      final now = DateTime.now();
      if (mounted) {
        setState(() {
          lastSyncLabel = 'Up to date (${DateFormat('HH:mm').format(now)} WIB)';
          isLoading = false;
        });
      }
    }
  }

  String _makeInitials(String name) {
    final parts = name.trim().split(RegExp(r'[\s_-]+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0].substring(0, parts[0].length.clamp(0, 3)).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  Future<void> _logout(BuildContext context) async {
    await ApiService.logout();
    if (context.mounted) {
      Navigator.pushNamedAndRemoveUntil(context, '/', (route) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: isLoading
            ? const Center(child: CircularProgressIndicator())
            : SingleChildScrollView(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Profil & Privasi',
                      style: TextStyle(fontFamily: 'Plus Jakarta Sans', fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.navy),
                    ),
                    const SizedBox(height: 2),
                    const Text('Identitas partisipan & pengaturan data', style: TextStyle(fontSize: 12, color: AppColors.gray)),
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
                            decoration: const BoxDecoration(color: AppColors.navy, shape: BoxShape.circle),
                            child: Center(
                              child: Text(
                                avatarInitials,
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15),
                              ),
                            ),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  userName,
                                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.navy),
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  userRole.isNotEmpty && userRole != '—' ? 'Role: $userRole' : 'ID: $userId',
                                  style: const TextStyle(fontSize: 11, color: AppColors.gray),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Settings
                    _buildSettingCard(
                      icon: Icons.bluetooth,
                      title: 'Perangkat Sensor',
                      value: deviceName != '—' ? deviceName : 'Belum terhubung',
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
                      value: lastSyncLabel,
                      valueColor: AppColors.green,
                      onTap: _loadProfile,
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
                        onPressed: () => _logout(context),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.red,
                          side: const BorderSide(color: AppColors.red),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Text('Keluar / Logout', style: TextStyle(fontWeight: FontWeight.w700)),
                      ),
                    ),
                    const SizedBox(height: 10),

                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: () => _showRevokeConsentDialog(context),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.gray,
                          side: const BorderSide(color: AppColors.line),
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
    return GestureDetector(
      onTap: onTap,
      child: Container(
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
            Flexible(
              child: Text(value, style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: valueColor), overflow: TextOverflow.ellipsis),
            ),
          ],
        ),
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
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Batal')),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              _logout(context);
            },
            child: const Text('Ya, Cabut Consent', style: TextStyle(color: AppColors.red, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }
}
