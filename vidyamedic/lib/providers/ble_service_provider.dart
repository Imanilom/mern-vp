import 'package:flutter/material.dart';
import '../services/ble_service.dart';

/// Provider untuk BleService yang dapat digunakan dengan Provider pattern
/// 
/// Usage:
/// ```dart
/// final bleServiceProvider = BleServiceProvider();
/// 
/// // Di screen
/// context.watch<BleService>()  // Watch untuk perubahan
/// context.read<BleService>()   // Read untuk action
/// ```

class BleServiceProvider extends ChangeNotifier {
  static final BleServiceProvider _instance = BleServiceProvider._internal();

  factory BleServiceProvider() {
    return _instance;
  }

  BleServiceProvider._internal();

  late BleService _bleService;
  bool _isInitialized = false;

  /// Initialize BleService (panggil saat app startup)
  Future<void> initialize() async {
    if (_isInitialized) return;
    _bleService = BleService();
    _bleService.addListener(_notifyListeners);
    _isInitialized = true;
    notifyListeners();
  }

  /// Get instance BleService
  BleService get instance => _bleService;

  /// Notify listeners ketika BleService berubah
  void _notifyListeners() {
    notifyListeners();
  }

  @override
  void dispose() {
    _bleService.removeListener(_notifyListeners);
    _bleService.dispose();
    super.dispose();
  }
}

/// Provider wrapper untuk memudahkan akses via Provider.of<BleService>
class BleServiceWrapper extends ChangeNotifier {
  final BleService bleService = BleService();

  BleServiceWrapper() {
    bleService.addListener(_onBleServiceChanged);
  }

  void _onBleServiceChanged() {
    notifyListeners();
  }

  @override
  void dispose() {
    bleService.removeListener(_onBleServiceChanged);
    bleService.dispose();
    super.dispose();
  }
}
