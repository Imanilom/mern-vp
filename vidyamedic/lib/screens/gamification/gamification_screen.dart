import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../../services/api_service.dart';

class GamificationScreen extends StatefulWidget {
  const GamificationScreen({super.key});

  @override
  State<GamificationScreen> createState() => _GamificationScreenState();
}

class _GamificationScreenState extends State<GamificationScreen> {
  Map<String, dynamic>? _data;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final response = await ApiService.getGamification();
    if (!mounted) return;
    setState(() {
      _loading = false;
      if (response.success) {
        _data = response.data;
      } else {
        _error = response.message ?? 'Data gamifikasi belum dapat dimuat.';
      }
    });
  }

  Map<String, dynamic> get _settings {
    final value = _data?['settings'];
    return value is Map ? Map<String, dynamic>.from(value) : {};
  }

  Future<void> _saveSettings(Map<String, dynamic> settings) async {
    setState(() => _saving = true);
    final response = await ApiService.updateGamification(settings);
    if (!mounted) return;
    setState(() => _saving = false);
    if (!response.success) {
      _showMessage(response.message ?? 'Pengaturan gagal disimpan.');
      return;
    }
    await _load();
  }

  Future<void> _toggleLeaderboard(bool enabled) async {
    await _saveSettings({'leaderboard_opt_in': enabled});
  }

  Future<void> _toggleLocation(bool enabled) async {
    if (!enabled) {
      await _saveSettings({'location_opt_in': false});
      return;
    }
    final consent = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Bagikan area perkiraan?'),
        content: const Text(
          'Lokasi hanya digunakan setelah Anda setuju untuk menemukan anggota komunitas di sekitar. Aplikasi mengirim dan menyimpan area yang dibulatkan (sekitar 1 km), bukan alamat atau koordinat presisi. Anda dapat mematikannya kapan saja.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Setuju & lanjutkan'),
          ),
        ],
      ),
    );
    if (consent != true || !mounted) return;

    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        _showMessage('Aktifkan layanan lokasi untuk mencari komunitas dekat.');
        return;
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        _showMessage(
          'Izin lokasi belum diberikan. Anda tetap dapat menggunakan leaderboard.',
        );
        return;
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.low,
          timeLimit: Duration(seconds: 15),
        ),
      );
      await _saveSettings({
        'location_opt_in': true,
        'latitude': (position.latitude * 100).round() / 100,
        'longitude': (position.longitude * 100).round() / 100,
      });
    } on LocationServiceDisabledException {
      _showMessage('Layanan lokasi tidak aktif.');
    } on PermissionDeniedException {
      _showMessage('Izin lokasi tidak diberikan.');
    } catch (error) {
      _showMessage('Lokasi tidak dapat diperoleh: $error');
    }
  }

  Future<void> _editNickname() async {
    final controller = TextEditingController(
      text: _settings['nickname']?.toString() ?? '',
    );
    final nickname = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Nama samaran'),
        content: TextField(
          controller: controller,
          maxLength: 24,
          decoration: const InputDecoration(
            labelText: 'Nama yang terlihat di papan skor',
            hintText: 'Contoh: LangkahSehat',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () =>
                Navigator.pop(dialogContext, controller.text.trim()),
            child: const Text('Simpan'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (nickname == null || !mounted) return;
    if (nickname.length < 2) {
      _showMessage('Nama samaran minimal 2 karakter.');
      return;
    }
    await _saveSettings({'nickname': nickname});
  }

  void _showMessage(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading && _data == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null && _data == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Koin & Komunitas')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off_rounded, size: 44),
                const SizedBox(height: 12),
                Text(_error!, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _load,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Coba lagi'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    final leaderboardRaw = _data?['leaderboard'];
    final leaderboard = leaderboardRaw is List
        ? leaderboardRaw
            .whereType<Map>()
            .map(Map<String, dynamic>.from)
            .toList()
        : <Map<String, dynamic>>[];
    final scope = _data?['leaderboard_scope']?.toString() ?? 'global';
    final coins = (_data?['coins'] as num?)?.toInt() ?? 0;
    final nickname = _settings['nickname']?.toString() ?? 'Teman';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Koin & Komunitas'),
        actions: [
          IconButton(
            tooltip: 'Muat ulang',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
          children: [
            _CoinCard(coins: coins),
            const SizedBox(height: 16),
            _SectionCard(
              title: 'Cara mengumpulkan koin',
              icon: Icons.auto_awesome_rounded,
              child: const Text(
                'Rekam dengan wearable nyata dan pastikan sensor menempel agar data RR tercatat. Satu hari kalender dengan rekaman nyata mendapat 1 koin. Rekaman simulasi tidak dihitung.',
                style: TextStyle(height: 1.45),
              ),
            ),
            const SizedBox(height: 16),
            _SectionCard(
              title: 'Privasi & keikutsertaan',
              icon: Icons.verified_user_outlined,
              child: Column(
                children: [
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Nama samaran'),
                    subtitle: Text(nickname),
                    trailing: IconButton(
                      tooltip: 'Ubah nama samaran',
                      onPressed: _saving ? null : _editNickname,
                      icon: const Icon(Icons.edit_outlined),
                    ),
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Ikut papan skor'),
                    subtitle: const Text(
                      'Nama samaran dan jumlah koin akan terlihat oleh peserta lain.',
                    ),
                    value: _settings['leaderboard_opt_in'] == true,
                    onChanged: _saving ? null : _toggleLeaderboard,
                  ),
                  const Divider(height: 1),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Temukan komunitas dekat'),
                    subtitle: const Text(
                      'Lokasi area perkiraan dibagikan untuk menampilkan peserta dalam radius 10 km.',
                    ),
                    value: _settings['location_opt_in'] == true,
                    onChanged: _saving ? null : _toggleLocation,
                  ),
                  if (_saving)
                    const Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: LinearProgressIndicator(),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            _SectionCard(
              title: scope == 'nearby' ? 'Papan skor sekitar' : 'Papan skor',
              icon: Icons.emoji_events_outlined,
              trailing: Text(
                scope == 'nearby' ? 'Radius 10 km' : 'Komunitas',
                style: const TextStyle(fontSize: 12, color: Colors.black54),
              ),
              child: leaderboard.isEmpty
                  ? const Padding(
                      padding: EdgeInsets.symmetric(vertical: 16),
                      child: Text(
                        'Belum ada peserta yang tampil. Anda dapat bergabung dengan nama samaran di atas.',
                        textAlign: TextAlign.center,
                        style: TextStyle(height: 1.4),
                      ),
                    )
                  : Column(
                      children: [
                        for (var index = 0; index < leaderboard.length; index++)
                          _LeaderboardRow(
                            rank: index + 1,
                            nickname:
                                leaderboard[index]['nickname']?.toString() ??
                                    'Teman',
                            coins: (leaderboard[index]['coins'] as num?)
                                    ?.toInt() ??
                                0,
                            isMe: leaderboard[index]['is_me'] == true,
                          ),
                      ],
                    ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
          ],
        ),
      ),
    );
  }
}

class _CoinCard extends StatelessWidget {
  const _CoinCard({required this.coins});

  final int coins;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0B7A5A), Color(0xFF20A87E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: [
          Container(
            width: 58,
            height: 58,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.18),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.monetization_on_rounded,
              color: Color(0xFFFFD166),
              size: 38,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Koin rekaman',
                  style: TextStyle(color: Colors.white70, fontSize: 14),
                ),
                Text(
                  '$coins',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 34,
                    fontWeight: FontWeight.w800,
                    height: 1.1,
                  ),
                ),
                const Text(
                  'Hari aktif, satu koin untuk tiap hari',
                  style: TextStyle(color: Colors.white, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.icon,
    required this.child,
    this.trailing,
  });

  final String title;
  final IconData icon;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        side: const BorderSide(color: Color(0xFFE7EEEB)),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: const Color(0xFF0B7A5A), size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                ),
                if (trailing != null) trailing!,
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _LeaderboardRow extends StatelessWidget {
  const _LeaderboardRow({
    required this.rank,
    required this.nickname,
    required this.coins,
    required this.isMe,
  });

  final int rank;
  final String nickname;
  final int coins;
  final bool isMe;

  @override
  Widget build(BuildContext context) {
    final color = rank == 1
        ? const Color(0xFFFFB703)
        : rank == 2
            ? const Color(0xFF8D99AE)
            : rank == 3
                ? const Color(0xFFCD7F32)
                : const Color(0xFF0B7A5A);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
      decoration: BoxDecoration(
        color: isMe ? const Color(0xFFEAF6F1) : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 34,
            child: Text(
              '$rank',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                color: color,
                fontSize: 16,
              ),
            ),
          ),
          CircleAvatar(
            radius: 17,
            backgroundColor: const Color(0xFFEAF6F1),
            child: Text(
              nickname.isEmpty ? '?' : nickname.characters.first.toUpperCase(),
              style: const TextStyle(
                color: Color(0xFF0B7A5A),
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              isMe ? '$nickname (Anda)' : nickname,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          const Icon(
            Icons.monetization_on_rounded,
            color: Color(0xFFFFB703),
            size: 18,
          ),
          const SizedBox(width: 4),
          Text('$coins', style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}
