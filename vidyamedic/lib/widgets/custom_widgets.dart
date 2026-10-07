import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/health_models.dart';
import '../theme/app_theme.dart';

// ---------------------------------------------------------------------------
// Face badge – colored emoji face like the mockup (drawn, so it renders the
// same on every platform).
// ---------------------------------------------------------------------------
class FaceBadge extends StatelessWidget {
  final FaceExpression expression;
  final Color color;
  final double size;
  const FaceBadge({super.key, required this.expression, required this.color, this.size = 34});

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: Size.square(size), painter: _FacePainter(expression, color));
}

class _FacePainter extends CustomPainter {
  final FaceExpression e;
  final Color color;
  _FacePainter(this.e, this.color);

  @override
  void paint(Canvas canvas, Size s) {
    final r = s.width / 2;
    final c = Offset(r, r);
    canvas.drawCircle(
      c,
      r,
      Paint()
        ..shader = RadialGradient(
          colors: [Color.lerp(color, Colors.white, 0.25)!, color],
          center: const Alignment(-0.3, -0.4),
        ).createShader(Rect.fromCircle(center: c, radius: r)),
    );
    final ink = Paint()
      ..color = Color.lerp(color, Colors.black, 0.55)!
      ..style = PaintingStyle.stroke
      ..strokeWidth = s.width * 0.075
      ..strokeCap = StrokeCap.round;
    final eyeFill = Paint()..color = ink.color;
    final eyeY = r * 0.78, eyeDx = r * 0.36, eyeR = s.width * 0.065;
    canvas.drawCircle(Offset(r - eyeDx, eyeY), eyeR, eyeFill);
    canvas.drawCircle(Offset(r + eyeDx, eyeY), eyeR, eyeFill);

    final mouthW = r * 0.9;
    final left = Offset(r - mouthW / 2, r * 1.32);
    final right = Offset(r + mouthW / 2, r * 1.32);
    final path = Path()..moveTo(left.dx, left.dy);
    switch (e) {
      case FaceExpression.veryHappy:
        final p = Path()
          ..moveTo(left.dx, r * 1.18)
          ..quadraticBezierTo(r, r * 1.85, right.dx, r * 1.18)
          ..close();
        canvas.drawPath(p, Paint()..color = ink.color);
        return;
      case FaceExpression.happy:
        path.quadraticBezierTo(r, r * 1.68, right.dx, right.dy);
      case FaceExpression.neutral:
        path.lineTo(right.dx, right.dy + r * 0.04);
      case FaceExpression.sad:
        path
          ..moveTo(left.dx, r * 1.45)
          ..quadraticBezierTo(r, r * 1.18, right.dx, r * 1.45);
      case FaceExpression.verySad:
        path
          ..moveTo(left.dx, r * 1.5)
          ..quadraticBezierTo(r, r * 1.05, right.dx, r * 1.5);
    }
    canvas.drawPath(path, ink);
  }

  @override
  bool shouldRepaint(covariant _FacePainter old) => old.e != e || old.color != color;
}

// ---------------------------------------------------------------------------
// Step progress bar  ▬▬▬▬▬────────  1/4
// ---------------------------------------------------------------------------
class StepProgress extends StatelessWidget {
  final int step;
  final int total;
  const StepProgress({super.key, required this.step, required this.total});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: TweenAnimationBuilder<double>(
              tween: Tween(end: step / total),
              duration: const Duration(milliseconds: 350),
              curve: Curves.easeOutCubic,
              builder: (_, v, child) => LinearProgressIndicator(
                value: v,
                minHeight: 6,
                backgroundColor: const Color(0xFFE6ECEA),
                valueColor: const AlwaysStoppedAnimation(AppTheme.primaryLight),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Text('$step/$total',
            style: AppTheme.font(size: 12, weight: FontWeight.w600, color: AppTheme.textMuted)),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Pulsing Status Dot (Breathing live indicator)
// ---------------------------------------------------------------------------
class PulsingStatusDot extends StatefulWidget {
  final Color color;
  final double size;
  const PulsingStatusDot({super.key, this.color = AppTheme.statusGreen, this.size = 8});

  @override
  State<PulsingStatusDot> createState() => _PulsingStatusDotState();
}

class _PulsingStatusDotState extends State<PulsingStatusDot> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final glow = _controller.value * 4 + 2;
        return Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            color: widget.color,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: widget.color.withValues(alpha: 0.4 + _controller.value * 0.4),
                blurRadius: glow,
                spreadRadius: _controller.value * 1.5,
              ),
            ],
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Circular Score Gauge (Apple Health / Oura Ring style recovery score gauge)
// ---------------------------------------------------------------------------
class CircularScoreGauge extends StatelessWidget {
  final double score; // 0..100
  final double size;
  final String label;
  final String subtitle;
  final Color primaryColor;
  final Color trackColor;

