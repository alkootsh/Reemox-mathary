import { useState } from 'react';
import { Purchase, Sale, Product, Expense, Customer, Supplier } from '../types/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, BarChart, Bar } from 'recharts';

interface Props {
  purchases: Purchase[];
  sales: Sale[];
  products: Product[];
  expenses: Expense[];
  customers: Customer[];
  suppliers: Supplier[];
}

export default function Reports({ purchases, sales, products, expenses, customers, suppliers }: Props) {
  const [filterMode, setFilterMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  
  const lowStockThreshold = 5;
  const lowStockItems = products.filter(p => p.quantity <= lowStockThreshold);
  const totalInventoryValue = products.reduce((sum, p) => sum + (p.quantity * p.price), 0);

  const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
  const totalProfit = sales.reduce((sum, s) => sum + (s.items.reduce((itemSum, item) => itemSum + (item.price - item.product.cost) * item.quantity, 0)), 0);

  const totalCustomerDebt = customers.reduce((sum, c) => sum + (c.openingBalance || 0), 0);
  const totalSupplierDebt = suppliers.reduce((sum, s) => sum + (s.openingBalance || 0), 0);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('تقرير شامل', 10, 10);
    autoTable(doc, {
        head: [['التقرير', 'القيمة']],
        body: [['إجمالي المبيعات', `${totalSales} ج.م`], ['صافي الربح', `${totalProfit} ج.م`], ['ديون العملاء', `${totalCustomerDebt} ج.م`], ['ديون للموردين', `${totalSupplierDebt} ج.م`]]
    });
    doc.save('comprehensive-report.pdf');
  };

  return (
    <div className="p-4 sm:p-5 pb-28 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-xl sm:text-2xl font-bold">التقارير المالية والديون 📈</h2>
        <button onClick={exportPDF} className='bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-2xl font-bold text-xs sm:text-sm shadow transition-all flex items-center gap-1.5'>
          <span>📄</span>
          <span>تصدير تقرير PDF</span>
        </button>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-card p-4 rounded-3xl border border-border">
            <h3 className="text-sm text-text-dim">ديون العملاء</h3>
            <p className="text-xl font-black text-danger">{totalCustomerDebt} ج.م</p>
        </div>
        <div className="bg-card p-4 rounded-3xl border border-border">
            <h3 className="text-sm text-text-dim">مستحق للموردين</h3>
            <p className="text-xl font-black text-danger">{totalSupplierDebt} ج.م</p>
        </div>
      </div>

      <div className="bg-card p-4 rounded-3xl border border-border mb-6">
        <h3 className="text-sm text-text-dim">إجمالي المبيعات والأرباح</h3>
        <p className="text-2xl font-black">{totalSales} ج.م</p>
        <p className="text-sm font-bold text-success">صافي الربح: {totalProfit} ج.م</p>
      </div>

      <h2 className="text-xl font-bold mb-4">تحليل الأداء</h2>
      <div className="bg-card p-4 rounded-3xl border border-border mb-6 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={Array.from({ length: 5 }, (_, i) => ({ name: `الفترة ${i+1}`, مبيعات: totalSales/5, ربح: totalProfit/5 }))}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="مبيعات" fill="#8884d8" />
            <Bar dataKey="ربح" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
