import React, { useState, useRef, useEffect } from 'react';
import { BusinessType, AppConfig } from '../types/types';
import { safeParse } from '../lib/json';
import ActivationPanel from './ActivationPanel';
import UserManagement from './UserManagement';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import Toast from './Toast';
import { playSuccessSound, playWarningSound } from '../lib/sound';
import { 
  verifyDeveloperPassword, 
  MASTER_DEVELOPER_PASSWORD, 
  MASTER_DEVELOPER_PASSWORD_EN,
  MASTER_DEVELOPER_PIN,
  setCustomDeveloperPassword 
} from '../lib/license';

export default function Settings({ appConfig, setAppConfig }: { appConfig: AppConfig; setAppConfig: (config: AppConfig) => void; }) {
  const [businessType, setBusinessType] = useState<BusinessType>(appConfig.businessType);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);
  
  const [businessInfo, setBusinessInfo] = useState({
    name: localStorage.getItem('businessName') || '',
    address: localStorage.getItem('businessAddress') || '',
    phone: localStorage.getItem('businessPhone') || '',
    taxNumber: localStorage.getItem('businessTax') || '',
    logoUrl: localStorage.getItem('businessLogoUrl') || '',
    currency: localStorage.getItem('currency') || 'ج.م',
    invoiceNotes: localStorage.getItem('invoiceNotes') || '',
    backupFrequency: localStorage.getItem('backupFrequency') || 'none'
  });

  // Tax Settings State
  const [taxRate, setTaxRate] = useState<string>(() => {
    const saved = localStorage.getItem('taxRate');
    return saved !== null && !isNaN(Number(saved)) ? saved : '14';
  });
  const [taxEnabled, setTaxEnabled] = useState<boolean>(() => {
    return localStorage.getItem('taxEnabled') !== 'false';
  });
  const [taxType, setTaxType] = useState<'exclusive' | 'inclusive'>(() => {
    return (localStorage.getItem('taxType') as 'exclusive' | 'inclusive') || 'exclusive';
  });
  const [taxNumber, setTaxNumber] = useState<string>(() => {
    return localStorage.getItem('businessTax') || '';
  });

  const [printSettings, setPrintSettings] = useState({
    paperSize: localStorage.getItem('paperSize') || 'A4',
    showLogo: localStorage.getItem('showLogo') !== 'false'
  });

  // POS Price & Cashier Permissions State
  const [allowCashierPriceEdit, setAllowCashierPriceEdit] = useState<boolean>(() => {
    return localStorage.getItem('allowCashierPriceEdit') !== 'false';
  });
  const [preventSellBelowCost, setPreventSellBelowCost] = useState<boolean>(() => {
    return localStorage.getItem('preventSellBelowCost') === 'true';
  });
  const [requireSupervisorPinForPriceEdit, setRequireSupervisorPinForPriceEdit] = useState<boolean>(() => {
    return localStorage.getItem('requireSupervisorPinForPriceEdit') !== 'false';
  });
  
  const [showDevSettings, setShowDevSettings] = useState(false);
  const [devPassword, setDevPassword] = useState('');
  const [newDevPassword, setNewDevPassword] = useState('');
  const [managerEmail, setManagerEmail] = useState(localStorage.getItem('managerEmail') || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveType = () => {
    setAppConfig({ ...appConfig, businessType });
    playSuccessSound();
    setToast({ message: 'تم حفظ نوع النشاط بنجاح ✅', type: 'success' });
  };

  const updateAppConfig = (key: keyof AppConfig, value: boolean) => {
    setAppConfig({ ...appConfig, [key]: value });
  };

  const handleSaveBusiness = () => {
    localStorage.setItem('businessName', businessInfo.name);
    localStorage.setItem('businessAddress', businessInfo.address);
    localStorage.setItem('businessPhone', businessInfo.phone);
    localStorage.setItem('businessTax', businessInfo.taxNumber);
    localStorage.setItem('businessLogoUrl', businessInfo.logoUrl);
    localStorage.setItem('currency', businessInfo.currency);
    localStorage.setItem('invoiceNotes', businessInfo.invoiceNotes);
    localStorage.setItem('backupFrequency', businessInfo.backupFrequency);
    localStorage.setItem('managerEmail', managerEmail);
    // Also sync tax number in tax state
    setTaxNumber(businessInfo.taxNumber);
    playSuccessSound();
    setToast({ message: 'تم حفظ بيانات المنشأة بنجاح ✅', type: 'success' });
  };

  // Tax Settings Save Handler
  const handleSaveTax = () => {
    const rateNum = Number(taxRate);
    if (isNaN(rateNum) || rateNum < 0) {
      playWarningSound();
      setToast({ message: 'يرجى إدخال نسبة ضريبة صحيحة (0 أو أكبر)', type: 'warning' });
      return;
    }

    localStorage.setItem('taxRate', rateNum.toString());
    localStorage.setItem('taxEnabled', taxEnabled.toString());
    localStorage.setItem('taxType', taxType);
    localStorage.setItem('businessTax', taxNumber);
    
    // Also keep businessInfo in sync
    setBusinessInfo(prev => ({ ...prev, taxNumber }));

    window.dispatchEvent(new Event('taxSettingsUpdated'));
    playSuccessSound();
    setToast({ 
      message: `✅ تم حفظ إعدادات الضريبة بنجاح! (${taxEnabled ? `الضريبة مفعلة بنسبة ${rateNum}%` : 'الضريبة معطلة'})`, 
      type: 'success' 
    });
  };

  const handleSavePrint = () => {
    localStorage.setItem('paperSize', printSettings.paperSize);
    localStorage.setItem('showLogo', printSettings.showLogo.toString());
    playSuccessSound();
    setToast({ message: 'تم حفظ إعدادات الطباعة بنجاح ✅', type: 'success' });
  };

  const handleSavePosSettings = () => {
    localStorage.setItem('allowCashierPriceEdit', allowCashierPriceEdit.toString());
    localStorage.setItem('preventSellBelowCost', preventSellBelowCost.toString());
    localStorage.setItem('requireSupervisorPinForPriceEdit', requireSupervisorPinForPriceEdit.toString());
    
    setAppConfig({
      ...appConfig,
      allowCashierPriceEdit,
      preventSellBelowCost,
      requireSupervisorPinForPriceEdit
    });

    window.dispatchEvent(new Event('posSettingsUpdated'));
    playSuccessSound();
    setToast({ 
      message: `✅ تم حفظ صلاحيات البيع وتعديل الأسعار! (${allowCashierPriceEdit ? 'تعديل السعر مسموح' : 'تعديل السعر مقفل إلا بإذن المشرف'})`, 
      type: 'success' 
    });
  };

  const handleDevLogin = () => {
    if (verifyDeveloperPassword(devPassword)) {
      setShowDevSettings(true);
      playSuccessSound();
      setToast({ message: 'تم فتح لوحة تحكم المبرمج بنجاح 🛠️', type: 'success' });
    } else {
      playWarningSound();
      setToast({ message: 'كلمة مرور المبرمج غير صحيحة! (كلمة المرور: ١٨٨٠@Qwer أو 1880@Qwer أو PIN: 1880)', type: 'warning' });
    }
  };

  const handleChangeDevPassword = () => {
    if (!newDevPassword.trim()) {
      playWarningSound();
      setToast({ message: 'يرجى كتابة كلمة المرور الجديدة أولاً', type: 'warning' });
      return;
    }
    setCustomDeveloperPassword(newDevPassword.trim());
    playSuccessSound();
    setToast({ message: `✅ تم تغيير كلمة مرور المبرمج بنجاح إلى (${newDevPassword.trim()})`, type: 'success' });
    setNewDevPassword('');
  };

  const handleResetDevPassword = () => {
    setCustomDeveloperPassword('');
    playSuccessSound();
    setToast({ message: `تمت استعادة كلمة مرور المبرمج الافتراضية: ${MASTER_DEVELOPER_PASSWORD} (${MASTER_DEVELOPER_PASSWORD_EN})`, type: 'success' });
  };

  const clearLocalData = () => {
    if (confirm('هل أنت متأكد من مسح جميع بيانات التطبيق المحلية؟')) {
        indexedDB.deleteDatabase('firestoreCached');
        localStorage.clear();
        window.location.reload();
    }
  };

  const exportBackup = async () => {
    try {
        const productsSnapshot = await getDocs(collection(db, 'products'));
        const products = productsSnapshot.docs.map(d => d.data());
        
        const salesSnapshot = await getDocs(collection(db, 'sales'));
        const sales = salesSnapshot.docs.map(d => d.data());
        
        const backup = { products, sales, timestamp: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${new Date().toISOString()}.json`;
        a.click();
    } catch (e) {
        alert('خطأ في تصدير البيانات');
    }
  };

  const importBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const result = event.target?.result;
            const data = safeParse(typeof result === 'string' ? result : null, { products: [] });
            
            if (data && data.products && Array.isArray(data.products)) {
                for (const p of data.products) {
                   await addDoc(collection(db, 'products'), p);
                }
                alert('تم استيراد المنتجات بنجاح');
                window.location.reload();
            } else {
                throw new Error('Invalid format');
            }
        } catch (error) {
            alert('خطأ في استيراد البيانات');
        }
    };
    reader.readAsText(file);
  };

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <div className="p-4 sm:p-5 max-w-4xl mx-auto space-y-4 pb-28">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span>⚙️</span>
        <span>إعدادات النظام والضرائب</span>
      </h2>

      {/* Theme Setting */}
      <div className="bg-card p-5 rounded-4xl border border-border flex justify-between items-center">
        <div>
           <h3 className="text-sm font-bold">مظهر التطبيق (الوضع الليلي / النهارى)</h3>
           <p className="text-xs text-text-dim mt-1">التبديل الفوري بين الوضع الداكن والفاتح</p>
        </div>
        <button onClick={toggleTheme} className="bg-accent text-white px-4 py-2.5 rounded-2xl font-bold hover:opacity-90 transition-opacity">
           {isDark ? '☀️ الوضع النهاري' : '🌙 الوضع الليلي'}
        </button>
      </div>
      
      {/* Business Info */}
      <div className="bg-card p-5 rounded-4xl border border-border mb-4 space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <span>🏢</span>
          <span>بيانات المنشأة والمتجر</span>
        </h3>
        <div>
          <label className="text-xs text-text-dim mb-1 block">اسم المحل / الشركة:</label>
          <input placeholder="اسم المحل / الشركة" value={businessInfo.name} onChange={e => setBusinessInfo({...businessInfo, name: e.target.value})} className="bg-card2 border border-border p-3 rounded-2xl w-full" />
        </div>
        <div>
          <label className="text-xs text-text-dim mb-1 block">العنوان بالتفصيل:</label>
          <input placeholder="العنوان" value={businessInfo.address} onChange={e => setBusinessInfo({...businessInfo, address: e.target.value})} className="bg-card2 border border-border p-3 rounded-2xl w-full" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-text-dim mb-1 block">رقم الهاتف للتواصل:</label>
            <input placeholder="رقم الهاتف" value={businessInfo.phone} onChange={e => setBusinessInfo({...businessInfo, phone: e.target.value})} className="bg-card2 border border-border p-3 rounded-2xl w-full" />
          </div>
          <div>
            <label className="text-xs text-text-dim mb-1 block">الرقم الضريبي للمنشأة:</label>
            <input placeholder="الرقم الضريبي" value={businessInfo.taxNumber} onChange={e => {
              setBusinessInfo({...businessInfo, taxNumber: e.target.value});
              setTaxNumber(e.target.value);
            }} className="bg-card2 border border-border p-3 rounded-2xl w-full" />
          </div>
        </div>
        <div>
          <label className="text-xs text-text-dim mb-1 block">رابط الشعار (Logo URL):</label>
          <input placeholder="رابط شعار المتجر" value={businessInfo.logoUrl} onChange={e => setBusinessInfo({...businessInfo, logoUrl: e.target.value})} className="bg-card2 border border-border p-3 rounded-2xl w-full" />
        </div>
        <div>
          <label className="text-xs text-text-dim mb-1 block">العملة الافتراضية:</label>
          <input placeholder="العملة (مثل ج.م، ر.س، د.ع، $)" value={businessInfo.currency} onChange={e => setBusinessInfo({...businessInfo, currency: e.target.value})} className="bg-card2 border border-border p-3 rounded-2xl w-full" />
        </div>
        <div>
          <label className="text-xs text-text-dim mb-1 block">ملاحظات أسفل الفاتورة (سياسة الاسترجاع):</label>
          <textarea placeholder="ملاحظات أسفل الفاتورة (سياسة الاسترجاع، مواعيد العمل...)" value={businessInfo.invoiceNotes} onChange={e => setBusinessInfo({...businessInfo, invoiceNotes: e.target.value})} className="bg-card2 border border-border p-3 rounded-2xl w-full h-20" />
        </div>
        <div>
          <label className="text-xs text-text-dim mb-1 block">تكرار النسخ الاحتياطي التلقائي:</label>
          <select value={businessInfo.backupFrequency} onChange={e => setBusinessInfo({...businessInfo, backupFrequency: e.target.value})} className="bg-card2 border border-border p-3 rounded-2xl w-full">
              <option value="none">بدون نسخ احتياطي تلقائي</option>
              <option value="daily">يومي</option>
              <option value="weekly">أسبوعي</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-text-dim mb-1 block">بريد المدير لتنبيهات المخزون:</label>
          <input placeholder="بريد مدير النظام لتنبيهات المخزون" value={managerEmail} onChange={e => setManagerEmail(e.target.value)} className="bg-card2 border border-border p-3 rounded-2xl w-full" />
        </div>
        <button onClick={handleSaveBusiness} className="w-full bg-gold hover:bg-gold2 text-white p-3 rounded-2xl font-bold transition-all shadow-md">💾 حفظ بيانات المنشأة</button>
      </div>
      
      {/* =========================================================
          TAX & VAT SETTINGS (إعدادات الضريبة والقيمة المضافة)
          ========================================================= */}
      <div className="bg-card p-5 rounded-4xl border border-border mb-4 space-y-4 shadow-sm">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧾</span>
            <div>
              <h3 className="text-sm font-bold">إعدادات الضريبة والقيمة المضافة (VAT)</h3>
              <p className="text-xs text-text-dim">تحديد نسبة الضريبة، طريقة الاحتساب، والرقم الضريبي</p>
            </div>
          </div>
          <span className={`text-xs px-3 py-1 rounded-full font-bold ${taxEnabled ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            {taxEnabled ? `مفعلة (${taxRate}%)` : 'معطلة'}
          </span>
        </div>

        {/* Enable / Disable VAT Toggle */}
        <div className="bg-card2 p-3.5 rounded-2xl border border-border flex items-center justify-between">
          <div>
            <span className="font-bold text-xs block">تفعيل ضريبة القيمة المضافة (VAT)</span>
            <span className="text-[11px] text-text-dim">إظهار واحتساب الضريبة في الفواتير ونقاط البيع</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={taxEnabled} 
              onChange={e => setTaxEnabled(e.target.checked)} 
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold"></div>
          </label>
        </div>

        {/* Tax Rate Input + Preset Buttons */}
        <div>
          <label className="block text-xs font-bold text-text-dim mb-1">
            نسبة الضريبة المئوية (%):
          </label>
          <div className="flex gap-2 mb-2">
            <input 
              type="number" 
              step="0.1"
              min="0"
              max="100"
              value={taxRate} 
              onChange={e => setTaxRate(e.target.value)}
              placeholder="مثال: 14"
              className="bg-card2 border border-border p-3 rounded-2xl w-full font-bold font-mono text-base" 
            />
            <span className="bg-card2 border border-border px-4 flex items-center justify-center rounded-2xl font-bold font-mono text-gold">
              %
            </span>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-text-dim self-center text-[11px]">نسب شائعة:</span>
            <button 
              type="button" 
              onClick={() => setTaxRate('14')} 
              className={`px-3 py-1 rounded-xl font-bold border transition-all ${taxRate === '14' ? 'bg-gold text-white border-gold' : 'bg-card2 border-border text-text-dim hover:text-white'}`}
            >
              14% (مصر)
            </button>
            <button 
              type="button" 
              onClick={() => setTaxRate('15')} 
              className={`px-3 py-1 rounded-xl font-bold border transition-all ${taxRate === '15' ? 'bg-gold text-white border-gold' : 'bg-card2 border-border text-text-dim hover:text-white'}`}
            >
              15% (السعودية)
            </button>
            <button 
              type="button" 
              onClick={() => setTaxRate('5')} 
              className={`px-3 py-1 rounded-xl font-bold border transition-all ${taxRate === '5' ? 'bg-gold text-white border-gold' : 'bg-card2 border-border text-text-dim hover:text-white'}`}
            >
              5% (الإمارات / عمان)
            </button>
            <button 
              type="button" 
              onClick={() => setTaxRate('0')} 
              className={`px-3 py-1 rounded-xl font-bold border transition-all ${taxRate === '0' ? 'bg-gold text-white border-gold' : 'bg-card2 border-border text-text-dim hover:text-white'}`}
            >
              0% (معفى ضريبياً)
            </button>
          </div>
        </div>

        {/* Calculation Method */}
        <div>
          <label className="block text-xs font-bold text-text-dim mb-1">طريقة احتساب الضريبة في الفاتورة:</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setTaxType('exclusive')}
              className={`p-3 rounded-2xl border text-right text-xs transition-all ${taxType === 'exclusive' ? 'border-gold bg-gold/10 font-bold' : 'border-border bg-card2 text-text-dim'}`}
            >
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <span>{taxType === 'exclusive' ? '🔘' : '⚪'}</span>
                <span>تضاف فوق الإجمالي (Exclusive)</span>
              </div>
              <p className="text-[10px] text-text-dim pr-5">يتم احتساب الضريبة وإضافتها فوق سعر المنتجات في نهاية الفاتورة</p>
            </button>

            <button
              type="button"
              onClick={() => setTaxType('inclusive')}
              className={`p-3 rounded-2xl border text-right text-xs transition-all ${taxType === 'inclusive' ? 'border-gold bg-gold/10 font-bold' : 'border-border bg-card2 text-text-dim'}`}
            >
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <span>{taxType === 'inclusive' ? '🔘' : '⚪'}</span>
                <span>الأسعار شاملة الضريبة (Inclusive)</span>
              </div>
              <p className="text-[10px] text-text-dim pr-5">سعر المنتج المعروض يشمل الضريبة بالفعل ويتم استخراجها حسابياً</p>
            </button>
          </div>
        </div>

        {/* Tax Registration Number */}
        <div>
          <label className="block text-xs font-bold text-text-dim mb-1">الرقم الضريبي للمنشأة (Tax Registration Number):</label>
          <input 
            type="text"
            placeholder="مثال: 300-123-456"
            value={taxNumber}
            onChange={e => setTaxNumber(e.target.value)}
            className="bg-card2 border border-border p-3 rounded-2xl w-full font-mono text-sm"
          />
        </div>

        {/* Save Button */}
        <button 
          type="button"
          onClick={handleSaveTax} 
          className="w-full bg-gold hover:bg-gold2 text-white p-3.5 rounded-2xl font-black transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
        >
          <span>💾</span>
          <span>حفظ إعدادات الضريبة الآن</span>
        </button>
      </div>

      {/* Invoice Preview */}
      <div className="bg-card p-5 rounded-4xl border border-border mb-4">
          <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
            <span>👁️</span>
            <span>معاينة الفاتورة الضريبية</span>
          </h3>
          <div className='bg-white p-4 text-black text-xs space-y-2 border border-border rounded-xl shadow-inner'>
              <p className='font-bold text-center text-sm'>{businessInfo.name || 'اسم المنشأة'}</p>
              <p className='text-center text-[11px] text-gray-600'>{businessInfo.address || 'العنوان'}</p>
              {taxNumber && <p className='text-center text-[10px] text-gray-500 font-mono'>الرقم الضريبي: {taxNumber}</p>}
              <div className='border-t border-b border-black py-2 my-2'>
                  <div className="flex justify-between">
                    <span>منتج تجريبي</span>
                    <span>100 {businessInfo.currency}</span>
                  </div>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-gray-600">
                  <span>المجموع:</span>
                  <span>100 {businessInfo.currency}</span>
                </div>
                {taxEnabled && (
                  <div className="flex justify-between text-gray-600">
                    <span>ضريبة القيمة المضافة ({taxRate}%):</span>
                    <span>{taxType === 'exclusive' ? (100 * Number(taxRate) / 100).toFixed(2) : (100 - (100 / (1 + Number(taxRate)/100))).toFixed(2)} {businessInfo.currency}</span>
                  </div>
                )}
                <div className="flex justify-between font-black text-sm border-t border-black pt-1">
                  <span>الإجمالي النهائي:</span>
                  <span>{taxEnabled && taxType === 'exclusive' ? (100 + (100 * Number(taxRate) / 100)).toFixed(2) : '100'} {businessInfo.currency}</span>
                </div>
              </div>
              <p className='text-center italic text-gray-500 text-[10px] mt-2'>{businessInfo.invoiceNotes || 'شكراً لتعاملكم معنا'}</p>
          </div>
      </div>

      {/* POS & Cashier Price Permissions Settings */}
      <div className="bg-card p-5 rounded-4xl border border-border mb-4 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black flex items-center gap-2 text-gold">
            <span>🏷️</span>
            <span>صلاحيات نقطة البيع (POS) وتعديل أسعار الكاشير</span>
          </h3>
          <span className="text-[11px] bg-gold/15 text-gold px-3 py-1 rounded-full font-bold">
            تحكم الإدارة في الأسعار
          </span>
        </div>

        <p className="text-xs text-text-dim leading-relaxed">
          تحكم كامل في إمكانية قيام الكاشير بتعديل سعر البيع للأصناف داخل الفاتورة، وحماية أرباح المنشأة من البيع بأقل من التكلفة.
        </p>

        <div className="space-y-3">
          {/* Toggle 1: Allow Price Edit */}
          <label className="flex items-start justify-between gap-4 p-3.5 bg-card2 rounded-2xl border border-border cursor-pointer hover:border-gold/50 transition-all">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs">
                <span>✏️</span>
                <span>السماح للكاشير بتعديل سعر البيع في شاشة البيع (POS)</span>
              </div>
              <p className="text-[11px] text-text-dim pr-6">
                عند التفعيل، يستطيع الكاشير تعديل سعر الوحدة مباشرة داخل الفاتورة. عند الإيقاف، يقفل السعر ولا يمكن تعديله إلا برمز المشرف.
              </p>
            </div>
            <input 
              type="checkbox" 
              checked={allowCashierPriceEdit} 
              onChange={e => setAllowCashierPriceEdit(e.target.checked)} 
              className="mt-1 rounded w-5 h-5 text-gold accent-gold cursor-pointer flex-shrink-0" 
            />
          </label>

          {/* Toggle 2: Prevent Selling Below Cost */}
          <label className="flex items-start justify-between gap-4 p-3.5 bg-card2 rounded-2xl border border-border cursor-pointer hover:border-gold/50 transition-all">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs">
                <span>🛡️</span>
                <span>منع البيع بأقل من سعر التكلفة (Prevent Selling Below Cost)</span>
              </div>
              <p className="text-[11px] text-text-dim pr-6">
                عند التفعيل، يمنع النظام الكاشير من إدخال أي سعر بيع يقل عن سعر شراء وتكلفة المنتج في المخزن لمنع الخسائر المالية.
              </p>
            </div>
            <input 
              type="checkbox" 
              checked={preventSellBelowCost} 
              onChange={e => setPreventSellBelowCost(e.target.checked)} 
              className="mt-1 rounded w-5 h-5 text-gold accent-gold cursor-pointer flex-shrink-0" 
            />
          </label>

          {/* Toggle 3: Supervisor PIN Override */}
          <label className="flex items-start justify-between gap-4 p-3.5 bg-card2 rounded-2xl border border-border cursor-pointer hover:border-gold/50 transition-all">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs">
                <span>🔐</span>
                <span>طلب رمز المشرف / المدير (Supervisor PIN) للتجاوز عند القفل</span>
              </div>
              <p className="text-[11px] text-text-dim pr-6">
                إذا كان تعديل السعر مقفلاً للموظف، يمكن للمشرف إدخال رمزه السري (PIN) في نافذة سريعة بشاشة البيع لاعتماد السعر دون تسجيل الخروج.
              </p>
            </div>
            <input 
              type="checkbox" 
              checked={requireSupervisorPinForPriceEdit} 
              onChange={e => setRequireSupervisorPinForPriceEdit(e.target.checked)} 
              className="mt-1 rounded w-5 h-5 text-gold accent-gold cursor-pointer flex-shrink-0" 
            />
          </label>
        </div>

        <button 
          type="button"
          onClick={handleSavePosSettings} 
          className="w-full bg-gold hover:bg-gold2 text-white p-3.5 rounded-2xl font-black transition-all shadow-md flex items-center justify-center gap-2 active:scale-98"
        >
          <span>💾</span>
          <span>حفظ إعدادات وصلاحيات أسعار الكاشير</span>
        </button>
      </div>

      {/* Printing Settings */}
      <div className="bg-card p-5 rounded-4xl border border-border mb-4 space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <span>🖨️</span>
          <span>إعدادات الطباعة</span>
        </h3>
        <div>
          <label className="text-xs text-text-dim mb-1 block">مقاس ورق الطباعة الافتراضي:</label>
          <select value={printSettings.paperSize} onChange={e => setPrintSettings({...printSettings, paperSize: e.target.value})} className="bg-card2 border border-border p-3 rounded-2xl w-full">
              <option value="A4">A4 (ورق قياسي للمكاتب)</option>
              <option value="80mm">حراري (80mm Thermal POS)</option>
              <option value="58mm">حراري صغير (58mm Thermal POS)</option>
          </select>
        </div>
        <label className='flex items-center gap-2 p-2 bg-card2 rounded-xl text-xs font-bold cursor-pointer'>
            <input type='checkbox' checked={printSettings.showLogo} onChange={e => setPrintSettings({...printSettings, showLogo: e.target.checked})} className="rounded" />
            إظهار شعار المنشأة أعلى الفاتورة المطبوعة
        </label>
        <button onClick={handleSavePrint} className="w-full bg-gold hover:bg-gold2 text-white p-3 rounded-2xl font-bold transition-all shadow-md">💾 حفظ إعدادات الطباعة</button>
      </div>

      {/* Backup & Session Control */}
      <div className="bg-card p-5 rounded-4xl border border-border mb-4 space-y-2">
        <h3 className="text-sm font-bold mb-2 flex items-center gap-2">
          <span>💾</span>
          <span>النسخ الاحتياطي وإدارة البيانات</span>
        </h3>
        <button onClick={exportBackup} className="w-full bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-2xl font-bold mb-2 transition-all flex items-center justify-center gap-2">
          <span>📥</span>
          <span>تصدير نسخة احتياطية كاملة (JSON Backup)</span>
        </button>
        <input type="file" ref={fileInputRef} onChange={importBackup} className="hidden" />
        <button onClick={() => fileInputRef.current?.click()} className="w-full bg-green-600 hover:bg-green-500 text-white p-3 rounded-2xl font-bold mb-2 transition-all flex items-center justify-center gap-2">
          <span>📤</span>
          <span>استيراد واسترجاع نسخة احتياطية (JSON)</span>
        </button>
        <button onClick={clearLocalData} className="w-full bg-red-600/90 hover:bg-red-600 text-white p-3 rounded-2xl font-bold mb-2 transition-all flex items-center justify-center gap-2">
          <span>🗑️</span>
          <span>مسح بيانات الجلسة المحلية وإعادة الضبط</span>
        </button>
      </div>
      
      {/* User Management & Activation Panel */}
      <UserManagement />
      <ActivationPanel />
      
      {/* =========================================================
          DEVELOPER CONTROL PANEL (لوحة تحكم المبرمج)
          ========================================================= */}
      <div className="mt-8 bg-card p-5 rounded-4xl border border-border shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-black text-gold flex items-center gap-2">
            <span>👨‍💻</span>
            <span>لوحة تحكم المبرمج والمطور</span>
          </h3>
          <span className="text-xs text-text-dim">
            كلمة المرور: <code className="text-green-400 font-mono font-bold">١٨٨٠@Qwer</code> ({MASTER_DEVELOPER_PASSWORD_EN})
          </span>
        </div>

        {!showDevSettings ? (
          <div className="space-y-2">
            <p className="text-xs text-text-dim">أدخل كلمة مرور المبرمج لفتح خيارات التخصيص البرمجية والتحكم بالوحدات:</p>
            <div className="flex gap-2">
              <input 
                type="password" 
                placeholder="أدخل كلمة المرور (مثل: ١٨٨٠@Qwer أو 1880@Qwer أو 1880)" 
                className="bg-card2 border border-border p-3 rounded-2xl w-full text-xs font-mono" 
                value={devPassword}
                onChange={(e) => setDevPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleDevLogin();
                }}
              />
              <button onClick={handleDevLogin} className="bg-slate-700 hover:bg-slate-600 text-white px-6 py-3 rounded-2xl font-bold text-xs flex-shrink-0 transition-colors">
                دخول 🔓
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Developer Password Changer */}
            <div className="bg-card2 p-4 rounded-2xl border border-gold/30 space-y-3 text-xs">
              <h4 className="font-bold text-gold flex items-center gap-1.5">
                <span>🔐</span>
                <span>تغيير وتخصيص كلمة مرور المبرمج:</span>
              </h4>
              <p className="text-text-dim">
                كلمة المرور الحالية النشطة: <strong className="text-green-400 font-mono">١٨٨٠@Qwer</strong> (أو <strong className="text-green-400 font-mono">1880@Qwer</strong> / PIN: <strong className="text-green-400 font-mono">1880</strong>). يمكنك تعيين كلمة مرور جديدة من هنا:
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="text"
                  placeholder="اكتب كلمة مرور جديدة للمبرمج"
                  value={newDevPassword}
                  onChange={e => setNewDevPassword(e.target.value)}
                  className="bg-card border border-border p-2.5 rounded-xl flex-1 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={handleChangeDevPassword}
                  className="bg-gold hover:bg-gold2 text-white px-4 py-2.5 rounded-xl font-bold transition-all"
                >
                  تحديث كلمة المرور
                </button>
                <button
                  type="button"
                  onClick={handleResetDevPassword}
                  className="bg-card border border-border hover:border-gold text-text-dim hover:text-white px-3 py-2.5 rounded-xl font-bold transition-all"
                >
                  استعادة الافتراضية
                </button>
              </div>
            </div>

            {/* Business Type */}
            <div>
                <label className="block text-xs font-bold text-text-dim mb-2">نوع النشاط التجاري:</label>
                <select 
                value={businessType} 
                onChange={(e) => setBusinessType(e.target.value as BusinessType)}
                className="bg-card2 border border-border p-3 rounded-2xl w-full text-xs font-bold"
                >
                {Object.values(BusinessType).map((type) => (
                    <option key={type} value={type}>{type}</option>
                ))}
                </select>
            </div>
            
            {/* Feature Toggles */}
            <div>
              <label className="block text-xs font-bold text-text-dim mb-2">مزايا المنتجات الإضافية:</label>
              <div className='grid grid-cols-1 sm:grid-cols-3 gap-2'>
                  <label className='flex items-center gap-2 bg-card2 p-3 rounded-2xl text-xs font-bold cursor-pointer'>
                      <input type="checkbox" checked={appConfig.enableWeight} onChange={e => updateAppConfig('enableWeight', e.target.checked)} className="rounded" />
                      تفعيل الوزن والميزان الإلكتروني
                  </label>
                  <label className='flex items-center gap-2 bg-card2 p-3 rounded-2xl text-xs font-bold cursor-pointer'>
                      <input type="checkbox" checked={appConfig.enableExpiry} onChange={e => updateAppConfig('enableExpiry', e.target.checked)} className="rounded" />
                      تفعيل تاريخ الصلاحية
                  </label>
                  <label className='flex items-center gap-2 bg-card2 p-3 rounded-2xl text-xs font-bold cursor-pointer'>
                      <input type="checkbox" checked={appConfig.enableSerial} onChange={e => updateAppConfig('enableSerial', e.target.checked)} className="rounded" />
                      تفعيل السريال نمبر (الأجهزة)
                  </label>
              </div>
            </div>
            
            {/* Module Toggles */}
            <div>
              <label className="block text-xs font-bold text-text-dim mb-2">تفعيل وتعطيل الموديلات للعميل:</label>
              <div className='grid grid-cols-2 sm:grid-cols-4 gap-2'>
                  {['pos', 'inventory', 'inventory-reports', 'categories', 'reports', 'suppliers', 'customers', 'expenses', 'accounting', 'purchases', 'activity-log', 'users'].map(mod => (
                      <label key={mod} className='flex items-center gap-2 bg-card2 p-2.5 rounded-xl text-xs font-mono cursor-pointer'>
                          <input type="checkbox" checked={safeParse(localStorage.getItem('enabledModules'), {})[mod] !== false} onChange={e => {
                              let mods = safeParse(localStorage.getItem('enabledModules'), {});
                              // @ts-ignore
                              mods[mod] = e.target.checked;
                              localStorage.setItem('enabledModules', JSON.stringify(mods));
                              window.dispatchEvent(new Event('modulesUpdated'));
                          }} className="rounded" />
                          {mod}
                      </label>
                  ))}
              </div>
            </div>

            <button onClick={handleSaveType} className="w-full bg-green-600 hover:bg-green-500 text-white p-3.5 rounded-2xl font-bold transition-all shadow-md">
              💾 حفظ إعدادات النشاط والموديلات
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
