import React, { useState } from "react";
import { Product } from "../types";
import { Search, RotateCcw, Save, AlertTriangle, Check, ArrowUpDown } from "lucide-react";
import { resolveProductImageUrl } from "../utils/databaseApi";

interface InventoryProps {
  products: Product[];
  onUpdateStock: (productId: string, newStock: number) => void;
}

export default function Inventory({ products, onUpdateStock }: InventoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  // Track temporary edits in client state so they can edit draft stock numbers before saving them!
  const [editedStocks, setEditedStocks] = useState<Record<string, number | string>>({});
  // Track visual success icons per saved product
  const [savedStatus, setSavedStatus] = useState<Record<string, boolean>>({});
  // Zoom mode state for product images enlarger
  const [zoomedImage, setZoomedImage] = useState<{ src: string; name: string } | null>(null);

  // Filter products by search query
  const filteredProducts = products.filter((prod) => {
    const query = searchTerm.trim().toLowerCase();
    return prod.name.toLowerCase().includes(query) || prod.barcode.includes(query);
  });

  const handleStockChange = (productId: string, val: string) => {
    setEditedStocks((prev) => ({
      ...prev,
      [productId]: val,
    }));
  };

  const adjustStockStep = (productId: string, currentStock: number, step: number) => {
    const rawVal = editedStocks[productId] !== undefined ? editedStocks[productId] : currentStock;
    const currentNum = typeof rawVal === "number" ? rawVal : parseInt(String(rawVal), 10) || 0;
    const newVal = Math.max(0, currentNum + step);
    setEditedStocks((prev) => ({
      ...prev,
      [productId]: newVal,
    }));
  };

  const saveProductStock = (productId: string) => {
    const val = editedStocks[productId];
    if (val === undefined) return;

    const num = typeof val === "number" ? val : parseInt(String(val), 10);
    const finalStock = isNaN(num) || num < 0 ? 0 : num;

    onUpdateStock(productId, finalStock);
    
    // Clear draft edit for this product once saved
    setEditedStocks((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });

    // Trigger visual success feedback
    setSavedStatus((prev) => ({ ...prev, [productId]: true }));
    setTimeout(() => {
      setSavedStatus((prev) => ({ ...prev, [productId]: false }));
    }, 2000);
  };

  const resetEdits = () => {
    setEditedStocks({});
    alert("تم تصفية كل مسودات التدقيق غير المحفوظة.");
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6 animate-fadeIn" dir="rtl">
      
      {/* Title & Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-800">جرد وتدقيق مخزن المعرض</h2>
          <p className="text-xs text-slate-400 mt-1">
            عدِّل كميات المنتجات الفعلية المتواجدة في صالة العرض لحفظ وتسجيل فروقات الجرد بشكل فوري ومستمر.
          </p>
        </div>
        
        {/* Bulk tools */}
        <div className="flex gap-2">
          {Object.keys(editedStocks).length > 0 && (
            <button
              onClick={resetEdits}
              className="flex items-center gap-1.5 bg-slate-150 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تراجع عن التعديلات المسودة</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="relative">
        <input 
          type="text"
          placeholder="ابحث بالاسم أو الباركود لتدقيق وجرد مخزون صنف بعينه..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
        />
        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
      </div>

      {/* Audit Table Sheet layout */}
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 font-bold bg-slate-50 text-[11px]">
              <th className="py-3 px-4">تفاصيل المنتج بالكامل</th>
              <th className="py-3 px-4 text-center">كود الباركود</th>
              <th className="py-3 px-4 text-center">الحد الأدنى المقبول</th>
              <th className="py-3 px-4 text-center">حالة المخزون</th>
              <th className="py-3 px-4 text-center w-48">الكمية الحالية الحقيقية</th>
              <th className="py-3 px-4 text-center">الإجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProducts.map((prod) => {
              const currentVal = prod.stock;
              const rawDraftVal = editedStocks[prod.id] !== undefined ? editedStocks[prod.id] : currentVal;
              const numericDraftVal = typeof rawDraftVal === "number" ? rawDraftVal : (parseInt(String(rawDraftVal), 10) || 0);
              const isEdited = editedStocks[prod.id] !== undefined && numericDraftVal !== currentVal;
              const isLowStock = numericDraftVal <= prod.minStockAlert;
              const isSaved = savedStatus[prod.id];

              return (
                <tr key={prod.id} className={`hover:bg-slate-50/70 transition-all ${isEdited ? "bg-amber-50/20" : ""}`}>
                  {/* Photo & Name */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src={resolveProductImageUrl(prod.image)} 
                        alt={prod.name} 
                        referrerPolicy="no-referrer"
                        onClick={() => setZoomedImage({ src: resolveProductImageUrl(prod.image), name: prod.name })}
                        className="w-10 h-10 object-cover rounded-xl shadow-sm border border-slate-150 cursor-zoom-in hover:scale-110 active:scale-95 transition-all duration-200"
                        title="انقر لتكبير صورة الصنف"
                      />
                      <div>
                        <h4 className="font-bold text-slate-800 text-xs">{prod.name}</h4>
                        <span className="text-[10px] text-slate-400 font-medium">سعر الصنف: {prod.price.toLocaleString("ar-EG")} ج.م</span>
                      </div>
                    </div>
                  </td>

                  {/* Generated Code */}
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-600">
                    {prod.barcode}
                  </td>

                  {/* Warning line */}
                  <td className="py-3.5 px-4 text-center font-mono text-slate-500 font-bold">
                    {prod.minStockAlert} وحدة
                  </td>

                  {/* Stock State Badge */}
                  <td className="py-3.5 px-4 text-center">
                    <span className={`px-2.5 py-1 text-[10px] font-black rounded-full inline-flex items-center gap-1.5 ${
                      isLowStock 
                        ? "bg-rose-50 text-rose-600 border border-rose-100 animate-pulse" 
                        : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                    }`}>
                      {isLowStock && <AlertTriangle className="w-3 h-3 text-rose-500" />}
                      {isLowStock ? "مخزن منخفض!" : "كمية آمنة"}
                    </span>
                  </td>

                  {/* Interactive edits sheet field */}
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {/* Decrement */}
                      <button
                        onClick={() => adjustStockStep(prod.id, prod.stock, -5)}
                        className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center justify-center cursor-pointer transition-all active:scale-[90%]"
                        title="طرح 5 قطع"
                      >
                        -5
                      </button>
                      <button
                        onClick={() => adjustStockStep(prod.id, prod.stock, -1)}
                        className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-lg flex items-center justify-center cursor-pointer transition-all active:scale-[90%]"
                        title="طرح قطعة"
                      >
                        -1
                      </button>

                      {/* Direct input */}
                      <input 
                        type="number"
                        min="0"
                        value={rawDraftVal}
                        onChange={(e) => handleStockChange(prod.id, e.target.value)}
                        className={`w-14 py-1.5 border rounded-lg text-center font-bold text-xs font-mono focus:border-amber-500 focus:outline-none transition-all ${
                          isEdited 
                            ? "border-amber-500 bg-amber-500/10 text-amber-700 font-extrabold" 
                            : "border-slate-200 bg-white text-slate-800"
                        }`}
                      />

                      {/* Increment */}
                      <button
                        onClick={() => adjustStockStep(prod.id, prod.stock, 1)}
                        className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-lg flex items-center justify-center cursor-pointer transition-all active:scale-[90%]"
                        title="إضافة قطعة"
                      >
                        +1
                      </button>
                      <button
                        onClick={() => adjustStockStep(prod.id, prod.stock, 5)}
                        className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center justify-center cursor-pointer transition-all active:scale-[90%]"
                        title="إضافة 5 قطع"
                      >
                        +5
                      </button>
                    </div>
                  </td>

                  {/* Actions Column */}
                  <td className="py-3.5 px-4 text-center">
                    <button
                      disabled={!isEdited}
                      onClick={() => saveProductStock(prod.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 mx-auto transition-all cursor-pointer ${
                        isSaved 
                          ? "bg-emerald-500 text-slate-950 pointer-events-none"
                          : isEdited
                            ? "bg-slate-900 text-amber-400 hover:bg-slate-800 active:scale-95 shadow-md"
                            : "bg-slate-100 text-slate-400 pointer-events-none"
                      }`}
                    >
                      {isSaved ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-slate-950 stroke-[3]" />
                          <span>تم الحفظ</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>تطبيق التعديل</span>
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Footer advice */}
      <div className="bg-slate-50 p-4 rounded-2xl flex items-start gap-3 border border-slate-200/50">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1 text-[11px] text-slate-600 leading-relaxed">
          <strong>التحقق المستمر للجرد المعارض:</strong> نوصي بمراجعة وتعديل مستويات مخزن <strong className="text-amber-800">Gallery Anto</strong> مرتين شهرياً على الأقل وحساب الكمية المطابقة لتفادي فجوات التوريد. يمكنك التدقيق بالزيادة والنقصان والضغط على <strong className="text-slate-800">تطبيق التعديلات</strong> لحفظ القيمة رسمياً.
        </div>
      </div>

      {/* ZOOM MODAL OVERLAY */}
      {zoomedImage && (
        <div 
          className="fixed inset-0 bg-slate-900/85 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-2xl w-full flex flex-col items-center animate-scaleUp" onClick={(e) => e.stopPropagation()}>
            <button 
              className="absolute -top-12 right-0 text-white hover:text-amber-400 bg-black/40 hover:bg-black/60 px-4 py-2 rounded-full transition-all cursor-pointer font-bold text-xs"
              onClick={() => setZoomedImage(null)}
            >
              إغلاق وتكبير (✕)
            </button>
            <div className="bg-white p-3 rounded-3xl shadow-2xl border border-slate-200 max-h-[80vh] flex flex-col items-center">
              <img 
                src={zoomedImage.src} 
                alt={zoomedImage.name} 
                className="max-h-[65vh] max-w-full object-contain rounded-2xl"
                referrerPolicy="no-referrer"
              />
              <div className="text-center pt-3 font-bold text-slate-900 text-sm">
                {zoomedImage.name}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
