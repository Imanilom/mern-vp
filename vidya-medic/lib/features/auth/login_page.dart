import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/theme/htm_colors.dart';
import '../../core/theme/htm_spacing.dart';
import '../../core/theme/htm_typography.dart';
import '../../core/network/api_client.dart';
import 'qr_scan_modal.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _idController = TextEditingController();
  final _studyCodeController = TextEditingController();
  final _pinController = TextEditingController();
  bool _agreePrivacy = true;
  bool _isLoading = false;
  bool _pinVisible = false;

  late AnimationController _fadeController;
  late Animation<double> _fadeAnim;
  late Animation<Offset> _slideAnim;
  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _fadeController = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 600));
    _fadeAnim = CurvedAnimation(parent: _fadeController, curve: Curves.easeOut)
        .drive(Tween(begin: 0.0, end: 1.0));
    _slideAnim = CurvedAnimation(
            parent: _fadeController, curve: Curves.easeOutCubic)
        .drive(Tween(begin: const Offset(0, 0.05), end: Offset.zero));
    _fadeController.forward();

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
  }

  @override
  void dispose() {
    _fadeController.dispose();
    _pulseController.dispose();
    _idController.dispose();
    _studyCodeController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  void _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_agreePrivacy) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text("Harap menyetujui kebijakan privasi terlebih dahulu"),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
      return;
    }
    setState(() => _isLoading = true);
    
    final success = await ref.read(apiClientProvider).login(
      participantId: _idController.text,
      password: _pinController.text,
      studyCode: _studyCodeController.text,
      pin: _pinController.text,
    );
    
    if (!mounted) return;
    setState(() => _isLoading = false);
    
    if (success) {
      context.go('/home');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text("Gagal masuk. Silakan periksa kembali kredensial Anda."),
          behavior: SnackBarBehavior.floating,
          backgroundColor: Colors.red,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      );
    }
  }

  void _openQrScanner() async {
    final result = await Navigator.push<Map<String, String>>(
      context,
      MaterialPageRoute(builder: (context) => const QrScanModal()),
    );
    if (result != null && mounted) {
      setState(() {
        _idController.text = result['participantId'] ?? '';
        _studyCodeController.text = result['studyCode'] ?? '';
        _pinController.text = result['pin'] ?? '';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final htmColors = HtmColors.of(context);
    final textTheme = Theme.of(context).textTheme;

    final bgWarmCard = htmColors.surface;
    final borderWarm = htmColors.hairline;
    final accentGreen = htmColors.primary;
    final primaryGreen = htmColors.ink;
    final textMuted = htmColors.muted;

    return Scaffold(
      backgroundColor: htmColors.canvas,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: HtmSpacing.lg, vertical: HtmSpacing.xl),
          child: FadeTransition(
            opacity: _fadeAnim,
            child: SlideTransition(
              position: _slideAnim,
              child: Form(
                key: _formKey,
                child: Container(
                  width: 340,
                  decoration: BoxDecoration(
                    color: bgWarmCard,
                    border: Border.all(color: borderWarm, width: 1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: HtmSpacing.lg, vertical: HtmSpacing.xl),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SizedBox(
                        height: 52,
                        child: AnimatedBuilder(
                          animation: _pulseController,
                          builder: (context, child) {
                            return CustomPaint(
                              painter: _PulsePainter(accentGreen, _pulseController.value),
                            );
                          },
                        ),
                      ),
                      const SizedBox(height: 12),

                      // HTM Logo
                      Image.asset(
                        'assets/images/htm_logo.png',
                        height: 56,
                        fit: BoxFit.contain,
                        errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
                      ),
                      const SizedBox(height: HtmSpacing.sm),

                      Text(
                        "Selamat datang",
                        textAlign: TextAlign.center,
                        style: textTheme.displayMedium?.copyWith(color: primaryGreen),
                      ),
                      const SizedBox(height: HtmSpacing.xs),

                      Text(
                        "HEALTH TRAJECTORY MONITOR",
                        textAlign: TextAlign.center,
                        style: textTheme.labelSmall?.copyWith(color: accentGreen),
                      ),
                      const SizedBox(height: HtmSpacing.lg),

                      // Scan QR Button
                      OutlinedButton.icon(
                        onPressed: _openQrScanner,
                        icon: const Icon(Icons.qr_code_scanner_rounded, size: 17),
                        label: const Text("Scan QR code penelitian"),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: accentGreen,
                          side: BorderSide(color: accentGreen, width: 1.0),
                          fixedSize: const Size.fromHeight(46),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          textStyle: GoogleFonts.ibmPlexSans(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      const SizedBox(height: 22),

                      // Divider
                      Row(
                        children: [
                          Expanded(child: Divider(color: borderWarm, height: 1)),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: HtmSpacing.sm),
                            child: Text(
                              "atau isi secara manual",
                              style: textTheme.labelSmall?.copyWith(color: textMuted),
                            ),
                          ),
                          Expanded(child: Divider(color: borderWarm, height: 1)),
                        ],
                      ),
                      const SizedBox(height: 22),

                      // Participant ID Field
                      _buildLabel("Participant ID / Email", textMuted),
                      _buildInputField(
                        controller: _idController,
                        icon: Icons.badge_outlined,
                        iconColor: textMuted,
                        borderWarm: borderWarm,
                        accentGreen: accentGreen,
                        primaryGreen: primaryGreen,
                        validator: (v) => v == null || v.isEmpty ? 'Wajib diisi' : null,
                      ),
                      const SizedBox(height: 18),

                      // Study Code Field
                      _buildLabel("Study code", textMuted),
                      _buildInputField(
                        controller: _studyCodeController,
                        icon: Icons.science_outlined,
                        iconColor: textMuted,
                        borderWarm: borderWarm,
                        accentGreen: accentGreen,
                        primaryGreen: primaryGreen,
                      ),
                      const SizedBox(height: 18),

                      // PIN Field
                      _buildLabel("PIN / kata sandi", textMuted),
                      _buildInputField(
                        controller: _pinController,
                        icon: Icons.lock_outline_rounded,
                        iconColor: textMuted,
                        borderWarm: borderWarm,
                        accentGreen: accentGreen,
                        primaryGreen: primaryGreen,
                        obscureText: !_pinVisible,
                        validator: (v) => v == null || v.isEmpty ? 'Wajib diisi' : null,
                        suffix: IconButton(
                          icon: Icon(
                            _pinVisible
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            size: 17,
                            color: textMuted,
                          ),
                          onPressed: () => setState(() => _pinVisible = !_pinVisible),
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Privacy consent checkbox
                      _buildPrivacyCheckbox(accentGreen, textMuted),
                      const SizedBox(height: 24),

                      // Login Button
                      FilledButton(
                        onPressed: _isLoading ? null : _handleLogin,
                        style: FilledButton.styleFrom(
                          backgroundColor: primaryGreen,
                          disabledBackgroundColor: primaryGreen.withValues(alpha: 0.6),
                          fixedSize: const Size.fromHeight(50),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: _isLoading
                            ? SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.5,
                                  color: bgWarmCard,
                                ),
                              )
                            : Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    "Masuk ke sistem",
                                    style: textTheme.titleMedium?.copyWith(color: bgWarmCard),
                                  ),
                                  const SizedBox(width: 8),
                                  Icon(Icons.arrow_forward_rounded, size: 17, color: bgWarmCard),
                                ],
                              ),
                      ),
                      const SizedBox(height: 18),

                      // Helper links
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          GestureDetector(
                            onTap: () {},
                            child: Text(
                              "Lupa kata sandi?",
                              style: TextStyle(
                                fontSize: 12,
                                color: accentGreen,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            child: Text("·", style: TextStyle(color: textMuted)),
                          ),
                          GestureDetector(
                            onTap: () {},
                            child: Text(
                              "Hubungi admin",
                              style: TextStyle(
                                fontSize: 12,
                                color: accentGreen,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
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
    );
  }

  Widget _buildLabel(String text, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text.toUpperCase(),
        style: HtmTypography.labelSmall.copyWith(color: color),
      ),
    );
  }

  Widget _buildInputField({
    required TextEditingController controller,
    required IconData icon,
    required Color iconColor,
    required Color borderWarm,
    required Color accentGreen,
    required Color primaryGreen,
    bool obscureText = false,
    String? Function(String?)? validator,
    Widget? suffix,
  }) {
    return Row(
      children: [
        Icon(icon, size: 16, color: iconColor),
        const SizedBox(width: 8),
        Expanded(
          child: TextFormField(
            controller: controller,
            obscureText: obscureText,
            validator: validator,
            style: HtmTypography.dataText.copyWith(color: primaryGreen),
            decoration: InputDecoration(
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(vertical: 6, horizontal: 2),
              enabledBorder: UnderlineInputBorder(
                borderSide: BorderSide(color: borderWarm, width: 1.0),
              ),
              focusedBorder: UnderlineInputBorder(
                borderSide: BorderSide(color: accentGreen, width: 1.5),
              ),
              errorBorder: const UnderlineInputBorder(
                borderSide: BorderSide(color: Colors.red, width: 1.0),
              ),
              focusedErrorBorder: const UnderlineInputBorder(
                borderSide: BorderSide(color: Colors.red, width: 1.5),
              ),
              suffixIcon: suffix,
              suffixIconConstraints: const BoxConstraints(
                minWidth: 24,
                minHeight: 24,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPrivacyCheckbox(Color activeColor, Color textColor) {
    return GestureDetector(
      onTap: () => setState(() => _agreePrivacy = !_agreePrivacy),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 18,
              height: 18,
              decoration: BoxDecoration(
                color: _agreePrivacy ? activeColor : Colors.transparent,
                borderRadius: BorderRadius.circular(4),
                border: Border.all(
                  color: _agreePrivacy ? activeColor : textColor.withValues(alpha: 0.5),
                  width: 1.5,
                ),
              ),
              child: _agreePrivacy
                  ? const Icon(Icons.check_rounded, size: 12, color: Colors.white)
                  : null,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: TextStyle(
                  fontSize: 12,
                  height: 1.4,
                  color: textColor,
                ),
                children: [
                  const TextSpan(text: "Saya menyetujui "),
                  TextSpan(
                    text: "Kebijakan Privasi",
                    style: TextStyle(color: activeColor, fontWeight: FontWeight.w600),
                  ),
                  const TextSpan(text: " dan "),
                  TextSpan(
                    text: "Ketentuan Studi HTM",
                    style: TextStyle(color: activeColor, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PulsePainter extends CustomPainter {
  final Color color;
  final double animationValue;

  _PulsePainter(this.color, this.animationValue);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color.withValues(alpha: 0.15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final path = Path();
    final double w = size.width;
    final double h = size.height;
    final double midY = h / 2;

    final points = [
      Offset(0, midY),
      Offset(w * (96 / 272), midY),
      Offset(w * (108 / 272), h * (8 / 52)),
      Offset(w * (120 / 272), h * (44 / 52)),
      Offset(w * (132 / 272), h * (16 / 52)),
      Offset(w * (142 / 272), midY),
      Offset(w * (176 / 272), midY),
      Offset(w * (184 / 272), h * (14 / 52)),
      Offset(w * (192 / 272), midY),
      Offset(w, midY),
    ];

    path.moveTo(points[0].dx, points[0].dy);
    for (int i = 1; i < points.length; i++) {
      path.lineTo(points[i].dx, points[i].dy);
    }
    canvas.drawPath(path, paint);

    final double sweepPosition = animationValue * w;
    final double sweepWidth = w * 0.25;

    for (int i = 1; i < points.length; i++) {
      final p1 = points[i - 1];
      final p2 = points[i];

      final segmentMidX = (p1.dx + p2.dx) / 2;
      final distance = (segmentMidX - sweepPosition).abs();

      if (distance < sweepWidth) {
        final opacity = (1.0 - (distance / sweepWidth)).clamp(0.0, 1.0);
        final segmentPaint = Paint()
          ..color = color.withValues(alpha: opacity)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.0
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round;

        canvas.drawLine(p1, p2, segmentPaint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _PulsePainter oldDelegate) {
    return oldDelegate.animationValue != animationValue || oldDelegate.color != color;
  }
}
