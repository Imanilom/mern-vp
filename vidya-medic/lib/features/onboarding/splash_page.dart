import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/functional_colors.dart';
import '../../core/theme/htm_colors.dart';
import '../../core/theme/htm_spacing.dart';
import '../../core/theme/htm_typography.dart';
import '../../core/network/api_client.dart';

class SplashPage extends ConsumerStatefulWidget {
  const SplashPage({super.key});

  @override
  ConsumerState<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends ConsumerState<SplashPage>
    with TickerProviderStateMixin {
  late AnimationController _logoController;
  late AnimationController _textController;
  late AnimationController _progressController;
  late Animation<double> _logoScale;
  late Animation<double> _logoOpacity;
  late Animation<double> _textOpacity;
  late Animation<Offset> _textSlide;

  int _statusIndex = 0;
  double _progress = 0.0;

  final List<String> _statusMessages = [
    "Memeriksa koneksi...",
    "Memuat profil peserta...",
    "Menghubungkan sensor BLE...",
    "Sinkronisasi data...",
  ];

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarBrightness: Brightness.light,
    ));

    _logoController = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 800));
    _textController = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 600));
    _progressController = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 400));

    _logoScale = CurvedAnimation(
            parent: _logoController, curve: Curves.elasticOut)
        .drive(Tween(begin: 0.5, end: 1.0));
    _logoOpacity = CurvedAnimation(
            parent: _logoController, curve: Curves.easeOut)
        .drive(Tween(begin: 0.0, end: 1.0));
    _textOpacity = CurvedAnimation(
            parent: _textController, curve: Curves.easeOut)
        .drive(Tween(begin: 0.0, end: 1.0));
    _textSlide = CurvedAnimation(
            parent: _textController, curve: Curves.easeOutCubic)
        .drive(Tween(begin: const Offset(0, 0.3), end: Offset.zero));

    _runSequence();
  }

  void _runSequence() async {
    await Future.delayed(const Duration(milliseconds: 200));
    _logoController.forward();

    await Future.delayed(const Duration(milliseconds: 500));
    _textController.forward();

    await Future.delayed(const Duration(milliseconds: 400));
    _updateStatus(0, 0.25);

    await Future.delayed(const Duration(milliseconds: 800));
    _updateStatus(1, 0.50);

    await Future.delayed(const Duration(milliseconds: 900));
    _updateStatus(2, 0.75);

    await Future.delayed(const Duration(milliseconds: 800));
    _updateStatus(3, 1.0);

    await Future.delayed(const Duration(milliseconds: 700));
    if (!mounted) return;
    
    final loggedIn = await ref.read(apiClientProvider).isLoggedIn();
    if (!mounted) return;
    if (loggedIn) {
      context.go('/home');
    } else {
      context.go('/login');
    }
  }

  void _updateStatus(int index, double progress) {
    if (!mounted) return;
    setState(() {
      _statusIndex = index;
      _progress = progress;
    });
  }

  @override
  void dispose() {
    _logoController.dispose();
    _textController.dispose();
    _progressController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;
    final htmColors = HtmColors.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          color: htmColors.canvas,
        ),
        child: SafeArea(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(flex: 2),

              // Logo with animation
              ScaleTransition(
                scale: _logoScale,
                child: FadeTransition(
                  opacity: _logoOpacity,
                  child: Image.asset(
                    'assets/images/htm_logo.png',
                    height: 80,
                    fit: BoxFit.contain,
                    errorBuilder: (context, error, stackTrace) => Icon(
                      Icons.monitor_heart_rounded,
                      size: 48,
                      color: colors.dataBlue,
                    ),
                  ),
                ),
              ),

              const SizedBox(height: HtmSpacing.xl),

              // App name with slide animation
              SlideTransition(
                position: _textSlide,
                child: FadeTransition(
                  opacity: _textOpacity,
                  child: Column(
                    children: [
                      Text(
                        "Health Trajectory",
                        style: textTheme.displayLarge?.copyWith(
                          color: htmColors.primary,
                        ),
                      ),
                      Text(
                        "Monitor",
                        style: textTheme.displayMedium?.copyWith(
                          color: htmColors.muted,
                        ),
                      ),
                      const SizedBox(height: HtmSpacing.sm),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: HtmSpacing.md, vertical: HtmSpacing.xs),
                        decoration: BoxDecoration(
                          color: htmColors.primary.withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          "Continuous Health Monitoring",
                          style: textTheme.labelSmall?.copyWith(
                            color: htmColors.primary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const Spacer(flex: 2),

              // Progress section
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 48.0),
                child: Column(
                  children: [
                    // Progress bar
                    ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: TweenAnimationBuilder<double>(
                        tween: Tween(begin: 0, end: _progress),
                        duration: const Duration(milliseconds: 500),
                        curve: Curves.easeOutCubic,
                        builder: (context, value, child) {
                          return LinearProgressIndicator(
                            value: value,
                            backgroundColor: htmColors.hairline,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(htmColors.primary),
                            minHeight: 4,
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: HtmSpacing.md),
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 300),
                      transitionBuilder: (child, anim) => FadeTransition(
                        opacity: anim,
                        child: SlideTransition(
                          position: Tween<Offset>(
                                  begin: const Offset(0, 0.2), end: Offset.zero)
                              .animate(anim),
                          child: child,
                        ),
                      ),
                      child: Text(
                        _statusMessages[_statusIndex],
                        key: ValueKey(_statusIndex),
                        style: textTheme.bodyMedium?.copyWith(
                          color: htmColors.muted,
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 40),

              Text(
                "v1.0.0 • HTM Research System",
                style: TextStyle(
                  fontSize: 10,
                  color: isDark ? Colors.grey[600] : Colors.grey[400],
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
