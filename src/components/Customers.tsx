import React, { useState, useEffect } from 'react';
import { Customer } from '../types/types';
import { getCustomers, saveCustomer, deleteCustomer } from '../lib/firestoreService';
import Toast from './Toast';
import { playSuccessSound, playWarningSound } from '../lib/sound';
import { 
  Users, 
  UserPlus, 
  Search, 
  MessageCircle, 
  Phone, 
  Wallet, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle,
  TrendingDown,
  TrendingUp,
  X
} from 'lucide-react';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', openingBalance: '', whatsappReminders: true });
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  const hasUnsavedData = Boolean(newCustomer.name || newCustomer.phone || newCustomer.openingBalance);

  useEffect(() => {
    loadCustomers();
  }, []);

  // Warn if leaving with unsaved data
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedData) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedData]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const data = await getCustomers();
      setCustomers(data);
    } catch (err: any) {
      console.error('Error loading customers:', err.code, err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomer.name.trim()) {
      playWarningSound();
      setToast({ message: 'تنبيه: يرجى إدخال اسم العميل على الأقل', type: 'warning' });
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      
      const custData: Partial<Customer> = {
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim() || '0000000000',
        openingBalance: parseFloat(newCustomer.openingBalance) || 0,
        whatsappReminders: newCustomer.whatsappReminders
      };

      if (editingCustomerId) {
        custData.id = editingCustomerId;
      }

      await saveCustomer(custData);
      setNewCustomer({ name: '', phone: '', openingBalance: '', whatsappReminders: true });
      setEditingCustomerId(null);
      await loadCustomers();
      playSuccessSound();
      setToast({ message: editingCustomerId ? 'تم تحديث بيانات العميل بنجاح' : 'تم إضافة العميل بنجاح', type: 'success' });
    } catch (err: any) {
      console.error('Error saving customer:', err.code, err.message);
      setErrorMsg(`[${err.code || 'ERROR'}] ${err.message}`);
      playWarningSound();
      setToast({ message: `فشل الحفظ: ${err.message}`, type: 'warning' });
    } finally {
      setLoading(false);
    }
  };

  const startEditCustomer = (c: Customer) => {
    setEditingCustomerId(c.id);
    setNewCustomer({
      name: c.name,
      phone: c.phone || '',
      openingBalance: String(c.openingBalance || 0),
      whatsappReminders: c.whatsappReminders ?? true
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingCustomerId(null);
    setNewCustomer({ name: '', phone: '', openingBalance: '', whatsappReminders: true });
  };

  const handleDeleteCustomer = async (id: string) => {
    if (id === 'cash-customer') {
      alert('لا يمكن حذف حساب العميل النقدي الافتراضي!');
      return;
    }

    if (!window.confirm('هل أنت متأكد من حذف هذا العميل من قاعدة البيانات؟')) {
      return;
    }

    try {
      await deleteCustomer(id);
      setCustomers(customers.filter(c => c.id !== id));
      playSuccessSound();
      setToast({ message: 'تم حذف العميل بنجاح', type: 'success' });
    } catch (err: any) {
      playWarningSound();
      setToast({ message: `فشل الحذف: ${err.message}`, type: 'warning' });
    }
  };

  // WhatsApp Debt Reminder
  const sendWhatsAppReminder = (customer: Customer) => {
    const phone = (customer.phone || '').replace(/[^0-9]/g, '');
    if (!phone || phone.length < 9) {
      alert('العميل ليس لديه رقم هاتف صحيح لإرسال تذكير واتساب');
      return;
    }

    const businessName = localStorage.getItem('businessName') || 'متجر MARO';
    const balance = customer.currentBalance ?? customer.openingBalance ?? 0;
    
    let finalPhone = phone;
    if (finalPhone.startsWith('01') && finalPhone.length === 11) {
      finalPhone = '2' + finalPhone; // Egypt
    } else if (finalPhone.startsWith('05') && finalPhone.length === 10) {
      finalPhone = '966' + finalPhone.substring(1); // KSA
    }

    let message = `مرحباً بك أستاذ *${customer.name}*،\n\n`;
    message += `نود تذكيركم بكشف الحساب لدى *${businessName}*:\n`;
    message += `رصيد المديونية المستحق حالياً: *${balance} ج.م*\n\n`;
    message += `يرجى التكرم بسداد المبلغ في أقرب وقت. شكراً لتعاملكم الراقي معنا! 🙏`;

    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone && c.phone.includes(searchTerm))
  );

  const totalDebts = customers.reduce((sum, c) => sum + (Number(c.currentBalance ?? c.openingBalance) || 0), 0);

  return (
    <div className="p-4 sm:p-5 pb-28 max-w-5xl mx-auto space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Header & Stats */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-text-main">
            <Users className="text-gold" />
            <span>إدارة العملاء والديون والذمم المالية</span>
          </h2>
          <p className="text-xs text-text-dim mt-1">تسجيل العملاء، متابعة المديونيات، وإرسال تذكيرات سداد عبر واتساب</p>
        </div>

        <div className="bg-card2 border border-border p-3 rounded-2xl flex items-center gap-4 text-xs">
          <div>
            <span className="text-text-dim block text-[10px]">إجمالي العملاء</span>
            <span className="font-black text-sm text-gold font-mono">{customers.length}</span>
          </div>
          <div className="h-8 w-px bg-border"></div>
          <div>
            <span className="text-text-dim block text-[10px]">إجمالي ديون العملاء</span>
            <span className="font-black text-sm text-danger font-mono">{totalDebts.toLocaleString()} ج.م</span>
          </div>
        </div>
      </div>

      {errorMsg && <div className="bg-danger/10 border border-danger p-3 rounded-xl text-danger text-sm">{errorMsg}</div>}
      
      {/* Add / Edit Customer Form */}
      <form onSubmit={handleAddCustomer} className="bg-card p-5 sm:p-6 rounded-3xl border border-border space-y-4 shadow-sm">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <h3 className="font-black text-sm text-gold flex items-center gap-2">
            <UserPlus size={16} />
            <span>{editingCustomerId ? '✏️ تعديل بيانات العميل' : '➕ إضافة عميل جديد'}</span>
          </h3>
          {editingCustomerId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-xs bg-card2 border border-border px-3 py-1 rounded-full text-text-dim hover:text-white flex items-center gap-1"
            >
              <X size={12} />
              <span>إلغاء التعديل</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-text-dim font-bold mb-1">اسم العميل: *</label>
            <input 
              required
              placeholder="مثال: شركة النور أو أحمد محمود" 
              className="bg-card2 border border-border p-3 rounded-2xl w-full font-bold focus:outline-none focus:border-gold" 
              value={newCustomer.name} 
              onChange={e => setNewCustomer({...newCustomer, name: e.target.value})} 
            />
          </div>

          <div>
            <label className="block text-text-dim font-bold mb-1">رقم الهاتف / الواتساب:</label>
            <input 
              type="tel"
              placeholder="مثال: 01012345678" 
              className="bg-card2 border border-border p-3 rounded-2xl w-full font-mono focus:outline-none focus:border-gold" 
              value={newCustomer.phone} 
              onChange={e => setNewCustomer({...newCustomer, phone: e.target.value})} 
            />
          </div>

          <div>
            <label className="block text-text-dim font-bold mb-1">الرصيد الافتتاحي (مديونية سابقة):</label>
            <input 
              type="number" 
              placeholder="0.00" 
              className="bg-card2 border border-border p-3 rounded-2xl w-full font-mono focus:outline-none focus:border-gold" 
              value={newCustomer.openingBalance} 
              onChange={e => setNewCustomer({...newCustomer, openingBalance: e.target.value})} 
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1">
          <label className='flex items-center gap-2 cursor-pointer text-xs text-text-dim font-bold'>
            <input 
              type='checkbox' 
              className="rounded accent-gold"
              checked={newCustomer.whatsappReminders} 
              onChange={e => setNewCustomer({...newCustomer, whatsappReminders: e.target.checked})} 
            />
            <span>تفعيل ميزة تذكيرات واتساب للمديونية</span>
          </label>

          <button 
            type="submit"
            disabled={loading} 
            className="w-full sm:w-auto px-6 py-3 bg-gold text-white rounded-2xl font-bold hover:bg-gold2 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg active:scale-95 text-xs"
          >
            <span>💾</span>
            <span>{loading ? 'جاري الحفظ...' : (editingCustomerId ? 'حفظ التعديلات' : 'تسجيل وحفظ العميل')}</span>
          </button>
        </div>
      </form>

      {/* Customers List Section */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-base font-bold text-text-main flex items-center gap-2">
            <span>سجل العملاء والمديونيات</span>
            <span className="text-xs bg-card2 px-2 py-0.5 rounded-full border border-border text-text-dim font-mono">
              ({filteredCustomers.length})
            </span>
          </h3>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
            <input
              type="text"
              placeholder="بحث بالاسم أو الهاتف..."
              className="w-full bg-card border border-border pr-9 pl-3 py-2 rounded-2xl text-xs focus:outline-none focus:border-gold"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <p className="text-center py-6 text-text-dim text-sm">جاري تحميل سجل العملاء...</p>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-card p-8 rounded-3xl border border-border text-center text-text-dim space-y-2">
            <Users size={32} className="mx-auto opacity-30" />
            <p className="text-sm font-bold">لا يوجد عملاء مطابقين للبحث</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredCustomers.map(c => {
              const balance = Number(c.currentBalance ?? c.openingBalance) || 0;
              return (
                <div 
                  key={c.id} 
                  className="bg-card p-4 rounded-3xl border border-border flex flex-col justify-between gap-3 hover:border-gold/40 transition-all shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-sm text-text-main">{c.name}</h4>
                      {c.phone && (
                        <p className="text-text-dim text-xs flex items-center gap-1 mt-0.5 font-mono">
                          <Phone size={12} className="text-gold" />
                          <span>{c.phone}</span>
                        </p>
                      )}
                    </div>

                    <div className="text-left">
                      <span className="text-[10px] text-text-dim block">رصيد الحساب / الدين</span>
                      <span className={`font-black font-mono text-sm ${balance > 0 ? 'text-danger' : 'text-success'}`}>
                        {balance.toLocaleString()} ج.م
                      </span>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center justify-between border-t border-border/60 pt-2.5 mt-1 text-xs">
                    {c.phone && c.phone !== '0000000000' ? (
                      <button
                        type="button"
                        onClick={() => sendWhatsAppReminder(c)}
                        className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 transition-all text-[11px]"
                        title="إرسال كشف حساب ومطالبة سداد بالواتساب"
                      >
                        <MessageCircle size={13} />
                        <span>تذكير بالواتساب</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-text-dim">بدون هاتف</span>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEditCustomer(c)}
                        className="bg-card2 hover:bg-card border border-border p-1.5 rounded-xl text-text-dim hover:text-white transition-all"
                        title="تعديل العميل"
                      >
                        <Edit3 size={14} />
                      </button>

                      {c.id !== 'cash-customer' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomer(c.id)}
                          className="bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/20 p-1.5 rounded-xl transition-all"
                          title="حذف العميل"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
