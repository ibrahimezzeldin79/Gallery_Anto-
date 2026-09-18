import React, { useState, useEffect } from "react";
import { Product, CartItem, Invoice, ArchivedEmployeeSales, ClosedDay, Expense } from "./types";
import { INITIAL_PRODUCTS, getInitialInvoices, generateBarcode } from "./initialData";
import { compressImageDataUrl, safeSetLocalStorage } from "./utils/imageCompressor";
import { idbGet, idbSet, idbRemove } from "./utils/idbStorage";
import { dbApi, resolveProductImageUrl } from "./utils/databaseApi";
import Dashboard from "./components/Dashboard";
import Products from "./components/Products";
import Sales from "./components/Sales";
import Invoices from "./components/Invoices";
import Inventory from "./components/Inventory";
import Reports from "./components/Reports";
import Employees from "./components/Employees";
import Expenses from "./components/Expenses";
import InvoiceViewer from "./components/InvoiceViewer";
import SettingsComponent from "./components/Settings";
import { sendInvoiceDeletionSMS } from "./utils/sms";
import { calculatePaymentBreakdown } from "./utils/printer";
import Auth from "./components/Auth";

import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  ClipboardList, 
  BarChart3, 
  Clock, 
  Store,
  RefreshCw,
  FileText,
  Users,
  Lock,
  Unlock,
  Settings,
  Menu,
  X,
  Receipt
} from "lucide-react";

