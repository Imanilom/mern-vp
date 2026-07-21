import 'package:flutter/material.dart';
import '../api_service.dart';
import '../auth_service.dart';
import 'package:intl/intl.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({Key? key}) : super(key: key);

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  bool _isLoading = true;
  List<dynamic> _events = [];

  @override
  void initState() {
    super.initState();
    _loadEvents();
  }

  Future<void> _loadEvents() async {
    final userId = await AuthService.getUserId();
    if (userId != null && userId.isNotEmpty) {
      final events = await ApiService.getEvents(userId);
      if (mounted) {
        setState(() {
          _events = events;
          _isLoading = false;
        });
      }
    } else {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _formatTime(dynamic timestamp) {
    if (timestamp == null) return '';
    final date = DateTime.fromMillisecondsSinceEpoch(timestamp);
    return DateFormat('HH:mm').format(date);
  }

  @override
  Widget build(BuildContext context) {
    // Cari peringatan terbaru (event dengan classification == 'Alert' atau 'Deviation')
    final alertEvent = _events.firstWhere(
      (e) => e['classification'] == 'Alert' || e['classification'] == 'Deviation',
      orElse: () => null,
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F6),
      appBar: AppBar(
        backgroundColor: const Color(0xFF073B4C),
        title: const Text('Riwayat & Peringatan', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        elevation: 0,
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator(color: Color(0xFF073B4C)))
        : SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Peringatan Terakhir (Alert)
                if (alertEvent != null)
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: alertEvent['classification'] == 'Alert' ? Colors.red.shade50 : Colors.orange.shade50,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: alertEvent['classification'] == 'Alert' ? Colors.red.shade200 : Colors.orange.shade200),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.warning_amber_rounded, color: alertEvent['classification'] == 'Alert' ? Colors.red : Colors.orange, size: 28),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                'Perubahan Trajectory Terdeteksi',
                                style: TextStyle(color: alertEvent['classification'] == 'Alert' ? Colors.red : Colors.orange, fontWeight: FontWeight.bold, fontSize: 16),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Terjadi ${alertEvent['classification']} pada aktivitas ${alertEvent['activity'] ?? 'tidak diketahui'}.',
                          style: const TextStyle(fontSize: 12, color: Colors.black87),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            _buildAlertMetric('Magnitude', '${(alertEvent['peak_score'] ?? 0.0).toStringAsFixed(1)} SD'),
                            const SizedBox(width: 16),
                            _buildAlertMetric('Durasi', '${alertEvent['duration_minutes'] ?? 0} mnt'),
                            const SizedBox(width: 16),
                            _buildAlertMetric('Status', alertEvent['review_status'] ?? 'New'),
                          ],
                        ),
                      ],
                    ),
                  ),
                if (alertEvent != null) const SizedBox(height: 32),

                // Timeline
                const Text('Timeline', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF073B4C))),
                const SizedBox(height: 16),
                _events.isEmpty 
                  ? const Center(child: Padding(
                      padding: EdgeInsets.all(20.0),
                      child: Text('Belum ada riwayat tercatat.', style: TextStyle(color: Colors.grey)),
                    ))
                  : Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Column(
                        children: List.generate(_events.length, (index) {
                          final e = _events[index];
                          final isLast = index == _events.length - 1;
                          
                          Color iconColor = Colors.green;
                          IconData icon = Icons.info_outline;
                          
                          if (e['classification'] == 'Alert') {
                            iconColor = Colors.red;
                            icon = Icons.warning;
                          } else if (e['classification'] == 'Deviation') {
                            iconColor = Colors.orange;
                            icon = Icons.trending_up;
                          }

                          return _buildTimelineItem(
                            _formatTime(e['onset_time']), 
                            '${e['classification']} - ${e['activity'] ?? ''}', 
                            icon, 
                            iconColor, 
                            isLast: isLast
                          );
                        }),
                      ),
                    ),
              ],
            ),
          ),
    );
  }

  Widget _buildAlertMetric(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.bold)),
        Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildTimelineItem(String time, String title, IconData icon, Color color, {bool isLast = false}) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Column(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(color: color.withOpacity(0.1), shape: BoxShape.circle),
              child: Icon(icon, size: 16, color: color),
            ),
            if (!isLast)
              Container(
                width: 2,
                height: 30,
                color: Colors.grey.shade200,
              ),
          ],
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.only(top: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.black87)),
                Text(time, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey)),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
