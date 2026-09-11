import * as THREE from "three";

/** Pastel plushie-box colours for the glass room shelves. */
export const PLUSHIE_COLORS = [0xff7eb6, 0xffd166, 0x8be9fd, 0xb8f28e, 0xc59cff, 0xff9f68, 0xffffff, 0x6ec6ff];

/** Grey acoustic foam tiles (0.6 m grid). Callers set `repeat` to (width / 0.6, height / 0.6). */
export function acousticTileTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.fillStyle = "#1c1c20";
  ctx.fillRect(0, 0, 256, 256);
  const tile = 128;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const x = c * tile + 6;
      const y = r * tile + 6;
      const face = ctx.createLinearGradient(x, y, x + tile - 12, y + tile - 12);
      face.addColorStop(0, "#44444b");
      face.addColorStop(1, "#33333a");
      ctx.fillStyle = face;
      ctx.fillRect(x, y, tile - 12, tile - 12);
      // Bevel highlight on the top-left edges
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x, y + tile - 12);
      ctx.lineTo(x, y);
      ctx.lineTo(x + tile - 12, y);
      ctx.stroke();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** White analogue wall clock face reading about ten past ten. */
export function clockFaceTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.fillStyle = "#f6f6f2";
  ctx.beginPath();
  ctx.arc(128, 128, 124, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#111";
  ctx.lineWidth = 6;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100);
    ctx.lineTo(128 + Math.cos(a) * 116, 128 + Math.sin(a) * 116);
    ctx.stroke();
  }
  const hand = (angle: number, length: number, width: number) => {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(128 + Math.cos(angle) * length, 128 + Math.sin(angle) * length);
    ctx.stroke();
  };
  hand(-Math.PI / 2 + (10 / 12) * Math.PI * 2, 60, 9); // hour
  hand(-Math.PI / 2 + (10 / 60) * Math.PI * 2, 92, 6); // minute

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Pastel vertical game screen for the idol-arcade cabinet. No branding text. */
export function starlightScreenTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 896;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  const sky = ctx.createLinearGradient(0, 0, 0, 896);
  sky.addColorStop(0, "#7ec8ff");
  sky.addColorStop(0.4, "#c9b8ff");
  sky.addColorStop(1, "#ffb3d4");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 512, 896);

  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.beginPath();
  ctx.ellipse(120, 200, 100, 40, 0, 0, Math.PI * 2);
  ctx.ellipse(400, 150, 80, 32, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff7eb6";
  ctx.fillRect(150, 420, 212, 240);
  ctx.fillStyle = "#ffd0ea";
  ctx.fillRect(186, 372, 140, 56);
  ctx.fillStyle = "#5ad0ff";
  ctx.fillRect(200, 220, 44, 200);
  ctx.fillRect(268, 176, 44, 244);
  ctx.fillStyle = "#fff4b8";
  for (const [x, y] of [[214, 270], [214, 318], [282, 230], [282, 278], [282, 326]] as const) {
    ctx.fillRect(x, y, 16, 22);
  }
  ctx.fillStyle = "#3ecf8e";
  ctx.beginPath();
  ctx.ellipse(256, 700, 180, 48, 0, 0, Math.PI * 2);
  ctx.fill();

  const figure = (x: number, dress: string) => {
    ctx.fillStyle = "#ffd7b8";
    ctx.beginPath();
    ctx.arc(x, 610, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = dress;
    ctx.beginPath();
    ctx.moveTo(x, 630);
    ctx.lineTo(x - 28, 710);
    ctx.lineTo(x + 28, 710);
    ctx.closePath();
    ctx.fill();
  };
  figure(200, "#3d8bff");
  figure(312, "#ff4d8a");

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Pink circular playfield for the dual rhythm cabinet. Rings and notes, no logo. */
export function maimaiScreenTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  const g = ctx.createRadialGradient(256, 256, 20, 256, 256, 256);
  g.addColorStop(0, "#fff4fb");
  g.addColorStop(0.45, "#ff9ec8");
  g.addColorStop(1, "#ff5aa0");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(256, 256, 250, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 6;
  for (const r of [70, 130, 190]) {
    ctx.beginPath();
    ctx.arc(256, 256, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = i % 2 === 0 ? "#7ec8ff" : "#ffe36b";
    ctx.beginPath();
    ctx.arc(256 + Math.cos(a) * 160, 256 + Math.sin(a) * 160, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Rainbow floor mat in front of the rhythm cabinet, no wordmark. */
export function maimaiMatTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.fillStyle = "#ff4d6d";
  ctx.fillRect(0, 0, 512, 512);
  const bands = ["#ff4d6d", "#ff9f1c", "#ffe36b", "#7dffa0", "#6ec6ff", "#c59cff"];
  bands.forEach((color, i) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 28;
    ctx.beginPath();
    ctx.arc(256, 560, 140 + i * 28, Math.PI, 0);
    ctx.stroke();
  });
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(150, 200, 28, 0, Math.PI * 2);
  ctx.arc(360, 180, 22, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Stylised console race HUD for the lounge TV. No branding. */
export function loungeGameTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 576;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  const sky = ctx.createLinearGradient(0, 0, 0, 280);
  sky.addColorStop(0, "#6ec8ff");
  sky.addColorStop(1, "#ffe7b8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 1024, 576);

  ctx.fillStyle = "#3ecf7a";
  ctx.beginPath();
  ctx.moveTo(0, 300);
  ctx.lineTo(1024, 250);
  ctx.lineTo(1024, 576);
  ctx.lineTo(0, 576);
  ctx.fill();

  ctx.fillStyle = "#4a4a52";
  ctx.beginPath();
  ctx.moveTo(220, 576);
  ctx.lineTo(420, 300);
  ctx.lineTo(604, 300);
  ctx.lineTo(804, 576);
  ctx.fill();
  ctx.fillStyle = "#f4f4f4";
  ctx.beginPath();
  ctx.moveTo(490, 300);
  ctx.lineTo(534, 300);
  ctx.lineTo(620, 576);
  ctx.lineTo(404, 576);
  ctx.fill();

  ctx.fillStyle = "#ff4d6d";
  ctx.beginPath();
  ctx.moveTo(470, 430);
  ctx.lineTo(610, 430);
  ctx.lineTo(590, 490);
  ctx.lineTo(450, 490);
  ctx.fill();
  ctx.fillStyle = "#2b2b30";
  ctx.fillRect(468, 490, 140, 18);
  ctx.fillStyle = "#1c1c20";
  ctx.beginPath();
  ctx.arc(490, 508, 22, 0, Math.PI * 2);
  ctx.arc(590, 508, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(24, 24, 220, 72);
  ctx.fillStyle = "#7dffb3";
  ctx.font = "bold 28px sans-serif";
  ctx.fillText("LAP 2/3", 40, 70);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(800, 24, 200, 72);
  ctx.fillStyle = "#ffe36b";
  ctx.fillText("128 km/h", 820, 70);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** White circular waste pictogram for the 240L wheelie-bin front. */
export function wasteIconTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(128, 128, 118, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111111";
  ctx.beginPath();
  ctx.arc(118, 58, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(108, 76, 20, 46);
  ctx.beginPath();
  ctx.moveTo(128, 80);
  ctx.lineTo(168, 108);
  ctx.lineTo(160, 118);
  ctx.lineTo(128, 96);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(98, 122, 18, 36);
  ctx.beginPath();
  ctx.moveTo(128, 118);
  ctx.lineTo(150, 148);
  ctx.lineTo(138, 156);
  ctx.lineTo(122, 128);
  ctx.closePath();
  ctx.fill();

  ctx.fillRect(168, 128, 36, 52);
  ctx.fillRect(162, 122, 48, 10);
  ctx.fillRect(176, 180, 8, 14);
  ctx.fillRect(188, 180, 8, 14);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Simple idol-live poster with a big title; `variant` picks the colour scheme. */
export function posterTexture(variant: number): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 362;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  const schemes = [
    ["#ff2f7d", "#2b0a1a", "#ffffff"],
    ["#3f8cff", "#0a1430", "#ffe9a8"],
    ["#ffaa00", "#2a1a00", "#111111"],
  ];
  const [accent, background, ink] = schemes[variant % schemes.length];
  const fill = ctx.createLinearGradient(0, 0, 0, 362);
  fill.addColorStop(0, accent);
  fill.addColorStop(1, background);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, 256, 362);
  ctx.fillStyle = ink;
  ctx.font = "900 58px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("LIVE", 128, 120);
  ctx.font = "bold 28px sans-serif";
  ctx.fillText(`VOL.${variant + 1}`, 128, 170);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillRect(24, 300, 208, 30);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Starfield LED card: glowing "Girls in the Frontier vol. 2026" on navy black. */
export function frontierLedTexture(): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();
  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  const bg = ctx.createRadialGradient(960, 540, 80, 960, 540, 980);
  bg.addColorStop(0, "#0a1450");
  bg.addColorStop(0.45, "#05082a");
  bg.addColorStop(1, "#01020f");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1920, 1080);

  for (let i = 0; i < 420; i++) {
    const x = (i * 137 + 40) % 1920;
    const y = (i * 89 + 17) % 1080;
    const r = 0.4 + (i % 5) * 0.35;
    ctx.fillStyle = i % 9 === 0 ? "rgba(180, 220, 255, 0.95)" : "rgba(255, 255, 255, 0.75)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (i % 17 === 0) {
      ctx.strokeStyle = "rgba(210, 235, 255, 0.55)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 6, y);
      ctx.lineTo(x + 6, y);
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x, y + 6);
      ctx.stroke();
    }
  }

  ctx.save();
  ctx.translate(960, 500);
  ctx.rotate(-0.18);
  ctx.strokeStyle = "rgba(200, 225, 255, 0.85)";
  ctx.lineWidth = 8;
  ctx.shadowColor = "#9fd4ff";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.ellipse(40, 10, 620, 70, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const paintTitle = (text: string, y: number, size: number) => {
    ctx.textAlign = "center";
    ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
    ctx.shadowColor = "#7ec8ff";
    ctx.shadowBlur = 28;
    ctx.strokeStyle = "#9fd0ff";
    ctx.lineWidth = Math.max(4, size / 28);
    ctx.strokeText(text, 960, y);
    const fill = ctx.createLinearGradient(960, y - size, 960, y + size * 0.2);
    fill.addColorStop(0, "#ffffff");
    fill.addColorStop(0.45, "#e8f4ff");
    fill.addColorStop(1, "#7eb6ff");
    ctx.fillStyle = fill;
    ctx.fillText(text, 960, y);
  };

  paintTitle("GIRLS", 360, 168);
  paintTitle("in the", 500, 72);
  ctx.save();
  ctx.translate(960, 470);
  ctx.fillStyle = "#0a1648";
  ctx.shadowColor = "#cfe8ff";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * 46, Math.sin(a) * 46);
    ctx.lineTo(Math.cos(a + Math.PI / 4) * 14, Math.sin(a + Math.PI / 4) * 14);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  paintTitle("FRONTIER", 680, 178);
  paintTitle("vol. 2026", 820, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
