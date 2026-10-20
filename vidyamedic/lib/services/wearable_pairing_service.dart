import 'dart:async';
import 'dart:io' show Platform;
import 'dart:math' as math;

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:polar/polar.dart';

import 'api_service.dart';

class PolarWearablePairingService extends ChangeNotifier {
  PolarWearablePairingService({
    required Future<ApiResponse<Map<String, dynamic>>> Function(
            Map<String, dynamic>)
        uploadSample,
    required Future<ApiResponse<Map<String, dynamic>>> Function(
            Map<String, dynamic>)
        uploadStream,
    required VoidCallback onSampleStored,
  })  : _uploadSample = uploadSample,
        _uploadStream = uploadStream,
        _onSampleStored = onSampleStored {
    _connectSubscription = _polar.deviceConnected.listen(_handleConnected);
    _disconnectSubscription =
        _polar.deviceDisconnected.listen(_handleDisconnected);
    _featureSubscription = _polar.sdkFeatureReady.listen((event) {
      if (event.feature == PolarSdkFeature.onlineStreaming) {
        _startSensorStreams(event.identifier);
      }
    });
  }

  final Polar _polar = Polar();
  final Future<ApiResponse<Map<String, dynamic>>> Function(Map<String, dynamic>)
      _uploadSample;
  final Future<ApiResponse<Map<String, dynamic>>> Function(Map<String, dynamic>)
      _uploadStream;
  final VoidCallback _onSampleStored;
  final List<PolarDeviceInfo> _devices = [];
  final List<int> _rrIntervals = [];
  final List<int> _sessionHeartRates = [];
  final List<List<double>> _acceleration = [];
  final List<List<double>> _recentAcceleration = [];
  final List<Map<String, dynamic>> _pendingSamples = [];
  final List<Map<String, dynamic>> _streamReadings = [];
  final List<Map<String, dynamic>> _recentStreamReadings = [];
  final List<Map<String, dynamic>> _pendingStreamBatches = [];

  StreamSubscription<PolarDeviceInfo>? _scanSubscription;
  StreamSubscription<PolarDeviceInfo>? _connectSubscription;
  StreamSubscription<PolarDeviceDisconnectedEvent>? _disconnectSubscription;
  StreamSubscription<PolarSdkFeatureReadyEvent>? _featureSubscription;
  StreamSubscription<PolarHrData>? _heartRateSubscription;
  StreamSubscription<PolarAccData>? _accelerationSubscription;
  Timer? _sampleFlushTimer;
  Timer? _streamFlushTimer;
  Timer? _demoReadingTimer;
  Timer? _connectionTimeoutTimer;
  DateTime? _windowStartedAt;
  String _deviceId = '';
  String _connectingDeviceId = '';
  int _connectionAttempt = 0;
  String _deviceName = '';
  String _activity = 'unknown';
  int? _heartRateBpm;
  int _expectedRrCount = 0;
  int _validRrCount = 0;
  bool _sensorContact = false;
  List<double>? _latestAcceleration;
  bool _hasHeartRateStream = false;
  bool _hasAccelerationStream = false;
  bool _isUploadingSample = false;
  bool _isUploadingStream = false;
  bool _isDummyDevice = false;
  bool _isDisposed = false;
  int _demoTick = 0;
  Completer<void>? _sampleUploadCompleter;
  Completer<void>? _streamUploadCompleter;
  int _sessionRrIntervalCount = 0;
  int _sessionReadingCount = 0;
  int _sessionAccelerationCount = 0;
  int _sessionWindowCount = 0;

  bool isScanning = false;
  bool isConnecting = false;
  bool isConnected = false;
  bool isStreaming = false;
  bool get isDemoDevice => _isDummyDevice;
  bool get isUploading => _isUploadingSample || _isUploadingStream;
  String? sampleError;
  String? streamError;
  String? connectionError;
  String? get error => streamError ?? sampleError ?? connectionError;
  DateTime? lastUploadedAt;
  DateTime? lastStreamPublishedAt;
  List<PolarDeviceInfo> get devices => List.unmodifiable(_devices);
  List<Map<String, dynamic>> get recentStreamReadings =>
      List.unmodifiable(_recentStreamReadings);
  String get deviceId => _deviceId;
  String get deviceName => _deviceName;
  String get activity => _activity;
  int? get heartRateBpm => _heartRateBpm;
  int? get sessionMinimumHeartRate => _sessionHeartRates.isEmpty
      ? null
      : _sessionHeartRates.reduce((a, b) => a < b ? a : b);
  int? get sessionMaximumHeartRate => _sessionHeartRates.isEmpty
      ? null
      : _sessionHeartRates.reduce((a, b) => a > b ? a : b);
  int get sessionRrIntervalCount => _sessionRrIntervalCount;
  int get sessionReadingCount => _sessionReadingCount;
  int get sessionAccelerationCount => _sessionAccelerationCount;
  int get sessionWindowCount => _sessionWindowCount;
  List<List<double>> get recentAcceleration =>
      _recentAcceleration.map(List<double>.from).toList();
  int get pendingCount =>
      _pendingSamples.length +
      _pendingStreamBatches.length +
      (_streamReadings.isEmpty ? 0 : 1);

