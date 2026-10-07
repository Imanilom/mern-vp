import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/app_state.dart';
import '../../theme/app_theme.dart';
import '../../widgets/custom_widgets.dart';

/// Mockup halaman 5 – Input catatan bebas ("Catatan Saya").
class FreeNoteScreen extends StatefulWidget {
  const FreeNoteScreen({super.key});

  @override
  State<FreeNoteScreen> createState() => _FreeNoteScreenState();
}

class _FreeNoteScreenState extends State<FreeNoteScreen> {
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    final s = context.read<AppState>();
    _ctrl = TextEditingController(text: s.note);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final s = context.read<AppState>();
    s.update(() {
      s.note = _ctrl.text.trim();
      s.confirmDailySection('note');
    });
    final saved = await s.submitDaily();
    if (!mounted) return;
    if (!saved) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(s.dataError ?? 'Catatan gagal disimpan ke server.')),
      );
      return;
    }
    showSaved(context, 'Catatan tersimpan di server');
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final s = context.watch<AppState>();
    return MockupScaffold(
      title: 'Catatan Saya',
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppTheme.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                TextField(
                  controller: _ctrl,
                  maxLines: 7,
                  maxLength: 500,
                  buildCounter: (_, {required currentLength, required isFocused, maxLength}) =>
                      Text('$currentLength/$maxLength',
                          style: AppTheme.font(size: 11, color: AppTheme.textMuted)),
                  style: AppTheme.font(size: 13.5, height: 1.45),
                  decoration: const InputDecoration(
                    hintText: 'Tulis catatan di sini...',
                    filled: false,
                    contentPadding: EdgeInsets.zero,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Text('Contoh:', style: AppTheme.font(size: 13, weight: FontWeight.w700, color: AppTheme.textSecondary)),
          const SizedBox(height: 8),
          ...[
            'Merasa lebih lelah dari biasanya',
            'Ada stres karena pekerjaan',
            'Baru pulang perjalanan jauh',
            'Mengonsumsi makanan berlemak',
            'Menstruasi hari pertama',
            'Lainnya...',
          ].map((t) => Padding(
                padding: const EdgeInsets.only(bottom: 5),
                child: Text('•  $t', style: AppTheme.font(size: 12.5, color: AppTheme.textSecondary)),
              )),
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
}
