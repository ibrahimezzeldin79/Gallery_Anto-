import React from "react";
import { Invoice } from "../types";
import { Printer, X, FileText, Phone, Download, QrCode } from "lucide-react";
import QRCodeGenerator from "../QRCodeGenerator";
import QRCode from "qrcode";
import { printInvoiceReceipt } from "../utils/printer";
import { ANTO_LOGO_BASE64 } from "../assets/logoBase64";

interface InvoiceViewerProps {
  invoice: Invoice | null;
  onClose: () => void;
}

export default function InvoiceViewer({ invoice, onClose }: InvoiceViewerProps) {
  if (!invoice) return null;

  // Helper to trigger direct download of formatted printable receipt file
  const handleSaveInvoiceFile = async () => {
    let qrDataUrl = "";
    try {
      qrDataUrl = await QRCode.toDataURL("https://linktr.ee/Nabil_elsareaa?utm_source=qr_code", {
        margin: 1,
        width: 140,
        errorCorrectionLevel: "H"
      });
    } catch (err) {
      console.error("QR generation error:", err);
    }

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
      padding: 2mm 3.5mm 28mm 3.5mm; /* 28mm bottom safety margin prevents auto-cutter cutting QR */
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
      table-layout: fixed;
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
        ${invoice.items.map(it => `
          <tr>
            <td class="col-desc">
              <div style="font-size: 11.5px; font-weight: 900; line-height: 1.3;">${it.name}</div>
              <div style="font-size: 10px; font-weight: 800; margin-top: 1px; color: #000000 !important;">سعر القطعة: ${it.price.toLocaleString("ar-EG")} ج.م</div>
            </td>
            <td class="col-qty" style="font-size: 11.5px; padding-top: 4px;">${it.quantity}x</td>
            <td class="col-total" style="font-size: 11.5px; padding-top: 4px;">${(it.price * it.quantity).toLocaleString("ar-EG")} ج.م</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="dashed"></div>
    <div class="total-box">
      <span style="font-size: 16px;">${invoice.total.toLocaleString("ar-EG")} ج.م</span>
      <span>الإجمالي المطلوب:</span>
    </div>
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
      ${qrDataUrl ? `<img src="${qrDataUrl}" class="qr-img" alt="QR Code" />` : ''}
    </div>
    <div style="text-align: center; margin-top: 10px;">
      <div style="font-size: 12px; font-weight: 900; color: #000;">شكراً لزيارتكم معرض أنطو للأنتيكات!</div>
      <div style="margin-top: 14px; display: flex; justify-content: center; align-items: center;">
        <div style="width: 45%; border-top: 1.5px solid #000000; margin: 0 auto;"></div>
      </div>
    </div>
    
    <!-- Extra paper feed safety spacer to clear thermal cutter blade -->
    <div style="height: 15mm; width: 100%;"></div>
  </div>
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>
    `;

    const blob = new Blob([receiptHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-ANTO-${invoice.invoiceNumber}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:p-0 no-print-backdrop" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] print:max-h-full print:w-full print:shadow-none print:border-none print:rounded-none animate-scaleUp">
        
        {/* Header toolbar - hidden on print */}
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center no-print">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <span className="font-extrabold text-sm">تفاصيل فاتورة البيع الرسمية</span>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl transition-all text-xs font-bold cursor-pointer"
          >
            إغلاق (✕)
          </button>
        </div>

        {/* PRINT TARGET RECEIPT CONTAINER */}
        <div className="p-6 overflow-y-auto bg-white flex-1 text-slate-900 w-full" id="receipt-print">
          
          {/* Crown Logo Top */}
          <div className="flex justify-center mb-2">
            <img src={ANTO_LOGO_BASE64} className="w-[90px] h-[90px] object-contain mx-auto block" alt="Crown Logo" />
          </div>
          
          {/* Bold Header Details */}
          <div className="text-center space-y-1 mb-4">
            <h1 className="text-[22px] md:text-[24px] font-black text-slate-950 tracking-wider uppercase select-none font-sans leading-none">GALLERY ANTO</h1>
            <h2 className="text-[17px] md:text-[18px] font-black text-slate-950 tracking-wide select-none font-sans mt-1">إدارة الحاج نبيل السريع</h2>
            <p className="text-xs text-slate-800 font-extrabold select-none">معرض انطو للأنتيكات والديكور</p>
          </div>

          {/* Dotted/Dashed Line */}
          <div className="border-t-2 border-dashed border-slate-900 my-3" />

          {/* Invoice identifiers */}
          <div className="space-y-1.5 text-xs text-slate-900 my-3">
            <div className="flex justify-between items-center">
              <span className="font-extrabold font-mono text-slate-950 text-[12.5px]">{invoice.invoiceNumber}</span>
              <span className="font-black text-slate-800">رقم الفاتورة:</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-black text-slate-950">{invoice.formattedDate}</span>
              <span className="font-black text-slate-800">التاريخ الميلادي:</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-black text-slate-950">{invoice.formattedTime}</span>
              <span className="font-black text-slate-800">الوقت الحالي:</span>
            </div>
            {invoice.sellerName && (
              <div className="flex justify-between items-center">
                <span className="font-black text-slate-950">{invoice.sellerName}</span>
                <span className="font-black text-slate-800">مسؤول البيع (البائع):</span>
              </div>
            )}
            {invoice.customerPhone && (
              <div className="flex justify-between items-center">
                <span className="font-black text-slate-950 font-mono text-[13px]" dir="ltr">{invoice.customerPhone}</span>
                <span className="font-black text-slate-800">رقم موبيل العميل:</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                {invoice.splitPayments && invoice.splitPayments.length > 0 
                  ? invoice.splitPayments.map(sp => sp.method).join(' + ') 
                  : (invoice.paymentMethod || "كاش").replace(/\([^)]*\)/g, '').trim()}
              </span>
              <span className="font-black text-slate-800">طريقة الدفع:</span>
            </div>
            {invoice.isDiscountedBelowBase && (
              <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-xs text-rose-700 font-bold space-y-1 my-2">
                <p className="font-black text-rose-800 flex items-center gap-1">
                  <span>⚠️ تنبيه: تم بيع منتج بأقل من سعره الأساسي</span>
                </p>
                {invoice.discountAlerts?.map((a, i) => (
                  <p key={i} className="text-[10px] font-medium">• {a}</p>
                ))}
              </div>
            )}
          </div>

          {/* Dotted/Dashed Line */}
          <div className="border-t-2 border-dashed border-slate-900 my-3" />

          {/* Items Header */}
          <div className="my-3">
            <div className="flex justify-between items-center text-[11px] text-slate-900 font-black pb-1.5 border-b-2 border-slate-950">
              <span className="w-[50%] text-right">الوصف</span>
              <span className="w-[18%] text-center">الكمية</span>
              <span className="w-[32%] text-left">الإجمالي</span>
            </div>
            
            {/* Items Rows */}
            <div className="divide-y divide-slate-200">
              {invoice.items.map((it, idx) => (
                <div key={idx} className="flex justify-between items-start text-xs text-slate-900 py-1.5">
                  {/* Right side: Description */}
                  <div className="w-[50%] text-right flex flex-col pr-0.5">
                    <span className="font-black text-slate-950 text-[12px] break-words">{it.name}</span>
                    <span className="text-[10px] text-slate-600 font-bold">سعر القطعة: {it.price.toLocaleString("ar-EG")} ج.م</span>
                  </div>
                  
                  {/* Center: Quantity */}
                  <div className="w-[18%] text-center font-black text-slate-950 text-[11.5px] pt-0.5">
                    {it.quantity}x
                  </div>
                  
                  {/* Left: Total */}
                  <div className="w-[32%] text-left font-black text-slate-950 text-[11.5px] pt-0.5 pl-0.5">
                    {(it.price * it.quantity).toLocaleString("ar-EG")} ج.م
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dotted/Dashed Line */}
          <div className="border-t-2 border-dashed border-slate-900 my-3" />

          {/* Pricing Summary */}
          <div className="flex justify-between items-center text-slate-950 my-3 py-1">
            <span className="text-[16px] font-black font-mono">
              {invoice.total.toLocaleString("ar-EG")} ج.م
            </span>
            <span className="text-xs font-black">الإجمالي المطلوب:</span>
          </div>

          {/* Split payment breakdown box placed directly after total */}
          {invoice.splitPayments && invoice.splitPayments.length > 0 && (
            <div className="bg-slate-50 border border-slate-300 p-3 rounded-xl space-y-1.5 my-2">
              <div className="text-center font-black text-[11.5px] text-slate-900 border-b border-dashed border-slate-300 pb-1">
                🔀 تفاصيل تجزئة الدفع
              </div>
              {invoice.splitPayments.map((sp, idx) => (
                <div key={idx} className="flex justify-between items-center text-xs font-bold text-slate-800">
                  <span className="font-black text-slate-950 font-mono">{Number(sp.amount).toLocaleString("ar-EG")} ج.م</span>
                  <span>• {sp.method}:</span>
                </div>
              ))}
            </div>
          )}

          {/* Dotted/Dashed Line */}
          <div className="border-t-2 border-dashed border-slate-900 my-3" />

          {/* DUAL CONTACT PHONE NUMBERS BOX */}
          <div className="border border-slate-950 bg-white p-2.5 rounded-xl text-center space-y-1 my-3">
            <span className="text-xs text-slate-950 font-black tracking-wide block">للتواصل:</span>
            <div className="flex items-center justify-center gap-2 text-xs font-mono font-black text-slate-950 tracking-normal">
              <span>010-0495-0713</span>
              <span className="text-slate-400">|</span>
              <span>010-2745-7070</span>
              <Phone className="w-3.5 h-3.5 text-slate-950 shrink-0 fill-slate-950 stroke-white" />
            </div>
          </div>

          {/* QR CODE SECTION AT THE BOTTOM AS REQUESTED */}
          <div className="my-3 text-center space-y-1 border border-slate-200 bg-slate-50 p-3 rounded-2xl">
            <div className="flex items-center justify-center gap-1.5 text-slate-800">
              <QrCode className="w-3.5 h-3.5 text-slate-950" />
              <span className="text-[10.5px] font-black uppercase tracking-wider font-mono">SCAN ME</span>
            </div>
            <p className="text-[9.5px] text-slate-700 font-extrabold">امسح الكود</p>
            
            {/* Crisp Dynamic QR Code with Central Star Logo */}
            <div className="bg-white p-2 rounded-xl border border-slate-200 inline-block shadow-xs">
              <QRCodeGenerator value="https://linktr.ee/Nabil_elsareaa?utm_source=qr_code" size={110} />
            </div>
          </div>

          {/* Greetings footer & bottom divider */}
          <div className="mt-4 text-center space-y-1.5">
            <p className="text-xs font-black text-slate-950">شكراً لزيارتكم معرض أنطو للأنتيكات!</p>
            <div className="pt-2">
              <div className="w-2/5 border-t-2 border-slate-950 mx-auto" />
            </div>
          </div>
          
          {/* Print safety spacer for paper roll auto-cutters */}
          <div className="h-6 w-full hidden print:block"></div>
        </div>

        {/* Footer actions bar - hidden on print */}
        <div className="p-5 bg-white border-t border-slate-100 flex flex-col sm:flex-row gap-2.5 no-print">
          <button 
            id="print-invoice-view-btn"
            onClick={() => {
              printInvoiceReceipt(invoice);
            }}
            className="flex-1 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold py-3.5 rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-[0.98]"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الفاتورة الفورية</span>
          </button>

          <button 
            onClick={handleSaveInvoiceFile}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3.5 rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-[0.98]"
          >
            <Download className="w-4 h-4" />
            <span>حفظ الفاتورة كملف</span>
          </button>

          <button 
            onClick={onClose}
            className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3.5 rounded-2xl text-xs transition-all cursor-pointer"
          >
            رجوع
          </button>
        </div>

      </div>
    </div>
  );
}
