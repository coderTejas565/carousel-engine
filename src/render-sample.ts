import puppeteer from "puppeteer";
import path from "node:path";
import fs from "node:fs";
import { renderFlowSlideToHtml } from "./flow-renderer.js";
import { sampleFlowSlide } from "./sample-flow.js";

const WIDTH = 1080;
const HEIGHT = 1350;
const SCALE = 2;

const CHROME_PATH =
  process.env.CHROME_PATH ||
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.resolve(ROOT_DIR, "out");
const OUTPUT_FILE = path.resolve(OUTPUT_DIR, "sample-flow.png");

async function render() {
  console.log("🚀 Starting Flow Slide rendering pipeline...");

  // 1. Validate & generate HTML/SVG
  console.log("⚡ Generating HTML/SVG from FlowSlide JSON...");
  const html = renderFlowSlideToHtml(sampleFlowSlide);

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Optional: write the generated HTML to out/sample-flow.html for inspection/debugging
  const htmlFilePath = path.resolve(OUTPUT_DIR, "sample-flow.html");
  fs.writeFileSync(htmlFilePath, html, "utf8");
  console.log(`📄 Saved generated HTML to: ${htmlFilePath}`);

  // 2. Launch Puppeteer
  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  };

  if (fs.existsSync(CHROME_PATH)) {
    launchOptions.executablePath = CHROME_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  try {
    await page.setViewport({
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: SCALE,
    });

    console.log("🌐 Loading generated HTML into headless browser...");
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    // Wait for fonts to load
    await page.evaluate(async () => {
      await document.fonts.ready;
      const fonts = [
        "700 56px Inter",
        "600 24px Inter",
        "600 18px Inter",
        "500 14px 'JetBrains Mono'",
        "500 12px 'JetBrains Mono'",
      ];
      await Promise.all(
        fonts.map((f) => document.fonts.load(f).catch(() => {}))
      );
    });

    // Small delay to ensure layout & fonts settle
    await new Promise((resolve) => setTimeout(resolve, 300));

    const element = await page.$(".carousel-cover");
    if (!element) {
      throw new Error("Could not find .carousel-cover element in rendered page");
    }

    console.log("📸 Taking screenshot of .carousel-cover...");
    await element.screenshot({
      path: OUTPUT_FILE,
      type: "png",
      omitBackground: false,
    });

    console.log(`✅ Successfully generated PNG: ${OUTPUT_FILE}`);
    console.log(`📐 Resolution: ${WIDTH * SCALE} × ${HEIGHT * SCALE}px (${SCALE}x)`);
  } finally {
    await page.close();
    await browser.close();
  }
}

render().catch((err) => {
  console.error("❌ Render failed:", err);
  process.exit(1);
});
