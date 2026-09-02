import * as THREE from "three";
import { GENERIC_VENUE } from "../config/venue";
import { combineMovementInputs, KeyboardInput } from "../input/KeyboardInput";
import { JumpPointButton } from "../input/JumpPointButton";
import { MoshButton } from "../input/MoshButton";
import { TwoStepButton } from "../input/TwoStepButton";
import { VirtualJoystick } from "../input/VirtualJoystick";
import { CameraController } from "../player/CameraController";
import { PlayerController } from "../player/PlayerController";
import { createLowPolyPerson } from "../scene/createCharacter";
import { createVenue, type VenueBuild } from "../scene/createVenue";
import { ShowController } from "../show/ShowController";
import { getFullscreenPresentation } from "../ui/fullscreenMode";
import { YouTubePlayer } from "../ui/YouTubePlayer";

export interface AppSnapshot {
  player: { x: number; y: number; z: number };
  supporters: readonly { x: number; y: number; z: number }[];
  cameraYaw: number;
  playerYaw: number;
  cameraMode: "first" | "third";
  moshActive: boolean;
  twoStepActive: boolean;
  jumpPointActive: boolean;
  jumpPointHeld: boolean;
  liftActive: boolean;
  supporterVisible: boolean;
  knockedAudienceCount: number;
  returningAudienceCount: number;
  firstActiveAudience: {
    x: number;
    y: number;
    z: number;
    phase: "home" | "airborne" | "down" | "getting-up" | "returning";
  } | null;
}

export class App {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
  private readonly timer = new THREE.Timer();
  private readonly venue: VenueBuild;
  private readonly joystick: VirtualJoystick;
  private readonly keyboard: KeyboardInput;
  private readonly moshButton: MoshButton;
  private readonly twoStepButton: TwoStepButton;
  private readonly jumpPointButton: JumpPointButton;
  private readonly player: PlayerController;
  private readonly cameraController: CameraController;
  private readonly showController: ShowController;
  private readonly youtubePlayer: YouTubePlayer;
  private readonly entryScreen = requireElement<HTMLElement>("entry");
  private readonly hud = requireElement<HTMLElement>("hud");
  private readonly enterButton = requireElement<HTMLButtonElement>("enter-button");
  private readonly jumpButton = requireElement<HTMLButtonElement>("jump-button");
  private readonly moshElement = requireElement<HTMLButtonElement>("mosh-button");
  private readonly twoStepElement = requireElement<HTMLButtonElement>("two-step-button");
  private readonly jumpPointElement = requireElement<HTMLButtonElement>("jump-point-button");
  private readonly liftButton = requireElement<HTMLButtonElement>("lift-button");
  private readonly cameraButton = requireElement<HTMLButtonElement>("camera-button");
  private readonly cameraLabel = requireElement<HTMLElement>("camera-label");
  private readonly videoButton = requireElement<HTMLButtonElement>("video-button");
  private readonly videoCloseButton = requireElement<HTMLButtonElement>("video-close");
  private readonly videoUrlForm = requireElement<HTMLFormElement>("video-url-form");
  private readonly videoUrlInput = requireElement<HTMLInputElement>("video-url-input");
  private readonly videoUrlError = requireElement<HTMLElement>("video-url-error");
  private readonly fullscreenButton = requireElement<HTMLButtonElement>("fullscreen-button");
  private readonly fullscreenLabel = requireElement<HTMLElement>("fullscreen-label");
  private readonly fullscreenGuide = requireElement<HTMLElement>("fullscreen-guide");
  private readonly fullscreenGuideClose =
    requireElement<HTMLButtonElement>("fullscreen-guide-close");
  private frameId = 0;
  private lastWidth = 0;
  private lastHeight = 0;
  private entered = false;
  private qualityElapsed = 0;
  private qualityFrames = 0;
  private reducedQuality = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.timer.connect(document);

    this.scene.background = new THREE.Color(0x080611);
    this.scene.fog = new THREE.FogExp2(0x100a18, 0.026);
    this.venue = createVenue(GENERIC_VENUE);
    this.scene.add(this.venue.group);

    const playerRig = createLowPolyPerson({
      hairStyle: "short",
      palette: { top: 0xd6ff3f, bottom: 0x24202d, accent: 0xff2f7d },
    });
    this.player = new PlayerController(playerRig, GENERIC_VENUE, this.venue.colliders);
    this.scene.add(this.player.group, this.player.lift.group);
    this.showController = new ShowController(
      this.venue.performerPoints,
      this.venue.audiencePoints,
      this.venue.stageLights,
      GENERIC_VENUE,
    );
    this.scene.add(this.showController.group);