  Future<void> startScan() async {
    connectionError = null;
    try {
      await _requestBluetoothPermissions();

      await stopScan();
      _devices.clear();
      isScanning = true;
      _scanSubscription = _polar.searchForDevice().listen(
        (device) {
          if (!_devices.any((known) => known.deviceId == device.deviceId)) {
            _devices.add(device);
            _notify();
          }
        },
        onError: (Object e) {
          connectionError = 'Pemindaian Polar gagal: $e';
          isScanning = false;
          _notify();
        },
        onDone: () {
          isScanning = false;
          _notify();
        },
      );
      _notify();
    } catch (e) {
      connectionError = _errorMessage(e);
      isScanning = false;
      _notify();
    }
  }

  Future<void> _requestBluetoothPermissions() async {
    if (Platform.isAndroid) {
      final sdkInt = (await DeviceInfoPlugin().androidInfo).version.sdkInt;
      await _polar.requestPermissions();

      final requiredPermissions = sdkInt >= 31
          ? [Permission.bluetoothScan, Permission.bluetoothConnect]
          : sdkInt >= 23
              ? [Permission.location]
              : <Permission>[];
      await _ensurePermissionsGranted(requiredPermissions);
      return;
    }

    if (Platform.isIOS) {
      await Permission.bluetooth.request();
      await _ensurePermissionsGranted([Permission.bluetooth]);
      return;
    }

    throw StateError('Pairing Polar hanya didukung di Android dan iOS.');
  }

  Future<void> _ensurePermissionsGranted(
    List<Permission> permissions,
  ) async {
    final statuses = await Future.wait(
      permissions.map((permission) => permission.status),
    );
    final denied = <String>[];
    for (var index = 0; index < permissions.length; index++) {
      if (!statuses[index].isGranted) {
        final permissionName = switch (permissions[index]) {
          Permission.bluetoothScan => 'Bluetooth Scan',
          Permission.bluetoothConnect => 'Bluetooth Connect',
          Permission.bluetooth => 'Bluetooth',
          Permission.location =>
            'Lokasi (diperlukan Android lama untuk scan BLE)',
          _ => 'Izin perangkat',
        };
        final suffix = statuses[index].isPermanentlyDenied
            ? ' (ditolak permanen; aktifkan di Pengaturan)'
            : '';
        denied.add('$permissionName$suffix');
      }
    }
    if (denied.isNotEmpty) {
      throw StateError(
          'Izin berikut diperlukan untuk Polar: ${denied.join(', ')}.');
    }
  }

  String _errorMessage(Object error) {
    final message = error.toString();
    return message.startsWith('Bad state: ')
        ? message.substring('Bad state: '.length)
        : message;
  }

  Future<void> stopScan() async {
    await _scanSubscription?.cancel();
    _scanSubscription = null;
    isScanning = false;
    _notify();
  }

  Future<bool> connectDummyDevice() async {
    if (isConnected && !_isDummyDevice) {
      connectionError = 'Putuskan Polar H10 terlebih dahulu.';
      _notify();
      return false;
    }
    await stopScan();
    _isDummyDevice = true;
    _deviceId = 'VIDYAMEDIC-DEMO';
    _deviceName = 'Sensor Dummy VidyaMedic (DEMO)';
    _hasHeartRateStream = true;
    _hasAccelerationStream = true;
    isConnected = true;
    isConnecting = false;
    connectionError = null;
    _notify();
    return true;
  }

