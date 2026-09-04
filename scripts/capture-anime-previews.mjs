import { chromium } from "playwright";

const shots = [
  { name: "idol-team", x: 0, z: -0.6, yaw: 0, pitch: 0.06, firstPerson: true, idolCount: 7 },
  { name: "idol-line", x: 0, z: -4.6, yaw: 0, pitch: 0.14, firstPerson: true, idolCount: 7 },
  { name: "idol-face", x: 1.15, z: -6.1, yaw: 0, pitch: 0.22, firstPerson: true, idolCount: 7 },
  { name: "idol-left", x: -2.3, z: -6.1, yaw: 0, pitch: 0.22, firstPerson: true, idolCount: 7 },
  { name: "idol-three", x: 0, z: -1.6, yaw: 0, pitch: 0.08, firstPerson: true, idolCount: 3 },
  { name: "player-front", x: 0, z: 12, yaw: Math.PI, pitch: 0.1, firstPerson: false, idolCount: 7 },
  { name: "player-back", x: 0, z: 12, yaw: 0, pitch: 0.1, firstPerson: false, idolCount: 7 },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.goto("http://127.0.0.1:5173/?station=ngau-tau-kok", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#enter-button");
  await page.click("#enter-button");
  await page.waitForTimeout(1800);

  let firstPerson = false;
  for (const shot of shots) {
    if (shot.firstPerson !== firstPerson) {
      await page.click("#camera-button");
      firstPerson = shot.firstPerson;
      await page.waitForTimeout(400);
    }
    await page.evaluate(
      ({ x, z, yaw, pitch, idolCount }) => {
        window.__liveHouseDebug?.setIdolCount(idolCount);
        window.__liveHouseDebug?.placePlayer(x, z);
        window.__liveHouseDebug?.setCameraView(yaw, pitch);
      },
      shot,
    );
    await page.waitForTimeout(700);
    await page.screenshot({ path: `preview-anime-${shot.name}.png` });
    console.log(`captured ${shot.name}`);
  }

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
