import * as THREE from "three";
import { parseDanceClip, sampleCapturedDance, type DanceClip } from "../animation/capturedDance";
import { createPersonPose } from "../animation/personPose";
import { createChibiIdol } from "../scene/createChibiIdol";
import { applyIdolDancePose } from "../show/idolDance";
import { IDOL_MEMBERS } from "../show/idolMembers";

const MOTION_URL = "/motions/dance.animation.json";
const VIDEO_URL = "/motions/source-clip.mp4";
const OVERLAY_URL = "/motions/source-overlay.mp4";

const video = document.querySelector<HTMLVideoElement>("#source-video")!;
const overlay = document.querySelector<HTMLVideoElement>("#overlay-video")!;
const canvasHost = document.querySelector<HTMLDivElement>("#stage")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const timeEl = document.querySelector<HTMLSpanElement>("#time")!;
const playBtn = document.querySelector<HTMLButtonElement>("#play")!;
const restartBtn = document.querySelector<HTMLButtonElement>("#restart")!;
const speedSel = document.querySelector<HTMLSelectElement>("#speed")!;
const overlayToggle = document.querySelector<HTMLInputElement>("#show-overlay")!;
const seek = document.querySelector<HTMLInputElement>("#seek")!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
canvasHost.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14110e);

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
camera.position.set(0, 1.15, 3.2);
camera.lookAt(0, 0.78, 0);

const hemi = new THREE.HemisphereLight(0xfff1d6, 0x2a2118, 1.15);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xffe6c2, 1.35);
key.position.set(1.6, 3.2, 2.4);
key.castShadow = true;
scene.add(key);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(2.4, 48),
  new THREE.MeshStandardMaterial({ color: 0x3a3128, roughness: 0.92 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(4, 16, 0x6b5340, 0x2b241e);
grid.position.y = 0.002;
scene.add(grid);

const idol = createChibiIdol(IDOL_MEMBERS[0]!);
idol.group.position.set(0, 0, 0);
scene.add(idol.group);

const pose = createPersonPose();
const leftMarker = marker(0xff6b4a);
const rightMarker = marker(0x4ad2c4);
const footWorld = new THREE.Vector3();
scene.add(leftMarker, rightMarker);

let clip: DanceClip | null = null;
let playing = false;

function marker(color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 12, 10),
    new THREE.MeshBasicMaterial({ color }),
  );
  mesh.visible = false;
  return mesh;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, "0")}`;
}

function applyTime(time: number): void {
  if (!clip) return;
  if (!overlay.hidden && Number.isFinite(overlay.duration) && Math.abs(overlay.currentTime - time) > 0.1) {
    overlay.currentTime = time;
  }
  sampleCapturedDance(clip, time, pose, { loop: false });
  applyIdolDancePose(idol, pose);
  footWorld.set(pose.leftFootX, 0.08 + pose.leftFootY, pose.leftFootZ);
  idol.group.localToWorld(footWorld);
  leftMarker.position.copy(footWorld);
  footWorld.set(pose.rightFootX, 0.08 + pose.rightFootY, pose.rightFootZ);
  idol.group.localToWorld(footWorld);
  rightMarker.position.copy(footWorld);
  leftMarker.visible = true;
  rightMarker.visible = true;
  timeEl.textContent = `${formatTime(time)} / ${formatTime(clip.duration)}`;
  if (clip.duration > 0) seek.value = String((time / clip.duration) * 100);
}

function resize(): void {
  const width = canvasHost.clientWidth;
  const height = canvasHost.clientHeight;
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

playBtn.addEventListener("click", () => {
  if (!clip) return;
  if (playing) {
    video.pause();
    overlay.pause();
    playing = false;
    playBtn.textContent = "播放";
    return;
  }
  void video.play();
  if (overlayToggle.checked) void overlay.play();
  playing = true;
  playBtn.textContent = "暫停";
});

restartBtn.addEventListener("click", () => {
  video.currentTime = 0;
  overlay.currentTime = 0;
  applyTime(0);
});

speedSel.addEventListener("change", () => {
  const rate = Number(speedSel.value);
  video.playbackRate = rate;
  overlay.playbackRate = rate;
});

seek.addEventListener("input", () => {
  if (!clip) return;
  const time = (Number(seek.value) / 100) * clip.duration;
  video.currentTime = time;
  overlay.currentTime = time;
  applyTime(time);
});

overlayToggle.addEventListener("change", () => {
  overlay.hidden = !overlayToggle.checked;
  if (overlayToggle.checked) {
    overlay.currentTime = video.currentTime;
    if (playing) void overlay.play();
  } else {
    overlay.pause();
  }
});

video.addEventListener("ended", () => {
  playing = false;
  playBtn.textContent = "播放";
  overlay.pause();
});

addEventListener("resize", resize);
resize();

renderer.setAnimationLoop(() => {
  if (clip) applyTime(video.currentTime || 0);
  renderer.render(scene, camera);
});

async function boot(): Promise<void> {
  statusEl.textContent = "載入動作…";
  const response = await fetch(MOTION_URL);
  if (!response.ok) {
    statusEl.textContent = `找不到 ${MOTION_URL}。先跑 npm run video-to-dance。`;
    return;
  }
  clip = parseDanceClip(await response.json());
  video.src = VIDEO_URL;
  overlay.src = OVERLAY_URL;
  overlay.hidden = !overlayToggle.checked;
  video.addEventListener("loadedmetadata", () => {
    statusEl.textContent = `${clip?.captureMode} · ${clip?.rootMotionMode} · ${clip?.timestamps.length} keys`;
  });
  video.addEventListener("error", () => {
    statusEl.textContent += "（來源影片未複製到 public/motions/source-clip.mp4）";
  });
  applyTime(0);
}

void boot();
