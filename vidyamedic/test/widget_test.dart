import 'package:flutter_test/flutter_test.dart';
import 'package:nadiku/main.dart';
import 'package:nadiku/providers/app_state.dart';

void main() {
  testWidgets('VidyaMedic app smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(VidyaMedicApp(appState: AppState()));
    expect(find.text('VidyaMedic'), findsWidgets);
  });
}