  const CircularScoreGauge({
    super.key,
    required this.score,
    this.size = 130,
    this.label = 'Skor Kesiapan',
    this.subtitle = 'Optimal',
    this.primaryColor = AppTheme.accent,
    this.trackColor = const Color(0xFFE2ECE7),
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: score),
      duration: const Duration(milliseconds: 1000),
      curve: Curves.easeOutCubic,
      builder: (context, val, _) {
        return CustomPaint(
          size: Size.square(size),
          painter: _CircularGaugePainter(
            progress: val / 100.0,
            primaryColor: primaryColor,
            trackColor: trackColor,
          ),
          child: SizedBox(
            width: size,
            height: size,
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${val.toInt()}%',
                    style: AppTheme.font(size: size * 0.22, weight: FontWeight.w800, color: AppTheme.textPrimary),
                  ),
                  Text(
                    subtitle,
                    style: AppTheme.font(size: size * 0.095, weight: FontWeight.w700, color: primaryColor),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _CircularGaugePainter extends CustomPainter {
  final double progress;
  final Color primaryColor;
  final Color trackColor;

  _CircularGaugePainter({
    required this.progress,
    required this.primaryColor,
    required this.trackColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - 16) / 2;
    const strokeWidth = 9.0;
    const startAngle = -math.pi / 2;
    final sweepAngle = 2 * math.pi * progress.clamp(0.0, 1.0);

    // Track
    final trackPaint = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;
    canvas.drawCircle(center, radius, trackPaint);

    // Progress Arc with gradient
    if (progress > 0) {
      final rect = Rect.fromCircle(center: center, radius: radius);
      final gradient = SweepGradient(
        startAngle: 0,
        endAngle: math.pi * 2,
        colors: [
          primaryColor.withValues(alpha: 0.7),
          primaryColor,
        ],
        transform: const GradientRotation(startAngle),
      );

      final progressPaint = Paint()
        ..shader = gradient.createShader(rect)
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round;

      canvas.drawArc(rect, startAngle, sweepAngle, false, progressPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _CircularGaugePainter old) =>
      old.progress != progress || old.primaryColor != primaryColor;
}

// ---------------------------------------------------------------------------
// Standard responsive mockup screen: centered frame on large screens,
// back arrow + centered title (+ optional subtitle), scrollable body, sticky bottom.
// ---------------------------------------------------------------------------
class MockupScaffold extends StatelessWidget {
  final String title;
  final Widget? subtitle;
  final Widget? trailing;
  final Widget body;
  final Widget? bottom;
  final bool showBack;
  final VoidCallback? onBack;

  const MockupScaffold({
    super.key,
    required this.title,
    required this.body,
    this.subtitle,
    this.trailing,
    this.bottom,
    this.showBack = true,
    this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F7F5),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Color(0x0A064E3B),
                  blurRadius: 24,
                  offset: Offset(0, 4),
                )
              ],
            ),
            child: Scaffold(
              backgroundColor: Colors.white,
              appBar: AppBar(
                automaticallyImplyLeading: false,
                backgroundColor: Colors.white,
                surfaceTintColor: Colors.transparent,
                leading: showBack && (Navigator.of(context).canPop() || onBack != null)
                    ? IconButton(
                        icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20, color: AppTheme.primaryDark),
                        onPressed: onBack ?? () => Navigator.of(context).maybePop(),
                      )
                    : null,
                toolbarHeight: subtitle == null ? 56 : 68,
                title: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(title, style: AppTheme.font(size: 16.5, weight: FontWeight.w700, color: AppTheme.textPrimary)),
                    if (subtitle != null) ...[const SizedBox(height: 2), subtitle!],
                  ],
                ),
                actions: [if (trailing != null) trailing!, const SizedBox(width: 8)],
              ),
              body: SafeArea(
                top: false,
                child: Column(
                  children: [
                    Expanded(
                      child: SingleChildScrollView(
                        physics: const BouncingScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                        child: body,
                      ),
                    ),
                    if (bottom != null)
                      Container(
                        padding: const EdgeInsets.fromLTRB(20, 10, 20, 16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          border: Border(top: BorderSide(color: AppTheme.borderLight.withValues(alpha: 0.8))),
                        ),
                        child: bottom,
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Small "📅 Sen, 5 Mei 2025" line used under titles / at top of forms.
class DateLine extends StatelessWidget {
  final DateTime date;
  final bool centered;
  const DateLine({super.key, required this.date, this.centered = false});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: centered ? MainAxisSize.min : MainAxisSize.max,
      children: [
        const Icon(Icons.event_note_rounded, size: 14, color: AppTheme.primary),
        const SizedBox(width: 5),
        Text(DateFormat('EEE, d MMM yyyy', 'id_ID').format(date),
            style: AppTheme.font(size: 12, color: AppTheme.textSecondary)),
      ],
    );
  }
}

class SectionTitle extends StatelessWidget {
  final String text;
  final EdgeInsets padding;
  const SectionTitle(this.text, {super.key, this.padding = const EdgeInsets.only(top: 18, bottom: 10)});

  @override
  Widget build(BuildContext context) => Padding(
        padding: padding,
        child: Text(text, style: AppTheme.font(size: 14, weight: FontWeight.w700)),
      );
}

class FieldLabel extends StatelessWidget {
  final String text;
  const FieldLabel(this.text, {super.key});

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(top: 14, bottom: 6),
        child: Text(text, style: AppTheme.font(size: 13, color: AppTheme.textSecondary)),
      );
}

// ---------------------------------------------------------------------------
// Selectable tile with a face (mood / stres / kualitas tidur).
// ---------------------------------------------------------------------------
class FaceChoiceTile extends StatelessWidget {
  final String label;
  final FaceExpression face;
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  const FaceChoiceTile({
    super.key,
    required this.label,
    required this.face,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return _SelectableBox(
      selected: selected,
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedScale(
            scale: selected ? 1.08 : 1,
            duration: const Duration(milliseconds: 200),
            child: FaceBadge(expression: face, color: color, size: 32),
          ),
          const SizedBox(height: 6),
          Text(label,
              textAlign: TextAlign.center,
              maxLines: 2,
              style: AppTheme.font(
                size: 11,
                weight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? AppTheme.primaryDark : AppTheme.textSecondary,
                height: 1.2,
              )),
        ],
      ),
    );
  }
}

/// Icon in a soft circle + label (gejala). Selected = bordered tile.
class IconChoiceTile extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final bool selected;
  final VoidCallback onTap;

  const IconChoiceTile({
    super.key,
    required this.label,
    required this.icon,
    required this.color,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return _SelectableBox(
      selected: selected,
      onTap: onTap,
      showBorderWhenIdle: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(color: color.withValues(alpha: 0.13), shape: BoxShape.circle),
            child: Icon(icon, size: 20, color: color),
          ),
          const SizedBox(height: 6),
          Text(label,
              textAlign: TextAlign.center,
              maxLines: 2,
              style: AppTheme.font(
                size: 10.5,
                weight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? AppTheme.primaryDark : AppTheme.textSecondary,
                height: 1.2,
              )),
        ],
      ),
    );
  }
}

/// Square icon tile (aktivitas). Selected = filled primary with white icon.
class ActivityTile extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  const ActivityTile({
    super.key,
    required this.label,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: selected ? AppTheme.primary : AppTheme.fieldFill,
              borderRadius: BorderRadius.circular(14),
              boxShadow: selected
                  ? [BoxShadow(color: AppTheme.primary.withValues(alpha: 0.3), blurRadius: 10, offset: const Offset(0, 4))]
                  : null,
            ),
            child: Icon(icon, color: selected ? Colors.white : AppTheme.primaryDark, size: 24),
          ),
          const SizedBox(height: 6),
          Text(label,
              style: AppTheme.font(
                size: 11,
                weight: selected ? FontWeight.w700 : FontWeight.w500,
                color: selected ? AppTheme.primary : AppTheme.textSecondary,
              )),
        ],
      ),
    );
  }
}

