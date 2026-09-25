"""04 Museum plinth: a model of a mountain and a few buildings on a white
display base, for curated cities and national parks alike."""

from iconkit import Group, Layer, Svg, block, dark_fill, tinted_opacity, ic_linear, side_bands, window_bands, window_grid, write_bundle

TOP = 636  # the model's ground: a green board on top of the plinth


# the white display plinth
PX0, PX1, P_TOP, P_BACK, P_FOOT = 206, 818, 700, 668, 842


def plinth_top() -> Svg:
    s = Svg()
    s.poly([(PX0, P_TOP), (PX1, P_TOP), (PX1 - 34, P_BACK), (PX0 + 34, P_BACK)], "#EDE8DF")
    return s


def plinth_front() -> Svg:
    s = Svg()
    front = s.lin_grad(0, P_TOP, 0, P_FOOT, [(0, "#FFFFFF", 1), (1, "#E4DFD5", 1)])
    s.rect(PX0, P_TOP, PX1 - PX0, P_FOOT - P_TOP, front)
    return s


def plinth_foot() -> Svg:
    s = Svg()
    s.rect(PX0 - 14, P_FOOT, PX1 - PX0 + 28, 26, "#D2CABD", rx=6)
    return s


def board() -> Svg:
    """The model's own base board, sitting on the plinth."""
    s = Svg()
    bx0, bx1 = 244, 780
    s.poly([(bx0, TOP + 30), (bx1, TOP + 30), (bx1 - 30, TOP - 6), (bx0 + 30, TOP - 6)], "#7CD072")
    s.rect(bx0, TOP + 30, bx1 - bx0, 24, "#3F945A")
    return s


def mountains() -> Svg:
    s = Svg()
    # far peak, right
    s.poly([(470, TOP), (596, 392), (736, TOP)], "#A9BCD8")
    s.poly([(596, 392), (736, TOP), (640, TOP)], "#90A6C8")
    s.poly([(596, 392), (624, 452), (606, 444), (592, 460), (576, 440), (566, 454)], "#FFFFFF")
    # main peak, left
    ax, ay = 400, 250
    lx, rx = 236, 604
    s.poly([(lx, TOP), (ax, ay), (rx, TOP)], "#8398BA")
    s.poly([(ax, ay), (rx, TOP), (446, TOP)], "#687FA6")  # shaded right face

    def on_left(y: float) -> float:
        return ax + (lx - ax) * (y - ay) / (TOP - ay)

    def on_right(y: float) -> float:
        return ax + (rx - ax) * (y - ay) / (TOP - ay)

    s.poly(
        [(ax, ay), (on_right(372), 372), (438, 356), (420, 384), (400, 360), (382, 386), (on_left(368), 368)],
        "#FFFFFF",
    )
    return s


def model() -> Svg:
    s = Svg()
    d = (30, -18)
    # white tower
    block(s, 578, 666, TOP + 10, 330, d, "#FFFFFF", "#C4D3EA", "#EEF3FB")
    window_bands(s, 578, 666, 360, TOP - 10, 14, 20, "#9DBCE6", inset=13)
    side_bands(s, 666, d, 360, TOP - 10, 14, 20, "#86A6D6")
    # coral mid-rise
    block(s, 684, 770, TOP + 14, 486, d, "#FF8A6A", "#E0664A", "#FFB39C")
    window_grid(s, 684, 770, 486, TOP + 14, 2, 3, "#FFD4C4", pad=15, gx=12, gy=15)
    # pines at the foot of the mountain
    for cx, base, h, w in [(282, TOP + 12, 150, 78), (352, TOP + 16, 118, 64), (486, TOP + 16, 100, 56)]:
        s.rect(cx - 6, base - 22, 12, 24, "#7A5A43", rx=4)
        s.poly([(cx, base - h), (cx + w / 2, base - 18), (cx - w / 2, base - 18)], "#2B9A57")
        s.poly([(cx, base - h), (cx + w * 0.36, base - h * 0.42), (cx - w * 0.36, base - h * 0.42)], "#48B96C")
    return s


def build(out: str) -> None:
    write_bundle(
        out,
        ic_linear("#22D38A", "#067A55"),
        [
            Group("model", [Layer("model.svg", "model", model())]),
            Group("mountains", [Layer("mountains.svg", "mountains", mountains())]),
            Group(
                "plinth",
                [
                    Layer("board.svg", "board", board()),
                    # in dark mode the plinth turns graphite instead of glaring white
                    Layer("plinth-top.svg", "plinth-top", plinth_top(), {**dark_fill("#636366"), **tinted_opacity(0.6)}),
                    Layer("plinth-front.svg", "plinth-front", plinth_front(), {**dark_fill("#3A3A3C"), **tinted_opacity(0.6)}),
                    Layer("plinth-foot.svg", "plinth-foot", plinth_foot(), {**dark_fill("#2C2C2E"), **tinted_opacity(0.6)}),
                ],
            ),
        ],
    )
