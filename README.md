# Neon Backstage

一個以 Three.js 製作、手機橫向優先並支援桌面的低多邊形 3D Live House 探索原型。

## 第一版內容

- 原創香港小型 Live House 場景
- 街道入口、售票位、主場館、舞台、吧台、音控位及後台
- 第一與第三人稱視角
- 手機虛擬搖桿、桌面 WASD、可跳上舞台、Mosh、Lift 及拖曳鏡頭
- 五位低多邊形偶像循環舞蹈
- 十二位低多邊形觀眾
- 玩家螢光棒（12 色、舉棒／指台應援姿勢）與可調動作速度設定選單
- 官方 YouTube IFrame Player（目前介面暫時隱藏）
- 手機效能自動降級

## 本機運行

```bash
npm install
npm run dev
```

開啟 Vite 顯示的網址。使用手機測試時，手機與電腦需在同一網絡，並以 `npm run dev -- --host` 啟動。

## 驗證

```bash
npm test
npx playwright install chromium webkit
npm run test:e2e
npm run build
```

## 手機操作

- 使用橫向畫面
- 左側類比搖桿：移動
- 右下角「跳躍」按鈕：單次跳躍，落地後可再次起跳
- 「MOSH」按鈕：輕按完成一次約 0.65 秒的交替雙臂 Windmill，肩膀由頭頂向前揮擊並配合手肘伸展／收回；按住連續循環，放開後完成當圈；Mosh 時以一般速度的 125% 移動，仍可跳躍
- 「LIFT」按鈕：切換緊密雙人托腳；移動速度為一般的 200%，期間不可跳躍或 Mosh
- 「2STEP」按鈕：按住時以支撐膝吸震、低位 hop、自由膝收起、斜前交叉 sweep、腳踝保持鞋底水平及落地換重心後左右鏡像循環，放手立即停止；整個週期平均移動速度維持一般的 100%
- 「跳指」按鈕：按下立即以目前面向跳起並向前上方伸出微彎右手；空中雙膝彎曲、落地時吸震。輕按完成一次，按住會在每次落地後按節奏重跳
- 右側畫面拖曳：轉動鏡頭
- 「第一／第三人稱」按鈕：切換視角
- 「螢光棒」按鈕：開啟顏色面板；「舉棒／指台」切換應援姿勢（可邊走邊保持）
- 「設定」按鈕：調整移動／Mosh／Lift／2-Step 速度與跳躍高度，並可重設預設值
- 「現場影片」按鈕：暫時隱藏（程式碼保留，之後可再啟用）
- 「全螢幕」按鈕：桌面與支援的 Android 瀏覽器可切換全螢幕；iPhone Safari 會顯示加入主畫面的指引

## 桌面操作

- `W`／`A`／`S`／`D`：相對鏡頭方向移動
- `Space`：單次跳躍
- 按住滑鼠拖曳：轉動鏡頭
- 點擊「MOSH」：播放一次 Windmill Mosh；按住滑鼠可持續循環
- 點擊「LIFT」：切換雙人托舉；再次點擊會平滑回到地面
- 按住「2STEP」：持續低位交叉 sweep 與左右換重，放開滑鼠後停止；不設鍵盤快捷鍵
- 「跳指」按鈕：滑鼠按下立即跳指；快速放開仍完成當次跳躍，持續按住會自動重跳

Lift 中兩位支援者左右緊密並排，各自以雙手 two-bone IK 托住玩家對應腳部；玩家保持直立及固定的柔膝腿姿與前指／平衡手勢。移動時支援者以包含髖、膝及腳踝的快跑步態前進，但雙手持續托腳。Lift 使用較大的隊形碰撞半徑，避免支援者穿過主要牆面、舞台及吧台；關閉後必須先完成落地，才可再次跳躍或 Mosh。

Lift、Mosh、2-Step 與跳指互斥：開始其中一個動作會停止其他動作。2-Step 可在移動時使用一般速度，跳躍期間保留按住狀態但暫停舞步，落地後自動恢復；2-Step 與跳指都不會撞飛觀眾。跳指沿角色目前面向的本地前方動作，不會自動轉向舞台。

舞台尺寸為 11.25 × 5.875、高 0.75，後緣固定於 `z=-14.95`。舞台前欄與舞台邊不能直接走過；先退後助跑，再以普通跳躍或「跳指」越過欄位，下降至舞台範圍時會落在舞台頂。從舞台側面跳出後會落回場館地板。Lift 本身不能跳，但可先上台再啟動，支援者高度會跟隨舞台。第三人稱相機會依實際 3D ray 高度越過舞台與前欄，但仍避開全高牆面。

Mosh 或 Lift 移動時可撞飛觀眾 NPC 及五位舞台偶像，Lift 衝力較強。角色會以全肢體 flail 的簡化拋物線飛出，依舞台或地板高度落地，保持固定柔軟倒地姿勢，約兩秒後經跪姿起身，再以彎膝跑步回到精確原位並完整恢復表演姿勢；回位前不會重複受撞。2-Step、跳指、普通移動與普通跳躍不會觸發撞飛，玩家與 Lift 支援者也不受影響。

## 更換 YouTube 影片

> 目前正式版 HUD 已暫時隱藏「現場影片」與 YouTube 面板（`ENABLE_YOUTUBE = false`），避免背景載入 API。下列說明保留供日後重新啟用。


開啟「現場影片」後，可輸入 YouTube `watch`、`youtu.be`、`shorts`、`live` 連結或 11 字元影片 ID，再選擇「載入影片」。無效或非 YouTube 連結不會替換目前影片，輸入內容不會儲存在瀏覽器。

標題列的縮小按鈕會切換為右上角 Mini Player；同一個 iframe、目前影片、播放時間與聲音都會保留。Mini Player 提供倒後 10 秒、播放／暫停、快進 10 秒及展開控制。若直播不支援 seek，遊戲仍會正常運作。再次選擇 HUD「現場影片」可在 expanded 與 minimized 狀態間切換。

預設影片可修改 `src/config/venue.ts` 內的 `youtubeVideoId`。影片必須允許嵌入；播放器不會下載或抽取 YouTube 音訊。

預設 ID 是 YouTube IFrame API 官方示範影片。

## 全螢幕與主畫面模式

網站包含 standalone Web App manifest 與橫向顯示 metadata，但刻意不註冊 service worker 或離線快取，避免 Firebase Hosting 發布後沿用舊資源。iPhone Safari 可依畫面指引加入主畫面，再由主畫面以 standalone 模式開啟。

## 技術

- Vite
- TypeScript
- Three.js
- Vitest
- 原生 HTML/CSS

首版場館與角色使用程式化低多邊形幾何。日後可保持相同玩家及鏡頭控制，將個別場館替換成 Blender GLB 模型。

所有玩家、五位偶像、十二位 runtime 觀眾及兩位 Lift 支援者均使用 V2 nested joint rig：`body → pelvis → chest → neck/head`，四肢包含 shoulder/elbow 或 hip/knee/ankle 階層。模型仍沿用共享低多邊形幾何、原有配色、比例及陰影，不使用 OpenPose、SkinnedMesh 或額外 physics dependency。每幀由完整 neutral pose 開始，依 idle／walk／action／Lift 或 knockback 優先序覆蓋並套用 joint limits，避免前一狀態殘留。
