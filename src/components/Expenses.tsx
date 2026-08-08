import React, { useState, useEffect } from 'react';
import { Expense, AppUser } from '../types/types';
import { getExpenses, saveExpense, deleteExpense } from '../lib/firestoreService';
import Toast from './Toast';
import { playSuccessSound, playWarningSound } from '../lib/sound';
import { safeParse } from '../lib/json';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpense, setNewExpense] = useState({ category: '', amount: '', notes: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const currentUser: AppUser | null = safeParse(localStorage.getItem('currentUser'), null);
  const isAdmin = currentUser?.role === 'admin';

  const hasUnsavedData = Boolean(newExpense.category || newExpense.amount || newExpense.notes);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const data = await getExpenses();
      setExpenses(data);
    } catch (err: any) {
      console.error('Error loading expenses:', err);
    }
  };

  const handleSaveExpense = async () => {
    if (!newExpense.category || !newExpense.amount) {
      playWarningSound();
      setToast({ message: 'تنبيه: يرجى إدخال بند المصروف والمبلغ', type: 'warning' });
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      
      if (editingId) {
        if (!isAdmin) {
          playWarningSound();
          setToast({ message: 'عذراً: تعديل المصروفات متاح للمدير العام فقط!', type: 'warning' });
          return;
        }
        await updateDoc(doc(db, 'expenses', editingId), {
          category: newExpense.category,
          amount: parseFloat(newExpense.amount),
          notes: newExpense.notes
        });
        setToast({ message: 'تم تعديل المصروف بنجاح (صلاحية أدمن)', type: 'success' });
        setEditingId(null);
      } else {
        await saveExpense({
          category: newExpense.category,
          amount: parseFloat(newExpense.amount),
          paymentMethod: 'cash',
          date: new Date().toISOString(),
          notes: newExpense.notes
        });
        setToast({ message: 'تم حفظ المصروف بنجاح', type: 'success' });
      }

      setNewExpense({ category: '', amount: '', notes: '' });
      await loadData();
      playSuccessSound();
    } catch (err: any) {
      console.error('Error saving expense:', err.code, err.message);
      setErrorMsg(`[${err.code || 'ERROR'}] ${err.message}`);
      playWarningSound();
      setToast({ message: `فشل الحفظ: ${err.message}`, type: 'warning' });
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
      setToast({ message: 'تم حذف المصروف بنجاح (صلاحية أدمن)', type: 'success' });
    } catch (err: any) {
      playWarningSound();
      setToast({ message: `فشل الحذف: ${err.message}`, type: 'warning' });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="p-4 sm:p-5 pb-28 max-w-4xl mx-auto space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">{editingId ? '✏️ تعديل بند المصروف (أدمن)' : 'تسجيل مصروف جديد'}</h2>
          <p className="text-xs text-text-dim">
            {isAdmin ? '🛡️ أنت مسجل بصلاحية المدير العام (يمكنك تعديل وحذف أي مصروف)' : '🔒 الصلاحية: مشاهدة وإضافة (التعديل متاح للمدير فقط)'}
          </p>
        </div>
        {hasUnsavedData && (
          <span className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30 animate-pulse">
            ⚠️ يوجد بيانات غير محفوظة
          </span>
        )}
      </div>

      {errorMsg && <div className="bg-danger/10 border border-danger p-3 rounded-xl text-danger text-sm">{errorMsg}</div>}
      
      <div className="bg-card p-5 rounded-3xl border border-border space-y-3 shadow-sm">
        {editingId && (
          <div className="flex justify-between items-center bg-gold/10 border border-gold/30 p-2.5 rounded-2xl text-xs text-gold font-bold">
            <span>جاري تعديل المصروف: {newExpense.category}</span>
            <button
              onClick={() => {
                setEditingId(null);
                setNewExpense({ category: '', amount: '', notes: '' });
              }}
              className="text-text-dim hover:text-white"
            >
              إلغاء التعديل
            </button>
          </div>
        )}

        <input placeholder="بند المصروف (مثال: إيجار، كهرباء، صيانة...)" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newExpense.category} onChange={e => setNewExpense({...newExpense, category: e.target.value})} />
        <input type="number" placeholder="المبلغ (ج.م)" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} />
        <input placeholder="ملاحظات توضيحية (اختياري)" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newExpense.notes} onChange={e => setNewExpense({...newExpense, notes: e.target.value})} />
        
        <button onClick={handleSaveExpense} disabled={loading} className="w-full bg-gold text-white p-3.5 rounded-2xl font-bold hover:bg-gold2 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg">
          <span>💾</span>
          {loading ? 'جاري الحفظ...' : (editingId ? 'تحديث وحفظ التعديلات' : 'تسجيل المصروف')}
        </button>
      </div>

      <h2 className="text-xl font-bold">سجل المصروفات ({expenses.length})</h2>
      <div className="space-y-3">
        {expenses.map(e => (
          <div key={e.id} className="bg-card p-4 rounded-3xl border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
                <h3 className="font-bold text-base">{e.category}</h3>
                <p className="text-text-dim text-sm">{new Date(e.date).toLocaleDateString('ar-EG')} {e.notes ? `- ${e.notes}` : ''}</p>
            </div>

            <div className="flex items-center gap-4 self-end md:self-auto">
              <div className='font-black text-danger text-lg'>{e.amount} ج.م</div>

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
                        تأكيد الحذف
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
                      🗑️ حذف
                    </button>
                  )}
                </div>
              ) : (
                <span className="text-[11px] bg-card2 px-2.5 py-1 rounded-lg text-text-dim border border-border">
                  🔒 التعديل للأدمن
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
