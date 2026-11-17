import { contextBridge } from "electron";

/**
 * Minimal preload bridge for Milestone 1.
 * Steamworks / multiplayer IPC will be added later behind typed interfaces.
 */
contextBridge.exposeInMainWorld("desktopBridge", {
  appPhase: "milestone-1-local" as const,
  platform: process.platform,
});
