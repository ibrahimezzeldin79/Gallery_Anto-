import { Product, Invoice, ClosedDay, ArchivedEmployeeSales, Expense, ElectronApi, SyncOperationInput, SyncTombstoneInput } from "../types";
import { idbGet, idbSet } from "./idbStorage";
import { INITIAL_PRODUCTS } from "../initialData";

export function resolveProductImageUrl(imagePath?: string): string {
  if (!imagePath) return "";
  if (imagePath.startsWith("images/")) {
    if (window.api) {
      return `media://${imagePath}`;
    }
  }
  return imagePath;
}

// Check if running inside Electron desktop app with SQLite
export const isElectron = (): boolean => {
  return typeof window !== "undefined" && Boolean(window.api);
};

// -------------------------------------------------------------
// Web LocalStorage / IndexedDB Fallback Engine
// -------------------------------------------------------------
const WEB_PREFIX = "anto_sql_web_";

async function getWeb<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const val = await idbGet<T>(WEB_PREFIX + key);
    if (val !== null && val !== undefined) return val;
    const localVal = localStorage.getItem(WEB_PREFIX + key);
    if (localVal) return JSON.parse(localVal);
  } catch (e) {
    console.warn("Web storage read error:", e);
  }
  return defaultValue;
}

async function setWeb<T>(key: string, value: T): Promise<void> {
  try {
    await idbSet(WEB_PREFIX + key, value);
    try {
      localStorage.setItem(WEB_PREFIX + key, JSON.stringify(value));
    } catch (e) {}
  } catch (e) {
    console.warn("Web storage write error:", e);
  }
}

