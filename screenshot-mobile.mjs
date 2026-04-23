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
await page.setViewport({ width: 375, height: 812 });

const urls = [
  { url: 'http://localhost:3000', label: 'home-mobile' },
  { url: 'http://localhost:3000/about.html', label: 'about-mobile' },
  { url: 'http://localhost:3000/contact.html', label: 'contact-mobile' },
  { url: 'http://localhost:3000/terms.html', label: 'terms-mobile' },
];

for (const {url, label} of urls) {
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 1200));
  const outputPath = join(screenshotsDir, `screenshot-mobile-${label}.png`);
  await page.screenshot({ path: outputPath, fullPage: true });
  console.log(`✓ ${label}`);
}

await browser.close();
console.log('Mobile screenshots complete');
