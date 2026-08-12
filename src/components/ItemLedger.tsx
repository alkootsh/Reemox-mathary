import React, { useState, useEffect } from 'react';
import { Package, Search, Calendar, ArrowUpRight, ArrowDownLeft, RefreshCw, Filter, FileText } from 'lucide-react';

interface Movement {
  id: string;
  type: string;
  quantity: number;
  balance: number;
  referenceId: string;
  createdAt: string;
  productName: string;
}

interface Product {
  id: string;
  name: string;
  sku: string;
}

export default function ItemLedger() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [ledger, setLedger] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products?companyId=company_default');
      const data = await res.json();
      setProducts(data);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchLedger = async (id: string) => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/reports/item-ledger/${id}?companyId=company_default`);
      const data = await res.json();
      setLedger(data);
    } catch (err) {
      console.error('Error fetching ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  const getMovementLabel = (type: string) => {
    switch (type) {
      case 'SALE': return 'فاتورة مبيعات';
      case 'PURCHASE': return 'فاتورة مشتريات';
      case 'SALE_RETURN': return 'مرتجع مبيعات';
      case 'PURCHASE_RETURN': return 'مرتجع مشتريات';
      case 'ADJUSTMENT': return 'تسوية مخزنية';
      case 'TRANSFER': return 'تحويل بين المستودعات';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-black text-text-main flex items-center gap-2">
              <Package className="text-gold" />
              <span>كارت حركة الصنف (Item Ledger)</span>
            </h2>
            <p className="text-xs text-text-dim mt-1">تتبع حركة الوارد والمنصرف والارصدة التاريخية لصنف محدد</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <select 
                className="w-full bg-card2 border border-border rounded-xl py-2.5 pr-10 pl-3 text-sm font-bold appearance-none outline-none focus:border-gold"
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  fetchLedger(e.target.value);
                }}
              >
                <option value="">اختر الصنف لمعاينة الحركة...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                ))}
              </select>
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim pointer-events-none" size={16} />
            </div>
            
            <button 
              onClick={() => fetchLedger(selectedProductId)}
              className="p-2.5 bg-card2 border border-border rounded-xl hover:text-gold transition-all"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-card2 border-b border-border text-text-dim text-[11px] font-bold uppercase">
                <th className="p-4 text-right">التاريخ والوقت</th>
                <th className="p-4 text-right">نوع الحركة</th>
                <th className="p-4 text-right">المرجع</th>
                <th className="p-4 text-center">الوارد (+)</th>
                <th className="p-4 text-center">المنصرف (-)</th>
                <th className="p-4 text-left">الرصيد المتبقي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-text-dim">جاري تحميل حركة الصنف...</td>
                </tr>
              ) : ledger.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-text-dim">
                    {selectedProductId ? 'لا توجد حركات مسجلة لهذا الصنف' : 'يرجى اختيار صنف لعرض حركته'}
                  </td>
                </tr>
              ) : (
                ledger.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-gold/5 transition-colors">
                    <td className="p-4 text-xs font-mono text-text-dim">
                      {new Date(m.createdAt).toLocaleString('ar-EG')}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {m.quantity > 0 ? (
                          <ArrowDownLeft size={14} className="text-emerald-400" />
                        ) : (
                          <ArrowUpRight size={14} className="text-rose-400" />
                        )}
                        <span className="text-sm font-bold">{getMovementLabel(m.type)}</span>
                      </div>
                    </td>
                    <td className="p-4 text-xs font-mono text-text-dim">
                      {m.referenceId || '---'}
                    </td>
                    <td className="p-4 text-center font-bold text-emerald-400 font-mono">
                      {m.quantity > 0 ? `+${m.quantity}` : '-'}
                    </td>
                    <td className="p-4 text-center font-bold text-rose-400 font-mono">
                      {m.quantity < 0 ? `${m.quantity}` : '-'}
                    </td>
                    <td className="p-4 text-left font-black text-sm font-mono">
                      {m.balance}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
