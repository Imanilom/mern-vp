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

  Future<void> _connectDummy() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Gunakan sensor demo?'),
        content: const Text(
          'HR, RR/IBI, dan akselerasi akan dibuat secara sintetis dan disimpan dengan penanda simulasi. Data demo tidak mewakili kondisi tubuh dan tidak digunakan untuk baseline atau analisis CAPAR.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Aktifkan demo'),
          ),
        ],
      ),
    );
    if (!mounted || confirmed != true) return;
    final connected =
        await context.read<AppState>().wearableBridge.connectDummyDevice();
    if (!connected && mounted) {
      final bridge = context.read<AppState>().wearableBridge;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(bridge.error ?? 'Sensor demo gagal diaktifkan.')),
      );
    }
  }

  Future<void> _startStreaming() async {
    final state = context.read<AppState>();
    final bridge = state.wearableBridge;
    if (!bridge.isConnected) return;

    final deviceName =
        bridge.isDemoDevice ? 'VidyaMedic Dummy Sensor' : 'Polar H10';
    if (!await state.connectWearable(deviceName)) {
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
                    if (bridge.isDemoDevice)
                      Container(
                        margin: const EdgeInsets.only(bottom: 10),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppTheme.statusYellowBg,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                              color: AppTheme.statusYellow
                                  .withValues(alpha: 0.35)),
                        ),
                        child: Text(
                          'MODE DEMO: HR/RR 1 Hz dan ACC 10 Hz adalah data sintetis. Sampel diberi penanda simulasi dan tidak dipakai untuk analisis kesehatan CAPAR.',
                          style: AppTheme.font(
                              size: 11.5,
                              color: AppTheme.textPrimary,
                              height: 1.35,
                              weight: FontWeight.w600),
                        ),
                      ),
                    Text(
                      bridge.isStreaming
                          ? bridge.isDemoDevice
                              ? 'Perekaman demo aktif • ${bridge.sessionWindowCount} window tersimpan'
                              : 'Streaming aktif • ${bridge.pendingCount} batch menunggu pengiriman'
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
                      if (bridge.isDemoDevice && bridge.isStreaming)
                        Text(
                          'RR: ${bridge.sessionRrIntervalCount} interval · ACC: ${bridge.sessionAccelerationCount} sampel · minimal 10 detik sebelum simpan',
                          style: AppTheme.font(
                              size: 11, color: AppTheme.textSecondary),
                        ),
                      if (bridge.isStreaming) ...[
                        const SizedBox(height: 4),
                        Text(
                          bridge.streamError ??
                              (bridge.lastStreamPublishedAt == null
                                  ? 'RabbitMQ: menunggu batch pertama (maks. 10 detik)'
                                  : 'RabbitMQ: batch terakhir diterima ${TimeOfDay.fromDateTime(bridge.lastStreamPublishedAt!.toLocal()).format(context)}'),
                          style: AppTheme.font(
                            size: 11,
                            color: bridge.streamError == null
                                ? AppTheme.textSecondary
                                : AppTheme.statusRed,
                            weight: FontWeight.w600,
                          ),
                        ),
                      ],
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
                        label: Text(
                          bridge.isStreaming
                              ? bridge.isDemoDevice
                                  ? 'Hentikan rekaman demo'
                                  : 'Hentikan streaming'
                              : bridge.isDemoDevice
                                  ? 'Mulai rekam demo'
                                  : 'Mulai streaming',
                        ),
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
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: bridge.isConnecting ? null : _connectDummy,
                      icon: const Icon(Icons.science_outlined),
                      label: const Text('Gunakan sensor dummy (DEMO)'),
                    ),
                    Text(
                      'Untuk uji alur aplikasi saja. Data sintetis diberi penanda dan tidak digunakan untuk baseline atau analisis kesehatan.',
                      textAlign: TextAlign.center,
                      style: AppTheme.font(
                          size: 10.5, color: AppTheme.textMuted, height: 1.35),
                    ),
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
