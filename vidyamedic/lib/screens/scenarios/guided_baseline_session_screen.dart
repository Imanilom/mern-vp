import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../services/wearable_pairing_service.dart';
import '../../theme/app_theme.dart';
import 'guided_baseline_review_screen.dart';
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
  bool _reviewOpened = false;
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
      'is_simulated': wearable.isDemoDevice,
      'skipped': skipped && !wasRunning,
      'incomplete': skipped && wasRunning,
      'minimum_hr': wasRunning ? wearable.sessionMinimumHeartRate : null,
      'maximum_hr': wasRunning ? wearable.sessionMaximumHeartRate : null,
      'rr_interval_count': wasRunning ? wearable.sessionRrIntervalCount : 0,
      'reading_count': wasRunning ? wearable.sessionReadingCount : 0,
      'window_count': wasRunning ? wearable.sessionWindowCount : 0,
      'recorded_readings': wasRunning
          ? wearable.recentStreamReadings
              .map((reading) => Map<String, dynamic>.from(reading))
              .toList()
          : <Map<String, dynamic>>[],
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
      if (mounted) await _openReviewScreen();
    }
  }

  Future<void> _openReviewScreen() async {
    if (_reviewOpened || !mounted) return;
    _reviewOpened = true;
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => GuidedBaselineReviewScreen(
          stageResults: _stageResults
              .map((result) => Map<String, dynamic>.from(result))
              .toList(),
        ),
      ),
    );
    if (!mounted) return;
    _reviewOpened = false;
    if (saved == true) {
      setState(() {
        _emaSaved = true;
        _error = null;
      });
    }
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
                    const SizedBox(height: 8),
                    _baselineExplanation(stage.$1, appState),
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
              child: ListTile(
                leading: Icon(
                  _emaSaved
                      ? Icons.check_circle
                      : Icons.account_circle_outlined,
                  color: _emaSaved ? AppTheme.statusGreen : AppTheme.primary,
                ),
                title: Text(
                  _emaSaved
                      ? 'Tahap 3–6 selesai · EMA tersimpan'
                      : 'Rekaman selesai',
                  style: AppTheme.font(size: 14, weight: FontWeight.w800),
                ),
                subtitle: Text(
                  _emaSaved
                      ? 'Profil, perubahan, koreksi, dan interpretasi telah ditinjau.'
                      : 'Lanjutkan untuk meninjau profil, perubahan, koreksi, dan interpretasi.',
                ),
                trailing:
                    _emaSaved ? null : const Icon(Icons.chevron_right_rounded),
                onTap: _emaSaved ? null : _openReviewScreen,
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
          'Setiap konteks direkam hingga 5 menit. Setelah sesi, tinjau profil, perubahan, koreksi konteks, lalu interpretasi sebelum mengisi EMA. Lakukan hanya aktivitas yang aman; Anda boleh berhenti atau melewati tahap.',
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

  Widget _baselineExplanation(String activity, AppState appState) {
    final explanation = switch (activity) {
      'standing' =>
        'Berdiri setelah duduk membantu merekam respons tubuh terhadap perubahan postur. CAPAR membandingkan data dalam konteks aktivitas yang sesuai, bukan menganggap semua aktivitas memiliki pola yang sama.',
      'walking' =>
        'Berjalan santai memberi konteks aktivitas untuk membaca respons denyut dan gerak. Lakukan hanya jika aman dan nyaman; tahap ini boleh dilewati.',
      _ when _stageIndex == 3 =>
        'Duduk kembali membantu merekam perubahan setelah aktivitas. Ini adalah pengamatan respons tubuh, bukan diagnosis atau penilaian medis.',
      _ =>
        'Rekaman duduk memberi konteks untuk memahami pola Anda saat tenang. Baseline dibentuk dari pengukuran berulang yang berkualitas, bukan dari satu angka atau rentang populasi.',
    };
    final citations = appState.baselineGuidanceCitations.take(3).toList();
    return Card(
      margin: EdgeInsets.zero,
      color: AppTheme.fieldFill,
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 12),
        childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        leading:
            const Icon(Icons.auto_awesome_outlined, color: AppTheme.primary),
        title: Text(
          'Mengapa konteks ini direkam?',
          style: AppTheme.font(size: 12, weight: FontWeight.w800),
        ),
        subtitle: Text(
          citations.isEmpty
              ? 'Penjelasan dan bukti ilmiah'
              : '${citations.length} sumber ilmiah terkait',
          style: AppTheme.font(size: 10, color: AppTheme.textSecondary),
        ),
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              explanation,
              style: AppTheme.font(
                  size: 11.5, color: AppTheme.textSecondary, height: 1.4),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.science_outlined,
                  size: 16, color: AppTheme.primary),
              const SizedBox(width: 6),
              Text(
                'Bukti ilmiah yang ditemukan (RAG)',
                style: AppTheme.font(size: 11, weight: FontWeight.w800),
              ),
            ],
          ),
          const SizedBox(height: 7),
          if (citations.isEmpty)
            Text(
              appState.isCaparLoading
                  ? 'Sedang mencari sumber ilmiah yang relevan…'
                  : 'Belum ada sumber yang cocok tersedia. Penjelasan ini tidak menggunakan sitasi yang belum terverifikasi.',
              style: AppTheme.font(
                  size: 10.5, color: AppTheme.textMuted, height: 1.35),
            )
          else
            ...citations.map(_baselineCitationCard),
          if (appState.baselineGuidanceEvidenceLimit?.isNotEmpty == true) ...[
            const SizedBox(height: 3),
            Text(
              appState.baselineGuidanceEvidenceLimit!,
              style: AppTheme.font(
                  size: 10, color: AppTheme.textMuted, height: 1.35),
            ),
          ],
        ],
      ),
    );
  }

  Widget _baselineCitationCard(ScientificCitation citation) {
    final citationInfo = [
      citation.authors,
      citation.source,
      citation.year,
    ].where((item) => item.isNotEmpty).join(' · ');
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 7),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(citation.title,
              style: AppTheme.font(size: 10.5, weight: FontWeight.w700)),
          if (citation.summary.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              citation.summary,
              style: AppTheme.font(
                  size: 10, color: AppTheme.textSecondary, height: 1.35),
            ),
          ],
          if (citationInfo.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              citationInfo,
              style: AppTheme.font(size: 9.5, color: AppTheme.textMuted),
            ),
          ],
        ],
      ),
    );
  }

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