class _SelectableBox extends StatelessWidget {
  final bool selected;
  final VoidCallback onTap;
  final Widget child;
  final bool showBorderWhenIdle;

  const _SelectableBox({
    required this.selected,
    required this.onTap,
    required this.child,
    this.showBorderWhenIdle = true,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
          decoration: BoxDecoration(
            color: selected ? AppTheme.primarySoft : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected
                  ? AppTheme.primaryLight
                  : (showBorderWhenIdle ? AppTheme.borderLight : Colors.transparent),
              width: selected ? 1.6 : 1,
            ),
          ),
          child: Center(child: child),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Icon + label + switch row ("Apakah Anda baru saja?", notifikasi, gangguan tidur)
// ---------------------------------------------------------------------------
class ToggleRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? sublabel;
  final bool value;
  final ValueChanged<bool> onChanged;

  const ToggleRow({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.onChanged,
    this.sublabel,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => onChanged(!value),
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: [
            Icon(icon, size: 19, color: AppTheme.primaryDark),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: AppTheme.font(size: 13.5)),
                  if (sublabel != null)
                    Text(sublabel!, style: AppTheme.font(size: 11.5, color: AppTheme.textMuted)),
                ],
              ),
            ),
            Transform.scale(scale: 0.85, child: Switch(value: value, onChanged: onChanged)),
          ],
        ),
      ),
    );
  }
}

