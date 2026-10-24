import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nadiku/screens/home/live_heart_rate_chart.dart';

void main() {
  testWidgets('renders a graph from real streaming readings only',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: LiveHeartRateChart(
            isStreaming: true,
            readings: [
              {
                'recorded_at': '2026-10-24T10:00:00.000Z',
                'heart_rate_bpm': 72,
              },
              {
                'recorded_at': '2026-10-24T10:00:01.000Z',
                'heart_rate_bpm': 75,
              },
              {
                'recorded_at': '2026-10-24T10:00:02.000Z',
                'heart_rate_bpm': 120,
                'is_simulated': true,
              },
            ],
          ),
        ),
      ),
    );

    expect(find.text('Grafik streaming Polar H10'), findsOneWidget);
    expect(find.text('2 sampel'), findsOneWidget);
    expect(find.byKey(const ValueKey('heart-rate-line-chart')), findsOneWidget);
  });

  testWidgets('does not draw simulated readings as a health graph',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: LiveHeartRateChart(
            isStreaming: false,
            readings: [
              {
                'heart_rate_bpm': 72,
                'is_simulated': true,
              },
              {
                'heart_rate_bpm': 75,
                'is_simulated': true,
              },
            ],
          ),
        ),
      ),
    );

    expect(find.text('0 sampel'), findsOneWidget);
    expect(find.text('Grafik akan muncul setelah rekaman nyata tersedia.'),
        findsOneWidget);
    expect(find.byKey(const ValueKey('heart-rate-line-chart')), findsNothing);
  });
}
