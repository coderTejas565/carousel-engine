const puppeteer = require('puppeteer');
const path = require('path');

const INPUT_HTML = path.resolve(__dirname, 'cover.html');
const OUTPUT_PNG = path.resolve(__dirname, 'tejas-cover-01.png');

// Your installed Chrome
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const WIDTH = 1080;
const HEIGHT = 1350;
const SCALE = 2;

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();

  await page.setViewport({
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: SCALE,
  });

  await page.goto(`file://${INPUT_HTML}`, { waitUntil: 'networkidle0' });

  await page.evaluate(async () => {
    await document.fonts.ready;
    await document.fonts.load('700 82px Inter');
    await document.fonts.load('600 24px Inter');
    await document.fonts.load('500 16px Inter');
    await document.fonts.load('400 18px Inter');
  });

  await new Promise((r) => setTimeout(r, 300));

  const element = await page.$('.carousel-cover');
  if (!element) throw new Error('Could not find .carousel-cover element');

  await element.screenshot({
    path: OUTPUT_PNG,
    type: 'png',
    omitBackground: false,
  });

  console.log(`✅ Rendered: ${OUTPUT_PNG}`);
  console.log(`   Output: ${WIDTH * SCALE} × ${HEIGHT * SCALE}px (${SCALE}x)`);

  await browser.close();
})();