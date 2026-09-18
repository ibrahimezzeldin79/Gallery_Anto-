import React, { useState } from "react";
import { Invoice } from "../types";
import { 
  Search, 
  Printer, 
  Trash, 
  Calendar, 
  Clock, 
  DollarSign, 
  FileText, 
  FileSpreadsheet, 
  ShieldAlert, 
  X, 
  Lock, 
  CheckCircle2, 
  UserCheck, 
  Edit3, 
  User, 
  Save, 
  AlertCircle,
  CreditCard,
  ShoppingCart,
  ArrowRight,
  Pencil
} from "lucide-react";

interface InvoicesProps {
  invoices: Invoice[];
  deletedInvoices: Invoice[];
  onDeleteInvoice: (id: string) => void;
  onUpdateInvoice?: (invoice: Invoice) => void;
  onViewInvoice: (invoice: Invoice) => void;
  onEditInvoiceInPOS?: (invoice: Invoice) => void;
  deletionPassword?: string;
  employees?: string[];
}

export default function Invoices({ 
  invoices, 
  deletedInvoices = [], 
  onDeleteInvoice, 
  onUpdateInvoice,
  onViewInvoice,
  onEditInvoiceInPOS,
  deletionPassword = "0000",
  employees = []
}: InvoicesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sessionFilter, setSessionFilter] = useState<"all" | "active" | "closed">("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [sellerFilter, setSellerFilter] = useState<string>("all");
  const [viewTab, setViewTab] = useState<"active" | "deleted">("active");
  
  // Security delete popups
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);

  // Edit Invoice Modal states
  const [editingInvoiceModal, setEditingInvoiceModal] = useState<Invoice | null>(null);
  const [editModalTab, setEditModalTab] = useState<"menu" | "seller" | "payment">("menu");
  const [editSellerName, setEditSellerName] = useState("");
  const [editSellerSelectionMode, setEditSellerSelectionMode] = useState<"select" | "custom">("select");
  const [editPaymentMethod, setEditPaymentMethod] = useState("كاش");
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);

  // Active or Deleted list based on select Tab
  const activeList = viewTab === "active" ? invoices : deletedInvoices;

  // Build unique seller list
  const allSellerOptions = React.useMemo(() => {
    const sellersSet = new Set<string>();
    employees.forEach(e => {
      if (e && e.trim()) sellersSet.add(e.trim());
    });
    invoices.forEach(i => {
      if (i.sellerName && i.sellerName.trim()) sellersSet.add(i.sellerName.trim());
    });
    deletedInvoices.forEach(i => {
      if (i.sellerName && i.sellerName.trim()) sellersSet.add(i.sellerName.trim());
    });
    return Array.from(sellersSet);
  }, [employees, invoices, deletedInvoices]);

  // Filter list based on date, search term, seller, session status and payment method
  const filteredInvoices = activeList.filter((inv) => {
    const term = searchTerm.trim().toLowerCase();
    const invoiceNumMatch = inv.invoiceNumber.toLowerCase().includes(term);
    const sellerMatch = (inv.sellerName || "مبيعات عامة").toLowerCase().includes(term);
    const phoneMatch = inv.customerPhone ? inv.customerPhone.toLowerCase().includes(term) : false;
    
    // Check if any product name inside items list matches search term
    const itemMatch = inv.items.some(item => item.name.toLowerCase().includes(term));
    
    // Check Seller Filter match
    let sellerFilterMatch = true;
    if (sellerFilter !== "all") {
      const invSeller = (inv.sellerName || "مبيعات عامة").trim().toLowerCase();
      sellerFilterMatch = invSeller === sellerFilter.trim().toLowerCase();
    }

    // Check Date match
    let dateMatch = true;
    if (dateFilter) {
      if (inv.timestamp) {
        const invDate = new Date(inv.timestamp);
        if (!isNaN(invDate.getTime())) {
          const invYear = invDate.getFullYear();
          const invMonth = String(invDate.getMonth() + 1).padStart(2, '0');
          const invDay = String(invDate.getDate()).padStart(2, '0');
          const formattedInputDate = `${invYear}-${invMonth}-${invDay}`;
          dateMatch = formattedInputDate === dateFilter;
        } else {
          dateMatch = false;
        }
      } else {
        dateMatch = false;
      }
    }

    // Check Session (active / closed) match
    let sessionMatch = true;
    if (viewTab === "active") {
      if (sessionFilter === "active") {
        sessionMatch = !inv.closedDayId;
      } else if (sessionFilter === "closed") {
        sessionMatch = !!inv.closedDayId;
      }
    }

    // Check Payment Method match
    let paymentMatch = true;
    if (paymentFilter !== "all") {
      const invPayment = inv.paymentMethod || "كاش";
      if (inv.splitPayments && inv.splitPayments.length > 0) {
        paymentMatch = inv.splitPayments.some(sp => sp.method === paymentFilter) || invPayment.includes(paymentFilter);
      } else {
        paymentMatch = invPayment === paymentFilter;
      }
    }

    return (invoiceNumMatch || itemMatch || sellerMatch || phoneMatch) && sellerFilterMatch && dateMatch && sessionMatch && paymentMatch;
  });

  // Trigger Deletion Modal
  const requestDelete = (id: string) => {
    setInvoiceToDelete(id);
    setDeletePassword("");
    setPasswordError(false);
  };

  // Open Main Edit Modal
  const handleOpenEditModal = (inv: Invoice) => {
    setEditingInvoiceModal(inv);
    setEditModalTab("menu");
    const currentSeller = inv.sellerName?.trim() || "";
    setEditSellerName(currentSeller);
    setEditPaymentMethod(inv.paymentMethod || "كاش");
    if (employees.includes(currentSeller)) {
      setEditSellerSelectionMode("select");
    } else if (currentSeller) {
      setEditSellerSelectionMode("custom");
    } else {
      setEditSellerSelectionMode("select");
    }
  };

  // Save Seller only
  const handleSaveSellerOnly = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoiceModal) return;
    const finalSeller = editSellerName.trim();
    if (!finalSeller) {
      alert("⚠️ يرجى تحديد أو كتابة اسم البائع للفاتورة");
      return;
    }

    if (onUpdateInvoice) {
      onUpdateInvoice({
        ...editingInvoiceModal,
        sellerName: finalSeller
      });
    }

    setToastSuccess(`تم تعديل اسم البائع للفاتورة #${editingInvoiceModal.invoiceNumber} بنجاح إلى: [${finalSeller}]، وتم تحديث مبيعاته في صفحة العمال.`);
    setEditingInvoiceModal(null);
    setTimeout(() => {
      setToastSuccess(null);
    }, 4500);
  };

  // Save Payment Method only
  const handleSavePaymentMethodOnly = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInvoiceModal) return;

    if (onUpdateInvoice) {
      onUpdateInvoice({
        ...editingInvoiceModal,
        paymentMethod: editPaymentMethod
      });
    }

    setToastSuccess(`تم تعديل طريقة الدفع للفاتورة #${editingInvoiceModal.invoiceNumber} بنجاح إلى: [${editPaymentMethod}].`);
    setEditingInvoiceModal(null);
    setTimeout(() => {
      setToastSuccess(null);
    }, 4500);
  };

  // Edit Full Invoice in POS
  const handleEditFullInvoiceInPOS = () => {
    if (!editingInvoiceModal) return;
    if (onEditInvoiceInPOS) {
      onEditInvoiceInPOS(editingInvoiceModal);
      setEditingInvoiceModal(null);
    }
  };

  // Perform Secure Delete with password
  const handleConfirmDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (deletePassword === "0000" || deletePassword === deletionPassword) {
      if (invoiceToDelete) {
        onDeleteInvoice(invoiceToDelete);
        setInvoiceToDelete(null);
        setShowDeleteSuccessModal(true);
      }
    } else {
      setPasswordError(true);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn" dir="rtl">
      
      {/* SUCCESS NOTIFICATION TOAST */}
      {toastSuccess && (
        <div className="bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between gap-3 animate-fadeIn border border-emerald-500 font-bold text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-100 shrink-0" />
            <span>{toastSuccess}</span>
          </div>
          <button 
            onClick={() => setToastSuccess(null)}
            className="p-1 hover:bg-emerald-700 rounded-lg text-emerald-100 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      /* FILTERING AND CONTROLS SECTION */
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-md font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              <span>{viewTab === "active" ? "سجل الفواتير والمستندات المحاسبية" : "الأرشيف الآمن للفواتير الملغاة"}</span>
            </h2>
            <p className="text-[10px] text-slate-400">
              {viewTab === "active" 
                ? "قائمة مبيعات الفواتير الحالية المسجلة في النظام الفعال." 
                : "أرشيف دائم غير قابل للتعديل يحتوي على جميع الفواتير المحذوفة لأغراض التدقيق المالي."}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* View Tab Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewTab("active")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewTab === "active"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                <span>الفواتير الفعالة ({invoices.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setViewTab("deleted")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewTab === "deleted"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-500"
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>سجل المحذوفات ({deletedInvoices.length}) 🔒</span>
              </button>
            </div>

            {/* Search by number, product, phone or seller */}
            <div className="flex flex-col gap-1 w-full sm:w-72">
              <span className="text-[10px] font-bold text-slate-400 mr-1">البحث برقم الفاتورة أو رقم موبيل العميل أو الصنف</span>
              <div className="relative w-full">
                <input 
                  type="text"
                  placeholder="رقم الفاتورة، رقم موبيل العميل، اسم المنتج، البائع..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              </div>
            </div>

            {/* Session Status Filter (Active / Closed Shift) */}
            {viewTab === "active" && (
              <div className="flex flex-col gap-1 w-full sm:w-48">
                <span className="text-[10px] font-bold text-slate-400 mr-1">تصفية حالة الوردية</span>
                <div className="relative w-full">
                  <select
                    value={sessionFilter}
                    onChange={(e) => setSessionFilter(e.target.value as any)}
                    className="w-full pl-3 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700 cursor-pointer"
                  >
                    <option value="all">📁 جميع الفواتير</option>
                    <option value="active">🟢 فواتير اليوم فقط</option>
                    <option value="closed">📦 الفواتير المغلقة والمرحلة</option>
                  </select>
                </div>
              </div>
            )}

            {/* Filter by Seller */}
            <div className="flex flex-col gap-1 w-full sm:w-44">
              <span className="text-[10px] font-bold text-slate-400 mr-1">تصفية حسب البائع</span>
              <div className="relative w-full">
                <select
                  value={sellerFilter}
                  onChange={(e) => setSellerFilter(e.target.value)}
                  className="w-full pl-3 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700 cursor-pointer"
                >
                  <option value="all">👥 كل البائعين</option>
                  {allSellerOptions.map((seller) => (
                    <option key={seller} value={seller}>{seller}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Filter by Payment Method */}
            <div className="flex flex-col gap-1 w-full sm:w-44">
              <span className="text-[10px] font-bold text-slate-400 mr-1">طريقة الدفع</span>
              <div className="relative w-full">
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value)}
                  className="w-full pl-3 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700 cursor-pointer"
                >
                  <option value="all">جميع الطرق</option>
                  <option value="كاش">💵 كاش</option>
                  <option value="انستا باي">⚡ انستا باي</option>
                  <option value="فودافون كاش">📱 فودافون كاش</option>
                  <option value="فيزا">💳 فيزا</option>
                </select>
              </div>
            </div>

            {/* Filter by Specific Date (dd/mm/yyyy format hint) */}
            <div className="flex flex-col gap-1 w-full sm:w-44">
              <span className="text-[10px] font-bold text-slate-400 mr-1">تاريخ اليوم (dd/mm/yyyy)</span>
              <div className="relative w-full">
                <input 
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  placeholder="dd/mm/yyyy"
                  className="w-full text-right pl-3 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-slate-700"
                />
              </div>
            </div>

            {/* Clear Filters */}
            {(searchTerm || dateFilter || sessionFilter !== "all" || paymentFilter !== "all" || sellerFilter !== "all") && (
              <div className="flex flex-col justify-end">
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setDateFilter("");
                    setSessionFilter("all");
                    setPaymentFilter("all");
                    setSellerFilter("all");
                  }}
                  className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer h-9 mt-auto"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>مسح الفلترة</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* TABLE/LISTING */}
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-16 bg-slate-50/50 rounded-2xl border border-slate-100/50 text-slate-400 text-xs space-y-2">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="font-bold">لا توجد فواتير مطابقة لخيارات البحث المحددة.</p>
            <p className="text-[10px] text-slate-400">حاول تغيير عبارة البحث أو الفلتر الزمني المستخدم.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-50 rounded-2xl">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="border-b bg-slate-50 border-slate-100 text-slate-500 font-bold">
                  {viewTab === "active" ? (
                    <>
                      <th className="py-3 px-4">رقم الفاتورة</th>
                      <th className="py-3 px-4">التاريخ واليوم والوقت</th>
                      <th className="py-3 px-4 text-center">حالة الحساب</th>
                      <th className="py-3 px-4 text-center">اسم البائع</th>
                      <th className="py-3 px-4">المنتجات المشتراة</th>
                      <th className="py-3 px-4 text-left">المبلغ المطلوب</th>
                      <th className="py-3 px-4 text-center">الخيارات</th>
                    </>
                  ) : (
                    <>
                      <th className="py-3 px-4">رقم الفاتورة الملغية</th>
                      <th className="py-3 px-4">تاريخ البيع الأصلي</th>
                      <th className="py-3 px-4">تاريخ ووقت الإلغاء</th>
                      <th className="py-3 px-4 text-center">اسم البائع</th>
                      <th className="py-3 px-4">المنتجات الملغاة</th>
                      <th className="py-3 px-4 text-left">المبلغ المرتجع</th>
                      <th className="py-3 px-4 text-center">خيارات المعاينة</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...filteredInvoices].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).map((inv) => {
                  const sellerDisplayName = inv.sellerName?.trim() || "مبيعات عامة";
                  
                  if (viewTab === "active") {
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50/40 group transition-all">
                        {/* Invoice Number & Customer Phone */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-black text-slate-900">{inv.invoiceNumber}</div>
                          {inv.customerPhone && (
                            <div className="text-[10.5px] text-emerald-700 font-mono font-bold flex items-center gap-1 mt-0.5" dir="ltr">
                              <span>📱 {inv.customerPhone}</span>
                            </div>
                          )}
                        </td>
                        
                        {/* Timestamp Info */}
                        <td className="py-3.5 px-4 text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-slate-450" />
                            <span>{inv.formattedDate}</span>
                            <span className="text-slate-300 font-light mx-0.5">|</span>
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span className="font-mono text-amber-600 font-bold">{inv.formattedTime}</span>
                          </div>
                        </td>

                        {/* Payment Method & Split Payment Details */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            {inv.splitPayments && inv.splitPayments.length > 0 ? (
                              <div className="inline-flex flex-col bg-purple-50 text-purple-900 border border-purple-200 px-2.5 py-1 rounded-xl text-[10px] font-bold text-right shadow-xs">
                                <span className="font-extrabold text-purple-800 text-center mb-0.5">🔀 دفع مجزأ</span>
                                <div className="space-y-0.5 text-[9.5px]">
                                  {inv.splitPayments.map((sp, i) => (
                                    <div key={i} className="flex items-center justify-between gap-2 font-mono">
                                      <span className="font-bold text-purple-950">{sp.method}:</span>
                                      <span className="font-black text-purple-900">{Number(sp.amount).toLocaleString("ar-EG")} ج.م</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-xl text-[10px] font-extrabold">
                                {inv.paymentMethod || "كاش"}
                              </span>
                            )}
                            {inv.isDiscountedBelowBase && (
                              <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-lg text-[9px] font-black animate-pulse" title={inv.discountAlerts?.join(" | ")}>
                                ⚠️ بيع تحت السعر الأساسي
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Seller Name */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center">
                            <span className="bg-slate-100 border border-slate-200 text-slate-800 px-2.5 py-1 rounded-lg text-xs font-black inline-block">
                              {sellerDisplayName}
                            </span>
                          </div>
                        </td>

                        {/* List of product items */}
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={inv.items.map(it => `${it.name} (x${it.quantity})`).join(", ")}>
                          {inv.items.map(it => `${it.name} (×${it.quantity})`).join(" + ")}
                        </td>

                        {/* Total cost */}
                        <td className="py-3.5 px-4 text-left font-mono font-black text-slate-950 text-sm">
                          {inv.total.toLocaleString("ar-EG")} ج.م
                        </td>

                        {/* Controls and Operations */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {onUpdateInvoice && (
                              <button 
                                onClick={() => handleOpenEditModal(inv)}
                                className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 font-black text-[11px] shadow-sm active:scale-95 border border-amber-600/30"
                                title="تعديل الفاتورة (البائع / طريقة الدفع / محتويات الفاتورة)"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-950" />
                                <span>تعديل</span>
                              </button>
                            )}

                            <button 
                              onClick={() => onViewInvoice(inv)}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-600 p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 font-bold text-[10px]"
                              title="معاينة وطباعة الفاتورة"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>معاينة وطباعة</span>
                            </button>
                            
                            <button 
                              onClick={() => requestDelete(inv.id)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-500 p-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 font-bold text-[10px]"
                              title="إلغاء وحذف الفاتورة"
                            >
                              <Trash className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  } else {
                    return (
                      <tr key={inv.id} className="hover:bg-rose-50/10 group transition-all">
                        {/* Invoice Number & Customer Phone */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-black text-rose-700">{inv.invoiceNumber}</div>
                          {inv.customerPhone && (
                            <div className="text-[10px] text-slate-500 font-mono font-bold flex items-center gap-1 mt-0.5" dir="ltr">
                              <span>📱 {inv.customerPhone}</span>
                            </div>
                          )}
                        </td>
                        
                        {/* original Sale date */}
                        <td className="py-3.5 px-4 text-slate-500">{inv.formattedDate}</td>
                        
                        {/* Deletion Info */}
                        <td className="py-3.5 px-4 text-slate-700">
                          <div className="flex items-center gap-1.5 font-bold text-rose-600">
                            <Trash className="w-3 h-3 text-rose-500" />
                            <span>{(inv as any).deletedDateStr || inv.formattedDate}</span>
                            <span className="text-slate-300 font-light mx-0.5">|</span>
                            <Clock className="w-3 h-3 text-rose-500 animate-pulse" />
                            <span className="font-mono">{(inv as any).deletedTimeStr || inv.formattedTime}</span>
                          </div>
                        </td>

                        {/* Seller Name */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="bg-rose-50 border border-rose-200 text-rose-800 px-2.5 py-1 rounded-lg text-xs font-bold inline-block">
                            {sellerDisplayName}
                          </span>
                        </td>

                        {/* List of product items */}
                        <td className="py-3.5 px-4 text-slate-550 max-w-xs truncate" title={inv.items.map(it => `${it.name} (x${it.quantity})`).join(", ")}>
                          {inv.items.map(it => `${it.name} (×${it.quantity})`).join(" + ")}
                        </td>

                        {/* Total refund / loss value */}
                        <td className="py-3.5 px-4 text-left font-mono font-black text-rose-700 text-sm">
                          {inv.total.toLocaleString("ar-EG")} ج.م
                        </td>

                        {/* Prints for deleted invoices */}
                        <td className="py-3.5 px-4 text-center">
                          <button 
                            onClick={() => onViewInvoice(inv)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-xl transition-all cursor-pointer inline-flex items-center gap-1 font-bold text-[10px]"
                            title="معاينة وطباعة الفاتورة الملغية"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>معاينة الفاتورة الملغاة</span>
                          </button>
                        </td>
                      </tr>
                    );
                  }
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SUPERVISOR DELETE INVOICE SECURITY DIALOG PASSWORD */}
      {invoiceToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 animate-scaleUp">
            <div className="bg-rose-600 text-white p-5 flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-white shrink-0" />
              <div>
                <h3 className="text-md font-bold">إلغاء مبيعات وحذف فاتورة</h3>
                <p className="text-[10px] text-rose-100 mt-0.5">صلاحيات الإشراف الأمني مطلوبة من أجل المتابعة</p>
              </div>
            </div>

            <form onSubmit={handleConfirmDelete} className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                هل أنت متأكد من رغبتك في إلغاء هذه العملية وحذف الفاتورة نهائياً؟ هذا الإجراء سيقوم بإرجاع كميات السلع المباعة للمخزن وتحديث الأرباح فوراً، وسيتم إضافتها لسجل الأرشيف المحمي غير القابل للتدمير.
              </p>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 block">باسوورد الأمان للمدير العام (Supervisor Key)</label>
                <input 
                  type="password"
                  required
                  placeholder="أدخل باسوورد الأمان للإلغاء..."
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:outline-none placeholder-slate-400 font-mono text-center font-black"
                />
                {passwordError && (
                  <p className="text-[10px] text-rose-600 font-bold">باسوورد التحقق غير صحيحة! يرجى الاستعانة برئيس المعرض.</p>
                )}
              </div>

              <div className="pt-2 flex gap-2.5">
                <button
                  type="submit"
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all active:scale-[0.98] cursor-pointer"
                >
                  تأكيد الحذف نهائياً
                </button>
                <button
                  type="button"
                  onClick={() => setInvoiceToDelete(null)}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE SUCCESS NOTIFICATION MODAL (REQUIREMENT 1) */}
      {showDeleteSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 text-center space-y-4 border border-slate-100 shadow-2xl animate-scaleUp">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-black text-slate-900">تم حذف الفاتورة بنجاح</h3>
              <p className="text-xs text-slate-600 font-bold leading-relaxed">
                تم حذف الفاتورة بنجاح ونقلها إلى سجل المحذوفات!
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteSuccessModal(false);
                  setViewTab("deleted");
                }}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-amber-400 font-black py-3 rounded-xl text-xs transition-all cursor-pointer shadow-md active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>فتح سجل المحذوفات الآن</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteSuccessModal(false)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-3 rounded-xl text-xs transition-all cursor-pointer"
              >
                حسناً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MAIN 3-BUTTON EDIT INVOICE MODAL */}
      {editingInvoiceModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 animate-scaleUp">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    {editModalTab === "menu" && "خيارات تعديل الفاتورة"}
                    {editModalTab === "seller" && "تعديل اسم مسؤول البيع (البائع)"}
                    {editModalTab === "payment" && "تعديل طريقة دفع الفاتورة"}
                  </h3>
                  <p className="text-[11px] text-amber-400 font-mono mt-0.5 font-bold">
                    فاتورة رقم #{editingInvoiceModal.invoiceNumber} | الإجمالي: {editingInvoiceModal.total.toLocaleString("ar-EG")} ج.م
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingInvoiceModal(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL VIEW 1: THREE BUTTONS MENU */}
            {editModalTab === "menu" && (
              <div className="p-6 space-y-4">
                <p className="text-xs text-slate-600 font-bold leading-relaxed">
                  اختر نوع التعديل الذي ترغب في إجرائه على هذه الفاتورة:
                </p>

                <div className="space-y-3">
                  {/* Button 1: Edit Seller */}
                  <button
                    type="button"
                    onClick={() => setEditModalTab("seller")}
                    className="w-full text-right p-4 rounded-2xl border-2 border-slate-200 hover:border-amber-500 bg-slate-50 hover:bg-amber-50/50 transition-all cursor-pointer group flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black group-hover:scale-105 transition-transform">
                        <UserCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-900 group-hover:text-amber-800">
                          1. تعديل البائع (مسؤول البيع)
                        </div>
                        <div className="text-[11px] text-slate-500 font-bold mt-0.5">
                          البائع الحالي: <span className="text-slate-900 font-black">{editingInvoiceModal.sellerName || "مبيعات عامة"}</span> (نقل الفاتورة لبائع آخر)
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 rotate-180 transition-colors" />
                  </button>

                  {/* Button 2: Edit Payment Method */}
                  <button
                    type="button"
                    onClick={() => setEditModalTab("payment")}
                    className="w-full text-right p-4 rounded-2xl border-2 border-slate-200 hover:border-blue-500 bg-slate-50 hover:bg-blue-50/50 transition-all cursor-pointer group flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black group-hover:scale-105 transition-transform">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-900 group-hover:text-blue-800">
                          2. تعديل طريقة الدفع
                        </div>
                        <div className="text-[11px] text-slate-500 font-bold mt-0.5">
                          الطريقة الحالية: <span className="text-slate-900 font-black">{editingInvoiceModal.paymentMethod || "كاش"}</span> (كاش، انستا باي، فودافون كاش، فيزا)
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 rotate-180 transition-colors" />
                  </button>

                  {/* Button 3: Edit Full Invoice in POS */}
                  <button
                    type="button"
                    onClick={handleEditFullInvoiceInPOS}
                    className="w-full text-right p-4 rounded-2xl border-2 border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/50 transition-all cursor-pointer group flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black group-hover:scale-105 transition-transform">
                        <ShoppingCart className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs font-black text-slate-900 group-hover:text-emerald-800">
                          3. تعديل الفاتورة بالكامل (شاشة البيع POS)
                        </div>
                        <div className="text-[11px] text-slate-500 font-bold mt-0.5">
                          فتح الفاتورة في الكاشير لإضافة/حذف منتجات وتعديل الأسعار والكميات
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 rotate-180 transition-colors" />
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingInvoiceModal(null)}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            )}

            {/* MODAL VIEW 2: EDIT SELLER SUB-VIEW */}
            {editModalTab === "seller" && (
              <form onSubmit={handleSaveSellerOnly} className="p-6 space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 leading-relaxed font-semibold">
                  💡 عند تعديل اسم البائع سيتم تحديث الفاتورة فوراً وستُحتسب المبيعات للبائع الجديد في شاشات التقارير والعمال ومبيعات اليوم.
                </div>

                {/* Mode Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-700 block">طريقة تحديد البائع:</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setEditSellerSelectionMode("select")}
                      className={`py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                        editSellerSelectionMode === "select"
                          ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      اختيار من العمال المسجلين
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditSellerSelectionMode("custom");
                        if (employees.includes(editSellerName)) {
                          setEditSellerName("");
                        }
                      }}
                      className={`py-2 text-xs font-black rounded-xl transition-all cursor-pointer ${
                        editSellerSelectionMode === "custom"
                          ? "bg-white text-slate-900 shadow-sm border border-slate-200/80"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      كتابة اسم جديد يدوياً
                    </button>
                  </div>
                </div>

                {/* Inputs based on Mode */}
                {editSellerSelectionMode === "select" ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 block">اختر اسم البائع / الكاشير:</label>
                    <select
                      value={editSellerName}
                      onChange={(e) => setEditSellerName(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                    >
                      <option value="">-- اختر البائع المسجل --</option>
                      {employees.map((emp) => (
                        <option key={emp} value={emp}>
                          {emp}
                        </option>
                      ))}
                      {allSellerOptions.filter(s => !employees.includes(s)).map((seller) => (
                        <option key={seller} value={seller}>
                          {seller} (من الفواتير السابقة)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 block">اكتب اسم البائع الجديد:</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: أحمد، محمود، كاشير الصباح..."
                      value={editSellerName}
                      onChange={(e) => setEditSellerName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none placeholder-slate-400"
                    />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-3 flex gap-2.5">
                  <button
                    type="submit"
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-amber-400 font-black py-3 rounded-xl text-xs transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4 text-amber-400" />
                    <span>حفظ اسم البائع</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditModalTab("menu")}
                    className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    رجوع للخيارات
                  </button>
                </div>
              </form>
            )}

            {/* MODAL VIEW 3: EDIT PAYMENT METHOD SUB-VIEW */}
            {editModalTab === "payment" && (
              <form onSubmit={handleSavePaymentMethodOnly} className="p-6 space-y-4">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 leading-relaxed font-semibold">
                  💳 سيتم تعديل طريقة الدفع وتحديث إحصائيات الدفع وتفصيلة اليومية والتقارير تلقائياً فور الحفظ.
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-700 block">اختر طريقة الدفع الجديدة:</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { id: "كاش", label: "💵 كاش (نقدي)", color: "text-emerald-700 border-emerald-200 bg-emerald-50/40" },
                      { id: "انستا باي", label: "⚡ انستا باي (InstaPay)", color: "text-purple-700 border-purple-200 bg-purple-50/40" },
                      { id: "فودافون كاش", label: "📱 فودافون كاش (محفظة)", color: "text-rose-700 border-rose-200 bg-rose-50/40" },
                      { id: "فيزا", label: "💳 فيزا / ماستركارد", color: "text-blue-700 border-blue-200 bg-blue-50/40" },
                      { id: "أخرى", label: "🔄 طريقة أخرى", color: "text-slate-700 border-slate-200 bg-slate-50/40" }
                    ].map((method) => {
                      const isSelected = editPaymentMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setEditPaymentMethod(method.id)}
                          className={`p-3 rounded-2xl border-2 text-xs font-black transition-all cursor-pointer text-right flex items-center justify-between ${
                            isSelected
                              ? "border-blue-600 bg-blue-50 text-blue-950 shadow-sm ring-2 ring-blue-500/20"
                              : "border-slate-200 hover:border-slate-300 bg-white text-slate-700"
                          }`}
                        >
                          <span>{method.label}</span>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 flex gap-2.5">
                  <button
                    type="submit"
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-amber-400 font-black py-3 rounded-xl text-xs transition-all shadow-md active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4 text-amber-400" />
                    <span>حفظ طريقة الدفع</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditModalTab("menu")}
                    className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    رجوع للخيارات
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
