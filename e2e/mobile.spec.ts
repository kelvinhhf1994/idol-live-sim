import { expect, test, type Page } from "@playwright/test";

test.use({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
});

test("enters the venue and switches camera modes", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /NEON BACKSTAGE/ })).toBeVisible();
  await page.getByRole("button", { name: "進入場館" }).click();
  await expect(page.getByText("LIVE · NEON BACKSTAGE")).toBeVisible();
  await expect(page.locator("#world")).toBeVisible();

  await page.getByRole("button", { name: "切換視角" }).click();
  await expect(page.getByText("第一人稱")).toBeVisible();
  await page.getByRole("button", { name: "切換視角" }).click();
  await expect(page.getByText("第三人稱")).toBeVisible();
  await waitForAnimationFrames(page, 20);

  await page.screenshot({ path: `test-results/live-house-${testInfo.project.name}.png` });
});

test("moves and resets the touch joystick", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();
  const initialSnapshot = await page.evaluate(() => window.__liveHouseDebug?.snapshot());
  expect(initialSnapshot).toBeDefined();

  const joystick = page.getByLabel("移動搖桿");
  const knob = page.locator("#joystick-knob");
  const bounds = await joystick.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;

  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  await joystick.dispatchEvent("pointerdown", {
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    clientX: centerX,
    clientY: centerY,
  });
  await joystick.dispatchEvent("pointermove", {
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    clientX: centerX + bounds.width * 0.25,
    clientY: centerY,
  });
  await expect.poll(() => knob.evaluate((element) => element.style.transform)).not.toBe("translate3d(0px, 0px, 0px)");
  await waitForAnimationFrames(page, 12);
  const movedSnapshot = await page.evaluate(() => window.__liveHouseDebug?.snapshot());
  expect(movedSnapshot?.player.x).toBeGreaterThan(initialSnapshot?.player.x ?? 0);
  await joystick.dispatchEvent("pointercancel", {
    pointerId: 7,
    pointerType: "touch",
    isPrimary: true,
    clientX: centerX + bounds.width * 0.25,
    clientY: centerY,
  });
  await expect.poll(() => knob.evaluate((element) => element.style.transform)).toBe("translate3d(0px, 0px, 0px)");
});

test("jumps once from the touch button and lands", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();
  const initialSnapshot = await page.evaluate(() => window.__liveHouseDebug?.snapshot());
  expect(initialSnapshot).toBeDefined();

  const jumpButton = page.getByRole("button", { name: "跳躍" });
  const bounds = await jumpButton.boundingBox();
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  await jumpButton.dispatchEvent("pointerdown", {
    pointerId: 11,
    pointerType: "touch",
    isPrimary: true,
    clientX: (bounds?.x ?? 0) + (bounds?.width ?? 0) / 2,
    clientY: (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2,
  });

  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().player.y))
    .toBeGreaterThan(initialSnapshot?.player.y ?? 0);
  expect(await page.evaluate(() => window.__liveHouseDebug?.snapshot().cameraYaw)).toBe(initialSnapshot?.cameraYaw);
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().player.y), { timeout: 20_000 })
    .toBeCloseTo(initialSnapshot?.player.y ?? 0, 5);
});

test("rotates the camera from touch drag", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();
  const initialYaw = await page.evaluate(() => window.__liveHouseDebug?.snapshot().cameraYaw);
  const lookZone = page.getByLabel("拖曳控制鏡頭");
  const bounds = await lookZone.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;

  const startX = bounds.x + bounds.width / 2;
  const startY = bounds.y + bounds.height / 2;
  await lookZone.dispatchEvent("pointerdown", {
    pointerId: 9,
    pointerType: "touch",
    isPrimary: true,
    clientX: startX,
    clientY: startY,
  });
  await lookZone.dispatchEvent("pointermove", {
    pointerId: 9,
    pointerType: "touch",
    isPrimary: true,
    clientX: startX + 80,
    clientY: startY,
  });
  await lookZone.dispatchEvent("pointerup", {
    pointerId: 9,
    pointerType: "touch",
    isPrimary: true,
    clientX: startX + 80,
    clientY: startY,
  });

  const rotatedYaw = await page.evaluate(() => window.__liveHouseDebug?.snapshot().cameraYaw);
  expect(rotatedYaw).not.toBe(initialYaw);
});

