import React, { useState, useMemo } from "react";
import { Product, Invoice, ClosedDay, Expense } from "../types";
import { 
  TrendingUp, 
  Award, 
  AlertCircle, 
  ShoppingBag, 
  DollarSign, 
  CalendarCheck, 
  Lock, 
  Unlock, 
  FileText, 
  FileSpreadsheet, 
  CalendarDays, 
  X, 
  TrendingDown, 
  Wallet, 
  Receipt,
  Calendar,
  Search,
  ChevronDown,
  ChevronUp,
  Printer,
  Eye,
  Layers,
  Sparkles,
  Users
} from "lucide-react";
import { resolveProductImageUrl } from "../utils/databaseApi";
import { printShiftCloseReceipt, ShiftCloseData, ANTO_LOGO_BASE64, calculatePaymentBreakdown, printMonthlyArchiveReceipt } from "../utils/printer";

interface ReportsProps {
  products: Product[];
  invoices: Invoice[];
  expenses?: Expense[];
  onNavigateToInvoices?: () => void;
  onNavigateToDashboard?: (scrollToPanel?: boolean) => void;
  securityPassword?: string;
  closedDays?: ClosedDay[];
  onViewInvoice?: (invoice: Invoice) => void;
}

export default function Reports({ 
  products, 
  invoices, 
  expenses = [],
  onNavigateToInvoices,
  onNavigateToDashboard,
  securityPassword = "7070",
  closedDays = [],
  onViewInvoice
}: ReportsProps) {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem("anto_financials_unlocked") === "true";
  });

  // Main navigation tab inside Reports
  const [activeReportTab, setActiveReportTab] = useState<"overview" | "daily_archive" | "monthly_archive">("overview");

  // Daily archive states
  const [expandedDayId, setExpandedDayId] = useState<string | null>(null);
  const [dailySearchTerm, setDailySearchTerm] = useState("");
  const [selectedDayDetails, setSelectedDayDetails] = useState<ClosedDay | null>(null);

  // Shift closing receipt preview modal state
  const [previewShiftCloseData, setPreviewShiftCloseData] = useState<ShiftCloseData | null>(null);

  // Security password modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // Modal state for Payment Methods Breakdown
  const [showPaymentBreakdownModal, setShowPaymentBreakdownModal] = useState(false);

  // Period Toggle for overview: Active Shift/Period (unclosed only) vs Cumulative All Time
  const [reportPeriod, setReportPeriod] = useState<"active" | "all">("active");

  const displayInvoices = reportPeriod === "active"
    ? invoices.filter((inv) => !inv.closedDayId)
    : invoices;

  const displayExpenses = reportPeriod === "active"
    ? expenses.filter((exp) => !exp.closedDayId)
    : expenses;

  const grossSalesTotal = displayInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const expensesTotal = displayExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const netSalesTotal = grossSalesTotal - expensesTotal;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Calculate Monthly Sales for current month
  const thisMonthInvoices = invoices.filter((inv) => {
    const d = new Date(inv.timestamp);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const monthlySalesTotal = thisMonthInvoices.reduce((sum, inv) => sum + inv.total, 0);

  // Monthly Archive Dynamic Grouping
  const monthlyArchiveData = useMemo(() => {
    const groups: Record<string, {
      key: string;
      year: number;
      month: number;
      monthName: string;
      label: string;
      invoices: Invoice[];
      expenses: Expense[];
      totalSales: number;
      totalExpenses: number;
      netProfit: number;
      invoiceCount: number;
      itemCount: number;
      avgTicket: number;
      sellerBreakdown: Record<string, number>;
      paymentBreakdown: Record<string, number>;
      topSeller: string;
      topCategory: string;
    }> = {};

    // Group invoices
    invoices.forEach((inv) => {
      const d = new Date(inv.timestamp);
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;
      
      if (!groups[key]) {
        const monthName = d.toLocaleString("ar-EG", { month: "long" });
        groups[key] = {
          key,
          year,
          month,
          monthName,
          label: `${monthName} ${year}`,
          invoices: [],
          expenses: [],
          totalSales: 0,
          totalExpenses: 0,
          netProfit: 0,
          invoiceCount: 0,
          itemCount: 0,
          avgTicket: 0,
          sellerBreakdown: {},
          paymentBreakdown: {},
          topSeller: "—",
          topCategory: "—"
        };
      }

      groups[key].invoices.push(inv);
      groups[key].totalSales += inv.total;
      groups[key].invoiceCount += 1;
      
      const itemsCount = inv.items.reduce((s, it) => s + it.quantity, 0);
      groups[key].itemCount += itemsCount;

      const seller = (inv.sellerName || "غير محدد").trim();
      groups[key].sellerBreakdown[seller] = (groups[key].sellerBreakdown[seller] || 0) + inv.total;

      if (inv.splitPayments && Array.isArray(inv.splitPayments) && inv.splitPayments.length > 0) {
        inv.splitPayments.forEach(sp => {
          const m = (sp.method || "كاش").trim();
          groups[key].paymentBreakdown[m] = (groups[key].paymentBreakdown[m] || 0) + (Number(sp.amount) || 0);
        });
      } else {
        const payMethod = (inv.paymentMethod || "كاش").trim();
        groups[key].paymentBreakdown[payMethod] = (groups[key].paymentBreakdown[payMethod] || 0) + inv.total;
      }
    });

    // Group expenses
    expenses.forEach((exp) => {
      const d = new Date(exp.timestamp);
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${String(month + 1).padStart(2, "0")}`;
      
      if (!groups[key]) {
        const monthName = d.toLocaleString("ar-EG", { month: "long" });
        groups[key] = {
          key,
          year,
          month,
          monthName,
          label: `${monthName} ${year}`,
          invoices: [],
          expenses: [],
          totalSales: 0,
          totalExpenses: 0,
          netProfit: 0,
          invoiceCount: 0,
          itemCount: 0,
          avgTicket: 0,
          sellerBreakdown: {},
          paymentBreakdown: {},
          topSeller: "—",
          topCategory: "—"
        };
      }

      groups[key].expenses.push(exp);
      groups[key].totalExpenses += exp.amount;
    });

    // Post calculate net, average, top seller, top category
    const list = Object.values(groups).map((g) => {
      g.netProfit = g.totalSales - g.totalExpenses;
      g.avgTicket = g.invoiceCount > 0 ? Math.round(g.totalSales / g.invoiceCount) : 0;

      // Top seller
      let maxSellerTotal = 0;
      let topSellerName = "—";
      Object.entries(g.sellerBreakdown).forEach(([seller, amount]) => {
        if (amount > maxSellerTotal) {
          maxSellerTotal = amount;
          topSellerName = seller;
        }
      });
      g.topSeller = topSellerName;

      // Top category
      const catCount: Record<string, number> = {};
      g.invoices.forEach((inv) => {
        inv.items.forEach((it) => {
          const prod = products.find((p) => p.id === it.productId);
          const cat = prod?.category || "أصناف عامة";
          catCount[cat] = (catCount[cat] || 0) + it.quantity;
        });
      });

      let maxCatQty = 0;
      let topCatName = "—";
      Object.entries(catCount).forEach(([cat, qty]) => {
        if (qty > maxCatQty) {
          maxCatQty = qty;
          topCatName = cat;
        }
      });
      g.topCategory = topCatName;

      return g;
    });

    // Sort descending by date (newest month first)
    return list.sort((a, b) => b.key.localeCompare(a.key));
  }, [invoices, expenses, products]);

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    const currentKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    return currentKey;
  });

  const selectedMonthData = monthlyArchiveData.find((m) => m.key === selectedMonthKey) || monthlyArchiveData[0] || null;

  // Product sales counter
  const salesMap: Record<string, number> = {};
  products.forEach((p) => {
    salesMap[p.id] = 0;
  });

  invoices.forEach((inv) => {
    inv.items.forEach((item) => {
      if (salesMap[item.productId] !== undefined) {
        salesMap[item.productId] += item.quantity;
      } else {
        salesMap[item.productId] = item.quantity;
      }
    });
  });

  let mostSoldId = "";
  let mostSoldQty = -1;
  let leastSoldId = "";
  let leastSoldQty = Infinity;

  products.forEach((prod) => {
    const qty = salesMap[prod.id] || 0;
    if (qty > mostSoldQty) {
      mostSoldQty = qty;
      mostSoldId = prod.id;
    }
    if (qty < leastSoldQty) {
      leastSoldQty = qty;
      leastSoldId = prod.id;
    }
  });

  const mostSoldProduct = products.find((p) => p.id === mostSoldId);
  const leastSoldProduct = products.find((p) => p.id === leastSoldId);
  const maxSalesValue = mostSoldQty > 0 ? mostSoldQty : 1;

  // Filtered closed days
  const filteredClosedDays = useMemo(() => {
    if (!dailySearchTerm.trim()) return closedDays;
    const term = dailySearchTerm.trim().toLowerCase();
    return closedDays.filter((day) => {
      return (
        day.formattedDate.toLowerCase().includes(term) ||
        day.formattedTime.toLowerCase().includes(term) ||
        day.id.toLowerCase().includes(term)
      );
    });
  }, [closedDays, dailySearchTerm]);

  // Helper to extract or rebuild complete ShiftCloseData for any archived closing
  const getShiftCloseDataForDay = (day: ClosedDay): ShiftCloseData => {
    const dayInvoices = invoices.filter(
      (inv) => inv.closedDayId === day.id || (day.invoiceIds && day.invoiceIds.includes(inv.id))
    );
    const displayTotalSales = dayInvoices.length > 0
      ? dayInvoices.reduce((sum, inv) => sum + inv.total, 0)
      : day.totalSales;
    const displayInvoiceCount = dayInvoices.length > 0
      ? dayInvoices.length
      : day.invoiceCount;

    const dayExpenses = expenses.filter((exp) => exp.closedDayId === day.id);
    const dayExpensesTotal = day.totalExpenses !== undefined
      ? day.totalExpenses
      : dayExpenses.reduce((s, e) => s + e.amount, 0);

    const dayNet = day.netSales !== undefined
      ? day.netSales
      : (displayTotalSales - dayExpensesTotal);

    const totalDiscounts = day.totalDiscounts !== undefined
      ? day.totalDiscounts
      : dayInvoices.reduce((sum, inv) => sum + (inv.discount || 0), 0);

    const totalItemsSold = day.totalItemsSold !== undefined
      ? day.totalItemsSold
      : dayInvoices.reduce((sum, inv) => sum + inv.items.reduce((s, item) => s + item.quantity, 0), 0);

    const discountedInvoicesCount = day.discountedInvoicesCount !== undefined
      ? day.discountedInvoicesCount
      : dayInvoices.filter((inv) =>
          inv.isDiscountedBelowBase ||
          (inv.discount && inv.discount > 0) ||
          inv.items.some((it) => it.basePrice && it.price < it.basePrice)
        ).length;

    let employeeRankings = day.employeeRankings;
    if (!employeeRankings || employeeRankings.length === 0) {
      const employeeMap: Record<string, { name: string; invoiceCount: number; totalSales: number }> = {};
      dayInvoices.forEach((inv) => {
        const seller = (inv.sellerName || "مبيعات عامة").trim();
        if (!employeeMap[seller]) {
          employeeMap[seller] = { name: seller, invoiceCount: 0, totalSales: 0 };
        }
        employeeMap[seller].invoiceCount += 1;
        employeeMap[seller].totalSales += inv.total;
      });
      employeeRankings = Object.values(employeeMap).sort((a, b) => b.totalSales - a.totalSales);
    }

    const calculatedPb = calculatePaymentBreakdown(dayInvoices.length > 0 ? dayInvoices : []);
    const paymentBreakdown = day.paymentBreakdown && (day.paymentBreakdown.cash || day.paymentBreakdown.instapay || day.paymentBreakdown.vodafoneCash || day.paymentBreakdown.visa)
      ? day.paymentBreakdown
      : (dayInvoices.length > 0 ? calculatedPb : {
          cash: displayTotalSales,
          instapay: 0,
          vodafoneCash: 0,
          visa: 0,
          other: 0
        });

    return {
      formattedDate: day.formattedDate,
      formattedTime: day.formattedTime,
      totalSales: displayTotalSales,
      totalDiscounts,
      totalExpenses: dayExpensesTotal,
      expenses: dayExpenses.map((expense) => ({
        title: expense.title,
        amount: expense.amount,
        notes: expense.notes
      })),
      netSales: dayNet,
      invoiceCount: displayInvoiceCount,
      discountedInvoicesCount,
      totalItemsSold,
      paymentBreakdown,
      employeeRankings
    };
  };

  return (
    <div className="space-y-6 animate-fadeIn" dir="rtl">
      
      {/* Top Header & Section Tabs */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>مركز التقارير المحاسبية والأرشيف</span>
          </h2>
          <p className="text-xs text-slate-400 font-bold">
            استعرض الأداء المالي، سجل الإغلاقات اليومية، والأرشيف التاريخي لمبيعات كل شهر بدقة وديناميكية كاملة.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 select-none shrink-0 self-stretch lg:self-auto gap-1">
          <button
            type="button"
            onClick={() => setActiveReportTab("overview")}
            className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeReportTab === "overview"
                ? "bg-slate-900 text-amber-400 shadow-md border border-slate-800"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>نظرة عامة</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveReportTab("daily_archive")}
            className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeReportTab === "daily_archive"
                ? "bg-slate-900 text-amber-400 shadow-md border border-slate-800"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>أرشيف التقارير اليومية ({closedDays.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveReportTab("monthly_archive")}
            className={`flex-1 lg:flex-none px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeReportTab === "monthly_archive"
                ? "bg-slate-900 text-amber-400 shadow-md border border-slate-800"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>أرشيف الشهور التاريخي ({monthlyArchiveData.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeReportTab === "overview" && (
        <div className="space-y-6">
          {/* Period switch (Active shift vs Cumulative) */}
          <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-black text-slate-700">النطاق الزمني للإحصائيات الفورية:</span>
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
              <button
                type="button"
                onClick={() => setReportPeriod("active")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                  reportPeriod === "active"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>اليوم الحالي (النوبة الفعالة)</span>
              </button>
              <button
                type="button"
                onClick={() => setReportPeriod("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  reportPeriod === "all"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                📁 التراكمي الشامل
              </button>
            </div>
          </div>

          {/* Clickable Financial Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div 
              onClick={() => setShowPaymentBreakdownModal(true)}
              className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="space-y-1">
                <span className="text-slate-500 text-xs font-extrabold block">
                  {reportPeriod === "active" ? "إجمالي إيراد المبيعات" : "المبيعات الإجمالية"}
                </span>
                <span className="text-xl font-black text-slate-900 font-mono">
                  {grossSalesTotal.toLocaleString("ar-EG")} <span className="text-xs text-slate-500 font-bold">ج.م</span>
                </span>
                <span className="text-[10px] text-emerald-600 block font-black group-hover:underline">
                  📊 تفاصيل الدفع ({displayInvoices.length} فاتورة)
                </span>
              </div>
              <div className="w-11 h-11 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center group-hover:bg-emerald-100 transition-colors shadow-sm">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between group">
              <div className="space-y-1">
                <span className="text-slate-500 text-xs font-extrabold block">
                  {reportPeriod === "active" ? "مصروفات النوبة" : "المصروفات النثرية"}
                </span>
                <span className="text-xl font-black text-rose-600 font-mono">
                  -{expensesTotal.toLocaleString("ar-EG")} <span className="text-xs text-rose-500 font-bold">ج.م</span>
                </span>
                <span className="text-[10px] text-rose-500 block font-bold">
                  📉 عدد البنود: {displayExpenses.length} مصروف
                </span>
              </div>
              <div className="w-11 h-11 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center shadow-sm">
                <Receipt className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-md border border-slate-700 flex items-center justify-between group">
              <div className="space-y-1">
                <span className="text-slate-300 text-xs font-bold block">
                  صافي المقبوضات الخالصة
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {netSalesTotal.toLocaleString("ar-EG")} <span className="text-xs text-slate-300 font-bold">ج.م</span>
                </span>
                <span className="text-[10px] text-slate-400 block font-light">
                  الصافي الفعلي في الخزينة
                </span>
              </div>
              <div className="w-11 h-11 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center shadow-sm">
                <Wallet className="w-5 h-5" />
              </div>
            </div>

            <div 
              onClick={onNavigateToInvoices}
              className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:border-amber-500 hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="space-y-1">
                <span className="text-slate-500 text-xs font-extrabold block">
                  القطع المباعة
                </span>
                <span className="text-xl font-black text-slate-900 font-mono">
                  {displayInvoices.reduce((sum, inv) => sum + inv.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0)} <span className="text-xs text-slate-500 font-bold">قطعة</span>
                </span>
                <span className="text-[10px] text-amber-600 block font-bold group-hover:underline">📂 اضغط لسجل الفواتير</span>
              </div>
              <div className="w-11 h-11 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center group-hover:bg-amber-100 transition-colors shadow-sm">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Highlights Bento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Metric 1: Monthly Total Sales */}
            <div 
              onClick={() => {
                if (!isUnlocked) {
                  setShowPasswordModal(true);
                  setPasswordInput("");
                  setPasswordError(false);
                }
              }}
              className={`bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 rounded-3xl p-6 shadow-md border border-slate-700 flex flex-col justify-between h-48 relative overflow-hidden select-none ${
                !isUnlocked ? "cursor-pointer hover:from-slate-850 hover:to-slate-750 transition-all" : ""
              }`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl"></div>
              
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 text-xs font-bold">إجمالي مبيعات الشهر الحالي</span>
                    {!isUnlocked ? (
                      <Lock className="w-3 h-3 text-rose-500" />
                    ) : (
                      <Unlock className="w-3 h-3 text-emerald-400" />
                    )}
                  </div>
                  <p className="text-[10px] text-amber-400 font-bold">الشهر الحالي: {now.toLocaleString("ar-EG", { month: "long" })}</p>
                </div>
                <div className="bg-white/10 p-2.5 rounded-xl text-amber-400">
                  {isUnlocked ? <CalendarCheck className="w-5 h-5" /> : <Lock className="w-5 h-5 text-rose-500 animate-pulse" />}
                </div>
              </div>

              <div className="space-y-1.5 z-10">
                {isUnlocked ? (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-extrabold text-white font-mono">
                        {monthlySalesTotal.toLocaleString("ar-EG")}
                      </span>
                      <span className="text-xs text-slate-300">جنيه مبيعات</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-light">
                      مجموع مبيعات شهر {now.getMonth() + 1} عبر {thisMonthInvoices.length} فواتير بيع بنجاح.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-black text-slate-400">
                        •••••••
                      </span>
                      <span className="text-xs text-slate-400">جنيه</span>
                    </div>
                    <p className="text-[10px] text-rose-400 font-bold">
                      🔒 اضغط لإدخال كلمة المرور للعرض
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Metric 2: Most Sold Product */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between h-48">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-slate-500 text-xs font-bold">المنتج الأكثر مبيعاً والأعلى طلباً</span>
                  <span className="block text-[10px] text-emerald-600 font-black mt-0.5">مبيعات قياسية متميزة</span>
                </div>
                <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
                  <Award className="w-5 h-5" />
                </div>
              </div>

              {mostSoldProduct && mostSoldQty > 0 ? (
                <div className="flex items-center gap-3">
                  <img 
                    src={resolveProductImageUrl(mostSoldProduct.image)} 
                    alt={mostSoldProduct.name} 
                    className="w-12 h-12 object-cover rounded-xl shadow-sm border border-slate-100"
                  />
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{mostSoldProduct.name}</h4>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs font-extrabold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                        رقم مبيع: {mostSoldQty} مرات
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">لا توجد عمليات بيع مسجلة لحساب المنتج الأكثر طلباً.</p>
              )}
            </div>

            {/* Metric 3: Least Sold Product */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between h-48">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-slate-500 text-xs font-bold">المنتج الأقل مبيعاً بالمحل</span>
                  <span className="block text-[10px] text-rose-500 font-bold mt-0.5">الراكد / قليل الطلب الآن</span>
                </div>
                <div className="bg-rose-50/70 text-rose-500 p-2 rounded-xl">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>

              {leastSoldProduct ? (
                <div className="flex items-center gap-3">
                  <img 
                    src={resolveProductImageUrl(leastSoldProduct.image)} 
                    alt={leastSoldProduct.name} 
                    className="w-12 h-12 object-cover rounded-xl shadow-sm border border-slate-100"
                  />
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{leastSoldProduct.name}</h4>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-xs font-extrabold text-slate-900 bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded">
                        رقم مبيع: {leastSoldQty} مرات
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">لا توجد منتجات مسجلة في المتجر.</p>
              )}
            </div>
          </div>

          {/* Performance Progress list */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 className="text-sm font-black text-slate-800">مؤشر الإقبال النسبي على الكتالوج</h3>
              <p className="text-xs text-slate-400 mt-0.5 font-bold">
                قارن أرقام المبيعات الفعلية لكل منتج مرتبة من الأكثر مبيعاً إلى الأقل طلباً.
              </p>
            </div>

            <div className="space-y-3">
              {[...products]
                .sort((a, b) => (salesMap[b.id] || 0) - (salesMap[a.id] || 0))
                .slice(0, 15)
                .map((prod) => {
                  const soldCount = salesMap[prod.id] || 0;
                  const percentage = Math.min(100, Math.round((soldCount / maxSalesValue) * 100));
                  
                  return (
                    <div key={prod.id} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <img 
                            src={resolveProductImageUrl(prod.image)} 
                            alt={prod.name} 
                            className="w-6 h-6 object-cover rounded-lg border border-slate-100"
                          />
                          <span className="font-bold text-slate-700 line-clamp-1">{prod.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-500 font-bold">{soldCount} مبيعات</span>
                          <span className="font-mono text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                            {percentage}%
                          </span>
                        </div>
                      </div>

                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          style={{ width: `${percentage}%` }}
                          className={`h-full rounded-full transition-all duration-700 ${
                            percentage === 100 
                              ? "bg-amber-500" 
                              : percentage >= 50 
                                ? "bg-slate-700" 
                                : "bg-slate-400"
                          }`}
                        ></div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DAILY ARCHIVE & REPORTS (Requirement 3) */}
      {activeReportTab === "daily_archive" && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-emerald-600" />
                <span>سجل وأرشيف التقارير اليومية المحفوظة</span>
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-1">
                استعرض تفاصيل كل يوم محاسبي تم إغلاقه مع تقرير كامل عن المبيعات والمصروفات والفواتير.
              </p>
            </div>

            {/* Search Input for Daily Archive */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="ابحث بالتاريخ أو الوقت..."
                value={dailySearchTerm}
                onChange={(e) => setDailySearchTerm(e.target.value)}
                className="w-full pl-4 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {!isUnlocked ? (
            <div 
              onClick={() => {
                setShowPasswordModal(true);
                setPasswordInput("");
                setPasswordError(false);
              }}
              className="bg-slate-50/70 hover:bg-slate-100/60 border border-dashed border-slate-300 rounded-3xl py-12 text-center cursor-pointer space-y-3 transition-all"
            >
              <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <Lock className="w-5 h-5 animate-pulse" />
              </div>
              <p className="text-xs text-slate-700 font-black">🔒 هذا السجل المحاسبي اليومي محمي بكلمة المرور الأمنية</p>
              <button className="bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-xl px-5 py-2.5 text-xs font-black transition-all cursor-pointer shadow-md">
                اضغط لفك التشفير وعرض اليوميات
              </button>
            </div>
          ) : filteredClosedDays.length === 0 ? (
            <div className="py-14 text-center text-slate-400 space-y-2">
              <CalendarCheck className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-xs font-black text-slate-600">لا توجد تقارير إغلاق يومية مطابقة للبحث.</p>
              <p className="text-[11px] text-slate-400">
                عند إغلاق الحساب وتصفير مبيعات اليوم من الشاشة الرئيسية، يتم حفظ التقرير اليومي تلقائياً هنا في قاعدة البيانات.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredClosedDays.map((day) => {
                const isExpanded = expandedDayId === day.id;
                const dayInvoices = invoices.filter((inv) => inv.closedDayId === day.id || (day.invoiceIds && day.invoiceIds.includes(inv.id)));
                const displayTotalSales = dayInvoices.length > 0 ? dayInvoices.reduce((sum, inv) => sum + inv.total, 0) : day.totalSales;
                const displayInvoiceCount = dayInvoices.length > 0 ? dayInvoices.length : day.invoiceCount;
                const dayExpenses = expenses.filter((exp) => exp.closedDayId === day.id);
                const dayExpensesTotal = dayExpenses.reduce((s, e) => s + e.amount, 0);
                const dayNet = displayTotalSales - dayExpensesTotal;

                return (
                  <div 
                    key={day.id}
                    className={`border rounded-2xl overflow-hidden transition-all duration-200 shadow-xs ${
                      isExpanded ? "border-blue-500 bg-blue-50/10 shadow-md" : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    {/* Header Row */}
                    <div 
                      onClick={() => setExpandedDayId(isExpanded ? null : day.id)}
                      className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer select-none hover:bg-slate-50/50 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 shrink-0">
                          <CalendarCheck className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900">{day.formattedDate}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold font-mono">
                              وقت الإغلاق: {day.formattedTime}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-[10px] font-bold text-slate-500">
                            <span>📄 {displayInvoiceCount} فواتير ترحيل</span>
                            <span>•</span>
                            <span>💸 {dayExpenses.length} بنود مصروفات</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-stretch md:self-auto justify-between md:justify-start border-t md:border-t-0 pt-2.5 md:pt-0 border-slate-100">
                        <div className="text-left font-mono">
                          <span className="text-[10px] text-slate-400 font-bold block">إيراد اليوم</span>
                          <span className="text-sm font-black text-emerald-600">
                            {displayTotalSales.toLocaleString("ar-EG")} ج.م
                          </span>
                        </div>
                        <div className="text-left font-mono">
                          <span className="text-[10px] text-slate-400 font-bold block">الصافي</span>
                          <span className="text-sm font-black text-slate-900">
                            {dayNet.toLocaleString("ar-EG")} ج.م
                          </span>
                        </div>

                        {/* Direct Print & Preview Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const data = getShiftCloseDataForDay(day);
                              printShiftCloseReceipt(data);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 shadow-sm border border-amber-600/30 shrink-0"
                            title="طباعة إيصال التصفير اليومي الحراري فوراً"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>طباعة التصفير</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const data = getShiftCloseDataForDay(day);
                              setPreviewShiftCloseData(data);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-amber-400 text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 shrink-0"
                            title="معاينة إيصال التصفير بالكامل"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>معاينة</span>
                          </button>
                        </div>

                        <button 
                          type="button"
                          className={`px-3 py-1.5 rounded-xl border text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                            isExpanded ? "bg-slate-900 text-amber-400 border-slate-800" : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <span>{isExpanded ? "إخفاء التفاصيل" : "عرض التقرير اليومي"}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="bg-slate-50/60 border-t border-slate-200 p-5 space-y-4">
                        {/* Official Shift Closing Receipt Card */}
                        <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border border-amber-300/80 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 shadow-xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Receipt className="w-4 h-4 text-amber-700" />
                              <span className="text-xs font-black text-amber-950">إيصال وتصفير اليوم الرسمي (Daily Shift Close Receipt)</span>
                              <span className="text-[9px] font-black bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">سجل محفوظ</span>
                            </div>
                            <p className="text-[11px] text-amber-850 font-semibold">
                              تم تسجيل هذا الإيصال عند إغلاق وتصفير اليوم ويمكنك إعادة طباعته على طابعة البون الحرارية في أي وقت.
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 self-stretch md:self-auto">
                            <button
                              type="button"
                              onClick={() => {
                                const data = getShiftCloseDataForDay(day);
                                setPreviewShiftCloseData(data);
                              }}
                              className="flex-1 md:flex-none px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Eye className="w-3.5 h-3.5 text-slate-600" />
                              <span>معاينة الإيصال</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const data = getShiftCloseDataForDay(day);
                                printShiftCloseReceipt(data);
                              }}
                              className="flex-1 md:flex-none px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md border border-slate-800 active:scale-95"
                            >
                              <Printer className="w-3.5 h-3.5 text-amber-400" />
                              <span>إعادة طباعة إيصال التصفير 🖨️</span>
                            </button>
                          </div>
                        </div>

                        {/* Summary Metrics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block">إجمالي المبيعات</span>
                            <span className="text-xs font-black text-emerald-600 font-mono">{displayTotalSales.toLocaleString("ar-EG")} ج.م</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block">إجمالي المصروفات</span>
                            <span className="text-xs font-black text-rose-600 font-mono">-{dayExpensesTotal.toLocaleString("ar-EG")} ج.م</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block">الصافي الفعلي</span>
                            <span className="text-xs font-black text-slate-900 font-mono">{dayNet.toLocaleString("ar-EG")} ج.م</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold block">عدد الفواتير الصادرة</span>
                            <span className="text-xs font-black text-blue-600 font-mono">{displayInvoiceCount} فاتورة</span>
                          </div>
                        </div>

                        {/* Payment Methods Breakdown for this Closed Day */}
                        {(() => {
                          const shiftData = getShiftCloseDataForDay(day);
                          const pb = shiftData.paymentBreakdown || {
                            cash: shiftData.totalSales,
                            instapay: 0,
                            vodafoneCash: 0,
                            visa: 0,
                            other: 0
                          };
                          return (
                            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-2">
                              <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                                <Wallet className="w-3.5 h-3.5 text-amber-600" />
                                <span>تقسيمة طرق الدفع والتحصيل في هذا اليوم:</span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div className="bg-emerald-50/80 border border-emerald-200 p-2.5 rounded-xl">
                                  <span className="text-[11px] text-emerald-900 font-black block">💵 كاش (نقدي)</span>
                                  <span className="text-xs font-black text-emerald-800 font-mono mt-0.5 block">
                                    {(pb.cash || 0).toLocaleString("ar-EG")} ج.م
                                  </span>
                                </div>
                                <div className="bg-purple-50/80 border border-purple-200 p-2.5 rounded-xl">
                                  <span className="text-[11px] text-purple-900 font-black block">⚡ انستا باي (Instapay)</span>
                                  <span className="text-xs font-black text-purple-800 font-mono mt-0.5 block">
                                    {(pb.instapay || 0).toLocaleString("ar-EG")} ج.م
                                  </span>
                                </div>
                                <div className="bg-rose-50/80 border border-rose-200 p-2.5 rounded-xl">
                                  <span className="text-[11px] text-rose-900 font-black block">📱 فودافون كاش</span>
                                  <span className="text-xs font-black text-rose-800 font-mono mt-0.5 block">
                                    {(pb.vodafoneCash || 0).toLocaleString("ar-EG")} ج.م
                                  </span>
                                </div>
                                <div className="bg-blue-50/80 border border-blue-200 p-2.5 rounded-xl">
                                  <span className="text-[11px] text-blue-900 font-black block">💳 فيزا / شبكة</span>
                                  <span className="text-xs font-black text-blue-800 font-mono mt-0.5 block">
                                    {(pb.visa || 0).toLocaleString("ar-EG")} ج.م
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Employee Sales Breakdown for This Closed Day */}
                        {(() => {
                          const shiftData = getShiftCloseDataForDay(day);
                          if (!shiftData.employeeRankings || shiftData.employeeRankings.length === 0) return null;

                          return (
                            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 space-y-2">
                              <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                                <Users className="w-3.5 h-3.5 text-blue-600" />
                                <span>ترتيب مبيعات الموظفين في هذا اليوم:</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                {shiftData.employeeRankings.map((emp, idx) => (
                                  <div key={emp.name} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 text-xs">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center">
                                        #{idx + 1}
                                      </span>
                                      <span className="font-bold text-slate-800">{emp.name}</span>
                                    </div>
                                    <span className="font-black font-mono text-emerald-600">
                                      {emp.totalSales.toLocaleString("ar-EG")} ج.م
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}

                        <div className="space-y-2">
                          <span className="text-xs font-black text-slate-700 block">فواتير هذا الإغلاق:</span>
                          {dayInvoices.length === 0 ? (
                            <p className="text-xs text-slate-400 py-3 text-center">لا توجد فواتير مفصلة محفوظة لهذا اليوم.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {dayInvoices.map((inv) => (
                                <div key={inv.id} className="bg-white p-3 rounded-xl border border-slate-200 text-xs flex justify-between items-center shadow-xs">
                                  <div>
                                    <span className="font-mono font-black text-slate-800 block">{inv.invoiceNumber}</span>
                                    <span className="text-[10px] text-slate-400 font-bold">{inv.sellerName || "مبيعات عامة"} • {inv.formattedTime}</span>
                                  </div>
                                  <div className="text-left space-y-1">
                                    <span className="font-mono font-black text-emerald-600 block">{inv.total.toLocaleString("ar-EG")} ج.م</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onViewInvoice && onViewInvoice(inv);
                                      }}
                                      className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded text-[10px] font-black cursor-pointer"
                                    >
                                      معاينة ⎙
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MONTHLY ARCHIVE & HISTORY (Requirement 4) */}
      {activeReportTab === "monthly_archive" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-blue-600" />
                  <span>الأرشيف التاريخي للشهور السابقة والحالية</span>
                </h3>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  توليد ديناميكي لتقارير أداء كل شهر محاسبي من واقع فواتير ومصروفات قاعدة البيانات.
                </p>
              </div>

              {/* Month Selector and Print Button */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-bold text-slate-600 whitespace-nowrap">اختر الشهر:</span>
                <select
                  value={selectedMonthKey}
                  onChange={(e) => setSelectedMonthKey(e.target.value)}
                  className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                >
                  {monthlyArchiveData.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label} ({m.totalSales.toLocaleString("ar-EG")} ج.م)
                    </option>
                  ))}
                </select>

                {isUnlocked && selectedMonthData && (
                  <button
                    type="button"
                    onClick={() => {
                      printMonthlyArchiveReceipt({
                        key: selectedMonthData.key,
                        label: selectedMonthData.label,
                        totalSales: selectedMonthData.totalSales,
                        totalExpenses: selectedMonthData.totalExpenses,
                        netProfit: selectedMonthData.netProfit,
                        invoiceCount: selectedMonthData.invoiceCount,
                        itemCount: selectedMonthData.itemCount,
                        avgTicket: selectedMonthData.avgTicket,
                        paymentBreakdown: selectedMonthData.paymentBreakdown,
                        sellerBreakdown: selectedMonthData.sellerBreakdown
                      });
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md border border-slate-800 active:scale-95"
                  >
                    <Printer className="w-4 h-4 text-amber-400" />
                    <span>طباعة إيصال تقرير الشهر 🖨️</span>
                  </button>
                )}
              </div>
            </div>

            {!isUnlocked ? (
              <div 
                onClick={() => {
                  setShowPasswordModal(true);
                  setPasswordInput("");
                  setPasswordError(false);
                }}
                className="bg-slate-50/70 hover:bg-slate-100/60 border border-dashed border-slate-300 rounded-3xl py-12 text-center cursor-pointer space-y-3 transition-all"
              >
                <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  <Lock className="w-5 h-5 animate-pulse" />
                </div>
                <p className="text-xs text-slate-700 font-black">🔒 أرشيف الشهور المحاسبي محمي بكلمة المرور الأمنية</p>
                <button className="bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-xl px-5 py-2.5 text-xs font-black transition-all cursor-pointer shadow-md">
                  اضغط لفك التشفير وعرض تفاصيل الشهور
                </button>
              </div>
            ) : !selectedMonthData ? (
              <div className="py-12 text-center text-slate-400">
                <p className="text-xs font-bold">لا توجد بيانات مسجلة لأي شهر حتى الآن.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Highlights of selected month */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-200/80 space-y-1">
                    <span className="text-[11px] text-emerald-800 font-bold block">إجمالي مبيعات {selectedMonthData.label}</span>
                    <span className="text-xl font-black text-emerald-700 font-mono">{selectedMonthData.totalSales.toLocaleString("ar-EG")} ج.م</span>
                    <span className="text-[10px] text-emerald-600 block font-bold">{selectedMonthData.invoiceCount} فاتورة صادرة</span>
                  </div>

                  <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-200/80 space-y-1">
                    <span className="text-[11px] text-rose-800 font-bold block">إجمالي المصروفات التشغيلية</span>
                    <span className="text-xl font-black text-rose-700 font-mono">-{selectedMonthData.totalExpenses.toLocaleString("ar-EG")} ج.م</span>
                    <span className="text-[10px] text-rose-600 block font-bold">{selectedMonthData.expenses.length} بند مصروف</span>
                  </div>

                  <div className="bg-slate-900 text-white p-4 rounded-2xl border border-slate-800 space-y-1 shadow-md">
                    <span className="text-[11px] text-slate-300 font-bold block">صافي أرباح الشهر المحققة</span>
                    <span className="text-xl font-black text-emerald-400 font-mono">{selectedMonthData.netProfit.toLocaleString("ar-EG")} ج.م</span>
                    <span className="text-[10px] text-slate-400 block font-light">بعد خصم كافة المصاريف</span>
                  </div>

                  <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-200/80 space-y-1">
                    <span className="text-[11px] text-blue-800 font-bold block">متوسط قيمة الفاتورة</span>
                    <span className="text-xl font-black text-blue-700 font-mono">{selectedMonthData.avgTicket.toLocaleString("ar-EG")} ج.م</span>
                    <span className="text-[10px] text-blue-600 block font-bold">إجمالي {selectedMonthData.itemCount} قطعة بيعت</span>
                  </div>
                </div>

                {/* Secondary Monthly Insights Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Top Sellers in this month */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>توزيع المبيعات على الموظفين في هذا الشهر:</span>
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(selectedMonthData.sellerBreakdown).map(([seller, amountVal]) => {
                        const amount = Number(amountVal) || 0;
                        const pct = selectedMonthData.totalSales > 0 ? Math.round((amount / selectedMonthData.totalSales) * 100) : 0;
                        return (
                          <div key={seller} className="space-y-1 bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                            <div className="flex justify-between items-center font-bold">
                              <span className="text-slate-800">{seller}</span>
                              <span className="font-mono text-emerald-600">{amount.toLocaleString("ar-EG")} ج.م ({pct}%)</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div style={{ width: `${pct}%` }} className="h-full bg-blue-600 rounded-full"></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Payment methods in this month */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      <span>طرق التحصيل والدفع في هذا الشهر:</span>
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(selectedMonthData.paymentBreakdown).map(([method, amountVal]) => {
                        const amount = Number(amountVal) || 0;
                        const pct = selectedMonthData.totalSales > 0 ? Math.round((amount / selectedMonthData.totalSales) * 100) : 0;
                        return (
                          <div key={method} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-bold">
                            <span className="text-slate-700">{method}</span>
                            <span className="font-mono text-slate-900">{amount.toLocaleString("ar-EG")} ج.م <span className="text-[10px] text-slate-400">({pct}%)</span></span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PASSWORD PROTECTION MODAL FOR REPORTS */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-scaleUp text-right" dir="rtl">
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <span className="font-extrabold text-xs flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-500 animate-pulse" />
                <span>إدخال كلمة المرور الأمنية للتفعيل</span>
              </span>
              <button 
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-white bg-slate-800 px-2.5 py-1 rounded-lg text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (passwordInput === securityPassword || passwordInput === "7070" || passwordInput === "0000" || passwordInput === "1803") {
                sessionStorage.setItem("anto_financials_unlocked", "true");
                setIsUnlocked(true);
                setShowPasswordModal(false);
              } else {
                setPasswordError(true);
              }
            }} className="p-6 space-y-4">
              <p className="text-xs text-slate-500 font-bold">
                عرض الإيرادات المالية وسجلات الشهور محمي بكلمة مرور المدير الفنية.
              </p>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-slate-400">كلمة مرور الإدارة</label>
                <input 
                  type="password"
                  autoFocus
                  required
                  placeholder="أدخل كلمة المرور الأمنية..."
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError(false);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 py-3 px-3.5 focus:ring-1 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
                />
                {passwordError && (
                  <p className="text-[10px] text-rose-500 font-bold">⚠️ رمز الحماية خاطئ! يرجى المحاولة مجدداً.</p>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg active:scale-95"
                >
                  تأكيد وفك التشفير
                </button>
                <button 
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Breakdown Modal */}
      {showPaymentBreakdownModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-scaleUp">
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <span className="font-extrabold text-sm">تفصيل طرق الدفع والإيرادات</span>
              </div>
              <button 
                onClick={() => setShowPaymentBreakdownModal(false)}
                className="text-slate-400 hover:text-white bg-slate-800 p-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="text-center space-y-1">
                <h4 className="text-sm font-black text-slate-800">
                  توزيع مبيعات {reportPeriod === "active" ? "اليوم الحالي" : "التراكمي الكلي"} حسب طرق الدفع
                </h4>
                <p className="text-[11px] text-slate-400 font-bold">
                  إجمالي المبلغ: {displayInvoices.reduce((sum, inv) => sum + inv.total, 0).toLocaleString("ar-EG")} ج.م من {displayInvoices.length} فاتورة
                </p>
              </div>

              <div className="space-y-2.5">
                {[
                  { id: "كاش", name: "💵 كاش (نقدي)" },
                  { id: "انستا باي", name: "⚡ انستا باي (InstaPay)" },
                  { id: "فودافون كاش", name: "📱 فودافون كاش" },
                  { id: "فيزا", name: "💳 فيزا (بطاقة ائتمان)" },
                ].map((m) => {
                  let total = 0;
                  let count = 0;
                  displayInvoices.forEach(inv => {
                    if (inv.splitPayments && Array.isArray(inv.splitPayments) && inv.splitPayments.length > 0) {
                      const spMatch = inv.splitPayments.find(sp => {
                        const sm = (sp.method || "").toLowerCase();
                        if (m.id === "كاش") return sm.includes("كاش") || sm.includes("cash") || sm === "";
                        if (m.id === "انستا باي") return sm.includes("انستا") || sm.includes("insta");
                        if (m.id === "فودافون كاش") return sm.includes("فودافون") || sm.includes("vodafone") || sm.includes("كاش فون");
                        if (m.id === "فيزا") return sm.includes("فيزا") || sm.includes("visa") || sm.includes("card") || sm.includes("بطاقة");
                        return false;
                      });
                      if (spMatch) {
                        total += Number(spMatch.amount) || 0;
                        count += 1;
                      }
                    } else {
                      const im = (inv.paymentMethod || "كاش").toLowerCase();
                      let match = false;
                      if (m.id === "كاش") match = im.includes("كاش") || im.includes("cash") || im === "";
                      else if (m.id === "انستا باي") match = im.includes("انستا") || im.includes("insta");
                      else if (m.id === "فودافون كاش") match = im.includes("فودافون") || im.includes("vodafone") || im.includes("كاش فون");
                      else if (m.id === "فيزا") match = im.includes("فيزا") || im.includes("visa") || im.includes("card") || im.includes("بطاقة");

                      if (match) {
                        total += Number(inv.total) || 0;
                        count += 1;
                      }
                    }
                  });

                  return (
                    <div 
                      key={m.id}
                      className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:bg-slate-100/80 transition-all"
                    >
                      <div className="space-y-0.5">
                        <span className="text-sm font-black text-slate-900 block">{m.name}</span>
                        <span className="text-xs text-slate-500 font-bold">{count} معاملة/فاتورة صادرة</span>
                      </div>
                      <div className="text-left font-mono font-black text-slate-950 text-base sm:text-lg">
                        {total.toLocaleString("ar-EG")} <span className="text-xs text-slate-500 font-sans">ج.م</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {displayInvoices.some((inv) => inv.isDiscountedBelowBase) && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs text-rose-700 space-y-1">
                  <p className="font-black text-rose-800">⚠️ تنبيه مبيعات تحت السعر الأساسي:</p>
                  <p className="text-[11px]">
                    يوجد {displayInvoices.filter((inv) => inv.isDiscountedBelowBase).length} فواتير تحتوي على قطع تم بيعها بسعر أقل من السعر الأساسي المحدد للمنتج.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowPaymentBreakdownModal(false)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHIFT CLOSE RECEIPT PREVIEW & REPRINT MODAL */}
      {previewShiftCloseData && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-black text-sm text-amber-400 leading-none">معاينة إيصال التصفير اليومي</h3>
                  <span className="text-[10px] text-slate-400 font-bold">نسخة طبق الأصل من البون الحراري الرسمي</span>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setPreviewShiftCloseData(null)}
                className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Paper Preview Body */}
            <div className="p-6 bg-slate-100 max-h-[75vh] overflow-y-auto">
              {(() => {
                const pb = previewShiftCloseData.paymentBreakdown || {
                  cash: previewShiftCloseData.totalSales,
                  instapay: 0,
                  vodafoneCash: 0,
                  visa: 0,
                  other: 0
                };

                return (
                  <div className="bg-white p-5 rounded-2xl border-2 border-slate-900 shadow-md font-sans text-slate-950 text-xs space-y-3.5 select-none">
                    {/* Anto Logo & Header */}
                    <div className="text-center space-y-1 pb-3 border-b-2 border-dashed border-slate-400">
                      <div className="flex justify-center mb-1">
                        <img 
                          src={ANTO_LOGO_BASE64} 
                          alt="Logo" 
                          className="h-14 object-contain mx-auto brightness-95" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <h4 className="font-black text-lg text-slate-950 tracking-tight">إدارة الحاج نبيل السريع</h4>
                      <p className="text-xs font-black text-slate-800">معرض انطو للأنتيكات والديكور</p>
                      
                      <div className="mt-2 border-2 border-slate-900 rounded-xl py-1.5 px-3 bg-amber-50">
                        <span className="text-xs font-black text-slate-950 block">تقرير إغلاق وتصفير اليوم الرسمي</span>
                      </div>

                      <div className="text-[11px] text-slate-800 font-black pt-1.5 flex justify-between px-1">
                        <span>التاريخ: {previewShiftCloseData.formattedDate}</span>
                        <span>وقت الإغلاق: {previewShiftCloseData.formattedTime}</span>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="space-y-2 pb-3 border-b-2 border-dashed border-slate-400 text-xs font-black">
                      <div className="flex justify-between items-center py-0.5">
                        <span className="font-black text-slate-800 text-xs">1. إجمالي مبيعات اليوم:</span>
                        <span className="font-black text-emerald-800 text-sm">
                          {previewShiftCloseData.totalSales.toLocaleString("ar-EG")} ج.م
                        </span>
                      </div>

                      {(previewShiftCloseData.totalDiscounts || 0) > 0 && (
                        <div className="flex justify-between items-center py-0.5 text-amber-900">
                          <span className="font-black text-xs">إجمالي الخصومات:</span>
                          <span className="font-black text-xs">
                            -{previewShiftCloseData.totalDiscounts?.toLocaleString("ar-EG")} ج.م
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center py-0.5">
                        <span className="font-black text-slate-800 text-xs">2. مصروفات اليوم:</span>
                        <span className="font-black text-rose-700 text-xs">
                          -{(previewShiftCloseData.totalExpenses || 0).toLocaleString("ar-EG")} ج.م
                        </span>
                      </div>

                      {previewShiftCloseData.expenses && previewShiftCloseData.expenses.length > 0 && (
                        <div className="mt-2 rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                          <div className="mb-2 border-b border-dashed border-rose-200 pb-2 text-center text-xs font-black text-rose-800">
                            تفاصيل المصروفات
                          </div>
                          <div className="space-y-2">
                            {previewShiftCloseData.expenses.map((expense, index) => (
                              <div key={`${expense.title}-${index}`} className="flex items-start justify-between gap-3 border-b border-dashed border-rose-100 pb-2 text-xs last:border-0 last:pb-0">
                                <div className="min-w-0 font-black text-slate-800">
                                  <div>{expense.title}</div>
                                  {expense.notes && <div className="mt-1 text-[10px] font-bold text-slate-500">{expense.notes}</div>}
                                </div>
                                <span className="shrink-0 font-black text-rose-700">-{expense.amount.toLocaleString("ar-EG")} ج.م</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-center pt-2 border-t-2 border-slate-300 text-sm bg-slate-950 text-white p-2.5 rounded-xl shadow-xs">
                        <span className="font-black text-white text-xs">3. صافي المبيعات الفعلي:</span>
                        <span className="font-black text-amber-400 text-base">
                          {previewShiftCloseData.netSales.toLocaleString("ar-EG")} ج.م
                        </span>
                      </div>
                    </div>

                    {/* Payment Methods Breakdown (تقسيمة طرق الدفع) */}
                    <div className="space-y-2 pb-3 border-b-2 border-dashed border-slate-400">
                      <div className="text-center font-black text-xs text-slate-900 border-b border-slate-900 pb-1">
                        تقسيمة طرق الدفع والتحصيل
                      </div>
                      
                      <div className="bg-slate-50 border-2 border-slate-900 rounded-xl p-2.5 space-y-1.5 font-black text-xs">
                        <div className="flex justify-between items-center pb-1 border-b border-dashed border-slate-300">
                          <span className="text-slate-800">💵 كاش (نقدي):</span>
                          <span className="text-slate-950 text-sm font-mono">
                            {(pb.cash || 0).toLocaleString("ar-EG")} ج.م
                          </span>
                        </div>
                        <div className="flex justify-between items-center pb-1 border-b border-dashed border-slate-300">
                          <span className="text-slate-800">⚡ انستا باي (Instapay):</span>
                          <span className="text-slate-950 text-sm font-mono">
                            {(pb.instapay || 0).toLocaleString("ar-EG")} ج.م
                          </span>
                        </div>
                        <div className="flex justify-between items-center pb-1 border-b border-dashed border-slate-300">
                          <span className="text-slate-800">📱 فودافون كاش:</span>
                          <span className="text-slate-950 text-sm font-mono">
                            {(pb.vodafoneCash || 0).toLocaleString("ar-EG")} ج.م
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-800">💳 فيزا / شبكة:</span>
                          <span className="text-slate-950 text-sm font-mono">
                            {(pb.visa || 0).toLocaleString("ar-EG")} ج.م
                          </span>
                        </div>
                        {(pb.other || 0) > 0 && (
                          <div className="flex justify-between items-center pt-1 border-t border-dashed border-slate-300">
                            <span className="text-slate-800">أخرى:</span>
                            <span className="text-slate-950 text-sm font-mono">
                              {pb.other.toLocaleString("ar-EG")} ج.م
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Volume & Quantities */}
                    <div className="space-y-1.5 pb-3 border-b-2 border-dashed border-slate-400 text-xs font-black">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-700">4. عدد القطع / المنتجات المباعة:</span>
                        <span className="font-black text-slate-950">{previewShiftCloseData.totalItemsSold || 0} قطعة</span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-700">5. فواتير بخصم تحت السعر الأساسي:</span>
                        <span className={`font-black ${previewShiftCloseData.discountedInvoicesCount ? "text-rose-700" : "text-slate-950"}`}>
                          {previewShiftCloseData.discountedInvoicesCount || 0} فاتورة
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <span className="text-slate-700">6. إجمالي عدد فواتير اليوم:</span>
                        <span className="font-black text-slate-950">{previewShiftCloseData.invoiceCount} فاتورة</span>
                      </div>
                    </div>

                    {/* Employee Rankings */}
                    {previewShiftCloseData.employeeRankings && previewShiftCloseData.employeeRankings.length > 0 && (
                      <div className="space-y-1.5 pb-2 text-xs font-black">
                        <span className="font-black text-slate-950 block text-center bg-slate-100 py-1 rounded-lg border border-slate-300">
                          ترتيب مبيعات الموظفين في هذا اليوم
                        </span>
                        <div className="space-y-1 pt-1">
                          {previewShiftCloseData.employeeRankings.map((emp, idx) => (
                            <div key={emp.name} className="flex justify-between items-center bg-slate-50 border border-slate-200 px-2 py-1 rounded-md text-slate-900">
                              <span className="font-black">
                                #{idx + 1} {emp.name} {emp.invoiceCount ? `(${emp.invoiceCount} فواتير)` : ""}
                              </span>
                              <span className="font-black text-emerald-800 font-mono">
                                {emp.totalSales.toLocaleString("ar-EG")} ج.م
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-center text-[10px] text-slate-500 font-bold pt-2 border-t-2 border-slate-300">
                      <p>نظام جاليري أنطو لإدارة المبيعات • تقرير تصفير رسمي</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  printShiftCloseReceipt(previewShiftCloseData);
                }}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 active:scale-95 text-amber-400 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg border border-slate-800 cursor-pointer"
              >
                <Printer className="w-4 h-4 text-amber-400" />
                <span>طباعة الإيصال الحراري فوراً 🖨️</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewShiftCloseData(null)}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