    this.joystick = new VirtualJoystick(
      requireElement<HTMLElement>("joystick"),
      requireElement<HTMLElement>("joystick-knob"),
    );
    this.keyboard = new KeyboardInput(() => {
      if (this.entered) {
        this.jumpPointButton.cancel();
        this.player.jump();
      }
    });
    this.moshButton = new MoshButton(
      this.moshElement,
      () => {
        if (this.entered) {
          this.twoStepButton.cancel();
          this.jumpPointButton.cancel();
          this.player.startMosh();
        }
      },
      () => this.player.releaseMosh(),
    );
    this.twoStepButton = new TwoStepButton(
      this.twoStepElement,
      () => {
        if (!this.entered) return;
        this.moshButton.cancel();
        this.jumpPointButton.cancel();
        this.player.startTwoStep();
        this.liftButton.setAttribute("aria-pressed", "false");
        this.jumpButton.disabled = false;
        this.moshButton.setDisabled(false);
      },
      () => this.player.releaseTwoStep(),
    );
    this.jumpPointButton = new JumpPointButton(
      this.jumpPointElement,
      () => {
        if (!this.entered) return;
        this.moshButton.cancel();
        this.twoStepButton.cancel();
        this.player.startJumpPoint();
        this.liftButton.setAttribute("aria-pressed", "false");
        this.jumpButton.disabled = false;
        this.moshButton.setDisabled(false);
      },
      () => this.player.releaseJumpPoint(),
    );
    this.cameraController = new CameraController(
      this.camera,
      requireElement<HTMLElement>("look-zone"),
      GENERIC_VENUE,
      this.venue.colliders,
      this.player,
    );
    this.cameraController.update(1, this.player.position);
    this.youtubePlayer = new YouTubePlayer(
      GENERIC_VENUE.youtubeVideoId,
      requireElement<HTMLElement>("video-panel"),
      requireElement<HTMLElement>("youtube-player"),
      requireElement<HTMLElement>("video-status"),
    );

    this.enterButton.addEventListener("click", this.handleEnter);
    this.jumpButton.addEventListener("pointerdown", this.handleJump);
    this.liftButton.addEventListener("click", this.handleLiftToggle);
    this.cameraButton.addEventListener("click", this.handleCameraToggle);
    this.videoButton.addEventListener("click", this.handleVideoOpen);
    this.videoCloseButton.addEventListener("click", this.handleVideoClose);
    this.videoUrlForm.addEventListener("submit", this.handleVideoLoad);
    this.fullscreenButton.addEventListener("click", this.handleFullscreen);
    this.fullscreenGuideClose.addEventListener("click", this.handleFullscreenGuideClose);
    document.addEventListener("fullscreenchange", this.syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", this.syncFullscreenState);
    this.syncFullscreenState();
  }

  start(): void {
    this.frameId = window.requestAnimationFrame(this.render);
  }

  getSnapshot(): AppSnapshot {
    const supporters = this.player.supporterPositions.map((position) => ({
      x: position.x,
      y: position.y,
      z: position.z,
    }));
    const audienceStatus = this.showController.getAudienceStatus();
    return {
      player: {
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
      },
      supporters,
      cameraYaw: this.cameraController.yaw,
      playerYaw: this.player.group.rotation.y,
      cameraMode: this.cameraController.mode,
      moshActive: this.player.moshActive,
      twoStepActive: this.player.twoStepActive,
      jumpPointActive: this.player.jumpPointActive,
      jumpPointHeld: this.player.jumpPointHeld,
      liftActive: this.player.liftActive,
      supporterVisible: this.player.supporterVisible,
      ...audienceStatus,
    };
  }

  triggerAudienceKnockback(mode: "mosh" | "lift"): boolean {
    return this.showController.triggerAudienceKnockback(mode);
  }

  dispose(): void {
    window.cancelAnimationFrame(this.frameId);
    this.enterButton.removeEventListener("click", this.handleEnter);
    this.jumpButton.removeEventListener("pointerdown", this.handleJump);
    this.liftButton.removeEventListener("click", this.handleLiftToggle);
    this.cameraButton.removeEventListener("click", this.handleCameraToggle);
    this.videoButton.removeEventListener("click", this.handleVideoOpen);
    this.videoCloseButton.removeEventListener("click", this.handleVideoClose);
    this.videoUrlForm.removeEventListener("submit", this.handleVideoLoad);
    this.fullscreenButton.removeEventListener("click", this.handleFullscreen);
    this.fullscreenGuideClose.removeEventListener("click", this.handleFullscreenGuideClose);
    document.removeEventListener("fullscreenchange", this.syncFullscreenState);
    document.removeEventListener("webkitfullscreenchange", this.syncFullscreenState);
    this.joystick.dispose();
    this.keyboard.dispose();
    this.moshButton.dispose();
    this.twoStepButton.dispose();
    this.jumpPointButton.dispose();
    this.cameraController.dispose();
    this.youtubePlayer.dispose();
    this.timer.dispose();
    disposeScene(this.scene);
    this.renderer.dispose();
  }

