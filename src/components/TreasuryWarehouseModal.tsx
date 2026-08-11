import React, { useState, useEffect } from 'react';
import { 
  Treasury, 
  Warehouse, 
  getTreasuries, 
  saveTreasury, 
  deleteTreasury, 
  getWarehouses, 
  saveWarehouse, 
  deleteWarehouse 
} from '../lib/treasuryWarehouseService';
import { 
  Vault, 
  Store, 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Check, 
  AlertCircle,
  Building2,
  Wallet,
  MapPin,
  FileText
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function TreasuryWarehouseModal({ isOpen, onClose, onUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<'treasuries' | 'warehouses'>('treasuries');
  
  // Treasuries state
  const [treasuries, setTreasuries] = useState<Treasury[]>([]);
  const [editingTreasury, setEditingTreasury] = useState<Partial<Treasury> | null>(null);
  const [treasuryForm, setTreasuryForm] = useState<{
    name: string;
    type: 'main' | 'wholesale' | 'retail' | 'sub';
    openingBalance: string;
    notes: string;
  }>({
    name: '',
    type: 'sub',
    openingBalance: '0',
    notes: ''
  });

  // Warehouses state
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [editingWarehouse, setEditingWarehouse] = useState<Partial<Warehouse> | null>(null);
  const [warehouseForm, setWarehouseForm] = useState<{
    name: string;
    location: string;
    notes: string;
  }>({
    name: '',
    location: '',
    notes: ''
  });

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = () => {
    setTreasuries(getTreasuries());
    setWarehouses(getWarehouses());
  };

  if (!isOpen) return null;

  const showMsg = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // Treasury Handlers
  const handleSaveTreasury = (e: React.FormEvent) => {
    e.preventDefault();
    if (!treasuryForm.name.trim()) {
      showMsg('يرجى إدخال اسم الخزنة', 'error');
      return;
    }

    try {
      const payload: Partial<Treasury> = {
        id: editingTreasury?.id,
        name: treasuryForm.name.trim(),
        type: treasuryForm.type,
        openingBalance: parseFloat(treasuryForm.openingBalance) || 0,
        notes: treasuryForm.notes.trim()
      };

      const updated = saveTreasury(payload);
      setTreasuries(updated);
      setEditingTreasury(null);
      setTreasuryForm({ name: '', type: 'sub', openingBalance: '0', notes: '' });
      showMsg('تم حفظ بيانات الخزنة بنجاح', 'success');
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showMsg('فشل الحفظ: ' + err.message, 'error');
    }
  };

  const startEditTreasury = (t: Treasury) => {
    setEditingTreasury(t);
    setTreasuryForm({
      name: t.name,
      type: t.type || 'sub',
      openingBalance: (t.openingBalance || 0).toString(),
      notes: t.notes || ''
    });
  };

  const handleDeleteTreasury = (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف خزنة (${name})؟`)) return;
    try {
      const updated = deleteTreasury(id);
      setTreasuries(updated);
      showMsg(`تم حذف خزنة (${name}) بنجاح`, 'success');
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showMsg(err.message, 'error');
    }
  };

  // Warehouse Handlers
  const handleSaveWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseForm.name.trim()) {
      showMsg('يرجى إدخال اسم المخزن', 'error');
      return;
    }

    try {
      const payload: Partial<Warehouse> = {
        id: editingWarehouse?.id,
        name: warehouseForm.name.trim(),
        location: warehouseForm.location.trim(),
        notes: warehouseForm.notes.trim()
      };

      const updated = saveWarehouse(payload);
      setWarehouses(updated);
      setEditingWarehouse(null);
      setWarehouseForm({ name: '', location: '', notes: '' });
      showMsg('تم حفظ بيانات المخزن بنجاح', 'success');
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showMsg('فشل الحفظ: ' + err.message, 'error');
    }
  };

  const startEditWarehouse = (w: Warehouse) => {
    setEditingWarehouse(w);
    setWarehouseForm({
      name: w.name,
      location: w.location || '',
      notes: w.notes || ''
    });
  };

  const handleDeleteWarehouse = (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف مخزن (${name})؟`)) return;
    try {
      const updated = deleteWarehouse(id);
      setWarehouses(updated);
      showMsg(`تم حذف مخزن (${name}) بنجاح`, 'success');
      if (onUpdate) onUpdate();
    } catch (err: any) {
      showMsg(err.message, 'error');
    }
  };

  const typeLabels = {
    main: 'خزنة رئيسية عامة',
    wholesale: 'خزنة مبيعات جملة',
    retail: 'خزنة مبيعات قطاعي/درج',
    sub: 'خزنة فرعية / بنك'
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto dir-rtl">
      <div className="bg-card max-w-3xl w-full max-h-[92vh] overflow-y-auto rounded-3xl border border-gold/40 p-5 sm:p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-200 my-auto text-right">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border pb-3 sticky top-0 bg-card z-10 pt-1">
          <div className="flex items-center gap-2">
            <div className="bg-gold/10 p-2 rounded-2xl border border-gold/30 text-gold">
              <Building2 size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-text-main">إدارة الخزن والمخازن المتعددة</h3>
              <p className="text-xs text-text-dim">إضافة خزن نقدية جديدة، مخازن فرعية، وتخصيص أرصدة النظام</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl bg-card2 text-text-dim hover:text-white border border-border transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Notification */}
        {message && (
          <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 border ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
          }`}>
            <AlertCircle size={16} />
            <span>{message.text}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex bg-card2 p-1.5 rounded-2xl border border-border">
          <button
            type="button"
            onClick={() => setActiveTab('treasuries')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'treasuries'
                ? 'bg-gold text-white shadow-md'
                : 'text-text-dim hover:text-text-main'
            }`}
          >
            <Vault size={16} />
            <span>إدارة الخزن والدفاتر النقدية ({treasuries.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('warehouses')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
              activeTab === 'warehouses'
                ? 'bg-emerald-500 text-white shadow-md'
                : 'text-text-dim hover:text-text-main'
            }`}
          >
            <Store size={16} />
            <span>إدارة المخازن والمعارض ({warehouses.length})</span>
          </button>
        </div>

        {/* TAB 1: TREASURIES MANAGEMENT */}
        {activeTab === 'treasuries' && (
          <div className="space-y-5">
            {/* Form */}
            <form onSubmit={handleSaveTreasury} className="bg-card2 p-4 rounded-2xl border border-gold/30 space-y-3">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-xs font-bold text-gold flex items-center gap-1.5">
                  <Plus size={15} />
                  <span>{editingTreasury ? 'تعديل بيانات الخزنة' : 'إضافة خزنة / حساب نقدي جديد'}</span>
                </span>
                {editingTreasury && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTreasury(null);
                      setTreasuryForm({ name: '', type: 'sub', openingBalance: '0', notes: '' });
                    }}
                    className="text-[11px] text-text-dim hover:text-white underline"
                  >
                    إلغاء التعديل
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-text-dim block mb-1">اسم الخزنة / الحساب النقدي: *</label>
                  <input
                    type="text"
                    placeholder="مثال: خزنة فرع المهندسين / خزنة الكاشير الفرعي"
                    className="w-full bg-card border border-border p-2.5 rounded-xl font-bold text-text-main focus:border-gold focus:outline-none"
                    value={treasuryForm.name}
                    onChange={e => setTreasuryForm({ ...treasuryForm, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-text-dim block mb-1">نوع الخزنة / الاستخدام:</label>
                  <select
                    className="w-full bg-card border border-border p-2.5 rounded-xl font-bold text-text-main focus:border-gold focus:outline-none"
                    value={treasuryForm.type}
                    onChange={e => setTreasuryForm({ ...treasuryForm, type: e.target.value as any })}
                  >
                    <option value="main">خزنة رئيسية عامة</option>
                    <option value="wholesale">خزنة مبيعات جملة</option>
                    <option value="retail">خزنة مبيعات قطاعي/درج محل</option>
                    <option value="sub">خزنة فرعية / عهدة خاصة</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-text-dim block mb-1">رصيد أول المدة المبدئي (ج.م):</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full bg-card border border-border p-2.5 rounded-xl font-bold font-mono text-text-main focus:border-gold focus:outline-none"
                    value={treasuryForm.openingBalance}
                    onChange={e => setTreasuryForm({ ...treasuryForm, openingBalance: e.target.value })}
                  />
                </div>

                <div>
                  <label className="font-bold text-text-dim block mb-1">ملاحظات / وصف الخزنة:</label>
                  <input
                    type="text"
                    placeholder="مثال: خزنة تحصيل الدرج اليومي"
                    className="w-full bg-card border border-border p-2.5 rounded-xl font-bold text-text-main focus:border-gold focus:outline-none"
                    value={treasuryForm.notes}
                    onChange={e => setTreasuryForm({ ...treasuryForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-gold hover:bg-gold2 text-white py-2.5 rounded-xl font-bold text-xs shadow transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Check size={16} />
                <span>{editingTreasury ? 'حفظ تعديلات الخزنة' : 'حفظ وإضافة الخزنة الآن'}</span>
              </button>
            </form>

            {/* Existing Treasuries List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-text-dim mb-2">قائمة الخزن المتاحة بالنظام:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {treasuries.map(t => (
                  <div key={t.id} className="bg-card2 p-3.5 rounded-2xl border border-border hover:border-gold/40 transition-all flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-text-main">{t.name}</span>
                        <span className="text-[10px] bg-gold/10 text-gold px-2 py-0.5 rounded-full font-bold border border-gold/20">
                          {typeLabels[t.type] || t.type}
                        </span>
                      </div>
                      {t.notes && <p className="text-[11px] text-text-dim">{t.notes}</p>}
                      <div className="text-[11px] text-text-dim font-mono">
                        رصيد بداية المدة: <strong className="text-gold">{(t.openingBalance || 0).toLocaleString()} ج.م</strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEditTreasury(t)}
                        className="p-1.5 rounded-lg bg-card text-text-dim hover:text-gold border border-border transition-all"
                        title="تعديل"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTreasury(t.id, t.name)}
                        className="p-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white border border-danger/20 transition-all"
                        title="حذف"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: WAREHOUSES MANAGEMENT */}
        {activeTab === 'warehouses' && (
          <div className="space-y-5">
            {/* Form */}
            <form onSubmit={handleSaveWarehouse} className="bg-card2 p-4 rounded-2xl border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Plus size={15} />
                  <span>{editingWarehouse ? 'تعديل بيانات المخزن' : 'إضافة مخزن / معرض جديد'}</span>
                </span>
                {editingWarehouse && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWarehouse(null);
                      setWarehouseForm({ name: '', location: '', notes: '' });
                    }}
                    className="text-[11px] text-text-dim hover:text-white underline"
                  >
                    إلغاء التعديل
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-bold text-text-dim block mb-1">اسم المخزن / المعرض: *</label>
                  <input
                    type="text"
                    placeholder="مثال: مخزن فرع المعادي / معرض العرض المباشر"
                    className="w-full bg-card border border-border p-2.5 rounded-xl font-bold text-text-main focus:border-emerald-500 focus:outline-none"
                    value={warehouseForm.name}
                    onChange={e => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-text-dim block mb-1">الموقع / العنوان الجغرافي:</label>
                  <input
                    type="text"
                    placeholder="مثال: المبنى الرئيسي - الدور الأرضي"
                    className="w-full bg-card border border-border p-2.5 rounded-xl font-bold text-text-main focus:border-emerald-500 focus:outline-none"
                    value={warehouseForm.location}
                    onChange={e => setWarehouseForm({ ...warehouseForm, location: e.target.value })}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="font-bold text-text-dim block mb-1">ملاحظات / وصف التخزين:</label>
                  <input
                    type="text"
                    placeholder="مثال: مخزن خاص باستلام فواتير المشتريات والجملة"
                    className="w-full bg-card border border-border p-2.5 rounded-xl font-bold text-text-main focus:border-emerald-500 focus:outline-none"
                    value={warehouseForm.notes}
                    onChange={e => setWarehouseForm({ ...warehouseForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-2.5 rounded-xl font-bold text-xs shadow transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Check size={16} />
                <span>{editingWarehouse ? 'حفظ تعديلات المخزن' : 'حفظ وإضافة المخزن الآن'}</span>
              </button>
            </form>

            {/* Existing Warehouses List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-text-dim mb-2">قائمة المخازن والمعارض المتاحة:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {warehouses.map(w => (
                  <div key={w.id} className="bg-card2 p-3.5 rounded-2xl border border-border hover:border-emerald-500/40 transition-all flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Store size={15} className="text-emerald-400" />
                        <span className="font-bold text-xs text-text-main">{w.name}</span>
                      </div>
                      {w.location && (
                        <div className="text-[11px] text-text-dim flex items-center gap-1">
                          <MapPin size={11} className="text-emerald-400" />
                          <span>{w.location}</span>
                        </div>
                      )}
                      {w.notes && <p className="text-[11px] text-text-dim">{w.notes}</p>}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEditWarehouse(w)}
                        className="p-1.5 rounded-lg bg-card text-text-dim hover:text-emerald-400 border border-border transition-all"
                        title="تعديل"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWarehouse(w.id, w.name)}
                        className="p-1.5 rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white border border-danger/20 transition-all"
                        title="حذف"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
