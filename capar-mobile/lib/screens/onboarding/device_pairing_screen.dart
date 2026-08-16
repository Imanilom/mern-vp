import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_blue_plus/flutter_blue_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../theme/app_colors.dart';
import '../../services/ble_service.dart';
import '../../services/mqtt_service.dart';
import '../../services/telemetry_controller.dart';

class DevicePairingScreen extends ConsumerStatefulWidget {
  const DevicePairingScreen({super.key});

  @override
  ConsumerState<DevicePairingScreen> createState() => _DevicePairingScreenState();
}

class _DevicePairingScreenState extends ConsumerState<DevicePairingScreen> {
  String _selectedActivity = 'Duduk';
  final List<String> _activities = [
    'Tidur', 'Berbaring', 'Duduk', 'Berdiri', 'Berjalan', 
    'Berjalan Cepat', 'Naik Tangga', 'Bersepeda', 'Berenang',
    'Senam', 'Yoga', 'Berlari', 'Lari Cepat', 'Olahraga Berat',
    'Makan', 'Memasak', 'Berkendara', 'Bekerja', 'Lainnya'
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(bleServiceProvider).startScan();
    });
  }

  Future<void> _startStreaming() async {
    final ble = ref.read(bleServiceProvider);
    final mqtt = ref.read(mqttServiceProvider);
    final telemetry = ref.read(telemetryControllerProvider);

    if (!ble.isConnected) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Hubungkan Polar H10 terlebih dahulu!')));
      return;
    }

    // Show loading
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (c) => const Center(child: CircularProgressIndicator(color: AppColors.teal)),
    );

    final prefs = await SharedPreferences.getInstance();
    final userId = prefs.getString('user_id') ?? 'P012'; // Fallback to P012 if not found
    
    // Connect MQTT
    bool mqttConnected = await mqtt.connect(userId);
    
    if (!mounted) return;
    Navigator.pop(context); // hide loading

    if (!mqttConnected) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Gagal terhubung ke RabbitMQ Broker!')));
      return;
    }

    // Start Telemetry buffering
    telemetry.startStreaming(userId, ble.deviceName);
    
    // Go to next screen (Dashboard)
    Navigator.pushNamed(context, '/app');
  }

  @override
  Widget build(BuildContext context) {
    final bleState = ref.watch(bleServiceProvider);
    
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(
        backgroundColor: AppColors.bg,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: AppColors.navy),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Pairing & Aktivitas',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.navy),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 8.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (!bleState.isConnected) ...[
                      const Text(
                        'Pindai Perangkat',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.navy),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Pastikan Bluetooth aktif dan Polar H10 Anda menyala.',
                        style: TextStyle(fontSize: 14, color: AppColors.gray),
                      ),
                      const SizedBox(height: 20),
                      _buildScanResults(bleState),
                    ] else ...[
                      const Text(
                        'Perangkat Terhubung',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: AppColors.navy),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Terhubung ke ${bleState.deviceName}. Kualitas Sinyal: ${bleState.signalQuality}% | Baterai: ${bleState.batteryLevel}%',
                        style: const TextStyle(fontSize: 14, color: AppColors.gray),
                      ),
                      const SizedBox(height: 32),
                      const Text(
                        'Pilih Aktivitas Saat Ini',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.navy),
                      ),
                      const SizedBox(height: 12),
                      _buildActivityDropdown(bleState),
                    ]
                  ],
                ),
              ),
            ),

            // Action Button Container
            if (bleState.isConnected)
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 10,
                      offset: const Offset(0, -3),
                    ),
                  ],
                ),
                child: SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: ElevatedButton(
                    onPressed: _startStreaming,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.teal,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: const Text(
                      'Mulai Streaming ke RMQ',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildScanResults(BleService bleService) {
    return StreamBuilder<List<ScanResult>>(
      stream: bleService.scanResults,
      builder: (context, snapshot) {
        if (!snapshot.hasData || snapshot.data!.isEmpty) {
          return _buildLoadingScan(bleService);
        }

        // Hanya tampilkan device yang namanya mengandung "Polar"
        final polarDevices = snapshot.data!.where((r) {
          final pName = r.device.platformName.toLowerCase();
          final aName = r.advertisementData.advName.toLowerCase();
          return pName.contains('polar') || aName.contains('polar');
        }).toList();

        if (polarDevices.isEmpty) {
          return _buildLoadingScan(bleService);
        }

        return ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: polarDevices.length,
          itemBuilder: (context, index) {
            final result = polarDevices[index];
            final advName = result.advertisementData.advName;
            final platformName = result.device.platformName;

            String name = platformName.isNotEmpty ? platformName : advName;

            return Card(
              color: AppColors.surface,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: AppColors.line),
              ),
              child: ListTile(
                leading: const Icon(Icons.bluetooth, color: AppColors.teal),
                title: Text(name, style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.navy)),
                subtitle: Text(result.device.remoteId.toString(), style: const TextStyle(fontSize: 12, color: AppColors.gray)),
                trailing: TextButton(
                  onPressed: () => bleService.connectToDevice(result.device),
                  child: const Text('Hubungkan', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.teal)),
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildLoadingScan(BleService bleService) {
    return Center(
      child: Column(
        children: [
          const SizedBox(height: 40),
          const CircularProgressIndicator(color: AppColors.teal),
          const SizedBox(height: 16),
          const Text('Mencari perangkat Polar...', style: TextStyle(color: AppColors.gray)),
          TextButton(
            onPressed: () => bleService.startScan(),
            child: const Text('Pindai Ulang', style: TextStyle(color: AppColors.teal)),
          )
        ],
      ),
    );
  }

  Widget _buildActivityDropdown(BleService bleService) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.line),
        borderRadius: BorderRadius.circular(12),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedActivity,
          isExpanded: true,
          icon: const Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.gray),
          dropdownColor: AppColors.surface,
          items: _activities.map((String act) {
            return DropdownMenuItem<String>(
              value: act,
              child: Text(act, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.navy)),
            );
          }).toList(),
          onChanged: (String? newValue) {
            if (newValue != null) {
              setState(() => _selectedActivity = newValue);
              bleService.updateMotionState(newValue);
            }
          },
        ),
      ),
    );
  }
}
