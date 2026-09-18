const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  products: {
    getAll: () => ipcRenderer.invoke("db:products:getAll"),
    getById: (id) => ipcRenderer.invoke("db:products:getById", id),
    create: (product) => ipcRenderer.invoke("db:products:create", product),
    update: (product) => ipcRenderer.invoke("db:products:update", product),
    updateStock: (id, stock) => ipcRenderer.invoke("db:products:updateStock", id, stock),
    delete: (id) => ipcRenderer.invoke("db:products:delete", id)
  },
  invoices: {
    getAll: (options) => ipcRenderer.invoke("db:invoices:getAll", options),
    getById: (id) => ipcRenderer.invoke("db:invoices:getById", id),
    create: (invoiceData) => ipcRenderer.invoke("db:invoices:create", invoiceData),
    update: (invoice) => ipcRenderer.invoke("db:invoices:update", invoice),
    delete: (id) => ipcRenderer.invoke("db:invoices:delete", id),
    getNextInvoiceNumber: () => ipcRenderer.invoke("db:invoices:getNextInvoiceNumber")
  },
  deletedInvoices: {
    getAll: () => ipcRenderer.invoke("db:deletedInvoices:getAll")
  },
  employees: {
    getAll: () => ipcRenderer.invoke("db:employees:getAll"),
    create: (name) => ipcRenderer.invoke("db:employees:create", name),
    update: (oldName, newName) => ipcRenderer.invoke("db:employees:update", oldName, newName),
    delete: (name) => ipcRenderer.invoke("db:employees:delete", name)
  },
  categories: {
    getAll: () => ipcRenderer.invoke("db:categories:getAll"),
    create: (name) => ipcRenderer.invoke("db:categories:create", name),
    delete: (name) => ipcRenderer.invoke("db:categories:delete", name)
  },
  closedDays: {
    getAll: () => ipcRenderer.invoke("db:closedDays:getAll"),
    create: (data) => ipcRenderer.invoke("db:closedDays:create", data)
  },
  expenses: {
    getAll: () => ipcRenderer.invoke("db:expenses:getAll"),
    create: (expense) => ipcRenderer.invoke("db:expenses:create", expense),
    delete: (id) => ipcRenderer.invoke("db:expenses:delete", id)
  },
  archivedSales: {
    getAll: () => ipcRenderer.invoke("db:archivedSales:getAll"),
    create: (data) => ipcRenderer.invoke("db:archivedSales:create", data)
  },
  settings: {
    get: (key) => ipcRenderer.invoke("db:settings:get", key),
    set: (key, value) => ipcRenderer.invoke("db:settings:set", key, value)
  },
  backups: {
    createBackup: () => ipcRenderer.invoke("db:backups:createBackup"),
    listBackups: () => ipcRenderer.invoke("db:backups:listBackups"),
    restoreBackup: (name) => ipcRenderer.invoke("db:backups:restoreBackup", name)
  },
  sync: {
    getDeviceId: () => ipcRenderer.invoke("db:sync:getDeviceId"),
    createOperation: (operation) => ipcRenderer.invoke("db:sync:createOperation", operation),
    getOperation: (operationId) => ipcRenderer.invoke("db:sync:getOperation", operationId),
    getPendingOperations: (limit) => ipcRenderer.invoke("db:sync:getPendingOperations", limit),
    markOperationSynced: (operationId) => ipcRenderer.invoke("db:sync:markOperationSynced", operationId),
    markOperationFailed: (operationId, errorMessage) => ipcRenderer.invoke("db:sync:markOperationFailed", operationId, errorMessage),
    recordTombstone: (tombstone) => ipcRenderer.invoke("db:sync:recordTombstone", tombstone),
    getTombstone: (entityTable, entityId) => ipcRenderer.invoke("db:sync:getTombstone", entityTable, entityId),
    getTombstones: (limit) => ipcRenderer.invoke("db:sync:getTombstones", limit),
    getState: (key) => ipcRenderer.invoke("db:sync:getState", key),
    setState: (key, value) => ipcRenderer.invoke("db:sync:setState", key, value)
  },
  realtime: {
    start: () => ipcRenderer.invoke("realtime:start"),
    stop: () => ipcRenderer.invoke("realtime:stop"),
    getStatus: () => ipcRenderer.invoke("realtime:getStatus"),
    processPending: (limit) => ipcRenderer.invoke("realtime:processPending", limit)
  },
  lan: {
    getPrivateAddresses: () => ipcRenderer.invoke("lan:getPrivateAddresses"),
    startHost: (options) => ipcRenderer.invoke("lan:startHost", options),
    stopHost: () => ipcRenderer.invoke("lan:stopHost"),
    getStatus: () => ipcRenderer.invoke("lan:getStatus"),
    createPairingCode: () => ipcRenderer.invoke("lan:createPairingCode"),
    connect: (options) => ipcRenderer.invoke("lan:connect", options),
    disconnect: () => ipcRenderer.invoke("lan:disconnect"),
    sendTestMessage: (payload) => ipcRenderer.invoke("lan:sendTestMessage", payload),
    getLastTestMessage: () => ipcRenderer.invoke("lan:getLastTestMessage"),
    confirmTestMessage: (testId) => ipcRenderer.invoke("lan:confirmTestMessage", testId)
  },
  migration: {
    runMigrationIfNeeded: (legacyData) => ipcRenderer.invoke("db:migration:runMigrationIfNeeded", legacyData)
  },
  appInfo: {
    getUserDataPath: () => ipcRenderer.invoke("app:getUserDataPath")
  },
  updater: {
    getStatus: () => ipcRenderer.invoke("updater:getStatus"),
    check: () => ipcRenderer.invoke("updater:check"),
    download: () => ipcRenderer.invoke("updater:download"),
    install: () => ipcRenderer.invoke("updater:install"),
    onStatus: (listener) => {
      const handler = (_event, status) => listener(status);
      ipcRenderer.on("updater:status", handler);
      return () => ipcRenderer.removeListener("updater:status", handler);
    }
  }
});
