#!/usr/bin/env python3
"""Create Solina brand icons from the owner-provided screenshot without redrawing it."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "Screenshot_٢٠٢٦١١٢٨-١٤٠٤٤٢.png"
BRAND = ROOT / "assets" / "branding"
ANDROID = ROOT / "android" / "app" / "src" / "main" / "res"

def main():
    if not SOURCE.is_file():
        raise SystemExit(f"Source image not found: {SOURCE}")
    with Image.open(SOURCE) as original:
        image = original.convert("RGB")
    width, height = image.size
    if width < 256 or height < width:
        raise SystemExit(f"Unexpected source dimensions: {width}x{height}")
    # The supplied phone screenshot has the artwork in the central purple panel.
    # Remove the top status/toolbar and bottom navigation/black letterboxing.
    top = round(height * 0.15625)
    bottom = top + width
    if bottom > height:
        raise SystemExit("Artwork crop exceeds source image bounds")
    artwork = image.crop((0, top, width, bottom)).convert("RGB")
    BRAND.mkdir(parents=True, exist_ok=True)
    for size, name in [(1024, "solina-icon-master.png"), (512, "solina-icon-512.png"),
                       (192, "solina-icon-192.png"), (180, "apple-touch-icon.png"),
                       (32, "favicon-32.png")]:
        artwork.resize((size, size), Image.Resampling.LANCZOS).save(BRAND / name, optimize=True)
    density_sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for density, size in density_sizes.items():
        folder = ANDROID / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        icon = artwork.resize((size, size), Image.Resampling.LANCZOS)
        icon.save(folder / "ic_launcher.png", optimize=True)
        icon.save(folder / "ic_launcher_round.png", optimize=True)
    print(f"Created square Solina artwork from {SOURCE.name}: {width}x{height} -> {width}x{width}")
    
if __name__ == "__main__":
    main()
