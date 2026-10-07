import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
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
  final List<List<double>> _acceleration = [];
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
  DateTime? _windowStartedAt;
  String _deviceId = '';
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
  bool _isDisposed = false;

  bool isScanning = false;
  bool isConnecting = false;
  bool isConnected = false;
  bool isStreaming = false;
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
  int? get heartRateBpm => _heartRateBpm;
  int get pendingCount =>
      _pendingSamples.length +
      _pendingStreamBatches.length +
      (_streamReadings.isEmpty ? 0 : 1);

  Future<void> startScan() async {
    connectionError = null;
    try {
      final statuses = await _requestBluetoothPermissions();
      if (statuses.values.any((status) => !status.isGranted)) {
        throw StateError(
            'Izin Bluetooth diperlukan untuk mencari dan menghubungkan Polar H10.');
      }
      if (Platform.isAndroid &&
          await FlutterBluePlus.adapterState.first !=
              BluetoothAdapterState.on) {
        await FlutterBluePlus.turnOn();
      }

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
          connectionError = 'Pemindaian Bluetooth gagal: $e';
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
      connectionError = e.toString();
      isScanning = false;
      _notify();
    }
  }

  Future<Map<Permission, PermissionStatus>>
      _requestBluetoothPermissions() async {
    final permissions = Platform.isAndroid
        ? [
            Permission.bluetoothScan,
            Permission.bluetoothConnect,
            Permission.locationWhenInUse
          ]
        : [Permission.bluetooth, Permission.locationWhenInUse];
    return permissions.request();
  }

  Future<void> stopScan() async {
    await _scanSubscription?.cancel();
    _scanSubscription = null;
    isScanning = false;
    _notify();
  }

  Future<bool> connectToDevice(String id) async {
    if (id.trim().isEmpty) {
      connectionError = 'ID perangkat Bluetooth tidak valid.';
      _notify();
      return false;
    }
    connectionError = null;
    isConnecting = true;
    _notify();
    try {
      final statuses = await _requestBluetoothPermissions();
      if (statuses.values.any((status) => !status.isGranted)) {
        throw StateError(
            'Izin Bluetooth diperlukan untuk menghubungkan Polar H10.');
      }
      await stopScan();
      await _polar.connectToDevice(id);
      return true;
    } catch (e) {
      connectionError = 'Gagal menghubungkan Polar H10: $e';
      isConnecting = false;
      _notify();
      return false;
    }
  }

  void _handleConnected(PolarDeviceInfo device) {
    _deviceId = device.deviceId;
    _deviceName = device.name.isNotEmpty ? device.name : 'Polar H10';
    isConnected = true;
    isConnecting = false;
    connectionError = null;
    _notify();
  }

  void _handleDisconnected(PolarDeviceDisconnectedEvent event) {
    if (_deviceId.isNotEmpty && event.info.deviceId != _deviceId) return;
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

      for (final rr in sample.rrsMs) {
        _expectedRrCount++;
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
    _streamReadings.clear();
    _recentStreamReadings.clear();
    isStreaming = true;
    sampleError = null;
    streamError = null;
    _sampleFlushTimer?.cancel();
    _streamFlushTimer?.cancel();
    _sampleFlushTimer =
        Timer.periodic(const Duration(minutes: 1), (_) => flushSample());
    _streamFlushTimer =
        Timer.periodic(const Duration(seconds: 10), (_) => flushStream());
    _notify();
    return true;
  }

  Future<void> stopStreaming() async {
    _sampleFlushTimer?.cancel();
    _sampleFlushTimer = null;
    _streamFlushTimer?.cancel();
    _streamFlushTimer = null;
    isStreaming = false;
    await flushStream(force: true);
    await flushSample(force: true);
    _notify();
  }

  Future<void> flushStream({bool force = false}) async {
    if (!isStreaming && !force) return;
    if (_streamReadings.isNotEmpty) {
      _pendingStreamBatches.add({
        'provider': 'polar_h10',
        'device_id': _deviceId,
        'activity': _activity,
        'readings': List<Map<String, dynamic>>.from(_streamReadings),
      });
      _streamReadings.clear();
    }
    if (_isUploadingStream || _pendingStreamBatches.isEmpty) return;

    _isUploadingStream = true;
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
      _notify();
    }
  }

  Future<void> flushSample({bool force = false}) async {
    if (!isStreaming && !force) return;
    if (_rrIntervals.length >= 10 && _acceleration.length >= 10) {
      _pendingSamples.add(_createSamplePayload());
      _clearWindow();
    }
    if (_isUploadingSample || _pendingSamples.isEmpty) return;

    _isUploadingSample = true;
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
        lastUploadedAt = DateTime.now();
        sampleError = null;
        _onSampleStored();
      }
    } catch (e) {
      sampleError = 'Gagal menyimpan sampel wearable: $e';
    } finally {
      _isUploadingSample = false;
      _notify();
    }
  }

  Map<String, dynamic> _createSamplePayload() {
    final rr = _rrIntervals.length <= 256
        ? List<int>.from(_rrIntervals)
        : _rrIntervals.sublist(_rrIntervals.length - 256);
    final acceleration = _downsampleAcceleration(_acceleration, 512);
    return {
      'provider': 'polar_h10',
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
    await stopStreaming();
    await stopScan();
    _cancelSensorStreams();
    if (_deviceId.isNotEmpty) {
      await _polar.disconnectFromDevice(_deviceId);
    }
    isConnected = false;
    isConnecting = false;
    _deviceId = '';
    _deviceName = '';
    _notify();
  }

  void _notify() {
    if (!_isDisposed) notifyListeners();
  }

  @override
  void dispose() {
    _isDisposed = true;
    _sampleFlushTimer?.cancel();
    _streamFlushTimer?.cancel();
    _scanSubscription?.cancel();
    _cancelSensorStreams();
    _connectSubscription?.cancel();
    _disconnectSubscription?.cancel();
    _featureSubscription?.cancel();
    if (_deviceId.isNotEmpty) _polar.disconnectFromDevice(_deviceId);
    super.dispose();
  }
}
