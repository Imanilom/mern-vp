import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nadiku/providers/app_state.dart';
import 'package:nadiku/screens/scenarios/human_in_the_loop_live_monitor_screen.dart';
import 'package:nadiku/utils/hil_time.dart';

void main() {
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

  testWidgets('simulation asks for context and displays optional other field',
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

    expect(find.text('Ada aktivitas atau konteks sebelumnya?'), findsOneWidget);
    expect(find.text('Hal lain (opsional)'), findsOneWidget);
    expect(find.textContaining('HR maksimum yang terdeteksi: 105 bpm'), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, 'Olahraga');
    await tester.tap(find.text('Kirim'));
    await tester.pumpAndSettle();
    expect(find.text('Jawaban simulasi tercatat di layar.'), findsOneWidget);
    expect(find.textContaining('Konteks: Olahraga.'), findsOneWidget);
  });

  testWidgets('monitor shows per-second HR without graph or mean labels',
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

    expect(find.byKey(const Key('hil-live-hr-per-second')), findsOneWidget);
    expect(find.byKey(const Key('hil-live-realtime-chart')), findsNothing);
    expect(find.textContaining('rata-rata'), findsNothing);
    expect(find.textContaining('slope'), findsNothing);
  });

  test('30-second window reports the maximum valid per-second HR', () {
    final start = DateTime.utc(2026, 10, 27);
    final readings = List.generate(4, (index) {
      return {
        'recorded_at':
            start.add(Duration(seconds: index * 10)).toIso8601String(),
        'heart_rate_bpm': 70 + index * 3,
        'sensor_contact': true,
        'signal_confidence': 0.9,
      };
    });

    final window = HilLiveAnalysis.analyzeWindow(readings);

    expect(window.sampleCount, 4);
    expect(window.maxHr, 79);
  });

  test('maximum ignores readings that fail sensor-quality checks', () {
    final maximum = HilLiveAnalysis.maximumHeartRate([
      {
        'heart_rate_bpm': 130,
        'sensor_contact': true,
        'signal_confidence': 0.2,
      },
      {
        'heart_rate_bpm': 92,
        'sensor_contact': true,
        'signal_confidence': 0.9,
      },
      {
        'heart_rate_bpm': 180,
        'sensor_contact': false,
        'signal_confidence': 1.0,
      },
    ]);

    expect(
      maximum,
      92,
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
