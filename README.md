# Neon Backstage

一個以 Three.js 製作、手機橫向優先並支援桌面的低多邊形 3D Live House 探索原型。

## 第一版內容

- 原創香港小型 Live House 場景
- 街道入口、售票位、主場館、舞台、吧台、音控位及後台
- 第一與第三人稱視角
- 手機虛擬搖桿、桌面 WASD、跳躍、Mosh、Lift 及拖曳鏡頭
- 五位低多邊形偶像循環舞蹈
- 十二位低多邊形觀眾
- 官方 YouTube IFrame Player
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
- 「MOSH」按鈕：輕按完成一次約 0.65 秒的交替雙臂 Windmill，按住連續循環，放開後完成當圈；Mosh 時以一般速度的 125% 移動，仍可跳躍
- 「LIFT」按鈕：切換緊密雙人托腳；移動速度為一般的 200%，期間不可跳躍或 Mosh
- 「2STEP」按鈕：按住時依序左踏、右踢、右踏、左踢，放手立即停止；移動速度維持一般的 100%
- 「跳指」按鈕：按下立即以目前面向跳起並向前上方伸直右手；輕按完成一次，按住會在每次落地後按節奏重跳
- 右側畫面拖曳：轉動鏡頭
- 「第一／第三人稱」按鈕：切換視角
- 「現場影片」按鈕：開啟官方 YouTube 播放器
- 「全螢幕」按鈕：桌面與支援的 Android 瀏覽器可切換全螢幕；iPhone Safari 會顯示加入主畫面的指引

## 桌面操作

- `W`／`A`／`S`／`D`：相對鏡頭方向移動
- `Space`：單次跳躍
- 按住滑鼠拖曳：轉動鏡頭
- 點擊「MOSH」：播放一次 Windmill Mosh；按住滑鼠可持續循環
- 點擊「LIFT」：切換雙人托舉；再次點擊會平滑回到地面
- 按住「2STEP」：持續四拍舞步，放開滑鼠後停止；不設鍵盤快捷鍵
- 「跳指」按鈕：滑鼠按下立即跳指；快速放開仍完成當次跳躍，持續按住會自動重跳

Lift 中兩位支援者左右緊密並排，各自以雙手托住玩家對應腳部；玩家保持直立、固定雙腿及前指／平衡手勢。移動時支援者以快跑步態前進，但雙手持續托腳。Lift 使用較大的隊形碰撞半徑，避免支援者穿過主要牆面、舞台及吧台；關閉後必須先完成落地，才可再次跳躍或 Mosh。

Lift、Mosh、2-Step 與跳指互斥：開始其中一個動作會停止其他動作。2-Step 可在移動時使用一般速度，跳躍期間保留按住狀態但暫停舞步，落地後自動恢復；2-Step 與跳指都不會撞飛觀眾。跳指沿角色目前面向的本地前方動作，不會自動轉向舞台。

Mosh 或 Lift 移動時可撞飛觀眾 NPC。觀眾會以簡化拋物線飛出、落地、起身並快速跑回原位；舞台偶像、玩家與 Lift 支援者不受撞飛影響。觀眾回到原位前不會重複受撞。

## 更換 YouTube 影片

開啟「現場影片」後，可輸入 YouTube `watch`、`youtu.be`、`shorts`、`live` 連結或 11 字元影片 ID，再選擇「載入影片」。無效或非 YouTube 連結不會替換目前影片，輸入內容不會儲存在瀏覽器。

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
