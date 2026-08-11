import React, { useState, useEffect } from 'react';
import { Customer, Sale } from '../types/types';
import { getCustomers, saveCustomer, deleteCustomer, getSales, getUserPreferences } from '../lib/firestoreService';
import { useTenant } from '../context/TenantContext';
import Toast from './Toast';
import CustomerStatementModal from './CustomerStatementModal';
import ColumnManagerModal from './ColumnManagerModal';
import { CUSTOMERS_COLUMNS, CUSTOMERS_DEFAULT_VISIBLE } from '../lib/columns';
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
  FileText,
  X,
  Sliders,
  Table as TableIcon,
  LayoutGrid
} from 'lucide-react';

export default function Customers() {
  const { companyId, currentUser } = useTenant();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', customerType: 'retail' as 'retail'|'half_wholesale'|'wholesale', openingBalance: '', creditLimit: '', whatsappReminders: true });
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Column Manager & View Mode
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [visibleKeys, setVisibleKeys] = useState<string[]>(CUSTOMERS_DEFAULT_VISIBLE);
  const [orderedKeys, setOrderedKeys] = useState<string[]>(() => CUSTOMERS_COLUMNS.map(c => c.key));
  const [showColModal, setShowColModal] = useState<boolean>(false);

  const userEmail = currentUser?.email || currentUser?.username || 'admin';
  const hasUnsavedData = Boolean(newCustomer.name || newCustomer.phone || newCustomer.openingBalance);

  useEffect(() => {
    loadCustomers();
    loadPrefs();
  }, [companyId]);

  const loadPrefs = async () => {
    try {
      const prefs = await getUserPreferences(userEmail, 'customers');
      if (prefs && prefs.visible && prefs.order) {
        setVisibleKeys(prefs.visible);
        setOrderedKeys(prefs.order);
      }
    } catch (err) {
      console.warn("Failed to load customers preferences", err);
    }
  };

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
      const [custData, salesData] = await Promise.all([
        getCustomers(companyId),
        getSales(companyId)
      ]);
      setCustomers(custData);
      setSales(salesData);
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
        customerType: newCustomer.customerType,
        openingBalance: parseFloat(newCustomer.openingBalance) || 0,
        creditLimit: parseFloat(newCustomer.creditLimit) || 0,
        whatsappReminders: newCustomer.whatsappReminders
      };

      if (editingCustomerId) {
        custData.id = editingCustomerId;
      }

      await saveCustomer(custData, companyId);
      setNewCustomer({ name: '', phone: '', customerType: 'retail', openingBalance: '', creditLimit: '', whatsappReminders: true });
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
      customerType: c.customerType || 'retail',
      openingBalance: String(c.openingBalance || 0),
      creditLimit: String(c.creditLimit || 0),
      whatsappReminders: c.whatsappReminders ?? true
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingCustomerId(null);
    setNewCustomer({ name: '', phone: '', customerType: 'retail', openingBalance: '', creditLimit: '', whatsappReminders: true });
  };

  const handleDeleteCustomer = async (id: string) => {
    if (id === 'cash-customer') {
      alert('لا يمكن حذف حساب العميل النقدي الافتراضي!');
      return;
    }

    try {
      // Optimistic UI update
      setCustomers(prev => prev.filter(c => c.id !== id));
      await deleteCustomer(id, companyId);
      playSuccessSound();
      setToast({ message: 'تم حذف العميل بنجاح', type: 'success' });
    } catch (err: any) {
      playWarningSound();
      setToast({ message: `فشل الحذف: ${err.message}`, type: 'warning' });
      await loadCustomers();
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
            <label className="block text-text-dim font-bold mb-1">نوع التسعير / العميل:</label>
            <select
              className="bg-card2 border border-border p-3 rounded-2xl w-full font-bold focus:outline-none focus:border-gold"
              value={newCustomer.customerType}
              onChange={e => setNewCustomer({...newCustomer, customerType: e.target.value as any})}
            >
              <option value="retail">تجزئة (السعر العادي)</option>
              <option value="half_wholesale">نصف جملة</option>
              <option value="wholesale">جملة</option>
            </select>
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

          <div>
            <label className="block text-text-dim font-bold mb-1">حد الائتمان المسموح به:</label>
            <input 
              type="number" 
              placeholder="0.00" 
              className="bg-card2 border border-border p-3 rounded-2xl w-full font-mono focus:outline-none focus:border-gold" 
              value={newCustomer.creditLimit} 
              onChange={e => setNewCustomer({...newCustomer, creditLimit: e.target.value})} 
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

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-card2 p-1 rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${viewMode === 'table' ? 'bg-gold text-white shadow' : 'text-text-dim hover:text-white'}`}
                title="عرض الجدول"
              >
                <TableIcon size={14} />
                <span className="hidden sm:inline">جدول</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${viewMode === 'cards' ? 'bg-gold text-white shadow' : 'text-text-dim hover:text-white'}`}
                title="عرض البطاقات"
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline">بطاقات</span>
              </button>
            </div>

            {/* Column Manager Button */}
            {viewMode === 'table' && (
              <button
                type="button"
                onClick={() => setShowColModal(true)}
                className="bg-card border border-border hover:border-gold px-3 py-2 rounded-xl text-xs font-bold text-text-main transition-all flex items-center gap-1.5 shadow-sm"
                title="تخصيص أعمدة سجل العملاء"
              >
                <Sliders size={14} className="text-gold" />
                <span>تخصيص الأعمدة</span>
              </button>
            )}

            {/* Search Box */}
            <div className="relative w-full sm:w-60">
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
        </div>

        {/* Column Manager Modal */}
        {showColModal && (
          <ColumnManagerModal
            tableName="customers"
            allColumns={CUSTOMERS_COLUMNS}
            defaultVisibleKeys={CUSTOMERS_DEFAULT_VISIBLE}
            currentVisibleKeys={visibleKeys}
            currentOrderedKeys={orderedKeys}
            onSave={(vis, ord) => {
              setVisibleKeys(vis);
              setOrderedKeys(ord);
            }}
            onClose={() => setShowColModal(false)}
          />
        )}

        {loading ? (
          <p className="text-center py-6 text-text-dim text-sm">جاري تحميل سجل العملاء...</p>
        ) : filteredCustomers.length === 0 ? (
          <div className="bg-card p-8 rounded-3xl border border-border text-center text-text-dim space-y-2">
            <Users size={32} className="mx-auto opacity-30" />
            <p className="text-sm font-bold">لا يوجد عملاء مطابقين للبحث</p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-right text-xs">
              <thead className="bg-card2 border-b border-border text-text-dim font-bold">
                <tr>
                  {orderedKeys.map(colKey => {
                    if (!visibleKeys.includes(colKey)) return null;
                    const colDef = CUSTOMERS_COLUMNS.find(c => c.key === colKey);
                    return (
                      <th key={colKey} className={`p-3 ${colKey === 'currentBalance' || colKey === 'openingBalance' || colKey === 'creditLimit' || colKey === 'actions' ? 'text-center' : ''}`}>
                        {colDef?.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredCustomers.map(c => {
                  const balance = Number(c.currentBalance ?? c.openingBalance) || 0;
                  const creditLimit = Number(c.creditLimit) || 0;
                  const isOverLimit = creditLimit > 0 && balance > creditLimit;

                  return (
                    <tr key={c.id} className="hover:bg-card2/50 transition-colors">
                      {orderedKeys.map(colKey => {
                        if (!visibleKeys.includes(colKey)) return null;
                        switch (colKey) {
                          case 'name':
                            return (
                              <td key={colKey} className="p-3 font-bold text-text-main flex items-center gap-2">
                                <span>{c.name}</span>
                                {isOverLimit && <span className="text-[9px] bg-danger text-white px-1.5 py-0.5 rounded-full font-bold">تجاوز الائتمان</span>}
                              </td>
                            );
                          case 'phone':
                            return (
                              <td key={colKey} className="p-3 text-text-dim font-mono text-xs">
                                {c.phone || '-'}
                              </td>
                            );
                          case 'customerType':
                            return (
                              <td key={colKey} className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.customerType === 'wholesale' ? 'bg-purple-500/10 text-purple-400' : c.customerType === 'half_wholesale' ? 'bg-blue-500/10 text-blue-400' : 'bg-gold/10 text-gold'}`}>
                                  {c.customerType === 'wholesale' ? 'جملة' : c.customerType === 'half_wholesale' ? 'نصف جملة' : 'قطاعي'}
                                </span>
                              </td>
                            );
                          case 'currentBalance':
                            return (
                              <td key={colKey} className={`p-3 text-center font-mono font-black text-xs ${balance > 0 ? 'text-danger' : 'text-success'}`}>
                                {balance.toLocaleString()} ج.م
                              </td>
                            );
                          case 'openingBalance':
                            return (
                              <td key={colKey} className="p-3 text-center font-mono text-text-dim text-xs">
                                {Number(c.openingBalance || 0).toLocaleString()} ج.م
                              </td>
                            );
                          case 'creditLimit':
                            return (
                              <td key={colKey} className="p-3 text-center font-mono font-bold text-text-main text-xs">
                                {creditLimit > 0 ? `${creditLimit.toLocaleString()} ج.م` : 'غير محدد'}
                              </td>
                            );
                          case 'whatsappReminders':
                            return (
                              <td key={colKey} className="p-3 text-center">
                                {c.whatsappReminders !== false ? (
                                  <span className="text-emerald-400 font-bold text-[10px]">مفعل ✓</span>
                                ) : (
                                  <span className="text-text-dim text-[10px]">معطل</span>
                                )}
                              </td>
                            );
                          case 'notes':
                            return (
                              <td key={colKey} className="p-3 text-text-dim text-xs">
                                {c.notes || '-'}
                              </td>
                            );
                          case 'createdAt':
                            return (
                              <td key={colKey} className="p-3 text-text-dim font-mono text-[11px]">
                                {c.createdAt ? new Date(c.createdAt).toLocaleDateString('ar-EG') : '-'}
                              </td>
                            );
                          case 'actions':
                            return (
                              <td key={colKey} className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setStatementCustomer(c)}
                                    className="bg-gold/10 hover:bg-gold text-gold hover:text-white border border-gold/30 px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition-all text-[10px]"
                                    title="كشف حساب تفصيلي"
                                  >
                                    <FileText size={12} />
                                    <span>كشف</span>
                                  </button>

                                  {c.phone && c.phone !== '0000000000' && (
                                    <button
                                      type="button"
                                      onClick={() => sendWhatsAppReminder(c)}
                                      className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 p-1.5 rounded-lg transition-all"
                                      title="إرسال واتساب"
                                    >
                                      <MessageCircle size={12} />
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => startEditCustomer(c)}
                                    className="bg-card2 hover:bg-card border border-border p-1.5 rounded-lg text-text-dim hover:text-white transition-all"
                                    title="تعديل"
                                  >
                                    <Edit3 size={12} />
                                  </button>

                                  {deleteConfirmId === c.id ? (
                                    <div className="flex items-center gap-1 bg-danger/20 border border-danger p-0.5 rounded-lg">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleDeleteCustomer(c.id);
                                          setDeleteConfirmId(null);
                                        }}
                                        className="bg-danger text-white text-[10px] px-2 py-0.5 rounded font-bold"
                                      >
                                        تأكيد
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeleteConfirmId(null)}
                                        className="bg-card2 text-[10px] px-2 py-0.5 rounded font-bold text-text-dim"
                                      >
                                        إلغاء
                                      </button>
                                    </div>
                                  ) : (
                                    c.id !== 'cash-customer' && (
                                      <button
                                        type="button"
                                        onClick={() => setDeleteConfirmId(c.id)}
                                        className="bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/30 p-1.5 rounded-lg transition-all"
                                        title="حذف"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )
                                  )}
                                </div>
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredCustomers.map(c => {
              const balance = Number(c.currentBalance ?? c.openingBalance) || 0;
              const creditLimit = Number(c.creditLimit) || 0;
              const isOverLimit = creditLimit > 0 && balance > creditLimit;
              return (
                <div 
                  key={c.id} 
                  className={`bg-card p-4 rounded-3xl border ${isOverLimit ? 'border-danger' : 'border-border'} flex flex-col justify-between gap-3 hover:border-gold/40 transition-all shadow-sm`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-sm text-text-main flex items-center gap-2">
                        {c.name}
                        {isOverLimit && <span className="text-[10px] bg-danger text-white px-2 py-0.5 rounded-full">تجاوز حد الائتمان</span>}
                      </h4>
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
                  <div className="flex items-center justify-between border-t border-border/60 pt-2.5 mt-1 text-xs gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setStatementCustomer(c)}
                      className="bg-gold/10 hover:bg-gold text-gold hover:text-white border border-gold/30 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1 transition-all text-[11px]"
                      title="فتح كشف حساب تفصيلي مفلتر بالفواتير والأصناف"
                    >
                      <FileText size={13} />
                      <span>كشف حساب تفصيلي</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      {c.phone && c.phone !== '0000000000' && (
                        <button
                          type="button"
                          onClick={() => sendWhatsAppReminder(c)}
                          className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 px-2 py-1 rounded-xl font-bold flex items-center gap-1 transition-all text-[11px]"
                          title="إرسال تذكير بالواتساب"
                        >
                          <MessageCircle size={13} />
                          <span>واتساب</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => startEditCustomer(c)}
                        className="bg-card2 hover:bg-card border border-border px-2.5 py-1 rounded-xl text-text-dim hover:text-white transition-all text-[11px] font-bold flex items-center gap-1"
                        title="تعديل العميل"
                      >
                        <Edit3 size={13} />
                        <span>تعديل</span>
                      </button>

                      {deleteConfirmId === c.id ? (
                        <div className="flex items-center gap-1 bg-danger/20 border border-danger p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => {
                              handleDeleteCustomer(c.id);
                              setDeleteConfirmId(null);
                            }}
                            className="bg-danger text-white text-[11px] px-2 py-1 rounded-lg font-bold"
                          >
                            تأكيد
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="bg-card2 text-[11px] px-2 py-1 rounded-lg font-bold text-text-dim"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        c.id !== 'cash-customer' && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(c.id)}
                            className="bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/30 px-2.5 py-1 rounded-xl transition-all text-[11px] font-bold flex items-center gap-1"
                            title="حذف العميل"
                          >
                            <Trash2 size={13} />
                            <span>حذف</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {statementCustomer && (
        <CustomerStatementModal
          customer={statementCustomer}
          sales={sales}
          onClose={() => setStatementCustomer(null)}
        />
      )}
    </div>
  );
}
