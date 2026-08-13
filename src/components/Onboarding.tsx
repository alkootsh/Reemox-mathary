import React, { useState } from 'react';
import { Building2, Save, CheckCircle2, Factory, Store, ShoppingBag, Utensils, Stethoscope, CarFront, Construction } from 'lucide-react';
import { AppUser } from '../types/types';

interface OnboardingProps {
    currentUser: AppUser | null;
    onComplete: () => void;
}

const INDUSTRIES = [
    { id: 'RETAIL', name: 'تجارة عامة / Retail', icon: Store, desc: 'نقاط بيع، مبيعات، مخزون، وحسابات' },
    { id: 'FOOD', name: 'مواد غذائية / Food', icon: ShoppingBag, desc: 'تواريخ صلاحية، دفعات (Batches)' },
    { id: 'CLOTHING', name: 'ملابس وأحذية / Clothing', icon: Store, desc: 'مقاسات، ألوان، متغيرات (Variants)' },
    { id: 'RESTAURANT', name: 'مطاعم وكافيهات / Restaurant', icon: Utensils, desc: 'طاولات، مطبخ، طلبات داخلية' },
    { id: 'AUTOMOTIVE', name: 'معارض سيارات / Automotive', icon: CarFront, desc: 'أرقام هياكل (VIN)، صيانة' },
    { id: 'CLINIC', name: 'عيادات ومراكز طبية / Clinic', icon: Stethoscope, desc: 'حجوزات، ملفات مرضى' },
    { id: 'CONTRACTING', name: 'مقاولات / Contracting', icon: Construction, desc: 'مشاريع، مستخلصات، مشتريات' },
];

export default function Onboarding({ currentUser, onComplete }: OnboardingProps) {
    const [selected, setSelected] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleIndustry = (id: string) => {
        setSelected(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSave = async () => {
        if (selected.length === 0) {
            setError('يرجى اختيار نشاط واحد على الأقل');
            return;
        }
        
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem('token');
            if (!token) throw new Error('يرجى تسجيل الدخول مجدداً');

            for (const ind of selected) {
                const res = await fetch('/api/config/modules/company', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ moduleName: `INDUSTRY:${ind}`, isEnabled: true })
                });
                
                if (!res.ok) {
                    const data = await res.json().catch(()=>({}));
                    throw new Error(data.error || 'حدث خطأ أثناء حفظ الإعدادات');
                }
            }
            onComplete();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface p-8 rounded-2xl shadow-xl w-full max-w-4xl border border-border">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                        <Building2 className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-text mb-2">مرحباً بك في نظام ERP</h2>
                    <p className="text-text-dim">يرجى تحديد الأنشطة التجارية لشركتك لتخصيص النظام بما يناسبك</p>
                    <p className="text-sm text-primary mt-1">يمكنك اختيار أكثر من نشاط (Hybrid Industry)</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 text-red-500 p-4 rounded-xl mb-6 text-center text-sm border border-red-500/20">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8 max-h-[50vh] overflow-y-auto p-1">
                    {INDUSTRIES.map(ind => {
                        const isSelected = selected.includes(ind.id);
                        const Icon = ind.icon;
                        return (
                            <div 
                                key={ind.id}
                                onClick={() => toggleIndustry(ind.id)}
                                className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 flex flex-col items-center text-center gap-3 relative ${
                                    isSelected 
                                    ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' 
                                    : 'border-border hover:border-primary/50 hover:bg-surface-hover'
                                }`}
                            >
                                {isSelected && (
                                    <div className="absolute top-2 right-2 text-primary">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                )}
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isSelected ? 'bg-primary text-white' : 'bg-surface-hover text-text-dim'}`}>
                                    <Icon className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-text mb-1">{ind.name}</h3>
                                    <p className="text-xs text-text-dim">{ind.desc}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-center">
                    <button 
                        onClick={handleSave}
                        disabled={loading}
                        className="btn-primary py-3 px-12 text-lg disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? 'جاري الحفظ...' : 'حفظ ومتابعة'}
                        <Save className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
