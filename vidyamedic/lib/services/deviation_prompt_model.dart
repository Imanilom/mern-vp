import '../models/health_models.dart';

class DeviationPromptModel {
  const DeviationPromptModel();

  String generate({
    required CaparFollowUpPrompt followUp,
    required WearableData wearable,
    required List<Map<String, dynamic>> checkIns,
    DateTime? now,
  }) {
    final heartRateFactor = _heartRateFactor(followUp.mainFactors);
    final generatedAt = now ?? DateTime.now();
    final observation = _heartRateObservation(
            heartRateFactor, followUp, wearable, generatedAt) ??
        _factorObservation(followUp.mainFactors);
    final recordedContext = _recordedContext(
      checkIns,
      followUp.peakTime ?? followUp.onsetTime ?? generatedAt,
    );

    final contextSentence = recordedContext.isEmpty
        ? 'Belum ada catatan aktivitas, stres, tidur, atau keluhan yang waktunya sesuai dengan perubahan ini.'
        : 'Pada catatan sekitar waktu perubahan, Anda mencatat $recordedContext.';
    return '$observation $contextSentence Apakah catatan tersebut sesuai dengan kondisi Anda saat itu, atau ada hal lain yang ingin dicatat? Informasi ini hanya konteks waktu dan tidak membuktikan penyebab.';
  }

  Map<String, dynamic>? _heartRateFactor(
    List<Map<String, dynamic>> factors,
  ) {
    for (final factor in factors) {
      final feature =
          (factor['feature'] ?? factor['key'] ?? '').toString().toLowerCase();
      final label = factor['label']?.toString().toLowerCase() ?? '';
      final physiology = factor['physiology']?.toString().toLowerCase();
      if (feature == 'hr_mean' ||
          feature == 'hr_delta' ||
          feature == 'delta_hr' ||
          feature == 'hr_slope' ||
          physiology == 'heart_rate' ||
          label.contains('denyut jantung')) {
        return factor;
      }
    }
    return null;
  }

  String? _heartRateObservation(
    Map<String, dynamic>? factor,
    CaparFollowUpPrompt followUp,
    WearableData wearable,
    DateTime? now,
  ) {
    if (factor != null) {
      final feature =
          (factor['feature'] ?? factor['key'] ?? '').toString().toLowerCase();
      final value = _number(factor['value']);
      final baseline = _number(factor['baseline_mean']);
      final delta = _number(factor['delta']);
      if (feature == 'hr_mean' && value != null) {
        final baselineText = baseline == null
            ? ''
            : ', dibanding rerata pribadi ${_formatNumber(baseline)} bpm';
        final deltaText =
            delta == null ? '' : ' (selisih ${_signedNumber(delta)} bpm)';
        return 'Pada segmen yang terdeteksi, denyut jantung rata-rata tercatat ${_formatNumber(value)} bpm$baselineText$deltaText.';
      }
      if (delta != null) {
        if (delta == 0) {
          return 'Pada segmen yang terdeteksi, perubahan denyut jantung berada dalam rerata pola pribadi Anda.';
        }
        final direction = delta > 0 ? 'lebih tinggi' : 'lebih rendah';
        return 'Pada segmen yang terdeteksi, perubahan denyut jantung tercatat ${_formatNumber(delta.abs())} bpm $direction dari pola pribadi Anda.';
      }
    }

    final sampledAt = wearable.lastSync;
    final eventTime = followUp.peakTime ?? followUp.onsetTime ?? now;
    final sampleAge = sampledAt == null || eventTime == null
        ? null
        : eventTime.difference(sampledAt).abs();
    if (wearable.hasServerSamples &&
        !wearable.isSimulated &&
        wearable.heartRate > 0 &&
        wearable.baselineHr > 0 &&
        sampleAge != null &&
        sampleAge >= Duration.zero &&
        sampleAge <= const Duration(minutes: 30)) {
      final delta = wearable.heartRate - wearable.baselineHr;
      final comparison = delta > 0
          ? '${_formatNumber(delta.toDouble())} bpm di atas'
          : delta < 0
              ? '${_formatNumber(delta.abs().toDouble())} bpm di bawah'
              : 'setara dengan';
      return 'Data wearable terbaru mencatat denyut jantung ${wearable.heartRate} bpm, $comparison baseline pribadi Anda (${wearable.baselineHr} bpm).';
    }
    if (factor != null) {
      return 'Data CAPAR menandai perubahan denyut jantung dibandingkan pola pribadi Anda.';
    }
    return null;
  }

  String _factorObservation(List<Map<String, dynamic>> factors) {
    if (factors.isEmpty) {
      return 'Data CAPAR menunjukkan perubahan dibandingkan pola pribadi Anda.';
    }
    final feature =
        (factors.first['feature'] ?? factors.first['key'] ?? '').toString();
    final label = factors.first['label']?.toString() ?? _featureLabel(feature);
    return 'Data CAPAR menandai perubahan pada $label dibandingkan pola pribadi Anda.';
  }

