import React from 'react';

export default function LandingPage({ onGetStarted, onMarketing }: { onGetStarted: () => void, onMarketing: () => void }) {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <header className="py-6 px-8 flex justify-between items-center bg-white shadow-sm">
        <h1 className="text-2xl font-bold text-gold">متجري</h1>
        <div className="flex gap-4">
          <button onClick={onMarketing} className="text-gray-600 hover:text-gold">تعرف أكثر</button>
          <button 
            onClick={onGetStarted}
            className="bg-gold text-white px-6 py-2 rounded-full font-bold hover:bg-gold2 transition"
          >
            البدء الآن
          </button>
        </div>
      </header>
      
      <main className="max-w-5xl mx-auto py-20 px-8 text-center">
        <h2 className="text-5xl font-extrabold mb-6 leading-tight">
          إدارة متجرك أصبحت أسهل من أي وقت مضى مع <span className="text-gold">متجري</span>
        </h2>
        <p className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto">
          نظام محاسبي متكامل يساعدك في إدارة المنتجات، المبيعات، المخزون، والتقارير بكل احترافية وسهولة.
        </p>
        <button 
          onClick={onGetStarted}
          className="bg-gold text-white px-10 py-4 rounded-full text-lg font-bold shadow-lg hover:shadow-xl hover:bg-gold2 transition transform hover:-translate-y-1"
        >
          ابدأ تجربة النظام مجاناً
        </button>
        
        <div className="grid md:grid-cols-3 gap-10 mt-20">
          {[
            { title: 'إدارة مخزون ذكية', desc: 'تتبع منتجاتك وكمياتها بدقة عالية.' },
            { title: 'نظام نقاط بيع سريع', desc: 'إتمام عمليات البيع وتسجيل الفواتير في ثواني.' },
            { title: 'تقارير مالية شاملة', desc: 'احصل على تحليل دقيق لأداء عملك.' },
          ].map((feature, i) => (
            <div key={i} className="p-8 bg-gray-50 rounded-3xl border border-gray-100">
              <h3 className="text-xl font-bold mb-4">{feature.title}</h3>
              <p className="text-gray-600">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
