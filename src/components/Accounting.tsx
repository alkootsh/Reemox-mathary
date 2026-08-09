import React, { useState, useEffect } from 'react';
import { Expense, Purchase, Customer, Supplier, Product } from '../types/types';
import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Toast from './Toast';
import { 
  DollarSign, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  Building2, 
  Users, 
  Package, 
  PlusCircle, 
  CheckCircle, 
  Calendar,
  Layers,
  Scale
} from 'lucide-react';

interface Props {
  expenses: Expense[];
  purchases: Purchase[];
}

export default function Accounting({ expenses, purchases }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'opening_balances' | 'expenses' | 'purchases'>('overview');
  const [modalType, setModalType] = useState<'expenses' | 'purchases' | null>(null);
  
  // Opening Balance states
  const [cashOpeningBalance, setCashOpeningBalance] = useState<number>(0);
  const [bankOpeningBalance, setBankOpeningBalance] = useState<number>(0);
  const [newCashOpening, setNewCashOpening] = useState<string>('');
  const [newBankOpening, setNewBankOpening] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  useEffect(() => {
    loadAccountingData();
  }, []);

  const loadAccountingData = async () => {
    try {
      setLoading(true);
      // 1. Load Treasury settings
      const treasuryDoc = await getDoc(doc(db, 'settings', 'treasury_opening'));
      if (treasuryDoc.exists()) {
        const data = treasuryDoc.data();
        setCashOpeningBalance(data.cashOpening || 0);
        setBankOpeningBalance(data.bankOpening || 0);
        setNewCashOpening((data.cashOpening || 0).toString());
        setNewBankOpening((data.bankOpening || 0).toString());
      }

      // 2. Load Customers
      const custSnap = await getDocs(collection(db, 'customers'));
      setCustomers(custSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));

      // 3. Load Suppliers
      const suppSnap = await getDocs(collection(db, 'suppliers'));
      setSuppliers(suppSnap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));

      // 4. Load Products
      const prodSnap = await getDocs(collection(db, 'products'));
      setProducts(prodSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    } catch (err: any) {
      console.error('Error loading accounting data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTreasuryOpening = async () => {
    try {
      const cashVal = parseFloat(newCashOpening) || 0;
      const bankVal = parseFloat(newBankOpening) || 0;
      await setDoc(doc(db, 'settings', 'treasury_opening'), {
        cashOpening: cashVal,
        bankOpening: bankVal,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setCashOpeningBalance(cashVal);
      setBankOpeningBalance(bankVal);
      setToast({ message: 'تم حفظ رصيد أول المدة للخزينة والبنك بنجاح', type: 'success' });
    } catch (err: any) {
      setToast({ message: 'فشل حفظ رصيد الخزينة: ' + err.message, type: 'warning' });
    }
  };

  // Calculations
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + p.total, 0);
  const totalPaidPurchases = purchases.reduce((sum, p) => sum + p.paidAmount, 0);
  const totalPendingPurchases = totalPurchases - totalPaidPurchases;

  // Opening Balance Totals
  const totalStockOpeningCost = (products || []).reduce((sum, p) => {
    if (!p) return sum;
    const qty = p.openingStock ?? p.quantity ?? 0;
    const cost = p.openingCost ?? p.cost ?? 0;
    return sum + (qty * cost);
  }, 0);

  const totalCustomerOpening = customers.reduce((sum, c) => sum + (c.openingBalance || 0), 0);
  const totalSupplierOpening = suppliers.reduce((sum, s) => sum + (s.openingBalance || 0), 0);
  
  // Total Initial Assets / Equity
  const totalOpeningAssets = cashOpeningBalance + bankOpeningBalance + totalStockOpeningCost + totalCustomerOpening;
  const initialEquity = totalOpeningAssets - totalSupplierOpening;

  return (
    <div className="p-4 sm:p-6 pb-24 max-w-6xl mx-auto space-y-6">
      {toast && <Toast message={toast.message} onClose={() => setToast(null)} />}

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-text-main flex items-center gap-2">
            <Scale className="text-gold" />
            <span>شاشة الحسابات والأرصدة الافتتاحية</span>
          </h2>
          <p className="text-xs text-text-dim mt-1">إدارة رصيد أول المدة، حركة الصندوق، المصروفات، والذمم المالية</p>
        </div>

        <div className="flex bg-card2 p-1 rounded-2xl border border-border gap-1 w-full sm:w-auto">
          <button 
            onClick={() => setActiveTab('overview')} 
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'overview' ? 'bg-gold text-white shadow' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <Wallet size={14} />
            <span>الملخص المالي</span>
          </button>
          <button 
            onClick={() => setActiveTab('opening_balances')} 
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'opening_balances' ? 'bg-gold text-white shadow' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <Layers size={14} />
            <span>أرصدة أول المدة</span>
          </button>
          <button 
            onClick={() => setActiveTab('expenses')} 
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'expenses' ? 'bg-gold text-white shadow' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <TrendingDown size={14} />
            <span>المصروفات ({expenses.length})</span>
          </button>
          <button 
            onClick={() => setActiveTab('purchases')} 
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'purchases' ? 'bg-gold text-white shadow' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <Receipt size={14} />
            <span>المشتريات ({purchases.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Cash & Bank Opening */}
            <div className="bg-card p-5 rounded-3xl border border-border shadow-sm">
              <div className="flex items-center justify-between text-text-dim mb-2">
                <span className="text-xs font-bold">رصيد أول المدة للخزينة والبنك</span>
                <Wallet className="text-gold" size={18} />
              </div>
              <div className="text-2xl font-black text-gold font-mono">
                {(cashOpeningBalance + bankOpeningBalance).toLocaleString('en-US')} ج.م
              </div>
              <div className="text-[11px] text-text-dim mt-2 flex justify-between">
                <span>الخزينة: {cashOpeningBalance.toLocaleString()} ج</span>
                <span>البنك: {bankOpeningBalance.toLocaleString()} ج</span>
              </div>
            </div>

            {/* Expenses */}
            <div 
              onClick={() => setActiveTab('expenses')}
              className="bg-card p-5 rounded-3xl border border-border cursor-pointer hover:border-danger/60 transition-all shadow-sm group"
            >
              <div className="flex items-center justify-between text-text-dim mb-2">
                <span className="text-xs font-bold">إجمالي المصروفات المسجلة</span>
                <TrendingDown className="text-danger group-hover:scale-110 transition-transform" size={18} />
              </div>
              <div className="text-2xl font-black text-danger font-mono">
                {totalExpenses.toLocaleString('en-US')} ج.م
              </div>
              <p className="text-[11px] text-text-dim mt-2">عدد القيود: {expenses.length} مصروف</p>
            </div>

            {/* Purchases */}
            <div 
              onClick={() => setActiveTab('purchases')}
              className="bg-card p-5 rounded-3xl border border-border cursor-pointer hover:border-gold/60 transition-all shadow-sm group"
            >
              <div className="flex items-center justify-between text-text-dim mb-2">
                <span className="text-xs font-bold">إجمالي فواتير المشتريات</span>
                <Receipt className="text-gold group-hover:scale-110 transition-transform" size={18} />
              </div>
              <div className="text-2xl font-black text-text-main font-mono">
                {totalPurchases.toLocaleString('en-US')} ج.م
              </div>
              <div className="text-[11px] text-text-dim mt-2 flex justify-between">
                <span>المدفوع: {totalPaidPurchases.toLocaleString()} ج</span>
                <span className="text-danger">الآجل: {totalPendingPurchases.toLocaleString()} ج</span>
              </div>
            </div>

            {/* Opening Inventory Valuation */}
            <div className="bg-card p-5 rounded-3xl border border-border shadow-sm">
              <div className="flex items-center justify-between text-text-dim mb-2">
                <span className="text-xs font-bold">قيمة بضاعة أول المدة (المخزون)</span>
                <Package className="text-emerald-400" size={18} />
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {totalStockOpeningCost.toLocaleString('en-US')} ج.م
              </div>
              <p className="text-[11px] text-text-dim mt-2">عدد الأصناف: {products.length} صنف</p>
            </div>
          </div>

          {/* Quick Balance Statement Card */}
          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
            <h3 className="text-base font-bold mb-4 flex items-center gap-2">
              <Scale size={18} className="text-gold" />
              <span>ميزان رأس المال الافتتاحي (Opening Capital Equity Balance)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="bg-card2/60 p-4 rounded-2xl border border-border">
                <div className="text-xs text-text-dim font-bold mb-1">إجمالي الأصول الافتتاحية (+)</div>
                <div className="text-xl font-black text-emerald-400 font-mono">
                  +{totalOpeningAssets.toLocaleString('en-US')} ج.م
                </div>
                <div className="text-[11px] text-text-dim mt-1">(خزينة + بنك + بضاعة + ذمم عملاء)</div>
              </div>

              <div className="bg-card2/60 p-4 rounded-2xl border border-border">
                <div className="text-xs text-text-dim font-bold mb-1">إجمالي الالتزامات الافتتاحية (-)</div>
                <div className="text-xl font-black text-rose-400 font-mono">
                  -{totalSupplierOpening.toLocaleString('en-US')} ج.م
                </div>
                <div className="text-[11px] text-text-dim mt-1">(أرصدة الموردين الدائنة)</div>
              </div>

              <div className="bg-card2/60 p-4 rounded-2xl border border-gold/30">
                <div className="text-xs text-gold font-bold mb-1">صافي رأس المال الافتتاحي (=)</div>
                <div className="text-xl font-black text-gold font-mono">
                  {initialEquity.toLocaleString('en-US')} ج.م
                </div>
                <div className="text-[11px] text-text-dim mt-1">(حقوق الملكية ورأس المال المبدئي)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: OPENING BALANCES HUB */}
      {activeTab === 'opening_balances' && (
        <div className="space-y-6">
          {/* Treasury Opening Input */}
          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-text-main flex items-center gap-2">
                  <Wallet className="text-gold" />
                  <span>رصيد أول المدة للخزينة والبنك</span>
                </h3>
                <p className="text-xs text-text-dim mt-0.5">النقدية المتاحة في الدرج / الحساب البنكي عند بدء العمل بالنظام</p>
              </div>
              <button 
                onClick={handleSaveTreasuryOpening}
                className="bg-gold hover:bg-gold2 text-white px-5 py-2.5 rounded-2xl font-bold text-xs shadow transition-all active:scale-95"
              >
                حفظ رصيد الخزينة
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-bold text-text-dim block mb-1">رصيد أول المدة للخزينة النقدية (Cash In Drawer)</label>
                <input 
                  type="number"
                  placeholder="0.00"
                  className="bg-card2 border border-border p-3 rounded-2xl w-full text-sm font-bold font-mono text-text-main focus:border-gold focus:outline-none"
                  value={newCashOpening}
                  onChange={e => setNewCashOpening(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-text-dim block mb-1">رصيد أول المدة للحساب البنكي (Bank Balance)</label>
                <input 
                  type="number"
                  placeholder="0.00"
                  className="bg-card2 border border-border p-3 rounded-2xl w-full text-sm font-bold font-mono text-text-main focus:border-gold focus:outline-none"
                  value={newBankOpening}
                  onChange={e => setNewBankOpening(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Products Opening Summary */}
            <div className="bg-card p-5 rounded-3xl border border-border shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-text-main flex items-center gap-1.5">
                    <Package size={16} className="text-emerald-400" />
                    <span>رصيد أول مدة الأصناف</span>
                  </span>
                  <span className="text-xs font-mono bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                    {products.length} صنف
                  </span>
                </div>
                <p className="text-xs text-text-dim mb-3">إجمالي قيمة بضاعة أول المدة بسعر التكلفة</p>
                <div className="text-2xl font-black text-emerald-400 font-mono">
                  {totalStockOpeningCost.toLocaleString('en-US')} ج.م
                </div>
              </div>
              <p className="text-[11px] text-text-dim mt-4 border-t border-border/60 pt-2">
                يتم تعديل أرصدة وتكلفة أول مدة لكل صنف من شاشة <strong>إدارة المخزون</strong> أو <strong>الجرد</strong>.
              </p>
            </div>

            {/* Customers Opening Balance */}
            <div className="bg-card p-5 rounded-3xl border border-border shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-text-main flex items-center gap-1.5">
                    <Users size={16} className="text-sky-400" />
                    <span>أرصدة أول مدة العملاء</span>
                  </span>
                  <span className="text-xs font-mono bg-sky-500/10 text-sky-400 px-2 py-0.5 rounded-full font-bold">
                    {customers.length} عميل
                  </span>
                </div>
                <p className="text-xs text-text-dim mb-3">مستحقات على العملاء قبل بدء النظام (ذمم مدينة)</p>
                <div className="text-2xl font-black text-sky-400 font-mono">
                  {totalCustomerOpening.toLocaleString('en-US')} ج.م
                </div>
              </div>
              <p className="text-[11px] text-text-dim mt-4 border-t border-border/60 pt-2">
                يتم تسجيل الرصيد الافتتاحي لكل عميل من شاشة <strong>العملاء</strong>.
              </p>
            </div>

            {/* Suppliers Opening Balance */}
            <div className="bg-card p-5 rounded-3xl border border-border shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-text-main flex items-center gap-1.5">
                    <Building2 size={16} className="text-rose-400" />
                    <span>أرصدة أول مدة الموردين</span>
                  </span>
                  <span className="text-xs font-mono bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full font-bold">
                    {suppliers.length} مورد
                  </span>
                </div>
                <p className="text-xs text-text-dim mb-3">مستحقات للموردين قبل بدء النظام (ذمم دائنة)</p>
                <div className="text-2xl font-black text-rose-400 font-mono">
                  {totalSupplierOpening.toLocaleString('en-US')} ج.م
                </div>
              </div>
              <p className="text-[11px] text-text-dim mt-4 border-t border-border/60 pt-2">
                يتم تسجيل الرصيد الافتتاحي لكل مورد من شاشة <strong>الموردين</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: EXPENSES LIST */}
      {activeTab === 'expenses' && (
        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <h3 className="font-bold text-lg text-text-main">سجل المصروفات والنثريات</h3>
            <span className="font-black text-danger text-lg font-mono">الإجمالي: {totalExpenses.toLocaleString()} ج.م</span>
          </div>

          {expenses.length === 0 ? (
            <p className="text-center text-text-dim py-8">لا توجد مصروفات مسجلة بعد</p>
          ) : (
            <div className="space-y-2.5">
              {expenses.map(e => (
                <div key={e.id} className="bg-card2 p-4 rounded-2xl border border-border flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-sm text-text-main">{e.category}</h4>
                    <p className="text-xs text-text-dim mt-0.5">
                      {new Date(e.date).toLocaleDateString('ar-EG')} {e.notes ? `| ${e.notes}` : ''}
                    </p>
                  </div>
                  <div className="text-right font-black text-danger font-mono text-base">
                    {e.amount.toLocaleString()} ج.م
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PURCHASES LIST */}
      {activeTab === 'purchases' && (
        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-3">
            <h3 className="font-bold text-lg text-text-main">سجل فواتير المشتريات</h3>
            <span className="font-black text-text-main text-lg font-mono">الإجمالي: {totalPurchases.toLocaleString()} ج.م</span>
          </div>

          {purchases.length === 0 ? (
            <p className="text-center text-text-dim py-8">لا توجد مشتريات مسجلة بعد</p>
          ) : (
            <div className="space-y-2.5">
              {purchases.map(p => (
                <div key={p.id} className="bg-card2 p-4 rounded-2xl border border-border flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-sm text-text-main">المورد: {p.supplierName}</h4>
                    <p className="text-xs text-text-dim mt-0.5">
                      التاريخ: {new Date(p.date).toLocaleDateString('ar-EG')} | الطريقة: {p.paymentMethod === 'cash' ? 'كاش' : p.paymentMethod === 'deferred-full' ? 'آجل كلي' : 'آجل جزئي'}
                    </p>
                    {p.items?.map((item, idx) => (
                      <p key={idx} className="text-xs text-gold mt-0.5 font-mono">• {item?.productName || 'صنف'} ({item?.quantity || 0} × {item?.cost || 0} ج)</p>
                    ))}
                  </div>
                  <div className="text-right">
                    <div className="font-black text-text-main font-mono text-base">{p.total.toLocaleString()} ج.م</div>
                    <div className="text-xs text-text-dim">المدفوع: {p.paidAmount.toLocaleString()} ج</div>
                    {p.total - p.paidAmount > 0 && (
                      <div className="text-xs text-danger font-bold">المتبقي: {(p.total - p.paidAmount).toLocaleString()} ج</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

