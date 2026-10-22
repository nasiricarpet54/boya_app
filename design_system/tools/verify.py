"""Rasterise the generated SVG paths and score them against the source art.

Renders with the same contourpy+fill routine used for tracing, so the score
measures the *path* quality (simplification + smoothing), not the renderer.
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw

import matplotlib
matplotlib.use('Agg')
from matplotlib.path import Path  # noqa: E402
from matplotlib.patches import PathPatch  # noqa: E402
from matplotlib.figure import Figure  # noqa: E402
from matplotlib.backends.backend_agg import FigureCanvasAgg  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vec import SRC, TEAL, SAGE, classify  # noqa: E402


_TOKEN = re.compile(r'[MCZ]|-?\d*\.?\d+(?:[eE][-+]?\d+)?')


def parse_path(d):
    """Parse an SVG `d` of M/C/Z into a list of point loops (flattened).

    Uses a real tokenizer rather than whitespace splitting: coordinates can be
    negative, and `C-10.5 3` must not be read as one token.
    """
    toks = _TOKEN.findall(d)
    loops = []
    cur = []
    i = 0
    while i < len(toks):
        t = toks[i]
        if t == 'M':
            if cur:
                loops.append(cur)
            cur = [(float(toks[i + 1]), float(toks[i + 2]))]
            i += 3
        elif t == 'C':
            p = [(float(toks[i + 1]), float(toks[i + 2])),
                 (float(toks[i + 3]), float(toks[i + 4])),
                 (float(toks[i + 5]), float(toks[i + 6]))]
            # Flatten the cubic with 16 samples per segment.
            x0, y0 = cur[-1]
            for j in range(16):
                u = j / 16.0
                v = 1 - u
                bx = v**3 * x0 + 3 * v**2 * u * p[0][0] + 3 * v * u**2 * p[1][0] + u**3 * p[2][0]
                by = v**3 * y0 + 3 * v**2 * u * p[0][1] + 3 * v * u**2 * p[1][1] + u**3 * p[2][1]
                cur.append((bx, by))
            cur.append(p[2])
            i += 7
        elif t == 'Z':
            if cur:
                loops.append(cur)
                cur = []
            i += 1
        else:
            i += 1
    if cur:
        loops.append(cur)
    return loops


def _signed_area(loop):
    """Shoelace area; positive means counter-clockwise in screen coords."""
    a = 0.0
    n = len(loop)
    for i in range(n):
        x1, y1 = loop[i]
        x2, y2 = loop[(i + 1) % n]
        a += x1 * y2 - x2 * y1
    return a / 2.0


def render(d, size):
    """Fill the path into a boolean mask using SVG's nonzero winding rule.

    Each `M...Z` subpath becomes one closed polygon. Outer loops and holes are
    wound by the tracer so that nonzero winding keeps the holes open, exactly
    like a browser renders the same `d`.
    """
    polys = parse_path(d)
    verts, codes = [], []
    for loop in polys:
        if len(loop) < 3:
            continue
        # CLOSEPOLY ignores its vertex but still needs one, so repeat the first.
        verts.extend(loop)
        verts.append(loop[0])
        codes.extend([Path.MOVETO] + [Path.LINETO] * (len(loop) - 1) + [Path.CLOSEPOLY])
    if not verts:
        return np.zeros((size[1], size[0]), dtype=bool)
    path = Path(np.asarray(verts), np.asarray(codes))

    fig = Figure(figsize=(size[0] / 100.0, size[1] / 100.0), dpi=100)
    FigureCanvasAgg(fig)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.add_patch(PathPatch(path, facecolor='black', edgecolor='none'))
    ax.set_xlim(0, size[0])
    ax.set_ylim(size[1], 0)
    ax.set_axis_off()
    fig.canvas.draw()
    buf = np.asarray(fig.canvas.buffer_rgba())[:, :, 0] < 128
    return buf


def render_loops(loops, size):
    """Fill already-parsed loops (no SVG string round-trip)."""
    verts, codes = [], []
    for loop in loops:
        if len(loop) < 3:
            continue
        verts.extend(loop)
        verts.append(loop[0])
        codes.extend([Path.MOVETO] + [Path.LINETO] * (len(loop) - 1) + [Path.CLOSEPOLY])
    if not verts:
        return np.zeros((size[1], size[0]), dtype=bool)
    path = Path(np.asarray(verts), np.asarray(codes))
    fig = Figure(figsize=(size[0] / 100.0, size[1] / 100.0), dpi=100)
    FigureCanvasAgg(fig)
    ax = fig.add_axes([0, 0, 1, 1])
    ax.add_patch(PathPatch(path, facecolor='black', edgecolor='none'))
    ax.set_xlim(0, size[0])
    ax.set_ylim(size[1], 0)
    ax.set_axis_off()
    fig.canvas.draw()
    return np.asarray(fig.canvas.buffer_rgba())[:, :, 0] < 128


def iou(a, b):
    u = np.logical_or(a, b).sum()
    return (np.logical_and(a, b).sum() / u) if u else 0.0


def score(d, color, src_masks, size):
    """IoU of the rendered path against the source mask."""
    got = render(d, size)
    want = src_masks[color]
    inter = np.logical_and(got, want).sum()
    union = np.logical_or(got, want).sum()
    return inter / union if union else 0.0


if __name__ == '__main__':
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from vec import trace, rdp, smooth

    from PIL import Image

    for key in sys.argv[1:] or ['src_full', 'src_latin']:
        data = json.load(open(os.path.join(SRC, key + '.json'), encoding='utf-8'))
        masks = classify(os.path.join(SRC, key + '.jpg'))
        size = masks['teal'].shape[::-1]

        src = np.zeros(size, np.uint8)
        src[masks['sage']] = 1
        src[masks['teal']] = 2

        out = np.zeros(size, np.uint8)
        out[render(data['sage']['d'], size)] = 1
        out[render(data['teal']['d'], size)] = 2

        print(f'== {key} size={size}')
        print(f'  pixel-exact      : {(src == out).sum() / src.size:.4f}')
        for lbl, code in (('sage', 1), ('teal', 2)):
            a = src == code
            b = render(data[lbl]['d'], size)
            print(f'  {lbl:4s} mask IoU    : {iou(a, b):.4f} '
                  f'(src {a.sum()} px, path {b.sum()} px)')

        # Stage isolation on one colour: how much does each step cost?
        for lbl in ('sage', 'teal'):
            want = masks[lbl]
            raw = []
            for loop in trace(masks[lbl]):
                raw.append(np.vstack([loop, loop[0]])[:-1])
            m_raw = render_loops(raw, size)
            simp = [rdp(np.vstack([l, l[0]]), 0.7)[:-1] for l in raw]
            m_simp = render_loops(simp, size)
            sm = []
            for l in simp:
                s, segs = smooth(l)
                pts = [s] + [e[2] for e in segs]
                sm.append(pts)
            m_smooth = render_loops(sm, size)
            print(f'  {lbl:4s} stage IoU raw={iou(want, m_raw):.4f} '
                  f'rdp={iou(want, m_simp):.4f} smooth={iou(want, m_smooth):.4f}')
            d = np.full((size[1], size[0], 3), 255, np.uint8)
            d[want & ~m_smooth] = (220, 30, 30)
            d[m_smooth & ~want] = (30, 90, 220)
            d[want & m_smooth] = (30, 160, 90)
            Image.fromarray(d).save(os.path.join(SRC, f'{key}_{lbl}_maskdiff.png'))
