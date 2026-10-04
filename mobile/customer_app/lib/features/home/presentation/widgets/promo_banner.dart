import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';

/// Full-width promotional banner. Copper gradient with a decorative emoji.
class PromoBanner extends StatelessWidget {
  const PromoBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: SizedBox(
        height: 160,
        child: Ink(
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.centerLeft,
              end: Alignment.centerRight,
              colors: [BoyaColors.primaryHover, BoyaColors.primary, BoyaColors.rose],
              stops: [0, 0.55, 1],
            ),
            borderRadius: BorderRadius.circular(20),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(20),
            // Offer details screen is not built yet.
            onTap: () {},
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  const Text('🎉', style: TextStyle(fontSize: 52)),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '۲۰٪ تخفیف اولین رزرو',
                          style: BoyaTypography.title.copyWith(
                            color: BoyaColors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'برای تجربه اولین نوبت در بویا',
                          style: BoyaTypography.caption.copyWith(color: BoyaColors.white),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
