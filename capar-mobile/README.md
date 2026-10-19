# CAPAR Mobile

CAPAR Mobile pairs with Polar H10 through the Polar BLE SDK and submits
validated HR/RR/accelerometer readings through the authenticated
`POST /api/patient-app/wearable/stream` endpoint. The API derives the account
owner from the bearer token and forwards accepted readings to the server-side
CAPAR transport; the mobile client does not connect directly to MQTT/AMQP and
does not send account IDs in the telemetry payload.

The emulator mode is for interface demonstrations only. Synthetic readings
are not uploaded to the API. Streaming requires a valid signed-in session and
real sensor contact, RR data, and accelerometer data.

Any broker credentials previously shipped in mobile builds must be rotated
before deployment; removing credentials from the client does not invalidate
credentials that may already have been extracted.

Install dependencies and run the app with Flutter:

```bash
flutter pub get
flutter run
```
