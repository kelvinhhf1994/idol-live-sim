# 3D Live House Explorer MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一個手機橫向專用、可第一／第三人稱切換並觀看五人偶像演出的低多邊形 3D Live House 探索原型。

**Architecture:** 使用 Vite、TypeScript 與 Three.js。首版場館及角色由獨立的程式化建立器產生，玩家輸入、碰撞、鏡頭、演出及 YouTube UI 各自封裝，日後可把建立器替換成 GLB 載入器。

**Tech Stack:** Vite、TypeScript、Three.js、Vitest、HTML、CSS、YouTube IFrame Player API

## Global Constraints

- 僅支援手機瀏覽器橫向操作；直向顯示旋轉提示。
- 左側類比搖桿移動，右側拖曳鏡頭。
- 支援第一及第三人稱即時切換。
- 場景包含入口、售票位、主場館、舞台、吧台、音控位及小後台。
- 舞台有五位低多邊形偶像，觀眾為 8 至 15 名。
- 不使用 React、後端或完整物理引擎。
- 裝置像素比例上限為 1.5，目標手機平均約 30 FPS。
- YouTube 只透過官方可見 IFrame Player 播放，不抽取音訊。
- 所有程式碼註解使用英文。
- 目前目錄不是 Git repository，不建立提交。

## File Structure

- `package.json`：開發、測試及建置指令。
- `index.html`：Canvas、進場畫面、手機控制及 YouTube 容器。
- `src/main.ts`：應用程式入口。
- `src/styles.css`：手機橫向 UI、搖桿及場館介面。
- `src/app/App.ts`：Three.js 初始化、更新循環及模組協調。
- `src/config/venue.ts`：`VenueDefinition` 與第一間場館設定。
- `src/core/collision.ts`：玩家圓形碰撞與 AABB 滑動。
- `src/core/collision.test.ts`：碰撞單元測試。
- `src/input/VirtualJoystick.ts`：類比搖桿 Pointer Events。
- `src/player/PlayerController.ts`：移動、角色朝向及步行动畫。
- `src/player/CameraController.ts`：第一／第三人稱及右側拖曳。
- `src/scene/createVenue.ts`：程式化低多邊形場館、材質、燈光及碰撞物。
- `src/scene/createCharacter.ts`：共用低多邊形人物建立器。
- `src/show/ShowController.ts`：五位偶像及觀眾循環動畫。
- `src/ui/YouTubePlayer.ts`：官方播放器生命週期及錯誤狀態。
- `src/types/youtube.d.ts`：YouTube IFrame API 最小型別。

---

