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
  test.slow();
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

  const sweeps = await page.evaluate(() => {
    const debug = window.__liveHouseDebug;
    debug?.setTwoStepPhase(0.25);
    const rightSweep = debug?.snapshot().twoStepPose;
    debug?.setTwoStepPhase(0.75);
    const leftSweep = debug?.snapshot().twoStepPose;
    return {
      rightSweep: rightSweep ? { ...rightSweep } : null,
      leftSweep: leftSweep ? { ...leftSweep } : null,
    };
  });
  expect(sweeps.rightSweep?.rightLegX).toBeLessThanOrEqual(0.7);
  expect(sweeps.rightSweep?.rightLegZ).toBeLessThan(-0.2);
  expect(sweeps.rightSweep?.bodyX).toBe(0);
  expect(sweeps.rightSweep?.chestX).toBeLessThan(-0.18);
  expect(sweeps.leftSweep?.leftLegX).toBeCloseTo(sweeps.rightSweep?.rightLegX ?? 0);
  expect(sweeps.leftSweep?.leftLegZ).toBeCloseTo(-(sweeps.rightSweep?.rightLegZ ?? 0));

  await page.evaluate(() => window.__liveHouseDebug?.placePlayer(0, 8));
  const startZ = (await page.evaluate(() => window.__liveHouseDebug?.snapshot().player.z)) ?? 0;
  await page.keyboard.down("KeyW");
  await waitForAnimationFrames(page, 90);
  await page.keyboard.up("KeyW");
  const endZ = (await page.evaluate(() => window.__liveHouseDebug?.snapshot().player.z)) ?? 0;
  expect(endZ).toBeLessThan(startZ - 2);

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

