import React, { useState, useMemo } from 'react';
import { Product, Category } from '@/src/types/types';
import { recordInventoryAdjustment, recordBatchInventorySettlement } from '@/src/lib/firestoreService';
import { logActivity } from '@/src/lib/activity';
import { playSuccessSound } from '@/src/lib/sound';
import { useTenant } from '../context/TenantContext';
import { 
  ClipboardCheck, 
  Search, 
  Filter, 
  Printer, 
  Save, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingDown, 
  TrendingUp, 
  RefreshCw,
  Layers,
  Calendar,
  Pill,
  Check,
  FileSpreadsheet
} from 'lucide-react';

interface InventoryCountProps {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  categories?: Category[];
}

export default function InventoryCount({ products, setProducts, categories = [] }: InventoryCountProps) {
  const { currentUser } = useTenant();
  // Physical count state: productId -> count string
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [filterMode, setFilterMode] = useState<'ALL' | 'DIFF_ONLY' | 'PHARMACY_ONLY' | 'EXPIRING_SOON'>('ALL');
  const [sessionTitle, setSessionTitle] = useState('جرد المخزن الدوري');
  const [isSettling, setIsSettling] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Active non-archived products
  const activeProducts = useMemo(() => {
    return (products || []).filter(p => p && !p.archived);
  }, [products]);

  // Compute item details and differences
  const countedData = useMemo(() => {
    return activeProducts.map(p => {
      const enteredValue = counts[p.id];
      const hasInput = enteredValue !== undefined && enteredValue.trim() !== '';
      const physicalQty = hasInput ? parseFloat(enteredValue) || 0 : p.quantity;
      const difference = physicalQty - p.quantity;
      const unitCost = p.cost || 0;
      const diffValue = difference * unitCost;

      let status: 'MATCH' | 'DEFICIT' | 'SURPLUS' = 'MATCH';
      if (difference < 0) status = 'DEFICIT';
      else if (difference > 0) status = 'SURPLUS';

      // Check expiry condition (near expiry in 60 days or expired)
      let isExpired = false;
      let isNearExpiry = false;
      if (p.expirationDate) {
        const exp = new Date(p.expirationDate).getTime();
        const now = Date.now();
        const diffDays = (exp - now) / (1000 * 60 * 60 * 24);
        if (diffDays < 0) isExpired = true;
        else if (diffDays <= 60) isNearExpiry = true;
      }

      return {
        product: p,
        hasInput,
        physicalQty,
        bookQty: p.quantity,
        difference,
        unitCost,
        diffValue,
        status,
        isExpired,
        isNearExpiry,
        note: itemNotes[p.id] || ''
      };
    });
  }, [activeProducts, counts, itemNotes]);

  // Filtered view
  const filteredItems = useMemo(() => {
    return countedData.filter(item => {
      // Category filter
      if (selectedCategory !== 'ALL' && item.product.category !== selectedCategory) {
        return false;
      }

      // Filter mode
      if (filterMode === 'DIFF_ONLY' && item.difference === 0) return false;
      if (filterMode === 'PHARMACY_ONLY' && !item.product.isPharmacy && !item.product.expirationDate && !item.product.stripsPerBox) return false;
      if (filterMode === 'EXPIRING_SOON' && !item.isExpired && !item.isNearExpiry) return false;

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchName = item.product.name.toLowerCase().includes(query);
        const matchSku = item.product.sku?.toLowerCase().includes(query);
        const matchBarcode = item.product.barcodes?.some(b => b.toLowerCase().includes(query));
        const matchSerial = item.product.serial?.toLowerCase().includes(query);
        return matchName || matchSku || matchBarcode || matchSerial;
      }

      return true;
    });
  }, [countedData, selectedCategory, filterMode, searchTerm]);

  // Summary Metrics
  const summary = useMemo(() => {
    let totalItems = countedData.length;
    let modifiedItemsCount = 0;
    let deficitCount = 0;
    let surplusCount = 0;
    let matchCount = 0;
    let totalDeficitValue = 0;
    let totalSurplusValue = 0;

    countedData.forEach(item => {
      if (item.hasInput && item.difference !== 0) {
        modifiedItemsCount++;
      }
      if (item.difference < 0) {
        deficitCount++;
        totalDeficitValue += Math.abs(item.diffValue);
      } else if (item.difference > 0) {
        surplusCount++;
        totalSurplusValue += item.diffValue;
      } else {
        matchCount++;
      }
    });

    const netDiffValue = totalSurplusValue - totalDeficitValue;

    return {
      totalItems,
      modifiedItemsCount,
      deficitCount,
      surplusCount,
      matchCount,
      totalDeficitValue,
      totalSurplusValue,
      netDiffValue
    };
  }, [countedData]);

  // Fill all inputs with current book stock
  const handleAutoFillBookQuantities = () => {
    const newCounts: Record<string, string> = {};
    activeProducts.forEach(p => {
      newCounts[p.id] = p.quantity.toString();
    });
    setCounts(newCounts);
  };

  // Reset all count inputs
  const handleResetCounts = () => {
    if (window.confirm('هل أنت متأكد من مسح جميع الكميات المدخلة في الجرد الحالي؟')) {
      setCounts({});
      setItemNotes({});
    }
  };

  // Save single item settlement
  const handleSaveSingleItem = async (productId: string) => {
    const item = countedData.find(i => i.product.id === productId);
    if (!item || !item.hasInput) return;

    if (item.difference === 0) {
      alert('الرصيد الفعلي مطابق للرصيد الدفتري، لا يلزم إجراء تسوية.');
      return;
    }

    const reason = prompt(`أدخل سبب تسوية جرد الصنف "${item.product.name}" (الدفترية: ${item.bookQty} -> الفعلية: ${item.physicalQty}):`, item.note || 'تسوية جرد دوري');
    if (reason === null) return; // cancelled

    try {
      await recordInventoryAdjustment(
        item.product,
        item.physicalQty,
        reason
      );

      // Update state
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, quantity: item.physicalQty } : p));
      
      const empName = currentUser?.name || currentUser?.username || 'المسؤول';
      const timeStr = new Date().toLocaleString('ar-EG');
      const logText = `[تسوية جرد فردية] التاريخ: ${timeStr} | المسؤول: ${empName} | الصنف: ${item.product.name} | الكمية القديمة: ${item.bookQty} -> الجديدة: ${item.physicalQty} | السبب: ${reason || 'بدون سبب'}`;
      logActivity(logText);

      playSuccessSound();
      alert(`✅ تمت تسوية رصيد ${item.product.name} بنجاح إلى (${item.physicalQty}).`);
    } catch (err: any) {
      alert('حدث خطأ أثناء حفظ التسوية: ' + err.message);
    }
  };

  // Batch Settle All Discrepancies
  const handleBatchSettleAll = async () => {
    const itemsToSettle = countedData.filter(i => i.hasInput && i.difference !== 0);
    if (itemsToSettle.length === 0) {
      alert('لا توجد أصناف بها فروقات أو معدلة لتسويتها.');
      return;
    }

    const batchReason = prompt('أدخل سبب أو ملاحظة تسوية الجرد الشاملة:', sessionTitle);
    if (batchReason === null) return; // cancelled

    const confirmMsg = `تأكيد اعتماد التسوية المخزنية الشاملة:\n- عدد الأصناف المراد تسويتها: ${itemsToSettle.length}\n- إجمالي قيمة العجز: ${summary.totalDeficitValue.toLocaleString('ar-EG')} ج.م\n- إجمالي قيمة الزيادة: ${summary.totalSurplusValue.toLocaleString('ar-EG')} ج.م\n- السبب: ${batchReason}\n\nهل تريد تحديث أرصدة المخزن وتسجيل حركات التسوية الآن؟`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setIsSettling(true);
      const res = await recordBatchInventorySettlement(
        itemsToSettle.map(i => ({
          product: i.product,
          newQuantity: i.physicalQty,
          notes: batchReason
        })),
        sessionTitle
      );

      // Update local products state
      setProducts(prev => (prev || []).map(p => {
        const matched = itemsToSettle.find(i => i.product?.id === p.id);
        if (matched) {
          return { ...p, quantity: matched.physicalQty };
        }
        return p;
      }));

      const empName = currentUser?.name || currentUser?.username || 'المسؤول';
      const timeStr = new Date().toLocaleString('ar-EG');
      const logText = `[تسوية جرد شاملة] التاريخ: ${timeStr} | المسؤول: ${empName} | العنوان: ${sessionTitle} | عدد الأصناف: ${res.settledCount} | السبب: ${batchReason}`;
      logActivity(logText);

      playSuccessSound();
      alert(`🎉 تم بنجاح اعتماد تسوية الجرد وتحديث أرصدة ${res.settledCount} صنف في قاعدة البيانات!`);
      setCounts({});
    } catch (err: any) {
      console.error('Error settling inventory:', err);
      alert('حدث خطأ أثناء اعتماد التسوية: ' + err.message);
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header & Controls */}
      <div className="bg-card p-5 sm:p-6 rounded-3xl border border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 bg-gold/10 text-gold rounded-2xl">
              <ClipboardCheck size={24} />
            </span>
            <div>
              <h2 className="text-xl font-black text-text-main">جرد المخزن والتسويات المخزنية (Inventory Audit & Adjustments)</h2>
              <p className="text-xs text-text-dim mt-0.5">مطابقة الرصيد الفعلي مع الدفتري، رصد العجز والزيادة، وتطبيق التسويات الآلية</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <button
            type="button"
            onClick={handleAutoFillBookQuantities}
            className="bg-card2 hover:bg-card border border-border text-text-main hover:text-gold px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            title="تعبئة حقول الجرد بالرصيد الدفتري المسجل حالياً لتسهيل التعديل السريع"
          >
            <Check size={14} />
            <span>ملء بالرصيد الدفتري</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="bg-card2 hover:bg-card border border-border text-text-main hover:text-gold px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            title="طباعة كشف الجرد الرسمي ومحضر التسوية"
          >
            <Printer size={14} />
            <span>طباعة محضر الجرد</span>
          </button>

          <button
            type="button"
            onClick={handleBatchSettleAll}
            disabled={isSettling || summary.modifiedItemsCount === 0}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-md ${
              summary.modifiedItemsCount > 0 && !isSettling
                ? 'bg-gold hover:bg-gold2 text-white active:scale-95'
                : 'bg-border text-text-dim cursor-not-allowed opacity-60'
            }`}
          >
            <Save size={15} className={isSettling ? 'animate-spin' : ''} />
            <span>اعتماد تسوية الجرد ({summary.modifiedItemsCount})</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Dashboard Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card p-4 rounded-2xl border border-border">
          <p className="text-xs text-text-dim flex items-center gap-1">
            <Layers size={13} /> إجمالي الأصناف
          </p>
          <p className="text-2xl font-black text-text-main mt-1">{summary.totalItems}</p>
          <p className="text-[11px] text-emerald-400 mt-1 font-semibold">مطابق: {summary.matchCount}</p>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-rose-500/30 bg-rose-500/5">
          <p className="text-xs text-rose-400 flex items-center gap-1 font-bold">
            <TrendingDown size={13} /> إجمالي العجز (Deficit)
          </p>
          <p className="text-2xl font-black text-rose-500 mt-1">
            {summary.totalDeficitValue.toLocaleString('ar-EG')} <span className="text-xs font-normal text-rose-400">ج.م</span>
          </p>
          <p className="text-[11px] text-rose-400 mt-1 font-semibold">{summary.deficitCount} صنف به عجز</p>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5">
          <p className="text-xs text-emerald-400 flex items-center gap-1 font-bold">
            <TrendingUp size={13} /> إجمالي الزيادة (Surplus)
          </p>
          <p className="text-2xl font-black text-emerald-400 mt-1">
            {summary.totalSurplusValue.toLocaleString('ar-EG')} <span className="text-xs font-normal text-emerald-400">ج.م</span>
          </p>
          <p className="text-[11px] text-emerald-400 mt-1 font-semibold">{summary.surplusCount} صنف به زيادة</p>
        </div>

        <div className="bg-card p-4 rounded-2xl border border-gold/30 bg-gold/5">
          <p className="text-xs text-gold flex items-center gap-1 font-bold">
            <FileSpreadsheet size={13} /> صافي فروقات الجرد
          </p>
          <p className={`text-2xl font-black mt-1 ${summary.netDiffValue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {summary.netDiffValue.toLocaleString('ar-EG')} <span className="text-xs font-normal text-text-dim">ج.م</span>
          </p>
          <p className="text-[11px] text-text-dim mt-1">الفارق المالي الإجمالي</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-card p-4 rounded-2xl border border-border space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-dim" />
            <input
              type="text"
              placeholder="بحث باسم الصنف، كود SKU، باركود العلبة أو الشريط..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-card2 border border-border rounded-xl pr-10 pl-4 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-card2 border border-border rounded-xl px-3 py-2.5 text-xs text-text-main focus:outline-none focus:border-gold"
            >
              <option value="ALL">جميع الأقسام</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>

            <select
              value={filterMode}
              onChange={e => setFilterMode(e.target.value as any)}
              className="bg-card2 border border-border rounded-xl px-3 py-2.5 text-xs text-text-main focus:outline-none focus:border-gold font-bold"
            >
              <option value="ALL">عرض جميع الأصناف</option>
              <option value="DIFF_ONLY">⚠️ الأصناف ذات الفروقات فقط</option>
              <option value="PHARMACY_ONLY">💊 أصناف الصيدلية والوحدات</option>
              <option value="EXPIRING_SOON">⏳ القريبة من الانتهاء والمنتهية</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Stock Audit Table */}
      <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-card2/80 text-text-dim text-[11px] font-bold border-b border-border">
                <th className="p-3.5">الصنف والكود</th>
                <th className="p-3.5">بيانات الصيدلية / الصلاحية</th>
                <th className="p-3.5 text-center">الرصيد الدفتري</th>
                <th className="p-3.5 text-center">الرصيد الفعلي (العد)</th>
                <th className="p-3.5 text-center">الفارق</th>
                <th className="p-3.5 text-center">التكلفة</th>
                <th className="p-3.5 text-center">قيمة الفارق</th>
                <th className="p-3.5 text-center">ملاحظات التسوية</th>
                <th className="p-3.5 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-text-dim text-xs">
                    لا توجد أصناف مطابقة للبحث أو الفلتر المختار
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const p = item.product;
                  const isModified = item.hasInput && item.difference !== 0;

                  return (
                    <tr 
                      key={p.id} 
                      className={`hover:bg-card2/40 transition-colors ${
                        item.difference < 0 ? 'bg-rose-500/5' : item.difference > 0 ? 'bg-emerald-500/5' : ''
                      }`}
                    >
                      {/* Product Name & SKU */}
                      <td className="p-3.5">
                        <div className="font-bold text-text-main">{p.name}</div>
                        <div className="text-[11px] text-text-dim flex items-center gap-2 mt-0.5">
                          <span>SKU: {p.sku || '-'}</span>
                          {p.category && <span className="bg-border/60 px-1.5 py-0.2 rounded text-[10px]">{p.category}</span>}
                        </div>
                      </td>

                      {/* Expiry & Pharmacy info */}
                      <td className="p-3.5 text-xs">
                        <div className="space-y-1">
                          {p.expirationDate ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.isExpired 
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' 
                                : item.isNearExpiry 
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' 
                                : 'bg-emerald-500/10 text-emerald-400'
                            }`}>
                              <Calendar size={10} />
                              <span>{p.expirationDate}</span>
                              {item.isExpired && <span>(منتهي)</span>}
                              {item.isNearExpiry && <span>(قريب)</span>}
                            </span>
                          ) : (
                            <span className="text-[11px] text-text-dim">-</span>
                          )}

                          {p.stripsPerBox && p.stripsPerBox > 1 && (
                            <div className="text-[10px] text-gold flex items-center gap-1 font-semibold">
                              <Pill size={10} />
                              <span>علبة ({p.stripsPerBox} شريط)</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Book Quantity */}
                      <td className="p-3.5 text-center font-mono font-bold text-text-main">
                        {item.bookQty}
                      </td>

                      {/* Physical Count Input */}
                      <td className="p-3.5 text-center">
                        <input
                          type="number"
                          step="any"
                          className="bg-card2 border-2 border-border focus:border-gold rounded-xl p-2 w-24 text-center font-bold text-sm font-mono text-text-main focus:outline-none transition-all shadow-inner"
                          placeholder={item.bookQty.toString()}
                          value={counts[p.id] ?? ''}
                          onChange={e => setCounts({ ...counts, [p.id]: e.target.value })}
                        />
                      </td>

                      {/* Difference */}
                      <td className="p-3.5 text-center font-mono font-black">
                        {item.difference === 0 ? (
                          <span className="text-emerald-400 text-xs bg-emerald-500/10 px-2 py-0.5 rounded-md">0 (مطابق)</span>
                        ) : item.difference < 0 ? (
                          <span className="text-rose-400 text-xs bg-rose-500/20 px-2 py-0.5 rounded-md font-bold">
                            {item.difference} (عجز)
                          </span>
                        ) : (
                          <span className="text-blue-400 text-xs bg-blue-500/20 px-2 py-0.5 rounded-md font-bold">
                            +{item.difference} (زيادة)
                          </span>
                        )}
                      </td>

                      {/* Unit Cost */}
                      <td className="p-3.5 text-center font-mono text-xs text-text-dim">
                        {item.unitCost} ج.م
                      </td>

                      {/* Difference Value */}
                      <td className="p-3.5 text-center font-mono font-bold text-xs">
                        {item.diffValue === 0 ? (
                          <span className="text-text-dim">0 ج.م</span>
                        ) : item.diffValue < 0 ? (
                          <span className="text-rose-400">{Math.abs(item.diffValue).toLocaleString('ar-EG')} ج.م-</span>
                        ) : (
                          <span className="text-emerald-400">+{item.diffValue.toLocaleString('ar-EG')} ج.م</span>
                        )}
                      </td>

                      {/* Notes input */}
                      <td className="p-3.5 text-center">
                        <input
                          type="text"
                          placeholder="سبب العجز/الزيادة..."
                          value={itemNotes[p.id] || ''}
                          onChange={e => setItemNotes({ ...itemNotes, [p.id]: e.target.value })}
                          className="bg-card2 border border-border rounded-lg px-2 py-1 text-xs text-text-main w-32 focus:outline-none focus:border-gold"
                        />
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-center">
                        {isModified && (
                          <button
                            type="button"
                            onClick={() => handleSaveSingleItem(p.id)}
                            className="bg-gold/20 hover:bg-gold text-gold hover:text-white border border-gold/40 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                            title="تسوية هذا الصنف فقط وتحديث رصيده"
                          >
                            تسوية
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print Audit Sheet Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-card p-6 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-border shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-black text-text-main">كشف محضر جرد وتسوية المخزن الرسمي</h3>
                <p className="text-xs text-text-dim">جاهز للطباعة والاعتماد من لجنة الجرد والمحاسب القانوني</p>
              </div>
              <button onClick={() => setShowPrintModal(false)} className="text-text-dim hover:text-text-main p-2">✕</button>
            </div>

            {/* Printable Area */}
            <div id="printable-audit-sheet" className="bg-white text-black p-6 rounded-2xl border border-gray-300 space-y-4 font-sans text-sm">
              <div className="text-center border-b-2 border-black pb-3">
                <h2 className="text-xl font-bold">محضر جرد مخزني وتسوية فروقات الأصناف</h2>
                <div className="flex justify-between text-xs mt-2 text-gray-700">
                  <span>التاريخ: {new Date().toLocaleDateString('ar-EG')}</span>
                  <span>عنوان الجلسة: {sessionTitle}</span>
                  <span>إجمالي الأصناف: {countedData.length}</span>
                </div>
              </div>

              <table className="w-full border-collapse border border-gray-400 text-xs text-right">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-400 font-bold">
                    <th className="border border-gray-400 p-2">م</th>
                    <th className="border border-gray-400 p-2">اسم الصنف</th>
                    <th className="border border-gray-400 p-2">الكود SKU</th>
                    <th className="border border-gray-400 p-2 text-center">الرصيد الدفتري</th>
                    <th className="border border-gray-400 p-2 text-center">الرصيد الفعلي</th>
                    <th className="border border-gray-400 p-2 text-center">الفارق</th>
                    <th className="border border-gray-400 p-2 text-center">التكلفة</th>
                    <th className="border border-gray-400 p-2 text-center">قيمة الفارق</th>
                    <th className="border border-gray-400 p-2">ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {countedData.map((item, idx) => (
                    <tr key={item.product.id} className="border-b border-gray-300">
                      <td className="border border-gray-300 p-1.5 text-center">{idx + 1}</td>
                      <td className="border border-gray-300 p-1.5 font-bold">{item.product.name}</td>
                      <td className="border border-gray-300 p-1.5">{item.product.sku || '-'}</td>
                      <td className="border border-gray-300 p-1.5 text-center font-mono">{item.bookQty}</td>
                      <td className="border border-gray-300 p-1.5 text-center font-mono font-bold">{item.physicalQty}</td>
                      <td className="border border-gray-300 p-1.5 text-center font-mono">
                        {item.difference === 0 ? '0' : item.difference > 0 ? `+${item.difference}` : item.difference}
                      </td>
                      <td className="border border-gray-300 p-1.5 text-center font-mono">{item.unitCost}</td>
                      <td className="border border-gray-300 p-1.5 text-center font-mono">
                        {item.diffValue.toLocaleString('ar-EG')}
                      </td>
                      <td className="border border-gray-300 p-1.5 text-[10px]">{item.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals & Signatures */}
              <div className="border-t-2 border-black pt-3 flex justify-between text-xs font-bold">
                <span>إجمالي قيمة العجز: {summary.totalDeficitValue.toLocaleString('ar-EG')} ج.م</span>
                <span>إجمالي قيمة الزيادة: {summary.totalSurplusValue.toLocaleString('ar-EG')} ج.م</span>
                <span>صافي التسوية: {summary.netDiffValue.toLocaleString('ar-EG')} ج.م</span>
              </div>

              <div className="grid grid-cols-3 gap-8 pt-8 text-center text-xs text-gray-800">
                <div>
                  <p className="font-bold">أمين المخزن</p>
                  <p className="mt-8">التوقيع: .....................</p>
                </div>
                <div>
                  <p className="font-bold">عضو لجنة الجرد</p>
                  <p className="mt-8">التوقيع: .....................</p>
                </div>
                <div>
                  <p className="font-bold">مدير الحسابات / المعتمد</p>
                  <p className="mt-8">التوقيع: .....................</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="bg-card2 border border-border px-4 py-2 rounded-xl text-xs font-bold text-text-dim"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-gold hover:bg-gold2 text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Printer size={14} />
                <span>طباعة الكشف</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
