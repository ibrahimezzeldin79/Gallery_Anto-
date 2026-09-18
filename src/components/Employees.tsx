import React, { useState } from "react";
import { Invoice, ArchivedEmployeeSales } from "../types";
import { Users, Trophy, DollarSign, Calendar, Clock, ShoppingBag, Search, Award, UserPlus, Trash2, ShieldCheck, FileText, Gift, AlertTriangle, Edit2, Check } from "lucide-react";

interface EmployeesProps {
  invoices: Invoice[];
  employees: string[];
  deletedEmployeesArchive?: ArchivedEmployeeSales[];
  onAddEmployee: (name: string) => void;
  onDeleteEmployee: (name: string) => void;
  onUpdateEmployee?: (oldName: string, newName: string) => void;
  onViewInvoice: (invoice: Invoice) => void;
}

interface EmployeeStat {
  name: string;
  totalSales: number;
  invoiceCount: number;
  itemsSold: number;
  invoices: Invoice[];
  isRegistered: boolean;
}

export default function Employees({ 
  invoices, 
  employees = [], 
  deletedEmployeesArchive = [],
  onAddEmployee, 
  onDeleteEmployee, 
  onUpdateEmployee,
  onViewInvoice 
}: EmployeesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [newEmpName, setNewEmpName] = useState("");
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);
  const [selectedArchivedEmp, setSelectedArchivedEmp] = useState<ArchivedEmployeeSales | null>(null);

  // Custom premium modal/alerts states
  const [deleteConfirmEmpName, setDeleteConfirmEmpName] = useState<string | null>(null);
  const [editEmpName, setEditEmpName] = useState<string | null>(null);
  const [editEmpInput, setEditEmpInput] = useState<string>("");
  const [customAlertMsg, setCustomAlertMsg] = useState<string | null>(null);

  // tab switcher for active employees vs archived history
  const [employeeTab, setEmployeeTab] = useState<"active" | "archived">("active");

  // Selection of period: Active Session (unclosed only) vs Cumulative All Time
  const [filterPeriod, setFilterPeriod] = useState<"active" | "all">("active");

  // Arabic Normalization for robust name lookup and duplicate prevention
  const normName = (str: string) => {
    return str
      .trim()
      .replace(/[أإآا]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/[ىي]/g, "ي")
      .replace(/\s+/g, " ");
  };

  const normalizedEmployeesList = employees.map(emp => normName(emp));

  // Group invoices, seeding registered employees first
  const statsMap: Record<string, EmployeeStat> = {};

  // Seed with all base registered employees (so they show up even with 0 sales)
  employees.forEach((empName) => {
    const name = empName.trim();
    if (name) {
      statsMap[name] = {
        name,
        totalSales: 0,
        invoiceCount: 0,
        itemsSold: 0,
        invoices: [],
        isRegistered: true,
      };
    }
  });

  // Accumulate invoices: restrict to active unclosed ones if filtering by active period
  const relevantInvoices = filterPeriod === "active"
    ? invoices.filter((inv) => !inv.closedDayId)
    : invoices;

  relevantInvoices.forEach((inv) => {
    const rawName = inv.sellerName?.trim() || "";
    const name = rawName !== "" ? rawName : "مبيعات عامة";
    const normVal = normName(name);

    if (!statsMap[name]) {
      statsMap[name] = {
        name,
        totalSales: 0,
        invoiceCount: 0,
        itemsSold: 0,
        invoices: [],
        isRegistered: normalizedEmployeesList.includes(normVal),
      };
    }

    statsMap[name].totalSales += inv.total;
    statsMap[name].invoiceCount += 1;
    const itemsCount = inv.items.reduce((sum, item) => sum + item.quantity, 0);
    statsMap[name].itemsSold += itemsCount;
    statsMap[name].invoices.push(inv);
  });

  // Convert to array and sort by total sales (descending)
  const employeeList = Object.values(statsMap).sort((a, b) => b.totalSales - a.totalSales);

  // Filter out any ghost/deleted employees from active leaderboard to make it robust
  const activeEmployeeList = employeeList.filter((emp) => {
    const normVal = normName(emp.name);
    return emp.isRegistered || normalizedEmployeesList.includes(normVal) || emp.name === "مبيعات عامة";
  });

  // Filter list by search term
  const filteredEmployees = activeEmployeeList.filter((emp) =>
    emp.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
  );

  // Selected worker details
  const activeSellerData = selectedSeller ? statsMap[selectedSeller] : null;

  // Add Employee Form submit
  const handleCreateEmp = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newEmpName.trim();
    if (!name) return;

    if (normalizedEmployeesList.includes(normName(name))) {
      setCustomAlertMsg(`⚠️ هذا العامل [${name}] مسجل بالفعل في النظام.`);
      return;
    }

    onAddEmployee(name);
    setNewEmpName("");
    setCustomAlertMsg(`🎉 تم إضافة العامل البائع [${name}] بنجاح إلى سجل الموظفين الفعّال.`);
  };

  return (
    <div className="space-y-8 animate-fadeIn" dir="rtl">
      
      {/* 1. Upper Info Section with Adding form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* About Workers Info Banner */}
        <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-md space-y-3 lg:col-span-2">
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-slate-800" />
            <span>لوحة أداء المبيعات والعمال ومؤشرات الكفاءة</span>
          </h2>
          <p className="text-sm font-bold text-slate-600 leading-relaxed">
            مؤشرات مبيعات المعرض الفعالة مرتبة تنازلياً من العامل الأكثر إنتاجية ومبيعات إلى البدايات الجديدة. يتم تسجيل مبيعات العمال المحذوفين تلقائياً تحت بند <strong className="text-blue-600">"مبيعات عامة"</strong> مع حفظ نسخة كاملة غير قابلة للفقدان بالأرشيف والتحقق الإداري.
          </p>
        </div>

        {/* Quick Add Employee Form */}
        <div className="bg-slate-100 p-6 rounded-3xl border border-slate-300/80 shadow-md">
          <h3 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2 mb-3">
            <UserPlus className="w-5 h-5 text-emerald-600" />
            <span>تسجيل عامل / بائع جديد هُنا</span>
          </h3>

          <form onSubmit={handleCreateEmp} className="space-y-3">
            <input
              type="text"
              required
              placeholder="اكتب اسم البائع الجديد لإنشاء ملف مبيعات..."
              value={newEmpName}
              onChange={(e) => setNewEmpName(e.target.value)}
              className="w-full px-3 py-3 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 text-right"
            />
            <button
              type="submit"
              className="w-full bg-[#0f172a] hover:bg-slate-800 text-white font-black text-xs py-3 rounded-xl cursor-pointer transition-all active:scale-[0.98] shadow-sm shrink-0"
            >
              تسجيل وضّم البائع الآن
            </button>
          </form>
        </div>

      </div>

      {/* Main Tab Mode Toggle: Active Leaderboard vs Deleted Archives */}
      <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-sm max-w-md">
        <button
          type="button"
          onClick={() => setEmployeeTab("active")}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
            employeeTab === "active"
              ? "bg-white text-slate-900 shadow-md"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Trophy className="w-4 h-4 text-amber-500" />
          <span>ترتيب قائمة الموظفين الفعليين</span>
        </button>
        <button
          type="button"
          onClick={() => setEmployeeTab("archived")}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
            employeeTab === "archived"
              ? "bg-slate-900 text-white shadow-md animate-pulse"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>أرشيف المحذوفين ({deletedEmployeesArchive.length}) 🔒</span>
        </button>
      </div>

      {employeeTab === "active" ? (
        <>
          {/* Leaderboard Filtering */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-md flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500 animate-bounce" />
                <span>ترتيب الكفاءة الفردي ونسب المبيعات للفترة المختارة</span>
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">عرض مبيعات الكاشير والمندوبين إما للفترة النشطة الصالحة (منذ آخر تصفير) وإما إجمالي الفترات تراكمياً.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Period Filter Toggle */}
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 select-none">
                <button
                  type="button"
                  onClick={() => setFilterPeriod("active")}
                  className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                    filterPeriod === "active"
                      ? "bg-slate-905 bg-slate-900 text-white shadow-md font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>الوردية الحالية النّشطة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPeriod("all")}
                  className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                    filterPeriod === "all"
                      ? "bg-slate-900 text-white shadow-md font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  📁 المبيعات التراكمية التاريخية
                </button>
              </div>

              <div className="relative w-full md:w-56">
                <input
                  type="text"
                  placeholder="البحث باسم بائع..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-black text-slate-900"
                />
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-700 w-4 h-4" />
              </div>
            </div>
          </div>

          {/* TWO COLUMN GRID: Left Leaderboard (col-span-5) and Right Details (col-span-7) as requested! */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Workers List on Leaderboard - col-span-5 */}
            <div className="lg:col-span-5 space-y-4">
              {filteredEmployees.length === 0 ? (
                <div className="bg-white text-center py-20 rounded-3xl border border-slate-200 text-slate-600 text-sm font-bold">
                  لا توجد سجلات عمال مطابقة لخيارات الفلترة والبحث.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredEmployees.map((emp, index) => {
                    const isFirst = index === 0 && emp.totalSales > 0;
                    const isSecond = index === 1 && emp.totalSales > 0;
                    const isThird = index === 2 && emp.totalSales > 0;
                    const isSelected = selectedSeller === emp.name;

                    return (
                      <div
                        key={emp.name}
                        onClick={() => setSelectedSeller(isSelected ? null : emp.name)}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                          isSelected
                            ? "border-blue-600 bg-blue-50/40 shadow-semibold"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                        }`}
                      >
                        {/* Right side: Rank & Name */}
                        <div className="flex items-center gap-3">
                          {/* Rank Indicator */}
                          <div className="flex items-center justify-center shrink-0">
                            {isFirst ? (
                              <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-black border border-amber-300 text-sm relative">
                                <Trophy className="w-4 h-4 absolute -top-1 -right-1 text-amber-500 drop-shadow-sm" />
                                1
                              </div>
                            ) : isSecond ? (
                              <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-black border border-slate-300 text-sm">
                                2
                              </div>
                            ) : isThird ? (
                              <div className="w-9 h-9 rounded-full bg-amber-50 text-amber-800 flex items-center justify-center font-black border border-amber-200 text-sm">
                                3
                              </div>
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-black font-mono border border-slate-200">
                                {index + 1}
                              </div>
                            )}
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-black text-slate-900">{emp.name}</p>
                              {emp.isRegistered && (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black">بائع مسجل</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                              <span>{emp.invoiceCount} فواتير</span>
                              <span>•</span>
                              <span>{emp.itemsSold} قطع مباعة</span>
                            </div>
                          </div>
                        </div>

                        {/* Left: action and Sales values */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-left space-y-0.5 pl-1.5">
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black inline-block leading-none">
                              المبيعات
                            </span>
                            <p className="text-sm font-black text-slate-900 font-mono">
                              {emp.totalSales.toLocaleString("ar-EG")} <span className="text-[10px] text-slate-600">ج</span>
                            </p>
                          </div>

                          {/* Edit and Delete employee buttons */}
                          {emp.isRegistered && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditEmpName(emp.name);
                                  setEditEmpInput(emp.name);
                                }}
                                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all cursor-pointer shrink-0"
                                title="تعديل وتغيير اسم البائع"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmEmpName(emp.name);
                                }}
                                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer shrink-0"
                                title="إلغاء تسجيل البائع وتصفية سجله"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Worker Details Breakdown - col-span-7 as requested (LARGER BOX) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white p-7 rounded-3xl border-2 border-slate-200 shadow-md space-y-6 min-h-[380px]">
                {activeSellerData ? (
                  <div className="space-y-6">
                    <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
                      <div>
                        <h4 className="text-lg font-black text-slate-900">{activeSellerData.name}</h4>
                        <p className="text-xs font-bold text-slate-500 mt-1">تفاصيل العمليات المبيعات والأصناف المسؤولة للعام الحالي</p>
                      </div>
                      <Award className="w-7 h-7 text-amber-500 animate-pulse" />
                    </div>

                    {/* Stats Box Dashboard layout */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                        <span className="text-xs text-indigo-700 block font-black mb-1">الرصيد المالي المحقق</span>
                        <span className="text-base font-black text-indigo-900 font-mono">
                          {activeSellerData.totalSales.toLocaleString("ar-EG")} ج.م
                        </span>
                      </div>
                      <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                        <span className="text-xs text-emerald-700 block font-black mb-1">الفواتير المدفوعة</span>
                        <span className="text-base font-black text-emerald-900 font-mono">
                          {activeSellerData.invoiceCount} فواتير
                        </span>
                      </div>
                      <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                        <span className="text-xs text-amber-700 block font-black mb-1">إجمالي القطع المباعة</span>
                        <span className="text-base font-black text-amber-900 font-mono">
                          {activeSellerData.itemsSold} قطعة
                        </span>
                      </div>
                    </div>

                    {/* Structured Itemization for products sold */}
                    <div className="space-y-3">
                      <span className="text-sm font-black text-slate-800 flex items-center gap-1">
                        <Gift className="w-4 h-4 text-amber-500" />
                        <span>تفصيل السلع المصنفة البائع مسؤول عنها:</span>
                      </span>

                      {/* We can detail what products actually were sold by him */}
                      {(() => {
                        const itemsSoldMap: Record<string, { count: number; name: string; value: number }> = {};
                        activeSellerData.invoices.forEach(inv => {
                          inv.items.forEach(it => {
                            if (!itemsSoldMap[it.name]) {
                              itemsSoldMap[it.name] = { name: it.name, count: 0, value: 0 };
                            }
                            itemsSoldMap[it.name].count += it.quantity;
                            itemsSoldMap[it.name].value += (it.quantity * it.price);
                          });
                        });
                        const itemsArray = Object.values(itemsSoldMap).sort((a, b) => b.count - a.count);

                        if (itemsArray.length === 0) {
                          return null;
                        }

                        return (
                          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 max-h-[160px] overflow-y-auto space-y-1.5 scrollbar-thin">
                            {itemsArray.map((it) => (
                              <div key={it.name} className="flex justify-between items-center text-xs border-b border-slate-100 pb-1.5 last:border-0 last:pb-0 font-bold">
                                <span className="text-slate-800">{it.name}</span>
                                <div className="flex gap-4 font-mono text-slate-900">
                                  <span>الكمية: {it.count} قطع</span>
                                  <span className="text-indigo-600 font-black">{it.value.toLocaleString("ar-EG")} ج.م</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Invoices list from this seller */}
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black text-slate-800 block">سجل فواتير العامل التفصيلية:</span>
                        <span className="text-[11px] font-bold text-slate-500">
                          (الترتيب: من الأحدث للأقدم)
                        </span>
                      </div>
                      {activeSellerData.invoices.length === 0 ? (
                        <p className="text-sm text-slate-600 py-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                          لا توجد فواتير ومبيعات حية مسجلة لهذا البائع بعد.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                          {[...activeSellerData.invoices].reverse().map((inv) => {
                            const isBelowBase = Boolean(inv.isDiscountedBelowBase || (inv.discount && inv.discount > 0));

                            return (
                              <div
                                key={inv.id}
                                onClick={() => onViewInvoice(inv)}
                                className={`p-3 rounded-xl flex items-center justify-between text-xs cursor-pointer transition-all font-bold border ${
                                  isBelowBase
                                    ? "bg-rose-50/40 hover:bg-rose-100/60 border-rose-300 shadow-xs"
                                    : "bg-slate-50 hover:bg-slate-100 border-slate-200"
                                }`}
                              >
                                <div className="space-y-1 text-right">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-black text-slate-900">#{inv.invoiceNumber}</span>
                                    {isBelowBase && (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-md">
                                        <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                        <span>أقل من السعر الأساسي</span>
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs text-slate-500 block font-bold">
                                    {inv.formattedDate} | {inv.formattedTime}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-slate-500 font-bold">({inv.items.length} أصناف)</span>
                                  <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs">
                                    {inv.total.toLocaleString("ar-EG")} ج.م
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Prominent edit and delete action inside detail view */}
                    {activeSellerData.isRegistered && (
                      <div className="pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200 mt-4">
                        <div className="text-xs font-bold text-slate-700 leading-relaxed max-w-sm">
                          <strong>⚠️ إدارة بيانات البائع:</strong> يمكنك تعديل وتغيير اسم البائع، أو حذفه وتصفية سجله ونقل مبيعاته مع الاحتفاظ بالأرشيف.
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditEmpName(activeSellerData.name);
                              setEditEmpInput(activeSellerData.name);
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs transition-colors cursor-pointer border border-blue-400 shadow-sm shrink-0"
                          >
                            <Edit2 className="w-4 h-4 text-white" />
                            <span>تعديل الاسم</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirmEmpName(activeSellerData.name);
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition-colors cursor-pointer border border-rose-300 shadow-sm shrink-0"
                          >
                            <Trash2 className="w-4 h-4 text-white" />
                            <span>حذف العامل</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-24 text-center text-slate-500 text-sm space-y-3 h-full flex flex-col items-center justify-center">
                    <Users className="w-12 h-12 text-slate-350" />
                    <p className="font-black text-slate-900">قم بتحديد أي عامل من لوحة الترتيب باليمين</p>
                    <p className="text-xs font-bold text-slate-500 max-w-sm leading-relaxed mx-auto">
                      لعرض مؤشراته الحيوية التفصيلية، إجمالي الأصناف والكميات التي قام ببيعها، وكود كافة فواتيره بالتسلسل الزمني الدقيق.
                    </p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </>
      ) : (
        /* ARCHIVED / DELETED EMPLOYEES HISTORY VIEW (INDESTRUCTIBLE AND SECURE) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Archives Selection Column - col-span-5 */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 space-y-1.5 shadow-md">
              <h3 className="text-sm font-black flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>أرشيف التدقيق الأمني المحفوظ والمنقول</span>
              </h3>
              <p className="text-xs font-bold text-slate-400 leading-relaxed">
                ملفات وقوائم السلع للبائعين الذين تم حذف ملفهم الفعال. محمية من الضياع والتعديل لأغراض تتبع المخازن والمراجعة المستندات.
              </p>
            </div>

            {deletedEmployeesArchive.length === 0 ? (
              <div className="bg-white text-center py-20 rounded-3xl border border-slate-200 text-slate-600 text-sm font-black">
                لا توجد سجلات عمال محذوفة محفوظة حتى الآن.
              </div>
            ) : (
              <div className="space-y-3">
                {deletedEmployeesArchive.map((arch) => {
                  const isSelected = selectedArchivedEmp?.id === arch.id;

                  return (
                    <div
                      key={arch.id}
                      onClick={() => {
                        setSelectedArchivedEmp(arch);
                      }}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 select-none ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/15"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-black text-slate-900">{arch.employeeName}</p>
                          <span className="text-[10px] text-slate-500 font-bold block mt-0.5">منقول للأرشيف بـ: {arch.deletionDateStr}</span>
                        </div>
                        <span className="text-[10px] bg-rose-50 text-rose-700 font-black px-2 py-0.5 rounded-full">محذوف ومحفوظ</span>
                      </div>

                      <div className="grid grid-cols-3 gap-1 bg-slate-50 border border-slate-200/60 p-2 rounded-xl text-center text-[10px] font-bold text-slate-600">
                        <div>
                          <span>فواتير: </span>
                          <strong className="text-slate-900 font-mono font-black">{arch.invoiceCount}</strong>
                        </div>
                        <div>
                          <span>قطع: </span>
                          <strong className="text-slate-900 font-mono font-black">{arch.itemsSold}</strong>
                        </div>
                        <div>
                          <span>المجموع: </span>
                          <strong className="text-emerald-700 font-mono font-black">{arch.totalSales.toLocaleString("ar-EG")} ج</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Archived Employee Deep details - col-span-7 */}
          <div className="lg:col-span-7">
            <div className="bg-white p-7 rounded-3xl border-2 border-slate-200 shadow-md min-h-[380px] space-y-6">
              {selectedArchivedEmp ? (
                <div className="space-y-6">
                  <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
                    <div>
                      <h4 className="text-lg font-black text-slate-900">سجل البائع المحذوف: {selectedArchivedEmp.employeeName}</h4>
                      <p className="text-xs font-bold text-slate-500 mt-1">تاريخ ووقت الحذف والترحيل التلقائي: {selectedArchivedEmp.deletionDateStr}</p>
                    </div>
                    <ShieldCheck className="w-7 h-7 text-emerald-500 shrink-0" />
                  </div>

                  {/* Highlight stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-100 p-3.5 rounded-2xl border border-slate-205 text-center">
                      <span className="text-[10px] text-slate-600 font-bold block mb-1">المبيعات المحققة سابقاً</span>
                      <strong className="text-sm font-black font-mono text-emerald-800 block">
                        {selectedArchivedEmp.totalSales.toLocaleString("ar-EG")} ج.م
                      </strong>
                    </div>
                    <div className="bg-slate-100 p-3.5 rounded-2xl border border-slate-205 text-center">
                      <span className="text-[10px] text-slate-600 font-bold block mb-1">عدد الفواتير المنقولة</span>
                      <strong className="text-sm font-black font-mono text-slate-900 block">
                        {selectedArchivedEmp.invoiceCount} فواتير
                      </strong>
                    </div>
                    <div className="bg-slate-100 p-3.5 rounded-2xl border border-slate-205 text-center">
                      <span className="text-[10px] text-slate-600 font-bold block mb-1">عدد القطع المباعة</span>
                      <strong className="text-sm font-black font-mono text-slate-900 block">
                        {selectedArchivedEmp.itemsSold} قطعة
                      </strong>
                    </div>
                  </div>

                  {/* Breakdown of Sold Products */}
                  <div className="space-y-2.5">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <span>قائمة بجميع السلع التي قام ببيعها منفرداً قبل حذفه:</span>
                    </span>

                    {(() => {
                      const itemsSoldMap: Record<string, { count: number; name: string; value: number }> = {};
                      selectedArchivedEmp.invoicesCopied.forEach((inv) => {
                        inv.items.forEach((it) => {
                          if (!itemsSoldMap[it.name]) {
                            itemsSoldMap[it.name] = { name: it.name, count: 0, value: 0 };
                          }
                          itemsSoldMap[it.name].count += it.quantity;
                          itemsSoldMap[it.name].value += (it.quantity * it.price);
                        });
                      });
                      const itemsArray = Object.values(itemsSoldMap).sort((a, b) => b.count - a.count);

                      if (itemsArray.length === 0) {
                        return (
                          <p className="text-xs text-slate-500 text-center py-4 bg-slate-50/50 rounded-xl">
                            لا تتوفر مبيعات سلع سابقة في هذا السجل التاريخي.
                          </p>
                        );
                      }

                      return (
                        <div className="bg-emerald-50/10 border border-emerald-100/80 rounded-2xl p-4.5 space-y-2 max-h-[170px] overflow-y-auto">
                          {itemsArray.map((it) => (
                            <div key={it.name} className="flex justify-between items-center text-xs border-b border-slate-100 pb-2 last:border-0 last:pb-0 font-bold">
                              <span className="text-slate-800">{it.name}</span>
                              <div className="flex gap-4 font-mono text-slate-900">
                                <span>الكمية: {it.count} قطعة</span>
                                <span className="text-indigo-600 font-extrabold">{it.value.toLocaleString("ar-EG")} ج.م</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Copy of the detailed Invoices list */}
                  <div className="space-y-2">
                    <span className="text-xs font-black text-slate-800 block">أرشيف نسخ الفواتير الآمنه الموثقة للتأكيد:</span>
                    {selectedArchivedEmp.invoicesCopied.length === 0 ? (
                      <p className="text-xs text-slate-500 py-3 text-center bg-slate-50 rounded-xl">
                        لا يوجد نسخ لتلك الفواتير.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                        {selectedArchivedEmp.invoicesCopied.map((inv) => (
                          <div
                            key={inv.id}
                            onClick={() => onViewInvoice(inv)}
                            className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between text-xs cursor-pointer transition-all font-bold"
                          >
                            <div className="space-y-0.5 text-right">
                              <span className="font-mono font-black text-slate-900">#{inv.invoiceNumber} (نسخة أرشيفية)</span>
                              <span className="text-[10px] text-slate-500 block font-bold">
                                {inv.formattedDate} | {inv.formattedTime}
                              </span>
                            </div>
                            <span className="font-mono font-black text-slate-800 bg-slate-200 px-3 py-1 rounded-md text-xs">
                              {inv.total.toLocaleString("ar-EG")} ج.م
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-24 text-center text-slate-500 text-sm space-y-3 h-full flex flex-col items-center justify-center">
                  <ShieldCheck className="w-12 h-12 text-slate-300" />
                  <p className="font-black text-slate-900">قم باختيار عامل منقول للملف الأمني</p>
                  <p className="text-xs font-bold text-slate-505 max-w-sm leading-relaxed mx-auto">
                    لرؤية الملفات ونسخ الفواتير التاريخية الملغاة والمحذوفة التي لا يمكن فقدانها، والمبيعات المنقولة لحساب مبيعات عامة.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Custom Modern React Overlay Modals for Secure Warnings / Alerts */}
      {deleteConfirmEmpName && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-right space-y-6 animate-scaleUp" dir="rtl">
            <div className="flex items-center justify-center w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl mx-auto shadow-sm">
              <Trash2 className="w-6 h-6 animate-pulse" />
            </div>
            <div className="text-center space-y-3">
              <h3 className="text-lg font-black text-slate-900">تنبيه أمان هام: حذف وتصفية العامل</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                هل أنت متأكد من حذف البائع <strong className="text-rose-600">[{deleteConfirmEmpName}]</strong> وتصفية سجله؟
              </p>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs space-y-2 text-right font-semibold text-slate-700">
                <p className="flex items-start gap-1">
                  <span>1-</span>
                  <span>لن تضيع مبيعاته الإجمالية، بل سيتم فوراً تحويل كافة مبيعاته الحالية والسابقة لتتسجل باسم "مبيعات عامة".</span>
                </p>
                <p className="flex items-start gap-1">
                  <span>2-</span>
                  <span>سيتم تلقائياً حفظ نسخة تفصيلية في الأرشيف الآمن "غير قابلة للضياع والمحو" لمراجعة مبيعاته السابقة في أي وقت.</span>
                </p>
              </div>
            </div>
            <div className="flex gap-3 font-bold">
              <button
                type="button"
                onClick={() => {
                  const targetName = deleteConfirmEmpName;
                  onDeleteEmployee(targetName);
                  if (selectedSeller === targetName) {
                    setSelectedSeller(null);
                  }
                  setDeleteConfirmEmpName(null);
                  setCustomAlertMsg(`🎉 تم حذف العامل [${targetName}] بنجاح، ونقل كافة مبيعاته الفعالة لـ "مبيعات عامة"، وأرشفة تقريره كاملاً وموثقاً في أرشيف المحذوفات غير القابل للتلف.`);
                }}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm text-center"
              >
                تأكيد الحذف وتصفية السجل
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmEmpName(null)}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
              >
                التراجع وإلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Employee Name Modal */}
      {editEmpName && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 text-right space-y-6 animate-scaleUp" dir="rtl">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl mx-auto shadow-sm">
              <Edit2 className="w-6 h-6 animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-black text-slate-900">تعديل وتحديث اسم البائع</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                تعديل اسم العامل <strong className="text-blue-600">[{editEmpName}]</strong>، وسيتم تلقائياً تحديث الاسم في جميع الفواتير والمصروفات والأرشيفات المرتبطة به.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const oldName = editEmpName;
                const newName = editEmpInput.trim();
                if (!newName) return;

                if (normName(oldName) !== normName(newName) && normalizedEmployeesList.includes(normName(newName))) {
                  setCustomAlertMsg(`⚠️ الاسم الجديد [${newName}] مسجل بالفعل لبائع آخر.`);
                  return;
                }

                if (onUpdateEmployee) {
                  onUpdateEmployee(oldName, newName);
                }
                if (selectedSeller === oldName) {
                  setSelectedSeller(newName);
                }
                setEditEmpName(null);
                setCustomAlertMsg(`🎉 تم تحديث اسم البائع من [${oldName}] إلى [${newName}] بنجاح، وتحديث كافة سجلاته في النظام.`);
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">الاسم الجديد للبائع:</label>
                <input
                  type="text"
                  required
                  value={editEmpInput}
                  onChange={(e) => setEditEmpInput(e.target.value)}
                  placeholder="اكتب الاسم الجديد..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 text-right"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 font-bold pt-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm text-center"
                >
                  حفظ وتحديث الاسم
                </button>
                <button
                  type="button"
                  onClick={() => setEditEmpName(null)}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer text-center"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {customAlertMsg && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-right space-y-6 animate-scaleUp" dir="rtl">
            <div className="flex items-center justify-center w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl mx-auto shadow-sm">
              <ShieldCheck className="w-6 h-6 animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-md font-black text-slate-900">تنويه من النظام</h3>
              <p className="text-xs text-slate-650 leading-relaxed font-black">{customAlertMsg}</p>
            </div>
            <button
              type="button"
              onClick={() => setCustomAlertMsg(null)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer text-center shadow-md animate-bounce-subtle"
            >
              مفهوم ومتابعـة
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
