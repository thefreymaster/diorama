#!/usr/bin/env python3
"""Writes the icon concepts as Icon Composer bundles in design/icons/NN-name/.

    python3 design/icons/tools/build.py [concept-folder ...]
    design/icons/tools/render.sh          # PNG previews + contact sheet

Each concept lives in its own module next to this file; the SVG layers it
writes into the bundle are the real artwork (open the .icon in Icon Composer
to tweak glass, shadows or colours).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True  # keep __pycache__ out of the repo

import glass_dome  # noqa: E402
import tilt_shift  # noqa: E402
import two_lenses  # noqa: E402
import museum_plinth  # noqa: E402
import popup_map  # noqa: E402

ICONS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

CONCEPTS = {
    "01-glass-dome": ("glass-dome.icon", glass_dome.build),
    "02-tilt-shift": ("tilt-shift.icon", tilt_shift.build),
    "03-two-lenses": ("two-lenses.icon", two_lenses.build),
    "04-museum-plinth": ("museum-plinth.icon", museum_plinth.build),
    "05-popup-map": ("popup-map.icon", popup_map.build),
}


def main() -> None:
    only = set(sys.argv[1:])
    for folder, (bundle, build) in CONCEPTS.items():
        if only and folder not in only:
            continue
        os.makedirs(os.path.join(ICONS, folder), exist_ok=True)
        build(os.path.join(ICONS, folder, bundle))
        print("wrote", os.path.join(folder, bundle))


if __name__ == "__main__":
    main()
