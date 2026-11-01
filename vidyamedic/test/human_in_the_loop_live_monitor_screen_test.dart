import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nadiku/providers/app_state.dart';
import 'package:nadiku/screens/scenarios/human_in_the_loop_live_monitor_screen.dart';
import 'package:nadiku/screens/pedagogy/history_trend_chart.dart';
import 'package:nadiku/utils/hil_time.dart';

void main() {
  test('chart segments are broken when wearable samples have a long gap', () {
    final first = ChartPoint(DateTime.utc(2026, 11, 1, 3), 70);
    final connected = ChartPoint(
      DateTime.utc(2026, 11, 1, 3, 0, 3),
      72,
    );
    final afterDisconnect = ChartPoint(
      DateTime.utc(2026, 11, 1, 3, 0, 12),
      75,
    );

    expect(
      ChartPoint.canConnect(
        first,
        connected,
        maximumGap: const Duration(seconds: 5),
      ),
      isTrue,
    );
    expect(
      ChartPoint.canConnect(
        connected,
        afterDisconnect,
        maximumGap: const Duration(seconds: 5),
      ),
      isFalse,
    );
  });

  test('HIL timestamps display the UTC instant as WIB without shifting storage',
      () {
    expect(
      formatHilWibDateTime(DateTime.parse('2026-11-01T03:00:00.000Z')),
      '01/11/2026 10:00 WIB',
    );
    expect(
      hilWibPickerDateTimeToUtc(DateTime(2026, 11, 1, 10)),
      DateTime.utc(2026, 11, 1, 3),
    );
  });

  testWidgets('simulation shows clarification and recovers toward baseline',
      (tester) async {
    final state = AppState();
    addTearDown(state.dispose);
    await tester.pumpWidget(
      ChangeNotifierProvider<AppState>.value(
        value: state,
        child: const MaterialApp(
          home: HumanInTheLoopLiveMonitorScreen(
            initialActivity: 'sitting',
            baselineContexts: [
              {
                'activity': 'sitting',
                'time_period': 'morning',
                'level': 'provisional',
                'feature_stats': {
                  'mean_hr': {'mean': 70, 'standard_deviation': 3},
                },
              },
            ],
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(const Key('hil-live-run-simulation')));
    await tester.pump();

    expect(find.byKey(const Key('hil-live-simulation-banner')), findsOneWidget);
    await tester.scrollUntilVisible(
      find.byKey(const Key('hil-live-recommendation')),
      300,
      scrollable: find.descendant(
        of: find.byType(ListView),
        matching: find.byType(Scrollable),
      ),
    );
    expect(find.textContaining('Kurangi aktivitas'), findsOneWidget);
    expect(find.text('Denyut berbeda dari pola biasanya.'), findsOneWidget);
    expect(
      find.byKey(const Key('hil-live-zero-shot-analyze')),
      findsNothing,
    );

    await tester.pump(const Duration(seconds: 2));
    await tester.pump();

    expect(find.text('Klarifikasi aktivitas'), findsOneWidget);
    expect(
      find.textContaining('HR: 105.0 bpm · baseline 70.0 bpm'),
      findsOneWidget,
    );

    await tester.tap(find.text('Ya, aktivitas berat'));
    await tester.pump();
    expect(find.text('Klarifikasi aktivitas'), findsNothing);

    for (var index = 0; index < 6; index++) {
      await tester.pump(const Duration(seconds: 2));
      await tester.pump();
    }
    await tester.scrollUntilVisible(
      find.byKey(const Key('hil-live-current-result')),
      300,
      scrollable: find.descendant(
        of: find.byType(ListView),
        matching: find.byType(Scrollable),
      ),
    );
    await tester.pump();
    expect(find.text('Simulasi selesai · HR kembali ke baseline.'),
        findsOneWidget);
    expect(
        find.textContaining('HR simulasi mencapai 70.0 bpm'), findsOneWidget);
  });

  testWidgets('simulation chart labels a provisional-baseline candidate',
      (tester) async {
    final state = AppState();
    addTearDown(state.dispose);
    await tester.pumpWidget(
      ChangeNotifierProvider<AppState>.value(
        value: state,
        child: const MaterialApp(
          home: HumanInTheLoopLiveMonitorScreen(
            initialActivity: 'sitting',
            baselineContexts: [
              {
                'activity': 'sitting',
                'time_period': 'morning',
                'level': 'provisional',
                'feature_stats': {
                  'mean_hr': {'mean': 70, 'standard_deviation': 3},
                },
              },
            ],
          ),
        ),
      ),
    );

    await tester.tap(find.byKey(const Key('hil-live-run-simulation')));
    await tester.pump();
    await tester.drag(find.byType(ListView), const Offset(0, -1200));
    await tester.pump();

    expect(
      find.byKey(const Key('hil-live-observation-chart-plot')),
      findsOneWidget,
    );
    expect(find.textContaining('1 kandidat deviasi'), findsOneWidget);
    expect(find.text('Kandidat deviasi'), findsOneWidget);
  });

  testWidgets('live monitor includes a sensor realtime graph', (tester) async {
    final state = AppState();
    addTearDown(state.dispose);
    await tester.pumpWidget(
      ChangeNotifierProvider<AppState>.value(
        value: state,
        child: const MaterialApp(
          home: HumanInTheLoopLiveMonitorScreen(
            initialActivity: 'sitting',
            baselineContexts: [],
          ),
        ),
      ),
    );

    await tester.scrollUntilVisible(
      find.byKey(const Key('hil-live-realtime-chart')),
      300,
      scrollable: find.descendant(
        of: find.byType(ListView),
        matching: find.byType(Scrollable),
      ),
    );
    expect(find.byKey(const Key('hil-live-realtime-chart')), findsOneWidget);
    expect(
      find.text('Grafik HR realtime · 30 detik terakhir'),
      findsOneWidget,
    );
  });

  test('30-second window reports mean HR, slope, and stable acceleration', () {
    final start = DateTime.utc(2026, 10, 27);
    final readings = List.generate(4, (index) {
      return {
        'recorded_at':
            start.add(Duration(seconds: index * 10)).toIso8601String(),
        'heart_rate_bpm': 70 + index * 3,
        'acceleration_g': [0, 0, 1],
      };
    });

    final window = HilLiveAnalysis.analyzeWindow(readings);

    expect(window.sampleCount, 4);
    expect(window.meanHr, 74.5);
    expect(window.hrSlopeBpmPerMinute, closeTo(18, 0.001));
    expect(window.motionIsStable, isTrue);
  });

  test('stable-motion alert requires elevated HR and stable acceleration', () {
    expect(
      HilLiveAnalysis.isElevatedAtStableMotion(95, 70, 10, true),
      isTrue,
    );
    expect(
      HilLiveAnalysis.isElevatedAtStableMotion(95, 70, 10, false),
      isFalse,
    );
    expect(
      HilLiveAnalysis.isElevatedAtStableMotion(80, 70, 10, true),
      isFalse,
    );
  });

  test('realtime graph filters old and low-quality samples', () {
    final now = DateTime.utc(2026, 11, 1, 3);
    final points = HilLiveAnalysis.buildRealtimeHrPoints(
      readings: [
        {
          'recorded_at':
              now.subtract(const Duration(seconds: 31)).toIso8601String(),
          'heart_rate_bpm': 120,
          'sensor_contact': true,
          'signal_confidence': 1.0,
        },
        {
          'recorded_at':
              now.subtract(const Duration(seconds: 2)).toIso8601String(),
          'heart_rate_bpm': 120,
          'sensor_contact': true,
          'signal_confidence': 1.0,
        },
        {
          'recorded_at':
              now.subtract(const Duration(seconds: 1)).toIso8601String(),
          'heart_rate_bpm': 120,
          'sensor_contact': true,
          'signal_confidence': 0.2,
        },
      ],
      cutoff: now.subtract(const Duration(seconds: 30)),
      baselineMeanHr: 70,
      threshold: 10,
      activity: 'sitting',
    );

    expect(points, hasLength(2));
    expect(points.first.observationStatus, 'candidate_deviation');
    expect(points.last.observationStatus, 'not_assessable');
  });

  test('observation status uses provisional baseline only with quality gate',
      () {
    expect(
      HilLiveAnalysis.classifyObservation(
        meanHr: 95,
        baselineMeanHr: 70,
        threshold: 10,
        qualityGatePassed: true,
      ),
      'candidate_deviation',
    );
    expect(
      HilLiveAnalysis.classifyObservation(
        meanHr: 75,
        baselineMeanHr: 70,
        threshold: 10,
        qualityGatePassed: true,
      ),
      'normal',
    );
    expect(
      HilLiveAnalysis.classifyObservation(
        meanHr: 95,
        baselineMeanHr: 70,
        threshold: 10,
        qualityGatePassed: false,
      ),
      'not_assessable',
    );
    expect(
      HilLiveAnalysis.classifyObservation(
        meanHr: 95,
        baselineMeanHr: null,
        threshold: 10,
        qualityGatePassed: true,
      ),
      'not_assessable',
    );
  });

  test('DFA alpha-1 waits for 64 valid RR intervals', () {
    expect(HilLiveAnalysis.calculateDfaAlpha1(List.filled(63, 850)), isNull);
    final intervals =
        List.generate(128, (index) => 800 + (index * 37 % 120).toDouble());
    final alpha1 = HilLiveAnalysis.calculateDfaAlpha1(intervals);

    expect(alpha1, isNotNull);
    expect(alpha1!.isFinite, isTrue);
  });
}
