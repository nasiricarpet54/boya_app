// Patches booking_form.dart: swaps the manual address TextField for the
// picker-based sheet flow (decision 6: no manual entry).
const fs = require('fs');

const f = 'E:/boya/boya/mobile/customer_app/lib/features/booking/presentation/widgets/booking_form.dart';
let s = fs.readFileSync(f, 'utf8');
s = s.replace(/\r\n/g, '\n');

// 1) Replace all import lines (everything before the first top-level `class`)
//    with the new import block so we don't depend on exact existing ordering.
const firstClass = s.indexOf('class BookingForm');
if (firstClass < 0) throw new Error('BookingForm class not found');
const body = s.slice(firstClass);

const newImports = [
  "import 'package:boya_shared/boya_shared.dart';",
  "import 'package:flutter/material.dart';",
  "import 'package:flutter_riverpod/flutter_riverpod.dart';",
  "import 'package:go_router/go_router.dart';",
  '',
  "import '../../../core/network/api_client.dart';",
  "import '../../../salon/data/salon_api.dart';",
  "import '../../../salon/domain/available_slot.dart';",
  "import '../../../salon/domain/salon_detail.dart';",
  "import '../../../salon/domain/specialist_service.dart';",
  "import '../../location/application/addresses_state.dart';",
  "import '../../location/data/addresses_api.dart';",
  "import '../../location/domain/customer_address.dart';",
  "import '../../location/presentation/address_picker_sheet.dart';",
  "import '../../location/presentation/address_map_picker_screen.dart';",
  "import '../../location/presentation/widgets/boya_location_picker.dart';",
  "import 'booking_bar.dart';",
  "import 'booking_confirm_dialog.dart';",
  "import 'booking_choices.dart';",
  "import 'jalali_date_picker_card.dart';",
  "import 'slot_grid.dart';",
  '',
].join('\n');

s = newImports + '\n' + body;
fs.writeFileSync(f, s);
console.log('imports patched OK; body starts at', firstClass);
