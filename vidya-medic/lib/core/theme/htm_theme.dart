import 'package:flutter/material.dart';
import 'htm_colors.dart';
import 'htm_spacing.dart';
import 'htm_typography.dart';

class HtmTheme {
  static ThemeData get lightTheme {
    final textTheme = HtmTypography.textTheme;
    final colors = HtmColors._light;

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: ColorScheme.light(
        primary: colors.primary,
        surface: colors.surface,
        onSurface: colors.ink,
        onPrimary: colors.canvas,
        outline: colors.hairline,
        error: HtmColors.alert,
      ),
      scaffoldBackgroundColor: colors.canvas,
      canvasColor: colors.canvas,
      cardColor: colors.surface,
      dividerColor: colors.hairline,
      textTheme: textTheme,
      primaryTextTheme: textTheme,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: colors.canvas,
        foregroundColor: colors.ink,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: textTheme.titleMedium?.copyWith(color: colors.ink),
        toolbarHeight: 72,
        shape: Border(bottom: BorderSide(color: colors.hairline, width: 1)),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: colors.surface,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: colors.hairline, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          foregroundColor: colors.canvas,
          backgroundColor: colors.ink,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: textTheme.titleMedium?.copyWith(color: colors.canvas),
        ).copyWith(
          overlayColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.pressed)
                ? colors.hairline.withValues(alpha: 0.3)
                : null;
          }),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          foregroundColor: colors.canvas,
          backgroundColor: colors.ink,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: textTheme.titleMedium?.copyWith(color: colors.canvas),
        ).copyWith(
          overlayColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.pressed)
                ? colors.hairline.withValues(alpha: 0.3)
                : null;
          }),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: colors.primary,
          backgroundColor: Colors.transparent,
          side: BorderSide(color: colors.primary, width: 1),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: textTheme.titleMedium?.copyWith(color: colors.primary),
        ).copyWith(
          overlayColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.pressed)
                ? colors.primary.withValues(alpha: 0.08)
                : null;
          }),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: colors.primary,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          textStyle: textTheme.titleMedium?.copyWith(color: colors.primary),
        ).copyWith(
          overlayColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.pressed)
                ? colors.primary.withValues(alpha: 0.08)
                : null;
          }),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: false,
        contentPadding: const EdgeInsets.symmetric(vertical: HtmSpacing.sm, horizontal: 0),
        border: UnderlineInputBorder(borderSide: BorderSide(color: colors.hairline, width: 1)),
        enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: colors.hairline, width: 1)),
        focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: colors.primary, width: 1.5)),
        errorBorder: UnderlineInputBorder(borderSide: BorderSide(color: HtmColors.alert, width: 1)),
        focusedErrorBorder: UnderlineInputBorder(borderSide: BorderSide(color: HtmColors.alert, width: 1.5)),
        hintStyle: textTheme.bodyMedium?.copyWith(color: colors.muted),
        labelStyle: textTheme.labelSmall?.copyWith(color: colors.muted),
      ),
      navigationBarTheme: NavigationBarThemeData(
        elevation: 0,
        height: 64,
        backgroundColor: colors.surface,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.transparent,
        indicatorColor: colors.primary.withValues(alpha: 0.10),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return textTheme.labelSmall?.copyWith(color: colors.primary);
          }
          return textTheme.labelSmall?.copyWith(color: colors.muted);
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return IconThemeData(color: colors.primary, size: 20);
          }
          return IconThemeData(color: colors.muted, size: 20);
        }),
      ),
      chipTheme: ChipThemeData(
        shape: StadiumBorder(side: BorderSide(color: colors.hairline)),
        backgroundColor: colors.surface,
        side: BorderSide(color: colors.hairline),
        padding: const EdgeInsets.symmetric(horizontal: HtmSpacing.sm, vertical: HtmSpacing.xs),
        labelStyle: textTheme.labelSmall?.copyWith(color: colors.ink),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: colors.surface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        elevation: 0,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: colors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        elevation: 0,
      ),
      dividerTheme: DividerThemeData(color: colors.hairline, space: HtmSpacing.md, thickness: 1),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        backgroundColor: colors.surface,
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: colors.ink),
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.iOS: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.linux: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.macOS: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
        },
      ),
    );
  }

  static ThemeData get darkTheme {
    final textTheme = HtmTypography.textTheme;
    final colors = HtmColors._dark;

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.dark(
        primary: colors.primary,
        surface: colors.surface,
        onSurface: colors.ink,
        onPrimary: colors.canvas,
        outline: colors.hairline,
        error: HtmColors.alert,
      ),
      scaffoldBackgroundColor: colors.canvas,
      canvasColor: colors.canvas,
      cardColor: colors.surface,
      dividerColor: colors.hairline,
      textTheme: textTheme,
      primaryTextTheme: textTheme,
      appBarTheme: AppBarTheme(
        centerTitle: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        backgroundColor: colors.canvas,
        foregroundColor: colors.ink,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: textTheme.titleMedium?.copyWith(color: colors.ink),
        toolbarHeight: 72,
        shape: Border(bottom: BorderSide(color: colors.hairline, width: 1)),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: colors.surface,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: colors.hairline, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          foregroundColor: colors.canvas,
          backgroundColor: colors.ink,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: textTheme.titleMedium?.copyWith(color: colors.canvas),
        ).copyWith(
          overlayColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.pressed)
                ? colors.hairline.withValues(alpha: 0.3)
                : null;
          }),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          foregroundColor: colors.canvas,
          backgroundColor: colors.ink,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: textTheme.titleMedium?.copyWith(color: colors.canvas),
        ).copyWith(
          overlayColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.pressed)
                ? colors.hairline.withValues(alpha: 0.3)
                : null;
          }),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: colors.primary,
          backgroundColor: Colors.transparent,
          side: BorderSide(color: colors.primary, width: 1),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: textTheme.titleMedium?.copyWith(color: colors.primary),
        ).copyWith(
          overlayColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.pressed)
                ? colors.primary.withValues(alpha: 0.08)
                : null;
          }),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: colors.primary,
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          textStyle: textTheme.titleMedium?.copyWith(color: colors.primary),
        ).copyWith(
          overlayColor: WidgetStateProperty.resolveWith((states) {
            return states.contains(WidgetState.pressed)
                ? colors.primary.withValues(alpha: 0.08)
                : null;
          }),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: false,
        contentPadding: const EdgeInsets.symmetric(vertical: HtmSpacing.sm, horizontal: 0),
        border: UnderlineInputBorder(borderSide: BorderSide(color: colors.hairline, width: 1)),
        enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: colors.hairline, width: 1)),
        focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: colors.primary, width: 1.5)),
        errorBorder: UnderlineInputBorder(borderSide: BorderSide(color: HtmColors.alert, width: 1)),
        focusedErrorBorder: UnderlineInputBorder(borderSide: BorderSide(color: HtmColors.alert, width: 1.5)),
        hintStyle: textTheme.bodyMedium?.copyWith(color: colors.muted),
        labelStyle: textTheme.labelSmall?.copyWith(color: colors.muted),
      ),
      navigationBarTheme: NavigationBarThemeData(
        elevation: 0,
        height: 64,
        backgroundColor: colors.surface,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.transparent,
        indicatorColor: colors.primary.withValues(alpha: 0.10),
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return textTheme.labelSmall?.copyWith(color: colors.primary);
          }
          return textTheme.labelSmall?.copyWith(color: colors.muted);
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return IconThemeData(color: colors.primary, size: 20);
          }
          return IconThemeData(color: colors.muted, size: 20);
        }),
      ),
      chipTheme: ChipThemeData(
        shape: StadiumBorder(side: BorderSide(color: colors.hairline)),
        backgroundColor: colors.surface,
        side: BorderSide(color: colors.hairline),
        padding: const EdgeInsets.symmetric(horizontal: HtmSpacing.sm, vertical: HtmSpacing.xs),
        labelStyle: textTheme.labelSmall?.copyWith(color: colors.ink),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: colors.surface,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        elevation: 0,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: colors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        elevation: 0,
      ),
      dividerTheme: DividerThemeData(color: colors.hairline, space: HtmSpacing.md, thickness: 1),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        backgroundColor: colors.surface,
        contentTextStyle: textTheme.bodyMedium?.copyWith(color: colors.ink),
      ),
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.iOS: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.linux: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.macOS: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.windows: FadeUpwardsPageTransitionsBuilder(),
        },
      ),
    );
  }
}
