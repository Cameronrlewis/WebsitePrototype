#!/usr/bin/env python3
"""Build white ("light") variants of the monochrome black experience logos.

The source marks are black ink on a fully transparent background, so they
disappear against the dark theme. This script rebuilds the RGB channels as
pure white while preserving the original alpha channel byte-for-byte, and
writes `<base>-light.png` next to each source.

The recolor is chroma-aware: saturated red detail (e.g. the kraken's eye) is
copied through verbatim instead of being flattened to white. See
RED_DELTA_THRESHOLD.

A naive invert is deliberately avoided: it would also flip the RGB of the
alpha-0 background and is sensitive to the ink not being exactly #000000.

Usage:
    python3 tools/build-logo-light-variants.py [--check]

Idempotent: re-running simply rewrites the same outputs.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
EXPERIENCE_DIR = REPO_ROOT / "public" / "portfolio" / "assets" / "media" / "experience"

SOURCES = [
    "kraken-logo.png",
    "kraken-marker.png",
    "paradigm-logo.png",
    "paradigm-marker.png",
]

LIGHT_SUFFIX = "-light"

# A pixel counts as "colored detail" (and is preserved verbatim) when its red
# channel exceeds both other channels by at least this much. Measured on
# kraken-logo.png: the red eye is exactly 332 px, all at delta >= 10, while the
# warmest neutral ink noise tops out at delta == 9 (179 px at delta 8-9,
# scattered across the whole mark). There is a clean empty gap between 9 and 10,
# so 10 is the lowest threshold that keeps the eye without dragging ink along.
RED_DELTA_THRESHOLD = 10


def light_path(source: Path) -> Path:
    return source.with_name(f"{source.stem}{LIGHT_SUFFIX}{source.suffix}")


def is_colored(r: int, g: int, b: int) -> bool:
    """True when the pixel carries enough red chroma to be intentional detail."""
    return r - max(g, b) >= RED_DELTA_THRESHOLD


def build(source: Path, dry_run: bool) -> Path:
    with Image.open(source) as img:
        rgba = img.convert("RGBA")

    pixels = list(rgba.getdata())
    out = []
    colored = 0
    neutral = 0
    for r, g, b, a in pixels:
        if a == 0:
            out.append((255, 255, 255, a))
            continue
        if is_colored(r, g, b):
            colored += 1
            out.append((r, g, b, a))
        else:
            neutral += 1
            out.append((255, 255, 255, a))

    white = Image.new("RGBA", rgba.size)
    white.putdata(out)

    target = light_path(source)
    label = (
        f"{target.relative_to(REPO_ROOT)} ({white.size[0]}x{white.size[1]}; "
        f"colored={colored} neutral={neutral})"
    )
    if dry_run:
        print(f"[check] would write {label}")
        return target

    white.save(target, format="PNG", optimize=True)
    print(f"wrote {label}")
    return target


def verify(source: Path, target: Path) -> bool:
    with Image.open(source) as s_img, Image.open(target) as t_img:
        src = s_img.convert("RGBA")
        dst = t_img.convert("RGBA")

        size_ok = src.size == dst.size
        alpha_ok = src.getchannel("A").tobytes() == dst.getchannel("A").tobytes()

        src_px = list(src.getdata())
        dst_px = list(dst.getdata())

        opaque = 0
        colored = 0
        neutral = 0
        colored_ok = 0
        neutral_ok = 0
        for (sr, sg, sb, sa), (dr, dg, db, _da) in zip(src_px, dst_px):
            if sa == 0:
                continue
            opaque += 1
            if is_colored(sr, sg, sb):
                colored += 1
                if (dr, dg, db) == (sr, sg, sb):
                    colored_ok += 1
            else:
                neutral += 1
                if (dr, dg, db) == (255, 255, 255):
                    neutral_ok += 1

    ok = (
        size_ok
        and alpha_ok
        and colored_ok == colored
        and neutral_ok == neutral
    )
    print(
        f"verify {target.name}: size {src.size}->{dst.size} match={size_ok}; "
        f"alpha identical={alpha_ok}; pixels with alpha>0={opaque}; "
        f"colored (delta>={RED_DELTA_THRESHOLD})={colored} preserved verbatim={colored_ok}; "
        f"neutral={neutral} forced pure white={neutral_ok} -> {'PASS' if ok else 'FAIL'}"
    )
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="report without writing")
    args = parser.parse_args()

    all_ok = True
    for name in SOURCES:
        source = EXPERIENCE_DIR / name
        if not source.exists():
            print(f"missing source: {source}", file=sys.stderr)
            all_ok = False
            continue
        target = build(source, args.check)
        if not args.check:
            all_ok = verify(source, target) and all_ok

    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
