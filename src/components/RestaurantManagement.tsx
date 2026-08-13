import React, { useState, useEffect } from 'react';
import { useTenant } from '../context/TenantContext';
import { RestaurantTable } from '../types/types';
import { motion, AnimatePresence } from 'motion/react';
import { getRestaurantTables, saveRestaurantTable } from '../lib/firestoreService';
import { Users, LayoutGrid, CheckCircle, Clock, Plus, Settings2 } from 'lucide-react';

export default function RestaurantManagement() {
  const { companyId, branchId } = useTenant();
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [showAddTable, setShowAddTable] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newCapacity, setNewCapacity] = useState(4);

  const refreshData = async () => {
    const list = await getRestaurantTables(companyId, branchId);
    setTables(list);
  };

  useEffect(() => {
    refreshData();
  }, [companyId, branchId]);

  const addTable = async () => {
    if (!newTableName) return;
    await saveRestaurantTable({
      companyId,
      branchId,
      name: newTableName,
      capacity: newCapacity,
      status: 'AVAILABLE'
    });
    setNewTableName('');
    setNewCapacity(4);
    setShowAddTable(false);
    refreshData();
  };

  const updateTableStatus = async (table: RestaurantTable, status: RestaurantTable['status']) => {
    await saveRestaurantTable({ ...table, status });
    refreshData();
  };

  const getStatusColor = (status: RestaurantTable['status']) => {
    switch (status) {
      case 'AVAILABLE': return 'bg-emerald-500';
      case 'OCCUPIED': return 'bg-red-500';
      case 'RESERVED': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: RestaurantTable['status']) => {
    switch (status) {
      case 'AVAILABLE': return 'متاح';
      case 'OCCUPIED': return 'مشغول';
      case 'RESERVED': return 'محجوز';
      default: return status;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-text-main">إدارة الطاولات 🍽️</h2>
          <p className="text-text-dim mt-1">تنظيم صالة الطعام ومتابعة حالة الطاولات</p>
        </div>
        <button 
          onClick={() => setShowAddTable(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition-all flex items-center gap-2"
        >
          <Plus size={20} />
          إضافة طاولة
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {tables.map((table) => (
          <motion.div
            key={table.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`bg-card rounded-3xl border-2 transition-all p-6 relative overflow-hidden ${
              table.status === 'OCCUPIED' ? 'border-red-500/30' : 
              table.status === 'RESERVED' ? 'border-amber-500/30' : 
              'border-emerald-500/30'
            }`}
          >
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 ${getStatusColor(table.status)}`} />
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-2xl font-black text-text-main">{table.name}</h3>
                <div className="flex items-center gap-2 text-text-dim mt-1">
                  <Users size={14} />
                  <span className="text-sm">سعة {table.capacity} أشخاص</span>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${getStatusColor(table.status)}`}>
                {getStatusText(table.status)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => updateTableStatus(table, 'AVAILABLE')}
                className={`p-2 rounded-xl text-xs font-bold transition-all ${
                  table.status === 'AVAILABLE' ? 'bg-emerald-500 text-white' : 'bg-background hover:bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                }`}
              >
                متاح
              </button>
              <button 
                onClick={() => updateTableStatus(table, 'OCCUPIED')}
                className={`p-2 rounded-xl text-xs font-bold transition-all ${
                  table.status === 'OCCUPIED' ? 'bg-red-500 text-white' : 'bg-background hover:bg-red-500/10 text-red-500 border border-red-500/20'
                }`}
              >
                مشغول
              </button>
              <button 
                onClick={() => updateTableStatus(table, 'RESERVED')}
                className={`p-2 rounded-xl text-xs font-bold transition-all col-span-2 ${
                  table.status === 'RESERVED' ? 'bg-amber-500 text-white' : 'bg-background hover:bg-amber-500/10 text-amber-500 border border-amber-500/20'
                }`}
              >
                حجز للطاولة
              </button>
            </div>

            {table.status === 'OCCUPIED' && (
              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <div className="flex items-center gap-1 text-red-500">
                  <Clock size={14} />
                  <span className="text-xs font-bold">منذ 15 دقيقة</span>
                </div>
                <button className="text-gold text-xs font-bold flex items-center gap-1 hover:underline">
                  <Settings2 size={14} />
                  إدارة الطلب
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Add Table Modal */}
      <AnimatePresence>
        {showAddTable && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card w-full max-w-md rounded-4xl p-8 shadow-2xl border border-border"
            >
              <h3 className="text-2xl font-bold mb-6">إضافة طاولة جديدة ➕</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2">اسم أو رقم الطاولة</label>
                  <input 
                    type="text"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="مثال: طاولة 1 أو VIP"
                    className="w-full bg-background border border-border rounded-2xl p-4 focus:ring-2 focus:ring-gold outline-none"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold mb-2">السعة (عدد الأشخاص)</label>
                  <input 
                    type="number"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(Number(e.target.value))}
                    className="w-full bg-background border border-border rounded-2xl p-4 focus:ring-2 focus:ring-gold outline-none"
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={addTable}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl transition-all"
                  >
                    إضافة الطاولة
                  </button>
                  <button 
                    onClick={() => setShowAddTable(false)}
                    className="flex-1 bg-background border border-border hover:bg-secondary font-bold py-4 rounded-2xl transition-all"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
