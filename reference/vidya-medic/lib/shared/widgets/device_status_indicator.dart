import 'package:flutter/material.dart';
import '../../core/theme/functional_colors.dart';

class DeviceStatusIndicator extends StatelessWidget {
  final String deviceName;
  final bool isConnected;
  final int batteryLevel;
  final int signalQuality;

  const DeviceStatusIndicator({
    super.key,
    required this.deviceName,
    required this.isConnected,
    required this.batteryLevel,
    required this.signalQuality,
  });

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;
    final statusColor = isConnected ? colors.stableGreen : colors.alertRed;

    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            Icon(
              Icons.bluetooth_connected_rounded,
              color: statusColor,
              size: 24,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    deviceName,
                    style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: statusColor,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        isConnected ? "Terhubung" : "Terputus",
                        style: TextStyle(
                          fontSize: 11,
                          color: statusColor,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Row(
              children: [
                Icon(Icons.battery_5_bar_rounded, size: 16, color: colors.stableGreen),
                const SizedBox(width: 2),
                Text("$batteryLevel%", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500)),
                const SizedBox(width: 10),
                Icon(Icons.network_cell_rounded, size: 16, color: colors.dataBlue),
                const SizedBox(width: 2),
                Text("$signalQuality%", style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
