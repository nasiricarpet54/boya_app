import 'dart:convert';

import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// One Q&A pair inside the static FAQ.
class FaqItem {
  const FaqItem({required this.question, required this.answer});

  factory FaqItem.fromJson(Map<String, dynamic> json) => FaqItem(
        question: (json['question'] as String?) ?? '',
        answer: (json['answer'] as String?) ?? '',
      );

  final String question;
  final String answer;
}

/// A FAQ group, e.g. «رزرو» or «پرداخت».
class FaqCategory {
  const FaqCategory({required this.title, required this.questions});

  factory FaqCategory.fromJson(Map<String, dynamic> json) => FaqCategory(
        title: (json['title'] as String?) ?? '',
        questions: <FaqItem>[
          for (final item in (json['questions'] as List? ?? const <dynamic>[]))
            if (item is Map<String, dynamic>) FaqItem.fromJson(item),
        ],
      );

  final String title;
  final List<FaqItem> questions;
}

/// The FAQ is a bundled `assets/faq.json`, not an endpoint: it changes with app
/// releases, not per user, so shipping it in the bundle keeps the support page
/// instant and usable offline. Only tickets are dynamic.
class FaqContent {
  static const String assetPath = 'assets/faq.json';

  static Future<List<FaqCategory>> load() async {
    final raw = await rootBundle.loadString(assetPath);
    final decoded = jsonDecode(raw);
    if (decoded is! List) return const <FaqCategory>[];
    return <FaqCategory>[
      for (final item in decoded)
        if (item is Map<String, dynamic>) FaqCategory.fromJson(item),
    ];
  }
}

/// All FAQ categories, in the order the file declares them. Cached for the life
/// of the process — the content cannot change without a new build.
final faqProvider = FutureProvider<List<FaqCategory>>(
  (ref) async => FaqContent.load(),
);
