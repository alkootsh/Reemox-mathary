import React, { useState, useEffect } from 'react';
import { CashierSession, Sale, Expense, AppUser } from '../types/types';
import { getCashierSessions, openCashierSession, closeCashierSession, getSales, getExpenses, getUsers, getUserPreferences } from '../lib/firestoreService';
import { getTreasuries, getWarehouses, Treasury, Warehouse } from '../lib/treasuryWarehouseService';
import { 
  ShieldAlert, 
  CheckCircle2, 
  DollarSign, 
  Lock, 
  Unlock, 
  FileText, 
  RefreshCw, 
  MessageSquare, 
  Camera, 
  Video, 
  Eye, 
  Zap, 
  Printer, 
  Clock, 
  AlertTriangle,
  Play,
  Maximize2,
  Activity,
  Vault,
  Store,
  Sliders
} from 'lucide-react';
import { getNotificationConfig, openDirectWhatsAppChat } from '../lib/notifications';
import { playSuccessSound } from '../lib/sound';
import { useTenant } from '../context/TenantContext';
import ColumnManagerModal from './ColumnManagerModal';
import { SHIFTS_COLUMNS, SHIFTS_DEFAULT_VISIBLE } from '../lib/columns';

interface CashierSessionViewProps {
  sessions: CashierSession[];
  sales: Sale[];
  expenses: Expense[];
}

