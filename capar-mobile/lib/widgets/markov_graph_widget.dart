import 'dart:math';
import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class MarkovGraphWidget extends StatelessWidget {
  final Map<String, dynamic> markovData;

  const MarkovGraphWidget({super.key, required this.markovData});

  @override
  Widget build(BuildContext context) {
    final matrix = markovData['matrix'] as List<dynamic>? ?? [];
    
    // Parse edges
    List<Edge> edges = [];
    for (var row in matrix) {
      final fromState = row['current_state']?.toString() ?? '';
      final transitions = row['transitions'] as List<dynamic>? ?? [];
      for (var t in transitions) {
        final toState = t['next_state']?.toString() ?? '';
        final p = t['probability'];
        if (p != null && p is num && p > 0.05) { // Only show > 5% probability
          edges.add(Edge(fromState, toState, p.toDouble()));
        }
      }
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'MARKOV STATE GRAPH',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: AppColors.gray,
                      letterSpacing: 0.5,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Visualisasi Transisi Probabilitas',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: AppColors.navy,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.tealSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  'n=${markovData['episode_count']} ep',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.teal,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 240,
            width: double.infinity,
            child: CustomPaint(
              painter: _MarkovGraphPainter(edges: edges),
            ),
          ),
          const SizedBox(height: 16),
          // Legend
          Wrap(
            spacing: 12,
            runSpacing: 8,
            children: _stateLabels.keys.map((st) => Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 10, height: 10,
                  decoration: BoxDecoration(color: _stateColors[st], shape: BoxShape.circle),
                ),
                const SizedBox(width: 4),
                Text(_stateLabels[st]!, style: const TextStyle(fontSize: 10, color: AppColors.gray)),
              ],
            )).toList(),
          ),
        ],
      ),
    );
  }
}

class Edge {
  final String from;
  final String to;
  final double probability;
  Edge(this.from, this.to, this.probability);
}

const Map<String, String> _stateLabels = {
  'BASELINE_COMPATIBLE': 'BC',
  'DEVIATION_CANDIDATE': 'DC',
  'PERSISTENT_DEVIATION': 'PD',
  'RECOVERY_START': 'RS',
  'RECOVERED': 'RV',
};

const Map<String, Color> _stateColors = {
  'BASELINE_COMPATIBLE': Color(0xFF10B981), // emerald
  'DEVIATION_CANDIDATE': Color(0xFFF59E0B), // amber
  'PERSISTENT_DEVIATION': Color(0xFFEF4444), // red
  'RECOVERY_START': Color(0xFF8B5CF6), // purple
  'RECOVERED': Color(0xFF3B82F6), // blue
};

class _MarkovGraphPainter extends CustomPainter {
  final List<Edge> edges;
  _MarkovGraphPainter({required this.edges});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = min(size.width, size.height) / 2 * 0.75;

    final states = _stateLabels.keys.toList();
    final nodePositions = <String, Offset>{};

    // Calculate node positions (Pentagon layout)
    for (int i = 0; i < states.length; i++) {
      // Start at top (BC), then clockwise
      final angle = -pi / 2 + (2 * pi * i / states.length);
      final x = center.dx + radius * cos(angle);
      final y = center.dy + radius * sin(angle);
      nodePositions[states[i]] = Offset(x, y);
    }

    // Draw edges
    for (var edge in edges) {
      if (!nodePositions.containsKey(edge.from) || !nodePositions.containsKey(edge.to)) continue;
      _drawEdge(canvas, nodePositions[edge.from]!, nodePositions[edge.to]!, edge, edge.from == edge.to);
    }

    // Draw nodes
    final nodeRadius = 16.0;
    for (var state in states) {
      final pos = nodePositions[state]!;
      final paint = Paint()
        ..color = _stateColors[state] ?? AppColors.gray
        ..style = PaintingStyle.fill;
      canvas.drawCircle(pos, nodeRadius, paint);

      // Draw label inside node
      final textPainter = TextPainter(
        text: TextSpan(
          text: _stateLabels[state],
          style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
        ),
        textDirection: TextDirection.ltr,
      );
      textPainter.layout();
      textPainter.paint(canvas, pos - Offset(textPainter.width / 2, textPainter.height / 2));
    }
  }

  void _drawEdge(Canvas canvas, Offset from, Offset to, Edge edge, bool isSelf) {
    final pLabel = '${(edge.probability * 100).toStringAsFixed(0)}%';
    final textPainter = TextPainter(
      text: TextSpan(
        text: pLabel,
        style: TextStyle(color: AppColors.navy.withValues(alpha: 0.8), fontSize: 9, fontWeight: FontWeight.w600),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();

    final paint = Paint()
      ..color = AppColors.gray.withValues(alpha: 0.5)
      ..strokeWidth = 1.0 + (edge.probability * 2.5) // thickness based on prob
      ..style = PaintingStyle.stroke;

    final nodeRadius = 16.0;

    if (isSelf) {
      // Self loop
      final loopRadius = nodeRadius * 0.8;
      final loopCenter = from + Offset(nodeRadius * 1.2, -nodeRadius * 1.2);
      canvas.drawCircle(loopCenter, loopRadius, paint);
      
      textPainter.paint(canvas, loopCenter + Offset(-textPainter.width / 2, -textPainter.height / 2));
    } else {
      // Directed edge with curve
      final dx = to.dx - from.dx;
      final dy = to.dy - from.dy;
      final dist = sqrt(dx * dx + dy * dy);
      final nx = dx / dist;
      final ny = dy / dist;

      final start = from + Offset(nx, ny) * nodeRadius;
      final end = to - Offset(nx, ny) * nodeRadius;

      // Curve control point
      final mid = Offset((start.dx + end.dx) / 2, (start.dy + end.dy) / 2);
      final ox = -ny;
      final oy = nx;
      final curveOffset = dist * 0.2; // 20% bend
      final controlPoint = mid + Offset(ox, oy) * curveOffset;

      final path = Path();
      path.moveTo(start.dx, start.dy);
      path.quadraticBezierTo(controlPoint.dx, controlPoint.dy, end.dx, end.dy);
      canvas.drawPath(path, paint);

      // Arrow head at end
      final arrowAngle = atan2(end.dy - controlPoint.dy, end.dx - controlPoint.dx);
      final arrowLength = 6.0;
      final arrowPath = Path();
      arrowPath.moveTo(end.dx, end.dy);
      arrowPath.lineTo(end.dx - arrowLength * cos(arrowAngle - pi / 6), end.dy - arrowLength * sin(arrowAngle - pi / 6));
      arrowPath.moveTo(end.dx, end.dy);
      arrowPath.lineTo(end.dx - arrowLength * cos(arrowAngle + pi / 6), end.dy - arrowLength * sin(arrowAngle + pi / 6));
      canvas.drawPath(arrowPath, paint..style = PaintingStyle.stroke);

      // Label at control point
      // textPainter.paint(canvas, controlPoint - Offset(textPainter.width / 2, textPainter.height / 2));
      
      // Better text positioning along curve
      final textPos = mid + Offset(ox, oy) * (curveOffset * 0.5);
      // Give text a white background so it's readable
      final bgRect = Rect.fromCenter(center: textPos, width: textPainter.width + 4, height: textPainter.height + 2);
      canvas.drawRect(bgRect, Paint()..color = AppColors.surface.withValues(alpha: 0.8));
      textPainter.paint(canvas, textPos - Offset(textPainter.width / 2, textPainter.height / 2));
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
