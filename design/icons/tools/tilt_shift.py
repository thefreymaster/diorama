"""02 Tilt-shift: a street of toy-like buildings, sharp in a middle band and
blurred above and below, like the app's miniature effect."""

import os

from iconkit import Group, Layer, Svg, blurred_png, ic_linear, window_bands, window_grid, write_bundle

STREET_Y = 690  # where the focused row of buildings meets the pavement


def far_row() -> Svg:
    s = Svg()
    towers = [
        (-30, 150, 290, "#A9C0E6"),
        (150, 300, 170, "#D8E3F5"),
        (300, 420, 250, "#9CB6E0"),
        (420, 600, 130, "#CCD9F0"),
        (600, 720, 230, "#A3BBE3"),
        (720, 880, 160, "#D3DFF3"),
        (880, 1054, 270, "#A9C0E6"),
    ]
    for x0, x1, top, c in towers:
        s.rect(x0, top, x1 - x0, 560 - top, c)
        window_bands(s, x0, x1, top + 30, 540, 16, 22, "#F2F6FC", inset=18)
    return s


def street_row() -> Svg:
    s = Svg()
    houses = [
        # x0, x1, facade top, facade, roof, windows, cols, rows (the tall white one is the focus)
        (-30, 212, 500, "#4FC89A", "#9FEACB", "#E2FFF3", 2, 3),
        (212, 412, 446, "#FF6F5C", "#FFB3A5", "#FFE3DC", 2, 3),
        (412, 612, 330, "#FFFFFF", "#D5E1F2", "#94B6E6", 2, 6),
        (612, 812, 430, "#FFC23D", "#FFE296", "#FFF5D1", 2, 4),
        (812, 1054, 492, "#5B9BFF", "#A6C9FF", "#DDEBFF", 2, 3),
    ]
    for x0, x1, top, facade, roof, win, cols, rows in houses:
        s.rect(x0, top - 40, x1 - x0, 40, roof)  # seen from above: the roof shows
        s.rect(x0, top, x1 - x0, STREET_Y - top, facade)
        window_grid(s, x0 + 8, x1 - 8, top + 4, STREET_Y - 70, cols, rows, win, pad=22, gx=24, gy=18)
        dw = 40
        s.rect((x0 + x1) / 2 - dw / 2, STREET_Y - 64, dw, 64, "#34435A", rx=5)
    s.rect(-30, STREET_Y, 1084, 30, "#F1F2F5")  # pavement
    return s


def near_row() -> Svg:
    s = Svg()
    s.rect(-40, STREET_Y + 30, 1104, 200, "#8A93A3")  # road
    for x in range(-40, 1060, 170):
        s.rect(x, 796, 96, 14, "#F5F5F7", rx=7)
    # cars
    for x0, y0, c, roof in [(150, 748, "#FF4A40", "#FF8A80"), (650, 772, "#FFC21F", "#FFE17A")]:
        s.rect(x0, y0, 210, 74, c, rx=26)
        s.rect(x0 + 40, y0 - 32, 130, 48, roof, rx=18)
        s.rect(x0 + 52, y0 - 24, 106, 28, "#CFE6FF", rx=9)
    # out-of-focus tree tops right in front of the lens
    for x, y, r, c in [(40, 930, 150, "#2E9A55"), (250, 980, 150, "#3DB064"), (480, 950, 140, "#2E9A55"),
                       (700, 990, 160, "#46BA6B"), (930, 940, 150, "#34A45B")]:
        s.circle(x, y, r, c)
        s.circle(x - r * 0.3, y - r * 0.35, r * 0.5, "#7BD88C", 0.7)
    return s


def build(out: str) -> None:
    write_bundle(
        out,
        ic_linear("#6FC1FF", "#D2EDFF", stop_y=0.55),
        fill_dark=ic_linear("#0B1A38", "#22406E", stop_y=0.6),
        groups=[
            Group("near", [Layer("near.png", "near", None, {"glass": False, "opacity-specializations": [{"value": 1.0}, {"appearance": "dark", "value": 0.7}, {"appearance": "tinted", "value": 0.6}]})], shadow="none"),
            Group("street", [Layer("street.svg", "street", street_row())]),
            Group("far", [Layer("far.png", "far", None, {"glass": False, "opacity-specializations": [{"value": 1.0}, {"appearance": "dark", "value": 0.55}, {"appearance": "tinted", "value": 0.45}]})], shadow="none"),
        ],
    )
    assets = os.path.join(out, "Assets")
    blurred_png(far_row(), os.path.join(assets, "far.png"), 480, 16, 130, 34)
    blurred_png(near_row(), os.path.join(assets, "near.png"), STREET_Y + 30, 14, 1000, 38)
