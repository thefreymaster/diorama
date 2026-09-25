"""05 Pop-up map: a folded paper map lying open on a table, with a mountain
and a few buildings standing up from it like the pages of a pop-up book."""

import math

from iconkit import Group, Layer, Point, Svg, dark_fill, ic_linear, tinted_opacity, write_bundle

Vec = tuple[float, float, float]

# The map lies on the table (x across, z towards you, y up), folded like an
# accordion: the outer edges and the middle crease are raised a little.
FOLD_X = [-1.0, -0.5, 0.0, 0.5, 1.0]
FOLD_Y = [0.07, 0.0, 0.07, 0.0, 0.07]
Z_BACK, Z_FRONT = -0.62, 0.80

# A simple pinhole camera looking down at the map.
EYE: Vec = (0.0, 2.7, 3.1)
TARGET: Vec = (0.0, 0.32, 0.0)
SCALE, CENTRE_X, CENTRE_Y = 1340.0, 512.0, 498.0


def _sub(a: Vec, b: Vec) -> Vec:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _dot(a: Vec, b: Vec) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _norm(a: Vec) -> Vec:
    n = math.sqrt(_dot(a, a))
    return (a[0] / n, a[1] / n, a[2] / n)


def _cross(a: Vec, b: Vec) -> Vec:
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


FWD = _norm(_sub(TARGET, EYE))
RIGHT = _norm(_cross(FWD, (0.0, 1.0, 0.0)))
UP = _cross(RIGHT, FWD)


def project(p: Vec) -> Point:
    d = _sub(p, EYE)
    z = _dot(d, FWD)
    return (CENTRE_X + SCALE * _dot(d, RIGHT) / z, CENTRE_Y - SCALE * _dot(d, UP) / z)


def fold_y(x: float) -> float:
    x = min(max(x, -1.0), 1.0)
    i = min(int((x + 1) / 0.5), 3)
    t = (x - FOLD_X[i]) / 0.5
    return FOLD_Y[i] + (FOLD_Y[i + 1] - FOLD_Y[i]) * t


def on_map(x: float, z: float) -> Point:
    return project((x, fold_y(x), z))


def dense(pts: list[tuple[float, float]], steps: int = 24) -> list[tuple[float, float]]:
    out: list[tuple[float, float]] = []
    for (x0, z0), (x1, z1) in zip(pts, pts[1:]):
        out += [(x0 + (x1 - x0) * k / steps, z0 + (z1 - z0) * k / steps) for k in range(steps)]
    return out + [pts[-1]]


def strip(pts: list[tuple[float, float]], width: float) -> list[Point]:
    """A band printed on the map along an (x, z) polyline, following the folds."""
    d = dense(pts)
    return [on_map(x, z - width / 2) for x, z in d] + [on_map(x, z + width / 2) for x, z in reversed(d)]


def area(x0: float, z0: float, x1: float, z1: float) -> list[Point]:
    return [on_map(x, z) for x, z in dense([(x0, z0), (x1, z0), (x1, z1), (x0, z1), (x0, z0)])]


def paper(shaded: bool) -> Svg:
    """Two of the four panels: the ones facing the light, or the ones turned away."""
    s = Svg()
    for i in range(4):
        if (i % 2 == 1) == shaded:
            x0, x1 = FOLD_X[i], FOLD_X[i + 1]
            s.poly([on_map(x0, Z_BACK), on_map(x1, Z_BACK), on_map(x1, Z_FRONT), on_map(x0, Z_FRONT)], "#E9E1D2" if shaded else "#FFFFFF")
    return s


def print_layer() -> Svg:
    """What's printed on the map: parks, a river and roads."""
    s = Svg()
    s.poly(area(-0.94, -0.56, -0.40, -0.02), "#A3DE8E")  # parks
    s.poly(area(0.58, 0.34, 0.94, 0.74), "#A3DE8E")
    s.poly(strip([(-1.0, 0.52), (-0.5, 0.40), (0.0, 0.58), (0.5, 0.42), (1.0, 0.26)], 0.13), "#6FB6FF")  # river
    s.poly(strip([(-1.0, -0.12), (1.0, -0.12)], 0.05), "#FFC266")  # roads
    for x in (-0.25, 0.25):
        s.poly([on_map(x - 0.02, Z_BACK), on_map(x + 0.02, Z_BACK), on_map(x + 0.02, Z_FRONT), on_map(x - 0.02, Z_FRONT)], "#FFC266")
    return s


