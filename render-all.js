const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

const WIDTH = 1080;
const HEIGHT = 1350;
const SCALE = 2;

// Directories
const ROOT_DIR = __dirname;
const CAROUSELS_DIR = path.resolve(ROOT_DIR, "carousels");
const OUTPUT_DIR = path.resolve(ROOT_DIR, "out");

// Your installed Chrome
const CHROME_PATH =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

// Carousel name from CLI
const carouselName = process.argv[2];

if (!carouselName) {
  console.error("❌ Missing carousel name.");
  console.error("Usage: node render-all.js <carousel-name>");
  console.error("Example: node render-all.js get-profile");
  process.exit(1);
}

const carouselDir = path.resolve(CAROUSELS_DIR, carouselName);
const outputDir = path.resolve(OUTPUT_DIR, carouselName);

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function ensureDirectory(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function getSlides(dir) {
  return fs
    .readdirSync(dir)
    .filter((file) => file.toLowerCase().endsWith(".html"))
    .sort(naturalSort);
}

function toFileUrl(filePath) {
  return `file://${filePath.replace(/\\/g, "/")}`;
}

async function waitForAssets(page) {
  await page.evaluate(async () => {
    // Wait for fonts
    await document.fonts.ready;

    const fonts = [
      "700 82px Inter",
      "700 56px Inter",
      "600 24px Inter",
      "600 22px Inter",
      "600 15px Inter",
      "500 16px Inter",
      "400 22px Inter",
      "400 18px Inter",
      "400 17px Inter",
      '400 17px "JetBrains Mono"',
      '500 17px "JetBrains Mono"',
    ];

    await Promise.all(
      fonts.map((font) =>
        document.fonts.load(font).catch(() => {})
      )
    );

    // Wait for images
    const images = Array.from(document.images);

    await Promise.all(
      images.map((img) => {
        if (img.complete) {
          return Promise.resolve();
        }

        return new Promise((resolve) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", resolve, { once: true });
        });
      })
    );
  });

  // Give the browser a moment to finish layout/font rendering.
  await new Promise((resolve) => setTimeout(resolve, 300));
}

async function renderSlide(page, file, outputPath) {
  const inputPath = path.join(carouselDir, file);

  console.log(`→ Rendering ${file}`);

  await page.goto(toFileUrl(inputPath), {
    waitUntil: "networkidle0",
  });

  await waitForAssets(page);

  const element = await page.$(".carousel-cover");

  if (!element) {
    throw new Error("Could not find .carousel-cover element");
  }

  await element.screenshot({
    path: outputPath,
    type: "png",
    omitBackground: false,
  });

  console.log(
    `  ✅ ${file} → ${path.relative(ROOT_DIR, outputPath)}`
  );
}

async function main() {
  // Validate carousel
  if (!fs.existsSync(carouselDir)) {
    throw new Error(`Carousel not found: ${carouselDir}`);
  }

  // Validate Chrome
  if (!fs.existsSync(CHROME_PATH)) {
    throw new Error(`Chrome executable not found: ${CHROME_PATH}`);
  }

  // Find slides
  const slides = getSlides(carouselDir);

  if (slides.length === 0) {
    throw new Error(`No HTML slides found in ${carouselDir}`);
  }

  // Create output directory
  ensureDirectory(outputDir);

  console.log("");
  console.log(`🎠 Carousel: ${carouselName}`);
  console.log(`📄 Slides:   ${slides.length}`);
  console.log(`📐 Size:     ${WIDTH} × ${HEIGHT}`);
  console.log(`🔍 Scale:    ${SCALE}x`);
  console.log(`🌐 Chrome:   ${CHROME_PATH}`);
  console.log(`🖼️ Output:   ${outputDir}`);
  console.log("");

  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: CHROME_PATH,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: SCALE,
    });

    let successful = 0;
    let failed = 0;

    for (const file of slides) {
      const outputFile = file.replace(/\.html$/i, ".png");
      const outputPath = path.join(outputDir, outputFile);

      try {
        await renderSlide(page, file, outputPath);
        successful++;
      } catch (error) {
        failed++;

        console.error(`  ❌ ${file}`);
        console.error(`     ${error.message}`);
      }
    }

    console.log("");
    console.log("────────────────────────────────");
    console.log(`✅ Rendered: ${successful}`);
    console.log(`❌ Failed:   ${failed}`);
    console.log("────────────────────────────────");

    console.log(
      `📦 Output resolution: ${WIDTH * SCALE} × ${HEIGHT * SCALE}px`
    );

    if (failed === 0) {
      console.log("🎉 Carousel rendered successfully.");
    } else {
      console.error("⚠️ Carousel completed with errors.");
      process.exitCode = 1;
    }
  } finally {
    await page.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error("");
  console.error(`❌ ${error.message}`);
  process.exitCode = 1;
});