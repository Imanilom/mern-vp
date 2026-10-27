import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nadiku/providers/app_state.dart';
import 'package:nadiku/screens/pedagogy/pedagogy_screen_what_changed.dart';
import 'package:provider/provider.dart';

void main() {
  testWidgets(
      'observed changes lists and averages sitting baselines even when provisional',
      (tester) async {
    final state = AppState()
      ..rawCaparInsights = {
        'capar': {
          'baseline': {
            'contexts': [
              {
                'activity': 'sitting',
                'time_period': 'morning',
                'level': 'provisional',
                'segment_count': 4,
                'feature_stats': {
                  'mean_hr': {'mean': 60},
                  'mean_rr': {'mean': 1000},
                  'rmssd': {'mean': 30},
                  'dfa_alpha1': {'mean': 0.9},
                },
              },
              {
                'activity': 'sitting',
                'time_period': 'afternoon',
                'level': 'provisional',
                'segment_count': 5,
                'feature_stats': {
                  'mean_hr': {'mean': 70},
                  'mean_rr': {'mean': 900},
                  'rmssd': {'mean': 40},
                  'dfa_alpha1': {'mean': 1.1},
                },
              },
              {
                'activity': 'sitting',
                'time_period': 'evening',
                'level': 'cold_start',
                'segment_count': 2,
                'feature_stats': {
                  'mean_hr': {'mean': 80},
                  'mean_rr': {'mean': 800},
                  'rmssd': {'mean': 50},
                  'dfa_alpha1': {'mean': 1.3},
                },
              },
              {
                'activity': 'walking',
                'time_period': 'morning',
                'level': 'mature',
                'segment_count': 30,
                'feature_stats': {
                  'mean_hr': {'mean': 110},
                },
              },
            ],
          },
          'latest_observation': {'activity': 'sitting'},
          'mahalanobis': [
            {
              'available': false,
              'activity': 'sitting',
              'state': 'insufficient_data',
            },
          ],
        },
      };
    addTearDown(state.dispose);

    await tester.pumpWidget(
      ChangeNotifierProvider<AppState>.value(
        value: state,
        child: const MaterialApp(home: WhatChangedScreen()),
      ),
    );

    expect(find.byKey(const Key('observed-change-baselines')), findsOneWidget);
    expect(
        find.text(
            'Jumlah konteks baseline: 3 · status: provisional, baru terbentuk'),
        findsOneWidget);
    expect(find.text('Rerata HR: 70.0 bpm · 3 konteks'), findsOneWidget);
    expect(find.text('Rerata RR: 900.0 ms · 3 konteks'), findsOneWidget);
    expect(find.text('RMSSD: 40.0 ms · 3 konteks'), findsOneWidget);
    expect(find.text('DFA α1: 1.1 · 3 konteks'), findsOneWidget);
    expect(find.textContaining('Baseline provisional tetap ditampilkan'),
        findsOneWidget);
    expect(find.textContaining('CAPAR tidak menganggapnya baseline matang'),
        findsOneWidget);
    expect(find.textContaining('Berjalan'), findsNothing);
  });
}
