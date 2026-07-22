import 'package:flutter/material.dart';
import 'htm_colors.dart';

@immutable
class FunctionalColors extends ThemeExtension<FunctionalColors> {
  final Color dataBlue;
  final Color stableGreen;
  final Color attentionYellow;
  final Color deviationOrange;
  final Color alertRed;
  final Color modelPurple;
  final Color inactiveGrey;

  const FunctionalColors({
    required this.dataBlue,
    required this.stableGreen,
    required this.attentionYellow,
    required this.deviationOrange,
    required this.alertRed,
    required this.modelPurple,
    required this.inactiveGrey,
  });

  static const light = FunctionalColors(
    dataBlue: HtmColors.primaryLight,       // Clinical sage green
    stableGreen: HtmColors.stable,
    attentionYellow: HtmColors.attention,
    deviationOrange: HtmColors.deviation,
    alertRed: HtmColors.alert,
    modelPurple: HtmColors.model,
    inactiveGrey: HtmColors.inactive,
  );

  static const dark = FunctionalColors(
    dataBlue: HtmColors.primaryDark,
    stableGreen: HtmColors.primaryDark,
    attentionYellow: HtmColors.attention,
    deviationOrange: HtmColors.deviation,
    alertRed: HtmColors.alert,
    modelPurple: HtmColors.model,
    inactiveGrey: HtmColors.inactive,
  );

  @override
  FunctionalColors copyWith({
    Color? dataBlue,
    Color? stableGreen,
    Color? attentionYellow,
    Color? deviationOrange,
    Color? alertRed,
    Color? modelPurple,
    Color? inactiveGrey,
  }) {
    return FunctionalColors(
      dataBlue: dataBlue ?? this.dataBlue,
      stableGreen: stableGreen ?? this.stableGreen,
      attentionYellow: attentionYellow ?? this.attentionYellow,
      deviationOrange: deviationOrange ?? this.deviationOrange,
      alertRed: alertRed ?? this.alertRed,
      modelPurple: modelPurple ?? this.modelPurple,
      inactiveGrey: inactiveGrey ?? this.inactiveGrey,
    );
  }

  @override
  FunctionalColors lerp(ThemeExtension<FunctionalColors>? other, double t) {
    if (other is! FunctionalColors) return this;
    return FunctionalColors(
      dataBlue: Color.lerp(dataBlue, other.dataBlue, t)!,
      stableGreen: Color.lerp(stableGreen, other.stableGreen, t)!,
      attentionYellow: Color.lerp(attentionYellow, other.attentionYellow, t)!,
      deviationOrange: Color.lerp(deviationOrange, other.deviationOrange, t)!,
      alertRed: Color.lerp(alertRed, other.alertRed, t)!,
      modelPurple: Color.lerp(modelPurple, other.modelPurple, t)!,
      inactiveGrey: Color.lerp(inactiveGrey, other.inactiveGrey, t)!,
    );
  }
}
