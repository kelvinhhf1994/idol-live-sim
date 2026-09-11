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
