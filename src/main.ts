import "./styles.css";
import { App } from "./app/App";

const canvas = document.querySelector<HTMLCanvasElement>("#world");
const errorScreen = document.querySelector<HTMLElement>("#error-screen");
const errorMessage = document.querySelector<HTMLElement>("#error-message");
const reloadButton = document.querySelector<HTMLButtonElement>("#reload-button");

reloadButton?.addEventListener("click", () => window.location.reload());

if (!canvas) {
  throw new Error("Missing game canvas");
}

try {
  const app = new App(canvas);
  if (import.meta.env.DEV) {
    window.__liveHouseDebug = {
      snapshot: () => app.getSnapshot(),
      triggerAudienceKnockback: (mode) => app.triggerAudienceKnockback(mode),
    };
  }
  app.start();
  window.addEventListener(
    "pagehide",
    () => {
      delete window.__liveHouseDebug;
      app.dispose();
    },
    { once: true },
  );
} catch (error) {
  if (errorScreen) errorScreen.hidden = false;
  if (errorMessage && error instanceof Error) errorMessage.textContent = error.message;
}
