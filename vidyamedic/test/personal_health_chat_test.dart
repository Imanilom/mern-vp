import 'package:flutter_test/flutter_test.dart';
import 'package:nadiku/models/health_models.dart';
import 'package:nadiku/providers/app_state.dart';
import 'package:nadiku/services/personal_health_chat.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('PersonalHealthChatModel', () {
    late AppState state;

    setUp(() {
      state = AppState()
        ..wearable = WearableData(
          hasServerSamples: true,
          heartRate: 95,
          baselineHr: 70,
        )
        ..dailySummaryData = {
          'check_ins': [
            {
              'recorded_at': '2026-10-21T07:00:00Z',
              'activity': 'walking',
              'stress_level': 2,
              'symptoms': ['palpitations'],
              'sleep': {'duration_minutes': 390, 'quality': 'fair'},
            }
          ],
        };
    });

    tearDown(() => state.dispose());

    test('compares recorded heart rate to the personal baseline', () {
      final answer = const PersonalHealthChatModel().reply(
        question: 'Bagaimana denyut jantung saya?',
        state: state,
        history: const [],
      );

      expect(answer, contains('95 bpm'));
      expect(answer, contains('25 bpm di atas baseline pribadi 70 bpm'));
      expect(answer, contains('bukan diagnosis'));
    });

    test('uses recent user check-in data for personal insights', () {
      final answer = const PersonalHealthChatModel().reply(
        question: 'Beri wawasan dari data saya',
        state: state,
        history: const [],
      );

      expect(answer, contains('denyut wearable 95 bpm'));
      expect(answer, contains('berjalan'));
      expect(answer, contains('stres 2'));
      expect(answer, contains('tidur 6.5 jam'));
    });

    test('uses the previous user question for a short follow-up', () {
      final answer = const PersonalHealthChatModel().reply(
        question: 'jelaskan lagi',
        state: state,
        history: [
          PersonalChatMessage(
            role: PersonalChatRole.user,
            text: 'Bagaimana denyut jantung saya?',
            createdAt: DateTime.utc(2026, 10, 21),
          ),
        ],
      );

      expect(answer, contains('Menindaklanjuti pertanyaan Anda'));
      expect(answer, contains('denyut 95 bpm'));
    });

    test('calculates averages from real wearable samples', () {
      final now = DateTime.now();
      state.wearableSamples = [
        {
          'recorded_at':
              now.subtract(const Duration(minutes: 20)).toIso8601String(),
          'heart_rate_bpm': 60,
          'is_simulated': false,
        },
        {
          'recorded_at':
              now.subtract(const Duration(minutes: 10)).toIso8601String(),
          'heart_rate_bpm': 100,
          'is_simulated': false,
        },
        {
          'recorded_at': now.toIso8601String(),
          'heart_rate_bpm': 200,
          'is_simulated': true,
        },
      ];

      final answer = const PersonalHealthChatModel().reply(
        question: 'Berapa rata-rata denyut jantung saya?',
        state: state,
        history: const [],
      );

      expect(answer, contains('rata-rata 80 bpm'));
      expect(answer, contains('dari 2 sampel nyata'));
      expect(answer, contains('bukan diagnosis'));
    });

    test('treats yesterday as a calendar day, not the last 24 hours', () {
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      state.wearableSamples = [
        {
          'recorded_at':
              today.subtract(const Duration(hours: 12)).toIso8601String(),
          'heart_rate_bpm': 60,
          'is_simulated': false,
        },
        {
          'recorded_at': today.add(const Duration(hours: 8)).toIso8601String(),
          'heart_rate_bpm': 100,
          'is_simulated': false,
        },
      ];

      final answer = const PersonalHealthChatModel().reply(
        question: 'Berapa rata-rata denyut jantung saya kemarin?',
        state: state,
        history: const [],
      );

      expect(answer, contains('untuk kemarin'));
      expect(answer, contains('rata-rata 60 bpm'));
      expect(answer, contains('dari 1 sampel nyata'));
    });

    test('calculates maximum and trend from ordered real samples', () {
      final now = DateTime.now();
      state.wearableSamples = [
        {
          'recorded_at':
              now.subtract(const Duration(minutes: 20)).toIso8601String(),
          'heart_rate_bpm': 60,
          'is_simulated': false,
        },
        {
          'recorded_at':
              now.subtract(const Duration(minutes: 10)).toIso8601String(),
          'heart_rate_bpm': 100,
          'is_simulated': false,
        },
      ];

      final model = const PersonalHealthChatModel();
      final maximum = model.reply(
        question: 'Berapa denyut jantung tertinggi saya?',
        state: state,
        history: const [],
      );
      final trend = model.reply(
        question: 'Bagaimana tren denyut jantung saya?',
        state: state,
        history: const [],
      );

      expect(maximum, contains('nilai tertinggi 100 bpm'));
      expect(trend, contains('meningkat 40 bpm'));
    });

    test('does not calculate when no real samples are available', () {
      state.wearableSamples = [
        {
          'recorded_at': DateTime.now().toIso8601String(),
          'heart_rate_bpm': 88,
          'is_simulated': true,
        },
      ];
      state.wearable = WearableData(isSimulated: true, heartRate: 88);

      final answer = const PersonalHealthChatModel().reply(
        question: 'Berapa rata-rata HRV saya?',
        state: state,
        history: const [],
      );

      expect(answer, contains('tidak menemukan sampel nyata'));
      expect(answer, contains('Data demo tidak dihitung'));
    });

    test('does not infer a relationship from unpaired sleep and step data', () {
      final answer = const PersonalHealthChatModel().reply(
        question: 'Apakah tidur berhubungan dengan langkah saya?',
        state: state,
        history: const [],
      );

      expect(answer, contains('catatan berpasangan'));
      expect(answer, contains('tidak akan menebak'));
    });

    test('does not treat a two-day comparison as one-day summary', () {
      final answer = const PersonalHealthChatModel().reply(
        question: 'Bandingkan denyut jantung hari ini dengan kemarin',
        state: state,
        history: const [],
      );

      expect(answer, contains('catatan berpasangan'));
    });
  });

  group('PersonalChatHistoryStore', () {
    setUp(() => SharedPreferences.setMockInitialValues({}));

    test('persists history per account and can clear it', () async {
      final firstAccount = PersonalChatHistoryStore(accountId: 'patient-a');
      final secondAccount = PersonalChatHistoryStore(accountId: 'patient-b');
      final messages = [
        PersonalChatMessage(
          role: PersonalChatRole.user,
          text: 'Bagaimana denyut jantung saya?',
          createdAt: DateTime.utc(2026, 10, 21),
        ),
        PersonalChatMessage(
          role: PersonalChatRole.assistant,
          text: 'Dari data personal Anda...',
          createdAt: DateTime.utc(2026, 10, 21, 0, 1),
        ),
      ];

      await firstAccount.save(messages);

      expect((await firstAccount.load()).map((message) => message.text),
          messages.map((message) => message.text));
      expect(await secondAccount.load(), isEmpty);

      await firstAccount.clear();
      expect(await firstAccount.load(), isEmpty);
    });
  });
}
