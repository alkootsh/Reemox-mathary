import React, { useState, useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
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
  Layers 
} from 'lucide-react';

interface SalesChartsProps {
  sales: Sale[];
  purchases?: Purchase[];
  expenses?: Expense[];
  products?: Product[];
}

type TimeframeOption = '7days' | '14days' | '30days' | 'monthly';

const COLORS = ['#e94560', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function SalesCharts({ sales = [], purchases = [], expenses = [], products = [] }: SalesChartsProps) {
  const [timeframe, setTimeframe] = useState<TimeframeOption>('7days');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [activeTab, setActiveTab] = useState<'daily' | 'monthly' | 'payments' | 'topProducts'>('daily');

  // --- 1. Process Daily Sales Data ---
  const dailySalesData = useMemo(() => {
    const daysCount = timeframe === '7days' ? 7 : timeframe === '14days' ? 14 : 30;
    const now = new Date();
    const result: { dateKey: string; dateLabel: string; sales: number; count: number; average: number }[] = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const dateLabel = d.toLocaleDateString('ar-EG', { weekday: 'short', month: 'numeric', day: 'numeric' });

      // Filter sales on this date
      const daySales = sales.filter(s => s.date && s.date.startsWith(dateKey));
      const totalAmount = daySales.reduce((sum, s) => sum + (s.finalTotal || s.total || 0), 0);
      const count = daySales.length;
      const average = count > 0 ? Math.round(totalAmount / count) : 0;

      result.push({
        dateKey,
        dateLabel,
        sales: totalAmount,
        count,
        average
      });
    }
    return result;
  }, [sales, timeframe]);

  // --- 2. Process Monthly Data (Last 6 Months) ---
  const monthlyData = useMemo(() => {
    const monthsArabic = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const now = new Date();
    const result: { monthKey: string; monthName: string; مبيعات: number; مشتريات: number; مصروفات: number; صافي_الربح: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const monthPrefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
      const monthName = `${monthsArabic[monthIndex]} ${year}`;

      const monthSales = sales
        .filter(s => s.date && s.date.startsWith(monthPrefix))
        .reduce((sum, s) => sum + (s.finalTotal || s.total || 0), 0);

      const monthPurchases = purchases
        .filter(p => p.date && p.date.startsWith(monthPrefix))
        .reduce((sum, p) => sum + (p.total || 0), 0);

      const monthExpenses = expenses
        .filter(e => e.date && e.date.startsWith(monthPrefix))
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      // Estimated gross profit (sales - purchases - expenses)
      const estimatedNet = Math.max(0, monthSales - monthPurchases - monthExpenses);

      result.push({
        monthKey: monthPrefix,
        monthName,
        مبيعات: monthSales,
        مشتريات: monthPurchases,
        مصروفات: monthExpenses,
        صافي_الربح: estimatedNet
      });
    }
    return result;
  }, [sales, purchases, expenses]);

  // --- 3. Process Payment Methods Distribution ---
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
        // Fallback
        cash += (sale.finalTotal || sale.total || 0);
      }
    });

    const total = cash + card + wallet + credit;
    if (total === 0) {
      return [
        { name: 'نقدى (Cash)', value: 1, amount: 0, percentage: '100%' }
      ];
    }

    return [
      { name: 'نقدى (Cash)', value: cash, amount: cash, percentage: `${Math.round((cash / total) * 100)}%` },
      { name: 'بطاقة (Card / Visa)', value: card, amount: card, percentage: `${Math.round((card / total) * 100)}%` },
      { name: 'محفظة (Wallet / InstaPay)', value: wallet, amount: wallet, percentage: `${Math.round((wallet / total) * 100)}%` },
      { name: 'آجل (Credit)', value: credit, amount: credit, percentage: `${Math.round((credit / total) * 100)}%` },
    ].filter(item => item.value > 0);
  }, [sales]);

  // --- 4. Process Top Selling Products ---
  const topProductsData = useMemo(() => {
    const productStats: Record<string, { name: string; quantity: number; revenue: number }> = {};

    sales.forEach(sale => {
      sale.items?.forEach(item => {
        const prodName = item.name || item.product?.name || 'منتج عام';
        if (!productStats[prodName]) {
          productStats[prodName] = { name: prodName, quantity: 0, revenue: 0 };
        }
        productStats[prodName].quantity += item.quantity || 0;
        productStats[prodName].revenue += (item.price || 0) * (item.quantity || 0);
      });
    });

    return Object.values(productStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [sales]);

  // --- Summary Metrics ---
  const totalSalesSum = useMemo(() => {
    return sales.reduce((sum, s) => sum + (s.finalTotal || s.total || 0), 0);
  }, [sales]);

  const totalInvoicesCount = sales.length;
  const averageTicket = totalInvoicesCount > 0 ? Math.round(totalSalesSum / totalInvoicesCount) : 0;

  const peakDay = useMemo(() => {
    if (dailySalesData.length === 0) return { label: 'لا يوجد', value: 0 };
    return dailySalesData.reduce((prev, current) => (prev.sales > current.sales) ? prev : current, dailySalesData[0]);
  }, [dailySalesData]);

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card p-3 rounded-2xl border border-border shadow-xl text-xs space-y-1">
          <p className="font-bold text-text-main border-b border-border pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex justify-between gap-4">
              <span style={{ color: entry.color || entry.stroke || '#e94560' }} className="font-bold">
                {entry.name}:
              </span>
              <span className="font-mono font-black text-text-main">
                {Number(entry.value).toLocaleString()} ج.م
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-card rounded-3xl border border-border p-5 space-y-6 shadow-sm">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📈</span>
            <h3 className="text-lg font-black text-text-main">لوحة مؤشرات وإحصائيات المبيعات (Sales Analytics)</h3>
          </div>
          <p className="text-xs text-text-dim mt-0.5">
            تحليل حركة المبيعات اليومية والشهرية وتوزيع المدفوعات بدقة عالية
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-card2 p-1 rounded-2xl border border-border text-xs font-bold overflow-x-auto self-stretch sm:self-auto">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'daily' ? 'bg-gold text-white shadow-md' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <TrendingUp size={14} />
            <span>المبيعات اليومية</span>
          </button>

          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'monthly' ? 'bg-gold text-white shadow-md' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <BarChart3 size={14} />
            <span>المقارنة الشهرية</span>
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'payments' ? 'bg-gold text-white shadow-md' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <PieIcon size={14} />
            <span>طرق الدفع</span>
          </button>

          <button
            onClick={() => setActiveTab('topProducts')}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'topProducts' ? 'bg-gold text-white shadow-md' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <ShoppingBag size={14} />
            <span>الأكثر مبيعاً</span>
          </button>
        </div>
      </div>

      {/* KPI Performance Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card2 p-3.5 rounded-2xl border border-border">
          <div className="flex items-center justify-between text-text-dim text-xs mb-1">
            <span>إجمالي المبيعات</span>
            <DollarSign size={14} className="text-gold" />
          </div>
          <div className="text-lg font-black text-gold font-mono">{totalSalesSum.toLocaleString()} ج.م</div>
          <div className="text-[10px] text-text-dim mt-0.5">من {totalInvoicesCount} فاتورة مسجلة</div>
        </div>

        <div className="bg-card2 p-3.5 rounded-2xl border border-border">
          <div className="flex items-center justify-between text-text-dim text-xs mb-1">
            <span>متوسط الفاتورة</span>
            <ShoppingBag size={14} className="text-blue-400" />
          </div>
          <div className="text-lg font-black text-blue-400 font-mono">{averageTicket.toLocaleString()} ج.م</div>
          <div className="text-[10px] text-text-dim mt-0.5">Average Order Value</div>
        </div>

        <div className="bg-card2 p-3.5 rounded-2xl border border-border">
          <div className="flex items-center justify-between text-text-dim text-xs mb-1">
            <span>أعلى يوم مبيعات</span>
            <Calendar size={14} className="text-green-400" />
          </div>
          <div className="text-sm font-black text-green-400 truncate">{peakDay.dateLabel}</div>
          <div className="text-[10px] text-text-dim mt-0.5 font-mono">({peakDay.sales.toLocaleString()} ج.م)</div>
        </div>

        <div className="bg-card2 p-3.5 rounded-2xl border border-border">
          <div className="flex items-center justify-between text-text-dim text-xs mb-1">
            <span>عدد الفواتير</span>
            <Layers size={14} className="text-purple-400" />
          </div>
          <div className="text-lg font-black text-purple-400 font-mono">{totalInvoicesCount}</div>
          <div className="text-[10px] text-text-dim mt-0.5">عملية بيع منجزة</div>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="space-y-4">
        {/* TAB 1: DAILY SALES */}
        {activeTab === 'daily' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <span className="text-xs font-bold text-text-dim">
                حركة المبيعات اليومية لـ ({timeframe === '7days' ? 'آخر 7 أيام' : timeframe === '14days' ? 'آخر 14 يوم' : 'آخر 30 يوم'}):
              </span>

              <div className="flex items-center gap-2">
                {/* Timeframe selector */}
                <div className="flex bg-card2 p-0.5 rounded-xl border border-border text-[11px] font-bold">
                  <button
                    onClick={() => setTimeframe('7days')}
                    className={`px-2 py-1 rounded-lg ${timeframe === '7days' ? 'bg-card text-gold shadow-sm' : 'text-text-dim'}`}
                  >
                    7 أيام
                  </button>
                  <button
                    onClick={() => setTimeframe('14days')}
                    className={`px-2 py-1 rounded-lg ${timeframe === '14days' ? 'bg-card text-gold shadow-sm' : 'text-text-dim'}`}
                  >
                    14 يوم
                  </button>
                  <button
                    onClick={() => setTimeframe('30days')}
                    className={`px-2 py-1 rounded-lg ${timeframe === '30days' ? 'bg-card text-gold shadow-sm' : 'text-text-dim'}`}
                  >
                    30 يوم
                  </button>
                </div>

                {/* Chart style toggle */}
                <div className="flex bg-card2 p-0.5 rounded-xl border border-border text-[11px] font-bold">
                  <button
                    onClick={() => setChartType('area')}
                    className={`px-2 py-1 rounded-lg ${chartType === 'area' ? 'bg-gold text-white' : 'text-text-dim'}`}
                  >
                    منحنى Area
                  </button>
                  <button
                    onClick={() => setChartType('bar')}
                    className={`px-2 py-1 rounded-lg ${chartType === 'bar' ? 'bg-gold text-white' : 'text-text-dim'}`}
                  >
                    أعمدة Bar
                  </button>
                </div>
              </div>
            </div>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'area' ? (
                  <AreaChart data={dailySalesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e94560" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#e94560" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#8892a4' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#8892a4' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area 
                      type="monotone" 
                      dataKey="sales" 
                      name="المبيعات" 
                      stroke="#e94560" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#salesGrad)" 
                    />
                  </AreaChart>
                ) : (
                  <BarChart data={dailySalesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 11, fill: '#8892a4' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#8892a4' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="sales" name="المبيعات" fill="#e94560" radius={[8, 8, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TAB 2: MONTHLY COMPARISON */}
        {activeTab === 'monthly' && (
          <div className="space-y-3">
            <span className="text-xs font-bold text-text-dim block">
              مقارنة المبيعات والمشتريات والمصروفات خلال آخر 6 أشهر:
            </span>

            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="monthName" tick={{ fontSize: 11, fill: '#8892a4' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#8892a4' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="مبيعات" fill="#e94560" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="مشتريات" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="مصروفات" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="صافي_الربح" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* TAB 3: PAYMENT METHODS */}
        {activeTab === 'payments' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
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

            {/* Payment Method Breakdown List */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-text-dim mb-3">تفاصيل التوزيع حسب وسيلة السداد:</h4>
              {paymentMethodsData.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-card2 p-2.5 rounded-xl border border-border text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="font-bold text-text-main">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-text-main">{item.amount.toLocaleString()} ج.م</span>
                    <span className="text-[10px] bg-card px-2 py-0.5 rounded-md font-bold text-gold border border-border">
                      {item.percentage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: TOP PRODUCTS */}
        {activeTab === 'topProducts' && (
          <div className="space-y-3">
            <span className="text-xs font-bold text-text-dim block">
              أفضل 5 منتجات مبيعاً من حيث قيمة الإيرادات والكميات المباعة:
            </span>

            {topProductsData.length === 0 ? (
              <div className="text-center py-12 text-text-dim text-xs">
                لا توجد بيانات مبيعات مسجلة للمنتجات حتى الآن.
              </div>
            ) : (
              <div className="space-y-2.5">
                {topProductsData.map((prod, index) => (
                  <div key={index} className="bg-card2 p-3 rounded-2xl border border-border space-y-1.5">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gold/20 text-gold flex items-center justify-center text-[10px] font-black">
                          {index + 1}
                        </span>
                        <span className="text-text-main">{prod.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-text-dim text-[11px] font-normal">{prod.quantity} قطعة مباعة</span>
                        <span className="font-black text-gold font-mono">{prod.revenue.toLocaleString()} ج.م</span>
                      </div>
                    </div>
                    {/* Visual bar */}
                    <div className="w-full bg-card h-2 rounded-full overflow-hidden">
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
    </div>
  );
}
