const fs = require('fs');
const p = 'E:/boya/boya/mobile/customer_app/lib/features/booking/presentation/widgets/booking_form.dart';
const s = fs.readFileSync(p, 'utf8');
const a = s.indexOf('  /// ADR-011: the address the specialist travels to.');
const b = s.indexOf('  /// Toggles [isMobile]');
fs.writeFileSync('E:/boya/boya/mobile/customer_app/scripts/props.txt', JSON.stringify(s.slice(a, b)));
const c = s.indexOf('class _MobileSection extends StatelessWidget');
const d = s.indexOf('class _AddressField extends StatelessWidget');
fs.writeFileSync('E:/boya/boya/mobile/customer_app/scripts/mobile.txt', JSON.stringify(s.slice(c, d)));
console.log('done');

