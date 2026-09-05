import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';
import '../screens/ema/ema_dialogs.dart';

class SocketService {
  static io.Socket? _socket;
  static Function(Map<String, dynamic>)? onStateUpdated;
  static BuildContext? _appContext;

  static void init(BuildContext context) async {
    _appContext = context;
    if (_socket != null && _socket!.connected) return;
    
    final prefs = await SharedPreferences.getInstance();
    final userId = prefs.getString('user_id');

    // Connect to the backend
    _socket = io.io(ApiService.baseUrl.replaceAll('/api', ''), io.OptionBuilder()
      .setTransports(['websocket'])
      .disableAutoConnect()
      .build()
    );

    _socket?.connect();

    _socket?.onConnect((_) {
      debugPrint('Socket connected');
      if (userId != null) {
        _socket?.emit('join_room', 'user_$userId');
      }
    });

    // Listen for new sensor data broadcasted by the backend
    _socket?.on('new_sensor_data', (data) {
      if (onStateUpdated != null) {
        onStateUpdated!(data);
      }
    });

    // Listen for real-time Anomaly Deviation Alert from backend
    _socket?.on('ANOMALY_DEVIATION_ALERT', (data) {
      debugPrint('[SocketService] Received ANOMALY_DEVIATION_ALERT: $data');
      if (_appContext != null) {
        _showDeviationAlertBanner(data);
      }
    });

    // Listen for RMQ Mobile Notifications forwarded by Socket.io
    _socket?.on('notification', (data) {
      debugPrint('Received notification: $data');
      if (_appContext != null) {
        _showNotificationDialog(data);
      }
    });

    _socket?.onDisconnect((_) => debugPrint('Socket disconnected'));
  }

  static void _showDeviationAlertBanner(dynamic data) {
    if (_appContext == null) return;
    final act = data['activity'] ?? 'Aktivitas';
    final score = data['score'] != null ? NumberFormatFixed(data['score']) : 'Deviasi';
    final isRelapse = data['relapse'] == true;

    ScaffoldMessenger.of(_appContext!).hideCurrentSnackBar();
    ScaffoldMessenger.of(_appContext!).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        backgroundColor: isRelapse ? const Color(0xFFDC2626) : const Color(0xFFD97706),
        duration: const Duration(seconds: 8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        content: Row(
          children: [
            const Icon(Icons.warning_rounded, color: Colors.white, size: 24),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isRelapse ? '⚠ RELAPSE DEVASI TERDETEKSI' : '⚡ DEVIASI OTONOM BARU',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Colors.white),
                  ),
                  Text(
                    '$act • Score: $score • Konfirmasi tidur & obat',
                    style: const TextStyle(fontSize: 11, color: Colors.white70),
                  ),
                ],
              ),
            ),
          ],
        ),
        action: SnackBarAction(
          label: 'ISI EMA 1',
          textColor: Colors.white,
          onPressed: () {
            EmaDialogs.showEma1(_appContext!);
          },
        ),
      ),
    );
  }

  static String NumberFormatFixed(dynamic val) {
    if (val is num) return val.toStringAsFixed(2);
    return val.toString();
  }

  static void _showNotificationDialog(dynamic data) {
    if (_appContext == null) return;
    
    final String type = data['type'] ?? 'NOTIFICATION';
    final String message = data['message'] ?? 'Ada pemberitahuan baru.';
    
    IconData iconData = Icons.info_outline;
    Color iconColor = Colors.blue;
    String title = 'Pemberitahuan';

    if (type == 'ANNOTATION_REQUIRED') {
      EmaDialogs.showEma1(_appContext!);
      return;
    } else if (type == 'QUALITY_WARNING') {
      iconData = Icons.warning_amber_rounded;
      iconColor = Colors.redAccent;
      title = 'Peringatan Kualitas Sensor';
    }

    showDialog(
      context: _appContext!,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            Icon(iconData, color: iconColor),
            const SizedBox(width: 8),
            Expanded(child: Text(title, style: const TextStyle(fontSize: 16))),
          ],
        ),
        content: Text(message, style: const TextStyle(fontSize: 14)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Mengerti', style: TextStyle(color: Colors.teal)),
          )
        ],
      ),
    );
  }

  static void dispose() {
    _socket?.disconnect();
    _socket = null;
  }
}
