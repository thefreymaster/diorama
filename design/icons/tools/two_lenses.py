"""03 Two lenses: two round eye windows side by side, each showing the same
little city, like the app's two-eye view in a headset."""

from iconkit import Group, Layer, Svg, block, crescent, ic_linear, tinted_opacity, side_bands, window_bands, window_grid, write_bundle

R = 206
EYES = [(292, 512), (732, 512)]  # lens centres
K = R / 190  # the scene below is drawn for a 190-point lens
PARALLAX = 8  # near buildings sit a little further in on each eye, as in stereo


def scene() -> Svg:
    """Sky, a far mountain and the ground inside each lens."""
    s = Svg()
    for cx, cy in EYES:
        inner = Svg()
        sky = s.lin_grad(0, cy - R, 0, cy + 40 * K, [(0, "#4FB3FF", 1), (1, "#CDEEFF", 1)])
        inner.rect(cx - R, cy - R, 2 * R, 2 * R, sky)
        # a far peak on the horizon: cities and national parks
        def pt(x: float, y: float) -> tuple[float, float]:
            return (cx + x * K, cy + y * K)

        inner.poly([pt(-190, 70), pt(-86, -54), pt(-46, -18), pt(10, -76), pt(190, 70)], "#9DBBE6")
        inner.poly([pt(-86, -54), pt(-60, -24), pt(-80, -30), pt(-104, -30)], "#FFFFFF")
        inner.poly([pt(10, -76), pt(42, -40), pt(14, -46), pt(-14, -40)], "#FFFFFF")
        inner.rect(cx - R, cy + 56 * K, 2 * R, R, "#6FCB6A")
        inner.rect(cx - R, cy + 56 * K, 2 * R, 10 * K, "#9BE08E")
        s.group(s.clip_circle(cx, cy, R), inner)
    return s


def city() -> Svg:
    s = Svg()
    d = (22 * K, -13 * K)
    for i, (cx, cy) in enumerate(EYES):
        p = PARALLAX if i == 0 else -PARALLAX

        def x(v: float) -> float:
            return cx + v * K + p

        def y(v: float) -> float:
            return cy + v * K

        inner = Svg()
        g = 96  # ground line of the buildings
        # tall white tower
        block(inner, x(-36), x(36), y(g), y(-128), d, "#FFFFFF", "#C4D3EA", "#EEF3FB")
        window_bands(inner, x(-36), x(36), y(-102), y(g - 14), 10 * K, 15 * K, "#9DBCE6", inset=10 * K)
        side_bands(inner, x(36), d, y(-102), y(g - 14), 10 * K, 15 * K, "#86A6D6", inset=5 * K)
        # coral block, right
        block(inner, x(44), x(112), y(g + 12), y(-8), d, "#FF8A6A", "#E0664A", "#FFB39C")
        window_grid(inner, x(44), x(112), y(-8), y(g + 12), 2, 3, "#FFD4C4", pad=11 * K, gx=9 * K, gy=11 * K)
        # yellow block, left
        block(inner, x(-114), x(-46), y(g + 12), y(18), d, "#FFC94D", "#E4A52D", "#FFE08A")
        window_grid(inner, x(-114), x(-46), y(18), y(g + 12), 2, 2, "#FFF0C2", pad=11 * K, gx=9 * K, gy=12 * K)
        s.group(s.clip_circle(cx, cy, R), inner)
    return s


def lenses() -> Svg:
    s = Svg()
    for cx, cy in EYES:
        s.add(f'<circle cx="{cx}" cy="{cy}" r="{R - 8}" fill="none" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="16"/>')
        s.poly(crescent(cx, cy, R - 26, 16, 20, R - 30), "#FFFFFF", 0.45)
    return s


def build(out: str) -> None:
    write_bundle(
        out,
        ic_linear("#55555C", "#1C1C20"),
        [
            Group("lenses", [Layer("lenses.svg", "lenses", lenses())], translucent=0.4, extra={"specular": True}),
            Group("city", [Layer("city.svg", "city", city())]),
            Group("view", [Layer("view.svg", "view", scene(), tinted_opacity(0.45))], shadow="none"),
        ],
    )
