import { useState } from 'react';
import { Sale, Customer } from '../types/types';
import { ShoppingCart } from 'lucide-react';

export default function ActivityLog({ sales, customers }: { sales: Sale[], customers: Customer[] }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    const filteredSales = sales.filter(s => {
        const customer = customers.find(c => c.id === s.customerId || c.name === s.customerName);
        const matchesSearch = s.id.includes(searchTerm) || (customer?.name.includes(searchTerm) || (s.customerName && s.customerName.includes(searchTerm)));
        const matchesDate = dateFilter ? new Date(s.date).toDateString() === new Date(dateFilter).toDateString() : true;
        return matchesSearch && matchesDate;
    });

    return (
        <div className="p-4 sm:p-5 pb-28 max-w-4xl mx-auto space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold">سجل المبيعات والفواتير</h2>
            <div className="flex flex-col sm:flex-row gap-3">
                <input placeholder="بحث برقم الفاتورة أو العميل..." className="bg-card2 border border-border p-3 rounded-2xl flex-1 text-sm focus:outline-none focus:border-gold" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                <input type="date" className="bg-card2 border border-border p-3 rounded-2xl text-sm focus:outline-none focus:border-gold" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
            </div>
            
            <div className="bg-card p-5 rounded-4xl border border-border">
                {filteredSales.length === 0 ? <p className="text-text-dim">لا توجد مبيعات تطابق البحث.</p> : (
                    <div className='space-y-2'>
                        {filteredSales.map((sale) => (
                            <div key={sale.id} className="border-b border-border py-3 text-sm flex justify-between items-center">
                                <div className='flex items-center gap-3'>
                                    <div className='bg-accent p-2 rounded-xl text-white'><ShoppingCart size={16} /></div>
                                    <div>
                                        <p className='font-bold'>فاتورة #{sale.id}</p>
                                        <p className='text-xs text-text-dim'>{new Date(sale.date).toLocaleString('ar-EG')} - {sale.customerName}</p>
                                    </div>
                                </div>
                                <p className='font-bold'>{sale.total} {localStorage.getItem('currency') || 'ج.م'}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
