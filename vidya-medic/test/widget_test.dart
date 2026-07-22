import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:health_trajectory_monitor/features/home/home_page.dart';
import 'package:health_trajectory_monitor/features/monitoring/monitoring_page.dart';

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
      const ProviderScope(
        child: MaterialApp(
          home: HomePage(),
        ),
      ),
    );

    // Verify greeting and subtitle
    expect(find.text('Selamat pagi, P001'), findsOneWidget);
    expect(find.text('Monitoring aktif sejak 07:30'), findsOneWidget);

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
