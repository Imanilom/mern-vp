import 'package:geocoding/geocoding.dart';
import 'package:geolocator/geolocator.dart';

class DeviationLocation {
  const DeviationLocation({
    required this.latitude,
    required this.longitude,
    required this.placeName,
    required this.capturedAt,
  });

  final double latitude;
  final double longitude;
  final String placeName;
  final DateTime capturedAt;

  Map<String, dynamic> toJson() => {
        'latitude': latitude,
        'longitude': longitude,
        'place_name': placeName,
        'captured_at': capturedAt.toUtc().toIso8601String(),
      };
}

class DeviationLocationResult {
  const DeviationLocationResult({this.location, this.error});

  final DeviationLocation? location;
  final String? error;
}

class DeviationLocationService {
  const DeviationLocationService();

  Future<DeviationLocationResult> capture() async {
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        return const DeviationLocationResult(
          error: 'Layanan lokasi perangkat sedang nonaktif.',
        );
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied) {
        return const DeviationLocationResult(
          error:
              'Izin lokasi tidak diberikan; jawaban konteks tetap dapat disimpan.',
        );
      }
      if (permission == LocationPermission.deniedForever) {
        return const DeviationLocationResult(
          error:
              'Izin lokasi ditolak permanen. Aktifkan dari Pengaturan jika ingin menyertakan lokasi.',
        );
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );
      var placeName = 'Lokasi terdeteksi';
      String? warning;
      try {
        final placemarks = await Geocoding().placemarkFromCoordinates(
          position.latitude,
          position.longitude,
        );
        if (placemarks.isNotEmpty) {
          final place = placemarks.first;
          final parts = [
            place.name,
            place.subLocality,
            place.locality,
            place.subAdministrativeArea,
            place.administrativeArea,
            place.country,
          ]
              .whereType<String>()
              .map((part) => part.trim())
              .where((part) => part.isNotEmpty)
              .toSet()
              .toList();
          if (parts.isNotEmpty) placeName = parts.join(', ');
        }
      } catch (_) {
        placeName =
            '${position.latitude.toStringAsFixed(5)}, ${position.longitude.toStringAsFixed(5)}';
        warning =
            'Nama tempat tidak tersedia; koordinat lokasi tetap berhasil diambil.';
      }
      return DeviationLocationResult(
        location: DeviationLocation(
          latitude: position.latitude,
          longitude: position.longitude,
          placeName: placeName,
          capturedAt: position.timestamp,
        ),
        error: warning,
      );
    } catch (error) {
      return DeviationLocationResult(
        error: 'Gagal mengambil lokasi: $error',
      );
    }
  }
}
