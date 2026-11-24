import { contextBridge } from "electron";

/**
 * Desktop preload bridge.
 */
contextBridge.exposeInMainWorld("desktopBridge", {
  appPhase: "desktop" as const,
  platform: process.platform,
});
