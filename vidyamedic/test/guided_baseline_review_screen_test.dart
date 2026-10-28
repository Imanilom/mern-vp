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

    final next = find.byKey(const Key('baseline-review-next'));
    await tester.scrollUntilVisible(next, 250);
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

    await tester.ensureVisible(next);
    await tester.tap(next);
    await tester.pumpAndSettle();

    expect(find.text('Tahap 5/6'), findsOneWidget);
    expect(
        find.text('Konfirmasi atau koreksi konteks rekaman'), findsOneWidget);
    expect(
      find.byKey(const Key('baseline-correction-start-time')),
      findsOneWidget,
    );
    expect(
      find.byKey(const Key('baseline-correction-end-time')),
      findsOneWidget,
    );
    expect(
      find.byKey(const Key('baseline-correction-activity')),
      findsOneWidget,
    );
    expect(
      find.byKey(const Key('baseline-correction-activity-unsure')),
      findsOneWidget,
    );
    expect(
      find.byKey(const Key('baseline-correction-activity-sitting')),
      findsOneWidget,
    );
    expect(find.byType(DropdownButtonFormField<String>), findsNothing);

    final moodOption = find.byKey(
      const Key('baseline-correction-mood-stressed'),
    );
    await tester.ensureVisible(moodOption);
    await tester.pumpAndSettle();
    await tester.tap(moodOption);
    await tester.pumpAndSettle();
    expect(tester.widget<ChoiceChip>(moodOption).selected, isTrue);

    final caffeineOption = find.byKey(
      const Key('baseline-correction-caffeine-consumed'),
    );
    await tester.ensureVisible(caffeineOption);
    await tester.pumpAndSettle();
    await tester.tap(caffeineOption);
    await tester.pumpAndSettle();
    expect(tester.widget<ChoiceChip>(caffeineOption).selected, isTrue);

    final factorOption = find.byKey(
      const Key('baseline-correction-factor-poor_sleep'),
    );
    await tester.ensureVisible(factorOption);
    await tester.pumpAndSettle();
    expect(
      factorOption,
      findsOneWidget,
    );
    expect(
      find.byKey(const Key('baseline-correction-mood-unsure')),
      findsOneWidget,
    );
    expect(find.text('Suasana hati'), findsOneWidget);
    expect(find.text('Konsumsi kafein'), findsOneWidget);
    expect(find.text('Makan pada/sekitar rentang waktu ini'), findsOneWidget);
  });
}
