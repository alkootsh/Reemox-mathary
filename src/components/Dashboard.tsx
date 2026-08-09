import React, { useState } from 'react';
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
  Receipt,
  AlertCircle,
  PackageCheck,
  CheckCircle2,
  RefreshCw,
  Search,
  MessageCircle,
  ExternalLink,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Mail,
  Send
} from 'lucide-react';
import { getNotificationConfig, buildBulkLowStockMessage, openDirectWhatsAppChat, buildDailySalesSummaryMessage } from '@/src/lib/notifications';
import { playSuccessSound, playWarningSound } from '@/src/lib/sound';

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
  const [reorderFilter, setReorderFilter] = useState<'all' | 'out_of_stock' | 'low_stock'>('all');
  const [reorderSearch, setReorderSearch] = useState('');
  const [isAlertCenterExpanded, setIsAlertCenterExpanded] = useState(true);

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

  // Reorder Point & Low Stock Calculation
  const allReorderProducts = products.filter(p => !p.archived && p.quantity <= (p.lowStockThreshold ?? 5));
  const outOfStockProducts = allReorderProducts.filter(p => p.quantity <= 0);
  const lowStockProducts = allReorderProducts.filter(p => p.quantity > 0 && p.quantity <= (p.lowStockThreshold ?? 5));

  // Filtered List based on manager tab & search
  const filteredReorderList = allReorderProducts.filter(p => {
    const matchesFilter = 
      reorderFilter === 'all' ? true :
      reorderFilter === 'out_of_stock' ? p.quantity <= 0 :
      p.quantity > 0;
    
    const matchesSearch = 
      p.name.toLowerCase().includes(reorderSearch.toLowerCase()) || 
      p.sku.toLowerCase().includes(reorderSearch.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(reorderSearch.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  // Calculate estimated restock cost to bring items to safety (2x threshold)
  const totalRestockEstimatedCost = allReorderProducts.reduce((sum, p) => {
    if (!p) return sum;
    const threshold = p.lowStockThreshold ?? 5;
    const targetQty = threshold * 2;
    const needed = Math.max(1, targetQty - Math.max(0, p.quantity || 0));
    const cost = p.cost || ((p.price || 0) * 0.7);
    return sum + (needed * cost);
  }, 0);

  // WhatsApp quick supplier order
  const handleQuickWhatsAppSupplierOrder = (product: Product) => {
    const threshold = product.lowStockThreshold ?? 5;
    const targetQty = threshold * 2;
    const neededQty = Math.max(1, targetQty - Math.max(0, product.quantity));
    const businessName = localStorage.getItem('businessName') || 'المتجر';

    let msg = `السلام عليكم ورحمة الله،\n`;
    msg += `طلب توريد نواقص من متجر *${businessName}*:\n`;
    msg += `--------------------------------\n`;
    msg += `▪ الصنف المطلوب: *${product.name}*\n`;
    msg += `▪ كود الصنف (SKU): ${product.sku}\n`;
    msg += `▪ الكمية المطلوبة للتوريد: *${neededQty} قطعة*\n`;
    msg += `▪ الرصيد الحالي بالمخزن: ${product.quantity} قطعة (وصل لحد الطلب)\n`;
    msg += `--------------------------------\n`;
    msg += `يرجى تأكيد التوافر وإرسال الفاتورة وموعد التوصيل. شكراً لكم! 🙏`;

    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

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

      {/* =========================================================
          REORDER POINT & LOW STOCK VISUAL ALERT CENTER
          ========================================================= */}
      <div className="bg-card rounded-3xl border border-border shadow-md overflow-hidden transition-all">
        {/* Alert Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-card2 via-card to-card2 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl ${allReorderProducts.length > 0 ? 'bg-amber-500/20 text-amber-400 animate-pulse' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {allReorderProducts.length > 0 ? <AlertTriangle size={22} /> : <PackageCheck size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-text-main">
                  مركز تنبيهات حد الطلب ونواقص المخزون (Reorder Point Alerts)
                </h3>
                {allReorderProducts.length > 0 ? (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full font-mono animate-bounce">
                    {allReorderProducts.length} صنف بحاجة للتوريد
                  </span>
                ) : (
                  <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                    المخزون آمن ومكتمل ✅
                  </span>
                )}
              </div>
              <p className="text-xs text-text-dim mt-0.5">
                تنبيه المدير الفوري بالأصناف التي وصلت لحد إعادة الطلب أو نفد رصيدها تماماً
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            {allReorderProducts.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const cfg = getNotificationConfig();
                    const msg = buildBulkLowStockMessage(allReorderProducts);
                    openDirectWhatsAppChat(cfg.managerWhatsApp, msg, cfg.managerWhatsAppCountryCode);
                    playSuccessSound();
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                  title="إرسال تقرير النواقص المباشر لواتساب المدير"
                >
                  <MessageSquare size={14} />
                  <span>إرسال لواتساب المدير 📱</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const cfg = getNotificationConfig();
                    if (!cfg.managerEmail) {
                      playWarningSound();
                      alert('يرجى تحديد البريد الإلكتروني للمدير أولاً من شاشة الإعدادات');
                      return;
                    }
                    const msg = buildBulkLowStockMessage(allReorderProducts);
                    try {
                      const res = await fetch('/api/notify-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          to: cfg.managerEmail,
                          subject: `🚨 تقرير نواقص المخزون (${allReorderProducts.length} صنف)`,
                          message: msg
                        })
                      });
                      const d = await res.json();
                      if (d.success) {
                        playSuccessSound();
                        alert('✅ تم إرسال تقرير النواقص لبريد المدير بنجاح');
                      } else {
                        playWarningSound();
                        alert(`⚠️ تنبيه: ${d.reason || 'تعذر الإرسال'}`);
                      }
                    } catch (e) {
                      alert('تعذر الاتصال بالخادم');
                    }
                  }}
                  className="bg-card2 hover:bg-slate-700 text-blue-400 border border-blue-500/30 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  title="إرسال تقرير النواقص لبريد المدير"
                >
                  <Mail size={14} />
                  <span>إرسال إيميل ✉️</span>
                </button>
              </>
            )}

            <button
              onClick={() => setCurrentScreen('purchases')}
              className="bg-gold hover:bg-gold2 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md active:scale-95"
            >
              <Package size={14} />
              <span>فاتورة توريد</span>
            </button>
            <button
              onClick={() => setIsAlertCenterExpanded(!isAlertCenterExpanded)}
              className="p-2 rounded-xl bg-card2 border border-border text-text-dim hover:text-text-main transition-colors"
              title={isAlertCenterExpanded ? 'طي اللوحة' : 'توسيع اللوحة'}
            >
              {isAlertCenterExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Quick KPI Counters for Reorder Status */}
        {isAlertCenterExpanded && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-card2 p-3.5 rounded-2xl border border-border flex flex-col justify-between">
                <span className="text-[11px] text-text-dim font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span>نفد من المخزون (Out of Stock)</span>
                </span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-black text-rose-400 font-mono">{outOfStockProducts.length}</span>
                  <span className="text-[10px] text-text-dim">أصناف صفرية</span>
                </div>
              </div>

              <div className="bg-card2 p-3.5 rounded-2xl border border-border flex flex-col justify-between">
                <span className="text-[11px] text-text-dim font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>وصلت لحد الطلب (Low Stock)</span>
                </span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-black text-amber-400 font-mono">{lowStockProducts.length}</span>
                  <span className="text-[10px] text-text-dim">تحت حد الأمان</span>
                </div>
              </div>

              <div className="bg-card2 p-3.5 rounded-2xl border border-border flex flex-col justify-between">
                <span className="text-[11px] text-text-dim font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  <span>تكلفة إعادة التوريد التقديرية</span>
                </span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-xl font-black text-blue-400 font-mono">{Math.round(totalRestockEstimatedCost).toLocaleString()} ج.م</span>
                  <span className="text-[10px] text-text-dim">تغطية الأمان</span>
                </div>
              </div>

              <div className="bg-card2 p-3.5 rounded-2xl border border-border flex flex-col justify-between">
                <span className="text-[11px] text-text-dim font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>مستوى سلامة المخزون العام</span>
                </span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-xl font-black text-emerald-400 font-mono">
                    {products.length > 0 ? Math.round(((products.length - allReorderProducts.length) / products.length) * 100) : 100}%
                  </span>
                  <span className="text-[10px] text-text-dim">{products.length - allReorderProducts.length} من {products.length} آمن</span>
                </div>
              </div>
            </div>

            {/* Filter Bar & Search inside Alert Center */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 pt-1">
              <div className="flex bg-card2 p-1 rounded-2xl border border-border gap-1 text-xs font-bold overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setReorderFilter('all')}
                  className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${reorderFilter === 'all' ? 'bg-gold text-white shadow-sm' : 'text-text-dim hover:text-text-main'}`}
                >
                  جميع النواقص ({allReorderProducts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReorderFilter('out_of_stock')}
                  className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${reorderFilter === 'out_of_stock' ? 'bg-rose-600 text-white shadow-sm' : 'text-text-dim hover:text-text-main'}`}
                >
                  نفد تماماً (0) ({outOfStockProducts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setReorderFilter('low_stock')}
                  className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap ${reorderFilter === 'low_stock' ? 'bg-amber-500 text-white shadow-sm' : 'text-text-dim hover:text-text-main'}`}
                >
                  تحت حد الطلب ({lowStockProducts.length})
                </button>
              </div>

              <div className="relative flex-1 sm:max-w-xs">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim" size={14} />
                <input
                  type="text"
                  placeholder="بحث في النواقص بالاسم أو الكود..."
                  className="w-full bg-card2 border border-border pr-8 pl-3 py-1.5 rounded-xl text-xs focus:outline-none focus:border-gold"
                  value={reorderSearch}
                  onChange={e => setReorderSearch(e.target.value)}
                />
              </div>
            </div>

            {/* List / Table of Products Needing Reorder */}
            {filteredReorderList.length === 0 ? (
              <div className="p-6 bg-card2 rounded-2xl border border-border text-center text-text-dim space-y-1.5">
                <CheckCircle2 size={32} className="mx-auto text-emerald-400 opacity-60" />
                <p className="text-xs font-bold text-text-main">لا توجد أصناف تطابق معايير الفلترة الحالية</p>
                <p className="text-[11px]">مستويات المخزون ضمن الحدود المحددة مسبقاً.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredReorderList.map(product => {
                  const threshold = product.lowStockThreshold ?? 5;
                  const qty = product.quantity || 0;
                  const isZero = qty <= 0;
                  const targetSafetyQty = threshold * 2;
                  const suggestedOrderQty = Math.max(1, targetSafetyQty - Math.max(0, qty));
                  const estimatedCost = suggestedOrderQty * (product.cost || ((product.price || 0) * 0.7));
                  const progressPercentage = Math.min(100, Math.max(0, (qty / threshold) * 100));

                  return (
                    <div
                      key={product.id}
                      className={`bg-card2 p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 shadow-sm ${
                        isZero 
                          ? 'border-rose-500/40 hover:border-rose-500 bg-rose-500/5' 
                          : 'border-amber-500/40 hover:border-amber-500 bg-amber-500/5'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h4 className="font-black text-sm text-text-main leading-tight">{product.name}</h4>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-text-dim font-mono">
                              <span>SKU: {product.sku}</span>
                              {product.category && (
                                <span className="bg-card border border-border px-1.5 py-0.5 rounded text-[10px]">
                                  {product.category}
                                </span>
                              )}
                            </div>
                          </div>

                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border whitespace-nowrap ${
                            isZero 
                              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' 
                              : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                          }`}>
                            {isZero ? '🔴 نفد تماماً' : '🟡 عند حد الطلب'}
                          </span>
                        </div>

                        {/* Stock Level Visual Bar */}
                        <div className="space-y-1 bg-card p-2.5 rounded-xl border border-border/80">
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-text-dim">الرصيد الحالي بالمخزن:</span>
                            <span className={`font-black font-mono text-xs ${isZero ? 'text-rose-400' : 'text-amber-400'}`}>
                              {product.quantity} {product.isWeighted ? (product.weightUnit || 'كجم') : 'قطعة'}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-border h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all ${isZero ? 'bg-rose-500' : 'bg-amber-400'}`}
                              style={{ width: `${progressPercentage}%` }}
                            ></div>
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-text-dim">
                            <span>حد إعادة الطلب (Threshold): <strong className="font-mono text-text-main">{threshold}</strong></span>
                            <span>المقترح للطلب: <strong className="font-mono text-gold font-bold">+{suggestedOrderQty}</strong></span>
                          </div>
                        </div>

                        {/* Financial Restock Estimate */}
                        <div className="flex justify-between items-center text-[11px] px-1 text-text-dim">
                          <span>سعر التكلفة التقديري:</span>
                          <span className="font-bold font-mono text-text-main">{product.cost || '---'} ج.م</span>
                          <span>إجمالي تكلفة الطلب:</span>
                          <span className="font-bold font-mono text-gold">{Math.round(estimatedCost).toLocaleString()} ج.م</span>
                        </div>
                      </div>

                      {/* Action Buttons for Manager */}
                      <div className="flex items-center gap-1.5 pt-2 border-t border-border/60">
                        <button
                          type="button"
                          onClick={() => setCurrentScreen('purchases')}
                          className="flex-1 bg-gold hover:bg-gold2 text-white py-1.5 px-2 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 shadow-sm active:scale-95"
                          title="إنشاء فاتورة توريد للمنتج"
                        >
                          <Package size={12} />
                          <span>أمر شراء (+{suggestedOrderQty})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleQuickWhatsAppSupplierOrder(product)}
                          className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 p-1.5 rounded-xl transition-all flex items-center justify-center text-[11px]"
                          title="طلب سريع من المورد عبر واتساب"
                        >
                          <MessageCircle size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => setCurrentScreen('inventory')}
                          className="bg-card hover:bg-card2 border border-border text-text-dim hover:text-white p-1.5 rounded-xl transition-all"
                          title="تعديل حد الأمان في المخزون"
                        >
                          <SlidersHorizontal size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

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


