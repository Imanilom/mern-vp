import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/health_models.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';

/// Mockup halaman 4 – Tidur ("Tidur Malam Ini").
class SleepInputScreen extends StatefulWidget {
  const SleepInputScreen({super.key});

  @override
  State<SleepInputScreen> createState() => _SleepInputScreenState();
}

class _SleepInputScreenState extends State<SleepInputScreen> {
  late int _minutes;
  late SleepQuality _quality;
  late TimeOfDay _bedTime;
  late TimeOfDay _wakeTime;
  late bool _wakeOften;
  late bool _hardToSleep;
  late bool _nightmare;

  @override
  void initState() {
    super.initState();
    final s = context.read<AppState>();
    _minutes = s.sleepMinutes;
    _quality = s.sleepQuality;
    _bedTime = s.bedTime;
    _wakeTime = s.wakeTime;
    _wakeOften = s.sleepWakeOften;
    _hardToSleep = s.sleepHardToSleep;
    _nightmare = s.sleepNightmare;
  }

  Future<void> _save() async {
    final s = context.read<AppState>();
    s.update(() {
      s.sleepMinutes = _minutes;
      s.sleepQuality = _quality;
      s.bedTime = _bedTime;
      s.wakeTime = _wakeTime;
      s.sleepWakeOften = _wakeOften;
      s.sleepHardToSleep = _hardToSleep;
      s.sleepNightmare = _nightmare;
      s.confirmDailySection('sleep');
    });
    final saved = await s.submitDaily();
    if (!mounted) return;
    if (!saved) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.dataError ?? 'Data tidur gagal disimpan ke server.')),
      );
      return;
    }
    showSaved(context, 'Data tidur tersimpan di server');
    Navigator.pop(context);
  }

  String _formatDuration(int m) {
    final h = m ~/ 60, mins = m % 60;
    return mins == 0 ? '$h jam' : '$h jam $mins menit';
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();

    return MockupScaffold(
      title: 'Tidur Malam Ini',
      subtitle: DateLine(date: s.logDate, centered: true),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionTitle('Durasi tidur', padding: EdgeInsets.only(top: 8, bottom: 10)),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppTheme.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _stepButton(
                  icon: Icons.remove,
                  onTap: () {
                    if (_minutes > 60) setState(() => _minutes -= 30);
                  },
                ),
                Text(
                  _formatDuration(_minutes),
                  style: AppTheme.font(size: 16, weight: FontWeight.w700),
                ),
                _stepButton(
                  icon: Icons.add,
                  onTap: () {
                    if (_minutes < 840) setState(() => _minutes += 30);
                  },
                ),
              ],
            ),
          ),

          const SectionTitle('Kualitas tidur'),
          Row(
            children: SleepQuality.values
                .map((q) => Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 3),
                        child: FaceChoiceTile(
                          label: q.label,
                          face: q.face,
                          color: q.color,
                          selected: _quality == q,
                          onTap: () => setState(() => _quality = q),
                        ),
                      ),
                    ))
                .toList(),
          ),

          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _TimeBox(
                  label: 'Waktu tidur',
                  time: _bedTime,
                  onTap: () async {
                    final t = await showTimePicker(context: context, initialTime: _bedTime);
                    if (t != null) setState(() => _bedTime = t);
                  },
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _TimeBox(
                  label: 'Waktu bangun',
                  time: _wakeTime,
                  onTap: () async {
                    final t = await showTimePicker(context: context, initialTime: _wakeTime);
                    if (t != null) setState(() => _wakeTime = t);
                  },
                ),
              ),
            ],
          ),

          const SectionTitle('Gangguan tidur'),
          ToggleRow(
            icon: Icons.access_time_rounded,
            label: 'Sering terbangun',
            value: _wakeOften,
            onChanged: (v) => setState(() => _wakeOften = v),
          ),
          ToggleRow(
            icon: Icons.nightlight_outlined,
            label: 'Sulit tidur',
            value: _hardToSleep,
            onChanged: (v) => setState(() => _hardToSleep = v),
          ),
          ToggleRow(
            icon: Icons.psychology_outlined,
            label: 'Mimpi buruk',
            value: _nightmare,
            onChanged: (v) => setState(() => _nightmare = v),
          ),
          const SizedBox(height: 10),
        ],
      ),
      bottom: ElevatedButton(
        onPressed: s.isSubmittingDaily ? null : _save,
        child: s.isSubmittingDaily
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : const Text('Simpan'),
      ),
    );
  }

  Widget _stepButton({required IconData icon, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: AppTheme.fieldFill,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: AppTheme.primaryDark, size: 20),
      ),
    );
  }
}

class _TimeBox extends StatelessWidget {
  final String label;
  final TimeOfDay time;
  final VoidCallback onTap;

  const _TimeBox({required this.label, required this.time, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppTheme.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: AppTheme.font(size: 11.5, color: AppTheme.textMuted)),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(fmtTime(time), style: AppTheme.font(size: 15, weight: FontWeight.w700)),
                const Icon(Icons.access_time_rounded, size: 17, color: AppTheme.textSecondary),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
