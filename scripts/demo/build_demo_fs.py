"""Builds the AeroBridge demo file system (demo/fs) used by the `?demo` dev mode.

Every file is a structurally valid file of its format, so the app's own extractors
produce the previews (PSD image resource 1036, Blender TEST block, Figma/Krita ZIP
thumbnails, PDF-compatible Illustrator, InDesign embedded JPEG, HTML render).

Usage: python scripts/demo/build_demo_fs.py   (requires Pillow + PyMuPDF, Edge for HTML boards)
"""
import base64, io, json, os, random, shutil, struct, subprocess, zipfile, zlib
from datetime import datetime, timedelta

import fitz
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
ART = os.path.join(REPO, "demo", "art")
FS = os.path.join(REPO, "demo", "fs")
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
FONTS = r"C:\Windows\Fonts"

rng = random.Random(7)
BASE_TIME = datetime(2026, 10, 16, 18, 0)


def font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name), size)


def art(name, max_side=None):
    im = Image.open(os.path.join(ART, name + ".jpg")).convert("RGB")
    if max_side:
        im.thumbnail((max_side, max_side), Image.LANCZOS)
    return im


def jpeg_bytes(im, q=85):
    b = io.BytesIO()
    im.convert("RGB").save(b, "JPEG", quality=q)
    return b.getvalue()


def png_bytes(im):
    b = io.BytesIO()
    im.save(b, "PNG", optimize=True)
    return b.getvalue()


def write(rel, data):
    path = os.path.join(FS, *rel.split("/"))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data if isinstance(data, bytes) else data.encode("utf-8"))


# ---------------------------------------------------------------- format writers

def make_psd(im):
    """Valid 8-bit RGB PSD mimicking a file saved with "Maximize Compatibility":
    image resource 1036 (160 px JPEG thumbnail), resource 1060 (XMP with a 256 px xmpGImg thumbnail)
    and the full flattened composite as RLE (PackBits) image data at the end of the file."""
    w, h = im.size

    small = im.copy()
    small.thumbnail((160, 160), Image.LANCZOS)
    t = jpeg_bytes(small, 86)
    tw, th = small.size
    widthbytes = (tw * 24 + 31) // 32 * 4
    res_data = struct.pack(">IIIIIIHH", 1, tw, th, widthbytes, widthbytes * th, len(t), 24, 1) + t
    if len(res_data) % 2:
        res_data += b"\0"
    resource_1036 = b"8BIM" + struct.pack(">H", 0x040C) + b"\0\0" + struct.pack(">I", len(res_data)) + res_data

    mid = im.copy()
    mid.thumbnail((256, 256), Image.LANCZOS)
    xmp = (
        '<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>'
        '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
        '<rdf:Description xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:xmpGImg="http://ns.adobe.com/xap/1.0/g/img/">'
        '<xmp:CreatorTool>Adobe Photoshop 2026 (Windows)</xmp:CreatorTool><xmp:Thumbnails><rdf:Alt>'
        f'<rdf:li rdf:parseType="Resource"><xmpGImg:width>{mid.width}</xmpGImg:width><xmpGImg:height>{mid.height}</xmpGImg:height>'
        f'<xmpGImg:format>JPEG</xmpGImg:format><xmpGImg:image>{base64.b64encode(jpeg_bytes(mid, 88)).decode()}</xmpGImg:image></rdf:li>'
        '</rdf:Alt></xmp:Thumbnails></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>'
    ).encode("utf-8")
    if len(xmp) % 2:
        xmp += b" "
    resource_1060 = b"8BIM" + struct.pack(">H", 0x0424) + b"\0\0" + struct.pack(">I", len(xmp)) + xmp

    # Resource 1005 (ResolutionInfo): 300 pixels/inch in 16.16 fixed point
    res_info = struct.pack(">IHHIHH", 300 << 16, 1, 1, 300 << 16, 1, 1)
    resource_1005 = b"8BIM" + struct.pack(">H", 0x03ED) + b"\0\0" + struct.pack(">I", len(res_info)) + res_info

    resources = resource_1005 + resource_1036 + resource_1060
    header = b"8BPS" + struct.pack(">H", 1) + b"\0" * 6 + struct.pack(">HIIHH", 3, h, w, 8, 3)
    color_mode = struct.pack(">I", 0)
    image_resources = struct.pack(">I", len(resources)) + resources
    layer_mask = struct.pack(">I", 0)

    channels = im.convert("RGB").split()
    counts, rows = [], []
    for ch in channels:
        data = ch.tobytes()
        for y in range(h):
            row = data[y * w:(y + 1) * w]
            packed = bytearray()
            i = 0
            while i < w:
                n = min(128, w - i)
                packed.append(n - 1)
                packed += row[i:i + n]
                i += n
            counts.append(len(packed))
            rows.append(bytes(packed))
    image_data = struct.pack(">H", 1) + b"".join(struct.pack(">H", c) for c in counts) + b"".join(rows)
    return header + color_mode + image_resources + layer_mask + image_data


