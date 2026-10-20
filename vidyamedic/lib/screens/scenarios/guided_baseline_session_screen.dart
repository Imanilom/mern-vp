import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/app_state.dart';
import '../../services/wearable_pairing_service.dart';
import '../../theme/app_theme.dart';
import 'guided_baseline_ema_screen.dart';
import '../profile/wearable_pairing_screen.dart';

class GuidedBaselineSessionScreen extends StatefulWidget {
  const GuidedBaselineSessionScreen({super.key});

  @override
  State<GuidedBaselineSessionScreen> createState() =>
      _GuidedBaselineSessionScreenState();
}

class _GuidedBaselineSessionScreenState
    extends State<GuidedBaselineSessionScreen> {
  static const _stages = <(String, String, String)>[
    ('sitting', 'Duduk', 'Duduk tenang dan usahakan posisi tetap nyaman.'),
    ('standing', 'Berdiri', 'Berdiri hanya jika terasa aman dan nyaman.'),
    (
      'walking',
      'Berjalan',
      'Berjalan santai di area yang aman; tahap ini boleh dilewati.'
    ),
    ('sitting', 'Duduk kembali', 'Duduk dan biarkan tubuh beristirahat.'),
  ];
  static const _stageDuration = Duration(minutes: 5);

  int _stageIndex = 0;
  int _remainingSeconds = _stageDuration.inSeconds;
  Timer? _timer;
  bool _stageRunning = false;
  bool _finishingStage = false;
  bool _emaSaved = false;
  String? _error;
  final List<Map<String, dynamic>> _stageResults = [];

  @override
  void dispose() {
    _timer?.cancel();
    final wearable = context.read<AppState>().wearableBridge;
    if (wearable.isStreaming) unawaited(wearable.stopStreaming());
    super.dispose();
  }

  Future<bool> _confirmParticipation() async {
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Sesi pengukuran personal'),
        content: const Text(
          'Sesi ini merekam data Polar H10 nyata selama 5 menit per konteks: duduk, berdiri, berjalan santai, lalu duduk kembali. Aktivitas berdiri dan berjalan bersifat sukarela; Anda dapat melewati tahap atau menghentikan sesi kapan saja. Jangan lakukan gerakan yang terasa tidak aman. Lima menit belum menjamin baseline matang; CAPAR dapat memerlukan rekaman berkualitas pada beberapa waktu/hari.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Saya siap'),
          ),
        ],
      ),
    );
    return accepted == true;
  }

  Future<void> _startStage() async {
    if (_stageIndex >= _stages.length || _stageRunning || _finishingStage) {
      return;
    }
    if (_stageIndex == 0 && _stageResults.isEmpty) {
      if (!await _confirmParticipation() || !mounted) return;
    }
    final appState = context.read<AppState>();
    if (!appState.wearableBridge.isConnected) {
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => const WearablePairingScreen(),
        ),
      );
      if (!mounted || !appState.wearableBridge.isConnected) return;
    }
    if (appState.wearableBridge.pendingCount > 0) {
      final uploaded = await appState.wearableBridge.flushPendingUploads();
      if (!mounted) return;
      if (!uploaded) {
        setState(() {
          _error = appState.wearableBridge.error ??
              'Data sesi sebelumnya belum terkirim. Periksa koneksi sebelum memulai konteks berikutnya.';
        });
        return;
      }
    }
    final activity = _stages[_stageIndex].$1;
    if (!appState.wearableBridge.startStreaming(activity)) {
      setState(() {
        _error = appState.wearableBridge.error ??
            'Perekaman belum dapat dimulai. Pastikan HR/RR dan akselerometer tersedia.';
      });
      return;
    }
    setState(() {
      _error = null;
      _remainingSeconds = _stageDuration.inSeconds;
      _stageRunning = true;
    });
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return timer.cancel();
      if (_remainingSeconds <= 1) {
        timer.cancel();
        unawaited(_finishStage());
      } else {
        setState(() => _remainingSeconds--);
      }
    });
  }

  Future<void> _finishStage({bool skipped = false}) async {
    if (_finishingStage) return;
    _timer?.cancel();
    final wearable = context.read<AppState>().wearableBridge;
    final wasRunning = _stageRunning && wearable.isStreaming;
    final activity = _stages[_stageIndex].$1;
    setState(() {
      _finishingStage = true;
      _stageRunning = false;
    });
    if (wearable.isStreaming) {
      await wearable.stopStreaming();
    }
    if (!mounted) return;
    final result = <String, dynamic>{
      'activity': activity,
      'label': _stages[_stageIndex].$2,
      'skipped': skipped && !wasRunning,
      'incomplete': skipped && wasRunning,
      'minimum_hr': wasRunning ? wearable.sessionMinimumHeartRate : null,
      'maximum_hr': wasRunning ? wearable.sessionMaximumHeartRate : null,
      'rr_interval_count': wasRunning ? wearable.sessionRrIntervalCount : 0,
      'reading_count': wasRunning ? wearable.sessionReadingCount : 0,
      'window_count': wasRunning ? wearable.sessionWindowCount : 0,
      'finished_at': DateTime.now().toIso8601String(),
    };
    final streamError = wearable.streamError ?? wearable.sampleError;
    setState(() {
      _stageResults.add(result);
      _stageIndex++;
      _remainingSeconds = _stageDuration.inSeconds;
      _finishingStage = false;
      if (streamError != null) {
        _error = 'Sebagian data gagal dikirim: $streamError';
      }
    });
    if (_stageIndex == _stages.length && mounted) {
      await context.read<AppState>().fetchCaparInsights();
    }
  }

  Future<void> _openEmaScreen() async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => GuidedBaselineEmaScreen(
          stageResults: _stageResults
              .map((result) => Map<String, dynamic>.from(result))
              .toList(),
        ),
      ),
    );
    if (!mounted || saved != true) return;
    setState(() {
      _emaSaved = true;
      _error = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final appState = context.watch<AppState>();
    final wearable = appState.wearableBridge;
    final isComplete = _stageIndex >= _stages.length;
    final stage = isComplete ? null : _stages[_stageIndex];
    final seconds = _remainingSeconds % 60;
    final minutes = _remainingSeconds ~/ 60;
    return Scaffold(
      appBar: AppBar(title: const Text('Perekaman baseline terpandu')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _introCard(),
          const SizedBox(height: 12),
          if (_error != null) _message(_error!, isError: true),
          if (!isComplete) ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 22,
                          backgroundColor: AppTheme.primarySoft,
                          child: Icon(
                            _stageIcon(stage!.$1),
                            color: AppTheme.primary,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'KONTEKS ${_stageIndex + 1} DARI ${_stages.length}',
                                style: AppTheme.font(
                                  size: 10,
                                  color: AppTheme.textMuted,
                                  weight: FontWeight.w700,
                                  letterSpacing: 0.5,
                                ),
                              ),
                              const SizedBox(height: 3),
                              Text(
                                stage.$2,
                                style: AppTheme.font(
                                    size: 20, weight: FontWeight.w800),
                              ),
                            ],
                          ),
                        ),
                        if (_stageRunning)
                          const Icon(Icons.radio_button_checked_rounded,
                              color: AppTheme.statusGreen, size: 20),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(stage.$3,
                        style: AppTheme.font(
                            size: 12,
                            color: AppTheme.textSecondary,
                            height: 1.4)),
                    const SizedBox(height: 16),
                    if (_stageRunning) ...[
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppTheme.primarySoft,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: AppTheme.borderLight),
                        ),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.timer_outlined,
                                    color: AppTheme.primary),
                                const SizedBox(width: 8),
                                Text(
                                  'Waktu perekaman',
                                  style: AppTheme.font(
                                      size: 12, weight: FontWeight.w700),
                                ),
                                const Spacer(),
                                Text(
                                  '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}',
                                  style: AppTheme.font(
                                    size: 28,
                                    weight: FontWeight.w900,
                                    color: AppTheme.primaryDark,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(6),
                              child: LinearProgressIndicator(
                                minHeight: 7,
                                value: 1 -
                                    _remainingSeconds /
                                        _stageDuration.inSeconds,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      _heartRateSummary(
                        current: wearable.heartRateBpm,
                        minimum: wearable.sessionMinimumHeartRate,
                        maximum: wearable.sessionMaximumHeartRate,
                      ),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: _metric(
                              'Interval antardetak',
                              wearable.sessionRrIntervalCount,
                              'RR/IBI',
                              Icons.waves_rounded,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _metric(
                              'Titik terkumpul',
                              wearable.sessionReadingCount,
                              'titik',
                              Icons.sensors_rounded,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _metric(
                              'Window tersimpan',
                              wearable.sessionWindowCount,
                              'window',
                              Icons.view_week_outlined,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      _streamStatus(wearable, context),
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: _finishingStage
                            ? null
                            : () => _finishStage(skipped: true),
                        icon: const Icon(Icons.stop_circle_outlined),
                        label: const Text('Hentikan tahap ini'),
                      ),
                    ] else ...[
                      _connectionStatus(wearable.isConnected),
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: _finishingStage ? null : _startStage,
                              icon: Icon(wearable.isConnected
                                  ? Icons.play_arrow_rounded
                                  : Icons.bluetooth_searching_rounded),
                              label: Text(wearable.isConnected
                                  ? 'Rekam 5 menit'
                                  : 'Sambungkan & mulai'),
                            ),
                          ),
                          if (_stageIndex > 0) ...[
                            const SizedBox(width: 8),
                            TextButton(
                              onPressed: _finishingStage
                                  ? null
                                  : () => _finishStage(skipped: true),
                              child: const Text('Lewati'),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ] else ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Perbandingan pola pribadi dan hasil rekaman',
                        style:
                            AppTheme.font(size: 15, weight: FontWeight.w800)),
                    const SizedBox(height: 5),
                    Text(
                      'CAPAR membandingkan rekaman dengan baseline pada konteks aktivitas dan waktu yang sama. Tahap lima menit ini mengumpulkan bukti; belum berarti baseline sudah matang.',
                      style: AppTheme.font(
                          size: 11.5,
                          color: AppTheme.textSecondary,
                          height: 1.4),
                    ),
                    const SizedBox(height: 10),
                    ..._stageResults.map(_stageResultCard),
                    const SizedBox(height: 12),
                    _baselineComparison(),
                  ],
                ),
              ),
            ),
            Card(
              clipBehavior: Clip.antiAlias,
              child: ExpansionTile(
                leading: const Icon(Icons.menu_book_outlined,
                    color: AppTheme.primary),
                title: Text(
                  'Tahap 3A · Memahami tubuh Anda',
                  style: AppTheme.font(size: 14, weight: FontWeight.w800),
                ),
                subtitle: const Text(
                  'Enam panduan untuk membaca hasil dengan konteks dan batasnya.',
                ),
                children: appState.pedagogyAnswers
                    .map(
                      (answer) => ExpansionTile(
                        tilePadding: const EdgeInsets.symmetric(horizontal: 16),
                        title: Text(
                          answer.question,
                          style:
                              AppTheme.font(size: 13, weight: FontWeight.w700),
                        ),
                        subtitle: Text(
                          answer.status,
                          style: AppTheme.font(
                              size: 11, color: answer.statusColor),
                        ),
                        childrenPadding:
                            const EdgeInsets.fromLTRB(16, 0, 16, 14),
                        children: [
                          if (answer.algorithm.isNotEmpty) ...[
                            Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                'Cara membaca',
                                style: AppTheme.font(
                                    size: 11.5, weight: FontWeight.w700),
                              ),
                            ),
                            const SizedBox(height: 3),
                            Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                answer.algorithm,
                                style: AppTheme.font(
                                    size: 12,
                                    color: AppTheme.textSecondary,
                                    height: 1.35),
                              ),
                            ),
                            const SizedBox(height: 8),
                          ],
                          Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              answer.summary,
                              style: AppTheme.font(
                                  size: 12.5,
                                  weight: FontWeight.w600,
                                  height: 1.35),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Align(
                            alignment: Alignment.centerLeft,
                            child: Text(
                              answer.detail,
                              style: AppTheme.font(
                                  size: 12,
                                  color: AppTheme.textSecondary,
                                  height: 1.4),
                            ),
                          ),
                        ],
                      ),
                    )
                    .toList(),
              ),
            ),
            Card(
              child: ListTile(
                leading: Icon(
                  _emaSaved ? Icons.check_circle : Icons.rate_review_outlined,
                  color: _emaSaved ? AppTheme.statusGreen : AppTheme.primary,
                ),
                title: Text(
                    _emaSaved ? 'Tahap 7 · EMA tersimpan' : 'Tahap 7 · EMA'),
                subtitle: Text(
                  _emaSaved
                      ? 'Pengalaman Anda dicatat terpisah dari hasil sensor.'
                      : 'Tambahkan catatan pengalaman setelah melihat interpretasi sesi.',
                ),
                trailing:
                    _emaSaved ? null : const Icon(Icons.chevron_right_rounded),
                onTap: _emaSaved ? null : _openEmaScreen,
              ),
            ),
          ],
          const SizedBox(height: 12),
          Text(
            'HR adalah denyut per menit. RR/IBI pada Polar H10 berarti interval antardetak dalam milidetik, bukan laju napas. Nilai yang tidak terkumpul tidak akan diisi atau dianggap normal.',
            style: AppTheme.font(
                size: 10.5, color: AppTheme.textMuted, height: 1.35),
          ),
        ],
      ),
    );
  }

  Widget _introCard() => Container(
        padding: const EdgeInsets.all(13),
        decoration: BoxDecoration(
          color: AppTheme.primarySoft,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.borderLight),
        ),
        child: Text(
          'Alur pengukuran L1 → L2 → L3A → EMA. Setiap konteks direkam 5 menit dengan window wearable per menit. Lakukan hanya aktivitas yang aman bagi Anda; Anda boleh berhenti atau melewati tahap.',
          style: AppTheme.font(
              size: 11.5,
              color: AppTheme.primaryDark,
              weight: FontWeight.w600,
              height: 1.4),
        ),
      );

  IconData _stageIcon(String activity) => switch (activity) {
        'standing' => Icons.accessibility_new_rounded,
        'walking' => Icons.directions_walk_rounded,
        _ => Icons.chair_alt_rounded,
      };

  Widget _heartRateSummary({
    required int? current,
    required int? minimum,
    required int? maximum,
  }) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.monitor_heart_outlined,
                  color: AppTheme.statusRed, size: 20),
              const SizedBox(width: 7),
              Text('Detak jantung · bpm',
                  style: AppTheme.font(size: 12, weight: FontWeight.w800)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _heartRateValue('Saat ini', current, emphasized: true),
              ),
              _heartRateDivider(),
              Expanded(child: _heartRateValue('Minimum', minimum)),
              _heartRateDivider(),
              Expanded(child: _heartRateValue('Maksimum', maximum)),
            ],
          ),
          if (minimum == null || maximum == null) ...[
            const SizedBox(height: 9),
            Text(
              'Rentang min–maks akan terhitung otomatis setelah pembacaan HR pertama diterima.',
              style: AppTheme.font(
                  size: 10, color: AppTheme.textMuted, height: 1.35),
            ),
          ],
        ],
      ),
    );
  }

  Widget _heartRateValue(String label, int? value, {bool emphasized = false}) {
    return Column(
      children: [
        Text(
          label,
          textAlign: TextAlign.center,
          style: AppTheme.font(size: 10, color: AppTheme.textMuted),
        ),
        const SizedBox(height: 3),
        Text(
          value?.toString() ?? '—',
          textAlign: TextAlign.center,
          style: AppTheme.font(
            size: emphasized ? 25 : 22,
            weight: FontWeight.w900,
            color: emphasized ? AppTheme.primary : AppTheme.textPrimary,
          ),
        ),
      ],
    );
  }

  Widget _heartRateDivider() => Container(
        width: 1,
        height: 38,
        color: AppTheme.borderLight,
      );

  Widget _metric(String label, Object? value, String unit, IconData icon) {
    final displayed = value is num
        ? '$value${unit == 'RR/IBI' ? ' RR/IBI' : unit.isEmpty ? '' : ' $unit'}'
        : '—';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 10),
      decoration: BoxDecoration(
        color: AppTheme.fieldFill,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 17, color: AppTheme.primary),
          const SizedBox(height: 7),
          Text(
            label,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style:
                AppTheme.font(size: 9, color: AppTheme.textMuted, height: 1.2),
          ),
          const SizedBox(height: 3),
          FittedBox(
            alignment: Alignment.centerLeft,
            fit: BoxFit.scaleDown,
            child: Text(displayed,
                style: AppTheme.font(size: 11, weight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }

  Widget _streamStatus(
    PolarWearablePairingService wearable,
    BuildContext context,
  ) {
    final hasError = wearable.streamError != null;
    final lastPublishedAt = wearable.lastStreamPublishedAt;
    final message = wearable.streamError ??
        (lastPublishedAt == null
            ? 'Menunggu batch pertama; pengiriman berjalan berkala.'
            : 'Batch terakhir diterima ${TimeOfDay.fromDateTime(lastPublishedAt.toLocal()).format(context)}');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 9),
      decoration: BoxDecoration(
        color: hasError ? AppTheme.statusRedBg : AppTheme.statusGreenBg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            hasError
                ? Icons.cloud_off_outlined
                : lastPublishedAt == null
                    ? Icons.cloud_upload_outlined
                    : Icons.cloud_done_outlined,
            size: 17,
            color: hasError ? AppTheme.statusRed : AppTheme.statusGreen,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'RabbitMQ · $message',
              style: AppTheme.font(
                size: 10.5,
                color: hasError ? AppTheme.statusRed : AppTheme.textSecondary,
                weight: FontWeight.w600,
                height: 1.3,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _connectionStatus(bool connected) {
    return Container(
      padding: const EdgeInsets.all(11),
      decoration: BoxDecoration(
        color: connected ? AppTheme.statusGreenBg : AppTheme.fieldFill,
        borderRadius: BorderRadius.circular(11),
      ),
      child: Row(
        children: [
          Icon(
            connected
                ? Icons.bluetooth_connected_rounded
                : Icons.bluetooth_disabled_rounded,
            color: connected ? AppTheme.statusGreen : AppTheme.textMuted,
            size: 19,
          ),
          const SizedBox(width: 9),
          Expanded(
            child: Text(
              connected
                  ? 'Wearable tersambung dan siap merekam.'
                  : 'Sambungkan Polar H10 untuk mulai merekam data nyata.',
              style: AppTheme.font(
                  size: 11,
                  color: AppTheme.textSecondary,
                  weight: FontWeight.w600,
                  height: 1.3),
            ),
          ),
        ],
      ),
    );
  }

  Widget _stageResultCard(Map<String, dynamic> result) {
    final skipped = result['skipped'] == true;
    final minimum = result['minimum_hr'];
    final maximum = result['maximum_hr'];
    final comparison = _findBaseline(result['activity']?.toString());
    final featureStats = comparison?['feature_stats'] is Map
        ? Map<String, dynamic>.from(comparison!['feature_stats'] as Map)
        : <String, dynamic>{};
    final baselineHr = featureStats['mean_hr'] is Map
        ? (featureStats['mean_hr'] as Map)['mean']
        : null;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 7),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: skipped ? AppTheme.fieldFill : Colors.white,
        border: Border.all(color: AppTheme.borderLight),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(result['label']?.toString() ?? 'Konteks',
              style: AppTheme.font(size: 11.5, weight: FontWeight.w700)),
          Text(
            skipped
                ? 'Tahap dilewati; tidak ada pengukuran untuk konteks ini.'
                : '${result['incomplete'] == true ? 'Tahap dihentikan sebelum 5 menit. ' : ''}'
                    'HR min–maks ${minimum ?? '—'}–${maximum ?? '—'} bpm · '
                    '${result['rr_interval_count'] ?? 0} interval RR/IBI · '
                    '${result['reading_count'] ?? 0} titik · '
                    '${result['window_count'] ?? 0} window tersimpan',
            style: AppTheme.font(
                size: 10.5, color: AppTheme.textSecondary, height: 1.35),
          ),
          if (comparison != null) ...[
            const SizedBox(height: 3),
            Text(
              'Baseline CAPAR ${comparison['level'] ?? comparison['maturity_detail']?['level'] ?? 'tersimpan'}'
              '${baselineHr is num ? ' · HR rerata ${baselineHr.toStringAsFixed(1)} bpm' : ''}'
              ' · ${comparison['segment_count'] ?? 0} segmen',
              style: AppTheme.font(
                  size: 10, color: AppTheme.primaryDark, height: 1.3),
            ),
          ] else if (!skipped)
            Text(
              'Belum ditemukan baseline CAPAR pada aktivitas ini. Rekaman tetap tersimpan; perbandingan belum tersedia.',
              style: AppTheme.font(
                  size: 10, color: AppTheme.textMuted, height: 1.3),
            ),
        ],
      ),
    );
  }

  Map<String, dynamic>? _findBaseline(String? activity) {
    final capar = context.read<AppState>().rawCaparInsights?['capar'];
    final baseline = capar is Map ? capar['baseline'] : null;
    final contexts = baseline is Map ? baseline['contexts'] : null;
    if (contexts is! List) return null;
    const aliases = {
      'sitting': ['sitting', 'rest', 'duduk'],
      'standing': ['standing', 'berdiri'],
      'walking': ['walking', 'light', 'berjalan'],
    };
    final accepted = aliases[activity] ?? [activity?.toLowerCase() ?? ''];
    for (final item in contexts.whereType<Map>()) {
      final baselineActivity = item['activity']?.toString().toLowerCase() ?? '';
      if (accepted.any((alias) => baselineActivity == alias)) {
        return Map<String, dynamic>.from(item);
      }
    }
    return null;
  }

  Widget _baselineComparison() {
    final skipped =
        _stageResults.where((item) => item['skipped'] == true).length;
    final partial =
        _stageResults.where((item) => item['incomplete'] == true).length;
    final recorded = _stageResults.length - skipped - partial;
    return Text(
      '$recorded dari ${_stages.length} konteks selesai direkam${partial > 0 ? ' · $partial dihentikan sebelum selesai' : ''}${skipped > 0 ? ' · $skipped dilewati' : ''}. CAPAR mengolah data sesuai quality gate dan konteks. Perekaman singkat ini tidak langsung mengubah status baseline menjadi matang.',
      style: AppTheme.font(
          size: 10.5, color: AppTheme.textSecondary, height: 1.35),
    );
  }

  Widget _message(String text, {bool isError = false}) => Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isError ? const Color(0xFFFFF1F0) : AppTheme.primarySoft,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(text,
            style: AppTheme.font(
                size: 11.5, color: AppTheme.textSecondary, height: 1.35)),
      );
}
