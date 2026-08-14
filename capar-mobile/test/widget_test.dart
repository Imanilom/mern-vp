import 'package:flutter_test/flutter_test.dart';
import 'package:capar_mobile/main.dart';

void main() {
  testWidgets('Capar Mobile smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const CaparMobileApp());
    expect(find.text('CAPAR'), findsOneWidget);
  });
}
