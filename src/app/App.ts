import * as THREE from "three";
import { ENABLE_YOUTUBE } from "../config/features";
import { GENERIC_VENUE } from "../config/venue";
import { combineMovementInputs, KeyboardInput } from "../input/KeyboardInput";
import { BeatButton } from "../input/BeatButton";
import { JumpPointButton } from "../input/JumpPointButton";
import { MoshButton } from "../input/MoshButton";
import { TwoStepButton } from "../input/TwoStepButton";
import { VirtualJoystick } from "../input/VirtualJoystick";
import { CameraController } from "../player/CameraController";
import {
  DEFAULT_GAME_SETTINGS,
  loadGameSettings,
  resetGameSettings,
  saveGameSettings,
  type GameSettings,
} from "../player/gameSettings";
import {
  handlePenlightColorSelect,
  loadPenlightState,
  PENLIGHT_COLORS,
  savePenlightState,
  type PenlightPose,
} from "../player/penlight";
import { PlayerController } from "../player/PlayerController";
import type { TwoStepPose } from "../player/TwoStepAction";
import { createLowPolyPerson, DENIM_JEANS } from "../scene/createCharacter";
import { createVenue, type VenueBuild } from "../scene/createVenue";
import { ShowController } from "../show/ShowController";
import { getFullscreenPresentation } from "../ui/fullscreenMode";
import { StationSelector, type Station } from "../ui/StationSelector";
import { YouTubePlayer } from "../ui/YouTubePlayer";

