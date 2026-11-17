/// <reference types="vite/client" />

interface DesktopBridge {
  readonly appPhase: "milestone-1-local";
  readonly platform: string;
}

interface Window {
  desktopBridge?: DesktopBridge;
}
