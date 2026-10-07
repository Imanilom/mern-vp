import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../services/api_config.dart';
import '../theme/app_theme.dart';
import '../widgets/custom_widgets.dart';
import 'onboarding/onboarding_screen.dart';
import 'home/home_screen.dart';

/// Halaman Cover & Autentikasi Awal VidyaMedic
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  void _showServerConfigDialog(BuildContext context) {
    final ctrl = TextEditingController(text: ApiConfig.baseUrl);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Konfigurasi URL Server', style: AppTheme.font(size: 17, weight: FontWeight.w700)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Gunakan URL backend (contoh: http://10.0.2.2:3030 untuk emulator atau http://localhost:3030)',
              style: AppTheme.font(size: 12.5, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: ctrl,
              decoration: const InputDecoration(
                hintText: 'http://localhost:3030',
                prefixIcon: Icon(Icons.link_rounded),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () async {
              await ApiConfig.resetBaseUrl();
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('Reset Default'),
          ),
          ElevatedButton(
            onPressed: () async {
              final newUrl = ctrl.text.trim();
              if (newUrl.isNotEmpty) {
                await ApiConfig.setBaseUrl(newUrl);
              }
              if (ctx.mounted) Navigator.pop(ctx);
            },
            child: const Text('Simpan'),
          ),
        ],
      ),
    );
  }

  void _showSignInSheet(BuildContext context) {
    final emailCtrl = TextEditingController();
    final passCtrl = TextEditingController();
    bool isSubmitting = false;
    String? localError;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setMState) => Padding(
          padding: EdgeInsets.fromLTRB(24, 16, 24, MediaQuery.of(ctx).viewInsets.bottom + 24),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4.5,
                    decoration: BoxDecoration(
                      color: AppTheme.borderLight,
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Masuk ke VidyaMedic',
                        style: AppTheme.font(size: 18, weight: FontWeight.w800, color: AppTheme.primaryDark)),
                    IconButton.filledTonal(
                      style: IconButton.styleFrom(
                        backgroundColor: AppTheme.fieldFill,
                        padding: const EdgeInsets.all(6),
                      ),
                      icon: const Icon(Icons.close_rounded, size: 18),
                      onPressed: () => Navigator.pop(ctx),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text('Masuk dengan akun pasien yang telah terdaftar',
                    style: AppTheme.font(size: 13, color: AppTheme.textSecondary)),
                const SizedBox(height: 18),
                if (localError != null)
                  Container(
                    margin: const EdgeInsets.only(bottom: 14),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFDECEC),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppTheme.statusRed.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline, size: 20, color: AppTheme.statusRed),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(localError!,
                              style: AppTheme.font(size: 12.5, color: AppTheme.statusRed, weight: FontWeight.w500)),
                        ),
                      ],
                    ),
                  ),
                const FieldLabel('Email'),
                TextField(
                  controller: emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    hintText: 'nama@example.com',
                    prefixIcon: Icon(Icons.email_outlined, size: 20),
                  ),
                ),
                const FieldLabel('Password'),
                TextField(
                  controller: passCtrl,
                  obscureText: true,
                  decoration: const InputDecoration(
                    hintText: '••••••••',
                    prefixIcon: Icon(Icons.lock_outline, size: 20),
                  ),
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: isSubmitting
                        ? null
                        : () async {
                            final email = emailCtrl.text.trim();
                            final pass = passCtrl.text;
                            if (email.isEmpty || pass.isEmpty) {
                              setMState(() => localError = 'Harap isi email dan password.');
                              return;
                            }
                            setMState(() {
                              isSubmitting = true;
                              localError = null;
                            });

                            final appState = context.read<AppState>();
                            final success = await appState.signin(email: email, password: pass);

                            if (!ctx.mounted) return;
                            if (success) {
                              Navigator.pop(ctx);
                              Navigator.pushReplacement(
                                context,
                                MaterialPageRoute(builder: (_) => const HomeScreen()),
                              );
                            } else {
                              setMState(() {
                                isSubmitting = false;
                                localError = appState.authError ?? 'Gagal masuk akun. Periksa email & password.';
                              });
                            }
                          },
                    child: isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('Masuk'),
                  ),
                ),
                const SizedBox(height: 10),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF6F9F8),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Container(
              color: Colors.white,
              child: LayoutBuilder(
                builder: (context, c) => SingleChildScrollView(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: c.maxHeight),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.settings_outlined, color: AppTheme.textSecondary, size: 22),
                                    tooltip: 'Pengaturan Server',
                                    onPressed: () => _showServerConfigDialog(context),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              const _Logo(),
                              const SizedBox(height: 10),
                              Text(
                                'VidyaMedic',
                                style: AppTheme.font(
                                  size: 28,
                                  weight: FontWeight.w800,
                                  color: AppTheme.primaryDark,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Kenali tubuhmu,\njalani hari dengan lebih aman',
                                textAlign: TextAlign.center,
                                style: AppTheme.font(
                                  size: 13.5,
                                  color: AppTheme.textSecondary,
                                  height: 1.35,
                                ),
                              ),
                              const SizedBox(height: 16),
                              const _WelcomeHeroCard(),
                            ],
                          ),
                          Column(
                            children: [
                              const SizedBox(height: 20),
                              ElevatedButton(
                                onPressed: () => Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => const OnboardingScreen()),
                                ),
                                child: const Text('Daftar Akun Baru'),
                              ),
                              const SizedBox(height: 10),
                              TonalButton(
                                label: 'Masuk Akun',
                                onPressed: () => _showSignInSheet(context),
                              ),
                              const SizedBox(height: 22),
                              const Row(
                                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                                children: [
                                  _Pillar(Icons.eco_outlined, 'Pantau\nSehari-hari', Color(0xFF22B573)),
                                  _Pillar(Icons.groups_2_outlined, 'Pahami\nPerubahan', Color(0xFF2F9E8F)),
                                  _Pillar(Icons.favorite_outline, 'Ambil Langkah\nTepat', Color(0xFFF2B630)),
                                ],
                              ),
                              const SizedBox(height: 8),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Logo extends StatelessWidget {
  const _Logo();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 64,
      height: 58,
      child: Stack(
        alignment: Alignment.center,
        children: [
          ShaderMask(
            shaderCallback: (r) => const LinearGradient(
              colors: [AppTheme.primaryLight, AppTheme.primaryDark],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ).createShader(r),
            child: const Icon(Icons.favorite, size: 64, color: Colors.white),
          ),
          const Positioned(
            top: 18,
            child: Icon(Icons.monitor_heart_outlined, size: 26, color: Colors.white),
          ),
        ],
      ),
    );
  }
}

