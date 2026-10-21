import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../providers/app_state.dart';
import '../../services/api_service.dart';
import '../../services/personal_health_chat.dart';
import '../../theme/app_theme.dart';

class PersonalHealthChatScreen extends StatefulWidget {
  const PersonalHealthChatScreen({super.key});

  @override
  State<PersonalHealthChatScreen> createState() =>
      _PersonalHealthChatScreenState();
}

class _PersonalHealthChatScreenState extends State<PersonalHealthChatScreen> {
  final _inputController = TextEditingController();
  final _scrollController = ScrollController();
  final _model = const PersonalHealthChatModel();
  late final PersonalChatHistoryStore _historyStore;
  final List<PersonalChatMessage> _messages = [];
  late final String _geminiConsentKey;
  bool _loadingHistory = true;
  bool _sending = false;
  bool _refreshingData = false;
  bool _useGemini = false;
  String? _historyError;

  @override
  void initState() {
    super.initState();
    final state = context.read<AppState>();
    final account = state.currentAccount;
    final accountId = (account?['id'] ??
            account?['_id'] ??
            account?['email'] ??
            state.userProfile.name)
        .toString()
        .trim();
    final consentAccountId =
        accountId.isEmpty ? 'signed_in_account' : accountId;
    _geminiConsentKey =
        'vidyamedic_personal_chat_gemini_consent_v1_${Uri.encodeComponent(consentAccountId)}';
    _historyStore = PersonalChatHistoryStore(
      accountId: consentAccountId,
    );
    unawaited(_loadHistory());
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    try {
      final preferences = await SharedPreferences.getInstance();
      final messages = await _historyStore.load();
      if (!mounted) return;
      setState(() {
        _messages
          ..clear()
          ..addAll(messages);
        _useGemini = preferences.getBool(_geminiConsentKey) ?? false;
        _historyError = null;
        _loadingHistory = false;
      });
      _scrollToLatest();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _historyError = 'Riwayat chat tidak dapat dibaca: $error';
        _loadingHistory = false;
      });
    }
  }

  Future<bool> _saveHistory() async {
    try {
      await _historyStore.save(_messages);
      if (mounted) setState(() => _historyError = null);
      return true;
    } catch (error) {
      if (mounted) {
        setState(() => _historyError = 'Riwayat chat gagal disimpan: $error');
      }
      return false;
    }
  }

  Future<void> _configureGemini() async {
    if (_useGemini) {
      try {
        final preferences = await SharedPreferences.getInstance();
        final saved = await preferences.setBool(_geminiConsentKey, false);
        if (!saved) throw StateError('Preferensi Gemini gagal disimpan.');
        if (mounted) setState(() => _useGemini = false);
      } catch (error) {
        if (mounted) _showMessage('Gemini gagal dinonaktifkan: $error');
      }
      return;
    }

    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Aktifkan Gemini?'),
        content: const Text(
          'Jika Anda setuju, pertanyaan dan hanya catatan kesehatan yang relevan akan dikirim melalui backend VidyaMedic ke Google Gemini untuk membuat jawaban. Riwayat chat, profil, dan Gemini API key tidak dikirim dari aplikasi. Gemini diproses oleh layanan Google dan dapat mengikuti kebijakan privasinya. Anda dapat tetap memakai chatbot lokal atau menonaktifkan Gemini kapan saja.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Tetap lokal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Setuju, aktifkan'),
          ),
        ],
      ),
    );
    if (accepted != true || !mounted) return;
    try {
      final preferences = await SharedPreferences.getInstance();
      final saved = await preferences.setBool(_geminiConsentKey, true);
      if (!saved) throw StateError('Preferensi Gemini gagal disimpan.');
      if (mounted) setState(() => _useGemini = true);
    } catch (error) {
      if (mounted) _showMessage('Persetujuan Gemini gagal disimpan: $error');
    }
  }

  Future<void> _send([String? preset]) async {
    final question = (preset ?? _inputController.text).trim();
    if (question.isEmpty || _sending || _loadingHistory) return;
    if (_historyError != null) {
      _showMessage('Selesaikan masalah riwayat chat sebelum mengirim pesan.');
      return;
    }

    final previousMessages = List<PersonalChatMessage>.of(_messages);
    final state = context.read<AppState>();
    final userMessage = PersonalChatMessage(
      role: PersonalChatRole.user,
      text: question,
      createdAt: DateTime.now(),
    );
    setState(() {
      _sending = true;
      _messages.add(userMessage);
      if (preset == null) _inputController.clear();
    });
    _scrollToLatest();

    if (!await _saveHistory()) {
      if (mounted) setState(() => _sending = false);
      return;
    }

    final response = _model.respond(
      question: question,
      state: state,
      history: previousMessages,
    );
    var answer = response.text;
    var usedGemini = false;
    if (_useGemini &&
        !response.hasInsufficientData &&
        response.supportingRecords > 0 &&
        _model.isSafeForGemini(question)) {
      final evidence = _model.buildGeminiEvidence(
        question: question,
        state: state,
        history: previousMessages,
      );
      if (evidence.isNotEmpty) {
        final geminiResponse = await ApiService.generatePersonalChatAnswer(
          question: question,
          evidence: evidence,
          localSummary: response.text,
        );
        if (!mounted) return;
        if (geminiResponse.success && geminiResponse.data != null) {
          answer = geminiResponse.data!;
          usedGemini = true;
        } else {
          answer = '${response.text}\n\n'
              'Gemini tidak tersedia: ${geminiResponse.message ?? 'kesalahan tidak diketahui'}. '
              'Saya menampilkan ringkasan lokal dari catatan yang ditemukan.';
        }
      }
    }
    final assistantMessage = PersonalChatMessage(
      role: PersonalChatRole.assistant,
      text: answer,
      createdAt: DateTime.now(),
      quickActions: response.quickActions,
      supportingRecords: response.supportingRecords,
      usedGemini: usedGemini,
    );
    if (!mounted) return;
    setState(() {
      _messages.add(assistantMessage);
      _sending = false;
    });
    _scrollToLatest();
    await _saveHistory();
  }

  Future<void> _refreshPersonalData() async {
    if (_refreshingData) return;
    final state = context.read<AppState>();
    setState(() => _refreshingData = true);
    try {
      await Future.wait<void>([
        state.fetchDailySummary(DateTime.now()),
        state.fetchCaparInsights(),
        state.fetchWearableSamples().then<void>((_) {}),
      ]);
      if (!mounted) return;
      if (state.dataError != null) {
        _showMessage(state.dataError!);
      } else {
        _showMessage('Data personal berhasil diperbarui.');
      }
    } catch (error, stackTrace) {
      debugPrint('Gagal memperbarui data untuk chat personal: '
          '$error\n$stackTrace');
      if (mounted) {
        _showMessage('Data personal gagal diperbarui: $error');
      }
    } finally {
      if (mounted) setState(() => _refreshingData = false);
    }
  }

  Future<void> _confirmClearHistory() async {
    final shouldClear = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Hapus riwayat chat?'),
        content: const Text(
          'Semua percakapan yang tersimpan di perangkat untuk akun ini akan dihapus.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Hapus'),
          ),
        ],
      ),
    );
    if (shouldClear != true || !mounted) return;
    try {
      await _historyStore.clear();
      if (!mounted) return;
      setState(() {
        _messages.clear();
        _historyError = null;
      });
      _showMessage('Riwayat chat di perangkat sudah dihapus.');
    } catch (error) {
      if (!mounted) return;
      setState(() => _historyError = 'Riwayat chat gagal dihapus: $error');
    }
  }

  void _scrollToLatest() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  void _runQuickAction(PersonalChatQuickAction action) {
    if (action.prompt == null) {
      _refreshPersonalData();
    } else {
      _send(action.prompt);
    }
  }

  @override
  Widget build(BuildContext context) {
    context.watch<AppState>();
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Wawasan Personal'),
        actions: [
          IconButton(
            tooltip: _useGemini
                ? 'Gemini aktif; ketuk untuk menonaktifkan'
                : 'Aktifkan Gemini (perlu persetujuan)',
            onPressed: _sending ? null : _configureGemini,
            icon: Icon(
              Icons.auto_awesome,
              color: _useGemini ? AppTheme.primary : null,
            ),
          ),
          IconButton(
            tooltip: 'Perbarui data personal',
            onPressed: _refreshingData ? null : _refreshPersonalData,
            icon: _refreshingData
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh_rounded),
          ),
          IconButton(
            tooltip: 'Hapus riwayat chat di perangkat',
            onPressed:
                _messages.isEmpty || _sending ? null : _confirmClearHistory,
            icon: const Icon(Icons.delete_outline),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            _privacyNotice(),
            if (_historyError != null) _historyErrorBanner(),
            Expanded(
              child: _loadingHistory
                  ? const Center(child: CircularProgressIndicator())
                  : _messages.isEmpty
                      ? _emptyConversation()
                      : _conversation(),
            ),
            _composer(),
          ],
        ),
      ),
    );
  }

  Widget _privacyNotice() => Container(
        width: double.infinity,
        margin: const EdgeInsets.fromLTRB(12, 8, 12, 4),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.primarySoft,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          _useGemini
              ? 'Gemini aktif dengan persetujuan Anda: pertanyaan dan bukti kesehatan terpilih dikirim melalui backend ke Google Gemini. Riwayat chat dan profil tidak dikirim. Ketuk ikon Gemini untuk mematikan. Rujukan tetap dicari lokal; bukan diagnosis.'
              : 'RAG lokal mencari catatan check-in dan sampel wearable yang relevan. Tidak ada data yang dikirim ke AI pihak ketiga selama Gemini nonaktif. Ketuk ikon Gemini bila ingin mengaktifkannya. Riwayat tersimpan lokal dan tidak dienkripsi oleh fitur ini; bukan diagnosis.',
          style: AppTheme.font(
            size: 11,
            color: AppTheme.textSecondary,
            height: 1.4,
          ),
        ),
      );

  Widget _historyErrorBanner() => Container(
        width: double.infinity,
        margin: const EdgeInsets.fromLTRB(12, 4, 12, 8),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppTheme.statusOrangeBg,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                _historyError!,
                style: AppTheme.font(size: 11, color: AppTheme.textPrimary),
              ),
            ),
            TextButton(
              onPressed: _loadHistory,
              child: const Text('Coba lagi'),
            ),
          ],
        ),
      );

  Widget _emptyConversation() => ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const SizedBox(height: 24),
          const Icon(Icons.chat_bubble_outline,
              size: 42, color: AppTheme.primary),
          const SizedBox(height: 12),
          Text(
            'Tanya tentang catatan kesehatan Anda',
            textAlign: TextAlign.center,
            style: AppTheme.font(
              size: 17,
              weight: FontWeight.w800,
              color: AppTheme.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Saya merujuk pada data yang tercatat. Jika datanya belum ada, saya akan mengatakannya.',
            textAlign: TextAlign.center,
            style: AppTheme.font(size: 13, color: AppTheme.textSecondary),
          ),
          const SizedBox(height: 14),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.borderLight),
            ),
            child: Text(
              'Cara menggunakan: perbarui data, isi check-in tidur/aktivitas/stres/gejala, lalu ajukan satu pertanyaan spesifik dengan rentang waktu. Contoh: “Berapa rata-rata denyut jantung 7 hari terakhir?” Jika bukti kurang, chatbot memberi tombol tindakan cepat.',
              style: AppTheme.font(
                size: 12,
                color: AppTheme.textSecondary,
                height: 1.45,
              ),
            ),
          ),
          const SizedBox(height: 20),
          _suggestion('Bagaimana denyut jantung saya dibanding baseline?'),
          _suggestion('Apa yang tercatat tentang tidur saya?'),
          _suggestion('Beri wawasan dari data personal saya'),
        ],
      );

  Widget _suggestion(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: OutlinedButton(
          onPressed: _sending ? null : () => _send(text),
          style: OutlinedButton.styleFrom(
            alignment: Alignment.centerLeft,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          child: Text(text),
        ),
      );

  Widget _conversation() => ListView.builder(
        controller: _scrollController,
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 16),
        itemCount: _messages.length + (_sending ? 1 : 0),
        itemBuilder: (context, index) {
          if (index == _messages.length) {
            return const Align(
              alignment: Alignment.centerLeft,
              child: Padding(
                padding: EdgeInsets.all(12),
                child: SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              ),
            );
          }
          return _messageBubble(_messages[index]);
        },
      );

  Widget _messageBubble(PersonalChatMessage message) {
    final isUser = message.role == PersonalChatRole.user;
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: const BoxConstraints(maxWidth: 320),
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.fromLTRB(13, 10, 13, 8),
        decoration: BoxDecoration(
          color: isUser ? AppTheme.primary : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: isUser ? null : Border.all(color: AppTheme.borderLight),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              message.text,
              style: AppTheme.font(
                size: 13,
                color: isUser ? Colors.white : AppTheme.textPrimary,
                height: 1.4,
              ),
            ),
            if (!isUser && message.supportingRecords > 0) ...[
              const SizedBox(height: 5),
              Text(
                '${message.usedGemini ? 'Jawaban Gemini • ' : ''}'
                'Rujukan lokal: ${message.supportingRecords} catatan/sampel',
                style: AppTheme.font(size: 10, color: AppTheme.textMuted),
              ),
            ],
            const SizedBox(height: 4),
            Text(
              DateFormat('HH:mm').format(message.createdAt.toLocal()),
              style: AppTheme.font(
                size: 10,
                color: isUser ? Colors.white70 : AppTheme.textMuted,
              ),
            ),
            if (message.quickActions.isNotEmpty) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: message.quickActions
                    .map(
                      (action) => ActionChip(
                        label: Text(action.label),
                        onPressed: _sending
                            ? null
                            : () => _runQuickAction(action),
                        visualDensity: VisualDensity.compact,
                      ),
                    )
                    .toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _composer() => Container(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
        color: Colors.white,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextField(
                controller: _inputController,
                minLines: 1,
                maxLines: 4,
                maxLength: 500,
                enabled: !_loadingHistory && !_sending && _historyError == null,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _send(),
                decoration: InputDecoration(
                  hintText: 'Tanyakan tentang data Anda...',
                  counterText: '',
                  filled: true,
                  fillColor: AppTheme.fieldFill,
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(20),
                    borderSide: BorderSide.none,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              tooltip: 'Kirim pesan',
              onPressed: _loadingHistory || _sending || _historyError != null
                  ? null
                  : _send,
              icon: const Icon(Icons.send_rounded),
            ),
          ],
        ),
      );
}
