import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../theme/app_colors.dart';
import '../../services/ble_service.dart';

class DevicePairingScreen extends StatefulWidget {
  const DevicePairingScreen({super.key});

  @override
  State<DevicePairingScreen> createState() => _DevicePairingScreenState();
}

class _DevicePairingScreenState extends State<DevicePairingScreen> {
  bool _isScanning = false;
  List<ScanResult> _scanResults = [];
  StreamSubscription? _scanSub;
  bool _isConnecting = false;

  @override
  void initState() {
    super.initState();
    _checkPermissionsAndScan();
  }

  Future<void> _checkPermissionsAndScan() async {
    bool hasPermissions = await BleService.requestPermissions();
    if (hasPermissions) {
      _startScan();
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Izin Bluetooth/Lokasi dibutuhkan untuk mencari perangkat H10.')),
        );
      }
    }
  }

  void _startScan() {
    setState(() {
      _isScanning = true;
      _scanResults.clear();
    });

    _scanSub = BleService.scanForPolar().listen((results) {
      if (mounted) {
        setState(() {
          _scanResults = results;
        });
      }
    });

    Future.delayed(const Duration(seconds: 10), () {
      if (mounted) {
        setState(() {
          _isScanning = false;
        });
      }
    });
  }

  @override
  void dispose() {
    _scanSub?.cancel();
    BleService.stopScan();
    super.dispose();
  }

  Future<void> _connect(BluetoothDevice device) async {
    BleService.stopScan();
    setState(() => _isConnecting = true);

    bool success = await BleService.connectToDevice(device);
    
    if (mounted) {
      setState(() => _isConnecting = false);
      if (success) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool('dummy_mode', false);
        
        // Start background service
        final service = FlutterBackgroundService();
        await service.startService();

        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Berhasil terhubung ke ${device.platformName}!')),
        );
        Navigator.pushReplacementNamed(context, '/baseline');
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Gagal terhubung atau Heart Rate Service tidak ditemukan.')),
        );
      }
    }
  }

  Future<void> _useDummyMode() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('dummy_mode', true);
    
    final service = FlutterBackgroundService();
    await service.startService();
    
    if (mounted) {
      Navigator.pushReplacementNamed(context, '/baseline');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.navy),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Hubungkan Perangkat', style: TextStyle(color: AppColors.navy, fontSize: 16)),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Cari Polar H10',
                style: TextStyle(
                  fontFamily: 'Plus Jakarta Sans',
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Pastikan Bluetooth Anda menyala dan sensor sudah terpasang di dada.',
                style: TextStyle(fontSize: 14, color: AppColors.gray),
              ),
              const SizedBox(height: 20),

              if (_isScanning)
                const Center(child: CircularProgressIndicator())
              else if (_scanResults.isEmpty)
                const Center(
                  child: Text(
                    'Tidak menemukan perangkat Polar H10.',
                    style: TextStyle(color: AppColors.gray),
                  ),
                ),

              Expanded(
                child: ListView.builder(
                  itemCount: _scanResults.length,
                  itemBuilder: (context, index) {
                    final r = _scanResults[index];
                    return Card(
                      color: AppColors.surface,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: const BorderSide(color: AppColors.line),
                      ),
                      child: ListTile(
                        leading: const Icon(Icons.bluetooth, color: AppColors.teal),
                        title: Text(r.device.platformName, style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text(r.device.remoteId.toString()),
                        trailing: _isConnecting
                            ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                            : ElevatedButton(
                                onPressed: () => _connect(r.device),
                                style: ElevatedButton.styleFrom(backgroundColor: AppColors.teal, foregroundColor: Colors.white),
                                child: const Text('Hubungkan'),
                              ),
                      ),
                    );
                  },
                ),
              ),

              const SizedBox(height: 20),
              
              // Fallback / Testing option
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: _useDummyMode,
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: const BorderSide(color: AppColors.teal),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  child: const Text(
                    'Gunakan Dummy Mode (Untuk Emulator)',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.teal),
                  ),
                ),
              ),
              
              const SizedBox(height: 12),
              
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _isScanning ? null : _startScan,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.navy,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: Text(
                    _isScanning ? 'Mencari...' : 'Pindai Ulang',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
