export interface Product {
  id: string;
  name: string;
  price: number;
  basePrice?: number;
  barcode: string;
  stock: number;
  minStockAlert?: number;
  image?: string;
  category?: string;
  createdAt?: number;
  isIncomplete?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  customPrice?: number;
}

export interface InvoiceItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  basePrice?: number;
}

export interface SplitPayment {
  method: string;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  timestamp: number;
  formattedDate: string;
  formattedTime: string;
  items: InvoiceItem[];
  total: number;
  subtotal?: number;
  discount?: number;
  paymentMethod?: string;
  splitPayments?: SplitPayment[];
  customerPhone?: string;
  sellerName?: string;
  closedDayId?: string;
  deletedAt?: number;
  deletedDateStr?: string;
  deletedTimeStr?: string;
  isDiscountedBelowBase?: boolean;
  discountAlerts?: string[];
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  timestamp: number;
  formattedDate: string;
  formattedTime: string;
  notes?: string;
  sellerName?: string;
  closedDayId?: string;
}

export interface PaymentMethodsBreakdown {
  cash: number;
  instapay: number;
  vodafoneCash: number;
  visa: number;
  other?: number;
}

export interface ClosedDay {
  id: string;
  timestamp: number;
  formattedDate: string;
  formattedTime: string;
  totalSales: number;
  totalDiscounts?: number;
  totalExpenses?: number;
  netSales?: number;
  invoiceCount: number;
  invoiceIds: string[];
  totalItemsSold?: number;
  discountedInvoicesCount?: number;
  paymentBreakdown?: PaymentMethodsBreakdown;
  employeeRankings?: Array<{
    name: string;
    totalSales: number;
    invoiceCount?: number;
  }>;
}

export interface ArchivedEmployeeSales {
  id: string;
  employeeName: string;
  deletionTimestamp?: number;
  deletedAt?: number;
  deletionDateStr?: string;
  dateStr?: string;
  totalSales: number;
  totalExpenses?: number;
  netSales?: number;
  invoiceCount: number;
  itemsSold?: number;
  invoicesCopied: Invoice[];
}

export interface SystemData {
  products: Product[];
  invoices: Invoice[];
  passwordRequired: string;
}

export type SyncOperationType = "create" | "update" | "delete";

export interface SyncOperationInput {
  operationId?: string;
  entityTable: string;
  entityId: string;
  operationType: SyncOperationType;
  payload?: unknown;
  createdAt?: number;
}

export interface SyncOperation extends SyncOperationInput {
  operationId: string;
  deviceId: string;
  payload: unknown;
  createdAt: number;
  status: "pending" | "processing" | "synced" | "failed";
  attemptCount: number;
  lastAttemptAt?: number | null;
  lastError?: string | null;
  syncedAt?: number | null;
}

export interface SyncTombstoneInput {
  tombstoneId?: string;
  entityTable: string;
  entityId: string;
  operationId?: string;
  deletedAt?: number;
}

export interface SyncTombstone {
  tombstoneId: string;
  deviceId: string;
  entityTable: string;
  entityId: string;
  operationId?: string | null;
  deletedAt: number;
}

export interface SyncState {
  key: string;
  value: string;
  updatedAt: number;
}

export interface RealtimeStatus {
  running: boolean;
  processing: boolean;
  lastRunAt: number | null;
  lastError: string | null;
  lastProcessedCount: number;
}

export interface LanStatus {
  mode: "stopped" | "host" | "client";
  connected: boolean;
  peerCount: number;
  lastTestMessage: unknown;
  lastError: string | null;
  connectionInfo: { mode: string; host: string; port: number; protocolVersion: number } | null;
}

export type UpdaterState = "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "installing" | "error";

export interface UpdaterStatus {
  state: UpdaterState;
  currentVersion: string;
  availableVersion: string | null;
  progress: number;
  error: string | null;
  providerConfigured: boolean;
}

