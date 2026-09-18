import QRCode from "qrcode";
import { Invoice, PaymentMethodsBreakdown } from "../types";
import { ANTO_LOGO_BASE64 } from "../assets/logoBase64";

export { ANTO_LOGO_BASE64 };

export type PaymentCategory = "cash" | "instapay" | "vodafoneCash" | "visa" | "other";

/**
 * Accurately categorizes any raw payment method string.
 * CRITICAL: Vodafone Cash MUST be evaluated before Cash, because "فودافون كاش" contains "كاش"!
 */
export function categorizeMethod(rawMethod: string | undefined): PaymentCategory {
  const m = (rawMethod || "كاش").trim().toLowerCase();

  // 1. Vodafone Cash check
  if (m.includes("فودافون") || m.includes("vodafone") || m.includes("كاش فون") || m.includes("vf")) {
    return "vodafoneCash";
  }
  // 2. InstaPay check
  if (m.includes("انستا") || m.includes("insta")) {
    return "instapay";
  }
  // 3. Visa / Card / Credit check
  if (m.includes("فيزا") || m.includes("visa") || m.includes("card") || m.includes("بطاقة") || m.includes("ائتمان")) {
    return "visa";
  }
  // 4. Pure Cash check (strictly NOT Vodafone Cash or other wallets)
  if (m.includes("كاش") || m.includes("cash") || m === "" || m.includes("نقدي") || m.includes("نقد")) {
    return "cash";
  }
  return "other";
}

export function calculatePaymentBreakdown(invoicesList: Invoice[]): PaymentMethodsBreakdown {
  const breakdown: PaymentMethodsBreakdown = {
    cash: 0,
    instapay: 0,
    vodafoneCash: 0,
    visa: 0,
    other: 0
  };

  const addAmount = (rawMethod: string, amount: number) => {
    const cat = categorizeMethod(rawMethod);
    breakdown[cat] = (breakdown[cat] || 0) + amount;
  };

  invoicesList.forEach((inv) => {
    if (inv.splitPayments && Array.isArray(inv.splitPayments) && inv.splitPayments.length > 0) {
      inv.splitPayments.forEach(sp => {
        addAmount(sp.method, Number(sp.amount) || 0);
      });
    } else {
      const raw = inv.paymentMethod || "كاش";
      if (raw.includes("+") && raw.includes("(")) {
        const parts = raw.split("+");
        let handled = false;
        parts.forEach((part) => {
          const match = part.match(/\(([\d.,]+)\)/);
          const methodOnly = part.replace(/\([^)]*\)/g, "").trim();
          if (match) {
            const amt = parseFloat(match[1].replace(/,/g, ""));
            if (!isNaN(amt)) {
              addAmount(methodOnly, amt);
              handled = true;
            }
          }
        });
        if (!handled) {
          addAmount(raw, Number(inv.total) || 0);
        }
      } else {
        addAmount(raw, Number(inv.total) || 0);
      }
    }
  });

  return breakdown;
}

export interface MethodStatItem {
  total: number;
  count: number;
}

export interface PaymentBreakdownWithCounts {
  cash: MethodStatItem;
  instapay: MethodStatItem;
  vodafoneCash: MethodStatItem;
  visa: MethodStatItem;
  other: MethodStatItem;
}

export function calculatePaymentBreakdownWithCounts(invoicesList: Invoice[]): PaymentBreakdownWithCounts {
  const breakdown: PaymentBreakdownWithCounts = {
    cash: { total: 0, count: 0 },
    instapay: { total: 0, count: 0 },
    vodafoneCash: { total: 0, count: 0 },
    visa: { total: 0, count: 0 },
    other: { total: 0, count: 0 }
  };

  invoicesList.forEach((inv) => {
    if (inv.splitPayments && Array.isArray(inv.splitPayments) && inv.splitPayments.length > 0) {
      inv.splitPayments.forEach(sp => {
        const cat = categorizeMethod(sp.method);
        const amt = Number(sp.amount) || 0;
        breakdown[cat].total += amt;
        breakdown[cat].count += 1;
      });
    } else {
      const raw = inv.paymentMethod || "كاش";
      if (raw.includes("+") && raw.includes("(")) {
        const parts = raw.split("+");
        let handled = false;
        parts.forEach((part) => {
          const match = part.match(/\(([\d.,]+)\)/);
          const methodOnly = part.replace(/\([^)]*\)/g, "").trim();
          if (match) {
            const amt = parseFloat(match[1].replace(/,/g, ""));
            if (!isNaN(amt)) {
              const cat = categorizeMethod(methodOnly);
              breakdown[cat].total += amt;
              breakdown[cat].count += 1;
              handled = true;
            }
          }
        });
        if (!handled) {
          const cat = categorizeMethod(raw);
          breakdown[cat].total += Number(inv.total) || 0;
          breakdown[cat].count += 1;
        }
      } else {
        const cat = categorizeMethod(raw);
        breakdown[cat].total += Number(inv.total) || 0;
        breakdown[cat].count += 1;
      }
    }
  });

  return breakdown;
}

