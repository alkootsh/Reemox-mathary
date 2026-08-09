import React, { useState, useEffect } from 'react';
import { CashierSession, Sale } from '../types/types';
import { getCashierSessions, openCashierSession, closeCashierSession, getSales } from '../lib/firestoreService';
import { ShieldAlert, CheckCircle2, DollarSign, Lock, Unlock, FileText, RefreshCw, MessageSquare, Mail, Send } from 'lucide-react';
import { getNotificationConfig, openDirectWhatsAppChat } from '../lib/notifications';
import { playSuccessSound } from '../lib/sound';

export default function CashierSessionView() {
  const [sessions, setSessions] = useState<CashierSession[]>([]);
  const [activeSession, setActiveSession] = useState<CashierSession | null>(null);
  const [openingCashInput, setOpeningCashInput] = useState('');
  const [actualCashInput, setActualCashInput] = useState('');
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [cashierName, setCashierName] = useState('الكاشير الرئيسي');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sessList, salesList] = await Promise.all([getCashierSessions(), getSales()]);
      setSessions(sessList);
      setSales(salesList);
      const active = sessList.find(s => s.status === 'ACTIVE' || s.status === 'OPEN');
      setActiveSession(active || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(openingCashInput);
    if (isNaN(amount) || amount < 0) return alert('يرجى إدخال مبلغ افتتاح صحيح');
    try {
      const id = await openCashierSession(cashierName, amount);
      setOpeningCashInput('');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCloseSession = async () => {
    if (!activeSession) return;
    const actual = parseFloat(actualCashInput);
    if (isNaN(actual) || actual < 0) return alert('يرجى إدخال النقدية الفعلية الموجودة بالدرج');

    // Calculate sales during session
    const sessionSales = sales.filter(s => new Date(s.date).getTime() >= new Date(activeSession.openedAt).getTime());
    
    let cashSales = 0;
    let cardSales = 0;
    let walletSales = 0;
    let creditSales = 0;

    sessionSales.forEach(s => {
      s.payments?.forEach(p => {
        if (p.method === 'CASH') cashSales += p.amount;
        if (p.method === 'CARD') cardSales += p.amount;
        if (p.method === 'WALLET') walletSales += p.amount;
        if (p.method === 'CREDIT') creditSales += p.amount;
      });
    });

    const expectedCash = activeSession.openingCash + cashSales;

    try {
      await closeCashierSession(activeSession.id, actual, expectedCash, {
        cashSales,
        cardSales,
        walletSales,
        creditSales
      });
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
💵 *رصيد الافتتاح:* ${activeSession.openingCash} ج.م
💰 *مبيعات نقدية (Cash):* ${cashSales} ج.م
💳 *مبيعات بطاقة (Card):* ${cardSales} ج.م
📱 *مبيعات محفظة (Wallet):* ${walletSales} ج.م
🧾 *مبيعات آجل (Credit):* ${creditSales} ج.م
--------------------------------
🎯 *المتوقع بالدرج:* ${expectedCash} ج.م
📥 *الفعلي بالدرج:* ${actual} ج.م
⚖️ *الفارق (عجز/زيادة):* ${diff === 0 ? 'مطابق تماماً 0 ج.م ✅' : diff > 0 ? `+${diff} ج.م (زيادة)` : `${diff} ج.م (عجز ⚠️)`}`;

      if (cfg.notifyDailySummary) {
        // Try server dispatch in background
        fetch('/api/notify-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: zMsg })
        }).catch(e => console.warn('Twilio z-report bg dispatch:', e));

        if (cfg.managerEmail) {
          fetch('/api/notify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: cfg.managerEmail,
              subject: `📊 تقرير تقفيل الوردية (Z-Report) - ${activeSession.cashierName}`,
              message: zMsg
            })
          }).catch(e => console.warn('Email z-report bg dispatch:', e));
        }

        // Open direct WhatsApp for immediate delivery
        openDirectWhatsAppChat(cfg.managerWhatsApp, zMsg, cfg.managerWhatsAppCountryCode);
      }

      alert('تم إغلاق الوردية وإنشاء تقرير Z بنجاح وإرسال التنبيه للمدير ✅');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Calculate X Report live metrics if active session exists
  const sessionSales = activeSession ? sales.filter(s => new Date(s.date).getTime() >= new Date(activeSession.openedAt).getTime()) : [];
  let liveCash = 0;
  let liveCard = 0;
  let liveWallet = 0;
  let liveCredit = 0;

  sessionSales.forEach(s => {
    s.payments?.forEach(p => {
      if (p.method === 'CASH') liveCash += p.amount;
      if (p.method === 'CARD') liveCard += p.amount;
      if (p.method === 'WALLET') liveWallet += p.amount;
      if (p.method === 'CREDIT') liveCredit += p.amount;
    });
  });

  const liveExpectedCash = activeSession ? activeSession.openingCash + liveCash : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto pb-28">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card p-5 sm:p-6 rounded-3xl border border-border">
        <div>
          <h1 className="text-2xl font-black text-text-main">إدارة وردية الكاشير (Cashier Session & Z-Report)</h1>
          <p className="text-sm text-text-dim mt-1">فتح وإغلاق الوردية، ومتابعة النقدية وتقارير X و Z</p>
        </div>
        <button onClick={loadData} className="bg-accent text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2">
          <RefreshCw size={16} /> تحديث
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-text-dim">جاري التحميل...</div>
      ) : activeSession ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Session Info & X Report */}
          <div className="bg-card p-6 rounded-3xl border border-border space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <div>
                <span className="bg-green-500/10 text-green-400 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
                  <Unlock size={14} /> الوردية مفتوحة (نشطة)
                </span>
                <p className="text-xs text-text-dim mt-2">الكاشير: {activeSession.cashierName}</p>
                <p className="text-xs text-text-dim">وقت الفتح: {new Date(activeSession.openedAt).toLocaleString('ar-EG')}</p>
              </div>
              <div className="text-left">
                <p className="text-xs text-text-dim">رصيد الافتتاح</p>
                <p className="text-lg font-black text-gold">{activeSession.openingCash} ج.م</p>
              </div>
            </div>

            <h3 className="font-bold text-lg text-text-main">تقرير X المباشر (X-Report Live)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card2 p-4 rounded-2xl border border-border">
                <p className="text-xs text-text-dim">مبيعات نقدية (Cash)</p>
                <p className="text-xl font-black text-success mt-1">{liveCash} ج.م</p>
              </div>
              <div className="bg-card2 p-4 rounded-2xl border border-border">
                <p className="text-xs text-text-dim">مبيعات بطاقة (Card)</p>
                <p className="text-xl font-black text-blue-400 mt-1">{liveCard} ج.م</p>
              </div>
              <div className="bg-card2 p-4 rounded-2xl border border-border">
                <p className="text-xs text-text-dim">مبيعات محفظة (Wallet)</p>
                <p className="text-xl font-black text-purple-400 mt-1">{liveWallet} ج.م</p>
              </div>
              <div className="bg-card2 p-4 rounded-2xl border border-border">
                <p className="text-xs text-text-dim">مبيعات آجل (Credit)</p>
                <p className="text-xl font-black text-yellow-400 mt-1">{liveCredit} ج.م</p>
              </div>
            </div>

            <div className="bg-accent/10 border border-accent/30 p-4 rounded-2xl flex justify-between items-center">
              <span className="font-bold text-sm">النقدية المتوقعة بالدرج (Expected Cash):</span>
              <span className="text-xl font-black text-gold">{liveExpectedCash} ج.م</span>
            </div>
          </div>

          {/* Close Session Panel */}
          <div className="bg-card p-6 rounded-3xl border border-border space-y-4">
            <h3 className="font-bold text-lg text-text-main flex items-center gap-2">
              <Lock size={18} /> إغلاق الوردية وإصدار تقرير Z
            </h3>
            <p className="text-xs text-text-dim">قم بعد النقدية الفعلية الموجودة في درج الخزينة وأدخلها أدناه:</p>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-dim block mb-1">النقدية الفعلية بالدرج (Actual Cash)</label>
                <input
                  type="number"
                  placeholder="أدخل المبلغ الموجود فعلياً..."
                  className="w-full bg-card2 border border-border p-3 rounded-2xl text-lg font-bold focus:outline-none focus:border-gold"
                  value={actualCashInput}
                  onChange={e => setActualCashInput(e.target.value)}
                />
              </div>

              <button
                onClick={handleCloseSession}
                className="w-full bg-danger text-white py-3 rounded-2xl font-bold hover:bg-danger/80 transition-colors shadow-lg"
              >
                إغلاق الوردية الآن وتوليد تقرير Z
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Open Session Panel */
        <div className="bg-card p-8 rounded-3xl border border-border max-w-lg mx-auto space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-gold/10 text-gold rounded-full flex items-center justify-center mx-auto text-2xl font-black">
              🔓
            </div>
            <h2 className="text-xl font-black">لا توجد وردية مفتوحة حالياً</h2>
            <p className="text-xs text-text-dim">يجب فتح وردية جديدة وبدء رصيد الخزينة لكي تتمكن من إجراء المبيعات.</p>
          </div>

          <form onSubmit={handleOpenSession} className="space-y-4">
            <div>
              <label className="text-xs text-text-dim block mb-1">اسم الكاشير</label>
              <input
                type="text"
                className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm"
                value={cashierName}
                onChange={e => setCashierName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs text-text-dim block mb-1">رصيد الافتتاح النقدي (Opening Cash)</label>
              <input
                type="number"
                placeholder="مثال: 1000"
                className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm font-bold"
                value={openingCashInput}
                onChange={e => setOpeningCashInput(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="w-full bg-gold text-white py-3.5 rounded-2xl font-bold hover:bg-gold2 transition-colors">
              فتح الوردية وبدء العمل
            </button>
          </form>
        </div>
      )}

      {/* Historical Sessions */}
      <div className="bg-card p-6 rounded-3xl border border-border space-y-4">
        <h3 className="font-bold text-lg">سجل الورديات السابقة (Z-Reports History)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-card2 text-text-dim border-b border-border text-xs">
              <tr>
                <th className="p-3">الكاشير</th>
                <th className="p-3">الفتح</th>
                <th className="p-3">الإغلاق</th>
                <th className="p-3 text-center">الفتح النقدي</th>
                <th className="p-3 text-center">المتوقع</th>
                <th className="p-3 text-center">الفعلي</th>
                <th className="p-3 text-center">العجز / الزيادة</th>
                <th className="p-3 text-center">إجراءات التقرير</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sessions.filter(s => s.status === 'CLOSED').map(s => {
                const diff = s.difference || 0;
                return (
                  <tr key={s.id} className="hover:bg-card2/50">
                    <td className="p-3 font-bold">{s.cashierName}</td>
                    <td className="p-3 text-xs text-text-dim">{new Date(s.openedAt).toLocaleString('ar-EG')}</td>
                    <td className="p-3 text-xs text-text-dim">{s.closedAt ? new Date(s.closedAt).toLocaleString('ar-EG') : '-'}</td>
                    <td className="p-3 text-center">{s.openingCash} ج.م</td>
                    <td className="p-3 text-center">{s.expectedCash} ج.م</td>
                    <td className="p-3 text-center font-bold">{s.actualCash} ج.م</td>
                    <td className={`p-3 text-center font-black ${diff < 0 ? 'text-danger' : diff > 0 ? 'text-success' : 'text-text-dim'}`}>
                      {diff} ج.م
                    </td>
                    <td className="p-3 text-center">
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
                        className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1"
                        title="إرسال التقرير لواتساب المدير"
                      >
                        <MessageSquare size={13} />
                        <span>واتساب 📱</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
