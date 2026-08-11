import React, { useState, useEffect } from 'react';
import { 
  getTrialStatus, 
  activateWithKey, 
  generateActivationKey, 
  resetTrialDays, 
  extendTrialDays, 
  deactivateLicense, 
  MASTER_UNIVERSAL_KEY, 
  MASTER_DEV_KEY,
  MASTER_DEVELOPER_PASSWORD,
  MASTER_DEVELOPER_PASSWORD_EN,
  MASTER_DEVELOPER_PIN,
  verifyDeveloperPassword,
  TrialStatus 
} from '../lib/license';
import Toast from './Toast';
import { playSuccessSound, playWarningSound } from '../lib/sound';
import DeveloperKeygenSuite from './DeveloperKeygenSuite';

export default function ActivationPanel() {
  const [trial, setTrial] = useState<TrialStatus>(getTrialStatus);
  const [inputKey, setInputKey] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Dev tools inside activation
  const [showDevGenerator, setShowDevGenerator] = useState(false);
  const [devPassInput, setDevPassInput] = useState('');
  const [devUnlocked, setDevUnlocked] = useState(false);
  const [targetIdForGen, setTargetIdForGen] = useState('');
  const [generatedKey, setGeneratedKey] = useState('');

  const refreshStatus = () => {
    const updated = getTrialStatus();
    setTrial(updated);
  };

  useEffect(() => {
    refreshStatus();
    const handleUpdate = () => refreshStatus();
    window.addEventListener('licenseUpdated', handleUpdate);
    return () => window.removeEventListener('licenseUpdated', handleUpdate);
  }, []);

  const handleActivate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const result = activateWithKey(inputKey);
    if (result.success) {
      playSuccessSound();
      setToast({ message: result.message, type: 'success' });
      setInputKey('');
      refreshStatus();
    } else {
      playWarningSound();
      setToast({ message: result.message, type: 'warning' });
    }
  };

  const handleQuickActivateCurrent = () => {
    const key = generateActivationKey(trial.machineId);
    setInputKey(key);
    const res = activateWithKey(key);
    if (res.success) {
      playSuccessSound();
      setToast({ message: res.message, type: 'success' });
      refreshStatus();
    }
  };

  const handleMasterActivate = () => {
    const res = activateWithKey(MASTER_UNIVERSAL_KEY);
    if (res.success) {
      playSuccessSound();
      setToast({ message: 'تم التفعيل بكود المبرمج الماستر الشامل!', type: 'success' });
      refreshStatus();
    }
  };

  const copyMachineId = () => {
    navigator.clipboard.writeText(trial.machineId);
    setCopied(true);
    playSuccessSound();
    setToast({ message: `تم نسخ معرف الجهاز (${trial.machineId}) بنجاح!`, type: 'success' });
    setTimeout(() => setCopied(false), 3000);
  };

  const copyKey = (keyText: string) => {
    navigator.clipboard.writeText(keyText);
    setCopiedKey(true);
    playSuccessSound();
    setToast({ message: `تم نسخ كود التفعيل (${keyText}) بنجاح!`, type: 'success' });
    setTimeout(() => setCopiedKey(false), 3000);
  };

  const handleDevUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyDeveloperPassword(devPassInput)) {
      setDevUnlocked(true);
      playSuccessSound();
      setToast({ message: 'تم فتح لوحة تحكم المبرمج ومولد الأكواد بنجاح 🛠️', type: 'success' });
    } else {
      playWarningSound();
      setToast({ message: 'كلمة مرور المبرمج غير صحيحة! (كلمة المرور: ١٨٨٠@Qwer أو 1880@Qwer أو PIN: 1880)', type: 'warning' });
    }
  };

  const handleGenerateCustomKey = () => {
    if (!targetIdForGen.trim()) {
      playWarningSound();
      setToast({ message: 'يرجى إدخال معرف الجهاز لتوليد كود التفعيل له', type: 'warning' });
      return;
    }
    const key = generateActivationKey(targetIdForGen.trim());
    setGeneratedKey(key);
    playSuccessSound();
  };

  const percentageUsed = Math.min(100, Math.max(0, ((14 - trial.daysRemaining) / 14) * 100));

  return (
    <div className="bg-card p-6 rounded-3xl border border-border mt-4 shadow-sm space-y-6 max-w-4xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header & Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">
              {trial.licenseType === 'timed_subscription' ? '⏱️' : (trial.isActivated ? '👑' : '⏳')}
            </span>
            <h3 className="text-lg font-black text-gold">
              {trial.licenseType === 'timed_subscription' 
                ? `النظام مفعل باشتراك مؤقت (ينتهي في: ${trial.expiryDate ? new Date(trial.expiryDate).toLocaleDateString('ar-EG') : ''})`
                : (trial.isActivated ? 'النظام مفعل ومرخص مدى الحياة' : 'حالة ترخيص النظام والنسخة التجريبية (14 يوم)')}
            </h3>
          </div>
          <p className="text-xs text-text-dim mt-1">
            {trial.licenseType === 'timed_subscription'
              ? `النسخة التجارية الكاملة مفعلة بموجب اشتراك مؤقت متبقي فيه ${trial.daysRemaining} يوم.`
              : (trial.isActivated 
                ? 'النسخة التجارية الكاملة مفعلة بدون أي قيود زمنية أو حظر.' 
                : 'يعمل النظام حالياً في الفترة التجريبية المجانية الكاملة لمدة 14 يوماً.')}
          </p>
        </div>

        <div>
          {trial.licenseType === 'timed_subscription' ? (
            <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3.5 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 shadow-sm">
              <span>⏱️</span> اشتراك مؤقت: متبقي {trial.daysRemaining} يوم
            </span>
          ) : trial.isActivated ? (
            <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-3.5 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 shadow-sm">
              <span>✅</span> مرخص دائم مدى الحياة (PRO)
            </span>
          ) : trial.isExpired ? (
            <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-3.5 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 animate-pulse shadow-sm">
              <span>🚫</span> انتهت الفترة التجريبية (مطلوب تفعيل)
            </span>
          ) : (
            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3.5 py-1.5 rounded-full text-xs font-black flex items-center gap-1.5 shadow-sm">
              <span>⏱️</span> متبقي {trial.daysRemaining} يوم في التجربة
            </span>
          )}
        </div>
      </div>

      {/* 14-Day Trial Counter & Progress */}
      {!trial.isActivated && (
        <div className="bg-card2 p-4 rounded-2xl border border-border space-y-3">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <span>📅</span> عداد الأيام التجريبية:
            </span>
            <span className="text-gold">
              متبقي: {trial.daysRemaining} يوم من أصل 14 يوم
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-border/50 h-3.5 rounded-full overflow-hidden p-0.5">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                trial.daysRemaining <= 3 ? 'bg-danger' : trial.daysRemaining <= 7 ? 'bg-amber-500' : 'bg-gold'
              }`}
              style={{ width: `${Math.max(5, 100 - percentageUsed)}%` }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-text-dim">
            <span>تاريخ بدء التجربة: {new Date(trial.trialStartDate).toLocaleDateString('ar-EG')}</span>
            <span>انتهاء التجربة: {new Date(new Date(trial.trialStartDate).getTime() + 14 * 24 * 3600 * 1000).toLocaleDateString('ar-EG')}</span>
          </div>
        </div>
      )}

      {/* Machine ID info box */}
      <div className="bg-card2 p-4 rounded-2xl border border-border space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <label className="text-xs text-text-dim block mb-1 font-bold">معرف جهازك الفريد (Machine ID):</label>
            <span className="font-mono text-base font-black bg-primary px-3 py-1.5 rounded-xl border border-border tracking-wider text-gold select-all">
              {trial.machineId}
            </span>
          </div>
          <button
            type="button"
            onClick={copyMachineId}
            className="bg-card border border-border hover:border-gold px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
          >
            <span>{copied ? '✅' : '📋'}</span>
            <span>{copied ? 'تم النسخ!' : 'نسخ المعرف لإرساله للمبرمج'}</span>
          </button>
        </div>
      </div>

      {/* Activation Input Form */}
      <form onSubmit={handleActivate} className="space-y-3">
        <label className="block text-xs font-bold">
          أدخل كود التفعيل المستلم من المبرمج أو كود الماستر:
        </label>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder={`مثال: KEY-${trial.machineId} أو MARO-FULL-2026`}
            className="bg-card2 border border-border p-3 rounded-2xl text-sm font-mono tracking-wider flex-1 uppercase"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
          />
          <button
            type="submit"
            className="bg-gold text-white px-6 py-3 rounded-2xl font-bold hover:bg-gold2 transition-colors flex items-center justify-center gap-2 shadow-lg flex-shrink-0"
          >
            <span>🚀</span>
            <span>تفعيل النظام الآن</span>
          </button>
        </div>
      </form>

      {/* Step-by-Step Explanation: How Activation Works */}
      <div className="bg-card2/60 p-4 rounded-2xl border border-border space-y-2 text-xs">
        <h4 className="font-black text-sm text-gold flex items-center gap-1.5">
          <span>ℹ️</span> إزاي بيتم التفعيل؟ (دليل وخطوات التفعيل):
        </h4>
        <ol className="list-decimal list-inside space-y-1.5 text-text-dim leading-relaxed pr-1">
          <li>
            <strong className="text-text-main">معرف الجهاز (Machine ID):</strong> يقوم النظام تلقائياً بتوليد كود فريد لجهازك (مثل <code className="text-gold font-mono">{trial.machineId}</code>).
          </li>
          <li>
            <strong className="text-text-main">طلب كود التفعيل:</strong> انسخ معرف جهازك وأرسله للمبرمج أو المسؤول.
          </li>
          <li>
            <strong className="text-text-main">توليد الكود من المبرمج:</strong> كود التفعيل الخاص بجهازك يكون بصيغة: <code className="text-green-400 font-mono">KEY-{trial.machineId}</code>.
          </li>
          <li>
            <strong className="text-text-main">إدخال الكود:</strong> الصق الكود في الحقل أعلاه واضغط على "تفعيل النظام الآن"، وسيتم التفعيل مدى الحياة وإلغاء عداد الـ 14 يوماً فوراً.
          </li>
          <li>
            <strong className="text-text-main">كود الماستر الشامل للمبرمج:</strong> يمكنك أيضاً تفعيل أي جهاز مباشرة باستخدام كود الماستر <code className="text-amber-400 font-mono">{MASTER_UNIVERSAL_KEY}</code>.
          </li>
        </ol>
      </div>

      {/* Developer Master Section & Key Generator Toggle */}
      <div className="border-t border-border pt-4">
        <div className="flex justify-between items-center">
          <button
            type="button"
            onClick={() => setShowDevGenerator(!showDevGenerator)}
            className="text-xs text-text-dim hover:text-gold font-bold flex items-center gap-1.5 transition-colors"
          >
            <span>🛠️</span>
            <span>{showDevGenerator ? 'إخفاء أدوات المبرمج ومولد الأكواد' : 'أنا المبرمج / المطور (كود المبرمج وتوليد الأكواد)'}</span>
          </button>

          {trial.isActivated && (
            <button
              type="button"
              onClick={() => {
                if (confirm('هل تريد إلغاء تفعيل النظام وإرجاعه للوضع التجريبي للتجربة؟')) {
                  deactivateLicense();
                  playSuccessSound();
                  setToast({ message: 'تم إلغاء التفعيل وإرجاع النظام للوضع التجريبي', type: 'warning' });
                }
              }}
              className="text-[11px] text-danger/80 hover:text-danger underline"
            >
              إلغاء التفعيل (للتجربة)
            </button>
          )}
        </div>

        {/* Developer Unlocked Tools */}
        {showDevGenerator && (
          <div className="mt-4 bg-primary p-5 rounded-2xl border border-gold/30 space-y-4">
            <h4 className="font-bold text-sm text-gold flex items-center gap-2">
              <span>👨‍💻</span> لوحة المبرمج: الأكواد والمولد الفوري
            </h4>

            {!devUnlocked ? (
              <form onSubmit={handleDevUnlock} className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  placeholder="أدخل كلمة مرور المبرمج (مثل: ١٨٨٠@Qwer أو 1880@Qwer أو PIN: 1880)"
                  className="bg-card2 border border-border p-2.5 rounded-xl text-xs flex-1"
                  value={devPassInput}
                  onChange={(e) => setDevPassInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold"
                >
                  فتح لوحة المبرمج
                </button>
              </form>
            ) : (
              <div className="space-y-4 text-xs">
                {/* Master Codes Reference */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-card2 p-3.5 rounded-xl border border-border">
                  <div>
                    <span className="text-text-dim block mb-1">🔑 كود المبرمج الماستر الشامل:</span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono font-bold text-gold text-sm bg-card p-1 rounded border border-border">
                        {MASTER_UNIVERSAL_KEY}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyKey(MASTER_UNIVERSAL_KEY)}
                        className="bg-card px-2 py-1 rounded text-[10px] font-bold border border-border hover:border-gold"
                      >
                        نسخ
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-text-dim block mb-1">🔐 كلمة مرور المبرمج (Dev Password / PIN):</span>
                    <code className="font-mono font-bold text-green-400 text-sm bg-card p-1 rounded border border-border">
                      {MASTER_DEVELOPER_PASSWORD} ({MASTER_DEVELOPER_PASSWORD_EN}) / {MASTER_DEVELOPER_PIN}
                    </code>
                  </div>
                </div>

                {/* Instant 1-Click Activation for Current Device */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleQuickActivateCurrent}
                    className="bg-green-600 hover:bg-green-500 text-white px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <span>⚡</span>
                    <span>تفعيل هذا الجهاز فوراً (بنقرة واحدة)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleMasterActivate}
                    className="bg-gold hover:bg-gold2 text-white px-3.5 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-sm"
                  >
                    <span>👑</span>
                    <span>تفعيل بكود الماستر الشامل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      resetTrialDays();
                      playSuccessSound();
                      setToast({ message: 'تمت إعادة ضبط عداد الـ 14 يوماً من جديد!', type: 'success' });
                    }}
                    className="bg-card2 hover:bg-card border border-border px-3.5 py-2 rounded-xl font-bold text-text-dim hover:text-white"
                  >
                    🔄 تصفير عداد الـ 14 يوم
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      extendTrialDays(7);
                      playSuccessSound();
                      setToast({ message: 'تم تمديد الفترة التجريبية 7 أيام إضافية!', type: 'success' });
                    }}
                    className="bg-card2 hover:bg-card border border-border px-3.5 py-2 rounded-xl font-bold text-text-dim hover:text-white"
                  >
                    ➕ تمديد التجربة +7 أيام
                  </button>
                </div>

                {/* Generator for other machines */}
                <div className="bg-card2 p-3.5 rounded-xl border border-border space-y-2">
                  <span className="font-bold text-text-main block">
                    ⚡ مولد أكواد التفعيل لأي جهاز عميل آخر (Key Generator):
                  </span>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="الصق معرف جهاز العميل هنا (مثال: ID-ABC123XYZ)"
                      className="bg-card border border-border p-2.5 rounded-xl flex-1 text-xs font-mono uppercase"
                      value={targetIdForGen}
                      onChange={(e) => setTargetIdForGen(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={handleGenerateCustomKey}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold"
                    >
                      توليد كود التفعيل
                    </button>
                  </div>

                  {generatedKey && (
                    <div className="mt-2 p-2.5 bg-card rounded-xl border border-gold/40 flex justify-between items-center">
                      <div>
                        <span className="text-text-dim text-[11px] block">كود التفعيل المولد:</span>
                        <code className="font-mono text-sm text-gold font-bold select-all">{generatedKey}</code>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyKey(generatedKey)}
                        className="bg-gold text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-gold2"
                      >
                        نسخ الكود وإرساله للعميل
                      </button>
                    </div>
                  )}
                </div>

                {/* Developer Hub & Full Packaging Suite */}
                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-bold text-text-main">
                      📦 مركز حزم الديسكتوب والموبايل والتراخيص المتقدمة:
                    </span>
                    <a
                      href="/keygen.html"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs bg-gold hover:bg-amber-600 text-black px-3 py-1 rounded-lg font-black transition-all"
                    >
                      🌐 فتح صفحة المولد المستقلة
                    </a>
                  </div>
                  <DeveloperKeygenSuite />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
