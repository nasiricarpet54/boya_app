const fs = require('fs');
const p = 'E:/boya/boya/mobile/customer_app/lib/features/booking/presentation/widgets/booking_form.dart';
const s = fs.readFileSync(p, 'utf8');
const lines = s.split('\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('late final TextEditingController')) {
    for (let j = i; j < lines.length; j++) {
      console.log((j + 1) + ':' + JSON.stringify(lines[j]));
      if (lines[j].includes('@override') && j > i && lines[j-1].includes('void dispose')) break;
    }
    break;
  }
}