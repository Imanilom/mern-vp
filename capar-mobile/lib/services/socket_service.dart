import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'api_service.dart';

class SocketService {
  static IO.Socket? _socket;
  static Function(Map<String, dynamic>)? onStateUpdated;

  static void init() {
    if (_socket != null) return;
    
    // Connect to the backend
    _socket = IO.io(ApiService.baseUrl.replaceAll('/api', ''), IO.OptionBuilder()
      .setTransports(['websocket'])
      .disableAutoConnect()
      .build()
    );

    _socket?.connect();

    _socket?.onConnect((_) {
      print('Socket connected');
    });

    // Listen for new sensor data broadcasted by the backend
    _socket?.on('new_sensor_data', (data) {
      if (onStateUpdated != null) {
        onStateUpdated!(data);
      }
    });

    _socket?.onDisconnect((_) => print('Socket disconnected'));
  }

  static void dispose() {
    _socket?.disconnect();
    _socket = null;
  }
}
