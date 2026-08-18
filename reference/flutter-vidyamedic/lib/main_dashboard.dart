import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:polar/polar.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:path_provider/path_provider.dart';
import 'package:file_picker/file_picker.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:csv/csv.dart';
import 'package:http/http.dart' as http;
import 'package:vidyamedic/background_service.dart';
import 'env_config.dart';
import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'login_page.dart';
import 'health_questionnaire.dart';
import 'auth_service.dart';
import 'mqtt_gps_service.dart';

enum DataType { hr, rr, ecg, acc }

class SensorData {
  final DataType type;
  final double value;
  final DateTime timestamp;
  final Map<String, dynamic> additionalData;

  SensorData({
    required this.type,
    required this.value,
    required this.timestamp,
    this.additionalData = const {},
  });
}

class CsvHelper {
  static final CsvHelper _instance = CsvHelper._internal();
  factory CsvHelper() => _instance;
  CsvHelper._internal();

  String? _csvFolderPath;
  String? _csvFilePath;
  
  CombinedRowData? _currentRow;
  Timer? _csvWriteTimer;
  String? _currentDeviceId;
  String? _currentActivity;

  Future<SharedPreferences> _getPrefs() async {
    return await SharedPreferences.getInstance();
  }

  Future<void> saveActivities(List<String> activities) async {
    final prefs = await _getPrefs();
    prefs.setStringList('user_activities', activities);
  }

  Future<List<String>> loadActivities() async {
    final prefs = await _getPrefs();
    return prefs.getStringList('user_activities') ??
        [
          // Istirahat
          'Tidur',
          'Berbaring',
          'Duduk',
          'Berdiri',
          // Mobilitas ringan
          'Berjalan',
          'Berjalan Cepat',
          'Naik Tangga',
          // Olahraga sedang
          'Bersepeda',
          'Berenang',
          'Senam',
          'Yoga',
          // Olahraga berat
          'Berlari',
          'Lari Cepat',
          'Olahraga Berat',
          // Aktivitas harian
          'Makan',
          'Memasak',
          'Berkendara',
          'Bekerja',
          // Fallback
          'Lainnya',
        ];
  }

  void setCurrentActivity(String? activity) {
    _currentActivity = activity;
  }

  String? getCurrentActivity() {
    return _currentActivity;
  }

  Future<String> get csvFolderPath async {
    if (_csvFolderPath != null) return _csvFolderPath!;
    final directory = await getApplicationDocumentsDirectory();
    _csvFolderPath = '${directory.path}/PolarData';
    final folder = Directory(_csvFolderPath!);
    if (!await folder.exists()) {
      await folder.create(recursive: true);
    }
    return _csvFolderPath!;
  }

  Future<void> setCustomFolder() async {
    try {
      String? selectedDirectory = await FilePicker.getDirectoryPath();
      if (selectedDirectory != null) {
        _csvFolderPath = '$selectedDirectory/PolarData';
        final folder = Directory(_csvFolderPath!);
        if (!await folder.exists()) {
          await folder.create(recursive: true);
        }
        _csvFilePath = null;
      }
    } catch (e) {
      print('Error selecting directory: $e');
    }
  }

  Future<String> get csvFilePath async {
    if (_csvFilePath != null) return _csvFilePath!;
    final folderPath = await csvFolderPath;
    final now = DateTime.now();
    final dateString = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
    _csvFilePath = '$folderPath/polar_data_$dateString.csv';

    final file = File(_csvFilePath!);
    if (!await file.exists()) {
      await _createCsvWithHeaders();
    }
    return _csvFilePath!;
  }

  Future<void> _createCsvWithHeaders() async {
    final file = File(await csvFilePath);
    const headers = [
      'user_id',   // wajib: MongoDB ObjectId user
      'timestamp', 
      'date_created', 
      'time_created', 
      'hr', 
      'rr', 
      'rrms', 
      'acc_x', 
      'acc_y', 
      'acc_z', 
      'ecg', 
      'device_id', 
      'activity',
      'latitude',
      'longitude',
      'is_sent',
      'sent_at'
    ];
    final csvData = CsvEncoder().convert([headers]);
    await file.writeAsString(csvData);
  }

  void startPeriodicWriting(String deviceId) {
    _currentDeviceId = deviceId;
    _csvWriteTimer?.cancel();
    
    // Start GPS tracking and connect to MQTT/RabbitMQ in foreground
    MqttGpsService().startGpsTracking();
    MqttGpsService().connectMqtt();

    _csvWriteTimer = Timer.periodic(Duration(seconds: 1), (timer) {
      _writeCurrentRowToCSV();
    });
  }

  void stopPeriodicWriting() {
    _csvWriteTimer?.cancel();
    _csvWriteTimer = null;
    _currentRow = null;
    
    // Stop GPS tracking and disconnect MQTT
    MqttGpsService().stopGpsTracking();
    MqttGpsService().disconnectMqtt();
  }

  Future<void> appendSensorData(SensorData data) async {
    if (_currentDeviceId == null) return;
    
    if (_currentRow == null || 
        DateTime.now().difference(_currentRow!.timestamp).inSeconds >= 1) {
      _currentRow = CombinedRowData(
        timestamp: DateTime.now(),
        deviceId: _currentDeviceId!,
        activity: _currentActivity ?? 'Duduk', // Default activity
      );
    }

    switch (data.type) {
      case DataType.hr:
        _currentRow!.hr = data.value;
        break;
      case DataType.rr:
        _currentRow!.rr = data.value;
        _updateRRMS(data.value);
        break;
      case DataType.ecg:
        _currentRow!.ecg = data.value;
        break;
      case DataType.acc:
        _currentRow!.accX = data.additionalData['x']?.toDouble();
        _currentRow!.accY = data.additionalData['y']?.toDouble();
        _currentRow!.accZ = data.additionalData['z']?.toDouble();
        break;
    }
  }

  List<double> _rrIntervals = [];
  
