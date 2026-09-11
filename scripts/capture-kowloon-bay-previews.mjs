import { chromium } from "playwright";

// Usage: npm run dev (background), then `node scripts/capture-kowloon-bay-previews.mjs [baseUrl]`.
// Writes preview-kb-*.png to the repo root (gitignored).
// Camera yaw: forward = (-sin yaw, -cos yaw); yaw 0 looks toward -Z (the stage).
const SHOTS = [
  { name: "vestibule-doorway", place: [-4.6, 2.2, 0], view: [-Math.PI / 2, -0.02] },
  { name: "audience-facing-stage", place: [1.0, 1.0, 0], view: [0.0, -0.05] },
  // Stand at the +X end of the performer line so the idols do not block the lens
  { name: "stage-facing-audience", place: [2.8, -9.6, 0.7], view: [Math.PI - 0.35, -0.04] },
  { name: "right-side-wc-door", place: [0, -3.0, 0], view: [-Math.PI / 2, -0.02] },
  { name: "left-side-glass-room", place: [2.0, -6.0, 0], view: [Math.PI * 0.75, 0.12] },
  // Inside the backstage corridor looking stage-ward: 2/F stairs, stage stairs, road case
  { name: "backstage-corridor", place: [-5.5, -1.0, 0], view: [0.0, 0.05] },
  { name: "glass-room-view", place: [-4.75, 2.6, 3.0], view: [-0.37, -0.15] },
];

async function run() {
  const baseUrl = process.argv[2] ?? "http://127.0.0.1:5173";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  console.log("Navigating to Kowloon Bay...");
  await page.goto(`${baseUrl}/?station=kowloon-bay`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#enter-button");
  await page.click("#enter-button");
  await page.waitForTimeout(1500);

  // Switch to first-person camera mode
  await page.click("#camera-button");
  await page.waitForTimeout(500);

  for (const shot of SHOTS) {
    await page.evaluate(({ place, view }) => {
      window.__liveHouseDebug?.placePlayer(place[0], place[1], place[2]);
      window.__liveHouseDebug?.setCameraView(view[0], view[1]);
    }, shot);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `preview-kb-${shot.name}.png` });
    console.log(`captured preview-kb-${shot.name}.png`);
  }

  await browser.close();
  console.log("Screenshots captured successfully!");
}

run().catch((err) => {
  console.error("Error capturing screenshots:", err);
  process.exit(1);
});
