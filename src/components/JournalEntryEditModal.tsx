import React, { useState, useEffect } from 'react';
import { 
  Expense, 
  Sale, 
  Purchase 
} from '../types/types';
import { 
  saveExpense, 
  deleteExpense, 
  getExpenseCategories,
  getExpenses 
} from '../lib/firestoreService';
import { 
  FileText, 
  X, 
  Check, 
  Trash2, 
  Edit3, 
  AlertCircle, 
  Calendar, 
  DollarSign, 
  Tag, 
  AlignLeft, 
  Vault,
  Clock,
  ArrowDownRight,
  ArrowUpLeft,
  BookOpen
} from 'lucide-react';

export interface EntryItem {
  id: string;
  type: 'expense' | 'sale' | 'purchase' | 'opening';
  rawId: string;
  date: string;
  title: string;
  category?: string;
  amount: number;
  notes?: string;
  isCreditOrDebit: 'in' | 'out';
  customerOrSupplier?: string;
}

interface Props {
  entry: EntryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function JournalEntryEditModal({ entry, isOpen, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [categories, setCategories] = useState<any[]>([]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (entry && isOpen) {
      setAmount(entry.amount.toString());
      setCategory(entry.category || 'مصروفات متنوعة');
      setNotes(entry.notes || '');
      setDate(entry.date ? entry.date.split('T')[0] : new Date().toISOString().split('T')[0]);
      loadCategories();
    }
  }, [entry, isOpen]);

  const loadCategories = async () => {
    try {
      const cats = await getExpenseCategories();
      setCategories(cats);
    } catch (e) {
      console.error(e);
    }
  };

  if (!isOpen || !entry) return null;

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showMsg('يرجى إدخال مبلغ صحيح أكبر من الصفر', 'error');
      return;
    }

    setSaving(true);
    try {
      if (entry.type === 'expense') {
        // Save updated expense to Firestore / SQLite
        await saveExpense({
          id: entry.rawId,
          category: category,
          amount: parsedAmount,
          notes: notes,
          date: new Date(date).toISOString()
        });
        showMsg('تم تعديل وحفظ القيد المحاسبي بنجاح', 'success');
        if (onSaved) onSaved();
        setTimeout(onClose, 800);
      } else if (entry.type === 'opening') {
        // Handle opening cash balance
        const settingsPayload = {
          cashOpening: parsedAmount,
          bankOpening: 0,
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem('maro_treasury_opening', JSON.stringify(settingsPayload));
        showMsg('تم تحديث رصيد أول المدة الافتتاحي', 'success');
        if (onSaved) onSaved();
        setTimeout(onClose, 800);
      } else {
        showMsg('للتعديل التفصيلي للفواتير (مبيعات/مشتريات)، يرجى الذهاب لشاشة المبيعات أو المشتريات الرئيسية', 'error');
      }
    } catch (err: any) {
      showMsg('فشل حفظ القيد: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`هل أنت متأكد من إلغاء وحذف هذا القيد المحاسبي (${entry.title})؟`)) return;

    setSaving(true);
    try {
      if (entry.type === 'expense') {
        await deleteExpense(entry.rawId);
        showMsg('تم حذف القيد المحاسبي بنجاح', 'success');
        if (onSaved) onSaved();
        setTimeout(onClose, 800);
      } else {
        showMsg('يمكنك تعديل أو حذف فواتير المبيعات والمشتريات من الشاشات المخصصة لها', 'error');
      }
    } catch (err: any) {
      showMsg('فشل الحذف: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto dir-rtl">
      <div className="bg-card max-w-lg w-full rounded-3xl border border-gold/40 p-5 sm:p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 my-auto text-right">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-2xl border ${
              entry.isCreditOrDebit === 'in'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-text-main">مراجعة وتعديل القيد المحاسبي</h3>
              <p className="text-xs text-text-dim">معاينة تفاصيل الحركة المالية وتعديل القيود والبيان</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-card2 text-text-dim hover:text-white border border-border transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Message Alert */}
        {message && (
          <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 border ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          }`}>
            <AlertCircle size={16} />
            <span>{message.text}</span>
          </div>
        )}

        {/* Info Banner */}
        <div className="bg-card2 p-4 rounded-2xl border border-border space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-text-dim font-bold">نوع الحركة:</span>
            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
              entry.isCreditOrDebit === 'in'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}>
              {entry.isCreditOrDebit === 'in' ? '↗ مقبوضات (+ إيداع)' : '↘ مدفوعات (- صرف)'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-text-dim font-bold">عنوان الحركة:</span>
            <span className="font-bold text-text-main">{entry.title}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-text-dim font-bold">معرف القيد:</span>
            <span className="font-mono text-[11px] text-gold">{entry.id}</span>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div>
            <label className="font-bold text-text-dim block mb-1 flex items-center gap-1">
              <DollarSign size={14} className="text-gold" />
              <span>مبلغ القيد المحاسبي (ج.م): *</span>
            </label>
            <input
              type="number"
              step="any"
              className="w-full bg-card2 border border-border p-3 rounded-2xl font-black font-mono text-base text-gold focus:border-gold focus:outline-none"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />
          </div>

          {entry.type === 'expense' && (
            <div>
              <label className="font-bold text-text-dim block mb-1 flex items-center gap-1">
                <Tag size={14} className="text-gold" />
                <span>بند المصروف / الحساب الفرعي:</span>
              </label>
              <select
                className="w-full bg-card2 border border-border p-3 rounded-2xl font-bold text-text-main focus:border-gold focus:outline-none"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                {categories.map(c => (
                  <option key={c.id || c.name} value={c.name}>{c.name}</option>
                ))}
                {!categories.some(c => c.name === category) && (
                  <option value={category}>{category}</option>
                )}
              </select>
            </div>
          )}

          <div>
            <label className="font-bold text-text-dim block mb-1 flex items-center gap-1">
              <AlignLeft size={14} className="text-gold" />
              <span>البيان والملاحظات الشارحة للقيد:</span>
            </label>
            <textarea
              rows={2}
              className="w-full bg-card2 border border-border p-3 rounded-2xl font-bold text-text-main focus:border-gold focus:outline-none"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="شرح وتفاصيل الحركة المالية..."
            />
          </div>

          <div>
            <label className="font-bold text-text-dim block mb-1 flex items-center gap-1">
              <Calendar size={14} className="text-gold" />
              <span>تاريخ القيد:</span>
            </label>
            <input
              type="date"
              className="w-full bg-card2 border border-border p-3 rounded-2xl font-bold font-mono text-text-main focus:border-gold focus:outline-none"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          <div className="pt-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-gold hover:bg-gold2 text-white py-3 rounded-2xl font-bold text-xs shadow transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <Check size={16} />
              <span>حفظ وتعديل القيد المحاسبي</span>
            </button>

            {entry.type === 'expense' && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/30 px-4 py-3 rounded-2xl font-bold text-xs transition-all active:scale-95 flex items-center gap-1"
                title="حذف القيد"
              >
                <Trash2 size={16} />
                <span>حذف</span>
              </button>
            )}
          </div>
        </form>

      </div>
    </div>
  );
}
