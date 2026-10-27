import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:nadiku/providers/app_state.dart';
import 'package:nadiku/screens/scenarios/human_in_the_loop_screen.dart';

Widget _app(AppState state) => ChangeNotifierProvider<AppState>.value(
      value: state,
      child: const MaterialApp(home: HumanInTheLoopScreen()),
    );

void main() {
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
    expect(find.textContaining('Pembentukan baseline per aktivitas'),
        findsOneWidget);
    expect(find.textContaining('One-way feedback'), findsOneWidget);
    expect(find.textContaining('Human in the loop'), findsOneWidget);
    expect(find.byKey(const Key('hil-scenarios-locked')), findsOneWidget);
    expect(
        tester
            .widget<OutlinedButton>(
              find.byKey(const Key('hil-scenario-B')),
            )
            .onPressed,
        isNull);
    expect(
        tester
            .widget<OutlinedButton>(
              find.byKey(const Key('hil-scenario-C')),
            )
            .onPressed,
        isNull);

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
    expect(
        tester
            .widget<OutlinedButton>(
              find.byKey(const Key('hil-scenario-B')),
            )
            .onPressed,
        isNotNull);
    expect(
        tester
            .widget<OutlinedButton>(
              find.byKey(const Key('hil-scenario-C')),
            )
            .onPressed,
        isNotNull);

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

    expect(
      tester
          .widget<OutlinedButton>(
            find.byKey(const Key('hil-scenario-B')),
          )
          .onPressed,
      isNull,
    );
    expect(
      tester
          .widget<OutlinedButton>(
            find.byKey(const Key('hil-scenario-C')),
          )
          .onPressed,
      isNull,
    );
    expect(find.textContaining('Berjalan'), findsWidgets);
  });
}
