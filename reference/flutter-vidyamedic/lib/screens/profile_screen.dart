import 'package:flutter/material.dart';
import 'login_screen.dart';
import '../auth_service.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({Key? key}) : super(key: key);

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String _username = 'P001';
  String _email = 'Memuat...';

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    final username = await AuthService.getUsername() ?? 'P001';
    // Email is usually saved in auth_service, let's just show it or username
    setState(() {
      _username = username;
      _email = '$username@vidyamedic.com'; // Placeholder if email not explicitly fetched
    });
  }

  Future<void> _handleLogout() async {
    await AuthService.logout();
    if (mounted) {
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F6),
      appBar: AppBar(
        backgroundColor: const Color(0xFF073B4C),
        title: const Text('Profil & Pengaturan', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Profile Card
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.grey.shade200),
                boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4))],
              ),
              child: Row(
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(color: Colors.blue.shade50, shape: BoxShape.circle),
                    child: const Icon(Icons.person, size: 30, color: Colors.blue),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('User: $_username', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                        const SizedBox(height: 4),
                        const Text('Participant VidyaMedic', style: TextStyle(color: Colors.grey, fontSize: 12)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Device Information
            const Text('Perangkat Terhubung', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF073B4C))),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                children: [
                  const Row(
                    children: [
                      Icon(Icons.watch, color: Color(0xFF073B4C), size: 32),
                      SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Polar H10', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                            Text('Status: Connected', style: TextStyle(color: Colors.green, fontSize: 12, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16),
                    child: Divider(),
                  ),
                  _buildProfileRow('Battery', '82%'),
                  const SizedBox(height: 8),
                  _buildProfileRow('Signal Quality', 'Good (96%)'),
                  const SizedBox(height: 8),
                  _buildProfileRow('Last Sync', 'Real-time via MQTT'),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Settings
            const Text('Pengaturan', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF073B4C))),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                children: [
                  _buildSettingTile(Icons.notifications_none, 'Notifikasi', trailing: Switch(value: true, onChanged: (v) {}, activeColor: const Color(0xFF073B4C))),
                  const Divider(height: 1),
                  _buildSettingTile(Icons.battery_saver, 'Mode Hemat Baterai', trailing: Switch(value: false, onChanged: (v) {}, activeColor: const Color(0xFF073B4C))),
                  const Divider(height: 1),
                  _buildSettingTile(Icons.sync, 'Frekuensi Sinkronisasi', trailing: const Text('Real-time', style: TextStyle(color: Colors.grey, fontSize: 12))),
                  const Divider(height: 1),
                  _buildSettingTile(Icons.bluetooth, 'Izin Bluetooth', trailing: const Icon(Icons.check_circle, color: Colors.green, size: 20)),
                  const Divider(height: 1),
                  _buildSettingTile(Icons.lock_outline, 'Kebijakan Privasi', trailing: const Icon(Icons.chevron_right, color: Colors.grey)),
                ],
              ),
            ),
            const SizedBox(height: 32),

            // Logout
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: _handleLogout,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  side: const BorderSide(color: Colors.red),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: const Text('Keluar (Logout)', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold, fontSize: 16)),
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 13)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.black87)),
      ],
    );
  }

  Widget _buildSettingTile(IconData icon, String title, {required Widget trailing}) {
    return ListTile(
      leading: Icon(icon, color: Colors.black54),
      title: Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
      trailing: trailing,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
    );
  }
}
