export interface FullscreenState {
  nativeActive: boolean;
  standalone: boolean;
  nativeSupported: boolean;
}

export interface FullscreenPresentation {
  active: boolean;
  label: "全螢幕" | "退出全螢幕";
  action: "enter" | "exit" | "guide" | "none";
}

export function getFullscreenPresentation(state: FullscreenState): FullscreenPresentation {
  if (state.nativeActive) {
    return { active: true, label: "退出全螢幕", action: "exit" };
  }
  if (state.standalone) {
    return { active: true, label: "退出全螢幕", action: "none" };
  }
  if (state.nativeSupported) {
    return { active: false, label: "全螢幕", action: "enter" };
  }
  return { active: false, label: "全螢幕", action: "guide" };
}
