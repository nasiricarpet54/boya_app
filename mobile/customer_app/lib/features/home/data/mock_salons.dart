import '../domain/salon_summary.dart';
import '../domain/service_category.dart';

/// Hardcoded feed data for this iteration. No backend call is made.
///
/// Images are remote placeholders; `SalonCard` falls back to an icon when a
/// placeholder cannot be loaded (offline devices, blocked host).
const mockNearbySalons = <SalonSummary>[
  SalonSummary(
    id: 'salon-1',
    name: 'سالن زیبایی گلستان',
    specialty: 'رنگ مو و کراتین',
    imageUrl: 'https://picsum.photos/seed/boya-salon-1/200/200',
    rating: 4.8,
    reviewCount: 123,
    distanceKm: 2.3,
    discountPercent: 20,
    tags: ['رنگ مو', 'کراتین', 'کوتاهی'],
    minPrice: 140000,
  ),
  SalonSummary(
    id: 'salon-2',
    name: 'استودیو زیبایی رز',
    specialty: 'گریم و میکاپ عروس',
    imageUrl: 'https://picsum.photos/seed/boya-salon-2/200/200',
    rating: 4.9,
    reviewCount: 210,
    distanceKm: 4.5,
    discountPercent: null,
    tags: ['میکاپ', 'شنیون', 'آرایش عروس'],
    minPrice: 250000,
  ),
  SalonSummary(
    id: 'salon-3',
    name: 'سالن نازلی',
    specialty: 'ناخن و پدیکور',
    imageUrl: 'https://picsum.photos/seed/boya-salon-3/200/200',
    rating: 4.7,
    reviewCount: 64,
    distanceKm: 1.2,
    discountPercent: 15,
    tags: ['ناخن', 'پدیکور', 'کوتاهی'],
    minPrice: 95000,
  ),
  SalonSummary(
    id: 'salon-4',
    name: 'پاتوق زیبایی بهار',
    specialty: 'کوتاهی و رنگ مو',
    imageUrl: 'https://picsum.photos/seed/boya-salon-4/200/200',
    rating: 4.6,
    reviewCount: 87,
    distanceKm: 3.1,
    discountPercent: null,
    tags: ['کوتاهی', 'رنگ مو', 'براشینگ'],
    minPrice: 120000,
  ),
  SalonSummary(
    id: 'salon-5',
    name: 'سالن مهسا',
    specialty: 'پاکسازی پوست و اپیلاسیون',
    imageUrl: 'https://picsum.photos/seed/boya-salon-5/200/200',
    rating: 4.5,
    reviewCount: 152,
    distanceKm: 5.8,
    discountPercent: null,
    tags: ['پاکسازی پوست', 'اپیلاسیون', 'لیزر'],
    minPrice: 180000,
  ),
];

/// Category grid shown under the search bar. `all` is a navigation affordance,
/// not a real service.
const mockHomeCategories = <ServiceCategory>[
  ServiceCategory(id: 'hair-color', label: 'رنگ و لایت', emoji: '🎨'),
  ServiceCategory(id: 'makeup', label: 'گریم و میکاپ', emoji: '💄'),
  ServiceCategory(id: 'updo', label: 'شنیون', emoji: '👰'),
  ServiceCategory(id: 'coupe', label: 'کوپ', emoji: '✂️'),
  ServiceCategory(id: 'waxing', label: 'اپیلاسیون', emoji: '🪒'),
  ServiceCategory(id: 'pedicure', label: 'پدیکور', emoji: '🦶'),
  ServiceCategory(id: 'keratin', label: 'کراتین', emoji: '💇‍♀️'),
  ServiceCategory(id: 'nails', label: 'ناخن', emoji: '💅'),
  ServiceCategory(id: 'skincare', label: 'پاکسازی پوست', emoji: '✨'),
  ServiceCategory(id: 'bridal', label: 'آرایش عروس', emoji: '👑'),
  ServiceCategory(id: 'laser', label: 'لیزر', emoji: '🔆'),
  ServiceCategory(id: 'permanent-makeup', label: 'آرایش دائم', emoji: '🖊️'),
  ServiceCategory(id: 'all', label: 'مشاهده همه', emoji: '⋯'),
];
