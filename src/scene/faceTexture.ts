import * as THREE from "three";

const FACE_TEXTURE_SIZE = 256;
const LINE_COLOR = "#1b141f";

/** "chibi-*" variants belong to the big-headed idol build; "default" to the low-poly hero. */
export type FaceVariant = "default" | "chibi-open" | "chibi-closed";

const cache = new Map<string, THREE.Texture>();

/**
 * Transparent anime face decal (eyes, brows, mouth, blush) drawn on a canvas.
 * Cached per variant and iris colour so each idol only pays for one texture.
 */
export function getFaceTexture(eyeColor: number, variant: FaceVariant = "default"): THREE.Texture {
  const key = `${variant}:${eyeColor}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const texture = drawFaceTexture(eyeColor, variant);
  cache.set(key, texture);
  return texture;
}

function drawFaceTexture(eyeColor: number, variant: FaceVariant): THREE.Texture {
  if (typeof document === "undefined") return new THREE.Texture();

  const canvas = document.createElement("canvas");
  canvas.width = FACE_TEXTURE_SIZE;
  canvas.height = FACE_TEXTURE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is unavailable");

  if (variant === "default") drawHeroFace(ctx, eyeColor);
  else drawChibiFace(ctx, eyeColor, variant === "chibi-closed");

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function drawHeroFace(ctx: CanvasRenderingContext2D, eyeColor: number): void {
  const s = FACE_TEXTURE_SIZE;
  const eyeWidth = s * 0.235;
  const eyeHeight = s * 0.28;
  const eyeY = s * 0.45;

  drawBrow(ctx, s * 0.295, s * 0.235, eyeWidth, s, -1);
  drawBrow(ctx, s * 0.705, s * 0.235, eyeWidth, s, 1);
  drawBlush(ctx, s * 0.135, s * 0.63, s * 0.085, s * 0.05, 0.55);
  drawBlush(ctx, s * 0.865, s * 0.63, s * 0.085, s * 0.05, 0.55);
  drawEye(ctx, s * 0.295, eyeY, eyeWidth, eyeHeight, eyeColor, -1);
  drawEye(ctx, s * 0.705, eyeY, eyeWidth, eyeHeight, eyeColor, 1);
  drawMouth(ctx, s * 0.5, s * 0.745, s * 0.06);
}

/** Wider, taller eyes set lower on the skull — the big-head idol read. */
function drawChibiFace(ctx: CanvasRenderingContext2D, eyeColor: number, closed: boolean): void {
  const s = FACE_TEXTURE_SIZE;
  const eyeWidth = s * 0.3;
  const eyeHeight = s * 0.36;
  const eyeY = s * 0.5;
  const eyeX = s * 0.275;

  drawBlush(ctx, s * 0.1, s * 0.665, s * 0.105, s * 0.062, 0.72);
  drawBlush(ctx, s * 0.9, s * 0.665, s * 0.105, s * 0.062, 0.72);

  if (closed) {
    drawClosedEye(ctx, eyeX, eyeY, eyeWidth, eyeHeight, -1);
    drawClosedEye(ctx, s - eyeX, eyeY, eyeWidth, eyeHeight, 1);
  } else {
    drawBrow(ctx, eyeX, s * 0.235, eyeWidth * 0.82, s, -1);
    drawBrow(ctx, s - eyeX, s * 0.235, eyeWidth * 0.82, s, 1);
    drawEye(ctx, eyeX, eyeY, eyeWidth, eyeHeight, eyeColor, -1);
    drawEye(ctx, s - eyeX, eyeY, eyeWidth, eyeHeight, eyeColor, 1);
  }

  drawMouth(ctx, s * 0.5, s * 0.79, s * 0.055);
}

/** Upward "︶" arc with a lash flick, the closed-eye smile from the reference. */
function drawClosedEye(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
  outward: number,
): void {
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineCap = "round";
  ctx.lineWidth = height * 0.14;
  ctx.beginPath();
  ctx.moveTo(cx - width * 0.44, cy + height * 0.1);
  ctx.quadraticCurveTo(cx, cy - height * 0.42, cx + width * 0.44, cy + height * 0.1);
  ctx.stroke();

  ctx.lineWidth = height * 0.09;
  ctx.beginPath();
  ctx.moveTo(cx + outward * width * 0.42, cy + height * 0.08);
  ctx.lineTo(cx + outward * width * 0.6, cy - height * 0.16);
  ctx.stroke();
}

function drawEye(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
  eyeColor: number,
  outward: number,
): void {
  const irisRadius = height * 0.44;
  const irisY = cy + height * 0.03;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#f6f1f5";
  ctx.fill();
  ctx.clip();

  const gradient = ctx.createLinearGradient(cx, irisY - irisRadius, cx, irisY + irisRadius);
  gradient.addColorStop(0, shade(eyeColor, -0.5));
  gradient.addColorStop(0.55, css(eyeColor));
  gradient.addColorStop(1, shade(eyeColor, 0.4));
  ctx.beginPath();
  ctx.arc(cx, irisY, irisRadius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(cx, irisY, irisRadius * 0.34, irisRadius * 0.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#160f19";
  ctx.fill();

  // Upper-lid shadow keeps the eye from reading as a flat circle.
  ctx.beginPath();
  ctx.ellipse(cx, cy - height * 0.44, width * 0.6, height * 0.26, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(22, 15, 25, 0.32)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx - outward * irisRadius * 0.4, irisY - irisRadius * 0.42, irisRadius * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx + outward * irisRadius * 0.34, irisY + irisRadius * 0.42, irisRadius * 0.15, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = LINE_COLOR;
  ctx.lineCap = "round";
  ctx.lineWidth = height * 0.17;
  ctx.beginPath();
  ctx.ellipse(cx, cy, width / 2, height / 2, 0, Math.PI * 1.01, Math.PI * 1.99);
  ctx.stroke();

  // Outer lash flick.
  ctx.lineWidth = height * 0.1;
  ctx.beginPath();
  ctx.moveTo(cx + outward * width * 0.42, cy - height * 0.24);
  ctx.lineTo(cx + outward * width * 0.62, cy - height * 0.46);
  ctx.stroke();
}

function drawBrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  size: number,
  outward: number,
): void {
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineCap = "round";
  ctx.lineWidth = size * 0.026;
  ctx.beginPath();
  ctx.moveTo(cx - outward * width * 0.5, cy + size * 0.022);
  ctx.quadraticCurveTo(cx, cy - size * 0.022, cx + outward * width * 0.5, cy);
  ctx.stroke();
}

function drawMouth(ctx: CanvasRenderingContext2D, cx: number, cy: number, width: number): void {
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineCap = "round";
  ctx.lineWidth = width * 0.28;
  ctx.beginPath();
  ctx.moveTo(cx - width / 2, cy);
  ctx.quadraticCurveTo(cx, cy + width * 0.62, cx + width / 2, cy);
  ctx.stroke();
}

function drawBlush(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  strength: number,
): void {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radiusX);
  gradient.addColorStop(0, `rgba(255, 138, 168, ${strength})`);
  gradient.addColorStop(1, "rgba(255, 138, 168, 0)");
  ctx.beginPath();
  ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
}

function css(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** Positive amount lightens toward white, negative darkens toward black. */
function shade(color: number, amount: number): string {
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  const mix = (channel: number) => Math.round(channel + (target - channel) * t);
  const r = mix((color >> 16) & 0xff);
  const g = mix((color >> 8) & 0xff);
  const b = mix(color & 0xff);
  return `rgb(${r}, ${g}, ${b})`;
}