// Helper to ensure every product has a unique, non-empty barcode without overwriting custom barcodes
const ensureUniqueBarcodes = (prods: Product[]): Product[] => {
  const used = new Set<string>();
  return prods.map((prod) => {
    let code = (prod.barcode || "").trim();
    if (!code || used.has(code)) {
      let nextNum = 1;
      while (used.has(nextNum.toString())) {
        nextNum++;
      }
      code = nextNum.toString();
    }
    used.add(code);
    return {
      ...prod,
      barcode: code,
    };
  });
};

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("sales");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ email: string; name: string } | null>(() => {
    const saved = localStorage.getItem("anto_current_user");
    return saved ? JSON.parse(saved) : null;
  });
  
  const [fontScale, setFontScale] = useState<"normal" | "large" | "xlarge" | "xxlarge">(() => {
    const saved = localStorage.getItem("anto_font_scale");
    return (saved as any) || "normal";
  });

  // Watch and apply font scaling directly to HTML node (rem based scaling)
  useEffect(() => {
    const root = document.documentElement;
    if (fontScale === "large") {
      root.style.fontSize = "17.5px"; // +10% Scale up
    } else if (fontScale === "xlarge") {
      root.style.fontSize = "19px"; // +18% Scale up
    } else if (fontScale === "xxlarge") {
      root.style.fontSize = "21px"; // +30% Scale up for low-vision readers
    } else {
      root.style.fontSize = "16px"; // Normal base
    }
  }, [fontScale]);

  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [deletedInvoices, setDeletedInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  
  // Closed Days archive for daily accounting shift closing sessions
  const [closedDays, setClosedDays] = useState<ClosedDay[]>([]);
  
  // Financial password unlock states
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem("anto_financials_unlocked") === "true";
  });

  // Dynamic security password state
  const [securityPassword, setSecurityPassword] = useState<string>("0000");

  // Dynamic invoice deletion password state
  const [invoiceDeletionPassword, setInvoiceDeletionPassword] = useState<string>("0000");

  // Dynamic deleted employees archive (non-losable history)
  const [deletedEmployeesArchive, setDeletedEmployeesArchive] = useState<ArchivedEmployeeSales[]>([]);

  // Registered employees list
  const [employees, setEmployees] = useState<string[]>([]);

  // Registered product categories/classifications list
  const [categories, setCategories] = useState<string[]>([]);
  
  // Persistent Cashier Cart State (Requirement 2)
  const [salesCart, setSalesCart] = useState<CartItem[]>(() => {
    try {
      const saved = sessionStorage.getItem("anto_sales_cart");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // State to track if an existing invoice is being edited in POS
  const [editingInvoiceInPOS, setEditingInvoiceInPOS] = useState<Invoice | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem("anto_sales_cart", JSON.stringify(salesCart));
    } catch {}
  }, [salesCart]);

  // Real-time ticking Clock for cashier's screen
  const [time, setTime] = useState(new Date());

  // Automatic Lock Reset on Page switch (Lock only when leaving admin/protected pages)
  useEffect(() => {
    const isProtectedTab = ["dashboard", "reports", "employees", "inventory", "products", "expenses"].includes(activeTab);
    if (!isProtectedTab) {
      setIsUnlocked(false);
      sessionStorage.removeItem("anto_financials_unlocked");
    }
  }, [activeTab]);

  // 1. Load data whenever currentUser changes
  useEffect(() => {
    if (!currentUser) return;

    const email = currentUser.email;

    async function loadAllData() {
      // 1. Fetch current data from Database API
      let dbProducts = await dbApi.products.getAll();
      let dbInvoices = await dbApi.invoices.getAll();
      let dbDeletedInvoices = await dbApi.deletedInvoices.getAll();
      let dbExpenses = await dbApi.expenses.getAll();
      let dbEmployees = await dbApi.employees.getAll();
      let dbCategories = await dbApi.categories.getAll();
      let dbClosedDays = await dbApi.closedDays.getAll();
      let dbArchivedSales = await dbApi.archivedSales.getAll();
      let dbSecurityPass = await dbApi.settings.get("security_password");
      let dbDeletionPass = await dbApi.settings.get("deletion_password");

      // 2. Read legacy LocalStorage/IndexedDB data if database is empty or needs migration
      const savedProducts = await idbGet<Product[]>("anto_products_" + email);
      const savedInvoices = await idbGet<Invoice[]>("anto_invoices_" + email);
      const savedPassword = await idbGet<string>("anto_security_password_" + email);
      const savedEmployees = await idbGet<string[]>("anto_employees_list_" + email);
      const savedDeletedInvoices = await idbGet<Invoice[]>("anto_deleted_invoices_" + email);
      const savedDelPassword = await idbGet<string>("anto_deletion_password_" + email);
      const savedArchive = await idbGet<ArchivedEmployeeSales[]>("anto_deleted_employees_archive_" + email);
      const savedClosedDays = await idbGet<ClosedDay[]>("anto_closed_days_" + email);
      const savedCategories = await idbGet<string[]>("anto_categories_" + email);

      if (dbProducts.length === 0) {
        const defaultCats = ["انتيكات", "مجسمات", "صواني", "شمعدان", "شلالات", "ڤازات", "تسالي", "شجر", "براويز", "ساعات"];
        const defaultEmps = ["أحمد كامل", "محمد علي", "مصطفى محمود"];

        const legacyPayload = {
          products: savedProducts && savedProducts.length > 0 ? savedProducts : (email === "demo@gallery.com" ? INITIAL_PRODUCTS : []),
          invoices: savedInvoices && savedInvoices.length > 0 ? savedInvoices : (email === "demo@gallery.com" ? getInitialInvoices(INITIAL_PRODUCTS) : []),
          deletedInvoices: savedDeletedInvoices || [],
          employees: savedEmployees && savedEmployees.length > 0 ? savedEmployees : defaultEmps,
          categories: savedCategories && savedCategories.length > 0 ? savedCategories : defaultCats,
          closedDays: savedClosedDays || [],
          archivedSales: savedArchive || []
        };

        await dbApi.migration.runMigrationIfNeeded(legacyPayload);

        // Re-read from database API
        dbProducts = await dbApi.products.getAll();
        dbInvoices = await dbApi.invoices.getAll();
        dbDeletedInvoices = await dbApi.deletedInvoices.getAll();
        dbExpenses = await dbApi.expenses.getAll();
        dbEmployees = await dbApi.employees.getAll();
        dbCategories = await dbApi.categories.getAll();
        dbClosedDays = await dbApi.closedDays.getAll();
        dbArchivedSales = await dbApi.archivedSales.getAll();
      }

      setProducts(ensureUniqueBarcodes(dbProducts));
      setInvoices(dbInvoices);
      setDeletedInvoices(dbDeletedInvoices.length > 0 ? dbDeletedInvoices : (savedDeletedInvoices || []));
      setExpenses(dbExpenses);
      setEmployees(dbEmployees.map((e) => e.name));
      setCategories(dbCategories.length > 0 ? dbCategories : ["انتيكات", "مجسمات", "صواني", "شمعدان", "شلالات", "ڤازات", "تسالي", "شجر", "براويز", "ساعات"]);
      setClosedDays(dbClosedDays);
      setDeletedEmployeesArchive(dbArchivedSales);

      if (dbSecurityPass) setSecurityPassword(dbSecurityPass);
      else if (savedPassword) setSecurityPassword(savedPassword);
      else setSecurityPassword("0000");

      if (dbDeletionPass) setInvoiceDeletionPassword(dbDeletionPass);
      else if (savedDelPassword) setInvoiceDeletionPassword(savedDelPassword);
      else setInvoiceDeletionPassword("0000");
    }

    loadAllData();
  }, [currentUser]);

  // Timer useEffect for real-time Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogin = (session: { email: string; name: string }) => {
    setCurrentUser(session);
    localStorage.setItem("anto_current_user", JSON.stringify(session));
  };

  const handleLogout = () => {
    localStorage.removeItem("anto_current_user");
    setCurrentUser(null);
    setActiveTab("sales");
  };

  // 2. SQLite Database CRUD Operations via dbApi
  const handleAddProduct = async (newProd: Product) => {
    if (!currentUser) return;
    let targetBarcode = (newProd.barcode || "").trim();
    if (!targetBarcode) {
      targetBarcode = generateBarcode(products);
    }
    const prodToSave = { ...newProd, barcode: targetBarcode };
    await dbApi.products.create(prodToSave);
    const updated = await dbApi.products.getAll();
    setProducts(ensureUniqueBarcodes(updated));
  };

  const handleDeleteProduct = async (id: string) => {
    if (!currentUser) return;
    await dbApi.products.delete(id);
    const updated = await dbApi.products.getAll();
    setProducts(ensureUniqueBarcodes(updated));
  };

  const handleUpdateProduct = async (updatedProduct: Product) => {
    if (!currentUser) return;
    await dbApi.products.update(updatedProduct);
    const updated = await dbApi.products.getAll();
    setProducts(ensureUniqueBarcodes(updated));
  };

  const handleUpdateStock = async (productId: string, newStock: number) => {
    if (!currentUser) return;
    await dbApi.products.updateStock(productId, newStock);
    const updated = await dbApi.products.getAll();
    setProducts(ensureUniqueBarcodes(updated));
  };

  const handleAddCategory = async (catName: string) => {
    if (!currentUser) return;
    const trimmed = catName.trim();
    if (!trimmed) return;
    await dbApi.categories.create(trimmed);
    const updatedCats = await dbApi.categories.getAll();
    setCategories(updatedCats);
  };

  const handleDeleteCategory = async (catToDelete: string) => {
    if (!currentUser) return;
    await dbApi.categories.delete(catToDelete);
    const updatedCats = await dbApi.categories.getAll();
    const updatedProds = await dbApi.products.getAll();
    setCategories(updatedCats);
    setProducts(ensureUniqueBarcodes(updatedProds));
  };

  const handleAddEmployee = async (name: string) => {
    if (!currentUser) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const updatedEmps = await dbApi.employees.create(trimmed);
    setEmployees(updatedEmps.map((e) => e.name));
  };

  const handleUpdateEmployee = async (oldName: string, newName: string) => {
    if (!currentUser) return;
    const trimmedOld = oldName.trim();
    const trimmedNew = newName.trim();
    if (!trimmedOld || !trimmedNew || trimmedOld === trimmedNew) return;

    await dbApi.employees.update(trimmedOld, trimmedNew);

    const updatedEmps = await dbApi.employees.getAll();
    const updatedInvs = await dbApi.invoices.getAll();
    const updatedDeletedInvs = await dbApi.deletedInvoices.getAll();
    const updatedExpenses = await dbApi.expenses.getAll();
    const updatedArchives = await dbApi.archivedSales.getAll();

    setEmployees(updatedEmps.map((e) => e.name));
    setInvoices(updatedInvs);
    setDeletedInvoices(updatedDeletedInvs);
    setExpenses(updatedExpenses);
    setDeletedEmployeesArchive(updatedArchives);
  };

  const handleDeleteEmployee = async (name: string) => {
    if (!currentUser) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const normName = (str: string) => {
      return str
        .trim()
        .replace(/[أإآا]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/[ىي]/g, "ي")
        .replace(/\s+/g, " ");
    };

    const targetNorm = normName(trimmed);

    const workerInvoices = invoices.filter((inv) => inv.sellerName && normName(inv.sellerName) === targetNorm);
    const totalSales = workerInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const invoiceCount = workerInvoices.length;
    const itemsSold = workerInvoices.reduce((sum, inv) => sum + inv.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);

    const archiveRecord: ArchivedEmployeeSales = {
      id: "arch_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
      employeeName: trimmed,
      dateStr: new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      deletionTimestamp: Date.now(),
      deletedAt: Date.now(),
      deletionDateStr: new Date().toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      totalSales,
      invoiceCount,
      itemsSold,
      invoicesCopied: JSON.parse(JSON.stringify(workerInvoices)),
    };

    await dbApi.archivedSales.create(archiveRecord);
    await dbApi.employees.delete(trimmed);

    const updatedEmps = await dbApi.employees.getAll();
    const updatedArchives = await dbApi.archivedSales.getAll();
    const updatedInvs = await dbApi.invoices.getAll();

    setEmployees(updatedEmps.map((e) => e.name));
    setDeletedEmployeesArchive(updatedArchives);
    setInvoices(updatedInvs);
  };

  const handleUpdatePassword = async (newPass: string) => {
    if (!currentUser) return;
    setSecurityPassword(newPass);
    await dbApi.settings.set("security_password", newPass);
  };

  const handleUpdateDeletionPassword = async (newPass: string) => {
    if (!currentUser) return;
    setInvoiceDeletionPassword(newPass);
    await dbApi.settings.set("deletion_password", newPass);
  };

  const handleAddInvoice = async (newInv: Invoice): Promise<Invoice | null> => {
    if (!currentUser) return null;
    const created = await dbApi.invoices.create(newInv);

    const updatedInvs = await dbApi.invoices.getAll();
    const updatedProds = await dbApi.products.getAll();
    setInvoices(updatedInvs);
    setProducts(ensureUniqueBarcodes(updatedProds));

    if (newInv.sellerName) {
      await dbApi.employees.create(newInv.sellerName);
      const emps = await dbApi.employees.getAll();
      setEmployees(emps.map((e) => e.name));
    }

    return created || null;
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!currentUser) return;
    const targetInvoice = invoices.find((inv) => inv.id === id);

    await dbApi.invoices.delete(id);

    const updatedInvs = await dbApi.invoices.getAll();
    const updatedDeletedInvs = await dbApi.deletedInvoices.getAll();
    const updatedProds = await dbApi.products.getAll();
    const updatedClosedDays = await dbApi.closedDays.getAll();

    setInvoices(updatedInvs);
    setDeletedInvoices(updatedDeletedInvs);
    setProducts(ensureUniqueBarcodes(updatedProds));
    setClosedDays(updatedClosedDays);

    if (targetInvoice) {
      try {
        await sendInvoiceDeletionSMS({
          invoiceNumber: targetInvoice.invoiceNumber,
          total: targetInvoice.total,
          date: targetInvoice.formattedDate,
          time: targetInvoice.formattedTime,
          sellerName: targetInvoice.sellerName
        });
      } catch (err) {
        console.error("SMS notification dispatch failed:", err);
      }
    }
  };

  const handleUpdateInvoice = async (updatedInvoice: Invoice) => {
    if (!currentUser) return;
    await dbApi.invoices.update(updatedInvoice);

    if (updatedInvoice.sellerName && updatedInvoice.sellerName.trim()) {
      await dbApi.employees.create(updatedInvoice.sellerName.trim());
    }

    const updatedInvs = await dbApi.invoices.getAll();
    const updatedProds = await dbApi.products.getAll();
    const updatedEmps = await dbApi.employees.getAll();
    const updatedClosedDays = await dbApi.closedDays.getAll();

    setInvoices(updatedInvs);
    setProducts(ensureUniqueBarcodes(updatedProds));
    setEmployees(updatedEmps.map((e) => e.name));
    setClosedDays(updatedClosedDays);
    setEditingInvoiceInPOS(null);
  };

  const handleStartEditInvoiceInPOS = (inv: Invoice) => {
    // Convert invoice items to CartItems
    const loadedCart: CartItem[] = inv.items.map((it) => {
      const existingProduct = products.find(
        (p) => p.id === it.productId || p.name.trim().toLowerCase() === it.name.trim().toLowerCase()
      );
      if (existingProduct) {
        return {
          product: existingProduct,
          quantity: it.quantity,
          customPrice: it.price
        };
      }
      return {
        product: {
          id: it.productId || `prod-custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: it.name,
          price: it.basePrice || it.price,
          stock: 9999,
          category: "أخرى",
          barcode: "",
          description: ""
        },
        quantity: it.quantity,
        customPrice: it.price
      };
    });

    setSalesCart(loadedCart);
    setEditingInvoiceInPOS(inv);
    setActiveTab("sales");
  };

  const handleAddExpense = async (newExpense: Expense) => {
    if (!currentUser) return;
    await dbApi.expenses.create(newExpense);
    const updated = await dbApi.expenses.getAll();
    setExpenses(updated);
  };

  const handleDeleteExpense = async (id: string) => {
    if (!currentUser) return;
    await dbApi.expenses.delete(id);
    const updated = await dbApi.expenses.getAll();
    setExpenses(updated);
  };

  const handleCloseDay = async (activeInvoicesToClose: Invoice[]) => {
    if (!currentUser) return;
    const now = new Date();
    const earliestInvoiceTimestamp = activeInvoicesToClose.length > 0
      ? Math.min(...activeInvoicesToClose.map(inv => inv.timestamp))
      : now.getTime();

    const shiftDate = new Date(earliestInvoiceTimestamp);
    const formattedDate = shiftDate.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const formattedTime = now.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit", hour12: true });

    const closingTime = now.getTime();
    const newClosedDayId = "day-close-" + closingTime;
    const totalSales = activeInvoicesToClose.reduce((sum, inv) => sum + inv.total, 0);
    const totalDiscounts = activeInvoicesToClose.reduce((sum, inv) => sum + (inv.discount || 0), 0);
    const totalItemsSold = activeInvoicesToClose.reduce((sum, inv) => sum + inv.items.reduce((s, item) => s + item.quantity, 0), 0);

    const discountedInvoicesCount = activeInvoicesToClose.filter((inv) =>
      inv.isDiscountedBelowBase ||
      (inv.discount && inv.discount > 0) ||
      inv.items.some(it => it.basePrice && it.price < it.basePrice)
    ).length;

    const paymentBreakdown = calculatePaymentBreakdown(activeInvoicesToClose);

    const employeeMap: Record<string, { name: string; invoiceCount: number; totalSales: number }> = {};
    activeInvoicesToClose.forEach(inv => {
      const seller = (inv.sellerName || "مبيعات عامة").trim();
      if (!employeeMap[seller]) {
        employeeMap[seller] = { name: seller, invoiceCount: 0, totalSales: 0 };
      }
      employeeMap[seller].invoiceCount += 1;
      employeeMap[seller].totalSales += inv.total;
    });
    const employeeRankings = Object.values(employeeMap).sort((a, b) => b.totalSales - a.totalSales);

    const activeExpenses = expenses.filter((e) => !e.closedDayId);
    const totalExpenses = activeExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netSales = totalSales - totalExpenses;

    const newClosedDay: ClosedDay = {
      id: newClosedDayId,
      timestamp: closingTime,
      formattedDate,
      formattedTime,
      totalSales,
      totalDiscounts,
      totalExpenses,
      netSales,
      invoiceCount: activeInvoicesToClose.length,
      invoiceIds: activeInvoicesToClose.map(inv => inv.id),
      totalItemsSold,
      discountedInvoicesCount,
      paymentBreakdown,
      employeeRankings
    };

    await dbApi.closedDays.create(newClosedDay);

    const updatedClosedDays = await dbApi.closedDays.getAll();
    const updatedInvoices = await dbApi.invoices.getAll();
    const updatedExpenses = await dbApi.expenses.getAll();

    setClosedDays(updatedClosedDays);
    setInvoices(updatedInvoices);
    setExpenses(updatedExpenses);
  };

  // Reset current user account to clean values
  const handleFactoryReset = () => {
    if (!currentUser) return;
    const email = currentUser.email;

    if (email === "demo@gallery.com") {
      const confirmReset = window.confirm("هل تريد إعادة ضبط بيانات الحساب التجريبي إلى القيم الافتراضية؟");
      if (confirmReset) {
        idbRemove("anto_products_" + email);
        idbRemove("anto_invoices_" + email);
        idbRemove("anto_deleted_invoices_" + email);
        idbRemove("anto_closed_days_" + email);
        setProducts(INITIAL_PRODUCTS);
        const seeded = getInitialInvoices(INITIAL_PRODUCTS);
        setInvoices(seeded);
        setDeletedInvoices([]);
        setClosedDays([]);
        safeSetLocalStorage("anto_invoices_" + email, seeded);
        setActiveTab("dashboard");
      }
    } else {
      const confirmReset = window.confirm("هل تريد مسح كآفة منتجاتك وفواتيرك المسجلة والبدء بصفحة فارغة تماماً؟");
      if (confirmReset) {
        idbRemove("anto_products_" + email);
        idbRemove("anto_invoices_" + email);
        idbRemove("anto_deleted_invoices_" + email);
        idbRemove("anto_closed_days_" + email);
        setProducts([]);
        setInvoices([]);
        setDeletedInvoices([]);
        setClosedDays([]);
        setActiveTab("dashboard");
      }
    }
  };

  // Format Helper for top banner clock
  const formattedDay = time.toLocaleDateString("ar-EG", { weekday: "long" });
  const formattedDate = time.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const formattedTimeStr = time.toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });

  const renderActiveTabContent = () => {
    // Check if page requires security lock
    const isProtectedTab = ["dashboard", "reports", "employees", "inventory", "products", "expenses"].includes(activeTab);

    if (isProtectedTab && !isUnlocked) {
      return (
        <div className="flex items-center justify-center py-20 bg-[#f0f2f5] h-full" dir="rtl">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-lg border border-slate-200/80 text-right space-y-6 animate-scaleUp">
            <div className="flex items-center justify-center w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl mx-auto shadow-sm">
              <Lock className="w-6 h-6 animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-base font-extrabold text-slate-800">هذه الصفحة محمية بنظام الحماية</h3>
              <p className="text-xs text-slate-400">يرجى إدخال كلمة المرور الإدارية للتمكن من فك التشفير وعرض المحتوى.</p>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const input = form.elements.namedItem("pass") as HTMLInputElement;
              if (input.value === securityPassword) {
                sessionStorage.setItem("anto_financials_unlocked", "true");
                setIsUnlocked(true);
              } else {
                alert("⚠️ الرمز السري خاطئ! يرجى إدخال كلمة المرور الصحيحة للمتابعة.");
                input.value = "";
                input.focus();
              }
            }} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-slate-400 block mb-1">كلمة المرور المشتركة</label>
                <input
                  type="password"
                  name="pass"
                  autoFocus
                  required
                  placeholder="أدخل كلمة مرور المدراء..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-mono font-bold text-slate-800 py-3 px-3.5 focus:ring-2 focus:ring-blue-550 focus:outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-95"
              >
                تأكيد وفك التشفير
              </button>
            </form>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case "dashboard":
        return (
          <Dashboard 
            products={products} 
            invoices={invoices} 
            expenses={expenses}
            setActiveTab={setActiveTab}
            onViewInvoice={(inv) => setSelectedInvoice(inv)}
            securityPassword={securityPassword}
            closedDays={closedDays}
            onCloseDay={handleCloseDay}
          />
        );
      case "products":
        return (
          <Products 
            products={products} 
            onAddProduct={handleAddProduct} 
            onDeleteProduct={handleDeleteProduct} 
            onUpdateProduct={handleUpdateProduct}
            categories={categories}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
          />
        );
      case "sales":
        return (
          <Sales 
            products={products} 
            invoices={invoices} 
            onAddInvoice={handleAddInvoice} 
            onDeleteInvoice={handleDeleteInvoice}
            onUpdateStock={handleUpdateStock}
            onViewInvoice={(inv) => setSelectedInvoice(inv)}
            onAddProduct={handleAddProduct}
            employees={employees}
            deletionPassword={invoiceDeletionPassword}
            categories={categories}
            onDeleteCategory={handleDeleteCategory}
            cart={salesCart}
            setCart={setSalesCart}
            editingInvoice={editingInvoiceInPOS}
            onSaveEditedInvoice={handleUpdateInvoice}
            onCancelEditInvoice={() => {
              setEditingInvoiceInPOS(null);
              setSalesCart([]);
            }}
          />
        );
      case "invoices":
        return (
          <Invoices 
            invoices={invoices} 
            deletedInvoices={deletedInvoices}
            onDeleteInvoice={handleDeleteInvoice}
            onUpdateInvoice={handleUpdateInvoice}
            onEditInvoiceInPOS={handleStartEditInvoiceInPOS}
            onViewInvoice={(inv) => setSelectedInvoice(inv)}
            deletionPassword={invoiceDeletionPassword}
            employees={employees}
          />
        );
      case "inventory":
        return (
          <Inventory 
            products={products} 
            onUpdateStock={handleUpdateStock} 
          />
        );
      case "reports":
        return (
          <Reports 
            products={products} 
            invoices={invoices} 
            expenses={expenses}
            onNavigateToInvoices={() => setActiveTab("invoices")}
            onNavigateToDashboard={(scrollToPanel) => {
              setActiveTab("dashboard");
              if (scrollToPanel) {
                setTimeout(() => {
                  const el = document.getElementById("active-shift-invoices-panel");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }, 150);
              }
            }}
            onViewInvoice={(inv) => setSelectedInvoice(inv)}
            securityPassword={securityPassword}
            closedDays={closedDays}
          />
        );
      case "expenses":
        return (
          <Expenses 
            expenses={expenses}
            invoices={invoices}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            sellerName={currentUser.name}
            employees={employees}
          />
        );
      case "employees":
        return (
          <Employees 
            invoices={invoices} 
            onViewInvoice={(inv) => setSelectedInvoice(inv)}
            employees={employees}
            deletedEmployeesArchive={deletedEmployeesArchive}
            onAddEmployee={handleAddEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            onUpdateEmployee={handleUpdateEmployee}
          />
        );
      case "settings":
        return (
          <SettingsComponent 
            currentPassword={securityPassword}
            onUpdatePassword={handleUpdatePassword}
            deletionPassword={invoiceDeletionPassword}
            onUpdateDeletionPassword={handleUpdateDeletionPassword}
            fontScale={fontScale}
            onUpdateFontScale={(scale) => {
              setFontScale(scale as any);
              localStorage.setItem("anto_font_scale", scale);
            }}
          />
        );
      default:
        return null;
    }
  };

  if (!currentUser) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="h-screen w-screen bg-[#f0f2f5] text-[#1e293b] flex overflow-hidden font-sans select-none" dir="rtl">
      
      {/* SIDEBAR NAVIGATION (NO-PRINT) */}
      <aside className={`bg-[#0f172a] text-white flex flex-col justify-between border-l border-slate-800 shrink-0 no-print overflow-y-auto h-full max-h-screen sidebar-scrollbar transition-all duration-300 ${
        isSidebarCollapsed ? "w-0 p-0 overflow-hidden border-none opacity-0 pointer-events-none" : "w-64 p-6"
      }`}>
        <div className="space-y-8">
          {/* Logo / Header Brand with Toggle Button (REQUIREMENT 4) */}
          <div className="text-center group relative">
            <button 
              onClick={() => setIsSidebarCollapsed(true)}
              className="absolute left-0 top-0 p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded-xl transition-all cursor-pointer border border-slate-700 shadow-sm"
              title="إخفاء القائمة الجانبية لتكبير الشاشة"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform">
              <Store className="w-6 h-6 text-white" />
            </div>
            <div className="text-2xl font-black tracking-wider text-blue-450 mt-4 leading-none font-sans">
              GALLERY ANTO
            </div>
            <div className="text-[10px] uppercase text-slate-500 tracking-widest mt-1.5 font-bold">
              نظام إدارة المبيعات والمخزن
            </div>
          </div>

          {/* Time & Clock indicator */}
          <div className="bg-slate-800/40 border border-slate-800/50 p-4 rounded-2xl space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <Clock className="w-3.5 h-3.5 text-blue-450 animate-pulse" />
              <span>توقيت النظام الحالي</span>
            </div>
            <p className="text-xs font-black text-slate-200">{formattedDay}، {formattedDate}</p>
            <p className="font-mono text-sm font-bold text-blue-400" dir="ltr">{formattedTimeStr}</p>
          </div>

          {/* Nav Links */}
          <nav className="space-y-2.5">
            {[
              { id: "sales", label: "شاشة الكاشير", icon: ShoppingBag },
              { id: "invoices", label: "سجل الفواتير", icon: FileText },
              { id: "expenses", label: "المصروفات اليومية", icon: Receipt },
              { id: "dashboard", label: "الرئيسية والتحكم", icon: LayoutDashboard },
              { id: "products", label: "المنتجات", icon: Package },
              { id: "inventory", label: "كمية المنتجات", icon: ClipboardList },
              { id: "reports", label: "التقارير المالية", icon: BarChart3 },
              { id: "employees", label: "العمال والمبيعات", icon: Users },
              { id: "settings", label: "الإعدادات والأمان", icon: Settings },
            ].map((tab) => {
              const IconComp = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3.5 p-4 rounded-xl cursor-pointer transition-all border text-right font-black text-sm sm:text-base leading-none select-none ${
                    isActive
                      ? "bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/20 drop-shadow-[0_0_5px_rgba(255,255,255,0.75)]"
                      : "bg-slate-900/40 border-transparent text-slate-100 hover:text-white hover:bg-slate-800 hover:border-slate-750 drop-shadow-[0_0_2px_rgba(255,255,255,0.3)] hover:drop-shadow-[0_0_5.5px_rgba(255,255,255,0.7)]"
                  }`}
                >
                  <IconComp className={`w-5 h-5 shrink-0 ${isActive ? "text-white filter drop-shadow-[0_0_2.5px_rgba(255,255,255,0.6)]" : "text-slate-350"}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Card & Reset config */}
        <div className="space-y-3 pt-6 border-t border-slate-800">
          <div className="bg-slate-800/30 p-3 rounded-xl">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[10px] text-slate-500 font-bold">المتجر الحالي</p>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <p className="text-xs font-bold text-slate-200 truncate" title={currentUser.name}>
              {currentUser.name}
            </p>
            <p className="text-[9px] font-mono text-slate-400 mt-0.5 truncate" title={currentUser.email}>
              {currentUser.email}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleFactoryReset}
              className="flex-1 py-2 bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-orange-400 rounded-lg text-[9px] font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer border border-slate-850"
              title="إعادة ضبط وتصفير البيانات للحساب الحالي"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>ضبط الحساب</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-2.5 py-2 bg-rose-950/20 hover:bg-rose-900/30 text-rose-450 rounded-lg text-[9px] font-bold transition-all border border-rose-900/40 cursor-pointer text-center"
            >
              خروج
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN VIEW CANVAS */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Floating Sidebar Toggle Button when Sidebar is Collapsed */}
        {isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            className="fixed top-3 right-3 z-40 bg-slate-900 hover:bg-slate-800 text-amber-400 px-3 py-2 rounded-2xl border border-slate-700 shadow-2xl flex items-center gap-2 text-xs font-black cursor-pointer hover:scale-105 transition-all opacity-90 hover:opacity-100"
            title="إظهار القائمة الجانبية"
          >
            <Menu className="w-4 h-4 text-amber-400" />
            <span>القائمة الجانبية</span>
          </button>
        )}

        {/* Dynamic tabs viewport (Top header navbar completely removed as requested) */}
        <section className={`flex-1 overflow-y-auto no-print bg-[#f0f2f5] transition-all ${
          isSidebarCollapsed ? "p-2.5 sm:p-4" : "p-6"
        }`}>
          {renderActiveTabContent()}
        </section>
      </main>

      {/* OVERLAY VIEWER */}
      {selectedInvoice && (
        <InvoiceViewer 
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

    </div>
  );
}