  void _updateRRMS(double rrValue) {
    if (rrValue > 0 && rrValue < 2000) {
      _rrIntervals.add(rrValue);
      
      if (_rrIntervals.length > 30) {
        _rrIntervals.removeAt(0);
      }
      
      if (_rrIntervals.length >= 2) {
        double sumSquaredDifferences = 0;
        int validDifferences = 0;
        
        for (int i = 1; i < _rrIntervals.length; i++) {
          double difference = _rrIntervals[i] - _rrIntervals[i-1];
          if (difference.abs() < 300) {
            sumSquaredDifferences += difference * difference;
            validDifferences++;
          }
        }
        
        if (validDifferences > 0) {
          double rrms = sqrt(sumSquaredDifferences / validDifferences);
          _currentRow?.rrms = double.parse(rrms.toStringAsFixed(2));
        } else {
          _currentRow?.rrms = 0.0;
        }
      } else {
        _currentRow?.rrms = 0.0;
      }
    }
  }

  Future<void> _writeCurrentRowToCSV() async {
    if (_currentRow == null) return;

    // Ambil userId dari session
    final prefs = await _getPrefs();
    final userId = prefs.getString('userId') ?? '';

    if (userId.isEmpty) {
      print('[CsvHelper] userId kosong, skip write — pastikan user sudah login');
      return;
    }

    // 1. Get GPS coordinates
    final lastGps = MqttGpsService().lastKnownPosition;
    _currentRow!.latitude = lastGps?.latitude;
    _currentRow!.longitude = lastGps?.longitude;

    // 2. Try publishing via MQTT/RabbitMQ
    final payload = _currentRow!.toJson(userId);
    final isPublished = await MqttGpsService().publishTelemetry(payload);
    
    if (isPublished) {
      _currentRow!.isSent = 1;
      _currentRow!.sentAt = DateTime.now().toIso8601String();
    } else {
      _currentRow!.isSent = 0;
      _currentRow!.sentAt = '';
    }

    final file = File(await csvFilePath);
    final newRow = _currentRow!.toCsvRow(userId);
    final csvConverter = CsvEncoder();
    final newRowCsv = csvConverter.convert([newRow]);

    await file.writeAsString(
      '$newRowCsv\n',
      mode: FileMode.append,
      flush: true,
    );

    // Reset untuk row berikutnya
    _currentRow = CombinedRowData(
      timestamp: DateTime.now(),
      deviceId: _currentDeviceId!,
      activity: _currentActivity ?? 'Duduk',
    );
  }

  // Method untuk mengirim CSV ke server
  Future<void> uploadCsvToServer() async {
    try {
      // Verifikasi userId sebelum upload
      final prefs = await _getPrefs();
      final userId = prefs.getString('userId') ?? '';
      if (userId.isEmpty) {
        print('[CsvHelper] userId kosong, upload dibatalkan — user harus login dahulu');
        return;
      }

      final csvFile = await getCsvFile();
      if (!await csvFile.exists()) {
        print('CSV file does not exist');
        return;
      }

      // Kirim sebagai multipart file ke /api/log/logs
      // API membaca kolom user_id dari dalam CSV
      var request = http.MultipartRequest(
        'POST', 
        Uri.parse(EnvConfig.uploadUrl),
      );
      request.headers['ngrok-skip-browser-warning'] = 'true';
      
      request.files.add(
        await http.MultipartFile.fromPath(
          'file',
          csvFile.path,
          filename: 'polar_data_${DateTime.now().millisecondsSinceEpoch}.csv',
        ),
      );

      print('Uploading CSV for user $userId...');
      final streamedResponse = await request.send().timeout(Duration(seconds: 60));
      final response = await http.Response.fromStream(streamedResponse);
      
      if (response.statusCode == 200 || response.statusCode == 201) {
        print('CSV uploaded successfully: ${response.body}');
      } else {
        print('Failed to upload CSV: ${response.statusCode} — ${response.body}');
      }
    } catch (e) {
      print('Error uploading CSV: $e');
    }
  }

  // Method lainnya tetap sama...
  Future<List<SensorData>> getAllSensorData({DataType? filterType, int? limit}) async {
    final file = File(await csvFilePath);
    if (!await file.exists()) {
      return [];
    }
    final csvContent = await file.readAsString();
    if (csvContent.trim().isEmpty) {
      return [];
    }
    
    final csvConverter = CsvDecoder();
    final rows = csvConverter.convert(csvContent);
    final dataRows = rows.skip(1).toList();
    
    List<SensorData> sensorDataList = [];
    
    // Kolom CSV setelah user_id ditambahkan:
    // 0: user_id, 1: timestamp, 2: date_created, 3: time_created,
    // 4: hr, 5: rr, 6: rrms, 7: acc_x, 8: acc_y, 9: acc_z, 10: ecg, 11: device_id, 12: activity
    for (var row in dataRows) {
      try {
        if (row.length < 13) continue; // Butuh minimal 13 kolom
        final timestamp = DateTime.fromMillisecondsSinceEpoch(int.parse(row[1].toString()) * 1000);
        
        if (filterType == null || filterType == DataType.hr) {
          if (row[4].toString().isNotEmpty) { // hr di index 4
            sensorDataList.add(SensorData(
              type: DataType.hr,
              value: double.parse(row[4].toString()),
              timestamp: timestamp,
            ));
          }
        }
        
        if (filterType == null || filterType == DataType.rr) {
          if (row[5].toString().isNotEmpty) { // rr di index 5
            sensorDataList.add(SensorData(
              type: DataType.rr,
              value: double.parse(row[5].toString()),
              timestamp: timestamp,
            ));
          }
        }
        
        if (filterType == null || filterType == DataType.ecg) {
          if (row[10].toString().isNotEmpty) { // ecg di index 10
            sensorDataList.add(SensorData(
              type: DataType.ecg,
              value: double.parse(row[10].toString()),
              timestamp: timestamp,
            ));
          }
        }
        
        if (filterType == null || filterType == DataType.acc) {
          if (row[7].toString().isNotEmpty && row[8].toString().isNotEmpty && row[9].toString().isNotEmpty) {
            final x = double.parse(row[7].toString()); // acc_x di index 7
            final y = double.parse(row[8].toString()); // acc_y di index 8
            final z = double.parse(row[9].toString()); // acc_z di index 9
            final magnitude = sqrt(x * x + y * y + z * z);
            
            sensorDataList.add(SensorData(
              type: DataType.acc,
              value: magnitude,
              timestamp: timestamp,
              additionalData: {'x': x, 'y': y, 'z': z},
            ));
          }
        }
      } catch (e) {
        print('Error parsing row: $row, Error: $e');
      }
    }
    
    if (filterType != null) {
      sensorDataList = sensorDataList.where((data) => data.type == filterType).toList();
    }
    
    sensorDataList.sort((a, b) => b.timestamp.compareTo(a.timestamp));
    if (limit != null) {
      sensorDataList = sensorDataList.take(limit).toList();
    }
    
    return sensorDataList;
  }

