import React, { useState, useEffect } from 'react';
import { 
  getSaleReturns, saveSaleReturn, deleteSaleReturn, 
  getPurchaseReturns, savePurchaseReturn, deletePurchaseReturn,
  getSales, getPurchases, getProducts, getUserPreferences
} from '../lib/firestoreService';
import { useTenant } from '../context/TenantContext';
import ColumnManagerModal from './ColumnManagerModal';
import { RETURNS_COLUMNS, RETURNS_DEFAULT_VISIBLE } from '../lib/columns';
import { 
  RotateCcw, 
  Plus, 
  Trash2, 
  Search, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  ArrowLeftRight, 
  Home, 
  Sliders, 
  Table as TableIcon, 
  LayoutGrid 
} from 'lucide-react';

export default function Returns({ onNavigateHome }: { onNavigateHome?: () => void }) {
  const { companyId } = useTenant();
  const [activeTab, setActiveTab] = useState<'sales' | 'purchases'>('sales');
  
  const [saleReturns, setSaleReturns] = useState<any[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Column Manager & View State
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleKeys, setVisibleKeys] = useState<string[]>(RETURNS_DEFAULT_VISIBLE);
  const [orderedKeys, setOrderedKeys] = useState<string[]>(() => RETURNS_COLUMNS.map(c => c.key));
  const [showColModal, setShowColModal] = useState<boolean>(false);

  // New Sale Return Modal
  const [showNewSaleReturnModal, setShowNewSaleReturnModal] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [saleReturnReason, setSaleReturnReason] = useState('');
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});

  // New Purchase Return Modal
  const [showNewPurchaseReturnModal, setShowNewPurchaseReturnModal] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('');
  const [purchaseReturnReason, setPurchaseReturnReason] = useState('');
  const [purchaseReturnQuantities, setPurchaseReturnQuantities] = useState<Record<string, number>>({});

  const currentUserStr = localStorage.getItem('currentUser');
  const userObj = currentUserStr ? JSON.parse(currentUserStr) : null;
  const userEmail = userObj?.email || userObj?.username || 'admin';

  useEffect(() => {
    loadData();
    loadPrefs();
  }, [companyId]);

  const loadPrefs = async () => {
    try {
      const prefs = await getUserPreferences(userEmail, 'returns');
      if (prefs && prefs.visible && prefs.order) {
        setVisibleKeys(prefs.visible);
        setOrderedKeys(prefs.order);
      }
    } catch (err) {
      console.warn("Failed to load returns preferences", err);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [sRet, pRet, allSales, allPurchases, allProds] = await Promise.all([
        getSaleReturns(companyId),
        getPurchaseReturns(companyId),
        getSales(companyId),
        getPurchases(companyId),
        getProducts(companyId)
      ]);
      setSaleReturns(sRet || []);
      setPurchaseReturns(pRet || []);
      setSales(allSales || []);
      setPurchases(allPurchases || []);
      setProducts(allProds || []);
    } catch (err: any) {
      console.error('Error loading returns:', err);
      showToast('فشل تحميل بيانات المرتجعات', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Handle Sale Return Creation
  const handleCreateSaleReturn = async () => {
    if (!selectedSaleId) {
      alert('يرجى اختيار فاتورة المبيعات');
      return;
    }
    const targetSale = sales.find(s => s.id === selectedSaleId);
    if (!targetSale) return;

    const returnItems: any[] = [];
    let totalRefund = 0;

    for (const [productId, rawQty] of Object.entries(returnQuantities)) {
      const qty = Number(rawQty || 0);
      if (qty > 0) {
        const item = targetSale.items?.find((i: any) => i.productId === productId);
        const unitPrice = item ? Number(item.price || item.unitPrice || 0) : 0;
        const refundAmount = qty * unitPrice;
        totalRefund += refundAmount;
        returnItems.push({
          productId,
          quantity: qty,
          refundAmount
        });
      }
    }

    if (returnItems.length === 0) {
      alert('يرجى تحديد كمية واحدة على الأقل للإرجاع');
      return;
    }

    try {
      const returnNumber = `SRET-${Date.now().toString().slice(-6)}`;
      await saveSaleReturn({
        saleId: selectedSaleId,
        returnNumber,
        totalRefund,
        reason: saleReturnReason || 'مرتجع مبيعات',
        items: returnItems
      }, companyId);

      showToast('تم حفظ مرتجع المبيعات وتحديث المخزون بنجاح', 'success');
      setShowNewSaleReturnModal(false);
      setSelectedSaleId('');
      setSaleReturnReason('');
      setReturnQuantities({});
      loadData();
    } catch (err: any) {
      alert(`فشل حفظ المرتجع: ${err?.message || 'خطأ غير معروف'}`);
    }
  };

  // Handle Purchase Return Creation
  const handleCreatePurchaseReturn = async () => {
    if (!selectedPurchaseId) {
      alert('يرجى اختيار فاتورة المشتريات');
      return;
    }
    const targetPurchase = purchases.find(p => p.id === selectedPurchaseId);
    if (!targetPurchase) return;

    const returnItems: any[] = [];
    let totalRefund = 0;

    for (const [productId, rawQty] of Object.entries(purchaseReturnQuantities)) {
      const qty = Number(rawQty || 0);
      if (qty > 0) {
        const item = targetPurchase.items?.find((i: any) => i.productId === productId);
        const unitCost = item ? Number(item.costPrice || item.price || 0) : 0;
        const refundAmount = qty * unitCost;
        totalRefund += refundAmount;
        returnItems.push({
          productId,
          quantity: qty,
          refundAmount
        });
      }
    }

    if (returnItems.length === 0) {
      alert('يرجى تحديد كمية واحدة على الأقل للإرجاع');
      return;
    }

    try {
      const returnNumber = `PRET-${Date.now().toString().slice(-6)}`;
      await savePurchaseReturn({
        purchaseId: selectedPurchaseId,
        returnNumber,
        totalRefund,
        reason: purchaseReturnReason || 'مرتجع مشتريات',
        items: returnItems
      }, companyId);

      showToast('تم حفظ مرتجع المشتريات وتخصيم المخزون بنجاح', 'success');
      setShowNewPurchaseReturnModal(false);
      setSelectedPurchaseId('');
      setPurchaseReturnReason('');
      setPurchaseReturnQuantities({});
      loadData();
    } catch (err: any) {
      alert(`فشل حفظ المرتجع: ${err?.message || 'خطأ غير معروف'}`);
    }
  };

  // Delete Sale Return
  const handleDeleteSaleReturn = async (id: string, returnNum: string) => {
    if (!confirm(`هل أنت متأكد من حذف مرتجع المبيعات رقم (${returnNum})؟ سيتم عكس تأثيره على المخزون.`)) return;
    try {
      await deleteSaleReturn(id, companyId);
      showToast('تم حذف مرتجع المبيعات بنجاح', 'success');
      loadData();
    } catch (err: any) {
      alert(`فشل الحذف: ${err?.message || 'خطأ غير معروف'}`);
    }
  };

  // Delete Purchase Return
  const handleDeletePurchaseReturn = async (id: string, returnNum: string) => {
    if (!confirm(`هل أنت متأكد من حذف مرتجع المشتريات رقم (${returnNum})؟ سيتم عكس تأثيره على المخزون.`)) return;
    try {
      await deletePurchaseReturn(id, companyId);
      showToast('تم حذف مرتجع المشتريات بنجاح', 'success');
      loadData();
    } catch (err: any) {
      alert(`فشل الحذف: ${err?.message || 'خطأ غير معروف'}`);
    }
  };

  const selectedSale = sales.find(s => s.id === selectedSaleId);
  const selectedPurchase = purchases.find(p => p.id === selectedPurchaseId);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6 pb-28 text-right" dir="rtl">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 left-4 z-50 p-4 rounded-2xl shadow-2xl flex items-center gap-3 text-white ${toast.type === 'success' ? 'bg-success' : 'bg-danger'}`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold text-sm">{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-3 bg-card p-5 rounded-3xl border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gold/10 text-gold rounded-2xl">
            <RotateCcw size={28} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black">إدارة المرتجعات (البيع والشراء)</h1>
            <p className="text-xs text-text-dim mt-0.5">ربط فواتير البيع والشراء بمرتجعاتها مع التحديث التلقائي للمخزون والحسابات</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onNavigateHome && (
            <button
              onClick={onNavigateHome}
              className="bg-gold/20 hover:bg-gold text-gold hover:text-white border border-gold/30 px-3.5 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <Home size={15} />
              <span>الرئيسية</span>
            </button>
          )}
          <button
            onClick={() => setShowNewSaleReturnModal(true)}
            className="bg-gold hover:bg-gold2 text-white px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
          >
            <Plus size={16} />
            <span>+ مرتجع مبيعات جديد</span>
          </button>
          <button
            onClick={() => setShowNewPurchaseReturnModal(true)}
            className="bg-accent hover:bg-accent/80 text-white px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
          >
            <Plus size={16} />
            <span>+ مرتجع مشتريات جديد</span>
          </button>
        </div>
      </div>

      {/* Tabs and Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-border pb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'sales' ? 'bg-gold text-white shadow-lg' : 'bg-card border border-border text-text-dim hover:text-white'}`}
          >
            <RotateCcw size={16} />
            <span>مرتجعات المبيعات ({saleReturns.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={`px-5 py-2.5 rounded-2xl font-bold text-sm transition-all flex items-center gap-2 ${activeTab === 'purchases' ? 'bg-accent text-white shadow-lg' : 'bg-card border border-border text-text-dim hover:text-white'}`}
          >
            <ArrowLeftRight size={16} />
            <span>مرتجعات المشتريات ({purchaseReturns.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-end">
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

          {/* Column Customization Button */}
          {viewMode === 'table' && (
            <button
              onClick={() => setShowColModal(true)}
              className="bg-card border border-border hover:border-gold px-3 py-2 rounded-xl text-xs font-bold text-text-main transition-all flex items-center gap-1.5 shadow-sm"
              title="تخصيص أعمدة المرتجعات"
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
              placeholder="بحث في المرتجعات..."
              className="bg-card2 border border-border py-2 pr-9 pl-3 rounded-2xl w-full text-xs font-bold text-text-main focus:border-gold focus:outline-none"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Column Customization Modal */}
      {showColModal && (
        <ColumnManagerModal
          tableName="returns"
          allColumns={RETURNS_COLUMNS}
          defaultVisibleKeys={RETURNS_DEFAULT_VISIBLE}
          currentVisibleKeys={visibleKeys}
          currentOrderedKeys={orderedKeys}
          onSave={(vis, ord) => {
            setVisibleKeys(vis);
            setOrderedKeys(ord);
          }}
          onClose={() => setShowColModal(false)}
        />
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-text-dim font-bold">جاري تحميل بيانات المرتجعات...</div>
      ) : activeTab === 'sales' ? (
        <div className="space-y-4">
          {saleReturns.length === 0 ? (
            <div className="bg-card p-12 rounded-3xl border border-border text-center text-text-dim">
              <RotateCcw size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold text-base">لا توجد مرتجعات مبيعات مسجلة حتى الآن</p>
              <p className="text-xs mt-1">انقر على "مرتجع مبيعات جديد" لاختيار فاتورة مبيعات وإرجاع المنتجات مع تعديل المخزون تلقائياً</p>
            </div>
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-right text-xs">
                <thead className="bg-card2 border-b border-border text-text-dim font-bold">
                  <tr>
                    {orderedKeys.map(colKey => {
                      if (!visibleKeys.includes(colKey)) return null;
                      const colDef = RETURNS_COLUMNS.find(c => c.key === colKey);
                      return (
                        <th key={colKey} className={`p-3 ${colKey === 'totalRefund' || colKey === 'itemCount' || colKey === 'actions' ? 'text-center' : ''}`}>
                          {colDef?.label}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {saleReturns
                    .filter(ret => !searchQuery || ret.returnNumber?.toLowerCase().includes(searchQuery.toLowerCase()) || ret.saleId?.toLowerCase().includes(searchQuery.toLowerCase()) || ret.reason?.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(ret => (
                      <tr key={ret.id} className="hover:bg-card2/50 transition-colors">
                        {orderedKeys.map(colKey => {
                          if (!visibleKeys.includes(colKey)) return null;
                          switch (colKey) {
                            case 'returnNumber':
                              return (
                                <td key={colKey} className="p-3 font-mono font-bold text-gold text-xs">
                                  {ret.returnNumber}
                                </td>
                              );
                            case 'invoiceNumber':
                              return (
                                <td key={colKey} className="p-3 font-mono font-bold text-text-main">
                                  #{ret.saleId}
                                </td>
                              );
                            case 'date':
                              return (
                                <td key={colKey} className="p-3 text-text-dim font-mono text-[11px]">
                                  {ret.date ? new Date(ret.date).toLocaleDateString('ar-EG') : '-'}
                                </td>
                              );
                            case 'customerOrSupplier':
                              return (
                                <td key={colKey} className="p-3 font-bold text-text-main">
                                  {ret.customerName || 'عميل نقدي'}
                                </td>
                              );
                            case 'type':
                              return (
                                <td key={colKey} className="p-3">
                                  <span className="bg-gold/10 text-gold px-2 py-0.5 rounded-full text-[10px] font-bold">
                                    مرتجع بيع
                                  </span>
                                </td>
                              );
                            case 'totalRefund':
                              return (
                                <td key={colKey} className="p-3 text-center font-mono font-black text-gold text-sm">
                                  {ret.totalRefund?.toLocaleString()} ج.م
                                </td>
                              );
                            case 'paymentMethod':
                              return (
                                <td key={colKey} className="p-3 text-text-dim text-xs font-bold">
                                  {ret.paymentMethod === 'cash' ? 'نقدي' : 'آجل / رصيد'}
                                </td>
                              );
                            case 'reason':
                              return (
                                <td key={colKey} className="p-3 text-text-dim max-w-xs truncate">
                                  {ret.reason || 'بدون سبب'}
                                </td>
                              );
                            case 'cashier':
                              return (
                                <td key={colKey} className="p-3 text-text-dim text-[11px]">
                                  {ret.createdBy || 'المدير'}
                                </td>
                              );
                            case 'itemCount':
                              return (
                                <td key={colKey} className="p-3 text-center font-mono font-bold">
                                  {ret.items?.length || 0} صنف
                                </td>
                              );
                            case 'actions':
                              return (
                                <td key={colKey} className="p-3 text-center">
                                  <button
                                    onClick={() => handleDeleteSaleReturn(ret.id, ret.returnNumber)}
                                    className="bg-danger/10 hover:bg-danger text-danger hover:text-white p-2 rounded-xl transition-all"
                                    title="حذف المرتجع"
                                  >
                                    <Trash2 size={14} />
                                  </button>
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
            <div className="grid grid-cols-1 gap-4">
              {saleReturns.map(ret => (
                <div key={ret.id} className="bg-card p-5 rounded-3xl border border-border space-y-4 shadow-sm hover:border-gold/50 transition-all">
                  <div className="flex justify-between items-start flex-wrap gap-3 border-b border-border pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-gold/20 text-gold px-3 py-1 rounded-xl text-xs font-mono font-black">{ret.returnNumber}</span>
                        <span className="text-xs text-text-dim">مرتبط بفاتورة بيع: <strong className="text-text-main font-mono">{ret.saleId}</strong></span>
                      </div>
                      <p className="text-xs text-text-dim mt-1.5">السبب: {ret.reason || 'بدون سبب محدد'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <div className="text-xs text-text-dim">إجمالي الاسترجاع</div>
                        <div className="text-lg font-black text-gold font-mono">{ret.totalRefund?.toLocaleString()} ج.م</div>
                      </div>
                      <button
                        onClick={() => handleDeleteSaleReturn(ret.id, ret.returnNumber)}
                        className="bg-danger/10 hover:bg-danger text-danger hover:text-white p-2.5 rounded-xl transition-all"
                        title="حذف المرتجع"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="bg-card2 rounded-2xl p-3 overflow-x-auto">
                    <table className="w-full text-xs text-right min-w-[400px]">
                      <thead>
                        <tr className="text-text-dim border-b border-border">
                          <th className="pb-2">المنتج / الصنف</th>
                          <th className="pb-2">الكمية المرتجعة</th>
                          <th className="pb-2">مبلغ الاسترجاع</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ret.items?.map((item: any, i: number) => {
                          const prod = products.find(p => p.id === item.productId);
                          return (
                            <tr key={i} className="border-t border-border/50">
                              <td className="py-2 font-bold">{prod?.name || item.productId}</td>
                              <td className="py-2 font-mono text-gold font-black">{item.quantity}</td>
                              <td className="py-2 font-mono font-bold">{item.refundAmount?.toLocaleString()} ج.م</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {purchaseReturns.length === 0 ? (
            <div className="bg-card p-12 rounded-3xl border border-border text-center text-text-dim">
              <ArrowLeftRight size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-bold text-base">لا توجد مرتجعات مشتريات مسجلة حتى الآن</p>
              <p className="text-xs mt-1">انقر على "مرتجع مشتريات جديد" لإرجاع أصناف للموردين وتخصيمها من المخزون تلقائياً</p>
            </div>
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-right text-xs">
                <thead className="bg-card2 border-b border-border text-text-dim font-bold">
                  <tr>
                    {orderedKeys.map(colKey => {
                      if (!visibleKeys.includes(colKey)) return null;
                      const colDef = RETURNS_COLUMNS.find(c => c.key === colKey);
                      return (
                        <th key={colKey} className={`p-3 ${colKey === 'totalRefund' || colKey === 'itemCount' || colKey === 'actions' ? 'text-center' : ''}`}>
                          {colDef?.label}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {purchaseReturns
                    .filter(ret => !searchQuery || ret.returnNumber?.toLowerCase().includes(searchQuery.toLowerCase()) || ret.purchaseId?.toLowerCase().includes(searchQuery.toLowerCase()) || ret.reason?.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map(ret => (
                      <tr key={ret.id} className="hover:bg-card2/50 transition-colors">
                        {orderedKeys.map(colKey => {
                          if (!visibleKeys.includes(colKey)) return null;
                          switch (colKey) {
                            case 'returnNumber':
                              return (
                                <td key={colKey} className="p-3 font-mono font-bold text-accent text-xs">
                                  {ret.returnNumber}
                                </td>
                              );
                            case 'invoiceNumber':
                              return (
                                <td key={colKey} className="p-3 font-mono font-bold text-text-main">
                                  #{ret.purchaseId}
                                </td>
                              );
                            case 'date':
                              return (
                                <td key={colKey} className="p-3 text-text-dim font-mono text-[11px]">
                                  {ret.date ? new Date(ret.date).toLocaleDateString('ar-EG') : '-'}
                                </td>
                              );
                            case 'customerOrSupplier':
                              return (
                                <td key={colKey} className="p-3 font-bold text-text-main">
                                  {ret.supplierName || 'مورد رئيسي'}
                                </td>
                              );
                            case 'type':
                              return (
                                <td key={colKey} className="p-3">
                                  <span className="bg-accent/10 text-accent px-2 py-0.5 rounded-full text-[10px] font-bold">
                                    مرتجع شراء
                                  </span>
                                </td>
                              );
                            case 'totalRefund':
                              return (
                                <td key={colKey} className="p-3 text-center font-mono font-black text-accent text-sm">
                                  {ret.totalRefund?.toLocaleString()} ج.م
                                </td>
                              );
                            case 'paymentMethod':
                              return (
                                <td key={colKey} className="p-3 text-text-dim text-xs font-bold">
                                  {ret.paymentMethod === 'cash' ? 'نقدي' : 'آجل / رصيد'}
                                </td>
                              );
                            case 'reason':
                              return (
                                <td key={colKey} className="p-3 text-text-dim max-w-xs truncate">
                                  {ret.reason || 'بدون سبب'}
                                </td>
                              );
                            case 'cashier':
                              return (
                                <td key={colKey} className="p-3 text-text-dim text-[11px]">
                                  {ret.createdBy || 'المدير'}
                                </td>
                              );
                            case 'itemCount':
                              return (
                                <td key={colKey} className="p-3 text-center font-mono font-bold">
                                  {ret.items?.length || 0} صنف
                                </td>
                              );
                            case 'actions':
                              return (
                                <td key={colKey} className="p-3 text-center">
                                  <button
                                    onClick={() => handleDeletePurchaseReturn(ret.id, ret.returnNumber)}
                                    className="bg-danger/10 hover:bg-danger text-danger hover:text-white p-2 rounded-xl transition-all"
                                    title="حذف المرتجع"
                                  >
                                    <Trash2 size={14} />
                                  </button>
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
            <div className="grid grid-cols-1 gap-4">
              {purchaseReturns.map(ret => (
                <div key={ret.id} className="bg-card p-5 rounded-3xl border border-border space-y-4 shadow-sm hover:border-accent/50 transition-all">
                  <div className="flex justify-between items-start flex-wrap gap-3 border-b border-border pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-accent/20 text-accent px-3 py-1 rounded-xl text-xs font-mono font-black">{ret.returnNumber}</span>
                        <span className="text-xs text-text-dim">مرتبط بفاتورة شراء: <strong className="text-text-main font-mono">{ret.purchaseId}</strong></span>
                      </div>
                      <p className="text-xs text-text-dim mt-1.5">السبب: {ret.reason || 'بدون سبب محدد'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <div className="text-xs text-text-dim">إجمالي الاسترجاع</div>
                        <div className="text-lg font-black text-accent font-mono">{ret.totalRefund?.toLocaleString()} ج.م</div>
                      </div>
                      <button
                        onClick={() => handleDeletePurchaseReturn(ret.id, ret.returnNumber)}
                        className="bg-danger/10 hover:bg-danger text-danger hover:text-white p-2.5 rounded-xl transition-all"
                        title="حذف المرتجع"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="bg-card2 rounded-2xl p-3 overflow-x-auto">
                    <table className="w-full text-xs text-right min-w-[400px]">
                      <thead>
                        <tr className="text-text-dim border-b border-border">
                          <th className="pb-2">المنتج / الصنف</th>
                          <th className="pb-2">الكمية المرتجعة للمورد</th>
                          <th className="pb-2">مبلغ الاسترداد</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ret.items?.map((item: any, i: number) => {
                          const prod = products.find(p => p.id === item.productId);
                          return (
                            <tr key={i} className="border-t border-border/50">
                              <td className="py-2 font-bold">{prod?.name || item.productId}</td>
                              <td className="py-2 font-mono text-accent font-black">{item.quantity}</td>
                              <td className="py-2 font-mono font-bold">{item.refundAmount?.toLocaleString()} ج.م</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: New Sale Return */}
      {showNewSaleReturnModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-2xl space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-lg font-bold">إنشاء مرتجع مبيعات جديد</h3>
              <button onClick={() => setShowNewSaleReturnModal(false)} className="text-text-dim hover:text-white font-bold">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-text-dim block mb-1">اختر فاتورة المبيعات الأصلية:</label>
                <select
                  className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm"
                  value={selectedSaleId}
                  onChange={e => {
                    setSelectedSaleId(e.target.value);
                    setReturnQuantities({});
                  }}
                >
                  <option value="">-- اختر الفاتورة --</option>
                  {sales.map(s => (
                    <option key={s.id} value={s.id}>
                      فاتورة #{s.id.slice(-6)} - العميل: {s.customerName || 'نقدي'} - الإجمالي: {s.total} ج.م ({s.createdAt?.substring(0, 10)})
                    </option>
                  ))}
                </select>
              </div>

              {selectedSale && (
                <div className="space-y-3 bg-card2 p-4 rounded-2xl border border-border">
                  <h4 className="text-xs font-bold text-gold">أصناف الفاتورة (حدد الكمية المرتجعة لكل صنف):</h4>
                  <div className="space-y-2">
                    {selectedSale.items?.map((item: any, idx: number) => {
                      const prod = products.find(p => p.id === item.productId);
                      const soldQty = Number(item.quantity || 1);
                      const currentReturnQty = returnQuantities[item.productId] || 0;
                      return (
                        <div key={idx} className="flex items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border text-xs">
                          <div>
                            <div className="font-bold">{prod?.name || item.productId}</div>
                            <div className="text-text-dim">الكمية المباعة: {soldQty} | السعر: {item.price || item.unitPrice} ج.م</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-text-dim">المرتجع:</span>
                            <input
                              type="number"
                              min="0"
                              max={soldQty}
                              className="w-20 bg-card2 border border-border p-2 rounded-xl text-center font-mono font-bold text-gold"
                              value={currentReturnQty}
                              onChange={e => setReturnQuantities({
                                ...returnQuantities,
                                [item.productId]: Math.min(soldQty, Math.max(0, Number(e.target.value)))
                              })}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-text-dim block mb-1">سبب الاسترجاع:</label>
                <input
                  type="text"
                  placeholder="مثال: عيب صناعة، تغيير رأي العميل..."
                  className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm"
                  value={saleReturnReason}
                  onChange={e => setSaleReturnReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowNewSaleReturnModal(false)}
                  className="bg-secondary hover:bg-secondary/80 px-4 py-2.5 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleCreateSaleReturn}
                  className="bg-gold hover:bg-gold2 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg"
                >
                  حفظ المرتجع وتحديث المخزون
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Purchase Return */}
      {showNewPurchaseReturnModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-2xl space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="text-lg font-bold">إنشاء مرتجع مشتريات جديد للمورد</h3>
              <button onClick={() => setShowNewPurchaseReturnModal(false)} className="text-text-dim hover:text-white font-bold">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-text-dim block mb-1">اختر فاتورة المشتريات الأصلية:</label>
                <select
                  className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm"
                  value={selectedPurchaseId}
                  onChange={e => {
                    setSelectedPurchaseId(e.target.value);
                    setPurchaseReturnQuantities({});
                  }}
                >
                  <option value="">-- اختر الفاتورة --</option>
                  {purchases.map(p => (
                    <option key={p.id} value={p.id}>
                      فاتورة شراء #{p.id.slice(-6)} - المورد: {p.supplierName || 'مورد'} - الإجمالي: {p.total} ج.م ({p.date})
                    </option>
                  ))}
                </select>
              </div>

              {selectedPurchase && (
                <div className="space-y-3 bg-card2 p-4 rounded-2xl border border-border">
                  <h4 className="text-xs font-bold text-accent">أصناف الفاتورة (حدد الكمية المرتجعة للمورد):</h4>
                  <div className="space-y-2">
                    {selectedPurchase.items?.map((item: any, idx: number) => {
                      const prod = products.find(p => p.id === item.productId);
                      const purchasedQty = Number(item.quantity || 1);
                      const currentReturnQty = purchaseReturnQuantities[item.productId] || 0;
                      return (
                        <div key={idx} className="flex items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border text-xs">
                          <div>
                            <div className="font-bold">{prod?.name || item.productId}</div>
                            <div className="text-text-dim">الكمية المشتراة: {purchasedQty} | سعر التكلفة: {item.costPrice || item.price} ج.م</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-text-dim">المرتجع:</span>
                            <input
                              type="number"
                              min="0"
                              max={purchasedQty}
                              className="w-20 bg-card2 border border-border p-2 rounded-xl text-center font-mono font-bold text-accent"
                              value={currentReturnQty}
                              onChange={e => setPurchaseReturnQuantities({
                                ...purchaseReturnQuantities,
                                [item.productId]: Math.min(purchasedQty, Math.max(0, Number(e.target.value)))
                              })}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-text-dim block mb-1">سبب الاسترجاع:</label>
                <input
                  type="text"
                  placeholder="مثال: بضاعة تالفة، عدم مطابقة المواصفات..."
                  className="w-full bg-card2 border border-border p-3 rounded-2xl text-sm"
                  value={purchaseReturnReason}
                  onChange={e => setPurchaseReturnReason(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowNewPurchaseReturnModal(false)}
                  className="bg-secondary hover:bg-secondary/80 px-4 py-2.5 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleCreatePurchaseReturn}
                  className="bg-accent hover:bg-accent/80 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg"
                >
                  حفظ المرتجع وتخصيم المخزون
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