def make_blend(im):
    """Blender 2.8+ style 64-bit little-endian file with a TEST (thumbnail) block."""
    im = im.copy()
    im.thumbnail((960, 960), Image.LANCZOS)
    w, h = im.size
    rgba = im.convert("RGBA").transpose(Image.FLIP_TOP_BOTTOM).tobytes()
    test_data = struct.pack("<II", w, h) + rgba
    out = bytearray(b"BLENDER-v402")
    glob_data = b"\0" * 1024
    out += b"GLOB" + struct.pack("<IQII", len(glob_data), 0x1000, 0, 1) + glob_data
    out += b"TEST" + struct.pack("<IQII", len(test_data), 0x2000, 0, 1) + test_data
    out += b"ENDB" + struct.pack("<IQII", 0, 0, 0, 0)
    return bytes(out)


def make_zip(entries):
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as z:
        for name, data, compress in entries:
            z.writestr(name, data, zipfile.ZIP_DEFLATED if compress else zipfile.ZIP_STORED)
    return b.getvalue()


def make_kra(im):
    im = im.copy()
    im.thumbnail((1600, 1600), Image.LANCZOS)
    w, h = im.size
    small = im.copy()
    small.thumbnail((256, 256))
    maindoc = (f'<?xml version="1.0" encoding="UTF-8"?><DOC xmlns="http://www.calligra.org/DTD/krita" '
               f'syntaxVersion="2.0" kritaVersion="5.2.6"><IMAGE width="{w}" height="{h}" '
               f'colorspacename="RGBA" mime="application/x-kra" name="Concept"/></DOC>')
    return make_zip([
        ("mimetype", b"application/x-krita", False),
        ("maindoc.xml", maindoc.encode(), True),
        ("mergedimage.png", png_bytes(im), False),
        ("preview.png", png_bytes(small), False),
    ])


def make_fig(board_png):
    meta = json.dumps({"client_meta": {"background_color": {"r": 0.08, "g": 0.09, "b": 0.12, "a": 1}},
                       "file_name": "NOVA_HUD_System", "developer_related_links": []})
    return make_zip([
        ("canvas.fig", b"fig-kiwi\x0f\x00\x00\x00" + os.urandom(2048), False),
        ("meta.json", meta.encode(), True),
        ("thumbnail.png", board_png, False),
    ])


def make_indd(spread):
    """InDesign database GUID header followed by an embedded JPEG page preview."""
    guid = bytes.fromhex("0606EDF5D81D46E5BD31EFE7FE74B71D")
    header = guid + b"DOCUMENT" + b"\x01\x70\x0f\x00\x00\x05\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
    header += b"\0" * (4096 - len(header))
    pad = os.urandom(8192)
    return header + pad + jpeg_bytes(spread, 88) + os.urandom(4096)


def make_pdf_pages(pages):
    """pages: list of (PIL image, title, subtitle) rendered as 16:9 slides."""
    doc = fitz.open()
    bf = os.path.join(FONTS, "bahnschrift.ttf")
    for im, title, sub in pages:
        W, H = 1280, 720
        p = doc.new_page(width=W, height=H)
        bg = im.copy().resize((W, int(W * im.height / im.width)))
        p.insert_image(fitz.Rect(0, 0, W, H), stream=jpeg_bytes(bg, 80), keep_proportion=False)
        p.draw_rect(fitz.Rect(0, H - 220, W, H), color=None, fill=(0.04, 0.05, 0.07), fill_opacity=0.82)
        p.insert_font(fontname="bahn", fontfile=bf)
        p.insert_text((64, H - 140), title, fontname="bahn", fontsize=54, color=(1, 1, 1))
        p.insert_text((66, H - 88), sub, fontname="bahn", fontsize=22, color=(0.75, 0.8, 0.88))
    return doc.tobytes(deflate=True)


