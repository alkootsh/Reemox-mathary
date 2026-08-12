import React, { useState, useEffect, useMemo } from 'react';
import { Expense, Purchase, Customer, Supplier, Product, Sale, CashierSession } from '../types/types';
import { 
  getCustomers, 
  getSuppliers, 
  getProducts,
  getExpenseCategories,
  saveExpenseCategory,
  deleteExpenseCategory,
  getExpenses
} from '../lib/firestoreService';
import Toast from './Toast';
import TreasuryWarehouseModal from './TreasuryWarehouseModal';
import JournalEntryEditModal, { EntryItem } from './JournalEntryEditModal';
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
  Scale,
  FolderTree,
  Tag,
  Plus,
  Trash2,
  Edit2,
  FileText,
  PieChart,
  ArrowRight,
  BookOpen,
  Vault,
  Clock,
  ArrowDownRight,
  ArrowUpLeft,
  Store,
  ShieldCheck,
  Eye,
  Settings
} from 'lucide-react';

import ChartOfAccounts from './ChartOfAccounts';

interface Props {
  expenses: Expense[];
  purchases: Purchase[];
  sales?: Sale[];
  sessions?: CashierSession[];
  customers?: Customer[];
  suppliers?: Supplier[];
  products?: Product[];
}

export default function Accounting({ 
  expenses, 
  purchases, 
  sales = [], 
  sessions = [],
  customers: initialCustomers,
  suppliers: initialSuppliers,
  products: initialProducts
}: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'coa' | 'treasuries' | 'opening_balances' | 'expense_accounts' | 'expenses' | 'purchases'>('overview');
  
  // Opening Balance states
  const [cashOpeningBalance, setCashOpeningBalance] = useState<number>(0);
  const [bankOpeningBalance, setBankOpeningBalance] = useState<number>(0);
  const [newCashOpening, setNewCashOpening] = useState<string>('');
  const [newBankOpening, setNewBankOpening] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers || []);
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialSuppliers || []);
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  
  // Expense Categories states
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

  // Modals states
  const [isTreasuryModalOpen, setIsTreasuryModalOpen] = useState(false);
  const [selectedJournalEntry, setSelectedJournalEntry] = useState<EntryItem | null>(null);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);

  useEffect(() => {
    loadAccountingData();
  }, []);

  const loadAccountingData = async () => {
    try {
      setLoading(true);
      // 1. Load Treasury settings
      const cachedSettings = localStorage.getItem('maro_treasury_opening');
      if (cachedSettings) {
        const data = JSON.parse(cachedSettings);
        setCashOpeningBalance(data.cashOpening || 0);
        setBankOpeningBalance(data.bankOpening || 0);
        setNewCashOpening((data.cashOpening || 0).toString());
        setNewBankOpening((data.bankOpening || 0).toString());
      }

      // 2. Load Customers
      const customersData = await getCustomers();
      setCustomers(customersData);

      // 3. Load Suppliers
      const suppliersData = await getSuppliers();
      setSuppliers(suppliersData);

      // 4. Load Products
      const productsData = await getProducts();
      setProducts(productsData);

      // 5. Load Expense Categories
      const categoriesData = await getExpenseCategories();
      setExpenseCategories(categoriesData);
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
      
      const settingsPayload = {
        cashOpening: cashVal,
        bankOpening: bankVal,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('maro_treasury_opening', JSON.stringify(settingsPayload));

      setCashOpeningBalance(cashVal);
      setBankOpeningBalance(bankVal);
      setToast({ message: 'تم حفظ رصيد أول المدة للخزينة والبنك بنجاح', type: 'success' });
    } catch (err: any) {
      setToast({ message: 'فشل حفظ رصيد الخزينة: ' + err.message, type: 'warning' });
    }
  };

  // Expense Categories Handlers
  const handleAddCategory = async (nameToAdd?: string) => {
    const targetName = (nameToAdd || newCatName).trim();
    if (!targetName) {
      setToast({ message: 'يرجى كتابة اسم بند المصروف', type: 'warning' });
      return;
    }

    try {
      await saveExpenseCategory({ name: targetName });
      setNewCatName('');
      setToast({ message: `تمت إضافة بند المصروف "${targetName}" بنجاح`, type: 'success' });
      const updatedCats = await getExpenseCategories();
      setExpenseCategories(updatedCats);
    } catch (err: any) {
      setToast({ message: 'فشل إضافة بند المصروف: ' + err.message, type: 'warning' });
    }
  };

  const handleUpdateCategory = async (id: string) => {
    if (!editingCatName.trim()) return;
    try {
      await saveExpenseCategory({ id, name: editingCatName.trim() });
      setEditingCatId(null);
      setEditingCatName('');
      setToast({ message: 'تم تحديث اسم بند المصروف بنجاح', type: 'success' });
      const updatedCats = await getExpenseCategories();
      setExpenseCategories(updatedCats);
    } catch (err: any) {
      setToast({ message: 'فشل التعديل: ' + err.message, type: 'warning' });
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف بند المصروف "${name}"؟`)) return;
    try {
      await deleteExpenseCategory(id);
      setToast({ message: `تم حذف بند المصروف "${name}" بنجاح`, type: 'success' });
      const updatedCats = await getExpenseCategories();
      setExpenseCategories(updatedCats);
    } catch (err: any) {
      setToast({ message: 'فشل الحذف: ' + err.message, type: 'warning' });
    }
  };

  // Preset Common Egyptian/Arab Business Expense Categories
  const commonPresets = [
    'إيجار المقر والفرع',
    'كهرباء وإنارة',
    'مياه وصرف',
    'غاز واستهلاكات وقود',
    'رواتب وأجور عاملين',
    'صيانة وإصلاحات ومعدات',
    'بوفيه وضيافة ومشروبات',
    'انتقالات ومواصلات وشحن',
    'أدوات مكتبية ومطبوعات',
    'دعاية وإعلان وتسويق',
    'اشتراكات وإنترنت وهواتف',
    'ضرائب ورسوم وتراخيص'
  ];

  // Calculations
  const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
  const totalPaidPurchases = purchases.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);
  const totalPendingPurchases = totalPurchases - totalPaidPurchases;

  // Aggregate expenses per category
  const categoryStatsMap = new Map<string, { total: number; count: number }>();
  expenses.forEach(e => {
    const cat = e.category || 'مصروفات متنوعة';
    const amt = Number(e.amount) || 0;
    const current = categoryStatsMap.get(cat) || { total: 0, count: 0 };
    categoryStatsMap.set(cat, {
      total: current.total + amt,
      count: current.count + 1
    });
  });

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

  // Filtered expenses for category detailed view
  const displayedExpenses = selectedCategoryFilter 
    ? expenses.filter(e => e.category === selectedCategoryFilter)
    : expenses;

  // Cash Ledger & Treasury Calculations
  const cashSalesTotal = useMemo(() => {
    return sales.reduce((sum, s) => {
      if (s.paymentMethod === 'cash') return sum + (s.finalTotal || s.total || 0);
      let pCash = 0;
      s.payments?.forEach(p => { if (p.method === 'CASH') pCash += (p.amount || 0); });
      return sum + pCash;
    }, 0);
  }, [sales]);

  const cashPurchasesTotal = useMemo(() => {
    return purchases.reduce((sum, p) => {
      if (p.paymentMethod === 'cash') return sum + (p.paidAmount || p.total || 0);
      return sum;
    }, 0);
  }, [purchases]);

  const activeShift = useMemo(() => {
    return sessions.find(s => s.status === 'ACTIVE' || s.status === 'OPEN') || null;
  }, [sessions]);

  // Main Treasury current net cash balance
  const mainTreasuryCurrentCash = cashOpeningBalance + cashSalesTotal - totalExpenses - cashPurchasesTotal;

  // Chronological Cash Ledger Entries (الدفتر النقدي اليومي)
  const cashLedgerEntries = useMemo(() => {
    const entries: EntryItem[] = [];

    if (cashOpeningBalance > 0) {
      entries.push({
        id: 'opening_cash',
        type: 'opening',
        rawId: 'opening_cash',
        date: new Date().toISOString(),
        title: 'رصيد أول المدة للخزينة النقدية',
        notes: 'الرصيد الافتتاحي المعتمد بالنظام',
        amount: cashOpeningBalance,
        isCreditOrDebit: 'in'
      });
    }

    sales.forEach(s => {
      let cashAmt = 0;
      if (s.paymentMethod === 'cash') cashAmt = s.finalTotal || s.total || 0;
      else s.payments?.forEach(p => { if (p.method === 'CASH') cashAmt += (p.amount || 0); });

      if (cashAmt > 0) {
        entries.push({
          id: `sale_${s.id}`,
          type: 'sale',
          rawId: s.id,
          date: s.date || new Date().toISOString(),
          title: `مقبوضات مبيعات نقدية #${s.invoiceNumber || s.id}`,
          notes: `العميل: ${s.customerName || 'عميل نقدي'}`,
          amount: cashAmt,
          isCreditOrDebit: 'in',
          customerOrSupplier: s.customerName
        });
      }
    });

    expenses.forEach(e => {
      if ((e.amount || 0) > 0) {
        entries.push({
          id: `exp_${e.id}`,
          type: 'expense',
          rawId: e.id,
          date: e.date || new Date().toISOString(),
          title: `مصروفات نقدية: ${e.category || 'مصروف متنوع'}`,
          category: e.category,
          notes: e.notes || 'إذن صرف نقدية',
          amount: e.amount,
          isCreditOrDebit: 'out'
        });
      }
    });

    purchases.forEach(p => {
      const amt = p.paidAmount || (p.paymentMethod === 'cash' ? p.total : 0);
      if (amt > 0) {
        entries.push({
          id: `pur_${p.id}`,
          type: 'purchase',
          rawId: p.id,
          date: p.date || new Date().toISOString(),
          title: `سداد مشتريات للمورد: ${p.supplierName || 'مورد'}`,
          notes: `فاتورة مشتريات #${p.invoiceNumber || p.id}`,
          amount: amt,
          isCreditOrDebit: 'out',
          customerOrSupplier: p.supplierName
        });
      }
    });

    // Sort descending by date
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return entries;
  }, [cashOpeningBalance, sales, expenses, purchases]);

  return (
    <div className="p-4 sm:p-6 pb-24 max-w-6xl mx-auto space-y-6">
      {toast && <Toast message={toast.message} onClose={() => setToast(null)} />}

      {/* Header & Tabs */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-border pb-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full lg:w-auto gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-text-main flex items-center gap-2">
              <Scale className="text-gold" />
              <span>شاشة الحسابات والأرصدة الافتتاحية ودليل المصروفات</span>
            </h2>
            <p className="text-xs text-text-dim mt-1">إدارة شجرة بنود المصروفات المجمعة، الأرصدة الافتتاحية، وتتبع الحسابات الرئيسية</p>
          </div>

          <button
            onClick={() => setIsTreasuryModalOpen(true)}
            className="bg-gold/10 hover:bg-gold text-gold hover:text-white border border-gold/30 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm whitespace-nowrap active:scale-95"
          >
            <PlusCircle size={16} />
            <span>🏦 إدارة وإضافة الخزن والمخازن</span>
          </button>
        </div>

        <div className="flex flex-wrap bg-card2 p-1 rounded-2xl border border-border gap-1 w-full lg:w-auto">
          <button 
            onClick={() => setActiveTab('overview')} 
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'overview' ? 'bg-gold text-white shadow' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <Wallet size={14} />
            <span>الملخص المالي</span>
          </button>

          <button 
            onClick={() => setActiveTab('coa')} 
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'coa' ? 'bg-gold text-white shadow' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <FolderTree size={14} />
            <span>شجرة الحسابات (COA)</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('treasuries')} 
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'treasuries' ? 'bg-gold text-white shadow' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <Vault size={14} />
            <span>الخزن والشيفتات والدفتر النقدي والمخازن</span>
          </button>

          <button 
            onClick={() => setActiveTab('expense_accounts')} 
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'expense_accounts' ? 'bg-gold text-white shadow' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <FolderTree size={14} />
            <span>دليل بنود المصروفات ({expenseCategories.length})</span>
          </button>

          <button 
            onClick={() => setActiveTab('opening_balances')} 
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'opening_balances' ? 'bg-gold text-white shadow' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <Layers size={14} />
            <span>أرصدة أول المدة</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('expenses')} 
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'expenses' ? 'bg-gold text-white shadow' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <TrendingDown size={14} />
            <span>قيود المصروفات ({expenses.length})</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('purchases')} 
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
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
              onClick={() => setActiveTab('expense_accounts')}
              className="bg-card p-5 rounded-3xl border border-border cursor-pointer hover:border-danger/60 transition-all shadow-sm group"
            >
              <div className="flex items-center justify-between text-text-dim mb-2">
                <span className="text-xs font-bold">إجمالي المصروفات المرحلة</span>
                <TrendingDown className="text-danger group-hover:scale-110 transition-transform" size={18} />
              </div>
              <div className="text-2xl font-black text-danger font-mono">
                {totalExpenses.toLocaleString('en-US')} ج.م
              </div>
              <p className="text-[11px] text-text-dim mt-2">
                موزعة على {expenseCategories.length} بنود رئيسية
              </p>
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

      {/* TAB: CHART OF ACCOUNTS */}
      {activeTab === 'coa' && (
        <ChartOfAccounts />
      )}

      {/* TAB 2: TREASURIES, SHIFTS, CASH LEDGER & WAREHOUSES */}
      {activeTab === 'treasuries' && (
        <div className="space-y-6">
          {/* Main Treasury Summary Banner */}
          <div className="bg-card p-6 rounded-3xl border border-gold/30 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-border pb-3">
              <div>
                <h3 className="font-black text-xl text-text-main flex items-center gap-2">
                  <Vault className="text-gold" size={24} />
                  <span>الخزنة الرئيسية والحسابات النقدية</span>
                </h3>
                <p className="text-xs text-text-dim mt-0.5">
                  تتبع السيولة النقدية الفعلية بالدرج والخزنة الرئيسية، ربط الشيفتات اليومية، ودفتريات المقبوضات والمصروفات
                </p>
              </div>
              <div className="bg-gold/10 border border-gold/30 p-3 rounded-2xl text-right">
                <span className="text-xs text-gold font-bold block">صافي رصيد الخزنة الرئيسية الحالية:</span>
                <span className="text-2xl font-black text-gold font-mono">
                  {mainTreasuryCurrentCash.toLocaleString('en-US')} ج.م
                </span>
              </div>
            </div>

            {/* Cash Flow Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="bg-card2 p-3.5 rounded-2xl border border-border">
                <span className="text-xs text-text-dim block mb-1">رصيد أول المدة (+)</span>
                <span className="text-base font-bold text-text-main font-mono">{cashOpeningBalance.toLocaleString()} ج.م</span>
              </div>
              <div className="bg-card2 p-3.5 rounded-2xl border border-emerald-500/30">
                <span className="text-xs text-emerald-400 block mb-1">المقبوضات والمبيعات (+)</span>
                <span className="text-base font-bold text-emerald-400 font-mono">+{cashSalesTotal.toLocaleString()} ج.م</span>
              </div>
              <div className="bg-card2 p-3.5 rounded-2xl border border-rose-500/30">
                <span className="text-xs text-rose-400 block mb-1">المصروفات النقدية (-)</span>
                <span className="text-base font-bold text-rose-400 font-mono">-{totalExpenses.toLocaleString()} ج.م</span>
              </div>
              <div className="bg-card2 p-3.5 rounded-2xl border border-amber-500/30">
                <span className="text-xs text-amber-400 block mb-1">مدفوعات المشتريات (-)</span>
                <span className="text-base font-bold text-amber-400 font-mono">-{cashPurchasesTotal.toLocaleString()} ج.م</span>
              </div>
            </div>
          </div>

          {/* Active Cashier Shift & Drawer Section */}
          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-bold text-base text-text-main flex items-center gap-2">
                <Clock className="text-gold" size={18} />
                <span>حالة خزن الدرج والشيفتات الحالية (Cashier Drawer & Shift)</span>
              </h3>
              <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
                activeShift ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}>
                {activeShift ? `● وردية مفتوحة: ${activeShift.cashierName}` : '○ لا توجد وردية مفتوحة حالياً'}
              </span>
            </div>

            {activeShift ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-card2 p-4 rounded-2xl border border-border">
                <div>
                  <span className="text-xs text-text-dim block">الكاشير المسئول:</span>
                  <span className="font-bold text-sm text-text-main">{activeShift.cashierName}</span>
                  <span className="text-[11px] text-text-dim block mt-1">تاريخ الفتح: {new Date(activeShift.openedAt).toLocaleString('ar-EG')}</span>
                </div>
                <div>
                  <span className="text-xs text-text-dim block">عهد الرصيد الافتتاحي بالدرج:</span>
                  <span className="font-bold text-sm text-gold font-mono">{(activeShift.openingCash || 0).toLocaleString()} ج.م</span>
                </div>
                <div>
                  <span className="text-xs text-text-dim block">المبيعات النقدية بالوردية:</span>
                  <span className="font-bold text-sm text-emerald-400 font-mono">
                    +{sales.filter(s => new Date(s.date).getTime() >= new Date(activeShift.openedAt).getTime() && s.paymentMethod === 'cash')
                      .reduce((sum, s) => sum + (s.finalTotal || s.total || 0), 0).toLocaleString()} ج.م
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-dim text-center py-4">
                يمكن فتح وردية جديدة ومتابعة تسليمات الكاشير وتقارير Z من شاشة <strong>الوردية و Z</strong>.
              </p>
            )}
          </div>

          {/* Chronological Cash Ledger (الدفتر النقدي) */}
          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base text-text-main flex items-center gap-2">
                  <BookOpen className="text-gold" size={18} />
                  <span>الدفتر النقدي التراكمي (Cash Daybook Ledger)</span>
                </h3>
                <p className="text-xs text-text-dim mt-0.5">سجل جميع الحركات النقدية - اضغط على أي قيد لمراجعته وتعديله</p>
              </div>
              <span className="text-xs font-bold text-gold font-mono">
                عدد الحركات: {cashLedgerEntries.length}
              </span>
            </div>

            {cashLedgerEntries.length === 0 ? (
              <p className="text-center text-text-dim py-8">لا توجد حركات نقدية مسجلة بالدفتر بعد</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-card2 border-b border-border text-text-dim font-bold">
                      <th className="p-3">التاريخ والوقت</th>
                      <th className="p-3">بيان الحركة</th>
                      <th className="p-3">الملاحظات / التفاصيل</th>
                      <th className="p-3 text-emerald-400">مقبوضات (+)</th>
                      <th className="p-3 text-rose-400">مدفوعات (-)</th>
                      <th className="p-3 text-center">إجراءات القيد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-mono">
                    {cashLedgerEntries.map(entry => (
                      <tr 
                        key={entry.id} 
                        onClick={() => setSelectedJournalEntry(entry)}
                        className="hover:bg-gold/10 cursor-pointer transition-colors group"
                        title="اضغط لمعاينة وتعديل القيد المحاسبي"
                      >
                        <td className="p-3 text-text-dim whitespace-nowrap">
                          {new Date(entry.date).toLocaleDateString('ar-EG')} - {new Date(entry.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3 font-bold text-text-main font-sans">{entry.title}</td>
                        <td className="p-3 text-text-dim font-sans">{entry.notes}</td>
                        <td className="p-3 text-emerald-400 font-bold">
                          {entry.isCreditOrDebit === 'in' ? `+${entry.amount.toLocaleString()} ج` : '-'}
                        </td>
                        <td className="p-3 text-rose-400 font-bold">
                          {entry.isCreditOrDebit === 'out' ? `-${entry.amount.toLocaleString()} ج` : '-'}
                        </td>
                        <td className="p-3 text-center">
                          <span className="bg-gold/10 group-hover:bg-gold text-gold group-hover:text-white border border-gold/30 px-2.5 py-1 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 transition-all">
                            <Eye size={12} />
                            <span>تعديل القيد</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Warehouses Summary Section */}
          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base text-text-main flex items-center gap-2">
                <Store className="text-gold" size={18} />
                <span>حسابات المخازن والبضاعة (Warehouses Valuation)</span>
              </h3>
              <span className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full font-bold border border-emerald-500/30">
                إجمالي الأصناف: {products.length} صنف
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-card2 p-4 rounded-2xl border border-border">
                <span className="text-xs text-text-dim block mb-1">المخزن الرئيسي (Main Store)</span>
                <span className="text-xl font-black text-emerald-400 font-mono">{totalStockOpeningCost.toLocaleString()} ج.م</span>
                <span className="text-[11px] text-text-dim block mt-1">تقييم المخزون بسعر التكلفة المعتمدة</span>
              </div>
              <div className="bg-card2 p-4 rounded-2xl border border-border">
                <span className="text-xs text-text-dim block mb-1">إجمالي المشتريات المخزنية</span>
                <span className="text-xl font-black text-gold font-mono">{totalPurchases.toLocaleString()} ج.م</span>
                <span className="text-[11px] text-text-dim block mt-1">من واقع فواتير المشتريات الموردة</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EXPENSE ACCOUNTS CHART (دليل بنود المصروفات المجمعة) */}
      {activeTab === 'expense_accounts' && (
        <div className="space-y-6">
          {/* Add Category Section */}
          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="font-bold text-lg text-text-main flex items-center gap-2">
                  <FolderTree className="text-gold" />
                  <span>دليل شجرة بنود المصروفات (Chart of Expense Accounts)</span>
                </h3>
                <p className="text-xs text-text-dim mt-0.5">
                  أضف ونظّم بنود المصروفات الرئيسية هنا (كهرباء، مياه، إيجار، غاز، رواتب...)، لتظهر مباشرة في شاشة تسجيل قيود المصروفات اليومية وتُرحل حساباتها مجمعة للتقارير.
                </p>
              </div>
              <span className="text-xs bg-gold/10 text-gold px-3 py-1.5 rounded-xl border border-gold/30 font-bold">
                إجمالي البنود: {expenseCategories.length}
              </span>
            </div>

            {/* Input Form */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <input 
                type="text"
                placeholder="اسم بند المصروف الجديد (مثال: إيجار المقر، استهلاك كهرباء، غاز، صيانة...)"
                className="bg-card2 border border-border p-3 rounded-2xl flex-1 text-sm font-bold text-text-main focus:border-gold focus:outline-none"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }}
              />
              <button 
                onClick={() => handleAddCategory()}
                className="bg-gold hover:bg-gold2 text-white px-6 py-3 rounded-2xl font-bold text-xs shadow flex items-center justify-center gap-2 transition-all active:scale-95 whitespace-nowrap"
              >
                <Plus size={16} />
                <span>إضافة البند للشجرة</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div className="pt-2 border-t border-border/50">
              <label className="text-[11px] text-text-dim block mb-2 font-bold">بنود مقترحة جاهزة للإضافة السريعة:</label>
              <div className="flex flex-wrap gap-1.5">
                {commonPresets.map(preset => {
                  const alreadyExists = expenseCategories.some(c => c.name === preset);
                  return (
                    <button
                      key={preset}
                      disabled={alreadyExists}
                      onClick={() => handleAddCategory(preset)}
                      className={`text-xs px-2.5 py-1 rounded-xl font-bold border transition-all ${
                        alreadyExists 
                          ? 'bg-card2/50 text-text-dim/50 border-border/40 cursor-not-allowed'
                          : 'bg-card2 text-text-dim hover:text-gold hover:border-gold/50 border-border'
                      }`}
                    >
                      {alreadyExists ? `✓ ${preset}` : `+ ${preset}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Aggregated Categories Grid / Table */}
          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-bold text-base text-text-main flex items-center gap-2">
                <Tag size={16} className="text-gold" />
                <span>أرصدة البنود المجمعة والمرحلة (إجمالي الصرف والقيود)</span>
              </h3>
              <div className="text-xs font-bold text-danger font-mono">
                إجمالي المصروفات الكلية: {totalExpenses.toLocaleString()} ج.م
              </div>
            </div>

            {expenseCategories.length === 0 ? (
              <div className="text-center py-10 text-text-dim">
                لا توجد بنود مصروفات مسجلة بعد. استخدم النموذج أعلاه أو البنود المقترحة للإضافة.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {expenseCategories.map(cat => {
                  const stat = categoryStatsMap.get(cat.name) || { total: 0, count: 0 };
                  const percentage = totalExpenses > 0 ? ((stat.total / totalExpenses) * 100).toFixed(1) : '0';
                  const isEditing = editingCatId === cat.id;

                  return (
                    <div 
                      key={cat.id || cat.name} 
                      className="bg-card2 p-4 rounded-2xl border border-border hover:border-gold/40 transition-all flex flex-col justify-between space-y-3"
                    >
                      <div>
                        {isEditing ? (
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              className="bg-card border border-gold p-1.5 rounded-xl text-xs font-bold flex-1"
                              value={editingCatName}
                              onChange={e => setEditingCatName(e.target.value)}
                            />
                            <button 
                              onClick={() => handleUpdateCategory(cat.id)}
                              className="bg-gold text-white px-3 py-1 rounded-xl text-xs font-bold"
                            >
                              حفظ
                            </button>
                            <button 
                              onClick={() => setEditingCatId(null)}
                              className="bg-card text-text-dim px-2 py-1 rounded-xl text-xs"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm text-text-main flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-gold inline-block"></span>
                              <span>{cat.name}</span>
                            </h4>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingCatId(cat.id);
                                  setEditingCatName(cat.name);
                                }}
                                title="تعديل اسم البند"
                                className="text-text-dim hover:text-gold p-1"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                title="حذف البند"
                                className="text-text-dim hover:text-danger p-1"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="mt-2.5 flex justify-between items-baseline">
                          <span className="text-xs text-text-dim">إجمالي المنصرف:</span>
                          <span className="text-lg font-black text-danger font-mono">
                            {stat.total.toLocaleString()} ج.م
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-text-dim mb-1">
                            <span>{stat.count} قيد مرحل</span>
                            <span>{percentage}% من الإجمالي</span>
                          </div>
                          <div className="w-full bg-card h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="bg-danger h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(Number(percentage), 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedCategoryFilter(cat.name);
                          setActiveTab('expenses');
                        }}
                        className="w-full bg-card hover:bg-gold/10 hover:border-gold/30 border border-border text-xs text-text-main font-bold py-1.5 rounded-xl flex items-center justify-center gap-1 transition-all"
                      >
                        <BookOpen size={12} className="text-gold" />
                        <span>استعراض كشف قيود البند ({stat.count})</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: OPENING BALANCES HUB */}
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

      {/* TAB 4: EXPENSES JOURNAL & DETAILED ENTRIES */}
      {activeTab === 'expenses' && (
        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-border pb-3">
            <div>
              <h3 className="font-bold text-lg text-text-main flex items-center gap-2">
                <BookOpen className="text-danger" />
                <span>دفتر يومية قيود المصروفات المرحلة</span>
              </h3>
              {selectedCategoryFilter && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gold font-bold">فلترة حسب البند: {selectedCategoryFilter}</span>
                  <button 
                    onClick={() => setSelectedCategoryFilter(null)}
                    className="text-[11px] text-text-dim hover:text-danger underline"
                  >
                    (عرض كل القيود)
                  </button>
                </div>
              )}
            </div>

            <div className="text-left">
              <span className="font-black text-danger text-lg font-mono">
                الإجمالي: {displayedExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString()} ج.م
              </span>
              <span className="text-xs text-text-dim block">({displayedExpenses.length} قيد مسجل)</span>
            </div>
          </div>

          {displayedExpenses.length === 0 ? (
            <p className="text-center text-text-dim py-8">لا توجد مصروفات مسجلة في هذا العرض</p>
          ) : (
            <div className="space-y-2.5">
              {displayedExpenses.map(e => (
                <div 
                  key={e.id} 
                  onClick={() => setSelectedJournalEntry({
                    id: `exp_${e.id}`,
                    type: 'expense',
                    rawId: e.id,
                    date: e.date,
                    title: `مصروفات: ${e.category || (e as any).title || 'مصروف متنوع'}`,
                    category: e.category,
                    amount: e.amount,
                    notes: e.notes,
                    isCreditOrDebit: 'out'
                  })}
                  className="bg-card2 p-4 rounded-2xl border border-border flex justify-between items-center hover:border-gold/40 cursor-pointer transition-all group"
                  title="اضغط لمراجعة وتعديل قيد المصروف"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-text-main">{e.category || (e as any).title || 'مصروف'}</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                        مرحل للخزينة
                      </span>
                    </div>
                    <p className="text-xs text-text-dim">
                      {new Date(e.date).toLocaleDateString('ar-EG')} - {new Date(e.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      {e.notes ? ` | البيان: ${e.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right font-black text-danger font-mono text-base whitespace-nowrap">
                      {Number(e.amount || 0).toLocaleString()} ج.م
                    </div>
                    <button
                      type="button"
                      className="bg-gold/10 group-hover:bg-gold text-gold group-hover:text-white border border-gold/30 px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1"
                    >
                      <Eye size={13} />
                      <span>تعديل</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: PURCHASES LIST */}
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

      {/* Treasury & Warehouse Modal */}
      <TreasuryWarehouseModal 
        isOpen={isTreasuryModalOpen}
        onClose={() => setIsTreasuryModalOpen(false)}
        onUpdate={loadAccountingData}
      />

      {/* Journal Entry Review & Edit Modal */}
      <JournalEntryEditModal
        entry={selectedJournalEntry}
        isOpen={!!selectedJournalEntry}
        onClose={() => setSelectedJournalEntry(null)}
        onSaved={loadAccountingData}
      />
    </div>
  );
}


