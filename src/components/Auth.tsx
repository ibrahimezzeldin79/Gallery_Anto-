import React, { useState } from "react";
import { Store, ShieldCheck, Mail, Lock, User, Sparkles, LogIn, UserPlus, KeyRound, CheckCircle2, ArrowRight } from "lucide-react";

interface AuthProps {
  onLogin: (session: { email: string; name: string }) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const [isLoginView, setIsLoginView] = useState(true);
  const [isResetView, setIsResetView] = useState(false);
  
  // Login / Signup Form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Password Reset Flow
  const [resetStep, setResetStep] = useState<1 | 2 | 3>(1); // 1: Email, 2: OTP, 3: New Pass
  const [resetEmail, setResetEmail] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [userCodeInput, setUserCodeInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleDemoLogin = () => {
    onLogin({
      email: "demo@gallery.com",
      name: "معرض تجريبي (Gallery Demo)"
    });
  };

  const getRegisteredUsers = () => {
    const savedUsersStr = localStorage.getItem("anto_users");
    if (savedUsersStr) {
      try {
        return JSON.parse(savedUsersStr);
      } catch (err) {
        return [];
      }
    }
    return [];
  };

  const handleSendResetCode = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const normEmail = resetEmail.trim().toLowerCase();
    if (!normEmail) {
      setErrorMessage("يرجى إدخال البريد الإلكتروني.");
      return;
    }

    if (normEmail === "demo@gallery.com") {
      setErrorMessage("حساب Demo محمي. كلمة المرور الخاصة به هي demo دائماً.");
      return;
    }

    const registeredUsers = getRegisteredUsers();
    const matchUser = registeredUsers.find((u: any) => u.email === normEmail);

    if (!matchUser) {
      setErrorMessage("لم نتمكن من العثور على حساب مرتبط بهذا البريد الإلكتروني.");
      return;
    }

    // Generate random 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(code);
    setResetStep(2);
    setSuccessMessage(`تم إرسال رمز التحقق إلى ${normEmail}. (كود الاختبار السريع: ${code})`);
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (userCodeInput.trim() === generatedCode) {
      setResetStep(3);
      setSuccessMessage("تم تأكيد الكود بنجاح! يرجى تعيين كلمة المرور الجديدة.");
    } else {
      setErrorMessage("كود التحقق غير صحيح، يرجى المحاولة مرة أخرى.");
    }
  };

