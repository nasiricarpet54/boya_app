import 'package:boya_shared/boya_shared.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../domain/salon_detail.dart';
import 'salon_portfolio_tab.dart';

/// Full-screen photo viewer for the «نمونه‌کارها» tab, shown as a dialog.
///
/// Works on the list the tab already loaded, so opening a photo never triggers
/// a request: pinch to zoom, swipe or use the arrows to move between photos.
Future<void> showPortfolioViewer(
  BuildContext context,
  List<PortfolioItem> items,
  int initialIndex,
) {
  return showDialog<void>(
    context: context,
    useRootNavigator: false,
    barrierColor: Colors.black,
    builder: (_) => _PortfolioViewerDialog(items: items, initialIndex: initialIndex),
  );
}

class _PortfolioViewerDialog extends StatefulWidget {
  const _PortfolioViewerDialog({required this.items, required this.initialIndex});

  final List<PortfolioItem> items;
  final int initialIndex;

  @override
  State<_PortfolioViewerDialog> createState() => _PortfolioViewerDialogState();
}

class _PortfolioViewerDialogState extends State<_PortfolioViewerDialog> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BoyaColors.ink,
      // A dialog is laid out with loose constraints inside its barrier, so the
      // viewer has to claim the whole screen itself.
      body: SizedBox.expand(
        child: _PortfolioViewerBody(
          items: widget.items,
          initialIndex: widget.initialIndex,
        ),
      ),
    );
  }
}

/// Everything inside the full-screen dialog: the page view, zoom and arrows.
class _PortfolioViewerBody extends StatefulWidget {
  const _PortfolioViewerBody({required this.items, required this.initialIndex});

  final List<PortfolioItem> items;
  final int initialIndex;

  @override
  State<_PortfolioViewerBody> createState() => _PortfolioViewerBodyState();
}

class _PortfolioViewerBodyState extends State<_PortfolioViewerBody> {
  late final PageController _controller;
  late final TransformationController _zoom;
  late int _index;

  @override
  void initState() {
    super.initState();
    _index = widget.initialIndex;
    _controller = PageController(initialPage: _index);
    _zoom = TransformationController();
  }

  @override
  void dispose() {
    _controller.dispose();
    _zoom.dispose();
    super.dispose();
  }

  void _goTo(int index) {
    if (index < 0 || index >= widget.items.length) return;
    _controller.animateToPage(
      index,
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.items[_index];
    final name = item.specialistName;
    final counter = '${toPersianDigits(_index + 1)} از ${toPersianDigits(widget.items.length)}';

    return Scaffold(
      backgroundColor: BoyaColors.ink,
      appBar: AppBar(
        backgroundColor: BoyaColors.ink,
        foregroundColor: BoyaColors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          name == null || name.isEmpty ? 'نمونه‌کار' : '$name • $counter',
          style: BoyaTypography.caption.copyWith(color: BoyaColors.white),
        ),
      ),
      body: Stack(
        children: [
          PageView.builder(
            controller: _controller,
            itemCount: widget.items.length,
            onPageChanged: (index) => setState(() {
              _index = index;
              // Leaving a photo zoomed in would hide the next one, because the
              // shared transformation keeps the scale.
              _zoom.value = Matrix4.identity();
            }),
            itemBuilder: (context, index) {
              final photo = widget.items[index];
              return InteractiveViewer(
                transformationController: index == _index ? _zoom : null,
                minScale: 1,
                maxScale: 4,
                child: Center(
                  child: Hero(
                    tag: portfolioHeroTag(photo),
                    child: CachedNetworkImage(
                      imageUrl: photo.imageUrl,
                      fit: BoxFit.contain,
                      placeholder: (_, _) => const CircularProgressIndicator(color: BoyaColors.white),
                      errorWidget: (_, _, _) => const Icon(
                        Icons.broken_image_outlined,
                        color: BoyaColors.white,
                        size: 48,
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
          if (widget.items.length > 1) ...[
            Positioned(
              left: 8,
              top: 0,
              bottom: 0,
              child: _ViewerArrow(
                // Right-to-left: the left arrow walks the list forwards.
                icon: Icons.chevron_left,
                onTap: _index + 1 < widget.items.length ? () => _goTo(_index + 1) : null,
              ),
            ),
            Positioned(
              right: 8,
              top: 0,
              bottom: 0,
              child: _ViewerArrow(
                icon: Icons.chevron_right,
                onTap: _index > 0 ? () => _goTo(_index - 1) : null,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ViewerArrow extends StatelessWidget {
  const _ViewerArrow({required this.icon, this.onTap});

  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: IconButton.filledTonal(
        onPressed: onTap,
        icon: Icon(icon),
        style: IconButton.styleFrom(
          backgroundColor: BoyaColors.ink.withValues(alpha: 0.5),
          foregroundColor: BoyaColors.white,
          disabledForegroundColor: BoyaColors.inkMuted,
        ),
      ),
    );
  }
}
