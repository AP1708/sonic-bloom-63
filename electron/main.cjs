// IMUSIC desktop shell.
// A thin Electron window around the published web app, so desktop users get a
// dedicated app icon, window and media keys without a separate codebase.
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

const APP_URL = process.env.IMUSIC_URL || "https://imusic-com.lovable.app";

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0A0A0B",
    autoHideMenuBar: true,
    title: "IMUSIC",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(APP_URL);

  // Anything that isn't the app itself opens in the user's real browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
