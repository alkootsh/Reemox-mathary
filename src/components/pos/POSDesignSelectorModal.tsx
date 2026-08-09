import React from 'react';
import { Layout, Check, Sparkles, Smartphone, Monitor, Zap, Moon, X } from 'lucide-react';

export type POSDesignType = 'emerald' | 'classic' | 'touch' | 'dark';

interface POSDesignSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDesign: POSDesignType;
  onSelectDesign: (design: POSDesignType) => void;
}

export default function POSDesignSelectorModal({
  isOpen,
  onClose,
  currentDesign,
  onSelectDesign
}: POSDesignSelectorModalProps) {
  if (!isOpen) return null;

  const designs: {
    id: POSDesignType;
    title: string;
    subtitle: string;
    badge: string;
    icon: any;
    themeColor: string;
    accentColor: string;
    features: string[];
    isNew?: boolean;
  }[] = [
    {
      id: 'emerald',
      title: 'التصميم الزمردي الحديث (Modern Emerald)',
      subtitle: 'تصميم أنيق مستوحى من شاشات الكاشير الحديثة والتطبيقات السريعة',
      badge: 'الجديد والمميز ✨',
      icon: Smartphone,
      themeColor: 'from-emerald-950 to-emerald-800',
      accentColor: 'border-emerald-500 text-emerald-400 bg-emerald-500/10',
      features: [
        'هيدر زمردي فاخر مع بيانات العميل ورقم الكارت والموبايل',
        'حساب تلقائي لربح الفاتورة ونظام الكوبونات السريعة',
        'أزرار دفع وطباعة كبيرة وتحصيل فوري بلمسة واحدة',
        'شريط تنقل سفلي مرن للتبديل بين المنتجات والسلة'
      ],
      isNew: true
    },
    {
      id: 'classic',
      title: 'تصميم سطح المكتب الكلاسيكي (Classic ERP)',
      subtitle: 'الواجهة الاحترافية الشاملة لإدارة نقاط البيع الكبيرة والهايبرماركت',
      badge: 'المكتبي المعتمد',
      icon: Monitor,
      themeColor: 'from-slate-900 to-slate-800',
      accentColor: 'border-blue-500 text-blue-400 bg-blue-500/10',
      features: [
        'تقسيم عريض ثنائي (الكتالوج + جدول الفاتورة المحاسبي)',
        'تركيز فوري على قارئ الباركود (اختصار F2)',
        'صلاحيات المشرف لتعديل الأسعار وخصومات متعددة',
        'لوحة كاش سريعة وإحصائيات مبيعات اليوم'
      ]
    },
    {
      id: 'touch',
      title: 'تصميم التاتش السريع (Express Touch POS)',
      subtitle: 'مصمم خصيصاً للشاشات اللمسية، الكافيهات، المطاعم، والمخابز',
      badge: 'فائق السرعة',
      icon: Zap,
      themeColor: 'from-amber-950 to-amber-800',
      accentColor: 'border-amber-500 text-amber-400 bg-amber-500/10',
      features: [
        'بطاقات أصناف لمسية كبيرة مع تصنيفات ملونة',
        'أزرار النقدية السريعة (10، 20، 50، 100، 200 ج.م)',
        'إصدار فواتير بضغطة زر واحدة (1-Click Checkout)',
        'واجهة مريحة بدون الحاجة للوحة مفاتيح'
      ]
    },
    {
      id: 'dark',
      title: 'التصميم الليلي الفاخر (Modern Dark Luxury)',
      subtitle: 'واجهة داكنة مريحة للعين مع تأثيرات نيون ذهبية متطورة',
      badge: 'الوضع الليلي',
      icon: Moon,
      themeColor: 'from-zinc-950 to-neutral-900',
      accentColor: 'border-gold text-gold bg-gold/10',
      features: [
        'تصميم مريح للعين أثناء العمل الليلي الطويل',
        'تباين عالي وتفاصيل ذهبية أنيقة',
        'ماسح كاميرا متطور QR Barcode HUD',
        'تأثيرات صوتية وحركية ممتعة'
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-4xl rounded-3xl border border-border overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-border flex justify-between items-center bg-card2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gold/10 text-gold rounded-2xl border border-gold/20">
              <Layout className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-text-main flex items-center gap-2">
                <span>تخصيص وتغيير تصميم شاشة البيع (POS Design Themes)</span>
                <span className="text-xs bg-gold/20 text-gold px-2.5 py-0.5 rounded-full font-bold">
                  4 تصاميم احترافية
                </span>
              </h2>
              <p className="text-xs text-text-dim mt-0.5">
                اختر التصميم والشكل الأنسب لطبيعة عملك (شاشة لمس، كمبيوتر مكتبي، موبايل أو تابلت)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-card hover:bg-border text-text-dim hover:text-text-main transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Designs Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          {designs.map((design) => {
            const isSelected = currentDesign === design.id;
            const IconComp = design.icon;

            return (
              <div
                key={design.id}
                onClick={() => {
                  onSelectDesign(design.id);
                  onClose();
                }}
                className={`relative rounded-3xl border-2 transition-all p-5 cursor-pointer flex flex-col justify-between overflow-hidden group ${
                  isSelected
                    ? 'border-gold bg-gold/5 shadow-lg shadow-gold/5 scale-[1.01]'
                    : 'border-border bg-card2/50 hover:border-text-dim/40 hover:bg-card2'
                }`}
              >
                {/* Active Selection Badge */}
                {isSelected && (
                  <div className="absolute top-3 left-3 bg-gold text-black font-black text-xs px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                    <Check size={14} />
                    <span>التصميم النشط حالياً</span>
                  </div>
                )}

                <div>
                  {/* Top Bar Preview */}
                  <div className={`h-16 rounded-2xl bg-gradient-to-r ${design.themeColor} p-3 flex items-center justify-between text-white mb-4 border border-white/10 shadow-inner`}>
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-white/10 backdrop-blur-md">
                        <IconComp size={20} />
                      </div>
                      <div>
                        <div className="text-xs font-bold">{design.title.split('(')[0]}</div>
                        <div className="text-[10px] text-white/70">نقطة بيع سريعة</div>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold bg-white/20 px-2.5 py-1 rounded-full backdrop-blur-md">
                      {design.badge}
                    </span>
                  </div>

                  {/* Title & Info */}
                  <div className="space-y-1">
                    <h3 className="font-black text-base text-text-main group-hover:text-gold transition-colors flex items-center gap-2">
                      <span>{design.title}</span>
                    </h3>
                    <p className="text-xs text-text-dim leading-relaxed">
                      {design.subtitle}
                    </p>
                  </div>

                  {/* Features List */}
                  <div className="mt-4 space-y-1.5 pt-3 border-t border-border">
                    {design.features.map((feat, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-text-main">
                        <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                        <span className="text-[11px] text-text-dim">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bottom Action */}
                <div className="mt-5 pt-3 border-t border-border flex items-center justify-between">
                  <span className={`text-xs font-bold px-3 py-1 rounded-xl border ${design.accentColor}`}>
                    {design.id === 'emerald' ? '🌿 شكل الكاشير الزمردي' : design.id === 'classic' ? '🖥️ مكتبي متكامل' : design.id === 'touch' ? '⚡ سريع باللمس' : '🌙 دارك أنيق'}
                  </span>

                  <button
                    type="button"
                    className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-gold text-black shadow-sm'
                        : 'bg-card border border-border text-text-main group-hover:bg-gold group-hover:text-black group-hover:border-gold'
                    }`}
                  >
                    {isSelected ? 'مفعل الآن ✓' : 'تفعيل هذا التصميم'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card2 flex justify-between items-center text-xs text-text-dim">
          <span>يتم حفظ اختيارك تلقائياً ويمكنك التبديل بين التصاميم في أي وقت من شاشة البيع.</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-card border border-border hover:bg-border text-text-main font-bold transition-all"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
