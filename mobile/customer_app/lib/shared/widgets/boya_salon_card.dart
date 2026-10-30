import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:boya_shared/theme/boya_colors.dart';
import 'package:boya_shared/theme/boya_typography.dart';
import 'package:boya_shared/utils/persian_number_utils.dart';

/// کارت سالن تعاملی: انتخاب خدمت، متخصص و زمان رزرو.
class BoyaSalonCard extends StatefulWidget {
  final Map<String, dynamic> salon;
  final bool isWishlisted;
  final VoidCallback onToggleWishlist;
  final Function(dynamic service, dynamic specialist, String date, String time) onBookNow;
  final Function(dynamic specialist) onViewPortfolio;

  const BoyaSalonCard({
    super.key,
    required this.salon,
    required this.isWishlisted,
    required this.onToggleWishlist,
    required this.onBookNow,
    required this.viewPortfolio,
  });

  @override
  State<BoyaSalonCard> createState() => _BoyaSalonCardState();
}

class _BoyaSalonCardState extends State<BoyaSalonCard> {
  int _selectedServiceIndex = 0;
  int _selectedSpecialistIndex = 0;
  String _selectedTimeSlot = '';

  @override
  Widget build(BuildContext context) {
    final services = widget.salon['services'] as List<dynamic>? ?? [];
    final specialists = widget.salon['specialists'] as List<dynamic>? ?? [];
    final currentService = services.isNotEmpty ? services[_selectedServiceIndex] : null;

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: BoyaColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: BoyaColors.line),
        boxShadow: [
          BoxShadow(
            color: BoyaColors.primary.withOpacity(0.08),
            blurRadius: 30,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Cover Image & Badges
          Stack(
            children: [
              CachedNetworkImage(
                imageUrl: widget.salon['coverImage'] ?? '',
                height: 180,
                width: double.infinity,
                fit: BoxFit.cover,
                placeholder: (context, url) => Container(color: BoyaColors.cream),
                errorWidget: (context, url, error) => Container(color: BoyaColors.cream),
              ),
              Container(
                height: 180,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [
                      BoyaColors.primary.withOpacity(0.9),
                      BoyaColors.primary.withOpacity(0.0),
                    ],
                  ),
                ),
              ),
              if (widget.salon['isApproved'] == true)
                Positioned(
                  top: 12,
                  right: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: BoyaColors.surface.withOpacity(0.95),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: BoyaColors.success.withOpacity(0.5)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.check_circle, size: 14, color: BoyaColors.success),
                        SizedBox(width: 4),
                        Text(
                          'تایید شده',
                          style: TextStyle(
                            fontSize: 10,
                            color: BoyaColors.success,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              Positioned(
                bottom: 12,
                right: 12,
                left: 12,
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.salon['name'] ?? '',
                            style: TextStyle(
                              color: BoyaColors.cream,
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              fontFamily: BoyaTypography.fontFamily,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Icon(Icons.location_on_outlined, size: 14, color: BoyaColors.lightRose),
                              const SizedBox(width: 4),
                              Text(
                                '${widget.salon['city'] ?? ''}، ${widget.salon['district'] ?? ''}',
                                style: TextStyle(color: BoyaColors.cream, fontSize: 12),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: widget.onToggleWishlist,
                      icon: Icon(
                        widget.isWishlisted ? Icons.favorite : Icons.favorite_border,
                        color: widget.isWishlisted ? BoyaColors.error : BoyaColors.cream,
                        size: 20,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          // 2. Body Content - Specialists & Services
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('متخصصین سالن:', style: BoyaTypography.labelBold),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: List.generate(specialists.length, (index) {
                      final spec = specialists[index];
                      final isSelected = _selectedSpecialistIndex == index;
                      return GestureDetector(
                        onTap: () => setState(() => _selectedSpecialistIndex = index),
                        child: Container(
                          margin: const EdgeInsets.only(left: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                          decoration: BoxDecoration(
                            color: isSelected ? BoyaColors.lightRose.withOpacity(0.2) : BoyaColors.surface,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: isSelected ? BoyaColors.rose : BoyaColors.line),
                          ),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 14,
                                backgroundImage: CachedNetworkImageProvider(spec['avatar']),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                spec['name'],
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                  color: BoyaColors.ink,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                  ),
                ),
                const SizedBox(height: 16),
                const Text('خدمات:', style: BoyaTypography.labelBold),
                const SizedBox(height: 8),
                ...List.generate(services.length, (index) {
                  final serv = services[index];
                  final isSelected = _selectedServiceIndex == index;
                  return GestureDetector(
                    onTap: () => setState(() => _selectedServiceIndex = index),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: isSelected ? BoyaColors.lightRose.withOpacity(0.1) : BoyaColors.surface,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: isSelected ? BoyaColors.rose : BoyaColors.line),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  serv['name'],
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: BoyaColors.ink,
                                  ),
                                ),
                                Text(
                                  '${serv['durationMinutes']} دقیقه',
                                  style: const TextStyle(fontSize: 11, color: BoyaColors.inkMuted),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '${serv['price']} تومان',
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: BoyaColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
                const SizedBox(height: 16),
                const Text('ساعت‌های رزرو آزاد:', style: BoyaTypography.labelBold),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: List.generate(4, (index) {
                    final time = '۱${index + 2}:۰۰';
                    final isSelected = _selectedTimeSlot == time;
                    return GestureDetector(
                      onTap: () => setState(() => _selectedTimeSlot = time),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: isSelected ? BoyaColors.primary : BoyaColors.surface,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: isSelected ? BoyaColors.primary : BoyaColors.line),
                        ),
                        child: Text(
                          time,
                          style: TextStyle(
                            fontSize: 12,
                            color: isSelected ? BoyaColors.cream : BoyaColors.ink,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                      ),
                    );
                  }),
                ),
                const SizedBox(height: 16),
                const Divider(color: BoyaColors.line),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('مبلغ خدمت:', style: TextStyle(fontSize: 11, color: BoyaColors.inkMuted)),
                        Text(
                          currentService != null ? '${currentService['price']} تومان' : '',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: BoyaColors.ink,
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    ElevatedButton(
                      onPressed: () {
                        widget.onBookNow(
                          currentService,
                          specialists[_selectedSpecialistIndex],
                          'امروز',
                          _selectedTimeSlot.isEmpty ? '۱۱:۳۰' : _selectedTimeSlot,
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: BoyaColors.primary,
                        foregroundColor: BoyaColors.cream,
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('رزرو نوبت', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                          SizedBox(width: 4),
                          Icon(Icons.chevron_left, size: 16),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}