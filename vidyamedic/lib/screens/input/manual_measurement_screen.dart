import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';

/// Mockup halaman 5 – Pengukuran manual ("Input Pengukuran").
class ManualMeasurementScreen extends StatelessWidget {
  const ManualMeasurementScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();

    return MockupScaffold(
      title: 'Input Pengukuran',
      body: Column(
        children: [
          ...s.measurements.map((m) => _MeasurementRow(
                entry: m,
                onEdit: () => _editEntry(context, m),
              )),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton.icon(
              onPressed: () => _addCustom(context),
              icon: const Icon(Icons.add, size: 18, color: AppTheme.primary),
              label: Text(
                'Tambah Pengukuran',
                style: AppTheme.font(size: 14, weight: FontWeight.w600, color: AppTheme.primary),
              ),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppTheme.primaryLight, width: 1.2),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ),
          const SizedBox(height: 10),
        ],
      ),
      bottom: ElevatedButton(
        onPressed: () async {
          s.confirmDailySection('measurements');
          final saved = await s.submitDaily();
          if (!context.mounted) return;
          if (!saved) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text(s.dataError ?? 'Pengukuran gagal disimpan ke server.')),
            );
            return;
          }
          showSaved(context, 'Pengukuran tersimpan di server');
          Navigator.pop(context);
        },
        child: const Text('Simpan'),
      ),
    );
  }

  void _editEntry(BuildContext context, MeasurementEntry entry) {
    final s = context.read<AppState>();
    final valCtrl = TextEditingController(text: entry.value ?? '');
    TimeOfDay t = entry.time ?? TimeOfDay.now();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocalState) => Padding(
          padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Ubah ${entry.label}', style: AppTheme.font(size: 17, weight: FontWeight.w700)),
              const FieldLabel('Nilai pengukuran'),
              TextField(
                controller: valCtrl,
                keyboardType: TextInputType.text,
                decoration: InputDecoration(
                  hintText: 'Contoh: ${entry.key == "bp" ? "120/80" : "36.5"}',
                  suffixText: entry.unit,
                ),
              ),
              const FieldLabel('Waktu pencatatan'),
              InkWell(
                onTap: () async {
                  final picked = await showTimePicker(context: ctx, initialTime: t);
                  if (picked != null) setLocalState(() => t = picked);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppTheme.border),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(fmtTime(t), style: AppTheme.font(size: 14, weight: FontWeight.w600)),
                      const Icon(Icons.access_time, size: 18, color: AppTheme.textSecondary),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () {
                  s.update(() {
                    entry.value = valCtrl.text.trim().isEmpty ? null : valCtrl.text.trim();
                    entry.time = t;
                  });
                  Navigator.pop(ctx);
                },
                child: const Text('Simpan'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _addCustom(BuildContext context) {
    final s = context.read<AppState>();
    final nameCtrl = TextEditingController();
    final unitCtrl = TextEditingController();
    final valCtrl = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, MediaQuery.of(ctx).viewInsets.bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Tambah Jenis Pengukuran', style: AppTheme.font(size: 17, weight: FontWeight.w700)),
            const FieldLabel('Nama parameter'),
            TextField(controller: nameCtrl, decoration: const InputDecoration(hintText: 'Contoh: Kolesterol total')),
            const FieldLabel('Satuan'),
            TextField(controller: unitCtrl, decoration: const InputDecoration(hintText: 'Contoh: mg/dL')),
            const FieldLabel('Nilai (opsional)'),
            TextField(controller: valCtrl, decoration: const InputDecoration(hintText: 'Contoh: 180')),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                if (nameCtrl.text.trim().isEmpty) return;
                s.update(() {
                  s.measurements.add(
                    MeasurementEntry(
                      key: 'custom_${DateTime.now().millisecondsSinceEpoch}',
                      label: nameCtrl.text.trim(),
                      unit: unitCtrl.text.trim(),
                      icon: Icons.science_outlined,
                      color: AppTheme.primary,
                      value: valCtrl.text.trim().isEmpty ? null : valCtrl.text.trim(),
                      time: TimeOfDay.now(),
                    ),
                  );
                });
                Navigator.pop(ctx);
              },
              child: const Text('Tambahkan'),
            ),
          ],
        ),
      ),
    );
  }
}

class _MeasurementRow extends StatelessWidget {
  final MeasurementEntry entry;
  final VoidCallback onEdit;

  const _MeasurementRow({required this.entry, required this.onEdit});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppTheme.borderLight),
        boxShadow: AppTheme.shadowSoft,
      ),
      child: Row(
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: entry.color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(entry.icon, color: entry.color, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(entry.label, style: AppTheme.font(size: 13, color: AppTheme.textSecondary)),
                const SizedBox(height: 2),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      entry.value ?? '-',
                      style: AppTheme.font(size: 16, weight: FontWeight.w700),
                    ),
                    const SizedBox(width: 4),
                    Text(entry.unit, style: AppTheme.font(size: 11.5, color: AppTheme.textMuted)),
                  ],
                ),
              ],
            ),
          ),
          if (entry.time != null)
            Text(
              fmtTime(entry.time!),
              style: AppTheme.font(size: 12, color: AppTheme.textMuted),
            ),
          const SizedBox(width: 8),
          IconButton(
            icon: const Icon(Icons.edit_outlined, size: 18, color: AppTheme.textSecondary),
            onPressed: onEdit,
          ),
        ],
      ),
    );
  }
}
