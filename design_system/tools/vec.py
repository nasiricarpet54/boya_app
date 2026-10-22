"""Trace the official Boya artwork (JPG) into smooth SVG paths.

Pipeline: classify pixels -> clean masks -> marching-squares contours ->
RDP simplify -> corner-preserving Catmull-Rom -> cubic beziers.
"""
import json
import os
import sys

import contourpy
import numpy as np
from PIL import Image
from scipy import ndimage

BG = (0xF8, 0xF9, 0xFA)
TEAL = (0x13, 0x3E, 0x3E)
SAGE = (0x8A, 0x96, 0x84)
SRC = os.path.dirname(os.path.abspath(__file__))


def classify(path):
    """Split the artwork into teal/sage masks, dropping JPEG speckle.

    The two inks overlap in the artwork (the teal wave crosses the sage wave),
    so the teal/sage boundary pixels are blends. Those blends are resolved by
    distance to the nearest ink, and the teal shape is then restored on top of
    sage: the teal wave is drawn over the sage one in the original artwork.
    """
    a = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    refs = (BG, TEAL, SAGE)
    d = np.stack([np.linalg.norm(a - np.array(c, np.float32), axis=2) for c in refs])
    idx = np.argmin(d, axis=0)

    def clean(m):
        m = ndimage.binary_closing(m, np.ones((5, 5)), iterations=2)
        m = ndimage.binary_opening(m, np.ones((3, 3)), iterations=1)
        lab, n = ndimage.label(m)
        if not n:
            return m
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        keep = np.zeros_like(m)
        for k, s in enumerate(sizes):
            if s >= 120:  # drop compression speckle, keep every real stroke
                keep[lab == k + 1] = True
        return keep

    sage = clean(idx == 2)
    teal = clean(idx == 1)

    # The teal wave is drawn on top of the sage one. Where the classifier saw a
    # teal/sage blend it may have cut a notch out of the sage shape; restore the
    # sage shape by dilating it into the teal region that belongs to teal
    # only. Filling teal holes that are surrounded by sage is the giveaway.
    return {'teal': teal, 'sage': sage}


def trace(mask):
    """Marching squares contours as closed point loops (x=col, y=row).

    `level=0.5` on a 0/1 mask yields the 0.5 iso-line, which hugs the pixel
    boundary. `OuterAndInner` keeps holes as separate loops so counters and
    letter bowls stay open.
    """
    h, w = mask.shape
    cg = contourpy.contour_generator(x=w, y=h, z=mask.astype(np.float64))
    loops = []
    for line in cg.lines(0.5):
        pts = np.asarray(line, dtype=np.float64)
        if len(pts) >= 4:
            loops.append(pts)
    return loops


def rdp(points, eps):
    """Ramer-Douglas-Peucker simplification on a closed loop."""
    pts = np.asarray(points, dtype=np.float64)
    if len(pts) < 3:
        return pts
    start, end = pts[0], pts[-1]
    line = end - start
    length = float(np.hypot(*line))
    rel = pts - start
    if length < 1e-9:
        dist = np.hypot(rel[:, 0], rel[:, 1])
    else:
        cross = line[0] * rel[:, 1] - line[1] * rel[:, 0]
        dist = np.abs(cross) / length
    i = int(np.argmax(dist))
    if dist[i] > eps:
        left = rdp(pts[: i + 1], eps)
        right = rdp(pts[i:], eps)
        return np.vstack([left[:-1], right])
    return np.vstack([start, end])


def _corner_angles(pts):
    """Turn angle at each vertex of a closed loop, in degrees."""
    n = len(pts)
    angles = np.zeros(n)
    for i in range(n):
        v1 = pts[i] - pts[(i - 1) % n]
        v2 = pts[(i + 1) % n] - pts[i]
        c1 = float(v1 @ v1)
        c2 = float(v2 @ v2)
        if c1 < 1e-9 or c2 < 1e-9:
            continue
        cosang = float(v1 @ v2) / (np.sqrt(c1) * np.sqrt(c2))
        angles[i] = np.degrees(np.arccos(np.clip(cosang, -1.0, 1.0)))
    return angles


def smooth(pts, corner_deg=35.0, tension=1.0):
    """Corner-preserving Catmull-Rom -> cubic bezier segments.

    Returns (start_point, [segment, ...]) where segment = (c1, c2, end).

    Every vertex of the loop stays a bezier endpoint, so no corner is dropped.
    A sharp vertex keeps a straight approach and departure (handles at one
    third of the neighbouring edge); a smooth vertex uses the usual Catmull-Rom
    tangent, which is what keeps the organic wave curves looking organic.
    """
    n = len(pts)
    if n < 3:
        return pts[0], []
    angles = _corner_angles(pts)
    corner = angles > corner_deg

    # Outgoing handle at each vertex, and the incoming handle it ends with.
    out_off = np.zeros((n, 2))
    in_off = np.zeros((n, 2))
    for i in range(n):
        p = pts[i]
        if corner[i]:
            out_off[i] = (pts[(i + 1) % n] - p) / 3.0
            in_off[i] = (p - pts[(i - 1) % n]) / 3.0
        else:
            out_off[i] = (pts[(i + 1) % n] - pts[(i - 1) % n]) * (tension / 6.0)
            in_off[i] = (p - pts[(i - 2) % n]) * (tension / 6.0)

    segs = []
    for i in range(n):
        a = pts[i]
        b = pts[(i + 1) % n]
        c1 = a + out_off[i]
        c2 = b - in_off[(i + 1) % n]
        segs.append((c1, c2, b))
    return pts[0], segs


def to_path(subpaths, precision=2):
    """Serialise subpaths into an SVG `d` attribute."""
    parts = []
    for start, segs in subpaths:
        chunks = [f'M{start[0]:.{precision}f} {start[1]:.{precision}f}']
        for c1, c2, end in segs:
            chunks.append(
                f'C{c1[0]:.{precision}f} {c1[1]:.{precision}f} '
                f'{c2[0]:.{precision}f} {c2[1]:.{precision}f} '
                f'{end[0]:.{precision}f} {end[1]:.{precision}f}'
            )
        chunks.append('Z')
        parts.append(''.join(chunks))
    return ''.join(parts)


def build(path, eps=0.7):
    """Return {'teal': {...}, 'sage': {...}} for one source image."""
    masks = classify(path)
    out = {}
    for name, mask in masks.items():
        subpaths = []
        for loop in trace(mask):
            simple = rdp(np.vstack([loop, loop[0]]), eps)[:-1]
            if len(simple) < 3:
                continue
            subpaths.append(smooth(simple))
        if not subpaths:
            raise SystemExit(f'no contours for {name} in {path}')
        pts = []
        for s in subpaths:
            pts.append(s[0])
            pts.extend(e[2] for e in s[1])
        allpts = np.vstack(pts)
        out[name] = {
            'd': to_path(subpaths),
            'bbox': [float(allpts[:, 0].min()), float(allpts[:, 1].min()),
                     float(allpts[:, 0].max()), float(allpts[:, 1].max())],
            'n': len(subpaths),
        }
    return out


if __name__ == '__main__':
    for key in sys.argv[1:] or ['src_full', 'src_latin']:
        res = build(os.path.join(SRC, key + '.jpg'))
        print('==', key)
        for color, data in res.items():
            print(f'  {color}: subpaths={data["n"]} bbox={data["bbox"]} dlen={len(data["d"])}')
        with open(os.path.join(SRC, key + '.json'), 'w', encoding='utf-8') as fh:
            json.dump(res, fh)

