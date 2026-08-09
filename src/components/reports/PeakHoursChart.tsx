import React, { useMemo, useState } from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  AreaChart, 
  Area 
} from 'recharts';
import { Sale } from '../../types/types';
import { Clock, Calendar, Zap, TrendingUp, Users, Award } from 'lucide-react';

interface Props {
  sales: Sale[];
}

export default function PeakHoursChart({ sales = [] }: Props) {
  const [viewType, setViewType] = useState<'hourly' | 'weekly'>('hourly');

  // 1. Process 24-Hour Distribution
  const hourlyData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label: `${i}:00`,
      formattedHour: i === 0 ? '12 منتصف الليل' : i === 12 ? '12 ظهراً' : i > 12 ? `${i - 12} مساءً` : `${i} صباحاً`,
      sales: 0,
      invoices: 0,
      itemsSold: 0
    }));

    sales.forEach(sale => {
      if (!sale.date) return;
      const d = new Date(sale.date);
      if (isNaN(d.getTime())) return;
      const h = d.getHours();
      const total = Number(sale.finalTotal || sale.total || 0);
      const itemsCount = Array.isArray(sale.items) ? sale.items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0;

      if (hours[h]) {
        hours[h].sales += total;
        hours[h].invoices += 1;
        hours[h].itemsSold += itemsCount;
      }
    });

    // Find peak hour
    let peakHour = hours[0];
    hours.forEach(h => {
      if (h.sales > peakHour.sales) {
        peakHour = h;
      }
    });

    return {
      chartData: hours,
      peakHour,
      activeHoursCount: hours.filter(h => h.invoices > 0).length
    };
  }, [sales]);

  // 2. Process Day of Week Distribution
  const weeklyData = useMemo(() => {
    const daysArabic = [
      { id: 0, name: 'الأحد', short: 'أحد' },
      { id: 1, name: 'الإثنين', short: 'إثنين' },
      { id: 2, name: 'الثلاثاء', short: 'ثلاثاء' },
      { id: 3, name: 'الأربعاء', short: 'أربعاء' },
      { id: 4, name: 'الخميس', short: 'خميس' },
      { id: 5, name: 'الجمعة', short: 'جمعة' },
      { id: 6, name: 'السبت', short: 'سبت' },
    ];

    const dayMap = new Map<number, { dayName: string; short: string; sales: number; invoices: number }>();
    daysArabic.forEach(d => {
      dayMap.set(d.id, { dayName: d.name, short: d.short, sales: 0, invoices: 0 });
    });

    sales.forEach(sale => {
      if (!sale.date) return;
      const d = new Date(sale.date);
      if (isNaN(d.getTime())) return;
      const dayIdx = d.getDay();
      const total = Number(sale.finalTotal || sale.total || 0);

      const entry = dayMap.get(dayIdx);
      if (entry) {
        entry.sales += total;
        entry.invoices += 1;
      }
    });

    // Sort starting from Saturday (standard Egyptian/Arab business week)
    const weekOrder = [6, 0, 1, 2, 3, 4, 5];
    const ordered = weekOrder.map(idx => dayMap.get(idx)!);

    let bestDay = ordered[0];
    ordered.forEach(d => {
      if (d.sales > bestDay.sales) {
        bestDay = d;
      }
    });

    return {
      chartData: ordered,
      bestDay
    };
  }, [sales]);

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-card p-5 rounded-3xl border border-border shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-2xl bg-amber-500/10 text-amber-400">
                <Clock size={20} />
              </span>
              <h3 className="text-base font-black text-text-main">
                تحليل أوقات الذروة والمبيعات بالساعات والأيام (Peak Traffic & Hour Heatmap)
              </h3>
            </div>
            <p className="text-xs text-text-dim mt-1">
              مراقبة أنماط تدفق الزبائن، وساعات الذروة التشغيلية لتنظيم الورديات وتنشيط الفترات الهادئة.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-card2 p-1 rounded-2xl border border-border">
            <button
              onClick={() => setViewType('hourly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                viewType === 'hourly'
                  ? 'bg-gold text-black shadow-sm'
                  : 'text-text-dim hover:text-text-main'
              }`}
            >
              <Clock size={13} />
              <span>ساعات اليوم (24 ساعة)</span>
            </button>
            <button
              onClick={() => setViewType('weekly')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                viewType === 'weekly'
                  ? 'bg-gold text-black shadow-sm'
                  : 'text-text-dim hover:text-text-main'
              }`}
            >
              <Calendar size={13} />
              <span>أيام الأسبوع</span>
            </button>
          </div>
        </div>

        {/* Peak KPI Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-4">
          <div className="bg-card2 p-3.5 rounded-2xl border border-border flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
              <Zap size={20} />
            </div>
            <div>
              <div className="text-[11px] text-text-dim font-bold">ساعة الذروة القصوى</div>
              <div className="text-sm sm:text-base font-black text-text-main mt-0.5">
                {hourlyData.peakHour.formattedHour}
              </div>
              <div className="text-[10px] text-amber-400 font-mono mt-0.5">
                {hourlyData.peakHour.sales.toLocaleString('ar-EG')} ج.م ({hourlyData.peakHour.invoices} فاتورة)
              </div>
            </div>
          </div>

          <div className="bg-card2 p-3.5 rounded-2xl border border-border flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <Award size={20} />
            </div>
            <div>
              <div className="text-[11px] text-text-dim font-bold">أقوى أيام الأسبوع مبيعاً</div>
              <div className="text-sm sm:text-base font-black text-text-main mt-0.5">
                يوم {weeklyData.bestDay.dayName}
              </div>
              <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                {weeklyData.bestDay.sales.toLocaleString('ar-EG')} ج.م ({weeklyData.bestDay.invoices} فاتورة)
              </div>
            </div>
          </div>

          <div className="bg-card2 p-3.5 rounded-2xl border border-border flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
              <Users size={20} />
            </div>
            <div>
              <div className="text-[11px] text-text-dim font-bold">معدل الإقبال النشط</div>
              <div className="text-sm sm:text-base font-black text-text-main mt-0.5">
                {hourlyData.activeHoursCount} ساعة تشغيلية نشطة
              </div>
              <div className="text-[10px] text-text-dim mt-0.5">
                متوسط {(sales.length / (hourlyData.activeHoursCount || 1)).toFixed(1)} فاتورة / ساعة نشطة
              </div>
            </div>
          </div>
        </div>

        {/* Visual Chart */}
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-xs font-bold text-text-main flex items-center gap-1.5">
              <span>📊</span>
              {viewType === 'hourly' ? 'منحنى توزيع المبيعات عبر ساعات اليوم' : 'مقارنة حجم المبيعات حسب أيام الأسبوع'}
            </h4>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {viewType === 'hourly' ? (
                <BarChart data={hourlyData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" stroke="#94A3B8" fontSize={10} />
                  <YAxis stroke="#94A3B8" fontSize={10} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '12px', color: '#FFF' }}
                    formatter={(value: any, name: any) => [
                      name === 'sales' ? `${Number(value).toLocaleString('ar-EG')} ج.م` : `${value} فاتورة`,
                      name === 'sales' ? 'إجمالي المبيعات' : 'عدد الفواتير'
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="sales" name="المبيعات (ج.م)" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="invoices" name="عدد الفواتير" fill="#38BDF8" radius={[6, 6, 0, 0]} />
                </BarChart>
              ) : (
                <BarChart data={weeklyData.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="dayName" stroke="#94A3B8" fontSize={11} />
                  <YAxis stroke="#94A3B8" fontSize={11} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', borderRadius: '12px', color: '#FFF' }}
                    formatter={(value: any, name: any) => [
                      name === 'sales' ? `${Number(value).toLocaleString('ar-EG')} ج.م` : `${value} فاتورة`,
                      name === 'sales' ? 'إجمالي المبيعات' : 'عدد الفواتير'
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="sales" name="المبيعات (ج.م)" fill="#10B981" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="invoices" name="عدد الفواتير" fill="#818CF8" radius={[8, 8, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
