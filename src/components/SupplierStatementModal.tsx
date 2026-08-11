import React, { useState, useEffect, useMemo } from 'react';
import { Supplier, Purchase } from '../types/types';
import { useTenant } from '../context/TenantContext';
import { getSupplierStatement, getUserPreferences } from '../lib/firestoreService';
import ColumnManagerModal from './ColumnManagerModal';
import { STATEMENT_COLUMNS, STATEMENT_DEFAULT_VISIBLE } from '../lib/columns';
import { 
  FileText, 
  Search, 
  Calendar, 
  Printer, 
  Filter, 
  X, 
  CheckCircle2, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Package, 
  Receipt, 
  DollarSign,
  Download,
  Share2,
  Sliders
} from 'lucide-react';

interface SupplierStatementModalProps {
  supplier: Supplier;
  purchases?: Purchase[]; // retained for backwards compatibility
  onClose: () => void;
}

export default function SupplierStatementModal({ supplier, onClose }: SupplierStatementModalProps) {
  const { companyId } = useTenant();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'credit_purchase' | 'cash_purchase' | 'payment' | 'return'>('all');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ledger, setLedger] = useState<any[]>([]);
  const [supplierDetails, setSupplierDetails] = useState<any>(supplier);

  const [visibleKeys, setVisibleKeys] = useState<string[]>(STATEMENT_DEFAULT_VISIBLE);
  const [orderedKeys, setOrderedKeys] = useState<string[]>(() => STATEMENT_COLUMNS.map(c => c.key));
  const [showColModal, setShowColModal] = useState<boolean>(false);

  const businessName = localStorage.getItem('businessName') || 'متجر MARO';
  const businessPhone = localStorage.getItem('businessPhone') || '';
  const businessTax = localStorage.getItem('businessTax') || '';

  const currentUserStr = localStorage.getItem('currentUser');
  const userObj = currentUserStr ? JSON.parse(currentUserStr) : null;
  const userEmail = userObj?.email || userObj?.username || 'admin';

  useEffect(() => {
    async function loadPrefs() {
      try {
        const prefs = await getUserPreferences(userEmail, 'supplier_statement');
        if (prefs && prefs.visible && prefs.order) {
          setVisibleKeys(prefs.visible);
          setOrderedKeys(prefs.order);
        }
      } catch (err) {
        console.warn("Failed to load supplier statement preferences", err);
      }
    }
    loadPrefs();
  }, [userEmail]);

  useEffect(() => {
    async function fetchStatement() {
      try {
        setLoading(true);
        setError(null);
        const res = await getSupplierStatement(supplier.id, companyId);
        if (res && res.success) {
          setLedger(res.ledger || []);
          if (res.supplier) {
            setSupplierDetails(res.supplier);
          }
        } else {
          setError(res?.error || "حدث خطأ أثناء تحميل كشف الحساب من السيرفر");
        }
      } catch (err: any) {
        console.error("Error loading supplier statement:", err);
        setError(err?.message || "فشل الاتصال بالخادم لتحميل كشف الحساب");
      } finally {
        setLoading(false);
      }
    }
    if (supplier?.id) {
      fetchStatement();
    }
  }, [supplier?.id, companyId]);

  // Apply search and status filters to the ledger entries
  const filteredLedger = useMemo(() => {
    return ledger.filter(entry => {
      // Date filter (YYYY-MM-DD comparison)
      if (fromDate) {
        const entryDateStr = entry.date ? entry.date.substring(0, 10) : '';
        if (entryDateStr && entryDateStr < fromDate) return false;
      }
      if (toDate) {
        const entryDateStr = entry.date ? entry.date.substring(0, 10) : '';
        if (entryDateStr && entryDateStr > toDate) return false;
      }

      // Invoice Search
      if (invoiceSearch.trim()) {
        const q = invoiceSearch.trim().toLowerCase();
        const docNum = (entry.documentNumber || '').toLowerCase();
        if (!docNum.includes(q)) return false;
      }

      // Item search inside invoice items
      if (itemSearch.trim()) {
        const q = itemSearch.trim().toLowerCase();
        const hasItem = entry.items && entry.items.some((item: any) => 
          (item.name || '').toLowerCase().includes(q) ||
          (item.productId || '').toLowerCase().includes(q)
        );
        if (!hasItem) return false;
      }

      // Type filter
      if (typeFilter === 'credit_purchase') {
        if (entry.type !== 'PURCHASE' || entry.paymentMethod === 'cash') return false;
      } else if (typeFilter === 'cash_purchase') {
        if (entry.type !== 'PURCHASE' || entry.paymentMethod !== 'cash') return false;
      } else if (typeFilter === 'payment') {
        if (entry.type !== 'PAYMENT') return false;
      } else if (typeFilter === 'return') {
        if (entry.type !== 'RETURN') return false;
      }

      return true;
    });
  }, [ledger, fromDate, toDate, invoiceSearch, itemSearch, typeFilter]);

  // Financial summary
  const openingBal = Number(supplierDetails.openingBalance || 0);
  
  const totalInvoiced = useMemo(() => {
    // Total Credits from purchases (Credit is purchases on account/credit side of ledger)
    return filteredLedger.reduce((sum, entry) => sum + (entry.credit || 0), 0);
  }, [filteredLedger]);

  const totalPaid = useMemo(() => {
    // Total Debits from payments, returns or immediate payments (Debit side of ledger)
    return filteredLedger.reduce((sum, entry) => sum + (entry.debit || 0), 0);
  }, [filteredLedger]);

  // Dynamic chronological final balance
  const currentDebt = useMemo(() => {
    if (filteredLedger.length > 0) {
      return filteredLedger[filteredLedger.length - 1].runningBalance;
    }
    return openingBal;
  }, [filteredLedger, openingBal]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn" style={{ touchAction: 'pan-y' }}>
      <div className="bg-card border border-border w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto">
        
        {/* Modal Header (Hidden on Print) */}
        <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card2/90 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gold/10 text-gold flex items-center justify-center font-bold shrink-0">
              <FileText size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-text-main flex flex-wrap items-center gap-2">
                <span>كشف حساب تفصيلي المورد:</span>
                <span className="text-gold break-all">{supplierDetails.name}</span>
              </h2>
              <p className="text-xs text-text-dim">عرض فواتير المشتريات، المدفوعات المسددة، والرصيد المتبقي</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setShowColModal(true)}
              className="bg-card border border-border hover:border-gold px-3 py-2 rounded-xl text-xs font-bold text-text-main transition-all flex items-center gap-1.5 shadow-sm no-print"
              title="تخصيص الأعمدة الظاهرة"
            >
              <Sliders size={14} className="text-gold" />
              <span>تخصيص الأعمدة</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={loading || error !== null}
              className="bg-gold hover:bg-gold2 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50"
            >
              <Printer size={15} />
              <span>طباعة الكشف</span>
            </button>
            <button
              onClick={onClose}
              className="bg-card border border-border p-2 rounded-xl text-text-dim hover:text-white transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Dynamic Column Customization Modal */}
        {showColModal && (
          <ColumnManagerModal
            tableName="supplier_statement"
            allColumns={STATEMENT_COLUMNS}
            defaultVisibleKeys={STATEMENT_DEFAULT_VISIBLE}
            currentVisibleKeys={visibleKeys}
            currentOrderedKeys={orderedKeys}
            onSave={(vis, ord) => {
              setVisibleKeys(vis);
              setOrderedKeys(ord);
            }}
            onClose={() => setShowColModal(false)}
          />
        )}

        {/* Filters Panel (Hidden on Print) */}
        <div className="p-4 bg-card border-b border-border space-y-3 no-print">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 text-xs">
            {/* Date Range */}
            <div>
              <label className="text-[11px] font-bold text-text-dim block mb-1">من تاريخ:</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-full bg-card2 border border-border p-2 rounded-xl font-mono text-text-main focus:border-gold focus:outline-none [color-scheme:dark]"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-text-dim block mb-1">إلى تاريخ:</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="w-full bg-card2 border border-border p-2 rounded-xl font-mono text-text-main focus:border-gold focus:outline-none [color-scheme:dark]"
              />
            </div>

            {/* Invoice Search */}
            <div>
              <label className="text-[11px] font-bold text-text-dim block mb-1">البحث برقم الحركة:</label>
              <div className="relative">
                <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim" />
                <input
                  type="text"
                  placeholder="رقم الفاتورة أو المستند"
                  value={invoiceSearch}
                  onChange={e => setInvoiceSearch(e.target.value)}
                  className="w-full bg-card2 border border-border pr-8 pl-2 py-2 rounded-xl font-mono text-text-main focus:border-gold focus:outline-none text-xs"
                />
              </div>
            </div>

            {/* Type Filter */}
            <div>
              <label className="text-[11px] font-bold text-text-dim block mb-1">نوع المعاملة:</label>
              <div className="relative">
                <Receipt size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim" />
                <select
                  value={typeFilter}
                  onChange={e => setTypeFilter(e.target.value as any)}
                  className="w-full bg-card2 border border-border pr-8 pl-2 py-2 rounded-xl text-text-main focus:border-gold focus:outline-none text-xs"
                >
                  <option value="all">الكل (الحركات المالية)</option>
                  <option value="cash_purchase">مشتريات نقدية (كاش)</option>
                  <option value="credit_purchase">مشتريات آجلة (على الحساب)</option>
                  <option value="payment">سداد ومدفوعات للمورد</option>
                  <option value="return">مرتجع مشتريات</option>
                </select>
              </div>
            </div>
            
            {/* Item Search */}
            <div>
              <label className="text-[11px] font-bold text-text-dim block mb-1">فلترة باسم الصنف المباع:</label>
              <div className="relative">
                <Package size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-dim" />
                <input
                  type="text"
                  placeholder="اسم أو كود الصنف..."
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  className="w-full bg-card2 border border-border pr-8 pl-2 py-2 rounded-xl text-text-main focus:border-gold focus:outline-none text-xs"
                />
              </div>
            </div>
          </div>

          {(fromDate || toDate || invoiceSearch || itemSearch || typeFilter !== 'all') && (
            <div className="flex justify-between items-center text-xs pt-1">
              <span className="text-gold font-bold flex items-center gap-1">
                <Filter size={12} />
                <span>نتائج البحث المفلترة: ({filteredLedger.length} حركة)</span>
              </span>
              <button
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                  setInvoiceSearch('');
                  setItemSearch('');
                  setTypeFilter('all');
                }}
                className="text-danger hover:underline text-[11px] font-bold"
              >
                إلغاء تصفية البحث
              </button>
            </div>
          )}
        </div>

        {/* Modal Scrollable Content (Printable Area) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-text-main printable-statement font-sans flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-10 h-10 border-4 border-t-gold border-border rounded-full animate-spin"></div>
              <p className="text-xs text-text-dim">جاري جلب وعرض كشف الحساب التفصيلي للمورد من قاعدة البيانات...</p>
            </div>
          ) : error ? (
            <div className="bg-danger/10 border border-danger/30 p-6 rounded-2xl text-center space-y-3">
              <p className="text-danger font-bold text-sm">⚠️ {error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="bg-danger text-white px-4 py-2 rounded-xl text-xs font-bold"
              >
                إعادة المحاولة
              </button>
            </div>
          ) : (
            <>
              {/* Printable Header */}
              <div className="flex justify-between items-start border-b border-border pb-4">
                <div>
                  <h1 className="text-xl font-black text-gold">{businessName}</h1>
                  <p className="text-xs text-text-dim mt-0.5">كشف حساب مورد مفصل وسجل المشتريات والمدفوعات</p>
                  {businessTax && <p className="text-[10px] text-text-dim font-mono">الرقم الضريبي: {businessTax}</p>}
                </div>

                <div className="text-left font-mono text-xs text-text-dim space-y-1">
                  <p>تاريخ الاستخراج: <strong className="text-text-main">{new Date().toLocaleDateString('ar-EG')}</strong></p>
                  <p>المورد: <strong className="text-gold font-bold">{supplierDetails.name}</strong></p>
                  {supplierDetails.phone && <p>الهاتف: <strong className="text-text-main">{supplierDetails.phone}</strong></p>}
                </div>
              </div>

              {/* Financial Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-card2 border border-border p-3 rounded-2xl">
                  <span className="text-[11px] text-text-dim block">الرصيد الافتتاحي</span>
                  <span className="text-sm font-black font-mono text-text-main">{(openingBal || 0).toLocaleString()} ج.م</span>
                </div>

                <div className="bg-card2 border border-border p-3 rounded-2xl">
                  <span className="text-[11px] text-text-dim block">إجمالي المشتريات (دائن)</span>
                  <span className="text-sm font-black font-mono text-danger">{(totalInvoiced || 0).toLocaleString()} ج.م</span>
                </div>

                <div className="bg-card2 border border-border p-3 rounded-2xl">
                  <span className="text-[11px] text-text-dim block">إجمالي المسدد (مدين)</span>
                  <span className="text-sm font-black font-mono text-success">{(totalPaid || 0).toLocaleString()} ج.م</span>
                </div>

                <div className="bg-card2 border border-border p-3 rounded-2xl">
                  <span className="text-[11px] text-text-dim block">الرصيد النهائي المستحق</span>
                  <span className={`text-sm font-black font-mono ${currentDebt > 0 ? 'text-danger' : 'text-success'}`}>
                    {(currentDebt || 0).toLocaleString()} ج.م
                  </span>
                </div>
              </div>

              {/* Invoices Ledger Table */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-text-main flex items-center justify-between">
                  <span>سجل المعاملات والمدفوعات ({filteredLedger.length})</span>
                  <span className="text-xs text-text-dim font-mono font-normal">عرض تسلسلي زمني متكامل للمورد</span>
                </h3>

                {filteredLedger.length === 0 ? (
                  <div className="text-center py-8 bg-card2/50 rounded-2xl border border-border text-text-dim text-xs">
                    لا توجد فواتير أو عمليات مطابقة للبحث المحدد لهذا المورد
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-border">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-card2 border-b border-border text-text-dim font-bold">
                        <tr>
                          {orderedKeys.map(colKey => {
                            if (!visibleKeys.includes(colKey)) return null;
                            const colDef = STATEMENT_COLUMNS.find(c => c.key === colKey);
                            return (
                              <th 
                                key={colKey} 
                                className={`p-3 ${colKey === 'debit' || colKey === 'credit' || colKey === 'runningBalance' || colKey === 'actions' ? 'text-center' : ''} ${colKey === 'actions' ? 'no-print' : ''}`}
                              >
                                {colDef?.label}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredLedger.map((entry) => {
                          const isExpanded = expandedInvoiceId === entry.id;
                          const hasDetails = entry.items && entry.items.length > 0;

                          return (
                             <React.Fragment key={entry.id}>
                               <tr className="hover:bg-card2/50 transition-colors">
                                 {orderedKeys.map(colKey => {
                                   if (!visibleKeys.includes(colKey)) return null;
                                   switch (colKey) {
                                     case 'documentNumber':
                                       return (
                                         <td key={colKey} className="p-3 font-mono font-bold text-gold">
                                           #{entry.documentNumber}
                                         </td>
                                       );
                                     case 'date':
                                       return (
                                         <td key={colKey} className="p-3 text-text-dim font-mono text-[11px]">
                                           {entry.date ? new Date(entry.date).toLocaleString('ar-EG') : 'غير محدد'}
                                         </td>
                                       );
                                     case 'type':
                                       return (
                                         <td key={colKey} className="p-3 text-[11px] font-bold text-text-dim">
                                           {entry.type === 'PURCHASE' ? 'فاتورة شراء' : 
                                            entry.type === 'PAYMENT' ? 'سند صرف' : 
                                            entry.type === 'RETURN' ? 'مرتجع مشتريات' : 'حركة'}
                                         </td>
                                       );
                                     case 'notes':
                                       return (
                                         <td key={colKey} className="p-3">
                                           <div className="flex flex-col">
                                             <span className="font-bold text-text-main">{entry.notes}</span>
                                             <span className="text-[10px] text-text-dim">
                                               {entry.type === 'PURCHASE' ? 'فاتورة شراء مشتريات' : 
                                                entry.type === 'PAYMENT' ? 'سند صرف مدفوعات' : 
                                                entry.type === 'RETURN' ? 'إذن مرتجع مشتريات' : 'حركة محاسبية للمورد'}
                                             </span>
                                           </div>
                                         </td>
                                       );
                                     case 'debit':
                                       return (
                                         <td key={colKey} className="p-3 text-center font-mono font-bold text-success">
                                           {entry.debit > 0 ? `-${entry.debit.toLocaleString()} ج.م` : '-'}
                                         </td>
                                       );
                                     case 'credit':
                                       return (
                                         <td key={colKey} className="p-3 text-center font-mono font-bold text-danger">
                                           {entry.credit > 0 ? `+${entry.credit.toLocaleString()} ج.م` : '-'}
                                         </td>
                                       );
                                     case 'runningBalance':
                                       return (
                                         <td key={colKey} className="p-3 text-center font-mono font-bold text-text-main">
                                           {entry.runningBalance.toLocaleString()} ج.م
                                         </td>
                                       );
                                     case 'cashier':
                                       return (
                                         <td key={colKey} className="p-3 text-center text-text-dim text-[11px]">
                                           {entry.createdBy || 'المدير'}
                                         </td>
                                       );
                                     case 'actions':
                                       return (
                                         <td key={colKey} className="p-3 text-center no-print">
                                           {hasDetails ? (
                                             <button
                                               onClick={() => setExpandedInvoiceId(isExpanded ? null : entry.id)}
                                               className="text-gold hover:underline font-bold text-[11px]"
                                             >
                                               {isExpanded ? 'إخفاء' : 'عرض الأصناف'}
                                             </button>
                                           ) : '-'}
                                         </td>
                                       );
                                     default:
                                       return null;
                                   }
                                 })}
                               </tr>

                               {/* Expanded Items Breakdown Row */}
                               {isExpanded && hasDetails && (
                                 <tr className="bg-card2/80 no-print">
                                   <td colSpan={visibleKeys.length} className="p-3 space-y-2 border-t border-border">
                                     <div className="bg-card p-3 rounded-xl border border-border space-y-2">
                                       <h4 className="font-bold text-xs text-gold flex items-center gap-1.5">
                                         <Receipt size={14} />
                                         <span>أصناف الحركة ومواصفاتها:</span>
                                       </h4>
                                       <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                         {entry.items.map((it: any, idx: number) => (
                                           <div key={idx} className="bg-card2 p-2 rounded-lg border border-border text-xs flex justify-between items-center">
                                             <div>
                                               <p className="font-bold text-text-main">{it.name}</p>
                                               <p className="text-[10px] text-text-dim font-mono">
                                                 الكمية: {it.quantity} × بسعر {it.unitPrice} ج.م
                                               </p>
                                             </div>
                                             <span className="font-mono font-bold text-gold">
                                               {(it.totalPrice || (it.quantity * it.unitPrice)).toLocaleString()} ج.م
                                             </span>
                                           </div>
                                         ))}
                                       </div>
                                     </div>
                                   </td>
                                 </tr>
                               )}
                             </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Printable Signatures & Footer */}
              <div className="pt-6 border-t border-border grid grid-cols-2 text-center text-xs text-text-dim font-bold">
                <div>
                  <p>توقيع الحسابات والمراجع</p>
                  <div className="h-12 border-b border-dashed border-border w-2/3 mx-auto mt-2"></div>
                </div>
                <div>
                  <p>اعتماد المشتريات والمدير</p>
                  <div className="h-12 border-b border-dashed border-border w-2/3 mx-auto mt-2"></div>
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
