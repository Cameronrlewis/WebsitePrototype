#!/usr/bin/env python3
"""Downscales and re-encodes oversized project media.

Several card images were shipping at their full export resolution - the worst
was 9968x5912 (59 MP, 15.6 MB) for a slot that renders at roughly 1260 CSS px.
This resizes them to a sane cap and re-encodes to WebP.

    python3 tools/optimize-media.py [--check]

Originals are moved to assets-src/media-originals/ on first run and read from
there afterwards, so the script is idempotent and never destroys a source.
--check reports what would happen without writing anything.

Long-edge cap is 2400 px: ProjectModal renders the hero up to ~1260 CSS px, so
this stays crisp at 2x device pixel ratio.
"""
import argparse
import io
import shutil
import sys
from pathlib import Path

try:
    from PIL import Image, ImageCms, ImageOps
except ImportError:
    sys.exit("Pillow is required: python3 -m pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "public/portfolio/assets/media/projects"
ORIGINALS = ROOT / "assets-src/media-originals"

MAX_EDGE = 2400
WEBP_QUALITY = 82

# Images referenced by portfolio.ts that ship far larger than they render.
RESIZE = [
    "aux-power-board-card.png",
    "brick-buck-board-card.jpg",
    "aux-power-hiccup-fix.jpg",
    "brick-buck-kart-testing.jpg",
]

# Zero references anywhere in src/ - kept as sources, not deployed.
ORPHANS = [
    "brick-buck-board-card.png",
    "aux-power-board-card-3d.png",
]


def mib(n):
    return f"{n / 1048576:.2f} MB"


def resolve_source(name):
    """Prefer the preserved original so repeat runs never recompress output."""
    archived = ORIGINALS / name
    if archived.exists():
        return archived, False
    live = MEDIA / name
    if live.exists():
        return live, True
    return None, False


def archive(live: Path, name: str):
    """Move a source into the archive, refusing to clobber a different file.

    Overwriting here would destroy the only remaining copy of whichever file
    loses, so a collision is an error rather than a silent replace.
    """
    target = ORIGINALS / name
    if target.exists():
        if target.stat().st_size == live.stat().st_size and target.read_bytes() == live.read_bytes():
            live.unlink()  # byte-identical, nothing to preserve
            return
        raise SystemExit(
            f"{name}: a different original is already archived at {target}.\n"
            f"Refusing to overwrite it - move or rename one of them by hand."
        )
    shutil.move(str(live), str(target))


def load_for_web(path: Path):
    """Open an image with its orientation applied and its colours in sRGB.

    Two things a naive open+convert silently drops:
      * EXIF orientation - phone photos store landscape pixels plus a rotate
        flag, so skipping this ships them sideways.
      * A wide-gamut ICC profile - reinterpreting Display P3 values as sRGB
        oversaturates everything. Converting is safer than forwarding the
        profile, since WebP ICC handling varies across decoders.
    """
    img = Image.open(path)
    img = ImageOps.exif_transpose(img)

    icc = img.info.get("icc_profile")
    if icc:
        try:
            source = ImageCms.ImageCmsProfile(io.BytesIO(icc))
            img = ImageCms.profileToProfile(
                img, source, ImageCms.createProfile("sRGB"), outputMode="RGB"
            )
            return img, True
        except Exception as error:  # noqa: BLE001 - fall back rather than fail the build
            print(f"    warning: could not convert ICC profile ({error}); using raw values")

    return img.convert("RGB"), False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="report only, write nothing")
    args = parser.parse_args()

    if not args.check:
        ORIGINALS.mkdir(parents=True, exist_ok=True)

    before = after = 0
    failures = []

    for name in RESIZE:
        source, needs_archive = resolve_source(name)
        if source is None:
            failures.append(f"{name}: not found in {MEDIA} or {ORIGINALS}")
            continue

        out = MEDIA / (Path(name).stem + ".webp")
        img, converted = load_for_web(source)
        # Size AFTER exif_transpose - the display orientation, not the stored one.
        src_w, src_h = img.size
        scale = min(1.0, MAX_EDGE / max(src_w, src_h))
        dst = (round(src_w * scale), round(src_h * scale))

        if args.check:
            img.close()
            print(f"  {name}: {src_w}x{src_h} {mib(source.stat().st_size)} -> {dst[0]}x{dst[1]} webp")
            continue

        img.resize(dst, Image.LANCZOS).save(out, "WEBP", quality=WEBP_QUALITY, method=6)
        img.close()

        original_size = source.stat().st_size
        after += out.stat().st_size

        # Archive only once the WebP exists. A live file is never deleted
        # outright: if someone drops an updated export back into public/, it
        # gets preserved rather than clobbered by the stale archived copy.
        if needs_archive:
            before += original_size
            archive(source, name)
        elif (MEDIA / name).exists():
            archive(MEDIA / name, name)

        note = "  [orientation+sRGB]" if converted else ""
        print(
            f"  {name:34s} {src_w}x{src_h} {mib(original_size):>9s} -> "
            f"{dst[0]}x{dst[1]} {mib(out.stat().st_size):>9s}  {out.name}{note}"
        )

    for name in ORPHANS:
        live = MEDIA / name
        if not live.exists():
            continue
        if args.check:
            print(f"  {name}: orphan, would move to assets-src/media-originals/")
            continue
        before += live.stat().st_size
        archive(live, name)
        print(f"  {name:34s} {'orphan (0 refs)':>28s} -> assets-src/media-originals/")

    if failures:
        for problem in failures:
            print(f"ERROR {problem}", file=sys.stderr)
        return 1

    if not args.check:
        if before:
            print(f"\ntotal {mib(before)} -> {mib(after)} in public/  ({mib(before - after)} removed)")
        else:
            # Everything was already archived, so nothing left public/ this run.
            print(f"\nregenerated {mib(after)} of WebP from archived originals (public/ unchanged)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
