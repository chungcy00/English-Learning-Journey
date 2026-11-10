"""Export installation icons from the approved original PNG; never redraw characters.
Run: python3 scripts/generate-app-icons.py (Pillow required for this build-time export).
"""
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'public/illustrations/mascots/cat-hamster-book-logo.png'
OUT = ROOT / 'public/icons'
BACKGROUND = '#F8F7F2'  # Existing DESIGN.md app background; also used in both manifests.

def main():
    original = Image.open(SOURCE).convert('RGBA')
    # Ignore nearly transparent export noise only when measuring the empty margin.
    bounds = original.getchannel('A').point(lambda a: 255 if a >= 64 else 0).getbbox()
    left, top, right, bottom = bounds
    art = original.crop((max(0, left-12), max(0, top-12), min(original.width, right+12), min(original.height, bottom+12)))
    OUT.mkdir(exist_ok=True)
    outputs = [('192',192,.88), ('512',512,.88), ('maskable-512',512,.65), ('apple-180',180,.8), ('favicon-32',32,.94)]
    for name, size, fraction in outputs:
        canvas = Image.new('RGBA', (size,size), BACKGROUND)
        foreground = ImageOps.contain(art, (round(size*fraction), round(size*fraction)), Image.Resampling.LANCZOS)
        canvas.alpha_composite(foreground, ((size-foreground.width)//2,(size-foreground.height)//2))
        canvas.convert('RGB').save(OUT / f'mine-english-logo-{name}.png', optimize=True)
    # Keep the old public endpoint branded for existing bookmarks/install prompts.
    (ROOT/'public/site-icon.png').write_bytes((OUT/'mine-english-logo-512.png').read_bytes())

if __name__ == '__main__':
    main()
