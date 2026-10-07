import 'package:flutter/material.dart';
import 'package:polar/polar.dart';
import 'package:provider/provider.dart';

import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';

class WearablePairingScreen extends StatefulWidget {
  const WearablePairingScreen({super.key});

  @override
  State<WearablePairingScreen> createState() => _WearablePairingScreenState();
}

class _WearablePairingScreenState extends State<WearablePairingScreen> {
  String _activity = 'rest';

  static const _activities = <(String, String)>[
    ('Istirahat', 'rest'),
    ('Duduk', 'sitting'),
    ('Berdiri', 'standing'),
    ('Berjalan', 'walking'),
    ('Berlari', 'running'),
    ('Olahraga', 'exercise'),
    ('Tidur', 'sleep'),
    ('Lainnya', 'other'),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<AppState>().wearableBridge.startScan();
    });
  }

  Future<void> _connect(PolarDeviceInfo device) async {
    final bridge = context.read<AppState>().wearableBridge;
    final connected = await bridge.connectToDevice(device.deviceId);
    if (!mounted || connected) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(bridge.error ?? 'Polar H10 gagal dihubungkan.')),
    );
  }

  Future<void> _startStreaming() async {
    final state = context.read<AppState>();
    final bridge = state.wearableBridge;
    if (!bridge.isConnected) return;

    if (!await state.connectWearable('Polar H10')) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content:
                Text(state.dataError ?? 'Preferensi wearable gagal disimpan.')),
      );
      return;
    }

    state.setWearableActivityContext(_activity);
    if (!bridge.startStreaming(_activity)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(bridge.error ?? 'Streaming tidak dapat dimulai.')),
      );
    }
  }

  Future<void> _stopStreaming() async {
    final bridge = context.read<AppState>().wearableBridge;
    await bridge.stopStreaming();
    if (!mounted) return;
    final message = bridge.error;
    if (message != null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final bridge = state.wearableBridge;

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Pairing wearable'),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Hubungkan Polar H10 untuk mengirim HR, RR/IBI, dan akselerasi ke backend CAPAR melalui RabbitMQ.',
            style: AppTheme.font(
                size: 13, color: AppTheme.textSecondary, height: 1.45),
          ),
          const SizedBox(height: 16),
          Card(
            color: Colors.white,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        bridge.isConnected
                            ? Icons.bluetooth_connected
                            : Icons.bluetooth_searching,
                        color: bridge.isConnected
                            ? AppTheme.statusGreen
                            : AppTheme.textMuted,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          bridge.isConnected
                              ? bridge.deviceName
                              : 'Polar H10 belum terhubung',
                          style: AppTheme.font(
                              size: 15,
                              weight: FontWeight.w800,
                              color: AppTheme.textPrimary),
                        ),
                      ),
                    ],
                  ),
                  if (bridge.isConnected) ...[
                    const SizedBox(height: 8),
                    Text(
                      bridge.isStreaming
                          ? 'Streaming aktif • ${bridge.pendingCount} batch menunggu pengiriman'
                          : 'Perangkat terhubung; streaming belum dimulai.',
                      style: AppTheme.font(
                          size: 12, color: AppTheme.textSecondary),
                    ),
                    if (bridge.heartRateBpm != null) ...[
                      const SizedBox(height: 6),
                      Text(
                        'HR saat ini: ${bridge.heartRateBpm} bpm',
                        style: AppTheme.font(
                            size: 12, color: AppTheme.textSecondary),
                      ),
                    ],
                    if (bridge.lastUploadedAt != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Sampel terakhir diterima server: ${bridge.lastUploadedAt!.toLocal()}',
                        style:
                            AppTheme.font(size: 11, color: AppTheme.textMuted),
                      ),
                    ],
                    if (bridge.lastStreamPublishedAt != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        'Batch terakhir diterima RabbitMQ: ${bridge.lastStreamPublishedAt!.toLocal()}',
                        style:
                            AppTheme.font(size: 11, color: AppTheme.textMuted),
                      ),
                    ],
                    if (bridge.error != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        bridge.error!,
                        style:
                            AppTheme.font(size: 12, color: AppTheme.statusRed),
                      ),
                    ],
                    const SizedBox(height: 16),
                    DropdownButtonFormField<String>(
                      initialValue: _activity,
                      decoration:
                          const InputDecoration(labelText: 'Konteks aktivitas'),
                      items: _activities
                          .map((activity) => DropdownMenuItem(
                                value: activity.$2,
                                child: Text(activity.$1),
                              ))
                          .toList(),
                      onChanged: (value) {
                        if (value != null) {
                          setState(() => _activity = value);
                          context
                              .read<AppState>()
                              .setWearableActivityContext(value);
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: bridge.isUploading
                            ? null
                            : bridge.isStreaming
                                ? _stopStreaming
                                : _startStreaming,
                        icon: Icon(
                            bridge.isStreaming ? Icons.stop : Icons.sensors),
                        label: Text(bridge.isStreaming
                            ? 'Hentikan streaming'
                            : 'Mulai streaming'),
                      ),
                    ),
                    OutlinedButton.icon(
                      onPressed: bridge.isUploading ? null : bridge.disconnect,
                      icon: const Icon(Icons.bluetooth_disabled),
                      label: const Text('Putuskan perangkat'),
                    ),
                  ] else ...[
                    const SizedBox(height: 14),
                    if (bridge.error != null)
                      Text(
                        bridge.error!,
                        style:
                            AppTheme.font(size: 12, color: AppTheme.statusRed),
                      ),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            bridge.isScanning
                                ? 'Mencari perangkat Bluetooth…'
                                : 'Pastikan Polar H10 aktif dan berada dekat ponsel.',
                            style: AppTheme.font(
                                size: 12, color: AppTheme.textSecondary),
                          ),
                        ),
                        IconButton(
                          onPressed:
                              bridge.isScanning ? null : bridge.startScan,
                          tooltip: 'Pindai ulang',
                          icon: const Icon(Icons.refresh),
                        ),
                      ],
                    ),
                    if (bridge.isScanning) const LinearProgressIndicator(),
                  ],
                ],
              ),
            ),
          ),
          if (!bridge.isConnected) ...[
            const SizedBox(height: 16),
            Text(
              'Perangkat ditemukan',
              style: AppTheme.font(
                  size: 14,
                  weight: FontWeight.w800,
                  color: AppTheme.textPrimary),
            ),
            const SizedBox(height: 8),
            if (bridge.devices.isEmpty && !bridge.isScanning)
              Text(
                'Tidak ada perangkat yang terdeteksi. Pindai ulang setelah memeriksa Bluetooth dan izin perangkat.',
                style: AppTheme.font(size: 12, color: AppTheme.textMuted),
              ),
            ...bridge.devices.map(
              (device) => Card(
                color: Colors.white,
                child: ListTile(
                  leading: const Icon(Icons.favorite, color: AppTheme.primary),
                  title: Text(device.name.isEmpty ? 'Polar H10' : device.name),
                  subtitle: Text(device.deviceId),
                  trailing: bridge.isConnecting
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.chevron_right),
                  onTap: bridge.isConnecting ? null : () => _connect(device),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
