import React, { useMemo } from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Legend 
} from 'recharts';
import { Sale, Product } from '../../types/types';
import { Layers, PieChart as PieIcon, BarChart3, ArrowUpRight } from 'lucide-react';

interface Props {
  sales: Sale[];
  productsMap: Map<string, Product>;
}

const COLORS = ['#F59E0B', '#10B981', '#38BDF8', '#818CF8', '#F43F5E', '#EC4899', '#8B5CF6', '#14B8A6'];

export default function CategoryBreakdown({ sales = [], productsMap }: Props) {
  const categoryData = useMemo(() => {
    const map = new Map<string, {
      category: string;
      qtySold: number;
      revenue: number;
      cost: number;
      profit: number;
    }>();

    let totalAllProfit = 0;
    let totalAllRevenue = 0;

    sales.forEach(sale => {
      if (!Array.isArray(sale.items)) return;
      sale.items.forEach(item => {
        if (!item) return;
        const pId = item.productId || '';
        const prod = productsMap.get(pId);
        const category = prod?.category || (item.product?.category) || 'عام / غير مصنف';
        const qty = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        
        let unitCost = 0;
        if (item.unitCost !== undefined && item.unitCost !== null && !isNaN(item.unitCost)) {
          unitCost = Number(item.unitCost);
        } else if (item.product && item.product.cost !== undefined && !isNaN(item.product.cost)) {
          unitCost = Number(item.product.cost);
        } else if (prod && prod.cost !== undefined && !isNaN(prod.cost)) {
          unitCost = Number(prod.cost);
        }

        const rev = price * qty;
        const cst = unitCost * qty;
        const prof = rev - cst;

        totalAllRevenue += rev;
        totalAllProfit += prof;

        if (map.has(category)) {
          const entry = map.get(category)!;
          entry.qtySold += qty;
          entry.revenue += rev;
          entry.cost += cst;
          entry.profit += prof;
        } else {
          map.set(category, {
            category,
            qtySold: qty,
            revenue: rev,
            cost: cst,
            profit: prof
          });
        }
      });
    });

    const list = Array.from(map.values()).map(cat => {
      const margin = cat.revenue > 0 ? Math.round((cat.profit / cat.revenue) * 1000) / 10 : 0;
      const profitContribution = totalAllProfit > 0 ? Math.round((cat.profit / totalAllProfit) * 1000) / 10 : 0;
      const revenueContribution = totalAllRevenue > 0 ? Math.round((cat.revenue / totalAllRevenue) * 1000) / 10 : 0;

      return {
        ...cat,
        margin,
        profitContribution,
        revenueContribution
      };
    }).sort((a, b) => b.revenue - a.revenue);

    return {
      list,
      totalAllRevenue,
      totalAllProfit
    };
  }, [sales, productsMap]);

  return (
    <div className="space-y-6">
      <div className="bg-card p-5 rounded-3xl border border-border shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="p-2 rounded-2xl bg-indigo-500/10 text-indigo-400">
            <Layers size={20} />
          </span>
          <div>
            <h3 className="text-base font-black text-text-main">
              تحليل هوامش المساهمة والأقسام التجارية (Category Contribution Margins)
            </h3>
            <p className="text-xs text-text-dim mt-0.5">
              مقارنة أداء كل قسم وتصنيف لمعرفة أي الأقسام تمثل الركيزة الأساسية لأرباح المتجر.
            </p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-4">
          {/* Revenue by Category Bar Chart */}
          <div className="bg-card2 p-4 rounded-2xl border border-border">
            <h4 className="text-xs font-bold text-text-main mb-3 flex items-center gap-1.5">
              <BarChart3 size={15} className="text-gold" />
              <span>مبيعات وتكلفة الأقسام (ج.م)</span>
            </h4>
            <div className="h-56 w-full">
              {categoryData.list.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData.list.slice(0, 7)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <XAxis dataKey="category" stroke="#94A3B8" fontSize={10} />
                    <YAxis stroke="#94A3B8" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '12px', color: '#FFF' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                    <Bar dataKey="revenue" name="المبيعات" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="profit" name="صافي الربح" fill="#10B981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-text-dim text-xs">لا توجد بيانات</div>
              )}
            </div>
          </div>

          {/* Profit Contribution Pie */}
          <div className="bg-card2 p-4 rounded-2xl border border-border">
            <h4 className="text-xs font-bold text-text-main mb-3 flex items-center gap-1.5">
              <PieIcon size={15} className="text-emerald-400" />
              <span>نسبة مساهمة كل قسم في إجمالي الأرباح (%)</span>
            </h4>
            <div className="h-56 w-full flex items-center justify-center">
              {categoryData.list.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData.list}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="profit"
                      nameKey="category"
                    >
                      {categoryData.list.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '12px', color: '#FFF' }}
                      formatter={(val: any) => [`${Number(val).toLocaleString('ar-EG')} ج.م`, 'صافي الربح']}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-text-dim text-xs">لا توجد بيانات</div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Category Table */}
        <div className="overflow-x-auto rounded-2xl border border-border mt-4">
          <table className="w-full text-right text-xs">
            <thead className="bg-card2 text-text-dim border-b border-border font-bold">
              <tr>
                <th className="p-3.5">القسم / التصنيف</th>
                <th className="p-3.5 text-center">الكميات المباعة</th>
                <th className="p-3.5">إجمالي المبيعات</th>
                <th className="p-3.5">إجمالي التكلفة (COGS)</th>
                <th className="p-3.5">مجمل الربح</th>
                <th className="p-3.5 text-center">هامش الربح %</th>
                <th className="p-3.5 text-center">المساهمة في أرباح المتجر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categoryData.list.map((cat, idx) => (
                <tr key={idx} className="hover:bg-card2/50 transition-colors">
                  <td className="p-3.5 font-bold text-text-main flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span>{cat.category}</span>
                  </td>
                  <td className="p-3.5 text-center font-bold text-text-main">{cat.qtySold}</td>
                  <td className="p-3.5 font-black text-text-main">{cat.revenue.toLocaleString('ar-EG')} ج.م</td>
                  <td className="p-3.5 text-amber-500">{cat.cost.toLocaleString('ar-EG')} ج.م</td>
                  <td className={`p-3.5 font-black ${cat.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {cat.profit.toLocaleString('ar-EG')} ج.م
                  </td>
                  <td className="p-3.5 text-center font-bold text-gold">{cat.margin}%</td>
                  <td className="p-3.5 text-center">
                    <span className="bg-card2 border border-border px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-emerald-400">
                      {cat.profitContribution}%
                    </span>
                  </td>
                </tr>
              ))}
              {categoryData.list.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-text-dim text-xs">
                    لا توجد بيانات مبيعات مسجلة في هذا النطاق الزمني
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
