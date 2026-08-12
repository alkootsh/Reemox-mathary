import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MessageSquare, 
  Star, 
  Search, 
  Phone, 
  Mail, 
  Calendar, 
  Clock, 
  TrendingUp, 
  History,
  Plus,
  Filter,
  CheckCircle2,
  AlertCircle,
  MapPin,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Interaction {
  id: string;
  type: string;
  notes: string;
  date: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  points: number;
  totalSales: number;
  lastVisit: string;
}

export default function CRM() {
  const [activeTab, setActiveTab] = useState<'customers' | 'loyalty' | 'interactions'>('customers');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/customers?companyId=company_default');
      const data = await res.json();
      // Mocking some extra fields for CRM
      if (Array.isArray(data)) {
        setCustomers(data.map((c: any) => ({
          ...c,
          points: Math.floor(Math.random() * 500),
          totalSales: Math.floor(Math.random() * 5000),
          lastVisit: new Date().toISOString()
        })));
      } else {
        console.error('Invalid customers data for CRM:', data);
        setCustomers([]);
      }
    } catch (err) {
      console.error('Error fetching customers for CRM:', err);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-text-main flex items-center gap-3">
            <div className="p-3 bg-purple-400/10 rounded-2xl">
              <Star className="text-purple-400" size={32} />
            </div>
            <span>إدارة علاقات العملاء والولاء</span>
          </h1>
          <p className="text-text-dim mt-2 max-w-2xl leading-relaxed">
            متابعة سجل تفاعلات العملاء، إدارة نقاط الولاء، وتحليل سلوك الشراء لزيادة المبيعات.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-card p-1.5 rounded-2xl border border-border shadow-sm">
          {[
            { id: 'customers', label: 'قاعدة العملاء', icon: Users },
            { id: 'loyalty', label: 'برنامج الولاء', icon: Star },
            { id: 'interactions', label: 'سجل التواصل', icon: MessageSquare },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === tab.id ? 'bg-purple-400 text-white shadow-lg shadow-purple-400/20' : 'text-text-dim hover:text-text-main'
              }`}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* SEARCH & FILTERS */}
      <div className="bg-card p-4 rounded-3xl border border-border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
          <input 
            type="text" 
            placeholder="بحث في أسماء العملاء، أرقام الجوال..." 
            className="w-full bg-card2 border border-border rounded-xl py-2.5 pr-10 pl-4 text-sm focus:border-purple-400 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <button className="flex-1 md:flex-none bg-card2 border border-border text-text-dim px-4 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:text-text-main transition-all">
            <Filter size={16} />
            <span>تصفية</span>
          </button>
          <button className="flex-1 md:flex-none bg-purple-400 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-400/20 active:scale-95 transition-all">
            <Plus size={18} />
            <span>إضافة عميل</span>
          </button>
        </div>
      </div>

      {/* CUSTOMER GRID */}
      <AnimatePresence mode="wait">
        {activeTab === 'customers' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {loading ? (
              <div className="col-span-full py-20 text-center text-text-dim font-bold">جاري تحميل قاعدة العملاء...</div>
            ) : customers.length === 0 ? (
              <div className="col-span-full py-20 text-center text-text-dim">لا يوجد عملاء مسجلين</div>
            ) : (
              customers
                .filter(c => c.name.includes(searchTerm) || c.phone?.includes(searchTerm))
                .map(customer => (
                  <div key={customer.id} className="bg-card rounded-3xl border border-border shadow-sm p-6 hover:border-purple-400/30 transition-all group relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-400 opacity-0 group-hover:opacity-100 transition-all" />
                    
                    <div className="flex items-start justify-between">
                      <div className="w-14 h-14 rounded-2xl bg-purple-400/10 flex items-center justify-center text-purple-400 font-black text-lg border border-purple-400/20">
                        {customer.name.split(' ').map(n => n[0]).join('').substr(0, 2)}
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">
                          <TrendingUp size={10} />
                          <span>VIP</span>
                        </span>
                        <div className="mt-2 flex items-center gap-1 text-gold">
                          <Star size={12} fill="currentColor" />
                          <span className="text-sm font-black font-mono">{customer.points}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      <h3 className="text-base font-black text-text-main group-hover:text-purple-400 transition-colors">{customer.name}</h3>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2 text-xs text-text-dim">
                          <Phone size={14} className="text-purple-400/60" />
                          <span className="font-mono">{customer.phone || '---'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-text-dim">
                          <Mail size={14} className="text-purple-400/60" />
                          <span className="truncate">{customer.email || '---'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-6 border-t border-border flex justify-between items-center">
                      <div>
                        <p className="text-[10px] text-text-dim font-bold">إجمالي المشتريات</p>
                        <p className="text-sm font-black text-text-main font-mono">{Number(customer.totalSales).toLocaleString()} <span className="text-[10px]">SAR</span></p>
                      </div>
                      <button className="p-2 bg-card2 rounded-xl text-text-dim hover:text-purple-400 transition-all border border-border">
                        <History size={16} />
                      </button>
                    </div>
                  </div>
                ))
            )}
          </motion.div>
        )}

        {activeTab === 'loyalty' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-card p-12 rounded-3xl border border-border shadow-sm flex flex-col items-center justify-center text-center gap-4"
          >
            <div className="p-6 bg-gold/10 rounded-full text-gold">
              <Star size={48} />
            </div>
            <div>
              <h3 className="text-xl font-black text-text-main">برنامج الولاء (Loyalty Rewards)</h3>
              <p className="text-text-dim mt-2 max-w-md mx-auto">سيتم هنا إدارة قواعد كسب النقاط، استبدال المكافآت، وفئات العملاء المتميزة لزيادة معدل تكرار الشراء.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 w-full max-w-2xl">
              <div className="p-4 bg-card2 rounded-2xl border border-border text-right">
                <p className="text-xs text-text-dim font-bold uppercase tracking-wider">قاعدة الكسب</p>
                <p className="text-sm font-black text-text-main mt-1">1 نقطة لكل 10 ريال شراء</p>
              </div>
              <div className="p-4 bg-card2 rounded-2xl border border-border text-right">
                <p className="text-xs text-text-dim font-bold uppercase tracking-wider">قاعدة الاستبدال</p>
                <p className="text-sm font-black text-text-main mt-1">100 نقطة = 10 ريال خصم</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
