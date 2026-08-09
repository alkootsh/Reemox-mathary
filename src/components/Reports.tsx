import React, { useState, useMemo } from 'react';
import { Purchase, Sale, Product, Expense, Customer, Supplier, BusinessType } from '../types/types';
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
  CheckCircle2
} from 'lucide-react';
import FinancialRatiosCard, { FinancialRatiosData } from './reports/FinancialRatiosCard';
import AbcAnalysisCard from './reports/AbcAnalysisCard';
import PeakHoursChart from './reports/PeakHoursChart';
import CategoryBreakdown from './reports/CategoryBreakdown';
import CashFlowCard, { CashFlowData } from './reports/CashFlowCard';
import IncomeStatementModal from './reports/IncomeStatementModal';

interface Props {
  purchases?: Purchase[];
  sales?: Sale[];
  products?: Product[];
  expenses?: Expense[];
  customers?: Customer[];
  suppliers?: Supplier[];
}

export type ReportTab = 
  | 'overview' 
  | 'analytics' 
  | 'abc' 
  | 'peakhours' 
  | 'categories' 
  | 'cashflow' 
  | 'sales' 
  | 'products' 
  | 'customers' 
  | 'suppliers' 
  | 'expenses' 
  | 'inventory' 
  | 'tax';

type DatePreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'custom';

const COLORS = ['#F59E0B', '#10B981', '#38BDF8', '#818CF8', '#F43F5E', '#EC4899', '#8B5CF6', '#14B8A6'];

