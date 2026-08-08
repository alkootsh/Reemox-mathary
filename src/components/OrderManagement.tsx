import React, { useState } from 'react';
import { ShoppingBag, Clock, CheckCircle, Coins, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const orders = [
  { id:'ORD-2024-1048', name:'أحمد محمود سعيد', phone:'0101234567', date:'29 مايو 2026', items:3, status:'مكتمل', amount:'1,250' },
  { id:'ORD-2024-1047', name:'سارة عبد الله', phone:'0121234567', date:'29 مايو 2026', items:1, status:'شحن', amount:'780' },
];

export default function OrderManagement() {
  const [filter, setFilter] = useState('all');

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(orders);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");
    XLSX.writeFile(workbook, "orders.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const tableColumn = ["رقم الطلب", "العميل", "التاريخ", "الحالة", "المبلغ"];
    const tableRows = orders.map(o => [o.id, o.name, o.date, o.status, o.amount]);
    (doc as any).autoTable({
        head: [tableColumn],
        body: tableRows,
    });
    doc.save("orders.pdf");
  };

  return (
    <div className="p-4 sm:p-5 text-right space-y-6 pb-28" dir="rtl">
      <div className='flex justify-between items-center flex-wrap gap-2'>
        <h2 className="text-xl sm:text-2xl font-bold">إدارة الطلبات</h2>
        <div className='flex gap-2'>
            <button onClick={exportToExcel} className='bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-xl flex items-center gap-1 text-xs sm:text-sm font-bold shadow transition-all'><Download size={15}/> Excel</button>
            <button onClick={exportToPDF} className='bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-xl flex items-center gap-1 text-xs sm:text-sm font-bold shadow transition-all'><Download size={15}/> PDF</button>
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الطلبات', value: '248', icon: ShoppingBag, color: 'text-purple-600' },
          { label: 'قيد المعالجة', value: '38', icon: Clock, color: 'text-teal-600' },
          { label: 'مكتملة', value: '189', icon: CheckCircle, color: 'text-green-600' },
          { label: 'الإيرادات (ج.م)', value: '84,290', icon: Coins, color: 'text-amber-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-card p-4 rounded-3xl border border-border flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-secondary/20 ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-xs text-text-dim">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-card p-4 rounded-3xl border border-border flex gap-2 overflow-x-auto">
        {['الكل', 'جديد', 'معالجة', 'مكتمل'].map(f => (
          <button 
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-bold ${filter === f ? 'bg-primary text-white' : 'bg-secondary text-text-main'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card rounded-3xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm min-w-[500px]">
            <thead className="bg-secondary/10">
              <tr>
                <th className="p-4">رقم الطلب</th>
                <th className="p-4">العميل</th>
                <th className="p-4">التاريخ</th>
                <th className="p-4">الحالة</th>
                <th className="p-4">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} className="border-t border-border hover:bg-secondary/5">
                  <td className="p-4 font-bold">{o.id}</td>
                  <td className="p-4">{o.name}</td>
                  <td className="p-4">{o.date}</td>
                  <td className="p-4"><span className="bg-green-500/20 text-green-400 px-2.5 py-1 rounded-full text-xs font-bold">{o.status}</span></td>
                  <td className="p-4 font-bold text-gold font-mono">{o.amount} ج.م</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

