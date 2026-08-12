import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';
import '../screens/ema/ema_dialogs.dart';

class SocketService {
  static IO.Socket? _socket;
  static Function(Map<String, dynamic>)? onStateUpdated;
  static BuildContext? _appContext;

  static void init(BuildContext context) async {
    _appContext = context;
    if (_socket != null && _socket!.connected) return;
    
    final prefs = await SharedPreferences.getInstance();
    final userId = prefs.getString('user_id');

    // Connect to the backend
    _socket = IO.io(ApiService.baseUrl.replaceAll('/api', ''), IO.OptionBuilder()
      .setTransports(['websocket'])
      .disableAutoConnect()
      .build()
    );

    _socket?.connect();

    _socket?.onConnect((_) {
      print('Socket connected');
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

    // Listen for RMQ Mobile Notifications forwarded by Socket.io
    _socket?.on('notification', (data) {
      print('Received notification: $data');
      if (_appContext != null) {
        _showNotificationDialog(data);
      }
    });

    _socket?.onDisconnect((_) => print('Socket disconnected'));
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
            child: const Text('Mengerti', style: const TextStyle(color: Colors.teal)),
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