  Future<bool> connectToDevice(String id) async {
    if (_isDummyDevice) {
      connectionError = 'Putuskan sensor dummy sebelum menghubungkan Polar.';
      _notify();
      return false;
    }
    final deviceId = id.trim().toUpperCase();
    if (deviceId.isEmpty) {
      connectionError = 'ID perangkat Bluetooth tidak valid.';
      _notify();
      return false;
    }
    connectionError = null;
    final attempt = ++_connectionAttempt;
    _connectingDeviceId = deviceId;
    isConnecting = true;
    _notify();
    try {
      await _requestBluetoothPermissions();
      await stopScan();
      if (_connectionAttempt != attempt) return false;
      _connectionTimeoutTimer?.cancel();
      _connectionTimeoutTimer = Timer(const Duration(seconds: 30), () {
        if (_isDisposed ||
            !isConnecting ||
            _connectingDeviceId != deviceId ||
            _connectionAttempt != attempt) {
          return;
        }
        _connectionAttempt++;
        _connectionTimeoutTimer = null;
        _connectingDeviceId = '';
        isConnecting = false;
        connectionError =
            'Waktu koneksi Polar H10 habis. Pastikan Bluetooth aktif, sensor dikenakan agar menyala, dan Polar H10 tidak sedang terhubung ke CAPAR Mobile atau aplikasi lain. Lalu pindai ulang.';
        _notify();
        unawaited(_disconnectTimedOutDevice(deviceId));
      });
      await _polar.connectToDevice(deviceId);
      return true;
    } catch (e) {
      if (_connectionAttempt != attempt) {
        return isConnected && _deviceId == deviceId;
      }
      _connectionAttempt++;
      _connectionTimeoutTimer?.cancel();
      _connectionTimeoutTimer = null;
      _connectingDeviceId = '';
      connectionError =
          'Gagal menghubungkan Polar H10 ($deviceId): ${_errorMessage(e)}';
      isConnecting = false;
      _notify();
      return false;
    }
  }

  Future<void> _disconnectTimedOutDevice(String id) async {
    try {
      await _polar.disconnectFromDevice(id);
    } catch (error) {
      if (_isDisposed) return;
      connectionError =
          'Koneksi Polar H10 melewati batas waktu; pemutusan percobaan gagal: $error';
      _notify();
    }
  }

  void _handleConnected(PolarDeviceInfo device) {
    _connectionAttempt++;
    _connectionTimeoutTimer?.cancel();
    _connectionTimeoutTimer = null;
    _connectingDeviceId = '';
    _deviceId = device.deviceId;
    _deviceName = device.name.isNotEmpty ? device.name : 'Polar H10';
    isConnected = true;
    isConnecting = false;
    connectionError = null;
    _notify();
  }

  void _handleDisconnected(PolarDeviceDisconnectedEvent event) {
    if (_deviceId.isNotEmpty && event.info.deviceId != _deviceId) return;
    _connectionAttempt++;
    _connectionTimeoutTimer?.cancel();
    _connectionTimeoutTimer = null;
    _connectingDeviceId = '';
    isConnected = false;
    isConnecting = false;
    isStreaming = false;
    _hasHeartRateStream = false;
    _hasAccelerationStream = false;
    connectionError = 'Polar H10 terputus dari perangkat.';
    _sampleFlushTimer?.cancel();
    _sampleFlushTimer = null;
    _streamFlushTimer?.cancel();
    _streamFlushTimer = null;
    _cancelSensorStreams();
    unawaited(flushStream(force: true));
    unawaited(flushSample(force: true));
    _notify();
  }

  Future<void> _startSensorStreams(String identifier) async {
    try {
      _hasHeartRateStream = false;
      _hasAccelerationStream = false;
      connectionError = null;
      final available =
          await _polar.getAvailableOnlineStreamDataTypes(identifier);
      _hasHeartRateStream = available.contains(PolarDataType.hr);
      _hasAccelerationStream = available.contains(PolarDataType.acc);
      if (_hasHeartRateStream) {
        await _heartRateSubscription?.cancel();
        _heartRateSubscription = _polar.startHrStreaming(identifier).listen(
          _handleHeartRate,
          onError: (Object e) {
            streamError = 'Aliran HR/RR terputus: $e';
            _notify();
          },
          cancelOnError: false,
        );
      } else {
        connectionError = 'Perangkat ini tidak menyediakan aliran HR/RR.';
      }

      if (_hasAccelerationStream) {
        await _accelerationSubscription?.cancel();
        _accelerationSubscription = _polar
            .startAccStreaming(
          identifier,
          settings: PolarSensorSetting({
            PolarSettingType.sampleRate: 50,
            PolarSettingType.range: 8,
            PolarSettingType.resolution: 16,
          }),
        )
            .listen(
          _handleAcceleration,
          onError: (Object e) {
            streamError = 'Aliran akselerometer terputus: $e';
            _notify();
          },
          cancelOnError: false,
        );
      } else {
        connectionError =
            'Polar H10 tidak menyediakan aliran akselerometer yang dibutuhkan.';
      }
      _notify();
    } catch (e) {
      connectionError = 'Gagal memulai aliran sensor Polar: $e';
      _notify();
    }
  }

