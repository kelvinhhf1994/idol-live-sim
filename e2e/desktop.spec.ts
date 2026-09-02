import { expect, test, type Page } from "@playwright/test";

test("supports desktop movement, jumping, and mosh", async ({ page }) => {
  test.slow();
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();

  await expect(page.getByText("WASD 移動 · Space 跳躍 · 拖曳鏡頭")).toBeVisible();
  await expect(page.getByLabel("移動搖桿")).toBeHidden();
  await expect(page.getByRole("button", { name: "跳躍" })).toBeHidden();

  const initialSnapshot = await page.evaluate(() => window.__liveHouseDebug?.snapshot());
  expect(initialSnapshot).toBeDefined();

  const walkingStart = (await page.evaluate(() => window.__liveHouseDebug?.snapshot().player.z)) ?? 0;
  await page.keyboard.down("KeyW");
  await waitForAnimationFrames(page, 20);
  await page.keyboard.up("KeyW");
  const walkingEnd = (await page.evaluate(() => window.__liveHouseDebug?.snapshot().player.z)) ?? 0;
  const walkingDistance = Math.abs(walkingEnd - walkingStart);

  await page.keyboard.press("Space");
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().player.y))
    .toBeGreaterThan(initialSnapshot?.player.y ?? 0);
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().player.y), { timeout: 20_000 })
    .toBeCloseTo(initialSnapshot?.player.y ?? 0, 5);

  const moshButton = page.getByRole("button", { name: "MOSH" });
  await expect(moshButton).toBeVisible();
  await expect(moshButton).toHaveAttribute("aria-pressed", "false");
  const moshBounds = await moshButton.boundingBox();
  expect(moshBounds?.width).toBeGreaterThanOrEqual(44);
  expect(moshBounds?.height).toBeGreaterThanOrEqual(44);
  if (!moshBounds) return;
  await page.mouse.move(moshBounds.x + moshBounds.width / 2, moshBounds.y + moshBounds.height / 2);
  await page.mouse.down();
  await expect(moshButton).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().moshActive)).toBe(true);
  const moshMovementStart =
    (await page.evaluate(() => window.__liveHouseDebug?.snapshot().player.z)) ?? 0;
  await page.keyboard.down("KeyW");
  await waitForAnimationFrames(page, 20);
  await page.keyboard.up("KeyW");
  const moshMovementEnd =
    (await page.evaluate(() => window.__liveHouseDebug?.snapshot().player.z)) ?? 0;
  expect(Math.abs(moshMovementEnd - moshMovementStart)).toBeGreaterThan(walkingDistance * 1.12);
  await page.mouse.up();
  await expect(moshButton).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().moshActive)).toBe(false);
});

test("moves with WASD only while the two-step button is held", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();
  const button = page.getByRole("button", { name: "2STEP" });
  const bounds = await button.boundingBox();
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  if (!bounds) return;

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().twoStepActive))
    .toBe(true);

  const startZ = (await page.evaluate(() => window.__liveHouseDebug?.snapshot().player.z)) ?? 0;
  await page.keyboard.down("KeyW");
  await waitForAnimationFrames(page, 20);
  await page.keyboard.up("KeyW");
  const endZ = (await page.evaluate(() => window.__liveHouseDebug?.snapshot().player.z)) ?? 0;
  expect(endZ).toBeLessThan(startZ);

  await page.mouse.up();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().twoStepActive))
    .toBe(false);
});

test("repeats jump-point while held, stops after release, and preserves yaw", async ({ page }) => {
  test.slow();
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();
  const initial = await page.evaluate(() => window.__liveHouseDebug?.snapshot());
  const button = page.getByRole("button", { name: "跳指" });
  const bounds = await button.boundingBox();
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  expect(bounds?.height).toBeGreaterThanOrEqual(44);
  if (!bounds || !initial) return;

  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().player.y))
    .toBeGreaterThan(initial.player.y + 0.1);
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().player.y), {
      timeout: 20_000,
    })
    .toBeCloseTo(initial.player.y, 2);
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().player.y), {
      timeout: 20_000,
    })
    .toBeGreaterThan(initial.player.y + 0.1);

  await page.mouse.up();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().jumpPointActive), {
      timeout: 20_000,
    })
    .toBe(false);
  expect(await page.evaluate(() => window.__liveHouseDebug?.snapshot().playerYaw)).toBe(
    initial.playerYaw,
  );
});

