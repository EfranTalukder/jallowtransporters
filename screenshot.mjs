import puppeteer from 'puppeteer';
import { mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

// Puppeteer's own Chrome download may be missing; fall back to installed Chrome.
const chromeCandidates = [
  'C:/Users/Efran/.cache/puppeteer/chrome/win64-146.0.7680.153/chrome-win64/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];
const chromePath = chromeCandidates.find(existsSync);

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const screenshotsDir = join(__dirname, 'temporary screenshots');

const url = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] || '';

await mkdir(screenshotsDir, { recursive: true });

const files = await readdir(screenshotsDir).catch(() => []);
const nums = files
  .map(f => parseInt(f.match(/^screenshot-(\d+)/)?.[1]))
  .filter(n => !isNaN(n));
const next = nums.length ? Math.max(...nums) + 1 : 1;

const filename = label
  ? `screenshot-${next}-${label}.png`
  : `screenshot-${next}.png`;

const browser = await puppeteer.launch({
  executablePath: chromePath,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

// Wait for fonts and animations to settle
await new Promise(r => setTimeout(r, 1200));

const outputPath = join(screenshotsDir, filename);
await page.screenshot({ path: outputPath, fullPage: true });
await browser.close();

console.log(`Screenshot saved: ${outputPath}`);