  Future<void> clearAllData() async {
    final file = File(await csvFilePath);
    if (await file.exists()) {
      await file.delete();
    }
    await _createCsvWithHeaders();
    _currentRow = null;
    _rrIntervals.clear();
  }

  Future<File> getCsvFile() async {
    return File(await csvFilePath);
  }

  Future<String> getDataCount() async {
    final file = File(await csvFilePath);
    if (!await file.exists()) return '0';
    
    final csvContent = await file.readAsString();
    if (csvContent.trim().isEmpty) return '0';
    
    final csvConverter = CsvDecoder();
    final rows = csvConverter.convert(csvContent);
    return (rows.length - 1).toString();
  }

  String get currentFolderPath => _csvFolderPath ?? 'Not set';
}

// CLASS CombinedRowData YANG DIPERBAIKI
class CombinedRowData {
  final DateTime timestamp;
  final String deviceId;
  final String? activity;
  
  double? hr;
  double? rr;
  double? rrms;
  double? accX;
  double? accY;
  double? accZ;
  double? ecg;
  
  double? latitude;
  double? longitude;
  int isSent;
  String? sentAt;

  CombinedRowData({
    required this.timestamp,
    required this.deviceId,
    this.activity,
    this.hr,
    this.rr,
    this.rrms,
    this.accX,
    this.accY,
    this.accZ,
    this.ecg,
    this.latitude,
    this.longitude,
    this.isSent = 0,
    this.sentAt = '',
  });

  List<String> toCsvRow(String userId) {
    final now = DateTime.now();
    String fmt(double? v) => v != null ? v.toStringAsFixed(2) : '';
    String fmtAcc(double? v) => v != null ? v.toStringAsFixed(6) : '';
    String fmtGps(double? v) => v != null ? v.toStringAsFixed(8) : '';
    
    return [
      userId, // user_id — wajib untuk PolarData model
      (timestamp.millisecondsSinceEpoch ~/ 1000).toString(), // timestamp (Unix)
      '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}', // date_created
      '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}:${now.second.toString().padLeft(2, '0')}', // time_created
      fmt(hr), // hr
      fmt(rr), // rr
      fmt(rrms) ?? '0.0', // rrms
      fmtAcc(accX), // acc_x
      fmtAcc(accY), // acc_y
      fmtAcc(accZ), // acc_z
      fmt(ecg), // ecg
      deviceId, // device_id
      activity ?? 'Duduk', // activity
      fmtGps(latitude), // latitude
      fmtGps(longitude), // longitude
      isSent.toString(), // is_sent
      sentAt ?? '', // sent_at
    ];
  }

  Map<String, dynamic> toJson(String userId) {
    final now = DateTime.now();
    return {
      'user_id': userId, // wajib untuk PolarData model
      'timestamp': timestamp.millisecondsSinceEpoch ~/ 1000,
      'date_created': '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}',
      'time_created': '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}:${now.second.toString().padLeft(2, '0')}',
      'hr': hr,
      'rr': rr,
      'rrms': rrms ?? 0.0,
      'acc_x': accX,
      'acc_y': accY,
      'acc_z': accZ,
      'ecg': ecg,
      'device_id': deviceId,
      'activity': activity ?? 'Duduk',
      'latitude': latitude,
      'longitude': longitude,
      'is_sent': isSent,
      'sent_at': sentAt ?? '',
    };
  }
}

class PolarEnhancedMonitor extends StatefulWidget {
  @override
  _PolarEnhancedMonitorState createState() => _PolarEnhancedMonitorState();
}

class _PolarEnhancedMonitorState extends State<PolarEnhancedMonitor> with TickerProviderStateMixin {
  final Polar polar = Polar();
  String? connectedDeviceId;
  Map<DataType, double> currentValues = {
    DataType.hr: 0,
    DataType.rr: 0,
    DataType.ecg: 0,
    DataType.acc: 0,
  };
  bool isConnected = false;
  bool isConnecting = false;
  Map<DataType, bool> isStreaming = {
    DataType.hr: false,
    DataType.rr: false,
    DataType.ecg: false,
    DataType.acc: false,
  };
  final BackgroundServiceHelper _backgroundHelper = BackgroundServiceHelper();
  bool _isBackgroundRecording = false;

  List<String> discoveredDevices = [];
  Map<DataType, List<SensorData>> sensorHistory = {
    DataType.hr: [],
    DataType.rr: [],
    DataType.ecg: [],
    DataType.acc: [],
  };
  String totalDataCount = '0';

  StreamSubscription<PolarHrData>? hrStreamSubscription;
  StreamSubscription<PolarEcgData>? ecgStreamSubscription;
  StreamSubscription<PolarAccData>? accStreamSubscription;
  StreamSubscription<dynamic>? deviceConnectedSubscription;
  StreamSubscription<dynamic>? deviceDisconnectedSubscription;
  StreamSubscription<dynamic>? sdkFeatureReadySubscription;
  StreamSubscription<PolarDeviceInfo>? searchSubscription;

  final CsvHelper _csvHelper = CsvHelper();
  final TextEditingController _deviceIdController = TextEditingController();

  late TabController _tabController;

  String? selectedActivity;
  List<String> availableActivities = [];
  TextEditingController _newActivityController = TextEditingController();

  Map<DataType, List<FlSpot>> chartData = {
    DataType.hr: [],
    DataType.rr: [],
    DataType.ecg: [],
    DataType.acc: [],
  };

