import React, { useState, useRef, useEffect } from 'react';
import { BusinessType, AppConfig, Company } from '../types/types';
import { useTenant } from '../context/TenantContext';
import { safeParse } from '../lib/json';
import ActivationPanel from './ActivationPanel';
import UserManagement from './UserManagement';
import DeveloperKeygenSuite from './DeveloperKeygenSuite';
import Toast from './Toast';
import { playSuccessSound, playWarningSound, playAlertSound } from '../lib/sound';
import { 
  exportFullDatabaseBackup, 
  resetSystemDatabase, 
  SystemResetMode,
  saveProduct,
  saveCustomer,
  saveSupplier,
  saveCompany,
  getCompanies,
  deleteCompany,
  seedArabicDemoData
} from '../lib/firestoreService';
import { POSDesignType } from './pos/POSDesignSelectorModal';
import { 
  verifyDeveloperPassword, 
  MASTER_DEVELOPER_PASSWORD, 
  MASTER_DEVELOPER_PASSWORD_EN, 
  MASTER_DEVELOPER_PIN,
  setCustomDeveloperPassword 
} from '../lib/license';
import { 
  formatWhatsAppPhoneNumber, 
  getDirectWhatsAppUrl, 
  openDirectWhatsAppChat, 
  sendServerNotification,
  buildLowStockMessage,
  buildDailySalesSummaryMessage
} from '../lib/notifications';
import TreasuryWarehouseModal from './TreasuryWarehouseModal';
import UnitsModal from './UnitsModal';
import { 
  MessageSquare, 
  Mail, 
  Send, 
  Plus,
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  RefreshCw, 
  Smartphone, 
  ShieldAlert, 
  Settings as SettingsIcon,
  Bell,
  Check,
  X,
  Palette,
  MousePointer,
  Layout,
  Trash2,
  Download,
  Upload,
  Grid,
  List,
  Sparkles,
  Zap,
  Monitor,
  Moon,
  Vault,
  Building2,
  Store,
  Scale,
  BrainCircuit,
  Wand2
} from 'lucide-react';

