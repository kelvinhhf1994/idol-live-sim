import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { parseDanceClip, sampleCapturedDance, type DanceClip } from "../animation/capturedDance";
import { createPersonPose, type PersonPose } from "../animation/personPose";
import { createChibiIdol } from "../scene/createChibiIdol";
import { applyIdolDancePose } from "../show/idolDance";
import { IDOL_MEMBERS } from "../show/idolMembers";

const MOTION_URL = "/motions/preview-dance.animation.json";
const VIDEO_URL = "/motions/preview-dance-clip.mp4";
const OVERLAY_URL = "/motions/preview-dance-overlay.mp4";

const CHANNELS: Array<{ key: keyof PersonPose; label: string; side?: "left" | "right" }> = [
  { key: "bodyPositionX", label: "bodyPositionX" },
  { key: "bodyY", label: "bodyY" },
  { key: "bodyYaw", label: "bodyYaw" },
  { key: "chestX", label: "chestX" },
  { key: "leftShoulderX", label: "L shoulderX", side: "left" },
  { key: "leftShoulderY", label: "L shoulderY", side: "left" },
  { key: "leftShoulderZ", label: "L shoulderZ", side: "left" },
  { key: "leftElbow", label: "L elbow", side: "left" },
  { key: "rightShoulderX", label: "R shoulderX", side: "right" },
  { key: "rightShoulderY", label: "R shoulderY", side: "right" },
  { key: "rightShoulderZ", label: "R shoulderZ", side: "right" },
  { key: "rightElbow", label: "R elbow", side: "right" },
  { key: "leftFootX", label: "L footX", side: "left" },
  { key: "leftFootY", label: "L footY", side: "left" },
  { key: "leftFootZ", label: "L footZ", side: "left" },
  { key: "rightFootX", label: "R footX", side: "right" },
  { key: "rightFootY", label: "R footY", side: "right" },
  { key: "rightFootZ", label: "R footZ", side: "right" },
];

const video = document.querySelector<HTMLVideoElement>("#source-video")!;
const overlay = document.querySelector<HTMLVideoElement>("#overlay-video")!;
const canvasHost = document.querySelector<HTMLDivElement>("#stage")!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const timeEl = document.querySelector<HTMLSpanElement>("#time")!;
const readout = document.querySelector<HTMLDListElement>("#pose-readout")!;
const playBtn = document.querySelector<HTMLButtonElement>("#play")!;
const restartBtn = document.querySelector<HTMLButtonElement>("#restart")!;
const speedSel = document.querySelector<HTMLSelectElement>("#speed")!;
const loopToggle = document.querySelector<HTMLInputElement>("#loop")!;
const overlayToggle = document.querySelector<HTMLInputElement>("#show-overlay")!;
const bonesToggle = document.querySelector<HTMLInputElement>("#show-bones")!;
const seek = document.querySelector<HTMLInputElement>("#seek")!;

video.muted = false;
overlay.muted = true;
video.loop = loopToggle.checked;
overlay.loop = loopToggle.checked;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
canvasHost.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x14110e);

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
camera.position.set(0, 1.2, 3.6);
camera.lookAt(0, 0.78, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.78, 0);
controls.enablePan = false;
controls.minDistance = 2.2;
controls.maxDistance = 6;

scene.add(new THREE.HemisphereLight(0xfff1d6, 0x2a2118, 1.15));
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

const boneAxes = attachBoneAxes(idol);
const boneLines = createBoneLines(idol);
scene.add(boneLines);

let clip: DanceClip | null = null;
let leftContact: boolean[] = [];
let rightContact: boolean[] = [];
let playing = false;
const readoutValues = new Map<string, HTMLElement>();

function marker(color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 12, 10),
    new THREE.MeshBasicMaterial({ color }),
  );
  mesh.visible = false;
  return mesh;
}

function attachBoneAxes(rig: typeof idol): THREE.AxesHelper[] {
  const joints = [
    rig.body,
    rig.pelvis,
    rig.chest,
    rig.leftShoulder,
    rig.rightShoulder,
    rig.leftElbow,
    rig.rightElbow,
    rig.leftHip,
    rig.rightHip,
    rig.leftKnee,
    rig.rightKnee,
    rig.leftFootPivot,
    rig.rightFootPivot,
  ];
  return joints.map((joint) => {
    const axes = new THREE.AxesHelper(0.12);
    joint.add(axes);
    return axes;
  });
}

function createBoneLines(rig: typeof idol): THREE.LineSegments {
  const pairs: Array<[THREE.Object3D, THREE.Object3D]> = [
    [rig.pelvis, rig.chest],
    [rig.chest, rig.neck],
    [rig.chest, rig.leftShoulder],
    [rig.chest, rig.rightShoulder],
    [rig.leftShoulder, rig.leftElbow],
    [rig.rightShoulder, rig.rightElbow],
    [rig.leftElbow, rig.leftHand],
    [rig.rightElbow, rig.rightHand],
    [rig.pelvis, rig.leftHip],
    [rig.pelvis, rig.rightHip],
    [rig.leftHip, rig.leftKnee],
    [rig.rightHip, rig.rightKnee],
    [rig.leftKnee, rig.leftFootPivot],
    [rig.rightKnee, rig.rightFootPivot],
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pairs.length * 6), 3));
  const lines = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xf2c27a, depthTest: false }),
  );
  lines.renderOrder = 2;
  lines.userData.pairs = pairs;
  return lines;
}

