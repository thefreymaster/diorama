"""Small helpers for drawing icon layers as SVG and writing Icon Composer bundles.

Every layer is a full 1024 x 1024 SVG (same canvas as `assets/expo.icon`), so
Icon Composer places them without any offsets. Shapes are plain polygons,
circles and gradients: the subset CoreSVG (what Icon Composer uses) draws.
"""

from __future__ import annotations

import json
import math
import os
import shutil
from dataclasses import dataclass, field

Point = tuple[float, float]


# ---------------------------------------------------------------- colours


def hex_rgb(h: str) -> tuple[float, float, float]:
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255)


def ic_color(h: str, a: float = 1.0) -> str:
    """Icon Composer colour string, e.g. `srgb:0.26000,0.63000,1.00000,1.00000`."""
    r, g, b = hex_rgb(h)
    return f"srgb:{r:.5f},{g:.5f},{b:.5f},{a:.5f}"


def ic_linear(top: str, bottom: str, stop_y: float = 1.0) -> dict:
    """Vertical background gradient for icon.json."""
    return {
        "linear-gradient": [ic_color(top), ic_color(bottom)],
        "orientation": {"start": {"x": 0.5, "y": 0}, "stop": {"x": 0.5, "y": stop_y}},
    }


# ---------------------------------------------------------------- geometry


def f(v: float) -> str:
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def path_d(points: list[Point]) -> str:
    return "M" + " L".join(f"{f(x)},{f(y)}" for x, y in points) + " Z"


def arc_pts(cx: float, cy: float, rx: float, ry: float, a0: float, a1: float, n: int = 48) -> list[Point]:
    """Points on an ellipse from angle a0 to a1 (degrees, 0 = right, 90 = down)."""
    out = []
    for i in range(n + 1):
        t = math.radians(a0 + (a1 - a0) * i / n)
        out.append((cx + rx * math.cos(t), cy + ry * math.sin(t)))
    return out


