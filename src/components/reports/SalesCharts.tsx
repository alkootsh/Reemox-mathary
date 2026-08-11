import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, Legend } from 'recharts';
import { Sale, Product } from '../../types/types';

interface Props {
  sales: Sale[];
  products: Product[];
}

export default function SalesCharts({ sales, products }: Props) {
  const dailyData = useMemo(() => {
    const data: Record<string, number> = {};
    sales.forEach(sale => {
      const date = sale.date.split('T')[0];
      data[date] = (data[date] || 0) + sale.finalTotal;
    });
    return Object.entries(data).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));
  }, [sales]);

  const topProducts = useMemo(() => {
    const productSales: Record<string, number> = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        productSales[item.name] = (productSales[item.name] || 0) + item.quantity;
      });
    });
    return Object.entries(productSales)
      .map(([name, quantity]) => ({ name, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [sales]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="bg-card p-5 rounded-4xl border border-border">
        <h3 className="text-sm font-bold mb-4">حجم المبيعات اليومية</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px' }} />
              <Area type="monotone" dataKey="amount" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="bg-card p-5 rounded-4xl border border-border">
        <h3 className="text-sm font-bold mb-4">الأصناف الأكثر مبيعاً</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topProducts}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px' }} />
              <Bar dataKey="quantity" fill="#10B981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
