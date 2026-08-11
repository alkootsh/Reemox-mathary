import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Scale, Check } from 'lucide-react';
import { getUnits, saveUnit, deleteUnit, DEFAULT_UNITS, UnitItem } from '../lib/firestoreService';
import { useTenant } from '../context/TenantContext';

interface UnitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnitAdded?: (unitName: string) => void;
}

export default function UnitsModal({ isOpen, onClose, onUnitAdded }: UnitsModalProps) {
  const { companyId } = useTenant();
  const [customUnits, setCustomUnits] = useState<UnitItem[]>([]);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitSymbol, setNewUnitSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCustomUnits();
    }
  }, [isOpen, companyId]);

  const loadCustomUnits = async () => {
    try {
      const data = await getUnits(companyId);
      setCustomUnits(data);
    } catch (err: any) {
      console.error('Error loading custom units:', err);
    }
  };

  const handleAddUnit = async () => {
    const trimmed = newUnitName.trim();
    if (!trimmed) {
      alert('يرجى إدخال اسم وحدة القياس');
      return;
    }

    if (DEFAULT_UNITS.includes(trimmed) || customUnits.some(u => u.name.trim() === trimmed)) {
      alert('وحدة القياس موجودة بالفعل بالقائمة!');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      await saveUnit({ name: trimmed, symbol: newUnitSymbol.trim() }, companyId);
      setNewUnitName('');
      setNewUnitSymbol('');
      await loadCustomUnits();
      if (onUnitAdded) onUnitAdded(trimmed);
    } catch (err: any) {
      setErrorMsg(err?.message || 'فشل إضافة وحدة القياس');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomUnit = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف وحدة القياس "${name}"؟`)) return;
    try {
      setCustomUnits(prev => prev.filter(u => u.id !== id));
      await deleteUnit(id, companyId);
      await loadCustomUnits();
    } catch (err: any) {
      alert(`فشل الحذف: ${err?.message || 'خطأ غير معروف'}`);
      await loadCustomUnits();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-card w-full max-w-2xl rounded-3xl border border-gold/30 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-gold/20 via-card to-card border-b border-border flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-gold/20 p-2.5 rounded-2xl text-gold border border-gold/40">
              <Scale size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-main">دليل ووحدات القياس الرسمية (Units Management)</h3>
              <p className="text-xs text-text-dim">تحديد الوحدات الافتراضية وإضافة وحدات مخصصة للنظام</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-text-dim hover:text-text-main hover:bg-card2 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="bg-danger/10 border border-danger/30 text-danger p-3 rounded-2xl text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {/* Form to Add New Custom Unit */}
          <div className="bg-card2 p-4 rounded-2xl border border-border space-y-3">
            <h4 className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-1.5">
              <span>➕ إضافة وحدة قياس جديدة للسيستم</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <input 
                  type="text" 
                  placeholder="اسم الوحدة (مثال: درزن، بالتة، كونتينر، شكارة 50ك)" 
                  className="bg-card border border-border p-2.5 rounded-xl w-full text-xs font-bold text-text-main focus:border-gold focus:outline-none"
                  value={newUnitName}
                  onChange={e => setNewUnitName(e.target.value)}
                />
              </div>
              <div>
                <input 
                  type="text" 
                  placeholder="الرمز الاختصاري (اختياري)" 
                  className="bg-card border border-border p-2.5 rounded-xl w-full text-xs font-mono text-text-main focus:border-gold focus:outline-none"
                  value={newUnitSymbol}
                  onChange={e => setNewUnitSymbol(e.target.value)}
                />
              </div>
            </div>
            <button 
              onClick={handleAddUnit}
              disabled={loading || !newUnitName.trim()}
              className="w-full bg-gold hover:bg-gold2 text-white p-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow transition-all disabled:opacity-50"
            >
              <Plus size={16} />
              <span>{loading ? 'جاري الحفظ...' : 'حفظ وإضافة وحدة القياس'}</span>
            </button>
          </div>

          {/* Pre-defined Standard Units */}
          <div>
            <h4 className="text-xs font-bold text-text-main mb-2.5 flex items-center gap-2">
              <Check size={14} className="text-success" />
              <span>الوحدات الأساسية المحددة مسبقاً بالتطبيق ({DEFAULT_UNITS.length})</span>
            </h4>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-card2/50 rounded-2xl border border-border">
              {DEFAULT_UNITS.map((u, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (onUnitAdded) {
                      onUnitAdded(u);
                      onClose();
                    }
                  }}
                  className="bg-card hover:bg-gold/20 text-text-main hover:text-gold border border-border hover:border-gold/40 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  title="اضغط لاختيار هذه الوحدة"
                >
                  <span>{u}</span>
                </button>
              ))}
            </div>
          </div>

          {/* User Custom Added Units */}
          <div>
            <h4 className="text-xs font-bold text-text-main mb-2.5 flex items-center gap-2">
              <Scale size={14} className="text-gold" />
              <span>الوحدات المخصصة المضافة بواسطة المستخدم ({customUnits.length})</span>
            </h4>
            {customUnits.length === 0 ? (
              <p className="text-xs text-text-dim italic bg-card2/30 p-3 rounded-xl border border-border text-center">
                لم يتم إضافة وحدات قياس مخصصة بعد. يمكنك إضافة وحدات جديدة من النموذج أعلاه.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {customUnits.map(unit => (
                  <div 
                    key={unit.id}
                    className="bg-card2 p-3 rounded-xl border border-border flex justify-between items-center"
                  >
                    <div>
                      <span className="text-xs font-bold text-text-main">{unit.name}</span>
                      {unit.symbol && (
                        <span className="text-[10px] text-text-dim font-mono block">رمز: {unit.symbol}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomUnit(unit.id, unit.name)}
                      className="text-danger hover:bg-danger/10 p-1.5 rounded-lg transition-colors"
                      title="حذف الوحدة"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-card2 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="bg-border hover:bg-border/80 text-text-main px-5 py-2 rounded-xl text-xs font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