function updateBoneLines(): void {
  const pairs = boneLines.userData.pairs as Array<[THREE.Object3D, THREE.Object3D]>;
  const positions = boneLines.geometry.getAttribute("position") as THREE.BufferAttribute;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  pairs.forEach((pair, index) => {
    pair[0].getWorldPosition(a);
    pair[1].getWorldPosition(b);
    positions.setXYZ(index * 2, a.x, a.y, a.z);
    positions.setXYZ(index * 2 + 1, b.x, b.y, b.z);
  });
  positions.needsUpdate = true;
}

function setBoneDebugVisible(visible: boolean): void {
  for (const axes of boneAxes) axes.visible = visible;
  boneLines.visible = visible;
  leftMarker.visible = visible;
  rightMarker.visible = visible;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, "0")}`;
}

function buildReadout(): void {
  readout.replaceChildren();
  for (const { key, label, side } of CHANNELS) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = "0.000";
    if (side) {
      dt.className = side;
      dd.className = side;
    }
    readout.append(dt, dd);
    readoutValues.set(key, dd);
  }
  for (const [id, label, side] of [
    ["leftContact", "L contact", "left"],
    ["rightContact", "R contact", "right"],
  ] as const) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = "—";
    dt.className = side;
    dd.className = side;
    readout.append(dt, dd);
    readoutValues.set(id, dd);
  }
}

function contactAt(flags: boolean[], time: number): string {
  if (!clip || flags.length === 0) return "—";
  let index = 0;
  while (index < clip.timestamps.length - 1 && clip.timestamps[index + 1]! <= time) index += 1;
  index = Math.min(flags.length - 1, index);
  return flags[index] ? "plant" : "lift";
}

function renderReadout(time: number): void {
  for (const { key } of CHANNELS) {
    readoutValues.get(key)!.textContent = pose[key].toFixed(3);
  }
  readoutValues.get("leftContact")!.textContent = contactAt(leftContact, time);
  readoutValues.get("rightContact")!.textContent = contactAt(rightContact, time);
}

function applyTime(time: number): void {
  if (!clip) return;
  if (!overlay.hidden && Number.isFinite(overlay.duration) && Math.abs(overlay.currentTime - time) > 0.1) {
    overlay.currentTime = time;
  }
  sampleCapturedDance(clip, time, pose, { loop: loopToggle.checked });
  applyIdolDancePose(idol, pose);
  footWorld.set(pose.leftFootX, 0.08 + pose.leftFootY, pose.leftFootZ);
  idol.group.localToWorld(footWorld);
  leftMarker.position.copy(footWorld);
  footWorld.set(pose.rightFootX, 0.08 + pose.rightFootY, pose.rightFootZ);
  idol.group.localToWorld(footWorld);
  rightMarker.position.copy(footWorld);
  setBoneDebugVisible(bonesToggle.checked);
  updateBoneLines();
  renderReadout(time);
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

function syncLoop(): void {
  video.loop = loopToggle.checked;
  overlay.loop = loopToggle.checked;
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

loopToggle.addEventListener("change", syncLoop);

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

bonesToggle.addEventListener("change", () => setBoneDebugVisible(bonesToggle.checked));

video.addEventListener("ended", () => {
  if (loopToggle.checked) return;
  playing = false;
  playBtn.textContent = "播放";
  overlay.pause();
});

addEventListener("resize", resize);
resize();

renderer.setAnimationLoop(() => {
  if (clip) applyTime(video.currentTime || 0);
  controls.update();
  renderer.render(scene, camera);
});

function readContact(raw: unknown, side: "left" | "right"): boolean[] {
  if (typeof raw !== "object" || raw === null) return [];
  const feet = (raw as { feet?: { left?: { contact?: unknown }; right?: { contact?: unknown } } }).feet;
  const flags = feet?.[side]?.contact;
  return Array.isArray(flags) ? flags.map((flag) => flag === true) : [];
}

async function boot(): Promise<void> {
  buildReadout();
  statusEl.textContent = "載入動作…";
  const response = await fetch(MOTION_URL);
  if (!response.ok) {
    statusEl.textContent = `找不到 ${MOTION_URL}。pipeline 還在跑或失敗。`;
    return;
  }
  const raw: unknown = await response.json();
  clip = parseDanceClip(raw);
  leftContact = readContact(raw, "left");
  rightContact = readContact(raw, "right");
  video.src = VIDEO_URL;
  overlay.src = OVERLAY_URL;
  overlay.hidden = !overlayToggle.checked;
  video.addEventListener("loadedmetadata", () => {
    statusEl.textContent = `${clip?.captureMode} · ${clip?.rootMotionMode} · ${clip?.timestamps.length} keys`;
  });
  video.addEventListener("error", () => {
    statusEl.textContent += "（找不到 public/motions/preview-dance-clip.mp4）";
  });
  applyTime(0);
}

void boot();
