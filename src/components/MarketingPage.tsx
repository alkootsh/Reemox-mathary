import React from 'react';
import { Zap, Package, BarChart3, Users, Printer, WifiOff, CheckCircle } from 'lucide-react';

export default function MarketingPage({ onBack }: { onBack: () => void }) {
  const features = [
    { icon: Zap, title: 'سرعة البيع', desc: 'سلة مبيعات سريعة مع مسح الباركود بالكاميرا وأزرار دفع سريع' },
    { icon: Package, title: 'إدارة المخزون', desc: 'تنبيه تلقائي عند نقص أي صنف مع تتبع الكميات لحظة بلحظة' },
    { icon: BarChart3, title: 'تقارير ذكية', desc: 'أرباح يومية وشهرية وسنوية مع أكثر المنتجات مبيعًا' },
    { icon: Users, title: 'إدارة العملاء', desc: 'نقاط ولاء وسجل مشتريات وتذكيرات الديون عبر واتساب' },
  ];

  const plans = [
    { name: 'مجاني', price: '0', features: ['نقطة بيع واحدة', 'حتى 100 منتج', 'تقارير أساسية'] },
    { name: 'محترف', price: '99', features: ['منتجات غير محدودة', 'إدارة عملاء ونقاط ولاء', 'طباعة بلوتوث', 'تقارير متقدمة', 'تتبع المصروفات'], popular: true },
    { name: 'مؤسسة', price: '199', features: ['كل ما في المحترف', 'فروع متعددة', 'إدارة كاشيرين', 'إدارة موردين', 'دعم مخصص 24/7'] },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-20" dir="rtl">
      <header className="py-6 px-8 flex justify-between items-center bg-slate-900 sticky top-0 z-50 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-amber-500">محيّل</h1>
        <button onClick={onBack} className="text-slate-400 hover:text-white">العودة</button>
      </header>
      
      <main className="max-w-6xl mx-auto py-20 px-8">
        <section className="text-center mb-24">
          <h2 className="text-5xl font-extrabold mb-6 text-white tracking-tight">نقطة البيع الذكية<br /><span className='text-amber-500'>محيّل</span></h2>
          <p className="text-xl text-slate-400 mb-10 max-w-xl mx-auto">
            برنامج نقطة البيع الأول لأصحاب المحلات. حل SaaS متكامل لإدارة المبيعات والمخزون والعملاء — بسيط، سريع، ويعمل بدون إنترنت.
          </p>
          <button className="bg-amber-500 text-slate-950 px-10 py-4 rounded-full text-lg font-bold shadow-lg hover:bg-amber-400 transition">جرب محيّل مجانًا</button>
        </section>

        <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-24">
            {features.map((f, i) => (
                <div key={i} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 hover:border-slate-700 transition">
                    <f.icon className="w-10 h-10 text-teal-400 mb-4" />
                    <h3 className="text-xl font-bold mb-2">{f.title}</h3>
                    <p className="text-slate-400 text-sm">{f.desc}</p>
                </div>
            ))}
        </section>

        <section className="mb-24">
            <h2 className="text-3xl font-bold text-center mb-16">خطط الأسعار</h2>
            <div className="grid md:grid-cols-3 gap-8">
                {plans.map((plan, i) => (
                    <div key={i} className={`p-8 rounded-3xl border ${plan.popular ? 'border-amber-500 bg-slate-900' : 'border-slate-800 bg-slate-950'}`}>
                        {plan.popular && <div className="text-amber-500 text-xs font-bold mb-2 text-center uppercase tracking-widest">الأكثر طلباً</div>}
                        <h3 className="text-2xl font-bold text-center mb-1">{plan.name}</h3>
                        <p className="text-center text-slate-400 mb-6">{plan.price} ج.م / شهرياً</p>
                        <ul className="space-y-3 mb-8">
                            {plan.features.map(f => (<li key={f} className="flex items-center gap-2"><CheckCircle className="w-5 h-5 text-teal-400" /> <span className='text-slate-300 text-sm'>{f}</span></li>))}
                        </ul>
                        <button className={`w-full py-3 rounded-xl font-bold ${plan.popular ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-white'}`}>اختر الخطة</button>
                    </div>
                ))}
            </div>
        </section>
      </main>
    </div>
  );
}
