// Regenerates every derived brand asset from the master mark.
//   source: brand_assets/jt-logo-2026-source.svg  (artwork sits on a white plate)
//   out:    brand_assets/jt-logo-2026.png         transparent, for light surfaces
//           brand_assets/jt-logo-2026-light.png   knockout, for the navy surfaces
//           brand_assets/jt-monogram-light.png    JT only (no ring, no wordmark),
//                                                 silver + green, pairs with the
//                                                 typeset name in the footer
//           favicon.png                           mark on a white disc
//
// Run with:  node build-logo-assets.mjs
import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const chromePath = [
  'C:/Users/Efran/.cache/puppeteer/chrome/win64-146.0.7680.153/chrome-win64/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(existsSync);

const svg = readFileSync('brand_assets/jt-logo-2026-source.svg', 'utf8');
const b64 = svg.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/)[1];

const browser = await puppeteer.launch({
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');

const out = await page.evaluate(async (b64) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();

  const SIZE = 512;

  // ── 1. white plate -> alpha, unpremultiplied so edges stay saturated ──
  const full = document.createElement('canvas');
  full.width = img.width; full.height = img.height;
  const fctx = full.getContext('2d');
  fctx.drawImage(img, 0, 0);
  const fd = fctx.getImageData(0, 0, full.width, full.height);
  const d = fd.data;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mn = Math.min(r, g, b);
    const a = 255 - mn;
    if (a <= 2) { d[i + 3] = 0; continue; }
    const k = a / 255;
    d[i] = Math.max(0, Math.min(255, Math.round((r - mn) / k)));
    d[i + 1] = Math.max(0, Math.min(255, Math.round((g - mn) / k)));
    d[i + 2] = Math.max(0, Math.min(255, Math.round((b - mn) / k)));
    d[i + 3] = a;
  }
  fctx.putImageData(fd, 0, 0);

  const mark = document.createElement('canvas');
  mark.width = SIZE; mark.height = SIZE;
  const mctx = mark.getContext('2d');
  mctx.imageSmoothingQuality = 'high';
  mctx.drawImage(full, 0, 0, SIZE, SIZE);

  // ── 2. knockout for dark surfaces ──
  // The navy half of the mark disappears on a navy background, so it is
  // recoloured. `t` ramps on green-dominance, which turns the mark's own
  // navy->green gradient into light->green with no hard seam.
  const knockout = (light, green) => {
    const c = document.createElement('canvas');
    c.width = SIZE; c.height = SIZE;
    const ctx = c.getContext('2d');
    ctx.drawImage(mark, 0, 0);
    const id = ctx.getImageData(0, 0, SIZE, SIZE), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const t = Math.max(0, Math.min(1, (d[i + 1] - d[i + 2]) / 55));
      d[i] = Math.round(light[0] + (green[0] - light[0]) * t);
      d[i + 1] = Math.round(light[1] + (green[1] - light[1]) * t);
      d[i + 2] = Math.round(light[2] + (green[2] - light[2]) * t);
    }
    ctx.putImageData(id, 0, 0);
    return c;
  };

  const GREEN = [31, 201, 125];   // #1FC97D
  const SILVER = [194, 206, 228]; // #C2CEE4 — same tone as the footer body text

  // full mark, white knockout — the general-purpose reverse logo
  const light = knockout([255, 255, 255], GREEN);
  // footer monogram source: silver instead of white, so the mark sits in the
  // footer's own tonal range and green stays the only bright note
  const monoSrc = knockout(SILVER, GREEN);

  // ── 3. monogram: knockout with the ring and the small "JALLOW" dropped ──
  // At footer size the ring steals ~20% of the box and the built-in wordmark
  // turns to mush, so the footer pairs this with typeset text instead.
  const RING_CUT = 236;  // ring sits between r=238 and r=252 at 512px
  const WORD_CUT = 365;  // blank band (y 358-372) between the wave and "JALLOW"
  const mono = document.createElement('canvas');
  mono.width = SIZE; mono.height = SIZE;
  const nctx = mono.getContext('2d');
  nctx.drawImage(monoSrc, 0, 0);
  const nid = nctx.getImageData(0, 0, SIZE, SIZE);
  const nd = nid.data;
  let minX = SIZE, minY = SIZE, maxX = 0, maxY = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const o = (y * SIZE + x) * 4;
      if (y >= WORD_CUT || Math.hypot(x - SIZE / 2, y - SIZE / 2) > RING_CUT) { nd[o + 3] = 0; continue; }
      if (nd[o + 3] > 25) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  nctx.putImageData(nid, 0, 0);
  const mw = maxX - minX + 1, mh = maxY - minY + 1;
  const monoTrim = document.createElement('canvas');
  monoTrim.height = SIZE;
  monoTrim.width = Math.round((mw / mh) * SIZE);
  const tctx = monoTrim.getContext('2d');
  tctx.imageSmoothingQuality = 'high';
  tctx.drawImage(mono, minX, minY, mw, mh, 0, 0, monoTrim.width, monoTrim.height);

  // ── 4. favicon: mark on a white disc so it reads on dark browser chrome ──
  const F = 256;
  const fav = document.createElement('canvas');
  fav.width = F; fav.height = F;
  const vctx = fav.getContext('2d');
  vctx.imageSmoothingQuality = 'high';
  vctx.fillStyle = '#FFFFFF';
  vctx.beginPath();
  vctx.arc(F / 2, F / 2, F / 2 - 1, 0, Math.PI * 2);
  vctx.fill();
  vctx.drawImage(mark, 0, 0, F, F);

  return {
    mark: mark.toDataURL('image/png'),
    light: light.toDataURL('image/png'),
    mono: monoTrim.toDataURL('image/png'),
    favicon: fav.toDataURL('image/png'),
  };
}, b64);

const write = (path, dataUrl) => {
  const buf = Buffer.from(dataUrl.split(',')[1], 'base64');
  writeFileSync(path, buf);
  console.log(`${path}  ${(buf.length / 1024).toFixed(1)} KB`);
};

write('brand_assets/jt-logo-2026.png', out.mark);
write('brand_assets/jt-logo-2026-light.png', out.light);
write('brand_assets/jt-monogram-light.png', out.mono);
write('favicon.png', out.favicon);

await browser.close();
