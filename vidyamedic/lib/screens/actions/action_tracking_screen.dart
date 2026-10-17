import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../providers/app_state.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';
import '../input/guided_daily_flow_screen.dart';
import '../input/manual_measurement_screen.dart';
import '../pedagogy/pedagogy_screen_action.dart';

class ActionTrackingScreen extends StatefulWidget {
  const ActionTrackingScreen({super.key});

  @override
  State<ActionTrackingScreen> createState() => _ActionTrackingScreenState();
}

class _ActionTrackingScreenState extends State<ActionTrackingScreen> {
  List<Map<String, dynamic>> _checkIns = [];
  List<Map<String, dynamic>> _actions = [];
  bool _isLoading = true;
  bool _isSavingAction = false;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _loadCheckIns();
  }

  Future<void> _loadCheckIns() async {
    setState(() {
      _isLoading = true;
      _loadError = null;
    });
    final now = DateTime.now().toUtc();
    final responses = await Future.wait<dynamic>([
      ApiService.getCheckIns(
      from: now.subtract(const Duration(days: 30)).toIso8601String(),
      to: now.toIso8601String(),
      limit: 100,
      ),
      ApiService.getPatientActions(
        from: now.subtract(const Duration(days: 30)).toIso8601String(),
        to: now.toIso8601String(),
        limit: 100,
      ),
    ]);
    final response = responses[0] as ApiResponse<List<dynamic>>;
    final actionResponse = responses[1] as ApiResponse<List<dynamic>>;
    if (!mounted) return;
    if ((!response.success || response.data == null) &&
        (!actionResponse.success || actionResponse.data == null)) {
      setState(() {
        _isLoading = false;
        _loadError = [
          response.message,
          actionResponse.message,
        ].whereType<String>().join(' ');
      });
      return;
    }
    setState(() {
      _isLoading = false;
      _checkIns = response.success && response.data != null
          ? response.data!
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList()
          : [];
      _actions = actionResponse.success && actionResponse.data != null
          ? actionResponse.data!
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList()
          : [];
      _loadError = [
        if (!response.success) response.message,
        if (!actionResponse.success) actionResponse.message,
      ].whereType<String>().join(' ');
    });
  }

  Future<void> _refresh() async {
    await Future.wait([
      _loadCheckIns(),
      context.read<AppState>().fetchCaparInsights(),
    ]);
  }

  Future<void> _createAction(AppState state) async {
    final titleController = TextEditingController();
    final detailsController = TextEditingController();
    var actionType = 'patient_guidance';
    final formKey = GlobalKey<FormState>();
    final payload = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (dialogContext, setDialogState) => AlertDialog(
          title: const Text('Catat tindakan'),
          content: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<String>(
                    initialValue: actionType,
                    decoration: const InputDecoration(labelText: 'Jenis'),
                    items: const [
                      DropdownMenuItem(
                        value: 'patient_guidance',
                        child: Text('Panduan pasien'),
                      ),
                      DropdownMenuItem(
                        value: 'measurement',
                        child: Text('Pengukuran tambahan'),
                      ),
                      DropdownMenuItem(
                        value: 'clinical_review',
                        child: Text('Permintaan tinjauan klinis'),
                      ),
                      DropdownMenuItem(
                        value: 'monitoring',
                        child: Text('Pemantauan'),
                      ),
                      DropdownMenuItem(value: 'other', child: Text('Lainnya')),
                    ],
                    onChanged: (value) {
                      if (value != null) {
                        setDialogState(() => actionType = value);
                      }
                    },
                  ),
                  TextFormField(
                    controller: titleController,
                    maxLength: 160,
                    decoration: const InputDecoration(
                      labelText: 'Tindakan',
                      hintText: 'Contoh: melakukan pengukuran ulang',
                    ),
                    validator: (value) =>
                        value == null || value.trim().isEmpty
                            ? 'Tindakan wajib diisi.'
                            : null,
                  ),
                  TextField(
                    controller: detailsController,
                    maxLines: 3,
                    maxLength: 500,
                    decoration: const InputDecoration(
                      labelText: 'Catatan (opsional)',
                    ),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Batal'),
            ),
            ElevatedButton(
              onPressed: () {
                if (!formKey.currentState!.validate()) return;
                final decision = state.serverAction;
                Navigator.pop(dialogContext, {
                  'action_type': actionType,
                  'title': titleController.text.trim(),
                  'details': detailsController.text.trim(),
                  if (decision != null)
                    'decision': {
                      if (decision['level'] != null)
                        'level': decision['level'].toString(),
                      if (decision['title'] != null)
                        'title': decision['title'].toString(),
                      if (_asMap(decision['policy'])?['version'] != null)
                        'policy_version':
                            _asMap(decision['policy'])!['version'].toString(),
                    },
                });
              },
              child: const Text('Simpan'),
            ),
          ],
        ),
      ),
    );
    titleController.dispose();
    detailsController.dispose();
    if (payload == null || !mounted) return;

    setState(() => _isSavingAction = true);
    final response = await ApiService.createPatientAction(payload);
    if (!mounted) return;
    setState(() => _isSavingAction = false);
    if (!response.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(response.message ?? 'Tindakan gagal disimpan.')),
      );
      return;
    }
    await _loadCheckIns();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Tindakan tersimpan di server.')),
    );
  }

  Future<void> _advanceAction(Map<String, dynamic> action) async {
    const nextStatus = {
      'CREATED': 'DELIVERED',
      'DELIVERED': 'ACKNOWLEDGED',
      'ACKNOWLEDGED': 'COMPLETED',
    };
    final current = action['status']?.toString() ?? '';
    final target = nextStatus[current];
    final id = action['_id']?.toString();
    if (target == null || id == null) return;
    final response = await ApiService.updatePatientActionStatus(
      actionId: id,
      status: target,
    );
    if (!mounted) return;
    if (!response.success) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content: Text(response.message ?? 'Status tindakan gagal diubah.')),
      );
      return;
    }
    await _loadCheckIns();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final action = state.serverAction;
    final policy = _asMap(action?['policy']);
    final actionReports = _checkIns.where((checkIn) {
      final followUp = _asMap(checkIn['deviation_follow_up']);
      return (followUp?['action_taken']?.toString().trim().isNotEmpty ?? false);
    }).toList();

    return MockupScaffold(
      title: 'Tindakan & Tindak Lanjut',
      trailing: IconButton(
        tooltip: 'Perbarui keputusan dan riwayat',
        onPressed: _isLoading ? null : _refresh,
        icon: const Icon(Icons.refresh_rounded, color: AppTheme.primary),
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _introCard(),
          const SizedBox(height: 14),
          _decisionCard(action, policy),
          const SizedBox(height: 14),
          _trackedActionCard(context, state),
          const SizedBox(height: 14),
          _patientActionCard(context),
          const SizedBox(height: 14),
          _integrationCard(
            icon: Icons.medical_services_outlined,
            title: 'Tindakan klinisi',
            detail:
                'Pengiriman alert, acknowledgment, dan tindak lanjut klinisi belum tersedia pada API akun pasien ini.',
          ),
          const SizedBox(height: 8),
          _integrationCard(
            icon: Icons.settings_suggest_outlined,
            title: 'Tindakan otomatis sistem',
            detail:
                'Pengaturan sampling otomatis dan integrasi EHR belum tersedia pada perangkat atau API ini.',
          ),
          const SizedBox(height: 18),
          Text(
            'Status tindakan tercatat (30 hari)',
            style: AppTheme.font(size: 14, weight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          if (_actions.isEmpty && !_isLoading)
            _noticeCard(
              'Belum ada tindakan melalui pencatatan tindakan.',
            )
          else
            ..._actions.map(_trackedActionItem),
          const SizedBox(height: 18),
          Text(
            'Tindakan yang dilaporkan (30 hari)',
            style: AppTheme.font(size: 14, weight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          if (_isLoading)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(18),
                child: CircularProgressIndicator(),
              ),
            )
          else if (_loadError != null)
            _noticeCard(_loadError!, color: AppTheme.statusRed)
          else if (actionReports.isEmpty)
            _noticeCard(
              'Belum ada tindakan pribadi yang tercatat pada tindak lanjut CAPAR. Ini bukan berarti tindakan tidak dilakukan.',
            )
          else
            ...actionReports.map(_actionReportCard),
          if (_loadError != null)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: _refresh,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Coba lagi'),
              ),
            ),
        ],
      ),
    );
  }

  Widget _trackedActionCard(BuildContext context, AppState state) => _card(
        icon: Icons.add_task_outlined,
        title: 'Catat dan pantau tindakan',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Catatan ini memiliki ID dan jejak status tersendiri. Tandai status hanya sesuai kejadian yang benar-benar berlangsung.',
              style: AppTheme.font(
                  size: 12, color: AppTheme.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed:
                    _isSavingAction ? null : () => _createAction(state),
                icon: _isSavingAction
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.add_rounded),
                label: const Text('Buat catatan tindakan'),
              ),
            ),
          ],
        ),
      );

  Widget _trackedActionItem(Map<String, dynamic> action) {
    final status = action['status']?.toString() ?? 'CREATED';
    const labels = {
      'CREATED': 'Dibuat',
      'DELIVERED': 'Tersampaikan',
      'ACKNOWLEDGED': 'Dikonfirmasi',
      'COMPLETED': 'Selesai',
      'FAILED': 'Gagal',
    };
    const nextLabels = {
      'CREATED': 'Tandai tersampaikan',
      'DELIVERED': 'Konfirmasi diterima',
      'ACKNOWLEDGED': 'Tandai selesai',
    };
    final decision = _asMap(action['decision']);
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: AppTheme.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(action['title']?.toString() ?? 'Tindakan',
              style: AppTheme.font(size: 12.5, weight: FontWeight.w700)),
          const SizedBox(height: 4),
          Text(
            'Status: ${labels[status] ?? status} • ${action['action_type'] ?? 'other'}',
            style: AppTheme.font(size: 10.5, color: AppTheme.textSecondary),
          ),
          if (decision != null && decision['title']?.toString().isNotEmpty == true)
            Text(
              'Keputusan terkait: ${decision['title']}',
              style: AppTheme.font(size: 10.5, color: AppTheme.textMuted),
            ),
          if (nextLabels[status] != null)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton(
                onPressed: () => _advanceAction(action),
                child: Text(nextLabels[status]!),
              ),
            ),
        ],
      ),
    );
  }

  Widget _introCard() => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppTheme.primarySoft,
          borderRadius: BorderRadius.circular(15),
          border: Border.all(color: AppTheme.borderLight),
        ),
        child: Text(
          'Halaman ini menunjukkan keputusan CAPAR dan tindakan pribadi yang tercatat. Rekomendasi tidak membuktikan bahwa tindakan telah dijalankan atau efektif.',
          style: AppTheme.font(
              size: 12,
              color: AppTheme.primaryDark,
              height: 1.4,
              weight: FontWeight.w600),
        ),
      );

  Widget _decisionCard(
    Map<String, dynamic>? action,
    Map<String, dynamic>? policy,
  ) {
    final title = action?['title']?.toString();
    final message = action?['message']?.toString();
    return _card(
      icon: Icons.rule_outlined,
      title: 'Keputusan saat ini',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title ?? 'Belum dapat ditentukan dari data yang tersedia',
            style: AppTheme.font(
                size: 13, weight: FontWeight.w800, color: AppTheme.primaryDark),
          ),
          const SizedBox(height: 5),
          Text(
            message ??
                'Data yang tidak cukup bukan bukti bahwa kondisi Anda normal. Lanjutkan pencatatan atau pengukuran sesuai kebutuhan.',
            style: AppTheme.font(
                size: 12, color: AppTheme.textSecondary, height: 1.4),
          ),
          if (action?['level'] != null || policy != null) ...[
            const SizedBox(height: 8),
            Text(
              [
                if (action?['level'] != null) 'Prioritas: ${action!['level']}',
                if (policy?['status'] != null)
                  'Kebijakan: ${policy!['status']}',
                if (policy?['version'] != null) 'Versi: ${policy!['version']}',
              ].join(' • '),
              style: AppTheme.font(size: 10.5, color: AppTheme.textMuted),
            ),
          ],
        ],
      ),
    );
  }

  Widget _patientActionCard(BuildContext context) => _card(
        icon: Icons.person_outline_rounded,
        title: 'Panduan dan pengumpulan bukti',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Pilih panduan untuk melihat rekomendasi saat ini, atau catat konteks dan pengukuran. Data baru tidak otomatis mengubah baseline atau kebijakan.',
              style: AppTheme.font(
                  size: 12, color: AppTheme.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) => const ActionGuidanceScreen()),
                ),
                icon: const Icon(Icons.health_and_safety_outlined),
                label: const Text('Buka panduan tindakan'),
              ),
            ),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) => const GuidedDailyFlowScreen()),
                ),
                icon: const Icon(Icons.edit_note_outlined),
                label: const Text('Catat konteks harian'),
              ),
            ),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) => const ManualMeasurementScreen()),
                ),
                icon: const Icon(Icons.monitor_heart_outlined),
                label: const Text('Catat pengukuran tambahan'),
              ),
            ),
          ],
        ),
      );

  Widget _integrationCard({
    required IconData icon,
    required String title,
    required String detail,
  }) =>
      _card(
        icon: icon,
        title: title,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.info_outline_rounded,
                color: AppTheme.textMuted, size: 17),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                detail,
                style: AppTheme.font(
                    size: 11.5, color: AppTheme.textSecondary, height: 1.4),
              ),
            ),
          ],
        ),
      );

  Widget _actionReportCard(Map<String, dynamic> checkIn) {
    final followUp = _asMap(checkIn['deviation_follow_up'])!;
    final response = followUp['response_after_action']?.toString().trim();
    final date = DateTime.tryParse(checkIn['recorded_at']?.toString() ?? '');
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: AppTheme.borderLight),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            followUp['action_taken'].toString(),
            style: AppTheme.font(size: 12.5, weight: FontWeight.w700),
          ),
          if (response != null && response.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              'Respons yang dirasakan: $response',
              style: AppTheme.font(
                  size: 11.5, color: AppTheme.textSecondary, height: 1.35),
            ),
          ],
          const SizedBox(height: 6),
          Text(
            '${date == null ? 'Tanggal tidak tersedia' : MaterialLocalizations.of(context).formatMediumDate(date.toLocal())} • Dilaporkan pasien; status pelaksanaan tidak tersedia',
            style: AppTheme.font(size: 10, color: AppTheme.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _card({
    required IconData icon,
    required String title,
    required Widget child,
  }) =>
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(15),
          border: Border.all(color: AppTheme.borderLight),
          boxShadow: AppTheme.shadowSoft,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 18, color: AppTheme.primary),
                const SizedBox(width: 8),
                Text(title,
                    style: AppTheme.font(size: 13, weight: FontWeight.w800)),
              ],
            ),
            const SizedBox(height: 9),
            child,
          ],
        ),
      );

  Widget _noticeCard(String message, {Color color = AppTheme.textMuted}) =>
      Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.25)),
        ),
        child: Text(
          message,
          style: AppTheme.font(
              size: 11.5, color: AppTheme.textSecondary, height: 1.4),
        ),
      );

  Map<String, dynamic>? _asMap(dynamic value) =>
      value is Map ? Map<String, dynamic>.from(value) : null;
}