export default function Reports({
  purchases = [],
  sales = [],
  products = [],
  expenses = [],
  customers = [],
  suppliers = []
}: Props) {
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [isIncomeStatementOpen, setIsIncomeStatementOpen] = useState<boolean>(false);

  // Fast Product Lookup Map for Cost Calculation
  const productsMap = useMemo(() => {
    const map = new Map<string, Product>();
    (products || []).forEach(p => {
      if (p && p.id) map.set(p.id, p);
    });
    return map;
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

  // Filtered Datasets
  const filteredSales = useMemo(() => {
    return (sales || []).filter(s => {
      if (!s) return false;
      if (!isDateInRange(s.date)) return false;
      if (selectedPaymentMethod !== 'all' && (s.paymentMethod || 'cash') !== selectedPaymentMethod) {
        return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const cust = (s.customerName || '').toLowerCase();
        const inv = (s.invoiceNumber || s.id || '').toLowerCase();
        return cust.includes(term) || inv.includes(term);
      }
      return true;
    });
  }, [sales, dateRange, selectedPaymentMethod, searchTerm]);

  const filteredPurchases = useMemo(() => {
    return (purchases || []).filter(p => p && isDateInRange(p.date));
  }, [purchases, dateRange]);

  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter(e => e && isDateInRange(e.date));
  }, [expenses, dateRange]);

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

    const prevSalesList = (sales || []).filter(s => {
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
                  exportToCSV(filteredSales, 'تقرير_المبيعات', {
                    invoiceNumber: 'رقم الفاتورة',
                    date: 'التاريخ',
                    customerName: 'اسم العميل',
                    paymentMethod: 'طريقة الدفع',
                    finalTotal: 'الإجمالي (ج.م)',
                    status: 'الحالة'
                  });
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
            { id: 'products', label: 'أرباح الأصناف', icon: '📦' },
            { id: 'customers', label: 'ديون العملاء', icon: '👥' },
            { id: 'suppliers', label: 'مستحقات الموردين', icon: '🚚' },
            { id: 'expenses', label: 'تحليل المصروفات', icon: '📉' },
            { id: 'inventory', label: 'المخزون والنواقص', icon: '⚠️' },
            { id: 'tax', label: 'الإقرار الضريبي (VAT)', icon: '🧾' }
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
                {financialSummary.totalCustomerDebt.toLocaleString('ar-EG')} ج.م
              </div>
              <div className="text-[11px] text-text-dim mt-1">مستحقات واجبة التحصيل</div>
            </div>

            <div className="bg-card p-4 rounded-3xl border border-border">
              <div className="text-text-dim text-xs font-bold mb-1">مستحق للموردين (علينا)</div>
              <div className="text-xl font-black text-amber-400">
                {financialSummary.totalSupplierDebt.toLocaleString('ar-EG')} ج.م
              </div>
              <div className="text-[11px] text-text-dim mt-1">فواتير شراء آجلة مستحقة السداد</div>
            </div>

            <div className="bg-card p-4 rounded-3xl border border-border">
              <div className="text-text-dim text-xs font-bold mb-1">قيمة المخزون الحالي (بالتكلفة)</div>
              <div className="text-xl font-black text-accent">
                {financialSummary.inventoryCostValue.toLocaleString('ar-EG')} ج.م
              </div>
              <div className="text-[11px] text-text-dim mt-1">
                سعر البيع المتوقع: {financialSummary.inventorySaleValue.toLocaleString('ar-EG')} ج.م
              </div>
            </div>
          </div>

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
                  {financialSummary.grossSales.toLocaleString('ar-EG')} <span className="text-[10px] font-normal text-text-dim">ج.م</span>
                </span>
                <span className="text-[10px] text-text-dim">إيراد النشاط التجاري</span>
              </div>

              <div className="bg-card2 p-3.5 rounded-2xl border border-border flex flex-col justify-between">
                <span className="text-xs text-text-dim font-bold">2. (-) تكلفة البضاعة (COGS)</span>
                <span className="text-lg font-black text-amber-500 mt-2">
                  {financialSummary.totalCogs.toLocaleString('ar-EG')} <span className="text-[10px] font-normal text-text-dim">ج.م</span>
                </span>
                <span className="text-[10px] text-text-dim">تكلفة المخزون المباع</span>
              </div>

              <div className="bg-card2 p-3.5 rounded-2xl border border-border flex flex-col justify-between">
                <span className="text-xs text-text-dim font-bold">3. (=) مجمل الربح</span>
                <span className="text-lg font-black text-emerald-400 mt-2">
                  {financialSummary.grossProfit.toLocaleString('ar-EG')} <span className="text-[10px] font-normal text-text-dim">ج.م</span>
                </span>
                <span className="text-[10px] text-gold font-bold">هامش: {financialSummary.grossSales > 0 ? Math.round((financialSummary.grossProfit / financialSummary.grossSales) * 100) : 0}%</span>
              </div>

              <div className="bg-card2 p-3.5 rounded-2xl border border-border flex flex-col justify-between">
                <span className="text-xs text-text-dim font-bold">4. (-) المصروفات</span>
                <span className="text-lg font-black text-danger mt-2">
                  {financialSummary.totalExpenses.toLocaleString('ar-EG')} <span className="text-[10px] font-normal text-text-dim">ج.م</span>
                </span>
                <span className="text-[10px] text-text-dim">إيجار، رواتب، كهرباء، إلخ</span>
              </div>

              <div className={`p-3.5 rounded-2xl border flex flex-col justify-between ${
                financialSummary.netProfit >= 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
              }`}>
                <span className="text-xs font-bold text-text-main">5. (=) صافي الربح</span>
                <span className={`text-lg font-black mt-2 ${financialSummary.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {financialSummary.netProfit.toLocaleString('ar-EG')} <span className="text-[10px] font-normal text-text-dim">ج.م</span>
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

            <div className="flex items-center gap-2 w-full sm:w-auto">
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
            </div>
          </div>

          <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-card2 text-text-dim border-b border-border font-bold">
                  <tr>
                    <th className="p-3.5">رقم الفاتورة</th>
                    <th className="p-3.5">التاريخ والوقت</th>
                    <th className="p-3.5">العميل</th>
                    <th className="p-3.5">طريقة الدفع</th>
                    <th className="p-3.5">عدد البنود</th>
                    <th className="p-3.5">إجمالي الفاتورة</th>
                    <th className="p-3.5">المدفوع</th>
                    <th className="p-3.5">المتبقي</th>
                    <th className="p-3.5">الحالة</th>
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
                        <td className="p-3.5 font-mono font-bold text-text-main">
                          {sale.invoiceNumber || sale.id.slice(0, 8)}
                        </td>
                        <td className="p-3.5 text-text-dim">
                          {sale.date ? new Date(sale.date).toLocaleDateString('ar-EG') : '-'}
                        </td>
                        <td className="p-3.5 font-bold text-text-main">
                          {sale.customerName || 'عميل نقدي'}
                        </td>
                        <td className="p-3.5">
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
                        <td className="p-3.5 text-text-dim">{itemCount} قطعة</td>
                        <td className="p-3.5 font-black text-text-main">{total.toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-3.5 font-bold text-green-400">{paid.toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-3.5 font-bold text-danger">{rem > 0 ? `${rem.toLocaleString('ar-EG')} ج.م` : '-'}</td>
                        <td className="p-3.5">
                          <span className="bg-card2 px-2 py-0.5 rounded-md text-[10px] font-bold text-text-dim">
                            {sale.status || 'مكتمل'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSales.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-text-dim text-xs">
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

      {/* Income Statement (P&L) Printable Modal */}
      <IncomeStatementModal
        isOpen={isIncomeStatementOpen}
        onClose={() => setIsIncomeStatementOpen(false)}
        dateRangeLabel={dateRangeLabel}
        financials={{
          grossSales: financialSummary.grossSales,
          discounts: financialSummary.totalDiscount,
          netSales: Math.max(0, financialSummary.grossSales - financialSummary.totalDiscount),
          cogs: financialSummary.totalCogs,
          grossProfit: financialSummary.grossProfit,
          grossMargin: financialSummary.grossSales > 0 ? Math.round((financialSummary.grossProfit / financialSummary.grossSales) * 1000) / 10 : 0,
          expensesList: expenseCategoriesData,
          totalExpenses: financialSummary.totalExpenses,
          operatingProfit: financialSummary.grossProfit - financialSummary.totalExpenses,
          taxes: financialSummary.totalTaxCollected,
          netProfit: financialSummary.netProfit,
          netMargin: financialSummary.profitMargin
        }}
      />
    </div>
  );
}