### Task 1: Project foundation and render smoke test

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/styles.css`
- Create: `src/app/App.ts`

**Interfaces:**
- Produces: `new App(canvas: HTMLCanvasElement)`、`App.start(): void`、`App.dispose(): void`

- [ ] **Step 1: Install current dependencies**

Run:

```bash
npm init -y
npm install three
npm install -D vite typescript vitest @types/three
```

Expected: `package.json` and `package-lock.json` exist; installation exits with code 0.

- [ ] **Step 2: Add exact scripts**

Set scripts to:

```json
{
  "dev": "vite",
  "build": "tsc --noEmit && vite build",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Build the smallest render loop**

`App` creates `WebGLRenderer`, `Scene`, `PerspectiveCamera`, limits pixel ratio with `Math.min(devicePixelRatio, 1.5)`, handles resize, renders each animation frame, and exposes `dispose()` to cancel the frame and dispose the renderer.

- [ ] **Step 4: Verify the foundation**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build succeed and produce `dist/`.

### Task 2: Venue definition and collision behavior

**Files:**
- Create: `src/config/venue.ts`
- Create: `src/core/collision.ts`
- Create: `src/core/collision.test.ts`

**Interfaces:**
- Produces: `Aabb2`, `VenueDefinition`, `GENERIC_VENUE`, `moveCircleWithCollisions(position, delta, radius, colliders)`

- [ ] **Step 1: Write failing collision tests**

Use these cases:

```ts
it("moves freely when no collider is reached", () => {
  expect(moveCircleWithCollisions({ x: 0, z: 0 }, { x: 1, z: 0 }, 0.35, [])).toEqual({ x: 1, z: 0 });
});

it("stops before crossing a wall", () => {
  const wall = { minX: 1, maxX: 2, minZ: -1, maxZ: 1 };
  expect(moveCircleWithCollisions({ x: 0, z: 0 }, { x: 2, z: 0 }, 0.35, [wall]).x).toBeLessThan(1);
});

it("slides on the free axis", () => {
  const wall = { minX: 1, maxX: 2, minZ: -2, maxZ: 2 };
  const result = moveCircleWithCollisions({ x: 0, z: 0 }, { x: 2, z: 0.5 }, 0.35, [wall]);
  expect(result.z).toBeCloseTo(0.5);
});
```

- [ ] **Step 2: Confirm tests fail**

Run:

```bash
npm test -- src/core/collision.test.ts
```

Expected: FAIL because `moveCircleWithCollisions` does not exist.

- [ ] **Step 3: Implement axis-separated circle-to-AABB movement**

Apply X movement, reject it when the circle overlaps any expanded collider, then independently apply Z movement. Return a new `{ x, z }` without mutating input.

- [ ] **Step 4: Define the first venue**

`GENERIC_VENUE` contains:

```ts
{
  id: "generic-hk-live-house-01",
  name: "Neon Backstage",
  spawn: { x: 0, y: 0, z: 15, yaw: Math.PI },
  bounds: { minX: -9, maxX: 9, minZ: -16, maxZ: 18 },
  youtubeVideoId: "M7lc1UVf-VE"
}
```

The video ID is YouTube's official IFrame API demonstration video and remains configurable.

- [ ] **Step 5: Verify collision tests**

Run:

```bash
npm test -- src/core/collision.test.ts
```

Expected: 3 tests pass.

### Task 3: Procedural low-poly venue

**Files:**
- Create: `src/scene/createVenue.ts`
- Modify: `src/app/App.ts`

**Interfaces:**
- Consumes: `VenueDefinition`
- Produces: `createVenue(definition): { group: THREE.Group; colliders: Aabb2[]; stageCenter: THREE.Vector3; audiencePoints: THREE.Vector3[] }`

- [ ] **Step 1: Create reusable mesh helpers**

Implement local `box()` and `cylinder()` helpers that set position, shadow flags and flat-shaded materials. Do not expose a general scene framework.

- [ ] **Step 2: Build the complete compact layout**

Create the street facade, neon entrance, corridor, ticket desk, dark main hall, raised stage, side bar, sound booth, backstage opening, ceiling truss and emergency exit. Add matching collision boxes for outside walls, stage, bar, ticket desk and sound booth.

- [ ] **Step 3: Add mobile-conscious lighting**

Add one HemisphereLight, one shadow-casting DirectionalLight, four non-shadow SpotLights aimed at the stage, exponential fog and an sRGB background. Set renderer tone mapping to ACES Filmic.

- [ ] **Step 4: Integrate venue into App**

Add the venue group to the scene, save its colliders and frame the loading camera toward the entrance.

- [ ] **Step 5: Verify build**

Run:

```bash
npm run build
```

Expected: build succeeds without TypeScript errors.

### Task 4: Mobile player, joystick and camera

**Files:**
- Create: `src/input/VirtualJoystick.ts`
- Create: `src/scene/createCharacter.ts`
- Create: `src/player/PlayerController.ts`
- Create: `src/player/CameraController.ts`
- Modify: `src/app/App.ts`
- Modify: `index.html`
- Modify: `src/styles.css`

**Interfaces:**
- Produces: `VirtualJoystick.value: { x: number; y: number }`
- Produces: `PlayerController.update(dt, moveInput, cameraYaw): void`
- Produces: `CameraController.mode: "first" | "third"` and `toggleMode(): void`

- [ ] **Step 1: Implement pointer-safe joystick**

Capture one pointer, clamp the knob to its circular radius, normalize output to `[-1, 1]`, and reset on `pointerup`, `pointercancel`, `lostpointercapture`, `blur` and `visibilitychange`.

- [ ] **Step 2: Create the fixed player avatar**

Build one low-poly character from capsule, sphere, cylinder and box geometries. Return pivots for arms and legs so `PlayerController` can animate walking without a skeleton.

- [ ] **Step 3: Implement player movement**

Convert joystick input relative to camera yaw, normalize diagonal movement, move at `3.2` world units per second, resolve collision with `moveCircleWithCollisions`, clamp to venue bounds, rotate toward travel direction and animate limbs with sine waves.

- [ ] **Step 4: Implement dual camera**

First-person camera uses height `1.55`; third-person uses distance `4.2` and height `2.3`. Right-side drag adjusts yaw and pitch, pitch clamps between `-0.7` and `0.55`, and camera movement uses exponential damping.

- [ ] **Step 5: Wire mobile controls**

Add the joystick, camera interaction layer and view toggle button. Prevent browser scrolling and zoom gestures only within the game surface.

- [ ] **Step 6: Verify build and tests**

Run:

```bash
npm test
npm run build
```

Expected: all tests and the production build pass.

### Task 5: Five idols and animated audience

**Files:**
- Modify: `src/scene/createCharacter.ts`
- Create: `src/show/ShowController.ts`
- Modify: `src/app/App.ts`

**Interfaces:**
- Produces: `createIdol(options)`、`createAudienceMember(options)`
- Produces: `ShowController.update(elapsed: number): void`

- [ ] **Step 1: Create five distinct idol variants**

Reuse character geometry and provide five palettes, hair silhouettes and stage positions. Each idol includes arm, leg, torso and head pivots.

- [ ] **Step 2: Implement the dance loop**

Use a repeating eight-count animation based on sine and cosine curves: side step, alternating arm raise, torso bounce and head turn. Apply phase offsets no greater than `0.08` seconds.

- [ ] **Step 3: Create 12 audience members**

Use three shared color palettes and place members at configured audience points. Animate sway, hand raise and small jumps in three repeating variants.

- [ ] **Step 4: Integrate and verify**

Update `ShowController` from the central animation loop, then run:

```bash
npm run build
```

Expected: build succeeds with five idol instances and twelve audience instances.

### Task 6: Entry flow, orientation and YouTube player

**Files:**
- Create: `src/ui/YouTubePlayer.ts`
- Create: `src/types/youtube.d.ts`
- Modify: `index.html`
- Modify: `src/styles.css`
- Modify: `src/app/App.ts`

**Interfaces:**
- Produces: `YouTubePlayer.open(): void`、`close(): void`、`dispose(): void`

- [ ] **Step 1: Add entry and orientation UI**

Create a branded entry card with「進入場館」and a portrait-only「請旋轉手機」overlay. The render loop starts immediately, but player input remains disabled until entry.

- [ ] **Step 2: Add fullscreen behavior**

Show the fullscreen button only when `document.documentElement.requestFullscreen` exists. Treat rejection as non-fatal.

- [ ] **Step 3: Load the official YouTube API**

Load `https://www.youtube.com/iframe_api` once, create a visible 16:9 player with `youtubeVideoId`, and expose close/reopen controls. Handle `onError` by displaying「影片暫時無法播放，你仍可繼續探索場館。」.

- [ ] **Step 4: Preserve gameplay during player failure**

The YouTube module must not pause, block or dispose the Three.js scene when the API or video fails.

- [ ] **Step 5: Verify build**

Run:

```bash
npm run build
```

Expected: build succeeds and the generated page contains no bundled YouTube media.

### Task 7: Performance pass and browser verification

**Files:**
- Modify: `src/app/App.ts`
- Modify: `src/scene/createVenue.ts`
- Modify: `src/styles.css`
- Create: `README.md`

**Interfaces:**
- Produces: runnable local and production build instructions.

- [ ] **Step 1: Apply renderer limits**

Cap pixel ratio at `1.5`, enable frustum culling, use one shadow light, use `PCFSoftShadowMap`, share materials and geometries, pause animation when the page is hidden, and resize only when dimensions change.

- [ ] **Step 2: Add simple adaptive quality**

Measure a rolling five-second FPS average. If it remains below 24 FPS, set pixel ratio to `1`, hide four audience members and disable fog. Never reduce below eight visible audience members.

- [ ] **Step 3: Document operation**

README includes:

```bash
npm install
npm run dev
npm test
npm run build
```

It also documents landscape-only mobile controls and the configurable YouTube video ID.

- [ ] **Step 4: Run automated verification**

Run:

```bash
npm test
npm run build
```

Expected: all tests pass and production build succeeds.

- [ ] **Step 5: Run mobile browser smoke test**

Verify at a landscape mobile viewport:

- Entry button opens the venue.
- Joystick moves and resets when released.
- Right-side drag rotates the camera.
- View button toggles both camera modes.
- Player does not cross the stage or outer walls.
- Five idols and at least eight audience members animate.
- YouTube panel opens visibly and closes without stopping exploration.
- Portrait viewport displays the rotation overlay.

