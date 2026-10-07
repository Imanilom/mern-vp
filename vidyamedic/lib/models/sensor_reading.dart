class SensorReading {
  final DateTime timestamp;
  final int heartRate;
  final int rrInterval;
  final double rmssd;
  final double dfaAlpha1;
  final int signalQuality;
  final int battery;
  final String motionState;
  final double accX;
  final double accY;
  final double accZ;
  final double ecg;
  final int stepCount;

  SensorReading({
    required this.timestamp,
    required this.heartRate,
    required this.rrInterval,
    required this.rmssd,
    required this.dfaAlpha1,
    required this.signalQuality,
    required this.battery,
    required this.motionState,
    this.accX = 0.0,
    this.accY = 0.0,
    this.accZ = 0.0,
    this.ecg = 0.0,
    this.stepCount = 0,
  });
}
