import React, { useState, useEffect } from 'react';
import { Purchase, Product, AppUser } from '../types/types';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { deletePurchase } from '../lib/firestoreService';
import Toast from './Toast';
import { playSuccessSound, playWarningSound } from '../lib/sound';
import { safeParse } from '../lib/json';

interface Props {
  purchases: Purchase[];
  setPurchases: React.Dispatch<React.SetStateAction<Purchase[]>>;
}

export default function Purchases({ purchases, setPurchases }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPurchase, setNewPurchase] = useState({ supplierName: '', productId: '', quantity: '', cost: '', paymentMethod: 'cash' as const, paidAmount: '' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const currentUser: AppUser | null = safeParse(localStorage.getItem('currentUser'), null);
  const isAdmin = currentUser?.role === 'admin';

  const hasUnsavedData = Boolean(newPurchase.supplierName || newPurchase.productId || newPurchase.quantity || newPurchase.cost);

  useEffect(() => {
    async function loadProducts() {
      const snap = await getDocs(collection(db, 'products'));
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    }
    loadProducts();
  }, []);

  const handleSavePurchase = async () => {
    if (!newPurchase.supplierName || !newPurchase.productId || !newPurchase.quantity || !newPurchase.cost) {
      playWarningSound();
      setToast({ message: 'تنبيه: يرجى ملء جميع الحقول المطلوبة للمشتريات', type: 'warning' });
      return;
    }
    
    const selectedProd = products.find(p => p.id === newPurchase.productId);
    const qty = parseFloat(newPurchase.quantity);
    const cost = parseFloat(newPurchase.cost);
    const total = qty * cost;
    const paid = newPurchase.paymentMethod === 'cash' ? total : (newPurchase.paymentMethod === 'deferred-partial' ? parseFloat(newPurchase.paidAmount) || 0 : 0);
    
    const purchaseData = {
        supplierId: 'sup-1',
        supplierName: newPurchase.supplierName,
        items: [{
            productId: newPurchase.productId,
            productName: selectedProd?.name || 'منتج',
            quantity: qty,
            cost: cost
        }],
        total,
        paymentMethod: newPurchase.paymentMethod,
        paidAmount: paid,
        date: new Date().toISOString()
    };

    try {
        if (editingId) {
          if (!isAdmin) {
            playWarningSound();
            setToast({ message: 'عذراً: التعديل متاح فقط للمدير العام (Admin)', type: 'warning' });
            return;
          }
          await updateDoc(doc(db, 'purchases', editingId), purchaseData);
          setPurchases(purchases.map(p => p.id === editingId ? { ...purchaseData, id: editingId } as Purchase : p));
          setToast({ message: 'تم تعديل فاتورة الشراء بنجاح (صلاحية أدمن)', type: 'success' });
          setEditingId(null);
        } else {
          const docRef = await addDoc(collection(db, 'purchases'), purchaseData);
          setPurchases([...purchases, { ...purchaseData, id: docRef.id }]);
          setToast({ message: 'تم حفظ فاتورة المشتريات بنجاح', type: 'success' });
        }
        playSuccessSound();
        setNewPurchase({ supplierName: '', productId: '', quantity: '', cost: '', paymentMethod: 'cash', paidAmount: '' });
    } catch (err: any) {
        console.error('Error saving purchase:', err.code, err.message);
        playWarningSound();
        setToast({ message: `فشل الحفظ: ${err.message}`, type: 'warning' });
    }
  };

  const startEdit = (p: Purchase) => {
    if (!isAdmin) {
      playWarningSound();
      setToast({ message: 'عذراً: تعديل المعاملات متاح للمدير العام فقط!', type: 'warning' });
      return;
    }
    setEditingId(p.id);
    const item = p.items?.[0];
    setNewPurchase({
      supplierName: p.supplierName,
      productId: item?.productId || '',
      quantity: item?.quantity?.toString() || '',
      cost: item?.cost?.toString() || '',
      paymentMethod: p.paymentMethod as any,
      paidAmount: p.paidAmount?.toString() || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      playWarningSound();
      setToast({ message: 'عذراً: حذف المعاملات متاح للمدير العام فقط!', type: 'warning' });
      return;
    }
    try {
      await deletePurchase(id);
      setPurchases(purchases.filter(p => p.id !== id));
      playSuccessSound();
      setToast({ message: 'تم حذف معاملة الشراء بنجاح (صلاحية أدمن)', type: 'success' });
    } catch (err: any) {
      playWarningSound();
      setToast({ message: `فشل الحذف: ${err.message}`, type: 'warning' });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const getMethodText = (method: string) => {
      switch(method) {
          case 'cash': return 'كاش';
          case 'deferred-full': return 'آجل كلي';
          case 'deferred-partial': return 'آجل جزئي';
          default: return method;
      }
  };

  return (
    <div className="p-4 sm:p-5 pb-28 max-w-4xl mx-auto space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">{editingId ? '✏️ تعديل فاتورة شراء (أدمن)' : 'تسجيل عملية شراء جديدة'}</h2>
          <p className="text-xs text-text-dim">
            {isAdmin ? '🛡️ أنت مسجل بصلاحية المدير العام (يمكنك إضافة، تعديل، وحذف المشتريات)' : '🔒 الصلاحية: مشاهدة وإضافة (التعديل متاح للمدير فقط)'}
          </p>
        </div>
        {hasUnsavedData && (
          <span className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1 rounded-full border border-amber-500/30 animate-pulse">
            ⚠️ يوجد بيانات غير محفوظة
          </span>
        )}
      </div>

      <div className="bg-card p-6 rounded-3xl border border-border space-y-4">
        {editingId && (
          <div className="flex justify-between items-center bg-gold/10 border border-gold/30 p-2.5 rounded-2xl text-xs text-gold font-bold">
            <span>جاري تعديل الفاتورة رقم: {editingId}</span>
            <button
              onClick={() => {
                setEditingId(null);
                setNewPurchase({ supplierName: '', productId: '', quantity: '', cost: '', paymentMethod: 'cash', paidAmount: '' });
              }}
              className="text-text-dim hover:text-white"
            >
              إلغاء التعديل
            </button>
          </div>
        )}

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <input placeholder="اسم المورد" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newPurchase.supplierName} onChange={e => setNewPurchase({...newPurchase, supplierName: e.target.value})} />
            <select className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newPurchase.productId} onChange={e => setNewPurchase({...newPurchase, productId: e.target.value})}>
                <option value="">اختر المنتج</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku})</option>)}
            </select>
            <input type="number" placeholder="الكمية" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newPurchase.quantity} onChange={e => setNewPurchase({...newPurchase, quantity: e.target.value})} />
            <input type="number" placeholder="تكلفة الوحدة" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newPurchase.cost} onChange={e => setNewPurchase({...newPurchase, cost: e.target.value})} />
        </div>
        <select className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newPurchase.paymentMethod} onChange={e => setNewPurchase({...newPurchase, paymentMethod: e.target.value as any})}>
            <option value="cash">كاش</option>
            <option value="deferred-full">آجل كلي</option>
            <option value="deferred-partial">آجل جزئي</option>
        </select>
        {newPurchase.paymentMethod === 'deferred-partial' && (
            <input type="number" placeholder="المبلغ المدفوع" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newPurchase.paidAmount} onChange={e => setNewPurchase({...newPurchase, paidAmount: e.target.value})} />
        )}
        <button onClick={handleSavePurchase} className="w-full bg-gold text-white p-3.5 rounded-2xl font-bold hover:bg-gold2 transition-colors flex items-center justify-center gap-2 shadow-lg">
          <span>💾</span>
          {editingId ? 'تحديث وحفظ التعديلات' : 'تسجيل المشتريات'}
        </button>
      </div>

      <h2 className="text-xl font-bold">سجل المشتريات ({purchases.length})</h2>
      <div className="space-y-3">
        {purchases.map(p => (
          <div key={p.id} className="bg-card p-4 rounded-3xl border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
                <h3 className="font-bold text-base">{p.items?.[0]?.productName || 'منتج'}</h3>
                <p className="text-text-dim text-sm">المورد: {p.supplierName} | {getMethodText(p.paymentMethod)}</p>
                {p.paymentMethod === 'deferred-partial' && <p className='text-xs text-info'>تم دفع: {p.paidAmount} ج.م</p>}
                <p className="text-[11px] text-text-dim mt-1">{new Date(p.date).toLocaleDateString('ar-EG')}</p>
            </div>
            
            <div className='flex items-center gap-4 self-end md:self-auto'>
                <div className='text-right font-black text-gold'>
                  {p.items?.[0]?.quantity || 0} × {p.items?.[0]?.cost || 0} = {p.total} ج.م
                </div>

                {isAdmin ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(p)}
                      className="bg-card2 border border-border hover:border-gold text-xs px-3 py-1.5 rounded-xl font-bold transition-colors"
                      title="تعديل الفاتورة (أدمن)"
                    >
                      ✏️ تعديل
                    </button>
                    {deleteConfirmId === p.id ? (
                      <div className="flex items-center gap-1 bg-danger/20 border border-danger p-1 rounded-xl">
                        <button
                          onClick={() => handleDelete(p.id)}
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
                        onClick={() => setDeleteConfirmId(p.id)}
                        className="bg-danger/10 text-danger border border-danger/30 hover:bg-danger hover:text-white text-xs px-3 py-1.5 rounded-xl font-bold transition-colors"
                        title="حذف الفاتورة (أدمن)"
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