// -------------------------------------------------------------
// Unified Database API
// -------------------------------------------------------------
export const dbApi: ElectronApi = {
  products: {
    getAll: async () => {
      if (window.api) return window.api.products.getAll();
      return getWeb<Product[]>("products", INITIAL_PRODUCTS);
    },
    getById: async (id) => {
      if (window.api) return window.api.products.getById(id);
      const prods = await getWeb<Product[]>("products", INITIAL_PRODUCTS);
      return prods.find((p) => p.id === id) || null;
    },
    create: async (product) => {
      if (window.api) return window.api.products.create(product);
      const prods = await getWeb<Product[]>("products", INITIAL_PRODUCTS);
      const updated = [product, ...prods.filter((p) => p.id !== product.id)];
      await setWeb("products", updated);
      return product;
    },
    update: async (product) => {
      if (window.api) return window.api.products.update(product);
      const prods = await getWeb<Product[]>("products", INITIAL_PRODUCTS);
      const updated = prods.map((p) => (p.id === product.id ? product : p));
      await setWeb("products", updated);
      return product;
    },
    updateStock: async (id, stock) => {
      if (window.api) return window.api.products.updateStock(id, stock);
      const prods = await getWeb<Product[]>("products", INITIAL_PRODUCTS);
      const updated = prods.map((p) => (p.id === id ? { ...p, stock } : p));
      await setWeb("products", updated);
      return updated.find((p) => p.id === id)!;
    },
    delete: async (id) => {
      if (window.api) return window.api.products.delete(id);
      const prods = await getWeb<Product[]>("products", INITIAL_PRODUCTS);
      const updated = prods.filter((p) => p.id !== id);
      await setWeb("products", updated);
      return true;
    }
  },

  invoices: {
    getAll: async (options) => {
      if (window.api) return window.api.invoices.getAll(options);
      let invs = await getWeb<Invoice[]>("invoices", []);
      if (options?.seller && options.seller !== "all") {
        const s = options.seller.trim().toLowerCase();
        invs = invs.filter((i) => (i.sellerName || "").trim().toLowerCase() === s);
      }
      if (options?.search) {
        const s = options.search.toLowerCase();
        invs = invs.filter(
          (i) =>
            i.invoiceNumber.toLowerCase().includes(s) ||
            (i.sellerName && i.sellerName.toLowerCase().includes(s)) ||
            (i.customerPhone && i.customerPhone.toLowerCase().includes(s)) ||
            i.formattedDate.toLowerCase().includes(s)
        );
      }
      if (options?.date) {
        invs = invs.filter((i) => i.formattedDate.includes(options.date!));
      }
      if (options?.closedDayId) {
        if (options.closedDayId === "active") {
          invs = invs.filter((i) => !i.closedDayId);
        } else if (options.closedDayId === "closed") {
          invs = invs.filter((i) => !!i.closedDayId);
        } else {
          invs = invs.filter((i) => i.closedDayId === options.closedDayId);
        }
      }
      if (options?.page && options?.limit) {
        const start = (options.page - 1) * options.limit;
        return invs.slice(start, start + options.limit);
      }
      return invs;
    },
    getById: async (id) => {
      if (window.api) return window.api.invoices.getById(id);
      const invs = await getWeb<Invoice[]>("invoices", []);
      return invs.find((i) => i.id === id) || null;
    },
    create: async (invoiceData) => {
      if (window.api) return window.api.invoices.create(invoiceData);
      
      const invs = await getWeb<Invoice[]>("invoices", []);
      const nextNum = invoiceData.invoiceNumber || (await dbApi.invoices.getNextInvoiceNumber());
      const newInv = { ...invoiceData, invoiceNumber: nextNum };
      const updatedInvs = [newInv, ...invs];
      await setWeb("invoices", updatedInvs);

      // Deduct stock in web mode
      const prods = await getWeb<Product[]>("products", INITIAL_PRODUCTS);
      const updatedProds = prods.map((p) => {
        const item = invoiceData.items.find((it) => it.productId === p.id);
        if (item) {
          return { ...p, stock: Math.max(0, p.stock - item.quantity) };
        }
        return p;
      });
      await setWeb("products", updatedProds);

      return newInv;
    },
    update: async (invoice) => {
      if (window.api) return window.api.invoices.update(invoice);
      const invs = await getWeb<Invoice[]>("invoices", []);
      const existing = invs.find((i) => i.id === invoice.id);
      
      // If items changed, update stock in web mode
      if (existing && invoice.items && Array.isArray(invoice.items)) {
        const prods = await getWeb<Product[]>("products", INITIAL_PRODUCTS);
        // Restore old
        let updatedProds = prods.map((p) => {
          const oldItem = existing.items.find((it) => it.productId === p.id);
          if (oldItem) {
            return { ...p, stock: p.stock + oldItem.quantity };
          }
          return p;
        });
        // Deduct new
        updatedProds = updatedProds.map((p) => {
          const newItem = invoice.items.find((it) => it.productId === p.id);
          if (newItem) {
            return { ...p, stock: Math.max(0, p.stock - newItem.quantity) };
          }
          return p;
        });
        await setWeb("products", updatedProds);
      }

      const updatedInvs = invs.map((i) => (i.id === invoice.id ? { ...i, ...invoice } : i));
      await setWeb("invoices", updatedInvs);
      return updatedInvs.find((i) => i.id === invoice.id) || null;
    },
    delete: async (id) => {
      if (window.api) return window.api.invoices.delete(id);
      const invs = await getWeb<Invoice[]>("invoices", []);
      const target = invs.find((i) => i.id === id);
      const updated = invs.filter((i) => i.id !== id);
      await setWeb("invoices", updated);

      if (target) {
        // Archive to deleted_invoices
        const delInvs = await getWeb<Invoice[]>("deleted_invoices", []);
        const now = Date.now();
        const delRecord = {
          ...target,
          deletedAt: now,
          deletedDateStr: new Date(now).toLocaleDateString("ar-EG"),
          deletedTimeStr: new Date(now).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })
        };
        await setWeb("deleted_invoices", [delRecord, ...delInvs]);

        // Restore stock in web mode
        const prods = await getWeb<Product[]>("products", INITIAL_PRODUCTS);
        const updatedProds = prods.map((p) => {
          const item = target.items.find((it) => it.productId === p.id);
          if (item) {
            return { ...p, stock: p.stock + item.quantity };
          }
          return p;
        });
        await setWeb("products", updatedProds);
      }

      return true;
    },
    getNextInvoiceNumber: async () => {
      if (window.api) return window.api.invoices.getNextInvoiceNumber();
      const currentSeqStr = (await getWeb<string>("last_invoice_seq", "0")) || "0";
      let seq = parseInt(currentSeqStr, 10) || 0;

      const invs = await getWeb<Invoice[]>("invoices", []);
      for (const inv of invs) {
        if (inv.invoiceNumber) {
          const match = inv.invoiceNumber.match(/ANTO-(\d+)/);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > seq) seq = num;
          }
        }
      }

      const nextSeq = seq + 1;
      await setWeb("last_invoice_seq", String(nextSeq));
      return `ANTO-${String(nextSeq).padStart(4, "0")}`;
    }
  },

  deletedInvoices: {
    getAll: async () => {
      if (window.api) return window.api.deletedInvoices.getAll();
      return getWeb<Invoice[]>("deleted_invoices", []);
    }
  },

  employees: {
    getAll: async () => {
      if (window.api) return window.api.employees.getAll();
      const names = await getWeb<string[]>("employees", ["عمرو", "أنطو", "بيشوي", "مكاريوس", "المحل"]);
      return names.map((name, i) => ({ id: `emp-${i}`, name }));
    },
    create: async (name) => {
      if (window.api) return window.api.employees.create(name);
      const names = await getWeb<string[]>("employees", ["عمرو", "أنطو", "بيشوي", "مكاريوس", "المحل"]);
      if (!names.includes(name.trim())) {
        const updated = [...names, name.trim()];
        await setWeb("employees", updated);
        return updated.map((n, i) => ({ id: `emp-${i}`, name: n }));
      }
      return names.map((n, i) => ({ id: `emp-${i}`, name: n }));
    },
    update: async (oldName: string, newName: string) => {
      if (window.api) return window.api.employees.update(oldName, newName);
      const names = await getWeb<string[]>("employees", ["عمرو", "أنطو", "بيشوي", "مكاريوس", "المحل"]);
      const oldTrimmed = oldName.trim();
      const newTrimmed = newName.trim();

      if (!newTrimmed) throw new Error("يرجى إدخال اسم العامل الجديد بشكل صحيح");
      if (names.includes(newTrimmed) && newTrimmed !== oldTrimmed) {
        throw new Error(`اسم العامل "${newTrimmed}" مسجل بالفعل لعامل آخر في النظام`);
      }

      const updated = names.map((n) => (n === oldTrimmed ? newTrimmed : n));
      if (!updated.includes(newTrimmed)) updated.push(newTrimmed);
      await setWeb("employees", updated);

      // Update invoices in web mode
      const invs = await getWeb<Invoice[]>("invoices", []);
      const updatedInvs = invs.map((inv) =>
        inv.sellerName === oldTrimmed ? { ...inv, sellerName: newTrimmed } : inv
      );
      await setWeb("invoices", updatedInvs);

      return updated.map((n, i) => ({ id: `emp-${i}`, name: n }));
    },
    delete: async (name) => {
      if (window.api) return window.api.employees.delete(name);
      const names = await getWeb<string[]>("employees", ["عمرو", "أنطو", "بيشوي", "مكاريوس", "المحل"]);
      const updated = names.filter((n) => n !== name.trim());
      await setWeb("employees", updated);

      // Reassign active invoices to 'مبيعات عامة' in web mode
      const invs = await getWeb<Invoice[]>("invoices", []);
      const updatedInvs = invs.map((inv) =>
        inv.sellerName === name.trim() ? { ...inv, sellerName: "مبيعات عامة" } : inv
      );
      await setWeb("invoices", updatedInvs);

      return updated.map((n, i) => ({ id: `emp-${i}`, name: n }));
    }
  },

  categories: {
    getAll: async () => {
      if (window.api) return window.api.categories.getAll();
      return getWeb<string[]>("categories", [
        "انتيكات",
        "مجسمات",
        "صواني",
        "شمعدان",
        "شلالات",
        "ڤازات",
        "تسالي",
        "شجر",
        "براويز",
        "ساعات"
      ]);
    },
    create: async (name) => {
      if (window.api) return window.api.categories.create(name);
      const cats = await dbApi.categories.getAll();
      if (!cats.includes(name.trim())) {
        const updated = [...cats, name.trim()];
        await setWeb("categories", updated);
        return updated;
      }
      return cats;
    },
    delete: async (name) => {
      if (window.api) return window.api.categories.delete(name);
      const cats = await dbApi.categories.getAll();
      const updated = cats.filter((c) => c !== name.trim());
      await setWeb("categories", updated);

      // Reassign products under deleted category to "بدون تصنيف"
      const prods = await getWeb<Product[]>("products", INITIAL_PRODUCTS);
      const updatedProds = prods.map((p) =>
        p.category === name.trim() ? { ...p, category: "بدون تصنيف" } : p
      );
      await setWeb("products", updatedProds);

      return updated;
    }
  },

  closedDays: {
    getAll: async () => {
      if (window.api) return window.api.closedDays.getAll();
      return getWeb<ClosedDay[]>("closed_days", []);
    },
    create: async (data) => {
      if (window.api) return window.api.closedDays.create(data);
      const days = await getWeb<ClosedDay[]>("closed_days", []);
      const updated = [data, ...days];
      await setWeb("closed_days", updated);

      // Link active invoices to this closed session
      const invoices = await getWeb<Invoice[]>("invoices", []);
      const targetIds = data.invoiceIds && Array.isArray(data.invoiceIds) ? data.invoiceIds : [];
      const updatedInvoices = invoices.map((inv) => {
        if (!inv.closedDayId && (targetIds.length === 0 || targetIds.includes(inv.id))) {
          return { ...inv, closedDayId: data.id };
        }
        return inv;
      });
      await setWeb("invoices", updatedInvoices);

      // Link active expenses to this closed session
      const expenses = await getWeb<Expense[]>("expenses", []);
      const updatedExpenses = expenses.map((exp) => {
        if (!exp.closedDayId) {
          return { ...exp, closedDayId: data.id };
        }
        return exp;
      });
      await setWeb("expenses", updatedExpenses);

      return updated;
    }
  },

  archivedSales: {
    getAll: async () => {
      if (window.api) return window.api.archivedSales.getAll();
      return getWeb<ArchivedEmployeeSales[]>("archived_sales", []);
    },
    create: async (data) => {
      if (window.api) return window.api.archivedSales.create(data);
      const archives = await getWeb<ArchivedEmployeeSales[]>("archived_sales", []);
      const updated = [data, ...archives];
      await setWeb("archived_sales", updated);
      return updated;
    }
  },

  expenses: {
    getAll: async () => {
      if (window.api) return window.api.expenses.getAll();
      return getWeb<Expense[]>("expenses", []);
    },
    create: async (expense) => {
      if (window.api) return window.api.expenses.create(expense);
      const list = await getWeb<Expense[]>("expenses", []);
      const updated = [expense, ...list.filter((e) => e.id !== expense.id)];
      await setWeb("expenses", updated);
      return expense;
    },
    delete: async (id) => {
      if (window.api) return window.api.expenses.delete(id);
      const list = await getWeb<Expense[]>("expenses", []);
      const updated = list.filter((e) => e.id !== id);
      await setWeb("expenses", updated);
      return true;
    }
  },

  settings: {
    get: async (key) => {
      if (window.api) return window.api.settings.get(key);
      return getWeb<string | null>(`setting_${key}`, null);
    },
    set: async (key, value) => {
      if (window.api) return window.api.settings.set(key, value);
      await setWeb(`setting_${key}`, value);
      return true;
    }
  },

  backups: {
    createBackup: async () => {
      if (window.api) return window.api.backups.createBackup();
      return { success: true, filename: "web-mock-backup.sqlite" };
    },
    listBackups: async () => {
      if (window.api) return window.api.backups.listBackups();
      return [];
    },
    restoreBackup: async (name: string) => {
      if (window.api) return window.api.backups.restoreBackup(name);
      return { success: true };
    }
  },

  migration: {
    runMigrationIfNeeded: async (legacyData) => {
      if (window.api) return window.api.migration.runMigrationIfNeeded(legacyData);
      return { migrated: false, reason: "Web mode" };
    }
  },

  appInfo: {
    getUserDataPath: async () => {
      if (window.api) return window.api.appInfo.getUserDataPath();
      return "Web Browser Virtual Storage";
    }
  },

  sync: {
    getDeviceId: async () => {
      if (!window.api) throw new Error("Local synchronization is available only in Electron mode");
      return window.api.sync.getDeviceId();
    },
    createOperation: async (operation: SyncOperationInput) => {
      if (!window.api) throw new Error("Local synchronization is available only in Electron mode");
      return window.api.sync.createOperation(operation);
    },
    getOperation: async (operationId) => {
      if (!window.api) throw new Error("Local synchronization is available only in Electron mode");
      return window.api.sync.getOperation(operationId);
    },
    getPendingOperations: async (limit) => {
      if (!window.api) throw new Error("Local synchronization is available only in Electron mode");
      return window.api.sync.getPendingOperations(limit);
    },
    markOperationSynced: async (operationId) => {
      if (!window.api) throw new Error("Local synchronization is available only in Electron mode");
      return window.api.sync.markOperationSynced(operationId);
    },
    markOperationFailed: async (operationId, errorMessage) => {
      if (!window.api) throw new Error("Local synchronization is available only in Electron mode");
      return window.api.sync.markOperationFailed(operationId, errorMessage);
    },
    recordTombstone: async (tombstone: SyncTombstoneInput) => {
      if (!window.api) throw new Error("Local synchronization is available only in Electron mode");
      return window.api.sync.recordTombstone(tombstone);
    },
    getTombstone: async (entityTable, entityId) => {
      if (!window.api) throw new Error("Local synchronization is available only in Electron mode");
      return window.api.sync.getTombstone(entityTable, entityId);
    },
    getTombstones: async (limit) => {
      if (!window.api) throw new Error("Local synchronization is available only in Electron mode");
      return window.api.sync.getTombstones(limit);
    },
    getState: async (key) => {
      if (!window.api) throw new Error("Local synchronization is available only in Electron mode");
      return window.api.sync.getState(key);
    },
    setState: async (key, value) => {
      if (!window.api) throw new Error("Local synchronization is available only in Electron mode");
      return window.api.sync.setState(key, value);
    }
  },

  realtime: {
    start: async () => {
      if (!window.api) throw new Error("Realtime synchronization is available only in Electron mode");
      return window.api.realtime.start();
    },
    stop: async () => {
      if (!window.api) throw new Error("Realtime synchronization is available only in Electron mode");
      return window.api.realtime.stop();
    },
    getStatus: async () => {
      if (!window.api) throw new Error("Realtime synchronization is available only in Electron mode");
      return window.api.realtime.getStatus();
    },
    processPending: async (limit) => {
      if (!window.api) throw new Error("Realtime synchronization is available only in Electron mode");
      return window.api.realtime.processPending(limit);
    }
  },

  lan: {
    getPrivateAddresses: async () => {
      if (!window.api) throw new Error("LAN transport is available only in Electron mode");
      return window.api.lan.getPrivateAddresses();
    },
    startHost: async (options) => {
      if (!window.api) throw new Error("LAN transport is available only in Electron mode");
      return window.api.lan.startHost(options);
    },
    stopHost: async () => {
      if (!window.api) throw new Error("LAN transport is available only in Electron mode");
      return window.api.lan.stopHost();
    },
    getStatus: async () => {
      if (!window.api) throw new Error("LAN transport is available only in Electron mode");
      return window.api.lan.getStatus();
    },
    createPairingCode: async () => {
      if (!window.api) throw new Error("LAN transport is available only in Electron mode");
      return window.api.lan.createPairingCode();
    },
    connect: async (options) => {
      if (!window.api) throw new Error("LAN transport is available only in Electron mode");
      return window.api.lan.connect(options);
    },
    disconnect: async () => {
      if (!window.api) throw new Error("LAN transport is available only in Electron mode");
      return window.api.lan.disconnect();
    },
    sendTestMessage: async (payload) => {
      if (!window.api) throw new Error("LAN transport is available only in Electron mode");
      return window.api.lan.sendTestMessage(payload);
    },
    getLastTestMessage: async () => {
      if (!window.api) throw new Error("LAN transport is available only in Electron mode");
      return window.api.lan.getLastTestMessage();
    },
    confirmTestMessage: async (testId) => {
      if (!window.api) throw new Error("LAN transport is available only in Electron mode");
      return window.api.lan.confirmTestMessage(testId);
    }
  },

  updater: {
    getStatus: async () => {
      if (!window.api) throw new Error("Application updates are available only in Electron mode");
      return window.api.updater.getStatus();
    },
    check: async () => {
      if (!window.api) throw new Error("Application updates are available only in Electron mode");
      return window.api.updater.check();
    },
    download: async () => {
      if (!window.api) throw new Error("Application updates are available only in Electron mode");
      return window.api.updater.download();
    },
    install: async () => {
      if (!window.api) throw new Error("Application updates are available only in Electron mode");
      return window.api.updater.install();
    },
    onStatus: (listener) => {
      if (!window.api) return () => {};
      return window.api.updater.onStatus(listener);
    }
  }
};
