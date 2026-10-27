import 'dart:async';

import 'package:flutter/material.dart';
import 'package:polar/polar.dart';
import 'package:provider/provider.dart';

import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';

class WearablePairingScreen extends StatefulWidget {
  const WearablePairingScreen({
    super.key,
    this.startStreamingAndReturnHome = true,
    this.activityOverride,
  });

  final bool startStreamingAndReturnHome;
  final String? activityOverride;

  @override
  State<WearablePairingScreen> createState() => _WearablePairingScreenState();
}

class _WearablePairingScreenState extends State<WearablePairingScreen> {
  String _activity = 'rest';
  bool _activityConfirmed = false;
  String? _activityPromptCancelledForDevice;
  bool _isActivityPromptVisible = false;
  String? _preparingDeviceId;
  bool _isPreparingStream = false;
  AppState? _appState;

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
      if (!mounted) return;
      final state = context.read<AppState>();
      _appState = state;
      _activity = widget.activityOverride ?? mapActivityToApi(state.activity);
      _activityConfirmed = widget.activityOverride != null;
      final bridge = state.wearableBridge;
      bridge.addListener(_handleBridgeChange);
      if (bridge.isConnected) {
        _handleBridgeChange();
        return;
      }
      if (bridge.isConnecting || bridge.isAutoReconnecting) return;
      if (bridge.hasSavedDevice) {
        unawaited(bridge.restoreSavedDeviceAndAutoConnect());
        return;
      }
      bridge.startScan();
    });
  }

  void _handleBridgeChange() {
    if (!widget.startStreamingAndReturnHome || !mounted) return;
    final bridge = context.read<AppState>().wearableBridge;
    if (bridge.isStreaming) {
      if (!_isPreparingStream) Navigator.of(context).pop();
      return;
    }
    if (!bridge.isConnected) {
      _preparingDeviceId = null;
      return;
    }
    if (_activityPromptCancelledForDevice == bridge.deviceId) return;
    if (_isPreparingStream || _preparingDeviceId == bridge.deviceId) return;
    _preparingDeviceId = bridge.deviceId;
    _isPreparingStream = true;
    unawaited(_activateStreamAndReturnHome());
  }

  Future<void> _activateStreamAndReturnHome() async {
    final state = context.read<AppState>();
    final bridge = state.wearableBridge;
    final ready = await bridge.waitForSensorStreams();
    if (!mounted) return;
    if (!ready) {
      _showPairingError(
        bridge.error ??
            'Perangkat tersambung, tetapi stream sensor belum siap.',
      );
      _isPreparingStream = false;
      _preparingDeviceId = null;
      return;
    }

    if (!await _confirmActivityBeforeRecording()) {
      _isPreparingStream = false;
      _preparingDeviceId = null;
      _activityPromptCancelledForDevice = bridge.deviceId;
      return;
    }

    final deviceName =
        bridge.isDemoDevice ? 'VidyaMedic Dummy Sensor' : 'Polar H10';
    if (!await state.connectWearable(deviceName)) {
      if (!mounted) return;
      _showPairingError(
        state.dataError ?? 'Preferensi wearable gagal disimpan.',
      );
      _isPreparingStream = false;
      return;
    }

    state.setWearableActivityContext(_activity);
    if (!bridge.startStreaming(_activity)) {
      if (!mounted) return;
      _showPairingError(
        bridge.error ?? 'Streaming wearable tidak dapat dimulai.',
      );
      _isPreparingStream = false;
      return;
    }

    if (!mounted) return;
    Navigator.of(context).pop();
  }

  Future<bool> _confirmActivityBeforeRecording() async {
    if (widget.activityOverride != null) {
      _activity = widget.activityOverride!;
      context.read<AppState>().setWearableActivityContext(_activity);
      return true;
    }
    if (_activityConfirmed) return true;
    if (_isActivityPromptVisible) return false;
    _isActivityPromptVisible = true;
    var selectedActivity = _activity;
    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: const Text('Pilih aktivitas sebelum merekam'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Pastikan aktivitas atau posisi Anda saat ini agar bacaan wearable memiliki konteks yang benar.',
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: selectedActivity,
                decoration:
                    const InputDecoration(labelText: 'Aktivitas saat ini'),
                items: _activities
                    .map((activity) => DropdownMenuItem(
                          value: activity.$2,
                          child: Text(activity.$1),
                        ))
                    .toList(),
                onChanged: (value) {
                  if (value != null) {
                    setDialogState(() => selectedActivity = value);
                  }
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Nanti'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Konfirmasi & mulai'),
            ),
          ],
        ),
      ),
    );
    _isActivityPromptVisible = false;
    if (!mounted || confirmed != true) return false;
    setState(() {
      _activity = selectedActivity;
      _activityConfirmed = true;
      _activityPromptCancelledForDevice = null;
    });
    context.read<AppState>().setWearableActivityContext(_activity);
    return true;
  }

  void _showPairingError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  Future<void> _connect(PolarDeviceInfo device) async {
    final bridge = context.read<AppState>().wearableBridge;
    final connected = await bridge.connectToDevice(device.deviceId);
    if (!mounted || connected) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(bridge.error ?? 'Polar H10 gagal dihubungkan.')),
    );
  }

  @override
  void dispose() {
    final bridge = _appState?.wearableBridge;
    if (bridge != null) bridge.removeListener(_handleBridgeChange);
    super.dispose();
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
    if (!await _confirmActivityBeforeRecording()) return;

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
                      _isPreparingStream
                          ? 'Perangkat tersambung • menyiapkan streaming dan beranda...'
                          : bridge.isStreaming
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
                    if (bridge.lastMongoPersistedAt != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        '${bridge.lastMongoPersistedCount} bacaan tersimpan di MongoDB: ${TimeOfDay.fromDateTime(bridge.lastMongoPersistedAt!.toLocal()).format(context)}',
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
                          setState(() {
                            _activity = value;
                            _activityConfirmed = true;
                            _activityPromptCancelledForDevice = null;
                          });
                          context
                              .read<AppState>()
                              .setWearableActivityContext(value);
                        }
                      },
                      isExpanded: true,
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: bridge.isUploading || _isPreparingStream
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
                                : bridge.isConnecting && bridge.hasSavedDevice
                                    ? 'Menghubungkan ulang ke Polar H10 tersimpan…'
                                    : bridge.isAutoReconnecting
                                        ? 'Auto-pair aktif; mencoba kembali otomatis…'
                                        : 'Pastikan Polar H10 aktif dan berada dekat ponsel.',
                            style: AppTheme.font(
                                size: 12, color: AppTheme.textSecondary),
                          ),
                        ),
                        IconButton(
                          onPressed: bridge.isScanning || bridge.isConnecting
                              ? null
                              : bridge.startScan,
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
