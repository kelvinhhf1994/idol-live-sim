import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log("Navigating to live house...");
  await page.goto("http://127.0.0.1:5173/?station=ngau-tau-kok", { waitUntil: "domcontentloaded" });

  await page.waitForSelector("#enter-button");
  await page.click("#enter-button");
  await page.waitForTimeout(1500);

  // Switch to first-person camera mode
  await page.click("#camera-button");
  await page.waitForTimeout(500);

  // 1. Lobby Overview: Outside in corridor facing entrance doors
  console.log("Capturing Perspective 1: Lobby Overview...");
  await page.evaluate(() => {
    window.__liveHouseDebug?.placePlayer(0, 16.2);
    window.__liveHouseDebug?.setCameraView(0.0, 0.0);
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: "preview-ntk-lobby-overview.png" });

  // 2. Chamame Tuck Shop View (matching Image 1 photo perspective)
  console.log("Capturing Perspective 2: Chamame Tuck Shop...");
  await page.evaluate(() => {
    window.__liveHouseDebug?.placePlayer(-3.2, 11.0);
    window.__liveHouseDebug?.setCameraView(2.45, -0.06);
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: "preview-ntk-tuck-shop-view.png" });

  // 3. Chamame Merch Lobby through Glass (matching Image 2 photo perspective)
  console.log("Capturing Perspective 3: Chamame Merch Shop through glass...");
  await page.evaluate(() => {
    window.__liveHouseDebug?.placePlayer(0.0, 14.0);
    window.__liveHouseDebug?.setCameraView(-2.12, -0.04);
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: "preview-ntk-merch-shop-view.png" });

  // 4. Merch Shop Interior Close-up (CHAMAME sign, T-shirts, table, idol standee)
  console.log("Capturing Perspective 4: Merch Shop Interior...");
  await page.evaluate(() => {
    window.__liveHouseDebug?.placePlayer(3.9, 13.5);
    window.__liveHouseDebug?.setCameraView(Math.PI, -0.02);
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: "preview-ntk-merch-interior-close.png" });

  // 5. View from Inside Hall Looking Out to Lobby
  console.log("Capturing Perspective 5: View from Inside Hall to Lobby...");
  await page.evaluate(() => {
    window.__liveHouseDebug?.placePlayer(0, 9.2);
    window.__liveHouseDebug?.setCameraView(Math.PI, 0.02);
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: "preview-ntk-view-out-to-lobby.png" });

  await browser.close();
  console.log("Screenshots captured successfully!");
}

run().catch((err) => {
  console.error("Error capturing screenshots:", err);
  process.exit(1);
});
