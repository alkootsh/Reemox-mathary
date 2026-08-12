import React, { useState, useMemo, useEffect } from 'react';
import { Purchase, Sale, Product, Expense, Customer, Supplier, BusinessType, Branch } from '../types/types';
import { deleteSale, deletePurchase, getUserPreferences } from '../lib/firestoreService';
import { useTenant } from '../context/TenantContext';
import ColumnManagerModal from './ColumnManagerModal';
import Toast from './Toast';
import { playSuccessSound, playWarningSound } from '../lib/sound';
import { 
  SALES_COLUMNS, 
  SALES_DEFAULT_VISIBLE,
  PURCHASES_COLUMNS,
  PURCHASES_DEFAULT_VISIBLE,
  SHIFTS_COLUMNS,
  SHIFTS_DEFAULT_VISIBLE
} from '../lib/columns';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Printer, 
  Download, 
  Activity, 
  Sparkles, 
  Clock, 
  Layers, 
  Wallet, 
  DollarSign, 
  Percent, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  X,
  RotateCcw,
  Eye,
  PackageCheck,
  Truck,
  Receipt,
  Search,
  Package
} from 'lucide-react';
import FinancialRatiosCard, { FinancialRatiosData } from './reports/FinancialRatiosCard';
import AbcAnalysisCard from './reports/AbcAnalysisCard';
import PeakHoursChart from './reports/PeakHoursChart';
import CategoryBreakdown from './reports/CategoryBreakdown';
import CashFlowCard, { CashFlowData } from './reports/CashFlowCard';
import IncomeStatementModal from './reports/IncomeStatementModal';
import SalesCharts from './reports/SalesCharts';
import ItemLedger from './ItemLedger';

interface Props {
  purchases?: Purchase[];
  sales?: Sale[];
  products?: Product[];
  expenses?: Expense[];
  customers?: Customer[];
  suppliers?: Supplier[];
  branches?: Branch[];
  setSales?: React.Dispatch<React.SetStateAction<Sale[]>>;
  onSaleDeleted?: (saleId: string) => void;
  setPurchases?: React.Dispatch<React.SetStateAction<Purchase[]>>;
  onPurchaseDeleted?: (purchaseId: string) => void;
}

export type ReportTab = 
  | 'overview' 
  | 'analytics' 
  | 'abc' 
  | 'peakhours' 
  | 'categories' 
  | 'cashflow' 
  | 'sales' 
  | 'purchases'
  | 'products' 
  | 'customers' 
  | 'suppliers' 
  | 'expenses' 
  | 'inventory' 
  | 'item_ledger'
  | 'tax'
  | 'advanced';

type DatePreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'custom';

const COLORS = ['#F59E0B', '#10B981', '#38BDF8', '#818CF8', '#F43F5E', '#EC4899', '#8B5CF6', '#14B8A6'];

