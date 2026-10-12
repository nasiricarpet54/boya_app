import { MigrationInterface, QueryRunner } from 'typeorm';

interface CitySeed {
  readonly nameFa: string;
  readonly nameEn: string;
  readonly isCapital?: boolean;
  readonly displayOrder: number;
}

interface ProvinceSeed {
  readonly code: string;
  readonly nameFa: string;
  readonly nameEn: string;
  readonly displayOrder: number;
  readonly cities: readonly CitySeed[];
}

interface City extends CitySeed {
  readonly code: string;
}

interface Province extends Omit<ProvinceSeed, 'cities'> {
  readonly cities: readonly City[];
}

/**
 * 31 provinces of Iran and their principal cities, ordered the way the Home /
 * profile screens list them. Capital cities carry `isCapital: true`; every city
 * keeps a stable `displayOrder` inside its province.
 */
const PROVINCES: readonly ProvinceSeed[] = [
  {
    code: 'THR', nameFa: 'تهران', nameEn: 'Tehran', displayOrder: 1,
    cities: [
      { nameFa: 'تهران', nameEn: 'Tehran', isCapital: true, displayOrder: 1 },
      { nameFa: 'اسلامشهر', nameEn: 'Eslamshahr', displayOrder: 2 },
      { nameFa: 'شهریار', nameEn: 'Shahriar', displayOrder: 3 },
      { nameFa: 'ملارد', nameEn: 'Malard', displayOrder: 4 },
      { nameFa: 'قدس', nameEn: 'Qods', displayOrder: 5 },
      { nameFa: 'رباط‌کریم', nameEn: 'Robatkarim', displayOrder: 6 },
      { nameFa: 'ورامین', nameEn: 'Varamin', displayOrder: 7 },
      { nameFa: 'پاکدشت', nameEn: 'Pakdasht', displayOrder: 8 },
      { nameFa: 'بهارستان', nameEn: 'Baharestan', displayOrder: 9 },
      { nameFa: 'پردیس', nameEn: 'Pardis', displayOrder: 10 },
      { nameFa: 'دماوند', nameEn: 'Damavand', displayOrder: 11 },
      { nameFa: 'فیروزکوه', nameEn: 'Firuzkuh', displayOrder: 12 },
      { nameFa: 'لواسان', nameEn: 'Lavasan', displayOrder: 13 },
      { nameFa: 'پیشوا', nameEn: 'Pishva', displayOrder: 14 },
      { nameFa: 'ری', nameEn: 'Rey', displayOrder: 15 },
      { nameFa: 'کهریزک', nameEn: 'Kahrizak', displayOrder: 16 },
      { nameFa: 'نصیرشهر', nameEn: 'Nasirshahr', displayOrder: 17 },
      { nameFa: 'صالحیه', nameEn: 'Salehieh', displayOrder: 18 },
      { nameFa: 'اندیشه', nameEn: 'Andisheh', displayOrder: 19 },
      { nameFa: 'بومهن', nameEn: 'Bumehen', displayOrder: 20 },
      { nameFa: 'رودهن', nameEn: 'Rudehen', displayOrder: 21 },
      { nameFa: 'قرچک', nameEn: 'Qarchak', displayOrder: 22 },
    ],
  },
  {
    code: 'ABZ-E', nameFa: 'آذربایجان شرقی', nameEn: 'East Azerbaijan', displayOrder: 2,
    cities: [
      { nameFa: 'تبریز', nameEn: 'Tabriz', isCapital: true, displayOrder: 1 },
      { nameFa: 'مراغه', nameEn: 'Maragheh', displayOrder: 2 },
      { nameFa: 'میانه', nameEn: 'Mianeh', displayOrder: 3 },
      { nameFa: 'اهر', nameEn: 'Ahar', displayOrder: 4 },
      { nameFa: 'مرند', nameEn: 'Marand', displayOrder: 5 },
      { nameFa: 'بناب', nameEn: 'Bonab', displayOrder: 6 },
      { nameFa: 'شبستر', nameEn: 'Shabestar', displayOrder: 7 },
      { nameFa: 'جلفا', nameEn: 'Jolfa', displayOrder: 8 },
      { nameFa: 'سراب', nameEn: 'Sarab', displayOrder: 9 },
      { nameFa: 'ورزقان', nameEn: 'Varzaqan', displayOrder: 10 },
      { nameFa: 'هشترود', nameEn: 'Hashtrud', displayOrder: 11 },
      { nameFa: 'اسکو', nameEn: 'Osku', displayOrder: 12 },
      { nameFa: 'بستان‌آباد', nameEn: 'Bostanabad', displayOrder: 13 },
      { nameFa: 'تسوج', nameEn: 'Tasuj', displayOrder: 14 },
      { nameFa: 'ملکان', nameEn: 'Malekan', displayOrder: 15 },
      { nameFa: 'صوفیان', nameEn: 'Sofian', displayOrder: 16 },
    ],
  },
  {
    code: 'ABZ-W', nameFa: 'آذربایجان غربی', nameEn: 'West Azerbaijan', displayOrder: 3,
    cities: [
      { nameFa: 'ارومیه', nameEn: 'Urmia', isCapital: true, displayOrder: 1 },
      { nameFa: 'خوی', nameEn: 'Khoy', displayOrder: 2 },
      { nameFa: 'سلماس', nameEn: 'Salmas', displayOrder: 3 },
      { nameFa: 'ماکو', nameEn: 'Maku', displayOrder: 4 },
      { nameFa: 'مهاباد', nameEn: 'Mahabad', displayOrder: 5 },
      { nameFa: 'بوکان', nameEn: 'Bukan', displayOrder: 6 },
      { nameFa: 'سردشت', nameEn: 'Sardasht', displayOrder: 7 },
      { nameFa: 'نقده', nameEn: 'Naqadeh', displayOrder: 8 },
      { nameFa: 'اشنویه', nameEn: 'Oshnaviyeh', displayOrder: 9 },
      { nameFa: 'پیرانشهر', nameEn: 'Piranshahr', displayOrder: 10 },
      { nameFa: 'تکاب', nameEn: 'Takab', displayOrder: 11 },
      { nameFa: 'شاهین‌دژ', nameEn: 'Shahindezh', displayOrder: 12 },
      { nameFa: 'میاندوآب', nameEn: 'Miyandoab', displayOrder: 13 },
      { nameFa: 'شوط', nameEn: 'Showt', displayOrder: 14 },
      { nameFa: 'پلدشت', nameEn: 'Poldasht', displayOrder: 15 },
    ],
  },
  {
    code: 'ARD', nameFa: 'اردبیل', nameEn: 'Ardabil', displayOrder: 4,
    cities: [
      { nameFa: 'اردبیل', nameEn: 'Ardabil', isCapital: true, displayOrder: 1 },
      { nameFa: 'پارس‌آباد', nameEn: 'Parsabad', displayOrder: 2 },
      { nameFa: 'مشکین‌شهر', nameEn: 'Meshkinshahr', displayOrder: 3 },
      { nameFa: 'خلخال', nameEn: 'Khalkhal', displayOrder: 4 },
      { nameFa: 'گرمی', nameEn: 'Germi', displayOrder: 5 },
      { nameFa: 'بیله‌سوار', nameEn: 'Bilasavar', displayOrder: 6 },
      { nameFa: 'سرعین', nameEn: 'Sarein', displayOrder: 7 },
      { nameFa: 'نمین', nameEn: 'Namin', displayOrder: 8 },
      { nameFa: 'کوثر', nameEn: 'Kowsar', displayOrder: 9 },
      { nameFa: 'اصلاندوز', nameEn: 'Aslanduz', displayOrder: 10 },
    ],
  },
  {
    code: 'ISF', nameFa: 'اصفهان', nameEn: 'Isfahan', displayOrder: 5,
    cities: [
      { nameFa: 'اصفهان', nameEn: 'Isfahan', isCapital: true, displayOrder: 1 },
      { nameFa: 'کاشان', nameEn: 'Kashan', displayOrder: 2 },
      { nameFa: 'نجف‌آباد', nameEn: 'Najafabad', displayOrder: 3 },
      { nameFa: 'خمینی‌شهر', nameEn: 'Khomeinishahr', displayOrder: 4 },
      { nameFa: 'فولادشهر', nameEn: 'Fuladshahr', displayOrder: 5 },
      { nameFa: 'زرین‌شهر', nameEn: 'Zarrinshahr', displayOrder: 6 },
      { nameFa: 'شاهین‌شهر', nameEn: 'Shahinshahr', displayOrder: 7 },
      { nameFa: 'مبارکه', nameEn: 'Mobarakeh', displayOrder: 8 },
      { nameFa: 'سمیرم', nameEn: 'Semirom', displayOrder: 9 },
      { nameFa: 'فریدن', nameEn: 'Faridan', displayOrder: 10 },
      { nameFa: 'فریدون‌شهر', nameEn: 'Fereydunshahr', displayOrder: 11 },
      { nameFa: 'داران', nameEn: 'Daran', displayOrder: 12 },
      { nameFa: 'چادگان', nameEn: 'Chadegan', displayOrder: 13 },
      { nameFa: 'گلپایگان', nameEn: 'Golpayegan', displayOrder: 14 },
      { nameFa: 'خوانسار', nameEn: 'Khansar', displayOrder: 15 },
      { nameFa: 'دهاقان', nameEn: 'Dehaqan', displayOrder: 16 },
      { nameFa: 'نطنز', nameEn: 'Natanz', displayOrder: 17 },
      { nameFa: 'اردستان', nameEn: 'Ardestan', displayOrder: 18 },
      { nameFa: 'نایین', nameEn: 'Nain', displayOrder: 19 },
      { nameFa: 'کوهپایه', nameEn: 'Kuhpayeh', displayOrder: 20 },
      { nameFa: 'ورزنه', nameEn: 'Varzaneh', displayOrder: 21 },
    ],
  },
  {
    code: 'ALB', nameFa: 'البرز', nameEn: 'Alborz', displayOrder: 6,
    cities: [
      { nameFa: 'کرج', nameEn: 'Karaj', isCapital: true, displayOrder: 1 },
      { nameFa: 'نظرآباد', nameEn: 'Nazarabad', displayOrder: 2 },
      { nameFa: 'اشتهارد', nameEn: 'Eshtehard', displayOrder: 3 },
      { nameFa: 'طالقان', nameEn: 'Taleqan', displayOrder: 4 },
      { nameFa: 'ساوجبلاغ', nameEn: 'Savojbolagh', displayOrder: 5 },
      { nameFa: 'هشتگرد', nameEn: 'Hashtgerd', displayOrder: 6 },
      { nameFa: 'ماهدشت', nameEn: 'Mahdasht', displayOrder: 7 },
    ],
  },
  {
    code: 'ILA', nameFa: 'ایلام', nameEn: 'Ilam', displayOrder: 7,
    cities: [
      { nameFa: 'ایلام', nameEn: 'Ilam', isCapital: true, displayOrder: 1 },
      { nameFa: 'دهلران', nameEn: 'Dehloran', displayOrder: 2 },
      { nameFa: 'آبدانان', nameEn: 'Abdanan', displayOrder: 3 },
      { nameFa: 'دره‌شهر', nameEn: 'Darreshahr', displayOrder: 4 },
      { nameFa: 'مهران', nameEn: 'Mehran', displayOrder: 5 },
      { nameFa: 'بدره', nameEn: 'Badreh', displayOrder: 6 },
      { nameFa: 'صالح‌آباد', nameEn: 'Salehabad', displayOrder: 7 },
      { nameFa: 'ایوان', nameEn: 'Ivan', displayOrder: 8 },
    ],
  },
  {
    code: 'BUS', nameFa: 'بوشهر', nameEn: 'Bushehr', displayOrder: 8,
    cities: [
      { nameFa: 'بوشهر', nameEn: 'Bushehr', isCapital: true, displayOrder: 1 },
      { nameFa: 'برازجان', nameEn: 'Borazjan', displayOrder: 2 },
      { nameFa: 'گناوه', nameEn: 'Genaveh', displayOrder: 3 },
      { nameFa: 'دیر', nameEn: 'Deyr', displayOrder: 4 },
      { nameFa: 'کنگان', nameEn: 'Kangan', displayOrder: 5 },
      { nameFa: 'عسلویه', nameEn: 'Asaluyeh', displayOrder: 6 },
      { nameFa: 'جام', nameEn: 'Jam', displayOrder: 7 },
      { nameFa: 'خارک', nameEn: 'Kharg', displayOrder: 8 },
      { nameFa: 'دیلم', nameEn: 'Deylam', displayOrder: 9 },
      { nameFa: 'اهرم', nameEn: 'Ahram', displayOrder: 10 },
      { nameFa: 'چغادک', nameEn: 'Choghadak', displayOrder: 11 },
    ],
  },
  {
    code: 'CHB', nameFa: 'چهارمحال و بختیاری', nameEn: 'Chaharmahal and Bakhtiari', displayOrder: 9,
    cities: [
      { nameFa: 'شهرکرد', nameEn: 'Shahrekord', isCapital: true, displayOrder: 1 },
      { nameFa: 'فارسان', nameEn: 'Farsan', displayOrder: 2 },
      { nameFa: 'بروجن', nameEn: 'Borujen', displayOrder: 3 },
      { nameFa: 'لردگان', nameEn: 'Lordegan', displayOrder: 4 },
      { nameFa: 'سامان', nameEn: 'Saman', displayOrder: 5 },
      { nameFa: 'بن', nameEn: 'Ben', displayOrder: 6 },
      { nameFa: 'جونقان', nameEn: 'Junqan', displayOrder: 7 },
      { nameFa: 'بلداجی', nameEn: 'Boldaji', displayOrder: 8 },
      { nameFa: 'گندمان', nameEn: 'Gandoman', displayOrder: 9 },
      { nameFa: 'فرادنبه', nameEn: 'Faradonbeh', displayOrder: 10 },
      { nameFa: 'چلگرد', nameEn: 'Chelgerd', displayOrder: 11 },
      { nameFa: 'کوهرنگ', nameEn: 'Koohrang', displayOrder: 12 },
      { nameFa: 'اردل', nameEn: 'Ardal', displayOrder: 13 },
    ],
  },
  {
    code: 'KHR-J', nameFa: 'خراسان جنوبی', nameEn: 'South Khorasan', displayOrder: 10,
    cities: [
      { nameFa: 'بیرجند', nameEn: 'Birjand', isCapital: true, displayOrder: 1 },
      { nameFa: 'قاین', nameEn: 'Qaen', displayOrder: 2 },
      { nameFa: 'فردوس', nameEn: 'Ferdows', displayOrder: 3 },
      { nameFa: 'نهبندان', nameEn: 'Nehbandan', displayOrder: 4 },
      { nameFa: 'سرایان', nameEn: 'Sarayan', displayOrder: 5 },
      { nameFa: 'درمیان', nameEn: 'Darmian', displayOrder: 6 },
      { nameFa: 'خوسف', nameEn: 'Khosf', displayOrder: 7 },
      { nameFa: 'طبس', nameEn: 'Tabas', displayOrder: 8 },
      { nameFa: 'بشرویه', nameEn: 'Boshruyeh', displayOrder: 9 },
      { nameFa: 'اسدیه', nameEn: 'Asadiyeh', displayOrder: 10 },
    ],
  },
  {
    code: 'KHR-R', nameFa: 'خراسان رضوی', nameEn: 'Razavi Khorasan', displayOrder: 11,
    cities: [
      { nameFa: 'مشهد', nameEn: 'Mashhad', isCapital: true, displayOrder: 1 },
      { nameFa: 'نیشابور', nameEn: 'Nishapur', displayOrder: 2 },
      { nameFa: 'سبزوار', nameEn: 'Sabzevar', displayOrder: 3 },
      { nameFa: 'تربت حیدریه', nameEn: 'Torbat Heydarieh', displayOrder: 4 },
      { nameFa: 'قوچان', nameEn: 'Quchan', displayOrder: 5 },
      { nameFa: 'کاشمر', nameEn: 'Kashmar', displayOrder: 6 },
      { nameFa: 'تربت جام', nameEn: 'Torbat Jam', displayOrder: 7 },
      { nameFa: 'سرخس', nameEn: 'Sarakhs', displayOrder: 8 },
      { nameFa: 'فریمان', nameEn: 'Fariman', displayOrder: 9 },
      { nameFa: 'خواف', nameEn: 'Khaf', displayOrder: 10 },
      { nameFa: 'ترکبه', nameEn: 'Torqabeh', displayOrder: 11 },
      { nameFa: 'چناران', nameEn: 'Chenaran', displayOrder: 12 },
      { nameFa: 'گلبهار', nameEn: 'Golbahar', displayOrder: 13 },
      { nameFa: 'کلات', nameEn: 'Kalat', displayOrder: 14 },
      { nameFa: 'باخرز', nameEn: 'Bakharz', displayOrder: 15 },
      { nameFa: 'تایباد', nameEn: 'Taybad', displayOrder: 16 },
      { nameFa: 'صالح‌آباد', nameEn: 'Salehabad', displayOrder: 17 },
      { nameFa: 'شاندیز', nameEn: 'Shandiz', displayOrder: 18 },
      { nameFa: 'رشتخوار', nameEn: 'Rashtkhar', displayOrder: 19 },
      { nameFa: 'زاوه', nameEn: 'Zaveh', displayOrder: 20 },
    ],
  },
  {
    code: 'KHR-S', nameFa: 'خراسان شمالی', nameEn: 'North Khorasan', displayOrder: 12,
    cities: [
      { nameFa: 'بجنورد', nameEn: 'Bojnord', isCapital: true, displayOrder: 1 },
      { nameFa: 'اسفراین', nameEn: 'Esfarayen', displayOrder: 2 },
      { nameFa: 'شیروان', nameEn: 'Shirvan', displayOrder: 3 },
      { nameFa: 'آشخانه', nameEn: 'Ashkhaneh', displayOrder: 4 },
      { nameFa: 'فاروج', nameEn: 'Faruj', displayOrder: 5 },
      { nameFa: 'مانه', nameEn: 'Maneh', displayOrder: 6 },
      { nameFa: 'سملقان', nameEn: 'Samalqan', displayOrder: 7 },
      { nameFa: 'جاجرم', nameEn: 'Jajarm', displayOrder: 8 },
    ],
  },
  {
    code: 'KHU', nameFa: 'خوزستان', nameEn: 'Khuzestan', displayOrder: 13,
    cities: [
      { nameFa: 'اهواز', nameEn: 'Ahvaz', isCapital: true, displayOrder: 1 },
      { nameFa: 'آبادان', nameEn: 'Abadan', displayOrder: 2 },
      { nameFa: 'خرمشهر', nameEn: 'Khorramshahr', displayOrder: 3 },
      { nameFa: 'دزفول', nameEn: 'Dezful', displayOrder: 4 },
      { nameFa: 'اندیمشک', nameEn: 'Andimeshk', displayOrder: 5 },
      { nameFa: 'بهبهان', nameEn: 'Behbahan', displayOrder: 6 },
      { nameFa: 'ماهشهر', nameEn: 'Mahshahr', displayOrder: 7 },
      { nameFa: 'رامهرمز', nameEn: 'Ramhormoz', displayOrder: 8 },
      { nameFa: 'شوشتر', nameEn: 'Shushtar', displayOrder: 9 },
      { nameFa: 'شوش', nameEn: 'Shush', displayOrder: 10 },
      { nameFa: 'مسجدسلیمان', nameEn: 'Masjed Soleyman', displayOrder: 11 },
      { nameFa: 'هندیجان', nameEn: 'Hendijan', displayOrder: 12 },
      { nameFa: 'لالی', nameEn: 'Lali', displayOrder: 13 },
      { nameFa: 'هویزه', nameEn: 'Hoveyzeh', displayOrder: 14 },
      { nameFa: 'سوسنگرد', nameEn: 'Susangerd', displayOrder: 15 },
    ],
  },
  {
    code: 'ZAN', nameFa: 'زنجان', nameEn: 'Zanjan', displayOrder: 14,
    cities: [
      { nameFa: 'زنجان', nameEn: 'Zanjan', isCapital: true, displayOrder: 1 },
      { nameFa: 'ابهر', nameEn: 'Abhar', displayOrder: 2 },
      { nameFa: 'خرمدره', nameEn: 'Khorramdarreh', displayOrder: 3 },
      { nameFa: 'سلطانیه', nameEn: 'Soltaniyeh', displayOrder: 4 },
      { nameFa: 'ماه‌نشان', nameEn: 'Mahneshan', displayOrder: 5 },
      { nameFa: 'طارم', nameEn: 'Tarom', displayOrder: 6 },
      { nameFa: 'صائین‌قلعه', nameEn: 'Sainqaleh', displayOrder: 7 },
    ],
  },
  {
    code: 'SEM', nameFa: 'سمنان', nameEn: 'Semnan', displayOrder: 15,
    cities: [
      { nameFa: 'سمنان', nameEn: 'Semnan', isCapital: true, displayOrder: 1 },
      { nameFa: 'شاهرود', nameEn: 'Shahrud', displayOrder: 2 },
      { nameFa: 'دامغان', nameEn: 'Damghan', displayOrder: 3 },
      { nameFa: 'مهدی‌شهر', nameEn: 'Mehdishahr', displayOrder: 4 },
      { nameFa: 'سرخه', nameEn: 'Sorkheh', displayOrder: 5 },
      { nameFa: 'ایوانکی', nameEn: 'Eyvanki', displayOrder: 6 },
      { nameFa: 'بسطام', nameEn: 'Bastam', displayOrder: 7 },
    ],
  },
  {
    code: 'SBA', nameFa: 'سیستان و بلوچستان', nameEn: 'Sistan and Baluchestan', displayOrder: 16,
    cities: [
      { nameFa: 'زاهدان', nameEn: 'Zahedan', isCapital: true, displayOrder: 1 },
      { nameFa: 'زابل', nameEn: 'Zabol', displayOrder: 2 },
      { nameFa: 'چابهار', nameEn: 'Chabahar', displayOrder: 3 },
      { nameFa: 'ایرانشهر', nameEn: 'Iranshahr', displayOrder: 4 },
      { nameFa: 'خاش', nameEn: 'Khash', displayOrder: 5 },
      { nameFa: 'میرجاوه', nameEn: 'Mirjaveh', displayOrder: 6 },
      { nameFa: 'نیکشهر', nameEn: 'Nikshahr', displayOrder: 7 },
      { nameFa: 'کنارک', nameEn: 'Konarak', displayOrder: 8 },
      { nameFa: 'سراوان', nameEn: 'Saravan', displayOrder: 9 },
      { nameFa: 'راسک', nameEn: 'Rask', displayOrder: 10 },
      { nameFa: 'بمپور', nameEn: 'Bampur', displayOrder: 11 },
      { nameFa: 'فنوج', nameEn: 'Fannuj', displayOrder: 12 },
      { nameFa: 'دلگان', nameEn: 'Delgan', displayOrder: 13 },
      { nameFa: 'مهرستان', nameEn: 'Mehrestan', displayOrder: 14 },
      { nameFa: 'زهک', nameEn: 'Zehak', displayOrder: 15 },
      { nameFa: 'هیرمند', nameEn: 'Hirmand', displayOrder: 16 },
    ],
  },
  {
    code: 'FAR', nameFa: 'فارس', nameEn: 'Fars', displayOrder: 17,
    cities: [
      { nameFa: 'شیراز', nameEn: 'Shiraz', isCapital: true, displayOrder: 1 },
      { nameFa: 'آباده', nameEn: 'Abadeh', displayOrder: 2 },
      { nameFa: 'مرودشت', nameEn: 'Marvdasht', displayOrder: 3 },
      { nameFa: 'جهرم', nameEn: 'Jahrom', displayOrder: 4 },
      { nameFa: 'فیروزآباد', nameEn: 'Firuzabad', displayOrder: 5 },
      { nameFa: 'داراب', nameEn: 'Darab', displayOrder: 6 },
      { nameFa: 'لار', nameEn: 'Lar', displayOrder: 7 },
      { nameFa: 'کازرون', nameEn: 'Kazerun', displayOrder: 8 },
      { nameFa: 'فسا', nameEn: 'Fasa', displayOrder: 9 },
      { nameFa: 'استهبان', nameEn: 'Estahban', displayOrder: 10 },
      { nameFa: 'نی‌ریز', nameEn: 'Neyriz', displayOrder: 11 },
      { nameFa: 'نورآباد', nameEn: 'Nurabad', displayOrder: 12 },
      { nameFa: 'خرم‌بید', nameEn: 'Khorrambid', displayOrder: 13 },
      { nameFa: 'سپیدان', nameEn: 'Sepidan', displayOrder: 14 },
      { nameFa: 'بیضا', nameEn: 'Beyza', displayOrder: 15 },
      { nameFa: 'زرقان', nameEn: 'Zarqan', displayOrder: 16 },
      { nameFa: 'قیر', nameEn: 'Qir', displayOrder: 17 },
      { nameFa: 'فراشبند', nameEn: 'Farashband', displayOrder: 18 },
      { nameFa: 'اوز', nameEn: 'Evaz', displayOrder: 19 },
      { nameFa: 'مهر', nameEn: 'Mohr', displayOrder: 20 },
      { nameFa: 'لامرد', nameEn: 'Lamerd', displayOrder: 21 },
    ],
  },
  {
    code: 'QAZ', nameFa: 'قزوین', nameEn: 'Qazvin', displayOrder: 18,
    cities: [
      { nameFa: 'قزوین', nameEn: 'Qazvin', isCapital: true, displayOrder: 1 },
      { nameFa: 'تاکستان', nameEn: 'Takestan', displayOrder: 2 },
      { nameFa: 'آبیک', nameEn: 'Abik', displayOrder: 3 },
      { nameFa: 'بوئین‌زهرا', nameEn: 'Buin Zahra', displayOrder: 4 },
      { nameFa: 'شال', nameEn: 'Shal', displayOrder: 5 },
    ],
  },
  {
    code: 'QOM', nameFa: 'قم', nameEn: 'Qom', displayOrder: 19,
    cities: [
      { nameFa: 'قم', nameEn: 'Qom', isCapital: true, displayOrder: 1 },
      { nameFa: 'کهک', nameEn: 'Kahak', displayOrder: 2 },
      { nameFa: 'جعفریه', nameEn: 'Jafarieh', displayOrder: 3 },
      { nameFa: 'قنوات', nameEn: 'Qanavat', displayOrder: 4 },
      { nameFa: 'سلفچگان', nameEn: 'Salafchegan', displayOrder: 5 },
      { nameFa: 'دستجرد', nameEn: 'Dastjerd', displayOrder: 6 },
    ],
  },
  {
    code: 'KRD', nameFa: 'کردستان', nameEn: 'Kurdistan', displayOrder: 20,
    cities: [
      { nameFa: 'سنندج', nameEn: 'Sanandaj', isCapital: true, displayOrder: 1 },
      { nameFa: 'مریوان', nameEn: 'Marivan', displayOrder: 2 },
      { nameFa: 'سقز', nameEn: 'Saqqez', displayOrder: 3 },
      { nameFa: 'بانه', nameEn: 'Baneh', displayOrder: 4 },
      { nameFa: 'قروه', nameEn: 'Qorveh', displayOrder: 5 },
      { nameFa: 'بیجار', nameEn: 'Bijar', displayOrder: 6 },
      { nameFa: 'دیواندره', nameEn: 'Divandarreh', displayOrder: 7 },
      { nameFa: 'کامیاران', nameEn: 'Kamyaran', displayOrder: 8 },
      { nameFa: 'سروآباد', nameEn: 'Sarvabad', displayOrder: 9 },
      { nameFa: 'دهگلان', nameEn: 'Dehgolan', displayOrder: 10 },
    ],
  },
  {
    code: 'KER', nameFa: 'کرمان', nameEn: 'Kerman', displayOrder: 21,
    cities: [
      { nameFa: 'کرمان', nameEn: 'Kerman', isCapital: true, displayOrder: 1 },
      { nameFa: 'سیرجان', nameEn: 'Sirjan', displayOrder: 2 },
      { nameFa: 'بم', nameEn: 'Bam', displayOrder: 3 },
      { nameFa: 'جیرفت', nameEn: 'Jiroft', displayOrder: 4 },
      { nameFa: 'رفسنجان', nameEn: 'Rafsanjan', displayOrder: 5 },
      { nameFa: 'زرند', nameEn: 'Zarand', displayOrder: 6 },
      { nameFa: 'بافت', nameEn: 'Baft', displayOrder: 7 },
      { nameFa: 'شهر بابک', nameEn: 'Shahr-e Babak', displayOrder: 8 },
      { nameFa: 'عنبرآباد', nameEn: 'Anbarabad', displayOrder: 9 },
      { nameFa: 'کهنوج', nameEn: 'Kahnuj', displayOrder: 10 },
      { nameFa: 'منوجان', nameEn: 'Manujan', displayOrder: 11 },
      { nameFa: 'فاریاب', nameEn: 'Faryab', displayOrder: 12 },
      { nameFa: 'رابر', nameEn: 'Rabor', displayOrder: 13 },
      { nameFa: 'بردسیر', nameEn: 'Bardsir', displayOrder: 14 },
      { nameFa: 'ماهان', nameEn: 'Mahan', displayOrder: 15 },
      { nameFa: 'جوپار', nameEn: 'Jowpar', displayOrder: 16 },
      { nameFa: 'چترود', nameEn: 'Chatrud', displayOrder: 17 },
    ],
  },
  {
    code: 'KSH', nameFa: 'کرمانشاه', nameEn: 'Kermanshah', displayOrder: 22,
    cities: [
      { nameFa: 'کرمانشاه', nameEn: 'Kermanshah', isCapital: true, displayOrder: 1 },
      { nameFa: 'اسلام‌آباد غرب', nameEn: 'Eslamabad-e Gharb', displayOrder: 2 },
      { nameFa: 'هرسین', nameEn: 'Harsin', displayOrder: 3 },
      { nameFa: 'صحنه', nameEn: 'Sahneh', displayOrder: 4 },
      { nameFa: 'کنگاور', nameEn: 'Kangavar', displayOrder: 5 },
      { nameFa: 'سنقر', nameEn: 'Sonqor', displayOrder: 6 },
      { nameFa: 'گیلانغرب', nameEn: 'Gilan-e Gharb', displayOrder: 7 },
      { nameFa: 'قصر شیرین', nameEn: 'Qasr-e Shirin', displayOrder: 8 },
      { nameFa: 'سرپل ذهاب', nameEn: 'Sarpol-e Zahab', displayOrder: 9 },
      { nameFa: 'روانسر', nameEn: 'Ravansar', displayOrder: 10 },
      { nameFa: 'جوانرود', nameEn: 'Javanrud', displayOrder: 11 },
      { nameFa: 'پاوه', nameEn: 'Paveh', displayOrder: 12 },
      { nameFa: 'نودشه', nameEn: 'Nowsud', displayOrder: 13 },
      { nameFa: 'تازه‌آباد', nameEn: 'Tazehabad', displayOrder: 14 },
    ],
  },
  {
    code: 'KGB', nameFa: 'کهگیلویه و بویراحمد', nameEn: 'Kohgiluyeh and Boyer-Ahmad', displayOrder: 23,
    cities: [
      { nameFa: 'یاسوج', nameEn: 'Yasuj', isCapital: true, displayOrder: 1 },
      { nameFa: 'گچساران', nameEn: 'Gachsaran', displayOrder: 2 },
      { nameFa: 'دهدشت', nameEn: 'Dehdasht', displayOrder: 3 },
      { nameFa: 'سی‌سخت', nameEn: 'Sisakht', displayOrder: 4 },
      { nameFa: 'چرام', nameEn: 'Cheram', displayOrder: 5 },
      { nameFa: 'لنده', nameEn: 'Landeh', displayOrder: 6 },
      { nameFa: 'مادوان', nameEn: 'Madavan', displayOrder: 7 },
      { nameFa: 'چیتاب', nameEn: 'Chitab', displayOrder: 8 },
    ],
  },
  {
    code: 'GOL', nameFa: 'گلستان', nameEn: 'Golestan', displayOrder: 24,
    cities: [
      { nameFa: 'گرگان', nameEn: 'Gorgan', isCapital: true, displayOrder: 1 },
      { nameFa: 'گنبد کاووس', nameEn: 'Gonbad-e Kavus', displayOrder: 2 },
      { nameFa: 'علی‌آباد کتول', nameEn: 'Aliabad-e Katul', displayOrder: 3 },
      { nameFa: 'آق‌قلا', nameEn: 'Aqqala', displayOrder: 4 },
      { nameFa: 'بندر ترکمن', nameEn: 'Bandar-e Torkaman', displayOrder: 5 },
      { nameFa: 'کلاله', nameEn: 'Kalaleh', displayOrder: 6 },
      { nameFa: 'مینودشت', nameEn: 'Minudasht', displayOrder: 7 },
      { nameFa: 'آزادشهر', nameEn: 'Azadshahr', displayOrder: 8 },
      { nameFa: 'رامیان', nameEn: 'Ramian', displayOrder: 9 },
      { nameFa: 'مراوه تپه', nameEn: 'Maraveh Tappeh', displayOrder: 10 },
      { nameFa: 'گالیکش', nameEn: 'Galikash', displayOrder: 11 },
      { nameFa: 'بندر گز', nameEn: 'Bandar-e Gaz', displayOrder: 12 },
    ],
  },
  {
    code: 'GIL', nameFa: 'گیلان', nameEn: 'Gilan', displayOrder: 25,
    cities: [
      { nameFa: 'رشت', nameEn: 'Rasht', isCapital: true, displayOrder: 1 },
      { nameFa: 'بندر انزلی', nameEn: 'Bandar-e Anzali', displayOrder: 2 },
      { nameFa: 'لاهیجان', nameEn: 'Lahijan', displayOrder: 3 },
      { nameFa: 'آستارا', nameEn: 'Astara', displayOrder: 4 },
      { nameFa: 'تالش', nameEn: 'Talesh', displayOrder: 5 },
      { nameFa: 'صومعه‌سرا', nameEn: 'Someh Sara', displayOrder: 6 },
      { nameFa: 'رودبار', nameEn: 'Rudbar', displayOrder: 7 },
      { nameFa: 'رودسر', nameEn: 'Rudsar', displayOrder: 8 },
      { nameFa: 'املش', nameEn: 'Amlash', displayOrder: 9 },
      { nameFa: 'سیاهکل', nameEn: 'Siahkal', displayOrder: 10 },
      { nameFa: 'لنگرود', nameEn: 'Langrud', displayOrder: 11 },
      { nameFa: 'خمام', nameEn: 'Khomam', displayOrder: 12 },
      { nameFa: 'فومن', nameEn: 'Fuman', displayOrder: 13 },
      { nameFa: 'شفت', nameEn: 'Shaft', displayOrder: 14 },
      { nameFa: 'رضوانشهر', nameEn: 'Rezvanshahr', displayOrder: 15 },
      { nameFa: 'آستانه اشرفیه', nameEn: 'Astaneh-ye Ashrafiyeh', displayOrder: 16 },
    ],
  },
  {
    code: 'LOR', nameFa: 'لرستان', nameEn: 'Lorestan', displayOrder: 26,
    cities: [
      { nameFa: 'خرم‌آباد', nameEn: 'Khorramabad', isCapital: true, displayOrder: 1 },
      { nameFa: 'بروجرد', nameEn: 'Borujerd', displayOrder: 2 },
      { nameFa: 'دورود', nameEn: 'Dorud', displayOrder: 3 },
      { nameFa: 'الیگودرز', nameEn: 'Aligudarz', displayOrder: 4 },
      { nameFa: 'ازنا', nameEn: 'Azna', displayOrder: 5 },
      { nameFa: 'الشتر', nameEn: 'Alashtar', displayOrder: 6 },
      { nameFa: 'نورآباد', nameEn: 'Nurabad', displayOrder: 7 },
      { nameFa: 'پلدختر', nameEn: 'Poldokhtar', displayOrder: 8 },
      { nameFa: 'کوهدشت', nameEn: 'Kuhdasht', displayOrder: 9 },
    ],
  },
  {
    code: 'MAZ', nameFa: 'مازندران', nameEn: 'Mazandaran', displayOrder: 27,
    cities: [
      { nameFa: 'ساری', nameEn: 'Sari', isCapital: true, displayOrder: 1 },
      { nameFa: 'بابل', nameEn: 'Babol', displayOrder: 2 },
      { nameFa: 'آمل', nameEn: 'Amol', displayOrder: 3 },
      { nameFa: 'قائم‌شهر', nameEn: 'Qaemshahr', displayOrder: 4 },
      { nameFa: 'تنکابن', nameEn: 'Tonekabon', displayOrder: 5 },
      { nameFa: 'نوشهر', nameEn: 'Noshahr', displayOrder: 6 },
      { nameFa: 'محمودآباد', nameEn: 'Mahmudabad', displayOrder: 7 },
      { nameFa: 'فریدونکنار', nameEn: 'Fereydunkenar', displayOrder: 8 },
      { nameFa: 'جویبار', nameEn: 'Joybar', displayOrder: 9 },
      { nameFa: 'نکا', nameEn: 'Neka', displayOrder: 10 },
      { nameFa: 'سوادکوه', nameEn: 'Savadkuh', displayOrder: 11 },
      { nameFa: 'گلوگاه', nameEn: 'Galugah', displayOrder: 12 },
      { nameFa: 'کیاسر', nameEn: 'Kiyasar', displayOrder: 13 },
      { nameFa: 'ایزدشهر', nameEn: 'Izadshahr', displayOrder: 14 },
      { nameFa: 'عباس‌آباد', nameEn: 'Abbasabad', displayOrder: 15 },
    ],
  },
  {
    code: 'MAR', nameFa: 'مرکزی', nameEn: 'Markazi', displayOrder: 28,
    cities: [
      { nameFa: 'اراک', nameEn: 'Arak', isCapital: true, displayOrder: 1 },
      { nameFa: 'ساوه', nameEn: 'Saveh', displayOrder: 2 },
      { nameFa: 'خمین', nameEn: 'Khomein', displayOrder: 3 },
      { nameFa: 'محلات', nameEn: 'Mahallat', displayOrder: 4 },
      { nameFa: 'دلیجان', nameEn: 'Delijan', displayOrder: 5 },
      { nameFa: 'تفرش', nameEn: 'Tafresh', displayOrder: 6 },
      { nameFa: 'آشتیان', nameEn: 'Ashtian', displayOrder: 7 },
      { nameFa: 'شازند', nameEn: 'Shazand', displayOrder: 8 },
      { nameFa: 'کمیجان', nameEn: 'Komijan', displayOrder: 9 },
      { nameFa: 'زرندیه', nameEn: 'Zarandieh', displayOrder: 10 },
    ],
  },
  {
    code: 'HOR', nameFa: 'هرمزگان', nameEn: 'Hormozgan', displayOrder: 29,
    cities: [
      { nameFa: 'بندرعباس', nameEn: 'Bandar Abbas', isCapital: true, displayOrder: 1 },
      { nameFa: 'بندر لنگه', nameEn: 'Bandar Lengeh', displayOrder: 2 },
      { nameFa: 'قشم', nameEn: 'Qeshm', displayOrder: 3 },
      { nameFa: 'کیش', nameEn: 'Kish', displayOrder: 4 },
      { nameFa: 'جاسک', nameEn: 'Jask', displayOrder: 5 },
      { nameFa: 'سیری', nameEn: 'Sirri', displayOrder: 6 },
      { nameFa: 'کنگ', nameEn: 'Kong', displayOrder: 7 },
      { nameFa: 'حاجی‌آباد', nameEn: 'Hajiabad', displayOrder: 8 },
      { nameFa: 'رودان', nameEn: 'Rudan', displayOrder: 9 },
      { nameFa: 'میناب', nameEn: 'Minab', displayOrder: 10 },
      { nameFa: 'بستک', nameEn: 'Bastak', displayOrder: 11 },
      { nameFa: 'خمیر', nameEn: 'Khamir', displayOrder: 12 },
    ],
  },
  {
    code: 'HAM', nameFa: 'همدان', nameEn: 'Hamadan', displayOrder: 30,
    cities: [
      { nameFa: 'همدان', nameEn: 'Hamadan', isCapital: true, displayOrder: 1 },
      { nameFa: 'ملایر', nameEn: 'Malayer', displayOrder: 2 },
      { nameFa: 'نهاوند', nameEn: 'Nahavand', displayOrder: 3 },
      { nameFa: 'تویسرکان', nameEn: 'Tuyserkan', displayOrder: 4 },
      { nameFa: 'اسدآباد', nameEn: 'Asadabad', displayOrder: 5 },
      { nameFa: 'کبودرآهنگ', nameEn: 'Kabudarahang', displayOrder: 6 },
      { nameFa: 'رزن', nameEn: 'Razan', displayOrder: 7 },
      { nameFa: 'بهار', nameEn: 'Bahar', displayOrder: 8 },
      { nameFa: 'فامنین', nameEn: 'Famenin', displayOrder: 9 },
    ],
  },
  {
    code: 'YZD', nameFa: 'یزد', nameEn: 'Yazd', displayOrder: 31,
    cities: [
      { nameFa: 'یزد', nameEn: 'Yazd', isCapital: true, displayOrder: 1 },
      { nameFa: 'میبد', nameEn: 'Meybod', displayOrder: 2 },
      { nameFa: 'اردکان', nameEn: 'Ardakan', displayOrder: 3 },
      { nameFa: 'بافق', nameEn: 'Bafq', displayOrder: 4 },
      { nameFa: 'مهریز', nameEn: 'Mehriz', displayOrder: 5 },
      { nameFa: 'تفت', nameEn: 'Taft', displayOrder: 6 },
      { nameFa: 'اشکذر', nameEn: 'Ashkezar', displayOrder: 7 },
      { nameFa: 'خضرآباد', nameEn: 'Khezrabad', displayOrder: 8 },
    ],
  },
];

