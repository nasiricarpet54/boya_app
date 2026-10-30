import 'package:boya_shared/boya_shared.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Home feed route. Every home shortcut in the customer app jumps here.
const String boyaHomePath = '/home';

/// Tooltip of the home shortcut.
const String boyaHomeTooltip = 'خانه';

/// Tooltip of the back button.
const String boyaBackTooltip = 'بازگشت';

/// The app bar shared by every customer-app screen.
///
/// The leading slot is derived from the navigation stack instead of being
/// passed by each screen: a route that can be popped gets the RTL back arrow,
/// a root route gets a home icon. In RTL the actions render on the left edge
/// of the bar, which is where the always-on home shortcut lives.
///
/// Two shapes, chosen by constructor rather than inferred:
///
/// - [BoyaAppBar], a plain [AppBar], which is what [Scaffold.appBar] takes.
///   It accepts a [bottom] — typically a [TabBar] — and [AppBar] lays that out
///   under the title itself.
/// - [BoyaAppBar.sliver], a [SliverAppBar] for the [CustomScrollView] screens,
///   where the bar must be the page's first sliver so a cover photo can
///   collapse on scroll while the [bottom] tabs stay pinned.
class BoyaAppBar extends StatelessWidget implements PreferredSizeWidget {
  const BoyaAppBar({
    required this.title,
    this.bottom,
    this.actions,
    this.backgroundColor,
    this.foregroundColor,
    this.homeTooltip = boyaHomeTooltip,
    this.backTooltip = boyaBackTooltip,
    super.key,
  })  : pinned = false,
        expandedHeight = null,
        flexibleSpaceBackground = null,
        _sliver = false;

  /// Sliver shape for a [CustomScrollView]. See the class docs.
  const BoyaAppBar.sliver({
    required this.title,
    this.bottom,
    this.actions,
    this.pinned = false,
    this.expandedHeight,
    this.flexibleSpaceBackground,
    this.backgroundColor,
    this.foregroundColor,
    this.homeTooltip = boyaHomeTooltip,
    this.backTooltip = boyaBackTooltip,
    super.key,
  }) : _sliver = true;

  /// Which of the two shapes [build] returns.
  final bool _sliver;

  /// Centered screen title.
  final String title;

  /// Extra buttons for the bar, rendered before the home shortcut.
  final List<Widget>? actions;

  /// Widget pinned under the title, typically a [TabBar].
  final PreferredSizeWidget? bottom;

  /// Whether the [SliverAppBar] pins the title row to the top of the scroll.
  final bool pinned;

  /// Expanded height of the [SliverAppBar], including the height of [bottom].
  final double? expandedHeight;

  /// Image or gradient drawn behind the title in the [SliverAppBar] variant.
  final Widget? flexibleSpaceBackground;

  /// Defaults to the theme's app bar color, which is [BoyaColors.cream] in
  /// [BoyaTheme.light].
  final Color? backgroundColor;

  /// Icon and title color. Defaults to the theme's [ColorScheme.onSurface].
  final Color? foregroundColor;

  /// Tooltip of both home buttons.
  final String homeTooltip;

  /// Tooltip of the back button.
  final String backTooltip;

  /// What [Scaffold.appBar] measures before it lays the bar out, so the tabs a
  /// [bottom] adds to the box shape are included. The sliver shape is measured
  /// by its own [SliverAppBar], never through this getter.
  @override
  Size get preferredSize =>
      Size.fromHeight(kToolbarHeight + (bottom?.preferredSize.height ?? 0));

  /// The leading slot, derived from the navigation stack instead of being
  /// passed by each screen.
  Widget _leading(BuildContext context, Color foreground) {
    final navigator = Navigator.of(context);
    return navigator.canPop()
        ? IconButton(
            icon: Icon(Icons.arrow_forward, color: foreground),
            onPressed: navigator.pop,
            tooltip: backTooltip,
          )
        : BoyaHomeButton(color: foreground, tooltip: homeTooltip);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final barColor = backgroundColor ?? theme.appBarTheme.backgroundColor ?? BoyaColors.cream;
    final foreground = foregroundColor ?? theme.colorScheme.onSurface;
    // One line, clipped: salon names run up to 200 characters (the API accepts
    // that much), so an unconstrained title wraps and eats the bar.
    final title = Text(
      this.title,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      style: BoyaTypography.title.copyWith(color: foreground),
    );
    final actions = <Widget>[
      ...?this.actions,
      BoyaHomeButton(color: foreground, tooltip: homeTooltip),
    ];

    if (_sliver) {
      return SliverAppBar(
        backgroundColor: barColor,
        elevation: 0,
        pinned: pinned,
        expandedHeight: expandedHeight,
        flexibleSpace: FlexibleSpaceBar(
          title: title,
          // The flexible space reaches behind the bar's ends, so the default
          // title placement runs a long title under the leading/action buttons
          // and lands inside the pinned [bottom] tabs. Inset by one button slot
          // on each side and by the full tab height below.
          titlePadding: EdgeInsetsDirectional.only(
            start: kToolbarHeight,
            end: kToolbarHeight,
            bottom: (bottom?.preferredSize.height ?? 0) + 32,
          ),
          background: flexibleSpaceBackground,
        ),
        leading: _leading(context, foreground),
        actions: actions,
        bottom: bottom,
      );
    }

    return AppBar(
      backgroundColor: barColor,
      elevation: 0,
      centerTitle: true,
      title: title,
      leading: _leading(context, foreground),
      actions: actions,
      bottom: bottom,
    );
  }
}

/// Home shortcut used by both slots of [BoyaAppBar] and by screens whose bar
/// is a [SliverAppBar].
class BoyaHomeButton extends StatelessWidget {
  const BoyaHomeButton({required this.color, this.tooltip = boyaHomeTooltip, super.key});

  final Color color;

  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: Icon(Icons.home_outlined, color: color),
      onPressed: () => context.go(boyaHomePath),
      tooltip: tooltip,
    );
  }
}
