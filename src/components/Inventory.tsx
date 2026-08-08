import React, { useState, useEffect } from 'react';
import { Product, Category, Branch } from '@/src/types/types';
import { db } from '@/src/lib/firebase';
import { Camera, X } from 'lucide-react';
import QrScanner from 'react-qr-scanner';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { logActivity } from '@/src/lib/activity';
import Toast from './Toast';
import InventoryCount from './InventoryCount';
import { playAlertSound } from '@/src/lib/audio';
import { playSuccessSound } from '@/src/lib/sound';
import jsPDF from 'jspdf';

export default function Inventory({ categories, branches }: { categories: Category[], branches: Branch[] }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [newProduct, setNewProduct] = useState({ name: '', sku: '', serial: '', price: '', quantity: '', category: '', expirationDate: '', subcategory: '', lowStockThreshold: '', image: '', branchId: '' });
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterSubcategory, setFilterSubcategory] = useState<string>('');
  const [filterBranch, setFilterBranch] = useState<string>('');
  const [editingPrices, setEditingPrices] = useState<Record<string, { price: string; cost: string }>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'manage' | 'count'>('manage');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showLowStockModal, setShowLowStockModal] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  
  const toggleProductSelection = (productId: string) => {
      const newSelection = new Set(selectedProducts);
      if (newSelection.has(productId)) newSelection.delete(productId);
      else newSelection.add(productId);
      setSelectedProducts(newSelection);
  };

  const printSelectedBarcodes = () => {
      const doc = new jsPDF();
      let y = 10;
      products.filter(p => selectedProducts.has(p.id)).forEach((product, i) => {
          doc.text(`Name: ${product.name}`, 10, y);
          doc.text(`SKU: ${product.sku}`, 10, y + 10);
          doc.text(`Price: ${product.price}`, 10, y + 20);
          y += 40;
          if (y > 280) { doc.addPage(); y = 10; }
      });
      doc.save(`barcodes.pdf`);
  };

  
  useEffect(() => {
    const fetchProducts = async () => {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const productsData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product));
      setProducts(productsData);
    };
    fetchProducts();
  }, []);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSaveProduct = async () => {
    if (!newProduct.name || !newProduct.sku || !newProduct.price || !newProduct.quantity) {
      alert('يرجى ملء الحقول الإجبارية (الاسم، الرمز، السعر، الكمية)');
      return;
    }
    
    try {
      setSaving(true);
      setErrorMsg(null);
      const productData = {
        name: newProduct.name,
        sku: newProduct.sku,
        serial: newProduct.serial || null,
        price: parseFloat(newProduct.price),
        quantity: parseInt(newProduct.quantity),
        category: newProduct.category || null,
        expirationDate: newProduct.expirationDate || null,
        subcategory: newProduct.subcategory || null,
        branchId: newProduct.branchId || null,
        lowStockThreshold: newProduct.lowStockThreshold ? parseInt(newProduct.lowStockThreshold) : 5,
        image: newProduct.image || null,
      };
      
      const docRef = await addDoc(collection(db, 'products'), productData);
      setProducts([...products, { ...productData, id: docRef.id } as Product]);
      logActivity(`تم إضافة منتج جديد: ${newProduct.name}`);
      setNewProduct({ name: '', sku: '', serial: '', price: '', quantity: '', category: '', expirationDate: '', subcategory: '', branchId: '', lowStockThreshold: '', image: '' });
      alert('Saved successfully: تم حفظ المنتج في Firestore بنجاح');
    } catch (err: any) {
      console.error('Error saving product:', err.code, err.message);
      setErrorMsg(`[${err.code || 'ERROR'}] ${err.message}`);
      alert(`فشل الحفظ: [${err.code || 'ERROR'}] ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const updateQuantity = async (id: string, delta: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;

    const newQuantity = Math.max(0, product.quantity + delta);
    const threshold = product.lowStockThreshold ?? 5;
    
    await updateDoc(doc(db, 'products', id), { quantity: newQuantity });
    logActivity(`تم تحديث كمية ${product.name} إلى ${newQuantity}`);
    
    // Notify if it just crossed the threshold
    if (newQuantity <= threshold && product.quantity > threshold) {
        setToastMessage(`تحذير: المنتج ${product.name} أصبح رصيده منخفضاً (${newQuantity})`);
        playAlertSound('warning');
        fetch('/api/notify-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: product.name, quantity: newQuantity })
        }).catch(err => console.error("Failed to send notification:", err));

        const managerEmail = localStorage.getItem('managerEmail');
        if (managerEmail) {
            fetch('/api/notify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to: managerEmail, productName: product.name, quantity: newQuantity })
            }).catch(e => console.error("Email notification failed", e));
        }
    }
    
    setProducts(products.map(p => p.id === id ? { ...p, quantity: newQuantity } : p));
  };

  const savePrice = async (id: string) => {
    const editObj = editingPrices[id];
    if (!editObj) return;

    const newPrice = editObj.price !== '' ? parseFloat(editObj.price) : undefined;
    const newCost = editObj.cost !== '' ? parseFloat(editObj.cost) : undefined;

    const updateData: any = {};
    if (newPrice !== undefined && !isNaN(newPrice)) updateData.price = newPrice;
    if (newCost !== undefined && !isNaN(newCost)) updateData.cost = newCost;

    if (Object.keys(updateData).length === 0) return;
    
    await updateDoc(doc(db, 'products', id), updateData);
    const product = products.find(p => p.id === id);
    logActivity(`تم تحديث أسعار ${product?.name}`);
    
    setProducts(products.map(p => p.id === id ? { ...p, ...updateData } : p));
    setEditingPrices(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    playSuccessSound();
    setToastMessage('تم حفظ الأسعار والتكلفة بنجاح');
  };

  
  return (
    <div className="p-5">
      <div className="flex gap-2 mb-4">
          <button onClick={() => setActiveTab('manage')} className={`p-2 rounded-xl w-full ${activeTab === 'manage' ? 'bg-gold text-white' : 'bg-card2'}`}>إدارة</button>
          <button onClick={() => setActiveTab('count')} className={`p-2 rounded-xl w-full ${activeTab === 'count' ? 'bg-gold text-white' : 'bg-card2'}`}>جرد</button>
      </div>

      {activeTab === 'manage' ? (
        <>
            {showLowStockModal && (
                <div className='fixed inset-0 bg-black/85 z-[9999] flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn'>
                    <div className='bg-card p-6 rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto border border-border shadow-2xl'>
                       <h2 className='text-xl font-bold mb-4 text-gold'>تنبيه: منتجات تحتاج لإعادة طلب</h2>
                       <table className='w-full text-right'>
                          <thead><tr><th className='p-2'>المنتج</th><th className='p-2'>الكمية</th></tr></thead>
                          <tbody className='text-sm'>
                            {products.filter(p => p.quantity <= (p.lowStockThreshold ?? 5)).map(p => (
                               <tr key={p.id} className='border-t border-border'><td className='p-2'>{p.name}</td><td className='p-2'>{p.quantity}</td></tr>
                            ))}
                          </tbody>
                       </table>
                       <button onClick={() => setShowLowStockModal(false)} className='w-full mt-4 bg-gold hover:bg-gold2 text-white font-bold p-3 rounded-2xl transition-all'>إغلاق</button>
                    </div>
                </div>
            )}
            <h2 className="text-xl font-bold mb-4">إضافة منتج جديد</h2>
            <div className="bg-card p-4 rounded-3xl border border-border mb-6 space-y-3">
              <input placeholder="اسم المنتج" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              <div className='flex gap-2'>
                  <input placeholder="الرمز (SKU)" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} />
                  <button onClick={() => setIsScanning(true)} className='p-3 bg-accent rounded-2xl text-white'><Camera /></button>
              </div>
              <input placeholder="S/N (اختياري)" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newProduct.serial} onChange={e => setNewProduct({...newProduct, serial: e.target.value})} />
              <input type="number" placeholder="السعر" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
              <input type="number" placeholder="الكمية" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newProduct.quantity} onChange={e => setNewProduct({...newProduct, quantity: e.target.value})} />
              <input type="number" placeholder="حد التنبيه (اختياري، افتراضي 5)" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newProduct.lowStockThreshold} onChange={e => setNewProduct({...newProduct, lowStockThreshold: e.target.value})} />
              <input type="date" placeholder="تاريخ انتهاء الصلاحية" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newProduct.expirationDate} onChange={e => setNewProduct({...newProduct, expirationDate: e.target.value})} />
              <select className="w-full bg-card2 border border-border p-3 rounded-2xl" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value, subcategory: ''})}>
                  <option value="">اختر التصنيف الرئيسي</option>
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              {newProduct.category && (
                  <select className="w-full bg-card2 border border-border p-3 rounded-2xl" value={newProduct.subcategory} onChange={e => setNewProduct({...newProduct, subcategory: e.target.value})}>
                      <option value="">اختر التصنيف الفرعي</option>
                      {categories.find(c => c.name === newProduct.category)?.subcategories?.map(sc => <option key={sc} value={sc}>{sc}</option>)}
                  </select>
              )}
              <input placeholder="رابط الصورة (اختياري)" className="bg-card2 border border-border p-3 rounded-2xl w-full" value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} />
              <select className="w-full bg-card2 border border-border p-3 rounded-2xl" value={newProduct.branchId} onChange={e => setNewProduct({...newProduct, branchId: e.target.value})}>
                  <option value="">اختر الفرع</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <button onClick={handleSaveProduct} className="w-full bg-gold text-white p-3 rounded-2xl font-bold">حفظ المنتج</button>
            </div>

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">{showArchived ? 'المنتجات المؤرشفة' : 'المخزون المتوفر'}</h2>
              <button onClick={() => setShowArchived(!showArchived)} className={`px-4 py-2 rounded-2xl text-sm font-bold ${showArchived ? 'bg-gold text-white' : 'bg-card2 border border-border'}`}>
                {showArchived ? 'عرض المخزون الحالي' : 'عرض المنتجات المؤرشفة'}
              </button>
            </div>
            <div className='flex gap-2 mb-2'>
                <input type="text" placeholder="بحث عن منتج (اسم أو SKU)..." className="w-full bg-card2 border border-border p-3 rounded-2xl" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                {!showArchived && (
                  <button onClick={printSelectedBarcodes} disabled={selectedProducts.size === 0} className='bg-gold text-white p-3 rounded-2xl whitespace-nowrap disabled:bg-gray-400'>طباعة المختار ({selectedProducts.size})</button>
                )}
            </div>
            <select className="w-full bg-card2 border border-border p-2 rounded-xl mb-4" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">جميع التصنيفات الرئيسية</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <input placeholder="تصفية بالتصنيف الفرعي..." className="w-full bg-card2 border border-border p-3 rounded-2xl mb-4" value={filterSubcategory} onChange={e => setFilterSubcategory(e.target.value)} />
            <select className="w-full bg-card2 border border-border p-2 rounded-xl mb-4" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
              <option value="">جميع الفروع</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            {isScanning && (
                  <div className='fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn'>
                      <div className='bg-card p-4 rounded-3xl w-full max-w-sm border border-border shadow-2xl'>
                     <QrScanner
                          delay={100}
                          className='w-full h-64 rounded-2xl'
                          onError={(err: any) => console.error(err)}
                          onScan={(data: any) => {
                             if (data) {
                                const scanned = typeof data === 'string' ? data : data.text;
                                setNewProduct(prev => ({...prev, sku: scanned}));
                                setIsScanning(false);
                             }
                          }}
                       />
                         <button onClick={() => setIsScanning(false)} className='w-full mt-4 bg-danger text-white py-2.5 rounded-xl font-bold'>إغلاق</button>
                      </div>
                  </div>
              )}
              
            {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage(null)} />}
            <div className="space-y-3 pb-20">
              {products.filter(p => (!filterCategory || p.category === filterCategory) && (!filterSubcategory || p.subcategory?.includes(filterSubcategory)) && (!filterBranch || p.branchId === filterBranch) && (showArchived ? p.archived : !p.archived) && (p.name.includes(searchTerm) || p.sku.toLowerCase().includes(searchTerm.toLowerCase()))).map(product => {
                const threshold = product.lowStockThreshold ?? 5;
                const isLowStock = product.quantity <= threshold;
                return (
                  <div key={product.id} className={`bg-card p-4 rounded-3xl border ${isLowStock && !showArchived ? 'border-danger' : 'border-border'} flex flex-col gap-4`}>
                    <div className="flex items-center justify-between">
                        {!showArchived && <input type="checkbox" checked={selectedProducts.has(product.id)} onChange={() => toggleProductSelection(product.id)} />}
                      <div>
                        <h3 className="font-bold">{product.name}</h3>
                        <p className="text-text-dim text-xs">الرمز: {product.sku} {product.category && `| تصنيف: ${product.category}`}</p>
                        <p className="text-text-dim text-xs">S/N: {product.serial || 'N/A'}</p>
                        {isLowStock && !showArchived && <p className="text-danger text-xs font-bold mt-1">⚠️ مخزون منخفض (الحد: {threshold})</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={`font-black text-lg ${product.quantity === 0 ? 'text-danger' : isLowStock ? 'text-gold' : 'text-success'}`}>
                          {product.quantity}
                        </div>
                        {!showArchived && (
                          <div className="flex flex-col gap-1">
                            <button onClick={() => updateQuantity(product.id, 1)} className="bg-accent rounded-full p-1 text-xs px-2">+</button>
                            <button onClick={() => updateQuantity(product.id, -1)} className="bg-accent rounded-full p-1 text-xs px-2">-</button>
                          </div>
                        )}
                        {showArchived ? (
                          <button onClick={async () => {
                              await updateDoc(doc(db, 'products', product.id), { archived: false });
                              setProducts(products.map(p => p.id === product.id ? {...p, archived: false} : p));
                              logActivity(`استرجاع منتج: ${product.name}`);
                              setToastMessage(`تم استرجاع المنتج ${product.name} بنجاح`);
                          }} className='bg-success text-white rounded-full px-3 py-2 text-xs font-bold'>استرجاع</button>
                        ) : (
                          <button onClick={async () => {
                              await updateDoc(doc(db, 'products', product.id), { archived: true });
                              setProducts(products.map(p => p.id === product.id ? {...p, archived: true} : p));
                              logActivity(`أرشفة منتج: ${product.name}`);
                              setToastMessage(`تم أرشفة المنتج ${product.name}`);
                          }} className='bg-danger text-white rounded-full p-2 text-xs'>أرشفة</button>
                        )}
                      </div>
                    </div>
                    
                    {!showArchived && (
                      <div className="border-t border-border pt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm w-20">سعر البيع:</span>
                          <input 
                            type="number" 
                            className="bg-card2 border border-border p-2 rounded-xl flex-grow text-sm"
                            placeholder={product.price?.toString() || '0'}
                            value={editingPrices[product.id]?.price ?? ''}
                            onChange={e => setEditingPrices({
                              ...editingPrices, 
                              [product.id]: { 
                                price: e.target.value, 
                                cost: editingPrices[product.id]?.cost ?? product.cost?.toString() ?? '' 
                              }
                            })}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm w-20">التكلفة / الشراء:</span>
                          <input 
                            type="number" 
                            className="bg-card2 border border-border p-2 rounded-xl flex-grow text-sm"
                            placeholder={product.cost?.toString() || '0'}
                            value={editingPrices[product.id]?.cost ?? ''}
                            onChange={e => setEditingPrices({
                              ...editingPrices, 
                              [product.id]: { 
                                price: editingPrices[product.id]?.price ?? product.price?.toString() ?? '', 
                                cost: e.target.value 
                              }
                            })}
                          />
                          <button onClick={() => savePrice(product.id)} className="bg-gold text-white px-4 py-2 rounded-xl text-sm font-bold shadow">حفظ الأسعار</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
        </>
      ) : (
        <InventoryCount products={products} setProducts={setProducts} />
      )}
    </div>
  );
}
