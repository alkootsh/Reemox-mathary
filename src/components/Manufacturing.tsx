import React, { useState, useEffect } from 'react';
import { 
  Factory, 
  Settings, 
  Layers, 
  Plus, 
  Search, 
  Package, 
  Wrench, 
  History, 
  ChevronRight, 
  FileText,
  AlertCircle,
  TrendingUp,
  Cpu,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface BOMItem {
  id: string;
  productId: string;
  quantity: string;
  unitCost: string;
}

interface BOM {
  id: string;
  name: string;
  productId: string;
  totalCost: string;
  items: BOMItem[];
}

interface Product {
  id: string;
  name: string;
  sku: string;
  price: string;
}

export default function Manufacturing() {
  const [activeTab, setActiveTab] = useState<'boms' | 'orders' | 'settings'>('boms');
  const [boms, setBoms] = useState<BOM[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddBOM, setShowAddBOM] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bomRes, prodRes] = await Promise.all([
        fetch('/api/manufacturing/boms?companyId=company_default'),
        fetch('/api/products?companyId=company_default')
      ]);
      const [bomData, prodData] = await Promise.all([bomRes.json(), prodRes.json()]);
      setBoms(bomData);
      setProducts(prodData);
    } catch (err) {
      console.error('Error fetching manufacturing data:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-text-main flex items-center gap-3">
            <div className="p-3 bg-gold/10 rounded-2xl">
              <Factory className="text-gold" size={32} />
            </div>
            <span>مديول التصنيع والإنتاج</span>
          </h1>
          <p className="text-text-dim mt-2 max-w-2xl leading-relaxed">
            إدارة قوائم المواد (BOM)، مراحل الإنتاج، وحساب التكاليف الفعلية للمنتجات المصنعة.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-card p-1.5 rounded-2xl border border-border shadow-sm">
          <button 
            onClick={() => setActiveTab('boms')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'boms' ? 'bg-gold text-white shadow-lg shadow-gold/20' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <Layers size={16} />
            <span>قوائم المواد (BOM)</span>
          </button>
          <button 
            onClick={() => setActiveTab('orders')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'orders' ? 'bg-gold text-white shadow-lg shadow-gold/20' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <Cpu size={16} />
            <span>أوامر الإنتاج</span>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'settings' ? 'bg-gold text-white shadow-lg shadow-gold/20' : 'text-text-dim hover:text-text-main'
            }`}
          >
            <Settings size={16} />
            <span>الإعدادات</span>
          </button>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي قوائم المواد', value: boms.length, icon: Layers, color: 'emerald' },
          { label: 'أوامر إنتاج نشطة', value: 0, icon: Cpu, color: 'blue' },
          { label: 'منتجات تحت التشغيل', value: 0, icon: Wrench, color: 'orange' },
          { label: 'كفاءة الإنتاج', value: '100%', icon: TrendingUp, color: 'gold' },
        ].map((stat, i) => (
          <div key={i} className="bg-card p-5 rounded-3xl border border-border shadow-sm flex items-center gap-4 hover:border-gold/30 transition-all cursor-default">
            <div className={`p-3 bg-${stat.color}-400/10 rounded-2xl`}>
              <stat.icon className={`text-${stat.color === 'gold' ? 'gold' : stat.color + '-400'}`} size={24} />
            </div>
            <div>
              <p className="text-xs text-text-dim font-bold">{stat.label}</p>
              <p className="text-xl font-black text-text-main mt-0.5">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* MAIN CONTENT AREA */}
      <AnimatePresence mode="wait">
        {activeTab === 'boms' && (
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
                    placeholder="بحث في قوائم المواد..." 
                    className="w-full bg-card2 border border-border rounded-xl py-2.5 pr-10 pl-4 text-sm focus:border-gold outline-none transition-all"
                  />
                </div>
                <button 
                  onClick={() => setShowAddBOM(true)}
                  className="w-full md:w-auto bg-gold text-white px-6 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-gold/20 active:scale-95 transition-all"
                >
                  <Plus size={18} />
                  <span>إنشاء قائمة مواد (BOM)</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-card2/50 border-b border-border text-text-dim text-[11px] font-bold uppercase tracking-wider">
                      <th className="p-4">اسم المنتج النهائي</th>
                      <th className="p-4">اسم القائمة (BOM)</th>
                      <th className="p-4 text-center">عدد المكونات</th>
                      <th className="p-4 text-left">تكلفة الإنتاج التقريبية</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="p-20 text-center text-text-dim">جاري تحميل البيانات...</td>
                      </tr>
                    ) : boms.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-20 text-center">
                          <div className="flex flex-col items-center gap-3 text-text-dim">
                            <Layers size={48} className="opacity-20" />
                            <p>لا توجد قوائم مواد مسجلة حالياً</p>
                            <button onClick={() => setShowAddBOM(true)} className="text-gold text-sm font-bold underline">إضافة أول قائمة مواد</button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      boms.map(bom => {
                        const prod = products.find(p => p.id === bom.productId);
                        return (
                          <tr key={bom.id} className="hover:bg-gold/5 transition-all group">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-card2 rounded-lg text-gold">
                                  <Package size={18} />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-text-main">{prod?.name || 'منتج غير معروف'}</p>
                                  <p className="text-[10px] text-text-dim font-mono">{prod?.sku}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-sm font-bold">{bom.name}</td>
                            <td className="p-4 text-center">
                              <span className="px-2.5 py-1 bg-card2 border border-border rounded-lg text-[11px] font-bold">
                                {bom.items?.length || 0} مكونات
                              </span>
                            </td>
                            <td className="p-4 text-left">
                              <span className="text-sm font-black text-emerald-400 font-mono">
                                {Number(bom.totalCost).toLocaleString()} <span className="text-[10px]">SAR</span>
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                <button className="p-2 hover:bg-gold/10 text-text-dim hover:text-gold rounded-xl transition-all" title="تعديل">
                                  <Settings size={16} />
                                </button>
                                <button className="p-2 hover:bg-gold/10 text-text-dim hover:text-gold rounded-xl transition-all" title="معاينة">
                                  <FileText size={16} />
                                </button>
                                <button className="p-2 hover:bg-gold/10 text-text-dim hover:text-gold rounded-xl transition-all" title="إنتاج">
                                  <ArrowRight size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'orders' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-card p-12 rounded-3xl border border-border shadow-sm flex flex-col items-center justify-center text-center gap-4"
          >
            <div className="p-6 bg-blue-400/10 rounded-full text-blue-400">
              <Cpu size={48} />
            </div>
            <div>
              <h3 className="text-xl font-black text-text-main">أوامر الإنتاج (Production Orders)</h3>
              <p className="text-text-dim mt-2 max-w-md mx-auto">سيتم هنا عرض أوامر الإنتاج قيد التنفيذ، ومتابعة سحب المواد الخام من المستودعات وتحويلها لمنتجات تامة الصنع.</p>
            </div>
            <button className="bg-blue-400 text-white px-8 py-3 rounded-2xl font-bold text-sm shadow-lg shadow-blue-400/20 active:scale-95 transition-all mt-4">
              إضافة أمر إنتاج جديد
            </button>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-4">
              <h3 className="text-lg font-black text-text-main flex items-center gap-2">
                <Settings className="text-gold" size={20} />
                <span>إعدادات التكاليف</span>
              </h3>
              <p className="text-xs text-text-dim">تحديد كيفية حساب تكاليف العمالة والكهرباء والفاقد في عمليات التصنيع.</p>
              <div className="space-y-3 pt-4">
                <div className="flex justify-between items-center p-3 bg-card2 rounded-2xl border border-border">
                  <span className="text-sm font-bold">نسبة الفاقد الافتراضية (Waste %)</span>
                  <input type="number" defaultValue={2} className="w-20 bg-card border border-border rounded-lg p-1 text-center font-bold" />
                </div>
                <div className="flex justify-between items-center p-3 bg-card2 rounded-2xl border border-border">
                  <span className="text-sm font-bold">حساب تكلفة العمالة بالساعة</span>
                  <input type="number" defaultValue={25} className="w-20 bg-card border border-border rounded-lg p-1 text-center font-bold" />
                </div>
              </div>
            </div>

            <div className="bg-card p-6 rounded-3xl border border-border shadow-sm space-y-4">
              <h3 className="text-lg font-black text-text-main flex items-center gap-2">
                <AlertCircle className="text-gold" size={20} />
                <span>الرقابة المخزنية</span>
              </h3>
              <p className="text-xs text-text-dim">تنبيهات النواقص للمواد الخام المطلوبة لتنفيذ أوامر الإنتاج المجدولة.</p>
              <div className="p-8 text-center text-text-dim italic text-sm">
                سيتم تفعيل الرقابة المتقدمة في التحديث القادم
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
