"""01 Glass dome: a tiny city inside a snow globe on a wooden base."""

from iconkit import (
    Group,
    Layer,
    Svg,
    arc_pts,
    block,
    crescent,
    ic_color,
    ic_linear,
    side_bands,
    window_bands,
    window_grid,
    write_bundle,
)

CX, CY, R = 512, 440, 300  # the glass sphere
TOP_Y, TOP_RX, TOP_RY = 700, 236, 38  # the base's top rim, where the globe sits
FLOOR_Y = 636  # the city's ground inside the globe


def city() -> Svg:
    s = Svg()
    d = (34, -20)
    # tall white tower, centre back
    block(s, 450, 554, FLOOR_Y + 10, 236, d, "#FFFFFF", "#C4D3EA", "#EEF3FB")
    window_bands(s, 450, 554, 272, 620, 16, 22, "#9DBCE6", inset=14)
    side_bands(s, 554, d, 272, 620, 16, 22, "#86A6D6")
    # coral mid-rise, right front
    block(s, 568, 676, FLOOR_Y + 30, 436, d, "#FF8A6A", "#E0664A", "#FFB39C")
    window_grid(s, 568, 676, 436, FLOOR_Y + 30, 2, 4, "#FFD4C4", pad=17, gx=14, gy=17)
    # yellow low-rise, left front
    block(s, 342, 456, FLOOR_Y + 30, 506, d, "#FFC94D", "#E4A52D", "#FFE08A")
    window_grid(s, 342, 456, 506, FLOOR_Y + 30, 3, 2, "#FFF0C2", pad=17, gx=12, gy=18)
    return s


def trees() -> Svg:
    s = Svg()
    for x, y, r in [(318, 628, 30), (714, 632, 25)]:
        s.rect(x - 5, y + r - 8, 10, 28, "#7A5A43", rx=5)
        s.circle(x, y, r, "#2E9E55")
        s.circle(x - r * 0.28, y - r * 0.28, r * 0.62, "#5CC66C")
    return s


def ground() -> Svg:
    s = Svg()
    clip = s.clip_circle(CX, CY, R - 2)  # the ground stops at the glass
    inner = Svg()
    rx, ry = 230, 36
    inner.rect(CX - rx, FLOOR_Y, 2 * rx, 140, "#3F9A55")  # the mound's side, down into the base
    inner.ellipse(CX, FLOOR_Y, rx, ry, "#7BD174")
    s.group(clip, inner)
    return s


def snow() -> Svg:
    s = Svg()
    for x, y, r in [(338, 330, 10), (420, 214, 8), (636, 226, 9), (708, 356, 11), (380, 450, 7), (300, 520, 7), (730, 500, 8)]:
        s.circle(x, y, r, "#FFFFFF")
    return s


def glass() -> Svg:
    s = Svg()
    s.circle(CX, CY, R, "#FFFFFF", 0.14)
    # the big window reflection, upper left
    s.poly(crescent(CX, CY, R - 22, 28, 32, R - 30), "#FFFFFF", 0.6)
    s.circle(CX + 168, CY - 186, 17, "#FFFFFF", 0.85)
    return s


def base() -> Svg:
    s = Svg()
    bot_y, bot_rx, bot_ry = 856, 268, 42
    # front of the base: from the near half of its top rim down to its foot
    body = arc_pts(CX, TOP_Y, TOP_RX, TOP_RY, 180, 0) + arc_pts(CX, bot_y, bot_rx, bot_ry, 0, 180)
    wood = s.lin_grad(CX - bot_rx, 0, CX + bot_rx, 0, [(0, "#C98450", 1), (0.5, "#A8623A", 1), (1, "#7E4426", 1)])
    s.poly(body, wood)
    # a lighter rim along the top edge
    rim = arc_pts(CX, TOP_Y, TOP_RX, TOP_RY, 180, 0) + arc_pts(CX, TOP_Y + 18, TOP_RX + 2, TOP_RY, 0, 180)
    s.poly(rim, "#E3A571")
    return s


def build(out: str) -> None:
    white = {"solid": ic_color("#FFFFFF")}
    write_bundle(
        out,
        ic_linear("#7D8BFF", "#4637D0"),
        [
            Group("base", [Layer("base.svg", "base", base())]),
            Group(
                "glass",
                [Layer("glass.svg", "glass", glass(), {"opacity-specializations": [{"value": 1.0}, {"appearance": "dark", "value": 0.35}]})],
                translucent=0.5,
                extra={"specular": True},
            ),
            Group(
                "city",
                [
                    # white-only layers turn the background colour in dark mode; snow stays white
                    Layer("snow.svg", "snow", snow(), {"fill-specializations": [{"appearance": "dark", "value": white}]}),
                    Layer("trees.svg", "trees", trees()),
                    Layer("buildings.svg", "buildings", city()),
                ],
            ),
            Group("ground", [Layer("ground.svg", "ground", ground())]),
        ],
    )
