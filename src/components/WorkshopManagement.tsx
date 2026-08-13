import React, { useState, useEffect } from 'react';
import { useTenant } from '../context/TenantContext';
import { JobCard } from '../types/types';
import { motion, AnimatePresence } from 'motion/react';
import { getJobCards, saveJobCard } from '../lib/firestoreService';

export default function WorkshopManagement() {
  const { companyId, branchId } = useTenant();
  const [jobCards, setJobCards] = useState<JobCard[]>([]);
  const [showAddJob, setShowAddJob] = useState(false);
  const [newJob, setNewJob] = useState({
    customerName: '',
    make: '',
    model: '',
    plateNumber: '',
    description: ''
  });

  const refreshData = async () => {
    const list = await getJobCards(companyId, branchId);
    setJobCards(list);
  };

  useEffect(() => {
    refreshData();
  }, [companyId, branchId]);

  const addJobCard = async () => {
    if (!newJob.customerName || !newJob.plateNumber) return;

    const job: Partial<JobCard> = {
      companyId,
      branchId,
      customerName: newJob.customerName,
      vehicleDetails: {
        make: newJob.make,
        model: newJob.model,
        plateNumber: newJob.plateNumber
      },
      description: newJob.description,
      status: 'PENDING',
    };

    await saveJobCard(job);
    setShowAddJob(false);
    setNewJob({ customerName: '', make: '', model: '', plateNumber: '', description: '' });
    refreshData();
  };

  const updateStatus = async (id: string, status: JobCard['status']) => {
    const job = jobCards.find(j => j.id === id);
    if (job) {
      await saveJobCard({ ...job, status });
      refreshData();
    }
  };

  const getStatusColor = (status: JobCard['status']) => {
    switch (status) {
      case 'PENDING': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'IN_PROGRESS': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'COMPLETED': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      default: return 'bg-text-dim/10 text-text-dim border-text-dim/20';
    }
  };

  const getStatusLabel = (status: JobCard['status']) => {
    switch (status) {
      case 'PENDING': return 'قيد الانتظار';
      case 'IN_PROGRESS': return 'جاري العمل';
      case 'COMPLETED': return 'تم الإنجاز';
      default: return 'ملغي';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-text-main">صيانة السيارات 🚗</h2>
          <p className="text-text-dim mt-1">إدارة أوامر الشغل وبطاقات الصيانة</p>
        </div>
        <button 
          onClick={() => setShowAddJob(true)}
          className="bg-gold hover:bg-gold-dark text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition-all flex items-center gap-2"
        >
          <span>➕ فتح بطاقة صيانة</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {jobCards.map((job) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all group"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(job.status)}`}>
                    {getStatusLabel(job.status)}
                  </span>
                  <p className="text-[10px] text-text-dim">#{job.id.toUpperCase()}</p>
                </div>
                
                <h3 className="font-bold text-lg mb-1">{job.customerName}</h3>
                <div className="flex items-center gap-2 text-gold font-mono text-sm mb-4">
                  <span className="bg-gold/10 px-2 py-0.5 rounded border border-gold/20">
                    {job.vehicleDetails.plateNumber}
                  </span>
                  <span className="text-text-dim">|</span>
                  <span>{job.vehicleDetails.make} {job.vehicleDetails.model}</span>
                </div>

                <div className="bg-background/50 p-3 rounded-xl mb-4 h-20 overflow-y-auto text-sm text-text-dim">
                  {job.description || 'لا يوجد وصف للمشكلة'}
                </div>

                <div className="flex gap-2 pt-2">
                  {job.status === 'PENDING' && (
                    <button 
                      onClick={() => updateStatus(job.id, 'IN_PROGRESS')}
                      className="flex-1 bg-blue-500 text-white py-2 rounded-xl text-xs font-bold hover:bg-blue-600 transition-colors"
                    >
                      بدء العمل
                    </button>
                  )}
                  {job.status === 'IN_PROGRESS' && (
                    <button 
                      onClick={() => updateStatus(job.id, 'COMPLETED')}
                      className="flex-1 bg-emerald-500 text-white py-2 rounded-xl text-xs font-bold hover:bg-emerald-600 transition-colors"
                    >
                      تم التسليم
                    </button>
                  )}
                  <button className="px-4 py-2 bg-background border border-border rounded-xl text-xs hover:bg-card transition-all">
                    تعديل
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Add Job Modal */}
      {showAddJob && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-card w-full max-w-2xl rounded-4xl p-8 border border-border shadow-2xl overflow-y-auto max-h-[90vh]"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">فتح بطاقة صيانة جديدة</h3>
              <button onClick={() => setShowAddJob(false)} className="text-text-dim hover:text-white">✕</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold mb-2">اسم العميل</label>
                <input 
                  type="text" 
                  value={newJob.customerName}
                  onChange={(e) => setNewJob({...newJob, customerName: e.target.value})}
                  className="w-full bg-background border border-border rounded-2xl px-5 py-3 outline-none focus:border-gold"
                  placeholder="اسم العميل الرباعي"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold mb-2">رقم اللوحة</label>
                <input 
                  type="text" 
                  value={newJob.plateNumber}
                  onChange={(e) => setNewJob({...newJob, plateNumber: e.target.value})}
                  className="w-full bg-background border border-border rounded-2xl px-5 py-3 outline-none focus:border-gold text-center font-mono"
                  placeholder="أ ب ج 123"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">ماركة السيارة</label>
                <input 
                  type="text" 
                  value={newJob.make}
                  onChange={(e) => setNewJob({...newJob, make: e.target.value})}
                  className="w-full bg-background border border-border rounded-2xl px-5 py-3 outline-none focus:border-gold"
                  placeholder="مثال: تويوتا"
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">الموديل</label>
                <input 
                  type="text" 
                  value={newJob.model}
                  onChange={(e) => setNewJob({...newJob, model: e.target.value})}
                  className="w-full bg-background border border-border rounded-2xl px-5 py-3 outline-none focus:border-gold"
                  placeholder="مثال: كورولا"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold mb-2">وصف العطل / المطلوب</label>
                <textarea 
                  rows={4}
                  value={newJob.description}
                  onChange={(e) => setNewJob({...newJob, description: e.target.value})}
                  className="w-full bg-background border border-border rounded-2xl px-5 py-3 outline-none focus:border-gold resize-none"
                  placeholder="اكتب هنا تفاصيل المشكلة التي يشتكي منها العميل..."
                />
              </div>
            </div>

            <div className="pt-8 flex gap-4">
              <button 
                onClick={addJobCard}
                className="flex-1 bg-gold text-white font-bold py-4 rounded-2xl hover:bg-gold-dark transition-all shadow-lg"
              >
                تأكيد وفتح البطاقة
              </button>
              <button 
                onClick={() => setShowAddJob(false)}
                className="flex-1 bg-background border border-border text-text-main font-bold py-4 rounded-2xl hover:bg-card transition-all"
              >
                إلغاء
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