def make_ai_poster(im):
    """PDF-compatible Illustrator file (real .ai files are PDF containers since CS)."""
    doc = fitz.open()
    W, H = 700, 1000
    p = doc.new_page(width=W, height=H)
    p.draw_rect(fitz.Rect(0, 0, W, H), color=None, fill=(0.05, 0.05, 0.06))
    sq = im.copy()
    sq.thumbnail((1400, 1400))
    p.insert_image(fitz.Rect(40, 40, W - 40, W - 40), stream=jpeg_bytes(sq, 86))
    p.insert_font(fontname="bahn", fontfile=os.path.join(FONTS, "bahnschrift.ttf"))
    p.insert_text((48, 790), "NOVA EXODUS", fontname="bahn", fontsize=74, color=(0.96, 0.36, 0.25))
    p.insert_text((52, 840), "THE LAST SIGNAL  -  COMING 2027", fontname="bahn", fontsize=24, color=(0.9, 0.9, 0.9))
    p.draw_line((52, 880), (W - 52, 880), color=(0.96, 0.36, 0.25), width=2)
    p.insert_text((52, 930), "PC  /  CONSOLE  /  NOVAEXODUS.GAME", fontname="bahn", fontsize=16, color=(0.6, 0.62, 0.66))
    p.insert_text((52, 960), "Key Art  -  Poster B1  -  v07", fontname="bahn", fontsize=12, color=(0.45, 0.47, 0.5))
    data = doc.tobytes(deflate=True)
    return data.replace(b"%PDF-1.7", b"%PDF-1.6", 1)