  String _recordedContext(
    List<Map<String, dynamic>> checkIns,
    DateTime anchor,
  ) {
    final eligible = checkIns.map((checkIn) {
      final recordedAt =
          DateTime.tryParse(checkIn['recorded_at']?.toString() ?? '');
      return (checkIn: checkIn, recordedAt: recordedAt);
    }).where((entry) {
      final recordedAt = entry.recordedAt;
      if (recordedAt == null) return false;
      final age = anchor.difference(recordedAt);
      return age >= Duration.zero && age <= const Duration(hours: 24);
    }).toList()
      ..sort((a, b) => b.recordedAt!.compareTo(a.recordedAt!));

    for (final entry in eligible) {
      final checkIn = entry.checkIn;
      final context = <String>[];
      final activity = checkIn['activity']?.toString();
      if (activity != null && activity.isNotEmpty) {
        context.add(_activityLabel(activity));
      }

      final stress = _number(checkIn['stress_level']);
      if (stress != null) {
        context.add('stres ${_stressLabel(stress.round())}');
      }

      final symptoms = checkIn['symptoms'];
      if (symptoms is List) {
        final labels = symptoms
            .map((symptom) => _symptomLabel(symptom.toString()))
            .where((label) => label != null)
            .cast<String>()
            .toList();
        if (labels.isNotEmpty) context.add('keluhan ${labels.join(', ')}');
      }

      final sleep = checkIn['sleep'];
      if (sleep is Map) {
        final duration = _number(sleep['duration_minutes']);
        if (duration != null && duration > 0) {
          final hours = duration ~/ 60;
          final minutes = duration.round() % 60;
          context.add(
            'tidur $hours jam${minutes > 0 ? ' $minutes menit' : ''}',
          );
        }
        final quality = sleep['quality']?.toString();
        if (quality != null && quality.isNotEmpty) {
          context.add('kualitas tidur ${_sleepQualityLabel(quality)}');
        }
      }

      final lifestyle = checkIn['lifestyle'];
      if (lifestyle is Map && lifestyle['caffeine'] == true) {
        context.add('konsumsi kafein');
      }
      if (context.isNotEmpty) return context.join(', ');
    }
    return '';
  }

  String _activityLabel(String activity) => switch (activity.toLowerCase()) {
        'rest' || 'istirahat' => 'istirahat',
        'sitting' || 'duduk' => 'duduk',
        'standing' || 'berdiri' => 'berdiri',
        'walking' || 'berjalan' => 'berjalan',
        'running' || 'berlari' => 'berlari',
        'exercise' || 'olahraga' => 'berolahraga',
        'work' || 'working' || 'bekerja' => 'bekerja',
        'meal' || 'eating' || 'makan' => 'makan',
        _ => 'aktivitas lain',
      };

  String _stressLabel(int value) => switch (value) {
        1 => 'rendah',
        2 => 'sedang',
        3 => 'tinggi',
        _ => 'tercatat',
      };

  String? _symptomLabel(String code) => switch (code.toLowerCase()) {
        'palpitations' => 'jantung berdebar',
        'breathlessness' => 'sesak napas',
        'chest_pain' => 'nyeri dada',
        'dizziness' => 'pusing',
        'fatigue' => 'lelah',
        'headache' => 'sakit kepala',
        'pain' => 'nyeri',
        'nausea' => 'mual',
        'weakness' => 'lemas',
        'fever' => 'demam',
        'other' => 'keluhan lain',
        'none' => null,
        _ => code,
      };

  String _sleepQualityLabel(String quality) => switch (quality.toLowerCase()) {
        'very_good' || 'excellent' => 'sangat baik',
        'good' => 'baik',
        'fair' => 'cukup',
        'poor' => 'kurang baik',
        _ => quality,
      };

  String _featureLabel(String feature) => switch (feature.toLowerCase()) {
        'hr_mean' => 'denyut jantung rata-rata',
        'hr_delta' || 'delta_hr' => 'perubahan denyut jantung',
        'hr_slope' => 'kenaikan denyut jantung',
        'sdnn' => 'variabilitas denyut jantung',
        'rmssd' => 'variabilitas ritme jantung',
        'dfa_alpha1' => 'pola ritme jantung',
        'motion_index' => 'intensitas gerak',
        _ => feature.replaceAll('_', ' '),
      };

  double? _number(dynamic value) {
    if (value is num && value.isFinite) return value.toDouble();
    final parsed = double.tryParse(value?.toString() ?? '');
    return parsed != null && parsed.isFinite ? parsed : null;
  }

  String _formatNumber(double value) => value == value.roundToDouble()
      ? value.toStringAsFixed(0)
      : value.toStringAsFixed(1);

  String _signedNumber(double value) =>
      '${value > 0 ? '+' : ''}${_formatNumber(value)}';
}
