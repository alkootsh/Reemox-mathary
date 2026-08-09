import React, { useState, useMemo } from 'react';
import { 
  Sparkles, 
  Layers, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Filter, 
  ArrowUpDown,
  Search,
  ShieldCheck,
  Zap,
  ShoppingBag
} from 'lucide-react';

export interface AbcProductItem {
  id: string;
  name: string;
  category: string;
  qtySold: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  cumulativeRevenue: number;
  cumulativePercent: number;
  abcClass: 'A' | 'B' | 'C';
}

interface Props {
  productsProfitability: {
    id: string;
    name: string;
    category: string;
    qtySold: number;
    revenue: number;
    cost: number;
    profit: number;
  }[];
}

export default function AbcAnalysisCard({ productsProfitability }: Props) {
  const [selectedClass, setSelectedClass] = useState<'ALL' | 'A' | 'B' | 'C'>('ALL');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'revenue' | 'profit' | 'qty'>('revenue');

  // Compute ABC Breakdown
  const { items, summary } = useMemo(() => {
    if (!productsProfitability || productsProfitability.length === 0) {
      return {
        items: [],
        summary: {
          totalRevenue: 0,
          totalProfit: 0,
          classA: { count: 0, revenue: 0, profit: 0, percentRevenue: 0 },
          classB: { count: 0, revenue: 0, profit: 0, percentRevenue: 0 },
          classC: { count: 0, revenue: 0, profit: 0, percentRevenue: 0 },
        }
      };
    }

    // Sort by revenue descending
    const sorted = [...productsProfitability].sort((a, b) => b.revenue - a.revenue);
    const totalRev = sorted.reduce((sum, p) => sum + p.revenue, 0);
    const totalProf = sorted.reduce((sum, p) => sum + p.profit, 0);

    let cumRev = 0;
    const computedItems: AbcProductItem[] = sorted.map(p => {
      cumRev += p.revenue;
      const cumPct = totalRev > 0 ? (cumRev / totalRev) * 100 : 0;
      let abcClass: 'A' | 'B' | 'C' = 'C';

      if (cumPct <= 80 || (cumRev - p.revenue) / (totalRev || 1) < 0.8) {
        abcClass = 'A';
      } else if (cumPct <= 95 || (cumRev - p.revenue) / (totalRev || 1) < 0.95) {
        abcClass = 'B';
      } else {
        abcClass = 'C';
      }

      const margin = p.revenue > 0 ? Math.round((p.profit / p.revenue) * 1000) / 10 : 0;

      return {
        ...p,
        margin,
        cumulativeRevenue: cumRev,
        cumulativePercent: Math.round(cumPct * 10) / 10,
        abcClass
      };
    });

    // Summary aggregates
    const classAItems = computedItems.filter(i => i.abcClass === 'A');
    const classBItems = computedItems.filter(i => i.abcClass === 'B');
    const classCItems = computedItems.filter(i => i.abcClass === 'C');

    const revA = classAItems.reduce((s, i) => s + i.revenue, 0);
    const revB = classBItems.reduce((s, i) => s + i.revenue, 0);
    const revC = classCItems.reduce((s, i) => s + i.revenue, 0);

    const profA = classAItems.reduce((s, i) => s + i.profit, 0);
    const profB = classBItems.reduce((s, i) => s + i.profit, 0);
    const profC = classCItems.reduce((s, i) => s + i.profit, 0);

    return {
      items: computedItems,
      summary: {
        totalRevenue: totalRev,
        totalProfit: totalProf,
        classA: {
          count: classAItems.length,
          revenue: revA,
          profit: profA,
          percentRevenue: totalRev > 0 ? Math.round((revA / totalRev) * 1000) / 10 : 0
        },
        classB: {
          count: classBItems.length,
          revenue: revB,
          profit: profB,
          percentRevenue: totalRev > 0 ? Math.round((revB / totalRev) * 1000) / 10 : 0
        },
        classC: {
          count: classCItems.length,
          revenue: revC,
          profit: profC,
          percentRevenue: totalRev > 0 ? Math.round((revC / totalRev) * 1000) / 10 : 0
        },
      }
    };
  }, [productsProfitability]);

  // Filter and sort display items
  const filteredItems = useMemo(() => {
    return items
      .filter(item => {
        if (selectedClass !== 'ALL' && item.abcClass !== selectedClass) return false;
        if (search) {
          const s = search.toLowerCase();
          return item.name.toLowerCase().includes(s) || (item.category || '').toLowerCase().includes(s);
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'revenue') return b.revenue - a.revenue;
        if (sortBy === 'profit') return b.profit - a.profit;
        if (sortBy === 'qty') return b.qtySold - a.qtySold;
        return 0;
      });
  }, [items, selectedClass, search, sortBy]);

  return (
    <div className="space-y-6">
      {/* Introduction Header */}
      <div className="bg-card p-5 rounded-3xl border border-border shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-2xl bg-amber-500/10 text-amber-400">
                <Sparkles size={20} />
              </span>
              <h3 className="text-base font-black text-text-main">
                تحليل باريتو ومصفوفة ABC لتصنيف الأصناف والمخزون (Pareto 80/20 Analysis)
              </h3>
            </div>
            <p className="text-xs text-text-dim mt-1 max-w-3xl leading-relaxed">
              تقسيم علمي ذكي للأصناف المباعة لتحديد الأصناف ذات التأثير الأكبر على أرباح المنشأة، وترشيد استثمار رأس المال وتجنب تجميد السيولة في الأصناف الراكدة.
            </p>
          </div>
        </div>

        {/* 3 Classes KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          {/* Class A */}
          <div className="bg-gradient-to-br from-emerald-950/30 to-card p-4 rounded-2xl border border-emerald-500/30 relative overflow-hidden">
            <div className="flex justify-between items-center mb-2">
              <span className="bg-emerald-500 text-black font-black text-xs px-2.5 py-0.5 rounded-lg shadow-sm">
                الفئة A (النجوم 🌟)
              </span>
              <span className="text-xs font-bold text-emerald-400">
                {summary.classA.percentRevenue}% من الإيراد
              </span>
            </div>
            <div className="text-xl font-black text-text-main mt-1">
              {summary.classA.revenue.toLocaleString('ar-EG')} <span className="text-xs text-text-dim font-normal">ج.م</span>
            </div>
            <div className="text-xs text-text-dim mt-2 flex justify-between border-t border-emerald-500/20 pt-2">
              <span>عدد الأصناف: <strong className="text-text-main font-mono">{summary.classA.count} صنف</strong></span>
              <span>صافي الأرباح: <strong className="text-emerald-400 font-mono">{summary.classA.profit.toLocaleString('ar-EG')} ج.م</strong></span>
            </div>
            <p className="text-[11px] text-emerald-300/80 mt-2 bg-emerald-900/20 p-2 rounded-xl border border-emerald-500/20">
              💡 <strong>الاستراتيجية:</strong> الأصناف الأكثر حيوية؛ يجب عدم السماح بنفاد رصيدها مطلقاً وتأمين حد أمان مرتفع لها.
            </p>
          </div>

          {/* Class B */}
          <div className="bg-gradient-to-br from-blue-950/30 to-card p-4 rounded-2xl border border-blue-500/30 relative overflow-hidden">
            <div className="flex justify-between items-center mb-2">
              <span className="bg-blue-500 text-black font-black text-xs px-2.5 py-0.5 rounded-lg shadow-sm">
                الفئة B (المتوسطة ⚡)
              </span>
              <span className="text-xs font-bold text-blue-400">
                {summary.classB.percentRevenue}% من الإيراد
              </span>
            </div>
            <div className="text-xl font-black text-text-main mt-1">
              {summary.classB.revenue.toLocaleString('ar-EG')} <span className="text-xs text-text-dim font-normal">ج.م</span>
            </div>
            <div className="text-xs text-text-dim mt-2 flex justify-between border-t border-blue-500/20 pt-2">
              <span>عدد الأصناف: <strong className="text-text-main font-mono">{summary.classB.count} صنف</strong></span>
              <span>صافي الأرباح: <strong className="text-blue-400 font-mono">{summary.classB.profit.toLocaleString('ar-EG')} ج.م</strong></span>
            </div>
            <p className="text-[11px] text-blue-300/80 mt-2 bg-blue-900/20 p-2 rounded-xl border border-blue-500/20">
              💡 <strong>الاستراتيجية:</strong> مبيعات مستقرة ومتوسطة؛ طلب دوري معتدل ومراقبة شهرية لمعدلات الطلب.
            </p>
          </div>

          {/* Class C */}
          <div className="bg-gradient-to-br from-amber-950/30 to-card p-4 rounded-2xl border border-amber-500/30 relative overflow-hidden">
            <div className="flex justify-between items-center mb-2">
              <span className="bg-amber-500 text-black font-black text-xs px-2.5 py-0.5 rounded-lg shadow-sm">
                الفئة C (بطيئة الحركة ⚠️)
              </span>
              <span className="text-xs font-bold text-amber-400">
                {summary.classC.percentRevenue}% من الإيراد
              </span>
            </div>
            <div className="text-xl font-black text-text-main mt-1">
              {summary.classC.revenue.toLocaleString('ar-EG')} <span className="text-xs text-text-dim font-normal">ج.م</span>
            </div>
            <div className="text-xs text-text-dim mt-2 flex justify-between border-t border-amber-500/20 pt-2">
              <span>عدد الأصناف: <strong className="text-text-main font-mono">{summary.classC.count} صنف</strong></span>
              <span>صافي الأرباح: <strong className="text-amber-400 font-mono">{summary.classC.profit.toLocaleString('ar-EG')} ج.م</strong></span>
            </div>
            <p className="text-[11px] text-amber-300/80 mt-2 bg-amber-900/20 p-2 rounded-xl border border-amber-500/20">
              💡 <strong>الاستراتيجية:</strong> أصناف راكدة أو بطيئة؛ تقليل الشراء منها، وعمل عروض ترويجية لتصريفها وتسييل رأس المال.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive Products Table & Controls */}
      <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
        {/* Table Filters */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search size={14} className="absolute right-3 top-3 text-text-dim" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="بحث باسم الصنف أو القسم..."
                className="bg-card2 border border-border pr-8 pl-3 py-2 rounded-xl text-xs text-text-main outline-none focus:border-gold w-full"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
            <span className="text-xs font-bold text-text-dim">تصفية الفئة:</span>
            {(
              [
                { id: 'ALL', label: 'الكل' },
                { id: 'A', label: 'الفئة A (نجوم)' },
                { id: 'B', label: 'الفئة B (متوسطة)' },
                { id: 'C', label: 'الفئة C (بطيئة)' },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setSelectedClass(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedClass === tab.id
                    ? 'bg-gold text-black shadow-md'
                    : 'bg-card2 text-text-dim hover:text-text-main border border-border'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-card2 border border-border px-3 py-1.5 rounded-xl text-xs text-text-main outline-none focus:border-gold"
            >
              <option value="revenue">ترتيب: الإيراد (الأعلى)</option>
              <option value="profit">ترتيب: صافي الربح</option>
              <option value="qty">ترتيب: الكمية المباعة</option>
            </select>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-card2 text-text-dim border-b border-border font-bold">
              <tr>
                <th className="p-3.5">#</th>
                <th className="p-3.5">الصنف</th>
                <th className="p-3.5">القسم</th>
                <th className="p-3.5 text-center">تصنيف ABC</th>
                <th className="p-3.5 text-center">الكمية المباعة</th>
                <th className="p-3.5">إجمالي المبيعات</th>
                <th className="p-3.5">صافي الربح</th>
                <th className="p-3.5 text-center">هامش الربح</th>
                <th className="p-3.5 text-center">المساهمة التراكمية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-card2/50 transition-colors">
                  <td className="p-3.5 text-text-dim font-mono">{idx + 1}</td>
                  <td className="p-3.5 font-bold text-text-main">{item.name}</td>
                  <td className="p-3.5 text-text-dim">{item.category || 'عام'}</td>
                  <td className="p-3.5 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black inline-block shadow-sm ${
                      item.abcClass === 'A'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : item.abcClass === 'B'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      Class {item.abcClass}
                    </span>
                  </td>
                  <td className="p-3.5 text-center font-bold text-text-main">{item.qtySold}</td>
                  <td className="p-3.5 font-black text-text-main">{item.revenue.toLocaleString('ar-EG')} ج.م</td>
                  <td className={`p-3.5 font-black ${item.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {item.profit.toLocaleString('ar-EG')} ج.م
                  </td>
                  <td className="p-3.5 text-center font-bold text-gold">{item.margin}%</td>
                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-card2 h-2 rounded-full overflow-hidden border border-border">
                        <div 
                          className={`h-full ${item.abcClass === 'A' ? 'bg-emerald-500' : item.abcClass === 'B' ? 'bg-blue-500' : 'bg-amber-500'}`} 
                          style={{ width: `${Math.min(100, item.cumulativePercent)}%` }}
                        />
                      </div>
                      <span className="font-mono text-[11px] text-text-dim">{item.cumulativePercent}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-text-dim text-xs">
                    لا توجد أصناف تطابق معايير التصفية المحددة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
