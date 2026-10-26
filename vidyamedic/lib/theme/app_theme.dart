import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Navy and teal design system based on the VIDYAMEDIC mobile mockup.
class AppTheme {
  static const Color primary = Color(0xFF168C87);
  static const Color primaryDark = Color(0xFF182B42);
  static const Color primaryDeep = Color(0xFF142336);
  static const Color primaryLight = Color(0xFF45B7AE);
  static const Color primarySoft = Color(0xFFE8F6F3);
  static const Color primaryContainer = Color(0xFFD2EBE7);
  static const Color accent = Color(0xFF168C87);
  static const Color accentMint = Color(0xFF73D0C4);
  static const Color accentTeal = Color(0xFF168C87);

  // Neutrals & Surfaces
  static const Color background = Color(0xFFF3F7FA);
  static const Color surface = Colors.white;
  static const Color surfaceCard = Colors.white;
  static const Color fieldFill = Color(0xFFF1F5F8);
  static const Color border = Color(0xFFE1E9F0);
  static const Color borderLight = Color(0xFFE7EDF2);
  static const Color divider = Color(0xFFEEF2F6);

  // Text
  static const Color textPrimary = Color(0xFF243A50);
  static const Color textSecondary = Color(0xFF5E7086);
  static const Color textMuted = Color(0xFF8798AA);
  static const Color textInverted = Colors.white;

  // Face / status colors
  static const Color faceGreen = Color(0xFF10B981);
  static const Color faceYellow = Color(0xFFF59E0B);
  static const Color faceOrange = Color(0xFFF97316);
  static const Color faceRed = Color(0xFFEF4444);

  // Action engine / Triage colors
  static const Color statusGreen = Color(0xFF10B981);
  static const Color statusGreenBg = Color(0xFFECFDF5);
  static const Color statusYellow = Color(0xFFF59E0B);
  static const Color statusYellowBg = Color(0xFFFFFBEB);
  static const Color statusOrange = Color(0xFFEA580C);
  static const Color statusOrangeBg = Color(0xFFFFF7ED);
  static const Color statusRed = Color(0xFFDC2626);
  static const Color statusRedBg = Color(0xFFFEF2F2);

  // Gradients
  static const LinearGradient primaryGradient = LinearGradient(
    colors: [Color(0xFF168C87), Color(0xFF126E74)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient heroGradient = LinearGradient(
    colors: [Color(0xFF1B4055), Color(0xFF176F75), Color(0xFF168C87)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient cardGlowGradient = LinearGradient(
    colors: [Color(0xFFFFFFFF), Color(0xFFF4F8FA)],
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
  );

  static const LinearGradient accentMintGradient = LinearGradient(
    colors: [Color(0xFF45B7AE), Color(0xFF168C87)],
    begin: Alignment.centerLeft,
    end: Alignment.centerRight,
  );

  // Premium Multi-layer Shadows
  static List<BoxShadow> shadowSoft = [
    BoxShadow(
      color: const Color(0xFF182B42).withValues(alpha: 0.04),
      blurRadius: 10,
      offset: const Offset(0, 3),
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.02),
      blurRadius: 4,
      offset: const Offset(0, 1),
    ),
  ];

  static List<BoxShadow> shadowCard = [
    BoxShadow(
      color: const Color(0xFF182B42).withValues(alpha: 0.06),
      blurRadius: 20,
      offset: const Offset(0, 8),
      spreadRadius: -2,
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.03),
      blurRadius: 8,
      offset: const Offset(0, 2),
    ),
  ];

  static List<BoxShadow> shadowGlow = [
    BoxShadow(
      color: primary.withValues(alpha: 0.28),
      blurRadius: 18,
      offset: const Offset(0, 6),
    ),
  ];

  static TextStyle font({
    double size = 14,
    FontWeight weight = FontWeight.w400,
    Color color = textPrimary,
    double? height,
    double? letterSpacing,
  }) =>
      GoogleFonts.plusJakartaSans(
        fontSize: size,
        fontWeight: weight,
        color: color,
        height: height,
        letterSpacing: letterSpacing,
      );

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: background,
      primaryColor: primary,
      colorScheme: ColorScheme.fromSeed(
        seedColor: primary,
        primary: primary,
        surface: surface,
        error: statusRed,
      ),
      textTheme: GoogleFonts.plusJakartaSansTextTheme(),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        iconTheme: const IconThemeData(color: textPrimary),
        titleTextStyle: font(size: 16.5, weight: FontWeight.w700, color: textPrimary),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          elevation: 0,
          shadowColor: Colors.transparent,
          minimumSize: const Size.fromHeight(50),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: font(size: 15, weight: FontWeight.w700),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          minimumSize: const Size.fromHeight(50),
          side: const BorderSide(color: border, width: 1.2),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: font(size: 15, weight: FontWeight.w600),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: primary, width: 1.5),
        ),
        hintStyle: font(size: 14, color: textMuted),
        suffixStyle: font(size: 13, color: textMuted),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.all(Colors.white),
        trackColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? primary : const Color(0xFFD0DCD7),
        ),
        trackOutlineColor: WidgetStateProperty.all(Colors.transparent),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith(
          (s) => s.contains(WidgetState.selected) ? primary : Colors.white,
        ),
        side: const BorderSide(color: Color(0xFFB4C5BF), width: 1.4),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
      ),
      sliderTheme: SliderThemeData(
        activeTrackColor: primary,
        inactiveTrackColor: const Color(0xFFDEE7E3),
        thumbColor: Colors.white,
        overlayColor: primary.withValues(alpha: 0.12),
        trackHeight: 6,
        thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 10, elevation: 3),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: primaryDark,
        behavior: SnackBarBehavior.floating,
        contentTextStyle: font(size: 13, color: Colors.white, weight: FontWeight.w500),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
