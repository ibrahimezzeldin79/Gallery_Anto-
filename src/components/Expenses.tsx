import React, { useState } from "react";
import { Expense, Invoice } from "../types";
import { 
  PlusCircle, 
  Trash2, 
  Search, 
  Receipt, 
  TrendingDown, 
  DollarSign, 
  CalendarDays, 
  Clock, 
  User, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Tag,
  Wallet
} from "lucide-react";

interface ExpensesProps {
  expenses: Expense[];
  invoices: Invoice[];
  onAddExpense: (expense: Expense) => Promise<void> | void;
  onDeleteExpense: (id: string) => Promise<void> | void;
  sellerName?: string;
  employees?: string[];
}

const COMMON_EXPENSE_TITLES = [
  "أجرة شحن ونقل",
  "ضيافة ومشروبات",
  "أدوات نظافة ومطبوعات",
  "صيانة وإصلاحات",
  "كهرباء ومرافق",
  "إكراميات ونثريات",
  "سلفة / راتب موظف",
  "أخرى"
];

export default function Expenses({
  expenses,
  invoices,
  onAddExpense,
  onDeleteExpense,
  sellerName = "",
  employees = []
}: ExpensesProps) {
  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [registrar, setRegistrar] = useState(sellerName || (employees.length > 0 ? employees[0] : "مسؤول المعرض"));
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter & Search
  const [period, setPeriod] = useState<"active" | "all">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Delete Confirmation State
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  // Active (unclosed) invoices & expenses
  const activeInvoices = invoices.filter((i) => !i.closedDayId);
  const activeExpenses = expenses.filter((e) => !e.closedDayId);

  const displayExpenses = (period === "active" ? activeExpenses : expenses).filter((exp) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      exp.title.toLowerCase().includes(q) ||
      (exp.notes && exp.notes.toLowerCase().includes(q)) ||
      (exp.sellerName && exp.sellerName.toLowerCase().includes(q)) ||
      exp.amount.toString().includes(q)
    );
  });

  // Calculate totals
  const totalSalesActive = activeInvoices.reduce((sum, i) => sum + i.total, 0);
  const totalExpensesActive = activeExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netSalesActive = totalSalesActive - totalExpensesActive;

  const totalSalesAll = invoices.reduce((sum, i) => sum + i.total, 0);
  const totalExpensesAll = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netSalesAll = totalSalesAll - totalExpensesAll;

  const currentTotalSales = period === "active" ? totalSalesActive : totalSalesAll;
  const currentTotalExpenses = period === "active" ? totalExpensesActive : totalExpensesAll;
  const currentNetSales = period === "active" ? netSalesActive : netSalesAll;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    const numAmount = parseFloat(amount);
    if (!title.trim()) {
      setFormError("يرجى إدخال أو اختيار عنوان المصروف");
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError("يرجى إدخال مبلغ صحيح أكبر من صفر");
      return;
    }

    setIsSubmitting(true);
    const now = new Date();
    const formattedDate = now.toLocaleDateString("ar-EG", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
    const formattedTime = now.toLocaleTimeString("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });

    const newExpense: Expense = {
      id: "exp-" + Date.now(),
      title: title.trim(),
      amount: numAmount,
      timestamp: now.getTime(),
      formattedDate,
      formattedTime,
      notes: notes.trim(),
      sellerName: registrar.trim() || sellerName || "مسؤول المعرض"
    };

    try {
      await onAddExpense(newExpense);
      // Reset form
      setTitle("");
      setAmount("");
      setNotes("");
      setShowAddModal(false);
    } catch (err: any) {
      setFormError("فشل حفظ المصروف: " + (err.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    setDeletingId(expenseToDelete.id);
    try {
      await onDeleteExpense(expenseToDelete.id);
      setExpenseToDelete(null);
    } catch (err: any) {
      alert("❌ خطأ أثناء حذف المصروف: " + (err.message || err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn" dir="rtl">
      
      {/* Top Banner Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-50 rounded-xl text-rose-600">
              <TrendingDown className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">إدارة المصروفات اليومية والنثريات</h2>
          </div>
          <p className="text-xs text-slate-400">
            سجل جميع المصروفات اليومية لمعرضك لتتخصم تلقائياً من المبيعات وحساب الصافي الخالص بكل دقة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Period Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 select-none text-xs">
            <button
              type="button"
              onClick={() => setPeriod("active")}
              className={`px-4 py-2 rounded-xl font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                period === "active" ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>مصروفات اليوم</span>
            </button>
            <button
              type="button"
              onClick={() => setPeriod("all")}
              className={`px-4 py-2 rounded-xl font-black transition-all cursor-pointer ${
                period === "all" ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              📋 كافة المصروفات
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowAddModal(true);
              setFormError("");
            }}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-black shadow-md hover:shadow-rose-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>إضافة مصروف جديد</span>
          </button>
        </div>
      </div>

      {/* Dynamic Net Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Today's Gross Sales */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400">إجمالي المبيعات ({period === "active" ? "اليوم" : "تراكمي"})</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-800 font-mono">
                {currentTotalSales.toLocaleString("ar-EG")}
              </span>
              <span className="text-xs font-bold text-slate-500">جنيه</span>
            </div>
            <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>قبل خصم أي مصروفات</span>
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400">إجمالي المصروفات ({period === "active" ? "اليوم" : "تراكمي"})</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-rose-600 font-mono">
                {currentTotalExpenses.toLocaleString("ar-EG")}
              </span>
              <span className="text-xs font-bold text-rose-500">جنيه</span>
            </div>
            <p className="text-[11px] text-rose-500 font-bold flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>عدد البنود: {displayExpenses.length} بند</span>
            </p>
          </div>
          <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
            <Receipt className="w-6 h-6" />
          </div>
        </div>

        {/* Net Sales */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 rounded-3xl shadow-lg flex items-center justify-between border border-slate-700">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-300">صافي المبيعات</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-emerald-400 font-mono">
                {currentNetSales.toLocaleString("ar-EG")}
              </span>
              <span className="text-xs font-bold text-slate-300">جنيه</span>
            </div>
            <p className="text-[11px] text-slate-400 font-light">
              المبلغ الصافي الخالص في الخزينة
            </p>
          </div>
          <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center justify-center text-emerald-400">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Expenses List Section */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-slate-700" />
            <h3 className="text-base font-bold text-slate-800">
              {period === "active" ? "جدول مصروفات اليوم" : "جدول سجل كافة المصروفات المسجلة"}
            </h3>
            <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {displayExpenses.length}
            </span>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="بحث بالاسم أو البيان أو الملاحظات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2 bg-slate-50 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all"
            />
          </div>
        </div>

        {displayExpenses.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mx-auto">
              <Receipt className="w-8 h-8" />
            </div>
            <h4 className="text-sm font-bold text-slate-600">لا توجد أية مصروفات مسجلة حالياً</h4>
            <p className="text-xs text-slate-400">اضغط على زر "إضافة مصروف جديد" بالأعلى لتسجيل أي بند مصروفات جديد.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 font-bold">
                  <th className="p-4 rounded-r-xl">بيان المصروف / العنوان</th>
                  <th className="p-4">المبلغ</th>
                  <th className="p-4">التاريخ والوقت</th>
                  <th className="p-4">ملاحظات</th>
                  <th className="p-4 text-center rounded-l-xl">مسح البند</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition-all group">
                    <td className="p-4 font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>{exp.title}</span>
                      </div>
                    </td>

                    <td className="p-4 font-mono font-black text-rose-600 text-sm">
                      -{exp.amount.toLocaleString("ar-EG")} جنيه
                    </td>

                    <td className="p-4 text-slate-500 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                        <span>{exp.formattedDate}</span>
                        <Clock className="w-3.5 h-3.5 text-slate-400 ml-1" />
                        <span>{exp.formattedTime}</span>
                      </div>
                    </td>

                    <td className="p-4 text-slate-500 max-w-xs truncate">
                      {exp.notes ? exp.notes : <span className="text-slate-300">-</span>}
                    </td>

                    <td className="p-4 text-center">
                      <button
                        type="button"
                        disabled={deletingId === exp.id}
                        onClick={() => setExpenseToDelete(exp)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                        title="مسح هذا البند"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Add New Expense */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 relative">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-rose-600" />
                <h3 className="text-base font-extrabold text-slate-800">تسجيل مصروف جديد</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Title Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">عنوان/بيان المصروف *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أجرة نقل بضاعة، مشروبات، صيانة..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all font-bold"
                />
              </div>

              {/* Amount Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">المبلغ (بالجنيه) *</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all font-mono font-black text-rose-600"
                  />
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">جنيه</span>
                </div>
              </div>

              {/* Notes Input */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">ملاحظات إضافية (اختياري)</label>
                <textarea
                  rows={2}
                  placeholder="أي تفاصيل أخرى توضيحية..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? "جاري الحفظ..." : "حفظ المصروف"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Expense Deletion */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-right">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900">تأكيد مسح بند المصروف</h3>
              <p className="text-xs text-slate-500 font-bold">هل أنت متأكد من رغبتك في حذف هذا المصروف نهائياً؟</p>
            </div>

            {/* Expense details summary box */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 text-xs font-bold">
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
                <span className="text-slate-500">عنوان البند:</span>
                <span className="text-slate-900 font-extrabold">{expenseToDelete.title}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
                <span className="text-slate-500">المبلغ:</span>
                <span className="text-rose-600 font-black font-mono">{expenseToDelete.amount.toLocaleString("ar-EG")} جنيه</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-200/80 pb-2">
                <span className="text-slate-500">التاريخ والوقت:</span>
                <span className="text-slate-700 text-[11px]">{expenseToDelete.formattedDate} ({expenseToDelete.formattedTime})</span>
              </div>
              {expenseToDelete.notes && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">ملاحظات:</span>
                  <span className="text-slate-700 font-normal">{expenseToDelete.notes}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={confirmDeleteExpense}
                disabled={!!deletingId}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3 rounded-xl text-xs transition-all cursor-pointer shadow-md disabled:opacity-50"
              >
                {deletingId ? "جاري المسح..." : "نعم، تأكيد المسح"}
              </button>
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