class _Pillar extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  const _Pillar(this.icon, this.label, this.color);

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(color: color.withValues(alpha: 0.14), shape: BoxShape.circle),
          child: Icon(icon, color: color, size: 22),
        ),
        const SizedBox(height: 6),
        Text(label,
            textAlign: TextAlign.center,
            style: AppTheme.font(size: 11, weight: FontWeight.w500, color: AppTheme.textSecondary, height: 1.25)),
      ],
    );
  }
}

class _WelcomeHeroCard extends StatelessWidget {
  const _WelcomeHeroCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.borderLight),
        boxShadow: AppTheme.shadowCard,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  gradient: AppTheme.primaryGradient,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.insights_rounded, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'CAPAR Personal Baseline',
                      style: AppTheme.font(size: 14, weight: FontWeight.w700, color: AppTheme.textPrimary),
                    ),
                    Text(
                      'Analisis fisiologis terpersonalisasi',
                      style: AppTheme.font(size: 11.5, color: AppTheme.textSecondary),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            'Membantu Anda memahami baseline ritme jantung, deviasi kontekstual, pemulihan, dan panduan tindakan yang aman.',
            style: AppTheme.font(size: 12.5, color: AppTheme.textSecondary, height: 1.4),
          ),
        ],
      ),
    );
  }
}
