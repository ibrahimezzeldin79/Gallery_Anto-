const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const Database = require("better-sqlite3");

let db = null;
let userDataDir = "";
let imagesDir = "";
let backupsDir = "";
let deviceIdPath = "";

const SCHEMA_VERSION = 7;

/**
 * Initialize SQLite database connection and table schemas inside UserData directory.
 * Path is always outside of app/dist bundles, ensuring updates never wipe data.
 */
function initDatabase(appUserDataPath) {
  userDataDir = path.join(appUserDataPath, "data");
  imagesDir = path.join(userDataDir, "images");
  backupsDir = path.join(appUserDataPath, "backups");
  deviceIdPath = path.join(userDataDir, "device-id");

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const dbPath = path.join(userDataDir, "gallery_anto.sqlite");
  console.log("[SQLite] Opening database at:", dbPath);

  db = new Database(dbPath, { verbose: null });

  // Enable WAL mode for high performance & concurrency, enable Foreign Keys
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");

  // Create tables & core schemas
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      appliedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      basePrice REAL DEFAULT 0,
      barcode TEXT UNIQUE,
      stock INTEGER NOT NULL DEFAULT 0,
      minStockAlert INTEGER DEFAULT 3,
      image TEXT DEFAULT '',
      category TEXT DEFAULT '',
      createdAt INTEGER,
      isIncomplete INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoiceNumber TEXT UNIQUE NOT NULL,
      timestamp INTEGER NOT NULL,
      formattedDate TEXT NOT NULL,
      formattedTime TEXT NOT NULL,
      total REAL NOT NULL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      paymentMethod TEXT DEFAULT 'كاش',
      sellerName TEXT DEFAULT '',
      customerPhone TEXT DEFAULT '',
      splitPayments TEXT DEFAULT '[]',
      closedDayId TEXT DEFAULT NULL,
      isDiscountedBelowBase INTEGER DEFAULT 0,
      discountAlerts TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id TEXT PRIMARY KEY,
      invoiceId TEXT NOT NULL,
      productId TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      basePrice REAL DEFAULT 0,
      FOREIGN KEY (invoiceId) REFERENCES invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS deleted_invoices (
      id TEXT PRIMARY KEY,
      invoiceNumber TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      formattedDate TEXT NOT NULL,
      formattedTime TEXT NOT NULL,
      total REAL NOT NULL DEFAULT 0,
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      paymentMethod TEXT DEFAULT 'كاش',
      sellerName TEXT DEFAULT '',
      customerPhone TEXT DEFAULT '',
      splitPayments TEXT DEFAULT '[]',
      closedDayId TEXT DEFAULT NULL,
      isDiscountedBelowBase INTEGER DEFAULT 0,
      discountAlerts TEXT DEFAULT '[]',
      deletedAt INTEGER NOT NULL,
      deletedDateStr TEXT NOT NULL,
      deletedTimeStr TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deleted_invoice_items (
      id TEXT PRIMARY KEY,
      invoiceId TEXT NOT NULL,
      productId TEXT NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      basePrice REAL DEFAULT 0,
      FOREIGN KEY (invoiceId) REFERENCES deleted_invoices(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS closed_days (
      id TEXT PRIMARY KEY,
      timestamp INTEGER NOT NULL,
      formattedDate TEXT NOT NULL,
      formattedTime TEXT NOT NULL,
      totalSales REAL NOT NULL DEFAULT 0,
      totalExpenses REAL NOT NULL DEFAULT 0,
      netSales REAL NOT NULL DEFAULT 0,
      invoiceCount INTEGER NOT NULL DEFAULT 0,
      invoiceIds TEXT DEFAULT '[]',
      totalDiscounts REAL DEFAULT 0,
      totalItemsSold INTEGER DEFAULT 0,
      discountedInvoicesCount INTEGER DEFAULT 0,
      paymentBreakdown TEXT DEFAULT '{}',
      employeeRankings TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS archived_sales (
      id TEXT PRIMARY KEY,
      employeeName TEXT NOT NULL,
      dateStr TEXT NOT NULL,
      totalSales REAL NOT NULL DEFAULT 0,
      invoiceCount INTEGER NOT NULL DEFAULT 0,
      itemsSold INTEGER NOT NULL DEFAULT 0,
      deletedAt INTEGER NOT NULL,
      invoicesCopied TEXT DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL,
      formattedDate TEXT NOT NULL,
      formattedTime TEXT NOT NULL,
      notes TEXT DEFAULT '',
      sellerName TEXT DEFAULT '',
      closedDayId TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS counters (
      key TEXT PRIMARY KEY,
      value INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
    CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoiceNumber);
    CREATE INDEX IF NOT EXISTS idx_invoices_timestamp ON invoices(timestamp);
    CREATE INDEX IF NOT EXISTS idx_invoices_seller ON invoices(sellerName);
    CREATE INDEX IF NOT EXISTS idx_invoices_closedDay ON invoices(closedDayId);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoiceId);
    CREATE INDEX IF NOT EXISTS idx_deleted_invoices_number ON deleted_invoices(invoiceNumber);
    CREATE INDEX IF NOT EXISTS idx_deleted_invoice_items_invoice ON deleted_invoice_items(invoiceId);
    CREATE INDEX IF NOT EXISTS idx_expenses_timestamp ON expenses(timestamp);
    CREATE INDEX IF NOT EXISTS idx_expenses_closedDay ON expenses(closedDayId);
  `);

  applySchemaMigrations();
  getOrCreateDeviceId();
  initCountersIfNeeded();
}

/**
 * Applies schema migrations safely without dropping any tables.
 */
function applySchemaMigrations() {
  if (!db) return;
  try {
    const row = db.prepare("SELECT MAX(version) as currentVer FROM schema_migrations").get();
    const currentVer = (row && row.currentVer) || 0;

    if (currentVer < 1) {
      try { db.exec("ALTER TABLE invoices ADD COLUMN subtotal REAL DEFAULT 0;"); } catch (e) {}
      try { db.exec("ALTER TABLE invoices ADD COLUMN discount REAL DEFAULT 0;"); } catch (e) {}
      try { db.exec("ALTER TABLE closed_days ADD COLUMN totalExpenses REAL DEFAULT 0;"); } catch (e) {}
      try { db.exec("ALTER TABLE closed_days ADD COLUMN netSales REAL DEFAULT 0;"); } catch (e) {}
      try { db.exec("ALTER TABLE archived_sales ADD COLUMN itemsSold INTEGER DEFAULT 0;"); } catch (e) {}
      db.prepare("INSERT OR REPLACE INTO schema_migrations (version, appliedAt) VALUES (1, ?)").run(Date.now());
    }

    if (currentVer < 2) {
      try { db.exec("ALTER TABLE deleted_invoices ADD COLUMN subtotal REAL DEFAULT 0;"); } catch (e) {}
      try { db.exec("ALTER TABLE deleted_invoices ADD COLUMN discount REAL DEFAULT 0;"); } catch (e) {}
      db.prepare("INSERT OR REPLACE INTO schema_migrations (version, appliedAt) VALUES (2, ?)").run(Date.now());
    }

    if (currentVer < 3) {
      try { db.exec("ALTER TABLE closed_days ADD COLUMN totalDiscounts REAL DEFAULT 0;"); } catch (e) {}
      try { db.exec("ALTER TABLE closed_days ADD COLUMN totalItemsSold INTEGER DEFAULT 0;"); } catch (e) {}
      try { db.exec("ALTER TABLE closed_days ADD COLUMN discountedInvoicesCount INTEGER DEFAULT 0;"); } catch (e) {}
      try { db.exec("ALTER TABLE closed_days ADD COLUMN paymentBreakdown TEXT DEFAULT '{}';"); } catch (e) {}
      try { db.exec("ALTER TABLE closed_days ADD COLUMN employeeRankings TEXT DEFAULT '[]';"); } catch (e) {}
      db.prepare("INSERT OR REPLACE INTO schema_migrations (version, appliedAt) VALUES (3, ?)").run(Date.now());
    }

    if (currentVer < 4) {
      try { db.exec("ALTER TABLE invoices ADD COLUMN customerPhone TEXT DEFAULT '';"); } catch (e) {}
      try { db.exec("ALTER TABLE invoices ADD COLUMN splitPayments TEXT DEFAULT '[]';"); } catch (e) {}
      try { db.exec("ALTER TABLE deleted_invoices ADD COLUMN customerPhone TEXT DEFAULT '';"); } catch (e) {}
      try { db.exec("ALTER TABLE deleted_invoices ADD COLUMN splitPayments TEXT DEFAULT '[]';"); } catch (e) {}
      db.prepare("INSERT OR REPLACE INTO schema_migrations (version, appliedAt) VALUES (4, ?)").run(Date.now());
    }

    if (currentVer < 5) {
      try { db.exec("ALTER TABLE products ADD COLUMN isIncomplete INTEGER DEFAULT 0;"); } catch (e) {}
      db.prepare("INSERT OR REPLACE INTO schema_migrations (version, appliedAt) VALUES (5, ?)").run(Date.now());
    }

    if (currentVer < 6) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sync_operations (
          operationId TEXT PRIMARY KEY,
          deviceId TEXT NOT NULL,
          entityTable TEXT NOT NULL,
          entityId TEXT NOT NULL,
          operationType TEXT NOT NULL CHECK (operationType IN ('create', 'update', 'delete')),
          payload TEXT NOT NULL DEFAULT '{}',
          createdAt INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'synced', 'failed')),
          attemptCount INTEGER NOT NULL DEFAULT 0,
          lastAttemptAt INTEGER,
          lastError TEXT,
          syncedAt INTEGER
        );

        CREATE TABLE IF NOT EXISTS sync_tombstones (
          tombstoneId TEXT PRIMARY KEY,
          deviceId TEXT NOT NULL,
          entityTable TEXT NOT NULL,
          entityId TEXT NOT NULL,
          operationId TEXT,
          deletedAt INTEGER NOT NULL,
          UNIQUE (entityTable, entityId)
        );

        CREATE TABLE IF NOT EXISTS sync_state (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updatedAt INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_sync_operations_pending
          ON sync_operations(status, createdAt);
        CREATE INDEX IF NOT EXISTS idx_sync_operations_entity
          ON sync_operations(entityTable, entityId, createdAt);
        CREATE INDEX IF NOT EXISTS idx_sync_operations_device
          ON sync_operations(deviceId, createdAt);
        CREATE INDEX IF NOT EXISTS idx_sync_tombstones_entity
          ON sync_tombstones(entityTable, entityId);
        CREATE INDEX IF NOT EXISTS idx_sync_tombstones_deletedAt
          ON sync_tombstones(deletedAt);
      `);
      db.prepare("INSERT OR REPLACE INTO schema_migrations (version, appliedAt) VALUES (6, ?)").run(Date.now());
    }

    if (currentVer < 7) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS sync_applied_operations (
          operationId TEXT PRIMARY KEY,
          sourceDeviceId TEXT NOT NULL,
          entityTable TEXT NOT NULL,
          entityId TEXT NOT NULL,
          operationType TEXT NOT NULL CHECK (operationType IN ('create', 'update', 'delete')),
          appliedAt INTEGER NOT NULL,
          result TEXT NOT NULL DEFAULT 'applied'
        );

        CREATE INDEX IF NOT EXISTS idx_sync_applied_entity
          ON sync_applied_operations(entityTable, entityId, appliedAt);
        CREATE INDEX IF NOT EXISTS idx_sync_applied_source
          ON sync_applied_operations(sourceDeviceId, appliedAt);
      `);
      db.prepare("INSERT OR REPLACE INTO schema_migrations (version, appliedAt) VALUES (7, ?)").run(Date.now());
    }
  } catch (err) {
    console.error("[SQLite Migration Error]", err);
  }
}

function getOrCreateDeviceId() {
  if (!db) throw new Error("Database not initialized");

  let deviceId = "";
  try {
    deviceId = fs.readFileSync(deviceIdPath, "utf8").trim();
  } catch (e) {}

  if (!deviceId) {
    const existing = db.prepare("SELECT value FROM sync_state WHERE key = 'device_id'").get();
    deviceId = existing && existing.value ? existing.value : crypto.randomUUID();
    fs.writeFileSync(deviceIdPath, deviceId, { encoding: "utf8", mode: 0o600 });
  }

  db.prepare(`
    INSERT INTO sync_state (key, value, updatedAt)
    VALUES ('device_id', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
  `).run(deviceId, Date.now());
  return deviceId;
}

function runWriteTransaction(work) {
  if (db.inTransaction) return work();
  return db.transaction(work)();
}

function insertSyncOperation(operation) {
  if (!operation || !operation.entityTable || !operation.entityId) {
    throw new Error("Sync operation entity information is required");
  }
  if (!["create", "update", "delete"].includes(operation.operationType)) {
    throw new Error("Invalid sync operation type");
  }

  const operationId = operation.operationId || crypto.randomUUID();
  const createdAt = operation.createdAt || Date.now();
  const payload = JSON.stringify(operation.payload === undefined ? null : operation.payload);

  db.prepare(`
    INSERT INTO sync_operations (
      operationId, deviceId, entityTable, entityId, operationType,
      payload, createdAt, status, attemptCount, lastAttemptAt, lastError, syncedAt
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, NULL, NULL)
  `).run(
    operationId,
    getOrCreateDeviceId(),
    operation.entityTable,
    operation.entityId,
    operation.operationType,
    payload,
    createdAt
  );

  return operationId;
}

function insertSyncTombstone(tombstone) {
  if (!tombstone || !tombstone.entityTable || !tombstone.entityId) {
    throw new Error("Tombstone entity information is required");
  }

  const tombstoneId = tombstone.tombstoneId || crypto.randomUUID();
  const deletedAt = tombstone.deletedAt || Date.now();
  db.prepare(`
    INSERT INTO sync_tombstones (
      tombstoneId, deviceId, entityTable, entityId, operationId, deletedAt
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(entityTable, entityId) DO UPDATE SET
      tombstoneId = excluded.tombstoneId,
      deviceId = excluded.deviceId,
      operationId = excluded.operationId,
      deletedAt = excluded.deletedAt
  `).run(
    tombstoneId,
    getOrCreateDeviceId(),
    tombstone.entityTable,
    tombstone.entityId,
    tombstone.operationId || null,
    deletedAt
  );

  return tombstoneId;
}

function clearSyncTombstone(entityTable, entityId) {
  db.prepare("DELETE FROM sync_tombstones WHERE entityTable = ? AND entityId = ?").run(entityTable, entityId);
}

function buildInventoryEffects(items, direction) {
  const quantities = new Map();
  for (const item of items || []) {
    const productId = item.productId;
    const quantity = Number(item.quantity) || 0;
    quantities.set(productId, (quantities.get(productId) || 0) + (quantity * direction));
  }
  return Array.from(quantities.entries())
    .filter(([, quantityDelta]) => quantityDelta !== 0)
    .map(([productId, quantityDelta]) => ({ productId, quantityDelta }));
}

function buildInventoryAdjustmentEffects(previousItems, nextItems) {
  const effects = new Map();
  for (const effect of buildInventoryEffects(previousItems, 1)) {
    effects.set(effect.productId, (effects.get(effect.productId) || 0) + effect.quantityDelta);
  }
  for (const effect of buildInventoryEffects(nextItems, -1)) {
    effects.set(effect.productId, (effects.get(effect.productId) || 0) + effect.quantityDelta);
  }
  return Array.from(effects.entries())
    .filter(([, quantityDelta]) => quantityDelta !== 0)
    .map(([productId, quantityDelta]) => ({ productId, quantityDelta }));
}

function validateRemoteEvent(event) {
  if (!event || typeof event !== "object") throw new Error("Invalid sync event");
  const required = ["protocolVersion", "messageType", "operationId", "deviceId", "entityTable", "entityId", "operationType", "createdAt"];
  for (const key of required) {
    if (event[key] === undefined || event[key] === null || event[key] === "") {
      throw new Error(`Sync event field is required: ${key}`);
    }
  }
  if (event.protocolVersion !== 1) throw new Error("Unsupported sync protocol version");
  if (event.messageType !== "mutation") throw new Error("Unsupported sync message type");
  if (!["create", "update", "delete"].includes(event.operationType)) throw new Error("Invalid sync operation type");
  if (typeof event.payload !== "object" || event.payload === null) throw new Error("Invalid sync event payload");
  return event;
}

function getRemotePayloadRecord(event, key) {
  return event.payload[key] || (key === "invoice" ? event.payload.createdInvoice : null) || event.payload;
}

function applyInventoryEffects(effects) {
  for (const effect of effects || []) {
    if (!effect || !effect.productId || !Number.isFinite(Number(effect.quantityDelta))) continue;
    db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?").run(
      Number(effect.quantityDelta),
      effect.productId
    );
  }
}

function insertAppliedOperation(event, result) {
  db.prepare(`
    INSERT INTO sync_applied_operations (
      operationId, sourceDeviceId, entityTable, entityId, operationType, appliedAt, result
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.operationId,
    event.deviceId,
    event.entityTable,
    event.entityId,
    event.operationType,
    Date.now(),
    result
  );
}

function hasBlockingTombstone(event) {
  if (event.operationType === "delete") return false;
  const tombstone = db.prepare(`
    SELECT deletedAt FROM sync_tombstones
    WHERE entityTable = ? AND entityId = ?
  `).get(event.entityTable, event.entityId);
  if (!tombstone) return false;
  if (Number(event.createdAt) > Number(tombstone.deletedAt)) {
    clearSyncTombstone(event.entityTable, event.entityId);
    return false;
  }
  return true;
}

function applyRemoteProduct(event) {
  const product = getRemotePayloadRecord(event, "product");
  if (!product || !product.id) throw new Error("Remote product payload is invalid");
  if (event.operationType === "delete") {
    db.prepare("DELETE FROM products WHERE id = ?").run(product.id);
    return "applied";
  }

  const existing = productsApi.getById(product.id);
  db.prepare(`
    INSERT INTO products (
      id, name, price, basePrice, barcode, stock, minStockAlert, image, category, createdAt, isIncomplete
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      price = excluded.price,
      basePrice = excluded.basePrice,
      barcode = excluded.barcode,
      minStockAlert = excluded.minStockAlert,
      image = excluded.image,
      category = excluded.category,
      isIncomplete = excluded.isIncomplete
  `).run(
    product.id,
    product.name || "",
    Number(product.price) || 0,
    Number(product.basePrice) || 0,
    product.barcode || "",
    product.minStockAlert ?? 3,
    product.image || "",
    product.category || "",
    product.createdAt || Date.now(),
    product.isIncomplete ? 1 : 0
  );

  const adjustment = event.payload.stockAdjustment;
  if (adjustment && Number.isFinite(Number(adjustment.quantityDelta))) {
    applyInventoryEffects([{ productId: product.id, quantityDelta: Number(adjustment.quantityDelta) }]);
  } else if (!existing && Number.isFinite(Number(product.stock))) {
    applyInventoryEffects([{ productId: product.id, quantityDelta: Number(product.stock) }]);
  }
  return "applied";
}

function insertRemoteInvoice(invoice) {
  db.prepare(`
    INSERT OR IGNORE INTO invoices (
      id, invoiceNumber, timestamp, formattedDate, formattedTime, total, subtotal, discount,
      paymentMethod, sellerName, customerPhone, splitPayments, closedDayId,
      isDiscountedBelowBase, discountAlerts
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    invoice.id,
    invoice.invoiceNumber,
    invoice.timestamp || Date.now(),
    invoice.formattedDate || "",
    invoice.formattedTime || "",
    Number(invoice.total) || 0,
    Number(invoice.subtotal) || Number(invoice.total) || 0,
    Number(invoice.discount) || 0,
    invoice.paymentMethod || "كاش",
    invoice.sellerName || "",
    invoice.customerPhone || "",
    JSON.stringify(invoice.splitPayments || []),
    invoice.closedDayId || null,
    invoice.isDiscountedBelowBase ? 1 : 0,
    JSON.stringify(invoice.discountAlerts || [])
  );
  const insertItem = db.prepare(`
    INSERT OR IGNORE INTO invoice_items (id, invoiceId, productId, name, price, quantity, basePrice)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const item of invoice.items || []) {
    insertItem.run(
      `${invoice.id}-remote-${item.productId}-${crypto.randomUUID()}`,
      invoice.id,
      item.productId,
      item.name || "",
      Number(item.price) || 0,
      Number(item.quantity) || 1,
      Number(item.basePrice) || 0
    );
  }
}

function applyRemoteInvoice(event) {
  const invoice = getRemotePayloadRecord(event, "invoice");
  if (!invoice || !invoice.id) throw new Error("Remote invoice payload is invalid");
  if (event.operationType === "delete") {
    const deletedInvoice = event.payload.deletedInvoice || invoice;
    const existing = invoicesApi.getById(invoice.id);
    if (existing) {
      const now = Date.now();
      db.prepare(`
        INSERT OR REPLACE INTO deleted_invoices (
          id, invoiceNumber, timestamp, formattedDate, formattedTime, total, subtotal, discount,
          paymentMethod, sellerName, customerPhone, splitPayments, closedDayId,
          isDiscountedBelowBase, discountAlerts, deletedAt, deletedDateStr, deletedTimeStr
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        deletedInvoice.id, deletedInvoice.invoiceNumber, deletedInvoice.timestamp || now,
        deletedInvoice.formattedDate || "", deletedInvoice.formattedTime || "",
        Number(deletedInvoice.total) || 0, Number(deletedInvoice.subtotal) || Number(deletedInvoice.total) || 0,
        Number(deletedInvoice.discount) || 0, deletedInvoice.paymentMethod || "كاش",
        deletedInvoice.sellerName || "", deletedInvoice.customerPhone || "",
        JSON.stringify(deletedInvoice.splitPayments || []), deletedInvoice.closedDayId || null,
        deletedInvoice.isDiscountedBelowBase ? 1 : 0, JSON.stringify(deletedInvoice.discountAlerts || []),
        now, new Date(now).toLocaleDateString("ar-EG"),
        new Date(now).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })
      );
      const insertItem = db.prepare(`
        INSERT OR IGNORE INTO deleted_invoice_items (id, invoiceId, productId, name, price, quantity, basePrice)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of deletedInvoice.items || []) {
        insertItem.run(
          `del-${deletedInvoice.id}-remote-${item.productId}-${crypto.randomUUID()}`,
          deletedInvoice.id, item.productId, item.name || "", Number(item.price) || 0,
          Number(item.quantity) || 1, Number(item.basePrice) || 0
        );
      }
      db.prepare("DELETE FROM invoices WHERE id = ?").run(invoice.id);
      applyInventoryEffects(event.payload.inventoryEffects || buildInventoryEffects(invoice.items, 1));
    }
    return "applied";
  }

  if (event.operationType === "create") {
    const exists = db.prepare("SELECT id FROM invoices WHERE id = ?").get(invoice.id);
    if (!exists) {
      insertRemoteInvoice(invoice);
      applyInventoryEffects(event.payload.inventoryEffects || buildInventoryEffects(invoice.items, -1));
    }
    return "applied";
  }

  const existing = invoicesApi.getById(invoice.id);
  db.prepare(`
    UPDATE invoices SET sellerName = ?, paymentMethod = ?, discount = ?, subtotal = ?, total = ?,
      customerPhone = ?, splitPayments = ?, isDiscountedBelowBase = ?, discountAlerts = ?
    WHERE id = ?
  `).run(
    invoice.sellerName || "", invoice.paymentMethod || "كاش", Number(invoice.discount) || 0,
    Number(invoice.subtotal) || Number(invoice.total) || 0, Number(invoice.total) || 0,
    invoice.customerPhone || "", JSON.stringify(invoice.splitPayments || []),
    invoice.isDiscountedBelowBase ? 1 : 0, JSON.stringify(invoice.discountAlerts || []), invoice.id
  );
  if (invoice.items && Array.isArray(invoice.items)) {
    db.prepare("DELETE FROM invoice_items WHERE invoiceId = ?").run(invoice.id);
    const insertItem = db.prepare(`
      INSERT INTO invoice_items (id, invoiceId, productId, name, price, quantity, basePrice)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const item of invoice.items) {
      insertItem.run(
        `${invoice.id}-remote-${item.productId}-${crypto.randomUUID()}`,
        invoice.id, item.productId, item.name || "", Number(item.price) || 0,
        Number(item.quantity) || 1, Number(item.basePrice) || 0
      );
    }
  }
  if (existing) applyInventoryEffects(event.payload.inventoryEffects || []);
  return "applied";
}

function applyRemoteMutation(event) {
  switch (event.entityTable) {
    case "products": return applyRemoteProduct(event);
    case "inventory": applyInventoryEffects(event.payload.inventoryEffects || [event.payload]); return "applied";
    case "invoices": return applyRemoteInvoice(event);
    case "employees": {
      const employee = event.payload.employee || event.payload;
      if (event.operationType === "delete") {
        db.prepare("DELETE FROM employees WHERE id = ?").run(employee.id);
        db.prepare("UPDATE invoices SET sellerName = 'مبيعات عامة' WHERE sellerName = ?").run(employee.name || "");
      } else {
        const employeeId = employee.id || event.entityId;
        const employeeName = employee.name || event.payload.name;
        db.prepare("INSERT INTO employees (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name").run(employeeId, employeeName);
        if (event.payload.previousName && employeeName) {
          db.prepare("UPDATE invoices SET sellerName = ? WHERE sellerName = ?").run(employeeName, event.payload.previousName);
          db.prepare("UPDATE deleted_invoices SET sellerName = ? WHERE sellerName = ?").run(employeeName, event.payload.previousName);
          db.prepare("UPDATE expenses SET sellerName = ? WHERE sellerName = ?").run(employeeName, event.payload.previousName);
          db.prepare("UPDATE archived_sales SET employeeName = ? WHERE employeeName = ?").run(employeeName, event.payload.previousName);
        }
      }
      return "applied";
    }
    case "categories": {
      const category = event.payload.category || event.payload;
      if (event.operationType === "delete") {
        db.prepare("DELETE FROM categories WHERE id = ?").run(category.id);
        db.prepare("UPDATE products SET category = 'بدون تصنيف' WHERE category = ?").run(category.name || "");
      }
      else db.prepare("INSERT INTO categories (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name").run(category.id, category.name);
      return "applied";
    }
    case "expenses": {
      const expense = event.payload.expense || event.payload;
      if (event.operationType === "delete") db.prepare("DELETE FROM expenses WHERE id = ?").run(expense.id);
      else db.prepare(`
        INSERT INTO expenses (id, title, amount, timestamp, formattedDate, formattedTime, notes, sellerName, closedDayId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET title = excluded.title, amount = excluded.amount,
          timestamp = excluded.timestamp, formattedDate = excluded.formattedDate, formattedTime = excluded.formattedTime,
          notes = excluded.notes, sellerName = excluded.sellerName, closedDayId = excluded.closedDayId
      `).run(expense.id, expense.title || "", Number(expense.amount) || 0, expense.timestamp || Date.now(), expense.formattedDate || "", expense.formattedTime || "", expense.notes || "", expense.sellerName || "", expense.closedDayId || null);
      return "applied";
    }
    case "settings":
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(event.payload.key || event.entityId, String(event.payload.value));
      return "applied";
    case "archived_sales": {
      const archive = event.payload.archivedSale || event.payload;
      db.prepare(`INSERT OR REPLACE INTO archived_sales (id, employeeName, dateStr, totalSales, invoiceCount, itemsSold, deletedAt, invoicesCopied) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(archive.id, archive.employeeName || "", archive.dateStr || "", Number(archive.totalSales) || 0, Number(archive.invoiceCount) || 0, Number(archive.itemsSold) || 0, archive.deletedAt || Date.now(), JSON.stringify(archive.invoicesCopied || []));
      return "applied";
    }
    case "closed_days": {
      const day = event.payload.closedDay || event.payload;
      db.prepare(`INSERT OR REPLACE INTO closed_days (id, timestamp, formattedDate, formattedTime, totalSales, totalExpenses, netSales, invoiceCount, invoiceIds, totalDiscounts, totalItemsSold, discountedInvoicesCount, paymentBreakdown, employeeRankings) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(day.id, day.timestamp || Date.now(), day.formattedDate || "", day.formattedTime || "", Number(day.totalSales) || 0, Number(day.totalExpenses) || 0, Number(day.netSales) || 0, Number(day.invoiceCount) || 0, JSON.stringify(day.invoiceIds || []), Number(day.totalDiscounts) || 0, Number(day.totalItemsSold) || 0, Number(day.discountedInvoicesCount) || 0, JSON.stringify(day.paymentBreakdown || {}), JSON.stringify(day.employeeRankings || []));
      return "applied";
    }
    default: throw new Error(`Unsupported remote entity table: ${event.entityTable}`);
  }
}

function applyRemoteOperation(event) {
  if (!db) throw new Error("Database not initialized");
  validateRemoteEvent(event);
  return db.transaction(() => {
    const alreadyApplied = db.prepare("SELECT result FROM sync_applied_operations WHERE operationId = ?").get(event.operationId);
    if (alreadyApplied) return { applied: false, duplicate: true, result: alreadyApplied.result };
    if (hasBlockingTombstone(event)) {
      insertAppliedOperation(event, "ignored_tombstone");
      return { applied: false, duplicate: false, result: "ignored_tombstone" };
    }
    const result = applyRemoteMutation(event);
    if (event.operationType === "delete") {
      insertSyncTombstone({ entityTable: event.entityTable, entityId: event.entityId, operationId: event.operationId, deletedAt: event.createdAt });
    } else {
      clearSyncTombstone(event.entityTable, event.entityId);
    }
    insertAppliedOperation(event, result);
    return { applied: true, duplicate: false, result };
  })();
}

const syncApi = {
  getDeviceId: () => getOrCreateDeviceId(),

  applyRemoteOperation: (event) => applyRemoteOperation(event),

  createOperation: (operation) => {
    if (!db) throw new Error("Database not initialized");
    const operationId = insertSyncOperation(operation);

    return syncApi.getOperation(operationId);
  },

  getOperation: (operationId) => {
    if (!db) throw new Error("Database not initialized");
    const row = db.prepare("SELECT * FROM sync_operations WHERE operationId = ?").get(operationId);
    if (!row) return null;
    return {
      ...row,
      payload: JSON.parse(row.payload || "null")
    };
  },

  getPendingOperations: (limit = 100) => {
    if (!db) throw new Error("Database not initialized");
    const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 1000));
    const rows = db.prepare(`
      SELECT * FROM sync_operations
      WHERE status IN ('pending', 'failed')
      ORDER BY createdAt ASC
      LIMIT ?
    `).all(safeLimit);
    return rows.map((row) => ({
      ...row,
      payload: JSON.parse(row.payload || "null")
    }));
  },

  markOperationSynced: (operationId) => {
    if (!db) throw new Error("Database not initialized");
    const result = db.prepare(`
      UPDATE sync_operations
      SET status = 'synced', syncedAt = ?, lastError = NULL
      WHERE operationId = ?
    `).run(Date.now(), operationId);
    return result.changes > 0;
  },

  markOperationFailed: (operationId, errorMessage) => {
    if (!db) throw new Error("Database not initialized");
    const result = db.prepare(`
      UPDATE sync_operations
      SET status = 'failed', attemptCount = attemptCount + 1,
          lastAttemptAt = ?, lastError = ?
      WHERE operationId = ?
    `).run(Date.now(), String(errorMessage || "Unknown sync error"), operationId);
    return result.changes > 0;
  },

  recordTombstone: (tombstone) => {
    if (!db) throw new Error("Database not initialized");
    if (!tombstone || !tombstone.entityTable || !tombstone.entityId) {
      throw new Error("Tombstone entity information is required");
    }

    insertSyncTombstone(tombstone);

    return syncApi.getTombstone(tombstone.entityTable, tombstone.entityId);
  },

  getTombstone: (entityTable, entityId) => {
    if (!db) throw new Error("Database not initialized");
    return db.prepare(
      "SELECT * FROM sync_tombstones WHERE entityTable = ? AND entityId = ?"
    ).get(entityTable, entityId) || null;
  },

  getTombstones: (limit = 1000) => {
    if (!db) throw new Error("Database not initialized");
    const safeLimit = Math.max(1, Math.min(Number(limit) || 1000, 5000));
    return db.prepare(
      "SELECT * FROM sync_tombstones ORDER BY deletedAt ASC LIMIT ?"
    ).all(safeLimit);
  },

  getState: (key) => {
    if (!db) throw new Error("Database not initialized");
    if (key) {
      const row = db.prepare("SELECT value FROM sync_state WHERE key = ?").get(key);
      return row ? row.value : null;
    }
    return db.prepare("SELECT key, value, updatedAt FROM sync_state ORDER BY key ASC").all();
  },

  setState: (key, value) => {
    if (!db) throw new Error("Database not initialized");
    if (!key) throw new Error("Sync state key is required");
    db.prepare(`
      INSERT INTO sync_state (key, value, updatedAt)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
    `).run(key, String(value), Date.now());
    return true;
  }
};

/**
 * Ensures counter for invoice sequence exists and is in sync with max invoice number.
 */
function initCountersIfNeeded() {
  if (!db) return;
  const row = db.prepare("SELECT value FROM counters WHERE key = 'invoice_seq'").get();
  if (!row) {
    let maxSeq = 0;
    const invoices = db.prepare("SELECT invoiceNumber FROM invoices").all();
    for (const inv of invoices) {
      if (inv.invoiceNumber) {
        const match = inv.invoiceNumber.match(/ANTO-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      }
    }
    const delInvoices = db.prepare("SELECT invoiceNumber FROM deleted_invoices").all();
    for (const inv of delInvoices) {
      if (inv.invoiceNumber) {
        const match = inv.invoiceNumber.match(/ANTO-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxSeq) maxSeq = num;
        }
      }
    }
    db.prepare("INSERT INTO counters (key, value) VALUES ('invoice_seq', ?)").run(maxSeq);
  }
}

/**
 * Generates next sequential invoice number inside transaction (e.g. ANTO-0001).
 * Guaranteed non-duplicating and monotonically increasing.
 */
function generateNextInvoiceNumber() {
  let row = db.prepare("SELECT value FROM counters WHERE key = 'invoice_seq'").get();
  let currentSeq = row ? row.value : 0;

  if (!row) {
    const invoices = db.prepare("SELECT invoiceNumber FROM invoices").all();
    for (const inv of invoices) {
      if (inv.invoiceNumber) {
        const match = inv.invoiceNumber.match(/ANTO-(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > currentSeq) currentSeq = num;
        }
      }
    }
  }

  const nextSeq = currentSeq + 1;
  db.prepare("INSERT INTO counters (key, value) VALUES ('invoice_seq', ?) ON CONFLICT(key) DO UPDATE SET value = ?").run(nextSeq, nextSeq);

  return `ANTO-${String(nextSeq).padStart(4, "0")}`;
}

function getNextInvoiceNumber() {
  if (!db) throw new Error("Database not initialized");
  const tx = db.transaction(() => generateNextInvoiceNumber());
  return tx();
}

/**
 * Image Management: Save Base64 or copy local file into appData/data/images
 */
function saveProductImage(productId, imageStr) {
  if (!imageStr) return "";
  if (imageStr.startsWith("images/")) return imageStr;

  try {
    if (imageStr.startsWith("data:image")) {
      const match = imageStr.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (match) {
        const ext = match[1] === "jpeg" ? "jpg" : match[1];
        const base64Data = match[2];
        const filename = `product-${productId}-${Date.now()}.${ext}`;
        const filePath = path.join(imagesDir, filename);
        fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
        return `images/${filename}`;
      }
    } else if (fs.existsSync(imageStr)) {
      const ext = path.extname(imageStr) || ".jpg";
      const filename = `product-${productId}-${Date.now()}${ext}`;
      const destPath = path.join(imagesDir, filename);
      fs.copyFileSync(imageStr, destPath);
      return `images/${filename}`;
    }
  } catch (err) {
    console.error("Failed to save product image file:", err);
  }
  return imageStr;
}

function deleteProductImage(imagePath) {
  if (!imagePath || !imagePath.startsWith("images/")) return;
  try {
    const filename = path.basename(imagePath);
    const fullPath = path.join(imagesDir, filename);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.error("Failed to delete product image file:", err);
  }
}

// -------------------------------------------------------------
// Products API
// -------------------------------------------------------------
const productsApi = {
  getAll: () => {
    if (!db) throw new Error("Database not initialized");
    const prods = db.prepare("SELECT * FROM products ORDER BY name ASC").all();
    return prods.map(p => ({
      ...p,
      isIncomplete: Boolean(p.isIncomplete)
    }));
  },
  getById: (id) => {
    if (!db) throw new Error("Database not initialized");
    const p = db.prepare("SELECT * FROM products WHERE id = ?").get(id);
    if (!p) return null;
    return {
      ...p,
      isIncomplete: Boolean(p.isIncomplete)
    };
  },
  create: (product) => {
    if (!db) throw new Error("Database not initialized");
    if (!product || !product.id || !product.name) {
      throw new Error("بيانات المنتج غير مكتملة (المعرف والاسم مطلوبان)");
    }
    return runWriteTransaction(() => {
      const existing = productsApi.getById(product.id);
      const savedImagePath = saveProductImage(product.id, product.image);
      const prodToSave = { ...product, image: savedImagePath };

      const stmt = db.prepare(`
        INSERT INTO products (id, name, price, basePrice, barcode, stock, minStockAlert, image, category, createdAt, isIncomplete)
        VALUES (@id, @name, @price, @basePrice, @barcode, @stock, @minStockAlert, @image, @category, @createdAt, @isIncomplete)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          price = excluded.price,
          basePrice = excluded.basePrice,
          barcode = excluded.barcode,
          stock = excluded.stock,
          minStockAlert = excluded.minStockAlert,
          image = excluded.image,
          category = excluded.category,
          createdAt = excluded.createdAt,
          isIncomplete = excluded.isIncomplete
      `);
      stmt.run({
        id: prodToSave.id,
        name: prodToSave.name.trim(),
        price: Number(prodToSave.price) || 0,
        basePrice: Number(prodToSave.basePrice) || 0,
        barcode: (prodToSave.barcode || "").trim(),
        stock: Number(prodToSave.stock) || 0,
        minStockAlert: prodToSave.minStockAlert ?? 3,
        image: prodToSave.image || "",
        category: (prodToSave.category || "").trim(),
        createdAt: prodToSave.createdAt || Date.now(),
        isIncomplete: prodToSave.isIncomplete ? 1 : 0
      });
      const savedProduct = productsApi.getById(product.id);
      clearSyncTombstone("products", product.id);
      insertSyncOperation({
        entityTable: "products",
        entityId: product.id,
        operationType: "create",
        payload: {
          product: savedProduct,
          upsertedExisting: Boolean(existing),
          stockAdjustment: {
            previousStock: existing ? existing.stock : null,
            newStock: savedProduct.stock,
            quantityDelta: savedProduct.stock - (existing ? existing.stock : 0)
          }
        }
      });
      return savedProduct;
    });
  },
  update: (product) => {
    if (!db) throw new Error("Database not initialized");
    return runWriteTransaction(() => {
      const existing = productsApi.getById(product.id);
      if (existing && existing.image && existing.image !== product.image && existing.image.startsWith("images/")) {
        deleteProductImage(existing.image);
      }
      const savedImagePath = saveProductImage(product.id, product.image);
      const prodToSave = { ...product, image: savedImagePath };

      const stmt = db.prepare(`
        UPDATE products SET
          name = @name,
          price = @price,
          basePrice = @basePrice,
          barcode = @barcode,
          stock = @stock,
          minStockAlert = @minStockAlert,
          image = @image,
          category = @category,
          isIncomplete = @isIncomplete
        WHERE id = @id
      `);
      const result = stmt.run({
        id: prodToSave.id,
        name: prodToSave.name.trim(),
        price: Number(prodToSave.price) || 0,
        basePrice: Number(prodToSave.basePrice) || 0,
        barcode: (prodToSave.barcode || "").trim(),
        stock: Number(prodToSave.stock) || 0,
        minStockAlert: prodToSave.minStockAlert ?? 3,
        image: prodToSave.image || "",
        category: (prodToSave.category || "").trim(),
        isIncomplete: prodToSave.isIncomplete ? 1 : 0
      });
      const savedProduct = productsApi.getById(product.id);
      if (result.changes > 0) {
        clearSyncTombstone("products", product.id);
        insertSyncOperation({
          entityTable: "products",
          entityId: product.id,
          operationType: "update",
          payload: {
            product: savedProduct,
            stockAdjustment: {
              previousStock: existing ? existing.stock : null,
              newStock: savedProduct ? savedProduct.stock : null,
              quantityDelta: savedProduct && existing ? savedProduct.stock - existing.stock : null
            }
          }
        });
      }
      return savedProduct;
    });
  },
  updateStock: (id, stock) => {
    if (!db) throw new Error("Database not initialized");
    return runWriteTransaction(() => {
      const existing = productsApi.getById(id);
      const newStock = Number(stock) || 0;
      const result = db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, id);
      const updated = productsApi.getById(id);
      if (result.changes > 0 && updated) {
        insertSyncOperation({
          entityTable: "inventory",
          entityId: id,
          operationType: "update",
          payload: {
            productId: id,
            reason: "manual_stock_adjustment",
            previousStock: existing ? existing.stock : null,
            newStock: updated.stock,
            quantityDelta: existing ? updated.stock - existing.stock : null
          }
        });
      }
      return updated;
    });
  },
  delete: (id) => {
    if (!db) throw new Error("Database not initialized");
    return runWriteTransaction(() => {
      const existing = productsApi.getById(id);
      if (existing && existing.image) {
        deleteProductImage(existing.image);
      }
      const res = db.prepare("DELETE FROM products WHERE id = ?").run(id);
      if (res.changes > 0) {
        const operationId = insertSyncOperation({
          entityTable: "products",
          entityId: id,
          operationType: "delete",
          payload: { product: existing }
        });
        insertSyncTombstone({ entityTable: "products", entityId: id, operationId });
      }
      return res.changes > 0;
    });
  }
};

// -------------------------------------------------------------
// Invoices API (Atomic Transaction for Checkout & Deletion)
// -------------------------------------------------------------
const invoicesApi = {
  getAll: (options = {}) => {
    if (!db) throw new Error("Database not initialized");
    let sql = "SELECT * FROM invoices";
    const params = [];
    const whereClauses = [];

    if (options.seller && options.seller !== "all") {
      whereClauses.push("sellerName = ?");
      params.push(options.seller.trim());
    }

    if (options.search) {
      whereClauses.push("(invoiceNumber LIKE ? OR sellerName LIKE ? OR formattedDate LIKE ?)");
      const term = `%${options.search}%`;
      params.push(term, term, term);
    }

    if (options.date) {
      whereClauses.push("formattedDate LIKE ?");
      params.push(`%${options.date}%`);
    }

    if (options.closedDayId) {
      if (options.closedDayId === "active") {
        whereClauses.push("(closedDayId IS NULL OR closedDayId = '')");
      } else if (options.closedDayId === "closed") {
        whereClauses.push("(closedDayId IS NOT NULL AND closedDayId != '')");
      } else {
        whereClauses.push("closedDayId = ?");
        params.push(options.closedDayId);
      }
    }

    if (whereClauses.length > 0) {
      sql += " WHERE " + whereClauses.join(" AND ");
    }

    sql += " ORDER BY timestamp DESC";

    if (options.page && options.limit) {
      sql += " LIMIT ? OFFSET ?";
      params.push(options.limit, (options.page - 1) * options.limit);
    }

    const invoices = db.prepare(sql).all(...params);
    const stmtItems = db.prepare("SELECT * FROM invoice_items WHERE invoiceId = ?");

    return invoices.map((inv) => {
      const items = stmtItems.all(inv.id);
      let alerts = [];
      try {
        alerts = JSON.parse(inv.discountAlerts || "[]");
      } catch (e) {}
      let splits = [];
      try {
        splits = JSON.parse(inv.splitPayments || "[]");
      } catch (e) {}
      return {
        ...inv,
        customerPhone: inv.customerPhone || undefined,
        splitPayments: Array.isArray(splits) && splits.length > 0 ? splits : undefined,
        isDiscountedBelowBase: Boolean(inv.isDiscountedBelowBase),
        discountAlerts: alerts,
        items: items.map((it) => ({
          productId: it.productId,
          name: it.name,
          price: it.price,
          quantity: it.quantity,
          basePrice: it.basePrice || 0
        }))
      };
    });
  },

  getById: (id) => {
    if (!db) throw new Error("Database not initialized");
    const inv = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);
    if (!inv) return null;

    const items = db.prepare("SELECT * FROM invoice_items WHERE invoiceId = ?").all(id);
    let alerts = [];
    try {
      alerts = JSON.parse(inv.discountAlerts || "[]");
    } catch (e) {}
    let splits = [];
    try {
      splits = JSON.parse(inv.splitPayments || "[]");
    } catch (e) {}

    return {
      ...inv,
      customerPhone: inv.customerPhone || undefined,
      splitPayments: Array.isArray(splits) && splits.length > 0 ? splits : undefined,
      isDiscountedBelowBase: Boolean(inv.isDiscountedBelowBase),
      discountAlerts: alerts,
      items: items.map((it) => ({
        productId: it.productId,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        basePrice: it.basePrice || 0
      }))
    };
  },

  update: (invoice) => {
    if (!db) throw new Error("Database not initialized");
    if (!invoice || !invoice.id) throw new Error("بيانات الفاتورة غير صحيحة");

    const existing = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoice.id);
    if (!existing) throw new Error("الفاتورة غير موجودة في قاعدة البيانات");

    const updateTx = () => runWriteTransaction(() => {
      const newSellerName = (invoice.sellerName !== undefined ? invoice.sellerName : (existing.sellerName || "")).trim();
      const newPaymentMethod = invoice.paymentMethod !== undefined ? invoice.paymentMethod : existing.paymentMethod;
      const newDiscount = invoice.discount !== undefined ? Number(invoice.discount) : existing.discount;
      const newSubtotal = invoice.subtotal !== undefined ? Number(invoice.subtotal) : existing.subtotal;
      const newTotal = invoice.total !== undefined ? Number(invoice.total) : existing.total;
      const newCustomerPhone = invoice.customerPhone !== undefined ? invoice.customerPhone : (existing.customerPhone || "");
      const newSplitPayments = invoice.splitPayments !== undefined ? JSON.stringify(invoice.splitPayments) : (existing.splitPayments || "[]");
      const newDiscountBelowBase = invoice.isDiscountedBelowBase !== undefined ? (invoice.isDiscountedBelowBase ? 1 : 0) : existing.isDiscountedBelowBase;
      const newAlerts = invoice.discountAlerts !== undefined ? JSON.stringify(invoice.discountAlerts) : (existing.discountAlerts || "[]");
      let oldItems = [];
      let inventoryEffects = [];

      db.prepare(`
        UPDATE invoices
        SET sellerName = ?, paymentMethod = ?, discount = ?, subtotal = ?, total = ?, customerPhone = ?, splitPayments = ?, isDiscountedBelowBase = ?, discountAlerts = ?
        WHERE id = ?
      `).run(newSellerName, newPaymentMethod, newDiscount, newSubtotal, newTotal, newCustomerPhone, newSplitPayments, newDiscountBelowBase, newAlerts, invoice.id);

      // If items are provided in update, handle stock adjustment and re-insert items
      if (invoice.items && Array.isArray(invoice.items) && invoice.items.length > 0) {
        // 1. Restore previous stock for this invoice
        oldItems = db.prepare("SELECT * FROM invoice_items WHERE invoiceId = ?").all(invoice.id);
        inventoryEffects = buildInventoryAdjustmentEffects(oldItems, invoice.items);
        const restoreStockStmt = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
        for (const it of oldItems) {
          restoreStockStmt.run(it.quantity, it.productId);
        }

        // 2. Remove old invoice items
        db.prepare("DELETE FROM invoice_items WHERE invoiceId = ?").run(invoice.id);

        // 3. Deduct new stock and insert new items
        const deductStockStmt = db.prepare("UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?");
        const insertItemStmt = db.prepare(`
          INSERT INTO invoice_items (id, invoiceId, productId, name, price, quantity, basePrice)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const it of invoice.items) {
          deductStockStmt.run(it.quantity, it.productId);
          const itemId = `${invoice.id}_item_${it.productId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
          insertItemStmt.run(
            itemId,
            invoice.id,
            it.productId,
            it.name,
            it.price,
            it.quantity,
            it.basePrice || 0
          );
        }
      }
      const updatedInvoice = invoicesApi.getById(invoice.id);
      clearSyncTombstone("invoices", invoice.id);
      insertSyncOperation({
        entityTable: "invoices",
        entityId: invoice.id,
        operationType: "update",
        payload: {
          previousInvoice: { ...existing, items: oldItems },
          invoice: updatedInvoice,
          inventoryEffects
        }
      });
      return updatedInvoice;
    });

    updateTx();
    return invoicesApi.getById(invoice.id);
  },

  /**
   * ATOMIC TRANSACTION CHECKOUT:
   * 1. Validate invoice data and items.
   * 2. Generate or verify sequential invoice number.
   * 3. Verify stock sufficiency for every item.
   * 4. Deduct stock from products table.
   * 5. Insert invoice record.
   * 6. Insert all invoice items.
   * If any step fails, entire transaction is ROLLED BACK automatically.
   */
  createTransaction: (invoiceData) => {
    if (!db) throw new Error("Database not initialized");
    if (!invoiceData || !invoiceData.id || !invoiceData.items || invoiceData.items.length === 0) {
      throw new Error("بيانات الفاتورة غير صحيحة أو لا تحتوي على منتجات");
    }

    const checkoutTx = () => runWriteTransaction(() => {
      let invNum = (invoiceData.invoiceNumber || "").trim();
      if (!invNum) {
        invNum = generateNextInvoiceNumber();
      }

      // Check for duplicate invoiceNumber
      const existingInv = db.prepare("SELECT id FROM invoices WHERE invoiceNumber = ?").get(invNum);
      if (existingInv && existingInv.id !== invoiceData.id) {
        invNum = generateNextInvoiceNumber();
      }

      // 1. Verify stock for registered items (skip check for incomplete products or items with stock 0/incomplete)
      const checkStockStmt = db.prepare("SELECT stock, name, isIncomplete FROM products WHERE id = ?");
      for (const item of invoiceData.items) {
        const prod = checkStockStmt.get(item.productId);
        if (prod && !prod.isIncomplete && prod.stock < item.quantity) {
          throw new Error(`المخزون غير كافٍ للصنف "${prod.name}". المتبقي: ${prod.stock}، المطلوبة: ${item.quantity}`);
        }
      }

      // 2. Insert invoice header
      const insertInvStmt = db.prepare(`
        INSERT INTO invoices (id, invoiceNumber, timestamp, formattedDate, formattedTime, total, subtotal, discount, paymentMethod, sellerName, customerPhone, splitPayments, closedDayId, isDiscountedBelowBase, discountAlerts)
        VALUES (@id, @invoiceNumber, @timestamp, @formattedDate, @formattedTime, @total, @subtotal, @discount, @paymentMethod, @sellerName, @customerPhone, @splitPayments, @closedDayId, @isDiscountedBelowBase, @discountAlerts)
      `);

      const alertsJson = JSON.stringify(invoiceData.discountAlerts || []);
      const splitsJson = JSON.stringify(invoiceData.splitPayments || []);
      insertInvStmt.run({
        id: invoiceData.id,
        invoiceNumber: invNum,
        timestamp: invoiceData.timestamp || Date.now(),
        formattedDate: invoiceData.formattedDate,
        formattedTime: invoiceData.formattedTime,
        total: Number(invoiceData.total) || 0,
        subtotal: Number(invoiceData.subtotal) || Number(invoiceData.total) || 0,
        discount: Number(invoiceData.discount) || 0,
        paymentMethod: invoiceData.paymentMethod || "كاش",
        sellerName: (invoiceData.sellerName || "").trim(),
        customerPhone: (invoiceData.customerPhone || "").trim(),
        splitPayments: splitsJson,
        closedDayId: invoiceData.closedDayId || null,
        isDiscountedBelowBase: invoiceData.isDiscountedBelowBase ? 1 : 0,
        discountAlerts: alertsJson
      });

      // 3. Insert items and deduct stock
      const insertItemStmt = db.prepare(`
        INSERT INTO invoice_items (id, invoiceId, productId, name, price, quantity, basePrice)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const deductStockStmt = db.prepare(`
        UPDATE products SET stock = stock - ? WHERE id = ?
      `);

      for (const item of invoiceData.items) {
        const itemId = `${invoiceData.id}-${item.productId}-${Math.random().toString(36).substr(2, 5)}`;
        insertItemStmt.run(
          itemId,
          invoiceData.id,
          item.productId,
          item.name,
          Number(item.price) || 0,
          Number(item.quantity) || 1,
          Number(item.basePrice) || 0
        );
        deductStockStmt.run(Number(item.quantity) || 1, item.productId);
      }

      const createdInvoice = invoicesApi.getById(invoiceData.id);
      clearSyncTombstone("invoices", invoiceData.id);
      insertSyncOperation({
        entityTable: "invoices",
        entityId: invoiceData.id,
        operationType: "create",
        payload: {
          invoice: createdInvoice,
          inventoryEffects: invoiceData.items.map((item) => ({
            productId: item.productId,
            quantityDelta: -(Number(item.quantity) || 1)
          }))
        }
      });

      return invNum;
    });

    checkoutTx();
    return invoicesApi.getById(invoiceData.id);
  },

  /**
   * ATOMIC TRANSACTION DELETE INVOICE:
   * 1. Read items of invoice to restore product stock.
   * 2. Copy invoice & items to deleted_invoices archive tables.
   * 3. Delete invoice from active tables (cascade deletes items).
   * 4. Update closed_days if associated.
   */
  deleteTransaction: (id) => {
    if (!db) throw new Error("Database not initialized");
    const deleteTx = () => runWriteTransaction(() => {
      const targetInvoice = invoicesApi.getById(id);
      if (!targetInvoice) return false;
      const invoiceItemRows = db.prepare("SELECT id FROM invoice_items WHERE invoiceId = ?").all(id);

      // 1. Restore product stock
      const restoreStockStmt = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
      for (const item of targetInvoice.items) {
        restoreStockStmt.run(item.quantity, item.productId);
      }

      // 2. Archive to deleted_invoices table
      const now = Date.now();
      const deletedDateStr = new Date(now).toLocaleDateString("ar-EG");
      const deletedTimeStr = new Date(now).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" });

      db.prepare(`
        INSERT OR REPLACE INTO deleted_invoices (id, invoiceNumber, timestamp, formattedDate, formattedTime, total, subtotal, discount, paymentMethod, sellerName, customerPhone, splitPayments, closedDayId, isDiscountedBelowBase, discountAlerts, deletedAt, deletedDateStr, deletedTimeStr)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        targetInvoice.id,
        targetInvoice.invoiceNumber,
        targetInvoice.timestamp,
        targetInvoice.formattedDate,
        targetInvoice.formattedTime,
        targetInvoice.total,
        targetInvoice.subtotal || targetInvoice.total,
        targetInvoice.discount || 0,
        targetInvoice.paymentMethod || "كاش",
        targetInvoice.sellerName || "",
        targetInvoice.customerPhone || "",
        JSON.stringify(targetInvoice.splitPayments || []),
        targetInvoice.closedDayId || null,
        targetInvoice.isDiscountedBelowBase ? 1 : 0,
        JSON.stringify(targetInvoice.discountAlerts || []),
        now,
        deletedDateStr,
        deletedTimeStr
      );

      const insertDeletedItem = db.prepare(`
        INSERT OR REPLACE INTO deleted_invoice_items (id, invoiceId, productId, name, price, quantity, basePrice)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of targetInvoice.items) {
        const itemId = `del-${targetInvoice.id}-${item.productId}-${Math.random().toString(36).substr(2, 5)}`;
        insertDeletedItem.run(
          itemId,
          targetInvoice.id,
          item.productId,
          item.name,
          item.price,
          item.quantity,
          item.basePrice || 0
        );
      }

      // 3. Update closed shift if associated
      if (targetInvoice.closedDayId) {
        const shift = db.prepare("SELECT * FROM closed_days WHERE id = ?").get(targetInvoice.closedDayId);
        if (shift) {
          let invIds = [];
          try {
            invIds = JSON.parse(shift.invoiceIds || "[]");
          } catch (e) {}

          const newTotal = Math.max(0, shift.totalSales - targetInvoice.total);
          const newNet = Math.max(0, (shift.netSales || 0) - targetInvoice.total);
          const newCount = Math.max(0, shift.invoiceCount - 1);
          const updatedIds = invIds.filter((invId) => invId !== id);

          db.prepare("UPDATE closed_days SET totalSales = ?, netSales = ?, invoiceCount = ?, invoiceIds = ? WHERE id = ?").run(
            newTotal,
            newNet,
            newCount,
            JSON.stringify(updatedIds),
            targetInvoice.closedDayId
          );
        }
      }

      // 4. Delete invoice (cascade deletes from active invoice_items)
      const res = db.prepare("DELETE FROM invoices WHERE id = ?").run(id);
      if (res.changes > 0) {
        const operationId = insertSyncOperation({
          entityTable: "invoices",
          entityId: id,
          operationType: "delete",
          payload: {
            invoice: targetInvoice,
            inventoryEffects: buildInventoryEffects(targetInvoice.items, 1),
            deletedInvoice: targetInvoice
          }
        });
        insertSyncTombstone({ entityTable: "invoices", entityId: id, operationId });
        for (const item of invoiceItemRows) {
          insertSyncTombstone({ entityTable: "invoice_items", entityId: item.id, operationId });
        }
      }
      return res.changes > 0;
    });

    return deleteTx();
  }
};

// -------------------------------------------------------------
// Deleted Invoices API
// -------------------------------------------------------------
const deletedInvoicesApi = {
  getAll: () => {
    if (!db) throw new Error("Database not initialized");
    const rows = db.prepare("SELECT * FROM deleted_invoices ORDER BY deletedAt DESC").all();
    const stmtItems = db.prepare("SELECT * FROM deleted_invoice_items WHERE invoiceId = ?");

    return rows.map((inv) => {
      const items = stmtItems.all(inv.id);
      let alerts = [];
      try {
        alerts = JSON.parse(inv.discountAlerts || "[]");
      } catch (e) {}
      let splits = [];
      try {
        splits = JSON.parse(inv.splitPayments || "[]");
      } catch (e) {}
      return {
        ...inv,
        customerPhone: inv.customerPhone || undefined,
        splitPayments: Array.isArray(splits) && splits.length > 0 ? splits : undefined,
        isDiscountedBelowBase: Boolean(inv.isDiscountedBelowBase),
        discountAlerts: alerts,
        items: items.map((it) => ({
          productId: it.productId,
          name: it.name,
          price: it.price,
          quantity: it.quantity,
          basePrice: it.basePrice || 0
        }))
      };
    });
  }
};

// -------------------------------------------------------------
// Employees, Categories, ClosedDays, ArchivedSales APIs
// -------------------------------------------------------------
const employeesApi = {
  getAll: () => {
    if (!db) throw new Error("Database not initialized");
    return db.prepare("SELECT * FROM employees ORDER BY name ASC").all();
  },
  create: (name) => {
    if (!db) throw new Error("Database not initialized");
    const trimmed = name.trim();
    if (!trimmed) return employeesApi.getAll();
    return runWriteTransaction(() => {
      const id = `emp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const result = db.prepare("INSERT INTO employees (id, name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING").run(id, trimmed);
      if (result.changes > 0) {
        clearSyncTombstone("employees", id);
        insertSyncOperation({
          entityTable: "employees",
          entityId: id,
          operationType: "create",
          payload: { id, name: trimmed }
        });
      }
      return employeesApi.getAll();
    });
  },
  update: (oldName, newName) => {
    if (!db) throw new Error("Database not initialized");
    const oldTrimmed = (oldName || "").trim();
    const newTrimmed = (newName || "").trim();

    if (!oldTrimmed) {
      throw new Error("اسم العامل القديم غير محدد");
    }
    if (!newTrimmed) {
      throw new Error("يرجى إدخال اسم العامل الجديد بشكل صحيح");
    }
    if (oldTrimmed === newTrimmed) {
      return employeesApi.getAll();
    }

    const updateTx = () => runWriteTransaction(() => {
      // 1. Check if newName already exists for another employee
      const existingNew = db.prepare("SELECT id FROM employees WHERE name = ?").get(newTrimmed);
      if (existingNew) {
        throw new Error(`اسم العامل "${newTrimmed}" مسجل بالفعل لعامل آخر في النظام`);
      }

      // 2. Check if old employee exists in employees table
      const existingOld = db.prepare("SELECT id FROM employees WHERE name = ?").get(oldTrimmed);
      if (!existingOld) {
        const id = `emp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
        db.prepare("INSERT INTO employees (id, name) VALUES (?, ?)").run(id, newTrimmed);
      } else {
        db.prepare("UPDATE employees SET name = ? WHERE name = ?").run(newTrimmed, oldTrimmed);
      }

      // 3. Update all invoices where sellerName = oldName
      db.prepare("UPDATE invoices SET sellerName = ? WHERE sellerName = ?").run(newTrimmed, oldTrimmed);

      // 4. Update all deleted_invoices archive where sellerName = oldName
      db.prepare("UPDATE deleted_invoices SET sellerName = ? WHERE sellerName = ?").run(newTrimmed, oldTrimmed);

      // 5. Update expenses where sellerName = oldName
      db.prepare("UPDATE expenses SET sellerName = ? WHERE sellerName = ?").run(newTrimmed, oldTrimmed);

      // 6. Update archived_sales where employeeName = oldName
      db.prepare("UPDATE archived_sales SET employeeName = ? WHERE employeeName = ?").run(newTrimmed, oldTrimmed);

      clearSyncTombstone("employees", existingOld ? existingOld.id : newTrimmed);
      insertSyncOperation({
        entityTable: "employees",
        entityId: existingOld ? existingOld.id : newTrimmed,
        operationType: "update",
        payload: {
          previousName: oldTrimmed,
          name: newTrimmed,
          relatedRowsUpdated: true
        }
      });

      return true;
    });

    updateTx();
    return employeesApi.getAll();
  },
  delete: (name) => {
    if (!db) throw new Error("Database not initialized");
    const trimmed = name.trim();
    return runWriteTransaction(() => {
      const existing = db.prepare("SELECT * FROM employees WHERE name = ?").get(trimmed);
      const deleteResult = db.prepare("DELETE FROM employees WHERE name = ?").run(trimmed);
      const invoiceResult = db.prepare("UPDATE invoices SET sellerName = 'مبيعات عامة' WHERE sellerName = ?").run(trimmed);
      if (deleteResult.changes > 0 || invoiceResult.changes > 0) {
        const operationId = insertSyncOperation({
          entityTable: "employees",
          entityId: existing ? existing.id : trimmed,
          operationType: "delete",
          payload: {
            employee: existing || { name: trimmed },
            reassignedInvoiceCount: invoiceResult.changes
          }
        });
        if (existing) {
          insertSyncTombstone({ entityTable: "employees", entityId: existing.id, operationId });
        }
      }
      return employeesApi.getAll();
    });
  }
};

const categoriesApi = {
  getAll: () => {
    if (!db) throw new Error("Database not initialized");
    const rows = db.prepare("SELECT name FROM categories ORDER BY name ASC").all();
    return rows.map((r) => r.name);
  },
  create: (name) => {
    if (!db) throw new Error("Database not initialized");
    const trimmed = name.trim();
    if (!trimmed) return categoriesApi.getAll();
    return runWriteTransaction(() => {
      const id = `cat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const result = db.prepare("INSERT INTO categories (id, name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING").run(id, trimmed);
      if (result.changes > 0) {
        clearSyncTombstone("categories", id);
        insertSyncOperation({
          entityTable: "categories",
          entityId: id,
          operationType: "create",
          payload: { id, name: trimmed }
        });
      }
      return categoriesApi.getAll();
    });
  },
  delete: (name) => {
    if (!db) throw new Error("Database not initialized");
    const trimmed = name.trim();
    return runWriteTransaction(() => {
      const existing = db.prepare("SELECT * FROM categories WHERE name = ?").get(trimmed);
      const deleteResult = db.prepare("DELETE FROM categories WHERE name = ?").run(trimmed);
      const productResult = db.prepare("UPDATE products SET category = 'بدون تصنيف' WHERE category = ?").run(trimmed);
      if (deleteResult.changes > 0 || productResult.changes > 0) {
        const operationId = insertSyncOperation({
          entityTable: "categories",
          entityId: existing ? existing.id : trimmed,
          operationType: "delete",
          payload: {
            category: existing || { name: trimmed },
            reassignedProductCount: productResult.changes
          }
        });
        if (existing) {
          insertSyncTombstone({ entityTable: "categories", entityId: existing.id, operationId });
        }
      }
      return categoriesApi.getAll();
    });
  }
};

const closedDaysApi = {
  getAll: () => {
    if (!db) throw new Error("Database not initialized");
    const rows = db.prepare("SELECT * FROM closed_days ORDER BY timestamp DESC").all();
    return rows.map((r) => {
      let ids = [];
      try {
        ids = JSON.parse(r.invoiceIds || "[]");
      } catch (e) {}

      let paymentBreakdown = undefined;
      try {
        if (r.paymentBreakdown) {
          const parsed = JSON.parse(r.paymentBreakdown);
          if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
            paymentBreakdown = parsed;
          }
        }
      } catch (e) {}

      let employeeRankings = undefined;
      try {
        if (r.employeeRankings) {
          const parsed = JSON.parse(r.employeeRankings);
          if (Array.isArray(parsed) && parsed.length > 0) {
            employeeRankings = parsed;
          }
        }
      } catch (e) {}

      return {
        ...r,
        invoiceIds: ids,
        paymentBreakdown,
        employeeRankings,
        totalDiscounts: Number(r.totalDiscounts) || 0,
        totalItemsSold: Number(r.totalItemsSold) || 0,
        discountedInvoicesCount: Number(r.discountedInvoicesCount) || 0
      };
    });
  },
  create: (data) => {
    if (!db) throw new Error("Database not initialized");
    const closeShiftTx = () => runWriteTransaction(() => {
      const idsJson = JSON.stringify(data.invoiceIds || []);
      const pbJson = JSON.stringify(data.paymentBreakdown || {});
      const empRankJson = JSON.stringify(data.employeeRankings || []);

      db.prepare(`
        INSERT INTO closed_days (
          id, timestamp, formattedDate, formattedTime, 
          totalSales, totalExpenses, netSales, invoiceCount, 
          invoiceIds, totalDiscounts, totalItemsSold, 
          discountedInvoicesCount, paymentBreakdown, employeeRankings
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          totalSales = excluded.totalSales,
          totalExpenses = excluded.totalExpenses,
          netSales = excluded.netSales,
          invoiceCount = excluded.invoiceCount,
          invoiceIds = excluded.invoiceIds,
          totalDiscounts = excluded.totalDiscounts,
          totalItemsSold = excluded.totalItemsSold,
          discountedInvoicesCount = excluded.discountedInvoicesCount,
          paymentBreakdown = excluded.paymentBreakdown,
          employeeRankings = excluded.employeeRankings
      `).run(
        data.id,
        data.timestamp || Date.now(),
        data.formattedDate,
        data.formattedTime,
        Number(data.totalSales) || 0,
        Number(data.totalExpenses) || 0,
        Number(data.netSales) || 0,
        Number(data.invoiceCount) || 0,
        idsJson,
        Number(data.totalDiscounts) || 0,
        Number(data.totalItemsSold) || 0,
        Number(data.discountedInvoicesCount) || 0,
        pbJson,
        empRankJson
      );

      // Update invoices with closedDayId
      if (data.invoiceIds && Array.isArray(data.invoiceIds)) {
        const stmt = db.prepare("UPDATE invoices SET closedDayId = ? WHERE id = ?");
        for (const invId of data.invoiceIds) {
          stmt.run(data.id, invId);
        }
      }

      // Also link unclosed active expenses to this closed session
      const expenseResult = db.prepare("UPDATE expenses SET closedDayId = ? WHERE closedDayId IS NULL OR closedDayId = ''").run(data.id);

      clearSyncTombstone("closed_days", data.id);
      insertSyncOperation({
        entityTable: "closed_days",
        entityId: data.id,
        operationType: "create",
        payload: {
          closedDay: data,
          linkedInvoiceIds: data.invoiceIds || [],
          linkedExpenseCount: expenseResult.changes
        }
      });

      return true;
    });

    closeShiftTx();
    return closedDaysApi.getAll();
  }
};

const expensesApi = {
  getAll: () => {
    if (!db) throw new Error("Database not initialized");
    const rows = db.prepare("SELECT * FROM expenses ORDER BY timestamp DESC").all();
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      amount: r.amount,
      timestamp: r.timestamp,
      formattedDate: r.formattedDate,
      formattedTime: r.formattedTime,
      notes: r.notes || "",
      sellerName: r.sellerName || "",
      closedDayId: r.closedDayId || undefined
    }));
  },
  create: (expense) => {
    if (!db) throw new Error("Database not initialized");
    return runWriteTransaction(() => {
      db.prepare(`
        INSERT INTO expenses (id, title, amount, timestamp, formattedDate, formattedTime, notes, sellerName, closedDayId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        expense.id,
        expense.title,
        Number(expense.amount) || 0,
        expense.timestamp || Date.now(),
        expense.formattedDate || "",
        expense.formattedTime || "",
        expense.notes || "",
        expense.sellerName || "",
        expense.closedDayId || null
      );
      clearSyncTombstone("expenses", expense.id);
      insertSyncOperation({
        entityTable: "expenses",
        entityId: expense.id,
        operationType: "create",
        payload: { expense }
      });
      return expense;
    });
  },
  delete: (id) => {
    if (!db) throw new Error("Database not initialized");
    return runWriteTransaction(() => {
      const existing = db.prepare("SELECT * FROM expenses WHERE id = ?").get(id);
      const res = db.prepare("DELETE FROM expenses WHERE id = ?").run(id);
      if (res.changes > 0) {
        const operationId = insertSyncOperation({
          entityTable: "expenses",
          entityId: id,
          operationType: "delete",
          payload: { expense: existing }
        });
        insertSyncTombstone({ entityTable: "expenses", entityId: id, operationId });
      }
      return res.changes > 0;
    });
  }
};

const archivedSalesApi = {
  getAll: () => {
    if (!db) throw new Error("Database not initialized");
    const rows = db.prepare("SELECT * FROM archived_sales ORDER BY deletedAt DESC").all();
    return rows.map((r) => {
      let invs = [];
      try {
        invs = JSON.parse(r.invoicesCopied || "[]");
      } catch (e) {}
      return { ...r, invoicesCopied: invs };
    });
  },
  create: (data) => {
    if (!db) throw new Error("Database not initialized");
    return runWriteTransaction(() => {
      const copiedJson = JSON.stringify(data.invoicesCopied || []);
      db.prepare(`
        INSERT INTO archived_sales (id, employeeName, dateStr, totalSales, invoiceCount, itemsSold, deletedAt, invoicesCopied)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.id,
        data.employeeName,
        data.dateStr,
        Number(data.totalSales) || 0,
        Number(data.invoiceCount) || 0,
        Number(data.itemsSold) || 0,
        data.deletedAt || Date.now(),
        copiedJson
      );
      clearSyncTombstone("archived_sales", data.id);
      insertSyncOperation({
        entityTable: "archived_sales",
        entityId: data.id,
        operationType: "create",
        payload: { archivedSale: data }
      });
      return archivedSalesApi.getAll();
    });
  }
};

const settingsApi = {
  get: (key) => {
    if (!db) throw new Error("Database not initialized");
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
    return row ? row.value : null;
  },
  set: (key, value) => {
    if (!db) throw new Error("Database not initialized");
    return runWriteTransaction(() => {
      const existing = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
      db.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(key, String(value));
      insertSyncOperation({
        entityTable: "settings",
        entityId: key,
        operationType: "update",
        payload: {
          key,
          previousValue: existing ? existing.value : null,
          value: String(value)
        }
      });
      return true;
    });
  }
};

// -------------------------------------------------------------
// Backup & Restore Engine
// -------------------------------------------------------------
const backupsApi = {
  createBackup: () => {
    try {
      if (!db) throw new Error("Database not initialized");
      const timestampStr = new Date().toISOString().replace(/[:.]/g, "-");
      const folderName = `backup_${timestampStr}`;
      const destFolder = path.join(backupsDir, folderName);
      fs.mkdirSync(destFolder, { recursive: true });

      // 1. Copy SQLite Database after WAL checkpoint
      db.pragma("wal_checkpoint(TRUNCATE)");
      const dbPath = path.join(userDataDir, "gallery_anto.sqlite");
      fs.copyFileSync(dbPath, path.join(destFolder, "gallery_anto.sqlite"));

      // 2. Copy images folder
      const backupImagesDir = path.join(destFolder, "images");
      if (fs.existsSync(imagesDir)) {
        fs.mkdirSync(backupImagesDir, { recursive: true });
        const files = fs.readdirSync(imagesDir);
        for (const file of files) {
          fs.copyFileSync(path.join(imagesDir, file), path.join(backupImagesDir, file));
        }
      }

      return { success: true, path: destFolder, filename: folderName };
    } catch (err) {
      console.error("Backup creation failed:", err);
      return { success: false, error: err.message };
    }
  },

  listBackups: () => {
    try {
      if (!fs.existsSync(backupsDir)) return [];
      const entries = fs.readdirSync(backupsDir, { withFileTypes: true });
      const backups = [];
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith("backup_")) {
          const fullPath = path.join(backupsDir, entry.name);
          const stat = fs.statSync(fullPath);
          backups.push({
            name: entry.name,
            path: fullPath,
            size: stat.size,
            mtime: stat.mtime.toISOString()
          });
        }
      }
      return backups.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());
    } catch (err) {
      console.error("List backups failed:", err);
      return [];
    }
  },

  restoreBackup: (backupName) => {
    try {
      const backupFolderPath = path.join(backupsDir, backupName);
      const backupDbPath = path.join(backupFolderPath, "gallery_anto.sqlite");
      if (!fs.existsSync(backupDbPath)) {
        return { success: false, error: "ملف النسخة الاحتياطية غير موجود" };
      }

      // Create an automatic safety backup first!
      backupsApi.createBackup();

      // Close current DB connection
      if (db) {
        db.close();
        db = null;
      }

      // Overwrite database file
      const currentDbPath = path.join(userDataDir, "gallery_anto.sqlite");
      fs.copyFileSync(backupDbPath, currentDbPath);

      // Overwrite images
      const backupImagesDir = path.join(backupFolderPath, "images");
      if (fs.existsSync(backupImagesDir)) {
        const files = fs.readdirSync(backupImagesDir);
        for (const file of files) {
          fs.copyFileSync(path.join(backupImagesDir, file), path.join(imagesDir, file));
        }
      }

      // Re-initialize database
      db = new Database(currentDbPath, { verbose: null });
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");

      return { success: true };
    } catch (err) {
      console.error("Restore backup failed:", err);
      return { success: false, error: err.message };
    }
  }
};

// -------------------------------------------------------------
// Safe Idempotent Migration Engine
// -------------------------------------------------------------
function runMigrationIfNeeded(legacyData) {
  if (!db) return { migrated: false, reason: "Database not initialized" };

  const isCompleted = settingsApi.get("migration_completed");
  if (isCompleted === "true") {
    return { migrated: false, reason: "Migration already completed previously" };
  }

  const migrationTx = db.transaction(() => {
    // 1. Migrate Products
    if (legacyData.products && Array.isArray(legacyData.products)) {
      for (const prod of legacyData.products) {
        productsApi.create(prod);
      }
    }

    // 2. Migrate Employees
    if (legacyData.employees && Array.isArray(legacyData.employees)) {
      for (const empName of legacyData.employees) {
        if (typeof empName === "string") {
          employeesApi.create(empName);
        } else if (empName && empName.name) {
          employeesApi.create(empName.name);
        }
      }
    }

    // 3. Migrate Categories
    if (legacyData.categories && Array.isArray(legacyData.categories)) {
      for (const catName of legacyData.categories) {
        categoriesApi.create(catName);
      }
    }

    // 4. Migrate Closed Days
    if (legacyData.closedDays && Array.isArray(legacyData.closedDays)) {
      for (const day of legacyData.closedDays) {
        closedDaysApi.create(day);
      }
    }

    // 5. Migrate Archived Sales
    if (legacyData.archivedSales && Array.isArray(legacyData.archivedSales)) {
      for (const archive of legacyData.archivedSales) {
        archivedSalesApi.create(archive);
      }
    }

    // 6. Migrate Invoices & Invoice Items
    let maxInvoiceSeq = 0;
    if (legacyData.invoices && Array.isArray(legacyData.invoices)) {
      const insertInv = db.prepare(`
        INSERT INTO invoices (id, invoiceNumber, timestamp, formattedDate, formattedTime, total, subtotal, discount, paymentMethod, sellerName, closedDayId, isDiscountedBelowBase, discountAlerts)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `);
      const insertItem = db.prepare(`
        INSERT INTO invoice_items (id, invoiceId, productId, name, price, quantity, basePrice)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `);

      for (const inv of legacyData.invoices) {
        if (inv.invoiceNumber) {
          const match = inv.invoiceNumber.match(/ANTO-(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num) && num > maxInvoiceSeq) {
              maxInvoiceSeq = num;
            }
          }
        }

        const alertsJson = JSON.stringify(inv.discountAlerts || []);
        insertInv.run(
          inv.id,
          inv.invoiceNumber,
          inv.timestamp || Date.now(),
          inv.formattedDate,
          inv.formattedTime,
          Number(inv.total) || 0,
          Number(inv.subtotal) || Number(inv.total) || 0,
          Number(inv.discount) || 0,
          inv.paymentMethod || "كاش",
          inv.sellerName || "",
          inv.closedDayId || null,
          inv.isDiscountedBelowBase ? 1 : 0,
          alertsJson
        );

        if (inv.items && Array.isArray(inv.items)) {
          for (const item of inv.items) {
            const itemId = `${inv.id}-${item.productId}-${Math.random().toString(36).substr(2, 5)}`;
            insertItem.run(
              itemId,
              inv.id,
              item.productId,
              item.name,
              Number(item.price) || 0,
              Number(item.quantity) || 1,
              Number(item.basePrice) || 0
            );
          }
        }
      }
    }

    // 7. Migrate Deleted Invoices
    if (legacyData.deletedInvoices && Array.isArray(legacyData.deletedInvoices)) {
      const insertDelInv = db.prepare(`
        INSERT INTO deleted_invoices (id, invoiceNumber, timestamp, formattedDate, formattedTime, total, subtotal, discount, paymentMethod, sellerName, closedDayId, isDiscountedBelowBase, discountAlerts, deletedAt, deletedDateStr, deletedTimeStr)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `);
      const insertDelItem = db.prepare(`
        INSERT INTO deleted_invoice_items (id, invoiceId, productId, name, price, quantity, basePrice)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `);

      for (const inv of legacyData.deletedInvoices) {
        insertDelInv.run(
          inv.id,
          inv.invoiceNumber,
          inv.timestamp || Date.now(),
          inv.formattedDate,
          inv.formattedTime,
          Number(inv.total) || 0,
          Number(inv.subtotal) || Number(inv.total) || 0,
          Number(inv.discount) || 0,
          inv.paymentMethod || "كاش",
          inv.sellerName || "",
          inv.closedDayId || null,
          inv.isDiscountedBelowBase ? 1 : 0,
          JSON.stringify(inv.discountAlerts || []),
          inv.deletedAt || Date.now(),
          inv.deletedDateStr || "",
          inv.deletedTimeStr || ""
        );

        if (inv.items && Array.isArray(inv.items)) {
          for (const item of inv.items) {
            const itemId = `del-${inv.id}-${item.productId}-${Math.random().toString(36).substr(2, 5)}`;
            insertDelItem.run(
              itemId,
              inv.id,
              item.productId,
              item.name,
              Number(item.price) || 0,
              Number(item.quantity) || 1,
              Number(item.basePrice) || 0
            );
          }
        }
      }
    }

    // Initialize sequence counter
    db.prepare(`
      INSERT INTO counters (key, value) VALUES ('invoice_seq', ?)
      ON CONFLICT(key) DO UPDATE SET value = MAX(value, excluded.value)
    `).run(maxInvoiceSeq);

    // Mark migration as completed!
    settingsApi.set("migration_completed", "true");
    return { migrated: true };
  });

  try {
    return migrationTx();
  } catch (err) {
    console.error("Migration failed:", err);
    return { migrated: false, error: err.message };
  }
}

module.exports = {
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
};