test("supports tap and held mosh while moving", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();

  const moshButton = page.getByRole("button", { name: "MOSH" });
  await expect(moshButton).toHaveAttribute("aria-pressed", "false");
  const moshBounds = await moshButton.boundingBox();
  expect(moshBounds?.width).toBeGreaterThanOrEqual(44);
  expect(moshBounds?.height).toBeGreaterThanOrEqual(44);
  const moshX = (moshBounds?.x ?? 0) + (moshBounds?.width ?? 0) / 2;
  const moshY = (moshBounds?.y ?? 0) + (moshBounds?.height ?? 0) / 2;

  await moshButton.dispatchEvent("pointerdown", {
    pointerId: 21,
    pointerType: "touch",
    isPrimary: true,
    clientX: moshX,
    clientY: moshY,
  });
  await expect(moshButton).toHaveAttribute("aria-pressed", "true");
  await moshButton.dispatchEvent("pointerup", {
    pointerId: 21,
    pointerType: "touch",
    isPrimary: true,
    clientX: moshX,
    clientY: moshY,
  });
  await expect(moshButton).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().moshActive)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().moshActive)).toBe(false);

  await moshButton.dispatchEvent("pointerdown", {
    pointerId: 22,
    pointerType: "touch",
    isPrimary: true,
    clientX: moshX,
    clientY: moshY,
  });
  await expect(moshButton).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().moshActive)).toBe(true);

  const initialSnapshot = await page.evaluate(() => window.__liveHouseDebug?.snapshot());
  const joystick = page.getByLabel("移動搖桿");
  const joystickBounds = await joystick.boundingBox();
  expect(joystickBounds).not.toBeNull();
  if (!joystickBounds) return;
  const centerX = joystickBounds.x + joystickBounds.width / 2;
  const centerY = joystickBounds.y + joystickBounds.height / 2;
  await joystick.dispatchEvent("pointerdown", {
    pointerId: 23,
    pointerType: "touch",
    isPrimary: true,
    clientX: centerX,
    clientY: centerY,
  });
  await joystick.dispatchEvent("pointermove", {
    pointerId: 23,
    pointerType: "touch",
    isPrimary: true,
    clientX: centerX + joystickBounds.width * 0.25,
    clientY: centerY,
  });
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().player.x))
    .toBeGreaterThan(initialSnapshot?.player.x ?? 0);
  const movedSnapshot = await page.evaluate(() => window.__liveHouseDebug?.snapshot());
  expect(movedSnapshot?.player.x).toBeGreaterThan(initialSnapshot?.player.x ?? 0);
  expect(movedSnapshot?.moshActive).toBe(true);

  await joystick.dispatchEvent("pointercancel", {
    pointerId: 23,
    pointerType: "touch",
    isPrimary: true,
    clientX: centerX,
    clientY: centerY,
  });
  await moshButton.dispatchEvent("pointerup", {
    pointerId: 22,
    pointerType: "touch",
    isPrimary: true,
    clientX: moshX,
    clientY: moshY,
  });
  await expect(moshButton).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().moshActive)).toBe(false);
});

test("holds and releases two-step without tap latching", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();
  const button = page.getByRole("button", { name: "2STEP" });
  const bounds = await button.boundingBox();
  const liftBounds = await page.getByRole("button", { name: "LIFT" }).boundingBox();
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(liftBounds?.x ?? 0);
  if (!bounds) return;

  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  await button.dispatchEvent("pointerdown", {
    pointerId: 25,
    pointerType: "touch",
    isPrimary: true,
    clientX: x,
    clientY: y,
  });
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().twoStepActive))
    .toBe(true);

  await button.dispatchEvent("pointerup", {
    pointerId: 25,
    pointerType: "touch",
    isPrimary: true,
    clientX: x,
    clientY: y,
  });
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().twoStepActive))
    .toBe(false);

  await button.click();
  expect(await page.evaluate(() => window.__liveHouseDebug?.snapshot().twoStepActive)).toBe(false);
});

test("completes one jump-point tap without turning or repeating", async ({ page }) => {
  test.slow();
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();
  const initial = await page.evaluate(() => window.__liveHouseDebug?.snapshot());
  const button = page.getByRole("button", { name: "跳指" });
  const bounds = await button.boundingBox();
  const twoStepBounds = await page.getByRole("button", { name: "2STEP" }).boundingBox();
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(twoStepBounds?.x ?? 0);
  if (!bounds || !initial) return;

  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  await button.dispatchEvent("pointerdown", {
    pointerId: 26,
    pointerType: "touch",
    isPrimary: true,
    clientX: x,
    clientY: y,
  });
  await button.dispatchEvent("pointerup", {
    pointerId: 26,
    pointerType: "touch",
    isPrimary: true,
    clientX: x,
    clientY: y,
  });

  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().jumpPointHeld))
    .toBe(false);
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().player.y))
    .toBeGreaterThan(initial.player.y);
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().jumpPointActive), {
      timeout: 20_000,
    })
    .toBe(false);
  expect(await page.evaluate(() => window.__liveHouseDebug?.snapshot().playerYaw)).toBe(
    initial.playerYaw,
  );
});