  const handleSetNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!newPassword || newPassword.length < 4) {
      setErrorMessage("كلمة المرور يجب أن تتكون من 4 أرقام/رموز على الأقل.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("كلمتا المرور غير متطابقتين.");
      return;
    }

    const normEmail = resetEmail.trim().toLowerCase();
    const registeredUsers = getRegisteredUsers();
    const updatedUsers = registeredUsers.map((u: any) => {
      if (u.email === normEmail) {
        return { ...u, password: newPassword };
      }
      return u;
    });

    localStorage.setItem("anto_users", JSON.stringify(updatedUsers));
    setSuccessMessage("تم تغيير كلمة المرور بنجاح! جاري توجيهك لتسجيل الدخول...");

    setTimeout(() => {
      setIsResetView(false);
      setIsLoginView(true);
      setEmail(normEmail);
      setPassword(newPassword);
      setResetStep(1);
      setResetEmail("");
      setGeneratedCode("");
      setUserCodeInput("");
      setNewPassword("");
      setConfirmPassword("");
    }, 1500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMessage("من فضلك املأ كافة الحقول المطلوبة.");
      return;
    }

    const registeredUsers = getRegisteredUsers();

    if (isLoginView) {
      // 1. LOGIN LOGIC
      if (normalizedEmail === "demo@gallery.com" && password === "demo") {
        onLogin({ email: "demo@gallery.com", name: "معرض تجريبي (Gallery Demo)" });
        return;
      }

      const matchUser = registeredUsers.find(
        (u: any) => u.email === normalizedEmail && u.password === password
      );

      if (matchUser) {
        onLogin({ email: matchUser.email, name: matchUser.name });
      } else {
        setErrorMessage("البريد الإلكتروني أو كلمة المرور غير صحيحة.");
      }
    } else {
      // 2. SIGNUP LOGIC
      if (!name.trim()) {
        setErrorMessage("يرجى إدخال اسم المعرض أو التاجر.");
        return;
      }

      if (normalizedEmail === "demo@gallery.com") {
        setErrorMessage("هذا البريد الإلكتروني محجوز ومخصص للحساب التجريبي فقط.");
        return;
      }

      const userExists = registeredUsers.some((u: any) => u.email === normalizedEmail);
      if (userExists) {
        setErrorMessage("هذا البريد الإلكتروني مسجل بالفعل لديهم حساب سابقاً.");
        return;
      }

      const newUser = {
        name: name.trim(),
        email: normalizedEmail,
        password: password
      };

      const updatedUsers = [...registeredUsers, newUser];
      localStorage.setItem("anto_users", JSON.stringify(updatedUsers));
      
      setSuccessMessage("تم إنشاء الحساب بنجاح! جاري تسجيل دخولك التلقائي...");
      
      setTimeout(() => {
        onLogin({ email: newUser.email, name: newUser.name });
      }, 1500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-955 flex items-center justify-center p-4 relative overflow-hidden" style={{ backgroundColor: '#0f172a' }} dir="rtl">
      {/* Decorative ambient blurred nodes */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -ml-20 -mb-20"></div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative z-10 animate-scaleUp">
        {/* Brand Banner */}
        <div className="p-8 text-center bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-b border-slate-800/50">
          <div className="w-16 h-16 bg-gradient-to-b from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/10">
            <Store className="w-8 h-8 text-slate-950" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">معرض <span className="text-amber-400">Gallery Anto</span></h1>
          <p className="text-slate-400 text-xs mt-2">نظام جرد المحلات، فواتير المبيعات ونقط البيع المتكاملة</p>
        </div>

        {/* Dynamic Auth Body */}
        <div className="p-8 space-y-6">
          {!isResetView ? (
            <>
              <div className="flex border-b border-slate-800 p-1 bg-slate-950/60 rounded-xl">
                <button
                  onClick={() => {
                    setIsLoginView(true);
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    isLoginView 
                      ? "bg-amber-500 text-slate-950 shadow-md" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  <span>تسجيل الدخول</span>
                </button>
                <button
                  onClick={() => {
                    setIsLoginView(false);
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    !isLoginView 
                      ? "bg-amber-500 text-slate-950 shadow-md" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <UserPlus className="w-4 h-4" />
                  <span>إنشاء حساب جديد</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {errorMessage && (
                  <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3.5 rounded-xl text-xs font-bold leading-relaxed">
                    {errorMessage}
                  </div>
                )}

                {successMessage && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3.5 rounded-xl text-xs font-bold leading-relaxed">
                    {successMessage}
                  </div>
                )}

                {!isLoginView && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">اسم المعرض أو المتجر</label>
                    <div className="relative">
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                        <User className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="مثال: معرض الرواد للأثاث"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pr-10 pl-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 block">البريد الإلكتروني</label>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                      <Mail className="w-4 h-4" />
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="name@store.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pr-10 pl-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-300 block">كلمة المرور</label>
                    {isLoginView && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsResetView(true);
                          setResetStep(1);
                          setErrorMessage("");
                          setSuccessMessage("");
                          setResetEmail(email);
                        }}
                        className="text-[11px] text-amber-400 hover:text-amber-300 font-bold hover:underline cursor-pointer"
                      >
                        نسيت كلمة المرور؟
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                      <Lock className="w-4 h-4" />
                    </span>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pr-10 pl-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-slate-950 font-bold py-3.5 rounded-xl text-xs shadow-lg transition-all active:scale-[0.98] cursor-pointer text-center mt-2"
                >
                  {isLoginView ? "تسجيل الدخول المباشر" : "إنشاء الحساب وبدء التشغيل الجديد"}
                </button>
              </form>
            </>
          ) : (
            /* PASSWORD RESET WORKFLOW */
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-amber-400 text-sm font-extrabold">
                  <KeyRound className="w-4 h-4" />
                  <span>استعادة كلمة المرور عبر الإيميل</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsResetView(false);
                    setErrorMessage("");
                    setSuccessMessage("");
                  }}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>العودة</span>
                </button>
              </div>

              {errorMessage && (
                <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3.5 rounded-xl text-xs font-bold leading-relaxed">
                  {errorMessage}
                </div>
              )}

              {successMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3.5 rounded-xl text-xs font-bold leading-relaxed">
                  {successMessage}
                </div>
              )}

              {resetStep === 1 && (
                <form onSubmit={handleSendResetCode} className="space-y-4">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    أدخل بريدك الإلكتروني المسجل في النظام، وسنقوم بإنشاء وإرسال كود تحقق خاص لإعادة تعيين كلمة المرور.
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">البريد الإلكتروني المسجل</label>
                    <div className="relative">
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                        <Mail className="w-4 h-4" />
                      </span>
                      <input
                        type="email"
                        required
                        placeholder="name@store.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full pr-10 pl-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 rounded-xl text-xs shadow-md transition-all cursor-pointer"
                  >
                    إرسال كود التحقق الإيميل
                  </button>
                </form>
              )}

              {resetStep === 2 && (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    أدخل كود التحقق المكون من 6 أرقام للبريد <strong>{resetEmail}</strong>:
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">رمز التحقق (6 أرقام)</label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      placeholder="مثال: 849201"
                      value={userCodeInput}
                      onChange={(e) => setUserCodeInput(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 text-white text-center font-mono tracking-widest text-lg font-black rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black py-3 rounded-xl text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد رمز التحقق</span>
                  </button>
                </form>
              )}

              {resetStep === 3 && (
                <form onSubmit={handleSetNewPassword} className="space-y-4">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    أدخل كلمة المرور الجديدة الخاصة بحسابك:
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">كلمة المرور الجديدة</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">تأكيد كلمة المرور الجديدة</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 rounded-xl text-xs shadow-md transition-all cursor-pointer"
                  >
                    حفظ كلمة المرور الجديدة وتسجيل الدخول
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Prompt quick demo options */}
          <div className="border-t border-slate-800/80 pt-6 text-center space-y-3">
            <span className="text-[11px] text-slate-500 block">هل تود تجربة النظام السحابي بمعاينة كاملة أولاً؟</span>
            <button
              type="button"
              onClick={handleDemoLogin}
              className="w-full py-2.5 bg-slate-800/30 border border-slate-800 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>الدخول بالحساب التجريبي (مسبق البيانات)</span>
            </button>
          </div>
        </div>

        {/* Micro policy note */}
        <div className="bg-slate-950/40 p-4 border-t border-slate-800 text-center flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-amber-500/80" />
          <span>حماية البيانات والخصوصية مشفرة محلياً ورقمياً بالكامل</span>
        </div>
      </div>
    </div>
  );
}
