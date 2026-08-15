import 'package:flutter/material.dart';
import 'dart:async';
import '../api_service.dart';
import '../auth_service.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({Key? key}) : super(key: key);

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _username = 'P001';
  String _userId = '';
  Timer? _timer;

  // Real-time data
  Map<String, dynamic>? _liveSegment;
  List<double> _hrHistory = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadUserAndData();
  }

  Future<void> _loadUserAndData() async {
    final username = await AuthService.getUsername() ?? 'P001';
    final userId = await AuthService.getUserId() ?? '';
    
    setState(() {
      _username = username.split('@').first;
      _userId = userId;
    });

    if (_userId.isNotEmpty) {
      await _fetchData();
      // Poll every 5 seconds
      _timer = Timer.periodic(const Duration(seconds: 5), (_) => _fetchData());
    } else {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _fetchData() async {
    if (_userId.isEmpty) return;
    try {
      final segments = await ApiService.getSegments(_userId, limit: 15);
      if (segments.isNotEmpty && mounted) {
        setState(() {
          _liveSegment = segments.first;
          // Fix: use (num).toDouble() to safely handle int or double from JSON
          _hrHistory = segments
              .map((s) => ((s['features']?['mean_hr'] ?? 0) as num).toDouble())
              .toList()
              .reversed
              .toList();
          _isLoading = false;
        });
      } else if (mounted) {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      print('[HomeScreen] Error fetching data: $e');
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Color(0xFFF4F7F6),
        body: Center(child: CircularProgressIndicator(color: Color(0xFF073B4C))),
      );
    }

    final hrValue = _liveSegment?['features']?['mean_hr']?.round()?.toString() ?? '0';
    final rrValue = _liveSegment?['features']?['mean_rr']?.round()?.toString() ?? '0';
    final rrmsValue = _liveSegment?['features']?['rmssd']?.round()?.toString() ?? '0';
    final dfaValue = _liveSegment?['features']?['dfa_alpha1']?.toStringAsFixed(2) ?? '0.00';
    final activity = _liveSegment?['activity_label'] ?? 'Duduk';
    final status = _liveSegment?['classification'] ?? 'Stabil';

    Color statusColor = const Color(0xFF07AC7B); // Green
    if (status.toLowerCase().contains('alert')) statusColor = Colors.red;
    if (status.toLowerCase().contains('deviation')) statusColor = Colors.orange;

    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F6),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Text(
                'Selamat pagi, $_username',
                style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Color(0xFF073B4C)),
              ),
              const SizedBox(height: 4),
              const Text(
                'Monitoring aktif',
                style: TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 24),

              // Kondisi Saat Ini (Status Kesehatan)
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: statusColor,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(color: statusColor.withOpacity(0.3), blurRadius: 15, offset: const Offset(0, 8)),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: Colors.white.withOpacity(0.2), shape: BoxShape.circle),
                      child: Icon(
                        status.toLowerCase().contains('alert') ? Icons.warning : Icons.check_circle, 
                        color: Colors.white, size: 32
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Kondisi Saat Ini', style: TextStyle(color: Colors.white70, fontSize: 12)),
                          Text(status.toUpperCase(), style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900, letterSpacing: 1)),
                          const SizedBox(height: 4),
                          const Text('Data real-time disinkronkan', style: TextStyle(color: Colors.white, fontSize: 11)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Feature Monitoring Grid
              const Text('Data Sensor', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF073B4C))),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                childAspectRatio: 1.8,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                children: [
                  _buildMetricCard('Heart Rate', hrValue, 'BPM', Icons.monitor_heart, Colors.red),
                  _buildMetricCard('RR Interval', rrValue, 'ms', Icons.waves, Colors.blue),
                  _buildMetricCard('RMSSD', rrmsValue, 'ms', Icons.analytics, Colors.purple),
                  _buildMetricCard('DFA Alpha-1', dfaValue, '', Icons.show_chart, Colors.orange),
                  _buildMetricCard('Aktivitas', activity, '', Icons.directions_run, Colors.teal),
                  _buildMetricCard('Kualitas Sinyal', '96', '%', Icons.signal_cellular_alt, Colors.green),
                ],
              ),
              const SizedBox(height: 24),

              // Trajectory Mini Graph
              const Text('Trajectory Hari Ini', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF073B4C))),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Status saat ini: $status', style: const TextStyle(fontSize: 12, color: Colors.grey, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 16),
                    SizedBox(
                      height: 80,
                      width: double.infinity,
                      child: CustomPaint(
                        painter: _MockChartPainter(data: _hrHistory),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Sebelumnya', style: TextStyle(fontSize: 10, color: Colors.grey)),
                        Text('Sekarang', style: TextStyle(fontSize: 10, color: Colors.grey)),
                      ],
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

  Widget _buildMetricCard(String title, String value, String unit, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(title, style: const TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.bold)),
                RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(text: value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF073B4C))),
                      if (unit.isNotEmpty) TextSpan(text: ' $unit', style: const TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.bold)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MockChartPainter extends CustomPainter {
  final List<double> data;
  _MockChartPainter({required this.data});

  @override
  void paint(Canvas canvas, Size size) {
    if (data.isEmpty) return;

    final paint = Paint()
      ..color = const Color(0xFF3B82F6)
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [const Color(0xFF3B82F6).withOpacity(0.3), Colors.transparent],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height))
      ..style = PaintingStyle.fill;

    double maxVal = data.reduce((curr, next) => curr > next ? curr : next);
    double minVal = data.reduce((curr, next) => curr < next ? curr : next);
    if (maxVal == minVal) {
      maxVal += 10;
      minVal -= 10;
    }

    final path = Path();
    for (int i = 0; i < data.length; i++) {
      double x = (i / (data.length - 1)) * size.width;
      double y = size.height - (((data[i] - minVal) / (maxVal - minVal)) * size.height);
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }

    final fillPath = Path.from(path);
    fillPath.lineTo(size.width, size.height);
    fillPath.lineTo(0, size.height);
    fillPath.close();

    canvas.drawPath(fillPath, fillPaint);
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _MockChartPainter oldDelegate) => true;
}
