import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../theme/app_colors.dart';

class InsightScreen extends StatefulWidget {
  const InsightScreen({super.key});

  @override
  State<InsightScreen> createState() => _InsightScreenState();
}

class _InsightScreenState extends State<InsightScreen> {
  Map<String, dynamic>? forecastData;
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadForecast();
  }

  Future<void> _loadForecast() async {
    setState(() => isLoading = true);
    final data = await ApiService.fetchForecast();
    if (mounted) {
      setState(() {
        forecastData = data;
        isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Insight & Prediksi',
                style: TextStyle(
                  fontFamily: 'Plus Jakarta Sans',
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 2),
              const Text(
                'Personal recovery profile & horizon prediction',
                style: TextStyle(fontSize: 12, color: AppColors.gray),
              ),
              const SizedBox(height: 20),

              // A13 Prediksi State Card (Empty State)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.line),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('PREDIKSI STATE & INSIGHT', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.gray)),
                    const SizedBox(height: 14),
                    const Center(
                      child: Text(
                        'Prediksi insight belum tersedia.',
                        style: TextStyle(fontSize: 12, color: AppColors.gray),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

}

