import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nadiku/screens/scenarios/scenario_questionnaire_screen.dart';

void main() {
  testWidgets('SUS requires participants to select each response',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: ScenarioQuestionnaireScreen(
          sessionId: 'session-id',
          type: ScenarioQuestionnaireType.sus,
        ),
      ),
    );

    await tester.pumpAndSettle();
    expect(
      find.textContaining('Saya berpikir akan sering menggunakan Vidyamedic.'),
      findsOneWidget,
    );
    expect(
      tester
          .widget<FilledButton>(
            find.byWidgetPredicate((widget) => widget is FilledButton),
          )
          .onPressed,
      isNull,
    );
    expect(tester.widget<ChoiceChip>(find.byType(ChoiceChip).first).selected,
        isFalse);
  });

  testWidgets(
      'NASA-TLX displays unanswered state until the user moves a slider',
      (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: ScenarioQuestionnaireScreen(
          sessionId: 'session-id',
          type: ScenarioQuestionnaireType.nasaTlx,
        ),
      ),
    );

    expect(find.text('Beban mental'), findsOneWidget);
    expect(find.text('Belum dipilih'), findsWidgets);
    expect(
      tester
          .widget<FilledButton>(
            find.byWidgetPredicate((widget) => widget is FilledButton),
          )
          .onPressed,
      isNull,
    );
  });
}
