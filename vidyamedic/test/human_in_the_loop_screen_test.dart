import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:nadiku/providers/app_state.dart';
import 'package:nadiku/screens/scenarios/human_in_the_loop_screen.dart';

Widget _app(AppState state) => ChangeNotifierProvider<AppState>.value(
      value: state,
      child: const MaterialApp(home: HumanInTheLoopScreen()),
    );

ListTile _scenarioTile(WidgetTester tester, String code) =>
    tester.widget<ListTile>(
      find.descendant(
        of: find.byKey(Key('hil-scenario-$code')),
        matching: find.byType(ListTile),
      ),
    );

Future<void> _acceptHilConsent(WidgetTester tester) async {
  final openConsent = find.byKey(const Key('hil-research-consent-open'));
  await tester.ensureVisible(openConsent);
  await tester.tap(openConsent);
  await tester.pumpAndSettle();
  final checkbox = find.byKey(const Key('hil-research-consent-check'));
  await tester.ensureVisible(checkbox);
  await tester.pumpAndSettle();
  await tester.tap(checkbox);
  await tester.pump();
  final accept = find.byKey(const Key('hil-research-consent-accept'));
  await tester.ensureVisible(accept);
  await tester.pumpAndSettle();
  await tester.tap(accept);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('baseline profile opens the ordered three-step HCI flow',
      (tester) async {
    final state = AppState()
      ..rawCaparInsights = {
        'capar': {
          'baseline': {'contexts': []},
        },
      };
    addTearDown(state.dispose);

    await tester.pumpWidget(_app(state));

    expect(find.byKey(const Key('hil-baseline-activity')), findsNothing);
    expect(find.byKey(const Key('hil-baseline-step-1')), findsOneWidget);
    expect(find.byKey(const Key('hil-baseline-step-2')), findsOneWidget);
    expect(find.byKey(const Key('hil-baseline-step-3')), findsOneWidget);

    final startButton = find.byKey(const Key('hil-start-guided-baseline'));
    expect(tester.widget<FilledButton>(startButton).onPressed, isNull);
    await _acceptHilConsent(tester);
    await tester.ensureVisible(startButton);
    expect(tester.widget<FilledButton>(startButton).onPressed, isNotNull);
    await tester.tap(startButton);
    await tester.pumpAndSettle();

    expect(find.text('Perekaman baseline terpandu'), findsOneWidget);
    expect(find.text('KONTEKS 1 DARI 3'), findsOneWidget);
    expect(find.text('Duduk'), findsOneWidget);
    await tester.pageBack();
    await tester.pumpAndSettle();
  });

  testWidgets(
      'Human In the Loop locks B/C until matching activity baseline is mature',
      (tester) async {
    final state = AppState()
      ..rawCaparInsights = {
        'capar': {
          'baseline': {
            'contexts': [
              {'activity': 'sitting', 'level': 'provisional'},
            ],
          },
          'mahalanobis': [
            {
              'available': true,
              'state': 'moderately_displaced',
              'activity': 'sitting',
              'distance': 2.4,
            },
          ],
          'pedagogy': {
            'what_changed': {
              'main_factors': [
                {'physiology': 'mean_hr'},
              ],
            },
            'follow_up': {'status': 'requested'},
            'reasoning_resolution': {
              'status': 'awaiting_clarification',
              'interpretation': 'Klarifikasi diperlukan.',
              'next_step': 'collect_patient_context',
            },
          },
          'reasoning_pipeline': {
            'stages': [
              {'stage_id': 'quality_gate', 'status': 'passed'},
              {
                'stage_id': 'personal_baseline',
                'status': 'mature',
                'activity': 'sitting',
                'segment_count': 30,
              },
            ],
          },
        },
      };
    addTearDown(state.dispose);

    await tester.pumpWidget(_app(state));

    expect(find.text('Human In the Loop'), findsOneWidget);
    expect(find.textContaining('terpisah dari eksperimen HCI'), findsNothing);
    expect(find.textContaining('Pembentukan baseline per aktivitas'),
        findsOneWidget);
    expect(find.textContaining('One-way feedback'), findsOneWidget);
    expect(find.textContaining('Human in the loop'), findsOneWidget);
    expect(find.byKey(const Key('hil-scenarios-locked')), findsOneWidget);
    expect(_scenarioTile(tester, 'B').onTap, isNull);
    expect(_scenarioTile(tester, 'C').onTap, isNull);
    expect(find.byKey(const Key('hil-consent-required')), findsOneWidget);

    expect(find.text('Deteksi perubahan dari z-score'), findsOneWidget);
    expect(find.text('Periksa kualitas dan baseline'), findsOneWidget);
    expect(find.text('Tinjau bukti dan batas interpretasi'), findsOneWidget);
    expect(find.text('Tafsir ulang hanya jika bukti cukup'), findsOneWidget);
    expect(find.text('Feedback dan observasi lanjutan'), findsOneWidget);
    expect(find.text('Isi klarifikasi lanjutan'), findsOneWidget);
    expect(find.text('Dua arah nonadaptif'), findsNothing);
  });

  testWidgets('mature matching activity baseline enables z-score B and C',
      (tester) async {
    final state = AppState()
      ..rawCaparInsights = {
        'capar': {
          'baseline': {
            'contexts': [
              {
                'activity': 'sitting',
                'time_period': 'morning',
                'level': 'mature',
                'segment_count': 35,
              },
            ],
          },
          'latest_observation': {
            'status': 'available',
            'activity': 'sitting',
            'time_period': 'morning',
            'features': [
              {
                'feature': 'mean_hr',
                'label': 'HR rata-rata',
                'z_score': 0.4,
              },
              {
                'feature': 'rmssd',
                'label': 'RMSSD',
                'z_score': -0.5,
              },
            ],
          },
          'mahalanobis': [
            {
              'available': true,
              'state': 'strongly_displaced',
              'activity': 'sitting',
              'distance': 3.2,
              'features': {
                'mean_hr': 110,
                'delta_hr': 32,
              },
            },
          ],
          'pedagogy': {
            'reasoning_pipeline': {
              'stages': [
                {'stage_id': 'quality_gate', 'status': 'passed'},
                {'stage_id': 'personal_baseline', 'status': 'mature'},
              ],
            },
          },
        },
      };
    addTearDown(state.dispose);

    await tester.pumpWidget(_app(state));

    expect(find.byKey(const Key('hil-scenarios-locked')), findsNothing);
    expect(_scenarioTile(tester, 'B').onTap, isNull);
    expect(_scenarioTile(tester, 'C').onTap, isNull);
    await _acceptHilConsent(tester);
    expect(_scenarioTile(tester, 'B').onTap, isNotNull);
    expect(_scenarioTile(tester, 'C').onTap, isNotNull);

    await tester.ensureVisible(find.byKey(const Key('hil-scenario-B')));
    await tester.tap(find.byKey(const Key('hil-scenario-B')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('hil-one-way-result')), findsOneWidget);
    expect(find.textContaining('HR rata-rata z=0.40'), findsWidgets);
    expect(find.textContaining('tanpa tau tambahan'), findsWidgets);
    expect(find.textContaining('RMSSD'), findsNothing);
    expect(find.byKey(const Key('hil-human-loop-form')), findsNothing);

    await tester.ensureVisible(find.byKey(const Key('hil-scenario-C')));
    await tester.tap(find.byKey(const Key('hil-scenario-C')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('hil-one-way-result')), findsNothing);
    expect(find.byKey(const Key('hil-human-loop-form')), findsOneWidget);
    expect(find.textContaining('aktivitas fisik berat'), findsOneWidget);
    expect(find.byKey(const Key('hil-submit-clarification')), findsOneWidget);
    expect(find.byKey(const Key('hil-open-live-monitor')), findsOneWidget);
  });

  testWidgets('a mature baseline for another activity cannot unlock the event',
      (tester) async {
    final state = AppState()
      ..rawCaparInsights = {
        'capar': {
          'baseline': {
            'contexts': [
              {
                'activity': 'walking',
                'time_period': 'morning',
                'level': 'mature',
                'segment_count': 35,
              },
              {
                'activity': 'sitting',
                'time_period': 'evening',
                'level': 'mature',
                'segment_count': 40,
              },
            ],
          },
          'latest_observation': {
            'status': 'insufficient_data',
            'activity': 'sitting',
            'time_period': 'morning',
            'features': [],
          },
        },
      };
    addTearDown(state.dispose);

    await tester.pumpWidget(_app(state));

    expect(_scenarioTile(tester, 'B').onTap, isNull);
    expect(_scenarioTile(tester, 'C').onTap, isNull);
    expect(find.textContaining('Berjalan'), findsWidgets);
  });
}
