import 'package:intl/intl.dart';

const hilWibOffset = Duration(hours: 7);
final _hilWibDateFormat = DateFormat('dd/MM/yyyy HH:mm');

String formatHilWibDateTime(DateTime value) =>
    '${_hilWibDateFormat.format(value.toUtc().add(hilWibOffset))} WIB';

DateTime hilWibPickerDateTime(DateTime value) {
  final wib = value.toUtc().add(hilWibOffset);
  return DateTime(wib.year, wib.month, wib.day, wib.hour, wib.minute);
}

DateTime hilWibPickerDateTimeToUtc(DateTime value) =>
    DateTime.utc(value.year, value.month, value.day, value.hour, value.minute)
        .subtract(hilWibOffset);
