import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/boya_app_bar.dart';
import '../../../core/network/api_client.dart' show messageFromDio;
import '../data/support_api.dart';

/// New complaint/question/suggestion form.
///
/// The submit button mirrors the backend validation (min lengths) so the
/// customer gets immediate feedback instead of a 400 round-trip. A successful
/// post invalidates [myTicketsProvider] before popping, so the list already has
/// the new row when the customer opens it.
class CreateTicketScreen extends ConsumerStatefulWidget {
  const CreateTicketScreen({super.key});

  @override
  ConsumerState<CreateTicketScreen> createState() => _CreateTicketScreenState();
}

class _CreateTicketScreenState extends ConsumerState<CreateTicketScreen> {
  final _formKey = GlobalKey<FormState>();
  final _subject = TextEditingController();
  final _message = TextEditingController();
  String _type = 'complaint';
  bool _sending = false;

  @override
  void dispose() {
    _subject.dispose();
    _message.dispose();
    super.dispose();
  }

  // Mirrors `CreateTicketDto`, so the button only unlocks a body the API accepts.
  bool get _isValid =>
      _subject.text.trim().length >= 3 && _message.text.trim().length >= 10;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _sending = true);
    final api = ref.read(supportApiProvider);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await api.createTicket(
        type: _type,
        subject: _subject.text.trim(),
        message: _message.text.trim(),
      );
      // The new ticket must appear in the list the customer is about to open.
      ref.invalidate(myTicketsProvider);
      if (mounted) {
        messenger.showSnackBar(const SnackBar(content: Text('تیکت شما ثبت شد')));
        context.pop();
      }
    } catch (error) {
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(content: Text('ثبت تیکت ناموفق بود: ${messageFromDio(error)}')),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BoyaColors.cream,
      appBar: const BoyaAppBar(title: 'ثبت تیکت'),
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              const Text('��� �?��', style: BoyaTypography.title),
              const SizedBox(height: 8),
              _TicketTypeSelector(
                value: _type,
                onChanged: (value) => setState(() => _type = value),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _subject,
                textDirection: TextDirection.rtl,
                decoration: const InputDecoration(
                  labelText: '�����',
                  hintText: 'خلاصه کوتاه',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  final text = (value ?? '').trim();
                  if (text.isEmpty) return '����� �� ���� ��?�';
                  if (text.length < 3) return '����� ��?� ����� ? ���ǘ�� ����';
                  if (text.length > 200) return '����� ��?� ��ǘ�� ??? ���ǘ�� ����';
                  return null;
                },
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _message,
                textDirection: TextDirection.rtl,
                maxLines: 8,
                decoration: const InputDecoration(
                  labelText: 'توضیحات',
                  hintText: 'مشکل یا سوال خود را کامل توضیح دهید',
                  border: OutlineInputBorder(),
                ),
                validator: (value) {
                  final text = (value ?? '').trim();
                  if (text.isEmpty) return 'توضیحات را وارد کنید';
                  if (text.length < 10) return 'توضیحات باید حداقل ۱۰ کاراکتر باشد';
                  if (text.length > 5000) return 'توضیحات باید حداکثر ۵۰۰۰ کاراکتر باشد';
                  return null;
                },
              ),
              const SizedBox(height: 8),
              Align(
                alignment: Alignment.centerRight,
                child: Text('حداقل ۱۰ کاراکتر', style: BoyaTypography.caption),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: _sending || !_isValid
                    ? null
                    : () {
                        FocusScope.of(context).unfocus();
                        _submit();
                      },
                icon: _sending
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send),
                label: const Text('ارسال تیکت'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TicketTypeSelector extends StatelessWidget {
  const _TicketTypeSelector({required this.value, required this.onChanged});

  final String value;
  final ValueChanged<String> onChanged;

  static const _types = <(String, String)>[
    ('complaint', 'شکایت'),
    ('question', 'سوال'),
    ('suggestion', 'پیشنهاد'),
    ('other', 'دیگر'),
  ];

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        for (final (typeValue, label) in _types)
          ChoiceChip(
            label: Text(label),
            selected: value == typeValue,
            onSelected: (_) => onChanged(typeValue),
            selectedColor: BoyaColors.primarySubtle,
          ),
      ],
    );
  }
}
