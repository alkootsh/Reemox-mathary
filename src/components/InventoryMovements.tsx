import React, { useState, useEffect } from 'react';
import { InventoryMovement } from '../types/types';
import { getInventoryMovements, getSales, getPurchases } from '../lib/firestoreService';
import { Search, ArrowDownLeft, ArrowUpRight, RefreshCw, Home, Eye, X, Printer, FileText, ShoppingCart, Package } from 'lucide-react';

interface Props {
  onNavigateHome?: () => void;
}

export default function InventoryMovementsView({ onNavigateHome }: Props) {
  const [movements, setMovements] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Invoice Modal State
  const [selectedTx, setSelectedTx] = useState<{
    type: 'SALE' | 'PURCHASE' | 'ADJUSTMENT' | 'MOVEMENT';
    title: string;
    id: string;
    date: string;
    partyName?: string;
    paymentMethod?: string;
    items: { name: string; quantity: number; price?: number; total?: number }[];
    subtotal?: number;
    discount?: number;
    vatAmount?: number;
    finalTotal?: number;
    paidAmount?: number;
    movementInfo?: any;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [movData, salesData, purchData] = await Promise.all([
        getInventoryMovements().catch(() => []),
        getSales().catch(() => []),
        getPurchases().catch(() => [])
      ]);
      
      movData.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setMovements(movData);
      setSales(salesData);
      setPurchases(purchData);
    } catch (err) {
      console.error('Error loading movements & invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (m: any) => {
    const rawType = (m.movementType || m.type || '').toUpperCase();
    const refId = m.referenceId || m.id;

    // 1. Check if Sale
    if (rawType.includes('SALE') && !rawType.includes('PURCHASE')) {
      const foundSale = sales.find(s => s.id === refId || s.invoiceNumber === refId || (s.items && s.items.some((i: any) => i.productId === m.productId)));
      if (foundSale) {
        setSelectedTx({
          type: 'SALE',
          title: `فاتورة مبيعات #${foundSale.invoiceNumber || foundSale.id}`,
          id: foundSale.invoiceNumber || foundSale.id,
          date: foundSale.date || m.createdAt,
          partyName: foundSale.customerName || 'عميل نقدي',
          paymentMethod: foundSale.paymentMethod || 'كاش',
          items: (foundSale.items || []).map((i: any) => ({
            name: i.name || i.productName || 'منتج',
            quantity: Number(i.quantity || 1),
            price: Number(i.unitPrice || i.price || 0),
            total: Number(i.totalPrice || (i.quantity * (i.unitPrice || i.price || 0)))
          })),
          subtotal: Number(foundSale.subtotal || foundSale.finalTotal || 0),
          discount: Number(foundSale.discount || 0),
          vatAmount: Number(foundSale.vatAmount || 0),
          finalTotal: Number(foundSale.finalTotal || foundSale.total || 0),
          paidAmount: Number(foundSale.paidAmount || foundSale.finalTotal || foundSale.total || 0)
        });
        return;
      }
    }

    // 2. Check if Purchase
    if (rawType.includes('PURCHASE')) {
      const foundPurch = purchases.find(p => p.id === refId || p.invoiceNumber === refId || p.purchaseNumber === refId);
      if (foundPurch) {
        setSelectedTx({
          type: 'PURCHASE',
          title: `فاتورة مشتريات #${foundPurch.invoiceNumber || foundPurch.purchaseNumber || foundPurch.id}`,
          id: foundPurch.invoiceNumber || foundPurch.purchaseNumber || foundPurch.id,
          date: foundPurch.date || m.createdAt,
          partyName: foundPurch.supplierName || 'مورد عام',
          paymentMethod: foundPurch.paymentMethod || 'نقداً',
          items: (foundPurch.items || []).map((i: any) => ({
            name: i.productName || 'منتج',
            quantity: Number(i.quantity || 1),
            price: Number(i.cost || i.costPrice || 0),
            total: Number((i.quantity || 1) * (i.cost || i.costPrice || 0))
          })),
          finalTotal: Number(foundPurch.total || 0),
          paidAmount: Number(foundPurch.paidAmount || foundPurch.total || 0)
        });
        return;
      }
    }

    // 3. Fallback: Show Movement Receipt Detail
    setSelectedTx({
      type: 'MOVEMENT',
      title: `سند حركة مخزنية #${m.id || refId}`,
      id: m.id || refId,
      date: m.createdAt || new Date().toISOString(),
      partyName: m.productName || 'منتج مخزني',
      items: [
        {
          name: m.productName || 'صنف مخزني',
          quantity: Number(m.quantity || 0),
          price: 0,
          total: 0
        }
      ],
      movementInfo: m
    });
  };

  const filtered = movements.filter(m => {
    const pName = (m.productName || '').toLowerCase();
    const refId = (m.referenceId || m.id || '').toLowerCase();
    const movType = (m.movementType || m.type || '').toUpperCase();
    const q = search.toLowerCase();

    const matchSearch = pName.includes(q) || refId.includes(q);
    const matchType = typeFilter === 'ALL' || movType === typeFilter || movType.includes(typeFilter);
    return matchSearch && matchType;
  });

  const getMovementLabel = (typeStr: string) => {
    const t = (typeStr || '').toUpperCase();
    if (t.includes('SALE_RETURN')) return '↩️ مرتجع بيع';
    if (t.includes('PURCHASE_RETURN')) return '↪️ مرتجع شراء';
    if (t.includes('SALE')) return '🛒 بيع';
    if (t.includes('PURCHASE')) return '📦 شراء';
    if (t.includes('ADJUSTMENT_IN')) return '➕ تسوية إضافة';
    if (t.includes('ADJUSTMENT_OUT')) return '➖ تسوية خصم';
    if (t.includes('ADJUSTMENT')) return '🛠️ تسوية مخزنية';
    return t || 'حركة مخزنية';
  };

  const businessName = localStorage.getItem('businessName') || 'نظام إدارة المبيعات والمخزون';
  const currency = localStorage.getItem('currency') || 'ج.م';

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto pb-28">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-5 sm:p-6 rounded-3xl border border-border shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-text-main">حركات المخزون (Inventory Movements)</h1>
          <p className="text-sm text-text-dim mt-1">اضغط على أي حركة لعرض واستعراض الفاتورة بالتفصيل</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          {onNavigateHome && (
            <button 
              onClick={onNavigateHome} 
              className="bg-card2 border border-border text-text-main px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-border transition-colors text-xs"
            >
              <Home size={16} /> الرئيسية
            </button>
          )}
          <button 
            onClick={loadData} 
            className="bg-accent text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-gold transition-colors text-xs"
          >
            <RefreshCw size={16} /> تحديث البيانات
          </button>
        </div>
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
          <option value="ADJUSTMENT">تسوية مخزنية (ADJUSTMENT)</option>
        </select>
      </div>

      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="p-12 text-center text-text-dim font-bold">جاري تحميل حركات المخزون والفواتير...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-text-dim">لا توجد حركات مخزنية مسجلة حتى الآن</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-card2 text-text-dim border-b border-border text-xs">
                <tr>
                  <th className="p-4">المنتج</th>
                  <th className="p-4">نوع الحركة</th>
                  <th className="p-4 text-center">الكمية</th>
                  <th className="p-4 text-center">الرصيد السابق</th>
                  <th className="p-4 text-center">الرصيد الحالي</th>
                  <th className="p-4">المرجع / الرقم</th>
                  <th className="p-4">التاريخ والوقت</th>
                  <th className="p-4 text-center">عرض الفاتورة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(m => {
                  const qty = Number(m.quantity || 0);
                  const isPositive = qty > 0;
                  const rawType = m.movementType || m.type || 'ADJUSTMENT';
                  const label = getMovementLabel(rawType);

                  return (
                    <tr 
                      key={m.id || Math.random()} 
                      onClick={() => handleRowClick(m)}
                      className="hover:bg-gold/10 cursor-pointer transition-colors group"
                      title="اضغط للانتقال إلى الفاتورة"
                    >
                      <td className="p-4 font-bold text-text-main group-hover:text-gold transition-colors">{m.productName || 'منتج غير معرف'}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                          rawType.includes('SALE') && !rawType.includes('RETURN') ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                          rawType.includes('PURCHASE') || rawType.includes('RETURN') || rawType.includes('IN') ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                        }`}>
                          {isPositive ? <ArrowDownLeft size={14}/> : <ArrowUpRight size={14}/>}
                          {label}
                        </span>
                      </td>
                      <td className={`p-4 text-center font-black dir-ltr ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isPositive ? `+${qty}` : qty}
                      </td>
                      <td className="p-4 text-center text-text-dim">{m.stockBefore !== undefined ? m.stockBefore : '-'}</td>
                      <td className="p-4 text-center font-bold text-text-main">{m.stockAfter !== undefined ? m.stockAfter : '-'}</td>
                      <td className="p-4 font-mono text-xs text-text-dim">{m.referenceId || m.id || '-'}</td>
                      <td className="p-4 text-xs text-text-dim">
                        {m.createdAt ? new Date(m.createdAt).toLocaleString('ar-EG') : '-'}
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRowClick(m); }}
                          className="bg-accent/10 group-hover:bg-accent text-accent group-hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1 transition-all"
                        >
                          <Eye size={14} />
                          <span>عرض الفاتورة</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ================= INVOICE DETAIL MODAL ================= */}
      {selectedTx && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-card2 p-5 border-b border-border flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-2xl text-white ${selectedTx.type === 'SALE' ? 'bg-accent' : selectedTx.type === 'PURCHASE' ? 'bg-blue-600' : 'bg-amber-600'}`}>
                  {selectedTx.type === 'SALE' ? <ShoppingCart size={20} /> : selectedTx.type === 'PURCHASE' ? <Package size={20} /> : <FileText size={20} />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-text-main">{selectedTx.title}</h3>
                  <p className="text-xs text-text-dim">{businessName} • {new Date(selectedTx.date).toLocaleString('ar-EG')}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedTx(null)}
                className="p-2 rounded-xl text-text-dim hover:text-text-main hover:bg-border transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-sm">
              {/* Info Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-card2/50 p-4 rounded-2xl border border-border text-xs">
                <div>
                  <span className="text-text-dim block">رقم الفاتورة / المرجع</span>
                  <span className="font-mono font-bold text-text-main text-sm">{selectedTx.id}</span>
                </div>
                <div>
                  <span className="text-text-dim block">{selectedTx.type === 'PURCHASE' ? 'المورد' : 'العميل'}</span>
                  <span className="font-bold text-text-main text-sm">{selectedTx.partyName || 'غير حدد'}</span>
                </div>
                {selectedTx.paymentMethod && (
                  <div>
                    <span className="text-text-dim block">طريقة السداد</span>
                    <span className="font-bold text-accent text-sm">{selectedTx.paymentMethod}</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-bold text-text-main mb-3 flex items-center gap-2">
                  <FileText size={16} className="text-gold" />
                  <span>تفاصيل أصناف الفاتورة:</span>
                </h4>
                <div className="border border-border rounded-2xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-card2 text-text-dim border-b border-border">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">اسم الصنف / المنتج</th>
                        <th className="p-3 text-center">الكمية</th>
                        {selectedTx.type !== 'MOVEMENT' && (
                          <>
                            <th className="p-3 text-center">السعر</th>
                            <th className="p-3 text-left">الإجمالي</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedTx.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-card2/30">
                          <td className="p-3 text-text-dim font-mono">{idx + 1}</td>
                          <td className="p-3 font-bold text-text-main">{item.name}</td>
                          <td className="p-3 text-center font-black">{item.quantity}</td>
                          {selectedTx.type !== 'MOVEMENT' && (
                            <>
                              <td className="p-3 text-center font-mono">{(item.price || 0).toLocaleString('ar-EG')} {currency}</td>
                              <td className="p-3 text-left font-black text-text-main font-mono">
                                {(item.total || (item.quantity * (item.price || 0))).toLocaleString('ar-EG')} {currency}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Movement Details fallback info */}
              {selectedTx.type === 'MOVEMENT' && selectedTx.movementInfo && (
                <div className="bg-card2 p-4 rounded-2xl border border-border space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-dim">الرصيد قبل الحركة:</span>
                    <span className="font-bold">{selectedTx.movementInfo.stockBefore ?? '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-dim">الرصيد بعد الحركة:</span>
                    <span className="font-bold text-accent">{selectedTx.movementInfo.stockAfter ?? '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-dim">تاريخ وتسجيل الحركة:</span>
                    <span className="font-mono">{new Date(selectedTx.movementInfo.createdAt).toLocaleString('ar-EG')}</span>
                  </div>
                </div>
              )}

              {/* Invoice Totals Breakdown */}
              {selectedTx.finalTotal !== undefined && selectedTx.type !== 'MOVEMENT' && (
                <div className="bg-card2 p-4 rounded-2xl border border-border space-y-2 text-xs">
                  {selectedTx.subtotal !== undefined && selectedTx.subtotal !== selectedTx.finalTotal && (
                    <div className="flex justify-between text-text-dim">
                      <span>المجموع الفرعي:</span>
                      <span className="font-mono">{selectedTx.subtotal.toLocaleString('ar-EG')} {currency}</span>
                    </div>
                  )}
                  {selectedTx.discount ? (
                    <div className="flex justify-between text-green-500">
                      <span>الخصم:</span>
                      <span className="font-mono">-{selectedTx.discount.toLocaleString('ar-EG')} {currency}</span>
                    </div>
                  ) : null}
                  {localStorage.getItem('taxEnabled') !== 'false' && selectedTx.vatAmount && selectedTx.vatAmount > 0 ? (
                    <div className="flex justify-between text-text-dim">
                      <span>الضريبة:</span>
                      <span className="font-mono">+{selectedTx.vatAmount.toLocaleString('ar-EG')} {currency}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between items-center text-sm font-black text-text-main pt-2 border-t border-border">
                    <span>صافي إجمالي الفاتورة:</span>
                    <span className="text-lg text-accent font-mono">{selectedTx.finalTotal.toLocaleString('ar-EG')} {currency}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-card2 p-4 border-t border-border flex justify-between items-center gap-3">
              <button
                onClick={() => window.print()}
                className="bg-card border border-border hover:bg-border text-text-main px-4 py-2.5 rounded-xl font-bold text-xs inline-flex items-center gap-2 transition-colors"
              >
                <Printer size={16} />
                <span>طباعة الفاتورة</span>
              </button>
              <button
                onClick={() => setSelectedTx(null)}
                className="bg-accent hover:bg-gold text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md active:scale-95"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


