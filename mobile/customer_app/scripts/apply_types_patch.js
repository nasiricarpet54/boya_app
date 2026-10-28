const fs = require('fs');
const f = 'E:/boya/boya/mobile/customer_app/lib/features/booking/presentation/widgets/booking_form.dart';
let s = fs.readFileSync(f, 'utf8');
s = s.replace(/\r\n/g, '\n');
const log = [];
function rep(oldS, newS, label) {
  if (!s.includes(oldS)) { log.push('NOT FOUND: ' + label); return false; }
  s = s.replace(oldS, newS); log.push('OK: ' + label); return true;
}

rep(
`  /// ADR-011: the address the specialist travels to. Owned by the screen so it
  /// survives slot changes and rebuilds.
  final String address;

  /// Toggles [isMobile]; the screen validates the address on submit.
  final ValueChanged<bool> onMobile;

  /// Updates [address] on every keystroke.
  final ValueChanged<String> onAddress;`,
`  /// ADR-011: the address the specialist travels to (decision 6 - picked,
  /// not typed). Owned by the screen so it survives slot changes and
  /// rebuilds.
  final CustomerAddress? address;

  /// Toggles [isMobile]; the screen validates the address on submit.
  final ValueChanged<bool> onMobile;

  /// Reports the picked [CustomerAddress] back to the screen.
  final ValueChanged<CustomerAddress?> onAddress;`,
  'BookingForm props');

rep(
`  late final TextEditingController _addressController;
  final _addressFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    _addressController = TextEditingController(text: widget.address);
  }

  @override
  void didUpdateWidget(covariant BookingForm oldWidget) {
    super.didUpdateWidget(oldWidget);
    // External changes (a stored draft) should land in the field, but a typing
    // loop has to be avoided: a controller rebuild on every keystroke resets
    // the caret to the end and makes Persian composition behave oddly.
    if (oldWidget.address != widget.address && _addressController.text != widget.address) {
      _addressController.text = widget.address;
    }
  }

  @override
  void dispose() {
    _addressController.dispose();
    _addressFocus.dispose();
    super.dispose();
  }

`,
``,
  'fields+lifecycle');

rep(
`            isMobile: widget.isMobile,
            address: widget.address,
            addressController: _addressController,
            addressFocus: _addressFocus,
            onMobile: widget.onMobile,`,
`            isMobile: widget.isMobile,
            address: widget.address,
            onMobile: widget.onMobile,`,
  '_MobileSection invocation');

rep(
`    required this.addressController,
    required this.addressFocus,
    required this.onMobile,`,
`    required this.onMobile,`,
  'constructor params');

rep(
`  /// Current address text, shown as an error hint when the toggle is on but the
  /// field is empty.
  final String address;
  final TextEditingController addressController;
  final FocusNode addressFocus;
  final ValueChanged<bool> onMobile;
  final ValueChanged<String> onAddress;`,
`  /// The picked address (or null); renders as the picker row's text.
  final CustomerAddress? address;
  final ValueChanged<bool> onMobile;
  final ValueChanged<CustomerAddress?> onAddress;`,
  '_MobileSection fields');

rep(
`                _AddressField(
                  controller: addressController,
                  focusNode: addressFocus,
                  address: address,
                  onChanged: onAddress,
                ),`,
`                _AddressField(
                  address: address,
                  onChanged: onAddress,
                ),`,
  '_AddressField invocation');

fs.writeFileSync('E:/boya/boya/mobile/customer_app/scripts/report.txt', log.join('\n'), 'utf8');
fs.writeFileSync(f, s);
console.log('written');