  void _handleHeartRate(PolarHrData data) {
    if (!isStreaming) return;
    for (final sample in data.samples) {
      final hasContact = sample.contactStatusSupported
          ? sample.contactStatus
          : sample.rrsMs.isNotEmpty;
      if (!hasContact) continue;
      _sensorContact = true;
      _heartRateBpm = sample.hr;
      _sessionHeartRates.add(sample.hr);

      for (final rr in sample.rrsMs) {
        _expectedRrCount++;
        _sessionRrIntervalCount++;
        if (rr >= 250 && rr <= 3000) {
          _rrIntervals.add(rr);
          _validRrCount++;
        }
      }
      if (sample.rrsMs.isNotEmpty) {
        final eventTime = DateTime.now().toUtc();
        _windowStartedAt ??= eventTime;
        if (_latestAcceleration != null) {
          var beatTime = eventTime;
          final records = <Map<String, dynamic>>[];
          for (var index = sample.rrsMs.length - 1; index >= 0; index--) {
            final rr = sample.rrsMs[index];
            beatTime = beatTime.subtract(Duration(milliseconds: rr));
            records.add({
              'recorded_at': beatTime.toIso8601String(),
              'heart_rate_bpm': sample.hr,
              'rr_interval_ms': rr,
              'acceleration_g': List<double>.from(_latestAcceleration!),
            });
          }
          _sessionReadingCount += records.length;
          _streamReadings.addAll(records.reversed);
          _recentStreamReadings.addAll(records.reversed);
          if (_recentStreamReadings.length > 300) {
            _recentStreamReadings.removeRange(
                0, _recentStreamReadings.length - 300);
          }
        }
      }
    }
    _notify();
  }

  void _handleAcceleration(PolarAccData data) {
    if (!isStreaming) return;
    for (final sample in data.samples) {
      final vector = [
        sample.x / 1000.0,
        sample.y / 1000.0,
        sample.z / 1000.0,
      ];
      _latestAcceleration = vector;
      _acceleration.add(vector);
      _recentAcceleration.add(vector);
      _sessionAccelerationCount++;
      if (_recentAcceleration.length > 500) {
        _recentAcceleration.removeRange(0, _recentAcceleration.length - 500);
      }
    }
  }

  void setActivity(String activity) {
    _activity = activity;
    _notify();
  }

  bool startStreaming(String activity) {
    if (!isConnected) {
      connectionError = 'Hubungkan Polar H10 sebelum memulai streaming.';
      _notify();
      return false;
    }
    if (!_hasHeartRateStream || !_hasAccelerationStream) {
      connectionError =
          'Aliran HR/RR dan akselerometer belum siap dari perangkat.';
      _notify();
      return false;
    }
    _activity = activity;
    _clearWindow();
    _sessionHeartRates.clear();
    _sessionRrIntervalCount = 0;
    _sessionReadingCount = 0;
    _sessionAccelerationCount = 0;
    _sessionWindowCount = 0;
    _streamReadings.clear();
    _recentStreamReadings.clear();
    _recentAcceleration.clear();
    lastStreamPublishedAt = null;
    isStreaming = true;
    sampleError = null;
    streamError = null;
    _sampleFlushTimer?.cancel();
    _streamFlushTimer?.cancel();
    _sampleFlushTimer =
        Timer.periodic(const Duration(minutes: 1), (_) => flushSample());
    _streamFlushTimer =
        Timer.periodic(const Duration(seconds: 10), (_) => flushStream());
    if (_isDummyDevice) {
      _demoTick = 0;
      _demoReadingTimer?.cancel();
      _demoReadingTimer = Timer.periodic(
        const Duration(seconds: 1),
        (_) => _emitDummyReading(),
      );
      _emitDummyReading();
    }
    _notify();
    return true;
  }

  Future<void> stopStreaming() async {
    _demoReadingTimer?.cancel();
    _demoReadingTimer = null;
    _sampleFlushTimer?.cancel();
    _sampleFlushTimer = null;
    _streamFlushTimer?.cancel();
    _streamFlushTimer = null;
    isStreaming = false;
    await flushStream(force: true);
    await flushSample(force: true);
    _notify();
  }