export default function CashierSessionView({ sessions, sales, expenses }: CashierSessionViewProps) {
  const { currentUser } = useTenant();
  const [activeTab, setActiveTab] = useState<'shifts' | 'cameras'>('shifts');
  const [sessionsData, setSessionsData] = useState<CashierSession[]>(sessions);
  const [activeSession, setActiveSession] = useState<CashierSession | null>(null);
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [actualCashInput, setActualCashInput] = useState('');
  const [cashierName, setCashierName] = useState('الكاشير الرئيسي');
  const [cashierId, setCashierId] = useState('usr-cashier');

  // Column Customization
  const [visibleKeys, setVisibleKeys] = useState<string[]>(SHIFTS_DEFAULT_VISIBLE);
  const [orderedKeys, setOrderedKeys] = useState<string[]>(() => SHIFTS_COLUMNS.map(c => c.key));
  const [showColModal, setShowColModal] = useState<boolean>(false);

  // Treasury & Warehouse linking state
  const [users, setUsers] = useState<AppUser[]>([]);
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedTreasuryId, setSelectedTreasuryId] = useState<string>('treasury-main');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('wh-main');

  // CCTV State
  const [selectedCam, setSelectedCam] = useState<number>(1);
  const [securityLog, setSecurityLog] = useState<Array<{ time: string; cam: string; event: string; status: 'info' | 'warning' | 'alert' }>>([
    { time: '10:15:22 AM', cam: 'كاميرا 01 (الدرج)', event: 'فتح درج النقدية بالماكينة تلقائياً بالفاتورة #INV-CSH1-0001', status: 'info' },
    { time: '11:42:05 AM', cam: 'كاميرا 04 (الخزينة)', event: 'رصد كشف غطاء الخزينة الرئيسية لتغذية النقدية', status: 'info' },
    { time: '01:20:10 PM', cam: 'كاميرا 01 (الدرج)', event: 'تخصيم صنف مرتجع بقيمة 180 ج.م بطلب كاشير', status: 'warning' },
    { time: '02:05:40 PM', cam: 'كاميرا 02 (المدخل)', event: 'حركة دخول مكثفة للعملاء بمنطقة الكاشير', status: 'info' },
  ]);
  const [snapshots, setSnapshots] = useState<string[]>([]);

  // Filters for History
  const [filterDate, setFilterDate] = useState('');
  const [filterCashier, setFilterCashier] = useState('all');
  const [showDailyConsolidated, setShowDailyConsolidated] = useState(false);
  const [consolidatedDate, setConsolidatedDate] = useState(new Date().toISOString().split('T')[0]);

  // Shift Transaction Advanced Filters
  const [txFilterCashier, setTxFilterCashier] = useState('all');
  const [txFilterCustomer, setTxFilterCustomer] = useState('all');
  const [txFilterPaymentMethod, setTxFilterPaymentMethod] = useState('all');
  const [txFilterCamera, setTxFilterCamera] = useState('all');
  const [txFilterSessionId, setTxFilterSessionId] = useState('all');

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const userEmail = currentUser?.email || currentUser?.username || 'admin';
        const prefs = await getUserPreferences(userEmail, 'shifts');
        if (prefs && prefs.visible && prefs.order) {
          setVisibleKeys(prefs.visible);
          setOrderedKeys(prefs.order);
        }
      } catch (err) {
        console.warn('Failed to load shifts preferences', err);
      }
    };
    loadPrefs();
  }, [currentUser]);

  useEffect(() => {
    setSessionsData(sessions);
    const active = sessions.find(s => s.status === 'ACTIVE' || s.status === 'OPEN');
    setActiveSession(active || null);
    
    // Load registered users, treasuries, and warehouses
    getUsers().then(uList => {
      setUsers(uList);
      if (uList.length > 0) {
        const first = uList[0];
        setCashierId(first.id);
        setCashierName(first.name);
        if (first.treasuryId) setSelectedTreasuryId(first.treasuryId);
        if (first.warehouseId) setSelectedWarehouseId(first.warehouseId);
      }
    });
    setTreasuries(getTreasuries());
    setWarehouses(getWarehouses());
  }, [sessions]);

  const handleCashierSelect = (uId: string) => {
    setCashierId(uId);
    const found = users.find(u => u.id === uId);
    if (found) {
      setCashierName(found.name);
      if (found.treasuryId) setSelectedTreasuryId(found.treasuryId);
      if (found.warehouseId) setSelectedWarehouseId(found.warehouseId);
    }
  };

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(openingCashInput);
    if (isNaN(amount) || amount < 0) return alert('يرجى إدخال مبلغ افتتاح صحيح');

    const selectedUser = users.find(u => u.id === cashierId);
    const selectedTreasuryObj = treasuries.find(t => t.id === selectedTreasuryId);
    const selectedWarehouseObj = warehouses.find(w => w.id === selectedWarehouseId);

    const targetTreasuryId = selectedUser?.treasuryId || selectedTreasuryId || 'treasury-main';
    const targetTreasuryName = selectedUser?.treasuryName || selectedTreasuryObj?.name || 'الخزنة الرئيسية';
    const targetWarehouseId = selectedUser?.warehouseId || selectedWarehouseId || 'wh-main';
    const targetWarehouseName = selectedUser?.warehouseName || selectedWarehouseObj?.name || 'المخزن الرئيسي';

    try {
      await openCashierSession(
        amount, 
        cashierId, 
        cashierName,
        targetTreasuryId,
        targetTreasuryName,
        targetWarehouseId,
        targetWarehouseName
      );
      setOpeningCashInput('');
      playSuccessSound();
      
      // Log CCTV security event
      setSecurityLog(prev => [
        { 
          time: new Date().toLocaleTimeString('ar-EG'), 
          cam: 'كاميرا 01 (الدرج)', 
          event: `فتح وردية جديدة بواسطة الكاشير (${cashierName}) على ${targetTreasuryName} ومخزن (${targetWarehouseName}) برصيد ${amount} ج.م`, 
          status: 'info' 
        },
        ...prev
      ]);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;
    const actual = parseFloat(actualCashInput);
    if (isNaN(actual) || actual < 0) return alert('يرجى إدخال النقدية الفعلية الموجودة بالدرج');

    // Calculate sales during session
    const sessionStartTime = new Date(activeSession.openedAt).getTime();
    const sessionSales = sales.filter(s => new Date(s.date).getTime() >= sessionStartTime);
    const sessionExpenses = expenses.filter(e => new Date(e.date).getTime() >= sessionStartTime);
    
    let cashSales = 0;
    let cardSales = 0;
    let walletSales = 0;
    let creditSales = 0;
    let cashExpenses = 0;

    sessionSales.forEach(s => {
      s.payments?.forEach(p => {
        if (p.method === 'CASH') cashSales += p.amount;
        if (p.method === 'CARD') cardSales += p.amount;
        if (p.method === 'WALLET') walletSales += p.amount;
        if (p.method === 'CREDIT') creditSales += p.amount;
      });
      if ((!s.payments || s.payments.length === 0) && s.paymentMethod === 'cash') {
        cashSales += (s.finalTotal || s.total || 0);
      }
    });

    sessionExpenses.forEach(e => {
        cashExpenses += (e.amount || 0);
    });

    const totalSalesVal = cashSales + cardSales + walletSales + creditSales;
    const expectedCash = activeSession.openingCash + cashSales - cashExpenses;

    try {
      await closeCashierSession(activeSession.id, actual);
      setActualCashInput('');
      playSuccessSound();

      // Build Z-Report WhatsApp Message for Manager
      const cfg = getNotificationConfig();
      const diff = actual - expectedCash;
      const zMsg = `📊 *تقرير تقفيل الوردية (Z-Report) للمدير*
🏪 *المنشأة:* ${cfg.businessName}
👤 *الكاشير:* ${activeSession.cashierName}
⏰ *وقت الفتح:* ${new Date(activeSession.openedAt).toLocaleTimeString('ar-EG')}
🏁 *وقت الإغلاق:* ${new Date().toLocaleTimeString('ar-EG')}
--------------------------------
💵 *رصيد الافتتاح:* ${(activeSession.openingCash || 0).toLocaleString()} ج.م
🛒 *إجمالي المبيعات:* ${(totalSalesVal || 0).toLocaleString()} ج.م
💸 *إجمالي المصروفات:* ${(cashExpenses || 0).toLocaleString()} ج.م
--------------------------------
💰 *مبيعات نقدية (Cash):* ${(cashSales || 0).toLocaleString()} ج.م
💳 *مبيعات بطاقة (Card):* ${(cardSales || 0).toLocaleString()} ج.م
📱 *مبيعات محفظة (Wallet):* ${(walletSales || 0).toLocaleString()} ج.م
🧾 *مبيعات آجل (Credit):* ${(creditSales || 0).toLocaleString()} ج.م
--------------------------------
🎯 *المتوقع بالدرج:* ${(expectedCash || 0).toLocaleString()} ج.م
📥 *الفعلي بالدرج:* ${(actual || 0).toLocaleString()} ج.م
⚖️ *الفارق (عجز/زيادة):* ${diff === 0 ? 'مطابق تماماً 0 ج.م ✅' : diff > 0 ? `+${(diff || 0).toLocaleString()} ج.م (زيادة)` : `${(diff || 0).toLocaleString()} ج.م (عجز ⚠️)`}`;

      if (cfg.notifyDailySummary) {
        fetch('/api/notify-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: zMsg })
        }).catch(e => console.warn('Twilio z-report bg dispatch:', e));

        openDirectWhatsAppChat(cfg.managerWhatsApp, zMsg, cfg.managerWhatsAppCountryCode);
      }

      if (cfg.managerEmail) {
        fetch('/api/notify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: cfg.managerEmail,
            subject: `📊 تقرير تقفيل الوردية (Z-Report) - كاشير: ${activeSession.cashierName}`,
            message: zMsg
          })
        }).catch(e => console.warn('Email z-report bg dispatch:', e));
      }

      setSecurityLog(prev => [
        { time: new Date().toLocaleTimeString('ar-EG'), cam: 'كاميرا 04 (الخزينة)', event: `إغلاق الوردية وإنشاء تقرير Z. النقدية الفعلية: ${actual} ج.م (الفارق: ${diff} ج.م)`, status: diff !== 0 ? 'warning' : 'info' },
        ...prev
      ]);

      alert('تم إغلاق الوردية وإنشاء تقرير Z بنجاح وإرسال التنبيه للمدير ✅');
      // No manual reload
    } catch (err: any) {
      alert(err.message);
    }
  };

  const captureSnapshot = () => {
    const camName = selectedCam === 1 ? 'درج الكاشير' : selectedCam === 2 ? 'المدخل الرئيسي' : selectedCam === 3 ? 'المخزن والأرفف' : 'الخزينة الرئيسية';
    const timestamp = new Date().toLocaleTimeString('ar-EG');
    const msg = `📷 تم التقاط لقطة كاميرا سريعة (${camName}) - ${timestamp}`;
    setSnapshots(prev => [msg, ...prev]);
    playSuccessSound();
  };

  const handleEmailManagerReport = async () => {
    if (!activeSession) return;
    const cfg = getNotificationConfig();
    const targetEmail = cfg.managerEmail || prompt('أدخل البريد الإلكتروني للمدير لإرسال تقرير الوردية:');
    if (!targetEmail) return;

    const subject = `تقرير الوردية الحالية - كاشير: ${activeSession.cashierName}`;
    const message = `تقرير الوردية الحالية (X-Report):
اسم الكاشير: ${activeSession.cashierName}
وقت الفتح: ${new Date(activeSession.openedAt).toLocaleString('ar-EG')}
رصيد الافتتاح: ${activeSession.openingCash} ج.م
المبيعات النقدية: ${liveCash} ج.م
المتوقع بالدرج: ${liveExpectedCash} ج.م`;

    try {
      const res = await fetch('/api/notify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: targetEmail, subject, message })
      });
      const data = await res.json();
      if (data.success) {
        alert('تم إرسال تقرير الوردية إلى البريد الإلكتروني للمدير بنجاح ✅');
      } else {
        alert('فشل الإرسال: ' + (data.error || 'خطأ غير معروف'));
      }
    } catch (e: any) {
      alert('خطأ في الاتصال بالخادم: ' + e.message);
    }
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>تقرير الوردية (Shift Z-Report)</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; padding: 20px; color: #111; }
            h2 { text-align: center; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: right; font-size: 14px; }
            th { background: #f4f4f4; }
          </style>
        </head>
        <body>
          <h2>تقرير تقفيل وردية الكاشير</h2>
          <p><strong>اسم الكاشير:</strong> ${activeSession?.cashierName || '-'}</p>
          <p><strong>وقت الفتح:</strong> ${activeSession ? new Date(activeSession.openedAt).toLocaleString('ar-EG') : '-'}</p>
          <table>
            <tr><th>البند المالي</th><th>القيمة (ج.م)</th></tr>
            <tr><td>رصيد افتتاح الوردية</td><td>${activeSession?.openingCash || 0}</td></tr>
            <tr><td>مبيعات نقدية (Cash)</td><td>${liveCash}</td></tr>
            <tr><td>مبيعات بطاقة (Card)</td><td>${liveCard}</td></tr>
            <tr><td>مبيعات محفظة (Wallet)</td><td>${liveWallet}</td></tr>
            <tr><td>مبيعات آجل (Credit)</td><td>${liveCredit}</td></tr>
            <tr><td>النقدية المتوقعة بالدرج</td><td><strong>${liveExpectedCash}</strong></td></tr>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintConsolidatedReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>التقرير اليومي المجمع (Consolidated Z-Report)</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; padding: 20px; color: #111; }
            h2 { text-align: center; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: right; font-size: 14px; }
            th { background: #f4f4f4; }
          </style>
        </head>
        <body>
          <h2>التقرير المجمع لورديات يوم: ${consolidatedDate}</h2>
          <table>
            <tr><th>البند المالي</th><th>القيمة الإجمالية (ج.م)</th></tr>
            <tr><td>عدد الورديات المغلقة</td><td>${dailyReport.count}</td></tr>
            <tr><td>إجمالي المبيعات</td><td>${(dailyReport.totalSales || 0).toLocaleString()}</td></tr>
            <tr><td>إجمالي النقدية المحصلة</td><td>${(dailyReport.totalCash || 0).toLocaleString()}</td></tr>
            <tr><td>إجمالي المبيعات الآجلة</td><td>${(dailyReport.totalCredit || 0).toLocaleString()}</td></tr>
            <tr><td>إجمالي النقدية المتوقعة بالدرج</td><td>${(dailyReport.totalExpected || 0).toLocaleString()}</td></tr>
            <tr><td>إجمالي النقدية الفعلية بالدرج</td><td>${(dailyReport.totalActual || 0).toLocaleString()}</td></tr>
            <tr><td>إجمالي العجز / الزيادة الكلي</td><td><strong>${(dailyReport.totalDiff || 0).toLocaleString()}</strong></td></tr>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintPastSession = (s: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const diff = s.difference || 0;
    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>تقرير تقفيل وردية (Z-Report)</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; padding: 20px; color: #111; }
            h2 { text-align: center; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: right; font-size: 14px; }
            th { background: #f4f4f4; }
          </style>
        </head>
        <body>
          <h2>تقرير تقفيل وردية كاشير (Z-Report)</h2>
          <p><strong>اسم الكاشير:</strong> ${s.cashierName}</p>
          <p><strong>وقت الفتح:</strong> ${new Date(s.openedAt).toLocaleString('ar-EG')}</p>
          <p><strong>وقت الإغلاق:</strong> ${s.closedAt ? new Date(s.closedAt).toLocaleString('ar-EG') : '-'}</p>
          <table>
            <tr><th>البند المالي</th><th>القيمة (ج.م)</th></tr>
            <tr><td>رصيد افتتاح الوردية</td><td>${s.openingCash || 0}</td></tr>
            <tr><td>النقدية المتوقعة بالدرج</td><td>${s.expectedCash || 0}</td></tr>
            <tr><td>النقدية الفعلية بالدرج</td><td>${s.actualCash || 0}</td></tr>
            <tr><td>الفارق (عجز / زيادة)</td><td><strong>${diff === 0 ? 'مطابق تماماً (0)' : diff > 0 ? `+${diff} (زيادة)` : `${diff} (عجز)`}</strong></td></tr>
          </table>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Live X-Report calculations
  const sessionSales = activeSession ? sales.filter(s => new Date(s.date).getTime() >= new Date(activeSession.openedAt).getTime()) : [];
  let liveCash = 0;
  let liveCard = 0;
  let liveWallet = 0;
  let liveCredit = 0;

  sessionSales.forEach(s => {
    if (s.payments && s.payments.length > 0) {
      s.payments.forEach(p => {
        if (p.method === 'CASH') liveCash += p.amount;
        if (p.method === 'CARD') liveCard += p.amount;
        if (p.method === 'WALLET') liveWallet += p.amount;
        if (p.method === 'CREDIT') liveCredit += p.amount;
      });
    } else {
      const tot = s.finalTotal || s.total || 0;
      if (s.paymentMethod === 'credit') liveCredit += tot;
      else if (s.paymentMethod === 'card') liveCard += tot;
      else if (s.paymentMethod === 'wallet') liveWallet += tot;
      else liveCash += tot;
    }
  });

  const liveExpectedCash = activeSession ? activeSession.openingCash + liveCash : 0;

  // Filtered Sessions Data
  const filteredSessions = sessionsData.filter(s => {
    if (s.status !== 'CLOSED') return false;
    if (filterDate && s.openedAt.split('T')[0] !== filterDate) return false;
    if (filterCashier !== 'all' && s.cashierName !== filterCashier) return false;
    return true;
  });

  // Unique Cashiers for filter
  const uniqueCashiers = Array.from(new Set(sessionsData.map(s => s.cashierName)));

  // Consolidated Daily Report Logic
  const getConsolidatedReport = (date: string) => {
    const daySessions = sessionsData.filter(s => s.openedAt.split('T')[0] === date && s.status === 'CLOSED');
    let totalOpening = 0;
    let totalActual = 0;
    let totalExpected = 0;
    let totalDiff = 0;
    let totalSales = 0;
    let totalCash = 0;
    let totalCard = 0;
    let totalCredit = 0;

    daySessions.forEach(s => {
      totalOpening += s.openingCash;
      totalActual += s.actualCash;
      totalExpected += s.expectedCash;
      totalDiff += (s.difference || 0);
      totalSales += (s.totalSales || 0);
      totalCash += (s.totalCash || 0);
      totalCard += (s.totalCard || 0);
      totalCredit += (s.totalSales - s.totalCash - s.totalCard); // Simplified credit calc
    });

    return {
      count: daySessions.length,
      totalOpening,
      totalActual,
      totalExpected,
      totalDiff,
      totalSales,
      totalCash,
      totalCard,
      totalCredit
    };
  };

  const dailyReport = getConsolidatedReport(consolidatedDate);

  // Dynamic lists for transactions filtering
  const txCustomers = Array.from(new Set(sales.map(s => s.customerName || 'عميل نقدي').filter(Boolean)));
  const txCashiers = Array.from(new Set(sessionsData.map(s => s.cashierName).filter(Boolean)));

  const filteredSales = sales.filter(sale => {
    // 1. Filter by Cashier
    if (txFilterCashier !== 'all') {
      const saleTime = new Date(sale.date).getTime();
      const sess = sessionsData.find(s => {
        const start = new Date(s.openedAt).getTime();
        const end = s.closedAt ? new Date(s.closedAt).getTime() : Date.now();
        return saleTime >= start && saleTime <= end;
      });
      if (!sess || sess.cashierName !== txFilterCashier) return false;
    }

    // 2. Filter by Customer
    if (txFilterCustomer !== 'all') {
      const name = sale.customerName || 'عميل نقدي';
      if (name !== txFilterCustomer) return false;
    }

    // 3. Filter by Payment Method
    if (txFilterPaymentMethod !== 'all') {
      const isPartial = (sale.paidAmount || 0) > 0 && (sale.remainingAmount || 0) > 0;
      if (txFilterPaymentMethod === 'cash') {
        if (isPartial || sale.paymentMethod !== 'cash') return false;
      } else if (txFilterPaymentMethod === 'card') {
        if (isPartial || sale.paymentMethod !== 'card') return false;
      } else if (txFilterPaymentMethod === 'credit') {
        if (isPartial || sale.paymentMethod !== 'credit') return false;
      } else if (txFilterPaymentMethod === 'partial') {
        if (!isPartial) return false;
      }
    }

    // 4. Filter by Camera (Simulated coverage matching)
    if (txFilterCamera !== 'all') {
      // Camera 1 covers cash drawer, Camera 2 covers main entrance sales, Camera 4 covers Card terminal
      if (txFilterCamera === 'cam1' && sale.paymentMethod !== 'cash') return false;
      if (txFilterCamera === 'cam4' && sale.paymentMethod !== 'card') return false;
      if (txFilterCamera === 'cam2' && (sale.finalTotal || 0) < 500) return false; // Show larger checkout traffic on entrance CAM
    }

    // 5. Filter by Session ID
    if (txFilterSessionId !== 'all') {
      const sess = sessionsData.find(s => s.id === txFilterSessionId);
      if (sess) {
        const start = new Date(sess.openedAt).getTime();
        const end = sess.closedAt ? new Date(sess.closedAt).getTime() : Date.now();
        const saleTime = new Date(sale.date).getTime();
        if (saleTime < start || saleTime > end) return false;
      } else {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto pb-28">
      
      {/* Top Header & Tab Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-5 sm:p-6 rounded-3xl border border-border shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-text-main flex items-center gap-2">
            <ShieldAlert className="text-gold" size={26} />
            <span>إدارة الورديات وتغطية كاميرات المراقبة (CCTV & Shifts)</span>
          </h1>
          <p className="text-xs text-text-dim mt-1">
            متابعة فتح وإغلاق الوردية، النقدية المتوقعة، وتقارير X & Z مع البث المباشر لكاميرات المراقبة
          </p>
        </div>

        <div className="flex items-center bg-card2 p-1.5 rounded-2xl border border-border gap-1 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('shifts')}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'shifts' ? 'bg-gold text-white shadow-md' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <Clock size={16} />
            <span>تقارير الورديات Z & X</span>
          </button>
          <button
            onClick={() => setActiveTab('cameras')}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'cameras' ? 'bg-gold text-white shadow-md' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <Video size={16} />
            <span>كاميرات المراقبة M-CCTV</span>
          </button>
        </div>
      </div>

      {activeTab === 'shifts' ? (
        <div className="space-y-6">
          
          {/* Active Session Status Bar */}
          {activeSession ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Session Info & X Report */}
              <div className="bg-card p-6 rounded-3xl border border-border space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-border pb-4">
                  <div>
                    <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5">
                      <Unlock size={14} /> الوردية مفتوحة (نشطة)
                    </span>
                    <p className="text-xs text-text-dim mt-2 font-bold">الكاشير المسؤول: <span className="text-text-main">{activeSession.cashierName}</span></p>
                    <div className="flex flex-wrap items-center gap-2 mt-1.5">
                      <span className="text-[11px] font-bold text-gold bg-gold/10 border border-gold/30 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                        <span>🏦 الخزنة:</span> {activeSession.treasuryName || 'الخزنة الرئيسية'}
                      </span>
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                        <span>🏬 المخزن:</span> {activeSession.warehouseName || 'المخزن الرئيسي'}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-dim font-mono mt-1">وقت الفتح: {new Date(activeSession.openedAt).toLocaleString('ar-EG')}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-[11px] text-text-dim">رصيد أول الوردية</p>
                    <p className="text-lg font-black text-gold font-mono">{(activeSession.openingCash || 0).toLocaleString()} ج.م</p>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-text-main flex items-center gap-2">
                  <Zap size={16} className="text-gold" />
                  <span>تقرير X اللحظي (Live X-Report Metrics)</span>
                </h3>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-card2 p-3.5 rounded-2xl border border-border">
                    <p className="text-text-dim font-bold">مبيعات نقدية (Cash)</p>
                    <p className="text-lg font-black text-emerald-400 mt-1 font-mono">{(liveCash || 0).toLocaleString()} ج.م</p>
                  </div>
                  <div className="bg-card2 p-3.5 rounded-2xl border border-border">
                    <p className="text-text-dim font-bold">مبيعات بطاقة (Card)</p>
                    <p className="text-lg font-black text-blue-400 mt-1 font-mono">{(liveCard || 0).toLocaleString()} ج.m</p>
                  </div>
                  <div className="bg-card2 p-3.5 rounded-2xl border border-border">
                    <p className="text-text-dim font-bold">مبيعات محفظة (Wallet)</p>
                    <p className="text-lg font-black text-purple-400 mt-1 font-mono">{(liveWallet || 0).toLocaleString()} ج.م</p>
                  </div>
                  <div className="bg-card2 p-3.5 rounded-2xl border border-border">
                    <p className="text-text-dim font-bold">مبيعات آجل (Credit)</p>
                    <p className="text-lg font-black text-amber-400 mt-1 font-mono">{(liveCredit || 0).toLocaleString()} ج.م</p>
                  </div>
                </div>

                <div className="bg-gold/10 border border-gold/30 p-4 rounded-2xl flex justify-between items-center text-xs">
                  <span className="font-bold text-text-main">النقدية المتوقعة بالدرج (Expected Cash):</span>
                  <span className="text-xl font-black text-gold font-mono">{(liveExpectedCash || 0).toLocaleString()} ج.م</span>
                </div>
              </div>

              {/* Close Session Panel */}
              <div className="bg-card p-6 rounded-3xl border border-border space-y-4 shadow-sm">
                <h3 className="font-bold text-base text-text-main flex items-center gap-2">
                  <Lock size={18} className="text-danger" />
                  <span>إغلاق الوردية وتوليد تقرير Z النهائى</span>
                </h3>
                <p className="text-xs text-text-dim">قم بعد النقدية الفعلية بالدرج وأدخل المبلغ لمقارنته بالنقدية المتوقعة:</p>
                
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-xs text-text-dim font-bold block mb-1">النقدية الفعلية بالدرج (Actual Cash) *</label>
                    <input
                      type="number"
                      placeholder="أدخل المبلغ النقدي بالجنيه..."
                      className="w-full bg-card2 border border-border p-3.5 rounded-2xl text-lg font-bold font-mono focus:outline-none focus:border-gold"
                      value={actualCashInput}
                      onChange={e => setActualCashInput(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={handleCloseSession}
                      className="flex-1 bg-danger text-white py-3.5 rounded-2xl font-bold hover:bg-danger/90 transition-all shadow-lg active:scale-95 text-xs flex items-center justify-center gap-2"
                    >
                      <Lock size={16} />
                      <span>إغلاق الوردية وحفظ Z</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintReport}
                      className="bg-card2 border border-border text-text-main px-4 py-3.5 rounded-2xl font-bold hover:bg-card transition-all text-xs flex items-center justify-center gap-2"
                    >
                      <Printer size={16} />
                      <span>طباعة التقرير</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleEmailManagerReport}
                      className="bg-gold/20 border border-gold/40 text-gold hover:bg-gold hover:text-white px-4 py-3.5 rounded-2xl font-bold transition-all text-xs flex items-center justify-center gap-2"
                    >
                      <span>✉️ إرسال للإيميل</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Open Session Form */
            <div className="bg-card p-8 rounded-3xl border border-border max-w-md mx-auto space-y-6 shadow-sm text-center">
              <div className="w-16 h-16 bg-gold/10 text-gold rounded-full flex items-center justify-center mx-auto text-3xl">
                🔓
              </div>
              <div>
                <h2 className="text-lg font-black text-text-main">لا توجد وردية مفتوحة حالياً</h2>
                <p className="text-xs text-text-dim mt-1">قم بفتح وردية جديدة لتحديد اسم الكاشير ورصيد بداية الخزينة</p>
              </div>

              <form onSubmit={handleOpenSession} className="space-y-4 text-right">
                <div>
                  <label className="text-xs text-text-dim font-bold block mb-1">اختر الكاشير / الموظف المسؤول: *</label>
                  {users.length > 0 ? (
                    <select
                      className="w-full bg-card2 border border-border p-3 rounded-2xl text-xs font-bold"
                      value={cashierId}
                      onChange={e => handleCashierSelect(e.target.value)}
                    >
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} (@{u.username})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="w-full bg-card2 border border-border p-3 rounded-2xl text-xs font-bold"
                      value={cashierName}
                      onChange={e => setCashierName(e.target.value)}
                      required
                    />
                  )}
                </div>

                {/* Predetermined Treasury & Warehouse linked to employee account */}
                {(() => {
                  const selectedUser = users.find(u => u.id === cashierId);
                  const selectedTreasuryObj = treasuries.find(t => t.id === selectedTreasuryId);
                  const selectedWarehouseObj = warehouses.find(w => w.id === selectedWarehouseId);
                  const tName = selectedUser?.treasuryName || selectedTreasuryObj?.name || 'الخزنة الرئيسية';
                  const wName = selectedUser?.warehouseName || selectedWarehouseObj?.name || 'المخزن الرئيسي';

                  return (
                    <div className="bg-card2 p-4 rounded-2xl border border-gold/30 space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <span className="text-gold font-bold flex items-center gap-1.5">
                          <Vault size={16} />
                          <span>الخزنة المربوطة بالحساب:</span>
                        </span>
                        <span className="font-bold text-gold bg-gold/10 border border-gold/30 px-3 py-1 rounded-xl">
                          {tName}
                        </span>
                      </div>

                      <div className="flex items-center justify-between border-b border-border/50 pb-2">
                        <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                          <Store size={16} />
                          <span>المخزن المربوط بالحساب:</span>
                        </span>
                        <span className="font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-xl">
                          {wName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-text-dim justify-center pt-0.5">
                        <ShieldAlert size={12} className="text-gold" />
                        <span>محددان مسبقاً بحساب الموظف في "إدارة الموظفين"</span>
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label className="text-xs text-text-dim font-bold block mb-1">رصيد الافتتاح النقدي (بداية الوردية): *</label>
                  <input
                    type="number"
                    placeholder="مثال: 500"
                    className="w-full bg-card2 border border-border p-3 rounded-2xl text-xs font-bold font-mono"
                    value={openingCashInput}
                    onChange={e => setOpeningCashInput(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="w-full bg-gold text-white py-3.5 rounded-2xl font-bold hover:bg-gold2 transition-all shadow-md active:scale-95 text-xs flex items-center justify-center gap-2">
                  <span>🔓 فتح الوردية وتخصيص الخزنة والمخزن</span>
                </button>
              </form>
            </div>
          )}

          {/* Past Z-Reports History */}
          <div className="bg-card p-6 rounded-3xl border border-border space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-bold text-base text-text-main flex items-center gap-2">
                  <FileText size={18} className="text-gold" />
                  <span>أرشيف تقارير تقفيل الورديات السابقة (Z-Reports History)</span>
                </h3>
                <p className="text-xs text-text-dim mt-0.5">مراجعة سجلات تقفيل الورديات النقدية والمبيعات والعجز والزيادة</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowColModal(true)}
                  className="bg-card2 border border-border hover:border-gold px-3 py-1.5 rounded-xl text-xs font-bold text-text-main transition-all flex items-center gap-1.5 shadow-sm"
                  title="تخصيص أعمدة جدول الورديات"
                >
                  <Sliders size={13} className="text-gold" />
                  <span>تخصيص الأعمدة</span>
                </button>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-text-dim">التاريخ:</span>
                  <input 
                    type="date" 
                    value={filterDate} 
                    onChange={e => setFilterDate(e.target.value)}
                    className="bg-card2 border border-border rounded-xl px-2 py-1 text-[10px] outline-none focus:border-gold"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-text-dim">الموظف:</span>
                  <select 
                    value={filterCashier} 
                    onChange={e => setFilterCashier(e.target.value)}
                    className="bg-card2 border border-border rounded-xl px-2 py-1 text-[10px] outline-none focus:border-gold"
                  >
                    <option value="all">الكل</option>
                    {uniqueCashiers.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
                <button 
                  onClick={() => setShowDailyConsolidated(!showDailyConsolidated)}
                  className="bg-gold/20 text-gold border border-gold/40 px-3 py-1 rounded-xl text-[10px] font-bold hover:bg-gold hover:text-white transition-all"
                >
                  {showDailyConsolidated ? 'إخفاء التقرير المجمع' : 'عرض التقرير اليومي المجمع'}
                </button>
              </div>
            </div>

            {/* Column Manager Modal */}
            {showColModal && (
              <ColumnManagerModal
                tableName="shifts"
                allColumns={SHIFTS_COLUMNS}
                defaultVisibleKeys={SHIFTS_DEFAULT_VISIBLE}
                currentVisibleKeys={visibleKeys}
                currentOrderedKeys={orderedKeys}
                onSave={(vis, ord) => {
                  setVisibleKeys(vis);
                  setOrderedKeys(ord);
                }}
                onClose={() => setShowColModal(false)}
              />
            )}

            {showDailyConsolidated && (
              <div className="bg-card2 p-4 rounded-2xl border border-gold/30 space-y-4 animate-in slide-in-from-top-2 duration-300">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h4 className="text-xs font-bold text-gold flex items-center gap-2">
                    <Activity size={14} />
                    <span>التقرير المجمع ليوم: {consolidatedDate}</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <input 
                      type="date" 
                      value={consolidatedDate} 
                      onChange={e => setConsolidatedDate(e.target.value)}
                      className="bg-card border border-border rounded-xl px-2 py-1 text-[10px]"
                    />
                    <button
                      type="button"
                      onClick={handlePrintConsolidatedReport}
                      className="bg-gold text-white px-3 py-1 rounded-xl text-[10px] font-bold hover:bg-gold2 transition-all flex items-center gap-1 shadow-sm"
                    >
                      <Printer size={12} />
                      <span>طباعة التقرير المجمع</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 bg-card rounded-xl border border-border">
                    <p className="text-[10px] text-text-dim font-bold">عدد الورديات</p>
                    <p className="text-lg font-black text-text-main">{dailyReport.count}</p>
                  </div>
                  <div className="p-3 bg-card rounded-xl border border-border">
                    <p className="text-[10px] text-text-dim font-bold">إجمالي المبيعات</p>
                    <p className="text-lg font-black text-gold font-mono">{(dailyReport.totalSales || 0).toLocaleString()} ج.م</p>
                  </div>
                  <div className="p-3 bg-card rounded-xl border border-border">
                    <p className="text-[10px] text-text-dim font-bold">إجمالي النقدية</p>
                    <p className="text-lg font-black text-emerald-400 font-mono">{(dailyReport.totalCash || 0).toLocaleString()} ج.م</p>
                  </div>
                  <div className="p-3 bg-card rounded-xl border border-border">
                    <p className="text-[10px] text-text-dim font-bold">إجمالي الآجل</p>
                    <p className="text-lg font-black text-amber-400 font-mono">{(dailyReport.totalCredit || 0).toLocaleString()} ج.م</p>
                  </div>
                  <div className="p-3 bg-card rounded-xl border border-border">
                    <p className="text-[10px] text-text-dim font-bold">المتوقع النهائي</p>
                    <p className="text-lg font-black text-gold font-mono">{(dailyReport.totalExpected || 0).toLocaleString()} ج.م</p>
                  </div>
                  <div className="p-3 bg-card rounded-xl border border-border">
                    <p className="text-[10px] text-text-dim font-bold">الفعلي النهائي</p>
                    <p className="text-lg font-black text-emerald-400 font-mono">{(dailyReport.totalActual || 0).toLocaleString()} ج.م</p>
                  </div>
                  <div className="p-3 bg-card rounded-xl border border-border">
                    <p className="text-[10px] text-text-dim font-bold">عجز/زيادة الكلي</p>
                    <p className={`text-lg font-black font-mono ${(dailyReport.totalDiff || 0) < 0 ? 'text-danger' : 'text-emerald-400'}`}>
                      {(dailyReport.totalDiff || 0).toLocaleString()} ج.م
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-right text-xs">
                <thead className="bg-card2 text-text-dim font-bold border-b border-border">
                  <tr>
                    {orderedKeys.map(colKey => {
                      if (!visibleKeys.includes(colKey)) return null;
                      const colDef = SHIFTS_COLUMNS.find(c => c.key === colKey);
                      return (
                        <th key={colKey} className={`p-3 ${colKey !== 'id' && colKey !== 'cashierName' && colKey !== 'openedAt' && colKey !== 'closedAt' ? 'text-center' : ''}`}>
                          {colDef?.label}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {filteredSessions.length > 0 ? filteredSessions.map(s => {
                    const diff = s.difference || 0;
                    return (
                      <tr key={s.id} className="hover:bg-card2/50 transition-colors">
                        {orderedKeys.map(colKey => {
                          if (!visibleKeys.includes(colKey)) return null;
                          switch (colKey) {
                            case 'id':
                              return (
                                <td key={colKey} className="p-3 font-mono text-[11px] text-gold font-bold">
                                  #{s.id.slice(0, 8)}
                                </td>
                              );
                            case 'cashierName':
                              return (
                                <td key={colKey} className="p-3 font-bold font-sans text-text-main">
                                  {s.cashierName}
                                </td>
                              );
                            case 'openedAt':
                              return (
                                <td key={colKey} className="p-3 text-[11px] text-text-dim font-sans">
                                  {new Date(s.openedAt).toLocaleString('ar-EG')}
                                </td>
                              );
                            case 'closedAt':
                              return (
                                <td key={colKey} className="p-3 text-[11px] text-text-dim font-sans">
                                  {s.closedAt ? new Date(s.closedAt).toLocaleString('ar-EG') : '-'}
                                </td>
                              );
                            case 'openingBalance':
                              return (
                                <td key={colKey} className="p-3 text-center text-text-main">
                                  {(s.openingCash || 0).toLocaleString()} ج.م
                                </td>
                              );
                            case 'totalSales':
                              return (
                                <td key={colKey} className="p-3 text-center font-bold text-gold">
                                  {(s.totalSales || 0).toLocaleString()} ج.م
                                </td>
                              );
                            case 'totalCash':
                              return (
                                <td key={colKey} className="p-3 text-center text-emerald-400 font-bold">
                                  {(s.totalCashSales || 0).toLocaleString()} ج.م
                                </td>
                              );
                            case 'totalCard':
                              return (
                                <td key={colKey} className="p-3 text-center text-blue-400 font-bold">
                                  {(s.totalCardSales || 0).toLocaleString()} ج.م
                                </td>
                              );
                            case 'totalExpenses':
                              return (
                                <td key={colKey} className="p-3 text-center text-rose-400 font-bold">
                                  {(s.totalExpenses || 0).toLocaleString()} ج.م
                                </td>
                              );
                            case 'closingBalance':
                              return (
                                <td key={colKey} className="p-3 text-center font-bold text-text-main">
                                  {(s.actualCash ?? s.expectedCash ?? 0).toLocaleString()} ج.م
                                </td>
                              );
                            case 'difference':
                              return (
                                <td key={colKey} className={`p-3 text-center font-bold font-sans ${diff < 0 ? 'text-danger' : diff > 0 ? 'text-emerald-400' : 'text-text-dim'}`}>
                                  {diff === 0 ? 'مطابق 0 ج' : diff > 0 ? `+${(diff || 0).toLocaleString()} ج (زيادة)` : `${(diff || 0).toLocaleString()} ج (عجز)`}
                                </td>
                              );
                            case 'status':
                              return (
                                <td key={colKey} className="p-3 text-center font-sans">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    s.status === 'CLOSED'
                                      ? 'bg-card2 text-text-dim border border-border'
                                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  }`}>
                                    {s.status === 'CLOSED' ? 'مغلقة' : 'مفتوحة'}
                                  </span>
                                </td>
                              );
                            case 'actions':
                              return (
                                <td key={colKey} className="p-3 text-center font-sans">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handlePrintPastSession(s)}
                                      className="bg-card2 hover:bg-card text-text-main border border-border px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all inline-flex items-center gap-1"
                                    >
                                      <Printer size={12} />
                                      <span>طباعة</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const cfg = getNotificationConfig();
                                        const zMsg = `📊 *تقرير تقفيل الوردية (Z-Report)*
🏪 *المنشأة:* ${cfg.businessName}
👤 *الكاشير:* ${s.cashierName}
⏰ *وقت الفتح:* ${new Date(s.openedAt).toLocaleString('ar-EG')}
🏁 *وقت الإغلاق:* ${s.closedAt ? new Date(s.closedAt).toLocaleString('ar-EG') : '-'}
💵 *رصيد الافتتاح:* ${s.openingCash} ج.م
🎯 *المتوقع بالدرج:* ${s.expectedCash} ج.م
📥 *الفعلي بالدرج:* ${s.actualCash} ج.م
⚖️ *الفارق:* ${diff === 0 ? 'مطابق تماماً 0 ج.م ✅' : diff > 0 ? `+${diff} ج.م (زيادة)` : `${diff} ج.م (عجز ⚠️)`}`;
                                        openDirectWhatsAppChat(cfg.managerWhatsApp, zMsg, cfg.managerWhatsAppCountryCode);
                                      }}
                                      className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all inline-flex items-center gap-1 border border-emerald-500/30"
                                    >
                                      <MessageSquare size={12} />
                                      <span>واتساب</span>
                                    </button>
                                  </div>
                                </td>
                              );
                            default:
                              return null;
                          }
                        })}
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={visibleKeys.length} className="p-8 text-center text-text-dim font-sans italic">
                        لا توجد ورديات مطابقة لخيارات البحث
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Advanced Transaction Audit Section */}
          <div className="bg-card p-6 rounded-3xl border border-border space-y-6 shadow-sm">
            <div>
              <h3 className="font-bold text-base text-text-main flex items-center gap-2">
                <span className="text-xl">🔍</span>
                <span>المراقبة والفلترة المتقدمة لمعاملات وفواتير الوردية (Shift Sales Audit)</span>
              </h3>
              <p className="text-xs text-text-dim mt-1">
                استعلام لحظي وتفصيلي للمبيعات حسب طريقة البيع (كاش، آجل، جزئي، فيزا)، العميل، والربط مع كاميرات المراقبة لتتبع النقدية والأمان بالدرج.
              </p>
            </div>

            {/* Filters Dashboard Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="text-xs text-text-dim block mb-1.5 font-bold">الوردية / الجلسة:</label>
                <select
                  value={txFilterSessionId}
                  onChange={e => setTxFilterSessionId(e.target.value)}
                  className="w-full bg-card2 border border-border p-3 rounded-2xl text-xs font-bold text-text-main"
                >
                  <option value="all">كل الورديات (تاريخي ومفتوح)</option>
                  {sessionsData.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.cashierName} - {new Date(s.openedAt).toLocaleDateString('ar-EG')} ({s.status === 'CLOSED' ? 'مغلقة' : 'نشطة'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-text-dim block mb-1.5 font-bold">الكاشير / الموظف:</label>
                <select
                  value={txFilterCashier}
                  onChange={e => setTxFilterCashier(e.target.value)}
                  className="w-full bg-card2 border border-border p-3 rounded-2xl text-xs font-bold text-text-main"
                >
                  <option value="all">كل الموظفين</option>
                  {txCashiers.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-text-dim block mb-1.5 font-bold">العميل:</label>
                <select
                  value={txFilterCustomer}
                  onChange={e => setTxFilterCustomer(e.target.value)}
                  className="w-full bg-card2 border border-border p-3 rounded-2xl text-xs font-bold text-text-main"
                >
                  <option value="all">كل العملاء</option>
                  {txCustomers.map(custName => (
                    <option key={custName} value={custName}>{custName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-text-dim block mb-1.5 font-bold">نوعية البيع / طريقة الدفع:</label>
                <select
                  value={txFilterPaymentMethod}
                  onChange={e => setTxFilterPaymentMethod(e.target.value)}
                  className="w-full bg-card2 border border-border p-3 rounded-2xl text-xs font-bold text-text-main"
                >
                  <option value="all">كل طرق البيع</option>
                  <option value="cash">كاش (نقدي كامل)</option>
                  <option value="card">فيزا / بطاقة (Visa)</option>
                  <option value="credit">آجل (Credit)</option>
                  <option value="partial">جزئي / دفعات (Partial)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-text-dim block mb-1.5 font-bold">ربط وتغطية الكاميرات:</label>
                <select
                  value={txFilterCamera}
                  onChange={e => setTxFilterCamera(e.target.value)}
                  className="w-full bg-card2 border border-border p-3 rounded-2xl text-xs font-bold text-text-main"
                >
                  <option value="all">كل كاميرات المراقبة</option>
                  <option value="cam1">كاميرا 01 (درج النقدية بالماكينة)</option>
                  <option value="cam4">كاميرا 04 (خزينة وبوابة الدفع)</option>
                  <option value="cam2">كاميرا 02 (مدخل صالة العرض)</option>
                </select>
              </div>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-right text-xs">
                <thead className="bg-card2 text-text-dim font-bold border-b border-border">
                  <tr>
                    <th className="p-3">رقم الفاتورة</th>
                    <th className="p-3">العميل</th>
                    <th className="p-3">التاريخ والوقت</th>
                    <th className="p-3 text-center">طريقة البيع</th>
                    <th className="p-3 text-center">الصافي النهائي</th>
                    <th className="p-3 text-center">المدفوع بالكامل</th>
                    <th className="p-3 text-center">المتبقي الآجل</th>
                    <th className="p-3 text-center">الكاميرا المرتبطة</th>
                    <th className="p-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {filteredSales.length > 0 ? (
                    filteredSales.map(sale => {
                      const isPartial = (sale.paidAmount || 0) > 0 && (sale.remainingAmount || 0) > 0;
                      let payBadge = <span className="bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg text-[10px] font-black border border-emerald-500/30">كاش نقدي</span>;
                      let cameraLabel = "كاميرا 01 (الدرج)";
                      let camId = 1;

                      if (isPartial) {
                        payBadge = <span className="bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-lg text-[10px] font-black border border-amber-500/30">دفع جزئي</span>;
                        cameraLabel = "كاميرا 04 (الخزينة)";
                        camId = 4;
                      } else if (sale.paymentMethod === 'credit') {
                        payBadge = <span className="bg-red-500/10 text-red-400 px-2.5 py-1 rounded-lg text-[10px] font-black border border-red-500/30">بيع آجل</span>;
                        cameraLabel = "كاميرا 02 (المدخل)";
                        camId = 2;
                      } else if (sale.paymentMethod === 'card') {
                        payBadge = <span className="bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-lg text-[10px] font-black border border-blue-500/30">فيزا / بطاقة</span>;
                        cameraLabel = "كاميرا 04 (الخزينة)";
                        camId = 4;
                      }

                      // Print single invoice inline logic helper
                      const handlePrintInvoice = (s: Sale) => {
                        const pWin = window.open('', '_blank');
                        if (!pWin) return;
                        pWin.document.write(`
                          <html dir="rtl" lang="ar">
                            <head>
                              <title>فاتورة مبيعات #${s.invoiceNumber || s.id}</title>
                              <style>
                                body { font-family: Tahoma, Arial, sans-serif; padding: 25px; color: #111; max-width: 600px; margin: 0 auto; }
                                .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
                                h2 { margin: 5px 0; color: #222; }
                                .meta-info { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 15px; border-bottom: 1px dashed #ddd; padding-bottom: 10px; }
                                table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                                th, td { border-bottom: 1px solid #eee; padding: 10px 8px; text-align: right; font-size: 13px; }
                                th { background: #f9f9f9; font-weight: bold; }
                                .totals { margin-top: 20px; text-align: left; font-size: 14px; line-height: 1.8; }
                                .totals span { display: inline-block; width: 150px; text-align: right; }
                                .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #666; border-top: 1px solid #eee; padding-top: 15px; }
                              </style>
                            </head>
                            <body>
                              <div class="header">
                                <h2>نظام مارو لايت المحاسبي</h2>
                                <p style="margin: 3px 0; font-size: 12px; color: #666;">فاتورة مبيعات مبسطة</p>
                              </div>
                              <div class="meta-info">
                                <div>
                                  <p><strong>رقم الفاتورة:</strong> \${s.invoiceNumber || s.id.substring(0, 8)}</p>
                                  <p><strong>تاريخ المعاملة:</strong> \${new Date(s.date).toLocaleString('ar-EG')}</p>
                                </div>
                                <div style="text-align: left;">
                                  <p><strong>العميل:</strong> \${s.customerName || 'عميل نقدي'}</p>
                                  <p><strong>حالة الدفع:</strong> \${((s.paidAmount || 0) > 0 && (s.remainingAmount || 0) > 0) ? 'دفع جزئي' : s.paymentMethod === 'credit' ? 'آجل' : 'مدفوع بالكامل'}</p>
                                </div>
                              </div>
                              <table>
                                <thead>
                                  <tr>
                                    <th>الصنف</th>
                                    <th style="text-align: center;">الكمية</th>
                                    <th style="text-align: left;">السعر</th>
                                    <th style="text-align: left;">الإجمالي</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  \${s.items.map(item => \`
                                    <tr>
                                      <td>\${item.name}</td>
                                      <td style="text-align: center;">\${item.quantity} \${item.unit || 'وحدة'}</td>
                                      <td style="text-align: left;">\${item.price.toLocaleString()} ج.م</td>
                                      <td style="text-align: left;">\${(item.quantity * item.price).toLocaleString()} ج.م</td>
                                    </tr>
                                  \`).join('')}
                                </tbody>
                              </table>
                              <div class="totals">
                                <p><span>إجمالي الفاتورة:</span> <strong>\${(s.total || 0).toLocaleString()} ج.م</strong></p>
                                \${s.discount ? \`<p><span>الخصم:</span> \${(s.discount || 0).toLocaleString()} ج.م</p>\` : ''}
                                \${s.tax ? \`<p><span>الضريبة المضافة:</span> \${(s.taxAmount || 0).toLocaleString()} ج.م</p>\` : ''}
                                <p style="border-top: 2px solid #333; padding-top: 5px; font-size: 16px;"><span>الصافي النهائي:</span> <strong>\${(s.finalTotal || 0).toLocaleString()} ج.م</strong></p>
                                <p><span>المبلغ المدفوع:</span> \${(s.paidAmount || s.finalTotal || 0).toLocaleString()} ج.م</p>
                                <p><span>المبلغ المتبقي:</span> \${(s.remainingAmount || 0).toLocaleString()} ج.م</p>
                              </div>
                              <div class="footer">
                                <p>شكرًا لتعاملكم معنا • تم توليد الفاتورة تلقائيًا عبر مارو لايت</p>
                              </div>
                              <script>window.print();</script>
                            </body>
                          </html>
                        `);
                        pWin.document.close();
                      };

                      return (
                        <tr key={sale.id} className="hover:bg-card2/50 transition-colors">
                          <td className="p-3 font-bold text-text-main">#{sale.invoiceNumber || sale.id.substring(0, 8)}</td>
                          <td className="p-3 font-bold font-sans text-text-main">{sale.customerName || 'عميل نقدي'}</td>
                          <td className="p-3 text-text-dim text-[11px]">{new Date(sale.date).toLocaleString('ar-EG')}</td>
                          <td className="p-3 text-center font-sans">{payBadge}</td>
                          <td className="p-3 text-center text-text-main font-bold">{(sale.finalTotal || 0).toLocaleString()} ج.م</td>
                          <td className="p-3 text-center text-emerald-400 font-bold">{(sale.paidAmount || sale.finalTotal || 0).toLocaleString()} ج.م</td>
                          <td className="p-3 text-center text-red-400 font-bold">{(sale.remainingAmount || 0).toLocaleString()} ج.m</td>
                          <td className="p-3 text-center font-sans">
                            <span className="text-[10px] bg-neutral-800 text-neutral-300 border border-neutral-700 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                              <span>🎥</span> {cameraLabel}
                            </span>
                          </td>
                          <td className="p-3 text-center font-sans flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePrintInvoice(sale)}
                              className="bg-card2 hover:bg-card text-text-main border border-border px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all inline-flex items-center gap-1"
                            >
                              <Printer size={12} />
                              <span>طباعة الفاتورة</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCam(camId);
                                setActiveTab('cameras');
                                playSuccessSound();
                              }}
                              className="bg-gold/10 hover:bg-gold text-gold hover:text-white border border-gold/20 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all inline-flex items-center gap-1"
                              title="تبديل الكاميرا لمراجعة تسجيل عملية الدفع هذه أمنياً"
                            >
                              <Video size={12} />
                              <span>بث أمني للكاميرا</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-text-dim font-sans italic">
                        لا توجد فواتير أو معاملات مطابقة لمعايير البحث والفلترة المحددة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        /* CCTV Cameras View */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Live Camera Grid Feed */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-black/90 rounded-3xl border border-border p-4 relative overflow-hidden shadow-2xl">
                {/* Simulated Live Camera Stream */}
                <div className="aspect-video bg-neutral-950 rounded-2xl relative flex items-center justify-center overflow-hidden border border-neutral-800">
                  
                  {/* Camera overlay HUD */}
                  <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse z-10">
                    <span className="w-2 h-2 rounded-full bg-white"></span>
                    <span>LIVE HD 1080p</span>
                  </div>

                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-emerald-400 text-[11px] font-mono px-3 py-1 rounded-xl border border-emerald-500/30 z-10">
                    {new Date().toLocaleTimeString('ar-EG')} • {selectedCam === 1 ? 'CAM-01: درج الكاشير' : selectedCam === 2 ? 'CAM-02: مدخل المتجر' : selectedCam === 3 ? 'CAM-03: منطقة المخزن' : 'CAM-04: الخزينة الرئيسية'}
                  </div>

                  {/* Simulated Visual Angle Content */}
                  <div className="text-center space-y-3 text-neutral-400">
                    <Video size={56} className="mx-auto opacity-30 animate-pulse text-gold" />
                    <div>
                      <p className="font-bold text-sm text-neutral-200">
                        {selectedCam === 1 && '📹 البث الحي: كاميرا 01 - ماكينة ودرج النقدية الكاشير'}
                        {selectedCam === 2 && '📹 البث الحي: كاميرا 02 - مدخل المتجر وصالة البيع'}
                        {selectedCam === 3 && '📹 البث الحي: كاميرا 03 - المخزن الداخلي والأرفف'}
                        {selectedCam === 4 && '📹 البث الحي: كاميرا 04 - الخزينة والآمنة الكبرى'}
                      </p>
                      <p className="text-xs text-neutral-500 mt-1 font-mono">Status: Connected • FPS: 30 • Bitrate: 4.2 Mbps</p>
                    </div>
                  </div>

                  {/* Motion Detection Grid Graphic */}
                  <div className="absolute bottom-3 left-3 text-[10px] bg-black/70 text-gold px-2.5 py-1 rounded-lg border border-gold/20 flex items-center gap-1.5 font-mono">
                    <Zap size={12} />
                    <span>مستشعر الحركة: نشط (Motion Detected OK)</span>
                  </div>
                </div>

                {/* Camera Selector Buttons */}
                <div className="grid grid-cols-4 gap-2 mt-4 text-xs font-bold">
                  {[
                    { id: 1, label: 'كاميرا 01 (الدرج)' },
                    { id: 2, label: 'كاميرا 02 (المدخل)' },
                    { id: 3, label: 'كاميرا 03 (المخزن)' },
                    { id: 4, label: 'كاميرا 04 (الخزينة)' },
                  ].map(cam => (
                    <button
                      key={cam.id}
                      onClick={() => setSelectedCam(cam.id)}
                      className={`p-2.5 rounded-xl border transition-all text-center ${
                        selectedCam === cam.id ? 'bg-gold text-white border-gold shadow' : 'bg-card2 text-text-dim border-border hover:text-white'
                      }`}
                    >
                      {cam.label}
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex justify-between items-center text-xs">
                  <button
                    type="button"
                    onClick={captureSnapshot}
                    className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Camera size={14} />
                    <span>التقاط لقطة كاميرا (Take Snapshot)</span>
                  </button>

                  <span className="text-[11px] text-text-dim">نظام المراقبة M-CCTV v4.2 مفعل</span>
                </div>
              </div>
            </div>

            {/* Security Audit Log & Snapshots */}
            <div className="space-y-4">
              <div className="bg-card p-5 rounded-3xl border border-border space-y-3 shadow-sm">
                <h3 className="font-bold text-sm text-text-main flex items-center gap-2">
                  <Eye size={16} className="text-gold" />
                  <span>سجل المراقبة والأحداث الأمنية</span>
                </h3>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1 text-xs">
                  {securityLog.map((log, idx) => (
                    <div key={idx} className="bg-card2 p-2.5 rounded-2xl border border-border space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-text-dim font-mono">
                        <span className="text-gold font-bold">{log.cam}</span>
                        <span>{log.time}</span>
                      </div>
                      <p className="text-text-main font-bold">{log.event}</p>
                    </div>
                  ))}
                </div>
              </div>

              {snapshots.length > 0 && (
                <div className="bg-card p-4 rounded-3xl border border-border space-y-2 text-xs">
                  <h4 className="font-bold text-emerald-400">اللقطات الملتقطة:</h4>
                  <ul className="space-y-1 text-text-dim font-mono text-[11px]">
                    {snapshots.map((s, i) => (
                      <li key={i} className="bg-card2 p-2 rounded-xl border border-border">{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
