import React, { useState } from "react";
import { Product, CartItem, Invoice, SplitPayment } from "../types";
import QRCodeGenerator from "../QRCodeGenerator";
import QRCode from "qrcode";
import { printInvoiceReceipt } from "../utils/printer";
import { ANTO_LOGO_BASE64 } from "../assets/logoBase64";
import { dbApi, resolveProductImageUrl } from "../utils/databaseApi";
import { generateBarcode } from "../initialData";
import { 
  Search, 
  ShoppingCart, 
  Plus, 
  PlusCircle,
  Minus, 
  Trash2, 
  Printer, 
  AlertCircle, 
  CheckCircle,
  User,
  Phone,
  Barcode,
  ShoppingBag,
  Tag,
  Download,
  QrCode,
  ArrowLeftRight,
  Split,
  AlertTriangle,
  Package
} from "lucide-react";

interface SalesProps {
  products: Product[];
  invoices: Invoice[];
  onAddInvoice: (invoice: Invoice) => Promise<Invoice | null> | void;
  onDeleteInvoice: (id: string) => void;
  onUpdateStock: (productId: string, newStock: number) => void;
  onViewInvoice: (invoice: Invoice) => void;
  onAddProduct?: (product: Product) => Promise<void> | void;
  employees?: string[];
  deletionPassword?: string;
  categories: string[];
  onDeleteCategory?: (catName: string) => void;
  cart?: CartItem[];
  setCart?: React.Dispatch<React.SetStateAction<CartItem[]>>;
  editingInvoice?: Invoice | null;
  onSaveEditedInvoice?: (updatedInvoice: Invoice) => Promise<void> | void;
  onCancelEditInvoice?: () => void;
}