  void _emitDummyReading() {
    if (!isStreaming || !_isDummyDevice) return;
    final recordedAt = DateTime.now().toUtc();
    _windowStartedAt ??= recordedAt;
    final intensity = switch (_activity) {
      'walking' => 1.0,
      'running' || 'exercise' => 1.5,
      'standing' => 0.45,
      _ => 0.0,
    };
    final baseHeartRate = switch (_activity) {
      'walking' => 105,
      'running' => 138,
      'exercise' => 125,
      'standing' => 82,
      _ => 70,
    };
    final phase = _demoTick.toDouble();
    final heartRate =
        (baseHeartRate + 3 * math.sin(phase / 7) + 2 * math.sin(phase / 2.5))
            .round();
    final rrInterval = (60000 / heartRate + 15 * math.sin(phase / 3)).round();
    _heartRateBpm = heartRate;
    _sensorContact = true;
    _expectedRrCount++;
    _sessionRrIntervalCount++;
    _sessionReadingCount++;
    _sessionHeartRates.add(heartRate);
    if (_sessionHeartRates.length > 10000) {
      _sessionHeartRates.removeAt(0);
    }
    _rrIntervals.add(rrInterval);
    _validRrCount++;

    List<double>? latestAcceleration;
    for (var sample = 0; sample < 10; sample++) {
      final accPhase = (phase * 10 + sample) * 2 * math.pi / 14;
      final vector = [
        intensity * 0.3 * math.sin(accPhase),
        intensity * 0.08 * math.cos(accPhase * 0.7),
        1 + intensity * 0.12 * math.cos(accPhase),
      ];
      _latestAcceleration = vector;
      _acceleration.add(vector);
      _recentAcceleration.add(vector);
      _sessionAccelerationCount++;
      latestAcceleration = vector;
    }
    if (latestAcceleration != null) {
      final reading = <String, dynamic>{
        'recorded_at': recordedAt.toIso8601String(),
        'heart_rate_bpm': heartRate,
        'rr_interval_ms': rrInterval,
        'acceleration_g': latestAcceleration,
        'sensor_contact': true,
        'signal_confidence': 1.0,
      };
      _streamReadings.add(reading);
      _recentStreamReadings.add(reading);
      if (_recentStreamReadings.length > 300) {
        _recentStreamReadings.removeRange(
            0, _recentStreamReadings.length - 300);
      }
    }
    if (_recentAcceleration.length > 500) {
      _recentAcceleration.removeRange(0, _recentAcceleration.length - 500);
    }
    _demoTick++;
    _notify();
  }

  Future<bool> flushPendingUploads() async {
    await flushStream(force: true);
    await flushSample(force: true);
    return _pendingStreamBatches.isEmpty && _pendingSamples.isEmpty;
  }

  Future<void> flushStream({bool force = false}) async {
    if (!isStreaming && !force) return;
    if (_streamReadings.isNotEmpty) {
      _pendingStreamBatches.add({
        'provider': _isDummyDevice ? 'other' : 'polar_h10',
        'is_simulated': _isDummyDevice,
        'device_id': _deviceId,
        'activity': _activity,
        'readings': List<Map<String, dynamic>>.from(_streamReadings),
      });
      _streamReadings.clear();
    }
    if (_isUploadingStream) {
      if (force) {
        await _streamUploadCompleter?.future;
        if (_pendingStreamBatches.isNotEmpty) {
          await flushStream(force: true);
        }
      }
      return;
    }
    if (_pendingStreamBatches.isEmpty) return;

    _isUploadingStream = true;
    final uploadCompleter = Completer<void>();
    _streamUploadCompleter = uploadCompleter;
    _notify();
    try {
      while (_pendingStreamBatches.isNotEmpty) {
        final result = await _uploadStream(_pendingStreamBatches.first);
        if (!result.success || result.data?['published'] != true) {
          streamError =
              result.message ?? 'RabbitMQ tidak menerima batch streaming.';
          break;
        }
        _pendingStreamBatches.removeAt(0);
        lastStreamPublishedAt = DateTime.now();
        streamError = null;
      }
    } catch (e) {
      streamError = 'Gagal mengirim batch wearable: $e';
    } finally {
      _isUploadingStream = false;
      _streamUploadCompleter = null;
      uploadCompleter.complete();
      _notify();
    }
  }

