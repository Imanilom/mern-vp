import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../core/theme/functional_colors.dart';
import '../../core/notifications/notification_service.dart';

class QrScanModal extends StatefulWidget {
  const QrScanModal({super.key});

  @override
  State<QrScanModal> createState() => _QrScanModalState();
}

class _QrScanModalState extends State<QrScanModal> {
  final MobileScannerController _controller = MobileScannerController();
  bool _isScanned = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleBarcode(BarcodeCapture capture) {
    if (_isScanned) return;
    final List<Barcode> barcodes = capture.barcodes;
    for (final barcode in barcodes) {
      final String? rawValue = barcode.rawValue;
      if (rawValue != null && rawValue.isNotEmpty) {
        _isScanned = true;
        NotificationService().showQrScanSuccess(rawValue);
        
        final parts = rawValue.split(RegExp(r'[;,]'));
        String pId = rawValue;
        String sCode = 'HTM-2026';
        String pin = '';
        if (parts.length >= 3) {
          pId = parts[0].trim();
          sCode = parts[1].trim();
          pin = parts[2].trim();
        } else if (parts.length == 2) {
          pId = parts[0].trim();
          sCode = parts[1].trim();
        }
        
        Navigator.pop(context, {
          'participantId': pId,
          'studyCode': sCode,
          'pin': pin,
        });
        break;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors =
        Theme.of(context).extension<FunctionalColors>() ?? FunctionalColors.light;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: const Text("Scan QR Code Penelitian",
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: ValueListenableBuilder(
              valueListenable: _controller,
              builder: (context, state, child) {
                switch (state.torchState) {
                  case TorchState.on:
                    return const Icon(Icons.flash_on_rounded, color: Colors.amber);
                  default:
                    return const Icon(Icons.flash_off_rounded, color: Colors.grey);
                }
              },
            ),
            onPressed: () => _controller.toggleTorch(),
          ),
          IconButton(
            icon: const Icon(Icons.cameraswitch_rounded, color: Colors.white),
            onPressed: () => _controller.switchCamera(),
          ),
        ],
      ),
      body: Stack(
        children: [
          // Real Mobile Scanner View
          MobileScanner(
            controller: _controller,
            onDetect: _handleBarcode,
            errorBuilder: (context, error, child) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.camera_alt_outlined,
                          size: 64, color: Colors.white54),
                      const SizedBox(height: 16),
                      Text(
                        "Kamera tidak tersedia atau tidak diizinkan di perangkat ini.\n(${error.errorCode})",
                        textAlign: TextAlign.center,
                        style:
                            const TextStyle(color: Colors.white70, fontSize: 13),
                      ),

                    ],
                  ),
                ),
              );
            },
          ),

          // Scanning Frame Overlay
          Center(
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                border: Border.all(color: colors.dataBlue, width: 3),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: colors.dataBlue.withValues(alpha: 0.25),
                    blurRadius: 20,
                    spreadRadius: 2,
                  ),
                ],
              ),
            ),
          ),

          // Bottom Instruction Card & Simulation Fallback Button
          Positioned(
            left: 24,
            right: 24,
            bottom: 40,
            child: Column(
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.75),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.white24),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.qr_code_scanner, color: Colors.white, size: 18),
                      SizedBox(width: 8),
                      Text(
                        "Posisikan kode QR di dalam bingkai",
                        style: TextStyle(color: Colors.white, fontSize: 12),
                      ),
                    ],
                  ),
                ),

              ],
            ),
          ),
        ],
      ),
    );
  }
}
