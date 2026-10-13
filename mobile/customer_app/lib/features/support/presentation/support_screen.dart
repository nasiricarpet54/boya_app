import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../shared/widgets/boya_app_bar.dart';
import '../data/faq_content.dart';

/// Landing page for the whole support area: FAQ first (most tickets are answered
/// questions), then the two dynamic entries below.
///
/// The FAQ is read through [faqProvider], so this screen rebuilds when the
/// bundled file has been parsed. Everything else here is static chrome.
class SupportScreen extends ConsumerWidget {
  const SupportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final faqAsync = ref.watch(faqProvider);
    return Scaffold(
      backgroundColor: BoyaColors.cream,
      appBar: const BoyaAppBar(title: 'پشتیبانی'),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const _SupportHeader(),
          const SizedBox(height: 16),
          const _SectionTitle(title: 'سوالات متداول'),
          const SizedBox(height: 8),
          faqAsync.when(
            data: (categories) => _FaqPreview(categories: categories),
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(child: CircularProgressIndicator(color: BoyaColors.primary)),
            ),
            error: (_, _) => const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text('بارگذاری سوالات متداول ناموفق بود', style: BoyaTypography.body),
              ),
            ),
          ),
          const SizedBox(height: 16),
          const _SectionTitle(title: 'تماس با ما'),
          const SizedBox(height: 8),
          const _ContactTile(
            icon: Icons.phone_outlined,
            title: 'تلفن پشتیبانی',
            value: '۰۲۱-۱۲۳۴۵۶۷۸',
          ),
          const _ContactTile(
            icon: Icons.mail_outline,
            title: 'ایمیل پشتیبانی',
            value: 'support@boya.ir',
          ),
          const SizedBox(height: 16),
          const _SectionTitle(title: 'تیکت‌ها'),
          const SizedBox(height: 8),
          _ActionTile(
            icon: Icons.add_comment_outlined,
            title: 'ثبت شکایت / سوال جدید',
            subtitle: 'پیام شما به تیم پشتیبانی ارسال می‌شود',
            onTap: () => context.push('/support/new'),
          ),
          _ActionTile(
            icon: Icons.list_alt,
            title: 'تیکت‌های من',
            subtitle: 'پیگیری و مشاهده پاسخ‌ها',
            onTap: () => context.push('/support/tickets'),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class _SupportHeader extends StatelessWidget {
  const _SupportHeader();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: BoyaColors.primarySubtle,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const Icon(Icons.support_agent, color: BoyaColors.primary, size: 32),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('هر کمکی لازم دارید، اینجا هستیم', style: BoyaTypography.title),
                const SizedBox(height: 4),
                Text(
                  'ابتدا سوالات متداول را ببینید; وگرنه یک تیکت ثبت کنید تا پاسخ بدهیم.',
                  style: BoyaTypography.caption,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// The three most-asked questions, collapsed, with a link to the full list.
class _FaqPreview extends StatelessWidget {
  const _FaqPreview({required this.categories});

  final List<FaqCategory> categories;

  @override
  Widget build(BuildContext context) {
    final preview = categories.take(3).toList();
    return Card(
      color: BoyaColors.surface,
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Column(
        children: [
          for (final category in preview) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Align(
                alignment: Alignment.centerRight,
                child: Text(category.title, style: BoyaTypography.caption),
              ),
            ),
            for (final item in category.questions.take(2))
              _FaqPreviewRow(question: item.question, answer: item.answer),
          ],
          ListTile(
            title: Align(
              alignment: Alignment.center,
              child: Text(
                'مشاهده همه سوالات متداول',
                style: BoyaTypography.caption.copyWith(color: BoyaColors.primary),
              ),
            ),
            onTap: () => context.push('/support/faq'),
          ),
        ],
      ),
    );
  }
}

class _FaqPreviewRow extends StatelessWidget {
  const _FaqPreviewRow({required this.question, required this.answer});

  final String question;
  final String answer;

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      tilePadding: const EdgeInsets.symmetric(horizontal: 16),
      title: Text(question, style: BoyaTypography.body.copyWith(fontSize: 14)),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: Align(
            alignment: Alignment.centerRight,
            child: Text(answer, style: BoyaTypography.caption),
          ),
        ),
      ],
    );
  }
}

class _ContactTile extends StatelessWidget {
  const _ContactTile({required this.icon, required this.title, required this.value});

  final IconData icon;
  final String title;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: BoyaColors.surface,
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ListTile(
        leading: Icon(icon, color: BoyaColors.primary),
        title: Text(title, style: BoyaTypography.body),
        trailing: Text(value, style: BoyaTypography.caption),
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: BoyaColors.surface,
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: ListTile(
        leading: Icon(icon, color: BoyaColors.primary),
        title: Text(title, style: BoyaTypography.body),
        subtitle: Text(subtitle, style: BoyaTypography.caption),
        trailing: const Icon(Icons.chevron_left, color: BoyaColors.inkMuted),
        onTap: onTap,
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(title, style: BoyaTypography.title);
  }
}
