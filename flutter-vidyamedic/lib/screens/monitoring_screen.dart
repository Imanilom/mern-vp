import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../background_service.dart';
import '../mqtt_gps_service.dart';

class MonitoringScreen extends StatefulWidget {
  const MonitoringScreen({Key? key}) : super(key: key);

  @override
  State<MonitoringScreen> createState() => _MonitoringScreenState();
}

class _MonitoringScreenState extends State<MonitoringScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _deviceIdController = TextEditingController();

  // Live sensor values from background service
  double _currentHr = 0;
  double _currentRr = 0;
  double _currentRrms = 0;
  double _currentEcg = 0;
  double _currentAccX = 0;
  double _currentAccY = 0;
  double _currentAccZ = 0;

  // Connection state
  bool _isRecording = false;
  bool _mqttConnected = false;
  String _mqttLastSent = '–';
  double? _gpsLat;
  double? _gpsLng;

  // Rolling chart buffers (max 60 points)
  final List<double> _hrBuffer = [];
  final List<double> _rrBuffer = [];
  final List<double> _ecgBuffer = [];
  static const int _maxPoints = 60;

  StreamSubscription? _sensorSub;
  Timer? _statusPollTimer;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    _loadSavedState();
    _listenToBackgroundService();
    _statusPollTimer =
        Timer.periodic(const Duration(seconds: 3), (_) => _pollMqttStatus());
  }

  Future<void> _loadSavedState() async {
    final prefs = await SharedPreferences.getInstance();
    if (!mounted) return;
    setState(() {
      _deviceIdController.text = prefs.getString('polar_device_id') ?? '';
      _isRecording = prefs.getBool('is_background_recording') ?? false;
      _mqttConnected = prefs.getBool('mqtt_connected') ?? false;
      _mqttLastSent = prefs.getString('mqtt_last_sent') ?? '–';
      _gpsLat = prefs.getDouble('gps_latitude');
      _gpsLng = prefs.getDouble('gps_longitude');
    });
  }

  Future<void> _pollMqttStatus() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.reload();
    if (!mounted) return;
    setState(() {
      _mqttConnected = prefs.getBool('mqtt_connected') ?? false;
      _mqttLastSent = prefs.getString('mqtt_last_sent') ?? '–';
      _gpsLat = prefs.getDouble('gps_latitude');
      _gpsLng = prefs.getDouble('gps_longitude');
    });
  }

  void _listenToBackgroundService() {
    _sensorSub = FlutterBackgroundService().on('sensor_update').listen((event) {
      if (event != null && mounted) {
        setState(() {
          _currentHr = ((event['hr'] ?? 0) as num).toDouble();
          _currentRr = ((event['rr'] ?? 0) as num).toDouble();
          _currentRrms = ((event['rrms'] ?? 0) as num).toDouble();
          _currentEcg = ((event['ecg'] ?? 0) as num).toDouble();
          _currentAccX = ((event['acc_x'] ?? 0) as num).toDouble();
          _currentAccY = ((event['acc_y'] ?? 0) as num).toDouble();
          _currentAccZ = ((event['acc_z'] ?? 0) as num).toDouble();
          _mqttConnected = event['mqtt_connected'] ?? false;

          // Push to chart buffers
          void push(List<double> buf, double val) {
            buf.add(val);
            if (buf.length > _maxPoints) buf.removeAt(0);
          }

          push(_hrBuffer, _currentHr);
          push(_rrBuffer, _currentRr);
          push(_ecgBuffer, _currentEcg);
        });
      }
    });
  }

  Future<void> _startPolar() async {
    final deviceId = _deviceIdController.text.trim();
    if (deviceId.isEmpty) {
      _snack('Harap masukkan Polar Device ID terlebih dahulu!', isError: true);
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('polar_device_id', deviceId);
    final activity = prefs.getString('current_activity') ?? 'Duduk';

    try {
      await BackgroundServiceHelper().startBackgroundService(deviceId, activity);
      if (mounted) {
        setState(() => _isRecording = true);
        _snack('Menghubungkan ke Polar $deviceId ...');
      }
    } catch (e) {
      _snack('Gagal memulai: $e', isError: true);
    }
  }

  Future<void> _stopPolar() async {
    await BackgroundServiceHelper().stopBackgroundService();
    if (mounted) {
      setState(() {
        _isRecording = false;
        _currentHr = 0;
        _currentRr = 0;
        _currentRrms = 0;
        _currentEcg = 0;
        _currentAccX = _currentAccY = _currentAccZ = 0;
        _hrBuffer.clear();
        _rrBuffer.clear();
        _ecgBuffer.clear();
      });
      _snack('Monitoring dihentikan.');
    }
  }

  void _snack(String msg, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: isError ? Colors.red : const Color(0xFF073B4C),
    ));
  }

  @override
  void dispose() {
    _sensorSub?.cancel();
    _statusPollTimer?.cancel();
    _tabController.dispose();
    _deviceIdController.dispose();
    super.dispose();
  }

  // ─── Build ───────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0D1F2D),
      appBar: AppBar(
        backgroundColor: const Color(0xFF073B4C),
        title: const Text('Monitoring Sensor',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: const Color(0xFFFFD166),
          labelColor: const Color(0xFFFFD166),
          unselectedLabelColor: Colors.white54,
          tabs: const [
            Tab(text: 'Heart Rate'),
            Tab(text: 'RR Interval'),
            Tab(text: 'HRV'),
            Tab(text: 'ECG'),
            Tab(text: 'Motion'),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildDeviceInput(),
            const SizedBox(height: 12),
            _buildConnectionCard(),
            const SizedBox(height: 16),
            _buildLiveValueGrid(),
            const SizedBox(height: 16),
            _buildMiniChart(_tabController.index),
            const SizedBox(height: 16),
            _buildTransmissionCard(),
            const SizedBox(height: 16),
            _buildControlButtons(),
          ],
        ),
      ),
    );
  }

  // ─── Device ID Input ─────────────────────────────────────────────────────────

  Widget _buildDeviceInput() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1A3347),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Polar Device ID',
              style: TextStyle(
                  color: Colors.white70,
                  fontSize: 12,
                  fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(Icons.bluetooth, color: Color(0xFF64DFDF), size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _deviceIdController,
                  style: const TextStyle(color: Colors.white, fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Contoh: B6B78822',
                    hintStyle: TextStyle(color: Colors.white38, fontSize: 13),
                    isDense: true,
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ─── Connection Status Card ───────────────────────────────────────────────────

  Widget _buildConnectionCard() {
    final color = _isRecording ? const Color(0xFF06D6A0) : Colors.red.shade400;
    final label = _isRecording ? 'Terhubung / Streaming' : 'Terputus';
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1A3347),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Row(
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 400),
            width: 12,
            height: 12,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              boxShadow: _isRecording
                  ? [BoxShadow(color: color.withOpacity(0.6), blurRadius: 8)]
                  : [],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Polar H10 — ${_deviceIdController.text.isEmpty ? "–" : _deviceIdController.text}',
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.bold)),
                Text(label,
                    style: TextStyle(
                        color: color, fontSize: 12, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          Icon(
            _isRecording ? Icons.bluetooth_connected : Icons.bluetooth_disabled,
            color: color,
          ),
        ],
      ),
    );
  }

  // ─── Live Value Grid ─────────────────────────────────────────────────────────

  Widget _buildLiveValueGrid() {
    final items = [
      _LiveItem('Heart Rate', '${_currentHr.round()}', 'BPM', const Color(0xFFEF476F), Icons.favorite),
      _LiveItem('RR Interval', '${_currentRr.round()}', 'ms', const Color(0xFFFFD166), Icons.timeline),
      _LiveItem('HRV (RMSSD)', '${_currentRrms.toStringAsFixed(1)}', 'ms', const Color(0xFF06D6A0), Icons.bar_chart),
      _LiveItem('ECG', '${_currentEcg.round()}', 'µV', const Color(0xFF64DFDF), Icons.monitor_heart),
      _LiveItem('ACC–X', '${_currentAccX.toStringAsFixed(2)}', 'g', Colors.orange, Icons.swap_horiz),
      _LiveItem('ACC–Y', '${_currentAccY.toStringAsFixed(2)}', 'g', Colors.purple.shade300, Icons.swap_vert),
      _LiveItem('ACC–Z', '${_currentAccZ.toStringAsFixed(2)}', 'g', Colors.pink.shade300, Icons.height),
    ];

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 10,
      mainAxisSpacing: 10,
      childAspectRatio: 2.5,
      children: items.map(_buildLiveCard).toList(),
    );
  }

  Widget _buildLiveCard(_LiveItem item) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: item.color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: item.color.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(item.icon, color: item.color, size: 22),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(item.label,
                    style: TextStyle(
                        color: Colors.white60,
                        fontSize: 9,
                        fontWeight: FontWeight.bold),
                    overflow: TextOverflow.ellipsis),
                Text(
                  '${item.value} ${item.unit}',
                  style: TextStyle(
                      color: item.color,
                      fontSize: 15,
                      fontWeight: FontWeight.w900),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ─── Mini Chart (sparkline) ───────────────────────────────────────────────────

  Widget _buildMiniChart(int tabIndex) {
    List<double> data;
    String title;
    Color color;
    String unit;

    switch (tabIndex) {
      case 1:
        data = _rrBuffer;
        title = 'RR Interval';
        color = const Color(0xFFFFD166);
        unit = 'ms';
        break;
      case 3:
        data = _ecgBuffer;
        title = 'ECG';
        color = const Color(0xFF64DFDF);
        unit = 'µV';
        break;
      default:
        data = _hrBuffer;
        title = 'Heart Rate';
        color = const Color(0xFFEF476F);
        unit = 'BPM';
    }

    return Container(
      height: 130,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF112233),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Live — $title',
                  style: TextStyle(
                      color: color, fontSize: 11, fontWeight: FontWeight.bold)),
              Text(data.isEmpty ? '–' : '${data.last.toStringAsFixed(1)} $unit',
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 8),
          Expanded(
            child: data.length < 2
                ? Center(
                    child: Text(
                      _isRecording
                          ? 'Menunggu data dari sensor...'
                          : 'Tekan "Mulai" untuk memulai streaming',
                      style: const TextStyle(color: Colors.white38, fontSize: 11),
                      textAlign: TextAlign.center,
                    ),
                  )
                : CustomPaint(
                    painter: _SparklinePainter(data, color),
                    size: Size.infinite,
                  ),
          ),
        ],
      ),
    );
  }

  // ─── Transmission Info ────────────────────────────────────────────────────────

  Widget _buildTransmissionCard() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF1A3347),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Status Transmisi',
              style: TextStyle(
                  color: Colors.white70,
                  fontSize: 12,
                  fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          _infoRow('RabbitMQ / MQTT', _mqttConnected ? '● Connected' : '● Offline',
              _mqttConnected ? const Color(0xFF06D6A0) : Colors.red.shade400),
          const SizedBox(height: 6),
          _infoRow('Terakhir Dikirim', _mqttLastSent, Colors.white70),
          const SizedBox(height: 6),
          _infoRow(
            'GPS',
            (_gpsLat != null && _gpsLng != null)
                ? '${_gpsLat!.toStringAsFixed(5)}, ${_gpsLng!.toStringAsFixed(5)}'
                : 'Belum ada posisi',
            Colors.white70,
          ),
          const SizedBox(height: 6),
          _infoRow('Topik MQTT', MqttGpsService.topic, Colors.white38),
          _infoRow('Broker', '${MqttGpsService.brokerHost}:${MqttGpsService.brokerPort}',
              Colors.white38),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value, Color valueColor) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.white54, fontSize: 11)),
        Text(value,
            style: TextStyle(
                color: valueColor, fontSize: 11, fontWeight: FontWeight.bold)),
      ],
    );
  }

  // ─── Control Buttons ─────────────────────────────────────────────────────────

  Widget _buildControlButtons() {
    return Row(
      children: [
        Expanded(
          child: _ctrlBtn(
            icon: Icons.play_arrow_rounded,
            label: 'Mulai',
            color: const Color(0xFF06D6A0),
            onTap: _isRecording ? null : _startPolar,
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _ctrlBtn(
            icon: Icons.stop_rounded,
            label: 'Stop',
            color: Colors.red.shade400,
            onTap: _isRecording ? _stopPolar : null,
          ),
        ),
      ],
    );
  }

  Widget _ctrlBtn({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback? onTap,
  }) {
    final active = onTap != null;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: active ? color : Colors.white12,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: active ? Colors.white : Colors.white30, size: 20),
            const SizedBox(width: 6),
            Text(label,
                style: TextStyle(
                    color: active ? Colors.white : Colors.white30,
                    fontWeight: FontWeight.bold,
                    fontSize: 14)),
          ],
        ),
      ),
    );
  }
}

