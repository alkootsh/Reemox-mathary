import React, { useState } from 'react';
import { Expense, Purchase } from '../types/types';

interface Props {
  expenses: Expense[];
  purchases: Purchase[];
}

export default function Accounting({ expenses, purchases }: Props) {
  const [modalType, setModalType] = useState<'expenses' | 'purchases' | null>(null);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + p.total, 0);
  const totalPaidPurchases = purchases.reduce((sum, p) => sum + p.paidAmount, 0);

  return (
    <div className="p-5 pb-24 max-w-4xl mx-auto space-y-6">
      <h2 className="text-xl font-bold mb-4">شاشة الصندوق والحسابات (اضغط على أي بند لعرض التفاصيل)</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          onClick={() => setModalType('expenses')}
          className="bg-card p-6 rounded-3xl border border-border cursor-pointer hover:border-gold transition-all shadow-sm hover:shadow-md"
        >
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-lg">إجمالي المصروفات</h3>
            <span className="text-xs bg-danger/20 text-danger px-3 py-1 rounded-full font-bold">عرض التفاصيل 🔍</span>
          </div>
          <p className="text-3xl font-black text-danger">{totalExpenses} ج.م</p>
          <p className="text-xs text-text-dim mt-2">عدد بنود المصروفات: {expenses.length}</p>
        </div>

        <div 
          onClick={() => setModalType('purchases')}
          className="bg-card p-6 rounded-3xl border border-border cursor-pointer hover:border-gold transition-all shadow-sm hover:shadow-md"
        >
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-lg">إجمالي المشتريات</h3>
            <span className="text-xs bg-gold/20 text-gold px-3 py-1 rounded-full font-bold">عرض التفاصيل 🔍</span>
          </div>
          <p className="text-3xl font-black">{totalPurchases} ج.م</p>
          <div className="flex justify-between text-sm text-text-dim mt-2">
            <span>المدفوع: {totalPaidPurchases} ج.م</span>
            <span>المتبقي: {totalPurchases - totalPaidPurchases} ج.م</span>
          </div>
          <p className="text-xs text-text-dim mt-1">عدد فواتير المشتريات: {purchases.length}</p>
        </div>
      </div>

      {/* Modal for Details */}
      {modalType && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-card border border-border w-full max-w-2xl max-h-[85vh] rounded-3xl p-6 flex flex-col shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
              <h3 className="text-xl font-bold">
                {modalType === 'expenses' ? 'التفصيل الكامل للمصروفات' : 'التفصيل الكامل لفواتير المشتريات'}
              </h3>
              <button 
                onClick={() => setModalType(null)} 
                className="bg-card2 border border-border px-3 py-1.5 rounded-full text-xs font-bold hover:bg-danger hover:text-white transition-colors"
              >
                ✕ إغلاق
              </button>
            </div>

            <div className="overflow-y-auto flex-grow space-y-3 pr-1">
              {modalType === 'expenses' ? (
                expenses.length === 0 ? (
                  <p className="text-center text-text-dim py-8">لا توجد مصروفات مسجلة بعد</p>
                ) : (
                  expenses.map(e => (
                    <div key={e.id} className="bg-card2 p-4 rounded-2xl border border-border flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-base">{e.category}</h4>
                        <p className="text-xs text-text-dim">{new Date(e.date).toLocaleDateString('ar-EG')} {e.notes ? `- ${e.notes}` : ''}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-danger text-lg">{e.amount} ج.م</span>
                      </div>
                    </div>
                  ))
                )
              ) : (
                purchases.length === 0 ? (
                  <p className="text-center text-text-dim py-8">لا توجد مشريات مسجلة بعد</p>
                ) : (
                  purchases.map(p => (
                    <div key={p.id} className="bg-card2 p-4 rounded-2xl border border-border flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-base">المورد: {p.supplierName}</h4>
                        <p className="text-xs text-text-dim">
                          التاريخ: {new Date(p.date).toLocaleDateString('ar-EG')} | الطريقة: {p.paymentMethod === 'cash' ? 'كاش' : p.paymentMethod === 'deferred-full' ? 'آجل كلي' : 'آجل جزئي'}
                        </p>
                        {p.items?.map((item, idx) => (
                          <p key={idx} className="text-xs text-gold mt-1">• {item.productName} ({item.quantity} × {item.cost} ج)</p>
                        ))}
                      </div>
                      <div className="text-right">
                        <div className="font-black text-lg">{p.total} ج.م</div>
                        <div className="text-xs text-text-dim">المدفوع: {p.paidAmount} ج</div>
                      </div>
                    </div>
                  ))
                )
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-border flex justify-between items-center text-sm font-bold text-text-dim">
              <span>إجمالي العناصر: {modalType === 'expenses' ? expenses.length : purchases.length}</span>
              <button 
                onClick={() => setModalType(null)} 
                className="bg-gold text-white px-5 py-2 rounded-2xl font-bold shadow hover:bg-gold2"
              >
                تم
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

