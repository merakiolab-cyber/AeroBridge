"""Copies the curated Midjourney concept-art selection into demo/art (resized, JPEG).

Usage: python scripts/demo/select_art.py <midjourney_root>
"""
import glob, os, sys
from PIL import Image

ROOT = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "demo", "art")

# (folder, index in sorted listing, output name)
PICKS = [
    ("80s scify", 0, "moto_white"),
    ("80s scify", 1, "moto_yellow"),
    ("80s scify", 14, "highland_gathering"),
    ("80s scify", 16, "red_agent"),
    ("80s scify", 17, "clone_corridor"),
    ("80s scify", 20, "pilot_orange"),
    ("80s scify", 21, "scout_orange"),
    ("80s scify", 22, "council_dome"),
    ("80s scify", 25, "obelisk_painting"),
    ("80s scify", 26, "mantis_painting"),
    ("80s scify", 27, "ruins_sketch"),
    ("80s scify", 28, "tower_sketch"),
    ("80s scify", 30, "lab_crew"),
    ("80s scify", 32, "red_banquet"),
    ("80s scify", 34, "red_hall_guards"),
    ("80s scify", 37, "transit_tunnel"),
    ("80s scify", 39, "visor_red"),
    ("80s scify", 42, "dusk_horizon"),
    ("80s scify", 43, "steam_vent"),
    ("80s scify", 44, "lab_synth"),
    ("80s scify", 47, "mask_choir"),
    ("80s scify", 48, "flooded_helmets"),
    ("80s scify", 50, "pod_racer"),
    ("80s scify", 52, "council_feast"),
    ("80s scify", 54, "desert_thrones"),
    ("80s scify", 56, "desert_oracle"),
    ("80s scify", 60, "broadcaster"),
]

os.makedirs(OUT, exist_ok=True)
for folder, idx, name in PICKS:
    files = sorted(p for p in glob.glob(os.path.join(ROOT, folder, "**", "*"), recursive=True)
                   if p.lower().endswith((".png", ".jpg", ".jpeg", ".webp")))
    im = Image.open(files[idx]).convert("RGB")
    im.thumbnail((1920, 1920), Image.LANCZOS)
    im.save(os.path.join(OUT, name + ".jpg"), quality=86, optimize=True, progressive=True)
    print(name, im.size)
