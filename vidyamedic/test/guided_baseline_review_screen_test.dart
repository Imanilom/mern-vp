import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:nadiku/providers/app_state.dart';
import 'package:nadiku/screens/scenarios/guided_baseline_review_screen.dart';

void main() {
  testWidgets('baseline review shows recorded-data chart then stage 4',
      (tester) async {
    final state = AppState()
      ..rawCaparInsights = {
        'capar': {
          'baseline': {'contexts': []},
          'trajectory_30d': [],
        },
      };
    addTearDown(state.dispose);

    await tester.pumpWidget(
      ChangeNotifierProvider<AppState>.value(
        value: state,
        child: MaterialApp(
          home: GuidedBaselineReviewScreen(
            stageResults: [
              {
                'activity': 'sitting',
                'label': 'Duduk',
                'minimum_hr': 62,
                'maximum_hr': 74,
                'reading_count': 2,
                'rr_interval_count': 2,
                'skipped': false,
                'incomplete': false,
                'recorded_readings': [
                  {
                    'recorded_at': '2026-10-20T01:00:00.000Z',
                    'heart_rate_bpm': 65,
                    'rr_interval_ms': 920,
                  },
                  {
                    'recorded_at': '2026-10-20T01:01:00.000Z',
                    'heart_rate_bpm': 68,
                    'rr_interval_ms': 900,
                  },
                ],
              },
            ],
          ),
        ),
      ),
    );

    expect(find.text('Tahap 3/6'), findsOneWidget);
    expect(find.text('Profil kesehatan personal'), findsOneWidget);
    expect(find.text('Detak jantung selama sesi baseline'), findsOneWidget);
    expect(find.byType(CustomPaint), findsWidgets);

    final next = find.text('Lanjut ke tahap 4');
    await tester.ensureVisible(next);
    await tester.tap(next);
    await tester.pumpAndSettle();

    expect(find.text('Tahap 4/6'), findsOneWidget);
    expect(find.text('Perubahan yang teramati'), findsOneWidget);
    expect(
      find.text(
        'Baseline matang untuk konteks ini belum tersedia · 2 pembacaan sesi',
      ),
      findsOneWidget,
    );
  });
}
