import React, { useState, useEffect } from 'react';
import { InventoryMovement } from '../types/types';
import { getInventoryMovements } from '../lib/firestoreService';
import { Search, Filter, ArrowDownLeft, ArrowUpRight, RefreshCw, FileText } from 'lucide-react';

export default function InventoryMovementsView() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  useEffect(() => {
    loadMovements();
  }, []);

  const loadMovements = async () => {
    try {
      setLoading(true);
      const data = await getInventoryMovements();
      // Sort descending by date
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMovements(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = movements.filter(m => {
    const matchSearch = m.productName.toLowerCase().includes(search.toLowerCase()) || m.referenceId.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'ALL' || m.movementType === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto pb-28">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-5 sm:p-6 rounded-3xl border border-border">
        <div>
          <h1 className="text-2xl font-black text-text-main">حركات المخزون (Inventory Movements)</h1>
          <p className="text-sm text-text-dim mt-1">سجل كامل لكل وارد وصادر وتعديلات المخزون بدقة تامة</p>
        </div>
        <button onClick={loadMovements} className="bg-accent text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-gold transition-colors">
          <RefreshCw size={16} /> تحديث القائمة
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3.5 text-text-dim" size={18} />
          <input
            type="text"
            placeholder="بحث باسم المنتج أو رقم المرجع..."
            className="w-full bg-card border border-border pr-10 pl-4 py-3 rounded-2xl text-sm focus:outline-none focus:border-gold"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="bg-card border border-border px-4 py-3 rounded-2xl text-sm focus:outline-none focus:border-gold"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="ALL">جميع الحركات</option>
          <option value="SALE">بيع (SALE)</option>
          <option value="PURCHASE">شراء (PURCHASE)</option>
          <option value="SALE_RETURN">مرتجع بيع (SALE_RETURN)</option>
          <option value="PURCHASE_RETURN">مرتجع شراء (PURCHASE_RETURN)</option>
          <option value="ADJUSTMENT_IN">تسوية إضافة (ADJUSTMENT_IN)</option>
          <option value="ADJUSTMENT_OUT">تسوية خصم (ADJUSTMENT_OUT)</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-12 text-center text-text-dim">جاري التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-text-dim">لا توجد حركات مخزنية مسجلة</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-card2 text-text-dim border-b border-border text-xs">
                <tr>
                  <th className="p-4">المنتج</th>
                  <th className="p-4">نوع الحركة</th>
                  <th className="p-4 text-center">الكمية</th>
                  <th className="p-4 text-center">قبل الحركة</th>
                  <th className="p-4 text-center">بعد الحركة</th>
                  <th className="p-4">المرجع</th>
                  <th className="p-4">التاريخ والوقت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(m => {
                  const isPositive = m.quantity > 0;
                  return (
                    <tr key={m.id} className="hover:bg-card2/50 transition-colors">
                      <td className="p-4 font-bold">{m.productName}</td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1 ${
                          m.movementType.includes('SALE') && !m.movementType.includes('RETURN') ? 'bg-red-500/10 text-red-400' :
                          m.movementType.includes('PURCHASE') || m.movementType.includes('RETURN') || m.movementType.includes('IN') ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {isPositive ? <ArrowDownLeft size={14}/> : <ArrowUpRight size={14}/>}
                          {m.movementType}
                        </span>
                      </td>
                      <td className={`p-4 text-center font-black ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? `+${m.quantity}` : m.quantity}
                      </td>
                      <td className="p-4 text-center text-text-dim">{m.stockBefore}</td>
                      <td className="p-4 text-center font-bold">{m.stockAfter}</td>
                      <td className="p-4 font-mono text-xs text-text-dim">{m.referenceId}</td>
                      <td className="p-4 text-xs text-text-dim">{new Date(m.createdAt).toLocaleString('ar-EG')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
