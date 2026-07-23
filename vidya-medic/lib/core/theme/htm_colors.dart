import 'package:flutter/material.dart';

class HtmColors {
  // ─── LIGHT PALETTE ──────────────────────────────────────────────────────────
  static const canvasLight = Color(0xFFF7F5F0);
  static const surfaceLight = Color(0xFFFFFFFF);
  static const primaryLight = Color(0xFF2F6F5E);
  static const inkLight = Color(0xFF16302B);
  static const mutedLight = Color(0xFF6B6459);
  static const hairlineLight = Color(0xFFE4DFD3);

  // ─── DARK PALETTE ───────────────────────────────────────────────────────────
  static const canvasDark = Color(0xFF12181F);
  static const surfaceDark = Color(0xFF1E2631);
  static const primaryDark = Color(0xFF4E9F86);
  static const inkDark = Color(0xFFFFFFFF);
  static const mutedDark = Color(0xFF9E978C);
  static const hairlineDark = Color(0xFF3E4651);

  // ─── STATUS COLORS (Clinical Calm) ──────────────────────────────────────────
  static const Color stable = Color(0xFF2F6F5E);
  static const Color attention = Color(0xFFD9A05B);
  static const Color deviation = Color(0xFFD97706);
  static const Color alert = Color(0xFFC0392B);
  static const Color model = Color(0xFF7209B7);
  static const Color inactive = Color(0xFF8D8D8D);

  // ─── DYNAMIC GETTERS (Theme-Aware) ──────────────────────────────────────────
  final Color canvas;
  final Color surface;
  final Color primary;
  final Color ink;
  final Color muted;
  final Color hairline;

  const HtmColors._({
    required this.canvas,
    required this.surface,
    required this.primary,
    required this.ink,
    required this.muted,
    required this.hairline,
  });

  static HtmColors of(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return isDark ? dark : light;
  }

  static const light = HtmColors._(
    canvas: canvasLight,
    surface: surfaceLight,
    primary: primaryLight,
    ink: inkLight,
    muted: mutedLight,
    hairline: hairlineLight,
  );

  static const dark = HtmColors._(
    canvas: canvasDark,
    surface: surfaceDark,
    primary: primaryDark,
    ink: inkDark,
    muted: mutedDark,
    hairline: hairlineDark,
  );
}