/// Bordered radio row (tujuan penggunaan).
class RadioRow extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;
  const RadioRow({super.key, required this.label, required this.selected, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            color: selected ? AppTheme.primarySoft : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: selected ? AppTheme.primaryLight : AppTheme.borderLight),
          ),
          child: Row(
            children: [
              Icon(selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                  size: 20, color: selected ? AppTheme.primary : AppTheme.textMuted),
              const SizedBox(width: 10),
              Expanded(child: Text(label, style: AppTheme.font(size: 13))),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tonal "Masuk" style button (light green fill).
class TonalButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;
  final IconData? icon;
  const TonalButton({super.key, required this.label, required this.onPressed, this.icon});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 50,
      child: TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(
          backgroundColor: AppTheme.primarySoft,
          foregroundColor: AppTheme.primary,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (icon != null) ...[Icon(icon, size: 18), const SizedBox(width: 6)],
            Text(label, style: AppTheme.font(size: 15, weight: FontWeight.w600, color: AppTheme.primary)),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Smartwatch face (Contoh Integrasi Wearable, halaman 2 & 5).
// ---------------------------------------------------------------------------
class WatchFace extends StatelessWidget {
  final Widget child;
  final double width;
  const WatchFace({super.key, required this.child, this.width = 120});

  @override
  Widget build(BuildContext context) {
    final h = width * 1.30;
    return SizedBox(
      width: width,
      height: h + 36,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // strap
          Container(
            width: width * 0.62,
            height: h + 36,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF2B3431), Color(0xFF3D4844), Color(0xFF2B3431)],
              ),
              borderRadius: BorderRadius.circular(16),
            ),
          ),
          // case
          Container(
            width: width,
            height: h,
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: const Color(0xFF1F2523),
              borderRadius: BorderRadius.circular(width * 0.26),
              boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.25), blurRadius: 14, offset: const Offset(0, 6))],
            ),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.black,
                borderRadius: BorderRadius.circular(width * 0.22),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
              child: Center(child: child),
            ),
          ),
          // crown
          Positioned(
            right: 0,
            top: h * 0.42,
            child: Container(
              width: 5,
              height: 18,
              decoration: BoxDecoration(color: const Color(0xFF3D4844), borderRadius: BorderRadius.circular(2)),
            ),
          ),
        ],
      ),
    );
  }
}

/// Mini ECG-like line drawn on the watch.
class PulseLine extends StatelessWidget {
  final Color color;
  final double height;
  const PulseLine({super.key, this.color = AppTheme.accentMint, this.height = 14});

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: Size(double.infinity, height), painter: _PulsePainter(color));
}

class _PulsePainter extends CustomPainter {
  final Color color;
  _PulsePainter(this.color);

  @override
  void paint(Canvas canvas, Size s) {
    final p = Path()..moveTo(0, s.height * 0.6);
    final step = s.width / 40;
    for (var i = 1; i <= 40; i++) {
      final x = i * step;
      double y = s.height * 0.6 + math.sin(i * 0.9) * 1.5;
      if (i % 13 == 6) y = s.height * 0.05;
      if (i % 13 == 7) y = s.height * 0.95;
      p.lineTo(x, y);
    }
    canvas.drawPath(
      p,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

void showSaved(BuildContext context, String msg) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(content: Text(msg), duration: const Duration(milliseconds: 1400)));
}

String fmtTime(TimeOfDay t) =>
    '${t.hour.toString().padLeft(2, '0')}.${t.minute.toString().padLeft(2, '0')}';
