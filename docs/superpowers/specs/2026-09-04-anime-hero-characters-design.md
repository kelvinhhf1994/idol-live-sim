# 主要角色日系動漫風升級 — 設計規格

## 1. 目標

把主角與五位舞台偶像從現時的「低多邊形 PBR」外觀，升級為日系動漫（賽璐璐）外觀，令主要角色在畫面上明顯更精緻、更有動漫感。

十二位觀眾與兩位 Lift 支援 NPC **不在本次範圍**，維持現狀。

## 2. 現況

所有人形由 `src/scene/createCharacter.ts` 的 `createLowPolyPerson()` 程式化組裝：球體、膠囊體、圓柱體加 `MeshStandardMaterial({ flatShading: true })`。沒有任何 GLTF/GLB/VRM 外部模型，動畫是自訂的關節 `Group` 樹（`PersonPose`），不是骨骼動畫。

角色總高 1.8843，頭部直徑約 0.556，即約 3.4 頭身。此尺寸被 `createCharacterV2.test.ts` 鎖定於 ±5mm，並被玩家碰撞、攝影機視點、Lift 雙骨 IK 的手臂長度共同依賴。

## 3. 範圍決定

**不改動身體比例。** 3.4 頭身本身是成立的日系 SD／Q 版偶像比例；動漫感主要來自著色與臉部，而非身高比例。改為 6 頭身需同步重做碰撞、攝影機、IK 與測試，屬於獨立工程，不在本次範圍。

**不新增任何 npm 依賴**，不引入 `EffectComposer` 或後製 pass。

## 4. 架構

新增一個 `style?: "lowpoly" | "anime"` 選項到 `CharacterOptions`，預設 `"lowpoly"`。只有傳入 `"anime"` 的角色會走新路徑，其餘呼叫端行為與輸出完全不變。

三個新模組各自單一職責，可獨立測試：

| 模組 | 職責 | 對外介面 |
|------|------|----------|
| `src/scene/toonMaterials.ts` | 賽璐璐著色材質 | `makeToonMaterial(color, emissive?)` |
| `src/scene/outline.ts` | 固定世界厚度描邊 | `addOutline(mesh, thickness)` → 描邊 mesh |
| `src/scene/faceTexture.ts` | Canvas 2D 動漫臉貼圖 | `getFaceTexture(eyeColor)` → `CanvasTexture` |

`createCharacter.ts` 是唯一的組裝者，負責在動漫模式下呼叫這三者。

### 4.1 賽璐璐著色

`MeshToonMaterial` 配一張三階 `DataTexture` 漸層圖（`minFilter`/`magFilter` 皆為 `NearestFilter`），令明暗變成硬邊色塊。漸層圖全域共用一張。

材質仍受場景燈光與陰影影響，因此舞台四支彩色 `SpotLight` 的打光與霓虹邊光效果會保留，只是邊界變硬。

`emissive` 參數保留給 accent 與螢光棒。

### 4.2 描邊

Inverted hull：為每件角色 mesh 加一個共用同一 `BufferGeometry` 的子 mesh，材質為 `MeshBasicMaterial({ color, side: THREE.BackSide })`，且 `castShadow = false`、`receiveShadow = false`。

**厚度用固定世界尺寸（3mm）反推每件的縮放**，而非統一百分比：

```
scale = 1 + thickness / boundingSphere.radius
```

原因有二：一是描邊粗幼在全身一致，視覺上正確得多；二是總高只增加約 3mm，仍然通過現有的 ±5mm 高度測試。

描邊套用於軀幹、四肢、頭、頭髮、鞋；**不套用**於臉部貼圖殼、螢光棒、地面陰影圓。

### 4.3 動漫臉

移除動漫模式下的兩粒 `SphereGeometry(0.025)` 眼珠 mesh，改為一塊貼合頭部弧度的球面殼片（`SphereGeometry` 以 `phiStart`/`phiLength`/`thetaStart`/`thetaLength` 切出正面一塊，半徑略大於頭部），貼上透明 `CanvasTexture`。

用球面切片而非平面，是為了讓五官貼合頭部曲率，同時避開整顆球體 UV 環繞造成的貼圖拉伸問題。

Canvas 內容（256×256）：大眼輪廓、虹膜垂直漸層、白色高光點、上睫毛粗線、眉、細嘴、腮紅。虹膜顏色取自角色 palette，因此五位偶像各有各的眼色。貼圖按顏色快取，最多產生 6 張。

### 4.4 頭髮層次

動漫模式下保留現有的後髮殼與四種髮型（`short`/`bob`/`ponytail`/`twin`），另加 3–5 條尖頭髮片瀏海與鬢髮（錐體幾何）。尖銳的髮絲輪廓是動漫感的第二大來源。

## 5. 接駁

- `src/app/App.ts:163` — 主角加 `style: "anime"`
- `src/show/ShowController.ts:105` — 五位偶像加 `style: "anime"`

## 6. 效能

`PersonRig` 新增 `outlines: THREE.Mesh[]`，讓外部可整批開關描邊。

`App.updateQuality()` 在平均 FPS 跌穿 24 時已會降低 pixelRatio、收起部分觀眾、關閉霧效；本次在同一處加入關閉描邊。描邊是最廉價的可棄項，而六個角色的額外 draw call 本身數量很少（約 30 個小物件），正常情況不應觸發降級。

## 7. 測試

新增 `src/scene/createCharacterAnime.test.ts`：

- 動漫模式的軀幹／四肢材質為 `MeshToonMaterial` 且帶 `gradientMap`
- 描邊 mesh 存在、`side === THREE.BackSide`、不投射陰影
- 動漫模式總高仍在 1.8843 ± 5mm 內
- 動漫模式有臉部貼圖 mesh，且無 `name === "eye"` 的球體
- `rig.outlines` 可整批切換 `visible`

另加 `toonMaterials`、`outline`、`faceTexture` 各自的單元測試。

**回歸要求：** 現有 `createCharacterV2.test.ts`、`personPose.test.ts`、`PlayerController.test.ts`、`ShowController.test.ts`、`LiftController.test.ts` 全部維持綠燈，不得修改。

最後以 Playwright 截圖人工確認視覺效果。

## 8. 明確不做

- 不改身體比例
- 不改觀眾與 Lift NPC
- 不加 bloom 或任何後製
- 不加 npm 依賴
- 不引入外部模型檔（VRM／GLB）
