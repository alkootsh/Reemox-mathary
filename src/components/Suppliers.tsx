import React, { useState, useEffect } from 'react';
import { Supplier, Purchase } from '../types/types';
import { getSuppliers, saveSupplier, deleteSupplier, getPurchases, getUserPreferences } from '../lib/firestoreService';
import { useTenant } from '../context/TenantContext';
import Toast from './Toast';
import { playSuccessSound, playWarningSound } from '../lib/sound';
import { 
  Trash2, 
  Search, 
  Sliders, 
  Table as TableIcon, 
  LayoutGrid, 
  FileText, 
  Edit3, 
  Phone, 
  Mail, 
  Building2, 
  UserPlus, 
  X, 
  DollarSign,
  TrendingDown
} from 'lucide-react';
import SupplierStatementModal from './SupplierStatementModal';
import ColumnManagerModal from './ColumnManagerModal';
import { SUPPLIERS_COLUMNS, SUPPLIERS_DEFAULT_VISIBLE } from '../lib/columns';

export default function Suppliers() {
  const { companyId, currentUser } = useTenant();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [newSupplier, setNewSupplier] = useState({ id: '', name: '', contactPerson: '', phone: '', email: '', openingBalance: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showStatement, setShowStatement] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Search, View Mode & Column Customization
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [visibleKeys, setVisibleKeys] = useState<string[]>(SUPPLIERS_DEFAULT_VISIBLE);
  const [orderedKeys, setOrderedKeys] = useState<string[]>(() => SUPPLIERS_COLUMNS.map(c => c.key));
  const [showColModal, setShowColModal] = useState<boolean>(false);

  const userEmail = currentUser?.email || currentUser?.username || 'admin';
  const hasUnsavedData = Boolean(newSupplier.name || newSupplier.phone || newSupplier.contactPerson || newSupplier.openingBalance);

  useEffect(() => {
    loadData();
    loadPrefs();
  }, [companyId]);

  const loadPrefs = async () => {
    try {
      const prefs = await getUserPreferences(userEmail, 'suppliers');
      if (prefs && prefs.visible && prefs.order) {
        setVisibleKeys(prefs.visible);
        setOrderedKeys(prefs.order);
      }
    } catch (err) {
      console.warn("Failed to load suppliers preferences", err);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [sList, pList] = await Promise.all([getSuppliers(companyId), getPurchases(companyId)]);
      setSuppliers(sList);
      setPurchases(pList);
    } catch (err: any) {
      console.error('Error loading data:', err.code, err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddOrUpdateSupplier = async () => {
    if (!newSupplier.name || !newSupplier.phone) {
      playWarningSound();
      setToast({ message: 'تنبيه: يوجد بيانات غير محفوظة أو ناقصة (يرجى إدخال الاسم ورقم الهاتف)', type: 'warning' });
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      await saveSupplier({
        ...(newSupplier.id ? { id: newSupplier.id } : {}),
        name: newSupplier.name,
        contactPerson: newSupplier.contactPerson,
        phone: newSupplier.phone,
        email: newSupplier.email,
        openingBalance: parseFloat(newSupplier.openingBalance) || 0,
        purchases: [],
        payments: []
      }, companyId);
      setNewSupplier({ id: '', name: '', contactPerson: '', phone: '', email: '', openingBalance: '' });
      setIsEditing(false);
      await loadData();
      playSuccessSound();
      setToast({ message: isEditing ? 'تم تعديل بيانات المورد بنجاح' : 'تم إضافة المورد بنجاح', type: 'success' });
    } catch (err: any) {
      console.error('Error saving supplier:', err.code, err.message);
      setErrorMsg(`[${err.code || 'ERROR'}] ${err.message}`);
      playWarningSound();
      setToast({ message: `فشل الحفظ: ${err.message}`, type: 'warning' });
    } finally {
      setLoading(false);
    }
  };

  const startEditSupplier = (s: Supplier) => {
    setNewSupplier({
      id: s.id,
      name: s.name,
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      email: s.email || '',
      openingBalance: s.openingBalance?.toString() || '0'
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setNewSupplier({ id: '', name: '', contactPerson: '', phone: '', email: '', openingBalance: '' });
    setIsEditing(false);
  };

  const handleDeleteSupplier = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    try {
      setSuppliers(prev => prev.filter(s => s.id !== id));
      if (selectedSupplier?.id === id) setSelectedSupplier(null);
      await deleteSupplier(id, companyId);
      playSuccessSound();
      setToast({ message: 'تم حذف المورد بنجاح', type: 'success' });
    } catch (err: any) {
      console.error('Error deleting supplier:', err);
      playWarningSound();
      setToast({ message: `فشل الحذف: ${err.message || err}`, type: 'warning' });
      await loadData();
    }
  };

  const filteredSuppliers = suppliers.filter(s => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return s.name.toLowerCase().includes(q) || 
           s.phone?.toLowerCase().includes(q) || 
           s.contactPerson?.toLowerCase().includes(q) || 
           s.email?.toLowerCase().includes(q);
  });

  const totalSupplierDebts = suppliers.reduce((sum, s) => sum + (Number(s.currentBalance ?? s.openingBalance) || 0), 0);

  return (
    <div className="p-4 sm:p-5 pb-28 max-w-6xl mx-auto space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {showStatement && selectedSupplier && (
        <SupplierStatementModal 
          supplier={selectedSupplier} 
          purchases={purchases} 
          onClose={() => setShowStatement(false)} 
        />
      )}

      {/* Summary KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card p-4 rounded-3xl border border-border flex items-center justify-between">
          <div>
            <span className="text-xs text-text-dim font-bold">إجمالي عدد الموردين</span>
            <h4 className="text-2xl font-black text-text-main mt-0.5">{suppliers.length} مورد</h4>
          </div>
          <div className="p-3 bg-card2 text-gold rounded-2xl border border-border">
            <Building2 size={24} />
          </div>
        </div>

        <div className="bg-card p-4 rounded-3xl border border-border flex items-center justify-between">
          <div>
            <span className="text-xs text-text-dim font-bold">إجمالي مستحقات الموردين (ديون)</span>
            <h4 className="text-2xl font-black text-danger mt-0.5">{totalSupplierDebts.toLocaleString()} ج.م</h4>
          </div>
          <div className="p-3 bg-danger/10 text-danger rounded-2xl border border-danger/20">
            <TrendingDown size={24} />
          </div>
        </div>

        <div className="bg-card p-4 rounded-3xl border border-border flex items-center justify-between">
          <div>
            <span className="text-xs text-text-dim font-bold">الموردين النشطين مؤخراً</span>
            <h4 className="text-2xl font-black text-emerald-400 mt-0.5">{suppliers.filter(s => (s.currentBalance ?? 0) > 0).length}</h4>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <DollarSign size={24} />
          </div>
        </div>
      </div>

      {/* Add / Edit Form */}
      <div className="bg-card p-5 rounded-3xl border border-border space-y-4 shadow-sm">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <h2 className="text-base font-black text-text-main flex items-center gap-2">
            <UserPlus size={18} className="text-gold" />
            <span>{isEditing ? 'تعديل بيانات المورد' : 'إضافة مورد جديد للنظام'}</span>
          </h2>
          {isEditing && (
            <button
              onClick={cancelEdit}
              className="text-text-dim hover:text-white text-xs font-bold flex items-center gap-1 bg-card2 px-3 py-1.5 rounded-xl border border-border"
            >
              <X size={14} />
              <span>إلغاء التعديل</span>
            </button>
          )}
          {hasUnsavedData && !isEditing && (
            <span className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30 animate-pulse">
              ⚠️ يوجد بيانات غير محفوظة
            </span>
          )}
        </div>

        {errorMsg && <div className="bg-danger/10 border border-danger p-3 rounded-xl text-danger text-sm">{errorMsg}</div>}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold text-text-dim block mb-1">اسم المورد / الشركة *</label>
            <input 
              placeholder="مثال: شركة النصر للتوريدات" 
              className="bg-card2 border border-border p-3 rounded-2xl w-full text-xs font-bold text-text-main focus:border-gold focus:outline-none" 
              value={newSupplier.name || ''} 
              onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} 
            />
          </div>
          <div>
            <label className="text-xs font-bold text-text-dim block mb-1">مسؤول التواصل / المندوب</label>
            <input 
              placeholder="مثال: أ. محمد أحمد" 
              className="bg-card2 border border-border p-3 rounded-2xl w-full text-xs font-bold text-text-main focus:border-gold focus:outline-none" 
              value={newSupplier.contactPerson || ''} 
              onChange={e => setNewSupplier({...newSupplier, contactPerson: e.target.value})} 
            />
          </div>
          <div>
            <label className="text-xs font-bold text-text-dim block mb-1">رقم الهاتف *</label>
            <input 
              placeholder="مثال: 01012345678" 
              className="bg-card2 border border-border p-3 rounded-2xl w-full text-xs font-mono text-text-main focus:border-gold focus:outline-none" 
              value={newSupplier.phone || ''} 
              onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} 
            />
          </div>
          <div>
            <label className="text-xs font-bold text-text-dim block mb-1">البريد الإلكتروني</label>
            <input 
              placeholder="supplier@example.com" 
              className="bg-card2 border border-border p-3 rounded-2xl w-full text-xs text-text-main focus:border-gold focus:outline-none" 
              value={newSupplier.email || ''} 
              onChange={e => setNewSupplier({...newSupplier, email: e.target.value})} 
            />
          </div>
          <div>
            <label className="text-xs font-bold text-text-dim block mb-1">رصيد أول المدة (مستحق للمورد)</label>
            <input 
              type="number" 
              placeholder="0.00" 
              disabled={isEditing}
              className="bg-card2 border border-border p-3 rounded-2xl w-full text-xs font-mono font-bold text-text-main focus:border-gold focus:outline-none disabled:opacity-50" 
              value={newSupplier.openingBalance || ''} 
              onChange={e => setNewSupplier({...newSupplier, openingBalance: e.target.value})} 
            />
          </div>
          <div className="flex items-end">
            <button 
              onClick={handleAddOrUpdateSupplier} 
              disabled={loading} 
              className="w-full bg-gold hover:bg-gold2 text-white p-3 rounded-2xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg active:scale-95 text-xs"
            >
              <span>💾</span>
              <span>{loading ? 'جاري الحفظ...' : isEditing ? 'تحديث بيانات المورد' : 'حفظ المورد'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Directory & Records Section */}
      <div className="bg-card p-5 rounded-3xl border border-border space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border pb-3">
          <div>
            <h3 className="text-base font-black text-text-main flex items-center gap-2">
              <Building2 size={18} className="text-gold" />
              <span>دليل وسجل الموردين ({filteredSuppliers.length})</span>
            </h3>
            <p className="text-xs text-text-dim mt-0.5">إدارة حسابات الموردين والأرصدة المستحقة وكشوف الحسابات التفصيلية</p>
          </div>

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
                title="تخصيص أعمدة سجل الموردين"
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
                className="w-full bg-card2 border border-border pr-9 pl-3 py-2 rounded-2xl text-xs focus:outline-none focus:border-gold text-text-main"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Column Manager Modal */}
        {showColModal && (
          <ColumnManagerModal
            tableName="suppliers"
            allColumns={SUPPLIERS_COLUMNS}
            defaultVisibleKeys={SUPPLIERS_DEFAULT_VISIBLE}
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
          <p className="text-center py-8 text-text-dim text-sm">جاري تحميل سجل الموردين...</p>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-12 text-text-dim space-y-2 border border-dashed border-border rounded-2xl">
            <Building2 size={32} className="mx-auto opacity-30" />
            <p className="text-sm font-bold">لا يوجد موردين مطابقين للبحث</p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-right text-xs">
              <thead className="bg-card2 border-b border-border text-text-dim font-bold">
                <tr>
                  {orderedKeys.map(colKey => {
                    if (!visibleKeys.includes(colKey)) return null;
                    const colDef = SUPPLIERS_COLUMNS.find(c => c.key === colKey);
                    return (
                      <th key={colKey} className={`p-3 ${colKey === 'currentBalance' || colKey === 'openingBalance' || colKey === 'actions' ? 'text-center' : ''}`}>
                        {colDef?.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSuppliers.map(s => {
                  const balance = Number(s.currentBalance ?? s.openingBalance) || 0;

                  return (
                    <tr key={s.id} className="hover:bg-card2/50 transition-colors">
                      {orderedKeys.map(colKey => {
                        if (!visibleKeys.includes(colKey)) return null;
                        switch (colKey) {
                          case 'id':
                            return (
                              <td key={colKey} className="p-3 font-mono text-[11px] text-gold font-bold">
                                #{s.id.slice(-6)}
                              </td>
                            );
                          case 'name':
                            return (
                              <td key={colKey} className="p-3 font-bold text-text-main">
                                <span>{s.name}</span>
                              </td>
                            );
                          case 'contactPerson':
                            return (
                              <td key={colKey} className="p-3 text-text-dim text-xs">
                                {s.contactPerson || '-'}
                              </td>
                            );
                          case 'phone':
                            return (
                              <td key={colKey} className="p-3 text-text-dim font-mono text-xs">
                                {s.phone || '-'}
                              </td>
                            );
                          case 'email':
                            return (
                              <td key={colKey} className="p-3 text-text-dim text-xs">
                                {s.email || '-'}
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
                                {Number(s.openingBalance || 0).toLocaleString()} ج.م
                              </td>
                            );
                          case 'notes':
                            return (
                              <td key={colKey} className="p-3 text-text-dim text-xs">
                                {s.notes || '-'}
                              </td>
                            );
                          case 'createdAt':
                            return (
                              <td key={colKey} className="p-3 text-text-dim font-mono text-[11px]">
                                {s.createdAt ? new Date(s.createdAt).toLocaleDateString('ar-EG') : '-'}
                              </td>
                            );
                          case 'actions':
                            return (
                              <td key={colKey} className="p-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSupplier(s);
                                      setShowStatement(true);
                                    }}
                                    className="bg-gold/10 hover:bg-gold text-gold hover:text-white border border-gold/30 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all text-[11px]"
                                    title="كشف حساب تفصيلي"
                                  >
                                    <FileText size={12} />
                                    <span>كشف</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => startEditSupplier(s)}
                                    className="bg-card2 hover:bg-card border border-border p-1.5 rounded-lg text-text-dim hover:text-white transition-all"
                                    title="تعديل"
                                  >
                                    <Edit3 size={12} />
                                  </button>

                                  {deleteConfirmId === s.id ? (
                                    <div className="flex items-center gap-1 bg-danger/20 border border-danger p-0.5 rounded-lg">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          handleDeleteSupplier(s.id, e);
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
                                    <button
                                      type="button"
                                      onClick={() => setDeleteConfirmId(s.id)}
                                      className="bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/30 p-1.5 rounded-lg transition-all"
                                      title="حذف المورد"
                                    >
                                      <Trash2 size={12} />
                                    </button>
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
            {filteredSuppliers.map(s => {
              const balance = Number(s.currentBalance ?? s.openingBalance) || 0;

              return (
                <div key={s.id} className="bg-card2/70 p-4 rounded-2xl border border-border flex flex-col justify-between hover:border-gold/50 transition-all space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-sm text-text-main flex items-center gap-1.5">
                        <Building2 size={15} className="text-gold" />
                        <span>{s.name}</span>
                      </h4>
                      {s.contactPerson && <p className="text-xs text-text-dim mt-0.5">المسؤول: {s.contactPerson}</p>}
                      {s.phone && (
                        <p className="text-xs text-text-dim font-mono mt-0.5 flex items-center gap-1">
                          <Phone size={12} />
                          <span>{s.phone}</span>
                        </p>
                      )}
                      {s.email && (
                        <p className="text-[11px] text-text-dim mt-0.5 flex items-center gap-1">
                          <Mail size={11} />
                          <span>{s.email}</span>
                        </p>
                      )}
                    </div>

                    <div className="text-left">
                      <span className="text-[10px] text-text-dim block">الرصيد المستحق</span>
                      <span className={`font-mono font-black text-sm ${balance > 0 ? 'text-danger' : 'text-success'}`}>
                        {balance.toLocaleString()} ج.م
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSupplier(s);
                        setShowStatement(true);
                      }}
                      className="bg-gold/10 hover:bg-gold text-gold hover:text-white border border-gold/30 px-3 py-1 rounded-xl font-bold flex items-center gap-1.5 transition-all text-xs"
                    >
                      <FileText size={13} />
                      <span>كشف حساب المورد</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEditSupplier(s)}
                        className="bg-card hover:bg-card2 border border-border p-1.5 rounded-lg text-text-dim hover:text-white transition-all text-xs"
                        title="تعديل"
                      >
                        <Edit3 size={13} />
                      </button>

                      {deleteConfirmId === s.id ? (
                        <div className="flex items-center gap-1 bg-danger/20 border border-danger p-0.5 rounded-lg">
                          <button
                            type="button"
                            onClick={(e) => {
                              handleDeleteSupplier(s.id, e);
                              setDeleteConfirmId(null);
                            }}
                            className="bg-danger text-white text-[10px] px-2 py-0.5 rounded font-bold"
                          >
                            تأكيد
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(null)}
                            className="bg-card text-[10px] px-2 py-0.5 rounded font-bold text-text-dim"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(s.id)}
                          className="bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/30 p-1.5 rounded-lg transition-all text-xs"
                          title="حذف"
                        >
                          <Trash2 size={13} />
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
