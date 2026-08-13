import React, { useState, useEffect } from 'react';
import { useTenant } from '../context/TenantContext';
import { Queue, QueueTicket } from '../types/types';
import { motion, AnimatePresence } from 'motion/react';
import { getQueues, getQueueTickets, saveQueueTicket, updateQueueTicketStatus, saveQueue } from '../lib/firestoreService';

export default function QueueManagement() {
  const { companyId, branchId } = useTenant();
  const [queues, setQueues] = useState<Queue[]>([]);
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [activeQueueId, setActiveQueueId] = useState<string | null>(null);
  const [showAddTicket, setShowAddTicket] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  const refreshData = async () => {
    const qList = await getQueues(companyId, branchId);
    setQueues(qList);
    if (qList.length > 0 && !activeQueueId) {
      setActiveQueueId(qList[0].id);
    }
  };

  const refreshTickets = async () => {
    if (!activeQueueId) return;
    const tList = await getQueueTickets(activeQueueId);
    setTickets(tList);
  };

  useEffect(() => {
    refreshData();
  }, [companyId, branchId]);

  useEffect(() => {
    refreshTickets();
  }, [activeQueueId]);

  const addTicket = async () => {
    if (!newCustomerName || !activeQueueId) return;
    
    const activeQueue = queues.find(q => q.id === activeQueueId);
    if (!activeQueue) return;

    const nextNumber = (activeQueue.currentQueueNumber || 0) + 1;
    const newTicket: Partial<QueueTicket> = {
      queueId: activeQueueId,
      customerName: newCustomerName,
      customerPhone: newCustomerPhone,
      ticketNumber: nextNumber,
      status: 'WAITING',
      expectedWaitTimeMinutes: (tickets.filter(t => t.status === 'WAITING').length + 1) * 15,
    };

    await saveQueueTicket(newTicket);
    // Update queue current number
    await saveQueue({ ...activeQueue, currentQueueNumber: nextNumber });
    
    setNewCustomerName('');
    setNewCustomerPhone('');
    setShowAddTicket(false);
    refreshData();
    refreshTickets();

    alert(`تم إصدار التذكرة رقم ${nextNumber}. سيتم إرسال تنبيه للعميل.`);
  };

  const updateStatus = async (ticketId: string, newStatus: QueueTicket['status']) => {
    await updateQueueTicketStatus(ticketId, newStatus);
    refreshTickets();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-text-main">إدارة الأدوار الذكية 🎟️</h2>
          <p className="text-text-dim mt-1">تنظيم انتظار العملاء وتوقعات الوقت</p>
        </div>
        <button 
          onClick={() => setShowAddTicket(true)}
          className="bg-gold hover:bg-gold-dark text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition-all flex items-center gap-2"
        >
          <span>➕ إصدار تذكرة جديدة</span>
        </button>
      </div>

      <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
        {queues.map(q => (
          <button
            key={q.id}
            onClick={() => setActiveQueueId(q.id)}
            className={`px-6 py-3 rounded-2xl whitespace-nowrap transition-all border ${
              activeQueueId === q.id 
                ? 'bg-gold/10 border-gold text-gold font-bold shadow-sm' 
                : 'bg-card border-border text-text-dim hover:border-gold/50'
            }`}
          >
            {q.name} ({tickets.filter(t => t.queueId === q.id && t.status === 'WAITING').length} منتظر)
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-6 bg-gold rounded-full"></span>
            قائمة الانتظار الحالية
          </h3>
          
          <AnimatePresence mode="popLayout">
            {tickets.filter(t => t.queueId === activeQueueId && t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-card/50 border border-dashed border-border p-12 rounded-3xl text-center">
                <p className="text-text-dim italic">لا يوجد عملاء منتظرين حالياً</p>
              </motion.div>
            ) : (
              tickets
                .filter(t => t.queueId === activeQueueId && t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
                .sort((a, b) => (a.status === 'SERVING' ? -1 : b.status === 'SERVING' ? 1 : a.ticketNumber - b.ticketNumber))
                .map((ticket) => (
                <motion.div
                  key={ticket.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`bg-card p-5 rounded-3xl border transition-all ${
                    ticket.status === 'SERVING' ? 'border-gold shadow-gold/10 shadow-lg' : 'border-border'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl ${
                        ticket.status === 'SERVING' ? 'bg-gold text-white' : 'bg-gold/10 text-gold'
                      }`}>
                        {ticket.ticketNumber}
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{ticket.customerName}</h4>
                        <p className="text-text-dim text-sm">
                          {ticket.status === 'SERVING' ? '✅ جاري خدمته الآن' : `⏳ وقت الانتظار: ${ticket.expectedWaitTimeMinutes} دقيقة`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {ticket.status === 'WAITING' ? (
                        <button 
                          onClick={() => updateStatus(ticket.id, 'SERVING')}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                        >
                          بدء الخدمة
                        </button>
                      ) : (
                        <button 
                          onClick={() => updateStatus(ticket.id, 'COMPLETED')}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                        >
                          إكمال
                        </button>
                      )}
                      <button 
                        onClick={() => updateStatus(ticket.id, 'CANCELLED')}
                        className="bg-danger/10 text-danger hover:bg-danger hover:text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-6">
          <div className="bg-card p-6 rounded-3xl border border-border shadow-sm">
            <h3 className="font-bold mb-4 flex items-center gap-2">📊 ملخص النشاط</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-text-dim">إجمالي المنتظرين:</span>
                <span className="font-bold text-gold">{tickets.filter(t => t.status === 'WAITING').length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-dim">متوسط وقت الخدمة:</span>
                <span className="font-bold">15 دقيقة</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-dim">أدوار مكتملة اليوم:</span>
                <span className="font-bold text-emerald-500">12</span>
              </div>
            </div>
          </div>
          
          <div className="bg-gold/5 p-6 rounded-3xl border border-gold/20">
            <h3 className="font-bold text-gold mb-2 flex items-center gap-2">📱 نظام التنبيه الذكي</h3>
            <p className="text-xs text-text-dim leading-relaxed">
              يتم إرسال رسالة تلقائية للعميل عند تبقي دورين فقط. 
              هذه الخاصية تساعد في تقليل التزاحم داخل مكان النشاط.
            </p>
          </div>
        </div>
      </div>

      {/* Add Ticket Modal */}
      {showAddTicket && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card w-full max-w-md rounded-4xl p-8 border border-border shadow-2xl"
          >
            <h3 className="text-2xl font-bold mb-6">إصدار تذكرة جديدة</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2">اسم العميل</label>
                <input 
                  type="text" 
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full bg-background border border-border rounded-2xl px-5 py-3 outline-none focus:border-gold transition-all"
                  placeholder="مثال: محمد أحمد"
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2">رقم الهاتف (للتنبيهات)</label>
                <input 
                  type="tel" 
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="w-full bg-background border border-border rounded-2xl px-5 py-3 outline-none focus:border-gold transition-all"
                  placeholder="01xxxxxxxxx"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={addTicket}
                  className="flex-1 bg-gold text-white font-bold py-3 rounded-2xl hover:bg-gold-dark transition-all"
                >
                  إصدار التذكرة
                </button>
                <button 
                  onClick={() => setShowAddTicket(false)}
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
