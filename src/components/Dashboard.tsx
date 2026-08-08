import React from 'react';
import { Product, Purchase, Sale, Expense } from '@/src/types/types';
import SalesCharts from './SalesCharts';
import { 
  ShoppingCart, 
  Package, 
  Truck, 
  Users, 
  TrendingDown, 
  Landmark, 
  BarChart2, 
  Tag, 
  Zap, 
  AlertTriangle,
  ArrowUpRight,
  Receipt
} from 'lucide-react';

export default function Dashboard({ 
  products = [], 
  sales = [], 
  purchases = [], 
  expenses = [], 
  setCurrentScreen 
}: { 
  products: Product[], 
  sales: Sale[], 
  purchases: Purchase[], 
  expenses: Expense[], 
  setCurrentScreen: (screen: any) => void 
}) {
  const totalSales = sales.reduce((sum, sale) => sum + (sale.finalTotal || sale.total || 0), 0);
  const totalPurchases = purchases.reduce((sum, purchase) => sum + (purchase.total || 0), 0);
  const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
  const estimatedProfit = Math.max(0, totalSales - totalPurchases - totalExpenses);
  
  const menuItems = [
    { name: 'نقطة البيع (POS)', screen: 'pos', icon: <ShoppingCart size={22} className="text-blue-500" />, desc: 'إصدار الفواتير وطباعة الإيصالات' },
    { name: 'بيع سريع (Fast POS)', screen: 'fast-pos', icon: <Zap size={22} className="text-amber-500" />, desc: 'واجهة لمس سريعة ومختصرة' },
    { name: 'إدارة المخزون', screen: 'inventory', icon: <Tag size={22} className="text-pink-500" />, desc: 'الأصناف والأسعار والكميات' },
    { name: 'المشتريات والتوريد', screen: 'purchases', icon: <Package size={22} className="text-orange-500" />, desc: 'فواتير المشتريات والموردين' },
    { name: 'العملاء والديون', screen: 'customers', icon: <Users size={22} className="text-indigo-500" />, desc: 'سجل العملاء وحسابات الآجل' },
    { name: 'الموردين', screen: 'suppliers', icon: <Truck size={22} className="text-yellow-500" />, desc: 'بيانات الموردين والأرصدة' },
    { name: 'المصروفات', screen: 'expenses', icon: <TrendingDown size={22} className="text-red-500" />, desc: 'تسجيل النثريات والمصاريف' },
    { name: 'الخزينة والحسابات', screen: 'accounting', icon: <Landmark size={22} className="text-green-500" />, desc: 'حركة النقدية والصندوق' },
    { name: 'التقارير الشاملة', screen: 'reports', icon: <BarChart2 size={22} className="text-purple-500" />, desc: 'تحليلات الأرباح والمخزون' },
  ];

  const lowStockProducts = products.filter(p => p.quantity <= (p.lowStockThreshold ?? 5));

  return (
    <div className="p-4 md:p-6 pb-28 max-w-7xl mx-auto space-y-6">
      {/* Welcome & Quick Status Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-5 rounded-3xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-black text-text-main">لوحة التحكم الرئيسية 📊</h2>
          </div>
          <p className="text-xs text-text-dim mt-1">
            نظام متجري ERP المتكامل لإدارة المبيعات، المخزون، الحسابات، ونقاط البيع السريعة
          </p>
        </div>

        {/* POS Quick CTA */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => setCurrentScreen('pos')}
            className="flex-1 md:flex-none bg-gold text-white px-5 py-3 rounded-2xl font-black text-xs hover:bg-gold2 transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95"
          >
            <ShoppingCart size={16} />
            <span>فتح كاشير نقطة البيع (POS)</span>
          </button>

          <button
            onClick={() => setCurrentScreen('fast-pos')}
            className="bg-accent/20 border border-accent/40 text-accent hover:bg-accent/30 px-4 py-3 rounded-2xl font-bold text-xs transition-all flex items-center gap-1.5"
          >
            <Zap size={15} />
            <span>بيع سريع</span>
          </button>
        </div>
      </div>

      {/* Low Stock Warning Banner */}
      {lowStockProducts.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-3xl text-xs flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="text-red-400 flex-shrink-0" size={20} />
            <div>
              <strong className="font-black block text-sm">تنبيه نواقص المخزون:</strong>
              <span>يوجد {lowStockProducts.length} منتج وصل أو قل عن حد الأمان الأدنى.</span>
            </div>
          </div>
          <button
            onClick={() => setCurrentScreen('inventory')}
            className="bg-red-500 text-white px-3.5 py-1.5 rounded-xl font-bold hover:bg-red-600 transition-colors text-[11px]"
          >
            معاينة النواقص بالمخزن
          </button>
        </div>
      )}

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-card p-4 rounded-3xl border border-border space-y-1 shadow-sm">
          <div className="flex justify-between items-center text-text-dim text-xs">
            <span>إجمالي المبيعات</span>
            <span className="p-1.5 rounded-xl bg-gold/10 text-gold">🛒</span>
          </div>
          <p className="text-2xl font-black text-gold font-mono">{totalSales.toLocaleString()} ج.م</p>
          <p className="text-[10px] text-text-dim flex items-center gap-1">
            <span>عدد الفواتير:</span>
            <strong className="text-text-main font-bold">{sales.length}</strong>
          </p>
        </div>

        <div className="bg-card p-4 rounded-3xl border border-border space-y-1 shadow-sm">
          <div className="flex justify-between items-center text-text-dim text-xs">
            <span>إجمالي المشتريات</span>
            <span className="p-1.5 rounded-xl bg-blue-500/10 text-blue-400">📦</span>
          </div>
          <p className="text-2xl font-black text-blue-400 font-mono">{totalPurchases.toLocaleString()} ج.م</p>
          <p className="text-[10px] text-text-dim flex items-center gap-1">
            <span>فواتير الشراء:</span>
            <strong className="text-text-main font-bold">{purchases.length}</strong>
          </p>
        </div>

        <div className="bg-card p-4 rounded-3xl border border-border space-y-1 shadow-sm">
          <div className="flex justify-between items-center text-text-dim text-xs">
            <span>إجمالي المصروفات</span>
            <span className="p-1.5 rounded-xl bg-red-500/10 text-red-400">📉</span>
          </div>
          <p className="text-2xl font-black text-red-400 font-mono">{totalExpenses.toLocaleString()} ج.م</p>
          <p className="text-[10px] text-text-dim flex items-center gap-1">
            <span>نثريات ومصروفات:</span>
            <strong className="text-text-main font-bold">{expenses.length}</strong>
          </p>
        </div>

        <div className="bg-card p-4 rounded-3xl border border-border space-y-1 shadow-sm">
          <div className="flex justify-between items-center text-text-dim text-xs">
            <span>الصافي التقديري</span>
            <span className="p-1.5 rounded-xl bg-green-500/10 text-green-400">💰</span>
          </div>
          <p className="text-2xl font-black text-green-400 font-mono">{estimatedProfit.toLocaleString()} ج.م</p>
          <p className="text-[10px] text-text-dim flex items-center gap-1">
            <span>هامش الربح الإجمالي</span>
          </p>
        </div>
      </div>

      {/* SALES CHARTS COMPONENT (Visual Analytics with Recharts) */}
      <SalesCharts 
        sales={sales} 
        purchases={purchases} 
        expenses={expenses} 
        products={products} 
      />

      {/* Module Navigation Grid */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-text-main flex items-center gap-2">
          <span>⚡</span> الوصول السريع لأقسام وموديولات النظام
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {menuItems.map(item => (
            <button
              key={item.name}
              onClick={() => setCurrentScreen(item.screen)}
              className="bg-card hover:bg-card2 p-4 rounded-3xl border border-border flex items-start gap-3.5 text-right transition-all hover:border-gold/50 shadow-sm group active:scale-[0.98]"
            >
              <div className="p-3 rounded-2xl bg-card2 group-hover:bg-primary border border-border transition-colors">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-text-main group-hover:text-gold transition-colors">
                    {item.name}
                  </h4>
                  <ArrowUpRight size={14} className="text-text-dim group-hover:text-gold transition-colors opacity-0 group-hover:opacity-100" />
                </div>
                <p className="text-[11px] text-text-dim mt-0.5 truncate">{item.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

