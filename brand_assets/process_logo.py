from PIL import Image
import os

src = os.path.join(os.path.dirname(__file__), '..', 'logo3.png')
dst = os.path.join(os.path.dirname(__file__), 'jt-logo.png')

img = Image.open(src).convert('RGBA')
w, h = img.size
pixels = img.load()

# Strategy: brand-aware color-to-alpha.
#
# 1. Auto-detect the dominant brand colors (teal, coral, dark gray).
# 2. For each pixel:
#      - White-ish  (min channel >= 250): fully transparent.
#      - Solid      (min channel <= 200): keep original color, alpha = 1.
#      - Edge band  (in between): find the nearest brand color and express
#        the pixel as that brand color composited over white at a fractional
#        alpha. This way edges blend through PURE BRAND COLOR, never through
#        white -> no halo on any background, and interior color is unchanged.

WHITE_FLOOR = 250
SOLID_FLOOR = 200

# --- Step 1: detect brand colors from solid pixels ---
solid_samples = []
for y in range(0, h, 3):
    for x in range(0, w, 3):
        r, g, b, _ = pixels[x, y]
        if min(r, g, b) <= 130:
            solid_samples.append((r, g, b))

# Bucket samples by dominant hue family. Hand-tuned for this logo's palette
# (teal letters, coral truck, dark gray tagline) but degrades gracefully if a
# bucket is empty.
teal_pix  = [p for p in solid_samples if p[1] > p[0] + 20 and p[2] > p[0] + 20]
coral_pix = [p for p in solid_samples if p[0] > p[1] + 30 and p[0] > p[2] + 30]
gray_pix  = [p for p in solid_samples if abs(p[0]-p[1]) < 15
                                    and abs(p[1]-p[2]) < 15
                                    and max(p) < 100]

def avg(group):
    if not group:
        return None
    n = len(group)
    return (sum(p[0] for p in group)//n,
            sum(p[1] for p in group)//n,
            sum(p[2] for p in group)//n)

brand_colors = [c for c in (avg(teal_pix), avg(coral_pix), avg(gray_pix)) if c]
print(f"Detected brand colors: {brand_colors}")

def nearest_brand(r, g, b):
    return min(brand_colors,
               key=lambda c: (c[0]-r)**2 + (c[1]-g)**2 + (c[2]-b)**2)

# --- Step 2: rewrite every pixel ---
for y in range(h):
    for x in range(w):
        r, g, b, a_in = pixels[x, y]
        min_c = min(r, g, b)

        if min_c >= WHITE_FLOOR:
            pixels[x, y] = (0, 0, 0, 0)
            continue

        if min_c <= SOLID_FLOOR:
            pixels[x, y] = (r, g, b, a_in)
            continue

        # Edge band — snap to nearest brand color, compute alpha so that
        # brand * alpha + white * (1 - alpha) reproduces the source pixel.
        bc = nearest_brand(r, g, b)
        # Use the channel with the largest brand-vs-white delta for stability.
        deltas = [255 - bc[0], 255 - bc[1], 255 - bc[2]]
        idx = deltas.index(max(deltas))
        if deltas[idx] == 0:
            pixels[x, y] = (0, 0, 0, 0)
            continue
        src_c = (r, g, b)[idx]
        alpha = (255 - src_c) / deltas[idx]
        alpha = max(0.0, min(1.0, alpha))
        new_a = int(round(alpha * 255 * (a_in / 255.0)))
        pixels[x, y] = (bc[0], bc[1], bc[2], new_a)

bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)

img.save(dst, 'PNG', optimize=True)
print(f"Saved: {dst}  size: {img.size}")
