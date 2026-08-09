import React, { useState, useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  ComposedChart,
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  ReferenceLine
} from 'recharts';
import { Sale, Purchase, Expense, Product } from '../types/types';
import { 
  TrendingUp, 
  Calendar, 
  CreditCard, 
  DollarSign, 
  ShoppingBag, 
  BarChart3, 
  PieChart as PieIcon, 
  Layers,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Zap,
  Sparkles,
  Award,
  ChevronRight,
  Filter,
  CheckCircle2
} from 'lucide-react';

interface SalesChartsProps {
  sales: Sale[];
  purchases?: Purchase[];
  expenses?: Expense[];
  products?: Product[];
}

type MainTab = 'daily' | 'monthly' | 'hourly' | 'composed' | 'payments' | 'topProducts';
type DailyTimeframe = '7days' | '14days' | '30days';
type MonthlyTimeframe = '6months' | '12months';
type MetricView = 'volume' | 'count' | 'average' | 'profit';
type ChartStyle = 'area' | 'bar' | 'composed';

const COLORS = ['#e94560', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function SalesCharts({ 
  sales = [], 
  purchases = [], 
  expenses = [], 
  products = [] 
}: SalesChartsProps) {
  const [activeTab, setActiveTab] = useState<MainTab>('daily');
  const [dailyTimeframe, setDailyTimeframe] = useState<DailyTimeframe>('7days');
  const [monthlyTimeframe, setMonthlyTimeframe] = useState<MonthlyTimeframe>('6months');
  const [metricView, setMetricView] = useState<MetricView>('volume');
  const [chartStyle, setChartStyle] = useState<ChartStyle>('area');
  const [showAverageLine, setShowAverageLine] = useState<boolean>(true);

  // Products cost lookup map for quick profit calculations
  const productsCostMap = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach(p => {
      if (p.id) map.set(p.id, Number(p.cost || (p.price ? p.price * 0.7 : 0)));
      if (p.sku) map.set(p.sku, Number(p.cost || (p.price ? p.price * 0.7 : 0)));
    });
    return map;
  }, [products]);

  // Helper to calculate cost of sold item
  const getItemCost = (item: any): number => {
    if (item.cost !== undefined && item.cost > 0) return Number(item.cost);
    if (item.productId && productsCostMap.has(item.productId)) return productsCostMap.get(item.productId)!;
    if (item.sku && productsCostMap.has(item.sku)) return productsCostMap.get(item.sku)!;
    if (item.product?.cost) return Number(item.product.cost);
    const price = Number(item.price || 0);
    return price * 0.7; // Standard 30% margin fallback
  };

  // --- 1. PROCESS DAILY SALES VOLUME DATA ---
  const dailySalesData = useMemo(() => {
    const daysCount = dailyTimeframe === '7days' ? 7 : dailyTimeframe === '14days' ? 14 : 30;
    const now = new Date();
    const result: {
      dateKey: string;
      dateLabel: string;
      dayOfWeek: string;
      sales: number;
      profit: number;
      cogs: number;
      count: number;
      itemsCount: number;
      average: number;
    }[] = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const dateLabel = d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
      const dayOfWeek = d.toLocaleDateString('ar-EG', { weekday: 'short' });

      // Filter sales on this specific date
      const daySales = sales.filter(s => s.date && s.date.startsWith(dateKey));
      let totalAmount = 0;
      let totalCogs = 0;
      let totalItems = 0;

      daySales.forEach(s => {
        const val = Number(s.finalTotal || s.total || 0);
        totalAmount += val;
        if (Array.isArray(s.items)) {
          s.items.forEach(item => {
            const qty = Number(item.quantity || 0);
            totalItems += qty;
            totalCogs += getItemCost(item) * qty;
          });
        }
      });

      const count = daySales.length;
      const profit = Math.max(0, totalAmount - totalCogs);
      const average = count > 0 ? Math.round(totalAmount / count) : 0;

      result.push({
        dateKey,
        dateLabel,
        dayOfWeek,
        sales: Math.round(totalAmount),
        profit: Math.round(profit),
        cogs: Math.round(totalCogs),
        count,
        itemsCount: totalItems,
        average
      });
    }
    return result;
  }, [sales, dailyTimeframe, productsCostMap]);

  // Average and Peak stats for Daily Range
  const dailyStats = useMemo(() => {
    if (dailySalesData.length === 0) {
      return { totalSales: 0, totalCount: 0, averageSales: 0, peakDay: null, lowestDay: null };
    }
    const totalSales = dailySalesData.reduce((acc, d) => acc + d.sales, 0);
    const totalCount = dailySalesData.reduce((acc, d) => acc + d.count, 0);
    const averageSales = Math.round(totalSales / dailySalesData.length);
    const peakDay = dailySalesData.reduce((prev, curr) => (curr.sales > prev.sales ? curr : prev), dailySalesData[0]);
    const lowestDay = dailySalesData.reduce((prev, curr) => (curr.sales < prev.sales ? curr : prev), dailySalesData[0]);

    return { totalSales, totalCount, averageSales, peakDay, lowestDay };
  }, [dailySalesData]);

  // --- 2. PROCESS MONTHLY SALES VOLUME DATA ---
  const monthlyData = useMemo(() => {
    const monthsArabic = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    const monthsCount = monthlyTimeframe === '6months' ? 6 : 12;
    const now = new Date();
    const result: {
      monthKey: string;
      monthName: string;
      shortMonth: string;
      sales: number;
      purchases: number;
      expenses: number;
      profit: number;
      invoicesCount: number;
      growthPercentage: number;
    }[] = [];

    let prevMonthSales = 0;

    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      const monthName = `${monthsArabic[monthIndex]} ${year}`;
      const shortMonth = monthsArabic[monthIndex];

      const monthSalesList = sales.filter(s => s.date && s.date.startsWith(monthPrefix));
      const monthSales = monthSalesList.reduce((sum, s) => sum + (s.finalTotal || s.total || 0), 0);
      const invoicesCount = monthSalesList.length;

      const monthPurchases = purchases
        .filter(p => p.date && p.date.startsWith(monthPrefix))
        .reduce((sum, p) => sum + (p.total || 0), 0);

      const monthExpenses = expenses
        .filter(e => e.date && e.date.startsWith(monthPrefix))
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      // Estimated gross/operating profit
      const estimatedNet = Math.max(0, monthSales - monthPurchases - monthExpenses);

      const growthPercentage = prevMonthSales > 0 
        ? Math.round(((monthSales - prevMonthSales) / prevMonthSales) * 1000) / 10 
        : 0;

      prevMonthSales = monthSales;

      result.push({
        monthKey: monthPrefix,
        monthName,
        shortMonth,
        sales: Math.round(monthSales),
        purchases: Math.round(monthPurchases),
        expenses: Math.round(monthExpenses),
        profit: Math.round(estimatedNet),
        invoicesCount,
        growthPercentage
      });
    }
    return result;
  }, [sales, purchases, expenses, monthlyTimeframe]);

  // Monthly stats
  const monthlyStats = useMemo(() => {
    const totalSales = monthlyData.reduce((acc, m) => acc + m.sales, 0);
    const totalPurchases = monthlyData.reduce((acc, m) => acc + m.purchases, 0);
    const totalExpenses = monthlyData.reduce((acc, m) => acc + m.expenses, 0);
    const totalProfit = monthlyData.reduce((acc, m) => acc + m.profit, 0);
    const averageMonthlySales = monthlyData.length > 0 ? Math.round(totalSales / monthlyData.length) : 0;
    const peakMonth = monthlyData.reduce((prev, curr) => (curr.sales > prev.sales ? curr : prev), monthlyData[0] || { monthName: '---', sales: 0 });

    return { totalSales, totalPurchases, totalExpenses, totalProfit, averageMonthlySales, peakMonth };
  }, [monthlyData]);

  // --- 3. PROCESS HOURLY SALES PULSE (TODAY / ALL-TIME) ---
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      hourLabel: i === 0 ? '12 ص' : i < 12 ? `${i} ص` : i === 12 ? '12 م' : `${i - 12} م`,
      sales: 0,
      count: 0
    }));

    // Scan all sales with timestamps
    sales.forEach(sale => {
      if (!sale.date) return;
      const dateObj = new Date(sale.date);
      if (isNaN(dateObj.getTime())) return;
      const h = dateObj.getHours();
      if (h >= 0 && h < 24) {
        hours[h].sales += Number(sale.finalTotal || sale.total || 0);
        hours[h].count += 1;
      }
    });

    return hours.map(h => ({
      ...h,
      sales: Math.round(h.sales)
    }));
  }, [sales]);

  // Peak Hour
  const peakHour = useMemo(() => {
    return hourlyData.reduce((prev, curr) => (curr.sales > prev.sales ? curr : prev), hourlyData[0]);
  }, [hourlyData]);

  // --- 4. PROCESS PAYMENT METHODS DISTRIBUTION ---
  const paymentMethodsData = useMemo(() => {
    let cash = 0;
    let card = 0;
    let wallet = 0;
    let credit = 0;

    sales.forEach(sale => {
      if (sale.payments && sale.payments.length > 0) {
        sale.payments.forEach(p => {
          if (p.method === 'CASH') cash += p.amount;
          else if (p.method === 'CARD') card += p.amount;
          else if (p.method === 'WALLET') wallet += p.amount;
          else if (p.method === 'CREDIT') credit += p.amount;
        });
      } else {
        cash += (sale.finalTotal || sale.total || 0);
      }
    });

    const total = cash + card + wallet + credit;
    if (total === 0) {
      return [{ name: 'نقدى (Cash)', value: 1, amount: 0, percentage: '100%' }];
    }

    return [
      { name: 'نقدى (Cash)', value: cash, amount: cash, percentage: `${Math.round((cash / total) * 100)}%` },
      { name: 'بطاقة (Card / Visa)', value: card, amount: card, percentage: `${Math.round((card / total) * 100)}%` },
      { name: 'محفظة (Wallet / InstaPay)', value: wallet, amount: wallet, percentage: `${Math.round((wallet / total) * 100)}%` },
      { name: 'آجل (Credit)', value: credit, amount: credit, percentage: `${Math.round((credit / total) * 100)}%` },
    ].filter(item => item.value > 0);
  }, [sales]);

  // --- 5. TOP SELLING PRODUCTS ---
  const topProductsData = useMemo(() => {
    const productStats: Record<string, { name: string; quantity: number; revenue: number; profit: number }> = {};

    sales.forEach(sale => {
      sale.items?.forEach(item => {
        const prodName = item.name || item.product?.name || 'منتج عام';
        if (!productStats[prodName]) {
          productStats[prodName] = { name: prodName, quantity: 0, revenue: 0, profit: 0 };
        }
        const qty = item.quantity || 0;
        const rev = (item.price || 0) * qty;
        const cost = getItemCost(item) * qty;
        productStats[prodName].quantity += qty;
        productStats[prodName].revenue += rev;
        productStats[prodName].profit += Math.max(0, rev - cost);
      });
    });

    return Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [sales, productsCostMap]);

  // Executive KPI summary numbers
  const executiveKPIs = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const todaySalesList = sales.filter(s => s.date && s.date.startsWith(todayStr));
    const todaySales = todaySalesList.reduce((sum, s) => sum + (s.finalTotal || s.total || 0), 0);
    const todayCount = todaySalesList.length;

    const yesterdaySalesList = sales.filter(s => s.date && s.date.startsWith(yesterdayStr));
    const yesterdaySales = yesterdaySalesList.reduce((sum, s) => sum + (s.finalTotal || s.total || 0), 0);

    const todayGrowth = yesterdaySales > 0 
      ? Math.round(((todaySales - yesterdaySales) / yesterdaySales) * 1000) / 10 
      : 0;

    const thisMonthPrefix = new Date().toISOString().substring(0, 7);
    const thisMonthSales = sales
      .filter(s => s.date && s.date.startsWith(thisMonthPrefix))
      .reduce((sum, s) => sum + (s.finalTotal || s.total || 0), 0);

    const totalSalesSum = sales.reduce((sum, s) => sum + (s.finalTotal || s.total || 0), 0);
    const totalInvoices = sales.length;
    const aov = totalInvoices > 0 ? Math.round(totalSalesSum / totalInvoices) : 0;

    return {
      todaySales,
      todayCount,
      todayGrowth,
      thisMonthSales,
      totalSalesSum,
      totalInvoices,
      aov
    };
  }, [sales]);

  // Custom Rich Tooltip for Daily & Monthly Charts
  const CustomDailyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-card/95 backdrop-blur-md p-3.5 rounded-2xl border border-border shadow-2xl text-xs space-y-2 min-w-[200px] z-50">
          <div className="flex items-center justify-between border-b border-border pb-1.5 font-bold">
            <span className="text-text-main">{dataPoint.dayOfWeek ? `${dataPoint.dayOfWeek}، ` : ''}{dataPoint.dateLabel || label}</span>
            <span className="text-[10px] text-text-dim font-mono">{dataPoint.dateKey || ''}</span>
          </div>

          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-text-dim flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gold"></span>
                <span>حجم المبيعات:</span>
              </span>
              <span className="font-mono font-black text-gold">
                {Number(dataPoint.sales || 0).toLocaleString()} ج.م
              </span>
            </div>

            {dataPoint.profit !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-text-dim flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>صافي الربح:</span>
                </span>
                <span className="font-mono font-black text-emerald-400">
                  {Number(dataPoint.profit || 0).toLocaleString()} ج.م
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-text-dim flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                <span>عدد الفواتير:</span>
              </span>
              <span className="font-mono font-black text-text-main">
                {dataPoint.count || 0} فاتورة
              </span>
            </div>

            {dataPoint.average > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-border/60 text-[10px]">
                <span className="text-text-dim">متوسط الفاتورة:</span>
                <span className="font-mono font-bold text-text-main">
                  {dataPoint.average.toLocaleString()} ج.م
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Monthly Tooltip
  const CustomMonthlyTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-card/95 backdrop-blur-md p-3.5 rounded-2xl border border-border shadow-2xl text-xs space-y-2 min-w-[210px] z-50">
          <div className="flex items-center justify-between border-b border-border pb-1.5 font-bold">
            <span className="text-text-main">{dataPoint.monthName || label}</span>
            {dataPoint.growthPercentage !== 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                dataPoint.growthPercentage >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
              }`}>
                {dataPoint.growthPercentage >= 0 ? '+' : ''}{dataPoint.growthPercentage}%
              </span>
            )}
          </div>

          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between">
              <span className="text-text-dim flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gold"></span>
                <span>المبيعات:</span>
              </span>
              <span className="font-mono font-black text-gold">
                {Number(dataPoint.sales || 0).toLocaleString()} ج.م
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-text-dim flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                <span>المشتريات:</span>
              </span>
              <span className="font-mono font-bold text-blue-400">
                {Number(dataPoint.purchases || 0).toLocaleString()} ج.م
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-text-dim flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span>المصروفات:</span>
              </span>
              <span className="font-mono font-bold text-amber-400">
                {Number(dataPoint.expenses || 0).toLocaleString()} ج.م
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-border/80">
              <span className="font-bold text-text-main flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>صافي الربح:</span>
              </span>
              <span className="font-mono font-black text-emerald-400">
                {Number(dataPoint.profit || 0).toLocaleString()} ج.م
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card rounded-3xl border border-border p-4 sm:p-6 space-y-6 shadow-sm">
      {/* Header & Main Tabs Navigation */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-gold/10 text-gold">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-text-main flex items-center gap-2">
                <span>لوحة إحصائيات المبيعات البيانية للمدير</span>
                <span className="bg-gold/20 text-gold text-[10px] font-bold px-2 py-0.5 rounded-full border border-gold/30">
                  Recharts Analytics
                </span>
              </h3>
              <p className="text-xs text-text-dim mt-0.5">
                متابعة حركة وحجم المبيعات اليومية والشهرية ومعدلات النمو بالأرقام والرسوم البيانية
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-card2 p-1 rounded-2xl border border-border text-xs font-bold overflow-x-auto w-full lg:w-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'daily' ? 'bg-gold text-white shadow-md' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <TrendingUp size={14} />
            <span>المبيعات اليومية</span>
          </button>

          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'monthly' ? 'bg-gold text-white shadow-md' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <Calendar size={14} />
            <span>المبيعات الشهرية</span>
          </button>

          <button
            onClick={() => setActiveTab('hourly')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'hourly' ? 'bg-gold text-white shadow-md' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <Clock size={14} />
            <span>ساعات الذروة</span>
          </button>

          <button
            onClick={() => setActiveTab('composed')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'composed' ? 'bg-gold text-white shadow-md' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <Layers size={14} />
            <span>تحليل مركب</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'payments' ? 'bg-gold text-white shadow-md' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <CreditCard size={14} />
            <span>طرق الدفع</span>
          </button>

          <button
            onClick={() => setActiveTab('topProducts')}
            className={`px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'topProducts' ? 'bg-gold text-white shadow-md' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <ShoppingBag size={14} />
            <span>الأكثر مبيعاً</span>
          </button>
        </div>
      </div>

      {/* Executive Quick Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Card 1: Today's Sales */}
        <div className="bg-card2 p-3.5 rounded-2xl border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-dim text-xs">
            <span className="font-bold">مبيعات اليوم</span>
            <div className="p-1 rounded-lg bg-gold/10 text-gold">
              <Zap size={13} />
            </div>
          </div>
          <div className="my-1.5">
            <div className="text-xl font-black text-gold font-mono">
              {executiveKPIs.todaySales.toLocaleString('ar-EG')} <span className="text-xs font-normal text-text-dim">ج.م</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-text-dim pt-1 border-t border-border/60">
            <span>{executiveKPIs.todayCount} فواتير اليوم</span>
            {executiveKPIs.todayGrowth !== 0 && (
              <span className={`flex items-center font-bold ${
                executiveKPIs.todayGrowth >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {executiveKPIs.todayGrowth >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                {Math.abs(executiveKPIs.todayGrowth)}%
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Current Month Sales */}
        <div className="bg-card2 p-3.5 rounded-2xl border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-dim text-xs">
            <span className="font-bold">مبيعات الشهر الحالي</span>
            <div className="p-1 rounded-lg bg-blue-500/10 text-blue-400">
              <Calendar size={13} />
            </div>
          </div>
          <div className="my-1.5">
            <div className="text-xl font-black text-blue-400 font-mono">
              {executiveKPIs.thisMonthSales.toLocaleString('ar-EG')} <span className="text-xs font-normal text-text-dim">ج.م</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-text-dim pt-1 border-t border-border/60">
            <span>الشهر الجاري (MTD)</span>
            <span className="text-text-main font-bold">نشط</span>
          </div>
        </div>

        {/* Card 3: Daily Average */}
        <div className="bg-card2 p-3.5 rounded-2xl border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-dim text-xs">
            <span className="font-bold">المتوسط اليومي للفترة</span>
            <div className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Activity size={13} />
            </div>
          </div>
          <div className="my-1.5">
            <div className="text-xl font-black text-emerald-400 font-mono">
              {dailyStats.averageSales.toLocaleString('ar-EG')} <span className="text-xs font-normal text-text-dim">ج.م/يوم</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-text-dim pt-1 border-t border-border/60">
            <span>معدل السيولة اليومية</span>
            <span className="font-bold text-text-main">{dailySalesData.length} يوم</span>
          </div>
        </div>

        {/* Card 4: Peak Day & AOV */}
        <div className="bg-card2 p-3.5 rounded-2xl border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between text-text-dim text-xs">
            <span className="font-bold">متوسط الفاتورة (AOV)</span>
            <div className="p-1 rounded-lg bg-purple-500/10 text-purple-400">
              <ShoppingBag size={13} />
            </div>
          </div>
          <div className="my-1.5">
            <div className="text-xl font-black text-purple-400 font-mono">
              {executiveKPIs.aov.toLocaleString('ar-EG')} <span className="text-xs font-normal text-text-dim">ج.م</span>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-text-dim pt-1 border-t border-border/60">
            <span>إجمالي الفواتير</span>
            <span className="font-bold text-text-main">{executiveKPIs.totalInvoices} فاتورة</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: DAILY SALES VOLUME ANALYSIS (RECHARTS)
          ========================================================================= */}
      {activeTab === 'daily' && (
        <div className="space-y-4">
          {/* Controls Bar for Daily Chart */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card2/60 p-3 rounded-2xl border border-border">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-text-main">النطاق الزمني:</span>
              <div className="flex bg-card p-0.5 rounded-xl border border-border text-xs font-bold">
                <button
                  onClick={() => setDailyTimeframe('7days')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    dailyTimeframe === '7days' ? 'bg-gold text-white shadow-sm' : 'text-text-dim hover:text-text-main'
                  }`}
                >
                  آخر 7 أيام
                </button>
                <button
                  onClick={() => setDailyTimeframe('14days')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    dailyTimeframe === '14days' ? 'bg-gold text-white shadow-sm' : 'text-text-dim hover:text-text-main'
                  }`}
                >
                  آخر 14 يوم
                </button>
                <button
                  onClick={() => setDailyTimeframe('30days')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    dailyTimeframe === '30days' ? 'bg-gold text-white shadow-sm' : 'text-text-dim hover:text-text-main'
                  }`}
                >
                  آخر 30 يوم
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              {/* Metric Type Selector */}
              <div className="flex bg-card p-0.5 rounded-xl border border-border text-xs font-bold">
                <button
                  onClick={() => setMetricView('volume')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all ${
                    metricView === 'volume' ? 'bg-gold text-white' : 'text-text-dim'
                  }`}
                >
                  المبيعات (ج.م)
                </button>
                <button
                  onClick={() => setMetricView('profit')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all ${
                    metricView === 'profit' ? 'bg-emerald-600 text-white' : 'text-text-dim'
                  }`}
                >
                  المبيعات والربح
                </button>
                <button
                  onClick={() => setMetricView('count')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all ${
                    metricView === 'count' ? 'bg-blue-600 text-white' : 'text-text-dim'
                  }`}
                >
                  عدد الفواتير
                </button>
              </div>

              {/* Chart Style Toggle */}
              <div className="flex bg-card p-0.5 rounded-xl border border-border text-xs font-bold">
                <button
                  onClick={() => setChartStyle('area')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all ${
                    chartStyle === 'area' ? 'bg-gold/20 text-gold font-black' : 'text-text-dim'
                  }`}
                  title="مساحة انسيابية"
                >
                  Area
                </button>
                <button
                  onClick={() => setChartStyle('bar')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all ${
                    chartStyle === 'bar' ? 'bg-gold/20 text-gold font-black' : 'text-text-dim'
                  }`}
                  title="أعمدة رأسية"
                >
                  Bar
                </button>
              </div>
            </div>
          </div>

          {/* Recharts Daily Chart Display */}
          <div className="bg-card2/30 p-4 rounded-3xl border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-text-dim flex items-center gap-1.5">
                <TrendingUp size={14} className="text-gold" />
                <span>
                  منحنى حجم المبيعات اليومية 
                  ({dailyTimeframe === '7days' ? 'الأسبوع الحالي' : dailyTimeframe === '14days' ? 'آخر أسبوعين' : 'الشهر الأخير'})
                </span>
              </span>

              {dailyStats.peakDay && (
                <span className="text-[11px] bg-gold/10 text-gold border border-gold/30 px-2.5 py-0.5 rounded-full font-bold">
                  أعلى يوم: {dailyStats.peakDay.dayOfWeek} {dailyStats.peakDay.dateLabel} ({dailyStats.peakDay.sales.toLocaleString('ar-EG')} ج.م)
                </span>
              )}
            </div>

            <div className="h-80 w-full pt-3">
              <ResponsiveContainer width="100%" height="100%">
                {chartStyle === 'area' ? (
                  <AreaChart data={dailySalesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e94560" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#e94560" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis 
                      dataKey="dateLabel" 
                      tick={{ fontSize: 11, fill: '#8892a4' }} 
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: '#8892a4' }} 
                      tickLine={false}
                      tickFormatter={(val) => val >= 1000 ? `${Math.round(val / 1000)}k` : val}
                    />
                    <Tooltip content={<CustomDailyTooltip />} />
                    {showAverageLine && dailyStats.averageSales > 0 && metricView === 'volume' && (
                      <ReferenceLine 
                        y={dailyStats.averageSales} 
                        stroke="#f5a623" 
                        strokeDasharray="4 4" 
                        label={{ 
                          value: `متوسط: ${dailyStats.averageSales.toLocaleString()} ج.م`, 
                          fill: '#f5a623', 
                          fontSize: 10, 
                          position: 'top' 
                        }} 
                      />
                    )}
                    {metricView === 'count' ? (
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        name="عدد الفواتير" 
                        stroke="#3b82f6" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#salesGradient)" 
                      />
                    ) : (
                      <>
                        <Area 
                          type="monotone" 
                          dataKey="sales" 
                          name="حجم المبيعات" 
                          stroke="#e94560" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#salesGradient)" 
                        />
                        {metricView === 'profit' && (
                          <Area 
                            type="monotone" 
                            dataKey="profit" 
                            name="صافي الربح" 
                            stroke="#10b981" 
                            strokeWidth={2} 
                            fillOpacity={0.6} 
                            fill="url(#profitGradient)" 
                          />
                        )}
                      </>
                    )}
                  </AreaChart>
                ) : (
                  <BarChart data={dailySalesData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis 
                      dataKey="dateLabel" 
                      tick={{ fontSize: 11, fill: '#8892a4' }} 
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 11, fill: '#8892a4' }} 
                      tickLine={false}
                      tickFormatter={(val) => val >= 1000 ? `${Math.round(val / 1000)}k` : val}
                    />
                    <Tooltip content={<CustomDailyTooltip />} />
                    {metricView === 'count' ? (
                      <Bar dataKey="count" name="عدد الفواتير" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    ) : (
                      <>
                        <Bar dataKey="sales" name="المبيعات" fill="#e94560" radius={[6, 6, 0, 0]} />
                        {metricView === 'profit' && (
                          <Bar dataKey="profit" name="صافي الربح" fill="#10b981" radius={[6, 6, 0, 0]} />
                        )}
                      </>
                    )}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>

            {/* Micro-metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-border mt-3 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-card border border-border">
                <span className="text-text-dim">إجمالي مبيعات الفترة:</span>
                <span className="font-mono font-black text-gold">{dailyStats.totalSales.toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-card border border-border">
                <span className="text-text-dim">إجمالي الفواتير:</span>
                <span className="font-mono font-bold text-text-main">{dailyStats.totalCount} عملية</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-card border border-border">
                <span className="text-text-dim">متوسط المبيعات اليومي:</span>
                <span className="font-mono font-bold text-emerald-400">{dailyStats.averageSales.toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-card border border-border">
                <span className="text-text-dim">ذروة المبيعات:</span>
                <span className="font-mono font-bold text-text-main">{dailyStats.peakDay?.sales.toLocaleString('ar-EG') || 0} ج.م</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: MONTHLY SALES VOLUME & P&L COMPARISON (RECHARTS)
          ========================================================================= */}
      {activeTab === 'monthly' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-card2/60 p-3 rounded-2xl border border-border">
            <div>
              <span className="text-xs font-bold text-text-main">
                مقارنة حجم المبيعات الشهرية مع المشتريات والمصروفات وصافي الربح
              </span>
              <p className="text-[11px] text-text-dim">تحليل شهري شامل لتقييم الأداء المالي والنمو</p>
            </div>

            <div className="flex bg-card p-0.5 rounded-xl border border-border text-xs font-bold">
              <button
                onClick={() => setMonthlyTimeframe('6months')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  monthlyTimeframe === '6months' ? 'bg-gold text-white shadow-sm' : 'text-text-dim hover:text-text-main'
                }`}
              >
                آخر 6 أشهر
              </button>
              <button
                onClick={() => setMonthlyTimeframe('12months')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  monthlyTimeframe === '12months' ? 'bg-gold text-white shadow-sm' : 'text-text-dim hover:text-text-main'
                }`}
              >
                آخر 12 شهر (سنة كاملة)
              </button>
            </div>
          </div>

          {/* Monthly Recharts Multi-Bar & Line Chart */}
          <div className="bg-card2/30 p-4 rounded-3xl border border-border">
            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis 
                    dataKey="shortMonth" 
                    tick={{ fontSize: 11, fill: '#8892a4' }} 
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: '#8892a4' }} 
                    tickLine={false}
                    tickFormatter={(val) => val >= 1000 ? `${Math.round(val / 1000)}k` : val}
                  />
                  <Tooltip content={<CustomMonthlyTooltip />} />
                  <Legend 
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} 
                    formatter={(val) => <span className="text-text-main font-bold">{val}</span>}
                  />
                  <Bar dataKey="sales" name="حجم المبيعات" fill="#e94560" radius={[6, 6, 0, 0]} barSize={22} />
                  <Bar dataKey="purchases" name="المشتريات" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={22} />
                  <Bar dataKey="expenses" name="المصروفات" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={22} />
                  <Line 
                    type="monotone" 
                    dataKey="profit" 
                    name="صافي الربح" 
                    stroke="#10b981" 
                    strokeWidth={3} 
                    dot={{ fill: '#10b981', r: 4 }} 
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly Breakdown Table / Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-4 border-t border-border mt-3">
              {monthlyData.map((m, idx) => (
                <div key={idx} className="bg-card p-3 rounded-2xl border border-border flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-text-main">{m.shortMonth}</span>
                    {m.growthPercentage !== 0 && (
                      <span className={`text-[10px] font-bold ${
                        m.growthPercentage >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {m.growthPercentage >= 0 ? '▲' : '▼'}{Math.abs(m.growthPercentage)}%
                      </span>
                    )}
                  </div>
                  <div className="my-2">
                    <span className="text-xs text-text-dim block">المبيعات:</span>
                    <span className="text-sm font-black text-gold font-mono">
                      {m.sales.toLocaleString('ar-EG')} <span className="text-[10px] text-text-dim font-normal">ج.م</span>
                    </span>
                  </div>
                  <div className="text-[10px] text-text-dim flex justify-between border-t border-border/50 pt-1">
                    <span>الربح:</span>
                    <span className="font-bold text-emerald-400 font-mono">{m.profit.toLocaleString()} ج.م</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: HOURLY SALES PULSE (ساعات الذروة)
          ========================================================================= */}
      {activeTab === 'hourly' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-card2/60 p-3 rounded-2xl border border-border">
            <div>
              <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
                <Clock size={14} className="text-gold" />
                <span>توزيع المبيعات على مدار الـ 24 ساعة (Rush Hours Analytics)</span>
              </span>
              <p className="text-[11px] text-text-dim mt-0.5">
                تحديد ساعات الإقبال والذروة لمساعدة الإدارة في تنظيم أوقات العمل وتجهيز الكاشير
              </p>
            </div>

            {peakHour && peakHour.sales > 0 && (
              <span className="text-xs bg-gold/10 text-gold border border-gold/30 px-3 py-1 rounded-xl font-bold">
                ساعة الذروة الكبرى: {peakHour.hourLabel} ({peakHour.sales.toLocaleString()} ج.م)
              </span>
            )}
          </div>

          <div className="bg-card2/30 p-4 rounded-3xl border border-border">
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="hourLabel" tick={{ fontSize: 10, fill: '#8892a4' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#8892a4' }} />
                  <Tooltip 
                    formatter={(val: any) => [`${Number(val).toLocaleString()} ج.م`, 'حجم المبيعات']}
                    labelFormatter={(label) => `الساعة: ${label}`}
                  />
                  <Bar 
                    dataKey="sales" 
                    name="المبيعات" 
                    fill="#e94560" 
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: COMPOSED DUAL-AXIS ANALYSIS (REVENUE VS INVOICES)
          ========================================================================= */}
      {activeTab === 'composed' && (
        <div className="space-y-4">
          <div className="bg-card2/60 p-3 rounded-2xl border border-border">
            <span className="text-xs font-bold text-text-main flex items-center gap-1.5">
              <Layers size={14} className="text-gold" />
              <span>الرسم البياني المركب (حجم المبيعات بالجنيه مقابل عدد الفواتير)</span>
            </span>
            <p className="text-[11px] text-text-dim mt-0.5">
              مقارنة وتزامن الارتفاع في الإيرادات مع نمو عدد العملاء والمعاملات اليومية
            </p>
          </div>

          <div className="bg-card2/30 p-4 rounded-3xl border border-border">
            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailySalesData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#8892a4' }} />
                  <YAxis 
                    yAxisId="left" 
                    tick={{ fontSize: 11, fill: '#8892a4' }} 
                    tickFormatter={(val) => `${val >= 1000 ? `${Math.round(val/1000)}k` : val}`}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    tick={{ fontSize: 11, fill: '#3b82f6' }} 
                  />
                  <Tooltip content={<CustomDailyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar yAxisId="left" dataKey="sales" name="قيمة المبيعات (ج.م)" fill="#e94560" radius={[6, 6, 0, 0]} />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="count" 
                    name="عدد الفواتير (عمليات)" 
                    stroke="#3b82f6" 
                    strokeWidth={3} 
                    dot={{ fill: '#3b82f6', r: 4 }} 
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: PAYMENT METHODS DISTRIBUTION (PIE CHART)
          ========================================================================= */}
      {activeTab === 'payments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center bg-card2/30 p-5 rounded-3xl border border-border">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethodsData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {paymentMethodsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => [`${Number(val).toLocaleString()} ج.م`, 'المبلغ']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-text-dim">توزيع السيولة والتحصيل حسب وسيلة السداد:</h4>
            {paymentMethodsData.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-card p-3 rounded-2xl border border-border text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="font-bold text-text-main">{item.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-black text-text-main">{item.amount.toLocaleString('ar-EG')} ج.م</span>
                  <span className="text-[10px] bg-gold/10 px-2.5 py-0.5 rounded-lg font-bold text-gold border border-gold/20">
                    {item.percentage}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: TOP PRODUCTS REVENUE & QUANTITIES
          ========================================================================= */}
      {activeTab === 'topProducts' && (
        <div className="space-y-3 bg-card2/30 p-5 rounded-3xl border border-border">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-text-dim">
              أفضل الأصناف تحقيقاً للمبيعات والأرباح بالمتجر:
            </span>
            <span className="text-[11px] text-text-dim font-bold">مرتبة حسب الإيراد الإجمالي</span>
          </div>

          {topProductsData.length === 0 ? (
            <div className="text-center py-12 text-text-dim text-xs">
              لا توجد مبيعات مسجلة للمنتجات حتى الآن.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {topProductsData.map((prod, index) => (
                <div key={index} className="bg-card p-3.5 rounded-2xl border border-border space-y-2">
                  <div className="flex justify-between items-start text-xs font-bold">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-xl bg-gold/20 text-gold flex items-center justify-center text-xs font-black">
                        #{index + 1}
                      </span>
                      <div>
                        <span className="text-text-main block">{prod.name}</span>
                        <span className="text-[10px] text-text-dim font-normal">{prod.quantity} قطعة مباعة</span>
                      </div>
                    </div>
                    <div className="text-left">
                      <span className="font-black text-gold font-mono block">{prod.revenue.toLocaleString('ar-EG')} ج.م</span>
                      <span className="text-[10px] text-emerald-400 font-mono font-bold">ربح: {prod.profit.toLocaleString()} ج.م</span>
                    </div>
                  </div>
                  
                  {/* Progress visual bar */}
                  <div className="w-full bg-card2 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-gold h-full rounded-full transition-all duration-500" 
                      style={{ 
                        width: `${Math.min(100, Math.max(10, (prod.revenue / (topProductsData[0]?.revenue || 1)) * 100))}%` 
                      }} 
                    />
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
