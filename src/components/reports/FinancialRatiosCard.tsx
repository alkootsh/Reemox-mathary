import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  DollarSign, 
  Activity, 
  Clock, 
  Scale, 
  ShieldAlert, 
  CheckCircle2, 
  Layers, 
  ArrowUpRight,
  Info
} from 'lucide-react';

export interface FinancialRatiosData {
  grossSales: number;
  totalCogs: number;
  grossProfit: number;
  grossMargin: number; // %
  totalExpenses: number;
  netProfit: number;
  netMargin: number; // %
  markupPercentage: number; // %
  expenseRatio: number; // %
  inventoryCostValue: number;
  inventoryTurnover: number; // Times
  daysSalesInInventory: number; // Days
  totalInvoices: number;
  averageOrderValue: number; // AOV
  unitsPerTransaction: number; // UPT
  totalUnitsSold: number;
  breakEvenRevenue: number;
  creditSalesRatio: number; // %
  cashCollectionRatio: number; // %
  gmroi: number; // %
}

interface Props {
  data: FinancialRatiosData;
}

export default function FinancialRatiosCard({ data }: Props) {
  const ratios = [
    {
      title: 'هامش مجمل الربح (Gross Margin)',
      value: `${data.grossMargin}%`,
      formula: '(مجمل الربح ÷ صافي المبيعات) × 100',
      description: 'يقيس كفاءة تسعير المنتجات مقارنة بتكلفتها المباشرة',
      status: data.grossMargin >= 25 ? 'ممتاز' : data.grossMargin >= 15 ? 'جيد' : 'منخفض',
      statusColor: data.grossMargin >= 25 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : data.grossMargin >= 15 ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      icon: <Percent size={18} className="text-emerald-400" />
    },
    {
      title: 'هامش صافي الربح (Net Profit Margin)',
      value: `${data.netMargin}%`,
      formula: '(صافي الربح بعد المصروفات ÷ المبيعات) × 100',
      description: 'العائد الحقيقي المتبقي كأرباح صافية بعد كافة المصاريف',
      status: data.netMargin >= 15 ? 'ممتاز' : data.netMargin >= 8 ? 'جيد' : data.netMargin > 0 ? 'مقبول' : 'خسارة تشغيلية',
      statusColor: data.netMargin >= 15 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : data.netMargin > 0 ? 'text-blue-400 border-blue-500/30 bg-blue-500/10' : 'text-rose-400 border-rose-500/30 bg-rose-500/10',
      icon: <TrendingUp size={18} className="text-blue-400" />
    },
    {
      title: 'نسبة الترميز فوق التكلفة (Markup %)',
      value: `${data.markupPercentage}%`,
      formula: '(مجمل الربح ÷ تكلفة البضاعة المباعة COGS) × 100',
      description: 'متوسط النسبة المضافة فوق سعر الشراء لتحديد سعر البيع',
      status: data.markupPercentage >= 35 ? 'مرتفع' : data.markupPercentage >= 20 ? 'متوسط' : 'منخفض',
      statusColor: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
      icon: <ArrowUpRight size={18} className="text-purple-400" />
    },
    {
      title: 'معدل دوران المخزون (Inventory Turnover)',
      value: `${data.inventoryTurnover} مرة`,
      formula: 'تكلفة المبيعات (COGS) ÷ متوسط قيمة المخزون',
      description: 'سرعة تصريف البضائع وإعادة تعويضها نقدياً خلال الفترة',
      status: data.inventoryTurnover >= 4 ? 'دوران سريع 🚀' : data.inventoryTurnover >= 1 ? 'طبيعي' : 'دوران بطيء ⚠️',
      statusColor: data.inventoryTurnover >= 4 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      icon: <Activity size={18} className="text-amber-400" />
    },
    {
      title: 'متوسط بقاء المخزون (Days Sales in Inventory)',
      value: `${data.daysSalesInInventory} يوم`,
      formula: '365 يوم ÷ معدل دوران المخزون السنوي',
      description: 'متوسط عدد الأيام التي يستغرقها الصنف ليتحول إلى بيع نقدي',
      status: data.daysSalesInInventory <= 45 ? 'سيولة عالية' : data.daysSalesInInventory <= 90 ? 'معدل قياسي' : 'تكدس نسبي',
      statusColor: data.daysSalesInInventory <= 60 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      icon: <Clock size={18} className="text-teal-400" />
    },
    {
      title: 'متوسط قيمة الفاتورة (Average Order Value)',
      value: `${data.averageOrderValue.toLocaleString('ar-EG')} ج.م`,
      formula: 'إجمالي المبيعات ÷ إجمالي عدد الفواتير',
      description: 'متوسط إنفاق العميل في كل زيارة أو حركة شراء',
      status: `${data.totalInvoices} فاتورة`,
      statusColor: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
      icon: <DollarSign size={18} className="text-sky-400" />
    },
    {
      title: 'متوسط الأصناف بالفاتورة (Units Per Ticket)',
      value: `${data.unitsPerTransaction} قطع`,
      formula: 'إجمالي الكميات المباعة ÷ عدد الفواتير',
      description: 'مؤشر لقياس نجاح البيع المتقاطع وزيادة سلة مشتريات العميل',
      status: `${data.totalUnitsSold} قطعة مباعة`,
      statusColor: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
      icon: <Layers size={18} className="text-indigo-400" />
    },
    {
      title: 'نقطة التعادل المالي (Break-Even Point)',
      value: `${data.breakEvenRevenue.toLocaleString('ar-EG')} ج.م`,
      formula: 'المصروفات التشغيلية ÷ هامش مجمل الربح (%)',
      description: 'حجم المبيعات المطلوب لتغطية كافة المصاريف بدون ربح أو خسارة',
      status: data.grossSales >= data.breakEvenRevenue ? 'تم تجاوز التعادل (منطقة أرباح) ✅' : 'دون نقطة التعادل ⚠️',
      statusColor: data.grossSales >= data.breakEvenRevenue ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-rose-400 border-rose-500/30 bg-rose-500/10',
      icon: <Scale size={18} className="text-rose-400" />
    },
    {
      title: 'العائد على استثمار المخزون (GMROI)',
      value: `${data.gmroi}%`,
      formula: '(مجمل الربح ÷ تكلفة المخزون الحالي) × 100',
      description: 'يقيس الجنيه الواحد المستثمر في البضاعة كم يحقق من مجمل أرباح',
      status: data.gmroi >= 120 ? 'عائد ممتاز' : data.gmroi >= 50 ? 'عائد جيد' : 'عائد ضعيف',
      statusColor: data.gmroi >= 100 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      icon: <TrendingUp size={18} className="text-emerald-400" />
    },
    {
      title: 'نسبة المبيعات الآجلة (Credit Exposure)',
      value: `${data.creditSalesRatio}%`,
      formula: '(المبيعات الآجلة ÷ إجمالي المبيعات) × 100',
      description: 'يقيس حجم الائتمان الممنوح للعملاء مقارنة بالمبيعات الفورية',
      status: data.creditSalesRatio <= 20 ? 'أمان ائتماني ممتاز' : data.creditSalesRatio <= 40 ? 'مقبول' : 'مخاطر ائتمانية عالية ⚠️',
      statusColor: data.creditSalesRatio <= 25 ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10',
      icon: <ShieldAlert size={18} className="text-amber-400" />
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-text-main flex items-center gap-2">
            <Activity size={18} className="text-gold" />
            <span>مصفوفة المؤشرات المالية ونسب الأداء القياسية (Financial & Operational KPIs)</span>
          </h3>
          <p className="text-xs text-text-dim mt-0.5">
            معادلات محاسبية دقيقة وفق معايير المحاسبة الدولية (IFRS) لتقييم كفاءة التسعير، السيولة، وسرعة دوران رأس المال.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {ratios.map((item, idx) => (
          <div 
            key={idx} 
            className="bg-card p-4 rounded-3xl border border-border shadow-sm flex flex-col justify-between hover:border-gold/30 transition-all group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-card2 border border-border">
                    {item.icon}
                  </span>
                  <span className="font-bold text-xs text-text-main group-hover:text-gold transition-colors">
                    {item.title}
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.statusColor}`}>
                  {item.status}
                </span>
              </div>

              <div className="text-xl sm:text-2xl font-black text-text-main mt-1 tracking-tight">
                {item.value}
              </div>

              <p className="text-[11px] text-text-dim mt-1.5 leading-relaxed">
                {item.description}
              </p>
            </div>

            <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-[10px] text-text-dim font-mono">
              <span className="flex items-center gap-1">
                <Info size={11} className="text-text-dim" />
                <span>المعادلة:</span>
              </span>
              <span className="text-text-dim/80 text-left font-sans">{item.formula}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
