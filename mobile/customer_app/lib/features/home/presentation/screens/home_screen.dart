import 'package:flutter/material.dart';
import 'package:boya_shared/theme/boya_colors.dart';
import 'package:boya_shared/theme/boya_typography.dart';
import '../../../../shared/widgets/boya_header.dart';
import '../../../../shared/widgets/boya_salon_card.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  String _selectedCity = 'تهران';
  final TextEditingController _searchController = TextEditingController();
  bool _filterMobileOnly = false;

  final List<Map<String, dynamic>> _serviceLines = [
    {'id': 'all', 'name': 'همه خدمات', 'emoji': '✨'},
    {'id': 'hair', 'name': 'مو و استایل', 'emoji': '💇‍♀️'},
    {'id': 'nail', 'name': 'ناخن و دست', 'emoji': '💅'},
    {'id': 'lashes', 'name': 'مژه و ابرو', 'emoji': '👁️'},
    {'id': 'skin', 'name': 'پوست و فیشیال', 'emoji': '🫧'},
    {'id': 'makeup', 'name': 'میکاپ عروس', 'emoji': '💄'},
    {'id': 'spa', 'name': 'اسپا و ماساژ', 'emoji': '🕯️'},
    {'id': 'mobile', 'name': 'خدمات در محل', 'emoji': '🚗'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BoyaColors.background,
      appBar: BoyaHeader(
        selectedCity: _selectedCity,
        onCityTapped: () {},
      ),
      body: CustomScrollView(
        physics: const BouncingScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: _buildHeroBanner(),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: _buildSearchBar(),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              child: _buildServiceLines(),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('سالن‌های مورد تایید بویا', style: BoyaTypography.heading1),
                      Text('تضمین اصالت مجوز و نظارت کیفی', style: BoyaTypography.bodySmall),
                    ],
                  ),
                  TextButton(
                    onPressed: () {},
                    style: TextButton.styleFrom(foregroundColor: BoyaColors.accentRose),
                    child: const Row(
                      children: [
                        Text('لیست کامل', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        Icon(Icons.chevron_left, size: 16),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  return BoyaSalonCard(
                    salon: {
                      'name': 'سالن زیبایی و عمارت گل سرخ',
                      'city': 'تهران',
                      'district': 'الهیه',
                      'coverImage': 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1000&q=80',
                      'isApproved': true,
                      'services': [
                        {'name': 'کراتین و احیا', 'durationMinutes': 120, 'price': 3800000}
                      ],
                      'specialists': [
                        {'name': 'مریم شمس‌آرا', 'role': 'فیشیالیست', 'avatar': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=100&q=80'}
                      ],
                      'availableSlots': []
                    },
                    isWishlisted: false,
                    onToggleWishlist: () {},
                    onBookNow: (service, specialist, date, time) {},
                    onViewPortfolio: (specialist) {},
                  );
                },
                childCount: 3,
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: _buildFeaturesBanner(),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 100)),
        ],
      ),
    );
  }


  Widget _buildHeroBanner() {
    return Container(
      decoration: BoxDecoration(
        color: BoyaColors.primary,
        borderRadius: BorderRadius.circular(24),
        image: DecorationImage(
          image: const NetworkImage('https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80'),
          fit: BoxFit.cover,
          colorFilter: ColorFilter.mode(BoyaColors.primary.withOpacity(0.85), BlendMode.srcOver),
        ),
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: BoyaColors.surface.withOpacity(0.15),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: BoyaColors.accentSilk.withOpacity(0.3)),
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.auto_awesome, size: 14, color: BoyaColors.accentSilk),
                SizedBox(width: 6),
                Text('پلتفرم جامع رزرواسیون زیبایی', style: TextStyle(color: BoyaColors.accentSilk, fontSize: 11, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'رزرو آنلاین معتبرترین سالن‌ها\nو اعزام متخصص در محل',
            style: TextStyle(fontFamily: BoyaTypography.fontFamily, fontSize: 22, fontWeight: FontWeight.w900, color: BoyaColors.surface, height: 1.4),
          ),
          const SizedBox(height: 12),
          const Text(
            'دسترسی آسان به برترین سالن‌ها و متخصصین تایید شده در تهران. بدون کارمزد، با تایید آنی.',
            style: TextStyle(color: BoyaColors.background, fontSize: 12, height: 1.5),
          ),
          const SizedBox(height: 24),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              ElevatedButton(
                onPressed: () {},
                style: ElevatedButton.styleFrom(
                  backgroundColor: BoyaColors.accentRose,
                  foregroundColor: BoyaColors.surface,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                  elevation: 0,
                ),
                child: const Text('جستجو و رزرو نوبت', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ),
              OutlinedButton.icon(
                onPressed: () => setState(() => _filterMobileOnly = !_filterMobileOnly),
                icon: Icon(Icons.directions_car, size: 16, color: _filterMobileOnly ? BoyaColors.primary : BoyaColors.surface),
                label: Text(
                  _filterMobileOnly ? 'فیلتر سیار فعال است' : 'خدمات در منزل',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: _filterMobileOnly ? BoyaColors.primary : BoyaColors.surface),
                ),
                style: OutlinedButton.styleFrom(
                  backgroundColor: _filterMobileOnly ? BoyaColors.accentSilk : Colors.transparent,
                  side: BorderSide(color: _filterMobileOnly ? BoyaColors.accentSilk : BoyaColors.surface.withOpacity(0.3)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return TextField(
      controller: _searchController,
      decoration: InputDecoration(
        hintText: 'جستجوی سریع: کراتین مو، فیشیال، نام سالن...',
        hintStyle: const TextStyle(color: BoyaColors.textSecondary, fontSize: 12),
        prefixIcon: const Icon(Icons.search, color: BoyaColors.accentRose),
        filled: true,
        fillColor: BoyaColors.surface,
        contentPadding: const EdgeInsets.symmetric(vertical: 16),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: BoyaColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: BoyaColors.accentRose, width: 1.5),
        ),
      ),
    );
  }

  Widget _buildServiceLines() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('لاین‌های تخصصی خدمات زیبایی', style: BoyaTypography.heading1),
        const SizedBox(height: 16),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 4,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 0.85,
          ),
          itemCount: _serviceLines.length,
          itemBuilder: (context, index) {
            final line = _serviceLines[index];
            return GestureDetector(
              onTap: () {},
              child: Container(
                decoration: BoxDecoration(
                  color: BoyaColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: BoyaColors.border),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(line['emoji']!, style: const TextStyle(fontSize: 24)),
                    const SizedBox(height: 8),
                    Text(
                      line['name']!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: BoyaColors.textMain),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildFeaturesBanner() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: BoyaColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: BoyaColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildFeatureItem(Icons.verified_user, BoyaColors.success, 'تاییدیه پیامکی', 'دریافت فوری کد رهگیری'),
          const SizedBox(width: 8),
          _buildFeatureItem(Icons.calendar_month, BoyaColors.accentRose, 'بدون تداخل', 'الگوریتم هوشمند زمانبندی'),
          const SizedBox(width: 8),
          _buildFeatureItem(Icons.directions_car, BoyaColors.warning, 'خدمات سیار', 'اعزام متخصص به منزل'),
        ],
      ),
    );
  }

  Widget _buildFeatureItem(IconData icon, Color color, String title, String subtitle) {
    return Expanded(
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: BoyaColors.background,
              shape: BoxShape.circle,
              border: Border.all(color: BoyaColors.border),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(height: 8),
          Text(title, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: BoyaColors.textMain), textAlign: TextAlign.center),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(fontSize: 9, color: BoyaColors.textSecondary), textAlign: TextAlign.center),
        ],
      ),
    );
  }
}