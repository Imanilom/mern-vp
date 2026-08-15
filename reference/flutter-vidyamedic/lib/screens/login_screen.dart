import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:async';
import '../env_config.dart';
import '../auth_service.dart';
import 'main_wrapper.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _idController = TextEditingController();
  final TextEditingController _studyCodeController = TextEditingController();
  final TextEditingController _pinController = TextEditingController();
  bool _isLoading = false;
  bool _acceptedPrivacy = false;

  final String baseUrl = EnvConfig.apiBaseUrl;

  Future<void> _login() async {
    if (!_acceptedPrivacy) {
      _showError('Anda harus menyetujui kebijakan privasi.');
      return;
    }
    
    // Fallback: Using email/password route in backend for now.
    // In real app, ID maps to email or username.
    final String email = _idController.text.trim();
    final String password = _pinController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      _showError('Harap isi semua bidang.');
      return;
    }

    setState(() => _isLoading = true);

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/signin'),
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
        body: json.encode({
          'email': email,
          'password': password,
        }),
      );

      if (response.statusCode == 200) {
        final userData = json.decode(response.body);
        final userId = userData['_id']?.toString() ?? userData['id']?.toString() ?? '';
        final username = userData['name']?.toString() ?? email;
        final token = userData['token'];

        await AuthService.saveSession(
          userId: userId,
          username: username,
          email: email,
          token: token,
        );

        if (!mounted) return;
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const MainWrapper()),
        );
      } else {
        final errorData = json.decode(response.body);
        _showError(errorData['message'] ?? 'Gagal login.');
      }
    } catch (e) {
      _showError('Kesalahan jaringan: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 40),
              // Header
              const Icon(Icons.monitor_heart, size: 60, color: Color(0xFF073B4C)),
              const SizedBox(height: 20),
              const Text(
                'Selamat Datang',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF073B4C),
                ),
              ),
              const Text(
                'Health Trajectory Monitor',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: Colors.grey),
              ),
              const SizedBox(height: 40),
              
              // Form Fields
              TextField(
                controller: _idController,
                decoration: InputDecoration(
                  labelText: 'Email / Participant ID',
                  hintText: 'Contoh: P001',
                  prefixIcon: const Icon(Icons.person_outline),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _studyCodeController,
                decoration: InputDecoration(
                  labelText: 'Study Code',
                  hintText: 'Contoh: HTM-2026',
                  prefixIcon: const Icon(Icons.science_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _pinController,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: 'Kata Sandi / PIN',
                  prefixIcon: const Icon(Icons.lock_outline),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 16),
              
              // Privacy Checkbox
              Row(
                children: [
                  Checkbox(
                    value: _acceptedPrivacy,
                    activeColor: const Color(0xFF073B4C),
                    onChanged: (val) {
                      setState(() => _acceptedPrivacy = val ?? false);
                    },
                  ),
                  const Expanded(
                    child: Text(
                      'Saya menyetujui kebijakan privasi dan pengelolaan data penelitian.',
                      style: TextStyle(fontSize: 12),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              
              // Login Button
              ElevatedButton(
                onPressed: _isLoading ? null : _login,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF073B4C),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: _isLoading 
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Masuk', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
              ),
              const SizedBox(height: 16),
              
              // QR Login
              OutlinedButton.icon(
                onPressed: () {},
                icon: const Icon(Icons.qr_code_scanner, color: Color(0xFF073B4C)),
                label: const Text('Login menggunakan QR Code', style: TextStyle(color: Color(0xFF073B4C))),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  side: const BorderSide(color: Color(0xFF073B4C)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              
              const SizedBox(height: 24),
              TextButton(
                onPressed: () {},
                child: const Text('Lupa kata sandi?', style: TextStyle(color: Colors.grey)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