export default function Sales({ 
  products, 
  invoices, 
  onAddInvoice, 
  onDeleteInvoice, 
  onUpdateStock,
  onViewInvoice,
  onAddProduct,
  employees = [],
  deletionPassword = "0000",
  categories = [],
  onDeleteCategory,
  cart: propCart,
  setCart: propSetCart,
  editingInvoice,
  onSaveEditedInvoice,
  onCancelEditInvoice
}: SalesProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryTab, setSelectedCategoryTab] = useState("الكل");
  const [internalCart, setInternalCart] = useState<CartItem[]>([]);
  const cart = propCart !== undefined ? propCart : internalCart;
  const setCart = propSetCart !== undefined ? propSetCart : setInternalCart;

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const unregNameInputRef = React.useRef<HTMLInputElement>(null);
  const unregPriceInputRef = React.useRef<HTMLInputElement>(null);

  // State for adding Unregistered Product (Requirement 1)
  const [unregName, setUnregName] = useState("");
  const [unregPrice, setUnregPrice] = useState("");
  const [unregRegistrationChoice, setUnregRegistrationChoice] = useState<"register" | "skip">("register");

  const [lastCreatedInvoice, setLastCreatedInvoice] = useState<Invoice | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showClearCartModal, setShowClearCartModal] = useState(false);
  const [priceErrorModal, setPriceErrorModal] = useState<{ productName: string; basePrice: number; customPrice: number } | null>(null);
  
  // Customer Phone (Optional)
  const [customerPhone, setCustomerPhone] = useState<string>("");

  // Payment method state (REQUIREMENT 2)
  const [paymentMethod, setPaymentMethod] = useState<string>("كاش");

  // Split Payment states (Requirement: Multiple payment methods in one invoice)
  const [isSplitPayment, setIsSplitPayment] = useState<boolean>(false);
  const [splitMethod1, setSplitMethod1] = useState<string>("كاش");
  const [splitAmount1, setSplitAmount1] = useState<string>("");
  const [splitMethod2, setSplitMethod2] = useState<string>("انستا باي");
  const [splitAmount2, setSplitAmount2] = useState<string>("");

  // Optional Invoice Discount state
  const [invoiceDiscount, setInvoiceDiscount] = useState<string>("0");
  const [showDiscountInput, setShowDiscountInput] = useState<boolean>(false);

  // Password deletion states
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // Store active cashier/employee name to persist across transactions
  const [sellerName, setSellerName] = useState(() => {
    return localStorage.getItem("anto_last_seller_name") || "";
  });

  const [sellerSelectionType, setSellerSelectionType] = useState(() => {
    const lastSeller = localStorage.getItem("anto_last_seller_name") || "";
    if (employees.includes(lastSeller)) {
      return lastSeller;
    }
    return lastSeller ? "custom" : "";
  });

  // Auto-sync dropdown picker on employees changes
  React.useEffect(() => {
    if (sellerName) {
      if (employees.includes(sellerName)) {
        setSellerSelectionType(sellerName);
      } else {
        setSellerSelectionType("custom");
      }
    }
  }, [employees, sellerName]);

  // Sync state when entering invoice edit mode
  React.useEffect(() => {
    if (editingInvoice) {
      if (editingInvoice.sellerName) {
        setSellerName(editingInvoice.sellerName);
        if (employees.includes(editingInvoice.sellerName)) {
          setSellerSelectionType(editingInvoice.sellerName);
        } else {
          setSellerSelectionType("custom");
        }
      }
      if (editingInvoice.customerPhone) {
        setCustomerPhone(editingInvoice.customerPhone);
      } else {
        setCustomerPhone("");
      }
      if (editingInvoice.splitPayments && editingInvoice.splitPayments.length > 1) {
        setIsSplitPayment(true);
        setSplitMethod1(editingInvoice.splitPayments[0].method || "كاش");
        setSplitAmount1(String(editingInvoice.splitPayments[0].amount || ""));
        setSplitMethod2(editingInvoice.splitPayments[1].method || "انستا باي");
        setSplitAmount2(String(editingInvoice.splitPayments[1].amount || ""));
      } else {
        setIsSplitPayment(false);
        if (editingInvoice.paymentMethod) {
          setPaymentMethod(editingInvoice.paymentMethod);
        }
        setSplitAmount1("");
        setSplitAmount2("");
      }
      if (editingInvoice.discount && editingInvoice.discount > 0) {
        setInvoiceDiscount(editingInvoice.discount.toString());
        setShowDiscountInput(true);
      } else {
        setInvoiceDiscount("0");
        setShowDiscountInput(false);
      }
    }
  }, [editingInvoice, employees]);

  // Filter products for sales list (sorted naturally / alphabetically without any pinning)
  const filteredProducts = products
    .filter((prod) => {
      const searchLower = searchTerm.trim().toLowerCase();
      const matchesSearch = (
        prod.name.toLowerCase().includes(searchLower) ||
        prod.barcode.includes(searchLower)
      );
      const prodCategory = prod.category || "بدون تصنيف";
      const matchesCategory = selectedCategoryTab === "الكل" || prodCategory === selectedCategoryTab;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));

  // Add product to cart
  const addToCart = (product: Product) => {
    const isBypassStock = Boolean(product.isIncomplete || product.id.startsWith("unreg_"));
    if (!isBypassStock && product.stock <= 0) {
      alert(`عذراً، المنتج [${product.name}] نفد من المخزون تماماً!`);
      return;
    }

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product.id === product.id);
      if (existing) {
        if (!isBypassStock && existing.quantity >= product.stock) {
          alert(`لا يمكنك إضافة المزيد. الكمية المتوفرة في المخزن هي ${product.stock} وحدات فقط.`);
          return prevCart;
        }
        return prevCart.map((item) => 
          item.product.id === product.id 
            ? { ...item, quantity: (typeof item.quantity === "number" ? item.quantity : 1) + 1 } 
            : item
        );
      }
      return [...prevCart, { product, quantity: 1 }];
    });

    // UX: keep focus in search box so cashier can immediately continue scanning/searching
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 20);
  };

  // Add Unregistered Product Handler (Requirement 1 - Registers incomplete product with auto-code)
  const handleAddUnregisteredProduct = async (shouldRegister = true, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = unregName.trim();
    const parsedPrice = parseFloat(unregPrice);

    if (!trimmedName) {
      alert("⚠️ يرجى إدخال اسم القطعة / الصنف غير المسجل");
      return;
    }
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      alert("⚠️ يرجى إدخال سعر بيع صحيح للمنتج");
      return;
    }

    // Generate automatic sequential barcode
    const autoBarcode = generateBarcode(products);

    const unregProd: Product = {
      id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: trimmedName,
      price: parsedPrice,
      basePrice: parsedPrice,
      barcode: autoBarcode,
      stock: 0, // Without stock quantity initially
      minStockAlert: undefined, // Without alert threshold initially
      category: "بدون تصنيف",
      image: "", // Without image initially
      isIncomplete: true // Marked as incomplete for completion later in Products page
    };

    // Save product to database/state only when the cashier chooses registration
    if (shouldRegister && onAddProduct) {
      await onAddProduct(unregProd);
    }

    // Add directly to the sales cart
    addToCart(unregProd);
    setUnregName("");
    setUnregPrice("");

    setTimeout(() => {
      unregNameInputRef.current?.focus();
    }, 30);
  };

  // UX Keyboard Enter Search Handler (Requirement 7)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const term = searchTerm.trim().toLowerCase();
      if (!term) return;

      const exactBarcode = products.find((p) => p.barcode.toLowerCase() === term);
      if (exactBarcode) {
        addToCart(exactBarcode);
        setSearchTerm("");
        return;
      }

      if (filteredProducts.length === 1) {
        addToCart(filteredProducts[0]);
        setSearchTerm("");
        return;
      }
    }
  };

  // Update quantity in cart
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null; // will filter out
          if (!item.product.isIncomplete && newQty > item.product.stock) {
            alert(`الكمية المطلوبة تتجاوز الكمية المتاحة في المخزن (${item.product.stock} وحدات)`);
            return item;
          }
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  // Direct manual quantity edit
  const setCartItemQuantity = (productId: string, qtyStr: string) => {
    if (qtyStr === "") {
      setCart((prevCart) =>
        prevCart.map((item) =>
          item.product.id === productId ? { ...item, quantity: "" as any } : item
        )
      );
      return;
    }

    const parsed = parseInt(qtyStr, 10);
    if (isNaN(parsed) || parsed <= 0) return;

    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.product.id === productId) {
          if (!item.product.isIncomplete && parsed > item.product.stock) {
            alert(`الكمية المطلوبة تتجاوز الكمية المتاحة في المخزن (${item.product.stock} وحدات)`);
            return { ...item, quantity: item.product.stock };
          }
          return { ...item, quantity: parsed };
        }
        return item;
      });
    });
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Update custom unit price for the current cart item (Allows typing any price freely)
  const updateCustomPrice = (productId: string, priceStr: string) => {
    const item = cart.find((i) => i.product.id === productId);
    if (!item) return;

    const val = priceStr.trim();
    if (val === "") {
      setCart((prevCart) => prevCart.map((i) => i.product.id === productId ? { ...i, customPrice: undefined } : i));
      return;
    }

    const newPrice = parseFloat(val);
    setCart((prevCart) => prevCart.map((i) => 
      i.product.id === productId 
        ? { ...i, customPrice: isNaN(newPrice) ? undefined : newPrice } 
        : i
    ));
  };

  // Helper to save invoice HTML file directly onto local system (REQUIREMENT 1)
  const exportInvoiceFile = async (inv: Invoice) => {
    let qrDataUrl = "";
    try {
      qrDataUrl = await QRCode.toDataURL("https://linktr.ee/Nabil_elsareaa?utm_source=qr_code", {
        margin: 1,
        width: 140,
        errorCorrectionLevel: "H"
      });
    } catch (err) {
      console.error("QR Code generation error:", err);
    }

    const receiptHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>فاتورة ${inv.invoiceNumber}</title>
  <style>
    @page { size: auto; margin: 0; }
    body { font-family: 'Cairo', system-ui, -apple-system, sans-serif; background: #fff; color: #000 !important; font-weight: 900 !important; margin: 0; padding: 20px; display: flex; justify-content: center; }
    .receipt { width: 80mm; max-width: 100%; border: 2px solid #000; padding: 15px; background: #fff; box-sizing: border-box; text-align: right; color: #000 !important; }
    .dashed { border-top: 2px dashed #000; margin: 10px 0; }
    .row { display: flex; justify-content: space-between; align-items: center; margin: 5px 0; font-size: 12.5px; font-weight: 900; color: #000 !important; }
    .bold { font-weight: 900; color: #000 !important; }
    .total-box { font-size: 16px; font-weight: 900; margin: 10px 0; display: flex; justify-content: space-between; align-items: center; color: #000 !important; }
    .qr-container { text-align: center; margin-top: 12px; color: #000 !important; }
    .contact-box { border: 2px solid #000; padding: 10px 6px; text-align: center; font-size: 11.5px; margin: 12px 0; border-radius: 8px; font-weight: 900; color: #000 !important; }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Top Crown Logo Image -->
    <div style="text-align: center; margin-bottom: 6px;">
      <img src="${ANTO_LOGO_BASE64}" style="width: 90px; height: 90px; object-fit: contain; margin: 0 auto; display: block;" alt="Crown Logo" />
    </div>

    <div style="text-align: center; margin-bottom: 8px;">
      <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: 1px; line-height: 1.1; color: #000; font-family: 'Arial Black', Arial, sans-serif; text-transform: uppercase;">GALLERY ANTO</h1>
      <div style="font-size: 18px; font-weight: 900; margin-top: 4px; color: #000;">إدارة الحاج نبيل السريع</div>
      <div style="font-size: 13px; font-weight: 800; margin-top: 2px; color: #000;">معرض انطو للأنتيكات والديكور</div>
    </div>
    
    <div class="dashed"></div>
    <div class="row"><span class="bold">${inv.invoiceNumber}</span><span>رقم الفاتورة:</span></div>
    <div class="row"><span>${inv.formattedDate}</span><span>التاريخ:</span></div>
    <div class="row"><span>${inv.formattedTime}</span><span>الوقت:</span></div>
    ${inv.sellerName ? `<div class="row"><span>${inv.sellerName}</span><span>مسؤول البيع:</span></div>` : ''}
    ${inv.customerPhone ? `<div class="row"><span class="bold" style="font-family: monospace;">${inv.customerPhone}</span><span>رقم موبيل العميل:</span></div>` : ''}
    <div class="row"><span class="bold">${inv.splitPayments && inv.splitPayments.length > 0 ? inv.splitPayments.map(sp => sp.method).join(' + ') : (inv.paymentMethod || "كاش").replace(/\([^)]*\)/g, '').trim()}</span><span>طريقة الدفع:</span></div>
    <div class="dashed"></div>
    <table style="width: 100%; font-size: 12px; text-align: right; border-collapse: collapse; color: #000;">
      <thead>
        <tr style="border-bottom: 2px solid #000; font-weight: 900;">
          <th style="text-align: right; padding-bottom: 5px; font-size: 12.5px; font-weight: 900;">الوصف</th>
          <th style="text-align: center; padding-bottom: 5px; font-size: 12.5px; font-weight: 900;">الكمية</th>
          <th style="text-align: left; padding-bottom: 5px; font-size: 12.5px; font-weight: 900;">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${inv.items.map(it => `
          <tr>
            <td style="text-align: right; padding: 5px 0; font-weight: 900;">
              <div style="font-size: 12.5px; font-weight: 900;">${it.name}</div>
              <div style="font-size: 10.5px; font-weight: 900; margin-top: 2px;">سعر القطعة: ${it.price.toLocaleString("ar-EG")} ج.م</div>
            </td>
            <td style="text-align: center; padding: 5px 0; font-weight: 900; font-size: 12.5px;">${it.quantity}x</td>
            <td style="text-align: left; padding: 5px 0; font-weight: 900; font-size: 12.5px; white-space: nowrap;">${(it.price * it.quantity).toLocaleString("ar-EG")} ج.م</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="dashed"></div>
    ${inv.discount && inv.discount > 0 ? `
    <div class="row"><span>${(inv.subtotal || (inv.total + inv.discount)).toLocaleString("ar-EG")} ج.م</span><span>الإجمالي قبل الخصم:</span></div>
    <div class="row" style="color: #dc2626 !important;"><span>-${inv.discount.toLocaleString("ar-EG")} ج.م</span><span>قيمة الخصم:</span></div>
    <div class="total-box">
      <span style="font-size: 17px;">${inv.total.toLocaleString("ar-EG")} ج.م</span>
      <span>الصافي بعد الخصم:</span>
    </div>
    ` : `
    <div class="total-box">
      <span style="font-size: 17px;">${inv.total.toLocaleString("ar-EG")} ج.م</span>
      <span>الإجمالي الكلي:</span>
    </div>
    `}
    ${inv.splitPayments && inv.splitPayments.length > 0 ? `
    <div style="background: #f8fafc; border: 1.5px dashed #000; padding: 6px 8px; border-radius: 4px; margin: 6px 0;">
      <div style="text-align: center; font-weight: 900; font-size: 11.5px; margin-bottom: 4px; border-bottom: 1px dashed #000; padding-bottom: 2px;">
        🔀 تفاصيل تجزئة الدفع
      </div>
      ${inv.splitPayments.map(sp => `
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 900; margin: 3px 0;">
          <span style="font-weight: 900; font-family: monospace;">${Number(sp.amount).toLocaleString("ar-EG")} ج.م</span>
          <span>• ${sp.method}:</span>
        </div>
      `).join('')}
    </div>
    ` : ''}
    <div class="dashed"></div>
    <div class="contact-box">
      <div>أرقام وإدارة المبيعات والتواصل:</div>
      <div style="font-size: 12.5px; font-family: monospace; margin-top: 3px; font-weight: 900;">010-2745-7070 | 010-0495-0713</div>
    </div>
    <div class="qr-container">
      <div style="font-size: 12px; font-weight: 900; letter-spacing: 1px;">SCAN ME</div>
      <div style="font-size: 11px; font-weight: 900; margin-bottom: 4px;">امسح الكود</div>
      ${qrDataUrl ? `<img src="${qrDataUrl}" style="width: 130px; height: 130px; display: block; margin: 0 auto; image-rendering: pixelated;" alt="QR Code" />` : ''}
    </div>
    <div style="text-align: center; margin-top: 16px;">
      <div style="font-size: 12.5px; font-weight: 900; color: #000;">شكراً لشراؤكم من GALLERY ANTO!</div>
      <div style="margin-top: 22px; display: flex; justify-content: center; align-items: center;">
        <div style="width: 40%; border-top: 2px solid #000000; margin: 0 auto;"></div>
      </div>
      <div style="font-size: 9.5px; font-weight: 900; margin-top: 5px; letter-spacing: 0.5px; color: #000;">نهاية الفاتورة الرسمية</div>
    </div>
  </div>
  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>
    `;

    const blob = new Blob([receiptHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-ANTO-${inv.invoiceNumber}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handler to open preview modal (Allows selling below base price with warning)
  const handleOpenPreview = () => {
    if (cart.length === 0 || sellerName.trim() === "") return;

    // Validate Customer Phone if entered: must be exactly 11 digits
    const cleanPhone = customerPhone.replace(/\D/g, "").trim();
    if (customerPhone.trim() && cleanPhone.length !== 11) {
      alert("⚠️ تنبيه: رقم موبيل العميل يجب أن يتكون من 11 رقم بالضبط (أو اتركه فارغاً إذا لم يرغب العميل في تركه).");
      return;
    }

    if (isSplitPayment) {
      const a1 = Math.max(0, parseFloat(splitAmount1) || 0);
      const a2 = Math.max(0, parseFloat(splitAmount2) || 0);
      const splitSum = Math.round((a1 + a2) * 100) / 100;
      const expectedTotal = Math.round(cartTotal * 100) / 100;

      if (splitSum !== expectedTotal) {
        alert(`⚠️ تنبيه: مجموع مبالغ الدفع (${splitSum.toLocaleString("ar-EG")} ج.م) لا يتطابق مع إجمالي الفاتورة (${expectedTotal.toLocaleString("ar-EG")} ج.م).\nيرجى تعديل المبالغ لتتطابق مع المطلوب.`);
        return;
      }
    }

    setShowPreviewModal(true);
  };

  const cartSubtotal = cart.reduce((sum, item) => {
    const qty = typeof item.quantity === "string" ? parseInt(item.quantity, 10) : item.quantity;
    const finalQty = isNaN(qty) || qty <= 0 ? 1 : qty;
    return sum + (item.customPrice ?? item.product.price) * finalQty;
  }, 0);

  const discountAmount = Math.max(0, parseFloat(invoiceDiscount) || 0);
  const cartTotal = Math.max(0, cartSubtotal - discountAmount);

  // Checkout and Generate Invoice
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    // Validate Customer Phone if entered: must be exactly 11 digits
    const cleanPhone = customerPhone.replace(/\D/g, "").trim();
    if (customerPhone.trim() && cleanPhone.length !== 11) {
      alert("⚠️ تنبيه: رقم موبيل العميل يجب أن يتكون من 11 رقم بالضبط (أو اتركه فارغاً).");
      return;
    }

    // Clean and normalize all cart items
    const normalizedCart = cart.map((item) => {
      const q = typeof item.quantity === "string" ? parseInt(item.quantity, 10) : item.quantity;
      return {
        ...item,
        quantity: isNaN(q) || q <= 0 ? 1 : q
      };
    });

    const now = new Date();
    
    const arabicDayFormatter = new Intl.DateTimeFormat("ar-EG", { weekday: "long" });
    const arabicDateFormatter = new Intl.DateTimeFormat("ar-EG", { 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    });
    
    const formattedDate = `${arabicDayFormatter.format(now)}، ${arabicDateFormatter.format(now)}`;
    const formattedTime = now.toLocaleTimeString("ar-EG", { 
      hour: "numeric", 
      minute: "2-digit", 
      hour12: true 
    });

    // Detect items sold strictly below base price
    const itemsDiscounted = normalizedCart.filter(
      (item) => item.customPrice !== undefined && item.customPrice < item.product.price
    );
    const isDiscountedBelowBase = itemsDiscounted.length > 0;
    const discountAlerts = itemsDiscounted.map(
      (item) => `تم بيع منتج [${item.product.name}] بسعر ${item.customPrice} ج.م بدلاً من السعر الأساسي (${item.product.price} ج.م)`
    );

    const subtotalVal = normalizedCart.reduce((sum, item) => sum + (item.customPrice ?? item.product.price) * item.quantity, 0);
    const discountVal = Math.max(0, parseFloat(invoiceDiscount) || 0);
    const finalTotalVal = Math.max(0, subtotalVal - discountVal);

    if (sellerName.trim()) {
       localStorage.setItem("anto_last_seller_name", sellerName.trim());
    }

    // Determine payment details
    let finalPaymentMethod = paymentMethod || "كاش";
    let finalSplitPayments: SplitPayment[] | undefined = undefined;

    if (isSplitPayment) {
      const a1 = Math.max(0, parseFloat(splitAmount1) || 0);
      const a2 = Math.max(0, parseFloat(splitAmount2) || 0);
      const splitSum = Math.round((a1 + a2) * 100) / 100;
      const expectedTotal = Math.round(finalTotalVal * 100) / 100;

      if (splitSum !== expectedTotal) {
        alert(`⚠️ تنبيه: مجموع مبالغ الدفع (${splitSum.toLocaleString("ar-EG")} ج.م) لا يتطابق مع إجمالي الفاتورة (${expectedTotal.toLocaleString("ar-EG")} ج.م).\nيرجى تعديل المبالغ لتتطابق مع المطلوب.`);
        return;
      }

      finalSplitPayments = [
        { method: splitMethod1 || "كاش", amount: a1 },
        { method: splitMethod2 || "انستا باي", amount: a2 }
      ];
      finalPaymentMethod = `${splitMethod1} + ${splitMethod2}`;
    }

    if (editingInvoice) {
      const updatedInvoice: Invoice = {
        ...editingInvoice,
        items: normalizedCart.map((item) => ({
          productId: item.product.id,
          name: item.product.name,
          price: item.customPrice ?? item.product.price,
          quantity: item.quantity,
          basePrice: item.product.basePrice ?? item.product.price,
        })),
        subtotal: subtotalVal,
        discount: discountVal,
        total: finalTotalVal,
        paymentMethod: finalPaymentMethod,
        splitPayments: finalSplitPayments,
        customerPhone: customerPhone.trim() || undefined,
        sellerName: sellerName.trim() || undefined,
        isDiscountedBelowBase,
        discountAlerts: discountAlerts.length > 0 ? discountAlerts : undefined,
      };

      try {
        if (onSaveEditedInvoice) {
          await onSaveEditedInvoice(updatedInvoice);
        }
        setCart([]); // Clear cart
        setInvoiceDiscount("0");
        setShowDiscountInput(false);
        setShowPreviewModal(false); // Hide preview
        setCustomerPhone("");
        setIsSplitPayment(false);
        setSplitAmount1("");
        setSplitAmount2("");
        if (onCancelEditInvoice) {
          onCancelEditInvoice();
        }
      } catch (err: any) {
        alert("❌ فشل تحديث الفاتورة: " + (err.message || err));
      }
      return;
    }

    const newInvoice: Invoice = {
       id: "inv-" + Date.now(),
       invoiceNumber: "", // SQLite transaction will generate ANTO-XXXX sequence atomically
       timestamp: now.getTime(),
       formattedDate,
       formattedTime,
       items: normalizedCart.map((item) => ({
         productId: item.product.id,
         name: item.product.name,
         price: item.customPrice ?? item.product.price,
         quantity: item.quantity,
         basePrice: item.product.basePrice ?? item.product.price,
       })),
       subtotal: subtotalVal,
       discount: discountVal,
       total: finalTotalVal,
       paymentMethod: finalPaymentMethod,
       splitPayments: finalSplitPayments,
       customerPhone: customerPhone.trim() || undefined,
       sellerName: sellerName.trim() || undefined,
       isDiscountedBelowBase,
       discountAlerts: discountAlerts.length > 0 ? discountAlerts : undefined,
    };

    try {
      const result = await onAddInvoice(newInvoice);
      setLastCreatedInvoice(result || newInvoice);
      setCart([]); // Clear cart
      setInvoiceDiscount("0");
      setShowDiscountInput(false);
      setShowPreviewModal(false); // Hide preview
      setCustomerPhone("");
      setIsSplitPayment(false);
      setSplitAmount1("");
      setSplitAmount2("");
    } catch (err: any) {
      alert("❌ فشلت عملية البيع: " + (err.message || err));
    }
  };

  // Request Delete Invoice (prompts password)
  const initiateDeleteInvoice = (id: string) => {
    setInvoiceToDelete(id);
    setDeletePassword("");
    setPasswordError(false);
  };

  // Confirm Delete Invoice using Password
  const confirmDeleteInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (deletePassword === "0000" || deletePassword === "1803" || deletePassword === deletionPassword) {
      if (invoiceToDelete) {
        onDeleteInvoice(invoiceToDelete);
        setInvoiceToDelete(null);
        alert("تم إلغاء وحذف الفاتورة من النظام بنجاح.");
      }
    } else {
      setPasswordError(true);
    }
  };

  const closeReceiptAndFocusSearch = () => {
    setLastCreatedInvoice(null);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  return (
    <div className="space-y-6 animate-fadeIn" dir="rtl">
      {/* EDIT INVOICE MODE TOP BANNER */}
      {editingInvoice && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 p-4 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg border-2 border-amber-600/40 animate-scaleUp">
          <div className="flex items-center gap-3.5 text-right">
            <div className="w-12 h-12 rounded-2xl bg-slate-950 text-amber-400 flex items-center justify-center font-black shrink-0 shadow-md">
              <Tag className="w-6 h-6" />
            </div>
            <div>
              <div className="font-black text-sm text-slate-950 flex items-center gap-2">
                <span>⚠️ أنت الآن في وضع تعديل الفاتورة رقم: #{editingInvoice.invoiceNumber}</span>
              </div>
              <div className="text-xs font-bold text-slate-900/90 mt-0.5">
                يمكنك تعديل الكميات، تغيير الأسعار، إضافة أو إزالة منتجات. عند الانتهاء اضغط على "معاينة وحفظ التعديل".
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            {onCancelEditInvoice && (
              <button
                type="button"
                onClick={onCancelEditInvoice}
                className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md active:scale-95 flex items-center gap-1.5"
              >
                <span>إلغاء التعديل والرجوع</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-8 items-stretch">
      {/* PRODUCTS SECTION (col-span-8) */}
      <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col h-[125vh]">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3 shrink-0">
          <div>
            <h3 className="text-md font-extrabold text-slate-800 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-500" />
              <span>كتالوج قطع المعرض</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">اختر الأصناف وبدل الكميات لإضافتها فورياً لسلة المبيعات المعروضة.</p>
          </div>
          <span className="text-xs bg-slate-50 text-slate-500 px-3 py-1 rounded-xl font-bold border border-slate-200/50">
            {products.length} صنف مسجل
          </span>
        </div>

        {/* Search input field & category chips */}
        <div className="py-2 shrink-0 space-y-2">
          <div className="relative">
            <input 
              ref={searchInputRef}
              type="text"
              placeholder="ابحث عن قطعة أثاث بالاسم، الباركود... (اضغط Enter للإضافة المباشرة)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-bold"
            />
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
          </div>

          {/* Category filtering chips */}
          <div className="flex flex-wrap gap-1 overflow-x-auto max-w-full pb-0.5">
            {/* Button to manage all categories */}
            <button
              type="button"
              onClick={() => setShowCategoriesModal(true)}
              className="px-2.5 py-1 rounded-lg text-[9.5px] font-black bg-slate-900 text-amber-400 hover:bg-slate-800 transition-all cursor-pointer flex items-center gap-1 shrink-0 border border-slate-800 shadow-sm"
              title="إدارة جميع الأصناف وحذف أي منها"
            >
              <Tag className="w-3 h-3 text-amber-400" />
              <span>جميع الأصناف وإدارتها</span>
            </button>

            {/* الكل */}
            <button
              type="button"
              onClick={() => setSelectedCategoryTab("الكل")}
              className={`px-2.5 py-1 rounded-lg text-[9.5px] font-black transition-all cursor-pointer whitespace-nowrap ${
                selectedCategoryTab === "الكل"
                  ? "bg-slate-900 text-amber-400 shadow-md border border-slate-800"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              الكل ({products.length})
            </button>
            
            {/* بدون تصنيف */}
            <button
              type="button"
              onClick={() => setSelectedCategoryTab("بدون تصنيف")}
              className={`px-2.5 py-1 rounded-lg text-[9.5px] font-black transition-all cursor-pointer whitespace-nowrap ${
                selectedCategoryTab === "بدون تصنيف"
                  ? "bg-slate-900 text-amber-400 shadow-md border border-slate-800"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              بدون تصنيف ({products.filter((p) => !p.category || p.category === "بدون تصنيف").length})
            </button>

            {/* Custom user categories */}
            {categories.map((cat) => {
              const count = products.filter((p) => p.category === cat).length;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategoryTab(cat)}
                  className={`px-2.5 py-1 rounded-lg text-[9.5px] font-black transition-all cursor-pointer whitespace-nowrap ${
                    selectedCategoryTab === cat
                      ? "bg-slate-900 text-amber-400 shadow-md border border-slate-800"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Products Grid list with Pinned Unregistered Item Box at Top Right */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-3 gap-2.5 pb-4">
            {/* Box at Top Right: Add Unregistered Product quickly */}
            <div 
              id="unregistered-product-box"
              className="border-2 border-dashed border-amber-300 hover:border-amber-400 bg-gradient-to-b from-amber-50/95 to-amber-100/50 rounded-2xl p-2.5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between select-none"
            >
              <form onSubmit={(e) => handleAddUnregisteredProduct(unregRegistrationChoice === "register", e)} className="h-full flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between pb-1 mb-1 border-b border-amber-200/70">
                    <div className="flex items-center gap-1.5 text-amber-950 font-black text-xs">
                      <div className="w-5 h-5 rounded-md bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                        <Plus className="w-3.5 h-3.5" />
                      </div>
                      <span className="leading-none">صنف غير مسجل</span>
                    </div>
                    <span className="text-[9px] font-black bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded">
                      إضافة سريعة
                    </span>
                  </div>
                  <p className="text-[10px] text-amber-800 font-semibold leading-tight mt-0.5">
                    إضافة بند حر غير موجود بالكتالوج:
                  </p>
                </div>

                <div className="space-y-1.5 my-auto">
                  <div>
                    <input
                      ref={unregNameInputRef}
                      type="text"
                      placeholder="اسم الصنف أو القطعة..."
                      value={unregName}
                      onChange={(e) => setUnregName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (!unregName.trim()) {
                            alert("⚠️ يرجى إدخال اسم الصنف أولاً");
                            return;
                          }
                          unregPriceInputRef.current?.focus();
                          unregPriceInputRef.current?.select();
                        }
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                  </div>

                  <div className="relative">
                    <input
                      ref={unregPriceInputRef}
                      type="number"
                      min="0"
                      step="any"
                      placeholder="السعر"
                      value={unregPrice}
                      onChange={(e) => setUnregPrice(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddUnregisteredProduct(unregRegistrationChoice === "register");
                        }
                      }}
                      className="w-full pl-7 pr-2.5 py-1.5 bg-white border border-amber-200 rounded-xl text-xs font-black font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 pointer-events-none">
                      ج.م
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={() => setUnregRegistrationChoice("register")}
                    className={`py-1.5 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      unregRegistrationChoice === "register"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>تسجيل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnregRegistrationChoice("skip")}
                    className={`py-1.5 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      unregRegistrationChoice === "skip"
                        ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>عدم تسجيل</span>
                  </button>
                </div>
                <button
                  type="submit"
                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-amber-400 font-black text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm border border-slate-800 mt-1"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>+ إضافة للسلة</span>
                </button>
              </form>
            </div>

            {/* Catalog Products */}
            {filteredProducts.map((prod) => {
              const isIncomplete = Boolean(prod.isIncomplete);
              const outOfStock = !isIncomplete && prod.stock <= 0;
              const isLow = !isIncomplete && prod.stock <= prod.minStockAlert;
              const hasImage = Boolean(prod.image && prod.image.trim().length > 0);
              
              return (
                <div 
                  key={prod.id}
                  onClick={() => !outOfStock && addToCart(prod)}
                  className={`border rounded-2xl p-2.5 cursor-pointer select-none transition-all flex flex-col justify-between group ${
                    outOfStock 
                      ? "opacity-60 border-slate-150 bg-slate-50/50 pointer-events-none" 
                      : isIncomplete
                        ? "border-amber-300 bg-amber-50/20 hover:shadow-md hover:border-amber-400"
                        : "border-slate-150 hover:shadow-md hover:border-blue-350 bg-white"
                  }`}
                >
                    <div className="space-y-1.5">
                      <div className="relative rounded-xl overflow-hidden bg-slate-100 h-28 w-full">
                        {hasImage ? (
                          <img 
                            src={resolveProductImageUrl(prod.image)} 
                            alt={prod.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-amber-50 to-slate-100 text-amber-800 p-2 text-center">
                            <Package className="w-6 h-6 text-amber-500 mb-1" />
                            <span className="text-[9px] font-black text-amber-900">بدون صورة</span>
                          </div>
                        )}
                        {isIncomplete ? (
                          <div className="absolute top-1.5 right-1.5">
                            <span className="text-[8px] bg-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded-lg shadow-xs flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>غير مسجل</span>
                            </span>
                          </div>
                        ) : outOfStock ? (
                          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center">
                            <span className="text-[9px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded-lg">نفذ بالكامل</span>
                          </div>
                        ) : isLow ? (
                          <div className="absolute top-1.5 right-1.5">
                            <span className="text-[8px] bg-amber-500 text-white font-bold px-1.5 py-0.5 rounded-lg animate-pulse">مخزون حرج</span>
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-0.5 text-right">
                        <div className="flex justify-end mb-0.5">
                          <span className="text-[8px] bg-slate-100/80 text-slate-500 font-extrabold px-1.5 py-0.5 rounded-md border border-slate-200/50">
                            {prod.category || "بدون تصنيف"}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-1" title={prod.name}>
                          {prod.name}
                        </h4>
                        <p className="text-[9.5px] text-slate-400 font-mono flex items-center justify-end gap-1">
                          <Barcode className="w-2.5 h-2.5 text-slate-300" />
                          <span>{prod.barcode}</span>
                        </p>
                      </div>
                    </div>

                    {/* PRICE AND STOCK BADGE */}
                    <div className="border-t border-slate-100 mt-2 pt-1.5 flex justify-between items-center">
                      <span className="text-sm font-black text-emerald-600 font-mono">
                        {prod.price.toLocaleString("ar-EG")} ج.م
                      </span>
                      <span className={`text-[10.5px] font-black font-mono px-2 py-0.5 rounded-lg ${
                        isIncomplete
                          ? "bg-amber-100 text-amber-900 border border-amber-300"
                          : outOfStock 
                            ? "bg-rose-100 text-rose-700 border border-rose-200" 
                            : isLow 
                              ? "bg-amber-100 text-amber-800 border border-amber-200" 
                              : "bg-slate-100 text-slate-800 border border-slate-200"
                      }`}>
                        {isIncomplete ? "سعر حر" : `المتاح: ${prod.stock}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            {/* Empty search results message inside grid if no catalog match */}
            {filteredProducts.length === 0 && (
              <div className="col-span-1 sm:col-span-2 xl:col-span-2 border border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center text-slate-400 space-y-1">
                <ShoppingBag className="w-8 h-8 text-slate-300 mb-1" />
                <p className="text-xs font-bold text-slate-600">لا توجد قطع مطابقة لبحثك في الكتالوج.</p>
                <p className="text-[10px] text-slate-400">يمكنك استخدام خانة الصنف غير المسجل لإضافة أي بند فوراً.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SHOPPING CART SECTION (col-span-4) */}
      <div className="lg:col-span-4 bg-slate-50/70 p-6 rounded-3xl border border-slate-200/50 flex flex-col h-[125vh] justify-between">
        <div>
          <div className="flex justify-between items-center border-b border-slate-200/60 pb-4">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              <span>سلة المبيعات المعروضة</span>
            </h3>
            <div className="flex items-center gap-2">
              {/* REQUIREMENT 1: Empty Cart button using modal state */}
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearCartModal(true)}
                  className="text-[11px] font-extrabold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                  title="إزالة جميع المنتجات وإفراغ السلة"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>إزالة السلة</span>
                </button>
              )}
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                {cart.reduce((sum, item) => {
                  const qty = typeof item.quantity === "string" ? parseInt(item.quantity, 10) : item.quantity;
                  return sum + (isNaN(qty) || qty <= 0 ? 0 : qty);
                }, 0)} قطع
              </span>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[82vh] mt-4 space-y-3 pr-1 dark-scrollbar">
            {cart.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                  <ShoppingCart className="w-5 h-5 text-slate-350" />
                </div>
                <p className="text-xs font-bold">السلة فارغة تماماً.</p>
                <p className="text-[10px] text-slate-400 mt-1">اضغط على المنتجات لإضافتها وكتابة الاسعار الاستثنائية.</p>
              </div>
            ) : (
              cart.map((item) => (
                <div 
                  key={item.product.id}
                  className="bg-white border border-slate-200 rounded-2xl p-3 space-y-3 shadow-sm hover:border-blue-200 transition-all"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 text-right">
                      <span className="text-xs font-bold text-slate-800 line-clamp-1">{item.product.name}</span>
                      <p className="text-[10px] text-slate-400 mt-1">
                        السعر الأساسي: {item.product.price.toLocaleString("ar-EG")} ج.م
                      </p>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.product.id)}
                      className="text-slate-400 hover:text-red-650 p-1 rounded-lg hover:bg-red-50 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 bg-slate-50/50 -mx-3 -mb-3 p-3 rounded-b-2xl">
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
                      <button 
                        type="button"
                        onClick={() => updateQuantity(item.product.id, -1)}
                        className="w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-600 font-bold flex items-center justify-center cursor-pointer text-xs select-none"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={item.product.isIncomplete ? undefined : item.product.stock}
                        value={item.quantity}
                        onChange={(e) => setCartItemQuantity(item.product.id, e.target.value)}
                        className="w-10 text-center font-mono text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                      />
                      <button 
                        type="button"
                        onClick={() => updateQuantity(item.product.id, 1)}
                        className="w-5 h-5 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-600 font-bold flex items-center justify-center cursor-pointer text-xs select-none"
                      >
                        +
                      </button>
                    </div>

                    {(() => {
                      const isLowerThanBase = item.customPrice !== undefined && item.customPrice < item.product.price;
                      return (
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400">سعر البيع المعتمد:</span>
                            <input 
                              type="number"
                              min="0"
                              placeholder={String(item.product.price)}
                              value={item.customPrice !== undefined ? item.customPrice : ""}
                              onChange={(e) => updateCustomPrice(item.product.id, e.target.value)}
                              className={`w-20 rounded-lg text-xs font-mono font-black py-1 px-1.5 select-all text-center transition-all ${
                                isLowerThanBase
                                  ? "border-2 border-rose-600 bg-rose-50 text-rose-600 focus:ring-2 focus:ring-rose-500"
                                  : "border border-slate-250 text-slate-800 focus:ring-2 focus:ring-blue-105"
                              }`}
                            />
                          </div>
                          {isLowerThanBase && (
                            <span className="text-[9px] font-black text-rose-600">
                              أقل من الأساسي ({item.product.price} ج.م) ⚠️
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border-t border-slate-200/70 pt-4 space-y-3 bg-[#fbfcfd] -mx-6 -mb-6 p-6 rounded-b-3xl">
          {/* Customer Phone (Optional, Exactly 11 digits if provided) */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>رقم موبيل العميل:</span>
              </span>
              {customerPhone.length === 0 ? (
                <span className="text-[10px] text-slate-400 font-semibold bg-slate-100 px-2 py-0.5 rounded-md">(اختياري - 11 رقم)</span>
              ) : customerPhone.length === 11 ? (
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md font-mono">✅ 11 رقم</span>
              ) : (
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-mono">{customerPhone.length}/11 رقم</span>
              )}
            </label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              dir="ltr"
              placeholder="مثال: 01012345678 (11 رقم فقط)"
              value={customerPhone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 11);
                setCustomerPhone(val);
              }}
              className="w-full bg-white border border-slate-250 rounded-xl text-xs font-mono font-bold text-slate-800 py-1.5 px-3 text-right focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-350"
            />
          </div>

          {/* Payment Method Selector & Split Payment */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">طريقة الدفع:</label>
              <button
                type="button"
                onClick={() => {
                  if (!isSplitPayment) {
                    setIsSplitPayment(true);
                    if (!splitAmount1 && cartTotal > 0) {
                      const half = Math.round(cartTotal / 2);
                      setSplitAmount1(String(half));
                      setSplitAmount2(String(cartTotal - half));
                    }
                  } else {
                    setIsSplitPayment(false);
                  }
                }}
                className={`text-[11px] font-black px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                  isSplitPayment
                    ? "bg-purple-600 text-white border-purple-700 shadow-xs"
                    : "bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                }`}
              >
                <Split className="w-3 h-3" />
                <span>{isSplitPayment ? "إلغاء التقسيم (دفع موحد)" : "🔀 دفع مجزأ (طريقتين)"}</span>
              </button>
            </div>

            {!isSplitPayment ? (
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "كاش", label: "💵 كاش", activeBg: "bg-emerald-600 text-white border-emerald-600 shadow-sm" },
                  { id: "انستا باي", label: "⚡ انستا باي", activeBg: "bg-purple-600 text-white border-purple-600 shadow-sm" },
                  { id: "فودافون كاش", label: "📱 فودافون كاش", activeBg: "bg-rose-600 text-white border-rose-600 shadow-sm" },
                  { id: "فيزا", label: "💳 فيزا", activeBg: "bg-blue-600 text-white border-blue-600 shadow-sm" },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      paymentMethod === m.id
                        ? m.activeBg
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-purple-50/70 border border-purple-200 p-2.5 rounded-2xl space-y-2">
                <div className="text-[11px] font-black text-purple-900 flex items-center gap-1">
                  <span>🔀 تفاصيل الدفع المجزأ:</span>
                </div>
                
                {/* Method 1 */}
                <div className="grid grid-cols-5 gap-1.5 items-center">
                  <select
                    value={splitMethod1}
                    onChange={(e) => setSplitMethod1(e.target.value)}
                    className="col-span-2 bg-white border border-purple-200 rounded-xl text-[11px] font-bold text-slate-800 py-1.5 px-2 focus:ring-1 focus:ring-purple-500 text-right cursor-pointer"
                  >
                    <option value="كاش">💵 كاش</option>
                    <option value="انستا باي">⚡ انستا باي</option>
                    <option value="فودافون كاش">📱 فودافون كاش</option>
                    <option value="فيزا">💳 فيزا</option>
                  </select>
                  <div className="col-span-3 relative">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="المبلغ 1"
                      value={splitAmount1}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSplitAmount1(v);
                        const num = parseFloat(v) || 0;
                        if (cartTotal > 0) {
                          setSplitAmount2(String(Math.max(0, cartTotal - num)));
                        }
                      }}
                      className="w-full bg-white border border-purple-200 rounded-xl text-xs font-mono font-bold text-slate-900 py-1.5 px-2 pl-8 focus:ring-1 focus:ring-purple-500 text-right"
                    />
                    <span className="absolute left-2 top-1.5 text-[9px] font-bold text-purple-700">ج.م</span>
                  </div>
                </div>

                {/* Method 2 */}
                <div className="grid grid-cols-5 gap-1.5 items-center">
                  <select
                    value={splitMethod2}
                    onChange={(e) => setSplitMethod2(e.target.value)}
                    className="col-span-2 bg-white border border-purple-200 rounded-xl text-[11px] font-bold text-slate-800 py-1.5 px-2 focus:ring-1 focus:ring-purple-500 text-right cursor-pointer"
                  >
                    <option value="انستا باي">⚡ انستا باي</option>
                    <option value="كاش">💵 كاش</option>
                    <option value="فودافون كاش">📱 فودافون كاش</option>
                    <option value="فيزا">💳 فيزا</option>
                  </select>
                  <div className="col-span-3 relative">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="المبلغ 2"
                      value={splitAmount2}
                      onChange={(e) => setSplitAmount2(e.target.value)}
                      className="w-full bg-white border border-purple-200 rounded-xl text-xs font-mono font-bold text-slate-900 py-1.5 px-2 pl-8 focus:ring-1 focus:ring-purple-500 text-right"
                    />
                    <span className="absolute left-2 top-1.5 text-[9px] font-bold text-purple-700">ج.م</span>
                  </div>
                </div>

                {/* Split Balance Summary */}
                {(() => {
                  const a1 = parseFloat(splitAmount1) || 0;
                  const a2 = parseFloat(splitAmount2) || 0;
                  const currentSplitTotal = Math.round((a1 + a2) * 100) / 100;
                  const target = Math.round(cartTotal * 100) / 100;
                  const diff = Math.round((target - currentSplitTotal) * 100) / 100;

                  if (diff === 0 && target > 0) {
                    return (
                      <div className="bg-emerald-100/90 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-xl text-[10px] font-black text-center">
                        ✅ المجموع مطابق تماماً للمطلوب ({target.toLocaleString("ar-EG")} ج.م)
                      </div>
                    );
                  } else if (diff > 0) {
                    return (
                      <div className="bg-amber-100 text-amber-900 border border-amber-300 px-2 py-1 rounded-xl text-[10px] font-black flex items-center justify-between">
                        <span>متبقي: {diff.toLocaleString("ar-EG")} ج.م</span>
                        <button
                          type="button"
                          onClick={() => setSplitAmount2(String(Math.max(0, target - a1)))}
                          className="bg-amber-700 text-white px-2 py-0.5 rounded text-[9px] font-bold hover:bg-amber-800 cursor-pointer"
                        >
                          تعبئة المتبقي
                        </button>
                      </div>
                    );
                  } else {
                    return (
                      <div className="bg-rose-100 text-rose-800 border border-rose-300 px-2 py-1 rounded-xl text-[10px] font-black text-center">
                        ⚠️ زيادة عن المطلوب بمقدار {Math.abs(diff).toLocaleString("ar-EG")} ج.م
                      </div>
                    );
                  }
                })()}
              </div>
            )}
          </div>

          {/* Employee dropdown selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 block pb-0.5">الموظف المسئول عن البيع والعمولة:</label>
            <select
              value={sellerSelectionType}
              onChange={(e) => {
                const val = e.target.value;
                setSellerSelectionType(val);
                if (val === "custom") {
                  setSellerName("");
                } else {
                  setSellerName(val);
                }
              }}
              className="w-full bg-white border border-slate-250 rounded-xl text-xs font-bold text-slate-700 py-2 px-3 focus:ring-2 focus:ring-blue-105 cursor-pointer text-right"
            >
              <option value="">-- اختر من الموظفين المسجلين --</option>
              {employees.map((emp) => (
                <option key={emp} value={emp}>
                  {emp}
                </option>
              ))}
              <option value="custom">✍️ اسم موظف آخر (كتابة يدوي)...</option>
            </select>

            {(sellerSelectionType === "custom" || (sellerName && !employees.includes(sellerName))) && (
              <input 
                type="text"
                placeholder="اكتب اسم البائع (العامل) الجديد هُنا..."
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                className="w-full bg-white border border-slate-250 rounded-xl text-xs font-bold text-slate-700 py-2 px-3 mt-2 focus:ring-2 focus:ring-blue-105"
              />
            )}

            {sellerName.trim() === "" && cart.length > 0 && (
              <p className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>يرجى كتابة أو تحديد اسم البائع لإرسال وحفظ الفاتورة!</span>
              </p>
            )}
          </div>

          {/* Optional Invoice Discount Input */}
          <div className="border-t border-slate-150 pt-2.5">
            {!showDiscountInput ? (
              <button
                type="button"
                onClick={() => setShowDiscountInput(true)}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>إضافة خصم (اختياري) للفاتورة</span>
              </button>
            ) : (
              <div className="space-y-1 bg-amber-50/80 p-2.5 rounded-2xl border border-amber-200">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-amber-900 block">مبلغ الخصم (بالجنيه):</label>
                  <button
                    type="button"
                    onClick={() => {
                      setInvoiceDiscount("0");
                      setShowDiscountInput(false);
                    }}
                    className="text-[10px] text-rose-600 font-bold hover:underline"
                  >
                    إلغاء الخصم
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="اكتب مبلغ الخصم هُنا..."
                    value={invoiceDiscount}
                    onChange={(e) => setInvoiceDiscount(e.target.value)}
                    className="w-full bg-white border border-amber-300 rounded-xl text-xs font-mono font-bold text-amber-900 py-1.5 px-3 pl-12 focus:ring-2 focus:ring-amber-500"
                  />
                  <span className="absolute left-3 top-1.5 text-[10px] font-bold text-amber-700">ج.م</span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-150 pt-2.5 space-y-1">
            {discountAmount > 0 && (
              <>
                <div className="flex justify-between items-center text-xs text-slate-500 font-bold">
                  <span>الإجمالي قبل الخصم:</span>
                  <span className="font-mono">{cartSubtotal.toLocaleString("ar-EG")} ج.م</span>
                </div>
                <div className="flex justify-between items-center text-xs text-rose-600 font-bold">
                  <span>قيمة الخصم المطبق:</span>
                  <span className="font-mono">-{discountAmount.toLocaleString("ar-EG")} ج.م</span>
                </div>
              </>
            )}
            <div className="flex justify-between items-center text-slate-750 pt-1">
              <span className="text-xs font-extrabold text-slate-800">
                {discountAmount > 0 ? "الصافي المطلوب سداده:" : "إجمالي المطلوب سداده:"}
              </span>
              <div className="text-left">
                <span className="text-base font-mono font-black text-emerald-600">
                  {cartTotal.toLocaleString("ar-EG")}
                </span>
                <span className="text-[10px] text-slate-400 mr-1 font-bold">جنيه</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleOpenPreview}
              disabled={cart.length === 0 || sellerName.trim() === ""}
              className={`flex-1 font-black text-xs py-3.5 rounded-2xl shadow transition-all flex items-center justify-center gap-2 cursor-pointer ${
                (cart.length === 0 || sellerName.trim() === "")
                  ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-lg shadow-emerald-600/30 active:scale-[0.98]"
              }`}
            >
              <Printer className="w-4 h-4 text-white" />
              <span className="text-white font-extrabold text-xs">
                {editingInvoice ? "معاينة وحفظ تعديلات الفاتورة" : "معاينة وتأكيد الفاتورة"}
              </span>
            </button>
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => setShowClearCartModal(true)}
              className={`px-4.5 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                cart.length === 0
                  ? "border-slate-100 text-slate-300 cursor-not-allowed"
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
              }`}
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* BILL SUCCESS / THERMAL PRINT DIALOG MODAL */}
      {lastCreatedInvoice && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            
            {/* Header banner */}
            <div className="bg-[#2b56f5] text-white p-6 text-center space-y-1.5 no-print">
              <CheckCircle className="w-10 h-10 text-white mx-auto" />
              <h2 className="text-sm font-black">تم إصدار وحفظ الفاتورة بنجاح!</h2>
              <p className="text-[10px] text-blue-100">تم ترحيل الفواتير وخفض المخازن ومكافأة الموظفين.</p>
            </div>

            {/* Receipt Preview */}
            <div className="p-8 overflow-y-auto bg-white text-slate-900 border-y border-dashed border-slate-200 flex-1" id="receipt-print">
              
              {/* Crown Logo Top */}
              <div className="flex justify-center mb-2">
                <img src={ANTO_LOGO_BASE64} className="w-[90px] h-[90px] object-contain mx-auto block" alt="Crown Logo" />
              </div>
              
              {/* Bold Header Details */}
              <div className="text-center space-y-1 mb-5">
                <div className="text-[22px] md:text-[24px] font-black text-slate-950 tracking-wider uppercase select-none font-sans leading-none">GALLERY ANTO</div>
                <h2 className="text-[17px] md:text-[18px] font-black text-slate-950 tracking-wide select-none font-sans mt-1">إدارة الحاج نبيل السريع</h2>
                <p className="text-xs text-slate-800 font-extrabold select-none">معرض انطو للأنتيكات والديكور</p>
              </div>

              {/* Dotted/Dashed Line */}
              <div className="border-t-2 border-dashed border-slate-950 my-4" />

              {/* Invoice identifiers */}
              <div className="space-y-2 text-xs text-slate-900 my-4">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold font-mono text-slate-950 text-[13px]">{lastCreatedInvoice.invoiceNumber}</span>
                  <span className="font-bold text-slate-700 font-sans">رقم الفاتورة:</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-black text-slate-950 font-sans">{lastCreatedInvoice.formattedDate}</span>
                  <span className="font-bold text-slate-700 font-sans">التاريخ الميلادي:</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-black text-slate-950 font-sans">{lastCreatedInvoice.formattedTime}</span>
                  <span className="font-bold text-slate-700 font-sans">الوقت الحالي:</span>
                </div>
                {lastCreatedInvoice.sellerName && (
                  <div className="flex justify-between items-center">
                    <span className="font-black text-slate-950 font-sans">{lastCreatedInvoice.sellerName}</span>
                    <span className="font-bold text-slate-700 font-sans">مسؤول البيع (البائع):</span>
                  </div>
                )}
                {lastCreatedInvoice.customerPhone && (
                  <div className="flex justify-between items-center">
                    <span className="font-black text-slate-950 font-mono text-[13px]" dir="ltr">{lastCreatedInvoice.customerPhone}</span>
                    <span className="font-bold text-slate-700 font-sans">رقم موبيل العميل:</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                    {lastCreatedInvoice.splitPayments && lastCreatedInvoice.splitPayments.length > 0 
                      ? lastCreatedInvoice.splitPayments.map(sp => sp.method).join(' + ') 
                      : (lastCreatedInvoice.paymentMethod || "كاش").replace(/\([^)]*\)/g, '').trim()}
                  </span>
                  <span className="font-bold text-slate-700 font-sans">طريقة الدفع:</span>
                </div>
              </div>

              {/* Dotted/Dashed Line */}
              <div className="border-t border-dashed border-slate-400 my-4" />

              {/* Items Header */}
              <div className="space-y-3 my-4">
                <div className="flex justify-between items-center text-[11px] text-slate-700 font-black pb-2 border-b border-slate-950">
                  <span className="w-1/3 text-right">الوصف (الصنف)</span>
                  <span className="w-1/3 text-center">الكمية</span>
                  <span className="w-1/3 text-left">الإجمالي</span>
                </div>
                
                {/* Items Rows */}
                <div className="space-y-4">
                  {lastCreatedInvoice.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs text-slate-900 py-1 font-bold">
                      {/* Right side: Description */}
                      <div className="w-1/3 text-right flex flex-col space-y-0.5">
                        <span className="font-black text-slate-950 text-[13px]">{it.name}</span>
                        <span className="text-[11px] text-slate-900 font-extrabold">سعر القطعة: {it.price.toLocaleString("ar-EG")} ج.م</span>
                      </div>
                      
                      {/* Center: Quantity */}
                      <div className="w-1/3 text-center font-black text-slate-950">
                        {it.quantity}x
                      </div>
                      
                      {/* Left: Total */}
                      <div className="w-1/3 text-left font-black text-slate-950">
                        {(it.price * it.quantity).toLocaleString("ar-EG")} ج.م
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dotted/Dashed Line */}
              <div className="border-t border-dashed border-slate-400 my-4" />

              {/* Pricing Summary */}
              {lastCreatedInvoice.discount && lastCreatedInvoice.discount > 0 ? (
                <div className="space-y-1.5 text-xs text-slate-950 my-4 py-1 font-bold">
                  <div className="flex justify-between items-center">
                    <span className="font-mono">{(lastCreatedInvoice.subtotal || (lastCreatedInvoice.total + lastCreatedInvoice.discount)).toLocaleString("ar-EG")} ج.م</span>
                    <span className="text-slate-600">الإجمالي قبل الخصم:</span>
                  </div>
                  <div className="flex justify-between items-center text-rose-600">
                    <span className="font-mono">-{lastCreatedInvoice.discount.toLocaleString("ar-EG")} ج.م</span>
                    <span>قيمة الخصم:</span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-black pt-1.5 border-t border-slate-950">
                    <span className="font-mono text-emerald-700">{lastCreatedInvoice.total.toLocaleString("ar-EG")} ج.م</span>
                    <span>المبلغ المطلوب:</span>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-center text-slate-950 my-4 py-2">
                  <span className="text-[15px] font-black font-mono">
                    {lastCreatedInvoice.total.toLocaleString("ar-EG")} ج.م
                  </span>
                  <span className="text-xs font-black">الإجمالي الكلي (Total):</span>
                </div>
              )}

              {/* Split Payments Breakdown Box placed directly after grand total */}
              {lastCreatedInvoice.splitPayments && lastCreatedInvoice.splitPayments.length > 0 && (
                <div className="bg-slate-50 border border-slate-300 p-3 rounded-xl space-y-1.5 my-2">
                  <div className="text-center font-black text-[11.5px] text-slate-900 border-b border-dashed border-slate-300 pb-1">
                    🔀 تفاصيل تجزئة الدفع
                  </div>
                  {lastCreatedInvoice.splitPayments.map((sp, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs font-bold text-slate-800">
                      <span className="font-black text-slate-950 font-mono">{Number(sp.amount).toLocaleString("ar-EG")} ج.م</span>
                      <span>• {sp.method}:</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Dotted/Dashed Line */}
              <div className="border-t border-dashed border-slate-400 my-4" />

              {/* DUAL CONTACT PHONE NUMBERS BOX */}
              <div className="border border-slate-950 bg-white p-3 py-3 rounded-xl text-center space-y-1.5 my-5">
                <span className="text-xs text-slate-950 font-black tracking-wide block">للتواصل:</span>
                <div className="flex items-center justify-center gap-2.5 text-xs font-mono font-extrabold text-slate-950 tracking-normal">
                  <span className="hover:underline">010-0495-0713</span>
                  <span className="text-slate-350">|</span>
                  <span className="hover:underline">010-2745-7070</span>
                  <Phone className="w-3.5 h-3.5 text-slate-950 shrink-0 fill-slate-950 stroke-white" />
                </div>
              </div>

              {/* QR CODE SECTION (REQUIREMENT 2) */}
              <div className="my-5 text-center space-y-1.5 border border-slate-200 bg-slate-50/50 p-3.5 rounded-2xl">
                <div className="flex items-center justify-center gap-1.5 text-slate-800">
                  <QrCode className="w-4 h-4 text-slate-950" />
                  <span className="text-[11px] font-black uppercase tracking-wider font-mono">SCAN ME</span>
                </div>
                <p className="text-[10px] text-slate-700 font-extrabold">امسح الكود</p>
                
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 inline-block shadow-xs">
                  <QRCodeGenerator value="https://linktr.ee/Nabil_elsareaa?utm_source=qr_code" size={120} />
                </div>
              </div>

              {/* Greetings footer & bottom divider */}
              <div className="mt-5 text-center space-y-2">
                <p className="text-xs font-black text-slate-950">شكراً لزيارتكم معرض أنطو للأنتيكات!</p>
                <div className="pt-5">
                  <div className="w-2/5 border-t-2 border-slate-950 mx-auto" />
                </div>
              </div>
            </div>

            {/* Print trigger / Close Actions */}
            <div className="p-6 bg-white flex gap-3 border-t border-slate-100 no-print">
              <button 
                id="receipt-print-btn"
                onClick={async () => {
                  await printInvoiceReceipt(lastCreatedInvoice);
                  closeReceiptAndFocusSearch();
                }}
                className="flex-1 bg-slate-900 hover:bg-slate-850 text-amber-500 font-bold py-3 text-xs transition-all flex items-center justify-center gap-2 cursor-pointer rounded-xl"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الفاتورة الفورية</span>
              </button>
              <button 
                onClick={closeReceiptAndFocusSearch}
                className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-xs transition-all cursor-pointer"
              >
                غلق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PASSWORD PROMPT MODAL FOR INVOICE DELETION */}
      {invoiceToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={confirmDeleteInvoice}
            className="bg-white rounded-3xl w-full max-w-sm p-6 text-right space-y-4 border border-slate-100 shadow-2xl animate-scaleUp"
          >
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xs font-black text-slate-800">يتطلب الحذف تصريح الحماية</h3>
              <p className="text-[10px] text-slate-400">يرجى كتابة رمز مرور الحذف:</p>
            </div>

            <div className="space-y-1">
              <input 
                type="password"
                required
                dir="ltr"
                placeholder="••••"
                value={deletePassword}
                onChange={(e) => {
                  setDeletePassword(e.target.value);
                  setPasswordError(false);
                }}
                className="w-full text-center tracking-[1em] py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-bold font-mono text-lg"
              />
              {passwordError && (
                <p className="text-[9px] text-rose-600 font-bold text-center">رمز المرور خاطئ!</p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl text-[11px] transition-all cursor-pointer"
              >
                حذف الفاتورة
              </button>
              <button
                type="button"
                onClick={() => setInvoiceToDelete(null)}
                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-[11px] transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* INVOICE PREVIEW MODAL BEFORE CONFIRMATION */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            
            {/* Header banner */}
            <div className="bg-emerald-600 text-white p-5 text-center space-y-1">
              <ShoppingCart className="w-9 h-9 text-white mx-auto animate-pulse" />
              <h2 className="text-sm font-black">معاينة مسودة الفاتورة قبل الإصدار</h2>
              <p className="text-[10px] text-emerald-100">يرجى مراجعة تفاصيل المنتجات والأسعار المعتمدة قبل الطباعة والتأكيد النهائي.</p>
            </div>

            {/* Receipt Draft Preview */}
            <div className="p-6 overflow-y-auto bg-white text-slate-900 border-b border-slate-100 flex-1 space-y-4" dir="rtl">
              
              {/* Info Details */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">رقم الفاتورة المتوقع:</span>
                  <span className="font-bold text-slate-800">ANTO-{String(invoices.length + 1).padStart(4, "0")}# (مسودة)</span>
                </div>
                {sellerName && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">الموظف المسؤول:</span>
                    <span className="font-extrabold text-slate-800">{sellerName}</span>
                  </div>
                )}
                {customerPhone.trim() && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">رقم موبيل العميل:</span>
                    <span className="font-extrabold text-slate-800 font-mono" dir="ltr">{customerPhone}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">طريقة الدفع:</span>
                  <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                    {isSplitPayment ? `${splitMethod1} + ${splitMethod2}` : (paymentMethod || "كاش")}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-bold text-slate-700 mr-1">قائمة المنتجات المراد إصدارها:</h4>
                <div className="border border-slate-150 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                  {cart.map((item) => {
                    const price = item.customPrice ?? item.product.price;
                    const qty = typeof item.quantity === "string" ? parseInt(item.quantity, 10) : item.quantity;
                    const finalQty = isNaN(qty) || qty <= 0 ? 1 : qty;
                    return (
                      <div key={item.product.id} className="p-3 bg-white flex justify-between items-center gap-3 text-xs">
                        <div className="text-right">
                          <span className="font-bold text-slate-800 block leading-tight">{item.product.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">سعر البيع: {price.toLocaleString("ar-EG")} ج.م</span>
                        </div>
                        <div className="text-left font-mono shrink-0">
                          <span className="text-slate-500 font-bold">{finalQty}x = </span>
                          <span className="font-black text-slate-900">{(price * finalQty).toLocaleString("ar-EG")} ج.م</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total Box */}
              {discountAmount > 0 && (
                <div className="bg-amber-50/60 border border-amber-200 p-3 rounded-2xl space-y-1 text-xs">
                  <div className="flex justify-between items-center text-slate-600 font-bold">
                    <span>الإجمالي قبل الخصم:</span>
                    <span className="font-mono">{cartSubtotal.toLocaleString("ar-EG")} ج.م</span>
                  </div>
                  <div className="flex justify-between items-center text-rose-600 font-bold">
                    <span>قيمة الخصم المطبق:</span>
                    <span className="font-mono">-{discountAmount.toLocaleString("ar-EG")} ج.م</span>
                  </div>
                </div>
              )}

              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex justify-between items-center">
                <span className="text-xs font-extrabold text-emerald-800">
                  {discountAmount > 0 ? "المبلغ المطلوب:" : "المبلغ المطلوب:"}
                </span>
                <span className="text-base font-black font-mono text-emerald-700">
                  {cartTotal.toLocaleString("ar-EG")} ج.م
                </span>
              </div>

              {/* Split Payments Breakdown Box placed directly after grand total */}
              {isSplitPayment && (
                <div className="bg-purple-50/60 border border-purple-200 p-3 rounded-2xl space-y-1.5 text-xs">
                  <div className="text-center font-black text-purple-900 border-b border-dashed border-purple-200 pb-1">
                    🔀 تفاصيل تجزئة الدفع
                  </div>
                  <div className="flex justify-between items-center font-bold text-purple-900">
                    <span className="font-mono font-black">{Number(splitAmount1 || 0).toLocaleString("ar-EG")} ج.م</span>
                    <span>• {splitMethod1}:</span>
                  </div>
                  <div className="flex justify-between items-center font-bold text-purple-900">
                    <span className="font-mono font-black">{Number(splitAmount2 || 0).toLocaleString("ar-EG")} ج.م</span>
                    <span>• {splitMethod2}:</span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm & Back Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2.5">
              <button 
                onClick={handleCheckout}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 text-xs transition-all flex items-center justify-center gap-2 cursor-pointer rounded-xl shadow-lg shadow-emerald-200"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{editingInvoice ? "حفظ وتثبيت التعديلات على الفاتورة" : "تأكيد وطباعة الفاتورة الفورية"}</span>
              </button>
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="px-5 bg-white hover:bg-slate-100 text-slate-600 font-bold py-3 rounded-xl text-xs transition-all cursor-pointer border border-slate-200"
              >
                رجوع وتعديل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORIES MANAGEMENT MODAL (REQUIREMENT 6) */}
      {showCategoriesModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-scaleUp">
            <div className="bg-slate-900 text-white p-5 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black">جميع أصناف وتصنيفات المعرض</h3>
              </div>
              <button
                onClick={() => setShowCategoriesModal(false)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3.5 py-1.5 rounded-xl font-black text-xs cursor-pointer shadow-sm"
              >
                إغلاق (✕)
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              <p className="text-xs text-slate-600 font-bold mb-3 leading-relaxed">
                تعرض هذه القائمة كافة التصنيفات المسجلة، يمكنك الاطلاع على عدد المنتجات لكل صنف أو مسح أي تصنيف وتحويل كافة منتجاته المندرجة فيه تلقائياً إلى "بدون تصنيف".
              </p>

              {categories.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8 font-bold">لا توجد تصنيفات مخصصة حالياً.</p>
              ) : (
                <div className="space-y-2.5">
                  {categories.map((cat) => {
                    const count = products.filter((p) => p.category === cat).length;
                    return (
                      <div key={cat} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center gap-3 hover:border-slate-300 transition-all">
                        <div>
                          <span className="font-black text-slate-900 text-xs block">{cat}</span>
                          <span className="text-[10px] text-slate-500 font-bold">يحتوي على ({count}) منتجات</span>
                        </div>
                        <button
                          onClick={() => {
                            if (window.confirm(`هل أنت متأكد من مسح تصنيف "${cat}"؟\nسيتم نقل كافة المنتجات المندرجة تحته (${count} منتجات) إلى "بدون تصنيف".`)) {
                              if (onDeleteCategory) {
                                onDeleteCategory(cat);
                              }
                            }
                          }}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1 shadow-2xs active:scale-95"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>مسح التصنيف</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-left">
              <button
                onClick={() => setShowCategoriesModal(false)}
                className="px-6 bg-slate-900 hover:bg-slate-800 text-amber-400 font-black py-2.5 rounded-xl text-xs cursor-pointer shadow-md"
              >
                تم والغلق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLEAR CART CONFIRMATION MODAL (REQUIREMENT 1) */}
      {showClearCartModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 text-center space-y-4 border border-slate-100 shadow-2xl animate-scaleUp" dir="rtl">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-rose-600" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900">تأكيد تفريغ سلة المبيعات</h3>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                هل أنت متأكد من تفريغ وإزالة جميع المنتجات من السلة؟
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setCart([]);
                  setShowClearCartModal(false);
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3 rounded-xl text-xs transition-all cursor-pointer shadow-md active:scale-95"
              >
                تفريغ السلة الآن
              </button>
              <button
                onClick={() => setShowClearCartModal(false)}
                className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-3 rounded-xl text-xs transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRICE LOWER THAN BASE PRICE ERROR MODAL (REQUIREMENT 2) */}
      {priceErrorModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 text-center space-y-4 border border-slate-100 shadow-2xl animate-scaleUp" dir="rtl">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7 text-rose-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-black text-rose-600">عفواً! السعر أقل من السعر الأساسي</h3>
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-right space-y-1">
                <p className="text-xs font-black text-slate-900">
                  المنتج: <span className="text-rose-700">{priceErrorModal.productName}</span>
                </p>
                <p className="text-xs font-bold text-slate-700">
                  السعر الأساسي المعتمد: <span className="font-mono text-emerald-700 font-black">{priceErrorModal.basePrice.toLocaleString("ar-EG")} ج.م</span>
                </p>
                <p className="text-xs font-bold text-slate-700">
                  السعر المكتوب حالياً: <span className="font-mono text-rose-600 font-black">{priceErrorModal.customPrice.toLocaleString("ar-EG")} ج.م</span>
                </p>
              </div>
              <p className="text-xs text-slate-600 font-bold leading-relaxed pt-1">
                لا يمكنك إصدار الفاتورة بسعر أقل من السعر الأساسي للمنتج. يرجى تعديل السعر المكتوب أولاً!
              </p>
            </div>
            <button
              onClick={() => setPriceErrorModal(null)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-amber-400 font-black py-3 rounded-xl text-xs transition-all cursor-pointer shadow-md active:scale-95"
            >
              فهمت، سأقوم بتعديل السعر الآن
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
