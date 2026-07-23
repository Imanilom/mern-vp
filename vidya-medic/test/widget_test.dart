import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:health_trajectory_monitor/features/home/home_page.dart';
import 'package:health_trajectory_monitor/features/monitoring/monitoring_page.dart';
import 'package:health_trajectory_monitor/core/ble/mock_ble_service.dart';
import 'package:health_trajectory_monitor/core/network/api_client.dart';
import 'package:health_trajectory_monitor/core/providers/activity_provider.dart';
import 'package:health_trajectory_monitor/shared/models/models.dart';

class MockBleService extends BleService {
  @override
  bool get isConnected => true;
}

void main() {
  testWidgets('HomePage renders greeting and section headers', (WidgetTester tester) async {
    // Set a large viewport size to fit all widgets on screen
    tester.view.physicalSize = const Size(800, 2000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          profileProvider.overrideWith((ref) => const Participant(
            id: '123',
            name: 'P001',
            studyCode: 'HTM-2026',
            pin: '******',
            birthYear: 1990,
            gender: 'Laki-laki',
            heightCm: 170.0,
            weightKg: 65.0,
            relevantCondition: 'Test',
            staffContact: 'Test',
          )),
          activityStartTimeProvider.overrideWith((ref) => DateTime(2026, 7, 23, 7, 30)),
          eventsProvider.overrideWith((ref) => []),
          bleServiceProvider.overrideWith((ref) => MockBleService()),
        ],
        child: const MaterialApp(
          home: HomePage(),
        ),
      ),
    );

    // Verify greeting and subtitle
    expect(find.textContaining('P001'), findsOneWidget);
    expect(find.textContaining('Monitoring aktif sejak'), findsOneWidget);

    // Verify section labels
    expect(find.text('Parameter Real-time'), findsOneWidget);
    expect(find.text('Trajectory 6 Jam Terakhir'), findsAtLeast(1));
    expect(find.text('Aksi Cepat'), findsOneWidget);
  });

  testWidgets('MonitoringPage renders tab bar titles', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: MonitoringPage(),
        ),
      ),
    );

    // Verify tab headers (names matched with monitoring_page tabTitles)
    expect(find.text('Heart Rate'), findsAtLeast(1));
    expect(find.text('RR Interval'), findsAtLeast(1));
    expect(find.text('RMSSD (HRV)'), findsAtLeast(1));
  });
}
