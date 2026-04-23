from PIL import Image
import os

src = os.path.join(os.path.dirname(__file__), '..', 'logo3.png')
dst = os.path.join(os.path.dirname(__file__), 'jt-logo.png')

img = Image.open(src).convert('RGBA')
w, h = img.size
pixels = img.load()

# Edge-only color-to-alpha:
#  - Pure white pixels  -> fully transparent
#  - Anti-aliased edges -> recover true color via un-premultiply (kills halo)
#  - Solid interior     -> left ALONE (preserves original artwork colors,
#                          e.g. the coral truck stays coral, not pure red)
WHITE_FLOOR = 250   # at or above min(r,g,b) >= this -> treat as pure white
SOLID_FLOOR = 200   # at or below min(r,g,b) <= this -> treat as solid color

for y in range(h):
    for x in range(w):
        r, g, b, a_in = pixels[x, y]
        min_c = min(r, g, b)

        if min_c >= WHITE_FLOOR:
            pixels[x, y] = (0, 0, 0, 0)
            continue

        if min_c <= SOLID_FLOOR:
            # Solid foreground — keep the artist's original color exactly.
            pixels[x, y] = (r, g, b, a_in)
            continue

        # Edge band: pixel is partway between solid color and white.
        # Compute fractional alpha and un-premultiply against white so the
        # recovered color composites cleanly on ANY background.
        alpha = (WHITE_FLOOR - min_c) / (WHITE_FLOOR - SOLID_FLOOR)
        nr = int(round((r - 255 * (1 - alpha)) / alpha))
        ng = int(round((g - 255 * (1 - alpha)) / alpha))
        nb = int(round((b - 255 * (1 - alpha)) / alpha))
        nr = max(0, min(255, nr))
        ng = max(0, min(255, ng))
        nb = max(0, min(255, nb))
        new_a = int(round(alpha * 255 * (a_in / 255.0)))
        pixels[x, y] = (nr, ng, nb, new_a)

bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)

img.save(dst, 'PNG', optimize=True)
print(f"Saved: {dst}  size: {img.size}")
