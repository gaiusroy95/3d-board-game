import path from "node:path";
import { app, BrowserWindow } from "electron";

/**
 * After esbuild CJS emit (`dist-electron/main.cjs`), `__dirname` is the bundle directory.
 * Declared for typecheck; provided at runtime by the CommonJS module scope.
 */
declare const __dirname: string;

const DEV_SERVER_URL = "http://127.0.0.1:5173";

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#0a0a0a",
    title: "Back in century 20",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (!app.isPackaged) {
    void win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    void win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("Renderer failed to load", { errorCode, errorDescription, validatedURL });
  });

  return win;
}

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
