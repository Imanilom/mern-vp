import 'package:flutter/material.dart';
import 'functional_colors.dart';
import 'htm_theme.dart';

class AppTheme {
  static ThemeData get lightTheme => HtmTheme.lightTheme.copyWith(
        extensions: const <ThemeExtension<dynamic>>[FunctionalColors.light],
      );

  static ThemeData get darkTheme => HtmTheme.darkTheme.copyWith(
        extensions: const <ThemeExtension<dynamic>>[FunctionalColors.dark],
      );
}
