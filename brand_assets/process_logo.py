from PIL import Image
import os

src = os.path.join(os.path.dirname(__file__), '..', 'logo3.png')
dst = os.path.join(os.path.dirname(__file__), 'jt-logo.png')

img = Image.open(src).convert('RGBA')
w, h = img.size
pixels = img.load()

threshold = 240

for y in range(h):
    for x in range(w):
        r, g, b, a = pixels[x, y]
        if r >= threshold and g >= threshold and b >= threshold:
            pixels[x, y] = (255, 255, 255, 0)
        else:
            # soft edge blending for off-white pixels
            min_c = min(r, g, b)
            if min_c > 200:
                alpha = int(255 * (255 - min_c) / (255 - 200))
                pixels[x, y] = (r, g, b, alpha)

bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)

img.save(dst, 'PNG', optimize=True)
print(f"Saved: {dst}  size: {img.size}")

# Also create a tight square padded version for uniform nav use
# Optional: keep aspect ratio; nav will handle via CSS max-height
