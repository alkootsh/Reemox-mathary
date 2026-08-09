import React, { useState, useEffect } from 'react';
import { Product, Category, Branch } from '@/src/types/types';
import { db } from '@/src/lib/firebase';
import { Camera, X, MessageSquare, Mail, AlertTriangle, Send } from 'lucide-react';
import QrScanner from 'react-qr-scanner';
import { collection, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore';
import { logActivity } from '@/src/lib/activity';
import Toast from './Toast';
import InventoryCount from './InventoryCount';
import { playAlertSound } from '@/src/lib/audio';
import { playSuccessSound, playWarningSound } from '@/src/lib/sound';
import { triggerLowStockAlert, getNotificationConfig, buildBulkLowStockMessage, openDirectWhatsAppChat } from '@/src/lib/notifications';
import jsPDF from 'jspdf';

export default function Inventory({ categories, branches }: { categories: Category[], branches: Branch[] }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [newProduct, setNewProduct] = useState({ 
    name: '', 
    sku: '', 
    serial: '', 
    price: '', 
    cost: '',
    quantity: '', 
    openingStock: '',
    openingCost: '',
    category: '', 
    expirationDate: '', 
    batchNumber: '',
    subcategory: '', 
    lowStockThreshold: '', 
    image: '', 
    branchId: '',
    isPharmacy: false,
    stripsPerBox: '',
    stripPrice: '',
    stripBarcode: ''
  });
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
    if (!newProduct.name || !newProduct.sku || !newProduct.price) {
      alert('يرجى ملء الحقول الإجبارية (الاسم، الرمز، السعر)');
      return;
    }
    
    try {
      setSaving(true);
      setErrorMsg(null);
      const initialQty = newProduct.quantity ? parseInt(newProduct.quantity) : (newProduct.openingStock ? parseInt(newProduct.openingStock) : 0);
      const initialCost = newProduct.cost ? parseFloat(newProduct.cost) : (newProduct.openingCost ? parseFloat(newProduct.openingCost) : 0);
      const stripsCount = newProduct.stripsPerBox ? parseInt(newProduct.stripsPerBox) : undefined;
      const stripSellPrice = newProduct.stripPrice ? parseFloat(newProduct.stripPrice) : undefined;

      const productData: any = {
        name: newProduct.name,
        sku: newProduct.sku,
        serial: newProduct.serial || null,
        price: parseFloat(newProduct.price),
        cost: initialCost,
        quantity: initialQty,
        openingStock: initialQty,
        openingCost: initialCost,
        category: newProduct.category || null,
        expirationDate: newProduct.expirationDate || null,
        batchNumber: newProduct.batchNumber || null,
        subcategory: newProduct.subcategory || null,
        branchId: newProduct.branchId || null,
        lowStockThreshold: newProduct.lowStockThreshold ? parseInt(newProduct.lowStockThreshold) : 5,
        image: newProduct.image || null,
        isPharmacy: Boolean(newProduct.isPharmacy || stripsCount),
        stripsPerBox: stripsCount || null,
        stripPrice: stripSellPrice || null,
        stripBarcode: newProduct.stripBarcode || null,
        createdAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'products'), productData);
      
      // If opening stock is provided, log movement
      if (initialQty > 0) {
        await addDoc(collection(db, 'inventory_movements'), {
          productId: docRef.id,
          productName: newProduct.name,
          branchId: newProduct.branchId || 'default',
          movementType: 'OPENING_BALANCE',
          quantity: initialQty,
          unitCost: initialCost,
          stockBefore: 0,
          stockAfter: initialQty,
          referenceType: 'ADJUSTMENT',
          referenceId: 'OPENING-STOCK',
          userId: 'admin',
          createdAt: new Date().toISOString(),
          notes: 'تسجيل رصيد وتكلفة أول المدة عند إنشاء الصنف'
        });
      }

      setProducts([...products, { ...productData, id: docRef.id } as Product]);
      logActivity(`تم إضافة منتج جديد ورصيد أول مدة: ${newProduct.name}`);
      setNewProduct({ 
        name: '', 
        sku: '', 
        serial: '', 
        price: '', 
        cost: '',
        quantity: '', 
        openingStock: '',
        openingCost: '',
        category: '', 
        expirationDate: '', 
        batchNumber: '',
        subcategory: '', 
        branchId: '', 
        lowStockThreshold: '', 
        image: '',
        isPharmacy: false,
        stripsPerBox: '',
        stripPrice: '',
        stripBarcode: ''
      });
      alert('تم حفظ المنتج ورصيد أول المدة وبيانات الوحدات بنجاح!');
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
        setToastMessage(`🚨 تحذير: المنتج "${product.name}" أصبح رصيده منخفضاً (${newQuantity})`);
        playAlertSound('warning');

        // Dispatch comprehensive notification (Direct WhatsApp + Twilio + Email)
        triggerLowStockAlert({
          ...product,
          quantity: newQuantity
        }).catch(err => console.error("Failed to trigger stock alert:", err));
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
                    <div className='bg-card p-6 rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto border border-border shadow-2xl space-y-4'>
                       <div className="flex items-center justify-between border-b border-border pb-3">
                         <div className="flex items-center gap-2">
                           <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                             <AlertTriangle size={20} />
                           </span>
                           <h2 className='text-lg font-black text-gold'>منتجات تحتاج لإعادة طلب وتوريد</h2>
                         </div>
                         <button 
                           onClick={() => setShowLowStockModal(false)}
                           className="text-text-dim hover:text-white p-1 rounded-lg"
                         >
                           <X size={20} />
                         </button>
                       </div>

                       <div className="bg-card2 rounded-2xl border border-border overflow-hidden">
                         <table className='w-full text-right text-xs'>
                            <thead className="bg-card border-b border-border text-text-dim">
                              <tr>
                                <th className='p-3 font-bold'>المنتج</th>
                                <th className='p-3 text-center font-bold'>الرصيد الحالي</th>
                                <th className='p-3 text-center font-bold'>حد الطلب</th>
                              </tr>
                            </thead>
                            <tbody className='divide-y divide-border'>
                              {products.filter(p => p.quantity <= (p.lowStockThreshold ?? 5)).map(p => (
                                 <tr key={p.id} className='hover:bg-card/50'>
                                   <td className='p-3 font-bold text-text-main'>{p.name}</td>
                                   <td className='p-3 text-center font-mono font-black text-rose-400'>{p.quantity}</td>
                                   <td className='p-3 text-center font-mono text-text-dim'>{p.lowStockThreshold ?? 5}</td>
                                 </tr>
                              ))}
                            </tbody>
                         </table>
                       </div>

                       {/* Action Dispatcher Buttons */}
                       <div className="space-y-2 pt-2">
                         <button
                           onClick={() => {
                             const lowItems = products.filter(p => p.quantity <= (p.lowStockThreshold ?? 5));
                             const cfg = getNotificationConfig();
                             const msg = buildBulkLowStockMessage(lowItems);
                             openDirectWhatsAppChat(cfg.managerWhatsApp, msg, cfg.managerWhatsAppCountryCode);
                             playSuccessSound();
                           }}
                           className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold p-3 rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 text-xs"
                         >
                           <MessageSquare size={16} />
                           <span>📱 إرسال تقرير النواقص المباشر لواتساب المدير</span>
                         </button>

                         <button
                           onClick={async () => {
                             const lowItems = products.filter(p => p.quantity <= (p.lowStockThreshold ?? 5));
                             const cfg = getNotificationConfig();
                             if (!cfg.managerEmail) {
                               playWarningSound();
                               alert('يرجى تحديد البريد الإلكتروني للمدير أولاً من شاشة الإعدادات');
                               return;
                             }
                             const msg = buildBulkLowStockMessage(lowItems);
                             try {
                               const res = await fetch('/api/notify-email', {
                                 method: 'POST',
                                 headers: { 'Content-Type': 'application/json' },
                                 body: JSON.stringify({
                                   to: cfg.managerEmail,
                                   subject: `🚨 تقرير نواقص المخزون (${lowItems.length} صنف)`,
                                   message: msg
                                 })
                               });
                               const d = await res.json();
                               if (d.success) {
                                 playSuccessSound();
                                 alert('✅ تم إرسال تقرير النواقص للمدير عبر البريد بنجاح');
                               } else {
                                 playWarningSound();
                                 alert(`⚠️ تنبيه: ${d.reason || 'تعذر الإرسال عبر خادم SMTP'}`);
                               }
                             } catch (e) {
                               alert('تعذر الاتصال بالخادم');
                             }
                           }}
                           className="w-full bg-card2 hover:bg-slate-700 text-blue-400 border border-blue-500/30 font-bold p-3 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs"
                         >
                           <Mail size={16} />
                           <span>✉️ إرسال تقرير النواقص لبريد المدير الإلكتروني</span>
                         </button>

                         <button 
                           onClick={() => setShowLowStockModal(false)} 
                           className='w-full bg-slate-800 hover:bg-slate-700 text-text-dim hover:text-white font-bold p-3 rounded-2xl transition-all text-xs'
                         >
                           إغلاق
                         </button>
                       </div>
                    </div>
                </div>
            )}
            <h2 className="text-xl font-bold mb-4 text-text-main">إضافة صنف جديد (مع رصيد أول المدة، الصلاحية، ووحدات الصيدلية)</h2>
            <div className="bg-card p-5 sm:p-6 rounded-3xl border border-border mb-6 space-y-4 shadow-sm">
              {/* Basic Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-text-dim block mb-1">اسم الصنف / الدواء *</label>
                  <input 
                    placeholder="مثال: بنادول إكسترا 500 ملجم / شاي العروسة" 
                    className="bg-card2 border border-border p-3 rounded-2xl w-full text-sm font-bold text-text-main focus:border-gold focus:outline-none" 
                    value={newProduct.name} 
                    onChange={e => setNewProduct({...newProduct, name: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-dim block mb-1">الرمز أو الباركود (SKU) *</label>
                  <div className='flex gap-2'>
                    <input 
                      placeholder="SKU / Barcode" 
                      className="bg-card2 border border-border p-3 rounded-2xl w-full text-sm font-mono text-text-main focus:border-gold focus:outline-none" 
                      value={newProduct.sku} 
                      onChange={e => setNewProduct({...newProduct, sku: e.target.value})} 
                    />
                    <button type="button" onClick={() => setIsScanning(true)} className='p-3 bg-accent rounded-2xl text-white hover:opacity-90'>
                      <Camera size={18} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Pricing & Opening Stock */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-card2/50 p-4 rounded-2xl border border-border/80">
                <div>
                  <label className="text-xs font-bold text-text-dim block mb-1">سعر بيع الوحدة الأساسية (علبة/قطعة) *</label>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    className="bg-card2 border border-border p-2.5 rounded-xl w-full text-sm font-bold font-mono text-text-main focus:border-gold focus:outline-none" 
                    value={newProduct.price} 
                    onChange={e => setNewProduct({...newProduct, price: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-dim block mb-1">سعر التكلفة / الشراء</label>
                  <input 
                    type="number" 
                    placeholder="0.00" 
                    className="bg-card2 border border-border p-2.5 rounded-xl w-full text-sm font-bold font-mono text-text-main focus:border-gold focus:outline-none" 
                    value={newProduct.cost} 
                    onChange={e => setNewProduct({...newProduct, cost: e.target.value, openingCost: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gold block mb-1">رصيد أول المدة (Opening Stock)</label>
                  <input 
                    type="number" 
                    placeholder="0" 
                    className="bg-card2 border border-gold/40 p-2.5 rounded-xl w-full text-sm font-black font-mono text-gold focus:border-gold focus:outline-none" 
                    value={newProduct.quantity} 
                    onChange={e => setNewProduct({...newProduct, quantity: e.target.value, openingStock: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-dim block mb-1">حد تنبيه النواقص</label>
                  <input 
                    type="number" 
                    placeholder="5" 
                    className="bg-card2 border border-border p-2.5 rounded-xl w-full text-sm font-mono text-text-main focus:border-gold focus:outline-none" 
                    value={newProduct.lowStockThreshold} 
                    onChange={e => setNewProduct({...newProduct, lowStockThreshold: e.target.value})} 
                  />
                </div>
              </div>

              {/* Multi-Units & Pharmacy Features */}
              <div className="bg-accent/5 p-4 rounded-2xl border border-accent/20 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={newProduct.isPharmacy} 
                      onChange={e => setNewProduct({...newProduct, isPharmacy: e.target.checked})}
                      className="rounded accent-gold w-4 h-4"
                    />
                    <span className="text-sm font-bold text-text-main">صنف صيدلية / تجزئة وحدات (بيع بالعلبة والشريط والقرص) 💊</span>
                  </label>
                  <span className="text-[11px] text-text-dim">خصم كسرى تلقائي عند بيع الشريط</span>
                </div>

                {newProduct.isPharmacy && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="text-xs font-bold text-text-dim block mb-1">عدد الأشرطة بالعلبة (Strips/Box)</label>
                      <input 
                        type="number" 
                        placeholder="مثال: 3 أشرطة" 
                        className="bg-card2 border border-border p-2.5 rounded-xl w-full text-sm font-bold text-text-main focus:border-gold focus:outline-none" 
                        value={newProduct.stripsPerBox} 
                        onChange={e => setNewProduct({...newProduct, stripsPerBox: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-text-dim block mb-1">سعر بيع الشريط الواحد</label>
                      <input 
                        type="number" 
                        placeholder="مثال: 20 ج.م" 
                        className="bg-card2 border border-border p-2.5 rounded-xl w-full text-sm font-bold text-text-main focus:border-gold focus:outline-none" 
                        value={newProduct.stripPrice} 
                        onChange={e => setNewProduct({...newProduct, stripPrice: e.target.value})} 
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-text-dim block mb-1">باركود الشريط (اختياري)</label>
                      <input 
                        type="text" 
                        placeholder="باركود الشريط المنفصل" 
                        className="bg-card2 border border-border p-2.5 rounded-xl w-full text-sm font-mono text-text-main focus:border-gold focus:outline-none" 
                        value={newProduct.stripBarcode} 
                        onChange={e => setNewProduct({...newProduct, stripBarcode: e.target.value})} 
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Expiration & Batch Lot Tracking */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-card2/30 p-4 rounded-2xl border border-border">
                <div>
                  <label className="text-xs font-bold text-text-dim block mb-1">تاريخ انتهاء الصلاحية (Expiry Date)</label>
                  <input 
                    type="date" 
                    className="bg-card2 border border-border p-2.5 rounded-xl w-full text-sm text-text-main focus:border-gold focus:outline-none" 
                    value={newProduct.expirationDate} 
                    onChange={e => setNewProduct({...newProduct, expirationDate: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-dim block mb-1">رقم التشغيلة (Batch / Lot No.)</label>
                  <input 
                    type="text" 
                    placeholder="مثال: BATCH-2026-08" 
                    className="bg-card2 border border-border p-2.5 rounded-xl w-full text-sm font-mono text-text-main focus:border-gold focus:outline-none" 
                    value={newProduct.batchNumber} 
                    onChange={e => setNewProduct({...newProduct, batchNumber: e.target.value})} 
                  />
                </div>
              </div>

              {/* Categories & Branch */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <select className="bg-card2 border border-border p-3 rounded-2xl text-sm text-text-main" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value, subcategory: ''})}>
                    <option value="">اختر التصنيف الرئيسي</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                {newProduct.category && (
                    <select className="bg-card2 border border-border p-3 rounded-2xl text-sm text-text-main" value={newProduct.subcategory} onChange={e => setNewProduct({...newProduct, subcategory: e.target.value})}>
                        <option value="">اختر التصنيف الفرعي</option>
                        {categories.find(c => c.name === newProduct.category)?.subcategories?.map(sc => <option key={sc} value={sc}>{sc}</option>)}
                    </select>
                )}
                <select className="bg-card2 border border-border p-3 rounded-2xl text-sm text-text-main" value={newProduct.branchId} onChange={e => setNewProduct({...newProduct, branchId: e.target.value})}>
                    <option value="">اختر الفرع (الافتراضي)</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <button 
                type="button"
                onClick={handleSaveProduct} 
                disabled={saving} 
                className="w-full bg-gold hover:bg-gold2 text-white p-3.5 rounded-2xl font-black shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2 text-sm"
              >
                <span>حفظ الصنف وتوثيق رصيد أول المدة</span>
              </button>
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-text-main text-base">{product.name}</h3>
                          {product.isPharmacy && (
                            <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              💊 صيدلية
                            </span>
                          )}
                        </div>

                        <div className="text-text-dim text-xs flex items-center gap-3 mt-1 flex-wrap">
                          <span>الرمز: <strong className="text-text-main font-mono">{product.sku}</strong></span>
                          {product.category && <span>التصنيف: <span className="text-text-main">{product.category}</span></span>}
                          {product.batchNumber && <span>التشغيلة: <strong className="text-gold font-mono">{product.batchNumber}</strong></span>}
                          {product.serial && <span>S/N: {product.serial}</span>}
                        </div>

                        {/* Pharmacy Multi-units info */}
                        {product.stripsPerBox && product.stripsPerBox > 1 && (
                          <div className="text-[11px] text-purple-300 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-xl mt-2 inline-flex items-center gap-2">
                            <span>📦 علبة بها <strong>{product.stripsPerBox}</strong> شريط</span>
                            <span>| سعر الشريط: <strong className="text-gold font-mono">{product.stripPrice || (product.price / product.stripsPerBox).toFixed(1)} ج.م</strong></span>
                            {product.stripBarcode && <span>| باركود الشريط: <span className="font-mono">{product.stripBarcode}</span></span>}
                          </div>
                        )}

                        {/* Expiration date badge */}
                        {product.expirationDate && (
                          <div className="mt-1.5">
                            {(() => {
                              const expTime = new Date(product.expirationDate).getTime();
                              const nowTime = Date.now();
                              const diffDays = Math.ceil((expTime - nowTime) / (1000 * 60 * 60 * 24));
                              const isExpired = diffDays <= 0;
                              const isNear = diffDays > 0 && diffDays <= 60;
                              return (
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isExpired 
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' 
                                    : isNear 
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' 
                                    : 'bg-emerald-500/10 text-emerald-400'
                                }`}>
                                  <span>الصلاحية: {product.expirationDate}</span>
                                  {isExpired ? <span>(⚠️ منتهي الصلاحية!)</span> : isNear ? <span>(⏳ ينتهي خلال {diffDays} يوم)</span> : <span>(ساري)</span>}
                                </span>
                              );
                            })()}
                          </div>
                        )}

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
        <InventoryCount products={products} setProducts={setProducts} categories={categories} />
      )}
    </div>
  );
}
