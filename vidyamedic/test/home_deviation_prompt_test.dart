import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:provider/provider.dart';
import 'package:nadiku/models/health_models.dart';
import 'package:nadiku/providers/app_state.dart';
import 'package:nadiku/screens/home/home_screen.dart';
import 'package:nadiku/theme/app_theme.dart';

void main() {
  testWidgets('deviation prompt uses recorded heart rate and personal baseline',
      (tester) async {
    await initializeDateFormatting('id_ID', null);
    final appState = AppState()
      ..isRefreshing = true
      ..followUpPrompt = CaparFollowUpPrompt(
        status: 'requested',
        segmentId: 'test-segment',
        peakTime: DateTime.utc(2026, 10, 21, 1),
        mainFactors: [
          {
            'feature': 'hr_mean',
            'value': 91,
            'baseline_mean': 70,
            'delta': 21,
          },
        ],
      )
      ..dailySummaryData = {
        'check_ins': [
          {
            'recorded_at': '2026-10-21T00:55:00Z',
            'activity': 'walking',
            'stress_level': 2,
            'symptoms': ['palpitations'],
          },
        ],
      };

    await tester.pumpWidget(
      ChangeNotifierProvider(
        create: (_) => appState,
        child: MaterialApp(
          theme: AppTheme.lightTheme,
          home: const HomeScreen(),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(
      find.text(
        'Pada segmen yang terdeteksi, denyut jantung rata-rata tercatat 91 bpm, dibanding rerata pribadi 70 bpm (selisih +21 bpm). Pada catatan sekitar waktu perubahan, Anda mencatat berjalan, stres sedang, keluhan jantung berdebar. Apakah catatan tersebut sesuai dengan kondisi Anda saat itu, atau ada hal lain yang ingin dicatat? Informasi ini hanya konteks waktu dan tidak membuktikan penyebab.',
      ),
      findsOneWidget,
    );
  });
}
