import React, { useState, useEffect } from "react";
import { Settings, Lock, CheckCircle2, AlertCircle, ShieldCheck, Type, Database, Download, RefreshCw, HardDrive, Network, Play, Square, Link, Unplug, Send } from "lucide-react";
import { dbApi } from "../utils/databaseApi";
import { LanStatus, UpdaterStatus } from "../types";

interface SettingsProps {
  currentPassword?: string;
  onUpdatePassword?: (newPass: string) => void;
  deletionPassword?: string;
  onUpdateDeletionPassword?: (newPass: string) => void;
  fontScale?: string;
  onUpdateFontScale?: (scale: string) => void;
}

export default function SettingsComponent({ 
  currentPassword = "7070", 
  onUpdatePassword,
  deletionPassword = "0000",
  onUpdateDeletionPassword,
  fontScale = "normal",
  onUpdateFontScale
}: SettingsProps) {
  // Section 1: General lock password
  const [currentInput, setCurrentInput] = useState("");
  const [newInput, setNewInput] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Section 2: Invoice deletion password
  const [delCurrentInput, setDelCurrentInput] = useState("");
  const [delNewInput, setDelNewInput] = useState("");
  const [delConfirmInput, setDelConfirmInput] = useState("");
  const [delSuccessMsg, setDelSuccessMsg] = useState("");
  const [delErrorMsg, setDelErrorMsg] = useState("");

  // Section 3: Backup & Restore states
  const [backupsList, setBackupsList] = useState<string[]>([]);
  const [backupStatus, setBackupStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [isBackupLoading, setIsBackupLoading] = useState(false);

  // Section 4: LAN connectivity test only. This section never calls business APIs.
  const [lanAddresses, setLanAddresses] = useState<string[]>([]);
  const [lanStatus, setLanStatus] = useState<LanStatus>({
    mode: "stopped",
    connected: false,
    peerCount: 0,
    lastTestMessage: null,
    lastError: null,
    connectionInfo: null
  });
  const [lanPairingCode, setLanPairingCode] = useState("");
  const [lanPairingExpiresAt, setLanPairingExpiresAt] = useState<number | null>(null);
  const [lanHostIp, setLanHostIp] = useState("");
  const [lanHostPort, setLanHostPort] = useState("");
  const [lanClientCode, setLanClientCode] = useState("");
  const [lanMessage, setLanMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lanLoading, setLanLoading] = useState(false);
  const [lanClock, setLanClock] = useState(Date.now());
  const [lanTestConfirmed, setLanTestConfirmed] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<UpdaterStatus>({
    state: "idle",
    currentVersion: "-",
    availableVersion: null,
    progress: 0,
    error: null,
    providerConfigured: false
  });

  const loadBackupsList = async () => {
    try {
      if (!dbApi.backups?.listBackups) {
        setBackupsList([]);
        return;
      }
      const list = await dbApi.backups.listBackups();
      const normalized: string[] = Array.isArray(list)
        ? list.map((item: any) => (typeof item === "string" ? item : item?.name || item?.filename || JSON.stringify(item)))
        : [];
      setBackupsList(normalized);
    } catch (e) {
      console.error("Failed to load backups list:", e);
      setBackupsList([]);
    }
  };

  useEffect(() => {
    loadBackupsList();
    dbApi.lan.getPrivateAddresses().then(setLanAddresses).catch(() => setLanAddresses([]));
    dbApi.updater.getStatus().then(setUpdateStatus).catch(() => {});
    const removeUpdaterListener = dbApi.updater.onStatus(setUpdateStatus);
    return removeUpdaterListener;
  }, []);

  const handleCheckForUpdates = async () => {
    try {
      setUpdateStatus((current) => ({ ...current, state: "checking", error: null }));
      setUpdateStatus(await dbApi.updater.check());
    } catch (error: any) {
      setUpdateStatus((current) => ({ ...current, state: "error", error: error.message || "تعذر التحقق من التحديثات." }));
    }
  };

  const handleDownloadUpdate = async () => {
    try {
      setUpdateStatus(await dbApi.updater.download());
    } catch (error: any) {
      setUpdateStatus((current) => ({ ...current, state: "error", error: error.message || "تعذر تنزيل التحديث." }));
    }
  };

  const handleInstallUpdate = async () => {
    try {
      await dbApi.updater.install();
    } catch (error: any) {
      setUpdateStatus((current) => ({ ...current, state: "error", error: error.message || "تعذر تثبيت التحديث." }));
    }
  };

  const updateStatusLabel = {
    idle: "جاهز للتحقق",
    checking: "جارٍ التحقق...",
    available: `يتوفر تحديث${updateStatus.availableVersion ? `: ${updateStatus.availableVersion}` : ""}`,
    "not-available": "أنت تستخدم أحدث إصدار.",
    downloading: `جارٍ تنزيل التحديث: ${Math.round(updateStatus.progress)}%`,
    downloaded: "تم تنزيل التحديث وهو جاهز للتثبيت.",
    installing: "جارٍ تجهيز إعادة التشغيل...",
    error: updateStatus.error || "حدث خطأ أثناء التحديث."
  }[updateStatus.state];

  useEffect(() => {
    if (!lanPairingExpiresAt) return;
    const timer = window.setInterval(() => setLanClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [lanPairingExpiresAt]);

  useEffect(() => {
    if (lanStatus.mode === "stopped") return;
    const timer = window.setInterval(async () => {
      try {
        const status = await dbApi.lan.getStatus();
        setLanStatus(status);
        const testId = (status.lastTestMessage as { testId?: string } | null)?.testId;
        if (testId) setLanTestConfirmed(await dbApi.lan.confirmTestMessage(testId));
      } catch (error) {
        // The explicit LAN action will surface actionable errors to the user.
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lanStatus.mode]);

  const refreshLanStatus = async () => {
    const status = await dbApi.lan.getStatus();
    setLanStatus(status);
    return status;
  };

  const handleStartLanHost = async () => {
    setLanLoading(true);
    setLanMessage(null);
    try {
      const status = await dbApi.lan.startHost({ port: 0 });
      setLanStatus(status);
      setLanMessage({ type: "success", text: "تم تشغيل مضيف LAN للاختبار فقط." });
    } catch (error: any) {
      setLanMessage({ type: "error", text: error.message || "تعذر تشغيل مضيف LAN." });
    } finally {
      setLanLoading(false);
    }
  };

  const handleStopLanHost = async () => {
    setLanLoading(true);
    setLanMessage(null);
    try {
      setLanStatus(await dbApi.lan.stopHost());
      setLanPairingCode("");
      setLanPairingExpiresAt(null);
      setLanMessage({ type: "success", text: "تم إيقاف مضيف LAN." });
    } catch (error: any) {
      setLanMessage({ type: "error", text: error.message || "تعذر إيقاف مضيف LAN." });
    } finally {
      setLanLoading(false);
    }
  };

  const handleCreatePairingCode = async () => {
    setLanMessage(null);
    try {
      const result = await dbApi.lan.createPairingCode();
      setLanPairingCode(result.code);
      setLanPairingExpiresAt(result.expiresAt);
      setLanMessage({ type: "success", text: "تم إنشاء كود اقتران مؤقت." });
    } catch (error: any) {
      setLanMessage({ type: "error", text: error.message || "تعذر إنشاء كود الاقتران." });
    }
  };

  const handleConnectLanClient = async () => {
    setLanLoading(true);
    setLanMessage(null);
    try {
      const status = await dbApi.lan.connect({
        host: lanHostIp.trim(),
        port: Number(lanHostPort),
        pairingCode: lanClientCode.trim()
      });
      setLanStatus(status);
      setLanTestConfirmed(false);
      setLanMessage({ type: "success", text: "تم الاتصال بمضيف LAN." });
    } catch (error: any) {
      setLanMessage({ type: "error", text: error.message || "تعذر الاتصال بمضيف LAN." });
    } finally {
      setLanLoading(false);
    }
  };

  const handleDisconnectLanClient = async () => {
    setLanLoading(true);
    setLanMessage(null);
    try {
      setLanStatus(await dbApi.lan.disconnect());
      setLanTestConfirmed(false);
      setLanMessage({ type: "success", text: "تم قطع اتصال LAN." });
    } catch (error: any) {
      setLanMessage({ type: "error", text: error.message || "تعذر قطع اتصال LAN." });
    } finally {
      setLanLoading(false);
    }
  };

  const handleSendLanTestMessage = async () => {
    setLanLoading(true);
    setLanMessage(null);
    try {
      const acknowledgement: any = await dbApi.lan.sendTestMessage({
        source: "Gallery ANTO LAN Test Panel"
      });
      await refreshLanStatus();
      setLanMessage({
        type: "success",
        text: acknowledgement?.status === "received" ? "تم استلام ACK من الجهاز الآخر." : "تم إرسال رسالة الاختبار."
      });
    } catch (error: any) {
      setLanMessage({ type: "error", text: error.message || "تعذر إرسال رسالة الاختبار." });
    } finally {
      setLanLoading(false);
    }
  };

  const pairingIsActive = Boolean(lanPairingCode && lanPairingExpiresAt && lanPairingExpiresAt > lanClock);
  const receivedTestMessage = lanStatus.lastTestMessage as { testId?: string; payload?: { testOnly?: boolean } } | null;

  const handleCreateBackup = async () => {
    setIsBackupLoading(true);
    setBackupStatus(null);
    try {
      const res = await dbApi.backups.createBackup();
      if (res.success) {
        setBackupStatus({ type: "success", msg: `🎉 تم إنشاء النسخة الاحتياطية بنجاح بنظام SQLite والصور (${res.filename})` });
        await loadBackupsList();
      } else {
        setBackupStatus({ type: "error", msg: `⚠️ فشل إنشاء النسخة الاحتياطية: ${res.error}` });
      }
    } catch (err: any) {
      setBackupStatus({ type: "error", msg: `⚠️ خطأ أثناء أخذ النسخة: ${err.message || err}` });
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleRestoreBackup = async (backupName: string) => {
    if (!confirm(`هل أنت ألكيد من استعادة النسخة الاحتياطية (${backupName})؟\nسيتم أخذ نسخة أمان تلقائية قبل البدء.`)) {
      return;
    }
    setIsBackupLoading(true);
    setBackupStatus(null);
    try {
      const res = await dbApi.backups.restoreBackup(backupName);
      if (res.success) {
        setBackupStatus({ type: "success", msg: "🎉 تم استعادة البيانات والملفات بنجاح! سيتم إعادة تحميل البرنامج..." });
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setBackupStatus({ type: "error", msg: `⚠️ فشل استعادة النسخة الاحتياطية: ${res.error}` });
      }
    } catch (err: any) {
      setBackupStatus({ type: "error", msg: `⚠️ خطأ أثناء الاستعادة: ${err.message || err}` });
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg("");
    setErrorMsg("");

    if (currentInput !== currentPassword) {
      setErrorMsg("⚠️ كلمة المرور الحالية غير صحيحة.");
      return;
    }

    if (newInput.trim() === "") {
      setErrorMsg("⚠️ يرجى إدخال كلمة مرور جديدة صالحة.");
      return;
    }

    if (newInput !== confirmInput) {
      setErrorMsg("⚠️ كلمة المرور الجديدة وتأكيدها لا يتطابقان.");
      return;
    }

    if (newInput.length >= 4) {
      onUpdatePassword(newInput);
      setSuccessMsg("🎉 تم تغيير كلمة المرور العامة لحماية الصفحات بنجاح!");
      setCurrentInput("");
      setNewInput("");
      setConfirmInput("");
    } else {
      setErrorMsg("⚠️ يرجى إدخال كلمة مرور مكونة من 4 أرقام أو أحرف على الأقل.");
    }
  };

  const handleDelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDelSuccessMsg("");
    setDelErrorMsg("");

    if (delCurrentInput !== deletionPassword) {
      setDelErrorMsg("⚠️ كلمة مرور حذف الفواتير الحالية غير صحيحة.");
      return;
    }

    if (delNewInput.trim() === "") {
      setDelErrorMsg("⚠️ يرجى إدخال كلمة مرور جديدة صالحة.");
      return;
    }

    if (delNewInput !== delConfirmInput) {
      setDelErrorMsg("⚠️ كلمة مرور الحذف الجديدة وتأكيدها غير متطابقين.");
      return;
    }

    if (delNewInput.length >= 4) {
      onUpdateDeletionPassword(delNewInput);
      setDelSuccessMsg("🎉 تم تغيير كلمة مرور إلغاء الفواتير بنجاح!");
      setDelCurrentInput("");
      setDelNewInput("");
      setDelConfirmInput("");
    } else {
      setDelErrorMsg("⚠️ يرجى إدخال كلمة مرور مكونة من 4 أرقام على الأقل لزيادة الأمان.");
    }
  };

  return (
    <div className="space-y-8 max-w-2xl mx-auto animate-fadeIn" dir="rtl">
      
      {/* settings info header */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-md space-y-3">
        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-slate-800" />
          <span>إعدادات النظام والأمان الفني</span>
        </h2>
        <p className="text-sm font-bold text-slate-600 leading-relaxed">
          تخصيص مستويات الحماية وتغيير كلمة المرور الإدارية والتحكم بكود إلغاء الفواتير لـ <strong className="text-slate-900 underline decoration-amber-500 decoration-2">Gallery Anto</strong>.
        </p>
      </div>

      {/* ACCESSIBILITY SECTION: Font Size Scaling (تكبير حجم الخط لضعاف البصر) */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-md space-y-6">
        <div className="border-b border-slate-200 pb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Type className="w-5 h-5 text-indigo-650" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">مُعامل تكبير حجم الخط (خيار تيسير القراءة لضعاف البصر)</h3>
            <p className="text-xs font-bold text-slate-500 mt-1">تسهيل القراء بكافة شاشات وأزرار البرنامج فوراً للتسهيل على العمال ضعاف النظر وكبار السن.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          {[
            { id: "normal", name: "حجم عادي (افتراضي)", desc: "قياسي (100%)", style: "text-sm font-semibold" },
            { id: "large", name: "خط كبير إضافي", desc: "تكبير مريح (+10%)", style: "text-base font-bold" },
            { id: "xlarge", name: "خط جليّ جداً", desc: "قراءة سهلة (+18%)", style: "text-lg font-black" },
            { id: "xxlarge", name: "حجم ضخم (جمبو)", desc: "للضعف الشديد (+30%)", style: "text-xl font-black" },
          ].map((item) => {
            const isScaleActive = fontScale === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onUpdateFontScale(item.id)}
                className={`p-5 rounded-2xl border text-center transition-all flex flex-col justify-between items-center gap-2 cursor-pointer active:scale-95 min-h-[110px] ${
                  isScaleActive
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/15 font-black"
                    : "bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100 hover:text-indigo-900"
                }`}
              >
                <span className={`block leading-tight select-none ${item.style}`}>
                  أب ت ث
                </span>
                <span className="block text-[11px] font-black opacity-95 truncate mt-1">
                  {item.name}
                </span>
                <span className={`block text-[9px] font-bold ${isScaleActive ? "text-indigo-150" : "text-slate-450"}`}>
                  {item.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* APPLICATION UPDATES */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-md space-y-5">
        <div className="border-b border-slate-200 pb-4 flex items-center gap-3">
          <RefreshCw className="w-6 h-6 text-sky-600" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">تحديثات التطبيق</h3>
            <p className="text-xs font-bold text-slate-500 mt-1">يتم تنزيل التحديث في الخلفية ولا يتم تثبيته إلا بعد اختيار إعادة التشغيل.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="space-y-1 text-xs font-bold text-slate-700">
            <p>الإصدار الحالي: <span dir="ltr" className="font-mono font-black text-slate-900">v{updateStatus.currentVersion}</span></p>
            <p>الحالة: <span className={updateStatus.state === "error" ? "text-rose-600" : "text-slate-900"}>{updateStatusLabel}</span></p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleCheckForUpdates} disabled={updateStatus.state === "checking" || updateStatus.state === "downloading" || updateStatus.state === "installing"} className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black disabled:opacity-50">
              تحقق من التحديثات
            </button>
            {updateStatus.state === "available" && (
              <button type="button" onClick={handleDownloadUpdate} className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black">
                تنزيل التحديث
              </button>
            )}
            {updateStatus.state === "downloaded" && (
              <button type="button" onClick={handleInstallUpdate} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black">
                إعادة التشغيل والتثبيت
              </button>
            )}
          </div>
        </div>
        {!updateStatus.providerConfigured && (
          <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">مزود التحديث غير مضبوط بعد. يلزم ربط مستودع GitHub حقيقي قبل النشر.</p>
        )}
      </div>

      {/* SECTION 1: General Code Password */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-md space-y-6">
        <div className="border-b border-slate-200 pb-4 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">1. كلمة المرور العامة للمشرفين (حماية الصفحات والأقسام)</h3>
            <p className="text-xs font-bold text-slate-500 mt-1">تُستخدم لحماية وعرض المصروفات اليومية، التقارير المالية، المبيعات والعمال، والمخزون والجرد.</p>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2 border border-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs uppercase font-extrabold text-slate-700 block">كلمة المرور الحالية</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="أدخل كلمة المرور العامة الفعّالة..."
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl text-right text-sm font-mono font-black text-slate-900 py-3 pl-3 pr-10 focus:ring-2 focus:ring-blue-500/15 focus:outline-none focus:border-blue-500 transition-all placeholder-slate-400"
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase font-extrabold text-slate-700 block">كلمة المرور الجديدة</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="أدخل الرمز السري الجديد لغلق الصفحات..."
                  value={newInput}
                  onChange={(e) => setNewInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl text-right text-sm font-mono font-black text-slate-900 py-3 pl-3 pr-10 focus:ring-2 focus:ring-blue-500/15 focus:outline-none focus:border-blue-500 transition-all placeholder-slate-400"
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase font-extrabold text-slate-700 block">تأكيد كلمة المرور الجديدة</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="أعد كتابة الرمز الجديد للتأكيد..."
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl text-right text-sm font-mono font-black text-slate-900 py-3 pl-3 pr-10 focus:ring-2 focus:ring-blue-500/15 focus:outline-none focus:border-blue-500 transition-all placeholder-slate-400"
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
              </div>
            </div>

          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full md:w-auto px-7 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg active:scale-[0.98]"
            >
              حفظ كلمة المرور العامة للمشرفين
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: Invoice Deletion Code Password */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-md space-y-6">
        <div className="border-b border-slate-200 pb-4 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-amber-600" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">2. كلمة مرور إلغاء وحذف الفواتير (كود الحذف الخاص)</h3>
            <p className="text-xs font-bold text-slate-500 mt-1">تُستخدم حصراً من قبل رئيس المعرض للسماح للكاشير بإلغاء الفواتير وحذف المبيعات.</p>
          </div>
        </div>

        {delErrorMsg && (
          <div className="p-4 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2 border border-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{delErrorMsg}</span>
          </div>
        )}

        {delSuccessMsg && (
          <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold flex items-center gap-2 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{delSuccessMsg}</span>
          </div>
        )}

        <form onSubmit={handleDelSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className="space-y-1.5 col-span-2">
              <label className="text-xs uppercase font-extrabold text-slate-700 block">كلمة مرور الحذف الحالية</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="أدخل كود إلغاء الفواتير الحالي..."
                  value={delCurrentInput}
                  onChange={(e) => setDelCurrentInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl text-right text-sm font-mono font-black text-slate-900 py-3 pl-3 pr-10 focus:ring-2 focus:ring-amber-500/15 focus:outline-none focus:border-amber-500 transition-all placeholder-slate-400"
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase font-extrabold text-slate-700 block">كلمة مرور الحذف الجديدة</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="أدخل كود الحذف الجديد (مثال: 0000)..."
                  value={delNewInput}
                  onChange={(e) => setDelNewInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl text-right text-sm font-mono font-black text-slate-900 py-3 pl-3 pr-10 focus:ring-2 focus:ring-amber-500/15 focus:outline-none focus:border-amber-500 transition-all placeholder-slate-400"
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs uppercase font-extrabold text-slate-700 block">تأكيد كلمة مرور الحذف الجديدة</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="أعد إدخال كود الحذف التأكيدي..."
                  value={delConfirmInput}
                  onChange={(e) => setDelConfirmInput(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl text-right text-sm font-mono font-black text-slate-900 py-3 pl-3 pr-10 focus:ring-2 focus:ring-amber-500/15 focus:outline-none focus:border-amber-500 transition-all placeholder-slate-400"
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
              </div>
            </div>

          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full md:w-auto px-7 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg active:scale-[0.98]"
            >
              حفظ كود إلغاء الفواتير الجديد (مستقل)
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 3: SQLite Database Backup & Restore */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-md space-y-6">
        <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-emerald-600" />
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">3. النسخ الاحتياطي والاستعادة الذكية (SQLite & Images)</h3>
              <p className="text-xs font-bold text-slate-500 mt-1">حفظ واسترجاع كافة بيانات المبيعات والمخزون وصور المنتجات بضغط زر واحدة.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadBackupsList}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            title="تحديث قائمة النسخ الاحتياطية"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {backupStatus && (
          <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 border ${
            backupStatus.type === "success" 
              ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}>
            {backupStatus.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{backupStatus.msg}</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200/80">
            <div>
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-emerald-600" />
                <span>إنشاء نسخة احتياطية جديدة الآن</span>
              </h4>
              <p className="text-[11px] text-slate-500 font-bold mt-0.5">يتم نسخ ملف قاعدة البيانات sqlite مع مجلد الصور بأمان كامل.</p>
            </div>
            <button
              type="button"
              disabled={isBackupLoading}
              onClick={handleCreateBackup}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md flex items-center gap-2 shrink-0 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>أخذ نسخة احتياطية</span>
            </button>
          </div>

          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-black text-slate-800">قائمة النسخ المحفوظة على هذا الجهاز:</h4>
            {backupsList.length === 0 ? (
              <p className="text-xs text-slate-400 font-bold bg-slate-50 p-4 rounded-xl border border-slate-150 text-center">
                لا توجد نسخ احتياطية سابقة محفوظة. اضغط على أخذ نسخة احتياطية بالأعلى للبدء.
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {backupsList.map((bName) => (
                  <div key={bName} className="flex justify-between items-center bg-white p-3.5 rounded-xl border border-slate-200 text-xs font-mono font-bold hover:border-emerald-300 transition-all">
                    <span className="text-slate-800 text-[11px]">{bName}</span>
                    <button
                      type="button"
                      disabled={isBackupLoading}
                      onClick={() => handleRestoreBackup(bName)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-lg text-[11px] font-black transition-all cursor-pointer border border-slate-800 disabled:opacity-50"
                    >
                      استعادة هذه النسخة
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: LAN Connectivity Test Only */}
      <div className="bg-white p-7 rounded-3xl border border-slate-200 shadow-md space-y-6">
        <div className="border-b border-slate-200 pb-4 flex items-center gap-3">
          <Network className="w-6 h-6 text-sky-600" />
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">4. اختبار اتصال LAN</h3>
            <p className="text-xs font-bold text-slate-500 mt-1">اختبار اتصال فقط بين جهازين على الشبكة المحلية. لا تتم مزامنة أي بيانات مبيعات أو مخزون.</p>
          </div>
        </div>

        {lanMessage && (
          <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 border ${
            lanMessage.type === "success"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-rose-50 text-rose-700 border-rose-200"
          }`}>
            {lanMessage.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{lanMessage.text}</span>
          </div>
        )}

        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold">
          اختبار آمن فقط: الرسائل موسومة test-only، والنقل التجاري معطل بالكامل.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Play className="w-5 h-5 text-sky-600" />
              <h4 className="text-sm font-black text-slate-800">Host Mode</h4>
            </div>
            <div className="text-xs font-bold text-slate-600 space-y-1">
              <p>الحالة: <span className="font-black text-slate-900">{lanStatus.mode === "host" ? (lanStatus.connected ? "متصل بجهاز" : "يستمع") : "متوقف"}</span></p>
              <p>العناوين المحلية: <span dir="ltr" className="font-mono text-slate-900">{lanAddresses.length > 0 ? lanAddresses.join(", ") : "لا توجد"}</span></p>
              <p>المنفذ: <span dir="ltr" className="font-mono text-slate-900">{lanStatus.connectionInfo?.mode === "host" ? lanStatus.connectionInfo.port : "-"}</span></p>
              <p>الأجهزة المتصلة: <span className="font-black text-slate-900">{lanStatus.peerCount}</span></p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={lanLoading || lanStatus.mode === "host"} onClick={handleStartLanHost} className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black flex items-center gap-2 disabled:opacity-50">
                <Play className="w-4 h-4" /> Start Host
              </button>
              <button type="button" disabled={lanLoading || lanStatus.mode !== "host"} onClick={handleStopLanHost} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black flex items-center gap-2 disabled:opacity-50">
                <Square className="w-4 h-4" /> Stop Host
              </button>
              <button type="button" disabled={lanStatus.mode !== "host"} onClick={handleCreatePairingCode} className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 disabled:opacity-50">
                <Link className="w-4 h-4" /> Create Pairing Code
              </button>
            </div>
            <div className="rounded-xl bg-white border border-slate-200 p-4 text-center">
              <p className="text-[11px] font-black text-slate-500">Pairing code</p>
              <p dir="ltr" className="font-mono text-2xl font-black tracking-[0.35em] text-slate-900 min-h-[34px]">{lanPairingCode || "------"}</p>
              <p className={`text-[11px] font-bold ${pairingIsActive ? "text-emerald-600" : "text-slate-400"}`}>
                {pairingIsActive ? `فعال حتى ${new Date(lanPairingExpiresAt!).toLocaleTimeString("ar-EG")}` : "غير فعال"}
              </p>
            </div>
            {lanStatus.mode === "host" && lanStatus.connected && (
              <button type="button" disabled={lanLoading} onClick={handleSendLanTestMessage} className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50">
                <Send className="w-4 h-4" /> Send Test Message
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Link className="w-5 h-5 text-indigo-600" />
              <h4 className="text-sm font-black text-slate-800">Client Mode</h4>
            </div>
            <div className="space-y-3">
              <label className="block text-xs font-black text-slate-700">Host IP address
                <input value={lanHostIp} onChange={(e) => setLanHostIp(e.target.value)} placeholder="192.168.1.10" dir="ltr" className="mt-1 w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-sky-500" />
              </label>
              <label className="block text-xs font-black text-slate-700">Host port
                <input value={lanHostPort} onChange={(e) => setLanHostPort(e.target.value)} placeholder="مثال: 42000" inputMode="numeric" dir="ltr" className="mt-1 w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-sky-500" />
              </label>
              <label className="block text-xs font-black text-slate-700">Pairing code
                <input value={lanClientCode} onChange={(e) => setLanClientCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" maxLength={6} dir="ltr" className="mt-1 w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-mono font-black tracking-[0.25em] text-slate-900 focus:outline-none focus:border-sky-500" />
              </label>
            </div>
            <p className="text-xs font-bold text-slate-600">الحالة: <span className="font-black text-slate-900">{lanStatus.mode === "client" && lanStatus.connected ? "متصل" : "غير متصل"}</span></p>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={lanLoading || lanStatus.connected} onClick={handleConnectLanClient} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2 disabled:opacity-50">
                <Link className="w-4 h-4" /> Connect
              </button>
              <button type="button" disabled={lanLoading || !lanStatus.connected} onClick={handleDisconnectLanClient} className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black flex items-center gap-2 disabled:opacity-50">
                <Unplug className="w-4 h-4" /> Disconnect
              </button>
            </div>
            {receivedTestMessage?.payload?.testOnly === true && lanTestConfirmed && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
                تم استلام وتأكيد رسالة اختبار test-only من الجهاز المضيف.
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
