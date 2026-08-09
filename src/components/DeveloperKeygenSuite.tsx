import React, { useState } from 'react';
import { 
  generateActivationKey, 
  generateSignedProKey, 
  generateTimedSubscriptionKey, 
  MASTER_UNIVERSAL_KEY, 
  MASTER_DEV_KEY,
  MASTER_DEVELOPER_PIN,
  MASTER_DEVELOPER_PASSWORD_EN,
  MASTER_DEVELOPER_PASSWORD,
  verifyDeveloperPassword,
  getMachineId
} from '../lib/license';
import Toast from './Toast';
import { playSuccessSound, playWarningSound } from '../lib/sound';

export default function DeveloperKeygenSuite() {
  const [targetMachineId, setTargetMachineId] = useState('');
  const [clientName, setClientName] = useState('');
  const [licenseType, setLicenseType] = useState<'pro' | 'simple' | 'timed_30' | 'timed_90' | 'timed_365'>('pro');
  const [generatedKey, setGeneratedKey] = useState('');
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);
  const [activeTab, setActiveTab] = useState<'keygen' | 'desktop' | 'mobile' | 'security'>('keygen');

  const currentMachineId = getMachineId();

  const handleGenerate = () => {
    const cleanId = targetMachineId.trim().toUpperCase();
    if (!cleanId) {
      playWarningSound();
      setToast({ message: 'يرجى إدخال معرف الجهاز (Machine ID) أولاً!', type: 'warning' });
      return;
    }

    let key = '';
    let exp: string | null = null;

    if (licenseType === 'pro') {
      key = generateSignedProKey(cleanId);
    } else if (licenseType === 'simple') {
      key = generateActivationKey(cleanId);
    } else if (licenseType === 'timed_30') {
      const res = generateTimedSubscriptionKey(cleanId, 30);
      key = res.key;
      exp = res.expiryDate;
    } else if (licenseType === 'timed_90') {
      const res = generateTimedSubscriptionKey(cleanId, 90);
      key = res.key;
      exp = res.expiryDate;
    } else if (licenseType === 'timed_365') {
      const res = generateTimedSubscriptionKey(cleanId, 365);
      key = res.key;
      exp = res.expiryDate;
    }

    setGeneratedKey(key);
    setExpiryDate(exp);
    playSuccessSound();
    setToast({ message: 'تم توليد كود التفعيل المشفر بنجاح!', type: 'success' });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    playSuccessSound();
    setToast({ message: `تم نسخ ${label} بنجاح!`, type: 'success' });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-amber-950/40 via-card to-card p-6 rounded-3xl border border-gold/30 shadow-lg">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🛠️</span>
              <h2 className="text-xl font-black text-gold">مركز المبرمج الشامل: التراخيص وحزم التطبيقات (Desktop & Mobile & Keygen)</h2>
            </div>
            <p className="text-xs text-text-dim mt-1">
              أدوات توليد الأكواد المشفرة وحزم التثبيت للتوزيع التجاري للعملاء مع أعلى درجات الحماية من القرصنة.
            </p>
          </div>

          <div className="flex gap-2">
            <a
              href="/keygen.html"
              target="_blank"
              rel="noreferrer"
              className="bg-gold hover:bg-amber-600 text-black font-black text-xs px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-md"
            >
              <span>🌐</span> فتح مولد الأكواد المستقل (Keygen Page)
            </a>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mt-6 border-t border-border pt-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('keygen')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'keygen' ? 'bg-gold text-black shadow-md' : 'bg-card2 text-text-dim hover:text-text-main'
            }`}
          >
            <span>🔑</span> توليد الأكواد والتراخيص
          </button>
          <button
            onClick={() => setActiveTab('desktop')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'desktop' ? 'bg-gold text-black shadow-md' : 'bg-card2 text-text-dim hover:text-text-main'
            }`}
          >
            <span>💻</span> حزمة الديسكتوب (Windows Setup .exe)
          </button>
          <button
            onClick={() => setActiveTab('mobile')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'mobile' ? 'bg-gold text-black shadow-md' : 'bg-card2 text-text-dim hover:text-text-main'
            }`}
          >
            <span>📱</span> حزمة الموبايل (Android APK & iOS)
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'security' ? 'bg-gold text-black shadow-md' : 'bg-card2 text-text-dim hover:text-text-main'
            }`}
          >
            <span>🛡️</span> منظومة الأمان وحماية السورس كود
          </button>
        </div>
      </div>

      {/* Tab 1: Keygen */}
      {activeTab === 'keygen' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-card p-6 rounded-3xl border border-border space-y-4">
            <h3 className="font-black text-sm text-text-main flex items-center gap-2">
              <span>⚡</span> توليد كود تفعيل مشفر لجهاز عميل
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-text-dim block mb-1">معرف جهاز العميل (Machine ID):</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={targetMachineId}
                    onChange={e => setTargetMachineId(e.target.value)}
                    placeholder="مثال: ID-K9A8B7C या ID-9823412"
                    className="flex-1 bg-card2 border border-border px-3.5 py-2 rounded-xl text-xs font-mono font-bold text-text-main outline-none focus:border-gold"
                  />
                  <button
                    type="button"
                    onClick={() => setTargetMachineId(currentMachineId)}
                    className="bg-card2 hover:bg-card border border-border text-[11px] font-bold px-3 py-2 rounded-xl text-text-dim hover:text-gold"
                  >
                    جهازي الحالي
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-text-dim block mb-1">اسم العميل / النشاط التجاري:</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    placeholder="صيدلية الأمل / سوبرماركت الفتح"
                    className="w-full bg-card2 border border-border px-3.5 py-2 rounded-xl text-xs text-text-main outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-text-dim block mb-1">نوع الترخيص ومدة الصلاحية:</label>
                  <select
                    value={licenseType}
                    onChange={e => setLicenseType(e.target.value as any)}
                    className="w-full bg-card2 border border-border px-3.5 py-2 rounded-xl text-xs text-text-main outline-none focus:border-gold"
                  >
                    <option value="pro">👑 ترخيص دائم مدى الحياة مشفر (PRO Key)</option>
                    <option value="simple">⚡ كود مباشر (KEY-ID)</option>
                    <option value="timed_30">⏱️ اشتراك شهري (30 يوماً)</option>
                    <option value="timed_90">⏱️ اشتراك ربع سنوي (90 يوماً)</option>
                    <option value="timed_365">⏱️ اشتراك سنوي (365 يوماً)</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                className="w-full bg-gold hover:bg-amber-600 text-black font-black text-xs py-3 rounded-xl transition-all shadow-md mt-2 flex items-center justify-center gap-2"
              >
                <span>⚡</span> استخراج كود التفعيل المعتمد
              </button>

              {generatedKey && (
                <div className="bg-card2 p-4 rounded-2xl border border-gold/40 space-y-3 mt-4 animate-in fade-in">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-gold">كود التفعيل الجاهز للإرسال للعميل:</span>
                    {expiryDate && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">
                        صالح حتى: {expiryDate}
                      </span>
                    )}
                  </div>

                  <div className="bg-black/60 p-3 rounded-xl border border-border text-center font-mono font-black text-sm text-green-400 select-all break-all">
                    {generatedKey}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(generatedKey, 'كود التفعيل')}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold text-xs py-2 rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <span>📋</span> نسخ كود التفعيل للواتساب
                    </button>
                    <button
                      onClick={() => {
                        const text = `🎉 مرحباً بك في MARO POS\nالعميل: ${clientName || 'المحترم'}\nكود تفعيل جهازك هو:\n${generatedKey}\n\nشكراً لثقتكم بشركتنا!`;
                        copyToClipboard(text, 'رسالة التفعيل الكاملة للعميل');
                      }}
                      className="bg-card hover:bg-border text-text-main font-bold text-xs px-4 py-2 rounded-xl transition-all"
                    >
                      نسخ رسالة كاملة
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Master Codes Sidebar */}
          <div className="bg-card p-6 rounded-3xl border border-border space-y-4">
            <h3 className="font-black text-sm text-text-main flex items-center gap-2">
              <span>🛡️</span> مفاتيح الماستر للطوارئ
            </h3>
            <p className="text-xs text-text-dim">
              هذه المفاتيح تفتح البرنامج على أي جهاز فوراً دون التقيد بمعرف الجهاز:
            </p>

            <div className="space-y-3">
              <div className="bg-card2 p-3 rounded-xl border border-border">
                <span className="text-[10px] text-gold font-bold block">الكود الشامل (Universal Master):</span>
                <span className="font-mono text-xs font-black text-text-main block mt-1 select-all">{MASTER_UNIVERSAL_KEY}</span>
                <button
                  onClick={() => copyToClipboard(MASTER_UNIVERSAL_KEY, 'كود الماستر الشامل')}
                  className="text-[10px] text-accent hover:underline mt-1.5 block font-bold"
                >
                  نسخ الكود
                </button>
              </div>

              <div className="bg-card2 p-3 rounded-xl border border-border">
                <span className="text-[10px] text-accent font-bold block">كود المبرمج (Dev Key):</span>
                <span className="font-mono text-xs font-black text-text-main block mt-1 select-all">{MASTER_DEV_KEY}</span>
                <button
                  onClick={() => copyToClipboard(MASTER_DEV_KEY, 'كود المبرمج')}
                  className="text-[10px] text-accent hover:underline mt-1.5 block font-bold"
                >
                  نسخ الكود
                </button>
              </div>

              <div className="bg-card2 p-3 rounded-xl border border-border">
                <span className="text-[10px] text-green-400 font-bold block">PIN المطور السريع:</span>
                <span className="font-mono text-xs font-black text-text-main block mt-1 select-all">{MASTER_DEVELOPER_PIN}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Desktop Packaging Guide */}
      {activeTab === 'desktop' && (
        <div className="bg-card p-6 rounded-3xl border border-border space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="text-base font-black text-gold flex items-center gap-2">
                <span>💻</span> طريقة بناء نسخة الديسكتوب وتسطيبها عند العميل (Windows Setup Installer)
              </h3>
              <p className="text-xs text-text-dim mt-1">
                تم تجهيز كافة ملفات Electron و NSIS Installer بالكامل داخل المشروع لإنشاء ملف تثبيت احترافي (.exe).
              </p>
            </div>
            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-xs px-3 py-1 rounded-full font-bold">
              Electron + NSIS Ready
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card2 p-4 rounded-2xl border border-border space-y-2">
              <span className="w-7 h-7 rounded-full bg-gold text-black font-black text-xs flex items-center justify-center">1</span>
              <h4 className="font-bold text-xs text-text-main">تنزيل المشروع على جهازك</h4>
              <p className="text-[11px] text-text-dim leading-relaxed">
                قم بتصدير المشروع أو استنساخه على جهاز الكمبيوتر الخاص بك وافتح المجلد في Terminal.
              </p>
            </div>

            <div className="bg-card2 p-4 rounded-2xl border border-border space-y-2">
              <span className="w-7 h-7 rounded-full bg-gold text-black font-black text-xs flex items-center justify-center">2</span>
              <h4 className="font-bold text-xs text-text-main">تثبيت حزم Electron و Builder</h4>
              <div className="bg-black/50 p-2 rounded-lg font-mono text-[10px] text-green-400 select-all">
                npm install --save-dev electron electron-builder
              </div>
              <p className="text-[11px] text-text-dim">
                سيقوم بتحميل محرك الويندوز لتغليف التطبيق.
              </p>
            </div>

            <div className="bg-card2 p-4 rounded-2xl border border-border space-y-2">
              <span className="w-7 h-7 rounded-full bg-gold text-black font-black text-xs flex items-center justify-center">3</span>
              <h4 className="font-bold text-xs text-text-main">توليد ملف التثبيت .exe</h4>
              <div className="bg-black/50 p-2 rounded-lg font-mono text-[10px] text-green-400 select-all">
                npx electron-builder
              </div>
              <p className="text-[11px] text-text-dim">
                ستجد ملف <code className="text-gold">MARO-POS-Setup-1.0.0.exe</code> جاهزاً داخل مجلد <code className="text-gold">dist-desktop/</code>.
              </p>
            </div>
          </div>

          <div className="bg-card2 p-5 rounded-2xl border border-border space-y-3">
            <h4 className="font-bold text-xs text-gold flex items-center gap-1.5">
              <span>🚀</span> خطوات تسطيب البرنامج على جهاز العميل:
            </h4>
            <ol className="list-decimal list-inside text-xs text-text-dim space-y-2 leading-relaxed pr-2">
              <li>انسخ ملف <strong className="text-text-main">MARO-POS-Setup-1.0.0.exe</strong> على فلاشة USB وضعه على كمبيوتر العميل.</li>
              <li>شغل ملف التثبيت، واضغط <strong>Next</strong> حتى ينتهي التثبيت، وسيتم وضع أيقونة البرنامج على سطح المكتب تلقائياً.</li>
              <li>عند فتح البرنامج لأول مرة، سيظهر معرف الجهاز <strong className="text-text-main">(Machine ID)</strong> على شاشة التفعيل.</li>
              <li>اطلب من العميل معرف جهازه أو خذه منه، وافتحه في أداة التوليد <strong className="text-gold">keygen.html</strong> واستخرج له كود التفعيل المشفر.</li>
              <li>أدخل كود التفعيل في البرنامج وسيتم فتح البرنامج بالكامل مدى الحياة لهذا الجهاز حصراً.</li>
            </ol>
          </div>
        </div>
      )}

      {/* Tab 3: Mobile Packaging Guide */}
      {activeTab === 'mobile' && (
        <div className="bg-card p-6 rounded-3xl border border-border space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="text-base font-black text-gold flex items-center gap-2">
                <span>📱</span> طريقة تحويل البرنامج لتطبيق أندرويد (APK) وآيفون (iOS)
              </h3>
              <p className="text-xs text-text-dim mt-1">
                البرنامج يدعم العمل كـ PWA فوري بدون متجر، أو تحويله لتطبيق أصلي عبر Capacitor / Android Studio.
              </p>
            </div>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs px-3 py-1 rounded-full font-bold">
              Capacitor & PWA Ready
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Method A: PWA Instant Mobile Install */}
            <div className="bg-card2 p-5 rounded-2xl border border-emerald-500/30 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <h4 className="font-bold text-sm text-emerald-400">الطريقة الأولى: التثبيت الفوري بدون متجر (PWA)</h4>
              </div>
              <p className="text-xs text-text-dim leading-relaxed">
                أسرع طريقة وأكثرها سلاسة للعملاء ولأجهزة الأندرويد والآيفون:
              </p>
              <ul className="text-xs text-text-dim space-y-2 list-disc list-inside">
                <li>افتح رابط البرنامج على متصفح الموبايل (Chrome للأندرويد أو Safari للآيفون).</li>
                <li>اضغط على خيارات المتصفح (المشاركة أو النقاط الثلاث).</li>
                <li>اختر <strong>"إضافة إلى الشاشة الرئيسية" (Add to Home Screen)</strong>.</li>
                <li>سينزل التطبيق بأيقونته كأنه تطبيق أصلي تماماً ويعمل بملء الشاشة مع حفظ البيانات محلياً.</li>
              </ul>
            </div>

            {/* Method B: Native APK Generation */}
            <div className="bg-card2 p-5 rounded-2xl border border-border space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📦</span>
                <h4 className="font-bold text-sm text-gold">الطريقة الثانية: استخراج ملف APK رسمي عبر Capacitor</h4>
              </div>
              <p className="text-xs text-text-dim leading-relaxed">
                لإنتاج ملف APK خام قابل للتوزيع والتثبيت المباشر:
              </p>
              <div className="bg-black/60 p-3 rounded-xl font-mono text-[11px] text-green-400 space-y-1 select-all">
                <div>npm install @capacitor/core @capacitor/cli @capacitor/android</div>
                <div>npx cap add android</div>
                <div>npm run build</div>
                <div>npx cap sync android</div>
                <div>npx cap open android</div>
              </div>
              <p className="text-[11px] text-text-dim">
                سيفتح Android Studio، اضغط <strong>Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</strong> لاستخراج ملف التثبيت.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Security & Anti-Piracy */}
      {activeTab === 'security' && (
        <div className="bg-card p-6 rounded-3xl border border-border space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="text-base font-black text-gold flex items-center gap-2">
                <span>🛡️</span> منظومة الحماية من السرقة وإعادة التشغيل غير المرخص
              </h3>
              <p className="text-xs text-text-dim mt-1">
                طبقات الحماية المدمجة في البرنامج لضمان عدم نسخ البرنامج أو تفعيله بدون إذنك.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-card2 p-4 rounded-2xl border border-border space-y-2">
              <span className="text-xl">🔒</span>
              <h4 className="font-bold text-xs text-text-main">ربط الترخيص بعتاد الجهاز (Hardware Binding)</h4>
              <p className="text-[11px] text-text-dim leading-relaxed">
                كود التفعيل مشفر برقم المازربورد والقرص الصلب، إذا قام العميل بنسخ ملفات البرنامج لجهاز آخر فلن يعمل وسيطلب تفعيل جديد.
              </p>
            </div>

            <div className="bg-card2 p-4 rounded-2xl border border-border space-y-2">
              <span className="text-xl">⏳</span>
              <h4 className="font-bold text-xs text-text-main">حماية ضد التلاعب بساعة الويندوز (Clock Anti-Tamper)</h4>
              <p className="text-[11px] text-text-dim leading-relaxed">
                إذا حاول العميل ترجيع تاريخ الويندوز للوراء لتمديد الفترة التجريبية أو الاشتراك، يتم قفل البرنامج تلقائياً.
              </p>
            </div>

            <div className="bg-card2 p-4 rounded-2xl border border-border space-y-2">
              <span className="text-xl">🛡️</span>
              <h4 className="font-bold text-xs text-text-main">تشفير التوقيع الرقمي (Salted Hash Verification)</h4>
              <p className="text-[11px] text-text-dim leading-relaxed">
                لا يمكن تخمين كود التفعيل عبر مولدات أرقام عشوائية لأن الكود محمي بمفتاح سري خاص بالمبرمج فقط.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