test("toggles lift with a click and moves the full formation", async ({ page }) => {
  test.slow();
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();
  const initialSnapshot = await page.evaluate(() => window.__liveHouseDebug?.snapshot());
  expect(initialSnapshot).toBeDefined();

  const liftButton = page.getByRole("button", { name: "LIFT" });
  await expect(liftButton).toHaveAttribute("aria-pressed", "false");
  const bounds = await liftButton.boundingBox();
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  expect(bounds?.height).toBeGreaterThanOrEqual(44);

  const walkingStart = (await page.evaluate(() => window.__liveHouseDebug?.snapshot().player.z)) ?? 0;
  await page.keyboard.down("KeyW");
  await waitForAnimationFrames(page, 20);
  await page.keyboard.up("KeyW");
  const walkingEnd = (await page.evaluate(() => window.__liveHouseDebug?.snapshot().player.z)) ?? 0;
  const walkingDistance = Math.abs(walkingEnd - walkingStart);

  const moshButton = page.getByRole("button", { name: "MOSH" });
  await moshButton.dispatchEvent("pointerdown", {
    pointerId: 41,
    pointerType: "mouse",
    isPrimary: true,
  });
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().moshActive)).toBe(true);
  await liftButton.click();
  await expect(liftButton).toHaveAttribute("aria-pressed", "true");
  await expect(moshButton).toBeDisabled();
  await expect(moshButton).toHaveAttribute("aria-disabled", "true");
  await expect(moshButton).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().moshActive)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().liftActive)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().supporterVisible)).toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().player.y))
    .toBeGreaterThan((initialSnapshot?.player.y ?? 0) + 1);

  const raisedSnapshot = await page.evaluate(() => window.__liveHouseDebug?.snapshot());
  await page.keyboard.down("KeyW");
  await waitForAnimationFrames(page, 20);
  await page.keyboard.up("KeyW");
  const movedSnapshot = await page.evaluate(() => window.__liveHouseDebug?.snapshot());
  const liftDistance = Math.abs((movedSnapshot?.player.z ?? 0) - (raisedSnapshot?.player.z ?? 0));
  expect(liftDistance).toBeGreaterThan(walkingDistance * 1.7);
  expect(movedSnapshot?.supporters[0]?.z).toBeLessThan(raisedSnapshot?.supporters[0]?.z ?? 0);
  expect(movedSnapshot?.supporters[1]?.z).toBeLessThan(raisedSnapshot?.supporters[1]?.z ?? 0);

  await liftButton.click();
  await expect(liftButton).toHaveAttribute("aria-pressed", "false");
  await expect(moshButton).toBeEnabled();
  await expect(moshButton).toHaveAttribute("aria-disabled", "false");
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().player.y), { timeout: 20_000 })
    .toBeCloseTo(initialSnapshot?.player.y ?? 0, 5);
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().supporterVisible)).toBe(false);
});

test("toggles native fullscreen and keeps its state in sync", async ({ page }) => {
  await page.addInitScript(() => {
    let activeElement: Element | null = null;
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => activeElement,
    });
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: async () => {
        activeElement = document.documentElement;
        document.dispatchEvent(new Event("fullscreenchange"));
      },
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: async () => {
        activeElement = null;
        document.dispatchEvent(new Event("fullscreenchange"));
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();

  const fullscreenButton = page.getByRole("button", { name: "全螢幕" });
  await expect(fullscreenButton).toHaveAttribute("aria-pressed", "false");
  await fullscreenButton.click();
  await expect(page.getByRole("button", { name: "退出全螢幕" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "退出全螢幕" }).click();
  await expect(page.getByRole("button", { name: "全螢幕" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});

test("loads only valid YouTube input without replacing the current video on error", async ({
  page,
}) => {
  test.slow();
  await page.addInitScript(() => {
    const loadedIds: string[] = [];
    (window as Window & { __loadedYouTubeIds?: string[] }).__loadedYouTubeIds = loadedIds;
    class MockPlayer {
      constructor(
        _element: HTMLElement | string,
        options: { events?: { onReady?: () => void } },
      ) {
        queueMicrotask(() => options.events?.onReady?.());
      }
      loadVideoById(videoId: string): void {
        loadedIds.push(videoId);
      }
      pauseVideo(): void {}
      destroy(): void {}
    }
    (window as Window & { YT?: unknown }).YT = { Player: MockPlayer };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();
  await page.getByRole("button", { name: "開啟現場影片" }).click();

  const input = page.getByLabel("YouTube 連結或影片 ID");
  await input.fill("https://evil-youtube.com/watch?v=dQw4w9WgXcQ");
  await page.getByRole("button", { name: "載入影片" }).click();
  await expect(page.getByText("請輸入有效的 YouTube 連結")).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as Window & { __loadedYouTubeIds?: string[] }).__loadedYouTubeIds,
    ),
  ).toEqual([]);

  await input.fill("https://youtu.be/dQw4w9WgXcQ?si=example");
  await page.getByRole("button", { name: "載入影片" }).click();
  await expect(page.getByText("請輸入有效的 YouTube 連結")).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as Window & { __loadedYouTubeIds?: string[] }).__loadedYouTubeIds,
      ),
    )
    .toEqual(["dQw4w9WgXcQ"]);
  await expect(input).toHaveValue("https://youtu.be/dQw4w9WgXcQ?si=example");
});

test("knocks an audience member away during lift and returns them home", async ({ page }) => {
  test.slow();
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();
  await page.getByRole("button", { name: "LIFT" }).click();
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().liftActive)).toBe(true);

  expect(
    await page.evaluate(() => window.__liveHouseDebug?.triggerAudienceKnockback("lift")),
  ).toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().knockedAudienceCount), {
      timeout: 2_000,
    })
    .toBeGreaterThan(0);

  const lifecycle = await page.evaluate(
    () =>
      new Promise<{ sawReturning: boolean; endedHome: boolean }>((resolve, reject) => {
        let sawReturning = false;
        const timeout = window.setTimeout(
          () => reject(new Error("Audience did not return home")),
          40_000,
        );
        const observe = (): void => {
          const snapshot = window.__liveHouseDebug?.snapshot();
          sawReturning ||= (snapshot?.returningAudienceCount ?? 0) > 0;
          const activeCount =
            (snapshot?.knockedAudienceCount ?? 0) + (snapshot?.returningAudienceCount ?? 0);
          if (sawReturning && activeCount === 0) {
            window.clearTimeout(timeout);
            resolve({ sawReturning, endedHome: true });
            return;
          }
          window.requestAnimationFrame(observe);
        };
        window.requestAnimationFrame(observe);
      }),
  );
  expect(lifecycle).toEqual({ sawReturning: true, endedHome: true });
});

async function waitForAnimationFrames(page: Page, count: number): Promise<void> {
  await page.evaluate(
    (frameCount) =>
      new Promise<void>((resolve) => {
        let remaining = frameCount;
        const next = (): void => {
          remaining -= 1;
          if (remaining <= 0) resolve();
          else window.requestAnimationFrame(next);
        };
        window.requestAnimationFrame(next);
      }),
    count,
  );
}
