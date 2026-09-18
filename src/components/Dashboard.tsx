import React, { useState } from "react";
import { Product, Invoice, ClosedDay, Expense } from "../types";
import { TrendingUp, Package, AlertTriangle, Receipt, Eye, ShoppingBag, Lock, Unlock, CalendarRange, RefreshCw, TrendingDown, Wallet } from "lucide-react";
import { printShiftCloseReceipt, calculatePaymentBreakdownWithCounts } from "../utils/printer";
import { ANTO_LOGO_BASE64 } from "../assets/logoBase64";

interface DashboardProps {
  products: Product[];
  invoices: Invoice[];
  expenses?: Expense[];
  setActiveTab: (tab: string) => void;
  onViewInvoice: (invoice: Invoice) => void;
  securityPassword?: string;
  closedDays: ClosedDay[];
  onCloseDay: (activeInvoicesToClose: Invoice[]) => void;
}

export default function Dashboard({ 
  products, 
  invoices, 
  expenses = [],
  setActiveTab, 
  onViewInvoice,
  securityPassword = "7070",
  closedDays,
  onCloseDay
}: DashboardProps) {
  const [showPaymentBreakdownModal, setShowPaymentBreakdownModal] = useState(false);
  
  // Custom states for Shift Closing (Tasefeer)
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Financial password unlock states (stored in sessionStorage to stay unlocked across dashboard/reports switches)
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem("anto_financials_unlocked") === "true";
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // Filter active invoices for today
  const todayInvoices = React.useMemo(() => {
    return invoices.filter((inv) => !inv.closedDayId);
  }, [invoices]);

  const todaySalesTotal = React.useMemo(() => {
    return todayInvoices.reduce((sum, inv) => sum + inv.total, 0);
  }, [todayInvoices]);

  // Active unclosed expenses for today
  const activeExpenses = React.useMemo(() => {
    return expenses.filter((e) => !e.closedDayId);
  }, [expenses]);

  const todayExpensesTotal = React.useMemo(() => {
    return activeExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [activeExpenses]);

  const netTodaySales = React.useMemo(() => {
    return todaySalesTotal - todayExpensesTotal;
  }, [todaySalesTotal, todayExpensesTotal]);

  // Discounted below base price invoices in today's active shift
  const discountedTodayInvoicesCount = React.useMemo(() => {
    return todayInvoices.filter((inv) => inv.isDiscountedBelowBase).length;
  }, [todayInvoices]);

  // Stock alerts (low stock)
  const lowStockProducts = React.useMemo(() => {
    return products.filter((prod) => prod.stock <= prod.minStockAlert);
  }, [products]);

  return (
    <div className="space-y-8 animate-fadeIn" dir="rtl">
      {/* Top Banner Dashboard Greeting */}
      <div className="bg-gradient-to-l from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white rounded-3xl p-8 relative overflow-hidden shadow-2xl border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-xl -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-xl -ml-20 -mb-20"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-white/10 backdrop-blur-md rounded-2xl p-2 border border-white/20 flex items-center justify-center shrink-0 shadow-lg">
              <img 
                src={ANTO_LOGO_BASE64} 
                alt="Logo" 
                className="w-full h-full object-contain" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <span className="bg-amber-500/20 text-amber-400 text-xs font-bold px-3 py-1 rounded-full border border-amber-500/30">
                منظومة نقاط البيع والإدارة الرسمية
              </span>
              <h1 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight mt-2">
                إدارة الحاج نبيل السريع
              </h1>
              <p className="text-amber-300 font-bold text-xs md:text-sm mt-0.5">
                معرض انطو للأنتيكات والديكور
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <button 
              id="quick-sale-btn"
              onClick={() => setActiveTab("sales")}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold px-6 py-3.5 rounded-2xl shadow-lg hover:shadow-blue-500/20 transition-all active:scale-[0.98] cursor-pointer text-xs"
            >
              <ShoppingBag className="w-5 h-5 animate-pulse" />
              <span>فاتورة بيع جديدة</span>
            </button>

            <button
              id="quick-reset-day-btn"
              onClick={() => {
                if (todayInvoices.length === 0) {
                  setToastMessage("⚠️ لا توجد أي مبيعات أو فواتير نشطة حالياً لتصفيرها.");
                  setTimeout(() => setToastMessage(null), 3500);
                  return;
                }
                setShowCloseShiftModal(true);
              }}
              className="flex items-center gap-2 bg-[#dc2626] hover:bg-red-700 text-white font-extrabold px-6 py-3.5 rounded-2xl shadow-lg hover:shadow-red-500/20 transition-all active:scale-[0.98] cursor-pointer text-xs"
            >
              <RefreshCw className="w-4 h-4" />
              <span>تصفير وإغلاق الحساب</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Financial Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Today's Sales Card */}
        <div 
          id="today-sales-card"
          onClick={() => {
            if (isUnlocked) {
              setShowPaymentBreakdownModal(true);
            } else {
              setShowPasswordModal(true);
              setPasswordInput("");
              setPasswordError(false);
            }
          }}
          className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 hover:border-emerald-400 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-xs font-bold">1- مبيعات اليوم (اضغط لتقسيمة طرق الدفع)</span>
                {!isUnlocked ? (
                  <Lock className="w-3.2 h-3.2 text-rose-500" />
                ) : (
                  <Unlock className="w-3.2 h-3.2 text-emerald-500" />
                )}
              </div>
              
              {isUnlocked ? (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-slate-900 font-mono">
                      {todaySalesTotal.toLocaleString("ar-EG")}
                    </span>
                    <span className="text-xs font-bold text-slate-500">جنيه</span>
                  </div>
                  <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-1">
                    <span>📊 تفاصيل كاش / انستا باي / فودافون / فيزا</span>
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-slate-400">
                      •••••••
                    </span>
                    <span className="text-xs font-bold text-slate-400">جنيه</span>
                  </div>
                  <p className="text-[10px] text-rose-500 font-bold mt-1">
                    🔒 اضغط لإدخال كلمة المرور للعرض
                  </p>
                </>
              )}
            </div>
            <div className={`p-3.5 rounded-2xl group-hover:bg-slate-100 transition-all ${
              isUnlocked ? "bg-emerald-50 text-emerald-600" : "bg-rose-50/70 text-rose-500"
            }`}>
              {isUnlocked ? <TrendingUp className="w-6 h-6" /> : <Lock className="w-6 h-6 animate-pulse" />}
            </div>
          </div>
        </div>

        {/* 2. Today's Expenses Card */}
        <div 
          id="today-expenses-card"
          onClick={() => setActiveTab("expenses")}
          className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 hover:border-rose-400 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-2 h-full bg-rose-500"></div>
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-xs font-bold">2- إجمالي المصروفات (اليوم)</span>
              </div>
              
              {isUnlocked ? (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-rose-600 font-mono">
                      {todayExpensesTotal.toLocaleString("ar-EG")}
                    </span>
                    <span className="text-xs font-bold text-rose-500">جنيه</span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-bold flex items-center gap-1 mt-1">
                    <span>عدد البنود: {activeExpenses.length} بند (اضغط للذهاب للمصروفات)</span>
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-slate-400">
                      •••••••
                    </span>
                    <span className="text-xs font-bold text-slate-400">جنيه</span>
                  </div>
                  <p className="text-[10px] text-rose-500 font-bold mt-1">
                    🔒 اضغط لإدخال كلمة المرور للعرض
                  </p>
                </>
              )}
            </div>
            <div className="p-3.5 rounded-2xl bg-rose-50 text-rose-600 group-hover:bg-rose-100 transition-all">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* 3. Today's Net Sales Card */}
        <div 
          id="today-net-sales-card"
          onClick={() => setActiveTab("expenses")}
          className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 text-white rounded-3xl p-6 shadow-md border border-slate-700 hover:border-emerald-500 transition-all cursor-pointer group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-2 h-full bg-emerald-400"></div>
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-300 text-xs font-bold">3- صافي المبيعات (الخزينة)</span>
              </div>
              
              {isUnlocked ? (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-emerald-400 font-mono">
                      {netTodaySales.toLocaleString("ar-EG")}
                    </span>
                    <span className="text-xs font-bold text-slate-300">جنيه</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1 mt-1">
                    <span>المبلغ الصافي بعد خصم المصروفات</span>
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-slate-400">
                      •••••••
                    </span>
                    <span className="text-xs font-bold text-slate-400">جنيه</span>
                  </div>
                  <p className="text-[10px] text-rose-400 font-bold mt-1">
                    🔒 اضغط لإدخال كلمة المرور للعرض
                  </p>
                </>
              )}
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 group-hover:bg-emerald-500/30 transition-all">
              <Wallet className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Operational Monitoring Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sales Below Base Price Invoices Today Card */}
        <div 
          id="discounted-invoices-card"
          onClick={() => {
            const el = document.getElementById("active-shift-invoices-panel");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          className={`bg-white rounded-3xl p-6 shadow-sm border transition-all hover:shadow-md cursor-pointer group relative overflow-hidden ${
            discountedTodayInvoicesCount > 0 
              ? "border-rose-300 bg-rose-50/20" 
              : "border-slate-200/80"
          }`}
        >
          <div className={`absolute top-0 left-0 w-2 h-full ${discountedTodayInvoicesCount > 0 ? "bg-rose-500" : "bg-slate-300"}`}></div>
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-slate-500 text-xs font-bold">4- فواتير متباعة بأقل من السعر الأساسي اليوم</span>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-3xl font-black font-mono ${discountedTodayInvoicesCount > 0 ? "text-rose-600" : "text-slate-900"}`}>
                  {discountedTodayInvoicesCount.toLocaleString("ar-EG")}
                </span>
                <span className="text-xs font-bold text-slate-500">فاتورة</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {discountedTodayInvoicesCount > 0 ? (
                  <span className="text-rose-600 font-bold">⚠️ يوجد فواتير بها خصم تحت السعر الأساسي اليوم</span>
                ) : (
                  <span>لم يتم بيع أي قطعة بأقل من سعرها الأساسي اليوم (تتصفر مع مبيعات اليوم)</span>
                )}
              </p>
            </div>
            <div className={`p-3.5 rounded-2xl transition-all ${
              discountedTodayInvoicesCount > 0 ? "bg-rose-100 text-rose-700" : "bg-slate-50 text-slate-500"
            }`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Stock Alerts Card */}
        <div 
          id="low-stock-card"
          onClick={() => setActiveTab("inventory")}
          className={`bg-white rounded-3xl p-6 shadow-sm border transition-all hover:shadow-md cursor-pointer group relative overflow-hidden ${
            lowStockProducts.length > 0 
              ? "border-rose-200 hover:border-rose-450 bg-rose-50/10" 
              : "border-slate-200/80 hover:border-blue-450"
          }`}
        >
          <div className={`absolute top-0 left-0 w-2 h-full ${lowStockProducts.length > 0 ? "bg-rose-500" : "bg-slate-450"}`}></div>
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-slate-500 text-xs font-bold">5- تنبيهات نواقص المخزون</span>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-3xl font-black font-mono ${lowStockProducts.length > 0 ? "text-rose-600" : "text-slate-900"}`}>
                  {lowStockProducts.length.toLocaleString("ar-EG")}
                </span>
                <span className="text-xs font-bold text-slate-500">تنبيهات</span>
              </div>
              <p className="text-[11px] mt-1">
                {lowStockProducts.length > 0 ? (
                  <span className="text-rose-600 font-bold">هناك منتجات أوشكت على النفاد!</span>
                ) : (
                  <span className="text-slate-400">جميع المنتجات بكميات كافية وآمنة</span>
                )}
              </p>
            </div>
            <div className={`p-3.5 rounded-2xl transition-all ${
              lowStockProducts.length > 0 
                ? "bg-rose-50 text-rose-600 group-hover:bg-rose-100" 
                : "bg-slate-50 text-slate-500"
            }`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Full Width Today Invoices Section */}
      <div className="w-full">
        <div 
          id="active-shift-invoices-panel"
          className="w-full bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4"
        >
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="text-md font-extrabold text-slate-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-500" />
              <span>فواتير اليوم</span>
            </h2>
            <span className="bg-emerald-50 text-emerald-700 text-xs font-black px-3 py-1 rounded-xl border border-emerald-200">
              {todayInvoices.length} فاتورة صادرة اليوم
            </span>
          </div>

          {!isUnlocked ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center">
                <Lock className="w-8 h-8 animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-800">تفاصيل فواتير اليوم محجوبة لدواعي الأمان</p>
                <p className="text-[10px] text-slate-400">يرجى فك تشفير البيانات المالية في الأعلى أولاً لمعاينة التفاصيل اليومية.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(true);
                  setPasswordInput("");
                  setPasswordError(false);
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md active:scale-95"
              >
                فك تشفير وعرض الفواتير الحالية
              </button>
            </div>
          ) : todayInvoices.length === 0 ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-3">
                <Receipt className="w-8 h-8" />
              </div>
              <p className="text-xs font-bold text-slate-850">لا توجد فواتير نشطة اليوم حتى الآن.</p>
              <p className="text-[10px] text-slate-400 mt-1">سيتم سرد كآفة المعاملات الصادرة اليوم هنا فور بيعها وتتصفر مع التصفير تلقائيًا.</p>
              <button
                type="button"
                onClick={() => setActiveTab("sales")}
                className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                ابدأ بإصدار فاتورة بيع جديدة
              </button>
            </div>
          ) : (
            <>
              <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto pr-1">
                {todayInvoices.map((inv) => (
                  <div key={inv.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-slate-50 px-2 rounded-xl transition-all">
                    <div className="space-y-1">
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-mono text-xs font-black text-slate-700 bg-slate-150 px-2 py-0.5 rounded-md">
                          {inv.invoiceNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {inv.formattedTime}
                        </span>
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md font-black border border-blue-200">
                          {inv.paymentMethod || "كاش"}
                        </span>
                        {inv.sellerName && (
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                            بائع: {inv.sellerName}
                          </span>
                        )}
                        {inv.isDiscountedBelowBase && (
                          <span className="text-[10px] bg-rose-100 text-rose-800 px-2 py-0.5 rounded-md font-black">
                            ⚠️ تم البيع بأقل من السعر الأساسي
                          </span>
                        )}
                      </div>
                      {/* Products summary inline list */}
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                        {inv.items.map((item) => `${item.name} (${item.quantity}×)`).join(" ، ")}
                      </p>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <span className="text-xs font-black text-emerald-600 font-mono bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-xl">
                        {inv.total.toLocaleString("ar-EG")} ج.م
                      </span>
                      <button 
                        onClick={() => onViewInvoice(inv)}
                        className="flex items-center gap-1 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold px-3 py-1.5 rounded-xl text-[10px] transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>عرض وتصدير</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tasefeer / Shift Reset Banner directly visible under active invoices */}
              <div 
                id="close-day-banner" 
                className="bg-amber-50 border border-amber-200 rounded-3xl p-5 mt-4 flex flex-col sm:flex-row justify-between items-center gap-4 text-right"
              >
                <div className="space-y-1.5">
                  <h4 className="text-xs font-black text-amber-950 flex items-center gap-1.5 leading-none">
                    <RefreshCw className="w-4 h-4 text-amber-600 animate-spin-slow" />
                    <span>إقفال وتصفير مبيعات اليوم الحالي</span>
                  </h4>
                  <p className="text-[10.5px] text-amber-800/90 leading-relaxed font-semibold">
                    عند تصفير الفترة، سيتم دمج وحفظ كآفة الفواتير الموضحة أعلاه تلقائياً بصفحة التقارير المالية كاليوم المغلق وتجهيز الشاشة لوردية جديدة.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (todayInvoices.length === 0) {
                      setToastMessage("⚠️ لا توجد أي مبيعات أو فواتير نشطة حالياً لتصفيرها.");
                      setTimeout(() => setToastMessage(null), 3500);
                      return;
                    }
                    setShowCloseShiftModal(true);
                  }}
                  className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-extrabold px-5 py-2.5 rounded-2xl text-xs transition-all shadow-md cursor-pointer shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تصفير وإقفال حساب اليوم</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* PASSWORD PROTECTION MODAL FOR FINANCIAL DATA */}
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
                className="text-slate-400 hover:text-white bg-slate-800 px-2.5 py-1 rounded-lg text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (passwordInput === securityPassword) {
                sessionStorage.setItem("anto_financials_unlocked", "true");
                setIsUnlocked(true);
                setShowPasswordModal(false);
                setTimeout(() => {
                  const el = document.getElementById("active-shift-invoices-panel");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                }, 150);
              } else {
                setPasswordError(true);
              }
            }} className="p-6 space-y-4">
              <p className="text-xs text-slate-500">
                عرض الإيرادات المالية ومبيعات اليوم محمي بكلمة مرور المدير الفنية تماشياً مع معايير الأمان المالي.
              </p>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-extrabold text-slate-400">كلمة مرور الإدارة</label>
                <input 
                  type="password"
                  autoFocus
                  required
                  placeholder="أدخل كلمة المرور الأمنية للمتابعة..."
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
                  إلغاء المعاينة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUCCESS/WARNING FLOATING TOAST */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-slate-800 text-white py-3.5 px-6 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-fadeIn text-xs font-bold font-sans">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* CUSTOM TASEFEER (SHIFT CLOSING) DIALOG MODAL */}
      {showCloseShiftModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh] animate-scaleUp text-right" dir="rtl">
            <div className="bg-amber-600 text-white p-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-white animate-spin-slow" />
              </div>
              <div>
                <h3 className="text-md font-black">إقفال وتصفير الحساب اليومي (الوردية النشطة)</h3>
                <p className="text-[11px] text-amber-100 mt-0.5">يرجى تأكيد تصفير وترحيل مبيعات نوبة العمل</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2.5">
                <p className="text-xs font-bold text-slate-700">بيان الفترة المغلقة الحالية قبل التصفير:</p>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-white p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-bold">إجمالي مبيعات اليوم</span>
                    <span className="text-lg font-black text-emerald-600 font-mono">
                      {todaySalesTotal.toLocaleString("ar-EG")} <span className="text-xs">ج.م</span>
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block font-bold">فواتير الوردية النشطة</span>
                    <span className="text-lg font-black text-blue-600 font-mono">
                      {todayInvoices.length} <span className="text-xs">فاتورة</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-slate-600 text-xs leading-relaxed">
                <p className="font-bold text-slate-800">⚠️ ماذا سيحدث عند تصفير الحساب الآن?</p>
                <ul className="list-disc list-inside space-y-1 pr-2 text-[11px] text-slate-600">
                  <li>سيصبح رصيد <strong className="text-slate-800">مربع مبيعات اليوم</strong> بقيمة <strong className="text-emerald-600 font-black">٠ ج.م</strong> مباشرةً.</li>
                  <li>سيخلو <strong className="text-slate-800">مربع فواتير الوردية النشطة بالكامل</strong> ويصبح فارغاً تماماً للبدء بوردية جديدة.</li>
                  <li>سيتم <strong className="text-slate-800">حفظ وترحيل كآفة الفواتير المذكورة تلقائياً</strong> إلى مبيعات الشهر وتأصيلها بتاريخ أول فاتورة لهذا اليوم للرجوع إليها في صفحة التقارير.</li>
                </ul>
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button"
                  onClick={async () => {
                    const now = new Date();
                    const formattedDate = now.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
                    const formattedTime = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: true });

                    const totalDiscounts = todayInvoices.reduce((sum, inv) => sum + (inv.discount || 0), 0);
                    const totalItemsSold = todayInvoices.reduce((sum, inv) => sum + inv.items.reduce((s, item) => s + item.quantity, 0), 0);

                    // Count invoices sold below base price
                    const discountedInvoicesCount = todayInvoices.filter((inv) => 
                      inv.isDiscountedBelowBase || 
                      (inv.discount && inv.discount > 0) || 
                      inv.items.some(it => it.customPrice && it.customPrice < it.product.price)
                    ).length;

                    // Group sales by employee and sort from highest to lowest
                    const employeeMap: Record<string, { name: string; invoiceCount: number; totalSales: number }> = {};
                    todayInvoices.forEach(inv => {
                      const seller = (inv.sellerName || "مبيعات عامة").trim();
                      if (!employeeMap[seller]) {
                        employeeMap[seller] = { name: seller, invoiceCount: 0, totalSales: 0 };
                      }
                      employeeMap[seller].invoiceCount += 1;
                      employeeMap[seller].totalSales += inv.total;
                    });
                    const employeeRankings = Object.values(employeeMap).sort((a, b) => b.totalSales - a.totalSales);

                    // Print thermal shift closing receipt
                    try {
                      await printShiftCloseReceipt({
                        formattedDate,
                        formattedTime,
                        totalSales: todaySalesTotal,
                        totalDiscounts,
                        totalExpenses: todayExpensesTotal,
                        netSales: netTodaySales,
                        invoiceCount: todayInvoices.length,
                        discountedInvoicesCount,
                        totalItemsSold,
                        employeeRankings
                      });
                    } catch (err) {
                      console.error("Shift close receipt print error:", err);
                    }

                    onCloseDay(todayInvoices);
                    
                    setIsUnlocked(true);
                    sessionStorage.setItem("anto_financials_unlocked", "true");
                    
                    setShowCloseShiftModal(false);
                    setToastMessage("✓ تم تصفير وإغلاق حساب المبيعات اليومية وطباعة فاتورة التقفيل بنجاح!");
                    setTimeout(() => setToastMessage(null), 4000);
                  }}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>تأكيد التصفير والإغلاق الآن</span>
                </button>
                <button 
                  type="button"
                  onClick={() => setShowCloseShiftModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  تراجع / إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* PAYMENT METHOD BREAKDOWN MODAL FOR TODAY'S SALES */}
      {showPaymentBreakdownModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 flex flex-col animate-scaleUp text-right" dir="rtl">
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <span className="font-extrabold text-sm flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <span>تقسيمة مبيعات اليوم حسب طريقة الدفع</span>
              </span>
              <button 
                onClick={() => setShowPaymentBreakdownModal(false)}
                className="text-slate-400 hover:text-white bg-slate-800 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إغلاق (✕)
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="text-center space-y-1 pb-3 border-b border-slate-100">
                <span className="text-xs text-slate-400 font-bold">إجمالي مبيعات اليوم (الوردية الحالية)</span>
                <p className="text-3xl font-black text-slate-900 font-mono">
                  {todaySalesTotal.toLocaleString("ar-EG")} <span className="text-sm font-bold text-slate-500">ج.م</span>
                </p>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full inline-block mt-1">
                  {todayInvoices.length} فاتورة صادرة
                </span>
              </div>

              {/* Grid of Payment Methods */}
              <div className="grid grid-cols-2 gap-3">
                {(() => {
                  const stats = calculatePaymentBreakdownWithCounts(todayInvoices);
                  const cashStats = stats.cash;
                  const instaStats = stats.instapay;
                  const vfStats = stats.vodafoneCash;
                  const visaStats = stats.visa;

                  return (
                    <>
                      {/* Cash */}
                      <div className="bg-emerald-50/60 border border-emerald-200/80 p-3.5 rounded-2xl space-y-1">
                        <span className="text-xs font-black text-emerald-800 block">💵 كاش</span>
                        <span className="text-lg font-black text-emerald-900 font-mono block">
                          {cashStats.total.toLocaleString("ar-EG")} ج.م
                        </span>
                        <span className="text-[10px] text-emerald-700 font-bold block">
                          {cashStats.count} معاملة/فاتورة
                        </span>
                      </div>

                      {/* InstaPay */}
                      <div className="bg-indigo-50/60 border border-indigo-200/80 p-3.5 rounded-2xl space-y-1">
                        <span className="text-xs font-black text-indigo-800 block">⚡ انستا باي</span>
                        <span className="text-lg font-black text-indigo-900 font-mono block">
                          {instaStats.total.toLocaleString("ar-EG")} ج.م
                        </span>
                        <span className="text-[10px] text-indigo-700 font-bold block">
                          {instaStats.count} معاملة/فاتورة
                        </span>
                      </div>

                      {/* Vodafone Cash */}
                      <div className="bg-rose-50/60 border border-rose-200/80 p-3.5 rounded-2xl space-y-1">
                        <span className="text-xs font-black text-rose-800 block">📱 فودافون كاش</span>
                        <span className="text-lg font-black text-rose-900 font-mono block">
                          {vfStats.total.toLocaleString("ar-EG")} ج.م
                        </span>
                        <span className="text-[10px] text-rose-700 font-bold block">
                          {vfStats.count} معاملة/فاتورة
                        </span>
                      </div>

                      {/* Visa */}
                      <div className="bg-blue-50/60 border border-blue-200/80 p-3.5 rounded-2xl space-y-1">
                        <span className="text-xs font-black text-blue-800 block">💳 فيزا</span>
                        <span className="text-lg font-black text-blue-900 font-mono block">
                          {visaStats.total.toLocaleString("ar-EG")} ج.م
                        </span>
                        <span className="text-[10px] text-blue-700 font-bold block">
                          {visaStats.count} معاملة/فاتورة
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>

              <button
                type="button"
                onClick={() => setShowPaymentBreakdownModal(false)}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl text-xs transition-all cursor-pointer shadow-md"
              >
                تم الاطلاع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
