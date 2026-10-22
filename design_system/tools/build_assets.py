"""Build the production Boya brand assets from the traced vectors.

Outputs (into design_system/brand/):
  boya-symbol.svg        symbol only
  boya-logo-horizontal.svg symbol + wordmark, side by side
  boya-logo-vertical.svg   symbol + بویا + BÖYÂ, stacked
  boya-symbol-{16,32,192,512}.png
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image

TOOLS = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TOOLS)
from vec import SRC, classify, trace, rdp, smooth, to_path  # noqa: E402

OUT = os.path.join(TOOLS, '..', 'brand')
TEAL = '#133E3E'
SAGE = '#8A9684'

# Band boundaries found in the source artwork (row ranges of each lockup part).
FULL_SYMBOL = (153, 643)
FULL_PERSIAN = (674, 979)
FULL_LATIN = (1001, 1117)
LATIN_SYMBOL = (219, 828)
LATIN_WORD = (911, 1065)


def paths_for_band(masks, band, eps=0.7):
    """Trace one horizontal band of the artwork into per-colour path data."""
    out = {}
    for color in ('teal', 'sage'):
        m = np.zeros_like(masks[color])
        m[band[0]:band[1] + 1] = masks[color][band[0]:band[1] + 1]
        subpaths = []
        for loop in trace(m):
            simple = rdp(np.vstack([loop, loop[0]]), eps)[:-1]
            if len(simple) < 3:
                continue
            subpaths.append(smooth(simple))
        out[color] = {'d': to_path(subpaths), 'subpaths': subpaths}
    return out


def bbox_of(paths):
    """Bounding box of the traced geometry."""
    pts = []
    for data in paths.values():
        for start, segs in data['subpaths']:
            pts.append(start)
            pts.extend(e[2] for e in segs)
    if not pts:
        return (0.0, 0.0, 0.0, 0.0)
    p = np.vstack(pts)
    return (float(p[:, 0].min()), float(p[:, 1].min()),
            float(p[:, 0].max()), float(p[:, 1].max()))


def translate(d, dx, dy):
    """Shift a path's `d` by (dx, dy) without touching the curve shape."""
    import re
    tok = re.compile(r'[MCZ]|-?\d*\.?\d+')
    out = []
    for t in tok.findall(d):
        if t in 'MCZ':
            out.append(t)
        else:
            out.append(t)
    # Rebuild numerically instead: walk the token list and shift coordinates.
    toks = tok.findall(d)
    res = []
    i = 0
    while i < len(toks):
        t = toks[i]
        if t == 'M':
            res.append(f'M{float(toks[i+1])+dx:.2f} {float(toks[i+2])+dy:.2f}')
            i += 3
        elif t == 'C':
            pts = []
            for k in range(3):
                pts.append((float(toks[i+1+2*k])+dx, float(toks[i+2+2*k])+dy))
            res.append('C' + ' '.join(f'{x:.2f} {y:.2f}' for x, y in pts))
            i += 7
        elif t == 'Z':
            res.append('Z')
            i += 1
        else:
            i += 1
    return ''.join(res)



def svg_document(width, height, layers, title):
    """Build an SVG document string from positioned path layers."""
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:g} {height:g}" '
        f'width="{width:g}" height="{height:g}" role="img" aria-label="{title}">',
        f'  <title>{title}</title>',
    ]
    for d, fill in layers:
        parts.append(f'  <path fill="{fill}" d="{d}"/>')
    parts.append('</svg>')
    return '\n'.join(parts) + '\n'


def write_svg(name, width, height, layers, title):
    path = os.path.join(OUT, name)
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(svg_document(width, height, layers, title))
    print(f'  wrote {name} ({width:g}x{height:g})')
    return path