  Future<void> flushSample({bool force = false}) async {
    if (!isStreaming && !force) return;
    if (_rrIntervals.length >= 10 && _acceleration.length >= 10) {
      _pendingSamples.add(_createSamplePayload());
      _clearWindow();
    }
    if (_isUploadingSample) {
      if (force) {
        await _sampleUploadCompleter?.future;
        if (_pendingSamples.isNotEmpty) {
          await flushSample(force: true);
        }
      }
      return;
    }
    if (_pendingSamples.isEmpty) return;

    _isUploadingSample = true;
    final uploadCompleter = Completer<void>();
    _sampleUploadCompleter = uploadCompleter;
    _notify();
    try {
      while (_pendingSamples.isNotEmpty) {
        final result = await _uploadSample(_pendingSamples.first);
        if (!result.success || result.data == null) {
          sampleError =
              result.message ?? 'Sampel wearable gagal dikirim ke server.';
          break;
        }
        _pendingSamples.removeAt(0);
        _sessionWindowCount++;
        lastUploadedAt = DateTime.now();
        sampleError = null;
        _onSampleStored();
      }
    } catch (e) {
      sampleError = 'Gagal menyimpan sampel wearable: $e';
    } finally {
      _isUploadingSample = false;
      _sampleUploadCompleter = null;
      uploadCompleter.complete();
      _notify();
    }
  }

  Map<String, dynamic> _createSamplePayload() {
    final rr = _rrIntervals.length <= 256
        ? List<int>.from(_rrIntervals)
        : _rrIntervals.sublist(_rrIntervals.length - 256);
    final acceleration = _downsampleAcceleration(_acceleration, 512);
    return {
      'provider': _isDummyDevice ? 'other' : 'polar_h10',
      'is_simulated': _isDummyDevice,
      'device_id': _deviceId,
      'recorded_at':
          (_windowStartedAt ?? DateTime.now().toUtc()).toIso8601String(),
      'heart_rate_bpm': _heartRateBpm,
      'rr_intervals_ms': rr,
      'expected_rr_count': _expectedRrCount,
      'acceleration_g': acceleration,
      'sensor_contact': _sensorContact,
      'signal_confidence':
          _expectedRrCount == 0 ? 0 : _validRrCount / _expectedRrCount,
      'activity': _activity,
    };
  }

  List<List<double>> _downsampleAcceleration(
      List<List<double>> samples, int maxSamples) {
    if (samples.length <= maxSamples) {
      return samples.map(List<double>.from).toList();
    }
    final stride = (samples.length / maxSamples).ceil();
    return [
      for (var index = 0; index < samples.length; index += stride)
        samples[index],
    ];
  }

  void _clearWindow() {
    _rrIntervals.clear();
    _acceleration.clear();
    _windowStartedAt = null;
    _expectedRrCount = 0;
    _validRrCount = 0;
    _sensorContact = false;
    _heartRateBpm = null;
  }

  void _cancelSensorStreams() {
    _heartRateSubscription?.cancel();
    _heartRateSubscription = null;
    _accelerationSubscription?.cancel();
    _accelerationSubscription = null;
  }

  Future<void> disconnect() async {
    _connectionAttempt++;
    _connectionTimeoutTimer?.cancel();
    _connectionTimeoutTimer = null;
    _connectingDeviceId = '';
    await stopStreaming();
    await stopScan();
    _cancelSensorStreams();
    if (_deviceId.isNotEmpty && !_isDummyDevice) {
      await _polar.disconnectFromDevice(_deviceId);
    }
    isConnected = false;
    isConnecting = false;
    _deviceId = '';
    _deviceName = '';
    _isDummyDevice = false;
    _recentAcceleration.clear();
    _notify();
  }

  void _notify() {
    if (!_isDisposed) notifyListeners();
  }

  @override
  void dispose() {
    _isDisposed = true;
    _connectionAttempt++;
    _sampleFlushTimer?.cancel();
    _streamFlushTimer?.cancel();
    _demoReadingTimer?.cancel();
    _connectionTimeoutTimer?.cancel();
    _scanSubscription?.cancel();
    _cancelSensorStreams();
    _connectSubscription?.cancel();
    _disconnectSubscription?.cancel();
    _featureSubscription?.cancel();
    if (_deviceId.isNotEmpty && !_isDummyDevice) {
      _polar.disconnectFromDevice(_deviceId);
    }
    super.dispose();
  }
}