export default function Reports({
  purchases = [],
  sales = [],
  products = [],
  expenses = [],
  customers = [],
  suppliers = [],
  branches = [],
  setSales,
  onSaleDeleted,
  setPurchases,
  onPurchaseDeleted
}: Props) {
  const { companyId } = useTenant();
  const [localSales, setLocalSales] = useState<Sale[]>(sales || []);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [isDeletingSale, setIsDeletingSale] = useState(false);

  const [localPurchases, setLocalPurchases] = useState<Purchase[]>(purchases || []);
  const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null);
  const [isDeletingPurchase, setIsDeletingPurchase] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  useEffect(() => {
    setLocalSales(sales || []);
  }, [sales]);

  useEffect(() => {
    setLocalPurchases(purchases || []);
  }, [purchases]);

  const confirmDeleteSale = async () => {
    if (!saleToDelete) return;
    try {
      setIsDeletingSale(true);
      await deleteSale(saleToDelete.id, companyId);
      setLocalSales(prev => prev.filter(s => s.id !== saleToDelete.id));
      if (setSales) {
        setSales(prev => prev.filter(s => s.id !== saleToDelete.id));
      }
      if (onSaleDeleted) {
        onSaleDeleted(saleToDelete.id);
      }
      setToast({ 
        message: `تم حذف الفاتورة رقم #${saleToDelete.invoiceNumber || saleToDelete.id.slice(-8)} بنجاح وإرجاع كافة الكميات للمخزن.`, 
        type: 'success' 
      });
      playSuccessSound();
      setSaleToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete sale:', err);
      setToast({ 
        message: `فشل حذف الفاتورة: ${err?.message || 'خطأ أثناء تنفيذ العملية'}`, 
        type: 'error' 
      });
      playWarningSound();
    } finally {
      setIsDeletingSale(false);
    }
  };

  const confirmDeletePurchase = async () => {
    if (!purchaseToDelete) return;
    try {
      setIsDeletingPurchase(true);
      await deletePurchase(purchaseToDelete.id, companyId);
      setLocalPurchases(prev => prev.filter(p => p.id !== purchaseToDelete.id));
      if (setPurchases) {
        setPurchases(prev => prev.filter(p => p.id !== purchaseToDelete.id));
      }
      if (onPurchaseDeleted) {
        onPurchaseDeleted(purchaseToDelete.id);
      }
      setToast({ 
        message: `تم حذف فاتورة المشتريات رقم #${purchaseToDelete.purchaseNumber || purchaseToDelete.invoiceNumber || purchaseToDelete.id.slice(-8)} بنجاح، وتعديل كميات المخزن ورصيد المورد.`, 
        type: 'success' 
      });
      playSuccessSound();
      setPurchaseToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete purchase:', err);
      setToast({ 
        message: `فشل حذف فاتورة المشتريات: ${err?.message || 'خطأ أثناء تنفيذ العملية'}`, 
        type: 'error' 
      });
      playWarningSound();
    } finally {
      setIsDeletingPurchase(false);
    }
  };

  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [isIncomeStatementOpen, setIsIncomeStatementOpen] = useState<boolean>(false);

  // Advanced Filters State
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedCashierName, setSelectedCashierName] = useState<string>('all');
  const [minInvoiceValue, setMinInvoiceValue] = useState<string>('');
  const [maxInvoiceValue, setMaxInvoiceValue] = useState<string>('');
  const [selectedCustomerSupplierId, setSelectedCustomerSupplierId] = useState<string>('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  // Column Customization State for Report Tables (Sales, Purchases & Shifts)
  const currentUserStr = localStorage.getItem('currentUser');
  const userObj = currentUserStr ? JSON.parse(currentUserStr) : null;
  const userEmail = userObj?.email || userObj?.username || 'admin';

  const [salesVisibleKeys, setSalesVisibleKeys] = useState<string[]>(SALES_DEFAULT_VISIBLE);
  const [salesOrderedKeys, setSalesOrderedKeys] = useState<string[]>(() => SALES_COLUMNS.map(c => c.key));
  const [showSalesColModal, setShowSalesColModal] = useState<boolean>(false);

  const [purchasesVisibleKeys, setPurchasesVisibleKeys] = useState<string[]>(PURCHASES_DEFAULT_VISIBLE);
  const [purchasesOrderedKeys, setPurchasesOrderedKeys] = useState<string[]>(() => PURCHASES_COLUMNS.map(c => c.key));
  const [showPurchasesColModal, setShowPurchasesColModal] = useState<boolean>(false);

  const [shiftsVisibleKeys, setShiftsVisibleKeys] = useState<string[]>(SHIFTS_DEFAULT_VISIBLE);
  const [shiftsOrderedKeys, setShiftsOrderedKeys] = useState<string[]>(() => SHIFTS_COLUMNS.map(c => c.key));
  const [showShiftsColModal, setShowShiftsColModal] = useState<boolean>(false);

  useEffect(() => {
    async function fetchPrefs() {
      try {
        const salesPrefs = await getUserPreferences(userEmail, 'sales');
        if (salesPrefs && salesPrefs.visible && salesPrefs.order) {
          setSalesVisibleKeys(salesPrefs.visible);
          setSalesOrderedKeys(salesPrefs.order);
        }

        const purchPrefs = await getUserPreferences(userEmail, 'purchases');
        if (purchPrefs && purchPrefs.visible && purchPrefs.order) {
          setPurchasesVisibleKeys(purchPrefs.visible);
          setPurchasesOrderedKeys(purchPrefs.order);
        }
        
        const shiftsPrefs = await getUserPreferences(userEmail, 'shifts');
        if (shiftsPrefs && shiftsPrefs.visible && shiftsPrefs.order) {
          setShiftsVisibleKeys(shiftsPrefs.visible);
          setShiftsOrderedKeys(shiftsPrefs.order);
        }
      } catch (err) {
        console.warn("Failed to fetch column preferences on mount", err);
      }
    }
    fetchPrefs();
  }, [userEmail]);

  // Fast Product Lookup Map for Cost Calculation
  const productsMap = useMemo(() => {
    const map = new Map<string, Product>();
    (products || []).forEach(p => {
      if (p && p.id) map.set(p.id, p);
    });
    return map;
  }, [products]);

  // Derived unique cashier lists from sales
  const uniqueCashiers = useMemo(() => {
    const names = new Set<string>();
    (localSales || []).forEach(s => {
      if (s && s.cashierName) names.add(s.cashierName);
    });
    return Array.from(names);
  }, [localSales]);

  // Derived unique category lists from products
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    (products || []).forEach(p => {
      if (p && p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [products]);

  // Compute Active Date Range
  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    if (datePreset === 'all') return { start: null, end: null };

    if (datePreset === 'today') {
      return { start: todayStr, end: todayStr };
    }

    if (datePreset === 'yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = y.toISOString().split('T')[0];
      return { start: yStr, end: yStr };
    }

    if (datePreset === 'week') {
      const w = new Date(now);
      w.setDate(w.getDate() - 7);
      return { start: w.toISOString().split('T')[0], end: todayStr };
    }

    if (datePreset === 'month') {
      const mStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      return { start: mStart, end: todayStr };
    }

    if (datePreset === 'lastMonth') {
      const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      return { start: lmStart, end: lmEnd };
    }

    if (datePreset === 'custom') {
      return { start: startDate || null, end: endDate || null };
    }

    return { start: null, end: null };
  }, [datePreset, startDate, endDate]);

  // Helper date checker
  const isDateInRange = (dateStr?: string) => {
    if (!dateStr) return true;
    if (!dateRange.start && !dateRange.end) return true;
    const d = dateStr.split('T')[0];
    if (dateRange.start && d < dateRange.start) return false;
    if (dateRange.end && d > dateRange.end) return false;
    return true;
  };

  // Filtered Datasets with advanced criteria
  const filteredSales = useMemo(() => {
    return (localSales || []).filter(s => {
      if (!s) return false;
      if (!isDateInRange(s.date)) return false;
      
      // Payment Method
      if (selectedPaymentMethod !== 'all') {
        const rawMethod = (s.paymentMethod || (s.payments && s.payments[0]?.method) || 'cash').toLowerCase();
        let normalized = rawMethod;
        if (rawMethod.includes('cash') || !rawMethod) normalized = 'cash';
        else if (rawMethod.includes('credit') || rawMethod.includes('deferred') || rawMethod.includes('unpaid')) normalized = 'credit';
        else if (rawMethod.includes('card') || rawMethod.includes('visa')) normalized = 'card';
        else if (rawMethod.includes('wallet')) normalized = 'wallet';

        if (normalized !== selectedPaymentMethod.toLowerCase()) {
          return false;
        }
      }

      // Branch
      if (selectedBranchId !== 'all' && s.branchId !== selectedBranchId) {
        return false;
      }

      // Cashier / User
      if (selectedCashierName !== 'all' && s.cashierName !== selectedCashierName) {
        return false;
      }

      // Customer
      if (selectedCustomerSupplierId !== 'all') {
        const matchesId = s.customerId === selectedCustomerSupplierId;
        const matchesName = s.customerName && s.customerName.toLowerCase().includes(selectedCustomerSupplierId.toLowerCase());
        if (!matchesId && !matchesName) {
          return false;
        }
      }

      // Category filter (if any item in sale belongs to this category)
      if (selectedCategoryId !== 'all') {
        const hasItemWithCat = s.items?.some(item => {
          const prod = productsMap.get(item.productId);
          return prod?.category === selectedCategoryId;
        });
        if (!hasItemWithCat) return false;
      }

      // Min & Max total value
      const sTotal = Number(s.finalTotal || s.total || 0);
      if (minInvoiceValue && sTotal < parseFloat(minInvoiceValue)) {
        return false;
      }
      if (maxInvoiceValue && sTotal > parseFloat(maxInvoiceValue)) {
        return false;
      }

      // Text Search Term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const cust = (s.customerName || '').toLowerCase();
        const inv = (s.invoiceNumber || s.id || '').toLowerCase();
        return cust.includes(term) || inv.includes(term);
      }
      return true;
    });
  }, [sales, dateRange, selectedPaymentMethod, searchTerm, selectedBranchId, selectedCategoryId, selectedCashierName, selectedCustomerSupplierId, minInvoiceValue, maxInvoiceValue, productsMap]);

  const filteredPurchases = useMemo(() => {
    return (localPurchases || []).filter(p => {
      if (!p) return false;
      if (!isDateInRange(p.date)) return false;

      // Payment Method
      if (selectedPaymentMethod !== 'all') {
        const pMethod = (p.paymentMethod || 'cash').toLowerCase();
        if (selectedPaymentMethod === 'cash' && pMethod !== 'cash') return false;
        if (selectedPaymentMethod === 'credit' && pMethod !== 'deferred-full' && pMethod !== 'deferred-partial' && pMethod !== 'credit') return false;
        if (selectedPaymentMethod === 'deferred-full' && pMethod !== 'deferred-full') return false;
        if (selectedPaymentMethod === 'deferred-partial' && pMethod !== 'deferred-partial') return false;
      }

      // Branch
      if (selectedBranchId !== 'all' && p.branchId !== selectedBranchId) {
        return false;
      }

      // Supplier
      if (selectedCustomerSupplierId !== 'all') {
        const matchesId = p.supplierId === selectedCustomerSupplierId;
        const matchesName = p.supplierName && p.supplierName.toLowerCase().includes(selectedCustomerSupplierId.toLowerCase());
        if (!matchesId && !matchesName) {
          return false;
        }
      }

      // Min & Max total value
      const pTotal = Number(p.total || 0);
      if (minInvoiceValue && pTotal < parseFloat(minInvoiceValue)) {
        return false;
      }
      if (maxInvoiceValue && pTotal > parseFloat(maxInvoiceValue)) {
        return false;
      }

      // Text Search Term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const supp = (p.supplierName || '').toLowerCase();
        const invNum = (p.invoiceNumber || '').toLowerCase();
        const pNum = (p.purchaseNumber || p.id || '').toLowerCase();
        const notes = (p.notes || '').toLowerCase();
        const hasItemMatch = Array.isArray(p.items) && p.items.some(i => (i.productName || '').toLowerCase().includes(term));
        if (!supp.includes(term) && !invNum.includes(term) && !pNum.includes(term) && !notes.includes(term) && !hasItemMatch) {
          return false;
        }
      }

      return true;
    });
  }, [localPurchases, dateRange, selectedPaymentMethod, selectedBranchId, selectedCustomerSupplierId, minInvoiceValue, maxInvoiceValue, searchTerm]);

  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter(e => {
      if (!e) return false;
      if (!isDateInRange(e.date)) return false;

      // Branch
      if (selectedBranchId !== 'all' && e.branchId !== selectedBranchId) {
        return false;
      }

      // Min & Max total value
      const eTotal = Number(e.amount || 0);
      if (minInvoiceValue && eTotal < parseFloat(minInvoiceValue)) {
        return false;
      }
      if (maxInvoiceValue && eTotal > parseFloat(maxInvoiceValue)) {
        return false;
      }

      return true;
    });
  }, [expenses, dateRange, selectedBranchId, minInvoiceValue, maxInvoiceValue]);

  // Helper to calculate total cost of an item safely
  const getItemCost = (item: any) => {
    if (!item) return 0;
    if (item.unitCost !== undefined && item.unitCost !== null && !isNaN(item.unitCost)) {
      return Number(item.unitCost);
    }
    if (item.product && item.product.cost !== undefined && item.product.cost !== null && !isNaN(item.product.cost)) {
      return Number(item.product.cost);
    }
    if (item.productId) {
      const matched = productsMap.get(item.productId);
      if (matched && matched.cost !== undefined && matched.cost !== null && !isNaN(matched.cost)) {
        return Number(matched.cost);
      }
    }
    return 0;
  };

  // Core Financial Aggregations
  const financialSummary = useMemo(() => {
    let grossSales = 0;
    let totalTaxCollected = 0;
    let totalDiscount = 0;
    let totalCogs = 0;
    let totalPaidInCash = 0;
    let totalPaidInCredit = 0;
    let totalPaidInCard = 0;
    let totalPaidInWallet = 0;

    filteredSales.forEach(sale => {
      const saleFinal = Number(sale.finalTotal || sale.total || 0);
      grossSales += saleFinal;
      totalTaxCollected += Number(sale.taxAmount || sale.tax || 0);
      totalDiscount += Number(sale.discountValue || sale.discount || 0);

      const pMethod = (sale.paymentMethod || 'cash').toLowerCase();
      if (pMethod === 'cash') totalPaidInCash += saleFinal;
      else if (pMethod === 'credit') totalPaidInCredit += saleFinal;
      else if (pMethod === 'card') totalPaidInCard += saleFinal;
      else if (pMethod === 'wallet') totalPaidInWallet += saleFinal;

      // Calculate cost for this sale
      if (Array.isArray(sale.items)) {
        sale.items.forEach(item => {
          if (!item) return;
          const cost = getItemCost(item);
          const qty = Number(item.quantity || 0);
          totalCogs += cost * qty;
        });
      }
    });

    const totalPurchasesAmount = filteredPurchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
    const totalExpensesAmount = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const grossProfit = Math.round((grossSales - totalCogs) * 100) / 100;
    const netProfit = Math.round((grossProfit - totalExpensesAmount) * 100) / 100;
    const profitMargin = grossSales > 0 ? Math.round((netProfit / grossSales) * 1000) / 10 : 0;

    // Inventory Totals
    let inventoryCostValue = 0;
    let inventorySaleValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let expiredCount = 0;
    const today = new Date().toISOString().split('T')[0];

    (products || []).forEach(p => {
      if (!p) return;
      const qty = Number(p.quantity || 0);
      const cost = Number(p.cost || 0);
      const price = Number(p.price || 0);
      const threshold = Number(p.lowStockThreshold || 5);

      inventoryCostValue += qty * cost;
      inventorySaleValue += qty * price;

      if (qty <= 0) outOfStockCount++;
      else if (qty <= threshold) lowStockCount++;

      if (p.expirationDate && p.expirationDate <= today) {
        expiredCount++;
      }
    });

    // Customer & Supplier Debts
    const totalCustomerDebt = (customers || []).reduce((sum, c) => sum + Number(c.currentBalance || c.openingBalance || 0), 0);
    const totalSupplierDebt = (suppliers || []).reduce((sum, s) => sum + Number(s.currentBalance || s.openingBalance || 0), 0);

    return {
      grossSales: Math.round(grossSales * 100) / 100,
      totalCogs: Math.round(totalCogs * 100) / 100,
      grossProfit,
      totalExpenses: Math.round(totalExpensesAmount * 100) / 100,
      netProfit,
      profitMargin,
      totalPurchases: Math.round(totalPurchasesAmount * 100) / 100,
      totalTaxCollected: Math.round(totalTaxCollected * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      totalCustomerDebt: Math.round(totalCustomerDebt * 100) / 100,
      totalSupplierDebt: Math.round(totalSupplierDebt * 100) / 100,
      inventoryCostValue: Math.round(inventoryCostValue * 100) / 100,
      inventorySaleValue: Math.round(inventorySaleValue * 100) / 100,
      potentialProfit: Math.round((inventorySaleValue - inventoryCostValue) * 100) / 100,
      lowStockCount,
      outOfStockCount,
      expiredCount,
      paymentsBreakdown: {
        cash: totalPaidInCash,
        credit: totalPaidInCredit,
        card: totalPaidInCard,
        wallet: totalPaidInWallet
      }
    };
  }, [filteredSales, filteredPurchases, filteredExpenses, products, customers, suppliers, productsMap]);

  // Product-level Profitability Analysis
  const productProfitability = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      category: string;
      qtySold: number;
      revenue: number;
      cost: number;
      profit: number;
    }>();

    filteredSales.forEach(sale => {
      if (!Array.isArray(sale.items)) return;
      sale.items.forEach(item => {
        if (!item || !item.productId) return;
        const pId = item.productId;
        const name = item.name || productsMap.get(pId)?.name || 'صنف غير معروف';
        const category = productsMap.get(pId)?.category || 'عام';
        const qty = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        const cost = getItemCost(item);
        const itemRevenue = price * qty;
        const itemCost = cost * qty;
        const itemProfit = itemRevenue - itemCost;

        if (map.has(pId)) {
          const existing = map.get(pId)!;
          existing.qtySold += qty;
          existing.revenue += itemRevenue;
          existing.cost += itemCost;
          existing.profit += itemProfit;
        } else {
          map.set(pId, {
            id: pId,
            name,
            category,
            qtySold: qty,
            revenue: itemRevenue,
            cost: itemCost,
            profit: itemProfit
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => b.profit - a.profit);
  }, [filteredSales, productsMap]);

  // Expense Categorization
  const expenseCategoriesData = useMemo(() => {
    const map = new Map<string, number>();
    filteredExpenses.forEach(exp => {
      const cat = exp.category || 'مصروفات عامة';
      const amt = Number(exp.amount || 0);
      map.set(cat, (map.get(cat) || 0) + amt);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredExpenses]);

  // Sales and Profit Trend Chart Data (Grouped by Date)
  const salesChartData = useMemo(() => {
    const dateMap = new Map<string, { date: string; sales: number; profit: number; cogs: number }>();

    filteredSales.forEach(s => {
      const d = (s.date || '').split('T')[0] || 'غير محدد';
      const saleTotal = Number(s.finalTotal || s.total || 0);
      let saleCost = 0;
      if (Array.isArray(s.items)) {
        s.items.forEach(item => {
          saleCost += getItemCost(item) * Number(item.quantity || 0);
        });
      }
      const saleProfit = saleTotal - saleCost;

      if (dateMap.has(d)) {
        const row = dateMap.get(d)!;
        row.sales += saleTotal;
        row.profit += saleProfit;
        row.cogs += saleCost;
      } else {
        dateMap.set(d, {
          date: d,
          sales: saleTotal,
          profit: saleProfit,
          cogs: saleCost
        });
      }
    });

    const result = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    
    // If no sales in range, provide a friendly default data point
    if (result.length === 0) {
      return [{ date: 'اليوم', sales: 0, profit: 0, cogs: 0 }];
    }
    return result;
  }, [filteredSales, productsMap]);

  // Payment Breakdown for Pie Chart
  const paymentChartData = useMemo(() => {
    const { cash, credit, card, wallet } = financialSummary.paymentsBreakdown;
    return [
      { name: 'نقدي (Cash)', value: cash },
      { name: 'آجل (Credit)', value: credit },
      { name: 'شبكة / كارت', value: card },
      { name: 'محافظ إلكترونية', value: wallet }
    ].filter(item => item.value > 0);
  }, [financialSummary]);

  // Purchases Executive Summary Metrics
  const purchasesSummary = useMemo(() => {
    let totalPurchases = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let totalItemsCount = 0;

    filteredPurchases.forEach(p => {
      const tot = Number(p.total || 0);
      const pd = Number(p.paidAmount || (p.paymentMethod === 'cash' ? tot : 0));
      const rem = Math.max(0, tot - pd);
      const itemsQty = Array.isArray(p.items) ? p.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0) : 0;

      totalPurchases += tot;
      totalPaid += pd;
      totalRemaining += rem;
      totalItemsCount += itemsQty;
    });

    return {
      totalPurchases: Math.round(totalPurchases * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalRemaining: Math.round(totalRemaining * 100) / 100,
      invoicesCount: filteredPurchases.length,
      totalItemsCount,
      avgInvoiceValue: filteredPurchases.length > 0 ? Math.round(totalPurchases / filteredPurchases.length) : 0
    };
  }, [filteredPurchases]);

  // Purchases Trend Chart Data (Grouped by Date)
  const purchasesChartData = useMemo(() => {
    const dateMap = new Map<string, { date: string; total: number; paid: number; remaining: number; count: number }>();

    filteredPurchases.forEach(p => {
      const d = (p.date || '').split('T')[0] || 'غير محدد';
      const pTotal = Number(p.total || 0);
      const pPaid = Number(p.paidAmount || (p.paymentMethod === 'cash' ? pTotal : 0));
      const pRemaining = Math.max(0, pTotal - pPaid);

      if (dateMap.has(d)) {
        const row = dateMap.get(d)!;
        row.total += pTotal;
        row.paid += pPaid;
        row.remaining += pRemaining;
        row.count += 1;
      } else {
        dateMap.set(d, {
          date: d,
          total: pTotal,
          paid: pPaid,
          remaining: pRemaining,
          count: 1
        });
      }
    });

    const result = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    if (result.length === 0) {
      return [{ date: 'اليوم', total: 0, paid: 0, remaining: 0, count: 0 }];
    }
    return result;
  }, [filteredPurchases]);

  // Top Supplier purchases breakdown
  const supplierPurchasesBreakdown = useMemo(() => {
    const suppMap = new Map<string, { id: string; name: string; total: number; invoicesCount: number }>();

    filteredPurchases.forEach(p => {
      const suppId = p.supplierId || 'general';
      const suppName = p.supplierName || 'مورد عام / نقدي';
      const total = Number(p.total || 0);

      if (suppMap.has(suppId)) {
        const entry = suppMap.get(suppId)!;
        entry.total += total;
        entry.invoicesCount += 1;
      } else {
        suppMap.set(suppId, {
          id: suppId,
          name: suppName,
          total,
          invoicesCount: 1
        });
      }
    });

    return Array.from(suppMap.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [filteredPurchases]);

  // Date Range Human Label
  const dateRangeLabel = useMemo(() => {
    if (datePreset === 'all') return 'كافة السجلات المسجلة بالنظام';
    if (datePreset === 'today') return `اليوم (${new Date().toISOString().split('T')[0]})`;
    if (datePreset === 'yesterday') return 'أمس';
    if (datePreset === 'week') return 'آخر 7 أيام';
    if (datePreset === 'month') return `هذا الشهر (${new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })})`;
    if (datePreset === 'lastMonth') return 'الشهر السابق';
    if (datePreset === 'custom') return `من ${startDate || 'البداية'} إلى ${endDate || 'اليوم'}`;
    return 'فترة محددة';
  }, [datePreset, startDate, endDate]);

  // Comparative Period Metrics (Period-over-Period Growth %)
  const periodComparison = useMemo(() => {
    const now = new Date();
    let prevStart: string | null = null;
    let prevEnd: string | null = null;

    if (datePreset === 'today') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      prevStart = y.toISOString().split('T')[0];
      prevEnd = prevStart;
    } else if (datePreset === 'yesterday') {
      const db = new Date(now);
      db.setDate(db.getDate() - 2);
      prevStart = db.toISOString().split('T')[0];
      prevEnd = prevStart;
    } else if (datePreset === 'week') {
      const wEnd = new Date(now);
      wEnd.setDate(wEnd.getDate() - 8);
      const wStart = new Date(now);
      wStart.setDate(wStart.getDate() - 14);
      prevStart = wStart.toISOString().split('T')[0];
      prevEnd = wEnd.toISOString().split('T')[0];
    } else if (datePreset === 'month') {
      const lmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      prevStart = lmStart;
      prevEnd = lmEnd;
    }

    if (!prevStart || !prevEnd) {
      return {
        hasComparison: false,
        salesGrowth: 0,
        profitGrowth: 0,
        invoicesGrowth: 0,
        prevSales: 0,
        prevProfit: 0
      };
    }

    const prevSalesList = (localSales || []).filter(s => {
      if (!s || !s.date) return false;
      const d = s.date.split('T')[0];
      return d >= prevStart! && d <= prevEnd!;
    });

    let prevSalesTotal = 0;
    let prevCogsTotal = 0;
    prevSalesList.forEach(s => {
      const t = Number(s.finalTotal || s.total || 0);
      prevSalesTotal += t;
      if (Array.isArray(s.items)) {
        s.items.forEach(item => {
          prevCogsTotal += getItemCost(item) * Number(item.quantity || 0);
        });
      }
    });

    const prevProfitTotal = prevSalesTotal - prevCogsTotal;
    const currentSalesTotal = financialSummary.grossSales;
    const currentProfitTotal = financialSummary.netProfit;

    const salesGrowth = prevSalesTotal > 0 
      ? Math.round(((currentSalesTotal - prevSalesTotal) / prevSalesTotal) * 1000) / 10 
      : 0;
    const profitGrowth = prevProfitTotal > 0 
      ? Math.round(((currentProfitTotal - prevProfitTotal) / prevProfitTotal) * 1000) / 10 
      : 0;
    const invoicesGrowth = prevSalesList.length > 0 
      ? Math.round(((filteredSales.length - prevSalesList.length) / prevSalesList.length) * 1000) / 10 
      : 0;

    return {
      hasComparison: true,
      salesGrowth,
      profitGrowth,
      invoicesGrowth,
      prevSales: Math.round(prevSalesTotal),
      prevProfit: Math.round(prevProfitTotal)
    };
  }, [datePreset, sales, financialSummary, filteredSales]);

  // Financial & Operational Ratios Data
  const financialRatiosData: FinancialRatiosData = useMemo(() => {
    const grossSales = financialSummary.grossSales;
    const totalCogs = financialSummary.totalCogs;
    const grossProfit = financialSummary.grossProfit;
    const grossMargin = grossSales > 0 ? Math.round((grossProfit / grossSales) * 1000) / 10 : 0;
    const totalExpenses = financialSummary.totalExpenses;
    const netProfit = financialSummary.netProfit;
    const netMargin = financialSummary.profitMargin;
    const markupPercentage = totalCogs > 0 ? Math.round((grossProfit / totalCogs) * 1000) / 10 : 0;
    const expenseRatio = grossSales > 0 ? Math.round((totalExpenses / grossSales) * 1000) / 10 : 0;
    const inventoryCostValue = financialSummary.inventoryCostValue;
    const inventoryTurnover = inventoryCostValue > 0 ? Math.round((totalCogs / inventoryCostValue) * 100) / 100 : 0;
    const daysSalesInInventory = inventoryTurnover > 0 ? Math.round(365 / inventoryTurnover) : 0;
    const totalInvoices = filteredSales.length;
    const totalUnitsSold = filteredSales.reduce((sum, s) => sum + (Array.isArray(s.items) ? s.items.reduce((s2, i) => s2 + (Number(i.quantity) || 0), 0) : 0), 0);
    const averageOrderValue = totalInvoices > 0 ? Math.round(grossSales / totalInvoices) : 0;
    const unitsPerTransaction = totalInvoices > 0 ? Math.round((totalUnitsSold / totalInvoices) * 10) / 10 : 0;
    const breakEvenRevenue = grossMargin > 0 ? Math.round(totalExpenses / (grossMargin / 100)) : 0;
    const creditSalesRatio = grossSales > 0 ? Math.round((financialSummary.paymentsBreakdown.credit / grossSales) * 100) : 0;
    const cashCollectionRatio = grossSales > 0 ? Math.round(((grossSales - financialSummary.paymentsBreakdown.credit) / grossSales) * 100) : 100;
    const gmroi = inventoryCostValue > 0 ? Math.round((grossProfit / inventoryCostValue) * 100) : 0;

    return {
      grossSales,
      totalCogs,
      grossProfit,
      grossMargin,
      totalExpenses,
      netProfit,
      netMargin,
      markupPercentage,
      expenseRatio,
      inventoryCostValue,
      inventoryTurnover,
      daysSalesInInventory,
      totalInvoices,
      averageOrderValue,
      unitsPerTransaction,
      totalUnitsSold,
      breakEvenRevenue,
      creditSalesRatio,
      cashCollectionRatio,
      gmroi
    };
  }, [financialSummary, filteredSales]);

  // Cash Flow & Liquidity Data
  const cashFlowData: CashFlowData = useMemo(() => {
    const cashSales = financialSummary.paymentsBreakdown.cash;
    const cardAndWalletSales = financialSummary.paymentsBreakdown.card + financialSummary.paymentsBreakdown.wallet;
    const customerDebtCollected = 0;
    const totalInflows = cashSales + cardAndWalletSales;

    const cashPurchases = filteredPurchases.reduce((sum, p) => {
      const paid = Number(p.paidAmount !== undefined ? p.paidAmount : (p.paymentMethod === 'cash' ? p.total : 0));
      return sum + paid;
    }, 0);

    const supplierDebtPaid = 0;
    const operatingExpenses = financialSummary.totalExpenses;
    const totalOutflows = cashPurchases + operatingExpenses;
    const netOperatingCashFlow = totalInflows - totalOutflows;

    const totalReceivables = financialSummary.totalCustomerDebt;
    const totalPayables = financialSummary.totalSupplierDebt;
    const workingCapital = financialSummary.inventoryCostValue + totalReceivables - totalPayables;

    return {
      cashSales,
      cardAndWalletSales,
      customerDebtCollected,
      totalInflows,
      cashPurchases,
      supplierDebtPaid,
      operatingExpenses,
      totalOutflows,
      netOperatingCashFlow,
      cashOnHandEstimate: netOperatingCashFlow,
      totalReceivables,
      totalPayables,
      workingCapital
    };
  }, [financialSummary, filteredPurchases]);

  // Advanced multidimensional analytics
  const advancedAnalytics = useMemo(() => {
    // 1. Group by Product (Sales & Purchases)
    const productStats = new Map<string, {
      id: string;
      name: string;
      category: string;
      soldQty: number;
      salesRevenue: number;
      purchasedQty: number;
      purchaseCost: number;
    }>();

    // Seed with existing products
    products.forEach(p => {
      productStats.set(p.id, {
        id: p.id,
        name: p.name,
        category: p.category || 'عام',
        soldQty: 0,
        salesRevenue: 0,
        purchasedQty: 0,
        purchaseCost: 0
      });
    });

    // Populate Sales
    filteredSales.forEach(sale => {
      if (!Array.isArray(sale.items)) return;
      sale.items.forEach(item => {
        if (!item || !item.productId) return;
        const pId = item.productId;
        const qty = Number(item.quantity || 0);
        const revenue = Number(item.price || 0) * qty;

        if (productStats.has(pId)) {
          const stats = productStats.get(pId)!;
          stats.soldQty += qty;
          stats.salesRevenue += revenue;
        } else {
          productStats.set(pId, {
            id: pId,
            name: item.name || 'صنف غير معرف',
            category: 'عام',
            soldQty: qty,
            salesRevenue: revenue,
            purchasedQty: 0,
            purchaseCost: 0
          });
        }
      });
    });

    // Populate Purchases
    filteredPurchases.forEach(purch => {
      if (!Array.isArray(purch.items)) return;
      purch.items.forEach(item => {
        if (!item || !item.productId) return;
        const pId = item.productId;
        const qty = Number(item.quantity || 0);
        const cost = Number(item.cost || 0) * qty;

        if (productStats.has(pId)) {
          const stats = productStats.get(pId)!;
          stats.purchasedQty += qty;
          stats.purchaseCost += cost;
        } else {
          productStats.set(pId, {
            id: pId,
            name: item.productName || 'صنف غير معرف',
            category: 'عام',
            soldQty: 0,
            salesRevenue: 0,
            purchasedQty: qty,
            purchaseCost: cost
          });
        }
      });
    });

    const productsList = Array.from(productStats.values());

    // 2. Group by Category / Groups
    const categoryStats = new Map<string, {
      name: string;
      soldQty: number;
      salesRevenue: number;
      purchasedQty: number;
      purchaseCost: number;
    }>();

    productsList.forEach(p => {
      const cat = p.category || 'عام';
      if (!categoryStats.has(cat)) {
        categoryStats.set(cat, {
          name: cat,
          soldQty: 0,
          salesRevenue: 0,
          purchasedQty: 0,
          purchaseCost: 0
        });
      }
      const catStat = categoryStats.get(cat)!;
      catStat.soldQty += p.soldQty;
      catStat.salesRevenue += p.salesRevenue;
      catStat.purchasedQty += p.purchasedQty;
      catStat.purchaseCost += p.purchaseCost;
    });

    const categoriesList = Array.from(categoryStats.values());

    // 3. Group by Cashier (Sales only)
    const cashierStats = new Map<string, {
      id: string;
      name: string;
      totalSales: number;
      invoiceCount: number;
    }>();

    filteredSales.forEach(sale => {
      const cashierId = sale.userId || 'usr-cashier';
      const cashierName = sale.userName || sale.cashierName || 'الكاشير الرئيسي';
      const total = Number(sale.finalTotal || sale.total || 0);

      if (!cashierStats.has(cashierId)) {
        cashierStats.set(cashierId, {
          id: cashierId,
          name: cashierName,
          totalSales: 0,
          invoiceCount: 0
        });
      }
      const stat = cashierStats.get(cashierId)!;
      stat.totalSales += total;
      stat.invoiceCount += 1;
    });

    const cashiersList = Array.from(cashierStats.values());

    // 4. Group by Branch (Sales & Purchases)
    const branchStats = new Map<string, {
      id: string;
      name: string;
      salesRevenue: number;
      salesInvoices: number;
      purchasesCost: number;
      purchasesInvoices: number;
    }>();

    // Map of branch ID to branch name
    const branchNames = new Map<string, string>();
    branches.forEach(b => branchNames.set(b.id, b.name));
    branchNames.set('default', 'الفرع الرئيسي');

    filteredSales.forEach(sale => {
      const bId = sale.branchId || 'default';
      const bName = branchNames.get(bId) || `فرع ${bId}`;
      const total = Number(sale.finalTotal || sale.total || 0);

      if (!branchStats.has(bId)) {
        branchStats.set(bId, {
          id: bId,
          name: bName,
          salesRevenue: 0,
          salesInvoices: 0,
          purchasesCost: 0,
          purchasesInvoices: 0
        });
      }
      const stat = branchStats.get(bId)!;
      stat.salesRevenue += total;
      stat.salesInvoices += 1;
    });

    filteredPurchases.forEach(purch => {
      const bId = purch.branchId || 'default';
      const bName = branchNames.get(bId) || `فرع ${bId}`;
      const total = Number(purch.total || 0);

      if (!branchStats.has(bId)) {
        branchStats.set(bId, {
          id: bId,
          name: bName,
          salesRevenue: 0,
          salesInvoices: 0,
          purchasesCost: 0,
          purchasesInvoices: 0
        });
      }
      const stat = branchStats.get(bId)!;
      stat.purchasesCost += total;
      stat.purchasesInvoices += 1;
    });

    const branchesList = Array.from(branchStats.values());

    return {
      productsList,
      categoriesList,
      cashiersList,
      branchesList
    };
  }, [filteredSales, filteredPurchases, products, branches]);

  // Direct CSV Exporter with Arabic BOM support
  const exportToCSV = (data: any[], filename: string, headers: { [key: string]: string }) => {
    if (!data || data.length === 0) {
      alert('لا توجد بيانات متاحة للتصدير في هذا التقرير!');
      return;
    }

    const keys = Object.keys(headers);
    const headerRow = keys.map(k => `"${headers[k]}"`).join(',');
    
    const rows = data.map(item => {
      return keys.map(k => {
        let val = item[k];
        if (val === undefined || val === null) val = '';
        if (typeof val === 'number') val = val.toString();
        return `"${val.toString().replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = '\uFEFF' + [headerRow, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-3 sm:p-6 pb-28 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header & Main Control Toolbar */}
      <div className="bg-card p-5 rounded-3xl border border-border shadow-md">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📈</span>
              <h2 className="text-xl sm:text-2xl font-black text-text-main">
                المنظومة المحاسبية والتقارير المالية الشاملة
              </h2>
            </div>
            <p className="text-xs text-text-dim mt-1">
              تحليل دقيق للإيرادات، تكلفة البضاعة المباعة (COGS)، صافي الأرباح، ديون العملاء والموردين، وتقييم حركة المخزون.
            </p>
          </div>

          {/* Action Buttons: Print, P&L Modal & Export */}
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={() => setIsIncomeStatementOpen(true)}
              className="flex-1 sm:flex-none bg-gold hover:bg-yellow-500 text-black px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-md"
              title="عرض وطباعة قائمة الدخل الرسمية المعتمدة (P&L Statement)"
            >
              <FileText className="w-3.5 h-3.5 text-black" />
              <span>قائمة الدخل الرسمية (P&L)</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-none bg-card2 hover:bg-border text-text-main border border-border px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
              title="طباعة التقرير أو حفظه كـ PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة التقرير</span>
            </button>
            <button
              onClick={() => {
                if (activeTab === 'sales') {
                  const visibleColDefs = salesOrderedKeys
                    .filter(k => salesVisibleKeys.includes(k) && k !== 'actions')
                    .map(k => SALES_COLUMNS.find(c => c.key === k))
                    .filter(Boolean) as { key: string; label: string }[];

                  const columnMapping: Record<string, string> = {};
                  visibleColDefs.forEach(c => {
                    columnMapping[c.key] = c.label;
                  });

                  const exportData = filteredSales.map(sale => {
                    const total = Number(sale.finalTotal || sale.total || 0);
                    const paid = Number(sale.paidAmount || (sale.paymentMethod === 'credit' ? 0 : total));
                    const rem = Number(sale.remainingAmount || Math.max(0, total - paid));
                    const itemCount = Array.isArray(sale.items) ? sale.items.reduce((s, i) => s + (i.quantity || 0), 0) : 0;

                    const row: Record<string, any> = {};
                    visibleColDefs.forEach(c => {
                      switch (c.key) {
                        case 'invoiceNumber': row[c.key] = sale.invoiceNumber || sale.id; break;
                        case 'date': row[c.key] = sale.date || ''; break;
                        case 'customer': row[c.key] = sale.customerName || 'عميل نقدي'; break;
                        case 'cashier': row[c.key] = sale.cashierName || sale.createdBy || 'المدير'; break;
                        case 'branch': row[c.key] = sale.branchName || 'الفرع الرئيسي'; break;
                        case 'saleType': row[c.key] = sale.saleType || 'قطاعي'; break;
                        case 'paymentMethod': row[c.key] = sale.paymentMethod || 'نقدي'; break;
                        case 'itemCount': row[c.key] = itemCount; break;
                        case 'total': row[c.key] = sale.total || total; break;
                        case 'discount': row[c.key] = sale.discount || 0; break;
                        case 'tax': row[c.key] = sale.taxAmount || 0; break;
                        case 'finalTotal': row[c.key] = total; break;
                        case 'paid': row[c.key] = paid; break;
                        case 'remaining': row[c.key] = rem; break;
                        case 'status': row[c.key] = sale.status || 'مكتمل'; break;
                        case 'shiftNumber': row[c.key] = sale.shiftNumber || '-'; break;
                        case 'notes': row[c.key] = sale.notes || ''; break;
                        default: row[c.key] = (sale as any)[c.key] ?? '';
                      }
                    });
                    return row;
                  });

                  exportToCSV(exportData, 'تقرير_المبيعات', columnMapping);
                } else if (activeTab === 'purchases') {
                  const visibleColDefs = purchasesOrderedKeys
                    .filter(k => purchasesVisibleKeys.includes(k) && k !== 'actions')
                    .map(k => PURCHASES_COLUMNS.find(c => c.key === k))
                    .filter(Boolean) as { key: string; label: string }[];

                  const columnMapping: Record<string, string> = {};
                  visibleColDefs.forEach(c => {
                    columnMapping[c.key] = c.label;
                  });

                  const exportData = filteredPurchases.map(purch => {
                    const total = Number(purch.total || 0);
                    const paid = Number(purch.paidAmount || (purch.paymentMethod === 'cash' ? total : 0));
                    const rem = Math.max(0, total - paid);
                    const itemCount = Array.isArray(purch.items) ? purch.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0) : 0;

                    const row: Record<string, any> = {};
                    visibleColDefs.forEach(c => {
                      switch (c.key) {
                        case 'purchaseNumber': row[c.key] = purch.purchaseNumber || `PUR-${purch.id.slice(-6)}`; break;
                        case 'invoiceNumber': row[c.key] = purch.invoiceNumber || '-'; break;
                        case 'date': row[c.key] = purch.date || ''; break;
                        case 'supplier': row[c.key] = purch.supplierName || 'مورد عام'; break;
                        case 'cashier': row[c.key] = 'المدير'; break;
                        case 'paymentMethod': 
                          row[c.key] = purch.paymentMethod === 'cash' ? 'نقدي' :
                                       purch.paymentMethod === 'deferred-full' ? 'آجل بالكامل' : 'آجل جزئي'; 
                          break;
                        case 'itemCount': row[c.key] = itemCount; break;
                        case 'total': row[c.key] = total; break;
                        case 'discount': row[c.key] = 0; break;
                        case 'tax': row[c.key] = (purch as any).vatAmount || 0; break;
                        case 'finalTotal': row[c.key] = total; break;
                        case 'paidAmount': row[c.key] = paid; break;
                        case 'remaining': row[c.key] = rem; break;
                        case 'status': row[c.key] = rem === 0 ? 'مسدد بالكامل' : paid > 0 ? 'مسدد جزئياً' : 'غير مسدد (آجل)'; break;
                        case 'notes': row[c.key] = purch.notes || ''; break;
                        default: row[c.key] = (purch as any)[c.key] ?? '';
                      }
                    });
                    return row;
                  });

                  exportToCSV(exportData, 'تقرير_المشتريات', columnMapping);
                } else if (activeTab === 'products') {
                  exportToCSV(productProfitability, 'تقرير_أرباح_الأصناف', {
                    name: 'اسم الصنف',
                    category: 'التصنيف',
                    qtySold: 'الكمية المباعة',
                    revenue: 'إجمالي المبيعات (ج.م)',
                    cost: 'إجمالي التكلفة (ج.م)',
                    profit: 'صافي الربح (ج.م)'
                  });
                } else if (activeTab === 'customers') {
                  exportToCSV(customers, 'ديون_العملاء', {
                    name: 'اسم العميل',
                    phone: 'الهاتف',
                    openingBalance: 'رصيد أول المدة',
                    currentBalance: 'الرصيد الحالي المستحق'
                  });
                } else {
                  exportToCSV([
                    { item: 'إجمالي المبيعات', val: financialSummary.grossSales },
                    { item: 'تكلفة المبيعات (COGS)', val: financialSummary.totalCogs },
                    { item: 'مجمل الربح', val: financialSummary.grossProfit },
                    { item: 'المصروفات التشغيلية', val: financialSummary.totalExpenses },
                    { item: 'صافي الربح النهائي', val: financialSummary.netProfit },
                    { item: 'إجمالي المشتريات', val: financialSummary.totalPurchases },
                    { item: 'ديون العملاء', val: financialSummary.totalCustomerDebt },
                    { item: 'مستحقات الموردين', val: financialSummary.totalSupplierDebt },
                    { item: 'قيمة المخزون بالتكلفة', val: financialSummary.inventoryCostValue }
                  ], 'ملخص_الأرباح_الشامل', { item: 'البند المالي', val: 'القيمة (ج.م)' });
                }
              }}
              className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
              title="تصدير جدول البيانات لملف Excel / CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير Excel (CSV)</span>
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="mt-5 pt-4 border-t border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-text-dim ml-1">الفترة الزمنية:</span>
            {(
              [
                { id: 'all', label: 'الكل' },
                { id: 'today', label: 'اليوم' },
                { id: 'yesterday', label: 'أمس' },
                { id: 'week', label: 'آخر 7 أيام' },
                { id: 'month', label: 'هذا الشهر' },
                { id: 'lastMonth', label: 'الشهر السابق' },
                { id: 'custom', label: 'مخصص 📅' }
              ] as const
            ).map(preset => (
              <button
                key={preset.id}
                onClick={() => setDatePreset(preset.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  datePreset === preset.id
                    ? 'bg-gold text-black shadow-md'
                    : 'bg-card2 text-text-dim hover:text-text-main border border-border'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-2 bg-card2 p-2 rounded-2xl border border-border text-xs w-full md:w-auto">
              <div className="flex items-center gap-1">
                <span className="text-text-dim text-[11px]">من:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-card border border-border rounded-lg px-2 py-1 text-xs text-text-main outline-none focus:border-gold"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-text-dim text-[11px]">إلى:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-card border border-border rounded-lg px-2 py-1 text-xs text-text-main outline-none focus:border-gold"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1 border-b border-border scrollbar-none">
        {(
          [
            { id: 'overview', label: 'الملخص المالي', icon: '📊' },
            { id: 'analytics', label: 'النسب والمؤشرات المالية', icon: '🧠', highlight: true },
            { id: 'abc', label: 'مصفوفة ABC وباريتو', icon: '🎯', highlight: true },
            { id: 'peakhours', label: 'أوقات الذروة', icon: '⏰' },
            { id: 'categories', label: 'هوامش الأقسام', icon: '📂' },
            { id: 'cashflow', label: 'التدفقات والسيولة', icon: '💧', highlight: true },
            { id: 'sales', label: 'تقرير المبيعات', icon: '🛒' },
            { id: 'purchases', label: 'تقرير المشتريات', icon: '📥', highlight: true },
            { id: 'products', label: 'أرباح الأصناف', icon: '📦' },
            { id: 'customers', label: 'ديون العملاء', icon: '👥' },
            { id: 'suppliers', label: 'مستحقات الموردين', icon: '🚚' },
            { id: 'expenses', label: 'تحليل المصروفات', icon: '📉' },
            { id: 'inventory', label: 'المخزون والنواقص', icon: '⚠️' },
            { id: 'item_ledger', label: 'كارت حركة الصنف', icon: '📋' },
            { id: 'tax', label: 'الإقرار الضريبي (VAT)', icon: '🧾' },
            { id: 'advanced', label: 'التحليل المتقدم والفروع', icon: '🔮', highlight: true }
          ] as const
        ).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as ReportTab)}
            className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === tab.id
                ? 'bg-gold text-black shadow-md'
                : 'bg-card text-text-dim hover:text-text-main border border-border'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: FINANCIAL OVERVIEW & PROFIT SUMMARY */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Executive KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Gross Sales */}
            <div className="bg-card p-4 rounded-3xl border border-border shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center text-text-dim text-xs font-bold mb-1">
                  <span>إجمالي المبيعات</span>
                  <span className="text-base">💵</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-text-main">
                  {financialSummary.grossSales.toLocaleString('ar-EG')} <span className="text-xs text-text-dim font-normal">ج.م</span>
                </div>
              </div>
              <div className="mt-2 pt-1.5 border-t border-border flex items-center justify-between text-[11px]">
                <span className="text-text-dim">الفواتير: <b className="text-text-main">{filteredSales.length}</b></span>
                {periodComparison.hasComparison && (
                  <span className={`flex items-center gap-0.5 font-bold ${
                    periodComparison.salesGrowth >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {periodComparison.salesGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(periodComparison.salesGrowth)}%
                  </span>
                )}
              </div>
            </div>

            {/* COGS (Cost of Goods Sold) */}
            <div className="bg-card p-4 rounded-3xl border border-border shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center text-text-dim text-xs font-bold mb-1">
                  <span>تكلفة البضاعة المباعة (COGS)</span>
                  <span className="text-base">📦</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-500">
                  {financialSummary.totalCogs.toLocaleString('ar-EG')} <span className="text-xs text-text-dim font-normal">ج.م</span>
                </div>
              </div>
              <div className="text-[11px] text-text-dim mt-2 flex items-center justify-between border-t border-border pt-1.5">
                <span>مجمل الربح:</span>
                <span className="font-bold text-text-main">{financialSummary.grossProfit.toLocaleString('ar-EG')} ج.م</span>
              </div>
            </div>

            {/* Total Operating Expenses */}
            <div className="bg-card p-4 rounded-3xl border border-border shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center text-text-dim text-xs font-bold mb-1">
                  <span>المصروفات التشغيلية</span>
                  <span className="text-base">📉</span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-danger">
                  {financialSummary.totalExpenses.toLocaleString('ar-EG')} <span className="text-xs text-text-dim font-normal">ج.م</span>
                </div>
              </div>
              <div className="text-[11px] text-text-dim mt-2 flex items-center justify-between border-t border-border pt-1.5">
                <span>المشتريات الجديدة:</span>
                <span className="font-bold text-text-main">{financialSummary.totalPurchases.toLocaleString('ar-EG')} ج.م</span>
              </div>
            </div>

            {/* Net Operating Profit */}
            <div className={`p-4 rounded-3xl border shadow-sm flex flex-col justify-between ${
              financialSummary.netProfit >= 0
                ? 'bg-green-950/20 border-green-500/30'
                : 'bg-red-950/20 border-red-500/30'
            }`}>
              <div>
                <div className="flex justify-between items-center text-text-dim text-xs font-bold mb-1">
                  <span>صافي الربح الفعلي</span>
                  <span className="text-base">🏆</span>
                </div>
                <div className={`text-xl sm:text-2xl font-black ${
                  financialSummary.netProfit >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {financialSummary.netProfit.toLocaleString('ar-EG')} <span className="text-xs text-text-dim font-normal">ج.م</span>
                </div>
              </div>
              <div className="mt-2 pt-1.5 border-t border-border flex items-center justify-between text-[11px]">
                <span className="text-text-dim">هامش الربح: <b className="text-gold">{financialSummary.profitMargin}%</b></span>
                {periodComparison.hasComparison && (
                  <span className={`flex items-center gap-0.5 font-bold ${
                    periodComparison.profitGrowth >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {periodComparison.profitGrowth >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(periodComparison.profitGrowth)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Visual Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales and Profit Over Time Area Chart */}
            <div className="lg:col-span-2 bg-card p-5 rounded-3xl border border-border shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-sm text-text-main flex items-center gap-1.5">
                  <span>📊</span> حركة المبيعات وصافي الربح حسب الأيام
                </h3>
              </div>
              <div className="h-64 sm:h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={11} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '12px', color: '#FFF' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="sales" name="المبيعات (ج.م)" stroke="#F59E0B" fillOpacity={1} fill="url(#salesGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="profit" name="صافي الربح (ج.م)" stroke="#10B981" fillOpacity={1} fill="url(#profitGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payment Methods Distribution */}
            <div className="bg-card p-5 rounded-3xl border border-border shadow-sm flex flex-col justify-between">
              <h3 className="font-bold text-sm text-text-main flex items-center gap-1.5 mb-2">
                <span>💳</span> طرق تحصيل المبيعات
              </h3>
              <div className="h-52 w-full flex items-center justify-center">
                {paymentChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {paymentChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '12px', color: '#FFF' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-text-dim text-xs text-center">لا توجد مبيعات مسجلة في هذه الفترة</div>
                )}
              </div>
              <div className="space-y-1.5 border-t border-border pt-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-dim">نقدي (Cash):</span>
                  <span className="font-bold text-text-main">{financialSummary.paymentsBreakdown.cash.toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dim">آجل (Credit):</span>
                  <span className="font-bold text-text-main">{financialSummary.paymentsBreakdown.credit.toLocaleString('ar-EG')} ج.م</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dim">شبكة ومحافظ:</span>
                  <span className="font-bold text-text-main">
                    {(financialSummary.paymentsBreakdown.card + financialSummary.paymentsBreakdown.wallet).toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Balance Sheet Row (Debts vs Inventory) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card p-4 rounded-3xl border border-border">
              <div className="text-text-dim text-xs font-bold mb-1">إجمالي ديون العملاء (لنا)</div>
              <div className="text-xl font-black text-danger">
                { (financialSummary?.totalCustomerDebt || 0).toLocaleString('ar-EG') } ج.م
              </div>
              <div className="text-[11px] text-text-dim mt-1">مستحقات واجبة التحصيل</div>
            </div>

            <div className="bg-card p-4 rounded-3xl border border-border">
              <div className="text-text-dim text-xs font-bold mb-1">مستحق للموردين (علينا)</div>
              <div className="text-xl font-black text-amber-400">
                {(financialSummary?.totalSupplierDebt || 0).toLocaleString('ar-EG')} ج.م
              </div>
              <div className="text-[11px] text-text-dim mt-1">فواتير شراء آجلة مستحقة السداد</div>
            </div>

            <div className="bg-card p-4 rounded-3xl border border-border">
              <div className="text-text-dim text-xs font-bold mb-1">قيمة المخزون الحالي (بالتكلفة)</div>
              <div className="text-xl font-black text-accent">
                {(financialSummary?.inventoryCostValue || 0).toLocaleString('ar-EG')} ج.م
              </div>
              <div className="text-[11px] text-text-dim mt-1">
                سعر البيع المتوقع: {(financialSummary?.inventorySaleValue || 0).toLocaleString('ar-EG')} ج.م
              </div>
            </div>
          </div>
          
          <SalesCharts sales={sales} products={products} />

          {/* Quick Income Statement (Multi-Step P&L Preview) & Navigation Shortcuts */}
          <div className="bg-card p-6 rounded-3xl border border-border space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-bold text-sm text-text-main flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gold" />
                  <span>ملخص قائمة الدخل التشغيلية (Multi-Step P&L Summary)</span>
                </h3>
                <p className="text-xs text-text-dim mt-0.5">
                  حساب دقيق لتسلسل الأرباح من المبيعات إلى صافي الربح المحقق للفترة المحددة
                </p>
              </div>

              <button
                onClick={() => setIsIncomeStatementOpen(true)}
                className="bg-gold hover:bg-yellow-500 text-black px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              >
                <span>📄</span>
                <span>عرض وطباعة قائمة الدخل الرسمية</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
              <div className="bg-card2 p-3.5 rounded-2xl border border-border flex flex-col justify-between">
                <span className="text-xs text-text-dim font-bold">1. إجمالي المبيعات</span>
                <span className="text-lg font-black text-text-main mt-2">
                  { (financialSummary?.grossSales || 0).toLocaleString('ar-EG') } <span className="text-[10px] font-normal text-text-dim">ج.م</span>
                </span>
                <span className="text-[10px] text-text-dim">إيراد النشاط التجاري</span>
              </div>

              <div className="bg-card2 p-3.5 rounded-2xl border border-border flex flex-col justify-between">
                <span className="text-xs text-text-dim font-bold">2. (-) تكلفة البضاعة (COGS)</span>
                <span className="text-lg font-black text-amber-500 mt-2">
                  { (financialSummary?.totalCogs || 0).toLocaleString('ar-EG') } <span className="text-[10px] font-normal text-text-dim">ج.م</span>
                </span>
                <span className="text-[10px] text-text-dim">تكلفة المخزون المباع</span>
              </div>

              <div className="bg-card2 p-3.5 rounded-2xl border border-border flex flex-col justify-between">
                <span className="text-xs text-text-dim font-bold">3. (=) مجمل الربح</span>
                <span className="text-lg font-black text-emerald-400 mt-2">
                  { (financialSummary?.grossProfit || 0).toLocaleString('ar-EG') } <span className="text-[10px] font-normal text-text-dim">ج.م</span>
                </span>
                <span className="text-[10px] text-gold font-bold">هامش: {financialSummary.grossSales > 0 ? Math.round((financialSummary.grossProfit / financialSummary.grossSales) * 100) : 0}%</span>
              </div>

              <div className="bg-card2 p-3.5 rounded-2xl border border-border flex flex-col justify-between">
                <span className="text-xs text-text-dim font-bold">4. (-) المصروفات</span>
                <span className="text-lg font-black text-danger mt-2">
                  { (financialSummary?.totalExpenses || 0).toLocaleString('ar-EG') } <span className="text-[10px] font-normal text-text-dim">ج.م</span>
                </span>
                <span className="text-[10px] text-text-dim">إيجار، رواتب، كهرباء، إلخ</span>
              </div>

              <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                financialSummary.netProfit >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
              }`}>
                <span className="text-xs font-bold text-text-main">5. (=) صافي الربح</span>
                <span className={`text-lg font-black mt-2 ${financialSummary.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  { (financialSummary?.netProfit || 0).toLocaleString('ar-EG') } <span className="text-[10px] font-normal text-text-dim">ج.م</span>
                </span>
                <span className="text-[10px] text-gold font-bold">صافي: {financialSummary.profitMargin}%</span>
              </div>
            </div>

            {/* Direct analytical shortcuts */}
            <div className="pt-2 border-t border-border flex flex-wrap items-center gap-2">
              <span className="text-xs text-text-dim font-bold">استكشاف التحليلات المتقدمة:</span>
              <button
                onClick={() => setActiveTab('analytics')}
                className="bg-card2 hover:bg-gold/10 hover:border-gold border border-border px-3 py-1.5 rounded-xl text-xs font-bold text-text-main transition-all flex items-center gap-1"
              >
                <span>🧠</span>
                <span>المؤشرات والنسب المالية (KPIs)</span>
              </button>
              <button
                onClick={() => setActiveTab('abc')}
                className="bg-card2 hover:bg-gold/10 hover:border-gold border border-border px-3 py-1.5 rounded-xl text-xs font-bold text-text-main transition-all flex items-center gap-1"
              >
                <span>🎯</span>
                <span>مصفوفة ABC وباريتو للأصناف</span>
              </button>
              <button
                onClick={() => setActiveTab('cashflow')}
                className="bg-card2 hover:bg-gold/10 hover:border-gold border border-border px-3 py-1.5 rounded-xl text-xs font-bold text-text-main transition-all flex items-center gap-1"
              >
                <span>💧</span>
                <span>التدفقات النقدية والسيولة</span>
              </button>
              <button
                onClick={() => setActiveTab('peakhours')}
                className="bg-card2 hover:bg-gold/10 hover:border-gold border border-border px-3 py-1.5 rounded-xl text-xs font-bold text-text-main transition-all flex items-center gap-1"
              >
                <span>⏰</span>
                <span>أوقات الذروة بالساعات</span>
              </button>
              <button
                onClick={() => setActiveTab('categories')}
                className="bg-card2 hover:bg-gold/10 hover:border-gold border border-border px-3 py-1.5 rounded-xl text-xs font-bold text-text-main transition-all flex items-center gap-1"
              >
                <span>📂</span>
                <span>هوامش الأقسام والتصنيفات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: FINANCIAL RATIOS & KPIS */}
      {activeTab === 'analytics' && (
        <FinancialRatiosCard data={financialRatiosData} />
      )}

      {/* TAB: ABC PARETO ANALYSIS */}
      {activeTab === 'abc' && (
        <AbcAnalysisCard productsProfitability={productProfitability} />
      )}

      {/* TAB: PEAK SALES HOURS */}
      {activeTab === 'peakhours' && (
        <PeakHoursChart sales={filteredSales} />
      )}

      {/* TAB: CATEGORIES BREAKDOWN & CONTRIBUTION MARGINS */}
      {activeTab === 'categories' && (
        <CategoryBreakdown sales={filteredSales} productsMap={productsMap} />
      )}

      {/* TAB: CASH FLOW & LIQUIDITY STATEMENT */}
      {activeTab === 'cashflow' && (
        <CashFlowCard data={cashFlowData} />
      )}

      {/* TAB 2: DETAILED SALES & INVOICES REPORT */}
      {activeTab === 'sales' && (
        <div className="space-y-4">
          <div className="bg-card p-4 rounded-3xl border border-border flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="بحث برقم الفاتورة أو اسم العميل..."
                className="bg-card2 border border-border px-3.5 py-2 rounded-xl text-xs text-text-main outline-none focus:border-gold w-full sm:w-64"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-xs text-text-dim font-bold">طريقة الدفع:</span>
              <select
                value={selectedPaymentMethod}
                onChange={e => setSelectedPaymentMethod(e.target.value)}
                className="bg-card2 border border-border px-3 py-2 rounded-xl text-xs text-text-main outline-none focus:border-gold"
              >
                <option value="all">كل طرق الدفع</option>
                <option value="cash">نقدي (Cash)</option>
                <option value="credit">آجل (Credit)</option>
                <option value="card">فيزا / كارت</option>
                <option value="wallet">محفظة إلكترونية</option>
              </select>

              <button
                type="button"
                onClick={() => setShowSalesColModal(true)}
                className="bg-card2 hover:bg-card border border-border px-3 py-2 rounded-xl text-xs font-bold text-text-main flex items-center gap-1.5 transition-all"
                title="تخصيص الأعمدة الظاهرة (إظهار/إخفاء الأعمدة)"
              >
                <span>⚙️ تخصيص الأعمدة</span>
              </button>
            </div>
          </div>

          {/* Dynamic Sales Column Customization Modal */}
          {showSalesColModal && (
            <ColumnManagerModal
              tableName="sales"
              allColumns={SALES_COLUMNS}
              defaultVisibleKeys={SALES_DEFAULT_VISIBLE}
              currentVisibleKeys={salesVisibleKeys}
              currentOrderedKeys={salesOrderedKeys}
              onSave={(vis, ord) => {
                setSalesVisibleKeys(vis);
                setSalesOrderedKeys(ord);
              }}
              onClose={() => setShowSalesColModal(false)}
            />
          )}

          <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-card2 text-text-dim border-b border-border font-bold">
                  <tr>
                    {salesOrderedKeys.map(colKey => {
                      if (!salesVisibleKeys.includes(colKey)) return null;
                      const colDef = SALES_COLUMNS.find(c => c.key === colKey);
                      return <th key={colKey} className="p-3.5">{colDef?.label}</th>;
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSales.map((sale, idx) => {
                    const total = Number(sale.finalTotal || sale.total || 0);
                    const paid = Number(sale.paidAmount || (sale.paymentMethod === 'credit' ? 0 : total));
                    const rem = Number(sale.remainingAmount || Math.max(0, total - paid));
                    const itemCount = Array.isArray(sale.items) ? sale.items.reduce((s, i) => s + (i.quantity || 0), 0) : 0;

                    return (
                      <tr key={sale.id || idx} className="hover:bg-card2/50 transition-colors">
                        {salesOrderedKeys.map(colKey => {
                          if (!salesVisibleKeys.includes(colKey)) return null;
                          switch (colKey) {
                            case 'invoiceNumber':
                              return (
                                <td key={colKey} className="p-3.5 font-mono font-bold text-text-main">
                                  #{sale.invoiceNumber || sale.id.slice(0, 8)}
                                </td>
                              );
                            case 'date':
                              return (
                                <td key={colKey} className="p-3.5 text-text-dim font-mono">
                                  {sale.date ? new Date(sale.date).toLocaleString('ar-EG') : 'غير محدد'}
                                </td>
                              );
                            case 'customer':
                              return (
                                <td key={colKey} className="p-3.5 font-bold text-text-main">
                                  {sale.customerName || 'عميل نقدي'}
                                </td>
                              );
                            case 'cashier':
                              return (
                                <td key={colKey} className="p-3.5 text-text-dim font-bold">
                                  {sale.cashierName || sale.createdBy || 'المدير'}
                                </td>
                              );
                            case 'branch':
                              return (
                                <td key={colKey} className="p-3.5 text-text-dim font-mono">
                                  {sale.branchName || 'الفرع الرئيسي'}
                                </td>
                              );
                            case 'paymentMethod':
                              return (
                                <td key={colKey} className="p-3.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    sale.paymentMethod === 'credit' ? 'bg-red-500/20 text-red-400' :
                                    sale.paymentMethod === 'card' ? 'bg-blue-500/20 text-blue-400' :
                                    sale.paymentMethod === 'wallet' ? 'bg-purple-500/20 text-purple-400' :
                                    'bg-green-500/20 text-green-400'
                                  }`}>
                                    {sale.paymentMethod === 'credit' ? 'آجل' :
                                     sale.paymentMethod === 'card' ? 'كارت' :
                                     sale.paymentMethod === 'wallet' ? 'محفظة' : 'نقدي'}
                                  </span>
                                </td>
                              );
                            case 'itemCount':
                              return (
                                <td key={colKey} className="p-3.5 text-text-main font-bold">
                                  {itemCount} قطع
                                </td>
                              );
                            case 'total':
                              return (
                                <td key={colKey} className="p-3.5 font-bold text-text-dim">
                                  {(sale.total || total).toLocaleString('ar-EG')} ج.م
                                </td>
                              );
                            case 'discount':
                              return (
                                <td key={colKey} className="p-3.5 font-bold text-red-400">
                                  {(sale.discount || 0).toLocaleString('ar-EG')} ج.م
                                </td>
                              );
                            case 'tax':
                              return (
                                <td key={colKey} className="p-3.5 font-bold text-blue-400">
                                  {(sale.taxAmount || 0).toLocaleString('ar-EG')} ج.م
                                </td>
                              );
                            case 'finalTotal':
                              return (
                                <td key={colKey} className="p-3.5 font-black text-text-main">
                                  {total.toLocaleString('ar-EG')} ج.م
                                </td>
                              );
                            case 'paid':
                              return (
                                <td key={colKey} className="p-3.5 font-bold text-green-400">
                                  {paid.toLocaleString('ar-EG')} ج.م
                                </td>
                              );
                            case 'remaining':
                              return (
                                <td key={colKey} className="p-3.5 font-bold text-danger">
                                  {rem > 0 ? `${rem.toLocaleString('ar-EG')} ج.م` : '-'}
                                </td>
                              );
                            case 'status':
                              return (
                                <td key={colKey} className="p-3.5">
                                  <span className="bg-card2 px-2 py-0.5 rounded-md text-[10px] font-bold text-text-dim">
                                    {sale.status || 'مكتمل'}
                                  </span>
                                </td>
                              );
                            case 'shiftNumber':
                              return (
                                <td key={colKey} className="p-3.5 text-text-dim font-mono">
                                  {sale.sessionId || '-'}
                                </td>
                              );
                            case 'notes':
                              return (
                                <td key={colKey} className="p-3.5 text-text-dim max-w-[150px] truncate" title={sale.notes || ''}>
                                  {sale.notes || '-'}
                                </td>
                              );
                            case 'actions':
                              return (
                                <td key={colKey} className="p-3.5 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setSaleToDelete(sale)}
                                    className="bg-danger/15 hover:bg-danger text-danger hover:text-white border border-danger/30 px-3 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                                    title="حذف الفاتورة نهائياً وإرجاع الكميات للمخزن"
                                  >
                                    <Trash2 size={13} />
                                    <span>حذف الفاتورة</span>
                                  </button>
                                </td>
                              );
                            default:
                              return null;
                          }
                        })}
                      </tr>
                    );
                  })}
                  {filteredSales.length === 0 && (
                    <tr>
                      <td colSpan={salesVisibleKeys.length} className="p-8 text-center text-text-dim text-xs">
                        لا توجد فواتير مبيعات مسجلة في هذا النطاق الزمني
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2.5: PURCHASES REPORT & SUPPLIERS INVOICES */}
      {activeTab === 'purchases' && (
        <div className="space-y-6">
          {/* Top Control & Filter Bar for Purchases */}
          <div className="bg-card p-4 rounded-3xl border border-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="بحث برقم فاتورة المشتريات، اسم المورد، الصنف، أو الملاحظات..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-card2 border border-border rounded-2xl pr-10 pl-4 py-2.5 text-xs text-text-main placeholder-text-dim outline-none focus:border-gold transition-all"
              />
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-dim w-4 h-4" />
            </div>

            {/* Quick Filters: Payment Method & Supplier */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedPaymentMethod}
                onChange={e => setSelectedPaymentMethod(e.target.value)}
                className="bg-card2 border border-border rounded-2xl px-3 py-2 text-xs font-bold text-text-main outline-none focus:border-gold cursor-pointer"
              >
                <option value="all">كل طرق الدفع</option>
                <option value="cash">نقدي فقط (Cash)</option>
                <option value="deferred-full">آجل بالكامل (Credit)</option>
                <option value="deferred-partial">سداد جزئي (Partial)</option>
              </select>

              <select
                value={selectedCustomerSupplierId}
                onChange={e => setSelectedCustomerSupplierId(e.target.value)}
                className="bg-card2 border border-border rounded-2xl px-3 py-2 text-xs font-bold text-text-main outline-none focus:border-gold cursor-pointer"
              >
                <option value="all">كل الموردين</option>
                {(suppliers || []).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowPurchasesColModal(true)}
                className="bg-card2 hover:bg-border text-text-main border border-border px-3.5 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                title="تخصيص وإعادة ترتيب أعمدة جدول المشتريات"
              >
                <span>⚙️</span>
                <span>تخصيص الأعمدة</span>
              </button>
            </div>
          </div>

          {/* Purchases Executive KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Purchases */}
            <div className="bg-card p-4 rounded-3xl border border-border shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center text-text-dim text-xs font-bold mb-1">
                  <span>إجمالي المشتريات</span>
                  <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-500">
                    <Truck size={16} />
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-500 tracking-tight">
                  {purchasesSummary.totalPurchases.toLocaleString('ar-EG')} <span className="text-xs font-normal text-text-dim">ج.م</span>
                </div>
              </div>
              <div className="text-[11px] text-text-dim mt-2 pt-2 border-t border-border flex justify-between items-center">
                <span>عدد فواتير الشراء:</span>
                <span className="font-mono font-bold text-text-main">{purchasesSummary.invoicesCount} فاتورة</span>
              </div>
            </div>

            {/* Total Paid to Suppliers */}
            <div className="bg-card p-4 rounded-3xl border border-border shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center text-text-dim text-xs font-bold mb-1">
                  <span>المسدد للموردين</span>
                  <span className="p-1.5 rounded-xl bg-green-500/10 text-green-400">
                    <Wallet size={16} />
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-green-400 tracking-tight">
                  {purchasesSummary.totalPaid.toLocaleString('ar-EG')} <span className="text-xs font-normal text-text-dim">ج.م</span>
                </div>
              </div>
              <div className="text-[11px] text-text-dim mt-2 pt-2 border-t border-border flex justify-between items-center">
                <span>نسبة السداد النقدي:</span>
                <span className="font-mono font-bold text-green-400">
                  {purchasesSummary.totalPurchases > 0 ? Math.round((purchasesSummary.totalPaid / purchasesSummary.totalPurchases) * 100) : 100}%
                </span>
              </div>
            </div>

            {/* Total Remaining to Suppliers */}
            <div className="bg-card p-4 rounded-3xl border border-border shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center text-text-dim text-xs font-bold mb-1">
                  <span>المتبقي والآجل للموردين</span>
                  <span className="p-1.5 rounded-xl bg-danger/10 text-danger">
                    <AlertTriangle size={16} />
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-danger tracking-tight">
                  {purchasesSummary.totalRemaining.toLocaleString('ar-EG')} <span className="text-xs font-normal text-text-dim">ج.م</span>
                </div>
              </div>
              <div className="text-[11px] text-text-dim mt-2 pt-2 border-t border-border flex justify-between items-center">
                <span>فواتير آجلة / جزئية:</span>
                <span className="font-mono font-bold text-danger">
                  {filteredPurchases.filter(p => {
                    const tot = Number(p.total || 0);
                    const pd = Number(p.paidAmount || (p.paymentMethod === 'cash' ? tot : 0));
                    return tot - pd > 0;
                  }).length} فاتورة
                </span>
              </div>
            </div>

            {/* Total Purchased Items */}
            <div className="bg-card p-4 rounded-3xl border border-border shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center text-text-dim text-xs font-bold mb-1">
                  <span>إجمالي الكميات والقطع</span>
                  <span className="p-1.5 rounded-xl bg-sky-500/10 text-sky-400">
                    <PackageCheck size={16} />
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-black text-sky-400 tracking-tight">
                  {purchasesSummary.totalItemsCount.toLocaleString('ar-EG')} <span className="text-xs font-normal text-text-dim">قطعة</span>
                </div>
              </div>
              <div className="text-[11px] text-text-dim mt-2 pt-2 border-t border-border flex justify-between items-center">
                <span>متوسط قيمة الفاتورة:</span>
                <span className="font-mono font-bold text-text-main">{purchasesSummary.avgInvoiceValue.toLocaleString('ar-EG')} ج.م</span>
              </div>
            </div>
          </div>

          {/* Visual Charts: Daily Trend & Top Suppliers */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart 1: Purchases Daily Trend (2 cols) */}
            <div className="bg-card p-5 rounded-3xl border border-border shadow-sm lg:col-span-2">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-sm text-text-main flex items-center gap-2">
                  <span className="text-amber-500">📈</span>
                  <span>حركة المشتريات اليومية ومقارنة المدفوع بالآجل</span>
                </h3>
                <span className="text-xs text-text-dim">{dateRangeLabel}</span>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={purchasesChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="purchTotalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="purchPaidGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#6B7280" fontSize={11} />
                    <YAxis stroke="#6B7280" fontSize={11} tickFormatter={(val) => `${val}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181B', borderColor: '#27272A', borderRadius: '16px', fontSize: '12px' }} 
                      formatter={(value: any) => [`${Number(value).toLocaleString('ar-EG')} ج.م`, '']}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="total" name="إجمالي المشتريات" stroke="#F59E0B" strokeWidth={2.5} fillOpacity={1} fill="url(#purchTotalGrad)" />
                    <Area type="monotone" dataKey="paid" name="المسدد نقداً" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#purchPaidGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Top Suppliers Breakdown (1 col) */}
            <div className="bg-card p-5 rounded-3xl border border-border shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-text-main flex items-center gap-2 mb-3">
                  <span className="text-sky-400">🚚</span>
                  <span>أعلى الموردين توريداً حسب القيمة</span>
                </h3>
                <div className="space-y-3">
                  {supplierPurchasesBreakdown.slice(0, 5).map((supp, idx) => {
                    const percentage = purchasesSummary.totalPurchases > 0 
                      ? Math.round((supp.total / purchasesSummary.totalPurchases) * 100) 
                      : 0;
                    return (
                      <div key={supp.id || idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-text-main">{supp.name}</span>
                          <span className="text-amber-500 font-mono">{supp.total.toLocaleString('ar-EG')} ج.م ({percentage}%)</span>
                        </div>
                        <div className="w-full bg-card2 rounded-full h-2 overflow-hidden border border-border">
                          <div
                            className="bg-amber-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(5, percentage))}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {supplierPurchasesBreakdown.length === 0 && (
                    <div className="p-8 text-center text-text-dim text-xs">
                      لا توجد فواتير مشتريات مسجلة في هذا النطاق
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-border mt-3 text-[11px] text-text-dim flex justify-between items-center">
                <span>إجمالي عدد الموردين المتعامل معهم:</span>
                <span className="font-mono font-bold text-text-main">{supplierPurchasesBreakdown.length} مورد</span>
              </div>
            </div>
          </div>

          {/* Column Manager Modal for Purchases */}
          {showPurchasesColModal && (
            <ColumnManagerModal
              tableName="purchases"
              allColumns={PURCHASES_COLUMNS}
              defaultVisibleKeys={PURCHASES_DEFAULT_VISIBLE}
              currentVisibleKeys={purchasesVisibleKeys}
              currentOrderedKeys={purchasesOrderedKeys}
              onSave={(vis, ord) => {
                setPurchasesVisibleKeys(vis);
                setPurchasesOrderedKeys(ord);
              }}
              onClose={() => setShowPurchasesColModal(false)}
            />
          )}

          {/* Purchases Data Table */}
          <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
                  <Receipt size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-text-main">سجل فواتير وأذون المشتريات</h3>
                  <p className="text-[11px] text-text-dim">عرض كافة حركات التوريد والتكاليف وأرصدة الموردين</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-dim">عدد الفواتير المعروضة: {filteredPurchases.length}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-card2 text-text-dim border-b border-border font-bold">
                  <tr>
                    {purchasesOrderedKeys
                      .filter(k => purchasesVisibleKeys.includes(k))
                      .map(colKey => {
                        const colDef = PURCHASES_COLUMNS.find(c => c.key === colKey);
                        return (
                          <th key={colKey} className={`p-3.5 ${colKey === 'actions' ? 'text-center' : ''}`}>
                            {colDef ? colDef.label : colKey}
                          </th>
                        );
                      })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPurchases.map((purch, idx) => {
                    const total = Number(purch.total || 0);
                    const paid = Number(purch.paidAmount || (purch.paymentMethod === 'cash' ? total : 0));
                    const remaining = Math.max(0, total - paid);
                    const itemCount = Array.isArray(purch.items) ? purch.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0) : 0;

                    return (
                      <tr key={purch.id || idx} className="hover:bg-card2/50 transition-colors">
                        {purchasesOrderedKeys.filter(k => purchasesVisibleKeys.includes(k)).map(colKey => {
                          switch (colKey) {
                            case 'purchaseNumber':
                              return (
                                <td key={colKey} className="p-3.5 font-mono font-bold text-text-main">
                                  #{purch.purchaseNumber || `PUR-${purch.id.slice(-6)}`}
                                </td>
                              );
                            case 'invoiceNumber':
                              return (
                                <td key={colKey} className="p-3.5 font-mono text-text-dim">
                                  {purch.invoiceNumber ? `#${purch.invoiceNumber}` : '-'}
                                </td>
                              );
                            case 'date':
                              return (
                                <td key={colKey} className="p-3.5 font-mono text-text-dim">
                                  {purch.date ? new Date(purch.date).toLocaleString('ar-EG') : '-'}
                                </td>
                              );
                            case 'supplier':
                              return (
                                <td key={colKey} className="p-3.5 font-bold text-text-main flex items-center gap-1.5">
                                  <Truck size={14} className="text-amber-500 shrink-0" />
                                  <span>{purch.supplierName || 'مورد عام / نقدي'}</span>
                                </td>
                              );
                            case 'cashier':
                              return (
                                <td key={colKey} className="p-3.5 text-text-dim">
                                  المدير
                                </td>
                              );
                            case 'paymentMethod':
                              return (
                                <td key={colKey} className="p-3.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    purch.paymentMethod === 'cash' 
                                      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                      : purch.paymentMethod === 'deferred-partial'
                                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  }`}>
                                    {purch.paymentMethod === 'cash' ? 'نقدي' :
                                     purch.paymentMethod === 'deferred-full' ? 'آجل بالكامل' : 'سداد جزئي'}
                                  </span>
                                </td>
                              );
                            case 'itemCount':
                              return (
                                <td key={colKey} className="p-3.5 font-bold text-text-main font-mono">
                                  <span className="bg-card2 px-2 py-0.5 rounded-lg border border-border">
                                    {purch.items?.length || 0} صنف ({itemCount} ق)
                                  </span>
                                </td>
                              );
                            case 'total':
                              return (
                                <td key={colKey} className="p-3.5 font-mono text-text-dim">
                                  {total.toLocaleString('ar-EG')} ج.م
                                </td>
                              );
                            case 'discount':
                              return (
                                <td key={colKey} className="p-3.5 font-mono text-text-dim">
                                  0 ج.م
                                </td>
                              );
                            case 'tax':
                              return (
                                <td key={colKey} className="p-3.5 font-mono text-text-dim">
                                  {((purch as any).vatAmount || 0).toLocaleString('ar-EG')} ج.م
                                </td>
                              );
                            case 'finalTotal':
                              return (
                                <td key={colKey} className="p-3.5 font-bold font-mono text-amber-500">
                                  {total.toLocaleString('ar-EG')} ج.م
                                </td>
                              );
                            case 'paidAmount':
                              return (
                                <td key={colKey} className="p-3.5 font-bold font-mono text-green-400">
                                  {paid.toLocaleString('ar-EG')} ج.م
                                </td>
                              );
                            case 'remaining':
                              return (
                                <td key={colKey} className={`p-3.5 font-bold font-mono ${remaining > 0 ? 'text-danger' : 'text-text-dim'}`}>
                                  {remaining > 0 ? `${remaining.toLocaleString('ar-EG')} ج.م` : '-'}
                                </td>
                              );
                            case 'status':
                              return (
                                <td key={colKey} className="p-3.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    remaining === 0 
                                      ? 'bg-green-500/20 text-green-400' 
                                      : paid > 0 
                                      ? 'bg-amber-500/20 text-amber-400' 
                                      : 'bg-red-500/20 text-red-400'
                                  }`}>
                                    {remaining === 0 ? 'مسدد بالكامل' : paid > 0 ? 'مسدد جزئياً' : 'غير مسدد (آجل)'}
                                  </span>
                                </td>
                              );
                            case 'notes':
                              return (
                                <td key={colKey} className="p-3.5 text-text-dim max-w-[150px] truncate" title={purch.notes || ''}>
                                  {purch.notes || '-'}
                                </td>
                              );
                            case 'actions':
                              return (
                                <td key={colKey} className="p-3.5 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setViewingPurchase(purch)}
                                      className="bg-card2 hover:bg-card text-text-main border border-border px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                                      title="معاينة تفاصيل الأصناف وبنود الفاتورة"
                                    >
                                      <Eye size={13} className="text-sky-400" />
                                      <span>معاينة</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setPurchaseToDelete(purch)}
                                      className="bg-danger/15 hover:bg-danger text-danger hover:text-white border border-danger/30 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 shadow-sm active:scale-95 cursor-pointer"
                                      title="حذف فاتورة المشتريات نهائياً وخصم الكميات من المخزن"
                                    >
                                      <Trash2 size={13} />
                                      <span>حذف</span>
                                    </button>
                                  </div>
                                </td>
                              );
                            default:
                              return null;
                          }
                        })}
                      </tr>
                    );
                  })}
                  {filteredPurchases.length === 0 && (
                    <tr>
                      <td colSpan={purchasesVisibleKeys.length} className="p-8 text-center text-text-dim text-xs">
                        لا توجد فواتير مشتريات مسجلة في هذا النطاق الزمني
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PRODUCTS SALES & PROFITABILITY */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border flex justify-between items-center">
              <h3 className="font-bold text-sm text-text-main flex items-center gap-1.5">
                <span>📦</span> ترتيب الأصناف حسب الأكثر مبيعاً والأعلى تحقيقاً للأرباح
              </h3>
              <span className="text-xs text-text-dim">إجمالي الأصناف المباعة: {productProfitability.length} صنف</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-card2 text-text-dim border-b border-border font-bold">
                  <tr>
                    <th className="p-3.5">#</th>
                    <th className="p-3.5">اسم الصنف</th>
                    <th className="p-3.5">التصنيف</th>
                    <th className="p-3.5">الكمية المباعة</th>
                    <th className="p-3.5">إجمالي المبيعات</th>
                    <th className="p-3.5">إجمالي التكلفة</th>
                    <th className="p-3.5">صافي الربح</th>
                    <th className="p-3.5">نسبة الربحية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {productProfitability.map((item, idx) => {
                    const margin = item.revenue > 0 ? Math.round((item.profit / item.revenue) * 1000) / 10 : 0;
                    return (
                      <tr key={item.id || idx} className="hover:bg-card2/50 transition-colors">
                        <td className="p-3.5 text-text-dim font-mono">{idx + 1}</td>
                        <td className="p-3.5 font-bold text-text-main">{item.name}</td>
                        <td className="p-3.5 text-text-dim">{item.category}</td>
                        <td className="p-3.5 font-bold text-text-main">{item.qtySold}</td>
                        <td className="p-3.5 font-bold text-text-main">{item.revenue.toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-3.5 text-amber-500">{item.cost.toLocaleString('ar-EG')} ج.م</td>
                        <td className={`p-3.5 font-black ${item.profit >= 0 ? 'text-green-400' : 'text-danger'}`}>
                          {item.profit.toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            margin >= 20 ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {margin}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {productProfitability.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-text-dim text-xs">
                        لا توجد أصناف مباعة في الفترة المحددة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: CUSTOMERS DEBTS & RECEIVABLES */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card p-4 rounded-3xl border border-border">
              <div className="text-text-dim text-xs font-bold mb-1">إجمالي ديون العملاء المطلوب تحصيلها</div>
              <div className="text-2xl font-black text-danger">
                {financialSummary.totalCustomerDebt.toLocaleString('ar-EG')} ج.م
              </div>
            </div>
            <div className="bg-card p-4 rounded-3xl border border-border">
              <div className="text-text-dim text-xs font-bold mb-1">عدد العملاء المدينين</div>
              <div className="text-2xl font-black text-text-main">
                {(customers || []).filter(c => (c.currentBalance || c.openingBalance || 0) > 0).length} عميل
              </div>
            </div>
          </div>

          <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-card2 text-text-dim border-b border-border font-bold">
                  <tr>
                    <th className="p-3.5">اسم العميل</th>
                    <th className="p-3.5">رقم الهاتف</th>
                    <th className="p-3.5">رصيد أول المدة</th>
                    <th className="p-3.5">الرصيد المستحق الحالي</th>
                    <th className="p-3.5 text-center">إجراء تذكير سريع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(customers || []).map((c, idx) => {
                    const balance = Number(c.currentBalance || c.openingBalance || 0);
                    return (
                      <tr key={c.id || idx} className="hover:bg-card2/50 transition-colors">
                        <td className="p-3.5 font-bold text-text-main">{c.name}</td>
                        <td className="p-3.5 font-mono text-text-dim">{c.phone || '-'}</td>
                        <td className="p-3.5 text-text-dim">{Number(c.openingBalance || 0).toLocaleString('ar-EG')} ج.م</td>
                        <td className={`p-3.5 font-black ${balance > 0 ? 'text-danger' : 'text-green-400'}`}>
                          {balance.toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="p-3.5 text-center">
                          {c.phone && balance > 0 ? (
                            <a
                              href={`https://wa.me/2${c.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`مرحباً ${c.name}، نود تذكيركم بوجود مديونية مستحقة بقيمة ${balance} ج.م لدى محلنا. نسعد بسدادكم في أقرب وقت.`)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-green-600/20 text-green-400 hover:bg-green-600/30 px-3 py-1 rounded-xl text-[11px] font-bold transition-all inline-flex items-center gap-1"
                            >
                              <span>📱</span> تذكير واتساب
                            </a>
                          ) : (
                            <span className="text-text-dim text-[11px]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {(customers || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-text-dim text-xs">
                        لا يوجد عملاء مسجلين بالنظام
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SUPPLIERS PAYABLES */}
      {activeTab === 'suppliers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-card p-4 rounded-3xl border border-border">
              <div className="text-text-dim text-xs font-bold mb-1">إجمالي المستحق للموردين (فواتير آجلة)</div>
              <div className="text-2xl font-black text-amber-500">
                {financialSummary.totalSupplierDebt.toLocaleString('ar-EG')} ج.م
              </div>
            </div>
            <div className="bg-card p-4 rounded-3xl border border-border">
              <div className="text-text-dim text-xs font-bold mb-1">عدد الموردين المسجلين</div>
              <div className="text-2xl font-black text-text-main">
                {(suppliers || []).length} مورد
              </div>
            </div>
          </div>

          <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-card2 text-text-dim border-b border-border font-bold">
                  <tr>
                    <th className="p-3.5">اسم الشركة / المورد</th>
                    <th className="p-3.5">الشخص المسؤول</th>
                    <th className="p-3.5">رقم الهاتف</th>
                    <th className="p-3.5">رصيد أول المدة</th>
                    <th className="p-3.5">المستحق الحالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(suppliers || []).map((s, idx) => {
                    const balance = Number(s.currentBalance || s.openingBalance || 0);
                    return (
                      <tr key={s.id || idx} className="hover:bg-card2/50 transition-colors">
                        <td className="p-3.5 font-bold text-text-main">{s.name}</td>
                        <td className="p-3.5 text-text-dim">{s.contactPerson || '-'}</td>
                        <td className="p-3.5 font-mono text-text-dim">{s.phone || '-'}</td>
                        <td className="p-3.5 text-text-dim">{Number(s.openingBalance || 0).toLocaleString('ar-EG')} ج.م</td>
                        <td className={`p-3.5 font-black ${balance > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                          {balance.toLocaleString('ar-EG')} ج.م
                        </td>
                      </tr>
                    );
                  })}
                  {(suppliers || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-text-dim text-xs">
                        لا يوجد موردين مسجلين بالنظام
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: EXPENSES BREAKDOWN */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-card p-5 rounded-3xl border border-border">
              <h3 className="font-bold text-sm text-text-main mb-4 flex items-center gap-1.5">
                <span>📉</span> توزيع المصروفات حسب التصنيف
              </h3>
              <div className="h-64 w-full">
                {expenseCategoriesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={expenseCategoriesData}>
                      <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                      <YAxis stroke="#94A3B8" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '12px', color: '#FFF' }} />
                      <Bar dataKey="value" name="المبلغ (ج.م)" fill="#F43F5E" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-text-dim text-xs">
                    لا توجد مصروفات مسجلة في هذه الفترة
                  </div>
                )}
              </div>
            </div>

            <div className="bg-card p-5 rounded-3xl border border-border flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-text-main mb-3">إجمالي المصروفات</h3>
                <div className="text-3xl font-black text-danger mb-4">
                  {financialSummary.totalExpenses.toLocaleString('ar-EG')} ج.م
                </div>
                <div className="space-y-2 text-xs divide-y divide-border">
                  {expenseCategoriesData.map((cat, i) => (
                    <div key={i} className="flex justify-between pt-2">
                      <span className="text-text-dim">{cat.name}:</span>
                      <span className="font-bold text-text-main">{cat.value.toLocaleString('ar-EG')} ج.م</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: INVENTORY VALUATION & LOW STOCK */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-card p-4 rounded-3xl border border-border">
              <div className="text-text-dim text-xs font-bold mb-1">قيمة المخزون بالتكلفة</div>
              <div className="text-xl font-black text-amber-400">
                {financialSummary.inventoryCostValue.toLocaleString('ar-EG')} ج.م
              </div>
            </div>
            <div className="bg-card p-4 rounded-3xl border border-border">
              <div className="text-text-dim text-xs font-bold mb-1">قيمة المخزون بسعر البيع</div>
              <div className="text-xl font-black text-green-400">
                {financialSummary.inventorySaleValue.toLocaleString('ar-EG')} ج.م
              </div>
            </div>
            <div className="bg-card p-4 rounded-3xl border border-border">
              <div className="text-text-dim text-xs font-bold mb-1">أصناف قاربت على النفاد</div>
              <div className="text-xl font-black text-amber-500">
                {financialSummary.lowStockCount} صنف
              </div>
            </div>
            <div className="bg-card p-4 rounded-3xl border border-border">
              <div className="text-text-dim text-xs font-bold mb-1">أصناف نفدت بالكامل (0)</div>
              <div className="text-xl font-black text-danger">
                {financialSummary.outOfStockCount} صنف
              </div>
            </div>
          </div>

          <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border font-bold text-sm text-text-main flex items-center gap-1.5">
              <span>⚠️</span> قائمة الأصناف التي تحتاج لإعادة طلب عاجلة
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-card2 text-text-dim border-b border-border font-bold">
                  <tr>
                    <th className="p-3.5">اسم الصنف</th>
                    <th className="p-3.5">التصنيف</th>
                    <th className="p-3.5">الرصيد الحالي</th>
                    <th className="p-3.5">حد الطلب</th>
                    <th className="p-3.5">سعر التكلفة</th>
                    <th className="p-3.5">سعر البيع</th>
                    <th className="p-3.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(products || [])
                    .filter(p => (p.quantity || 0) <= (p.lowStockThreshold || 5))
                    .map((p, idx) => (
                      <tr key={p.id || idx} className="hover:bg-card2/50 transition-colors">
                        <td className="p-3.5 font-bold text-text-main">{p.name}</td>
                        <td className="p-3.5 text-text-dim">{p.category || 'عام'}</td>
                        <td className="p-3.5 font-black text-danger">{p.quantity || 0}</td>
                        <td className="p-3.5 text-text-dim">{p.lowStockThreshold || 5}</td>
                        <td className="p-3.5 text-text-dim">{(p.cost || 0).toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-3.5 font-bold text-text-main">{(p.price || 0).toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-3.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            (p.quantity || 0) <= 0 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {(p.quantity || 0) <= 0 ? 'نفد تماماً' : 'منخفض'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  {(products || []).filter(p => (p.quantity || 0) <= (p.lowStockThreshold || 5)).length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-text-dim text-xs">
                        ✅ جميع الأصناف في حالة مخزنية ممتازة وتتجاوز حدود الأمان
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'item_ledger' && (
        <ItemLedger />
      )}

      {/* TAB 8: VAT & TAX REPORT */}
      {activeTab === 'tax' && (
        <div className="space-y-4">
          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-4">
            <h3 className="font-black text-base text-gold flex items-center gap-2">
              <span>🧾</span> تقرير ضريبة القيمة المضافة (VAT Tax Return Summary)
            </h3>
            <p className="text-xs text-text-dim leading-relaxed">
              حساب إجمالي الضريبة المحصلة من فواتير المبيعات وضريبة المدخلات من فواتير الشراء لحساب صافي الضريبة الواجب سدادها لمصلحة الضرائب.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-card2 p-4 rounded-2xl border border-border">
                <div className="text-text-dim text-xs font-bold mb-1">ضريبة المبيعات المحصلة (مخرجات)</div>
                <div className="text-2xl font-black text-green-400">
                  {financialSummary.totalTaxCollected.toLocaleString('ar-EG')} ج.م
                </div>
              </div>

              <div className="bg-card2 p-4 rounded-2xl border border-border">
                <div className="text-text-dim text-xs font-bold mb-1">إجمالي الخصومات الممنوحة</div>
                <div className="text-2xl font-black text-amber-400">
                  {financialSummary.totalDiscount.toLocaleString('ar-EG')} ج.م
                </div>
              </div>

              <div className="bg-card2 p-4 rounded-2xl border border-border">
                <div className="text-text-dim text-xs font-bold mb-1">صافي المبيعات الخاضعة للضريبة</div>
                <div className="text-2xl font-black text-text-main">
                  {financialSummary.grossSales.toLocaleString('ar-EG')} ج.م
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: ADVANCED SALES & PURCHASES ANALYSIS (ITEMS, GROUPS, CASHIER, BRANCH) */}
      {activeTab === 'advanced' && (
        <div className="space-y-6">
          {/* Section 1: KPI Grid for Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card p-4 rounded-3xl border border-border shadow-sm">
              <div className="text-text-dim text-xs font-bold mb-1">عدد الفروع النشطة</div>
              <div className="text-2xl font-black text-gold">
                {advancedAnalytics.branchesList.length.toLocaleString('ar-EG')} فرع
              </div>
            </div>
            <div className="bg-card p-4 rounded-3xl border border-border shadow-sm">
              <div className="text-text-dim text-xs font-bold mb-1">إجمالي الكاشيرات العاملة</div>
              <div className="text-2xl font-black text-green-400">
                {advancedAnalytics.cashiersList.length.toLocaleString('ar-EG')} كاشير
              </div>
            </div>
            <div className="bg-card p-4 rounded-3xl border border-border shadow-sm">
              <div className="text-text-dim text-xs font-bold mb-1">إجمالي المبيعات (الفترة)</div>
              <div className="text-2xl font-black text-text-main">
                {financialSummary.grossSales.toLocaleString('ar-EG')} ج.م
              </div>
            </div>
            <div className="bg-card p-4 rounded-3xl border border-border shadow-sm">
              <div className="text-text-dim text-xs font-bold mb-1">إجمالي المشتريات (الفترة)</div>
              <div className="text-2xl font-black text-amber-500">
                {filteredPurchases.reduce((sum, p) => sum + Number(p.total || 0), 0).toLocaleString('ar-EG')} ج.م
              </div>
            </div>
          </div>

          {/* Section 2: Category Breakdown Table & Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card p-5 rounded-3xl border border-border shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-sm text-text-main flex items-center gap-1.5">
                  <span>📂</span> تحليل المبيعات والمشتريات حسب المجموعات
                </h3>
                <button
                  onClick={() => exportToCSV(advancedAnalytics.categoriesList, 'category_analysis.csv', {
                    name: 'المجموعة/التصنيف',
                    soldQty: 'الكمية المباعة',
                    salesRevenue: 'قيمة المبيعات (ج.م)',
                    purchasedQty: 'الكمية المشتراة',
                    purchaseCost: 'تكلفة المشتريات (ج.م)'
                  })}
                  className="text-gold hover:text-white transition-colors text-xs flex items-center gap-1 font-bold"
                >
                  <Download className="w-3.5 h-3.5" /> تصدير
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-card2 text-text-dim border-b border-border font-bold">
                    <tr>
                      <th className="p-3">اسم المجموعة</th>
                      <th className="p-3">الكمية المباعة</th>
                      <th className="p-3">إيراد المبيعات</th>
                      <th className="p-3">الكمية المشتراة</th>
                      <th className="p-3">تكلفة الشراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {advancedAnalytics.categoriesList.map((cat, idx) => (
                      <tr key={idx} className="hover:bg-card2/50 transition-colors">
                        <td className="p-3 font-bold text-text-main">{cat.name}</td>
                        <td className="p-3 text-text-dim">{cat.soldQty.toLocaleString('ar-EG')}</td>
                        <td className="p-3 font-bold text-green-400">{cat.salesRevenue.toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-3 text-text-dim">{cat.purchasedQty.toLocaleString('ar-EG')}</td>
                        <td className="p-3 font-bold text-amber-500">{cat.purchaseCost.toLocaleString('ar-EG')} ج.م</td>
                      </tr>
                    ))}
                    {advancedAnalytics.categoriesList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-text-dim">لا توجد بيانات مجموعات</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-card p-5 rounded-3xl border border-border shadow-sm">
              <h3 className="font-bold text-sm text-text-main mb-4 flex items-center gap-1.5">
                <span>📊</span> مقارنة قيم مبيعات ومشتريات المجموعات
              </h3>
              <div className="h-64 w-full">
                {advancedAnalytics.categoriesList.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={advancedAnalytics.categoriesList}>
                      <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} />
                      <YAxis stroke="#94A3B8" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '12px', color: '#FFF' }} />
                      <Legend />
                      <Bar dataKey="salesRevenue" name="المبيعات (ج.م)" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="purchaseCost" name="المشتريات (ج.م)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-text-dim text-xs">لا توجد بيانات للمخطط</div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Branch and Cashier Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Cashier Report */}
            <div className="bg-card p-5 rounded-3xl border border-border shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-sm text-text-main flex items-center gap-1.5">
                  <span>👤</span> أداء وتحليل مبيعات الكاشير
                </h3>
                <button
                  onClick={() => exportToCSV(advancedAnalytics.cashiersList, 'cashier_analysis.csv', {
                    name: 'اسم الكاشير',
                    totalSales: 'إجمالي المبيعات (ج.م)',
                    invoiceCount: 'عدد الفواتير'
                  })}
                  className="text-gold hover:text-white transition-colors text-xs flex items-center gap-1 font-bold"
                >
                  <Download className="w-3.5 h-3.5" /> تصدير
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-card2 text-text-dim border-b border-border font-bold">
                    <tr>
                      <th className="p-3">اسم الكاشير</th>
                      <th className="p-3">إجمالي المبيعات</th>
                      <th className="p-3">عدد الفواتير</th>
                      <th className="p-3">متوسط قيمة الفاتورة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {advancedAnalytics.cashiersList.map((cashier, idx) => (
                      <tr key={idx} className="hover:bg-card2/50 transition-colors">
                        <td className="p-3 font-bold text-text-main">{cashier.name}</td>
                        <td className="p-3 font-black text-green-400">{cashier.totalSales.toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-3 text-text-dim">{cashier.invoiceCount.toLocaleString('ar-EG')} فواتير</td>
                        <td className="p-3 font-mono text-text-main">
                          {Math.round(cashier.totalSales / (cashier.invoiceCount || 1)).toLocaleString('ar-EG')} ج.م
                        </td>
                      </tr>
                    ))}
                    {advancedAnalytics.cashiersList.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-text-dim">لا توجد بيانات كاشير مسجلة</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Branch Report */}
            <div className="bg-card p-5 rounded-3xl border border-border shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-sm text-text-main flex items-center gap-1.5">
                  <span>🏢</span> أداء وتحليل الفروع (مبيعات ومشتريات)
                </h3>
                <button
                  onClick={() => exportToCSV(advancedAnalytics.branchesList, 'branch_analysis.csv', {
                    name: 'اسم الفرع',
                    salesRevenue: 'مبيعات الفرع (ج.م)',
                    salesInvoices: 'فواتير البيع',
                    purchasesCost: 'مشتريات الفرع (ج.م)',
                    purchasesInvoices: 'فواتير الشراء'
                  })}
                  className="text-gold hover:text-white transition-colors text-xs flex items-center gap-1 font-bold"
                >
                  <Download className="w-3.5 h-3.5" /> تصدير
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-card2 text-text-dim border-b border-border font-bold">
                    <tr>
                      <th className="p-3">اسم الفرع</th>
                      <th className="p-3">إيراد المبيعات</th>
                      <th className="p-3">فواتير البيع</th>
                      <th className="p-3">تكلفة المشتريات</th>
                      <th className="p-3">فواتير الشراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {advancedAnalytics.branchesList.map((branch, idx) => (
                      <tr key={idx} className="hover:bg-card2/50 transition-colors">
                        <td className="p-3 font-bold text-text-main">{branch.name}</td>
                        <td className="p-3 font-black text-green-400">{branch.salesRevenue.toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-3 text-text-dim">{branch.salesInvoices.toLocaleString('ar-EG')} فواتير</td>
                        <td className="p-3 font-black text-amber-500">{branch.purchasesCost.toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-3 text-text-dim">{branch.purchasesInvoices.toLocaleString('ar-EG')} فواتير</td>
                      </tr>
                    ))}
                    {advancedAnalytics.branchesList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-text-dim">لا توجد بيانات فروع مسجلة</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section 4: Detailed Product Flow (Sales and Purchases comparison per item) */}
          <div className="bg-card p-5 rounded-3xl border border-border shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
              <h3 className="font-bold text-sm text-text-main flex items-center gap-1.5">
                <span>📦</span> حركة الأصناف التفصيلية (مبيعات ومشتريات بالصنف)
              </h3>
              <div className="flex gap-2 w-full sm:w-auto">
                <button
                  onClick={() => exportToCSV(advancedAnalytics.productsList, 'product_flow_analysis.csv', {
                    name: 'اسم الصنف',
                    category: 'المجموعة',
                    soldQty: 'الكمية المباعة',
                    salesRevenue: 'قيمة المبيعات (ج.م)',
                    purchasedQty: 'الكمية المشتراة',
                    purchaseCost: 'تكلفة المشتريات (ج.م)'
                  })}
                  className="bg-card2 border border-border text-gold px-3.5 py-1.5 rounded-xl text-xs hover:text-white transition-all flex items-center gap-1.5 font-bold"
                >
                  <Download className="w-3.5 h-3.5" /> تصدير التقرير
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-card2 text-text-dim border-b border-border font-bold">
                  <tr>
                    <th className="p-3.5">اسم الصنف</th>
                    <th className="p-3.5">المجموعة</th>
                    <th className="p-3.5 text-center bg-green-500/10 text-green-400">الكمية المباعة</th>
                    <th className="p-3.5 text-center bg-green-500/10 text-green-400">إيراد المبيعات</th>
                    <th className="p-3.5 text-center bg-green-500/10 text-green-400">متوسط سعر البيع</th>
                    <th className="p-3.5 text-center bg-amber-500/10 text-amber-500">الكمية المشتراة</th>
                    <th className="p-3.5 text-center bg-amber-500/10 text-amber-500">تكلفة المشتريات</th>
                    <th className="p-3.5 text-center bg-amber-500/10 text-amber-500">متوسط سعر الشراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {advancedAnalytics.productsList.map((product, idx) => {
                    const avgSellPrice = product.soldQty > 0 ? Math.round(product.salesRevenue / product.soldQty) : 0;
                    const avgBuyPrice = product.purchasedQty > 0 ? Math.round(product.purchaseCost / product.purchasedQty) : 0;

                    return (
                      <tr key={product.id || idx} className="hover:bg-card2/50 transition-colors">
                        <td className="p-3.5 font-bold text-text-main">{product.name}</td>
                        <td className="p-3.5 text-text-dim">{product.category}</td>
                        <td className="p-3.5 text-center font-bold text-text-main">{product.soldQty.toLocaleString('ar-EG')}</td>
                        <td className="p-3.5 text-center font-bold text-green-400">{product.salesRevenue.toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-3.5 text-center font-mono text-text-dim">{avgSellPrice.toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-3.5 text-center font-bold text-text-main">{product.purchasedQty.toLocaleString('ar-EG')}</td>
                        <td className="p-3.5 text-center font-bold text-amber-500">{product.purchaseCost.toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-3.5 text-center font-mono text-text-dim">{avgBuyPrice.toLocaleString('ar-EG')} ج.م</td>
                      </tr>
                    );
                  })}
                  {advancedAnalytics.productsList.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-text-dim">
                        لا توجد حركة مسجلة للأصناف في النطاق المحدد
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Income Statement (P&L) Printable Modal */}
      <IncomeStatementModal
        isOpen={isIncomeStatementOpen}
        onClose={() => setIsIncomeStatementOpen(false)}
        dateRangeLabel={dateRangeLabel}
        financials={{
          grossSales: financialSummary.grossSales || 0,
          discounts: financialSummary.totalDiscount || 0,
          netSales: Math.max(0, (financialSummary.grossSales || 0) - (financialSummary.totalDiscount || 0)),
          cogs: financialSummary.totalCogs || 0,
          grossProfit: financialSummary.grossProfit || 0,
          grossMargin: financialSummary.grossSales > 0 ? Math.round((financialSummary.grossProfit / financialSummary.grossSales) * 1000) / 10 : 0,
          expensesList: expenseCategoriesData || [],
          totalExpenses: financialSummary.totalExpenses || 0,
          operatingProfit: (financialSummary.grossProfit || 0) - (financialSummary.totalExpenses || 0),
          taxes: financialSummary.totalTaxCollected || 0,
          netProfit: financialSummary.netProfit || 0,
          netMargin: financialSummary.profitMargin || 0
        }}
      />

      {/* Delete Sale Confirmation Modal */}
      {saleToDelete && (
        <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-card p-6 rounded-3xl w-full max-w-lg border border-red-500/40 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-danger/20 text-danger">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-text-main">تأكيد حذف فاتورة المبيعات</h3>
                  <p className="text-[11px] text-text-dim">إلغاء أثر الفاتورة واسترجاع الأصناف للمخزن</p>
                </div>
              </div>
              <button 
                onClick={() => setSaleToDelete(null)}
                disabled={isDeletingSale}
                className="text-text-dim hover:text-danger p-1 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Invoice Details Card */}
            <div className="bg-card2 p-4 rounded-2xl border border-border space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-text-dim font-bold">رقم الفاتورة:</span>
                <span className="font-mono font-black text-text-main bg-card px-2 py-0.5 rounded-lg border border-border">
                  #{saleToDelete.invoiceNumber || saleToDelete.id.slice(-8)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-dim font-bold">العميل:</span>
                <span className="font-bold text-text-main">{saleToDelete.customerName || 'عميل نقدي'}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-dim font-bold">تاريخ المعاملة:</span>
                <span className="text-text-main font-mono">{new Date(saleToDelete.date).toLocaleString('ar-EG')}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-dim font-bold">إجمالي الفاتورة:</span>
                <span className="font-black text-gold text-sm font-mono">{Number(saleToDelete.finalTotal || saleToDelete.total || 0).toLocaleString('ar-EG')} ج.م</span>
              </div>

              {saleToDelete.items && saleToDelete.items.length > 0 && (
                <div className="mt-3 pt-2 border-t border-border">
                  <span className="text-text-dim font-bold block mb-1.5">الأصناف التي سيتم إرجاع كمياتها للمخزن:</span>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                    {saleToDelete.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] bg-card p-1.5 rounded-lg border border-border">
                        <span className="font-bold text-text-main">{item.name || item.productName || 'صنف'}</span>
                        <span className="font-mono font-bold text-green-400">+{item.quantity} في المخزن</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Warning Box */}
            <div className="bg-danger/10 border border-danger/30 p-3 rounded-2xl flex items-start gap-2.5 text-xs text-red-300">
              <AlertTriangle className="text-danger shrink-0 mt-0.5" size={18} />
              <div>
                <strong className="block text-danger font-black mb-0.5">تنبيه محاسبي هام:</strong>
                <span>
                  عند تأكيد الحذف، سيتم إلغاء تأثير الفاتورة تماماً، وإعادة كميات الأصناف المباعة إلى أرصدة المخازن، وتعديل حساب العميل إن كانت الفاتورة آجلة.
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={confirmDeleteSale}
                disabled={isDeletingSale}
                className="flex-1 bg-danger hover:bg-danger/90 text-white py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isDeletingSale ? (
                  <>
                    <RotateCcw className="animate-spin" size={16} />
                    <span>جاري الحذف وتعديل المخزون...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>تأكيد الحذف النهائي</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSaleToDelete(null)}
                disabled={isDeletingSale}
                className="bg-card2 hover:bg-card border border-border text-text-dim hover:text-white px-4 py-2.5 rounded-xl font-bold transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Purchase Invoice Modal */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-card p-6 rounded-3xl w-full max-w-2xl border border-amber-500/40 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-border pb-3 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500">
                  <Receipt size={22} />
                </div>
                <div>
                  <h3 className="font-black text-base text-text-main flex items-center gap-2">
                    <span>تفاصيل فاتورة المشتريات</span>
                    <span className="font-mono text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                      #{viewingPurchase.purchaseNumber || `PUR-${viewingPurchase.id.slice(-6)}`}
                    </span>
                  </h3>
                  <p className="text-[11px] text-text-dim">إذن استلام وتوريد بضائع للمخزن</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingPurchase(null)}
                className="text-text-dim hover:text-danger p-1 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs shrink-0">
              <div className="bg-card2 p-2.5 rounded-2xl border border-border">
                <span className="text-text-dim block text-[10px] font-bold">المورد:</span>
                <span className="font-bold text-text-main truncate block">{viewingPurchase.supplierName || 'مورد عام'}</span>
              </div>
              <div className="bg-card2 p-2.5 rounded-2xl border border-border">
                <span className="text-text-dim block text-[10px] font-bold">رقم فاتورة المورد:</span>
                <span className="font-mono font-bold text-text-main truncate block">{viewingPurchase.invoiceNumber || '-'}</span>
              </div>
              <div className="bg-card2 p-2.5 rounded-2xl border border-border">
                <span className="text-text-dim block text-[10px] font-bold">تاريخ المعاملة:</span>
                <span className="font-mono text-text-main truncate block">
                  {viewingPurchase.date ? new Date(viewingPurchase.date).toLocaleDateString('ar-EG') : '-'}
                </span>
              </div>
              <div className="bg-card2 p-2.5 rounded-2xl border border-border">
                <span className="text-text-dim block text-[10px] font-bold">طريقة السداد:</span>
                <span className={`font-bold text-[11px] ${
                  viewingPurchase.paymentMethod === 'cash' ? 'text-green-400' : 'text-amber-400'
                }`}>
                  {viewingPurchase.paymentMethod === 'cash' ? 'نقدي (Cash)' :
                   viewingPurchase.paymentMethod === 'deferred-full' ? 'آجل بالكامل' : 'سداد جزئي'}
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-y-auto flex-1 border border-border rounded-2xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-card2 text-text-dim border-b border-border sticky top-0 font-bold">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">اسم الصنف</th>
                    <th className="p-3 text-center">الوحدة</th>
                    <th className="p-3 text-center">الكمية</th>
                    <th className="p-3 text-center">سعر الشراء</th>
                    <th className="p-3 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(viewingPurchase.items || []).map((item, idx) => {
                    const buyPrice = Number(item.costPrice || item.buyPrice || item.price || 0);
                    const qty = Number(item.quantity || 1);
                    const subtotal = Number(item.total || (buyPrice * qty));

                    return (
                      <tr key={idx} className="hover:bg-card2/50">
                        <td className="p-3 text-text-dim font-mono">{idx + 1}</td>
                        <td className="p-3 font-bold text-text-main">{item.name || item.productName || 'صنف'}</td>
                        <td className="p-3 text-center text-text-dim">{item.unit || 'قطعة'}</td>
                        <td className="p-3 text-center font-bold font-mono text-text-main">
                          <span className="bg-card2 px-2 py-0.5 rounded-md border border-border">{qty}</span>
                        </td>
                        <td className="p-3 text-center font-mono text-text-dim">{buyPrice.toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-3 text-left font-bold font-mono text-amber-500">{subtotal.toLocaleString('ar-EG')} ج.م</td>
                      </tr>
                    );
                  })}
                  {(!viewingPurchase.items || viewingPurchase.items.length === 0) && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-text-dim text-xs">
                        لا توجد بنود مسجلة في هذه الفاتورة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Summary & Notes */}
            <div className="bg-card2 p-4 rounded-2xl border border-border space-y-2 text-xs shrink-0">
              <div className="flex justify-between items-center">
                <span className="text-text-dim">إجمالي الفاتورة:</span>
                <span className="font-black text-amber-500 font-mono text-sm">
                  {Number(viewingPurchase.total || 0).toLocaleString('ar-EG')} ج.م
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-text-dim">المبلغ المسدد للمورد:</span>
                <span className="font-bold text-green-400 font-mono">
                  {Number(viewingPurchase.paidAmount || (viewingPurchase.paymentMethod === 'cash' ? viewingPurchase.total : 0)).toLocaleString('ar-EG')} ج.م
                </span>
              </div>
              {Number(viewingPurchase.total || 0) - Number(viewingPurchase.paidAmount || (viewingPurchase.paymentMethod === 'cash' ? viewingPurchase.total : 0)) > 0 && (
                <div className="flex justify-between items-center text-danger font-bold">
                  <span>المتبقي في حساب المورد (آجل):</span>
                  <span className="font-mono">
                    {(Number(viewingPurchase.total || 0) - Number(viewingPurchase.paidAmount || 0)).toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              )}
              {viewingPurchase.notes && (
                <div className="pt-2 border-t border-border text-[11px] text-text-dim">
                  <span className="font-bold text-text-main ml-1">ملاحظات:</span>
                  <span>{viewingPurchase.notes}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1 shrink-0">
              <button
                type="button"
                onClick={() => setViewingPurchase(null)}
                className="flex-1 bg-card2 hover:bg-card border border-border text-text-main py-2.5 rounded-xl font-bold transition-all text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Purchase Confirmation Modal */}
      {purchaseToDelete && (
        <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-card p-6 rounded-3xl w-full max-w-lg border border-red-500/40 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-danger/20 text-danger">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-text-main">تأكيد حذف فاتورة المشتريات</h3>
                  <p className="text-[11px] text-text-dim">إلغاء أثر الفاتورة وخصم الكميات من المخزن</p>
                </div>
              </div>
              <button 
                onClick={() => setPurchaseToDelete(null)}
                disabled={isDeletingPurchase}
                className="text-text-dim hover:text-danger p-1 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Purchase Details Card */}
            <div className="bg-card2 p-4 rounded-2xl border border-border space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-text-dim font-bold">رقم الفاتورة:</span>
                <span className="font-mono font-black text-text-main bg-card px-2 py-0.5 rounded-lg border border-border">
                  #{purchaseToDelete.purchaseNumber || `PUR-${purchaseToDelete.id.slice(-6)}`}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-dim font-bold">المورد:</span>
                <span className="font-bold text-text-main">{purchaseToDelete.supplierName || 'مورد عام'}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-dim font-bold">تاريخ المعاملة:</span>
                <span className="text-text-main font-mono">
                  {purchaseToDelete.date ? new Date(purchaseToDelete.date).toLocaleString('ar-EG') : '-'}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-text-dim font-bold">إجمالي الفاتورة:</span>
                <span className="font-black text-amber-500 text-sm font-mono">
                  {Number(purchaseToDelete.total || 0).toLocaleString('ar-EG')} ج.م
                </span>
              </div>

              {purchaseToDelete.items && purchaseToDelete.items.length > 0 && (
                <div className="mt-3 pt-2 border-t border-border">
                  <span className="text-text-dim font-bold block mb-1.5">الأصناف التي سيتم خصم كمياتها من المخزن:</span>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                    {purchaseToDelete.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] bg-card p-1.5 rounded-lg border border-border">
                        <span className="font-bold text-text-main">{item.name || item.productName || 'صنف'}</span>
                        <span className="font-mono font-bold text-danger">-{item.quantity} من المخزن</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Warning Box */}
            <div className="bg-danger/10 border border-danger/30 p-3 rounded-2xl flex items-start gap-2.5 text-xs text-red-300">
              <AlertTriangle className="text-danger shrink-0 mt-0.5" size={18} />
              <div>
                <strong className="block text-danger font-black mb-0.5">تنبيه محاسبي هام:</strong>
                <span>
                  عند تأكيد الحذف، سيتم إلغاء تأثير الفاتورة تماماً، وخصم كميات الأصناف المشتراة من أرصدة المخازن، وتعديل حساب المورد إن كانت الفاتورة آجلة.
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={confirmDeletePurchase}
                disabled={isDeletingPurchase}
                className="flex-1 bg-danger hover:bg-danger/90 text-white py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isDeletingPurchase ? (
                  <>
                    <RotateCcw className="animate-spin" size={16} />
                    <span>جاري الحذف وتعديل المخزون...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>تأكيد الحذف النهائي</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setPurchaseToDelete(null)}
                disabled={isDeletingPurchase}
                className="bg-card2 hover:bg-card border border-border text-text-dim hover:text-white px-4 py-2.5 rounded-xl font-bold transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
