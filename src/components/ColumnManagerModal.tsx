import React, { useState, useMemo, useRef } from 'react';
import { Settings, X, ArrowUp, ArrowDown, RefreshCw, GripVertical, Check, Plus, Eye, EyeOff } from 'lucide-react';
import { saveUserPreferences } from '../lib/firestoreService';
import { safeParse } from '../lib/json';

export interface ColumnItem {
  key: string;
  label: string;
}

interface ColumnManagerModalProps {
  tableName: string;
  allColumns: ColumnItem[];
  defaultVisibleKeys: string[];
  currentVisibleKeys: string[];
  currentOrderedKeys: string[];
  onSave: (visibleKeys: string[], orderedKeys: string[]) => void;
  onClose: () => void;
}

export default function ColumnManagerModal({
  tableName,
  allColumns,
  defaultVisibleKeys,
  currentVisibleKeys,
  currentOrderedKeys,
  onSave,
  onClose,
}: ColumnManagerModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const dragItemRef = useRef<number | null>(null);
  const dragOverItemRef = useRef<number | null>(null);

  // Parse current user context safely
  const userObj = safeParse(localStorage.getItem('currentUser'), null);
  const userEmail = userObj?.username || userObj?.email || 'admin';

  // We keep local state for the ordered keys and whether they are checked (visible)
  const [localOrderedKeys, setLocalOrderedKeys] = useState<string[]>(() => {
    const existing = [...currentOrderedKeys];
    allColumns.forEach(c => {
      if (!existing.includes(c.key)) {
        existing.push(c.key);
      }
    });
    return existing;
  });

  const [localVisibleKeys, setLocalVisibleKeys] = useState<string[]>(() => [...currentVisibleKeys]);

  // Helper to move a key up in the order
  const moveUp = (index: number) => {
    if (index === 0) return;
    const newList = [...localOrderedKeys];
    const temp = newList[index];
    newList[index] = newList[index - 1];
    newList[index - 1] = temp;
    setLocalOrderedKeys(newList);
  };

  // Helper to move a key down in the order
  const moveDown = (index: number) => {
    if (index === localOrderedKeys.length - 1) return;
    const newList = [...localOrderedKeys];
    const temp = newList[index];
    newList[index] = newList[index + 1];
    newList[index + 1] = temp;
    setLocalOrderedKeys(newList);
  };

  // Drag and Drop handlers
  const handleDragStart = (index: number) => {
    dragItemRef.current = index;
  };

  const handleDragEnter = (index: number) => {
    dragOverItemRef.current = index;
  };

  const handleDragEnd = () => {
    if (dragItemRef.current !== null && dragOverItemRef.current !== null && dragItemRef.current !== dragOverItemRef.current) {
      const fromIndex = dragItemRef.current;
      const toIndex = dragOverItemRef.current;
      const newList = [...localOrderedKeys];
      const [draggedItem] = newList.splice(fromIndex, 1);
      newList.splice(toIndex, 0, draggedItem);
      setLocalOrderedKeys(newList);
    }
    dragItemRef.current = null;
    dragOverItemRef.current = null;
  };

  // Helper to toggle visibility of a column
  const toggleVisibility = (key: string) => {
    setLocalVisibleKeys(prev => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev;
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const showColumn = (key: string) => {
    if (!localVisibleKeys.includes(key)) {
      setLocalVisibleKeys(prev => [...prev, key]);
    }
  };

  const hideColumn = (key: string) => {
    if (localVisibleKeys.length > 1) {
      setLocalVisibleKeys(prev => prev.filter(k => k !== key));
    }
  };

  // Revert back to default layout
  const resetToDefault = () => {
    setLocalVisibleKeys([...defaultVisibleKeys]);
    setLocalOrderedKeys(allColumns.map(c => c.key));
  };

  // Handle final save
  const handleSave = async () => {
    try {
      setSaving(true);
      
      const prefPayload = {
        visible: localVisibleKeys,
        order: localOrderedKeys,
      };

      await saveUserPreferences(userEmail, tableName, prefPayload);
      onSave(localVisibleKeys, localOrderedKeys);
      onClose();
    } catch (err) {
      console.error("Failed to save column preferences:", err);
      onSave(localVisibleKeys, localOrderedKeys);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // Visible items matching search
  const visibleItems = useMemo(() => {
    return localOrderedKeys
      .filter(k => localVisibleKeys.includes(k))
      .map(k => allColumns.find(c => c.key === k))
      .filter((c): c is ColumnItem => !!c && (c.label.toLowerCase().includes(searchQuery.toLowerCase()) || c.key.toLowerCase().includes(searchQuery.toLowerCase())));
  }, [localOrderedKeys, localVisibleKeys, allColumns, searchQuery]);

  // Available / Hidden items matching search
  const availableItems = useMemo(() => {
    return localOrderedKeys
      .filter(k => !localVisibleKeys.includes(k))
      .map(k => allColumns.find(c => c.key === k))
      .filter((c): c is ColumnItem => !!c && (c.label.toLowerCase().includes(searchQuery.toLowerCase()) || c.key.toLowerCase().includes(searchQuery.toLowerCase())));
  }, [localOrderedKeys, localVisibleKeys, allColumns, searchQuery]);

  return (
    <div className="fixed inset-0 z-[1001] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto font-sans" style={{ direction: 'rtl' }}>
      <div className="bg-card border border-border w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-border flex justify-between items-center bg-card2/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gold/10 text-gold flex items-center justify-center">
              <Settings size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-text-main">تخصيص وإعادة ترتيب أعمدة الجدول</h3>
              <p className="text-xs text-text-dim mt-0.5">اسحب بالماوس للترتيب، أو استخدم الأسهم، وحدد الأعمدة المعروضة</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="text-text-dim hover:text-white bg-card2 p-2 rounded-xl border border-border hover:border-gold/50 transition-all active:scale-95"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border bg-card">
          <input
            type="text"
            placeholder="ابحث عن اسم العمود أو المعرف لفلترة الخيارات..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-card2 border border-border px-4 py-2.5 rounded-xl text-xs text-text-main focus:border-gold focus:outline-none transition-all"
          />
        </div>

        {/* Columns Content Grid */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 md:grid-cols-2 gap-5 min-h-[300px]">
          
          {/* Section 1: Visible Columns (ordered & draggable) */}
          <div className="flex flex-col space-y-3">
            <div className="flex justify-between items-center border-b border-border pb-1.5">
              <span className="text-xs font-black text-emerald-400 flex items-center gap-1">
                <Eye size={13} />
                <span>الأعمدة الظاهرة مرتبة ({visibleItems.length})</span>
              </span>
              <span className="text-[10px] text-text-dim font-bold">اسحب بالماوس ✋ أو ⬆️ ⬇️</span>
            </div>
            
            <div className="space-y-1.5 flex-1 max-h-[45vh] overflow-y-auto pr-1">
              {visibleItems.length === 0 ? (
                <div className="text-center py-8 text-text-dim text-xs border border-dashed border-border rounded-xl">
                  لا توجد أعمدة ظاهرة مطابقة للبحث
                </div>
              ) : (
                visibleItems.map((item, idx) => {
                  const globalIndex = localOrderedKeys.indexOf(item.key);
                  return (
                    <div 
                      key={item.key} 
                      draggable
                      onDragStart={() => handleDragStart(globalIndex)}
                      onDragEnter={() => handleDragEnter(globalIndex)}
                      onDragEnd={handleDragEnd}
                      onDragOver={e => e.preventDefault()}
                      className="flex items-center justify-between p-2.5 bg-card2/80 border border-emerald-500/20 rounded-xl hover:bg-card hover:border-emerald-500/40 transition-all text-xs cursor-move"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <GripVertical size={14} className="text-text-dim/60 flex-shrink-0" />
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={true}
                            onChange={() => toggleVisibility(item.key)}
                            className="w-4 h-4 rounded text-gold accent-gold cursor-pointer"
                          />
                          <span className="text-text-main font-bold">{item.label}</span>
                        </label>
                      </div>
                      
                      {/* Order and Hide buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveUp(globalIndex)}
                          className="p-1 text-text-dim hover:text-white disabled:opacity-20 hover:bg-card2 rounded transition-all"
                          title="تحريك لأعلى"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === visibleItems.length - 1}
                          onClick={() => moveDown(globalIndex)}
                          className="p-1 text-text-dim hover:text-white disabled:opacity-20 hover:bg-card2 rounded transition-all"
                          title="تحريك لأسفل"
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={localVisibleKeys.length <= 1}
                          onClick={() => hideColumn(item.key)}
                          className="p-1 text-red-400/80 hover:text-red-400 disabled:opacity-20 hover:bg-card2 rounded transition-all"
                          title="إخفاء العمود"
                        >
                          <EyeOff size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Section 2: Available Columns */}
          <div className="flex flex-col space-y-3">
            <div className="flex justify-between items-center border-b border-border pb-1.5">
              <span className="text-xs font-black text-text-dim flex items-center gap-1">
                <Plus size={13} />
                <span>الأعمدة الإضافية المتاحة ({availableItems.length})</span>
              </span>
              <span className="text-[10px] text-text-dim font-bold">اضغط لإظهار العمود في الجدول</span>
            </div>
            
            <div className="space-y-1.5 flex-1 max-h-[45vh] overflow-y-auto pr-1">
              {availableItems.length === 0 ? (
                <div className="text-center py-8 text-text-dim text-xs border border-dashed border-border rounded-xl">
                  جميع الأعمدة المتاحة ظاهرة حالياً
                </div>
              ) : (
                availableItems.map((item) => {
                  return (
                    <div 
                      key={item.key} 
                      className="flex items-center justify-between p-2.5 bg-card2/40 border border-border/60 rounded-xl hover:bg-card hover:border-gold/30 transition-all text-xs"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer select-none flex-1">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => showColumn(item.key)}
                          className="w-4 h-4 rounded text-gold accent-gold cursor-pointer"
                        />
                        <span className="text-text-dim font-bold">{item.label}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => showColumn(item.key)}
                        className="text-emerald-400 hover:text-emerald-300 px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-[11px] font-bold transition-all flex items-center gap-1"
                      >
                        <Plus size={11} />
                        <span>إظهار</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card2/80 flex flex-col sm:flex-row gap-3 justify-between items-center">
          <button
            type="button"
            onClick={resetToDefault}
            className="w-full sm:w-auto px-4 py-2 bg-card border border-border hover:border-danger/40 hover:text-danger rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 text-text-dim"
          >
            <RefreshCw size={14} />
            <span>إعادة الإعدادات الافتراضية</span>
          </button>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-card border border-border rounded-xl text-xs font-bold text-text-dim hover:text-white transition-all text-center"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex-1 sm:flex-initial px-6 py-2.5 bg-gold hover:bg-gold2 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5"
            >
              {saving ? '⏳ جاري الحفظ...' : 'حفظ التخصيص والترتيب'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
