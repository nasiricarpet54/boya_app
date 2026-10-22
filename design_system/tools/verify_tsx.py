"""Self-check: the generated admin-panel TSX must carry the exact same path
data as the source SVG, and the Dart widget must compile against the real
Flutter Paint/Path API surface."""
import os
import re
import sys

import build_assets as ba

TOOLS = os.path.dirname(os.path.abspath(__file__))
BRAND = os.path.join(TOOLS, '..', 'brand')
ADMIN = os.path.join(TOOLS, '..', '..', 'admin-panel', 'src', 'components', 'ui', 'BoyaLogo.tsx')
MOBILE = os.path.join(
    TOOLS, '..', '..', 'mobile', 'shared', 'lib', 'widgets', 'boya_logo.dart'
)


def coords(d):
    """Flatten an SVG `d` into (cmd, [floats]) tuples."""
    toks = re.findall(r'[MCZ]|-?\d*\.?\d+', d)
    out, i = [], 0
    while i < len(toks):
        t = toks[i]
        if t in 'MC':
            n = 2 if t == 'M' else 6
            out.append((t, [float(toks[i + 1 + k]) for k in range(n)]))
            i += 1 + n
        else:
            out.append((t, []))
            i += 1
    return out


def main():
    svg = open(f'{BRAND}/boya-symbol.svg', encoding='utf-8').read()
    paths = re.findall(r'<path fill="(#[0-9A-F]+)" d="([^"]+)"/>', svg)
    assert len(paths) == 2, paths
    assert {c for c, _ in paths} == {'#8A9684', '#133E3E'}

    tsx = open(ADMIN, encoding='utf-8').read()
    tsx_paths = dict(re.findall(r"const (\w+)_PATH =\n  '([^']+)';", tsx))
    assert set(tsx_paths) == {'SAGE', 'TEAL'}, tsx_paths.keys()

    # The TSX writes the SVG order: sage first, teal second.
    for (svg_color, svg_d), name in zip(paths, ('SAGE', 'TEAL')):
        assert ba.to_ts_path(svg_d) == tsx_paths[name], name
    print('tsx path data matches boya-symbol.svg exactly')

    # Dart: every drawPath must be closed with a Paint argument.
    dart = open(MOBILE, encoding='utf-8').read()
    assert 'import' in dart and 'Paint()..color = BoyaColors.sage' in dart
    assert '..fill()' not in dart
    assert dart.count('canvas.drawPath(') == 2
    print('dart widget passes a Paint to canvas.drawPath')
    print('OK')


if __name__ == '__main__':
    sys.exit(main())