test("toggles lift by touch and moves the formation with the joystick", async ({ page }) => {
  test.slow();
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).tap();
  const initialSnapshot = await page.evaluate(() => window.__liveHouseDebug?.snapshot());
  expect(initialSnapshot).toBeDefined();

  const liftButton = page.getByRole("button", { name: "LIFT" });
  const liftBounds = await liftButton.boundingBox();
  expect(liftBounds?.width).toBeGreaterThanOrEqual(44);
  expect(liftBounds?.height).toBeGreaterThanOrEqual(44);
  await liftButton.tap();
  await expect(liftButton).toHaveAttribute("aria-pressed", "true");
  const moshButton = page.getByRole("button", { name: "MOSH" });
  await expect(moshButton).toBeDisabled();
  await expect(moshButton).toHaveAttribute("aria-disabled", "true");
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().liftActive)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().supporterVisible)).toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().player.y))
    .toBeGreaterThan((initialSnapshot?.player.y ?? 0) + 1);

  const raisedSnapshot = await page.evaluate(() => window.__liveHouseDebug?.snapshot());
  const joystick = page.getByLabel("移動搖桿");
  const joystickBounds = await joystick.boundingBox();
  expect(joystickBounds).not.toBeNull();
  if (!joystickBounds) return;
  const centerX = joystickBounds.x + joystickBounds.width / 2;
  const centerY = joystickBounds.y + joystickBounds.height / 2;
  await joystick.dispatchEvent("pointerdown", {
    pointerId: 31,
    pointerType: "touch",
    isPrimary: true,
    clientX: centerX,
    clientY: centerY,
  });
  await joystick.dispatchEvent("pointermove", {
    pointerId: 31,
    pointerType: "touch",
    isPrimary: true,
    clientX: centerX,
    clientY: centerY - joystickBounds.height * 0.25,
  });
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().player.z))
    .toBeLessThan(raisedSnapshot?.player.z ?? 0);
  await joystick.dispatchEvent("pointercancel", {
    pointerId: 31,
    pointerType: "touch",
    isPrimary: true,
    clientX: centerX,
    clientY: centerY,
  });
  const movedSnapshot = await page.evaluate(() => window.__liveHouseDebug?.snapshot());
  expect(movedSnapshot?.supporters[0]?.z).toBeLessThan(raisedSnapshot?.supporters[0]?.z ?? 0);
  expect(movedSnapshot?.supporters[1]?.z).toBeLessThan(raisedSnapshot?.supporters[1]?.z ?? 0);

  await liftButton.tap();
  await expect(liftButton).toHaveAttribute("aria-pressed", "false");
  await expect(moshButton).toBeEnabled();
  await expect(moshButton).toHaveAttribute("aria-disabled", "false");
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().player.y), { timeout: 20_000 })
    .toBeCloseTo(initialSnapshot?.player.y ?? 0, 5);
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().supporterVisible)).toBe(false);
});

test("shows Add to Home Screen guidance on iPhone without fullscreen API", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-webkit");
  await page.addInitScript(() => {
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(document.documentElement, "webkitRequestFullscreen", {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();

  const fullscreenButton = page.getByRole("button", { name: "全螢幕" });
  await expect(fullscreenButton).toBeVisible();
  await fullscreenButton.tap();
  const guide = page.getByRole("dialog", { name: "使用全螢幕模式" });
  await expect(guide).toContainText(
    "點按分享按鈕，再選擇「加入主畫面」，從主畫面開啟即可使用全螢幕模式。",
  );
  await page.getByRole("button", { name: "知道了" }).tap();
  await expect(guide).toBeHidden();
});

test("recognizes standalone display mode without showing guidance", async ({ page }) => {
  await page.addInitScript(() => {
    const originalMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query: string): MediaQueryList => {
      if (query !== "(display-mode: standalone)") return originalMatchMedia(query);
      return {
        matches: true,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => true,
      };
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();

  const fullscreenButton = page.getByRole("button", { name: "退出全螢幕" });
  await expect(fullscreenButton).toHaveAttribute("aria-pressed", "true");
  await fullscreenButton.tap();
  await expect(page.getByRole("dialog", { name: "使用全螢幕模式" })).toBeHidden();
});

test("reports YouTube failure and retries when reopened", async ({ page }) => {
  let apiRequests = 0;
  await page.route("https://www.youtube.com/iframe_api", (route) => {
    apiRequests += 1;
    return route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();

  await page.getByRole("button", { name: "開啟現場影片" }).click();
  await expect(page.getByRole("heading", { name: "現場影片" })).toBeVisible();
  await expect(page.locator("#video-status")).toHaveText("影片暫時無法播放，你仍可繼續探索場館。");
  await page.getByRole("button", { name: "關閉影片" }).click();
  await expect(page.locator("#video-panel")).toBeHidden();
  await page.getByRole("button", { name: "開啟現場影片" }).click();
  await expect(page.locator("#video-status")).toHaveText("影片暫時無法播放，你仍可繼續探索場館。");
  expect(apiRequests).toBe(2);
});

test("asks portrait mobile users to rotate the phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "請旋轉手機" })).toBeVisible();
});

async function waitForAnimationFrames(page: Page, count: number): Promise<void> {
  await page.evaluate(
    (frameCount) =>
      new Promise<void>((resolve) => {
        let remaining = frameCount;
        const next = (): void => {
          remaining -= 1;
          if (remaining <= 0) {
            resolve();
            return;
          }
          window.requestAnimationFrame(next);
        };
        window.requestAnimationFrame(next);
      }),
    count,
  );
}