// ─── Data Model ───────────────────────────────────────────────────────────────

class _LiveItem {
  final String label;
  final String value;
  final String unit;
  final Color color;
  final IconData icon;

  const _LiveItem(this.label, this.value, this.unit, this.color, this.icon);
}

// ─── Sparkline Painter ────────────────────────────────────────────────────────

class _SparklinePainter extends CustomPainter {
  final List<double> data;
  final Color color;

  _SparklinePainter(this.data, this.color);

  @override
  void paint(Canvas canvas, Size size) {
    if (data.length < 2) return;

    final min = data.reduce((a, b) => a < b ? a : b);
    final max = data.reduce((a, b) => a > b ? a : b);
    final range = (max - min).abs();
    final safeRange = range < 0.001 ? 1.0 : range;

    final paint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke
      ..strokeJoin = StrokeJoin.round
      ..strokeCap = StrokeCap.round;

    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [color.withOpacity(0.35), color.withOpacity(0.0)],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height))
      ..style = PaintingStyle.fill;

    final path = Path();
    final fillPath = Path();

    for (int i = 0; i < data.length; i++) {
      final x = (i / (data.length - 1)) * size.width;
      final y = size.height - ((data[i] - min) / safeRange) * size.height;
      if (i == 0) {
        path.moveTo(x, y);
        fillPath.moveTo(x, size.height);
        fillPath.lineTo(x, y);
      } else {
        path.lineTo(x, y);
        fillPath.lineTo(x, y);
      }
    }

    fillPath.lineTo(size.width, size.height);
    fillPath.close();

    canvas.drawPath(fillPath, fillPaint);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(_SparklinePainter oldDelegate) =>
      oldDelegate.data != data || oldDelegate.color != color;
}
