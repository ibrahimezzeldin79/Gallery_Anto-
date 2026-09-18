const { app, BrowserWindow, ipcMain, protocol, net, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const legacyUserDataRoot = path.join(
  process.env.APPDATA || path.join(require("os").homedir(), "AppData", "Roaming"),
  "react-example"
);
app.setPath("userData", legacyUserDataRoot);

const {
  initDatabase,
  getNextInvoiceNumber,
  productsApi,
  invoicesApi,
  deletedInvoicesApi,
  employeesApi,
  categoriesApi,
  closedDaysApi,
  expensesApi,
  archivedSalesApi,
  settingsApi,
  backupsApi,
  syncApi,
  runMigrationIfNeeded
} = require("./database.cjs");
const { InMemoryTransport } = require("./realtime/transportInterface.cjs");
const { SyncCoordinator } = require("./realtime/syncCoordinator.cjs");
const { LanTransport, getPrivateAddresses } = require("./realtime/lanTransport.cjs");
const { AutoUpdaterManager } = require("./autoUpdater.cjs");

// Register privileged custom scheme 'media://' before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: "media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

let mainWindow = null;
let lanTransport = null;
const updaterManager = new AutoUpdaterManager({
  app,
  getWindow: () => mainWindow
});
const syncCoordinator = new SyncCoordinator({
  syncApi,
  transport: new InMemoryTransport()
});

function getLanTransport() {
  if (!lanTransport) {
    lanTransport = new LanTransport({
      deviceIdProvider: () => syncApi.getDeviceId(),
      dataDirectory: path.join(app.getPath("userData"), "lan"),
      safeStorage,
      allowMutations: false
    });
  }
  return lanTransport;
}

function createWindow() {
  const userDataPath = app.getPath("userData");
  initDatabase(userDataPath);

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: "Gallery ANTO POS",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, "preload.cjs")
    }
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";
  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || "http://localhost:3000";
    mainWindow.loadURL(devUrl).catch((err) => {
      console.warn("Could not load dev server URL, falling back to local file:", err);
      mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// -------------------------------------------------------------
// Register Custom Media Protocol (media://images/filename)
// -------------------------------------------------------------
function registerMediaProtocol() {
  protocol.handle("media", (request) => {
    try {
      const url = request.url;
      const urlPath = url.replace(/^media:\/\//, "");
      const imagesDir = path.join(app.getPath("userData"), "data", "images");
      const normalizedPath = path.normalize(urlPath.replace(/^images\//, ""));
      const fullPath = path.join(imagesDir, normalizedPath);

      if (fs.existsSync(fullPath)) {
        return net.fetch(pathToFileURL(fullPath).toString());
      } else {
        return new Response("Not Found", { status: 404 });
      }
    } catch (err) {
      console.error("Media protocol error:", err);
      return new Response("Internal Error", { status: 500 });
    }
  });
}

// -------------------------------------------------------------
// App Lifecycle
// -------------------------------------------------------------
app.whenReady().then(() => {
  registerMediaProtocol();
  setupIpcHandlers();
  createWindow();
  updaterManager.initialize();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  updaterManager.dispose();
});

// -------------------------------------------------------------
// Register IPC Handlers
// -------------------------------------------------------------
function setupIpcHandlers() {
  // Products
  ipcMain.handle("db:products:getAll", async () => productsApi.getAll());
  ipcMain.handle("db:products:getById", async (_, id) => productsApi.getById(id));
  ipcMain.handle("db:products:create", async (_, product) => productsApi.create(product));
  ipcMain.handle("db:products:update", async (_, product) => productsApi.update(product));
  ipcMain.handle("db:products:updateStock", async (_, id, stock) => productsApi.updateStock(id, stock));
  ipcMain.handle("db:products:delete", async (_, id) => productsApi.delete(id));

  // Invoices
  ipcMain.handle("db:invoices:getAll", async (_, options) => invoicesApi.getAll(options));
  ipcMain.handle("db:invoices:getById", async (_, id) => invoicesApi.getById(id));
  ipcMain.handle("db:invoices:create", async (_, invoiceData) => invoicesApi.createTransaction(invoiceData));
  ipcMain.handle("db:invoices:update", async (_, invoice) => invoicesApi.update(invoice));
  ipcMain.handle("db:invoices:delete", async (_, id) => invoicesApi.deleteTransaction(id));
  ipcMain.handle("db:invoices:getNextInvoiceNumber", async () => getNextInvoiceNumber());

  // Deleted Invoices
  ipcMain.handle("db:deletedInvoices:getAll", async () => deletedInvoicesApi.getAll());

  // Employees
  ipcMain.handle("db:employees:getAll", async () => employeesApi.getAll());
  ipcMain.handle("db:employees:create", async (_, name) => employeesApi.create(name));
  ipcMain.handle("db:employees:update", async (_, oldName, newName) => employeesApi.update(oldName, newName));
  ipcMain.handle("db:employees:delete", async (_, name) => employeesApi.delete(name));

  // Categories
  ipcMain.handle("db:categories:getAll", async () => categoriesApi.getAll());
  ipcMain.handle("db:categories:create", async (_, name) => categoriesApi.create(name));
  ipcMain.handle("db:categories:delete", async (_, name) => categoriesApi.delete(name));

  // Closed Days
  ipcMain.handle("db:closedDays:getAll", async () => closedDaysApi.getAll());
  ipcMain.handle("db:closedDays:create", async (_, data) => closedDaysApi.create(data));

  // Expenses
  ipcMain.handle("db:expenses:getAll", async () => expensesApi.getAll());
  ipcMain.handle("db:expenses:create", async (_, expense) => expensesApi.create(expense));
  ipcMain.handle("db:expenses:delete", async (_, id) => expensesApi.delete(id));

  // Archived Sales
  ipcMain.handle("db:archivedSales:getAll", async () => archivedSalesApi.getAll());
  ipcMain.handle("db:archivedSales:create", async (_, data) => archivedSalesApi.create(data));

  // Settings
  ipcMain.handle("db:settings:get", async (_, key) => settingsApi.get(key));
  ipcMain.handle("db:settings:set", async (_, key, value) => settingsApi.set(key, value));

  // Backups
  ipcMain.handle("db:backups:createBackup", async () => backupsApi.createBackup());
  ipcMain.handle("db:backups:listBackups", async () => backupsApi.listBackups());
  ipcMain.handle("db:backups:restoreBackup", async (_, name) => backupsApi.restoreBackup(name));

  // Local synchronization foundation
  ipcMain.handle("db:sync:getDeviceId", async () => syncApi.getDeviceId());
  ipcMain.handle("db:sync:createOperation", async (_, operation) => syncApi.createOperation(operation));
  ipcMain.handle("db:sync:getOperation", async (_, operationId) => syncApi.getOperation(operationId));
  ipcMain.handle("db:sync:getPendingOperations", async (_, limit) => syncApi.getPendingOperations(limit));
  ipcMain.handle("db:sync:markOperationSynced", async (_, operationId) => syncApi.markOperationSynced(operationId));
  ipcMain.handle("db:sync:markOperationFailed", async (_, operationId, errorMessage) => syncApi.markOperationFailed(operationId, errorMessage));
  ipcMain.handle("db:sync:recordTombstone", async (_, tombstone) => syncApi.recordTombstone(tombstone));
  ipcMain.handle("db:sync:getTombstone", async (_, entityTable, entityId) => syncApi.getTombstone(entityTable, entityId));
  ipcMain.handle("db:sync:getTombstones", async (_, limit) => syncApi.getTombstones(limit));
  ipcMain.handle("db:sync:getState", async (_, key) => syncApi.getState(key));
  ipcMain.handle("db:sync:setState", async (_, key, value) => syncApi.setState(key, value));

  // Transport-neutral sync coordinator. It is opt-in and uses only the test transport for now.
  ipcMain.handle("realtime:start", async () => syncCoordinator.start());
  ipcMain.handle("realtime:stop", async () => syncCoordinator.stop());
  ipcMain.handle("realtime:getStatus", async () => syncCoordinator.getStatus());
  ipcMain.handle("realtime:processPending", async (_, limit) => syncCoordinator.processPending(limit));

  // LAN connectivity test APIs. LAN mutation transport remains disabled in this stage.
  ipcMain.handle("lan:getPrivateAddresses", async () => getPrivateAddresses());
  ipcMain.handle("lan:startHost", async (_, options) => getLanTransport().startHost(options));
  ipcMain.handle("lan:stopHost", async () => getLanTransport().stopHost());
  ipcMain.handle("lan:getStatus", async () => getLanTransport().getStatus());
  ipcMain.handle("lan:createPairingCode", async () => getLanTransport().createPairingCode());
  ipcMain.handle("lan:connect", async (_, options) => getLanTransport().connect(options));
  ipcMain.handle("lan:disconnect", async () => getLanTransport().disconnect());
  ipcMain.handle("lan:sendTestMessage", async (_, payload) => getLanTransport().sendTestMessage(payload));
  ipcMain.handle("lan:getLastTestMessage", async () => getLanTransport().getLastTestMessage());
  ipcMain.handle("lan:confirmTestMessage", async (_, testId) => getLanTransport().confirmTestMessage(testId));

  // Migration
  ipcMain.handle("db:migration:runMigrationIfNeeded", async (_, legacyData) => runMigrationIfNeeded(legacyData));

  // App Info
  ipcMain.handle("app:getUserDataPath", async () => app.getPath("userData"));

  // Application updates. The updater never accesses business data.
  ipcMain.handle("updater:getStatus", async () => updaterManager.getStatus());
  ipcMain.handle("updater:check", async () => updaterManager.check());
  ipcMain.handle("updater:download", async () => updaterManager.download());
  ipcMain.handle("updater:install", async () => updaterManager.install());
}