test.skip("loads only valid YouTube input without replacing the current video on error", async ({
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
    (window as unknown as { YT?: unknown }).YT = { Player: MockPlayer };
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

test.skip("minimizes one continuous player and controls playback and seeking", async ({ page }) => {
  test.slow();
  await page.addInitScript(() => {
    let currentTime = 6;
    let playerState = 1;
    let onStateChange: ((event: { data: number }) => void) | undefined;
    const calls = { constructors: 0, pause: 0, play: 0, seeks: [] as number[] };
    const debugWindow = window as Window & {
      __ytCalls?: typeof calls;
      __setYTTime?: (time: number) => void;
      __setYTState?: (state: number) => void;
    };
    debugWindow.__ytCalls = calls;
    debugWindow.__setYTTime = (time) => {
      currentTime = time;
    };
    debugWindow.__setYTState = (state) => {
      playerState = state;
      onStateChange?.({ data: state });
    };
    class MockPlayer {
      constructor(
        element: HTMLElement | string,
        options: {
          events?: {
            onReady?: () => void;
            onStateChange?: (event: { data: number }) => void;
          };
        },
      ) {
        calls.constructors += 1;
        onStateChange = options.events?.onStateChange;
        const host =
          typeof element === "string" ? document.getElementById(element) : element;
        const iframe = document.createElement("iframe");
        iframe.dataset.instance = String(calls.constructors);
        host?.append(iframe);
        queueMicrotask(() => {
          options.events?.onReady?.();
          onStateChange?.({ data: playerState });
        });
      }
      loadVideoById(): void {}
      getCurrentTime(): number {
        return currentTime;
      }
      getPlayerState(): number {
        return playerState;
      }
      seekTo(time: number): void {
        calls.seeks.push(time);
        currentTime = time;
      }
      pauseVideo(): void {
        calls.pause += 1;
        playerState = 2;
        onStateChange?.({ data: playerState });
      }
      playVideo(): void {
        calls.play += 1;
        playerState = 1;
        onStateChange?.({ data: playerState });
      }
      destroy(): void {}
    }
    (window as unknown as { YT?: unknown }).YT = { Player: MockPlayer };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();
  const hudVideoButton = page.getByRole("button", { name: "開啟現場影片" });
  await hudVideoButton.click();
  const panel = page.locator("#video-panel");
  const input = page.getByLabel("YouTube 連結或影片 ID");
  await input.fill("https://youtu.be/dQw4w9WgXcQ");
  await expect(panel).toHaveAttribute("data-state", "expanded");
  await expect(page.locator("#youtube-player iframe")).toHaveAttribute("data-instance", "1");

  await page.getByRole("button", { name: "縮小影片" }).click();
  await expect(panel).toHaveAttribute("data-state", "minimized");
  await expect(input).toBeHidden();
  expect(
    await page.evaluate(
      () => (window as Window & { __ytCalls?: { pause: number } }).__ytCalls?.pause,
    ),
  ).toBe(0);
  await expect(page.locator("#youtube-player iframe")).toHaveAttribute("data-instance", "1");

  const playback = page.locator("#video-playback-toggle");
  await expect(playback).toHaveAttribute("aria-label", "暫停影片");
  await playback.click();
  await expect(playback).toHaveAttribute("aria-label", "播放影片");
  await playback.click();
  await expect(playback).toHaveAttribute("aria-label", "暫停影片");

  await page.getByRole("button", { name: "倒後 10 秒" }).click();
  await page.evaluate(() =>
    (window as Window & { __setYTTime?: (time: number) => void }).__setYTTime?.(20),
  );
  await page.getByRole("button", { name: "快進 10 秒" }).click();
  expect(
    await page.evaluate(
      () => (window as Window & { __ytCalls?: { seeks: number[] } }).__ytCalls?.seeks,
    ),
  ).toEqual([0, 30]);

  await page.getByRole("button", { name: "展開影片" }).click();
  await expect(panel).toHaveAttribute("data-state", "expanded");
  await expect(input).toBeVisible();
  await expect(input).toHaveValue("https://youtu.be/dQw4w9WgXcQ");
  await expect(page.locator("#youtube-player iframe")).toHaveAttribute("data-instance", "1");

  await page.getByRole("button", { name: "縮小現場影片" }).click();
  await expect(panel).toHaveAttribute("data-state", "minimized");
  await page.getByRole("button", { name: "展開現場影片" }).click();
  await expect(panel).toHaveAttribute("data-state", "expanded");
  expect(
    await page.evaluate(
      () => (window as Window & { __ytCalls?: { constructors: number } }).__ytCalls?.constructors,
    ),
  ).toBe(1);
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

test("jumps onto the stage and knocks a performer home again", async ({ page }) => {
  test.slow();
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();
  await page.evaluate(() => window.__liveHouseDebug?.placePlayer(0, -6.8));

  await page.keyboard.down("KeyW");
  await page.keyboard.press("Space");
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().onStage), {
      timeout: 20_000,
    })
    .toBe(true);
  await page.keyboard.up("KeyW");
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().player.y))
    .toBeCloseTo(0.75, 2);

  const moshButton = page.getByRole("button", { name: "MOSH" });
  await moshButton.dispatchEvent("pointerdown", {
    pointerId: 61,
    pointerType: "mouse",
    isPrimary: true,
  });
  expect(
    await page.evaluate(() => window.__liveHouseDebug?.triggerPerformerKnockback("mosh")),
  ).toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().knockedPerformerCount))
    .toBeGreaterThan(0);
  await moshButton.dispatchEvent("pointerup", {
    pointerId: 61,
    pointerType: "mouse",
    isPrimary: true,
  });

  const lifecycle = await page.evaluate(
    () =>
      new Promise<{ sawReturning: boolean; endedHome: boolean }>((resolve, reject) => {
        let sawReturning = false;
        const timeout = window.setTimeout(
          () => reject(new Error("Performer did not return home")),
          40_000,
        );
        const observe = (): void => {
          const snapshot = window.__liveHouseDebug?.snapshot();
          sawReturning ||= (snapshot?.returningPerformerCount ?? 0) > 0;
          const activeCount =
            (snapshot?.knockedPerformerCount ?? 0) + (snapshot?.returningPerformerCount ?? 0);
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

test("keeps a useful third-person camera root across the enlarged stage", async ({ page }) => {
  test.slow();
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();

  for (const yaw of [0, Math.PI, Math.PI / 2, -Math.PI / 2]) {
    await page.evaluate(
      ({ viewYaw }) => {
        window.__liveHouseDebug?.placePlayer(0, -12);
        window.__liveHouseDebug?.setCameraView(viewYaw, -0.12);
      },
      { viewYaw: yaw },
    );
    const snapshot = await page.evaluate(() => window.__liveHouseDebug?.snapshot());
    expect(snapshot?.onStage).toBe(true);
    expect(snapshot?.cameraHorizontalDistance).toBeGreaterThan(3);
  }

  for (const position of [
    { x: 0, z: -9.5, yaw: 0 },
    { x: 0, z: -14.3, yaw: Math.PI },
    { x: -5, z: -12, yaw: -Math.PI / 2 },
    { x: 5, z: -12, yaw: Math.PI / 2 },
  ]) {
    await page.evaluate(({ x, z, yaw }) => {
      window.__liveHouseDebug?.placePlayer(x, z);
      window.__liveHouseDebug?.setCameraView(yaw, -0.12);
    }, position);
    expect(
      await page.evaluate(
        () => window.__liveHouseDebug?.snapshot().cameraHorizontalDistance,
      ),
    ).toBeGreaterThan(0.8);
  }

  await page.getByRole("button", { name: "切換視角" }).click();
  await waitForAnimationFrames(page, 5);
  const firstPerson = await page.evaluate(() => window.__liveHouseDebug?.snapshot());
  expect(firstPerson?.cameraMode).toBe("first");
  expect(firstPerson?.cameraHorizontalDistance).toBeLessThan(0.1);
  expect((firstPerson?.camera.y ?? 0) - (firstPerson?.player.y ?? 0)).toBeCloseTo(1.55, 1);
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


test("keeps moshing across a long hold and exposes held state", async ({ page }) => {
  test.slow();
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();
  const moshButton = page.getByRole("button", { name: "MOSH" });
  const box = await moshButton.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await expect(moshButton).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().moshActive)).toBe(true);
  // Advance enough animation frames for >1 windmill cycle (0.65s each).
  await waitForAnimationFrames(page, 140);
  const mid = await page.evaluate(() => window.__liveHouseDebug?.snapshot());
  expect(mid?.moshActive).toBe(true);
  expect(mid?.moshHeld).toBe(true);
  expect(mid?.moshWindmillTurns ?? 0).toBeGreaterThan(1);
  await page.mouse.up();
  await expect(moshButton).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().moshActive)).toBe(false);
});

test("hides YouTube controls and supports penlight plus settings panels", async ({ page }) => {
  test.slow();
  await page.goto("/");
  await page.getByRole("button", { name: "進入場館" }).click();
  await expect(page.getByRole("button", { name: "開啟現場影片" })).toBeHidden();
  await expect(page.locator("#video-panel")).toBeHidden();

  await page.getByRole("button", { name: "螢光棒" }).click();
  await expect(page.getByRole("dialog", { name: "螢光棒" })).toBeVisible();
  await page.getByRole("option", { name: "水藍" }).click();
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().penlightColorId)).toBe("aqua");
  await expect(page.getByRole("dialog", { name: "螢光棒" })).toBeHidden();
  await expect(page.getByRole("button", { name: "螢光棒" })).toHaveAttribute("aria-pressed", "false");

  // HUD toggle can reopen the panel after an auto-close from color pick.
  await page.getByRole("button", { name: "螢光棒" }).click();
  await expect(page.getByRole("dialog", { name: "螢光棒" })).toBeVisible();
  await page.getByRole("button", { name: "關閉螢光棒面板" }).click();
  await expect(page.getByRole("dialog", { name: "螢光棒" })).toBeHidden();

  await page.getByRole("button", { name: "舉棒" }).click();
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().penlightPose)).toBe("raise");
  await page.getByRole("button", { name: "指台" }).click();
  await expect.poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().penlightPose)).toBe("point");

  await page.getByRole("button", { name: "設定" }).click();
  await expect(page.getByRole("dialog", { name: "設定" })).toBeVisible();
  await page.locator("#setting-walkSpeed").evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = "1.5";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().settings.walkSpeed ?? 0))
    .toBeCloseTo(1.5, 5);
  await page.getByRole("button", { name: "重設預設值" }).click();
  await expect
    .poll(() => page.evaluate(() => window.__liveHouseDebug?.snapshot().settings.walkSpeed ?? 0))
    .toBeCloseTo(1, 5);
});