let cachedQrDataUrl: string | null = null;

async function getQrDataUrl(): Promise<string> {
  if (cachedQrDataUrl) return cachedQrDataUrl;
  try {
    cachedQrDataUrl = await QRCode.toDataURL("https://linktr.ee/Nabil_elsareaa?utm_source=qr_code", {
      margin: 1,
      width: 140,
      errorCorrectionLevel: "H"
    });
  } catch (err) {
    console.error("QR Code generation error for printing:", err);
    cachedQrDataUrl = "";
  }
  return cachedQrDataUrl || "";
}

// Background eager pre-cache
getQrDataUrl().catch(() => {});

function executeIframePrint(receiptHtml: string) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0px";
  iframe.style.height = "0px";
  iframe.style.border = "none";
  iframe.style.zIndex = "-9999";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (doc) {
    doc.open();
    doc.write(receiptHtml);
    doc.close();

    // Trigger printing promptly with zero unnecessary delay
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.warn("Iframe print fallback trigger:", err);
        window.print();
      }
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1500);
    }, 40);
  } else {
    window.print();
  }
}

export async function printInvoiceReceipt(invoice: Invoice) {
  const qrDataUrl = await getQrDataUrl();

  const receiptHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>فاتورة ${invoice.invoiceNumber}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0mm;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      font-weight: 900 !important;
      direction: rtl;
    }
    .receipt {
      width: 100%;
      max-width: 76mm;
      padding: 2mm 3.5mm 28mm 3.5mm; /* 28mm bottom padding ensures thermal cutter blade does not slice QR or footer */
      margin: 0 auto;
      box-sizing: border-box;
      text-align: right;
      color: #000000 !important;
      overflow: hidden;
    }
    .dashed {
      border-top: 2px dashed #000000;
      margin: 7px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 4px 0;
      font-size: 12px;
      font-weight: 900;
      color: #000000 !important;
      line-height: 1.35;
    }
    .bold {
      font-weight: 900;
      color: #000000 !important;
    }
    table {
      width: 100%;
      table-layout: fixed; /* Prevents columns expanding off the printable area */
      font-size: 11.5px;
      border-collapse: collapse;
      margin: 5px 0;
      color: #000000 !important;
    }
    th {
      border-bottom: 2px solid #000000;
      padding: 4px 0;
      font-weight: 900;
      font-size: 12px;
      color: #000000 !important;
    }
    td {
      padding: 4px 0;
      vertical-align: top;
      color: #000000 !important;
      font-weight: 900;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    .col-desc { width: 50%; text-align: right; }
    .col-qty { width: 18%; text-align: center; }
    .col-total { width: 32%; text-align: left; }
    
    .total-box {
      font-size: 15.5px;
      font-weight: 900;
      margin: 6px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #000000 !important;
    }
    .contact-box {
      border: 1.5px solid #000000;
      padding: 6px 4px;
      text-align: center;
      font-size: 11px;
      margin: 8px 0;
      border-radius: 6px;
      font-weight: 900;
      color: #000000 !important;
      line-height: 1.4;
    }
    .qr-container {
      text-align: center;
      margin-top: 8px;
      margin-bottom: 4px;
      color: #000000 !important;
    }
    .qr-img {
      width: 110px;
      max-width: 85%;
      height: auto;
      display: block;
      margin: 0 auto;
      image-rendering: pixelated;
    }
    @media print {
      body {
        width: 100%;
        color: #000000 !important;
      }
      * {
        color: #000000 !important;
        font-weight: 900 !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Top Crown Logo Image -->
    <div style="text-align: center; margin-bottom: 6px;">
      <img src="${ANTO_LOGO_BASE64}" style="width: 90px; height: 90px; object-fit: contain; margin: 0 auto; display: block;" alt="Logo" />
    </div>

    <div style="text-align: center; margin-bottom: 8px;">
      <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: 1px; line-height: 1.1; color: #000; font-family: 'Arial Black', Arial, sans-serif; text-transform: uppercase;">GALLERY ANTO</h1>
      <div style="font-size: 18px; font-weight: 900; margin-top: 4px; color: #000;">إدارة الحاج نبيل السريع</div>
      <div style="font-size: 13px; font-weight: 800; margin-top: 2px; color: #000;">معرض انطو للأنتيكات والديكور</div>
    </div>
    
    <div class="dashed"></div>
    
    <div class="row"><span class="bold">${invoice.invoiceNumber}</span><span>رقم الفاتورة:</span></div>
    <div class="row"><span>${invoice.formattedDate}</span><span>التاريخ:</span></div>
    <div class="row"><span>${invoice.formattedTime}</span><span>الوقت:</span></div>
    ${invoice.sellerName ? `<div class="row"><span>${invoice.sellerName}</span><span>مسؤول البيع:</span></div>` : ''}
    ${invoice.customerPhone ? `<div class="row"><span class="bold" style="font-family: monospace;">${invoice.customerPhone}</span><span>رقم موبيل العميل:</span></div>` : ''}
    <div class="row"><span class="bold">${invoice.splitPayments && invoice.splitPayments.length > 0 ? invoice.splitPayments.map(sp => sp.method).join(' + ') : (invoice.paymentMethod || "كاش").replace(/\([^)]*\)/g, '').trim()}</span><span>طريقة الدفع:</span></div>
    
    <div class="dashed"></div>
    
    <table>
      <thead>
        <tr>
          <th class="col-desc">الوصف</th>
          <th class="col-qty">الكمية</th>
          <th class="col-total">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${invoice.items.map(item => `
          <tr>
            <td class="col-desc">
              <div style="font-size: 12px; font-weight: 900;">${item.name}</div>
              <div style="font-size: 10.5px; font-weight: 900; color: #000;">سعر القطعة: ${item.price.toLocaleString("ar-EG")} ج.م</div>
            </td>
            <td class="col-qty" style="font-size: 12px; font-weight: 900;">${item.quantity}x</td>
            <td class="col-total" style="font-size: 12px; font-weight: 900;">${(item.price * item.quantity).toLocaleString("ar-EG")} ج.م</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div class="dashed"></div>
    
    ${(invoice.discount && invoice.discount > 0) ? `
    <div class="row" style="font-size: 13px;">
      <span>${invoice.subtotal ? invoice.subtotal.toLocaleString("ar-EG") : invoice.total.toLocaleString("ar-EG")} ج.م</span>
      <span>المجموع الأصلي:</span>
    </div>
    <div class="row" style="color: #000; font-size: 13px;">
      <span>-${invoice.discount.toLocaleString("ar-EG")} ج.م</span>
      <span>الخصم المطبق:</span>
    </div>
    <div class="total-box">
      <span style="font-size: 16px;">${invoice.total.toLocaleString("ar-EG")} ج.م</span>
      <span>المبلغ الصافي المطلوب:</span>
    </div>
    ` : `
    <div class="total-box">
      <span style="font-size: 16px;">${invoice.total.toLocaleString("ar-EG")} ج.م</span>
      <span>المبلغ المطلوب:</span>
    </div>
    `}
    
    ${invoice.splitPayments && invoice.splitPayments.length > 0 ? `
    <div style="background: #f8fafc; border: 1.5px dashed #000; padding: 6px 8px; border-radius: 4px; margin: 6px 0;">
      <div style="text-align: center; font-weight: 900; font-size: 11.5px; margin-bottom: 4px; border-bottom: 1px dashed #000; padding-bottom: 2px;">
        🔀 تفاصيل تجزئة الدفع
      </div>
      ${invoice.splitPayments.map(sp => `
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 900; margin: 3px 0;">
          <span style="font-weight: 900; font-family: monospace;">${Number(sp.amount).toLocaleString("ar-EG")} ج.م</span>
          <span>• ${sp.method}:</span>
        </div>
      `).join('')}
    </div>
    ` : ''}
    
    <div class="dashed"></div>
    
    <div class="contact-box">
      <div style="font-size: 12px; font-weight: 900;">للتواصل:</div>
      <div style="font-size: 12px; font-family: monospace; margin-top: 2px; font-weight: 900; letter-spacing: 0.3px;">010-2745-7070 | 010-0495-0713</div>
    </div>
    
    <div class="qr-container">
      <div style="font-size: 11px; font-weight: 900; letter-spacing: 1px;">SCAN ME</div>
      <div style="font-size: 10px; font-weight: 900; margin-bottom: 3px;">امسح الكود</div>
      ${qrDataUrl ? `<img src="${qrDataUrl}" class="qr-img" alt="QR" />` : ''}
    </div>
    
    <div style="text-align: center; margin-top: 10px;">
      <div style="font-size: 12px; font-weight: 900; color: #000;">شكراً لزيارتكم معرض أنطو للأنتيكات!</div>
      <div style="margin-top: 14px; display: flex; justify-content: center; align-items: center;">
        <div style="width: 45%; border-top: 1.5px solid #000000; margin: 0 auto;"></div>
      </div>
    </div>
    
    <!-- Extra paper feed safety spacer to clear thermal cutter blade -->
    <div style="height: 18mm; width: 100%;"></div>
  </div>
</body>
</html>
  `;

  executeIframePrint(receiptHtml);
}

export interface ShiftCloseData {
  formattedDate: string;
  formattedTime: string;
  totalSales: number;
  totalDiscounts: number;
  totalExpenses: number;
  expenses?: Array<{
    title: string;
    amount: number;
    notes?: string;
  }>;
  netSales: number;
  invoiceCount: number;
  discountedInvoicesCount?: number;
  totalItemsSold?: number;
  paymentBreakdown?: PaymentMethodsBreakdown;
  employeeRankings?: Array<{
    name: string;
    totalSales: number;
    invoiceCount?: number;
  }>;
}

export async function printShiftCloseReceipt(data: ShiftCloseData) {
  const now = new Date();
  const printDate = data.formattedDate || now.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const printTime = data.formattedTime || now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: true });

  const pb = data.paymentBreakdown || {
    cash: data.totalSales,
    instapay: 0,
    vodafoneCash: 0,
    visa: 0,
    other: 0
  };

  const receiptHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير إغلاق اليوم - GALLERY ANTO</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0mm;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-weight: 900 !important;
      direction: rtl;
    }
    .receipt {
      width: 100%;
      max-width: 76mm;
      padding: 2mm 3.5mm 28mm 3.5mm; /* 28mm bottom safety margin */
      margin: 0 auto;
      box-sizing: border-box;
      text-align: right;
      overflow: hidden;
    }
    .divider {
      border-top: 2px dashed #000000;
      margin: 8px 0;
    }
    .double-divider {
      border-top: 3px double #000000;
      margin: 10px 0;
    }
    .solid-divider {
      border-top: 2px solid #000000;
      margin: 8px 0;
    }
    .title-box {
      border: 2.5px solid #000000;
      border-radius: 8px;
      padding: 6px 4px;
      margin: 6px 0;
      text-align: center;
      font-size: 17px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 900;
      text-align: center;
      margin: 8px 0 6px 0;
      border-bottom: 2px solid #000;
      padding-bottom: 3px;
      letter-spacing: 0.3px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 5px 0;
      font-size: 13.5px;
      font-weight: 900;
      line-height: 1.4;
    }
    .metric-box {
      border: 2.5px solid #000000;
      border-radius: 8px;
      padding: 8px 6px;
      margin: 8px 0;
      text-align: center;
      background: #000000;
      color: #ffffff !important;
    }
    .metric-box * {
      color: #ffffff !important;
      font-weight: 900 !important;
    }
    .payment-box {
      border: 1.8px solid #000000;
      border-radius: 8px;
      padding: 6px 8px;
      margin: 6px 0;
      background: #fafafa;
    }
    .worker-card {
      border: 1.5px solid #000000;
      border-radius: 6px;
      padding: 6px 8px;
      margin: 5px 0;
      background: #fdfdfd;
    }
    @media print {
      body {
        width: 80mm;
      }
      * {
        font-weight: 900 !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Top Brand Header -->
    <div style="text-align: center; margin-bottom: 8px;">
      <img src="${ANTO_LOGO_BASE64}" style="width: 90px; height: 90px; object-fit: contain; margin: 0 auto; display: block;" alt="Logo" />
      <h1 style="margin: 4px 0 0 0; font-size: 26px; font-weight: 900; letter-spacing: 1px; line-height: 1.1; font-family: 'Arial Black', Arial, sans-serif; text-transform: uppercase;">GALLERY ANTO</h1>
      <div style="font-size: 18px; font-weight: 900; margin-top: 4px;">إدارة الحاج نبيل السريع</div>
      <div style="font-size: 13px; font-weight: 800; margin-top: 2px;">معرض انطو للأنتيكات والديكور</div>
    </div>

    <!-- Main Title -->
    <div class="title-box">
      تقرير إغلاق وتصفير اليوم
    </div>

    <div class="divider"></div>

    <!-- Date & Time -->
    <div class="info-row">
      <span style="font-size: 13.5px; font-weight: 900;">التاريخ:</span>
      <span style="font-size: 13.5px; font-weight: 900;">${printDate}</span>
    </div>
    <div class="info-row">
      <span style="font-size: 13.5px; font-weight: 900;">وقت الإغلاق:</span>
      <span style="font-size: 13.5px; font-weight: 900;">${printTime}</span>
    </div>

    <div class="solid-divider"></div>

    <!-- 1. مبيعات اليوم -->
    <div class="info-row" style="font-size: 15px; font-weight: 900;">
      <span>1. إجمالي مبيعات اليوم:</span>
      <span style="font-size: 16px; font-weight: 900;">${data.totalSales.toLocaleString("ar-EG")} ج.م</span>
    </div>

    ${(data.totalDiscounts || 0) > 0 ? `
    <div class="info-row" style="font-size: 13.5px; font-weight: 900;">
      <span>إجمالي الخصومات:</span>
      <span style="font-size: 14px; font-weight: 900;">-${data.totalDiscounts.toLocaleString("ar-EG")} ج.م</span>
    </div>
    ` : ''}

    <!-- 2. مصروفات اليوم -->
    <div class="info-row" style="font-size: 14.5px; font-weight: 900;">
      <span>2. مصروفات اليوم:</span>
      <span style="font-size: 15px; font-weight: 900;">-${(data.totalExpenses || 0).toLocaleString("ar-EG")} ج.م</span>
    </div>

    ${data.expenses && data.expenses.length > 0 ? `
    <div class="payment-box" style="margin-top: 4px;">
      <div style="font-size: 13.5px; font-weight: 900; text-align: center; border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px;">تفاصيل المصروفات</div>
      ${data.expenses.map((expense) => `
        <div class="info-row" style="font-size: 12.5px; font-weight: 900; border-bottom: 1px dashed #000; padding: 3px 0; align-items: flex-start;">
          <span style="max-width: 65%; line-height: 1.35;">${expense.title}${expense.notes ? `<small style="display: block; font-size: 10px; font-weight: 800; margin-top: 2px;">${expense.notes}</small>` : ''}</span>
          <span style="font-size: 13px; font-weight: 900; white-space: nowrap;">-${expense.amount.toLocaleString("ar-EG")} ج.م</span>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- 3. صافي المبيعات اليوم -->
    <div class="metric-box">
      <div style="font-size: 14px; font-weight: 900;">3. صافي المبيعات الفعلي:</div>
      <div style="font-size: 22px; font-weight: 900; margin-top: 4px;">${data.netSales.toLocaleString("ar-EG")} ج.م</div>
    </div>

    <div class="double-divider"></div>

    <!-- قسم تقسيمة طرق الدفع والتحصيل -->
    <div class="section-title">
      تقسيمة طرق الدفع والتحصيل
    </div>
    
    <div class="payment-box">
      <div class="info-row" style="font-size: 14px; font-weight: 900; border-bottom: 1px dashed #000; padding-bottom: 4px;">
        <span>💵 كاش (نقدي):</span>
        <span style="font-size: 15px; font-weight: 900;">${(pb.cash || 0).toLocaleString("ar-EG")} ج.م</span>
      </div>
      <div class="info-row" style="font-size: 14px; font-weight: 900; border-bottom: 1px dashed #000; padding: 4px 0;">
        <span>⚡ انستا باي (Instapay):</span>
        <span style="font-size: 15px; font-weight: 900;">${(pb.instapay || 0).toLocaleString("ar-EG")} ج.م</span>
      </div>
      <div class="info-row" style="font-size: 14px; font-weight: 900; border-bottom: 1px dashed #000; padding: 4px 0;">
        <span>📱 فودافون كاش:</span>
        <span style="font-size: 15px; font-weight: 900;">${(pb.vodafoneCash || 0).toLocaleString("ar-EG")} ج.م</span>
      </div>
      <div class="info-row" style="font-size: 14px; font-weight: 900; padding-top: 4px;">
        <span>💳 فيزا / شبكة:</span>
        <span style="font-size: 15px; font-weight: 900;">${(pb.visa || 0).toLocaleString("ar-EG")} ج.م</span>
      </div>
      ${(pb.other || 0) > 0 ? `
      <div class="info-row" style="font-size: 13.5px; font-weight: 900; border-top: 1px dashed #000; padding-top: 4px;">
        <span>أخرى:</span>
        <span style="font-size: 14px; font-weight: 900;">${pb.other.toLocaleString("ar-EG")} ج.م</span>
      </div>
      ` : ''}
    </div>

    <div class="divider"></div>

    <!-- 4. عدد المنتجات المباعة اليوم -->
    <div class="info-row" style="font-size: 13.5px; font-weight: 900;">
      <span>4. عدد القطع المباعة اليوم:</span>
      <span style="font-size: 14px; font-weight: 900;">${data.totalItemsSold ?? data.invoiceCount} قطعة</span>
    </div>

    <!-- 5. عدد المنتجات التي تم بيعها بأقل من السعر الأساسي -->
    <div class="info-row" style="font-size: 13px; font-weight: 900;">
      <span>5. فواتير بخصم تحت السعر الأساسي:</span>
      <span style="font-size: 14px; font-weight: 900;">${data.discountedInvoicesCount || 0} فاتورة</span>
    </div>

    <div class="info-row" style="font-size: 13px; font-weight: 900;">
      <span>6. إجمالي عدد فواتير اليوم:</span>
      <span style="font-size: 14px; font-weight: 900;">${data.invoiceCount} فاتورة</span>
    </div>

    <div class="double-divider"></div>

    <!-- قسم مبيعات العاملين -->
    <div class="section-title">
      ترتيب مبيعات العاملين اليوم
    </div>

    ${data.employeeRankings && data.employeeRankings.length > 0 ? `
      <div>
        ${data.employeeRankings.map((emp, idx) => `
          <div class="worker-card">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 900;">
              <span>${idx + 1}. ${emp.name}</span>
              ${emp.invoiceCount !== undefined ? `<span style="font-size: 12px; font-weight: 900;">(${emp.invoiceCount} فواتير)</span>` : ''}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14.5px; font-weight: 900; margin-top: 3px; border-top: 1px dashed #000; padding-top: 3px;">
              <span>إجمالي المبيعات:</span>
              <span style="font-size: 15px; font-weight: 900;">${emp.totalSales.toLocaleString("ar-EG")} ج.م</span>
            </div>
          </div>
        `).join('')}
      </div>
    ` : `
      <div style="text-align: center; font-size: 13px; font-weight: 900; margin: 8px 0;">لا توجد مبيعات للعاملين في هذا اليوم</div>
    `}

    <div class="divider"></div>

    <div style="text-align: center; font-size: 10.5px; font-weight: 900; margin-top: 8px;">
      نظام جاليري أنطو لإدارة المبيعات • بون إغلاق معتمد
    </div>

    <!-- Bottom cut line spacer -->
    <div style="text-align: center; margin-top: 16px; padding-top: 10px;">
      <div style="width: 35mm; border-top: 1.5px solid #000000; margin: 0 auto;"></div>
    </div>
  </div>
</body>
</html>
  `;

  executeIframePrint(receiptHtml);
}

export interface MonthlyArchivePrintData {
  key: string;
  label: string;
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
  invoiceCount: number;
  itemCount: number;
  avgTicket: number;
  paymentBreakdown: Record<string, number>;
  sellerBreakdown: Record<string, number>;
}

export async function printMonthlyArchiveReceipt(data: MonthlyArchivePrintData) {
  const qrDataUrl = await getQrDataUrl();
  const now = new Date();
  const printDate = now.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const printTime = now.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: true });

  const pb = data.paymentBreakdown || {};
  const cashAmount = pb["كاش"] || pb["cash"] || 0;
  const instapayAmount = pb["انستا باي"] || pb["انستاباي"] || pb["instapay"] || 0;
  const vodafoneAmount = pb["فودافون كاش"] || pb["vodafone"] || 0;
  const visaAmount = pb["فيزا"] || pb["visa"] || 0;

  const receiptHtml = `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير أرشيف ${data.label} - GALLERY ANTO</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0mm;
    }
    *, *::before, *::after {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 auto !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      font-weight: 900 !important;
      direction: rtl;
    }
    .receipt {
      width: 100%;
      max-width: 76mm;
      padding: 2mm 3.5mm 28mm 3.5mm;
      margin: 0 auto;
      box-sizing: border-box;
      text-align: right;
      overflow: hidden;
    }
    .divider {
      border-top: 2px dashed #000000;
      margin: 8px 0;
    }
    .double-divider {
      border-top: 3px double #000000;
      margin: 10px 0;
    }
    .solid-divider {
      border-top: 2px solid #000000;
      margin: 8px 0;
    }
    .title-box {
      border: 2.5px solid #000000;
      border-radius: 8px;
      padding: 6px 4px;
      margin: 6px 0;
      text-align: center;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.5px;
      background: #fafafa;
    }
    .section-title {
      font-size: 14px;
      font-weight: 900;
      text-align: center;
      margin: 8px 0 6px 0;
      border-bottom: 2px solid #000;
      padding-bottom: 3px;
      letter-spacing: 0.3px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 5px 0;
      font-size: 13.5px;
      font-weight: 900;
      line-height: 1.4;
    }
    .metric-box {
      border: 2.5px solid #000000;
      border-radius: 8px;
      padding: 8px 6px;
      margin: 8px 0;
      text-align: center;
      background: #000000;
      color: #ffffff !important;
    }
    .metric-box * {
      color: #ffffff !important;
      font-weight: 900 !important;
    }
    .payment-box {
      border: 1.8px solid #000000;
      border-radius: 8px;
      padding: 6px 8px;
      margin: 6px 0;
      background: #fafafa;
    }
    .worker-card {
      border: 1.5px solid #000000;
      border-radius: 6px;
      padding: 6px 8px;
      margin: 5px 0;
      background: #fdfdfd;
    }
    .contact-box {
      border: 1.5px solid #000000;
      padding: 6px 4px;
      text-align: center;
      font-size: 11px;
      margin: 8px 0;
      border-radius: 6px;
      font-weight: 900;
      line-height: 1.4;
    }
    .qr-container {
      text-align: center;
      margin-top: 8px;
      margin-bottom: 4px;
    }
    .qr-img {
      width: 100px;
      max-width: 80%;
      height: auto;
      display: block;
      margin: 0 auto;
    }
    @media print {
      body {
        width: 80mm;
      }
      * {
        font-weight: 900 !important;
      }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Top Brand Header -->
    <div style="text-align: center; margin-bottom: 8px;">
      <img src="${ANTO_LOGO_BASE64}" style="width: 90px; height: 90px; object-fit: contain; margin: 0 auto; display: block;" alt="Logo" />
      <h1 style="margin: 4px 0 0 0; font-size: 26px; font-weight: 900; letter-spacing: 1px; line-height: 1.1; font-family: 'Arial Black', Arial, sans-serif; text-transform: uppercase;">GALLERY ANTO</h1>
      <div style="font-size: 18px; font-weight: 900; margin-top: 4px;">إدارة الحاج نبيل السريع</div>
      <div style="font-size: 13px; font-weight: 800; margin-top: 2px;">معرض انطو للأنتيكات والديكور</div>
    </div>

    <!-- Main Title -->
    <div class="title-box">
      تقرير الأرشيف الشهري الرسمي<br />
      <span style="font-size: 14px; color: #333;">${data.label}</span>
    </div>

    <div class="divider"></div>

    <!-- Date & Time of Print -->
    <div class="info-row">
      <span style="font-size: 12.5px;">تاريخ الطباعة:</span>
      <span style="font-size: 12.5px;">${printDate}</span>
    </div>
    <div class="info-row">
      <span style="font-size: 12.5px;">وقت الطباعة:</span>
      <span style="font-size: 12.5px;">${printTime}</span>
    </div>

    <div class="solid-divider"></div>

    <!-- 1. إجمالي مبيعات الشهر -->
    <div class="info-row" style="font-size: 15px; font-weight: 900;">
      <span>1. إجمالي مبيعات الشهر:</span>
      <span style="font-size: 16px; font-weight: 900;">${data.totalSales.toLocaleString("ar-EG")} ج.م</span>
    </div>

    <!-- 2. مصروفات الشهر -->
    <div class="info-row" style="font-size: 14.5px; font-weight: 900;">
      <span>2. مصروفات الشهر التشغيلية:</span>
      <span style="font-size: 15px; font-weight: 900;">-${data.totalExpenses.toLocaleString("ar-EG")} ج.م</span>
    </div>

    <!-- 3. صافي أرباح الشهر -->
    <div class="metric-box">
      <div style="font-size: 13.5px; font-weight: 900;">3. صافي الأرباح المحققة للشهر:</div>
      <div style="font-size: 22px; font-weight: 900; margin-top: 4px;">${data.netProfit.toLocaleString("ar-EG")} ج.م</div>
    </div>

    <div class="info-row" style="font-size: 13px;">
      <span>عدد الفواتير الصادرة:</span>
      <span style="font-size: 14px;">${data.invoiceCount} فاتورة</span>
    </div>
    <div class="info-row" style="font-size: 13px;">
      <span>إجمالي القطع المباعة:</span>
      <span style="font-size: 14px;">${data.itemCount} قطعة</span>
    </div>
    <div class="info-row" style="font-size: 13px;">
      <span>متوسط قيمة الفاتورة:</span>
      <span style="font-size: 14px;">${data.avgTicket.toLocaleString("ar-EG")} ج.م</span>
    </div>

    <div class="double-divider"></div>

    <!-- قسم طرق الدفع والتحصيل في هذا الشهر -->
    <div class="section-title">
      طرق التحصيل والدفع في ${data.label}
    </div>
    
    <div class="payment-box">
      <div class="info-row" style="font-size: 14px; font-weight: 900; border-bottom: 1px dashed #000; padding-bottom: 4px;">
        <span>💵 كاش (نقدي):</span>
        <span style="font-size: 15px; font-weight: 900;">${cashAmount.toLocaleString("ar-EG")} ج.م</span>
      </div>
      <div class="info-row" style="font-size: 14px; font-weight: 900; border-bottom: 1px dashed #000; padding: 4px 0;">
        <span>⚡ انستا باي (Instapay):</span>
        <span style="font-size: 15px; font-weight: 900;">${instapayAmount.toLocaleString("ar-EG")} ج.م</span>
      </div>
      <div class="info-row" style="font-size: 14px; font-weight: 900; border-bottom: 1px dashed #000; padding: 4px 0;">
        <span>📱 فودافون كاش:</span>
        <span style="font-size: 15px; font-weight: 900;">${vodafoneAmount.toLocaleString("ar-EG")} ج.م</span>
      </div>
      <div class="info-row" style="font-size: 14px; font-weight: 900; padding-top: 4px;">
        <span>💳 فيزا / شبكة:</span>
        <span style="font-size: 15px; font-weight: 900;">${visaAmount.toLocaleString("ar-EG")} ج.م</span>
      </div>
    </div>

    <div class="double-divider"></div>

    <!-- قسم مبيعات الموظفين في هذا الشهر -->
    <div class="section-title">
      مبيعات الموظفين في ${data.label}
    </div>

    ${Object.keys(data.sellerBreakdown || {}).length > 0 ? `
      <div>
        ${Object.entries(data.sellerBreakdown).map(([seller, amountVal], idx) => {
          const amount = Number(amountVal) || 0;
          const pct = data.totalSales > 0 ? Math.round((amount / data.totalSales) * 100) : 0;
          return `
            <div class="worker-card">
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 900;">
                <span>${idx + 1}. ${seller}</span>
                <span style="font-size: 12px; font-weight: 900;">(${pct}%)</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 14.5px; font-weight: 900; margin-top: 3px; border-top: 1px dashed #000; padding-top: 3px;">
                <span>المبيعات:</span>
                <span style="font-size: 15px; font-weight: 900;">${amount.toLocaleString("ar-EG")} ج.م</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : `
      <div style="text-align: center; font-size: 13px; font-weight: 900; margin: 8px 0;">لا توجد مبيعات للموظفين في هذا الشهر</div>
    `}

    <div class="divider"></div>

    <div class="contact-box">
      <div style="font-size: 12px; font-weight: 900;">للتواصل:</div>
      <div style="font-size: 12px; font-family: monospace; margin-top: 2px; font-weight: 900;">010-2745-7070 | 010-0495-0713</div>
    </div>

    <div class="qr-container">
      <div style="font-size: 11px; font-weight: 900; letter-spacing: 1px;">SCAN ME</div>
      <div style="font-size: 10px; font-weight: 900; margin-bottom: 3px;">امسح الكود</div>
      ${qrDataUrl ? `<img src="${qrDataUrl}" class="qr-img" alt="QR" />` : ''}
    </div>

    <div style="text-align: center; font-size: 10.5px; font-weight: 900; margin-top: 8px;">
      نظام جاليري أنطو لإدارة المبيعات • تقرير شهري رسمي
    </div>

    <!-- Bottom cut line spacer -->
    <div style="text-align: center; margin-top: 16px; padding-top: 10px;">
      <div style="width: 35mm; border-top: 1.5px solid #000000; margin: 0 auto;"></div>
    </div>
  </div>
</body>
</html>
  `;

  executeIframePrint(receiptHtml);
}