def crescent(cx: float, cy: float, r: float, ox: float, oy: float, r2: float, n: int = 96) -> list[Point]:
    """Part of circle A (cx, cy, r) that lies outside circle B (cx+ox, cy+oy, r2)."""
    bx, by = cx + ox, cy + oy
    outer = []
    for i in range(n * 4):
        t = 2 * math.pi * i / (n * 4)
        x, y = cx + r * math.cos(t), cy + r * math.sin(t)
        outer.append(((x - bx) ** 2 + (y - by) ** 2 > r2 * r2, x, y, t))
    # rotate so the run of "outside" points is contiguous
    start = next(i for i in range(len(outer)) if outer[i][0] and not outer[i - 1][0])
    run = []
    i = start
    while outer[i % len(outer)][0]:
        run.append(outer[i % len(outer)])
        i += 1
    pts = [(x, y) for _, x, y, _ in run]
    # back along circle B, inside A
    ex, ey = pts[-1]
    sx, sy = pts[0]
    a_end = math.atan2(ey - by, ex - bx)
    a_start = math.atan2(sy - by, sx - bx)
    # go from end back to start the short way that stays inside A
    da = a_start - a_end
    while da > 0:
        da -= 2 * math.pi
    back = []
    for k in range(1, n):
        t = a_end + da * k / n
        back.append((bx + r2 * math.cos(t), by + r2 * math.sin(t)))
    # choose direction that stays inside circle A
    mid = back[len(back) // 2]
    if (mid[0] - cx) ** 2 + (mid[1] - cy) ** 2 > r * r:
        da += 2 * math.pi
        back = [(bx + r2 * math.cos(a_end + da * k / n), by + r2 * math.sin(a_end + da * k / n)) for k in range(1, n)]
    return pts + back


# ---------------------------------------------------------------- svg


class Svg:
    def __init__(self) -> None:
        self.defs: list[str] = []
        self.body: list[str] = []
        self._ids = 0

    def uid(self, prefix: str) -> str:
        self._ids += 1
        return f"{prefix}{self._ids}"

    def add(self, s: str) -> None:
        self.body.append(s)

    @staticmethod
    def _attrs(fill: str, opacity: float | None, extra: str) -> str:
        a = f' fill="{fill}"'
        if opacity is not None and opacity < 1:
            a += f' fill-opacity="{opacity:.3f}"'
        if extra:
            a += " " + extra
        return a

    def poly(self, pts: list[Point], fill: str, opacity: float | None = None, extra: str = "") -> None:
        self.add(f'<path d="{path_d(pts)}"{self._attrs(fill, opacity, extra)}/>')

    def rect(self, x: float, y: float, w: float, h: float, fill: str, rx: float = 0, opacity: float | None = None, extra: str = "") -> None:
        r = f' rx="{f(rx)}"' if rx else ""
        self.add(f'<rect x="{f(x)}" y="{f(y)}" width="{f(w)}" height="{f(h)}"{r}{self._attrs(fill, opacity, extra)}/>')

    def circle(self, cx: float, cy: float, r: float, fill: str, opacity: float | None = None, extra: str = "") -> None:
        self.add(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"{self._attrs(fill, opacity, extra)}/>')

    def ellipse(self, cx: float, cy: float, rx: float, ry: float, fill: str, opacity: float | None = None, extra: str = "") -> None:
        self.add(f'<ellipse cx="{f(cx)}" cy="{f(cy)}" rx="{f(rx)}" ry="{f(ry)}"{self._attrs(fill, opacity, extra)}/>')

    def lin_grad(self, x1: float, y1: float, x2: float, y2: float, stops: list[tuple[float, str, float]]) -> str:
        gid = self.uid("g")
        st = "".join(
            f'<stop offset="{o:.3f}" stop-color="{c}"' + (f' stop-opacity="{a:.3f}"' if a < 1 else "") + "/>" for o, c, a in stops
        )
        self.defs.append(
            f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}">{st}</linearGradient>'
        )
        return f"url(#{gid})"

    def rad_grad(self, cx: float, cy: float, r: float, stops: list[tuple[float, str, float]]) -> str:
        gid = self.uid("r")
        st = "".join(
            f'<stop offset="{o:.3f}" stop-color="{c}"' + (f' stop-opacity="{a:.3f}"' if a < 1 else "") + "/>" for o, c, a in stops
        )
        self.defs.append(f'<radialGradient id="{gid}" gradientUnits="userSpaceOnUse" cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}">{st}</radialGradient>')
        return f"url(#{gid})"

    def clip_circle(self, cx: float, cy: float, r: float) -> str:
        cid = self.uid("c")
        self.defs.append(f'<clipPath id="{cid}"><circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}"/></clipPath>')
        return f'clip-path="url(#{cid})"'

    def clip_path(self, pts: list[Point]) -> str:
        cid = self.uid("c")
        self.defs.append(f'<clipPath id="{cid}"><path d="{path_d(pts)}"/></clipPath>')
        return f'clip-path="url(#{cid})"'

    def group(self, attrs: str, inner: "Svg") -> None:
        self.defs.extend(inner.defs)
        self.add(f"<g {attrs}>" + "".join(inner.body) + "</g>")

    def text(self) -> str:
        defs = f"<defs>{''.join(self.defs)}</defs>\n" if self.defs else ""
        return (
            '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">\n'
            + defs
            + "\n".join("  " + b for b in self.body)
            + "\n</svg>\n"
        )


# ---------------------------------------------------------------- 2.5D blocks


def block(
    s: Svg,
    x0: float,
    x1: float,
    base: float,
    top: float,
    depth: tuple[float, float],
    front: str,
    side: str,
    roof: str,
) -> None:
    """A box seen from the front, with its right side and roof showing.

    `depth` is the (dx, dy) of the receding edge, e.g. (34, -20).
    """
    dx, dy = depth
    s.rect(x0, top, x1 - x0, base - top, front)
    s.poly([(x1, base), (x1 + dx, base + dy), (x1 + dx, top + dy), (x1, top)], side)
    s.poly([(x0, top), (x1, top), (x1 + dx, top + dy), (x0 + dx, top + dy)], roof)


def window_bands(s: Svg, x0: float, x1: float, y0: float, y1: float, band: float, gap: float, fill: str, inset: float = 12) -> None:
    y = y0
    while y + band <= y1:
        s.rect(x0 + inset, y, x1 - x0 - 2 * inset, band, fill)
        y += band + gap


def window_grid(s: Svg, x0: float, x1: float, y0: float, y1: float, cols: int, rows: int, fill: str, pad: float = 12, gx: float = 10, gy: float = 12) -> None:
    w = (x1 - x0 - 2 * pad - (cols - 1) * gx) / cols
    h = (y1 - y0 - 2 * pad - (rows - 1) * gy) / rows
    for r in range(rows):
        for c in range(cols):
            s.rect(x0 + pad + c * (w + gx), y0 + pad + r * (h + gy), w, h, fill, rx=2)


def side_bands(s: Svg, x1: float, depth: tuple[float, float], y0: float, y1: float, band: float, gap: float, fill: str, inset: float = 7) -> None:
    """Window bands on a receding side face (parallelograms)."""
    dx, dy = depth
    y = y0
    a, b = inset, dx - inset
    while y + band <= y1:
        s.poly(
            [
                (x1 + a, y + dy * a / dx),
                (x1 + b, y + dy * b / dx),
                (x1 + b, y + band + dy * b / dx),
                (x1 + a, y + band + dy * a / dx),
            ],
            fill,
        )
        y += band + gap


# ---------------------------------------------------------------- bundles


@dataclass
class Layer:
    file: str
    name: str
    svg: Svg | None = None  # None when the file is written some other way (e.g. a PNG)
    extra: dict = field(default_factory=dict)


@dataclass
class Group:
    name: str
    layers: list[Layer]
    shadow: str = "neutral"  # neutral | layer-color | none
    shadow_opacity: float = 0.5
    translucent: float | None = None  # None = opaque, else translucency value
    extra: dict = field(default_factory=dict)


def write_bundle(path: str, fill_light: dict, groups: list[Group], fill_dark: dict | None = None) -> None:
    """Writes an Icon Composer `.icon` bundle in the same format as assets/expo.icon."""
    if os.path.isdir(path):
        shutil.rmtree(path)
    os.makedirs(os.path.join(path, "Assets"))
    doc: dict = {}
    if fill_dark is None:
        doc["fill"] = fill_light
    else:
        # A background with its own dark look must list both as specializations.
        doc["fill-specializations"] = [{"value": fill_light}, {"appearance": "dark", "value": fill_dark}]
    doc["groups"] = []
    for g in groups:
        layers = []
        for layer in g.layers:
            if layer.svg is not None:
                with open(os.path.join(path, "Assets", layer.file), "w") as fh:
                    fh.write(layer.svg.text())
            entry = {"image-name": layer.file, "name": layer.name}
            entry.update(layer.extra)
            layers.append(entry)
        group: dict = {"layers": layers, "name": g.name}
        group["shadow"] = {"kind": g.shadow, "opacity": g.shadow_opacity}
        group["translucency"] = {"enabled": g.translucent is not None, "value": g.translucent if g.translucent is not None else 0.5}
        group.update(g.extra)
        doc["groups"].append(group)
    doc["supported-platforms"] = {"circles": ["watchOS"], "squares": "shared"}
    with open(os.path.join(path, "icon.json"), "w") as fh:
        json.dump(doc, fh, indent=2, sort_keys=True)
        fh.write("\n")


# ---------------------------------------------------------------- blurred PNG layers

_BLUR_BIN: str | None = None


def blurred_png(svg: Svg, out_png: str, y_a: float, r_a: float, y_b: float, r_b: float) -> None:
    """Rasterises `svg` and blurs it (radius r_a at y_a easing to r_b at y_b) into a PNG layer.

    Uses blur_layer.swift (Core Image), compiled once per run with `xcrun swiftc`.
    """
    import subprocess
    import tempfile

    global _BLUR_BIN
    here = os.path.dirname(os.path.abspath(__file__))
    tmp = os.path.join(tempfile.gettempdir(), "mini-cities-icons")
    os.makedirs(tmp, exist_ok=True)
    if _BLUR_BIN is None:
        _BLUR_BIN = os.path.join(tmp, "blur_layer")
        subprocess.run(["xcrun", "swiftc", "-O", os.path.join(here, "blur_layer.swift"), "-o", _BLUR_BIN], check=True)
    src = os.path.join(tmp, os.path.basename(out_png) + ".svg")
    with open(src, "w") as fh:
        fh.write(svg.text())
    subprocess.run([_BLUR_BIN, src, out_png, str(y_a), str(r_a), str(y_b), str(r_b)], check=True)


def dark_fill(h: str) -> dict:
    """Layer settings that paint the whole layer one colour in dark mode (keeps it from glaring)."""
    return {"fill-specializations": [{"appearance": "dark", "value": {"solid": ic_color(h)}}]}


def tinted_opacity(v: float) -> dict:
    """Layer settings that fade a background layer in the tinted look, so the subject stands out."""
    return {"opacity-specializations": [{"value": 1.0}, {"appearance": "tinted", "value": v}]}