def card(s: Svg, x: float, z: float, outline: list[tuple[float, float]], fill: str) -> None:
    """A flat pop-up card standing at (x, z); outline points are (dx, height) in world units."""
    y0 = fold_y(x)
    s.poly([project((x + dx, y0 + h, z)) for dx, h in outline], fill)


def rect_card(s: Svg, x: float, z: float, w: float, h: float, fill: str) -> None:
    card(s, x, z, [(-w / 2, 0), (w / 2, 0), (w / 2, h), (-w / 2, h)], fill)


def windows(s: Svg, x: float, z: float, w: float, h0: float, h1: float, cols: int, rows: int, fill: str, pad: float = 0.045) -> None:
    gx, gy = 0.035, 0.035
    ww = (w - 2 * pad - (cols - 1) * gx) / cols
    wh = (h1 - h0 - 2 * pad - (rows - 1) * gy) / rows
    for r in range(rows):
        for c in range(cols):
            x0 = x - w / 2 + pad + c * (ww + gx)
            y0 = h0 + pad + r * (wh + gy)
            card(s, x, z, [(x0 - x, y0), (x0 - x + ww, y0), (x0 - x + ww, y0 + wh), (x0 - x, y0 + wh)], fill)


def cards() -> Svg:
    """The pop-up pieces, drawn back to front."""
    s = Svg()
    # mountain, back left
    x, z = -0.50, -0.30
    card(s, x, z, [(-0.40, 0), (-0.02, 0.70), (0.38, 0)], "#7F95BA")
    card(s, x, z, [(-0.02, 0.70), (0.38, 0), (0.09, 0)], "#667DA6")
    card(s, x, z, [(-0.02, 0.70), (0.098, 0.48), (0.035, 0.515), (-0.01, 0.45), (-0.07, 0.505), (-0.143, 0.48)], "#FFFFFF")
    # pine, back right
    x, z = 0.72, -0.26
    rect_card(s, x, z, 0.04, 0.08, "#7A5A43")
    card(s, x, z, [(-0.14, 0.06), (0.0, 0.54), (0.14, 0.06)], "#2B9A57")
    # tall white tower on the middle crease
    x, z = 0.04, -0.10
    rect_card(s, x, z, 0.31, 1.02, "#FFFFFF")
    for k in range(9):
        y = 0.15 + k * 0.096
        card(s, x, z, [(-0.11, y), (0.11, y), (0.11, y + 0.042), (-0.11, y + 0.042)], "#9DBCE6")
    # yellow block, front right
    x, z = 0.42, 0.14
    rect_card(s, x, z, 0.37, 0.60, "#FFC23D")
    windows(s, x, z, 0.37, 0.02, 0.60, 2, 4, "#FFF3CC", pad=0.05)
    # coral house with a gable, front left
    x, z = -0.30, 0.22
    rect_card(s, x, z, 0.40, 0.34, "#FF7F66")
    card(s, x, z, [(-0.235, 0.33), (0.0, 0.56), (0.235, 0.33)], "#E0563F")
    windows(s, x, z, 0.40, 0.11, 0.34, 3, 1, "#FFE0D8", pad=0.05)
    rect_card(s, x, z, 0.085, 0.13, "#8A3A2C")
    return s


def build(out: str) -> None:
    write_bundle(
        out,
        ic_linear("#FFC940", "#FF8A1F"),
        [
            Group("pop-ups", [Layer("pop-ups.svg", "pop-ups", cards())]),
            Group(
                "map",
                [
                    Layer("print.svg", "print", print_layer(), tinted_opacity(0.6)),
                    # in dark mode the paper turns graphite instead of glaring white
                    Layer("paper-lit.svg", "paper-lit", paper(False), {**dark_fill("#545458"), **tinted_opacity(0.55)}),
                    Layer("paper-shaded.svg", "paper-shaded", paper(True), {**dark_fill("#3A3A3C"), **tinted_opacity(0.45)}),
                ],
            ),
        ],
    )
