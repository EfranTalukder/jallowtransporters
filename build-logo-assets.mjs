// Regenerates every derived brand asset from the master mark.
//   source: brand_assets/jt-logo-2026-source.svg  (artwork sits on a white plate)
//   out:    brand_assets/jt-logo-2026.png         transparent, for light surfaces
//           brand_assets/jt-logo-2026-light.png   knockout, for the navy surfaces
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

  // ── 2. knockout for dark surfaces: navy -> white, green lifted to #22C77E ──
  const light = document.createElement('canvas');
  light.width = SIZE; light.height = SIZE;
  const lctx = light.getContext('2d');
  lctx.drawImage(mark, 0, 0);
  const lid = lctx.getImageData(0, 0, SIZE, SIZE);
  const ld = lid.data;
  const [GR, GG, GB] = [31, 201, 125];
  for (let i = 0; i < ld.length; i += 4) {
    if (ld[i + 3] === 0) continue;
    // ramp on green-dominance, so the navy->green ring gradient becomes
    // white->green with no hard seam
    const t = Math.max(0, Math.min(1, (ld[i + 1] - ld[i + 2]) / 55));
    ld[i] = Math.round(255 + (GR - 255) * t);
    ld[i + 1] = Math.round(255 + (GG - 255) * t);
    ld[i + 2] = Math.round(255 + (GB - 255) * t);
  }
  lctx.putImageData(lid, 0, 0);

  // ── 3. favicon: mark on a white disc so it reads on dark browser chrome ──
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
write('favicon.png', out.favicon);

await browser.close();