def render_png(svg_path, png_path, size):
    """Rasterise an SVG file to a square PNG with Chrome.

    The artwork keeps its own aspect ratio and is centred on a transparent
    square, so nothing is stretched. Chrome is the renderer that draws the
    logo in the browser, so the bitmap and the vector agree by construction.
    """
    import subprocess
    import tempfile

    chrome = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    with tempfile.TemporaryDirectory() as tmp:
        html = os.path.join(tmp, 'page.html')
        with open(html, 'w', encoding='utf-8') as fh:
            fh.write(
                '<!doctype html><meta charset="utf-8">'
                '<style>html,body{margin:0;padding:0;background:transparent;'
                'height:100%;overflow:hidden}'
                'body{display:flex;align-items:center;justify-content:center}'
                'img{display:block;max-width:100%;max-height:100%}</style>'
                '<img src="file:///' + svg_path.replace('\\', '/') + '">'
            )
        out = os.path.join(tmp, 'shot.png')
        subprocess.run(
            [chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars',
             '--default-background-color=00000000',
             '--force-device-scale-factor=2',
             '--window-size=1000,1000', f'--screenshot={out}', html],
            check=True, capture_output=True,
        )
        im = Image.open(out).convert('RGBA')
        # The screenshot is 2000x2000 at scale 2; fit the artwork onto a
        # square canvas without ever scaling one axis more than the other.
        canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        scale = min(size / im.width, size / im.height)
        w, h = max(1, round(im.width * scale)), max(1, round(im.height * scale))
        canvas.paste(im.resize((w, h), Image.LANCZOS),
                     ((size - w) // 2, (size - h) // 2))
        canvas.save(png_path)
    print(f'  wrote {os.path.basename(png_path)} ({size}x{size})')



def to_dart_path(d, precision=2):
    """Convert an SVG `d` into a Dart `Path` construction.

    `Path.parse` does not exist in the pinned Flutter version, so the path
    data is emitted as Dart statements. The SVG stays the source of truth and
    this file is generated from it.
    """
    toks = re.findall(r'[MCZ]|-?\d*\.?\d+', d)
    out = []
    i = 0
    while i < len(toks):
        t = toks[i]
        if t == 'M':
            out.append(f'..moveTo({float(toks[i+1]):.{precision}f}, {float(toks[i+2]):.{precision}f})')
            i += 3
        elif t == 'C':
            c1 = (float(toks[i+1]), float(toks[i+2]))
            c2 = (float(toks[i+3]), float(toks[i+4]))
            e = (float(toks[i+5]), float(toks[i+6]))
            out.append(
                f'..cubicTo({c1[0]:.{precision}f}, {c1[1]:.{precision}f}, '
                f'{c2[0]:.{precision}f}, {c2[1]:.{precision}f}, '
                f'{e[0]:.{precision}f}, {e[1]:.{precision}f})'
            )
            i += 7
        elif t == 'Z':
            out.append('..close()')
            i += 1
        else:
            i += 1
    return '\n      '.join(out)


def to_ts_path(d, indent=6):
    """Convert an SVG `d` into a JSX `d` attribute string."""
    toks = re.findall(r'[MCZ]|-?\d*\.?\d+', d)
    out = []
    i = 0
    while i < len(toks):
        t = toks[i]
        if t == 'M':
            out.append(f'M{float(toks[i+1]):.2f} {float(toks[i+2]):.2f}')
            i += 3
        elif t == 'C':
            pts = [float(toks[i + 1 + k]) for k in range(6)]
            out.append('C' + ' '.join(f'{v:.2f}' for v in pts))
            i += 7
        elif t == 'Z':
            out.append('Z')
            i += 1
        else:
            i += 1
    return ' '.join(out)


def write_tsx(sym, sx0, sy0):
    """Write the admin-panel React logo component."""
    sage = to_ts_path(translate(sym['sage']['d'], -sx0, -sy0))
    teal = to_ts_path(translate(sym['teal']['d'], -sx0, -sy0))
    tsx = f'''import {{ cn }} from '@/lib/utils/cn';

/**
 * The official Boya mark.
 *
 * The path data is generated from `design_system/brand/boya-symbol.svg`, so
 * the panel needs no SVG loader and the mark stays crisp at any pixel
 * density. The two inks are painted in the order of the original artwork: the
 * petrol teal wave sits on top of the sage one.
 */
const SAGE_PATH =
  '{sage}';

const TEAL_PATH =
  '{teal}';

export function BoyaLogo({{
  className,
  title = 'بویا',
}}: {{
  className?: string;
  title?: string;
}}) {{
  return (
    <svg
      viewBox="0 0 730 491"
      role="img"
      aria-label={{title}}
      className={{cn('h-auto w-full', className)}}
    >
      <title>{{title}}</title>
      <path fill="#8A9684" d={{SAGE_PATH}} />
      <path fill="#133E3E" d={{TEAL_PATH}} />
    </svg>
  );
}}
'''
    path = os.path.join(TOOLS, '..', '..', 'admin-panel', 'src', 'components', 'ui', 'BoyaLogo.tsx')
    with open(path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write(tsx)
    print(f'  wrote {path}')


def main():
    os.makedirs(OUT, exist_ok=True)

    full = classify(rf'{SRC}\src_full.jpg')

    print('building brand assets')

    # --- Symbol only ----------------------------------------------------------
    sym = paths_for_band(full, FULL_SYMBOL)
    sx0, sy0, sx1, sy1 = bbox_of(sym)
    sw, sh = sx1 - sx0, sy1 - sy0
    sym_layers = [
        (translate(sym['sage']['d'], -sx0, -sy0), SAGE),
        (translate(sym['teal']['d'], -sx0, -sy0), TEAL),
    ]
    symbol_svg = write_svg('boya-symbol.svg', sw, sh, sym_layers, 'Boya')
    for size in (16, 32, 192, 512):
        render_png(symbol_svg, os.path.join(OUT, f'boya-symbol-{size}.png'), size)

    # --- Horizontal lockup: symbol + بویا, side by side ------------------------
    persian = paths_for_band(full, FULL_PERSIAN)
    px0, py0, px1, py1 = bbox_of(persian)
    gap = 28.0
    h_total_w = sw + gap + (px1 - px0)
    h_total_h = max(sh, py1 - py0)
    h_layers = [
        (translate(sym['sage']['d'], -sx0, h_total_h / 2 - (sy0 + sy1) / 2), SAGE),
        (translate(sym['teal']['d'], -sx0, h_total_h / 2 - (sy0 + sy1) / 2), TEAL),
        (translate(persian['sage']['d'], sw + gap - px0, h_total_h / 2 - (py0 + py1) / 2), SAGE),
        (translate(persian['teal']['d'], sw + gap - px0, h_total_h / 2 - (py0 + py1) / 2), TEAL),
    ]
    write_svg('boya-logo-horizontal.svg', h_total_w, h_total_h, h_layers, 'Boya')

    # --- Vertical lockup: symbol + بویا + BÖYÂ, stacked -----------------------
    latin2 = paths_for_band(full, FULL_LATIN)
    lx0, ly0, lx1, ly1 = bbox_of(latin2)

    v_gap1 = 28.0
    v_gap2 = 20.0
    v_w = max(sw, px1 - px0, lx1 - lx0)
    v_h = sh + v_gap1 + (py1 - py0) + v_gap2 + (ly1 - ly0)
    v_layers = [
        (translate(sym['sage']['d'], v_w / 2 - (sx0 + sx1) / 2, -sy0), SAGE),
        (translate(sym['teal']['d'], v_w / 2 - (sx0 + sx1) / 2, -sy0), TEAL),
        (translate(persian['sage']['d'], v_w / 2 - (px0 + px1) / 2, sh + v_gap1 - py0), SAGE),
        (translate(persian['teal']['d'], v_w / 2 - (px0 + px1) / 2, sh + v_gap1 - py0), TEAL),
        (translate(latin2['sage']['d'], v_w / 2 - (lx0 + lx1) / 2,
                   sh + v_gap1 + (py1 - py0) + v_gap2 - ly0), SAGE),
        (translate(latin2['teal']['d'], v_w / 2 - (lx0 + lx1) / 2,
                   sh + v_gap1 + (py1 - py0) + v_gap2 - ly0), TEAL),
    ]
    write_svg('boya-logo-vertical.svg', v_w, v_h, v_layers, 'Boya')

    # --- Flutter widget source: the same paths, as Dart ------------------------
    dart = [
        "import 'package:flutter/material.dart';",
        '',
        "import '../theme/boya_colors.dart';",
        '',
        '/// Generated from `design_system/brand/boya-symbol.svg`. Do not edit by hand.',
        '///',
        '/// The official Boya mark: a dual-tone organic wave drawn with cubic',
        '/// beziers. It is kept as vector paths rather than a bitmap so it stays',
        '/// crisp on any pixel density.',
        'class BoyaLogo extends StatelessWidget {',
        '  const BoyaLogo({super.key, this.size = 80});',
        '',
        '  /// Height of the mark in logical pixels.',
        '  final double size;',
        '',
        '  @override',
        '  Widget build(BuildContext context) {',
        '    return CustomPaint(',
        '      size: Size(size * _aspect, size),',
        '      painter: const _BoyaLogoPainter(),',
        '    );',
        '  }',
        '',
        '  /// Width/height of the mark, taken from the SVG viewBox.',
        '  static const double _aspect = 730 / 491;',
        '}',
        '',
        '/// Paints the mark. The two inks are drawn in the order of the original',
        '/// artwork, so the petrol teal wave sits on top of the sage one.',
        'class _BoyaLogoPainter extends CustomPainter {',
        '  const _BoyaLogoPainter();',
        '',
        '  @override',
        '  void paint(Canvas canvas, Size size) {',
        '    final scale = size.height / 491;',
        '    canvas.scale(scale);',
        '    canvas.drawPath(',
        '      Path()',
        '        ' + to_dart_path(translate(sym['sage']['d'], -sx0, -sy0)) + ',',
        '      Paint()..color = BoyaColors.sage,',
        '    );',
        '    canvas.drawPath(',
        '      Path()',
        '        ' + to_dart_path(translate(sym['teal']['d'], -sx0, -sy0)) + ',',
        '      Paint()..color = BoyaColors.primary,',
        '    );',
        '  }',
        '',
        '  @override',
        '  bool shouldRepaint(covariant _BoyaLogoPainter oldDelegate) => false;',
        '}',
    ]
    dart_path = os.path.join(OUT, 'boya_logo.dart')
    with open(dart_path, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(dart) + '\n')
    print(f'  wrote {dart_path}')

    write_tsx(sym, sx0, sy0)


if __name__ == '__main__':
    main()
