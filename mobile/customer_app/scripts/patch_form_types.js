// Threads CustomerAddress? through BookingForm -> _MobileSection -> _AddressField
// and removes the now-unused TextEditingController / FocusNode plumbing.
const fs = require('fs');
const f = 'E:/boya/boya/mobile/customer_app/lib/features/booking/presentation/widgets/booking_form.dart';
let s = fs.readFileSync(f, 'utf8');
s = s.replace(/\r\n/g, '\n');

function rep(oldS, newS, label) {
  if (!s.includes(oldS)) throw new Error('NOT FOUND: ' + label);
  s = s.replace(oldS, newS);
  console.log('replaced:', label);
}

// R1: BookingForm props (address type, onAddress type, doc comments).
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
  'BookingForm props'
);

// R2: remove controller/focus fields + the three lifecycle methods.
rep(
`class _BookingFormState extends ConsumerState<BookingForm> {
  late final TextEditingController _addressController;
  final _addressFocus = FocusNode();

  @override
  void initState() {
    super.initState();
    _addressController = TextEditingController(text: widget.address);
  }

  @override
  void didUpdateWidget(covariant BookingForm oldWidget) {
    super.didUpdateWidget(oldWidget);
    // External changes (a stored draft) should land in the field, but a
    // typing loop has to be avoided: a controller rebuild on every keystroke
    // resets the caret to the end and makes Persian composition behave oddly.
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
`class _BookingFormState extends ConsumerState<BookingForm> {
`,
  '_BookingFormState fields + lifecycle methods'
);

// R3: drop addressController/addressFocus from the _MobileSection invocation.
rep(
`            isMobile: widget.isMobile,
            address: widget.address,
            addressController: _addressController,
            addressFocus: _addressFocus,
            onMobile: widget.onMobile,`,
`            isMobile: widget.isMobile,
            address: widget.address,
            onMobile: widget.onMobile,`,
  '_MobileSection invocation'
);

// R4: drop constructor params.
rep(
`  const _MobileSection({
    required this.enabled,
    required this.isMobile,
    required this.address,
    required this.addressController,
    required this.addressFocus,
    required this.onMobile,
    required this.onAddress,
    required this.reason,
  });`,
`  const _MobileSection({
    required this.enabled,
    required this.isMobile,
    required this.address,
    required this.onMobile,
    required this.onAddress,
    required this.reason,
  });`,
  '_MobileSection constructor params'
);

// R5: drop field decls + retyping address/onAddress.
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
  '_MobileSection fields'
);

// R6: drop controller/focusNode from the _AddressField invocation.
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
  '_AddressField invocation'
);

fs.writeFileSync(f, s);
console.log('done; length', s.length);