def make_artbook_spread(left_art, right_art):
    W, H = 2400, 1600
    sp = Image.new("RGB", (W, H), (244, 241, 234))
    l = left_art.copy()
    l = l.resize((int(H * l.width / l.height), H))
    sp.paste(l.crop(((l.width - W // 2) // 2, 0, (l.width - W // 2) // 2 + W // 2, H)), (0, 0))
    d = ImageDraw.Draw(sp)
    x0 = W // 2 + 110
    d.text((x0, 120), "CHAPTER 03", font=font("bahnschrift.ttf", 34), fill=(196, 72, 48))
    d.text((x0, 170), "The Long Dusk", font=font("georgiab.ttf", 92), fill=(24, 24, 28))
    r = right_art.copy()
    r.thumbnail((W // 2 - 220, 640))
    sp.paste(r, (x0, 330))
    body = font("georgia.ttf", 27)
    para = ("When the colony grid fails, the survey crews walk out into the dusk. The "
            "obelisks of the northern basin are the only landmarks left standing, and "
            "every route home is measured against them.")
    y = 330 + r.height + 50
    words, line = para.split(), ""
    for wd in words:
        test = (line + " " + wd).strip()
        if d.textlength(test, font=body) > W // 2 - 220:
            d.text((x0, y), line, font=body, fill=(50, 50, 56)); y += 42; line = wd
        else:
            line = test
    d.text((x0, y), line, font=body, fill=(50, 50, 56))
    d.text((x0, H - 90), "NOVA EXODUS  -  ART OF THE GAME", font=font("bahnschrift.ttf", 22), fill=(140, 140, 146))
    d.text((W - 160, H - 90), "087", font=font("bahnschrift.ttf", 22), fill=(140, 140, 146))
    d.line((W // 2, 0, W // 2, H), fill=(210, 206, 198), width=3)
    return sp


def make_presskit(im):
    W, H = 1240, 1754
    pg = Image.new("RGB", (W, H), (14, 15, 19))
    top = im.copy().resize((W, int(W * im.height / im.width)))
    pg.paste(top, (0, 0))
    d = ImageDraw.Draw(pg)
    y = top.height + 70
    d.text((80, y), "PRESS KIT 2026", font=font("bahnschrift.ttf", 30), fill=(240, 92, 64))
    d.text((80, y + 50), "NOVA EXODUS", font=font("bahnschrift.ttf", 120), fill=(245, 245, 245))
    d.text((80, y + 200), "Narrative survival on a dying colony world.", font=font("segoeui.ttf", 38), fill=(170, 176, 186))
    for i, (k, v) in enumerate([("Genre", "Survival / Exploration"), ("Platforms", "PC, PS5, Xbox Series"),
                                ("Release", "Q3 2027"), ("Studio", "Meridian Forge")]):
        yy = y + 320 + i * 70
        d.text((80, yy), k.upper(), font=font("bahnschrift.ttf", 24), fill=(120, 126, 136))
        d.text((380, yy - 4), v, font=font("segoeui.ttf", 32), fill=(230, 232, 236))
    return pg


def html_page(title, bg_b64, body, extra_css=""):
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>{title}</title>
<style>
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
body {{ width: 1280px; height: 916px; overflow: hidden; color: #e9edf3; font-family: 'Bahnschrift', 'Segoe UI', sans-serif;
  background: #07080c url(data:image/jpeg;base64,{bg_b64}) center / cover no-repeat; }}
.shade {{ position: absolute; inset: 0; background: linear-gradient(90deg, rgba(5,6,10,.92) 0%, rgba(5,6,10,.55) 45%, rgba(5,6,10,0) 75%); }}
{extra_css}
</style></head>
<body><div class="shade"></div>{body}</body></html>
"""


MENU_CSS = """
.menu { position: absolute; left: 96px; top: 150px; width: 460px; }
.logo { font-size: 72px; letter-spacing: 10px; font-weight: 700; color: #fff; }
.tag { margin-top: 6px; font-size: 15px; letter-spacing: 6px; color: #f0603f; }
.items { margin-top: 70px; display: flex; flex-direction: column; gap: 6px; }
.item { padding: 14px 18px; font-size: 22px; letter-spacing: 3px; color: #b9c0cc; border-left: 3px solid transparent; }
.item.on { color: #fff; background: linear-gradient(90deg, rgba(240,96,63,.28), rgba(240,96,63,0)); border-left-color: #f0603f; }
.foot { position: absolute; left: 96px; bottom: 60px; font-size: 13px; letter-spacing: 3px; color: #7d8592; }
.news { position: absolute; right: 70px; bottom: 60px; width: 330px; padding: 18px 20px; background: rgba(8,10,14,.72);
  border: 1px solid rgba(255,255,255,.12); }
.news h4 { font-size: 12px; letter-spacing: 3px; color: #f0603f; }
.news p { margin-top: 8px; font-size: 16px; color: #d7dce4; line-height: 1.4; }
"""

MENU_BODY = """
<div class="menu">
  <div class="logo">NOVA EXODUS</div>
  <div class="tag">THE LAST SIGNAL</div>
  <div class="items">
    <div class="item on">CONTINUE EXPEDITION</div>
    <div class="item">NEW GAME</div>
    <div class="item">CODEX</div>
    <div class="item">SETTINGS</div>
    <div class="item">QUIT TO DESKTOP</div>
  </div>
</div>
<div class="foot">BUILD 0.9.412  -  MERIDIAN FORGE</div>
<div class="news"><h4>PATCH NOTES</h4><p>Transit tunnel expedition added. New pod racer and moto interceptor routes.</p></div>
"""

INV_CSS = """
.panel { position: absolute; left: 64px; top: 64px; right: 64px; bottom: 64px; border: 1px solid rgba(255,255,255,.14);
  background: rgba(7,9,13,.78); padding: 36px 40px; }
.hd { display: flex; justify-content: space-between; align-items: baseline; }
.hd h1 { font-size: 34px; letter-spacing: 6px; }
.hd span { font-size: 14px; letter-spacing: 3px; color: #f0603f; }
.grid { margin-top: 30px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; width: 720px; }
.slot { height: 104px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); position: relative; }
.slot.r { border-color: #f0603f; background: rgba(240,96,63,.12); }
.slot.b { border-color: #49b6ff; background: rgba(73,182,255,.1); }
.slot i { position: absolute; left: 50%; top: 50%; width: 42px; height: 42px; margin: -21px 0 0 -21px; transform: rotate(45deg);
  border: 2px solid rgba(255,255,255,.55); }
.slot em { position: absolute; right: 8px; bottom: 6px; font-style: normal; font-size: 13px; color: #9aa3b0; }
.side { position: absolute; right: 40px; top: 100px; width: 330px; }
.side h3 { font-size: 22px; letter-spacing: 3px; }
.side p { margin-top: 10px; color: #aab2be; font-size: 15px; line-height: 1.5; }
.bar { margin-top: 18px; height: 6px; background: rgba(255,255,255,.1); }
.bar b { display: block; height: 6px; width: 72%; background: #f0603f; }
"""


def inv_body():
    slots = []
    kinds = ["r", "", "b", "", "", "r", "", "b", "", "", "", "", "b", "", "r", "", "", ""]
    for i, k in enumerate(kinds):
        slots.append(f'<div class="slot {k}"><i></i><em>x{(i * 7) % 12 + 1}</em></div>')
    return f"""
<div class="panel">
  <div class="hd"><h1>INVENTORY</h1><span>WEIGHT 42 / 60</span></div>
  <div class="grid">{''.join(slots)}</div>
  <div class="side"><h3>RESONANCE CORE</h3>
    <p>Recovered from the northern obelisk field. Powers the pod racer for 6 cycles.</p>
    <div class="bar"><b></b></div></div>
</div>"""


HUD_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400">
  <title>NOVA EXODUS HUD icon set</title>
  <rect width="640" height="400" fill="#0b0d12"/>
  <g fill="none" stroke="#f0603f" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
    <path d="M80 60 L120 130 L40 130 Z"/>
    <circle cx="240" cy="100" r="40"/><path d="M240 60 V140 M200 100 H280"/>
    <rect x="340" y="60" width="80" height="80" transform="rotate(45 380 100)"/>
    <path d="M480 140 V80 L520 60 L560 80 V140 Z"/>
  </g>
  <g fill="none" stroke="#e9edf3" stroke-width="6" stroke-linejoin="round" stroke-linecap="round">
    <path d="M40 300 Q80 220 120 300 T200 300"/>
    <circle cx="300" cy="280" r="34"/><circle cx="300" cy="280" r="10" fill="#e9edf3"/>
    <path d="M400 240 L460 320 M460 240 L400 320"/>
    <path d="M520 320 V250 H590 V320 M520 280 H590"/>
  </g>
  <text x="40" y="380" fill="#7d8592" font-family="Bahnschrift, sans-serif" font-size="16" letter-spacing="4">HUD ICONS  /  v3</text>
</svg>
"""

TEXT_FILES = {
    "README.md": """# NOVA EXODUS — Art Production

Shared drive for the concept, key art and UI team.

## Folder structure
| Folder | Content |
|---|---|
| `01_Concept_Art` | Environment and creature exploration (PSD, KRA) |
| `02_Characters` | Character sheets, busts, Blender sculpts |
| `03_Vehicles_Mechs` | Vehicle and mech designs, turnarounds |
| `04_Key_Art_Marketing` | Art book, press kit, posters (INDD, AI, PDF) |
| `05_UI_HUD` | Figma HUD system, HTML prototypes, icon sets |

## Naming
`<CAT>_<Subject>_<Variant>_v<NN>.<ext>` — e.g. `ENV_Clone_Corridor_KeyFrame_v04.psd`

## Review
Weekly paint-over review every Thursday, 15:00. Approved files move to `_Approved`.
""",
    "Lore_Bible.md": """# Lore Bible — Kepler-442b

## The Exodus
In 2291 the colony ship *Meridian* lands on Kepler-442b after the collapse of the inner
systems. Within a decade the colony fractures into three clans.

## Factions
- **Orange Corps** — pilots and scouts who keep the transit tunnels open.
- **Nebula Monarchy** — gilded rulers of the orbital spire.
- **Survey Corps** — engineers who run the pod racers and launch bays.

## The Obelisks
Monoliths in the northern basin. They emit a low resonance every 41 hours.
> "It was here before us. It is waiting for something." — Survey log 114
""",
    "Asset_Pipeline.md": """# Asset Pipeline

1. **Sketch** in Krita (`.kra`) — 4K canvas, sRGB.
2. **Paint-over** in Photoshop (`.psd`) — keep layer groups `BG / MID / FG / FX`.
3. **3D block-out** in Blender (`.blend`) — save with preview thumbnail enabled.
4. **UI** in Figma (`.fig`) — export HTML prototypes for in-engine review.
5. **Marketing** in InDesign / Illustrator — package to `04_Key_Art_Marketing`.

Previews of all formats are browsed in AeroBridge Studio without opening the source apps.
""",
    "build_manifest.json": json.dumps({
        "project": "NOVA EXODUS",
        "build": "0.9.412",
        "engine": "Unreal Engine 5.6",
        "art_freeze": "2026-11-30",
        "targets": ["Win64", "PS5", "XSX"],
        "asset_counts": {"concept": 148, "characters": 62, "vehicles": 37, "ui_screens": 54},
    }, indent=2) + "\n",
    "TODO.txt": """[ ] Transit tunnel: final lighting pass
[x] Pod racer turnaround
[ ] Orange pilot: alt colour scheme for the night biome
[ ] Press kit A4: update platform list
[ ] HUD: inventory weight indicator states
""",
}


def edge_screenshot(html_path, png_path, w, h):
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--window-size={w},{h}",
                    f"--screenshot={png_path}", "file:///" + html_path.replace("\\", "/")],
                   check=True, capture_output=True, timeout=60)


# ---------------------------------------------------------------- build

def main():
    if os.path.isdir(FS):
        shutil.rmtree(FS)
    os.makedirs(FS)
    manifest = []
    P = "F/NOVA_EXODUS"

    def add(rel, data, size_mb=None, days_ago=None):
        write(rel, data)
        real = len(data) if isinstance(data, bytes) else len(data.encode("utf-8"))
        size = int(size_mb * 1024 * 1024) if size_mb else real
        when = BASE_TIME - timedelta(days=days_ago if days_ago is not None else rng.uniform(0, 40),
                                     minutes=rng.randint(0, 600))
        manifest.append({"file": rel, "size": size, "modified_ms": int(when.timestamp() * 1000)})

    # 01 Concept art
    c = f"{P}/01_Concept_Art"
    add(f"{c}/ENV_Clone_Corridor_KeyFrame_v04.psd", make_psd(art("clone_corridor", 1600)), 486.2, 1)
    add(f"{c}/ENV_Transit_Tunnel_Light_v02.psd", make_psd(art("transit_tunnel", 1400)), 312.7, 3)
    add(f"{c}/ENV_Council_Dome_v03.psd", make_psd(art("council_dome", 1600)), 254.1, 6)
    add(f"{c}/ENV_Desert_Thrones_v02.psd", make_psd(art("desert_thrones", 1600)), 198.4, 9)
    add(f"{c}/ENV_Ruins_Sketch.kra", make_kra(art("ruins_sketch")), 88.3, 4)
    add(f"{c}/ENV_Tower_Sketch_Study.kra", make_kra(art("tower_sketch")), 74.9, 11)
    add(f"{c}/CRE_Mantis_Encounter.psd", make_psd(art("mantis_painting", 1600)), 402.5, 2)
    add(f"{c}/ENV_Obelisk_Painting.jpg", jpeg_bytes(art("obelisk_painting"), 90), None, 14)
    add(f"{c}/ENV_Dusk_Horizon_01.jpg", jpeg_bytes(art("dusk_horizon"), 90), None, 8)
    add(f"{c}/ENV_Highland_Gathering_Matte.png", png_bytes(art("highland_gathering", 1456)), None, 17)
    add(f"{c}/ENV_Red_Banquet_Hall.jpg", jpeg_bytes(art("red_banquet"), 90), None, 21)

    # 02 Characters
    ch = f"{P}/02_Characters"
    add(f"{ch}/CHR_Pilot_Orange_Final.psd", make_psd(art("pilot_orange", 1600)), 612.8, 1)
    add(f"{ch}/CHR_Visor_Red_Bust.blend", make_blend(art("visor_red")), 284.6, 5)
    add(f"{ch}/CHR_Desert_Oracle_Mask.kra", make_kra(art("desert_oracle")), 96.2, 7)
    add(f"{ch}/CHR_Lab_Synth_v05.psd", make_psd(art("lab_synth", 1600)), 377.0, 10)
    add(f"{ch}/CHR_Red_Agent.png", png_bytes(art("red_agent")), None, 12)
    add(f"{ch}/CHR_Scout_Orange.jpg", jpeg_bytes(art("scout_orange"), 90), None, 15)

    # 03 Vehicles & mechs
    v = f"{P}/03_Vehicles_Mechs"
    add(f"{v}/VHC_Pod_Racer_MK2.blend", make_blend(art("pod_racer")), 356.3, 2)
    add(f"{v}/VHC_Moto_Interceptor.blend", make_blend(art("moto_white")), 221.9, 6)
    add(f"{v}/VHC_Moto_Courier_Paint.psd", make_psd(art("moto_yellow", 1600)), 289.5, 4)
    add(f"{v}/FX_Steam_Vent_Hangar.psd", make_psd(art("steam_vent", 1600)), 341.2, 13)
    add(f"{v}/VHC_Flooded_Launch_Bay.jpg", jpeg_bytes(art("flooded_helmets"), 90), None, 19)
    add(f"{v}/ART_Lab_Crew_Hangar.jpg", jpeg_bytes(art("lab_crew"), 90), None, 23)

    # 04 Key art & marketing
    k = f"{P}/04_Key_Art_Marketing"
    add(f"{k}/NOVA_ArtBook_Ch03_Spread.indd", make_indd(make_artbook_spread(art("dusk_horizon"), art("obelisk_painting"))), 142.6, 2)
    add(f"{k}/NOVA_PressKit_A4.indd", make_indd(make_presskit(art("council_feast"))), 64.3, 8)
    add(f"{k}/NOVA_Poster_B1.ai", make_ai_poster(art("broadcaster")), 38.7, 3)
    add(f"{k}/NOVA_Pitch_Deck.pdf", make_pdf_pages([
        (art("clone_corridor"), "NOVA EXODUS", "Investor pitch  -  October 2026"),
        (art("pod_racer"), "Core loop", "Explore  -  Race  -  Survive"),
        (art("desert_thrones"), "World", "Kepler-442b, three clans, one signal"),
    ]), 24.1, 5)
    add(f"{k}/NOVA_Steam_Capsule.psd", make_psd(art("mask_choir", 1600)), 156.4, 9)
    add(f"{k}/NOVA_Trailer_Storyboard.psd", make_psd(art("red_hall_guards", 1600)), 210.8, 16)

    # 05 UI / HUD (HTML prototypes, Figma board rendered from the same HTML)
    u = f"{P}/05_UI_HUD"
    bg_menu = base64.b64encode(jpeg_bytes(art("transit_tunnel", 1280), 72)).decode()
    bg_inv = base64.b64encode(jpeg_bytes(art("red_banquet", 1280), 60)).decode()
    menu_html = html_page("NOVA EXODUS - Main Menu", bg_menu, MENU_BODY, MENU_CSS)
    inv_html = html_page("NOVA EXODUS - Inventory", bg_inv, inv_body(), INV_CSS)
    add(f"{u}/Main_Menu_Prototype.html", menu_html, None, 1)
    add(f"{u}/Inventory_Screen.html", inv_html, None, 3)
    add(f"{u}/HUD_Icon_Set.svg", HUD_SVG, None, 6)

    tmp = os.path.join(REPO, "demo", ".tmp")
    os.makedirs(tmp, exist_ok=True)
    shots = []
    for name, html in (("menu", menu_html), ("inv", inv_html)):
        hp = os.path.join(tmp, name + ".html")
        open(hp, "w", encoding="utf-8").write(html)
        pp = os.path.join(tmp, name + ".png")
        edge_screenshot(hp, pp, 1280, 916)
        shots.append(Image.open(pp).convert("RGB"))
    board = Image.new("RGB", (1600, 1000), (30, 31, 36))
    d = ImageDraw.Draw(board)
    lab = font("segoeui.ttf", 20)
    for i, s in enumerate(shots):
        t = s.copy(); t.thumbnail((720, 720))
        x = 60 + i * 780
        d.text((x, 150), ["Main Menu / Desktop", "Inventory / Desktop"][i], font=lab, fill=(170, 172, 180))
        board.paste(t, (x, 185))
    d.text((60, 60), "NOVA HUD System", font=font("segoeuib.ttf", 40), fill=(240, 240, 244))
    for j, col in enumerate([(240, 96, 63), (73, 182, 255), (233, 237, 243), (11, 13, 18)]):
        d.rectangle((60 + j * 70, 760, 110 + j * 70, 810), fill=col, outline=(80, 80, 90))
    d.text((60, 830), "Tokens  -  Accent / Info / Text / Surface", font=lab, fill=(150, 152, 160))
    add(f"{u}/NOVA_HUD_System.fig", make_fig(png_bytes(board)), 46.2, 2)
    shutil.rmtree(tmp)

    # Docs for the notepad
    for name, text in TEXT_FILES.items():
        add(f"{P}/{name}", text, None, rng.uniform(0, 10))

    # Other folders so the drive roots look lived-in (aliases reuse existing files)
    manifest_aliases = [
        ("F/_Reference/Moodboard_Obelisk.jpg", f"{c}/ENV_Obelisk_Painting.jpg"),
        ("F/_Reference/Moodboard_Dusk.jpg", f"{c}/ENV_Dusk_Horizon_01.jpg"),
        ("F/Archive_2025/NOVA_Prototype_Menu_v01.html", f"{u}/Main_Menu_Prototype.html"),
        ("F/Exports/NOVA_Pitch_Deck_web.pdf", f"{k}/NOVA_Pitch_Deck.pdf"),
        ("F/Client_Pitches/Meridian_Forge_Intro.pdf", f"{k}/NOVA_Pitch_Deck.pdf"),
        ("D/Asset_Library/Environments/Tower_Sketch.kra", f"{c}/ENV_Tower_Sketch_Study.kra"),
        ("D/Asset_Library/Vehicles/Flooded_Launch_Bay.jpg", f"{v}/VHC_Flooded_Launch_Bay.jpg"),
        ("D/Brushes_And_Textures/README.md", f"{P}/README.md"),
        ("Z/Render_Farm/Queue/VHC_Pod_Racer_MK2.blend", f"{v}/VHC_Pod_Racer_MK2.blend"),
        ("Z/Render_Farm/Output/Lab_Crew_Hangar.jpg", f"{v}/ART_Lab_Crew_Hangar.jpg"),
        ("C/Users/Studio/Desktop/TODO.txt", f"{P}/TODO.txt"),
        ("C/Users/Studio/Downloads/NOVA_Pitch_Deck.pdf", f"{k}/NOVA_Pitch_Deck.pdf"),
        ("C/Users/Studio/Pictures/Red_Agent.png", f"{ch}/CHR_Red_Agent.png"),
    ]
    # Weekly review folder mixing every supported format side by side
    review = f"{P}/_Review_Week_42"
    for target in (f"{k}/NOVA_ArtBook_Ch03_Spread.indd", f"{k}/NOVA_Poster_B1.ai", f"{u}/NOVA_HUD_System.fig",
                   f"{ch}/CHR_Visor_Red_Bust.blend", f"{u}/Main_Menu_Prototype.html",
                   f"{c}/ENV_Clone_Corridor_KeyFrame_v04.psd", f"{ch}/CHR_Pilot_Orange_Final.psd",
                   f"{c}/ENV_Ruins_Sketch.kra", f"{k}/NOVA_Pitch_Deck.pdf", f"{v}/VHC_Pod_Racer_MK2.blend",
                   f"{v}/VHC_Moto_Courier_Paint.psd", f"{u}/Inventory_Screen.html", f"{ch}/CHR_Desert_Oracle_Mask.kra",
                   f"{k}/NOVA_PressKit_A4.indd", f"{v}/VHC_Moto_Interceptor.blend"):
        manifest_aliases.append((f"{review}/{target.rsplit('/', 1)[1]}", target))

    by_file = {m["file"]: m for m in manifest}
    for alias, target in manifest_aliases:
        src = by_file[target]
        manifest.append({"file": alias, "alias": target, "size": src["size"],
                         "modified_ms": src["modified_ms"] - rng.randint(1, 90) * 86400000})

    with open(os.path.join(FS, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump({
            "drives": [
                {"letter": "C", "name": "Windows (C:)"},
                {"letter": "D", "name": "Asset Library (D:)"},
                {"letter": "F", "name": "Studio Projects (F:)"},
                {"letter": "Z", "name": "NAS Render Farm (Z:)"},
            ],
            "places": [
                {"name": "Plocha", "path": "C:\\Users\\Studio\\Desktop"},
                {"name": "Stažené soubory", "path": "C:\\Users\\Studio\\Downloads"},
                {"name": "Obrázky", "path": "C:\\Users\\Studio\\Pictures"},
            ],
            "files": manifest,
        }, f, indent=1, ensure_ascii=False)
    total = sum(os.path.getsize(os.path.join(dp, fn)) for dp, _, fns in os.walk(FS) for fn in fns)
    print(f"{len(manifest)} entries, {total / 1048576:.1f} MB on disk")


if __name__ == "__main__":
    main()