  // MQTT & GPS status variables
  bool _mqttConnected = false;
  String? _mqttLastSent;
  int _mqttPendingCount = 0;
  double? _gpsLat;
  double? _gpsLng;
  Timer? _statusPollTimer;

  Future<void> _loadMqttGpsStatus() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.reload(); // Refresh isolate cache
      setState(() {
        _mqttConnected = prefs.getBool('mqtt_connected') ?? false;
        _mqttLastSent = prefs.getString('mqtt_last_sent');
        _mqttPendingCount = prefs.getInt('mqtt_pending_count') ?? 0;
        _gpsLat = prefs.getDouble('gps_latitude');
        _gpsLng = prefs.getDouble('gps_longitude');
      });
    } catch (e) {
      debugPrint('Error loading MQTT/GPS status: $e');
    }
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 6, vsync: this);
    _requestPermissions();
    _loadSensorHistory();
    _loadActivities();
    _initializePolarSDK();
    _checkBackgroundRecordingStatus(); 
    _initializeBackgroundService(); 
    
    // Poll MQTT status every 3 seconds to keep UI updated
    _loadMqttGpsStatus();
    _statusPollTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
      _loadMqttGpsStatus();
    });
  }

  Future<void> _initializeBackgroundService() async {
    await _backgroundHelper.initializeService();
  }

  Future<void> _checkBackgroundRecordingStatus() async {
    final isRecording = await _backgroundHelper.isBackgroundRecording();
    if (isRecording) {
      final deviceId = await _backgroundHelper.getBackgroundDeviceId();
      final activity = await _backgroundHelper.getBackgroundActivity();
      
      setState(() {
        _isBackgroundRecording = true;
        connectedDeviceId = deviceId;
        isConnected = deviceId != null;
        selectedActivity = activity;
      });
    }
  }

  Future<void> _startBackgroundRecording() async {
    if (connectedDeviceId == null) {
      _showSnackBar('Please connect to a device first');
      return;
    }

    if (_csvHelper.getCurrentActivity() == null) {
      _showSnackBar("Please select an activity before starting!");
      return;
    }

  
    try {
      await _backgroundHelper.startBackgroundService(
        connectedDeviceId!, 
        _csvHelper.getCurrentActivity()
      );
      setState(() {
        _isBackgroundRecording = true;
      });
      _showSnackBar('Background recording started');
    } catch (e) {
      _showSnackBar('Failed to start background recording: $e');
    }
  }