export default function Settings({ appConfig, setAppConfig }: { appConfig: AppConfig; setAppConfig: (config: AppConfig) => void; }) {
  const { companyId, setCompanyId } = useTenant();
  const [companies, setCompanies] = useState<Company[]>([]);
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

  // POS Customization & Theme States
  const [posDesign, setPosDesign] = useState<POSDesignType>(() => {
    return (localStorage.getItem('posDesign') as POSDesignType) || 'emerald';
  });
  const [posTouchMode, setPosTouchMode] = useState<boolean>(() => {
    return localStorage.getItem('posTouchMode') === 'true';
  });
  const [posPrimaryColor, setPosPrimaryColor] = useState<string>(() => {
    return localStorage.getItem('posPrimaryColor') || 'emerald';
  });
  const [posButtonSize, setPosButtonSize] = useState<'small' | 'medium' | 'large'>(() => {
    return (localStorage.getItem('posButtonSize') as any) || 'medium';
  });
  const [posViewMode, setPosViewMode] = useState<'image-grid' | 'compact-list'>(() => {
    return (localStorage.getItem('posViewMode') as any) || 'image-grid';
  });

  // Treasury & Warehouse Modal State
  const [isTreasuryModalOpen, setIsTreasuryModalOpen] = useState(false);
  const [isUnitsModalOpen, setIsUnitsModalOpen] = useState(false);

  // Database Reset Modal States
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetMode, setResetMode] = useState<SystemResetMode>('full');
  const [resetConfirmationInput, setResetConfirmationInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  const [showDevSettings, setShowDevSettings] = useState(false);

  useEffect(() => {
    getCompanies().then(setCompanies);
  }, []);
  const [devPassword, setDevPassword] = useState('');
  const [newDevPassword, setNewDevPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manager Alerts & Notification Center State
  const [managerWhatsApp, setManagerWhatsApp] = useState<string>(() => {
    return localStorage.getItem('managerWhatsApp') || localStorage.getItem('businessPhone') || '';
  });
  const [managerWhatsAppCountryCode, setManagerWhatsAppCountryCode] = useState<string>(() => {
    return localStorage.getItem('managerWhatsAppCountryCode') || '+20';
  });
  const [managerEmail, setManagerEmail] = useState<string>(() => {
    return localStorage.getItem('managerEmail') || '';
  });
  const [notifyLowStock, setNotifyLowStock] = useState<boolean>(() => {
    return localStorage.getItem('notify_low_stock') !== 'false';
  });
  const [notifyDailySummary, setNotifyDailySummary] = useState<boolean>(() => {
    return localStorage.getItem('notify_daily_summary') !== 'false';
  });
  const [notifyPriceOverride, setNotifyPriceOverride] = useState<boolean>(() => {
    return localStorage.getItem('notify_price_override') !== 'false';
  });
  const [notifyPurchase, setNotifyPurchase] = useState<boolean>(() => {
    return localStorage.getItem('notify_purchase') === 'true';
  });
  const [notifyMethod, setNotifyMethod] = useState<'both' | 'direct-whatsapp' | 'server'>(() => {
    return (localStorage.getItem('notify_preferred_method') as any) || 'both';
  });

  // Server Diagnostics State
  const [serverDiagnostic, setServerDiagnostic] = useState<{
    twilioConfigured: boolean;
    smtpConfigured: boolean;
    hasSid?: boolean;
    hasToken?: boolean;
    hasFromPhone?: boolean;
    hasAdminPhone?: boolean;
    fromPhone?: string;
    adminPhone?: string;
    smtpHost?: string;
    smtpUser?: string;
  } | null>(null);

  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<{ type: 'whatsapp' | 'email'; success: boolean; message: string } | null>(null);

  // AI Module State
  const [aiEnabled, setAiEnabled] = useState<boolean>(false);
  const [aiLicenseKey, setAiLicenseKey] = useState<string>('');
  const [isSavingAi, setIsSavingAi] = useState(false);

  useEffect(() => {
    fetchAiConfig();
  }, []);

  const fetchAiConfig = async () => {
    try {
      const res = await fetch('/api/ai/config');
      const data = await res.json();
      setAiEnabled(data.isEnabled);
      setAiLicenseKey(data.licenseKey || '');
    } catch (err) {
      console.error("Error fetching AI config:", err);
    }
  };

  const handleSaveAiConfig = async () => {
    setIsSavingAi(true);
    try {
      const res = await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: aiEnabled, licenseKey: aiLicenseKey })
      });
      if (res.ok) {
        setToast({ message: 'تم تحديث إعدادات الذكاء الاصطناعي بنجاح', type: 'success' });
        window.location.reload(); // Reload to refresh AI copilot instance
      }
    } catch (err) {
      setToast({ message: 'فشل حفظ إعدادات الذكاء الاصطناعي', type: 'warning' });
    } finally {
      setIsSavingAi(false);
    }
  };

  // Fetch Server Notification Status on load
  const checkServerStatus = async () => {
    try {
      const res = await fetch('/api/notifications/status');
      if (res.ok) {
        const data = await res.json();
        setServerDiagnostic({
          twilioConfigured: data.twilio?.configured,
          smtpConfigured: data.smtp?.configured,
          hasSid: data.twilio?.hasSid,
          hasToken: data.twilio?.hasToken,
          hasFromPhone: data.twilio?.hasFromPhone,
          hasAdminPhone: data.twilio?.hasAdminPhone,
          fromPhone: data.twilio?.fromPhone,
          adminPhone: data.twilio?.adminPhone,
          smtpHost: data.smtp?.host,
          smtpUser: data.smtp?.user
        });
      }
    } catch (e) {
      console.warn('Could not check server notification status', e);
    }
  };

  useEffect(() => {
    checkServerStatus();
    fetch('/api/companies')
      .then(res => res.json())
      .then(data => setCompanies(data))
      .catch(err => console.error('Failed to fetch companies', err));
  }, []);

  const handleSaveNotifications = () => {
    localStorage.setItem('managerWhatsApp', managerWhatsApp.trim());
    localStorage.setItem('managerWhatsAppCountryCode', managerWhatsAppCountryCode);
    localStorage.setItem('managerEmail', managerEmail.trim());
    localStorage.setItem('notify_low_stock', notifyLowStock.toString());
    localStorage.setItem('notify_daily_summary', notifyDailySummary.toString());
    localStorage.setItem('notify_price_override', notifyPriceOverride.toString());
    localStorage.setItem('notify_purchase', notifyPurchase.toString());
    localStorage.setItem('notify_preferred_method', notifyMethod);

    window.dispatchEvent(new Event('managerNotificationSettingsUpdated'));
    playSuccessSound();
    setToast({
      message: '✅ تم حفظ إعدادات تنبيهات واتساب والبريد الإلكتروني للمدير بنجاح!',
      type: 'success'
    });
  };

  // Test WhatsApp Direct (Opens wa.me immediately)
  const handleDirectWhatsAppTest = () => {
    if (!managerWhatsApp.trim()) {
      playWarningSound();
      setToast({ message: 'يرجى إدخال رقم واتساب المدير أولاً لإجراء الفحص', type: 'warning' });
      return;
    }
    const testMsg = `🧪 *رسالة فحص واختبار واتساب من نظام المبيعات والمخزون*
🏪 *المنشأة:* ${businessInfo.name || 'المتجر'}
📅 *التاريخ:* ${new Date().toLocaleDateString('ar-EG')}
⏰ *الوقت:* ${new Date().toLocaleTimeString('ar-EG')}

✅ *تهانينا:* رقمك مفعل ومربوط بنجاح لاستقبال كافة تنبيهات نقص المخزون، تقارير المبيعات اليومية، والعمليات الحساسة فور وقوعها!`;

    openDirectWhatsAppChat(managerWhatsApp, testMsg, managerWhatsAppCountryCode);
    playSuccessSound();
    setToast({ message: '🚀 جاري فتح محادثة واتساب المباشرة مع المدير...', type: 'success' });
  };

  // Test WhatsApp Server Dispatch (Twilio)
  const handleServerWhatsAppTest = async () => {
    if (!managerWhatsApp.trim()) {
      playWarningSound();
      setToast({ message: 'يرجى إدخال رقم واتساب المدير أولاً', type: 'warning' });
      return;
    }
    setIsTestingWhatsApp(true);
    setTestResult(null);

    const formatted = formatWhatsAppPhoneNumber(managerWhatsApp, managerWhatsAppCountryCode);
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'whatsapp',
          target: formatted,
          message: `🧪 *فحص إرسال واتساب عبر السيرفر*\n✅ النظام متصل بنجاح مع هاتف المدير (+${formatted})\n⏰ ${new Date().toLocaleTimeString('ar-EG')}`
        })
      });
      const data = await res.json();
      if (data.success) {
        playSuccessSound();
        setTestResult({
          type: 'whatsapp',
          success: true,
          message: `✅ تم إرسال رسالة واتساب بنجاح عبر السيرفر إلى (+${formatted})!`
        });
      } else {
        playWarningSound();
        setTestResult({
          type: 'whatsapp',
          success: false,
          message: `⚠️ تنبيه من السيرفر: ${data.reason || 'تعذر الإرسال التلقائي عبر Twilio'}. يمكنك استخدام "الإرسال المباشر عبر واتساب ويب" فهو يعمل مجاناً 100% بدون أي خادم!`
        });
      }
    } catch (e: any) {
      playWarningSound();
      setTestResult({
        type: 'whatsapp',
        success: false,
        message: 'تعذر الاتصال بخادم الإرسال. استخدم زر الإرسال المباشر لواتساب ويب.'
      });
    } finally {
      setIsTestingWhatsApp(false);
      checkServerStatus();
    }
  };

  // Test Email Server Dispatch
  const handleServerEmailTest = async () => {
    if (!managerEmail.trim()) {
      playWarningSound();
      setToast({ message: 'يرجى إدخال البريد الإلكتروني للمدير أولاً', type: 'warning' });
      return;
    }
    setIsTestingEmail(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          target: managerEmail.trim(),
          message: `🧪 هذا بريد إلكتروني تجريبي لتأكيد تفعيل إشعارات نظام إدارة المبيعات والمخزون للمدير (${managerEmail}).\n\nتاريخ الإرسال: ${new Date().toLocaleString('ar-EG')}`
        })
      });
      const data = await res.json();
      if (data.success) {
        playSuccessSound();
        setTestResult({
          type: 'email',
          success: true,
          message: `✅ تم إرسال بريد إلكتروني تجريبي بنجاح إلى (${managerEmail})! يرجى التحقق من صندوق الوارد أو البريد غير الهام (Spam).`
        });
      } else {
        playWarningSound();
        setTestResult({
          type: 'email',
          success: false,
          message: `⚠️ سبب عدم الإرسال: ${data.reason || 'إعدادات SMTP غير مكتملة أو كلمة مرور التطبيقات في بريد الإرسال غير صحيحة'}.`
        });
      }
    } catch (e) {
      playWarningSound();
      setTestResult({
        type: 'email',
        success: false,
        message: 'فشل الاتصال بخادم البريد الإلكتروني.'
      });
    } finally {
      setIsTestingEmail(false);
      checkServerStatus();
    }
  };

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

  const checkAdminPermission = (): boolean => {
    const user = safeParse(localStorage.getItem('currentUser'), null);
    if (!user || user.role !== 'admin') {
      playWarningSound();
      alert('⚠️ عذراً! هذه الخاصية مقتصرة على حساب المدير (Admin) فقط. لا تملك الصلاحية للوصول لإعدادات النظام أو تعديلها أو التصدير والمسح.');
      return false;
    }
    return true;
  };

  // Save POS Theme & Layout Customization
  const handleSavePosCustomization = () => {
    if (!checkAdminPermission()) return;
    localStorage.setItem('posDesign', posDesign);
    localStorage.setItem('posTouchMode', posTouchMode.toString());
    localStorage.setItem('posPrimaryColor', posPrimaryColor);
    localStorage.setItem('posButtonSize', posButtonSize);
    localStorage.setItem('posViewMode', posViewMode);

    window.dispatchEvent(new Event('posCustomizationUpdated'));
    window.dispatchEvent(new Event('posSettingsUpdated'));
    playSuccessSound();
    setToast({
      message: '🎨 تم حفظ تخصيصات واجهة وألوان وأزرار شاشة البيع (POS) بنجاح!',
      type: 'success'
    });
  };

  // Full System Export Backup
  const handleExportBackup = async () => {
    if (!checkAdminPermission()) return;
    setIsExporting(true);
    try {
      const backupData = await exportFullDatabaseBackup();
      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-full-${new Date().toISOString().split('T')[0]}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      playSuccessSound();
      setToast({ message: '📥 تم تصدير نسخة احتياطية شاملة لكافة بيانات النظام بنجاح!', type: 'success' });
    } catch (e: any) {
      playWarningSound();
      setToast({ message: `فشل تصدير البيانات: ${e.message || 'خطأ غير متوقع'}`, type: 'warning' });
    } finally {
      setIsExporting(false);
    }
  };

  // Full / Selective Database Import
  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!checkAdminPermission()) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const result = event.target?.result;
        const data = safeParse(typeof result === 'string' ? result : null, null);
        if (!data) throw new Error('الملف غير صالح أو صيغة JSON غير معتمدة');

        let prodCount = 0;
        let custCount = 0;
        let suppCount = 0;

        if (data.products && Array.isArray(data.products)) {
          for (const p of data.products) {
            const { id: _, ...pWithoutId } = p;
            await saveProduct(pWithoutId);
            prodCount++;
          }
        }

        if (data.customers && Array.isArray(data.customers)) {
          for (const c of data.customers) {
            const { id: _, ...cWithoutId } = c;
            await saveCustomer(cWithoutId);
            custCount++;
          }
        }

        if (data.suppliers && Array.isArray(data.suppliers)) {
          for (const s of data.suppliers) {
            const { id: _, ...sWithoutId } = s;
            await saveSupplier(sWithoutId);
            suppCount++;
          }
        }

        if (data.settings && typeof data.settings === 'object') {
          Object.entries(data.settings).forEach(([k, v]) => {
            if (typeof v === 'string') localStorage.setItem(k, v);
          });
        }

        playSuccessSound();
        setToast({ 
          message: `✅ تم استيراد واسترجاع بيانات النسخة الاحتياطية بنجاح! (${prodCount} أصناف، ${custCount} عملاء، ${suppCount} موردين)`, 
          type: 'success' 
        });
        setTimeout(() => window.location.reload(), 1500);
      } catch (error: any) {
        playWarningSound();
        setToast({ message: `خطأ أثناء استيراد الملف: ${error.message}`, type: 'warning' });
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Execute Database Wipe / Reset
  const handleExecuteReset = async () => {
    if (!checkAdminPermission()) return;
    if (resetConfirmationInput.trim() !== 'مسح') {
      playWarningSound();
      setToast({ message: 'يرجى كتابة كلمة (مسح) في الخانة المخصصة للتأكيد أولاً', type: 'warning' });
      return;
    }

    setIsResetting(true);
    try {
      await resetSystemDatabase(resetMode);
      playSuccessSound();
      alert(`✅ تم تنفيذ المسح بنجاح! (${
        resetMode === 'full' ? 'تم البدء كنسخة جديدة كلياً' :
        resetMode === 'balances_only' ? 'تم تصفير الأرصدة والكميات مع الاحتفاظ بكتالوج المنتجات والعملاء' :
        'تم مسح سجل وحركات المبيعات والمشتريات فقط'
      })`);
      window.location.reload();
    } catch (e: any) {
      playWarningSound();
      setToast({ message: `خطأ أثناء مسح البيانات: ${e.message}`, type: 'warning' });
    } finally {
      setIsResetting(false);
      setIsResetModalOpen(false);
      setResetConfirmationInput('');
    }
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

  const [isSeeding, setIsSeeding] = useState(false);

  const handleSeedDemoData = async () => {
    try {
      setIsSeeding(true);
      const res = await seedArabicDemoData();
      playSuccessSound();
      setToast({
        message: `✅ تم إضافة البيانات التجريبية بنجاح! تم توليد ${res.productsSeed} منتجاً، ${res.suppliersSeed} مورداً، و ${res.customersSeed} عميلاً.`,
        type: 'success'
      });
      setTimeout(() => {
        window.location.reload();
      }, 2500);
    } catch (err: any) {
      playWarningSound();
      setToast({
        message: `⚠️ حدث خطأ أثناء توليد البيانات التجريبية: ${err.message || err}`,
        type: 'warning'
      });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 max-w-4xl mx-auto space-y-4 pb-28">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <span>⚙️</span>
        <span>إعدادات النظام والضرائب</span>
      </h2>

      {/* Company Setting */}
      <div className="bg-card p-6 rounded-4xl border border-border shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
              <Store className="text-gold" size={20} />
              <span>إدارة الشركات والمؤسسات</span>
            </h3>
            <p className="text-xs text-text-dim mt-1">يمكنك إضافة أكثر من شركة وإدارة بيانات كل واحدة على حدة</p>
          </div>
          <button 
            onClick={() => {
              const name = prompt('أدخل اسم الشركة الجديدة:');
              if (name) saveCompany({ name, isActive: true }).then(() => window.location.reload());
            }} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
          >
            <Plus size={14} />
            إضافة شركة
          </button>
          {companies.some(c => !c.isActive) && (
            <button 
              onClick={() => {
                if (confirm('هل أنت متأكد من حذف جميع الشركات غير النشطة نهائياً؟')) {
                  const inactiveIds = companies.filter(c => !c.isActive).map(c => c.id);
                  Promise.all(inactiveIds.map(id => deleteCompany(id))).then(() => window.location.reload());
                }
              }} 
              className="bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 border border-red-500/20"
            >
              <Trash2 size={14} />
              حذف الشركات غير النشطة
            </button>
          )}
        </div>

        <div className="space-y-4">
          {companies.map(c => (
            <div key={c.id} className={`p-4 rounded-3xl border-2 transition-all flex items-center justify-between ${companyId === c.id ? 'border-gold bg-gold/5' : 'border-border bg-background/50'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${companyId === c.id ? 'bg-gold text-white' : 'bg-card text-text-dim border border-border'}`}>
                  {c.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-text-main">{c.name}</h4>
                    {companyId === c.id && <span className="bg-gold/20 text-gold text-[10px] px-2 py-0.5 rounded-full font-bold">نشطة حالياً</span>}
                    {!c.isActive && <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-bold">غير نشطة</span>}
                  </div>
                  <p className="text-[10px] text-text-dim mt-0.5">ID: {c.id}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    saveCompany({ ...c, isActive: !c.isActive }).then(() => window.location.reload());
                  }}
                  className={`p-2 rounded-xl text-xs font-bold transition-all ${c.isActive ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white'}`}
                  title={c.isActive ? 'إيقاف النشاط' : 'تفعيل الشركة'}
                >
                  {c.isActive ? 'إيقاف' : 'تفعيل'}
                </button>
                {companyId !== c.id && (
                  <button 
                    onClick={() => {
                      setCompanyId(c.id);
                      window.location.reload();
                    }}
                    className="p-2 bg-gold/10 text-gold hover:bg-gold hover:text-white rounded-xl text-xs font-bold transition-all"
                  >
                    تبديل إليها
                  </button>
                )}
                <button 
                  onClick={() => {
                    if (confirm('هل أنت متأكد من حذف هذه الشركة وكل بياناتها؟')) {
                      deleteCompany(c.id).then(() => {
                        if (companyId === c.id) setCompanyId('company_default');
                        window.location.reload();
                      });
                    }
                  }}
                  className="p-2 bg-danger/10 text-danger hover:bg-danger hover:text-white rounded-xl text-xs font-bold transition-all"
                  title="حذف الشركة"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

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

      {/* Treasuries & Warehouses Quick Access Card */}
      <div className="bg-card p-5 rounded-4xl border border-gold/40 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gold/10 p-3 rounded-2xl text-gold border border-gold/30">
            <Vault size={22} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-main">إدارة الخزن النقدية والمخازن المتعددة</h3>
            <p className="text-xs text-text-dim mt-0.5">إضافة خزن نقدية جديدة، مخازن فرعية، وتخصيص أرصدة النظام</p>
          </div>
        </div>
        <button
          onClick={() => setIsTreasuryModalOpen(true)}
          className="bg-gold hover:bg-gold2 text-white px-5 py-2.5 rounded-2xl font-bold text-xs shadow flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap w-full sm:w-auto justify-center"
        >
          <Building2 size={16} />
          <span>➕ إضافة خزن ومخازن جديدة</span>
        </button>
      </div>

      {/* Units Management Quick Access Card */}
      <div className="bg-card p-5 rounded-4xl border border-gold/40 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gold/10 p-3 rounded-2xl text-gold border border-gold/30">
            <Scale size={22} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-main">دليل ووحدات القياس الرسمية (Units Guide)</h3>
            <p className="text-xs text-text-dim mt-0.5">إدارة وتخصيص وحدات القياس الافتراضية للسيستم (قطعة، علبة، كرتونة، كيلو، لتر، طرد...)</p>
          </div>
        </div>
        <button
          onClick={() => setIsUnitsModalOpen(true)}
          className="bg-gold hover:bg-gold2 text-white px-5 py-2.5 rounded-2xl font-bold text-xs shadow flex items-center gap-2 transition-all active:scale-95 whitespace-nowrap w-full sm:w-auto justify-center"
        >
          <Scale size={16} />
          <span>⚙️ إدارة الوحدات المحددة مسبقاً</span>
        </button>
      </div>

      {/* Clear Cache Setting */}
      <div className="bg-card p-5 rounded-4xl border border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
           <h3 className="text-sm font-bold text-red-500">مسح البيانات المؤقتة (Cache)</h3>
           <p className="text-xs text-text-dim mt-1">مسح الكاش والملفات المؤقتة لحل أي بطء مع الحفاظ التام على بيانات PostgreSQL والتفعيل والمستخدمين</p>
        </div>
        <button 
          type="button"
          onClick={async () => {
            try {
              const keysToKeep = [
                'machineID',
                'activationKey',
                'activationDate',
                'currentUser',
                'tenant_company_id',
                'tenant_branch_id',
                'developerPassword',
                'businessName',
                'businessAddress',
                'businessPhone',
                'businessTax',
                'businessLogoUrl',
                'currency',
                'invoiceNotes',
                'taxRate',
                'taxEnabled',
                'taxType',
                'paperSize',
                'showLogo',
                'allowCashierPriceEdit',
                'preventSellBelowCost',
                'requireSupervisorPinForPriceEdit',
                'posDesign',
                'posTouchMode',
                'posPrimaryColor',
                'posButtonSize',
                'posViewMode',
                'theme',
                'managerWhatsApp',
                'managerWhatsAppCountryCode',
                'managerEmail',
                'notify_low_stock',
                'notify_daily_summary',
                'notify_price_override',
                'notify_purchase',
                'notify_preferred_method'
              ];
              const backup: { [key: string]: string } = {};
              keysToKeep.forEach(k => {
                const v = localStorage.getItem(k);
                if (v !== null) backup[k] = v;
              });
              
              localStorage.clear();
              
              Object.entries(backup).forEach(([k, v]) => {
                localStorage.setItem(k, v);
              });
              
              sessionStorage.clear();

              if ('caches' in window) {
                try {
                  const cacheKeys = await caches.keys();
                  await Promise.all(cacheKeys.map(key => caches.delete(key)));
                } catch (e) {
                  console.warn('Cache storage clear warning:', e);
                }
              }

              setToast({ message: 'تم مسح البيانات المؤقتة (Cache) بنجاح', type: 'success' });
              playSuccessSound();
              setTimeout(() => {
                window.location.reload();
              }, 600);
            } catch (err) {
              console.error('Error clearing cache:', err);
              window.location.reload();
            }
          }}
          className="bg-red-600 text-white px-4 py-2.5 rounded-2xl font-bold hover:opacity-90 transition-opacity active:scale-95 text-xs shadow-md"
        >
           🗑️ مسح البيانات المؤقتة
        </button>
      </div>

      {/* Demo Data Seeding */}
      <div className="bg-card p-5 rounded-4xl border border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
           <h3 className="text-sm font-bold text-blue-600 dark:text-blue-400">🎁 إضافة بيانات تجريبية (أصناف وموردين وعملاء)</h3>
           <p className="text-xs text-text-dim mt-1">توليد بيانات محاسبية تجريبية فورية لتجربة ميزات النظام والبيع السريع بضغطة واحدة</p>
        </div>
        <button
          onClick={handleSeedDemoData}
          disabled={isSeeding}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-2xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {isSeeding ? '⏳ جاري إضافة البيانات...' : '⚡ إضافة بيانات تجريبية'}
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
        <button onClick={handleSaveBusiness} className="w-full bg-gold hover:bg-gold2 text-white p-3 rounded-2xl font-bold transition-all shadow-md">💾 حفظ بيانات المنشأة</button>
      </div>
      
      {/* =========================================================
          MANAGER WHATSAPP & EMAIL NOTIFICATION HUB (مركز تنبيهات المدير)
          ========================================================= */}
      <div className="bg-card p-5 rounded-4xl border border-border mb-4 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black flex items-center gap-2">
                <span>مركز تنبيهات واتساب والبريد الإلكتروني للمدير</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full font-bold">
                  إشعارات فورية
                </span>
              </h3>
              <p className="text-xs text-text-dim">إرسال تقارير المبيعات اليومية ونواقص المخزون والتنبيهات الحساسة للمدير</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              type="button"
              onClick={checkServerStatus}
              className="text-[11px] bg-card2 hover:bg-slate-700 text-text-dim hover:text-white px-2.5 py-1 rounded-xl border border-border flex items-center gap-1 transition-all"
              title="تحديث حالة الخوادم"
            >
              <RefreshCw size={11} />
              <span>فحص الاتصال</span>
            </button>
          </div>
        </div>

        {/* Informative Explanation Banner */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-800 dark:text-emerald-200 leading-relaxed">
          <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-emerald-900 dark:text-emerald-300">طريقة عمل الإشعارات (مباشرة 100% وتلقائية):</p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-200/90">
              • <strong>واتساب المباشر (Direct WhatsApp):</strong> يعمل فوراً وبدون أي اشتراكات أو خوادم خارجية — يفتح محادثة واتساب منسقة بضغطة زر أو نافذة سريعة عند حدوث نقص مخزون أو تقفيل الوردية.
              <br />
              • <strong>الإرسال التلقائي عبر السيرفر:</strong> يدعم خادم Twilio لواتساب وخادم SMTP للبريد الإلكتروني عند توفر بيانات الربط.
            </p>
          </div>
        </div>

        {/* WhatsApp & Email Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* WhatsApp Phone Number */}
          <div className="bg-card2 p-3.5 rounded-2xl border border-border space-y-2">
            <label className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
              <Smartphone size={15} />
              <span>رقم واتساب المدير (لاستقبال التنبيهات):</span>
            </label>
            <div className="flex gap-1.5">
              <select
                value={managerWhatsAppCountryCode}
                onChange={e => setManagerWhatsAppCountryCode(e.target.value)}
                className="bg-card border border-border p-2.5 rounded-xl text-xs font-mono font-bold w-28 text-center"
              >
                <option value="+20">🇪🇬 مصر (+20)</option>
                <option value="+966">🇸🇦 السعودية (+966)</option>
                <option value="+971">🇦🇪 الإمارات (+971)</option>
                <option value="+965">🇰🇼 الكويت (+965)</option>
                <option value="+974">🇶🇦 قطر (+974)</option>
                <option value="+968">🇴🇲 عمان (+968)</option>
                <option value="+962">🇯🇴 الأردن (+962)</option>
                <option value="+964">🇮🇶 العراق (+964)</option>
                <option value="+218">🇱🇾 ليبيا (+218)</option>
                <option value="+249">🇸🇩 السودان (+249)</option>
                <option value="+970">🇵🇸 فلسطين (+970)</option>
                <option value="+961">🇱🇧 لبنان (+961)</option>
                <option value="+212">🇲🇦 المغرب (+212)</option>
                <option value="+213">🇩🇿 الجزائر (+213)</option>
                <option value="+216">🇹🇳 تونس (+216)</option>
                <option value="+1">🇺🇸 أمريكا / كندا (+1)</option>
                <option value="+44">🇬🇧 بريطانيا (+44)</option>
              </select>
              <input
                type="tel"
                placeholder="مثال: 01012345678"
                value={managerWhatsApp}
                onChange={e => setManagerWhatsApp(e.target.value)}
                className="bg-card border border-border p-2.5 rounded-xl flex-1 text-xs font-mono font-bold"
              />
            </div>
            {managerWhatsApp.trim() && (
              <p className="text-[10px] text-text-dim flex items-center gap-1 font-mono">
                <span>الصيغة الدولية:</span>
                <span className="text-emerald-400 font-bold">
                  +{formatWhatsAppPhoneNumber(managerWhatsApp, managerWhatsAppCountryCode)}
                </span>
              </p>
            )}
          </div>

          {/* Manager Email */}
          <div className="bg-card2 p-3.5 rounded-2xl border border-border space-y-2">
            <label className="text-xs font-bold flex items-center gap-1.5 text-blue-400">
              <Mail size={15} />
              <span>البريد الإلكتروني للمدير (Email Alerts):</span>
            </label>
            <input
              type="email"
              placeholder="manager@my-company.com"
              value={managerEmail}
              onChange={e => setManagerEmail(e.target.value)}
              className="bg-card border border-border p-2.5 rounded-xl w-full text-xs font-mono"
            />
            <p className="text-[10px] text-text-dim">
              يستخدم لإرسال التقارير اليومية وتنبيهات نقص المخزون عبر البريد.
            </p>
          </div>
        </div>

        {/* Notification Types (Toggles) */}
        <div>
          <label className="block text-xs font-bold text-text-dim mb-2">أنواع الإشعارات المراد إرسالها:</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex items-center justify-between gap-2 bg-card2 p-3 rounded-2xl border border-border cursor-pointer hover:border-emerald-500/40 transition-all text-xs">
              <div className="space-y-0.5">
                <span className="font-bold flex items-center gap-1.5 text-rose-400">
                  <span>🚨</span>
                  <span>تنبيه نقص المخزون الحرج</span>
                </span>
                <p className="text-[10px] text-text-dim">عندما يصل رصيد المنتج للحد الأدنى (حد الطلب)</p>
              </div>
              <input
                type="checkbox"
                checked={notifyLowStock}
                onChange={e => setNotifyLowStock(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 accent-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between gap-2 bg-card2 p-3 rounded-2xl border border-border cursor-pointer hover:border-emerald-500/40 transition-all text-xs">
              <div className="space-y-0.5">
                <span className="font-bold flex items-center gap-1.5 text-amber-400">
                  <span>📊</span>
                  <span>تقرير المبيعات والوردية اليومي</span>
                </span>
                <p className="text-[10px] text-text-dim">ملخص الإيراد والأرباح عند تقفيل الوردية أو نهاية اليوم</p>
              </div>
              <input
                type="checkbox"
                checked={notifyDailySummary}
                onChange={e => setNotifyDailySummary(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 accent-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between gap-2 bg-card2 p-3 rounded-2xl border border-border cursor-pointer hover:border-emerald-500/40 transition-all text-xs">
              <div className="space-y-0.5">
                <span className="font-bold flex items-center gap-1.5 text-yellow-400">
                  <span>⚠️</span>
                  <span>تنبيه تعديل الأسعار بالكاشير</span>
                </span>
                <p className="text-[10px] text-text-dim">عند بيع صنف بسعر معدل أو تجاوز سعر التكلفة</p>
              </div>
              <input
                type="checkbox"
                checked={notifyPriceOverride}
                onChange={e => setNotifyPriceOverride(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 accent-emerald-500"
              />
            </label>

            <label className="flex items-center justify-between gap-2 bg-card2 p-3 rounded-2xl border border-border cursor-pointer hover:border-emerald-500/40 transition-all text-xs">
              <div className="space-y-0.5">
                <span className="font-bold flex items-center gap-1.5 text-blue-400">
                  <span>📦</span>
                  <span>تنبيه فواتير المشتريات والتوريد</span>
                </span>
                <p className="text-[10px] text-text-dim">عند تسجيل فاتورة شراء جديدة أو إدخال بضاعة للمخزن</p>
              </div>
              <input
                type="checkbox"
                checked={notifyPurchase}
                onChange={e => setNotifyPurchase(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 accent-emerald-500"
              />
            </label>
          </div>
        </div>

        {/* Server Status Summary Badge */}
        <div className="bg-card2 p-3 rounded-2xl border border-border flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-text-dim">حالة قنوات الإرسال:</span>
            <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-lg font-bold text-[11px] border border-emerald-500/20">
              <Check size={12} />
              <span>واتساب المباشر: جاهز ومفعل 🟢</span>
            </span>
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold text-[11px] border ${serverDiagnostic?.twilioConfigured ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-text-dim border-border'}`}>
              {serverDiagnostic?.twilioConfigured ? <Check size={12} /> : <X size={12} />}
              <span>خادم Twilio WhatsApp: {serverDiagnostic?.twilioConfigured ? 'متصل' : 'غير مهيأ'}</span>
            </span>
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-lg font-bold text-[11px] border ${serverDiagnostic?.smtpConfigured ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-text-dim border-border'}`}>
              {serverDiagnostic?.smtpConfigured ? <Check size={12} /> : <X size={12} />}
              <span>خادم SMTP البريد: {serverDiagnostic?.smtpConfigured ? 'متصل' : 'غير مهيأ'}</span>
            </span>
          </div>
        </div>

        {/* Live Testing & Action Buttons */}
        <div className="space-y-2 pt-1">
          <label className="block text-xs font-bold text-text-dim">أدوات الفحص والتجربة المباشرة:</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Direct WhatsApp Test Button */}
            <button
              type="button"
              onClick={handleDirectWhatsAppTest}
              className="bg-emerald-600 hover:bg-emerald-500 text-white p-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98"
            >
              <ExternalLink size={14} />
              <span>تجربة واتساب مباشر (ويب/موبايل) 📱</span>
            </button>

            {/* Server WhatsApp Test Button */}
            <button
              type="button"
              onClick={handleServerWhatsAppTest}
              disabled={isTestingWhatsApp}
              className="bg-card2 hover:bg-slate-700 text-emerald-400 border border-emerald-500/40 p-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Send size={14} />
              <span>{isTestingWhatsApp ? 'جاري فحص Twilio...' : 'فحص إرسال Twilio السيرفر 🚀'}</span>
            </button>

            {/* Email Test Button */}
            <button
              type="button"
              onClick={handleServerEmailTest}
              disabled={isTestingEmail}
              className="bg-card2 hover:bg-slate-700 text-blue-400 border border-blue-500/40 p-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Mail size={14} />
              <span>{isTestingEmail ? 'جاري إرسال البريد...' : 'فحص إرسال الإيميل التجريبي ✉️'}</span>
            </button>
          </div>

          {/* Test Result Message Box */}
          {testResult && (
            <div className={`p-3 rounded-2xl border text-xs flex items-start gap-2 animate-fadeIn ${testResult.success ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-300' : 'bg-amber-500/10 border-amber-500/40 text-amber-800 dark:text-amber-300'}`}>
              {testResult.success ? <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />}
              <div className="flex-1">
                <p className="font-bold">{testResult.success ? 'نتيجة الفحص ناجحة:' : 'تنبيه الفحص والتشخيص:'}</p>
                <p className="text-[11px] mt-0.5 leading-relaxed">{testResult.message}</p>
              </div>
            </div>
          )}
        </div>

        {/* Save Notifications Button */}
        <button
          type="button"
          onClick={handleSaveNotifications}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white p-3.5 rounded-2xl font-black transition-all shadow-lg active:scale-98 flex items-center justify-center gap-2"
        >
          <span>💾</span>
          <span>حفظ إعدادات تنبيهات واتساب والإيميل للمدير</span>
        </button>
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
              onChange={e => {
                const checked = e.target.checked;
                setTaxEnabled(checked);
                localStorage.setItem('taxEnabled', checked.toString());
                window.dispatchEvent(new Event('taxSettingsUpdated'));
              }} 
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

      {/* =========================================================
          POS CUSTOMIZATION & THEME SETTINGS (تخصيص واجهة وألوان وأحجام أزرار POS)
          ========================================================= */}
      <div className="bg-card p-5 rounded-4xl border border-border mb-4 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gold/20 text-gold flex items-center justify-center font-bold">
              <Palette size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black flex items-center gap-2 text-text-main">
                <span>تخصيص واجهة وألوان وأحجام أزرار شاشة البيع (POS)</span>
                <span className="text-[10px] bg-gold/20 text-gold px-2.5 py-0.5 rounded-full font-bold">
                  تحكم كامل بالمظهر
                </span>
              </h3>
              <p className="text-xs text-text-dim">تعديل التصميم الرئيسي، وضع اللمس، حجم الأزرار، ونمط العرض للمتجر</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSavePosCustomization}
            className="bg-gold hover:bg-gold2 text-black px-4 py-2 rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-1.5 self-end sm:self-auto active:scale-98"
          >
            <span>💾</span>
            <span>حفظ تخصيصات الشاشة</span>
          </button>
        </div>

        {/* 1. POS Layout Gallery (معرض أشكال الواجهة) */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
            <Layout size={15} className="text-gold" />
            <span>معرض خيارات واجهة شاشة البيع (POS Layout Gallery):</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                id: 'emerald' as POSDesignType,
                title: 'تصميم الشبكة الحديث',
                desc: 'شكل الزمردي الحديث مع أزرار لمس كبيرة وبطاقة سريعة',
                icon: Sparkles,
                badge: 'الحديث ✨',
                color: 'border-emerald-500 text-emerald-400 bg-emerald-500/10'
              },
              {
                id: 'classic' as POSDesignType,
                title: 'القائمة الكلاسيكية',
                desc: 'النمط المكتبي الشامل للهايبر ماركت مع التركيز على الباركود',
                icon: Monitor,
                badge: 'ERP المكتبي',
                color: 'border-blue-500 text-blue-400 bg-blue-500/10'
              },
              {
                id: 'touch' as POSDesignType,
                title: 'تصميم الإدخال السريع',
                desc: 'شاشة لمس فائقة السرعة بلمسة واحدة بدون لوحة مفاتيح',
                icon: Zap,
                badge: 'التاتش السريع',
                color: 'border-amber-500 text-amber-400 bg-amber-500/10'
              },
              {
                id: 'dark' as POSDesignType,
                title: 'التصميم الليلي الفاخر',
                desc: 'واجهة داكنة مريحة مع تفاصيل ذهبية أنيقة ونوافق نيون',
                icon: Moon,
                badge: 'الوضع الليلي',
                color: 'border-gold text-gold bg-gold/10'
              }
            ].map((layout) => {
              const isSelected = posDesign === layout.id;
              const IconComponent = layout.icon;

              return (
                <div
                  key={layout.id}
                  onClick={() => setPosDesign(layout.id)}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-gold bg-gold/10 shadow-md scale-[1.02]'
                      : 'border-border bg-card2 hover:border-text-dim/50'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-xl bg-card">
                        <IconComponent size={18} className={isSelected ? 'text-gold' : 'text-text-dim'} />
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${layout.color}`}>
                        {layout.badge}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-xs font-black text-text-main flex items-center justify-between">
                        <span>{layout.title}</span>
                        {isSelected && <Check size={14} className="text-gold font-bold" />}
                      </h4>
                      <p className="text-[10px] text-text-dim leading-relaxed mt-1">{layout.desc}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Touch-Friendly Mode & View Mode Switcher */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {/* Touch Mode Toggle */}
          <label className="flex items-start justify-between gap-3 p-3.5 bg-card2 rounded-2xl border border-border cursor-pointer hover:border-gold/40 transition-all">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs text-text-main">
                <MousePointer size={16} className="text-gold" />
                <span>وضع 'اللمس المكثف' (Touch-Friendly Mode)</span>
              </div>
              <p className="text-[11px] text-text-dim pr-6 leading-relaxed">
                تكبير مناطق النقر (Hit-areas) وزيادة المسافات بين أزرار الأصناف لتسهيل استخدام الشاشات اللمسية والأصابع بدون أخطاء.
              </p>
            </div>
            <input
              type="checkbox"
              checked={posTouchMode}
              onChange={e => setPosTouchMode(e.target.checked)}
              className="mt-1 rounded w-5 h-5 text-gold accent-gold cursor-pointer flex-shrink-0"
            />
          </label>

          {/* View Mode Switcher (Grid vs Compact List) */}
          <div className="p-3.5 bg-card2 rounded-2xl border border-border space-y-2">
            <label className="block text-xs font-bold text-text-main flex items-center gap-1.5">
              <Layout size={15} className="text-gold" />
              <span>ترتيب وعرض الأصناف (Layout Switcher):</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPosViewMode('image-grid')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  posViewMode === 'image-grid'
                    ? 'bg-gold text-black border-gold shadow-sm'
                    : 'bg-card text-text-dim border-border hover:text-text-main'
                }`}
              >
                <Grid size={14} />
                <span>نمط صورة المنتج (Grid)</span>
              </button>

              <button
                type="button"
                onClick={() => setPosViewMode('compact-list')}
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  posViewMode === 'compact-list'
                    ? 'bg-gold text-black border-gold shadow-sm'
                    : 'bg-card text-text-dim border-border hover:text-text-main'
                }`}
              >
                <List size={14} />
                <span>القائمة المختصرة (List)</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Button Size according to Shop Nature */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-text-main block">
            أحجام أزرار المنتجات وحجم الأيقونات (لتتناسب مع طبيعة المتجر):
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              {
                id: 'small' as const,
                title: '🛒 صغير / مكثف (Hypermarket)',
                desc: 'أزرار صغيرة مدمجة تناسب السوبر ماركت والهايبر ذات الأصناف الكثيرة جداً'
              },
              {
                id: 'medium' as const,
                title: '🏪 متوسط / متوازن (General Retail)',
                desc: 'الحجم الافتراضي المعتمد للمحلات التجارية العامة والمتاجر'
              },
              {
                id: 'large' as const,
                title: '👕 كبير / لمس ممتاز (Clothing & Cafe)',
                desc: 'أزرار كبيرة بمساحة لمس واسعة تناسب محلات الملابس والمطاعم والكافيهات'
              }
            ].map((btnOption) => (
              <button
                key={btnOption.id}
                type="button"
                onClick={() => setPosButtonSize(btnOption.id)}
                className={`p-3 rounded-2xl border text-right transition-all ${
                  posButtonSize === btnOption.id
                    ? 'border-gold bg-gold/10 font-bold text-text-main'
                    : 'border-border bg-card2 text-text-dim hover:border-text-dim/40'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <span>{posButtonSize === btnOption.id ? '🔘' : '⚪'}</span>
                  <span>{btnOption.title}</span>
                </div>
                <p className="text-[10px] text-text-dim pr-5 leading-relaxed">{btnOption.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 4. POS Theme Colors */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-text-main block">اللون الأساسي لشاشة البيع (POS Primary Theme Color):</label>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'emerald', name: 'الزمردي (الأخضر)', bg: 'bg-emerald-600' },
              { id: 'blue', name: 'الأزرق الملكي', bg: 'bg-blue-600' },
              { id: 'gold', name: 'الذهبي / العنبر', bg: 'bg-amber-500' },
              { id: 'rose', name: 'الياقوتي (الأحمر)', bg: 'bg-rose-600' },
              { id: 'slate', name: 'الداكن الأنيق', bg: 'bg-slate-700' }
            ].map((colorObj) => (
              <button
                key={colorObj.id}
                type="button"
                onClick={() => setPosPrimaryColor(colorObj.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                  posPrimaryColor === colorObj.id
                    ? 'border-gold bg-card shadow-md text-text-main'
                    : 'border-border bg-card2 text-text-dim hover:text-text-main'
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded-full ${colorObj.bg}`} />
                <span>{colorObj.name}</span>
                {posPrimaryColor === colorObj.id && <Check size={12} className="text-gold" />}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSavePosCustomization}
          className="w-full bg-gold hover:bg-gold2 text-black p-3.5 rounded-2xl font-black transition-all shadow-md flex items-center justify-center gap-2 active:scale-98"
        >
          <span>💾</span>
          <span>حفظ وتطبيق إعدادات شاشة البيع الآن</span>
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
      <div className="bg-card p-5 rounded-4xl border border-border mb-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">💾</span>
            <div>
              <h3 className="text-sm font-bold text-text-main">النسخ الاحتياطي ومسح وإعادة ضبط البيانات</h3>
              <p className="text-xs text-text-dim">تصدير النسخة الاحتياطية وإعادة تعيين قاعدة البيانات بخيارات متعددة</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Export Full Backup */}
          <button
            type="button"
            onClick={handleExportBackup}
            disabled={isExporting}
            className="bg-blue-600 hover:bg-blue-500 text-white p-3.5 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md active:scale-98 disabled:opacity-50"
          >
            <Download size={16} />
            <span>{isExporting ? 'جاري تصدير النسخة الاحتياطية...' : 'تصدير نسخة احتياطية كاملة (JSON)'}</span>
          </button>

          {/* Import Backup */}
          <input type="file" ref={fileInputRef} onChange={handleImportBackup} accept=".json" className="hidden" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white p-3.5 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md active:scale-98 disabled:opacity-50"
          >
            <Upload size={16} />
            <span>{isImporting ? 'جاري استيراد النسخة...' : 'استيراد واسترجاع نسخة احتياطية (JSON)'}</span>
          </button>
        </div>

        {/* Clear & Reset Database Button */}
        <button
          type="button"
          onClick={() => {
            if (checkAdminPermission()) {
              setIsResetModalOpen(true);
            }
          }}
          className="w-full bg-red-600/90 hover:bg-red-600 text-white p-3.5 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-md active:scale-98 border border-red-500/30"
        >
          <Trash2 size={16} />
          <span>مسح وإعادة ضبط قاعدة البيانات والسيستم (Wipe & Reset)</span>
        </button>
      </div>

      {/* Database Reset Interactive Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-card max-w-xl w-full max-h-[92vh] overflow-y-auto rounded-3xl border border-red-500/40 p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 my-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3 sticky top-0 bg-card z-10 pt-1">
              <div className="flex items-center gap-2 text-red-400">
                <Trash2 size={22} />
                <h3 className="text-base sm:text-lg font-black">خيارات مسح وإعادة ضبط قاعدة البيانات</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="p-1.5 rounded-xl bg-card2 hover:bg-border text-text-dim"
              >
                <X size={18} />
              </button>
            </div>

            {/* Explanation Warning */}
            <div className="bg-red-500/10 border border-red-500/30 p-3.5 rounded-2xl text-xs text-red-200 leading-relaxed space-y-1">
              <p className="font-bold text-red-300 flex items-center gap-1.5">
                <AlertTriangle size={16} />
                <span>تنبيه هام جداً قبل المسح:</span>
              </p>
              <p>
                اختر نوع المسح المطلوب بعناية. نوصي بتصدير نسخة احتياطية (JSON) قبل متابعة العملية.
              </p>
            </div>

            {/* Reset Options Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-main block">اختر نوع المسح المطلوب تنفيذها:</label>
              
              <div className="space-y-2">
                {/* Mode 1: Full Wipe */}
                <button
                  type="button"
                  onClick={() => setResetMode('full')}
                  className={`w-full p-3.5 rounded-2xl border text-right transition-all flex items-start gap-3 ${
                    resetMode === 'full'
                      ? 'border-red-500 bg-red-500/15 font-bold text-text-main'
                      : 'border-border bg-card2 text-text-dim hover:border-red-500/40'
                  }`}
                >
                  <span className="text-lg">🔴</span>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-black text-red-400">1. مسح كامل كنسخة جديدة (Full System Wipe)</h4>
                    <p className="text-[11px] text-text-dim leading-relaxed">
                      مسح كافة المنتجات، المبيعات، العملاء، الموردين، والأنشطة كلياً كأنك تستخدم النظام لأول مرة.
                    </p>
                  </div>
                </button>

                {/* Mode 2: Reset Balances Only */}
                <button
                  type="button"
                  onClick={() => setResetMode('balances_only')}
                  className={`w-full p-3.5 rounded-2xl border text-right transition-all flex items-start gap-3 ${
                    resetMode === 'balances_only'
                      ? 'border-amber-500 bg-amber-500/15 font-bold text-text-main'
                      : 'border-border bg-card2 text-text-dim hover:border-amber-500/40'
                  }`}
                >
                  <span className="text-lg">🟡</span>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-black text-amber-400">2. مسح الأرصدة والكميات فقط (Reset Stock & Accounts)</h4>
                    <p className="text-[11px] text-text-dim leading-relaxed">
                      تصفير كميات المنتجات بالمخزن وأرصدة العملاء والموردين، وحذف سجل المبيعات، مع <strong>حفظ قائمة الأصناف وأسماء العملاء</strong>.
                    </p>
                  </div>
                </button>

                {/* Mode 3: Reset Sales & Purchases History Only */}
                <button
                  type="button"
                  onClick={() => setResetMode('sales_purchases_only')}
                  className={`w-full p-3.5 rounded-2xl border text-right transition-all flex items-start gap-3 ${
                    resetMode === 'sales_purchases_only'
                      ? 'border-blue-500 bg-blue-500/15 font-bold text-text-main'
                      : 'border-border bg-card2 text-text-dim hover:border-blue-500/40'
                  }`}
                >
                  <span className="text-lg">🔵</span>
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-black text-blue-400">3. مسح حركات المبيعات والمشتريات فقط (Transaction History Only)</h4>
                    <p className="text-[11px] text-text-dim leading-relaxed">
                      حذف سجل الفواتير والمبيعات والمشتريات فقط، مع <strong>الحفاظ الكامل على الأصناف والكميات الحالية بالمخزن والأرصدة</strong>.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Confirmation input */}
            <div className="space-y-1 pt-2 border-t border-border">
              <label className="text-xs font-bold text-text-main block">
                للتأكيد النهائي، اكتب كلمة <code className="text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded">مسح</code> في الخانة التالية:
              </label>
              <input
                type="text"
                placeholder="اكتب كلمة: مسح"
                value={resetConfirmationInput}
                onChange={e => setResetConfirmationInput(e.target.value)}
                className="w-full bg-card2 border border-border p-3 rounded-2xl text-xs font-bold text-center text-red-400 focus:border-red-500"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={isResetting || resetConfirmationInput.trim() !== 'مسح'}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white p-3.5 rounded-2xl font-black text-xs transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-lg"
              >
                <Trash2 size={16} />
                <span>{isResetting ? 'جاري تنفيذ المسح...' : 'تأكيد وتنفيذ المسح الآن'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-5 bg-card2 hover:bg-border text-text-main p-3.5 rounded-2xl font-bold text-xs transition-all border border-border"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
      
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

            {/* AI Co-pilot Configuration Section (Optional/Modular) */}
            <div className="bg-card p-6 rounded-[32px] border border-gold/30 space-y-6 shadow-xl shadow-gold/5 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gold/10 rounded-2xl text-gold">
                    <BrainCircuit size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-text-main">مديول المساعد الذكي (AI Co-pilot)</h3>
                    <p className="text-xs text-text-dim">إعدادات تفعيل مديول الذكاء الاصطناعي التفاعلي</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={aiEnabled}
                    onChange={(e) => setAiEnabled(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-14 h-7 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold"></div>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-text-main">مفتاح تفعيل الذكاء الاصطناعي (License Key):</label>
                  <div className="relative">
                    <input 
                      type="password" 
                      value={aiLicenseKey}
                      onChange={(e) => setAiLicenseKey(e.target.value)}
                      placeholder="AI-XXXX-XXXX-XXXX"
                      className="w-full bg-card2 border border-border rounded-2xl py-3 px-4 text-sm focus:border-gold outline-none transition-all pr-12"
                    />
                    <Zap className="absolute right-4 top-3.5 text-gold/50" size={18} />
                  </div>
                  <p className="text-[10px] text-text-dim italic">
                    * هذا المديول يتطلب اشتراكاً منفصلاً ومفتاح تفعيل خاص لربط النظام بـ Google Gemini 2.0 Central.
                  </p>
                </div>

                <div className="bg-gold/5 border border-gold/20 p-4 rounded-2xl space-y-3">
                  <h4 className="text-xs font-bold text-gold flex items-center gap-2">
                    <Sparkles size={14} />
                    <span>مميزات المديول النشطة:</span>
                  </h4>
                  <ul className="text-[11px] text-text-dim space-y-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      <span>تحليل سجلات الأخطاء والـ Telemetry لحظياً.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      <span>توفير جولات تعريفية (Onboarding) بناءً على دور المستخدم.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      <span>التنبؤ بالأعطال التقنية قبل وقوعها.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveAiConfig}
                disabled={isSavingAi}
                className="w-full bg-gold text-black p-4 rounded-2xl font-black text-sm shadow-lg shadow-gold/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSavingAi ? <RefreshCw className="animate-spin" size={20} /> : <Wand2 size={20} />}
                <span>حفظ وتفعيل إعدادات الذكاء الاصطناعي</span>
              </button>
            </div>

            {/* Developer Keygen Suite Component */}
            <div className="border-t border-border pt-4">
              <DeveloperKeygenSuite />
            </div>

            <button onClick={handleSaveType} className="w-full bg-green-600 hover:bg-green-500 text-white p-3.5 rounded-2xl font-bold transition-all shadow-md">
              💾 حفظ إعدادات النشاط والموديلات
            </button>
          </div>
        )}
      </div>

      {/* Treasury & Warehouse Modal */}
      <TreasuryWarehouseModal
        isOpen={isTreasuryModalOpen}
        onClose={() => setIsTreasuryModalOpen(false)}
      />

      {/* Units Manager Modal */}
      <UnitsModal
        isOpen={isUnitsModalOpen}
        onClose={() => setIsUnitsModalOpen(false)}
      />
    </div>
  );
}
