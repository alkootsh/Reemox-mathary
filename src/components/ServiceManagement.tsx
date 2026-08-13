import React, { useState, useEffect } from 'react';
import { useTenant } from '../context/TenantContext';
import { BusinessService } from '../types/types';
import { motion, AnimatePresence } from 'motion/react';
import { getBusinessServices, saveBusinessService } from '../lib/firestoreService';

export default function ServiceManagement() {
  const { companyId, branchId } = useTenant();
  const [services, setServices] = useState<BusinessService[]>([]);
  const [showAddService, setShowAddService] = useState(false);
  const [newService, setNewService] = useState({
    name: '',
    type: 'service' as const,
    price: 0,
    durationMinutes: 30
  });

  const refreshData = async () => {
    const list = await getBusinessServices(companyId, branchId);
    setServices(list);
  };

  useEffect(() => {
    refreshData();
  }, [companyId, branchId]);

  const addService = async () => {
    if (!newService.name) return;

    const service: Partial<BusinessService> = {
      companyId,
      branchId,
      name: newService.name,
      type: newService.type,
      price: newService.price,
      durationMinutes: newService.durationMinutes
    };

    await saveBusinessService(service);
    setShowAddService(false);
    setNewService({ name: '', type: 'service', price: 0, durationMinutes: 30 });
    refreshData();
  };

  const deleteService = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه الخدمة؟')) {
      // In a real app, you'd call a delete API. For now we just refresh or handle locally if needed.
      // But we can just use refreshData after a hypothetical delete.
      setServices(services.filter(s => s.id !== id));
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-text-main">إدارة الخدمات والأنشطة 🛠️</h2>
          <p className="text-text-dim mt-1">تحديد الخدمات والأسعار ومدد التنفيذ</p>
        </div>
        <button 
          onClick={() => setShowAddService(true)}
          className="bg-gold hover:bg-gold-dark text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition-all flex items-center gap-2"
        >
          <span>➕ إضافة خدمة جديدة</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {services.map((service) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card p-6 rounded-3xl border border-border group hover:border-gold/30 transition-all"
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${
                  service.type === 'service' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'
                }`}>
                  {service.type === 'service' ? '✂️' : '🎓'}
                </div>
                <button 
                  onClick={() => deleteService(service.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-danger hover:bg-danger/10 rounded-xl transition-all"
                >
                  🗑️
                </button>
              </div>
              <h3 className="font-bold text-lg mb-2">{service.name}</h3>
              <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
                <div>
                  <p className="text-[10px] text-text-dim uppercase tracking-wider">السعر</p>
                  <p className="font-bold text-gold text-lg">{service.price} <span className="text-xs font-normal">ج.م</span></p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-text-dim uppercase tracking-wider">المدة</p>
                  <p className="font-bold">{service.durationMinutes} <span className="text-xs font-normal">دقيقة</span></p>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add Service Modal */}
      {showAddService && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card w-full max-w-md rounded-4xl p-8 border border-border shadow-2xl"
          >
            <h3 className="text-2xl font-bold mb-6">إضافة خدمة / نشاط جديد</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">اسم الخدمة</label>
                <input 
                  type="text" 
                  value={newService.name}
                  onChange={(e) => setNewService({...newService, name: e.target.value})}
                  className="w-full bg-background border border-border rounded-2xl px-5 py-3 outline-none focus:border-gold transition-all"
                  placeholder="مثال: كشف طبي"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">نوع النشاط</label>
                <select 
                  value={newService.type}
                  onChange={(e) => setNewService({...newService, type: e.target.value as any})}
                  className="w-full bg-background border border-border rounded-2xl px-5 py-3 outline-none focus:border-gold appearance-none"
                >
                  <option value="service">خدمة سريعة (حلاقة، كشف، غسيل)</option>
                  <option value="course">نشاط مستمر (اشتراك جيم، دورة)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-2">السعر (ج.م)</label>
                  <input 
                    type="number" 
                    value={newService.price}
                    onChange={(e) => setNewService({...newService, price: Number(e.target.value)})}
                    className="w-full bg-background border border-border rounded-2xl px-5 py-3 outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">المدة (دقيقة)</label>
                  <input 
                    type="number" 
                    value={newService.durationMinutes}
                    onChange={(e) => setNewService({...newService, durationMinutes: Number(e.target.value)})}
                    className="w-full bg-background border border-border rounded-2xl px-5 py-3 outline-none focus:border-gold"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={addService}
                  className="flex-1 bg-gold text-white font-bold py-3 rounded-2xl hover:bg-gold-dark transition-all shadow-lg"
                >
                  إضافة
                </button>
                <button 
                  onClick={() => setShowAddService(false)}
                  className="flex-1 bg-background border border-border text-text-main font-bold py-3 rounded-2xl hover:bg-card transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