/**
 * Derives a short, stable, province-unique code for every city (e.g. "THR-TEH"
 * for تهران). It is the province code plus the first three letters of the
 * English name, with a numeric suffix added only to break a collision inside a
 * single province. The result always fits cities.code VARCHAR(10) and so always
 * satisfies the UNIQUE (province_id, code) constraint created in 1730000000038.
 */
function withCityCodes(provinces: readonly ProvinceSeed[]): readonly Province[] {
  return provinces.map((province) => {
    const used = new Set<string>();
    return {
      ...province,
      cities: province.cities.map((city) => {
        const slug = city.nameEn
          .replace(/[^A-Za-z0-9]/g, '')
          .toUpperCase()
          .slice(0, 3);
        let code = `${province.code}-${slug}`;
        for (let suffix = 2; used.has(code); suffix += 1) {
          code = `${province.code}-${slug}${suffix}`;
        }
        used.add(code);
        return { ...city, code };
      }),
    };
  });
}

const SEEDS = withCityCodes(PROVINCES);

/** Serialises a string into a single-quoted SQL literal. */
function lit(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Static geographic reference data for the whole of Iran: 31 provinces and a
 * few hundred of their principal cities.
 *
 * Unlike the mock salons in 1730000000009 this is real catalogue data every
 * environment needs, so it is never skipped. Both inserts are idempotent
 * (`ON CONFLICT ... DO NOTHING`): re-applying the migration on a database that
 * already has part of the list is a no-op, and a city added by hand is never
 * clobbered. Province ids are gen_random_uuid(), so each province's cities are
 * inserted through a SELECT that resolves the foreign key by province code.
 */
export class SeedProvincesCities1730000000039 implements MigrationInterface {
  name = 'SeedProvincesCities1730000000039';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // استان‌ها: یک INSERT واحد؛ کد استان کل یکتاست و در تضاد نادیده گرفته می‌شود
    const provinceRows = SEEDS.map(
      (province) =>
        `('${lit(province.code)}', '${lit(province.nameFa)}', '${lit(province.nameEn)}', ${province.displayOrder})`,
    ).join(`,\n        `);

    await queryRunner.query(`
      INSERT INTO provinces (code, name_fa, name_en, display_order)
      VALUES
        ${provinceRows}
      ON CONFLICT (code) DO NOTHING
    `);

    // شهرها: به ازای هر استان، کلید خارجی از روی کد استان حل می‌شود
    for (const province of SEEDS) {
      const cityRows = province.cities
        .map(
          (city) =>
            `('${lit(city.code)}', '${lit(city.nameFa)}', '${lit(city.nameEn)}', ${Boolean(city.isCapital)}, ${city.displayOrder})`,
        )
        .join(`,\n            `);

      await queryRunner.query(`
        INSERT INTO cities (province_id, code, name_fa, name_en, is_capital, display_order)
        SELECT p.id, v.code, v.name_fa, v.name_en, v.is_capital, v.display_order
        FROM provinces p
        CROSS JOIN (
          VALUES
            ${cityRows}
        ) AS v(code, name_fa, name_en, is_capital, display_order)
        WHERE p.code = '${lit(province.code)}'
        ON CONFLICT (province_id, code) DO NOTHING
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const codes = PROVINCES.map((province) => `'${lit(province.code)}'`).join(`, `);

    // Only the rows this migration owns. The provinces/cities tables themselves
    // (and the tenant/user columns) belong to 1730000000038 and stay untouched.
    await queryRunner.query(`
      DELETE FROM cities
      WHERE province_id IN (SELECT id FROM provinces WHERE code IN (${codes}))
    `);
    await queryRunner.query(`DELETE FROM provinces WHERE code IN (${codes})`);
  }
}
