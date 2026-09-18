const fs = require("fs");
const path = require("path");
const { autoUpdater } = require("electron-updater");

const INITIAL_STATUS = "idle";
const STATUS_VALUES = new Set([
  "idle",
  "checking",
  "available",
  "not-available",
  "downloading",
  "downloaded",
  "installing",
  "error"
]);

function sanitizeError(error) {
  const message = error && error.message ? String(error.message) : "Update operation failed";
  return message.slice(0, 300);
}

class AutoUpdaterManager {
  constructor({ app, getWindow } = {}) {
    if (!app || typeof getWindow !== "function") {
      throw new Error("AutoUpdaterManager requires app and getWindow");
    }
    this.app = app;
    this.getWindow = getWindow;
    this.status = {
      state: INITIAL_STATUS,
      currentVersion: app.getVersion(),
      availableVersion: null,
      progress: 0,
      error: null,
      providerConfigured: false
    };
    this.initialized = false;
    this.autoCheckTimer = null;
    this.listeners = [];
  }

  isProviderConfigured() {
    if (!this.app.isPackaged) return false;
    return fs.existsSync(path.join(process.resourcesPath, "app-update.yml"));
  }

  getStatus() {
    return { ...this.status };
  }

  publishStatus(patch = {}) {
    this.status = {
      ...this.status,
      ...patch,
      currentVersion: this.app.getVersion()
    };
    const window = this.getWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send("updater:status", this.getStatus());
    }
  }

  bind(event, handler) {
    autoUpdater.on(event, handler);
    this.listeners.push({ event, handler });
  }

  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    this.status.providerConfigured = this.isProviderConfigured();
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;

    this.bind("checking-for-update", () => {
      this.publishStatus({ state: "checking", error: null });
    });
    this.bind("update-available", (info) => {
      this.publishStatus({
        state: "available",
        availableVersion: info && info.version ? String(info.version) : null,
        progress: 0,
        error: null
      });
    });
    this.bind("update-not-available", () => {
      this.publishStatus({ state: "not-available", availableVersion: null, progress: 0, error: null });
    });
    this.bind("download-progress", (progress) => {
      this.publishStatus({
        state: "downloading",
        progress: Math.max(0, Math.min(100, Number(progress && progress.percent) || 0)),
        error: null
      });
    });
    this.bind("update-downloaded", (info) => {
      this.publishStatus({
        state: "downloaded",
        availableVersion: info && info.version ? String(info.version) : this.status.availableVersion,
        progress: 100,
        error: null
      });
    });
    this.bind("error", (error) => {
      console.error("[Updater] Update operation failed:", sanitizeError(error));
      this.publishStatus({ state: "error", error: sanitizeError(error) });
    });

    this.autoCheckTimer = setTimeout(() => {
      this.autoCheckTimer = null;
      this.check().catch(() => {});
    }, 10000);
  }

  async check() {
    if (!this.initialized) this.initialize();
    if (!this.status.providerConfigured) {
      const error = "Update provider is not configured";
      this.publishStatus({ state: "error", error });
      return this.getStatus();
    }
    this.publishStatus({ state: "checking", error: null });
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      console.error("[Updater] Check failed:", sanitizeError(error));
      this.publishStatus({ state: "error", error: sanitizeError(error) });
    }
    return this.getStatus();
  }

  async download() {
    if (!this.status.providerConfigured) {
      this.publishStatus({ state: "error", error: "Update provider is not configured" });
      return this.getStatus();
    }
    if (this.status.state !== "available") return this.getStatus();
    this.publishStatus({ state: "downloading", progress: 0, error: null });
    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error("[Updater] Download failed:", sanitizeError(error));
      this.publishStatus({ state: "error", error: sanitizeError(error) });
    }
    return this.getStatus();
  }

  install() {
    if (this.status.state !== "downloaded") return this.getStatus();
    this.publishStatus({ state: "installing", error: null });
    autoUpdater.quitAndInstall(false, true);
    return this.getStatus();
  }

  dispose() {
    if (this.autoCheckTimer) clearTimeout(this.autoCheckTimer);
    this.autoCheckTimer = null;
    for (const { event, handler } of this.listeners) autoUpdater.removeListener(event, handler);
    this.listeners = [];
  }
}

module.exports = { AutoUpdaterManager, STATUS_VALUES };