Future<void> _stopBackgroundRecording() async {
    try {
      await _backgroundHelper.stopBackgroundService();
      setState(() {
        _isBackgroundRecording = false;
      });
      _showSnackBar('Background recording stopped');
    } catch (e) {
      _showSnackBar('Failed to stop background recording: $e');
    }
  }

  Future<void> _uploadDataToServer() async {
    try {
      _showSnackBar('Uploading data to server...');
      await _backgroundHelper.uploadAllData();
      _showSnackBar('Data successfully uploaded to server');
    } catch (e) {
      _showSnackBar('Failed to upload data: $e');
    }
  }


  @override
  void dispose() {
    _statusPollTimer?.cancel();
    _stopAllStreams();
    _disconnectDevice();
     if (_isBackgroundRecording) {
      _backgroundHelper.stopBackgroundService();
    }
    _tabController.dispose();
    super.dispose();
  }

  void _logout() async {
    await AuthService.logout();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (context) => LoginPage()),
    );
  }

  Future<void> _loadActivities() async {
    final activities = await _csvHelper.loadActivities();
    setState(() {
      availableActivities = activities;
      if (selectedActivity == null && activities.isNotEmpty) {
        selectedActivity = activities.first;
        _csvHelper.setCurrentActivity(selectedActivity);
      }
    });
  }

  void _initializePolarSDK() {
    deviceConnectedSubscription = polar.deviceConnected.listen((event) {
      setState(() {
        connectedDeviceId = event.deviceId;
        isConnected = true;
        isConnecting = false;
      });
        _csvHelper.startPeriodicWriting(event.deviceId);
    });

    deviceDisconnectedSubscription = polar.deviceDisconnected.listen((event) {
      setState(() {
        connectedDeviceId = null;
        isConnected = false;
        isConnecting = false;
        isStreaming.updateAll((key, value) => false);
        currentValues.updateAll((key, value) => 0);
      });
        _csvHelper.stopPeriodicWriting();
    });

    sdkFeatureReadySubscription = polar.sdkFeatureReady.listen((event) {
      if (event.feature == PolarSdkFeature.onlineStreaming) {
        Future.delayed(Duration(seconds: 1), () {
          _startAllStreaming();
        });
      }
    });
  }

  Future<void> _requestPermissions() async {
    await Permission.bluetoothConnect.request();
    await Permission.bluetoothScan.request();
    await Permission.location.request();
    await Permission.storage.request();
  }

  Future<void> _loadSensorHistory() async {
    for (DataType type in DataType.values) {
      final data = await _csvHelper.getAllSensorData(filterType: type, limit: 100);
      setState(() {
        sensorHistory[type] = data;
        chartData[type] = _convertToFlSpots(data);
      });
    }
    final count = await _csvHelper.getDataCount();
    setState(() {
      totalDataCount = count;
    });
  }

  List<FlSpot> _convertToFlSpots(List<SensorData> data) {
    if (data.isEmpty) return [];
    final sortedData = data.reversed.toList();
    return sortedData.asMap().entries.map((entry) {
      return FlSpot(entry.key.toDouble(), entry.value.value);
    }).toList();
  }

  Future<void> _searchForDevices() async {
    setState(() {
      discoveredDevices.clear();
    });
    try {
      searchSubscription = polar.searchForDevice().listen((event) {
        if (!discoveredDevices.contains(event.deviceId)) {
          setState(() {
            discoveredDevices.add(event.deviceId);
          });
        }
      });
      Timer(Duration(seconds: 10), () {
        searchSubscription?.cancel();
      });
    } catch (e) {
      debugPrint('Error searching for devices: $e');
      _showSnackBar('Error searching for devices: $e');
    }
  }

  Future<void> _connectToDevice(String deviceId) async {
    setState(() {
      isConnecting = true;
    });
    try {
      await polar.connectToDevice(deviceId);
    } catch (e) {
      debugPrint('Error connecting to device: $e');
      setState(() {
        isConnecting = false;
      });
      _showSnackBar('Error connecting to device: $e');
    }
  }

  Future<void> _connectWithCustomId() async {
    final deviceId = _deviceIdController.text.trim();
    if (deviceId.isNotEmpty) {
      await _connectToDevice(deviceId);
    } else {
      _showSnackBar('Please enter a valid device ID');
    }
  }

  Future<void> _startAllStreaming() async {
    if (connectedDeviceId == null) return;

    if (_csvHelper.getCurrentActivity() == null) {
      _showSnackBar("Please select an activity before starting!");
      return;
    }

    try {
      final availableTypes = await polar.getAvailableOnlineStreamDataTypes(connectedDeviceId!);
      
      if (availableTypes.contains(PolarDataType.hr)) {
        await _startHeartRateStreaming();
        await Future.delayed(Duration(milliseconds: 500));
      }
      if (availableTypes.contains(PolarDataType.ecg)) {
        await _startEcgStreaming();
        await Future.delayed(Duration(milliseconds: 500));
      }
      if (availableTypes.contains(PolarDataType.acc)) {
        await _startAccStreaming();
      }
    } catch (e) {
      debugPrint('Error starting streaming: $e');
      _showSnackBar('Error starting streaming: $e');
    }
  }

  Future<void> _startHeartRateStreaming() async {
    if (connectedDeviceId == null) return;
    try {
      hrStreamSubscription = polar.startHrStreaming(connectedDeviceId!).listen(
        (hrData) {
          if (hrData.samples.isNotEmpty) {
            final heartRate = hrData.samples.first.hr.toDouble();
            final rrList = hrData.samples.first.rrsMs;
            final rrInterval = rrList.isNotEmpty
                ? rrList.first.toDouble()
                : 0.0;
            setState(() {
              currentValues[DataType.hr] = heartRate;
              currentValues[DataType.rr] = rrInterval;
              isStreaming[DataType.hr] = true;
              isStreaming[DataType.rr] = rrInterval > 0;
            });
            _saveSensorData(DataType.hr, heartRate);
            if (rrInterval > 0) {
              _saveSensorData(DataType.rr, rrInterval);
            }
          }
        },
        onError: (error) {
          debugPrint('HR streaming error: $error');
          setState(() {
            isStreaming[DataType.hr] = false;
            isStreaming[DataType.rr] = false;
          });
        },
      );
    } catch (e) {
      debugPrint('Error starting HR streaming: $e');
    }
  }

  Future<void> _startEcgStreaming() async {
    if (connectedDeviceId == null) return;
    try {
      ecgStreamSubscription = polar.startEcgStreaming(
        connectedDeviceId!,
      ).listen(
        (ecgData) {
          if (ecgData.samples.isNotEmpty) {
            final ecgValue = ecgData.samples.last.voltage.toDouble();
            
            setState(() {
              currentValues[DataType.ecg] = ecgValue;
              isStreaming[DataType.ecg] = true;
            });
            _saveSensorData(DataType.ecg, ecgValue);
          }
        },
        onError: (error) {
          debugPrint('ECG streaming error: $error');
          setState(() {
            isStreaming[DataType.ecg] = false;
          });
        },
      );
    } catch (e) {
      debugPrint('Error starting ECG streaming: $e');
      _showSnackBar('ECG streaming failed: $e');
    }
  }

  Future<void> _startAccStreaming() async {
    if (connectedDeviceId == null) return;
    try {
      accStreamSubscription = polar.startAccStreaming(
        connectedDeviceId!,
      ).listen(
        (accData) {
          if (accData.samples.isNotEmpty) {
            final sample = accData.samples.last;
            final magnitude = sqrt(
              pow(sample.x, 2) + pow(sample.y, 2) + pow(sample.z, 2)
            );
            
            setState(() {
              currentValues[DataType.acc] = magnitude;
              isStreaming[DataType.acc] = true;
            });
            _saveSensorData(DataType.acc, magnitude, additionalData: {
              'x': sample.x.toDouble(),
              'y': sample.y.toDouble(),
              'z': sample.z.toDouble(),
            });
          }
        },
        onError: (error) {
          setState(() {
            isStreaming[DataType.acc] = false;
          });
        },
      );
    } catch (e) {
      debugPrint('Error starting ACC streaming: $e');
      _showSnackBar('ACC streaming failed: $e');
    }
  }

  Future<void> _saveSensorData(DataType type, double value, {Map<String, dynamic>? additionalData}) async {
    final data = SensorData(
      type: type,
      value: value,
      timestamp: DateTime.now(),
      additionalData: additionalData ?? {},
    );
    await _csvHelper.appendSensorData(data);

    setState(() {
      sensorHistory[type]!.insert(0, data);
      if (sensorHistory[type]!.length > 100) {
        sensorHistory[type]!.removeAt(sensorHistory[type]!.length - 1);
      }
      chartData[type] = _convertToFlSpots(sensorHistory[type]!);
    });
  }

  void _stopAllStreams() {
    hrStreamSubscription?.cancel();
    ecgStreamSubscription?.cancel();
    accStreamSubscription?.cancel();
    searchSubscription?.cancel();
    setState(() {
      isStreaming.updateAll((key, value) => false);
    });
  }

  Future<void> _disconnectDevice() async {
    if (connectedDeviceId != null) {
      try {
        _stopAllStreams();
        await polar.disconnectFromDevice(connectedDeviceId!);
        setState(() {
          connectedDeviceId = null;
          isConnected = false;
          isConnecting = false;
          isStreaming.updateAll((key, value) => false);
          currentValues.updateAll((key, value) => 0);
        });
      } catch (e) {
        debugPrint('Error disconnecting: $e');
      }
    }
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Widget _buildConnectionTab() {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (!isConnected) ...[
                Card(
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 4,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            minimumSize: const Size.fromHeight(48),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          onPressed: _searchForDevices,
                          icon: const Icon(Icons.bluetooth_searching),
                          label: const Text('Search for Polar Devices'),
                        ),
                        const SizedBox(height: 20),
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _deviceIdController,
                                decoration: InputDecoration(
                                  labelText: 'Device ID',
                                  hintText: 'e.g., 1C709B20',
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              onPressed: isConnecting ? null : _connectWithCustomId,
                              child: const Text('Connect'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                if (discoveredDevices.isNotEmpty)
                  Card(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 2,
                    child: Column(
                      children: [
                        const ListTile(
                          leading: Icon(Icons.devices),
                          title: Text('Discovered Devices'),
                        ),
                        ...discoveredDevices.map((deviceId) => ListTile(
                              title: const Text('Polar Device'),
                              subtitle: Text('ID: $deviceId'),
                              trailing: ElevatedButton(
                                onPressed: isConnecting ? null : () => _connectToDevice(deviceId),
                                child: const Text('Connect'),
                              ),
                            )),
                      ],
                    ),
                  ),
                if (isConnecting) ...[
                  const SizedBox(height: 16),
                  const Center(child: CircularProgressIndicator()),
                  const SizedBox(height: 8),
                  const Text('Connecting...', textAlign: TextAlign.center),
                ],
              ] else ...[
                Card(
                  color: Colors.green.shade50,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 3,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        const Icon(Icons.bluetooth_connected, color: Colors.green, size: 40),
                        const SizedBox(height: 8),
                        Text(
                          'Connected to: $connectedDeviceId',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: Colors.green.shade700,
                              ),
                        ),
                        const SizedBox(height: 16),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          alignment: WrapAlignment.center,
                          children: [
                            _buildStreamingChip(DataType.hr, 'Heart Rate', Icons.favorite),
                            _buildStreamingChip(DataType.rr, 'RR Interval', Icons.timeline),
                            _buildStreamingChip(DataType.ecg, 'ECG', Icons.monitor_heart),
                            _buildStreamingChip(DataType.acc, 'Accelerometer', Icons.vibration),
                          ],
                        ),
                        const SizedBox(height: 20),
                        _buildActivitySelector(),
                        const SizedBox(height: 16),
                        Wrap(
                          alignment: WrapAlignment.center,
                          spacing: 12,
                          runSpacing: 8,
                          children: [
                            ElevatedButton.icon(
                              onPressed: () async {
                                await _csvHelper.setCustomFolder();
                                _showSnackBar('Folder updated: ${_csvHelper.currentFolderPath}');
                              },
                              icon: const Icon(Icons.folder_open),
                              label: const Text('Set Folder'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.blue,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                            ElevatedButton.icon(
                              onPressed: _disconnectDevice,
                              icon: const Icon(Icons.bluetooth_disabled),
                              label: const Text('Disconnect'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.red,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                   Card(
                  color: _isBackgroundRecording ? Colors.orange.shade50 : Colors.grey.shade50,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 3,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        Icon(
                          _isBackgroundRecording ? Icons.record_voice_over : Icons.voice_over_off,
                          color: _isBackgroundRecording ? Colors.orange : Colors.grey,
                          size: 40,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _isBackgroundRecording 
                              ? 'Background Recording Active' 
                              : 'Background Recording',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.bold,
                                color: _isBackgroundRecording ? Colors.orange : Colors.grey,
                              ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _isBackgroundRecording 
                              ? 'Data will continue recording when app is in background'
                              : 'Start recording that continues in background',
                          style: TextStyle(
                            fontSize: 12,
                            color: _isBackgroundRecording ? Colors.orange.shade700 : Colors.grey.shade600,
                            fontStyle: FontStyle.italic,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            ElevatedButton.icon(
                              onPressed: _isBackgroundRecording 
                                  ? _stopBackgroundRecording 
                                  : _startBackgroundRecording,
                              icon: Icon(_isBackgroundRecording ? Icons.stop : Icons.play_arrow),
                              label: Text(_isBackgroundRecording ? 'Stop' : 'Start'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: _isBackgroundRecording ? Colors.red : Colors.orange,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                            ElevatedButton.icon(
                              onPressed: _uploadDataToServer,
                              icon: Icon(Icons.cloud_upload),
                              label: Text('Upload'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.blue,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                
                const SizedBox(height: 16),
                _buildRabbitMQStatusCard(context),
                const SizedBox(height: 16),
                _buildDataStorageCard(context),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildActivitySelector() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Select Activity', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              children: availableActivities.map((act) {
                return ChoiceChip(
                  label: Text(act),
                  selected: selectedActivity == act,
                  onSelected: (bool selected) {
                    if (selected) {
                      setState(() {
                        selectedActivity = act;
                      });
                      _csvHelper.setCurrentActivity(act);
                    }
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _newActivityController,
                    decoration: InputDecoration(
                      labelText: 'New Activity',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      hintText: 'e.g., Olahraga Berat',
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.add, color: Colors.blue),
                  onPressed: () async {
                    final text = _newActivityController.text.trim();
                    if (text.isNotEmpty && !availableActivities.contains(text)) {
                      final updated = [...availableActivities, text];
                      await _csvHelper.saveActivities(updated);
                      setState(() {
                        availableActivities = updated;
                        _newActivityController.clear();
                      });
                    }
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRabbitMQStatusCard(BuildContext context) {
    final statusColor = _mqttConnected ? Colors.green : Colors.red;
    final statusText = _mqttConnected ? 'Connected' : 'Disconnected';
    final lastSentText = _mqttLastSent ?? 'Never';
    final gpsText = (_gpsLat != null && _gpsLng != null) 
        ? '${_gpsLat!.toStringAsFixed(6)}, ${_gpsLng!.toStringAsFixed(6)}' 
        : 'Searching / Unavailable';

    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.sync_alt, color: Colors.teal),
                    const SizedBox(width: 8),
                    Text(
                      'RabbitMQ (MQTT)',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: statusColor, width: 1),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: statusColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        statusText,
                        style: TextStyle(
                          color: statusColor,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 20),
            Row(
              children: [
                const Icon(Icons.send_outlined, size: 18, color: Colors.blueGrey),
                const SizedBox(width: 8),
                const Text('Last Sent:', style: TextStyle(fontWeight: FontWeight.w500)),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    lastSentText,
                    style: const TextStyle(color: Colors.black87),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.location_on_outlined, size: 18, color: Colors.blueGrey),
                const SizedBox(width: 8),
                const Text('GPS Location:', style: TextStyle(fontWeight: FontWeight.w500)),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    gpsText,
                    style: const TextStyle(color: Colors.black87),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.backup_outlined, size: 18, color: Colors.blueGrey),
                    const SizedBox(width: 8),
                    const Text('Pending Queue:', style: TextStyle(fontWeight: FontWeight.w500)),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: _mqttPendingCount > 0 ? Colors.orange.shade100 : Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '$_mqttPendingCount records',
                        style: TextStyle(
                          color: _mqttPendingCount > 0 ? Colors.orange.shade800 : Colors.grey.shade700,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                if (!_mqttConnected)
                  TextButton.icon(
                    onPressed: () {
                      MqttGpsService().connectMqtt();
                      _loadMqttGpsStatus();
                    },
                    icon: const Icon(Icons.refresh, size: 16),
                    label: const Text('Reconnect', style: TextStyle(fontSize: 12)),
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: const Size(50, 30),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDataStorageCard(BuildContext context) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Text('Data Storage',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('Folder: ${_csvHelper.currentFolderPath}'),
            Text('Total Records: $totalDataCount'),
            const SizedBox(height: 16),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 12,
              runSpacing: 8,
              children: [
                ElevatedButton.icon(
                  onPressed: () async {
                    await _csvHelper.clearAllData();
                    await _loadSensorHistory();
                    _showSnackBar('All data cleared');
                  },
                  icon: const Icon(Icons.clear_all),
                  label: const Text('Clear Data'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.orange,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                ElevatedButton.icon(
                  onPressed: () async {
                    final file = await _csvHelper.getCsvFile();
                    _showSnackBar('CSV: ${file.path}');
                  },
                  icon: const Icon(Icons.file_present),
                  label: const Text('Show CSV'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStreamingChip(DataType type, String label, IconData icon) {
    final streaming = isStreaming[type] ?? false;
    return Chip(
      avatar: Icon(icon, size: 16),
      label: Text(label),
      backgroundColor: streaming ? Colors.green.shade100 : Colors.grey.shade200,
      side: BorderSide(
        color: streaming ? Colors.green : Colors.grey,
        width: 1,
      ),
    );
  }

  Widget _buildDataTab(DataType type) {
    final data = sensorHistory[type] ?? [];
    final currentValue = currentValues[type] ?? 0;
    final streaming = isStreaming[type] ?? false;
    String unit = '';
    String title = '';
    IconData icon = Icons.show_chart;
    Color color = Colors.blue;
    switch (type) {
      case DataType.hr:
        unit = 'BPM';
        title = 'Heart Rate';
        icon = Icons.favorite;
        color = Colors.red;
        break;
      case DataType.rr:
        unit = 'ms';
        title = 'RR Interval';
        icon = Icons.timeline;
        color = Colors.orange;
        break;
      case DataType.ecg:
        unit = 'µV';
        title = 'ECG';
        icon = Icons.monitor_heart;
        color = Colors.purple;
        break;
      case DataType.acc:
        unit = 'mg';
        title = 'Accelerometer';
        icon = Icons.vibration;
        color = Colors.green;
        break;
    }

    return Padding(
      padding: EdgeInsets.all(16),
      child: Column(
        children: [
          Card(
            color: streaming ? color.withOpacity(0.1) : Colors.grey.shade100,
            child: Padding(
              padding: EdgeInsets.all(20),
              child: Column(
                children: [
                  Icon(icon, color: streaming ? color : Colors.grey, size: 40),
                  SizedBox(height: 10),
                  Text(
                    currentValue.toStringAsFixed(type == DataType.hr ? 0 : 2),
                    style: TextStyle(
                      fontSize: 48,
                      fontWeight: FontWeight.bold,
                      color: streaming ? color : Colors.grey,
                    ),
                  ),
                  Text(
                    unit,
                    style: TextStyle(
                      fontSize: 16,
                      color: streaming ? color.withOpacity(0.8) : Colors.grey,
                    ),
                  ),
                  SizedBox(height: 10),
                  Text(
                    streaming ? 'Streaming Active' : 'Not Streaming',
                    style: TextStyle(
                      fontSize: 12,
                      color: streaming ? Colors.green : Colors.grey,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
          SizedBox(height: 16),
          Expanded(
            flex: 2,
            child: Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$title Chart',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    SizedBox(height: 16),
                    Expanded(
                      child: chartData[type]!.isNotEmpty
                          ? LineChart(
                              LineChartData(
                                gridData: FlGridData(show: true),
                                titlesData: FlTitlesData(show: false),
                                borderData: FlBorderData(show: true),
                                lineBarsData: [
                                  LineChartBarData(
                                    spots: chartData[type]!,
                                    isCurved: true,
                                    color: color,
                                    barWidth: 2,
                                    isStrokeCapRound: true,
                                    dotData: FlDotData(show: false),
                                    belowBarData: BarAreaData(
                                      show: true,
                                      color: color.withOpacity(0.1),
                                    ),
                                  ),
                                ],
                              ),
                            )
                          : Center(
                              child: Text(
                                'No data available',
                                style: TextStyle(
                                  fontSize: 16,
                                  color: Colors.grey,
                                ),
                              ),
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(
            flex: 1,
            child: Card(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: EdgeInsets.all(16),
                    child: Text(
                      'Recent History (${data.length} records)',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ),
                  Expanded(
                    child: data.isNotEmpty
                        ? ListView.builder(
                            itemCount: data.length > 20 ? 20 : data.length,
                            itemBuilder: (context, index) {
                              final item = data[index];
                              return ListTile(
                                dense: true,
                                leading: Icon(icon, color: color, size: 20),
                                title: Text('${item.value.toStringAsFixed(type == DataType.hr ? 0 : 2)} $unit'),
                                subtitle: Text(
                                  '${item.timestamp.toString().substring(0, 19)}',
                                  style: TextStyle(fontSize: 12),
                                ),
                                trailing: type == DataType.acc && item.additionalData.isNotEmpty
                                    ? Text(
                                      'X:${item.additionalData['x']?.toStringAsFixed(1)}\n'
                                      'Y:${item.additionalData['y']?.toStringAsFixed(1)}\n'
                                      'Z:${item.additionalData['z']?.toStringAsFixed(1)}',
                                      style: TextStyle(fontSize: 10),
                                      )
                                    : null,
                              );
                            },
                          )
                        : Center(
                            child: Padding(
                              padding: EdgeInsets.all(20),
                              child: Text(
                                'No history data',
                                style: TextStyle(color: Colors.grey),
                              ),
                            ),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOverviewTab() {
    return Padding(
      padding: EdgeInsets.all(16),
      child: Column(
        children: [
          Expanded(
            flex: 2,
            child: GridView.builder(
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 1.2,
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
              ),
              itemCount: DataType.values.length,
              itemBuilder: (context, index) {
                final type = DataType.values[index];
                final value = currentValues[type] ?? 0;
                final streaming = isStreaming[type] ?? false;
                String unit = '';
                String title = '';
                IconData icon = Icons.show_chart;
                Color color = Colors.blue;
                switch (type) {
                  case DataType.hr:
                    unit = 'BPM';
                    title = 'Heart Rate';
                    icon = Icons.favorite;
                    color = Colors.red;
                    break;
                  case DataType.rr:
                    unit = 'ms';
                    title = 'RR Interval';
                    icon = Icons.timeline;
                    color = Colors.orange;
                    break;
                  case DataType.ecg:
                    unit = 'µV';
                    title = 'ECG';
                    icon = Icons.monitor_heart;
                    color = Colors.purple;
                    break;
                  case DataType.acc:
                    unit = 'mg';
                    title = 'Accelerometer';
                    icon = Icons.vibration;
                    color = Colors.green;
                    break;
                }
                return Card(
                  color: streaming ? color.withOpacity(0.1) : Colors.grey.shade100,
                  child: Padding(
                    padding: EdgeInsets.all(12),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          icon,
                          color: streaming ? color : Colors.grey,
                          size: 24,
                        ),
                        SizedBox(height: 8),
                        Text(
                          title,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        SizedBox(height: 4),
                        Text(
                          value.toStringAsFixed(type == DataType.hr ? 0 : 2),
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: streaming ? color : Colors.grey,
                          ),
                        ),
                        Text(
                          unit,
                          style: TextStyle(
                            fontSize: 10,
                            color: streaming ? color.withOpacity(0.8) : Colors.grey,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          Expanded(
            flex: 3,
            child: Card(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Combined Data Chart',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    SizedBox(height: 16),
                    Expanded(
                      child: _buildCombinedChart(),
                    ),
                  ],
                ),
              ),
            ),
          ),
          Card(
            child: Padding(
              padding: EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Statistics',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      Column(
                        children: [
                          Text('Total Records'),
                          Text(
                            totalDataCount,
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.blue,
                            ),
                          ),
                        ],
                      ),
                      Column(
                        children: [
                          Text('Active Streams'),
                          Text(
                            '${isStreaming.values.where((v) => v).length}',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Colors.green,
                            ),
                          ),
                        ],
                      ),
                      Column(
                        children: [
                          Text('Connection'),
                          Icon(
                            isConnected ? Icons.bluetooth_connected : Icons.bluetooth_disabled,
                            color: isConnected ? Colors.green : Colors.red,
                            size: 24,
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCombinedChart() {
    List<Color> colors = [Colors.red, Colors.orange, Colors.purple, Colors.green];
    List<LineChartBarData> series = [];
    for (int i = 0; i < DataType.values.length; i++) {
      final type = DataType.values[i];
      final data = chartData[type] ?? [];
      if (data.isNotEmpty && data.length > 1) {
        series.add(
          LineChartBarData(
            spots: data,
            isCurved: true,
            color: colors[i],
            barWidth: 2,
            isStrokeCapRound: true,
            dotData: FlDotData(show: false),
            belowBarData: BarAreaData(show: false),
          ),
        );
      }
    }
    if (series.isEmpty) {
      return Center(
        child: Text(
          'No data available for chart',
          style: TextStyle(fontSize: 16, color: Colors.grey),
        ),
      );
    }
    return LineChart(
      LineChartData(
        gridData: FlGridData(show: true),
        titlesData: FlTitlesData(show: false),
        borderData: FlBorderData(show: true),
        lineBarsData: series,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Enhanced Polar Monitor'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
            PopupMenuButton<String>(
            icon: Icon(Icons.account_circle),
            onSelected: (String value) {
              if (value == 'logout') {
                _logout();
              } else if (value == 'questionnaire') {
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (context) => HealthQuestionnairePage()),
                );
              }
            },
            itemBuilder: (BuildContext context) => [
              PopupMenuItem<String>(
                value: 'questionnaire',
                child: Row(
                  children: [
                    Icon(Icons.assignment, color: Colors.blue),
                    SizedBox(width: 8),
                    Text('Health Questionnaire'),
                  ],
                ),
              ),
              PopupMenuDivider(),
              PopupMenuItem<String>(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout, color: Colors.red),
                    SizedBox(width: 8),
                    Text('Logout'),
                  ],
                ),
              ),
            ],
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: [
            Tab(icon: Icon(Icons.bluetooth), text: 'Connection'),
            Tab(icon: Icon(Icons.dashboard), text: 'Overview'),
            Tab(icon: Icon(Icons.favorite), text: 'Heart Rate'),
            Tab(icon: Icon(Icons.timeline), text: 'RR Interval'),
            Tab(icon: Icon(Icons.monitor_heart), text: 'ECG'),
            Tab(icon: Icon(Icons.vibration), text: 'Accelerometer'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildConnectionTab(),
          _buildOverviewTab(),
          _buildDataTab(DataType.hr),
          _buildDataTab(DataType.rr),
          _buildDataTab(DataType.ecg),
          _buildDataTab(DataType.acc),
        ],
      ),
    );
  }
}