import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:nadiku/models/health_models.dart';
import 'package:nadiku/providers/app_state.dart';
import 'package:nadiku/screens/scenarios/guided_baseline_session_screen.dart';
import 'package:nadiku/screens/scenarios/human_in_the_loop_screen.dart';
import 'package:nadiku/screens/scenarios/hil_recorded_scenario_screen.dart';

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
  testWidgets('guided baseline displays HR after the sensor stream starts',
      (tester) async {
    final state = AppState();
    addTearDown(state.dispose);
    expect(await state.wearableBridge.connectDummyDevice(), isTrue);

    await tester.pumpWidget(
      ChangeNotifierProvider<AppState>.value(
        value: state,
        child: const MaterialApp(
          home: GuidedBaselineSessionScreen(isHilBaselineRecording: true),
        ),
      ),
    );
    final startButton = find.text('Rekam 5 menit');
    await tester.ensureVisible(startButton);
    await tester.tap(startButton);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Saya siap'));
    await tester.pump();

    expect(find.text('Saat ini'), findsOneWidget);
    expect(find.text('70'), findsWidgets);
    expect(
      find.textContaining('menunggu HR pertama'),
      findsNothing,
    );
    await tester.pumpWidget(const SizedBox());
  });

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
    expect(find.byKey(const Key('hil-baseline-node-guide')), findsOneWidget);
    expect(find.text('KONTEKS 1 DARI 3'), findsOneWidget);
    expect(find.text('Duduk'), findsOneWidget);
    expect(
      find.textContaining('HR 80–90 bpm termasuk valid'),
      findsOneWidget,
    );
    await tester.pageBack();
    await tester.pumpAndSettle();
  });

  testWidgets('formed baseline can reopen its longitudinal windows',
      (tester) async {
    final state = AppState()
      ..rawCaparInsights = {
        'capar': {
          'baseline': {'contexts': []},
        },
      }
      ..hilBaselineContexts = [
        {
          'activity': 'sitting',
          'segment_count': 1,
          'feature_stats': {
            'mean_hr': {'mean': 70},
          },
          'scenario_readiness': {'valid_window_count': 1},
          'history': [
            {
              'date': '2026-11-01',
              'segment_count': 1,
              'valid_window_count': 1,
              'feature_stats': {
                'mean_hr': {'mean': 70},
              },
              'windows': [
                {
                  'window_start': '2026-11-01T04:00:00.000Z',
                  'quality': {'q_signal': 0.9, 'q_complete': 0.9},
                  'quality_passed': true,
                  'features': {'mean_hr': 70},
                },
              ],
            },
          ],
        },
      ];
    addTearDown(state.dispose);

    await tester.pumpWidget(_app(state));

    final expansion = find.byKey(const Key('hil-baseline-history-expansion'));
    await tester.ensureVisible(expansion);
    await tester.tap(expansion);
    await tester.pumpAndSettle();
    final openHistory =
        find.byKey(const Key('hil-open-baseline-history-detail'));
    await tester.ensureVisible(openHistory);
    await tester.tap(openHistory);
    await tester.pumpAndSettle();

    expect(find.text('Riwayat baseline HIL'), findsOneWidget);
    expect(find.byKey(const Key('hil-baseline-longitudinal-chart')),
        findsOneWidget);
  });

  testWidgets(
      'Human In the Loop locks B/C until five quality-gated HIL minutes exist',
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
    expect(find.textContaining('One way feedback'), findsOneWidget);
    expect(find.textContaining('Human in the loop'), findsOneWidget);
    expect(find.byKey(const Key('hil-scenarios-locked')), findsOneWidget);
    expect(_scenarioTile(tester, 'B').onTap, isNull);
    expect(_scenarioTile(tester, 'C').onTap, isNull);
    expect(find.byKey(const Key('hil-consent-required')), findsOneWidget);

    expect(find.text('Deteksi perubahan dari pola pribadi'), findsOneWidget);
    expect(find.text('Periksa kualitas dan baseline'), findsOneWidget);
    expect(find.text('Tinjau bukti dan batas interpretasi'), findsOneWidget);
    expect(find.text('Tafsir ulang hanya jika bukti cukup'), findsOneWidget);
    expect(find.text('Feedback dan observasi lanjutan'), findsOneWidget);
    expect(find.text('Isi klarifikasi lanjutan'), findsOneWidget);
    expect(find.text('Dua arah nonadaptif'), findsNothing);
  });

  testWidgets('deviation asks for context and offers not remembered and skip',
      (tester) async {
    final state = AppState()
      ..rawCaparInsights = {
        'capar': {
          'latest_observation': {'activity': 'sitting'},
          'mahalanobis': [
            {
              'available': true,
              'activity': 'sitting',
              'segment_id': '507f1f77bcf86cd799439011',
            },
          ],
          'pedagogy': {
            'follow_up': {
              'status': 'requested',
              'triggered_by_segment_id': '507f1f77bcf86cd799439011',
            },
            'reasoning_resolution': {
              'status': 'awaiting_clarification',
              'feedback_recorded': false,
              'reinterpreted': false,
            },
          },
        },
      };
    addTearDown(state.dispose);

    await tester.pumpWidget(_app(state));

    final openClarification =
        find.byKey(const Key('hil-open-deviation-clarification'));
    await tester.ensureVisible(openClarification);
    await tester.tap(openClarification);
    await tester.pumpAndSettle();

    expect(
      find.byKey(const Key('hil-deviation-clarification-dialog')),
      findsOneWidget,
    );
    expect(find.text('Kirim dan tinjau ulang'), findsOneWidget);
    expect(find.text('Tidak ingat'), findsOneWidget);
    expect(find.text('Lewati'), findsOneWidget);
    expect(find.text('Pilih aktivitas sebelum puncak denyut'), findsOneWidget);
    expect(find.byKey(const Key('hil-activity-option-Duduk')), findsOneWidget);
    expect(
        find.byKey(const Key('hil-activity-option-Bekerja')), findsOneWidget);
  });

  testWidgets('A shows HIL baseline counts separately from CAPAR baselines',
      (tester) async {
    final state = AppState()
      ..rawCaparInsights = {
        'capar': {
          'status': 'available',
          'baseline': {
            'contexts': [
              {
                'activity': 'standing',
                'level': 'mature',
                'segment_count': 80,
                'scenario_readiness': {
                  'ready': true,
                  'valid_window_count': 80,
                }
              },
            ],
          },
        },
      }
      ..hilBaselineContexts = [
        {
          'activity': 'standing',
          'segment_count': 4,
          'scenario_readiness': {
            'ready': false,
            'valid_window_count': 4,
          },
        },
        {
          'activity': 'walking',
          'segment_count': 2,
          'scenario_readiness': {
            'ready': false,
            'valid_window_count': 0,
          },
        },
        {
          'activity': 'sitting',
          'segment_count': 2,
          'scenario_readiness': {
            'ready': false,
            'valid_window_count': 0,
          },
        },
      ];
    addTearDown(state.dispose);

    await tester.pumpWidget(_app(state));

    expect(find.text('Belum ada data'), findsNothing);
    expect(
      find.text('Belum siap HIL · 4/5 menit · 4 window'),
      findsOneWidget,
    );
    expect(
      find.text('Belum siap HIL · 0/5 menit · 2 window'),
      findsNWidgets(2),
    );
    expect(find.byKey(const Key('hil-scenarios-locked')), findsOneWidget);
    expect(_scenarioTile(tester, 'B').onTap, isNull);
    expect(_scenarioTile(tester, 'C').onTap, isNull);
  });

  testWidgets('one ready HIL activity does not unlock B/C for all activities',
      (tester) async {
    final state = AppState()
      ..hilBaselineContexts = [
        {
          'activity': 'sitting',
          'segment_count': 5,
          'scenario_readiness': {
            'ready': true,
            'valid_window_count': 5,
          },
        },
      ];
    addTearDown(state.dispose);

    await tester.pumpWidget(_app(state));

    expect(find.byKey(const Key('hil-scenarios-locked')), findsOneWidget);
    expect(find.textContaining('Saat ini 1/3 aktivitas siap'), findsOneWidget);
    expect(_scenarioTile(tester, 'B').onTap, isNull);
    expect(_scenarioTile(tester, 'C').onTap, isNull);
  });

  testWidgets('baseline history on the HIL home shows dates and HR summaries',
      (tester) async {
    final state = AppState()
      ..hilBaselineContexts = [
        {
          'activity': 'sitting',
          'segment_count': 7,
          'scenario_readiness': {
            'ready': true,
            'valid_window_count': 6,
          },
          'history': [
            {
              'date': '2026-11-02',
              'segment_count': 3,
              'valid_window_count': 3,
              'feature_stats': {
                'mean_hr': {'mean': 82.5},
              },
            },
            {
              'date': '2026-11-01',
              'segment_count': 4,
              'valid_window_count': 3,
              'feature_stats': {
                'mean_hr': {'mean': 79.0},
              },
            },
          ],
        },
      ];
    addTearDown(state.dispose);

    await tester.pumpWidget(_app(state));

    expect(
      find.text('2 catatan harian · dikelompokkan per aktivitas'),
      findsOneWidget,
    );
    final historyExpansion =
        find.byKey(const Key('hil-baseline-history-expansion'));
    await tester.ensureVisible(historyExpansion);
    await tester.tap(historyExpansion);
    await tester.pumpAndSettle();

    expect(find.text('Duduk'), findsWidgets);
    expect(find.text('02/11/2026'), findsOneWidget);
    expect(find.text('01/11/2026'), findsOneWidget);
    expect(
      find.text('3/3 window lolos kualitas · HR rata-rata 82.5 bpm'),
      findsOneWidget,
    );
  });

  testWidgets('A explains when AI consent prevents loading stored baselines',
      (tester) async {
    final state = AppState()
      ..rawCaparInsights = {
        'capar': {
          'status': 'consent_required',
          'baseline': {'contexts': []},
        },
      };
    addTearDown(state.dispose);

    await tester.pumpWidget(_app(state));

    expect(find.byKey(const Key('hil-ai-consent-required')), findsOneWidget);
    expect(find.byKey(const Key('hil-grant-ai-consent')), findsOneWidget);
    expect(find.text('Belum ada data'), findsNothing);
  });

  testWidgets('saved HIL explanation can be opened from scenario history',
      (tester) async {
    final state = AppState()
      ..rawCaparInsights = {
        'capar': {
          'baseline': {'contexts': []},
        },
      }
      ..events = [
        EventItem(
          id: 'hil-event-1',
          title: 'Human In the Loop',
          eventType: 'hil_scenario',
          icon: Icons.timeline,
          color: Colors.teal,
          timestamp: DateTime(2026, 11, 1, 11),
          details: 'Snapshot penjelasan skenario C.',
          value: {
            'version': 1,
            'scenario': 'C',
            'activity': 'sitting',
            'explanation': 'Bukti belum cukup; status tetap unresolved.',
            'status': 'unresolved',
            'quality_status': 'passed',
            'baseline_ready': true,
            'factors': ['mean_hr'],
          },
        ),
      ];
    addTearDown(state.dispose);

    await tester.pumpWidget(_app(state));

    final historyItem =
        find.byKey(const Key('hil-scenario-history-hil-event-1'));
    await tester.ensureVisible(historyItem);
    await tester.tap(historyItem);
    await tester.pumpAndSettle();

    expect(
        find.byKey(const Key('hil-scenario-history-detail')), findsOneWidget);
    expect(find.text('Aktivitas: sitting'), findsOneWidget);
    expect(
      find.text('Bukti belum cukup; status tetap unresolved.'),
      findsOneWidget,
    );
    expect(find.text('Faktor yang tercatat: mean_hr'), findsOneWidget);
  });

  testWidgets('explanation history from its dedicated collection is displayed',
      (tester) async {
    final state = AppState()
      ..rawCaparInsights = {
        'capar': {
          'baseline': {'contexts': []},
        },
      }
      ..hilExplanationHistory = [
        EventItem(
          id: 'hil-record-1',
          title: 'Human In the Loop',
          eventType: 'hil_scenario',
          icon: Icons.timeline,
          color: Colors.teal,
          timestamp: DateTime(2026, 11, 1, 11),
          details: 'Snapshot penjelasan skenario B.',
          value: {
            'version': 1,
            'scenario': 'B',
            'activity': 'walking',
            'explanation': 'Pola berjalan tetap dalam batas baseline.',
            'status': 'normal',
            'quality_status': 'passed',
            'baseline_ready': true,
            'factors': ['mean_hr'],
          },
        ),
      ];
    addTearDown(state.dispose);

    await tester.pumpWidget(_app(state));

    final historyItem =
        find.byKey(const Key('hil-scenario-history-hil-record-1'));
    await tester.ensureVisible(historyItem);
    await tester.tap(historyItem);
    await tester.pumpAndSettle();

    expect(
        find.byKey(const Key('hil-scenario-history-detail')), findsOneWidget);
    expect(find.text('Aktivitas: walking'), findsOneWidget);
    expect(
      find.text('Pola berjalan tetap dalam batas baseline.'),
      findsAtLeastNWidgets(1),
    );
  });

  testWidgets('HIL explanation details render attached XAI reasoning',
      (tester) async {
    final state = AppState()
      ..rawCaparInsights = {
        'capar': {
          'baseline': {'contexts': []},
        },
      }
      ..events = [
        EventItem(
          id: 'hil-event-xai',
          title: 'Human In the Loop',
          eventType: 'hil_scenario',
          icon: Icons.timeline,
          color: Colors.teal,
          timestamp: DateTime(2026, 11, 1, 12),
          details: 'Snapshot penjelasan XAI.',
          value: {
            'version': 1,
            'scenario': 'C',
            'activity': 'standing',
            'explanation': 'Kenaikan denyut jantung terdeteksi saat berdiri.',
            'status': 'reviewed',
            'quality_status': 'passed',
            'baseline_ready': true,
            'factors': ['mean_hr'],
            'xai': {
              'summary':
                  'Denyut naik karena transisi posisi dan pola aktivitas belum sepenuhnya dibaseline.',
              'confidence': 0.85,
              'supporting_factors': ['mean_hr', 'rmssd'],
              'contradicting_factors': ['sleep'],
            },
          },
        ),
      ];
    addTearDown(state.dispose);

    await tester.pumpWidget(_app(state));

    final historyItem =
        find.byKey(const Key('hil-scenario-history-hil-event-xai'));
    await tester.ensureVisible(historyItem);
    await tester.tap(historyItem);
    await tester.pumpAndSettle();

    expect(
        find.byKey(const Key('hil-scenario-history-detail')), findsOneWidget);
    expect(find.text('Penjelasan XAI'), findsOneWidget);
    expect(
      find.textContaining('Denyut naik karena transisi posisi'),
      findsOneWidget,
    );
    expect(find.textContaining('85%'), findsOneWidget);
  });

  testWidgets(
      'five-minute HIL baselines for all activities unlock recorded B/C',
      (tester) async {
    final state = AppState()
      ..rawCaparInsights = {
        'capar': {
          'baseline': {'contexts': []},
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
                {'stage_id': 'personal_baseline', 'status': 'cold_start'},
              ],
            },
          },
        },
      };
    state.hilBaselineContexts = [
      for (final activity in ['sitting', 'standing', 'walking'])
        {
          'activity': activity,
          'segment_count': 5,
          'scenario_readiness': {
            'ready': true,
            'valid_window_count': 5,
            'valid_duration_seconds': 300,
          },
        },
    ];
    addTearDown(state.dispose);

    await tester.pumpWidget(_app(state));

    expect(find.byKey(const Key('hil-scenarios-locked')), findsNothing);
    expect(_scenarioTile(tester, 'B').onTap, isNull);
    expect(_scenarioTile(tester, 'C').onTap, isNull);
    await _acceptHilConsent(tester);
    expect(_scenarioTile(tester, 'B').onTap, isNotNull);
    expect(_scenarioTile(tester, 'C').onTap, isNotNull);
  });

  test('recorded HIL deviation uses raw HR above baseline with quality gates',
      () {
    expect(
      HilRecordedScenarioAnalysis.isElevatedCandidate(
        heartRate: 91,
        baselineMean: 70,
        thresholdBpm: 0,
        qSignal: 0.9,
        qComplete: 0.9,
        qualityAccepted: true,
      ),
      isTrue,
    );
    expect(
      HilRecordedScenarioAnalysis.isElevatedCandidate(
        heartRate: 70,
        baselineMean: 70,
        thresholdBpm: 0,
        qSignal: 0.4,
        qComplete: 0.9,
        qualityAccepted: true,
      ),
      isFalse,
    );
    expect(
      HilRecordedScenarioAnalysis.isElevatedCandidate(
        heartRate: 70,
        baselineMean: 70,
        thresholdBpm: 0,
        qSignal: 0.9,
        qComplete: 0.9,
        qualityAccepted: true,
      ),
      isFalse,
    );
  });

  testWidgets('CAPAR maturity alone cannot unlock HIL scenarios',
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

  testWidgets('saved scenario logs show separate request and reply times',
      (tester) async {
    final state = AppState()
      ..hilScenarioLogs = [
        {
          '_id': 'log-reply',
          'run_id': 'scenario-run-1234',
          'scenario': 'C',
          'event_type': 'clarification_submitted',
          'activity': 'walking',
          'createdAt': '2026-11-01T03:02:00.000Z',
          'clarification': 'Saya baru selesai berjalan.',
        },
        {
          '_id': 'log-request',
          'run_id': 'scenario-run-1234',
          'scenario': 'C',
          'event_type': 'clarification_requested',
          'activity': 'walking',
          'createdAt': '2026-11-01T03:01:00.000Z',
          'explanation': 'Sistem meminta keterangan tambahan.',
        },
      ];
    addTearDown(state.dispose);

    await tester.pumpWidget(_app(state));

    final replyItem = find.byKey(
      const Key('hil-scenario-action-log-reply-clarification_submitted'),
    );
    await tester.ensureVisible(replyItem);
    await tester.tap(replyItem);
    await tester.pumpAndSettle();

    expect(find.text('Waktu tercatat: 01/11/2026 10:02 WIB'), findsOneWidget);
    expect(find.text('Keterangan pengguna: Saya baru selesai berjalan.'),
        findsOneWidget);
    await tester.tap(find.text('Tutup'));
    await tester.pumpAndSettle();

    final requestItem = find.byKey(
      const Key('hil-scenario-action-log-request-clarification_requested'),
    );
    await tester.ensureVisible(requestItem);
    await tester.tap(requestItem);
    await tester.pumpAndSettle();
    expect(find.text('Waktu tercatat: 01/11/2026 10:01 WIB'), findsOneWidget);
    expect(
      find.text('Penjelasan: Sistem meminta keterangan tambahan.'),
      findsOneWidget,
    );
  });
}
