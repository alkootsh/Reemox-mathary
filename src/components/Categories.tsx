import React, { useState, useEffect } from 'react';
import { Category } from '../types/types';
import { getCategories, saveCategory, deleteCategory } from '../lib/firestoreService';
import { useTenant } from '../context/TenantContext';
import { FolderTree, Plus, Trash2, Edit3, Check, X } from 'lucide-react';

export default function Categories() {
  const { companyId } = useTenant();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, [companyId]);

  const loadCategories = async () => {
    try {
      const data = await getCategories(companyId);
      setCategories(data);
    } catch (err: any) {
      console.error('Error loading categories:', err);
    }
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) {
      alert('يرجى إدخال اسم التصنيف الرئيسي');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      await saveCategory({ name: newCategoryName.trim(), subcategories: [] }, companyId);
      setNewCategoryName('');
      await loadCategories();
    } catch (err: any) {
      console.error('Error saving category:', err.code, err.message);
      setErrorMsg(`[${err.code || 'ERROR'}] ${err.message}`);
      alert(`فشل الحفظ: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateCategory = async (updated: Category) => {
    try {
      await saveCategory(updated, companyId);
      await loadCategories();
    } catch (err: any) {
      alert(`فشل التحديث: ${err.message}`);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف التصنيف الرئيسي "${name}" وجميع تصنيفاته الفرعية؟`)) return;
    try {
      setCategories(prev => prev.filter(c => c.id !== id));
      await deleteCategory(id, companyId);
      await loadCategories();
    } catch (err: any) {
      alert(`فشل الحذف: ${err.message}`);
      await loadCategories();
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-28">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="w-12 h-12 rounded-2xl bg-gold/10 text-gold flex items-center justify-center font-bold">
          <FolderTree size={24} />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-text-main">إدارة التصنيفات الرئيسية والفرعية</h2>
          <p className="text-xs text-text-dim">قم بإنشاء وتعديل التصنيفات وتصنيفاتها الفرعية لتنظيم المنتجات بدقة</p>
        </div>
      </div>

      {errorMsg && <div className="bg-danger/10 border border-danger p-3 rounded-xl text-danger text-sm">{errorMsg}</div>}
      
      {/* Add New Main Category Card */}
      <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-3">
        <label className="text-xs font-bold text-text-main block">إضافة تصنيف رئيسي جديد</label>
        <div className="flex gap-2">
          <input 
            placeholder="اسم التصنيف الرئيسي (مثال: إلكترونيات، مواد غذائية)..." 
            className="bg-card2 border border-border p-3 rounded-2xl flex-1 text-sm text-text-main focus:border-gold focus:outline-none" 
            value={newCategoryName} 
            onChange={e => setNewCategoryName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}
          />
          <button 
            onClick={addCategory} 
            disabled={loading} 
            className="bg-gold hover:bg-gold2 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center gap-2 disabled:opacity-50 shrink-0"
          >
            <Plus size={18} />
            <span>{loading ? 'جاري الحفظ...' : 'إضافة تصنيف'}</span>
          </button>
        </div>
      </div>

      {/* Categories List */}
      <div className="space-y-4">
        {categories.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-3xl border border-border text-text-dim text-sm">
            لا توجد تصنيفات مسجلة حتى الآن. أضف تصنيفاً رئيسياً للبدء.
          </div>
        ) : (
          categories.map(category => (
            <div key={category.id}>
              <CategoryItem category={category} onUpdate={updateCategory} onDelete={handleDeleteCategory} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CategoryItem({ category, onUpdate, onDelete }: { category: Category, onUpdate: (c: Category) => void | Promise<void>, onDelete: (id: string, name: string) => void | Promise<void> }) {
    const [subCat, setSubCat] = useState('');
    const [isEditingMain, setIsEditingMain] = useState(false);
    const [mainName, setMainName] = useState(category.name);
    const [editingSubIdx, setEditingSubIdx] = useState<number | null>(null);
    const [editingSubText, setEditingSubText] = useState('');

    const addSub = () => {
        if (!subCat.trim()) return;
        const currentSubs = category.subcategories || [];
        if (currentSubs.includes(subCat.trim())) {
            alert('هذا التصنيف الفرعي موجود مسبقاً');
            return;
        }
        onUpdate({...category, subcategories: [...currentSubs, subCat.trim()]});
        setSubCat('');
    };

    const deleteSub = (idx: number) => {
        const currentSubs = [...(category.subcategories || [])];
        currentSubs.splice(idx, 1);
        onUpdate({...category, subcategories: currentSubs});
    };

    const saveMainEdit = () => {
        if (!mainName.trim()) return;
        onUpdate({...category, name: mainName.trim()});
        setIsEditingMain(false);
    };

    const saveSubEdit = (idx: number) => {
        if (!editingSubText.trim()) return;
        const currentSubs = [...(category.subcategories || [])];
        currentSubs[idx] = editingSubText.trim();
        onUpdate({...category, subcategories: currentSubs});
        setEditingSubIdx(null);
        setEditingSubText('');
    };

    return (
        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm space-y-4">
            {/* Main Category Header */}
            <div className='flex justify-between items-center pb-3 border-b border-border/80'>
                {isEditingMain ? (
                    <div className="flex items-center gap-2 flex-1 mr-2">
                        <input 
                            className="bg-card2 border border-gold p-2 rounded-xl text-sm font-bold flex-1 text-text-main outline-none"
                            value={mainName}
                            onChange={e => setMainName(e.target.value)}
                        />
                        <button onClick={saveMainEdit} className="bg-emerald-500 text-white p-2 rounded-xl text-xs hover:bg-emerald-600">
                            <Check size={16} />
                        </button>
                        <button onClick={() => { setIsEditingMain(false); setMainName(category.name); }} className="bg-gray-500/20 text-text-dim p-2 rounded-xl text-xs">
                            <X size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <span className='font-black text-base sm:text-lg text-gold flex items-center gap-2'>
                            📁 {category.name}
                        </span>
                        <span className="text-xs bg-card2 border border-border px-2 py-0.5 rounded-full text-text-dim">
                            {(category.subcategories || []).length} تصنيف فرعي
                        </span>
                    </div>
                )}

                {!isEditingMain && (
                    <div className="flex items-center gap-1.5">
                        <button onClick={() => setIsEditingMain(true)} className="text-text-dim hover:text-gold p-2 rounded-xl hover:bg-card2 transition-colors" title="تعديل اسم التصنيف">
                            <Edit3 size={16} />
                        </button>
                        <button onClick={() => onDelete(category.id, category.name)} className="text-danger hover:bg-danger/10 p-2 rounded-xl transition-colors" title="حذف التصنيف الرئيسي">
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}
            </div>

            {/* Add Subcategory Input */}
            <div className='flex gap-2'>
                <input 
                    placeholder='أضف تصنيف فرعي جديد (مثال: هواتف ذكية، ثلاجات)...' 
                    className='bg-card2 border border-border p-2.5 rounded-2xl flex-grow text-xs text-text-main focus:border-gold focus:outline-none' 
                    value={subCat} 
                    onChange={e => setSubCat(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && addSub()}
                />
                <button onClick={addSub} className='bg-accent hover:bg-accent/80 text-white p-2.5 rounded-2xl px-4 text-xs font-bold transition-all flex items-center gap-1 shrink-0'>
                    <Plus size={16} />
                    <span>إضافة فرعي</span>
                </button>
            </div>

            {/* Subcategories Tags List */}
            <div className='flex flex-wrap gap-2 pt-1'>
                {(!category.subcategories || category.subcategories.length === 0) ? (
                    <span className="text-xs text-text-dim italic">لا توجد تصنيفات فرعية تحت هذا القسم. يمكنك إضافتها أعلاه.</span>
                ) : (
                    category.subcategories.map((sc, idx) => (
                        <div key={idx} className='bg-card2 border border-border px-3 py-1.5 rounded-2xl text-xs flex items-center gap-2 group hover:border-gold/50 transition-all'>
                            {editingSubIdx === idx ? (
                                <div className="flex items-center gap-1">
                                    <input 
                                        className="bg-card border border-gold px-2 py-0.5 rounded text-xs font-bold text-text-main outline-none w-28"
                                        value={editingSubText}
                                        onChange={e => setEditingSubText(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && saveSubEdit(idx)}
                                    />
                                    <button onClick={() => saveSubEdit(idx)} className="text-emerald-400 hover:text-emerald-500 p-0.5">
                                        <Check size={14} />
                                    </button>
                                    <button onClick={() => setEditingSubIdx(null)} className="text-text-dim hover:text-white p-0.5">
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <span className="font-bold text-text-main">🏷️ {sc}</span>
                                    <div className="flex items-center gap-1 opacity-75 group-hover:opacity-150">
                                        <button 
                                            onClick={() => { setEditingSubIdx(idx); setEditingSubText(sc); }}
                                            className="text-text-dim hover:text-gold p-0.5" 
                                            title="تعديل"
                                        >
                                            <Edit3 size={12} />
                                        </button>
                                        <button 
                                            onClick={() => deleteSub(idx)} 
                                            className="text-danger hover:text-red-500 p-0.5" 
                                            title="حذف"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

