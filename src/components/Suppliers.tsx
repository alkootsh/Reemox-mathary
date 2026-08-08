import React, { useState, useEffect } from 'react';
import { Supplier } from '../types/types';
import { getSuppliers, saveSupplier } from '../lib/firestoreService';
import Toast from './Toast';
import { playSuccessSound, playWarningSound } from '../lib/sound';

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [newSupplier, setNewSupplier] = useState({ name: '', contactPerson: '', phone: '', email: '', openingBalance: '' });
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  const hasUnsavedData = Boolean(newSupplier.name || newSupplier.phone || newSupplier.contactPerson || newSupplier.openingBalance);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const data = await getSuppliers();
      setSuppliers(data);
    } catch (err: any) {
      console.error('Error loading suppliers:', err.code, err.message);
    }
  };

  const handleAddSupplier = async () => {
    if (!newSupplier.name || !newSupplier.phone) {
      playWarningSound();
      setToast({ message: 'تنبيه: يوجد بيانات غير محفوظة أو ناقصة (يرجى إدخال الاسم ورقم الهاتف)', type: 'warning' });
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      await saveSupplier({
        name: newSupplier.name,
        contactPerson: newSupplier.contactPerson,
        phone: newSupplier.phone,
        email: newSupplier.email,
        openingBalance: parseFloat(newSupplier.openingBalance) || 0,
        purchases: [],
        payments: []
      });
      setNewSupplier({ name: '', contactPerson: '', phone: '', email: '', openingBalance: '' });
      await loadSuppliers();
      setToast({ message: 'تم الحفظ بنجاح', type: 'success' });
    } catch (err: any) {
      console.error('Error saving supplier:', err.code, err.message);
      setErrorMsg(`[${err.code || 'ERROR'}] ${err.message}`);
      playWarningSound();
      setToast({ message: `فشل الحفظ: ${err.message}`, type: 'warning' });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="p-4 sm:p-5 pb-28 max-w-4xl mx-auto space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {selectedSupplier ? (
        <div className='space-y-4'>
            <button onClick={() => setSelectedSupplier(null)} className='bg-secondary p-2 rounded-xl'>عودة للقائمة</button>
            <h2 className='text-xl font-bold'>سجل المورد: {selectedSupplier.name}</h2>
            <div className='space-y-2'>
                <h3 className='font-bold'>الرصيد الحالي: {selectedSupplier.currentBalance ?? selectedSupplier.openingBalance} ج.م</h3>
            </div>
        </div>
      ) : (
        <>
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">إضافة مورد جديد</h2>
              {hasUnsavedData && (
                <span className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30 animate-pulse">
                  ⚠️ يوجد بيانات غير محفوظة
                </span>
              )}
            </div>

            {errorMsg && <div className="bg-danger/10 border border-danger p-3 rounded-xl text-danger text-sm">{errorMsg}</div>}
            
            <div className="bg-card p-4 rounded-3xl border border-border space-y-3">
                <input placeholder="اسم المورد" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newSupplier.name} onChange={e => setNewSupplier({...newSupplier, name: e.target.value})} />
                <input placeholder="مسؤول التواصل" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newSupplier.contactPerson} onChange={e => setNewSupplier({...newSupplier, contactPerson: e.target.value})} />
                <input placeholder="رقم الهاتف" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newSupplier.phone} onChange={e => setNewSupplier({...newSupplier, phone: e.target.value})} />
                <input placeholder="البريد الإلكتروني" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newSupplier.email} onChange={e => setNewSupplier({...newSupplier, email: e.target.value})} />
                <input type="number" placeholder="رصيد أول المدة" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newSupplier.openingBalance} onChange={e => setNewSupplier({...newSupplier, openingBalance: e.target.value})} />
                
                <button onClick={handleAddSupplier} disabled={loading} className="w-full bg-gold text-white p-3 rounded-2xl font-bold hover:bg-gold2 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg">
                  <span>💾</span>
                  {loading ? 'جاري الحفظ...' : 'حفظ المورد'}
                </button>
            </div>

            <h2 className="text-xl font-bold">قائمة الموردين (Firestore)</h2>
            <div className="space-y-3">
                {suppliers.map(s => (
                <div key={s.id} onClick={() => setSelectedSupplier(s)} className="bg-card p-4 rounded-3xl border border-border flex justify-between cursor-pointer hover:border-gold transition-colors">
                    <div>
                        <h3 className="font-bold">{s.name}</h3>
                        <p className="text-text-dim text-sm">الهاتف: {s.phone}</p>
                    </div>
                    <div className='text-danger font-bold'>{s.currentBalance ?? s.openingBalance} ج.م</div>
                </div>
                ))}
            </div>
        </>
      )}
    </div>
  );
}
