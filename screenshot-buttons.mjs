import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const screenshotsDir = join(__dirname, 'temporary screenshots');
await mkdir(screenshotsDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: 'C:/Users/Efran/.cache/puppeteer/chrome/win64-146.0.7680.153/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

const tag = process.argv[2] || 'baseline';

const tasks = [
  { url: 'http://localhost:3000', label: 'home-hero', selector: '.hero-anim-4' },
  { url: 'http://localhost:3000', label: 'home-cta-band', selector: '.cta-band h2' },
  { url: 'http://localhost:3000/about.html', label: 'about-cta-band', selector: '.cta-band h2' },
  { url: 'http://localhost:3000/about.html', label: 'about-see-services', selector: 'a[href="/#services"].btn-primary' },
  { url: 'http://localhost:3000/contact.html', label: 'contact-form-buttons', selector: '#submitBtn' },
  { url: 'http://localhost:3000/contact.html', label: 'contact-whatsapp-card', selector: '.success-card .btn-primary' },
  { url: 'http://localhost:3000/terms.html', label: 'terms-cta-band', selector: '.cta-band h2' },
  { url: 'http://localhost:3000/terms.html', label: 'terms-info-box', selector: '.info-box .btn-primary' },
];

for (const t of tasks) {
  await page.goto(t.url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 600));
  try {
    if (!t.label.includes('hero')) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await new Promise(r => setTimeout(r, 600));
    }
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        const absoluteY = rect.top + window.pageYOffset;
        window.scrollTo(0, Math.max(0, absoluteY - 180));
      }
    }, t.selector);
    await new Promise(r => setTimeout(r, 700));
  } catch (e) {}
  const outputPath = join(screenshotsDir, `btn-${tag}-${t.label}.png`);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`✓ ${t.label}`);
}

await browser.close();