// Global Electron API interface
export interface ElectronApi {
  products: {
    getAll: () => Promise<Product[]>;
    getById: (id: string) => Promise<Product | null>;
    create: (product: Product) => Promise<Product>;
    update: (product: Product) => Promise<Product>;
    updateStock: (id: string, stock: number) => Promise<Product>;
    delete: (id: string) => Promise<boolean>;
  };
  invoices: {
    getAll: (options?: { page?: number; limit?: number; search?: string; seller?: string; date?: string; closedDayId?: string }) => Promise<Invoice[]>;
    getById: (id: string) => Promise<Invoice | null>;
    create: (invoiceData: Invoice) => Promise<Invoice>;
    update: (invoice: Invoice) => Promise<Invoice | null>;
    delete: (id: string) => Promise<boolean>;
    getNextInvoiceNumber: () => Promise<string>;
  };
  deletedInvoices: {
    getAll: () => Promise<Invoice[]>;
  };
  employees: {
    getAll: () => Promise<{ id: string; name: string }[]>;
    create: (name: string) => Promise<{ id: string; name: string }[]>;
    update: (oldName: string, newName: string) => Promise<{ id: string; name: string }[]>;
    delete: (name: string) => Promise<{ id: string; name: string }[]>;
  };
  categories: {
    getAll: () => Promise<string[]>;
    create: (name: string) => Promise<string[]>;
    delete: (name: string) => Promise<string[]>;
  };
  closedDays: {
    getAll: () => Promise<ClosedDay[]>;
    create: (data: ClosedDay) => Promise<ClosedDay[]>;
  };
  expenses: {
    getAll: () => Promise<Expense[]>;
    create: (expense: Expense) => Promise<Expense>;
    delete: (id: string) => Promise<boolean>;
  };
  archivedSales: {
    getAll: () => Promise<ArchivedEmployeeSales[]>;
    create: (data: ArchivedEmployeeSales) => Promise<ArchivedEmployeeSales[]>;
  };
  settings: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<boolean>;
  };
  backups: {
    createBackup: () => Promise<{ success: boolean; path?: string; filename?: string; error?: string }>;
    listBackups: () => Promise<{ name: string; path: string; size: number; mtime: string }[]>;
    restoreBackup: (name: string) => Promise<{ success: boolean; error?: string }>;
  };
  migration: {
    runMigrationIfNeeded: (legacyData: any) => Promise<{ migrated: boolean; error?: string; reason?: string }>;
  };
  appInfo: {
    getUserDataPath: () => Promise<string>;
  };
  updater: {
    getStatus: () => Promise<UpdaterStatus>;
    check: () => Promise<UpdaterStatus>;
    download: () => Promise<UpdaterStatus>;
    install: () => Promise<UpdaterStatus>;
    onStatus: (listener: (status: UpdaterStatus) => void) => () => void;
  };
  sync: {
    getDeviceId: () => Promise<string>;
    createOperation: (operation: SyncOperationInput) => Promise<SyncOperation | null>;
    getOperation: (operationId: string) => Promise<SyncOperation | null>;
    getPendingOperations: (limit?: number) => Promise<SyncOperation[]>;
    markOperationSynced: (operationId: string) => Promise<boolean>;
    markOperationFailed: (operationId: string, errorMessage: string) => Promise<boolean>;
    recordTombstone: (tombstone: SyncTombstoneInput) => Promise<SyncTombstone | null>;
    getTombstone: (entityTable: string, entityId: string) => Promise<SyncTombstone | null>;
    getTombstones: (limit?: number) => Promise<SyncTombstone[]>;
    getState: (key?: string) => Promise<string | SyncState[] | null>;
    setState: (key: string, value: string) => Promise<boolean>;
  };
  realtime: {
    start: () => Promise<RealtimeStatus>;
    stop: () => Promise<RealtimeStatus>;
    getStatus: () => Promise<RealtimeStatus>;
    processPending: (limit?: number) => Promise<{ processed: number; skipped: boolean; reason?: string }>;
  };
  lan: {
    getPrivateAddresses: () => Promise<string[]>;
    startHost: (options?: { host?: string; port?: number }) => Promise<LanStatus>;
    stopHost: () => Promise<LanStatus>;
    getStatus: () => Promise<LanStatus>;
    createPairingCode: () => Promise<{ code: string; expiresAt: number }>;
    connect: (options: { host: string; port: number; pairingCode?: string }) => Promise<LanStatus>;
    disconnect: () => Promise<LanStatus>;
    sendTestMessage: (payload?: Record<string, unknown>) => Promise<unknown>;
    getLastTestMessage: () => Promise<unknown>;
    confirmTestMessage: (testId: string) => Promise<boolean>;
  };
}

declare global {
  interface Window {
    api?: ElectronApi;
  }
}