  private readonly render = (timestamp: number): void => {
    this.timer.update(timestamp);
    const rawDt = this.timer.getDelta();
    const dt = Math.min(rawDt, 0.05);
    if (document.hidden) {
      this.frameId = window.requestAnimationFrame(this.render);
      return;
    }
    this.resize();
    const movement = combineMovementInputs(this.joystick.value, this.keyboard.value);
    this.player.update(dt, movement, this.cameraController.yaw, this.entered);
    this.cameraController.update(dt, this.player.position);
    this.showController.update(this.timer.getElapsed(), dt, this.player.audienceImpact);
    this.renderer.render(this.scene, this.camera);
    this.updateQuality(rawDt);
    this.frameId = window.requestAnimationFrame(this.render);
  };

  private readonly handleEnter = (): void => {
    this.entered = true;
    this.entryScreen.hidden = true;
    this.hud.hidden = false;
  };

  private readonly handleJump = (event: PointerEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    this.jumpPointButton.cancel();
    this.player.jump();
  };

  private readonly handleLiftToggle = (): void => {
    if (!this.entered) return;
    const active = !this.player.liftActive;
    if (active) {
      this.twoStepButton.cancel();
      this.jumpPointButton.cancel();
    }
    this.player.setLiftActive(active);
    this.liftButton.setAttribute("aria-pressed", String(active));
    this.jumpButton.disabled = active;
    this.moshButton.setDisabled(active);
  };

  private readonly handleCameraToggle = (): void => {
    const mode = this.cameraController.toggleMode();
    this.cameraLabel.textContent = mode === "first" ? "第一人稱" : "第三人稱";
  };

  private readonly handleVideoOpen = (): void => {
    this.youtubePlayer.open();
  };

  private readonly handleVideoClose = (): void => {
    this.youtubePlayer.close();
  };

  private readonly handleVideoLoad = (event: SubmitEvent): void => {
    event.preventDefault();
    const valid = this.youtubePlayer.load(this.videoUrlInput.value);
    this.videoUrlError.hidden = valid;
  };

  private readonly handleFullscreen = async (): Promise<void> => {
    const presentation = this.getFullscreenPresentation();
    try {
      if (presentation.action === "enter") {
        const root = document.documentElement as FullscreenElement;
        if (root.requestFullscreen) await root.requestFullscreen();
        else await Promise.resolve(root.webkitRequestFullscreen?.());
      } else if (presentation.action === "exit") {
        const fullscreenDocument = document as FullscreenDocument;
        if (fullscreenDocument.exitFullscreen) await fullscreenDocument.exitFullscreen();
        else await Promise.resolve(fullscreenDocument.webkitExitFullscreen?.());
      } else if (presentation.action === "guide") {
        this.fullscreenGuide.hidden = false;
        this.fullscreenGuideClose.focus();
      }
    } catch {
      // A rejected browser request must not interrupt the game loop.
    } finally {
      this.syncFullscreenState();
    }
  };

  private readonly handleFullscreenGuideClose = (): void => {
    this.fullscreenGuide.hidden = true;
    this.fullscreenButton.focus();
  };

  private readonly syncFullscreenState = (): void => {
    const presentation = this.getFullscreenPresentation();
    this.fullscreenLabel.textContent = presentation.label;
    this.fullscreenButton.setAttribute("aria-label", presentation.label);
    this.fullscreenButton.setAttribute("aria-pressed", String(presentation.active));
    this.fullscreenButton.classList.toggle("is-active", presentation.active);
  };

  private getFullscreenPresentation() {
    const fullscreenDocument = document as FullscreenDocument;
    const root = document.documentElement as FullscreenElement;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return getFullscreenPresentation({
      nativeActive: Boolean(
        fullscreenDocument.fullscreenElement || fullscreenDocument.webkitFullscreenElement,
      ),
      standalone,
      nativeSupported: Boolean(root.requestFullscreen || root.webkitRequestFullscreen),
    });
  }

  private updateQuality(dt: number): void {
    if (this.reducedQuality || !this.entered || dt > 0.2) return;
    this.qualityElapsed += dt;
    this.qualityFrames += 1;
    if (this.qualityElapsed < 5) return;

    const averageFps = this.qualityFrames / this.qualityElapsed;
    this.qualityElapsed = 0;
    this.qualityFrames = 0;
    if (averageFps >= 24) return;

    this.reducedQuality = true;
    this.renderer.setPixelRatio(1);
    this.showController.setReducedCrowd(true);
    this.scene.fog = null;
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    if (width === this.lastWidth && height === this.lastHeight) return;

    this.lastWidth = width;
    this.lastHeight = height;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }
}

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element: #${id}`);
  return element as T;
}

function disposeScene(scene: THREE.Scene): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value: unknown) => {
        if (value instanceof THREE.Texture) textures.add(value);
      });
    });
  });

  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}
