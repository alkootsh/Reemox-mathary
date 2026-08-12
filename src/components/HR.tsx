import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  CreditCard, 
  Calendar, 
  Briefcase, 
  DollarSign, 
  Search, 
  ChevronRight, 
  ShieldCheck, 
  Clock,
  TrendingUp,
  FileText,
  Building,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Employee {
  id: string;
  name: string;
  code: string;
  position: string;
  department: string;
  salary: string;
  status: string;
  joiningDate: string;
}

export default function HR() {
  const [activeTab, setActiveTab] = useState<'employees' | 'payroll' | 'attendance'>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/employees?companyId=company_default');
      const data = await res.json();
      if (Array.isArray(data)) {
        setEmployees(data);
      } else {
        console.error('Invalid employees data:', data);
        setEmployees([]);
      }
    } catch (err) {
      console.error('Error fetching employees:', err);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  const safeEmployees = Array.isArray(employees) ? employees : [];

  const stats = [
    { label: 'إجمالي الموظفين', value: safeEmployees.length, icon: Users, color: 'blue' },
    { label: 'نشط حالياً', value: safeEmployees.filter(e => e.status === 'ACTIVE').length, icon: CheckCircle2, color: 'emerald' },
    { label: 'إجمالي الرواتب', value: safeEmployees.reduce((acc, curr) => acc + (Number(curr.salary) || 0), 0).toLocaleString(), icon: DollarSign, color: 'gold' },
    { label: 'طلبات الإجازة', value: 0, icon: Clock, color: 'orange' },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-text-main flex items-center gap-3">
            <div className="p-3 bg-blue-400/10 rounded-2xl">
              <Users className="text-blue-400" size={32} />
            </div>
            <span>الموارد البشرية وشؤون الموظفين</span>
          </h1>
          <p className="text-text-dim mt-2 max-w-2xl leading-relaxed">
            إدارة بيانات الموظفين، الرواتب، العهد، ومتابعة الأداء الوظيفي والتواجد.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-card p-1.5 rounded-2xl border border-border shadow-sm">
          {[
            { id: 'employees', label: 'الموظفين', icon: Users },
            { id: 'payroll', label: 'مسيرات الرواتب', icon: CreditCard },
            { id: 'attendance', label: 'الحضور والانصراف', icon: Clock },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                activeTab === tab.id ? 'bg-blue-400 text-white shadow-lg shadow-blue-400/20' : 'text-text-dim hover:text-text-main'
              }`}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-card p-5 rounded-3xl border border-border shadow-sm flex items-center gap-4 hover:border-blue-400/30 transition-all cursor-default group">
            <div className={`p-3 bg-${stat.color}-400/10 rounded-2xl group-hover:scale-110 transition-transform`}>
              <stat.icon className={`text-${stat.color === 'gold' ? 'gold' : stat.color + '-400'}`} size={24} />
            </div>
            <div>
              <p className="text-xs text-text-dim font-bold">{stat.label}</p>
              <p className="text-xl font-black text-text-main mt-0.5">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CONTENT */}
      <AnimatePresence mode="wait">
        {activeTab === 'employees' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="relative w-full md:w-96">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim" size={16} />
                  <input 
                    type="text" 
                    placeholder="بحث في أسماء الموظفين أو الأكواد..." 
                    className="w-full bg-card2 border border-border rounded-xl py-2.5 pr-10 pl-4 text-sm focus:border-blue-400 outline-none transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button className="w-full md:w-auto bg-blue-400 text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-400/20 active:scale-95 transition-all">
                  <UserPlus size={18} />
                  <span>إضافة موظف جديد</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-card2/50 border-b border-border text-text-dim text-[11px] font-bold uppercase tracking-wider">
                      <th className="p-4">الموظف</th>
                      <th className="p-4">المنصب / القسم</th>
                      <th className="p-4">تاريخ الانضمام</th>
                      <th className="p-4 text-left">الراتب الأساسي</th>
                      <th className="p-4 text-center">الحالة</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="p-20 text-center text-text-dim">جاري تحميل بيانات الموظفين...</td>
                      </tr>
                    ) : safeEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-20 text-center">
                          <div className="flex flex-col items-center gap-3 text-text-dim">
                            <Users size={48} className="opacity-20" />
                            <p>لا يوجد موظفين مسجلين حالياً</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      safeEmployees
                        .filter(e => e.name.includes(searchTerm) || e.code?.includes(searchTerm))
                        .map(emp => (
                          <tr key={emp.id} className="hover:bg-blue-400/5 transition-all group">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-card2 flex items-center justify-center text-blue-400 font-black text-xs border border-border">
                                  {emp.name.split(' ').map(n => n[0]).join('').substr(0, 2)}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-text-main">{emp.name}</p>
                                  <p className="text-[10px] text-text-dim font-mono uppercase">{emp.code || '---'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-bold">{emp.position || '---'}</span>
                                <span className="text-[10px] text-text-dim">{emp.department || '---'}</span>
                              </div>
                            </td>
                            <td className="p-4 text-xs font-mono text-text-dim">
                              {emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('ar-EG') : '---'}
                            </td>
                            <td className="p-4 text-left">
                              <span className="text-sm font-black text-text-main font-mono">
                                {Number(emp.salary).toLocaleString()} <span className="text-[10px] text-text-dim">SAR</span>
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                                emp.status === 'ACTIVE' 
                                  ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' 
                                  : 'bg-rose-400/10 text-rose-400 border-rose-400/20'
                              }`}>
                                {emp.status === 'ACTIVE' ? 'على رأس العمل' : 'متوقف'}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex justify-center gap-2">
                                <button className="p-2 hover:bg-blue-400/10 text-text-dim hover:text-blue-400 rounded-xl transition-all"><FileText size={16} /></button>
                                <button className="p-2 hover:bg-blue-400/10 text-text-dim hover:text-blue-400 rounded-xl transition-all"><TrendingUp size={16} /></button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'payroll' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-card p-12 rounded-3xl border border-border shadow-sm flex flex-col items-center justify-center text-center gap-4"
          >
            <div className="p-6 bg-gold/10 rounded-full text-gold">
              <CreditCard size={48} />
            </div>
            <div>
              <h3 className="text-xl font-black text-text-main">مسيرات الرواتب (Payroll Management)</h3>
              <p className="text-text-dim mt-2 max-w-md mx-auto">سيتم هنا عرض كشوف الرواتب الشهرية، البدلات، الاستقطاعات، وإصدار أوامر الصرف البنكية.</p>
            </div>
            <button className="bg-gold text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-gold/20 active:scale-95 transition-all mt-4">
              إصدار مسير رواتب جديد
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
