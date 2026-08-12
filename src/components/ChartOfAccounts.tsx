import React, { useState, useEffect } from 'react';
import { FolderTree, Plus, ChevronRight, ChevronDown, Calculator, Building2, Wallet, TrendingUp, TrendingDown, Layers, Search, RefreshCw } from 'lucide-react';

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  level: number;
  isGroup: boolean;
  balance: number;
  parentAccountId: string | null;
}

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['acc_1', 'acc_2', 'acc_3', 'acc_4', 'acc_5']));

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/accounts?companyId=company_default');
      const data = await res.json();
      setAccounts(data);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (id: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedGroups(newSet);
  };

  const renderAccountRow = (acc: Account, depth: number = 0) => {
    const isExpanded = expandedGroups.has(acc.id);
    const children = accounts.filter(child => child.parentAccountId === acc.id);
    const hasChildren = children.length > 0 || acc.isGroup;

    // Filter by search term
    if (searchTerm && !acc.name.includes(searchTerm) && !acc.code.includes(searchTerm)) {
      const hasMatchingChild = accounts.some(c => c.parentAccountId === acc.id && (c.name.includes(searchTerm) || c.code.includes(searchTerm)));
      if (!hasMatchingChild) return null;
    }

    const getTypeColor = (type: string) => {
      switch (type) {
        case 'ASSET': return 'text-emerald-400 bg-emerald-400/10';
        case 'LIABILITY': return 'text-rose-400 bg-rose-400/10';
        case 'EQUITY': return 'text-amber-400 bg-amber-400/10';
        case 'REVENUE': return 'text-blue-400 bg-blue-400/10';
        case 'EXPENSE': return 'text-orange-400 bg-orange-400/10';
        default: return 'text-text-dim bg-card2';
      }
    };

    const getTypeLabel = (type: string) => {
      switch (type) {
        case 'ASSET': return 'أصل';
        case 'LIABILITY': return 'خصم';
        case 'EQUITY': return 'حق ملكية';
        case 'REVENUE': return 'إيراد';
        case 'EXPENSE': return 'مصروف';
        default: return type;
      }
    };

    return (
      <React.Fragment key={acc.id}>
        <tr 
          className={`hover:bg-gold/5 transition-colors border-b border-border/50 ${acc.isGroup ? 'font-bold' : ''}`}
          onClick={() => acc.isGroup && toggleGroup(acc.id)}
        >
          <td className="p-3">
            <div className="flex items-center gap-2" style={{ paddingRight: `${depth * 20}px` }}>
              {acc.isGroup ? (
                isExpanded ? <ChevronDown size={16} className="text-gold" /> : <ChevronRight size={16} className="text-gold" />
              ) : (
                <div className="w-4" />
              )}
              <span className="text-text-dim font-mono text-[11px] w-16">{acc.code}</span>
              <span className="text-sm">{acc.name}</span>
            </div>
          </td>
          <td className="p-3 text-center">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border border-current ${getTypeColor(acc.type)}`}>
              {getTypeLabel(acc.type)}
            </span>
          </td>
          <td className="p-3 text-center">
            <span className={`text-[11px] font-bold ${acc.isGroup ? 'text-text-dim' : 'text-text-main'}`}>
              {acc.isGroup ? 'حساب رئيسي' : 'حساب فرعي'}
            </span>
          </td>
          <td className="p-3 text-left font-mono font-bold text-sm">
            <span className={acc.balance < 0 ? 'text-rose-400' : 'text-emerald-400'}>
              {Number(acc.balance).toLocaleString()}
            </span>
          </td>
          <td className="p-3 text-center">
            <button className="p-1.5 hover:bg-gold/10 text-text-dim hover:text-gold rounded-lg transition-all">
              <Plus size={14} />
            </button>
          </td>
        </tr>
        {acc.isGroup && isExpanded && children.map(child => renderAccountRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
      <div className="p-6 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-text-main flex items-center gap-2">
            <FolderTree className="text-gold" />
            <span>شجرة الحسابات (Chart of Accounts)</span>
          </h2>
          <p className="text-xs text-text-dim mt-1">هيكلة الحسابات المالية متعددة المستويات للشركة</p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-text-dim" size={14} />
            <input 
              type="text"
              placeholder="بحث بالكود أو الاسم..."
              className="w-full bg-card2 border border-border rounded-xl py-2 pr-9 pl-3 text-xs focus:border-gold outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={fetchAccounts}
            className="p-2 bg-card2 border border-border rounded-xl hover:text-gold transition-all"
            title="تحديث البيانات"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="bg-gold text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm active:scale-95 transition-all">
            <Plus size={16} />
            <span>إضافة حساب</span>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-card2/50 border-b border-border text-text-dim text-[11px] font-bold uppercase">
              <th className="p-3 text-right">الحساب (الكود والاسم)</th>
              <th className="p-3 text-center">النوع</th>
              <th className="p-3 text-center">التصنيف</th>
              <th className="p-3 text-left">الرصيد الحالي</th>
              <th className="p-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-text-dim">جاري تحميل شجرة الحسابات...</td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-10 text-center text-text-dim">لا توجد حسابات مسجلة</td>
              </tr>
            ) : (
              accounts.filter(acc => !acc.parentAccountId).map(rootAcc => renderAccountRow(rootAcc))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
