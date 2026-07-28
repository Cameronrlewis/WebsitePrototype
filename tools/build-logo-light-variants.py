#!/usr/bin/env python3
"""Build white ("light") variants of the monochrome black experience logos.

The source marks are black ink on a fully transparent background, so they
disappear against the dark theme. This script rebuilds the RGB channels as
pure white while preserving the original alpha channel byte-for-byte, and
writes `<base>-light.png` next to each source.

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


def light_path(source: Path) -> Path:
    return source.with_name(f"{source.stem}{LIGHT_SUFFIX}{source.suffix}")


def build(source: Path, dry_run: bool) -> Path:
    with Image.open(source) as img:
        rgba = img.convert("RGBA")
        alpha = rgba.getchannel("A")
        white = Image.new("RGBA", rgba.size, (255, 255, 255, 0))
        white.putalpha(alpha)

    target = light_path(source)
    if dry_run:
        print(f"[check] would write {target.relative_to(REPO_ROOT)} ({white.size[0]}x{white.size[1]})")
        return target

    white.save(target, format="PNG", optimize=True)
    print(f"wrote {target.relative_to(REPO_ROOT)} ({white.size[0]}x{white.size[1]})")
    return target


def verify(source: Path, target: Path) -> bool:
    with Image.open(source) as s_img, Image.open(target) as t_img:
        src = s_img.convert("RGBA")
        dst = t_img.convert("RGBA")

        size_ok = src.size == dst.size
        alpha_ok = src.getchannel("A").tobytes() == dst.getchannel("A").tobytes()

        dst_alpha = dst.getchannel("A").tobytes()
        dst_r = dst.getchannel("R").tobytes()
        dst_g = dst.getchannel("G").tobytes()
        dst_b = dst.getchannel("B").tobytes()

        non_white = 0
        opaque = 0
        for i, a in enumerate(dst_alpha):
            if a > 0:
                opaque += 1
                if dst_r[i] != 255 or dst_g[i] != 255 or dst_b[i] != 255:
                    non_white += 1

    ok = size_ok and alpha_ok and non_white == 0
    print(
        f"verify {target.name}: size {src.size}->{dst.size} match={size_ok}; "
        f"alpha identical={alpha_ok}; pixels with alpha>0={opaque}; "
        f"of those non-white RGB={non_white} -> {'PASS' if ok else 'FAIL'}"
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
