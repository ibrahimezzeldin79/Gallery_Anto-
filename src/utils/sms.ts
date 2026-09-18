/**
 * Real API integration for sending SMS notification using Twilio
 * When an invoice is deleted, this utility sends a notification message
 * to the specified number: 01554071498.
 */

export interface SMSSendResult {
  success: boolean;
  message: string;
  error?: string;
}

function normalizePhone(num: string): string {
  // Strip all non-digits
  const digits = num.replace(/\D/g, "");
  // To avoid any formatting quirks, Egyptian cell number comparison uses the last 10 digits
  // i.e., +201554071498 and 01554071498 will both convert to 1554071498
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

export async function sendInvoiceDeletionSMS(details: {
  invoiceNumber: string;
  total: number;
  date: string;
  time: string;
  sellerName?: string;
}): Promise<SMSSendResult> {
  const metaEnv = (import.meta as any).env || {};
  const accountSid = metaEnv.VITE_TWILIO_ACCOUNT_SID;
  const authToken = metaEnv.VITE_TWILIO_AUTH_TOKEN;
  const fromNumber = metaEnv.VITE_TWILIO_FROM_NUMBER;
  const toNumber = "+201554071498"; // User's requested phone number (Egypt country code +20)

  // Construct message text
  const messageText = `تنبيه أمان معرض جاليري أنطو: تم حذف فريضة بيع / إلغاء فاتورة رقم ${details.invoiceNumber} بقيمة ${details.total.toLocaleString("ar-EG")} ج.م في تاريخ ${details.date}، الساعة ${details.time}${details.sellerName ? ` - البائع: ${details.sellerName}` : ""}.`;

  // Log to console for audit trail
  console.log(`[SMS Audit Log] Heading to ${toNumber}: "${messageText}"`);

  if (!accountSid || !authToken || !fromNumber) {
    return {
      success: false,
      message: "لا تتوفر إعدادات Twilio SMS حالياً في البيئة المحلية. سيتم تسجيل العملية في الفحص الأمني الداخلي للمتجر.",
      error: `Missing config: Account SID: ${accountSid ? "Present" : "Missing"}, Auth Token: ${authToken ? "Present" : "Missing"}, From Number: ${fromNumber ? "Present" : "Missing"}.`
    };
  }

  // Pre-check so we do not run into Twilio code 21266 error
  const normalizedFrom = normalizePhone(fromNumber);
  const normalizedTo = normalizePhone(toNumber);

  if (normalizedFrom === normalizedTo) {
    return {
      success: false,
      message: "خطأ في الإعدادات: لا يمكن لـ Twilio إرسال رسالة إذا كان رقم هاتف المرسل (From Number) هو نفس رقم هاتف المستقبل (To Number). يرجى تعيين رقم Twilio الخاص بك كمرسل في الإعدادات وليس رقمك الشخصي.",
      error: `Twilio Error 21266: Same From/To phone number (${fromNumber} is equivalent to ${toNumber}).`
    };
  }

  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    // Twilio expects application/x-www-form-urlencoded
    const formData = new URLSearchParams();
    formData.append("To", toNumber);
    formData.append("From", fromNumber);
    formData.append("Body", messageText);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + btoa(`${accountSid}:${authToken}`),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formData.toString()
    });

    if (response.ok) {
      const data = await response.json();
      console.log("[SMS API response]", data);
      return {
        success: true,
        message: `تم إرسال رسالة SMS أمنية بنجاح إلى الرقم ${toNumber}.`
      };
    } else {
      const errorText = await response.text();
      console.error("[SMS API error response]", errorText);
      try {
        const errObj = JSON.parse(errorText);
        if (errObj.code === 21266 || String(errObj.message).toLowerCase().includes("same")) {
          return {
            success: false,
            message: "تنبيه: فشل الإرسال لأن رقم المرسل (From) في إعدادات Twilio مطابق لرقم هاتف المستلم الشخصي. يرجى التأكد من كتابة رقم Twilio الافتراضي الممنوح لك في الحساب كمرسل.",
            error: errorText
          };
        }
      } catch (e) {
        // Safe check ignore
      }
      return {
        success: false,
        message: "فشل إرسال رسالة SMS عبر سيرفر Twilio. يرجى التحقق من الرصيد والبيانات.",
        error: errorText
      };
    }
  } catch (err: any) {
    console.error("[SMS API fatal error]", err);
    return {
      success: false,
      message: "حدث خطأ غير متوقع أثناء إرسال رسالة SMS.",
      error: err?.message || String(err)
    };
  }
}
