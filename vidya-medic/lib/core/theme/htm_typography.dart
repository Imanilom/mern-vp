import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class HtmTypography {
  static TextTheme get textTheme {
    return TextTheme(
      displayLarge: GoogleFonts.fraunces(
        fontSize: 28,
        fontWeight: FontWeight.w600, // Approximating 560 weight
        letterSpacing: -0.01,
      ),
      displayMedium: GoogleFonts.fraunces(
        fontSize: 22,
        fontWeight: FontWeight.w600, // Approximating 560 weight
      ),
      titleMedium: GoogleFonts.ibmPlexSans(
        fontSize: 16,
        fontWeight: FontWeight.w500,
      ),
      bodyLarge: GoogleFonts.ibmPlexSans(
        fontSize: 15,
        fontWeight: FontWeight.w400,
      ),
      bodyMedium: GoogleFonts.ibmPlexSans(
        fontSize: 13,
        fontWeight: FontWeight.w400,
      ),
      labelSmall: GoogleFonts.ibmPlexMono(
        fontSize: 10,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.1,
      ),
    );
  }

  // Custom style for technical metrics/code
  static TextStyle get dataText => GoogleFonts.ibmPlexMono(
        fontSize: 15,
        fontWeight: FontWeight.w400,
      );

  static TextStyle get dataTextMedium => GoogleFonts.ibmPlexMono(
        fontSize: 15,
        fontWeight: FontWeight.w500,
      );
}
