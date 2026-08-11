import { useState } from 'react';
import { Sale, Customer } from '../types/types';
import { ShoppingCart, Home } from 'lucide-react';

export default function ActivityLog({ sales, customers, onNavigateHome }: { sales: Sale[], customers: Customer[], onNavigateHome?: () => void }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    const filteredSales = sales.filter(s => {
        const customer = customers.find(c => c.id === s.customerId || c.name === s.customerName);
        const invNum = s.invoiceNumber || s.id;
        const matchesSearch = invNum.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              s.id.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (customer?.name && customer.name.includes(searchTerm)) || 
                              (s.customerName && s.customerName.includes(searchTerm));
        const matchesDate = dateFilter ? new Date(s.date).toDateString() === new Date(dateFilter).toDateString() : true;
        return matchesSearch && matchesDate;
    });

    return (
        <div className="p-4 sm:p-5 pb-28 max-w-4xl mx-auto space-y-4">
            <div className="flex justify-between items-center flex-wrap gap-2">
                <h2 className="text-xl sm:text-2xl font-bold">سجل المبيعات والفواتير</h2>
                {onNavigateHome && (
                    <button
                        onClick={onNavigateHome}
                        className="bg-gold/20 hover:bg-gold text-gold hover:text-white border border-gold/30 px-3.5 py-2 rounded-2xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                    >
                        <Home size={16} />
                        <span>العودة للرئيسية</span>
                    </button>
                )}
            </div>
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
                                        <p className='font-bold'>فاتورة #{sale.invoiceNumber || sale.id}</p>
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
