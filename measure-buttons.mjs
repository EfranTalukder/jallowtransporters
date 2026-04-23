import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  executablePath: 'C:/Users/Efran/.cache/puppeteer/chrome/win64-146.0.7680.153/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
const w = parseInt(process.argv[2] || '390', 10);
await page.setViewport({ width: w, height: 844 });
await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });

const data = await page.evaluate(() => {
  const sel = '.cta-band .flex.flex-wrap';
  const container = document.querySelector(sel);
  const btns = container.querySelectorAll('.btn-primary, .btn-outline');
  const cRect = container.getBoundingClientRect();
  return {
    containerWidth: cRect.width,
    viewportWidth: window.innerWidth,
    buttons: Array.from(btns).map(b => {
      const r = b.getBoundingClientRect();
      const cs = getComputedStyle(b);
      return {
        text: b.textContent.trim().slice(0, 40),
        width: r.width,
        height: r.height,
        top: r.top,
        left: r.left,
        padding: cs.padding,
        fontSize: cs.fontSize,
        minHeight: cs.minHeight,
      };
    })
  };
});
console.log(JSON.stringify(data, null, 2));
await browser.close();
