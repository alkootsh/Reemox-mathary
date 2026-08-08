import React, { useState, useEffect } from 'react';
import { Category } from '../types/types';
import { getCategories, saveCategory, deleteCategory } from '../lib/firestoreService';

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (err: any) {
      console.error('Error loading categories:', err);
    }
  };

  const addCategory = async () => {
    if (!newCategoryName) {
      alert('يرجى إدخال اسم التصنيف');
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      await saveCategory({ name: newCategoryName, subcategories: [] });
      setNewCategoryName('');
      await loadCategories();
      alert('تم حفظ التصنيف في Firestore بنجاح');
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
      await saveCategory(updated);
      await loadCategories();
    } catch (err: any) {
      alert(`فشل التحديث: ${err.message}`);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا التصنيف؟')) return;
    try {
      await deleteCategory(id);
      await loadCategories();
    } catch (err: any) {
      alert(`فشل الحذف: ${err.message}`);
    }
  };

  return (
    <div className="p-4 sm:p-5 max-w-4xl mx-auto space-y-6 pb-28">
      <h2 className="text-xl sm:text-2xl font-bold">إدارة التصنيفات (Firestore)</h2>
      {errorMsg && <div className="bg-danger/10 border border-danger p-3 rounded-xl text-danger text-sm">{errorMsg}</div>}
      <div className="bg-card p-4 rounded-3xl border border-border space-y-3">
        <input 
          placeholder="اسم التصنيف الجديد" 
          className="bg-card2 border border-border p-3 rounded-2xl w-full" 
          value={newCategoryName} 
          onChange={e => setNewCategoryName(e.target.value)} 
        />
        <button onClick={addCategory} disabled={loading} className="w-full bg-gold text-white p-3 rounded-2xl font-bold disabled:opacity-50">
          {loading ? 'جاري الحفظ...' : 'إضافة تصنيف في Firestore'}
        </button>
      </div>

      <div className="space-y-3">
        {categories.map(category => (
          <div key={category.id}>
            <CategoryItem category={category} onUpdate={updateCategory} onDelete={handleDeleteCategory} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryItem({ category, onUpdate, onDelete }: { category: Category, onUpdate: (c: Category) => void | Promise<void>, onDelete: (id: string) => void | Promise<void> }) {
    const [subCat, setSubCat] = useState('');
    const addSub = () => {
        if (!subCat) return;
        onUpdate({...category, subcategories: [...(category.subcategories || []), subCat]});
        setSubCat('');
    }
    return (
        <div className="bg-card p-4 rounded-3xl border border-border">
            <div className='flex justify-between items-center mb-2'>
                <span className='font-bold'>{category.name}</span>
                <button onClick={() => onDelete(category.id)} className="bg-danger text-white p-2 rounded-xl text-xs">حذف</button>
            </div>
            <div className='flex gap-2 mb-2'>
                <input placeholder='تصنيف فرعي جديد' className='bg-card2 p-2 rounded-xl flex-grow' value={subCat} onChange={e => setSubCat(e.target.value)} />
                <button onClick={addSub} className='bg-accent text-white p-2 rounded-xl px-4'>+</button>
            </div>
            <div className='flex flex-wrap gap-2'>
                {(category.subcategories || []).map(sc => <span key={sc} className='bg-secondary p-1 px-2 rounded-full text-xs'>{sc}</span>)}
            </div>
        </div>
    )
}