export interface AppSnapshot {
  player: { x: number; y: number; z: number };
  supporters: readonly { x: number; y: number; z: number }[];
  cameraYaw: number;
  camera: { x: number; y: number; z: number };
  cameraHorizontalDistance: number;
  cameraDistance: number;
  playerYaw: number;
  cameraMode: "first" | "third";
  moshActive: boolean;
  moshHeld: boolean;
  moshWindmillTurns: number;
  penlightPose: PenlightPose;
  penlightColorId: string;
  beatActive: boolean;
  beatHeld: boolean;
  settings: GameSettings;
  twoStepActive: boolean;
  twoStepPhase: number;
  twoStepPose: Readonly<TwoStepPose>;
  jumpPointActive: boolean;
  jumpPointHeld: boolean;
  liftActive: boolean;
  supporterVisible: boolean;
  groundHeight: number;
  onStage: boolean;
  knockedAudienceCount: number;
  returningAudienceCount: number;
  knockedPerformerCount: number;
  returningPerformerCount: number;
  firstActivePerformer: {
    x: number;
    y: number;
    z: number;
    phase: "home" | "airborne" | "down" | "getting-up" | "returning";
  } | null;
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
  private readonly beatButton: BeatButton;
  private readonly player: PlayerController;
  private readonly cameraController: CameraController;
  private readonly showController: ShowController;
  private readonly youtubePlayer: YouTubePlayer | null;
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
  private readonly videoSeekBackward = requireElement<HTMLButtonElement>("video-seek-backward");
  private readonly videoPlaybackToggle = requireElement<HTMLButtonElement>("video-playback-toggle");
  private readonly videoSeekForward = requireElement<HTMLButtonElement>("video-seek-forward");
  private readonly videoExpand = requireElement<HTMLButtonElement>("video-expand");
  private readonly videoUrlForm = requireElement<HTMLFormElement>("video-url-form");
  private readonly videoUrlInput = requireElement<HTMLInputElement>("video-url-input");
  private readonly videoUrlError = requireElement<HTMLElement>("video-url-error");
  private readonly fullscreenButton = requireElement<HTMLButtonElement>("fullscreen-button");
  private readonly fullscreenLabel = requireElement<HTMLElement>("fullscreen-label");
  private readonly fullscreenGuide = requireElement<HTMLElement>("fullscreen-guide");
  private readonly fullscreenGuideClose =
    requireElement<HTMLButtonElement>("fullscreen-guide-close");
  private readonly penlightButton = requireElement<HTMLButtonElement>("penlight-button");
  private readonly settingsButton = requireElement<HTMLButtonElement>("settings-button");
  private readonly raisePenlightButton = requireElement<HTMLButtonElement>("raise-penlight-button");
  private readonly wiperPenlightButton = requireElement<HTMLButtonElement>("wiper-penlight-button");
  private readonly beatPenlightButton = requireElement<HTMLButtonElement>("beat-penlight-button");
  private readonly pointPenlightButton = requireElement<HTMLButtonElement>("point-penlight-button");
  private readonly penlightPanel = requireElement<HTMLElement>("penlight-panel");
  private readonly settingsPanel = requireElement<HTMLElement>("settings-panel");
  private readonly penlightColorGrid = requireElement<HTMLElement>("penlight-color-grid");
  private readonly penlightPanelClose = requireElement<HTMLButtonElement>("penlight-panel-close");
  private readonly settingsPanelClose = requireElement<HTMLButtonElement>("settings-panel-close");
  private readonly settingsReset = requireElement<HTMLButtonElement>("settings-reset");
  private readonly videoPanel = requireElement<HTMLElement>("video-panel");
  private readonly stationSelector: StationSelector;
  private readonly venueBadgeText: HTMLElement | null;
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
      glowStick: true,
      palette: { top: 0xd6ff3f, bottom: DENIM_JEANS, accent: 0xff2f7d },
    });
    this.player = new PlayerController(playerRig, GENERIC_VENUE, this.venue.colliders);
    this.player.setPenlightState(loadPenlightState(window.localStorage));
    this.player.setGameSettings(loadGameSettings(window.localStorage));
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
          this.beatButton.cancel();
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
        this.beatButton.cancel();
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
        this.beatButton.cancel();
        this.player.startJumpPoint();
        this.liftButton.setAttribute("aria-pressed", "false");
        this.jumpButton.disabled = false;
        this.moshButton.setDisabled(false);
      },
      () => this.player.releaseJumpPoint(),
    );
    this.beatButton = new BeatButton(
      this.beatPenlightButton,
      () => {
        if (!this.entered) return;
        this.player.startBeat();
        this.syncPenlightChrome();
      },
      () => {
        this.player.releaseBeat();
        this.syncPenlightChrome();
      },
    );
    this.cameraController = new CameraController(
      this.camera,
      requireElement<HTMLElement>("look-zone"),
      GENERIC_VENUE,
      this.venue.colliders,
      this.player,
    );
    this.cameraController.update(1, this.player.position);
    if (ENABLE_YOUTUBE) {
      this.youtubePlayer = new YouTubePlayer(
        GENERIC_VENUE.youtubeVideoId,
        this.videoPanel,
        requireElement<HTMLElement>("youtube-player"),
        requireElement<HTMLElement>("video-status"),
        {
          toggleButton: this.videoButton,
          minimizeButton: this.videoCloseButton,
          backwardButton: this.videoSeekBackward,
          playbackButton: this.videoPlaybackToggle,
          forwardButton: this.videoSeekForward,
          expandButton: this.videoExpand,
        },
      );
      this.videoButton.hidden = false;
      this.videoButton.addEventListener("click", this.handleVideoOpen);
      this.videoUrlForm.addEventListener("submit", this.handleVideoLoad);
    } else {
      this.youtubePlayer = null;
      this.videoButton.hidden = true;
      this.videoPanel.hidden = true;
      document.documentElement.dataset.youtubeEnabled = "false";
    }

    this.buildPenlightColorGrid();
    this.syncSettingsControls(this.player.gameSettings);
    this.syncPenlightChrome();

    this.venueBadgeText = document.querySelector<HTMLElement>("#venue-badge-text");
    this.stationSelector = new StationSelector(
      {
        track: requireElement<HTMLElement>("station-track"),
        titleElement: requireElement<HTMLElement>("entry-title"),
        copyElement: requireElement<HTMLElement>("station-copy"),
        statusBadge: requireElement<HTMLElement>("station-status-badge"),
        enterButton: this.enterButton,
        feedbackElement: requireElement<HTMLElement>("enter-feedback"),
      },
      {
        onEnter: (station) => this.handleEnterWithStation(station),
      },
    );

    this.enterButton.addEventListener("click", this.handleEnter);
    this.jumpButton.addEventListener("pointerdown", this.handleJump);
    this.liftButton.addEventListener("click", this.handleLiftToggle);
    this.cameraButton.addEventListener("click", this.handleCameraToggle);
    this.fullscreenButton.addEventListener("click", this.handleFullscreen);
    this.fullscreenGuideClose.addEventListener("click", this.handleFullscreenGuideClose);
    this.penlightButton.addEventListener("click", this.handlePenlightPanelToggle);
    this.settingsButton.addEventListener("click", this.handleSettingsPanelToggle);
    this.penlightPanelClose.addEventListener("click", () => this.setPanelOpen("penlight", false));
    this.settingsPanelClose.addEventListener("click", () => this.setPanelOpen("settings", false));
    this.raisePenlightButton.addEventListener("click", () => this.handleCheerPose("raise"));
    this.wiperPenlightButton.addEventListener("click", () => this.handleCheerPose("wiper"));
    this.pointPenlightButton.addEventListener("click", () => this.handleCheerPose("point"));
    this.settingsReset.addEventListener("click", this.handleSettingsReset);
    this.penlightPanel.querySelectorAll("[data-close-panel]").forEach((el) => {
      el.addEventListener("click", () => this.setPanelOpen("penlight", false));
    });
    this.settingsPanel.querySelectorAll("[data-close-panel]").forEach((el) => {
      el.addEventListener("click", () => this.setPanelOpen("settings", false));
    });
    for (const key of Object.keys(DEFAULT_GAME_SETTINGS) as (keyof GameSettings)[]) {
      requireElement<HTMLInputElement>(`setting-${key}`).addEventListener("input", () => {
        this.handleSettingInput(key);
      });
    }
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
    const performerStatus = this.showController.getPerformerStatus();
    return {
      player: {
        x: this.player.position.x,
        y: this.player.position.y,
        z: this.player.position.z,
      },
      supporters,
      cameraYaw: this.cameraController.yaw,
      camera: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
      },
      cameraHorizontalDistance: Math.hypot(
        this.camera.position.x - this.player.position.x,
        this.camera.position.z - this.player.position.z,
      ),
      cameraDistance: this.camera.position.distanceTo(this.player.position),
      playerYaw: this.player.group.rotation.y,
      cameraMode: this.cameraController.mode,
      moshActive: this.player.moshActive,
      moshHeld: this.player.moshHeld,
      moshWindmillTurns: this.player.moshWindmillTurns,
      penlightPose: this.player.penlight.pose,
      penlightColorId: this.player.penlight.colorId,
      beatActive: this.player.beatActive,
      beatHeld: this.player.beatHeld,
      settings: { ...this.player.gameSettings },
      twoStepActive: this.player.twoStepActive,
      twoStepPhase: this.player.twoStepPhase,
      twoStepPose: { ...this.player.twoStepPoseState },
      jumpPointActive: this.player.jumpPointActive,
      jumpPointHeld: this.player.jumpPointHeld,
      liftActive: this.player.liftActive,
      supporterVisible: this.player.supporterVisible,
      groundHeight: this.player.groundHeight,
      onStage: this.player.groundHeight > GENERIC_VENUE.spawn.y,
      ...audienceStatus,
      ...performerStatus,
    };
  }

  triggerAudienceKnockback(mode: "mosh" | "lift"): boolean {
    return this.showController.triggerAudienceKnockback(mode);
  }

  triggerPerformerKnockback(mode: "mosh" | "lift"): boolean {
    return this.showController.triggerPerformerKnockback(mode);
  }

  debugPlacePlayer(x: number, z: number): void {
    this.player.debugPlaceOnGround(x, z);
  }

  debugSetTwoStepPhase(progress: number): void {
    this.player.debugSetTwoStepPhase(progress);
  }

  debugSetMoshPhase(progress: number): void {
    this.player.debugSetMoshPhase(progress);
  }

  debugSetCameraYaw(yaw: number): void {
    this.debugSetCameraView(yaw, -0.12);
  }

  debugSetCameraView(yaw: number, pitch: number): void {
    this.cameraController.debugSetView(yaw, pitch);
    this.cameraController.update(1, this.player.position);
  }

  dispose(): void {
    window.cancelAnimationFrame(this.frameId);
    this.enterButton.removeEventListener("click", this.handleEnter);
    this.jumpButton.removeEventListener("pointerdown", this.handleJump);
    this.liftButton.removeEventListener("click", this.handleLiftToggle);
    this.cameraButton.removeEventListener("click", this.handleCameraToggle);
    if (ENABLE_YOUTUBE) {
      this.videoButton.removeEventListener("click", this.handleVideoOpen);
      this.videoUrlForm.removeEventListener("submit", this.handleVideoLoad);
    }
    this.fullscreenButton.removeEventListener("click", this.handleFullscreen);
    this.fullscreenGuideClose.removeEventListener("click", this.handleFullscreenGuideClose);
    document.removeEventListener("fullscreenchange", this.syncFullscreenState);
    document.removeEventListener("webkitfullscreenchange", this.syncFullscreenState);
    this.joystick.dispose();
    this.keyboard.dispose();
    this.moshButton.dispose();
    this.twoStepButton.dispose();
    this.jumpPointButton.dispose();
    this.beatButton.dispose();
    this.cameraController.dispose();
    this.stationSelector.dispose();
    this.youtubePlayer?.dispose();
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
    this.stationSelector.handleEnterClick();
  };

  private readonly handleEnterWithStation = (station: Station): void => {
    this.entered = true;
    this.entryScreen.hidden = true;
    this.hud.hidden = false;
    if (this.venueBadgeText) {
      this.venueBadgeText.textContent = `LIVE · ${station.id === "neo-backstage" ? "NEON BACKSTAGE" : station.name}`;
    }
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
    this.youtubePlayer?.toggle();
  };

  private readonly handleVideoLoad = (event: SubmitEvent): void => {
    event.preventDefault();
    if (!this.youtubePlayer) return;
    const valid = this.youtubePlayer.load(this.videoUrlInput.value);
    this.videoUrlError.hidden = valid;
  };

  private readonly handlePenlightPanelToggle = (): void => {
    const open = this.penlightPanel.hasAttribute("hidden");
    this.setPanelOpen("settings", false);
    this.setPanelOpen("penlight", open);
  };

  private readonly handleSettingsPanelToggle = (): void => {
    const open = this.settingsPanel.hasAttribute("hidden");
    this.setPanelOpen("penlight", false);
    this.setPanelOpen("settings", open);
  };

  private handleCheerPose(pose: Exclude<PenlightPose, "idle" | "beat">): void {
    if (!this.entered) return;
    this.beatButton.cancel();
    const next = this.player.togglePenlightPose(pose);
    savePenlightState(this.player.penlight, window.localStorage);
    this.syncPenlightChrome();
    void next;
  }

  private readonly handleSettingsReset = (): void => {
    const settings = resetGameSettings(window.localStorage);
    this.player.setGameSettings(settings);
    this.syncSettingsControls(settings);
  };

  private handleSettingInput(key: keyof GameSettings): void {
    const input = requireElement<HTMLInputElement>(`setting-${key}`);
    const next = {
      ...this.player.gameSettings,
      [key]: Number(input.value),
    };
    const saved = saveGameSettings(next, window.localStorage);
    this.player.setGameSettings(saved);
    this.syncSettingsControls(saved);
  }

  private setPanelOpen(panel: "penlight" | "settings", open: boolean): void {
    const root = panel === "penlight" ? this.penlightPanel : this.settingsPanel;
    const button = panel === "penlight" ? this.penlightButton : this.settingsButton;
    root.hidden = !open;
    button.setAttribute("aria-pressed", String(open));
    button.classList.toggle("is-active", open);
  }

  private buildPenlightColorGrid(): void {
    this.penlightColorGrid.replaceChildren();
    for (const color of PENLIGHT_COLORS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "penlight-swatch";
      button.style.setProperty("--swatch", `#${color.hex.toString(16).padStart(6, "0")}`);
      button.setAttribute("role", "option");
      button.setAttribute("aria-label", color.label);
      button.dataset.colorId = color.id;
      button.addEventListener("click", () => {
        handlePenlightColorSelect({
          apply: () => this.player.setPenlightColor(color.id),
          persist: () => {
            savePenlightState(this.player.penlight, window.localStorage);
          },
          sync: () => this.syncPenlightChrome(),
          // Dismiss after a color pick; pose toggles stay on the HUD.
          dismiss: () => this.setPanelOpen("penlight", false),
        });
      });
      this.penlightColorGrid.append(button);
    }
  }

  private syncPenlightChrome(): void {
    const { colorId, pose } = this.player.penlight;
    const beating = this.player.beatActive || this.player.beatHeld;
    this.raisePenlightButton.setAttribute("aria-pressed", String(pose === "raise"));
    this.wiperPenlightButton.setAttribute("aria-pressed", String(pose === "wiper"));
    this.pointPenlightButton.setAttribute("aria-pressed", String(pose === "point"));
    this.raisePenlightButton.classList.toggle("is-active", pose === "raise");
    this.wiperPenlightButton.classList.toggle("is-active", pose === "wiper");
    this.pointPenlightButton.classList.toggle("is-active", pose === "point");
    // BeatButton owns pressed/active while the pointer is down; keep chrome in sync after release.
    if (!beating) {
      this.beatPenlightButton.setAttribute("aria-pressed", "false");
      this.beatPenlightButton.classList.remove("is-active");
    }
    this.penlightColorGrid.querySelectorAll<HTMLButtonElement>(".penlight-swatch").forEach((swatch) => {
      const selected = swatch.dataset.colorId === colorId;
      swatch.setAttribute("aria-selected", String(selected));
      swatch.classList.toggle("is-selected", selected);
    });
  }

  private syncSettingsControls(settings: GameSettings): void {
    for (const key of Object.keys(DEFAULT_GAME_SETTINGS) as (keyof GameSettings)[]) {
      const input = requireElement<HTMLInputElement>(`setting-${key}`);
      const output = requireElement<HTMLOutputElement>(`setting-${key}-value`);
      input.value = String(settings[key]);
      output.value = `${settings[key].toFixed(2)}×`;
    }
  }

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
