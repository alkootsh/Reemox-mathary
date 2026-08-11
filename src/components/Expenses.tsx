import React, { useState, useEffect, useMemo } from 'react';
import { Expense, AppUser } from '../types/types';
import { getExpenses, saveExpense, deleteExpense, getExpenseCategories, saveExpenseCategory, getUserPreferences } from '../lib/firestoreService';
import { triggerExpenseNotification } from '../lib/notifications';
import Toast from './Toast';
import { playSuccessSound, playWarningSound } from '../lib/sound';
import { safeParse } from '../lib/json';
import ColumnManagerModal from './ColumnManagerModal';
import { EXPENSES_COLUMNS, EXPENSES_DEFAULT_VISIBLE } from '../lib/columns';
import { 
  DollarSign, 
  FolderTree, 
  Search, 
  Tag, 
  Plus, 
  Calendar, 
  Filter, 
  CheckCircle, 
  TrendingDown, 
  FileText,
  Clock,
  Layers,
  Sliders,
  Table as TableIcon,
  LayoutGrid
} from 'lucide-react';

interface Props {
  expenses: Expense[];
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;
}

export default function Expenses({ expenses, setExpenses }: Props) {
  const [categories, setCategories] = useState<any[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: '', amount: '', notes: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Column Customization
  const [visibleKeys, setVisibleKeys] = useState<string[]>(EXPENSES_DEFAULT_VISIBLE);
  const [orderedKeys, setOrderedKeys] = useState<string[]>(() => EXPENSES_COLUMNS.map(c => c.key));
  const [showColModal, setShowColModal] = useState<boolean>(false);

  const currentUser: AppUser | null = safeParse(localStorage.getItem('currentUser'), null);
  const userEmail = currentUser?.email || currentUser?.username || 'admin';
  const isAdmin = currentUser?.role === 'admin';

  const hasUnsavedData = Boolean(newExpense.category || newExpense.amount || newExpense.notes);

  useEffect(() => {
    loadData();
    loadPrefs();
  }, []);

  const loadPrefs = async () => {
    try {
      const prefs = await getUserPreferences(userEmail, 'expenses');
      if (prefs && prefs.visible && prefs.order) {
        setVisibleKeys(prefs.visible);
        setOrderedKeys(prefs.order);
      }
    } catch (err) {
      console.warn("Failed to load expenses preferences", err);
    }
  };

  const loadData = async () => {
    try {
      const [expData, catData] = await Promise.all([
        getExpenses(),
        getExpenseCategories()
      ]);
      setExpenses(expData);
      setCategories(catData);
      if (catData.length > 0 && !newExpense.category) {
        setNewExpense(prev => ({ ...prev, category: catData[0].name }));
      }
    } catch (err: any) {
      console.error('Error loading expenses or categories:', err);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await saveExpenseCategory({ name: newCategoryName.trim() });
      const addedName = newCategoryName.trim();
      setNewCategoryName('');
      setShowAddCatModal(false);
      setToast({ message: `تمت إضافة بند المصروف "${addedName}" بنجاح`, type: 'success' });
      const updatedCats = await getExpenseCategories();
      setCategories(updatedCats);
      setNewExpense(prev => ({ ...prev, category: addedName }));
    } catch (e: any) {
      setToast({ message: 'فشل إضافة البند: ' + e.message, type: 'warning' });
    }
  };

  const handleSaveExpense = async () => {
    if (!newExpense.category || !newExpense.amount) {
      playWarningSound();
      setToast({ message: 'تنبيه: يرجى اختيار بند المصروف وتحديد المبلغ', type: 'warning' });
      return;
    }

    const amountNum = parseFloat(newExpense.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      playWarningSound();
      setToast({ message: 'تنبيه: يرجى إدخال مبلغ صحيح أكبر من الصفر', type: 'warning' });
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      
      const payload = {
        title: newExpense.category,
        category: newExpense.category,
        amount: amountNum,
        notes: newExpense.notes,
        paymentMethod: 'cash',
        date: new Date().toISOString()
      };

      if (editingId) {
        if (!isAdmin) {
          playWarningSound();
          setToast({ message: 'عذراً: تعديل المصروفات متاح للمدير العام فقط!', type: 'warning' });
          return;
        }
        await saveExpense({
          id: editingId,
          ...payload
        });
        setToast({ message: 'تم تعديل القيد بنجاح وترحيله للحسابات', type: 'success' });
        setEditingId(null);
      } else {
        await saveExpense(payload);
        triggerExpenseNotification(payload).catch(err => console.warn('Expense notification failed:', err));
        setToast({ message: `تم تسجيل قيد المصروف (${newExpense.category}) وترحيله للخزينة والحسابات الرئيسية بنجاح`, type: 'success' });
      }

      setNewExpense({ category: categories[0]?.name || '', amount: '', notes: '' });
      await loadData();
      playSuccessSound();
    } catch (err: any) {
      console.error('Error saving expense:', err.code, err.message);
      setErrorMsg(`[${err.code || 'ERROR'}] ${err.message}`);
      playWarningSound();
      setToast({ message: `فشل تسجيل القيد: ${err.message}`, type: 'warning' });
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (e: Expense) => {
    if (!isAdmin) {
      playWarningSound();
      setToast({ message: 'عذراً: تعديل المصروفات متاح للمدير العام فقط!', type: 'warning' });
      return;
    }
    setEditingId(e.id);
    setNewExpense({
      category: e.category,
      amount: e.amount.toString(),
      notes: e.notes || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      playWarningSound();
      setToast({ message: 'عذراً: حذف المصروفات متاح للمدير العام فقط!', type: 'warning' });
      return;
    }
    try {
      await deleteExpense(id);
      setExpenses(expenses.filter(e => e.id !== id));
      playSuccessSound();
      setToast({ message: 'تم إلغاء وحذف قيد المصروف بنجاح', type: 'success' });
    } catch (err: any) {
      playWarningSound();
      setToast({ message: `فشل الحذف: ${err.message}`, type: 'warning' });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  // Aggregated summary by category (كهرباء، مياه، إيجار، غاز، إلخ)
  const categoryStats = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    expenses.forEach(e => {
      const cat = e.category || 'مصروفات متنوعة';
      const amt = Number(e.amount) || 0;
      const curr = map.get(cat) || { total: 0, count: 0 };
      map.set(cat, { total: curr.total + amt, count: curr.count + 1 });
    });

    return Array.from(map.entries()).map(([name, stat]) => ({
      name,
      total: stat.total,
      count: stat.count
    })).sort((a, b) => b.total - a.total);
  }, [expenses]);

  const totalAllExpenses = useMemo(() => {
    return expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [expenses]);

  // Filtered expenses list
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchCat = selectedCatFilter === 'all' || e.category === selectedCatFilter;
      const matchQuery = !searchQuery.trim() || 
        (e.category && e.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.notes && e.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (e.amount && e.amount.toString().includes(searchQuery));
      return matchCat && matchQuery;
    });
  }, [expenses, selectedCatFilter, searchQuery]);

  return (
    <div className="p-4 sm:p-6 pb-28 max-w-5xl mx-auto space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-text-main flex items-center gap-2">
            <TrendingDown className="text-danger" />
            <span>تسجيل قيود المصروفات وترحيل الحسابات</span>
          </h2>
          <p className="text-xs text-text-dim mt-1">
            تسجيل القيود اليومية المنصرفة من الخزينة وتجميعها آلياً تحت بنود المصروفات الرئيسية (كهرباء، مياه، إيجار، غاز، رواتب...)
          </p>
        </div>

        <div className="text-left sm:text-right bg-card2 px-4 py-2 rounded-2xl border border-border">
          <span className="text-[11px] text-text-dim block">إجمالي المصروفات المرحلة:</span>
          <span className="text-xl font-black text-danger font-mono">{totalAllExpenses.toLocaleString()} ج.م</span>
        </div>
      </div>

      {/* TOP AGGREGATED SUMMARY CARDS (بند مجمع لكل حساب رئيسي) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-text-dim flex items-center gap-1.5">
            <Layers size={14} className="text-gold" />
            <span>الأرصدة المجمعة لحسابات المصروفات الرئيسية:</span>
          </h3>
          <span className="text-[11px] text-text-dim">
            انقر على أي بند للتصفية السريعة
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          <div 
            onClick={() => setSelectedCatFilter('all')}
            className={`p-3 rounded-2xl border cursor-pointer transition-all ${
              selectedCatFilter === 'all' 
                ? 'bg-gold/15 border-gold shadow-sm' 
                : 'bg-card border-border hover:border-gold/40'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-text-main">كل المصروفات</span>
              <span className="text-[10px] font-bold bg-card2 px-2 py-0.5 rounded-full text-text-dim">
                {expenses.length} قيد
              </span>
            </div>
            <div className="text-base font-black text-danger font-mono">
              {totalAllExpenses.toLocaleString()} ج.م
            </div>
          </div>

          {categoryStats.map(cat => {
            const isSelected = selectedCatFilter === cat.name;
            return (
              <div 
                key={cat.name}
                onClick={() => setSelectedCatFilter(isSelected ? 'all' : cat.name)}
                className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                  isSelected 
                    ? 'bg-danger/15 border-danger shadow-sm' 
                    : 'bg-card border-border hover:border-danger/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-text-main truncate" title={cat.name}>{cat.name}</span>
                  <span className="text-[10px] font-bold bg-card2 px-1.5 py-0.2 rounded-full text-text-dim">
                    {cat.count} قيد
                  </span>
                </div>
                <div className="text-base font-black text-danger font-mono">
                  {cat.total.toLocaleString()} ج.م
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {errorMsg && <div className="bg-danger/10 border border-danger p-3 rounded-xl text-danger text-sm">{errorMsg}</div>}
      
      {/* FORM: RECORD EXPENSE ENTRY */}
      <div className="bg-card p-5 sm:p-6 rounded-3xl border border-border space-y-4 shadow-sm">
        <div className="flex justify-between items-center border-b border-border pb-3">
          <h3 className="font-bold text-base text-text-main flex items-center gap-2">
            <DollarSign className="text-gold" size={18} />
            <span>{editingId ? 'تعديل قيد المصروف (صلاحية المدير)' : 'تسجيل قيد مصروف جديد (خصم من الخزينة)'}</span>
          </h3>

          {hasUnsavedData && !editingId && (
            <span className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30 animate-pulse">
              ⚠️ قيد غير محفوظ
            </span>
          )}
        </div>

        {editingId && (
          <div className="flex justify-between items-center bg-gold/10 border border-gold/30 p-2.5 rounded-2xl text-xs text-gold font-bold">
            <span>جاري تعديل القيد رقم: {editingId}</span>
            <button
              onClick={() => {
                setEditingId(null);
                setNewExpense({ category: categories[0]?.name || '', amount: '', notes: '' });
              }}
              className="text-text-dim hover:text-white underline"
            >
              إلغاء التعديل
            </button>
          </div>
        )}

        {/* Category Select / Add Category */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs text-text-dim font-bold flex items-center gap-1">
              <FolderTree size={14} className="text-gold" />
              <span>اختر بند المصروف الرئيسي المسجل في دليل الحسابات:</span>
            </label>
            <button
              type="button"
              onClick={() => setShowAddCatModal(!showAddCatModal)}
              className="text-xs text-gold hover:underline font-bold flex items-center gap-1"
            >
              <Plus size={13} />
              <span>{showAddCatModal ? 'إلغاء الإضافة' : 'إضافة بند رئيسي جديد'}</span>
            </button>
          </div>

          {showAddCatModal ? (
            <div className="flex gap-2 bg-card2 p-2.5 rounded-2xl border border-gold/40">
              <input
                type="text"
                placeholder="اسم بند المصروف الجديد (مثال: إيجار، كهرباء، صيانة...)"
                className="bg-card border border-border p-2.5 rounded-xl text-xs flex-1 font-bold text-text-main focus:border-gold focus:outline-none"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }}
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="bg-gold text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-gold2 transition-all"
              >
                حفظ البند بالدليل
              </button>
            </div>
          ) : (
            <select
              className="bg-card2 border border-border p-3 rounded-2xl w-full text-sm font-bold text-text-main focus:border-gold focus:outline-none"
              value={newExpense.category}
              onChange={e => setNewExpense({...newExpense, category: e.target.value})}
            >
              <option value="">-- اختر بند المصروف الرئيسي --</option>
              {categories.map(c => (
                <option key={c.id || c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Amount and Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="text-xs text-text-dim font-bold block mb-1">المبلغ المنصرف (ج.م):</label>
            <input 
              type="number" 
              placeholder="0.00" 
              className="bg-card2 border border-border p-3 rounded-2xl w-full text-sm font-bold font-mono text-text-main focus:border-gold focus:outline-none" 
              value={newExpense.amount || ''} 
              onChange={e => setNewExpense({...newExpense, amount: e.target.value})} 
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-text-dim font-bold block mb-1">البيان / ملاحظات توضيحية (اختياري):</label>
            <input 
              type="text"
              placeholder="مثال: فاتورة كهرباء شهر 8، صيانة التكييف..." 
              className="bg-card2 border border-border p-3 rounded-2xl w-full text-sm text-text-main focus:border-gold focus:outline-none" 
              value={newExpense.notes || ''} 
              onChange={e => setNewExpense({...newExpense, notes: e.target.value})} 
              onKeyDown={e => { if (e.key === 'Enter') handleSaveExpense(); }}
            />
          </div>
        </div>
        
        <button 
          onClick={handleSaveExpense} 
          disabled={loading} 
          className="w-full bg-gold hover:bg-gold2 text-white p-3.5 rounded-2xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg active:scale-98"
        >
          <CheckCircle size={18} />
          <span>{loading ? 'جاري الحفظ والترحيل...' : (editingId ? 'تحديث وحفظ التعديلات' : 'تسجيل وترحيل قيد المصروف')}</span>
        </button>
      </div>

      {/* FILTER & JOURNAL LIST */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
            <FileText size={18} className="text-gold" />
            <span>سجل دفتر قيود المصروفات ({filteredExpenses.length} من {expenses.length})</span>
          </h3>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-card2 p-1 rounded-xl border border-border">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${viewMode === 'table' ? 'bg-gold text-white shadow' : 'text-text-dim hover:text-white'}`}
                title="عرض الجدول"
              >
                <TableIcon size={14} />
                <span className="hidden sm:inline">جدول</span>
              </button>
              <button
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
                onClick={() => setShowColModal(true)}
                className="bg-card border border-border hover:border-gold px-3 py-2 rounded-xl text-xs font-bold text-text-main transition-all flex items-center gap-1.5 shadow-sm"
                title="تخصيص أعمدة جدول المصروفات"
              >
                <Sliders size={14} className="text-gold" />
                <span>تخصيص الأعمدة</span>
              </button>
            )}

            {/* Search Box */}
            <div className="relative w-full sm:w-56">
              <Search size={15} className="absolute right-3 top-3 text-text-dim" />
              <input 
                type="text"
                placeholder="بحث في القيود أو البيان..."
                className="bg-card2 border border-border py-2 pr-9 pl-3 rounded-2xl w-full text-xs font-bold text-text-main focus:border-gold focus:outline-none"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Column Manager Modal */}
        {showColModal && (
          <ColumnManagerModal
            tableName="expenses"
            allColumns={EXPENSES_COLUMNS}
            defaultVisibleKeys={EXPENSES_DEFAULT_VISIBLE}
            currentVisibleKeys={visibleKeys}
            currentOrderedKeys={orderedKeys}
            onSave={(vis, ord) => {
              setVisibleKeys(vis);
              setOrderedKeys(ord);
            }}
            onClose={() => setShowColModal(false)}
          />
        )}

        {filteredExpenses.length === 0 ? (
          <div className="bg-card p-10 rounded-3xl border border-border text-center text-text-dim text-sm">
            لا توجد قيود مصروفات مطابقة للبحث أو الفلتر المحدد
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-right text-xs">
              <thead className="bg-card2 border-b border-border text-text-dim font-bold">
                <tr>
                  {orderedKeys.map(colKey => {
                    if (!visibleKeys.includes(colKey)) return null;
                    const colDef = EXPENSES_COLUMNS.find(c => c.key === colKey);
                    return (
                      <th key={colKey} className={`p-3 ${colKey === 'amount' || colKey === 'actions' ? 'text-center' : ''}`}>
                        {colDef?.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredExpenses.map(e => (
                  <tr key={e.id} className="hover:bg-card2/50 transition-colors">
                    {orderedKeys.map(colKey => {
                      if (!visibleKeys.includes(colKey)) return null;
                      switch (colKey) {
                        case 'id':
                          return (
                            <td key={colKey} className="p-3 font-mono font-bold text-gold text-[11px]">
                              #{e.id.slice(-6)}
                            </td>
                          );
                        case 'title':
                          return (
                            <td key={colKey} className="p-3 font-bold text-text-main">
                              {e.notes || e.category}
                            </td>
                          );
                        case 'amount':
                          return (
                            <td key={colKey} className="p-3 text-center font-mono font-black text-danger text-sm">
                              {Number(e.amount || 0).toLocaleString()} ج.م
                            </td>
                          );
                        case 'category':
                          return (
                            <td key={colKey} className="p-3">
                              <span className="bg-gold/10 text-gold px-2.5 py-1 rounded-xl text-xs font-bold">
                                {e.category}
                              </span>
                            </td>
                          );
                        case 'paymentMethod':
                          return (
                            <td key={colKey} className="p-3 text-text-dim font-bold">
                              نقدي (الخزينة)
                            </td>
                          );
                        case 'notes':
                          return (
                            <td key={colKey} className="p-3 text-text-dim max-w-xs truncate">
                              {e.notes || '-'}
                            </td>
                          );
                        case 'createdBy':
                          return (
                            <td key={colKey} className="p-3 text-text-dim text-[11px]">
                              {e.createdBy || 'المدير'}
                            </td>
                          );
                        case 'createdAt':
                          return (
                            <td key={colKey} className="p-3 text-text-dim font-mono text-[11px]">
                              {new Date(e.date).toLocaleDateString('ar-EG')} {new Date(e.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                          );
                        case 'actions':
                          return (
                            <td key={colKey} className="p-3 text-center">
                              {isAdmin ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => startEdit(e)}
                                    className="bg-card2 border border-border hover:border-gold text-xs px-2.5 py-1 rounded-lg font-bold transition-colors"
                                  >
                                    ✏️
                                  </button>
                                  {deleteConfirmId === e.id ? (
                                    <div className="flex items-center gap-1 bg-danger/20 border border-danger p-0.5 rounded-lg">
                                      <button
                                        onClick={() => handleDelete(e.id)}
                                        className="bg-danger text-white text-[10px] px-2 py-0.5 rounded font-bold"
                                      >
                                        تأكيد
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirmId(null)}
                                        className="bg-card2 text-[10px] px-2 py-0.5 rounded font-bold"
                                      >
                                        إلغاء
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDeleteConfirmId(e.id)}
                                      className="bg-danger/10 text-danger border border-danger/30 hover:bg-danger hover:text-white text-xs px-2.5 py-1 rounded-lg font-bold transition-colors"
                                    >
                                      🗑️
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-text-dim">🔒</span>
                              )}
                            </td>
                          );
                        default:
                          return null;
                      }
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredExpenses.map(e => (
              <div 
                key={e.id} 
                className="bg-card p-4 rounded-2xl border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-3 hover:border-gold/30 transition-all shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-text-main">{e.category}</span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                      مرحل للخزينة
                    </span>
                  </div>
                  <p className="text-xs text-text-dim flex items-center gap-2">
                    <Clock size={12} />
                    <span>{new Date(e.date).toLocaleDateString('ar-EG')} - {new Date(e.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                    {e.notes && <span className="text-text-main font-medium">• {e.notes}</span>}
                  </p>
                </div>

                <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4 pt-2 md:pt-0 border-t md:border-t-0 border-border/50">
                  <div className="font-black text-danger text-lg font-mono">
                    {Number(e.amount || 0).toLocaleString()} ج.م
                  </div>

                  {isAdmin ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(e)}
                        className="bg-card2 border border-border hover:border-gold text-xs px-3 py-1.5 rounded-xl font-bold transition-colors"
                      >
                        ✏️ تعديل
                      </button>

                      {deleteConfirmId === e.id ? (
                        <div className="flex items-center gap-1 bg-danger/20 border border-danger p-1 rounded-xl">
                          <button
                            onClick={() => handleDelete(e.id)}
                            className="bg-danger text-white text-xs px-2 py-1 rounded-lg font-bold"
                          >
                            تأكيد
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="bg-card2 text-xs px-2 py-1 rounded-lg font-bold"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(e.id)}
                          className="bg-danger/10 text-danger border border-danger/30 hover:bg-danger hover:text-white text-xs px-3 py-1.5 rounded-xl font-bold transition-colors"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] bg-card2 px-2 py-1 rounded-lg text-text-dim border border-border">
                      🔒 أدمن
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

