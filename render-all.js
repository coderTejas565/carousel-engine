const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const SLIDES_DIR = path.resolve(__dirname, 'slides');
const OUTPUT_DIR = path.resolve(__dirname, 'out');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WIDTH = 1080;
const HEIGHT = 1350;
const SCALE = 2;

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const files = fs
    .readdirSync(SLIDES_DIR)
    .filter((f) => f.endsWith('.html'))
    .sort();

  if (files.length === 0) {
    console.error('❌ No HTML files found in /slides');
    await browser.close();
    process.exit(1);
  }

  console.log(`Found ${files.length} slides. Rendering...\n`);

  for (const file of files) {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: SCALE });

    const filePath = path.join(SLIDES_DIR, file);
    await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });

    // Ensure all fonts used across slides are loaded
    await page.evaluate(async () => {
      await document.fonts.ready;
      const loads = [
        '700 82px Inter', '700 56px Inter', '600 24px Inter',
        '600 22px Inter', '600 15px Inter', '500 16px Inter',
        '400 22px Inter', '400 18px Inter', '400 17px Inter',
        '400 17px "JetBrains Mono"', '500 17px "JetBrains Mono"',
      ];
      await Promise.all(loads.map((s) => document.fonts.load(s).catch(() => {})));
    });

    await new Promise((r) => setTimeout(r, 250));

    const el = await page.$('.carousel-cover');
    if (!el) {
      console.warn(`⚠️  ${file} — no .carousel-cover, skipping`);
      await page.close();
      continue;
    }

    const outPath = path.join(OUTPUT_DIR, file.replace('.html', '.png'));
    await el.screenshot({ path: outPath, type: 'png' });

    console.log(`✅ ${file.padEnd(10)} → out/${path.basename(outPath)}`);
    await page.close();
  }

  console.log(`\n🎉 Done. ${files.length} slides → ${OUTPUT_DIR}`);
  console.log(`   Resolution: ${WIDTH * SCALE} × ${HEIGHT * SCALE}px each`);
  await browser.close();
})();