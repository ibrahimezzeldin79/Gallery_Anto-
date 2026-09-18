import React, { useState } from "react";
import { Product } from "../types";
import { PlusCircle, Search, Trash2, Tag, Archive, Package, Image as ImageIcon, AlertTriangle, Edit, Save, X } from "lucide-react";
import { generateBarcode } from "../initialData";
import { compressImageDataUrl } from "../utils/imageCompressor";
import { resolveProductImageUrl } from "../utils/databaseApi";

interface ProductsProps {
  products: Product[];
  onAddProduct: (prod: Product) => void;
  onDeleteProduct: (id: string) => void;
  onUpdateProduct: (updatedProd: Product) => void;
  categories: string[];
  onAddCategory: (category: string) => void;
  onDeleteCategory: (category: string) => void;
}

// Default fallback high-quality product image if none uploaded
const DEFAULT_PRODUCT_IMAGE = "https://images.unsplash.com/photo-1549887534-1541e9326642?w=400&auto=format&fit=crop&q=60";

export default function Products({ 
  products, 
  onAddProduct, 
  onDeleteProduct, 
  onUpdateProduct,
  categories,
  onAddCategory,
  onDeleteCategory
}: ProductsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState("الكل");
  
  // NEW ADD PRODUCT Form State
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [minStockAlert, setMinStockAlert] = useState("5");
  const [imageFile, setImageFile] = useState<string>("");
  const [category, setCategory] = useState("بدون تصنيف");
  const [customBarcode, setCustomBarcode] = useState("");

  // PRODUCT EDIT modal state
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editStock, setEditStock] = useState("0");
  const [editMinStock, setEditMinStock] = useState("5");
  const [editBarcode, setEditBarcode] = useState("");
  const [editImageFile, setEditImageFile] = useState("");
  const [editCategory, setEditCategory] = useState("بدون تصنيف");
  
  // Confirm delete within Edit state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Category deletion modal state
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  // Count incomplete products
  const incompleteCount = products.filter((p) => p.isIncomplete).length;

  // Filter and sort products alphabetically.
  const filteredProducts = products
    .filter((prod) => {
      const searchLower = searchTerm.trim().toLowerCase();
      const matchesSearch = (
        prod.name.toLowerCase().includes(searchLower) ||
        prod.barcode.includes(searchLower)
      );
      
      let matchesCategory = true;
      if (selectedCategoryTab === "الكل") {
        matchesCategory = true;
      } else if (selectedCategoryTab === "غير مسجل بالكامل") {
        matchesCategory = Boolean(prod.isIncomplete);
      } else if (selectedCategoryTab === "بدون تصنيف") {
        matchesCategory = (!prod.category || prod.category === "بدون تصنيف") && !prod.isIncomplete;
      } else {
        matchesCategory = prod.category === selectedCategoryTab;
      }

      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));

  // Handle Add Product submit
  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || !stock) return;

    const initialStock = parseInt(stock) || 0;
    const alertThreshold = parseInt(minStockAlert) || 1;

    // Rule 1: If initial stock < min stock alert, block registration
    if (initialStock > 1 && initialStock < alertThreshold) {
      alert(`⚠️ عذراً، تعذر تسجيل المنتج!\nالكمية البدئية بالمخزن (${initialStock}) أقل من حد تنبيه المخزون (${alertThreshold}).\nيرجى زيادة الكمية البدئية أو تقليل حد التنبيه ليكون مساوياً أو أقل من الكمية البدئية.`);
      return;
    }

    // Check exact name match
    const exactMatch = products.some((p) => p.name === name);
    if (exactMatch) {
      alert("⚠️ هذا المنتج موجود بالفعل بنفس الاسم بالضبط! يرجى اختيار اسم مختلف أو تمييزه.");
      return;
    }

    let finalBarcode = customBarcode.trim();
    if (!finalBarcode) {
      finalBarcode = generateBarcode(products);
    }

    // Use selected device image if uploaded; otherwise use default fallback image
    const finalImage = imageFile || DEFAULT_PRODUCT_IMAGE;
    
    const newProduct: Product = {
      id: "prod-" + Date.now(),
      name: name,
      price: parseFloat(price),
      barcode: finalBarcode,
      stock: initialStock,
      minStockAlert: initialStock === 1 ? 1 : alertThreshold,
      image: finalImage,
      category: category,
    };

    onAddProduct(newProduct);
    
    // Reset Add Form
    setName("");
    setPrice("");
    setStock("");
    setMinStockAlert("5");
    setImageFile("");
    setCategory("بدون تصنيف");
    setCustomBarcode("");
    setShowAddModal(false);
  };

  // Launch edit popup
  const handleInitiateEdit = (prod: Product) => {
    setProductToEdit(prod);
    setEditName(prod.name);
    setEditPrice(prod.price.toString());
    setEditStock((prod.stock !== undefined ? prod.stock : 0).toString());
    setEditMinStock((prod.minStockAlert !== undefined ? prod.minStockAlert : 5).toString());
    setEditBarcode(prod.barcode);
    setEditImageFile(prod.image || "");
    setEditCategory(prod.category || "بدون تصنيف");
    setShowDeleteConfirm(false);
  };

  // Save edits
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productToEdit || !editName || !editPrice) return;

    // Check exact name match excluding current product being edited
    const exactMatch = products.some((p) => p.id !== productToEdit.id && p.name === editName);
    if (exactMatch) {
      alert("⚠️ هذا المنتج موجود بالفعل بنفس الاسم بالضبط! يرجى اختيار اسم مختلف أو تمييزه.");
      return;
    }

    const finalStock = parseInt(editStock) || 0;
    const finalMinStock = parseInt(editMinStock) || 5;

    const updatedProduct: Product = {
      ...productToEdit,
      name: editName.trim(),
      price: parseFloat(editPrice) || 0,
      barcode: editBarcode.trim() || productToEdit.barcode,
      stock: finalStock,
      minStockAlert: finalMinStock,
      image: editImageFile || "",
      category: editCategory,
      isIncomplete: false // Complete registration upon editing/saving!
    };

    onUpdateProduct(updatedProduct);
    setProductToEdit(null);
  };

  // Execute deletion inside edit action
  const executeDeleteFromEdit = () => {
    if (!productToEdit) return;
    onDeleteProduct(productToEdit.id);
    setProductToEdit(null);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="space-y-6 animate-fadeIn" dir="rtl">
      {/* Search Bar and Trigger Action */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="relative flex-1">
          <input 
            type="text"
            placeholder="ابحث عن أي منتج بالاسم أو كود الباركود..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium text-slate-800"
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm("")}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 font-bold text-xs cursor-pointer"
            >
              مسح
            </button>
          )}
        </div>

        <button 
          id="add-product-modal-trigger"
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-amber-400 font-bold px-6 py-3 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          <PlusCircle className="w-5 h-5 text-amber-400" />
          <span>إضافة منتج جديد</span>
        </button>
      </div>

      {/* Incomplete Products Alert Banner */}
      {incompleteCount > 0 && selectedCategoryTab !== "غير مسجل بالكامل" && (
        <div className="bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-amber-500/15 border border-amber-300/80 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2.5 text-amber-950 text-xs font-bold">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-xs">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <p className="font-extrabold text-amber-950 text-xs">
                تنبيه أصناف الكاشير: يوجد لديك <span className="font-black underline decoration-amber-500 text-sm text-slate-950 font-mono">{incompleteCount}</span> صنف غير مسجل بالكامل (أُضيفت سريعاً بدون صورة أو كمية).
              </p>
              <p className="text-[11px] text-amber-850 font-medium">يمكنك إكمال تسجيلها الآن بإضافة الصور والكميات وحدود التنبيه.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedCategoryTab("غير مسجل بالكامل")}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-xs rounded-xl transition-all cursor-pointer shadow-sm active:scale-95 whitespace-nowrap border border-slate-800 flex items-center gap-1.5"
          >
            <span>عرض وتكملة التسجيل الآن</span>
            <span>←</span>
          </button>
        </div>
      )}

      {/* Category Management and Filtering Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-black text-slate-800">تصنيفات المنتجات وتصفية المعروض</h4>
          </div>
          
          {/* Quick Add Category Form */}
          <div className="flex items-center gap-2">
            <input 
              type="text"
              id="new-category-name-input"
              placeholder="اسم تصنيف جديد (مثال: ساعات)"
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-800 text-right leading-none"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const target = e.currentTarget;
                  const val = target.value.trim();
                  if (val) {
                    onAddCategory(val);
                    target.value = "";
                  }
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("new-category-name-input") as HTMLInputElement;
                const val = el?.value.trim();
                if (val) {
                  onAddCategory(val);
                  if (el) el.value = "";
                }
              }}
              className="bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold px-3 py-2 rounded-lg text-[10px] cursor-pointer transition-all active:scale-95 flex items-center justify-center border border-slate-800"
            >
              إضافة تصنيف +
            </button>
          </div>
        </div>

        {/* Categories Tabs Scroll container */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* All products tab */}
          <button
            type="button"
            onClick={() => setSelectedCategoryTab("الكل")}
            className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
              selectedCategoryTab === "الكل"
                ? "bg-slate-900 text-amber-400 shadow-md shadow-slate-900/10 border border-slate-800"
                : "bg-slate-100/70 text-slate-600 hover:bg-slate-200/80"
            }`}
          >
            الكل ({products.length})
          </button>

          {/* Incomplete Products Filter Tab (Requirement 1 & Filter requirement) */}
          <button
            type="button"
            onClick={() => setSelectedCategoryTab("غير مسجل بالكامل")}
            className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedCategoryTab === "غير مسجل بالكامل"
                ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 border border-amber-600 ring-2 ring-amber-500/40"
                : incompleteCount > 0
                  ? "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100/80"
                  : "bg-slate-100/70 text-slate-500 hover:bg-slate-200/80"
            }`}
          >
            <AlertTriangle className={`w-3.5 h-3.5 ${selectedCategoryTab === "غير مسجل بالكامل" ? "text-slate-950" : "text-amber-600"}`} />
            <span>غير مسجل بالكامل ({incompleteCount})</span>
          </button>

          {/* Uncategorized tab */}
          <button
            type="button"
            onClick={() => setSelectedCategoryTab("بدون تصنيف")}
            className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
              selectedCategoryTab === "بدون تصنيف"
                ? "bg-slate-900 text-amber-400 shadow-md border border-slate-800"
                : "bg-slate-100/70 text-slate-600 hover:bg-slate-200/80"
            }`}
          >
            بدون تصنيف ({products.filter(p => (!p.category || p.category === "بدون تصنيف") && !p.isIncomplete).length})
          </button>

          {/* Custom user categories with delete button inside */}
          {categories.map((cat) => {
            const count = products.filter(p => p.category === cat).length;
            const isTabActive = selectedCategoryTab === cat;
            return (
              <div 
                key={cat}
                className={`flex items-center gap-1 px-3.5 py-1 rounded-xl text-[10px] font-black transition-all ${
                  isTabActive
                    ? "bg-slate-900 text-amber-450 shadow-md border border-slate-800"
                    : "bg-slate-105/70 text-slate-600 hover:bg-slate-200/80 border border-transparent"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedCategoryTab(cat)}
                  className={`cursor-pointer font-black ${isTabActive ? "text-amber-400" : "text-slate-600"}`}
                >
                  {cat} ({count})
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCategoryToDelete(cat);
                  }}
                  className="mr-1 py-0.5 px-1 rounded-md hover:bg-rose-50 text-rose-500 hover:text-rose-700 transition cursor-pointer"
                  title="حذف هذا التصنيف"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid of Products */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-2xl py-24 text-center border border-slate-100 shadow-sm">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
            <Archive className="w-8 h-8" />
          </div>
          <p className="text-slate-500 text-base font-bold">
            {selectedCategoryTab === "غير مسجل بالكامل" 
              ? "رائع! لا توجد أي منتجات غير مسجلة بالكامل حالياً." 
              : "لا توجد منتجات مطابقة لعملية البحث"}
          </p>
          <p className="text-slate-400 text-xs mt-1">
            {selectedCategoryTab === "غير مسجل بالكامل"
              ? "جميع المنتجات في المعرض مسجلة بكافة بياناتها وصورها ومخزونها."
              : "تأكد من كتابة الاسم الصحيح أو الرمز الباركود المناسب الكودي."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProducts.map((prod) => {
            const isIncomplete = Boolean(prod.isIncomplete);
            const isLowStock = !isIncomplete && prod.stock <= prod.minStockAlert;
            const hasImage = Boolean(prod.image && prod.image.trim().length > 0);

            return (
              <div 
                key={prod.id} 
                className={`bg-white rounded-3xl overflow-hidden border shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group h-full relative ${
                  isIncomplete
                    ? "border-amber-300 bg-amber-50/10 ring-1 ring-amber-200"
                    : "border-slate-100"
                }`}
              >
                {/* Product Image Section */}
                <div className="relative h-64 bg-slate-100 overflow-hidden">
                  {hasImage ? (
                    <img 
                      src={resolveProductImageUrl(prod.image)} 
                      alt={prod.name} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-amber-50/60 to-slate-100/80 p-6 text-center border-b border-amber-200/40 select-none">
                      <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mb-2 shadow-xs border border-amber-200">
                        <Package className="w-7 h-7 text-amber-600" />
                      </div>
                      <span className="text-xs font-black text-amber-950">صنف بدون صورة</span>
                      <span className="text-[10px] text-amber-800 font-bold mt-1 bg-amber-100/80 px-2 py-0.5 rounded-md">
                        اضغط "تكملة تسجيل الصنف" لإضافة صورة وكمية
                      </span>
                    </div>
                  )}

                  {/* Stock tag overlay */}
                  <div className={`absolute ${isIncomplete ? "top-10" : "top-3"} right-3 flex flex-col gap-1.5 items-end z-1`}>
                    <span className={`px-2.5 py-1 text-[10px] font-black rounded-lg shadow-md ${
                      isIncomplete
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : isLowStock 
                          ? "bg-rose-500 text-white animate-pulse" 
                          : "bg-slate-900 text-amber-400"
                    }`}>
                      {isIncomplete ? "الكمية: غير محددة" : isLowStock ? `ناقص: ${prod.stock} قطع` : `${prod.stock} وحدة متوفرة`}
                    </span>
                  </div>

                  {/* Category label badge */}
                  <div className={`absolute ${isIncomplete ? "top-10" : "top-3"} left-3 z-1`}>
                    <span className="px-2 py-1 text-[9px] font-black rounded-lg shadow-md bg-slate-900 text-amber-400 border border-slate-850">
                      {prod.category || "بدون تصنيف"}
                    </span>
                  </div>

                  {/* Absolute Price Badge */}
                  <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md text-slate-900 px-3 py-1.5 rounded-xl font-bold font-mono text-sm shadow-md border border-white/50 z-1">
                    {prod.price.toLocaleString("ar-EG")} ج.م
                  </div>
                </div>

                {/* Content body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-extrabold text-slate-800 line-clamp-2 leading-relaxed h-[40px]" title={prod.name}>
                      {prod.name}
                    </h3>
                  </div>

                  {/* Automated Barcode View Panel */}
                  <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold mb-1">
                      <span>الرمز الكودي للباركود</span>
                      <Tag className="w-3 h-3 text-slate-400" />
                    </div>
                    {/* Simulated barcode graphic strip lines */}
                    <div className="flex flex-col gap-1">
                      <div className="h-4 flex items-center justify-center tracking-[4px] opacity-45 font-mono text-[9px] bg-white border border-slate-200/50 rounded overflow-hidden select-none">
                        ||||| ||| || |||| |||
                      </div>
                      <div className="text-center font-mono text-[11px] font-bold text-slate-600 tracking-wider">
                        {prod.barcode}
                      </div>
                    </div>
                  </div>

                  {/* Action Button: Complete Incomplete Product or Edit */}
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button 
                      onClick={() => handleInitiateEdit(prod)}
                      className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition-all active:scale-[0.97] cursor-pointer shadow-sm ${
                        isIncomplete
                          ? "bg-amber-500 hover:bg-amber-400 text-slate-950 border border-amber-600 shadow-amber-500/20"
                          : "bg-slate-900 border border-slate-800 hover:bg-slate-800 text-amber-400 shadow-slate-900/10"
                      }`}
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>{isIncomplete ? "تكملة تسجيل الصنف وإضافة البيانات ✏️" : "تعديل الصنف"}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD NEW PRODUCT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-scaleUp">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-6 flex justify-between items-center animate-fadeIn">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-amber-400" />
                  <span>إضافة منتج جديد للمخزن والمعرض</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">سيقوم النظام بتوليد رمز باركود تلقائياً بعد الحفظ مباشرة.</p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-4 py-2 rounded-xl transition-all font-black text-xs cursor-pointer shadow-sm active:scale-95 flex items-center gap-1"
              >
                <span>إغلاق (✕)</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Product Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">اسم المنتج بالكامل</label>
                <input 
                  type="text"
                  required
                  placeholder="مثال: ساعة حائط برونزية عتيقة"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none font-medium"
                />
              </div>

              {/* Custom Barcode field */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-700 block">الباركود الرقمي (يدوي أو اتركه فارغاً للترقيم التلقائي)</label>
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                    التلقائي القادم: #{generateBarcode(products)}
                  </span>
                </div>
                <input 
                  type="text"
                  placeholder={`مثال: 5 أو 10 (اتركه فارغاً ليأخذ الرقم التلقائي #${generateBarcode(products)})`}
                  value={customBarcode}
                  onChange={(e) => setCustomBarcode(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none font-mono font-bold"
                />
              </div>

              {/* Price and Stock Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">سعر البيع (جنيه)</label>
                  <input 
                    type="number"
                    min="1"
                    required
                    placeholder="مثال: 1200"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none font-semibold font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">الكمية البدئية بالمخزن</label>
                  <input 
                    type="number"
                    min="0"
                    required
                    placeholder="مثال: 20"
                    value={stock}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStock(val);
                      if (parseInt(val) === 1) {
                        setMinStockAlert("1");
                      }
                    }}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none font-semibold font-mono"
                  />
                </div>
              </div>

              {/* Min stock for warnings */}
              {(() => {
                const initStockNum = parseInt(stock);
                const alertNum = parseInt(minStockAlert);
                const isInvalidAlert = !isNaN(initStockNum) && !isNaN(alertNum) && initStockNum > 0 && alertNum > initStockNum;

                return (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className={`text-xs font-bold block ${isInvalidAlert ? "text-rose-600 font-extrabold" : "text-slate-700"}`}>
                        حد التنبيه لنقص المخزن
                      </label>
                      {isInvalidAlert && (
                        <span className="text-[10.5px] font-black text-rose-600 animate-pulse">
                          ⚠️ أكبر من الكمية البدائية ({stock})
                        </span>
                      )}
                    </div>
                    <input 
                      type="number"
                      min="1"
                      required
                      disabled={parseInt(stock) === 1}
                      placeholder="إذا وصلت الكمية لهذا الرقم سيحذرك البرنامج"
                      value={parseInt(stock) === 1 ? "1" : minStockAlert}
                      onChange={(e) => setMinStockAlert(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold font-mono transition-all focus:outline-none disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${
                        isInvalidAlert
                          ? "bg-rose-50 border-2 border-rose-500 text-rose-900 focus:ring-2 focus:ring-rose-400/30 focus:border-rose-600"
                          : "bg-slate-50 border border-slate-200 text-slate-900 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                      }`}
                    />
                    {isInvalidAlert && (
                      <p className="text-[11px] font-black text-rose-700 bg-rose-50 p-2.5 rounded-xl border border-rose-200 flex items-center gap-1.5">
                        <span>⚠️ لا يمكن تسجيل المنتج طالما حد التنبيه ({minStockAlert}) أكبر من الكمية البدائية ({stock}).</span>
                      </p>
                    )}
                    {parseInt(stock) === 1 && (
                      <p className="text-[11px] font-bold text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200/60">
                        💡 عندما تكون الكمية البدئية = 1، لا يمكن تعديل حد التنبيه.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Product Category Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">تصنيف المنتج</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none font-semibold text-slate-700"
                >
                  <option value="بدون تصنيف">بدون تصنيف (افتراضي)</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* File Image Upload */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-amber-500" />
                  <span>صورة المنتج (تحميل من جهازك)</span>
                </label>
                
                {imageFile ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-40 bg-slate-50 flex items-center justify-center">
                    <img src={imageFile} alt="Preview" className="h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setImageFile("")}
                      className="absolute top-2 right-2 bg-rose-650 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                      style={{ backgroundColor: '#dc2626' }}
                    >
                      إزالة وتغيير الصورة
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-200 hover:border-amber-500 hover:bg-amber-50/10 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all gap-2 text-center h-40">
                    <PlusCircle className="w-8 h-8 text-slate-400" />
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">اضغط هنا لاختيار صورة من ملفاتك</span>
                      <span className="text-[10px] text-slate-400 mt-1 block">يدعم صيغ الصور JPEG, PNG, WEBP</span>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const raw = reader.result as string;
                            const compressed = await compressImageDataUrl(raw, 320, 0.7);
                            setImageFile(compressed);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden" 
                    />
                  </label>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-150 flex gap-3">
                <button 
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 rounded-xl text-xs transition-all shadow-md active:scale-[0.98] cursor-pointer text-center"
                >
                  حفظ المنتج بالمخزن
                </button>
                <button 
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-6 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 font-black py-3 rounded-xl text-xs transition-all cursor-pointer shadow-md active:scale-[0.98]"
                >
                  إلغاء لغلق المربع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULLY FUNCTIONAL EDIT PRODUCT MODAL popup AS REQUESTED BY THE USER */}
      {productToEdit && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-scaleUp">
            
            {/* Modal Header */}
            <div className="bg-slate-950 text-white p-6 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Edit className="w-5 h-5 text-amber-400" />
                  <span>تعديل بيانات الصنف: [{productToEdit.name}]</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">يتيح لك تعديل الاسم والأسعار والصور وسحب الصنف من المعرض.</p>
              </div>
              <button 
                onClick={() => setProductToEdit(null)}
                className="text-amber-400 hover:text-amber-300 bg-slate-900 hover:bg-slate-850 px-3.5 py-2 rounded-xl transition-all font-bold text-xs cursor-pointer border border-slate-800 shadow-sm"
              >
                إغلاق (✕)
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleEditSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
              
              {/* Incomplete product completion guidance banner */}
              {productToEdit.isIncomplete && (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-right space-y-1.5 shadow-xs">
                  <div className="flex items-center gap-2 text-xs font-black text-amber-950">
                    <div className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    <span>تكملة تسجيل الصنف غير المسجل بالكامل:</span>
                  </div>
                  <p className="text-[11px] text-amber-900 font-bold leading-relaxed">
                    هذا الصنف أُضيف سريعاً من شاشة الكاشير. يمكنك الآن إدخال <strong>(الصورة، الكمية بالمخزن، حد التنبيه، التصنيف، وتعديل الاسم والسعر)</strong> ثم الضغط على حفظ ليصبح مسجلاً بالكامل في النظام ويزول عنه وسم غير مسجل.
                  </p>
                </div>
              )}

              {/* Product Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">الاسم المعدل للمنتج</label>
                <input 
                  type="text"
                  required
                  placeholder="مثال: ساعة حائط برونزية عتيقة"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none font-medium"
                />
              </div>

              {/* Barcode Edit */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">كود الباركود</label>
                <input 
                  type="text"
                  placeholder="مثال: 1"
                  value={editBarcode}
                  onChange={(e) => setEditBarcode(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none font-mono"
                />
              </div>

              {/* Price and Stock Quantity Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">سعر البيع المعدل (جنيه)</label>
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    required
                    placeholder="مثال: 1200"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none font-semibold font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">
                    الكمية المتوفرة بالمخزن {productToEdit.isIncomplete && <span className="text-amber-600 font-extrabold">(مطلوب لإكمال التسجيل)</span>}
                  </label>
                  <input 
                    type="number"
                    min="0"
                    required
                    placeholder="مثال: 25"
                    value={editStock}
                    onChange={(e) => setEditStock(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none font-semibold font-mono"
                  />
                </div>
              </div>

              {/* Warning Limit and Category */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">حد التنبيه لنقص المخزن</label>
                  <input 
                    type="number"
                    min="1"
                    required
                    placeholder="مثال: 5"
                    value={editMinStock}
                    onChange={(e) => setEditMinStock(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none font-semibold font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">تصنيف المنتج</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none font-semibold text-slate-700"
                  >
                    <option value="بدون تصنيف">بدون تصنيف (افتراضي)</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* File Image Upload */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-amber-500" />
                  <span>تعديل صورة الصنف (تحميل من ملفات جهازك)</span>
                </label>
                
                {editImageFile ? (
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-40 bg-slate-50 flex items-center justify-center">
                    <img src={editImageFile} alt="Preview" className="h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setEditImageFile("")}
                      className="absolute top-2 right-2 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                    >
                      إزالة وتغيير الصورة
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-slate-200 hover:border-amber-500 hover:bg-amber-50/10 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all gap-2 text-center h-40">
                    <PlusCircle className="w-8 h-8 text-slate-400" />
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">اضغط هنا واختيار صورة جديدة لرفعها</span>
                      <span className="text-[10px] text-slate-400 mt-1 block">JPEG, PNG, WEBP يدعم صيغ</span>
                    </div>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const raw = reader.result as string;
                            const compressed = await compressImageDataUrl(raw, 320, 0.7);
                            setEditImageFile(compressed);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden" 
                    />
                  </label>
                )}
              </div>

              {/* INTEGRATED DELETE TRIGGER WITHIN THE EDIT POPUP AS REQUESTED */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                
                {showDeleteConfirm ? (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3">
                    <div className="flex items-start gap-2.5 text-rose-700 text-xs">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        هل أنت متأكد تماماً من حذف <strong>[{productToEdit.name}]</strong> بالكامل من المعرض والجرد؟ هذا التراجع غير ممكن. الحسابات الصادرة السابقة محمية مسبقاً.
                      </div>
                    </div>
                    
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={executeDeleteFromEdit}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 px-4 rounded-xl text-[11px] transition-all cursor-pointer"
                      >
                        نعم، احذف المنتج وصفي سجله
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2 px-4 rounded-xl text-[11px] transition-all cursor-pointer"
                      >
                        تراجع
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3 bg-rose-50/50 rounded-2xl border border-rose-100/50">
                    <span className="text-xs text-slate-500 font-medium">لحذف وإزالة هذا الصنف تماماً من قائمتك:</span>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1 text-rose-600 hover:text-white border border-rose-200 hover:bg-rose-600 px-4 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>حذف هذا المنتج</span>
                    </button>
                  </div>
                )}

              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-150 flex gap-3">
                <button 
                  type="submit"
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold py-3.5 rounded-2xl text-xs transition-all shadow-md active:scale-[0.98] cursor-pointer text-center"
                >
                  حفظ وتطبيق التحديثات
                </button>
                <button 
                  type="button"
                  onClick={() => setProductToEdit(null)}
                  className="px-6 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-800 font-bold py-3.5 rounded-2xl text-xs transition-all cursor-pointer shadow-md active:scale-[0.98]"
                >
                  إغلاق
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY DELETE CONFIRMATION MODAL (REQUIREMENT 4) */}
      {categoryToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 text-center space-y-4 border border-slate-100 shadow-2xl animate-scaleUp" dir="rtl">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-rose-600" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-sm font-black text-slate-900">تأكيد حذف التصنيف</h3>
              <p className="text-xs font-bold text-slate-700">
                هل أنت متأكد من رغبتك في حذف تصنيف <span className="text-rose-600 font-black font-sans">"{categoryToDelete}"</span>؟
              </p>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-right space-y-1">
                <p className="text-[11px] font-black text-amber-900 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>ملاحظة هامة للمخزن:</span>
                </p>
                <p className="text-[10px] text-amber-800 font-bold leading-relaxed">
                  جميع المنتجات المسجلة حالياً تحت هذا التصنيف (عدد {products.filter((p) => p.category === categoryToDelete).length} منتجات) ستتحول تلقائياً وتتخزن في تصنيف <span className="font-black text-slate-950 text-[11px]">"(بدون تصنيف)"</span> ولن تُحذف من النظام.
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (categoryToDelete) {
                    onDeleteCategory(categoryToDelete);
                    if (selectedCategoryTab === categoryToDelete) {
                      setSelectedCategoryTab("الكل");
                    }
                    setCategoryToDelete(null);
                  }
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3 rounded-xl text-xs transition-all cursor-pointer shadow-md active:scale-95"
              >
                تأكيد الحذف والتحويل
              </button>
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-3 rounded-xl text-xs transition-all cursor-pointer"
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
