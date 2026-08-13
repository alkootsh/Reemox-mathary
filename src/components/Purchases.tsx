import React, { useState, useEffect, useRef } from 'react';
import { Purchase, Product, AppUser, Supplier, PurchaseItem } from '../types/types';
import { db } from '../lib/firebase';
import { getProducts, savePurchase, deletePurchase, getSuppliers, saveSupplier, saveProduct, DEFAULT_UNITS, getUnits, getUserPreferences } from '../lib/firestoreService';
import Toast from './Toast';
import { playSuccessSound, playWarningSound } from '../lib/sound';
import { safeParse } from '../lib/json';
import { triggerPurchaseNotification } from '../lib/notifications';
import ColumnManagerModal from './ColumnManagerModal';
import { PURCHASES_COLUMNS, PURCHASES_DEFAULT_VISIBLE } from '../lib/columns';

interface Props {
  purchases: Purchase[];
  setPurchases: React.Dispatch<React.SetStateAction<Purchase[]>>;
}

interface InvoiceItem {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  cost: number;
  sellingPrice: number;
  quantity: number;
  notes: string;
  total: number;
}

export default function Purchases({ purchases, setPurchases }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Invoice general states
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedSupplierName, setSelectedSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState(() => `INV-${Date.now().toString().slice(-6)}`);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'deferred-full' | 'deferred-partial'>('cash');
  const [paidAmount, setPaidAmount] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [vatPercentage, setVatPercentage] = useState('0'); // Default 0% VAT

  // Invoice grid items
  const [cartItems, setCartItems] = useState<InvoiceItem[]>([]);

  // Search product states
  const [productSearch, setProductSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // New Supplier Quick Add Form State
  const [showAddSupplierModal, setShowAddSupplierModal] = useState(false);
  const [quickSupplierName, setQuickSupplierName] = useState('');
  const [quickSupplierPhone, setQuickSupplierPhone] = useState('');
  const [quickSupplierCompany, setQuickSupplierCompany] = useState('');
  const [quickSupplierBalance, setQuickSupplierBalance] = useState('0');
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  // New Product Quick Add Form State
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [quickProductName, setQuickProductName] = useState('');
  const [quickProductSku, setQuickProductSku] = useState('');
  const [quickProductPrice, setQuickProductPrice] = useState('');
  const [quickProductCost, setQuickProductCost] = useState('');
  const [quickProductQuantity, setQuickProductQuantity] = useState('0');
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const currentUser: AppUser | null = safeParse(localStorage.getItem('currentUser'), null);
  const isAdmin = currentUser?.role === 'admin';
  const userEmail = currentUser?.username || 'admin';

  const [purchasesVisibleKeys, setPurchasesVisibleKeys] = useState<string[]>(PURCHASES_DEFAULT_VISIBLE);
  const [purchasesOrderedKeys, setPurchasesOrderedKeys] = useState<string[]>(() => PURCHASES_COLUMNS.map(c => c.key));
  const [showPurchasesColModal, setShowPurchasesColModal] = useState<boolean>(false);

  useEffect(() => {
    async function fetchPrefs() {
      try {
        const prefs = await getUserPreferences(userEmail, 'purchases');
        if (prefs && prefs.visible && prefs.order) {
          setPurchasesVisibleKeys(prefs.visible);
          setPurchasesOrderedKeys(prefs.order);
        }
      } catch (err) {
        console.warn("Failed to fetch column preferences for purchases:", err);
      }
    }
    fetchPrefs();
  }, [userEmail]);

  const hasUnsavedData = cartItems.length > 0 || Boolean(selectedSupplierId);

  useEffect(() => {
    async function loadData() {
      const productsData = await getProducts();
      setProducts(productsData);
      
      const suppliersData = await getSuppliers();
      setSuppliers(suppliersData);
    }
    loadData();
  }, []);

  // Handle outside click to close search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Product search filter
  useEffect(() => {
    if (!productSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const q = productSearch.trim().toLowerCase();
    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcodes && p.barcodes.some(b => b.toLowerCase().includes(q)))
    );
    setSearchResults(filtered.slice(0, 5));
  }, [productSearch, products]);

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sId = e.target.value;
    const s = suppliers.find(sup => sup.id === sId);
    setSelectedSupplierId(sId);
    setSelectedSupplierName(s ? s.name : '');
  };

  const handleConvertLowStockToOrder = (prod: Product) => {
    const threshold = prod.lowStockThreshold ?? 5;
    const targetQty = threshold * 2;
    const suggestedQty = Math.max(1, targetQty - Math.max(0, prod.quantity || 0));

    const existing = cartItems.find(item => item.productId === prod.id);
    if (existing) {
      setCartItems(cartItems.map(item => 
        item.productId === prod.id 
          ? { ...item, quantity: item.quantity + suggestedQty, total: (item.quantity + suggestedQty) * item.cost }
          : item
      ));
    } else {
      setCartItems([...cartItems, {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku || (prod.barcodes && prod.barcodes[0]) || '',
        unit: 'علبة',
        cost: prod.cost || 0,
        sellingPrice: prod.price || 0,
        quantity: suggestedQty,
        notes: 'مضاف تلقائياً من نواقص المخزون',
        total: suggestedQty * (prod.cost || 0)
      }]);
    }
    playSuccessSound();
    setToast({ message: `تمت إضافة الصنف "${prod.name}" للطلبية بالكمية المقترحة (${suggestedQty})`, type: 'success' });
  };

  const handleAddProductToCart = (prod: Product) => {
    const existing = cartItems.find(item => item.productId === prod.id);
    if (existing) {
      // Update quantity
      setCartItems(cartItems.map(item => 
        item.productId === prod.id 
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.cost }
          : item
      ));
    } else {
      // Add as new row
      setCartItems([...cartItems, {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku || (prod.barcodes && prod.barcodes[0]) || '',
        unit: 'علبة', // Default unit
        cost: prod.cost || 0,
        sellingPrice: prod.price || 0,
        quantity: 1,
        notes: '',
        total: prod.cost || 0
      }]);
    }
    setProductSearch('');
    setSearchResults([]);
    setIsSearchFocused(false);
    playSuccessSound();
  };

  // Keyboard support for product search bar
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0) {
        // Add the first matching result
        handleAddProductToCart(searchResults[0]);
      } else if (productSearch.trim()) {
        // Option to add new quick product with this search query as name
        setQuickProductName(productSearch.trim());
        setShowAddProductModal(true);
      }
    }
  };

  const updateCartItem = (index: number, fields: Partial<InvoiceItem>) => {
    const updated = [...cartItems];
    const current = updated[index];
    const newQty = fields.quantity !== undefined ? fields.quantity : current.quantity;
    const newCost = fields.cost !== undefined ? fields.cost : current.cost;
    
    updated[index] = {
      ...current,
      ...fields,
      total: Math.round((newQty * newCost) * 100) / 100
    };
    setCartItems(updated);
  };

  const removeCartItem = (index: number) => {
    setCartItems(cartItems.filter((_, i) => i !== index));
    playWarningSound();
  };

  // Calculations
  const subtotal = cartItems.reduce((sum, item) => sum + item.total, 0);
  const vatRate = parseFloat(vatPercentage) || 0;
  const vatAmount = Math.round((subtotal * (vatRate / 100)) * 100) / 100;
  const finalTotal = subtotal + vatAmount;

  // Handle payment method constraints
  useEffect(() => {
    if (paymentMethod === 'cash') {
      setPaidAmount(finalTotal.toString());
    } else if (paymentMethod === 'deferred-full') {
      setPaidAmount('0');
    }
  }, [paymentMethod, finalTotal]);

  const paidVal = parseFloat(paidAmount) || 0;
  const deferredVal = Math.max(0, finalTotal - paidVal);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSupplierName.trim()) {
      setToast({ message: 'تنبيه: يرجى إدخال اسم المورد', type: 'warning' });
      playWarningSound();
      return;
    }
    try {
      setIsSavingSupplier(true);
      const supplierData = {
        name: quickSupplierName.trim(),
        phone: quickSupplierPhone.trim() || '0000000000',
        contactPerson: quickSupplierCompany.trim() || quickSupplierName.trim(),
        email: '',
        openingBalance: parseFloat(quickSupplierBalance) || 0,
        currentBalance: parseFloat(quickSupplierBalance) || 0
      };
      const newId = await saveSupplier(supplierData);
      const newSupplier = { ...supplierData, id: newId || `sup-${Date.now()}` } as Supplier;
      setSuppliers([...suppliers, newSupplier]);
      setSelectedSupplierId(newSupplier.id);
      setSelectedSupplierName(newSupplier.name);
      
      setQuickSupplierName('');
      setQuickSupplierPhone('');
      setQuickSupplierCompany('');
      setQuickSupplierBalance('0');
      setShowAddSupplierModal(false);
      playSuccessSound();
      setToast({ message: 'تم إضافة المورد الجديد بنجاح واختياره', type: 'success' });
    } catch (err: any) {
      console.error('Error adding supplier:', err);
      setToast({ message: `فشل حفظ المورد: ${err.message}`, type: 'warning' });
      playWarningSound();
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickProductName.trim()) {
      setToast({ message: 'تنبيه: يرجى إدخال اسم الصنف/المنتج', type: 'warning' });
      playWarningSound();
      return;
    }
    try {
      setIsSavingProduct(true);
      const productData = {
        name: quickProductName.trim(),
        sku: quickProductSku.trim() || `sku-${Date.now().toString().slice(-6)}`,
        price: parseFloat(quickProductPrice) || 0,
        cost: parseFloat(quickProductCost) || 0,
        quantity: parseFloat(quickProductQuantity) || 0,
        unlimitedStock: false,
        barcode: quickProductSku.trim() || `sku-${Date.now().toString().slice(-6)}`
      };
      const newId = await saveProduct(productData);
      const newProduct = { ...productData, id: newId || `prod-${Date.now()}` } as Product;
      setProducts([...products, newProduct]);
      
      // Auto add to classic invoice cart
      handleAddProductToCart(newProduct);

      setQuickProductName('');
      setQuickProductSku('');
      setQuickProductPrice('');
      setQuickProductCost('');
      setQuickProductQuantity('0');
      setShowAddProductModal(false);
      playSuccessSound();
      setToast({ message: 'تم إضافة الصنف الجديد بنجاح وإضافته للفاتورة الحالية', type: 'success' });
    } catch (err: any) {
      console.error('Error adding product:', err);
      setToast({ message: `فشل حفظ المنتج: ${err.message}`, type: 'warning' });
      playWarningSound();
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleSavePurchase = async () => {
    // 1. Validations (تدقيق المدخلات)
    if (!selectedSupplierId) {
      playWarningSound();
      setToast({ message: 'خطأ في التدقيق: يرجى تحديد اسم المورد بالفاتورة!', type: 'warning' });
      return;
    }
    if (cartItems.length === 0) {
      playWarningSound();
      setToast({ message: 'خطأ في التدقيق: لا يمكن حفظ فاتورة شراء فارغة. يرجى إضافة أصناف أولاً!', type: 'warning' });
      return;
    }
    
    // Check item values
    for (let i = 0; i < cartItems.length; i++) {
      const item = cartItems[i];
      if (item.quantity <= 0 || isNaN(item.quantity)) {
        playWarningSound();
        setToast({ message: `خطأ في التدقيق: الكمية للصنف (${item.productName}) يجب أن تكون أكبر من الصفر!`, type: 'warning' });
        return;
      }
      if (item.cost < 0 || isNaN(item.cost)) {
        playWarningSound();
        setToast({ message: `خطأ في التدقيق: سعر الشراء للصنف (${item.productName}) لا يمكن أن يكون سالباً!`, type: 'warning' });
        return;
      }
    }

    if (paymentMethod === 'deferred-partial') {
      const paid = parseFloat(paidAmount);
      if (isNaN(paid) || paid < 0) {
        playWarningSound();
        setToast({ message: 'خطأ في التدقيق: يرجى كتابة مبلغ مدفوع صحيح!', type: 'warning' });
        return;
      }
      if (paid > finalTotal) {
        playWarningSound();
        setToast({ message: 'خطأ في التدقيق: المبلغ المدفوع لا يمكن أن يتجاوز إجمالي الفاتورة!', type: 'warning' });
        return;
      }
    }

    // Build items payload
    const itemsPayload: PurchaseItem[] = cartItems.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      cost: item.cost,
      unit: item.unit,
      notes: item.notes,
      barcode: item.sku
    }));

    const purchaseData = {
      supplierId: selectedSupplierId,
      supplierName: selectedSupplierName,
      items: itemsPayload,
      total: finalTotal,
      subtotal: subtotal,
      vatAmount: vatAmount,
      paymentMethod: paymentMethod,
      paidAmount: paidVal,
      date: new Date().toISOString(),
      notes: invoiceNotes.trim(),
      invoiceNumber: invoiceNumber.trim() || `PUR-${Date.now().toString().slice(-6)}`
    };

    try {
      if (editingId) {
        if (!isAdmin) {
          playWarningSound();
          setToast({ message: 'عذراً: التعديل متاح فقط للمدير العام (Admin)', type: 'warning' });
          return;
        }
        await savePurchase({ ...purchaseData, id: editingId });
        setPurchases(purchases.map(p => p.id === editingId ? { ...purchaseData, id: editingId } as Purchase : p));
        setToast({ message: 'تم تعديل فاتورة الشراء بنجاح (صلاحية أدمن)', type: 'success' });
        setEditingId(null);
      } else {
        const savedId = await savePurchase(purchaseData);
        const newPurchObj = { ...purchaseData, id: savedId };
        setPurchases([...purchases, newPurchObj as Purchase]);
        triggerPurchaseNotification(newPurchObj).catch(err => console.warn('Purchase notification failed:', err));
        setToast({ message: 'تم تسجيل فاتورة المشتريات كلاسيك وحفظها بنجاح!', type: 'success' });

        // Automated WhatsApp Reorder Alert for Suppliers on Low-Stock Items
        const hasLowStockItem = cartItems.some(item => {
          const prod = products.find(p => p.id === item.productId);
          if (prod) {
            const threshold = prod.lowStockThreshold ?? 5;
            return (prod.quantity ?? 0) <= threshold;
          }
          return false;
        });

        const supplierObj = suppliers.find(sup => sup.id === selectedSupplierId);
        if (hasLowStockItem && supplierObj && supplierObj.phone) {
          const businessName = localStorage.getItem('businessName') || 'مركز المبيعات';
          let msg = `السلام عليكم ورحمة الله وبركاته،\n`;
          msg += `أمر توريد نواقص معتمد من *${businessName}*:\n`;
          msg += `--------------------------------\n`;
          msg += `📦 *رقم الفاتورة:* ${purchaseData.invoiceNumber || savedId}\n`;
          msg += `📅 *التاريخ:* ${new Date().toLocaleDateString('ar-EG')}\n`;
          msg += `--------------------------------\n`;
          msg += `📋 *الأصناف المطلوبة للتوريد:*\n`;
          
          cartItems.forEach((item, idx) => {
            msg += `🔹 *${idx + 1}. ${item.productName}* - الكمية المطلوبة: *${item.quantity}* (سعر: ${item.cost} ج.م)\n`;
          });
          
          msg += `--------------------------------\n`;
          msg += `💰 *إجمالي التوريد:* *${finalTotal.toLocaleString()} ج.م*\n`;
          msg += `💳 *طريقة السداد المتوقعة:* ${paymentMethod === 'cash' ? 'نقداً (كاش)' : paymentMethod === 'deferred-full' ? 'آجل كلي' : 'آجل جزئي'}\n\n`;
          msg += `يرجى مراجعة وتجهيز الطلبية وتأكيد موعد التوصيل. شكراً لكم! 🙏`;

          let phoneCleaned = supplierObj.phone.replace(/[^0-9]/g, '');
          if (phoneCleaned.startsWith('01') && phoneCleaned.length === 11) {
            phoneCleaned = '2' + phoneCleaned;
          } else if (phoneCleaned.startsWith('05') && phoneCleaned.length === 10) {
            phoneCleaned = '966' + phoneCleaned.substring(1);
          }
          
          const waUrl = `https://wa.me/${phoneCleaned}?text=${encodeURIComponent(msg)}`;
          setTimeout(() => {
            window.open(waUrl, '_blank');
          }, 1500);
        }
      }
      playSuccessSound();
      
      // Reset State
      setSelectedSupplierId('');
      setSelectedSupplierName('');
      setCartItems([]);
      setPaymentMethod('cash');
      setPaidAmount('');
      setInvoiceNotes('');
      setVatPercentage('0');
      setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
    } catch (err: any) {
      console.error('Error saving purchase:', err.code, err.message);
      playWarningSound();
      setToast({ message: `فشل الحفظ: ${err.message}`, type: 'warning' });
    }
  };

  const startEdit = (p: Purchase) => {
    if (!isAdmin) {
      playWarningSound();
      setToast({ message: 'عذراً: تعديل المعاملات متاح للمدير العام فقط!', type: 'warning' });
      return;
    }
    setEditingId(p.id);
    setSelectedSupplierId(p.supplierId || '');
    setSelectedSupplierName(p.supplierName);
    setPaymentMethod(p.paymentMethod as any);
    setPaidAmount(p.paidAmount?.toString() || '');
    setInvoiceNotes(p.notes || '');
    setInvoiceNumber(p.invoiceNumber || p.id);
    
    // Map items
    const mapped: InvoiceItem[] = (p.items || []).map(item => {
      const prod = products.find(pr => pr.id === item.productId);
      return {
        productId: item.productId,
        productName: item.productName || prod?.name || 'صنف',
        sku: item.barcode || prod?.sku || '',
        unit: item.unit || 'علبة',
        cost: item.cost,
        sellingPrice: prod?.price || 0,
        quantity: item.quantity,
        notes: item.notes || '',
        total: item.quantity * item.cost
      };
    });
    setCartItems(mapped);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      playWarningSound();
      setToast({ message: 'عذراً: حذف المعاملات متاح للمدير العام فقط!', type: 'warning' });
      return;
    }
    try {
      await deletePurchase(id);
      setPurchases(purchases.filter(p => p.id !== id));
      playSuccessSound();
      setToast({ message: 'تم حذف معاملة الشراء بنجاح (صلاحية أدمن)', type: 'success' });
    } catch (err: any) {
      playWarningSound();
      setToast({ message: `فشل الحذف: ${err.message}`, type: 'warning' });
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const getMethodText = (method: string) => {
    switch(method) {
      case 'cash': return 'كاش (نقدي)';
      case 'deferred-full': return 'آجل كلي';
      case 'deferred-partial': return 'آجل جزئي';
      default: return method;
    }
  };

  return (
    <div className="p-4 sm:p-5 pb-28 max-w-5xl mx-auto space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-text-main flex items-center gap-2">
            <span>📥</span>
            <span>فاتورة مشتريات كلاسيكية (جملة متعدد الأصناف)</span>
          </h2>
          <p className="text-xs text-text-dim mt-1">
            {isAdmin 
              ? '🛡️ أنت مسجل كمدير عام: يمكنك إدخال وتعديل وحذف فواتير المشتريات وتحديث المخزون ومستحقات الموردين.' 
              : '🔒 صلاحية موظف: تسجيل فواتير جديدة ومشاهدة السجل (التعديل والحذف مغلق للصيانة وإدارات الرقابة).'}
          </p>
        </div>
        {hasUnsavedData && (
          <span 
            className="text-xs bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-full border border-amber-500/30 animate-pulse font-bold"
            title="يوجد بيانات مدخلة حالياً في الفاتورة ولم يتم حفظها رسمياً بعد"
          >
            ⚠️ مسودة غير محفوظة
          </span>
        )}
      </div>

      {/* Low-Stock Reorder Alerts Panel */}
      {(() => {
        const reorderProducts = products.filter(p => (p.quantity ?? 0) <= (p.lowStockThreshold ?? 5));
        if (reorderProducts.length === 0) return null;
        
        return (
          <div className="bg-gradient-to-br from-amber-950/25 via-amber-900/10 to-card border border-amber-500/20 p-5 rounded-3xl shadow-sm space-y-3">
            <div className="flex justify-between items-center border-b border-amber-500/10 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg animate-pulse">⚠️</span>
                <div>
                  <h3 className="text-sm font-black text-amber-400">تنبيه نواقص المخزون (وصلت لحد الطلب)</h3>
                  <p className="text-[10px] text-text-dim">الأصناف المذكورة أدناه وصلت أو انخفضت عن حد الطلب الآمن.</p>
                </div>
              </div>
              <span className="text-xs bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full border border-amber-500/20 font-mono">
                {reorderProducts.length} أصناف تحتاج توريد
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {reorderProducts.map(prod => {
                const threshold = prod.lowStockThreshold ?? 5;
                const targetQty = threshold * 2;
                const suggestedQty = Math.max(1, targetQty - Math.max(0, prod.quantity || 0));
                
                return (
                  <div key={prod.id} className="bg-card2 border border-border hover:border-amber-500/30 transition-all p-3 rounded-2xl flex flex-col justify-between gap-3 text-xs">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <strong className="text-text-main font-bold truncate block flex-1">{prod.name}</strong>
                        <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-md font-mono border border-amber-500/25">
                          حد الطلب: {threshold}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] text-text-dim">
                        <div>
                          <span>المخزون الحالي:</span>
                          <span className="block font-black text-danger font-mono mt-0.5">{prod.quantity ?? 0} {prod.unit || 'علبة'}</span>
                        </div>
                        <div>
                          <span>الكمية المقترحة:</span>
                          <span className="block font-black text-emerald-400 font-mono mt-0.5">+{suggestedQty} {prod.unit || 'علبة'}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleConvertLowStockToOrder(prod)}
                      className="w-full py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white border border-amber-500/20 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 text-[11px]"
                    >
                      <span>📥</span>
                      <span>تحويل لأمر توريد (+{suggestedQty})</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Main Billing Form */}
      <div className="bg-card p-5 sm:p-6 rounded-3xl border border-border space-y-5 shadow-lg relative">
        {editingId && (
          <div className="flex justify-between items-center bg-gold/10 border border-gold/30 p-3 rounded-2xl text-xs text-gold font-bold">
            <span>🔄 جاري تعديل فاتورة المشتريات رقم: {editingId}</span>
            <button
              onClick={() => {
                setEditingId(null);
                setSelectedSupplierId('');
                setSelectedSupplierName('');
                setCartItems([]);
                setPaymentMethod('cash');
                setPaidAmount('');
                setInvoiceNotes('');
                setInvoiceNumber(`INV-${Date.now().toString().slice(-6)}`);
              }}
              className="text-text-dim hover:text-white underline text-[11px]"
              title="إلغاء وضع التعديل والعودة لتسجيل فاتورة جديدة"
            >
              إلغاء التعديل
            </button>
          </div>
        )}

        {/* Supplier & Invoice metadata */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Supplier Name */}
          <div className="space-y-1.5">
            <label className="text-xs text-text-dim block font-black flex items-center gap-1">
              <span>🚚</span> اسم المورد: *
            </label>
            <div className="flex gap-2">
              <select 
                className="bg-card2 border border-border p-3 rounded-2xl w-full focus:outline-none focus:border-gold font-bold text-sm" 
                value={selectedSupplierId} 
                onChange={handleSupplierChange}
                title="اختر المورد المسجل بالفاتورة لمتابعة حساب الآجل والذمم المالية"
              >
                <option value="">-- اختر المورد المسجل --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.phone ? `(${s.phone})` : ''}</option>
                ))}
              </select>
              <button 
                type="button" 
                onClick={() => setShowAddSupplierModal(true)} 
                className="bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 p-3 px-4 rounded-2xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center"
                title="إضافة مورد مالي جديد للمنظومة فوراً"
              >
                ➕
              </button>
            </div>
            <span className="text-[10px] text-text-dim block">اختر اسم المورد أو اضغط ➕ لإضافته سريعاً</span>
          </div>

          {/* Invoice Number */}
          <div className="space-y-1.5">
            <label className="text-xs text-text-dim block font-black">رقم الفاتورة الورقية / المرجع:</label>
            <input 
              type="text" 
              inputMode="text"
              placeholder="مثال: Bill-9921"
              className="bg-card2 border border-border p-3 rounded-2xl w-full focus:outline-none focus:border-gold font-bold text-sm font-mono text-left" 
              value={invoiceNumber} 
              onChange={e => setInvoiceNumber(e.target.value)} 
              title="رقم فاتورة الشراء المكتوب على الإيصال الورقي الوارد من المورد"
            />
            <span className="text-[10px] text-text-dim block">رقم الإيصال أو كود التتبع للرجوع إليه بالتدقيق</span>
          </div>

          {/* Product Search (Barcode or Name) */}
          <div className="space-y-1.5 relative" ref={searchContainerRef}>
            <label className="text-xs text-text-dim block font-black flex items-center gap-1">
              <span>🔍</span> ابحث بالاسم أو الباركود لإضافة صنف:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  inputMode="text"
                  placeholder="اكتب اسم الصنف أو امسح بالباركود..." 
                  className="bg-card2 border border-border p-3 pr-8 rounded-2xl w-full focus:outline-none focus:border-gold font-bold text-sm" 
                  value={productSearch} 
                  onChange={e => {
                    setProductSearch(e.target.value);
                    setIsSearchFocused(true);
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  onKeyDown={handleSearchKeyDown}
                  title="اكتب حروفاً من اسم الصنف أو امسح الباركود بجهاز الليزر وسينزل فوراً بالجدول"
                />
                {productSearch && (
                  <button 
                    onClick={() => setProductSearch('')}
                    className="absolute left-3 top-3 text-text-dim hover:text-white text-xs"
                    type="button"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddProductModal(true)} 
                className="bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 p-3 px-4 rounded-2xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center"
                title="تسجيل صنف/منتج جديد غير متواجد بالمخازن مسبقاً"
              >
                📦 + صنف
              </button>
            </div>
            <span className="text-[10px] text-text-dim block">اضغط Enter بعد البحث لتنزيله بالجدول</span>

            {/* Live Search Results Drops */}
            {isSearchFocused && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-border">
                {searchResults.map(prod => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => handleAddProductToCart(prod)}
                    className="w-full text-right p-3 hover:bg-gold/10 flex justify-between items-center transition-colors"
                  >
                    <div>
                      <div className="font-bold text-xs text-text-main">{prod.name}</div>
                      <div className="text-[10px] text-text-dim font-mono">الباركود: {prod.sku || prod.barcode || 'لا يوجد'}</div>
                    </div>
                    <div className="text-[11px] font-mono bg-card2 border border-border px-2.5 py-0.5 rounded-full text-gold font-black">
                      شراء: {prod.cost} ج.م | مخزن: {prod.quantity}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Classical Wholesale Items Grid */}
        <div className="border border-border rounded-2xl overflow-hidden bg-card2">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs divide-y divide-border">
              <thead className="bg-card">
                <tr className="text-text-dim font-bold">
                  <th className="p-3 text-center w-12" title="الترتيب التسلسلي للبند">م</th>
                  <th className="p-3 w-32" title="كود المنتج أو الباركود">كود الصنف</th>
                  <th className="p-3" title="الاسم التعريفي للمنتج">اسم الصنف</th>
                  <th className="p-3 w-28" title="اختر واحدة الصنف المباع بالجملة">الوحدة</th>
                  <th className="p-3 w-28" title="سعر شراء الوحدة الواحدة شامل أي خصومات">السعر (التكلفة) *</th>
                  <th className="p-3 w-28 text-emerald-400" title="سعر البيع المقترح لهذه الوحدة (كرتونة، علبة، قطعة...)">سعر البيع (للوحدة)</th>
                  <th className="p-3 w-24" title="الكمية المراد شراؤها وإدخالها للمستودع">الكمية *</th>
                  <th className="p-3" title="أي ملاحظات تخص هذا البند بالفاتورة">ملاحظات البند</th>
                  <th className="p-3 w-28 text-left" title="الإجمالي = الكمية × السعر">الإجمالي</th>
                  <th className="p-3 w-12 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-bold">
                {cartItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-10 text-center text-text-dim space-y-2">
                      <div className="text-3xl">📦</div>
                      <div className="text-sm font-black">فاتورة الشراء فارغة!</div>
                      <div className="text-xs">ابحث عن الأصناف بالأعلى أو امسح الباركود لإضافتها والبدء في تسجيل التوريد.</div>
                    </td>
                  </tr>
                ) : (
                  cartItems.map((item, idx) => (
                    <tr key={item.productId} className="hover:bg-card/30 transition-colors">
                      <td className="p-3 text-center text-text-dim font-mono">{idx + 1}</td>
                      <td className="p-3 text-text-dim font-mono text-[11px] truncate max-w-[120px]" title={item.sku}>{item.sku}</td>
                      <td className="p-3 text-text-main text-xs font-black">{item.productName}</td>
                      <td className="p-3">
                        <select
                          className="w-full bg-card border border-border rounded-lg p-1 text-xs focus:outline-none focus:border-gold font-bold text-text-main"
                          value={item.unit}
                          onChange={e => updateCartItem(idx, { unit: e.target.value })}
                          title="اختر التعبئة أو الوحدة الخاصة بهذا التوريد"
                        >
                          {DEFAULT_UNITS.map((u, uIdx) => (
                            <option key={uIdx} value={u}>{u}</option>
                          ))}
                          {item.unit && !DEFAULT_UNITS.includes(item.unit) && (
                            <option value={item.unit}>{item.unit}</option>
                          )}
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          inputMode="decimal"
                          className="w-full bg-card border border-border rounded-lg p-1 text-xs font-mono font-bold text-center focus:outline-none focus:border-gold"
                          value={item.cost === 0 ? '' : item.cost}
                          onChange={e => updateCartItem(idx, { cost: parseFloat(e.target.value) || 0 })}
                          placeholder="0.0"
                          title="سعر الشراء الفعلي للوحدة من هذا المورد"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          inputMode="decimal"
                          className="w-full bg-card border border-emerald-500/40 rounded-lg p-1 text-xs font-mono font-bold text-center focus:outline-none focus:border-emerald-500 text-emerald-400"
                          value={item.sellingPrice === 0 ? '' : item.sellingPrice}
                          onChange={e => updateCartItem(idx, { sellingPrice: parseFloat(e.target.value) || 0 })}
                          placeholder="0.0"
                          title="سعر البيع لهذه الوحدة (كرتونة، علبة، قطعة...)"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          inputMode="decimal"
                          className="w-full bg-card border border-border rounded-lg p-1 text-xs font-mono font-bold text-center focus:outline-none focus:border-gold text-gold"
                          value={item.quantity === 0 ? '' : item.quantity}
                          onChange={e => updateCartItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                          placeholder="1"
                          title="الكمية الواردة للمستودع"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          inputMode="text"
                          className="w-full bg-card border border-border rounded-lg p-1 text-xs focus:outline-none focus:border-gold text-text-main font-normal"
                          value={item.notes}
                          onChange={e => updateCartItem(idx, { notes: e.target.value })}
                          placeholder="ملاحظة للبند..."
                          title="سجل هنا أي تفاصيل كالرقم التشغيلي أو حالة التوريد للبند"
                        />
                      </td>
                      <td className="p-3 text-left font-mono text-text-main text-xs">{item.total.toLocaleString('ar-EG')} ج.م</td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeCartItem(idx)}
                          className="text-danger hover:bg-danger/20 p-1 px-2 rounded-lg transition-colors"
                          title="حذف هذا الصنف من الفاتورة الحالية"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payment Summary Calculations & Metadata */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Notes and overall parameters */}
          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="text-text-dim font-bold block">ملاحظات الفاتورة العامة:</label>
              <textarea
                className="w-full bg-card2 border border-border p-3 rounded-2xl h-24 focus:outline-none focus:border-gold text-text-main"
                placeholder="اكتب هنا أي شروط للدفع أو تواريخ تسليم أو تفاصيل الشحن والتخزين..."
                value={invoiceNotes}
                onChange={e => setInvoiceNotes(e.target.value)}
                title="ملاحظات تظهر في سجلات الحسابات المراجعة لهذه الفاتورة"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-text-dim font-bold block mb-1">نسبة ضريبة القيمة المضافة (%):</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-mono focus:outline-none focus:border-gold font-bold text-center"
                  value={vatPercentage}
                  onChange={e => setVatPercentage(e.target.value)}
                  placeholder="14"
                  title="النسبة المئوية لضريبة القيمة المضافة المعتمدة محلياً (مثال: 14% لجمهورية مصر العربية)"
                />
              </div>
              <div>
                <label className="text-text-dim font-bold block mb-1">طريقة سداد الفاتورة:</label>
                <select
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl focus:outline-none focus:border-gold font-bold"
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as any)}
                  title="حدد كيف تم تسوية الفاتورة مالياً مع المورد"
                >
                  <option value="cash">كاش (سداد فوري كامل)</option>
                  <option value="deferred-full">آجل كامل (ذمم دائنة)</option>
                  <option value="deferred-partial">آجل جزئي (مدفوع مقدم ومتبقي آجل)</option>
                </select>
              </div>
            </div>

            {paymentMethod === 'deferred-partial' && (
              <div className="animate-slideDown space-y-1">
                <label className="text-gold font-bold block">المبلغ المدفوع حالياً للمورد (ج.م): *</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-full bg-card2 border border-gold/40 p-2.5 rounded-xl font-mono focus:outline-none focus:border-gold font-bold text-center text-gold"
                  value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                  placeholder="اكتب المبلغ المدفوع كاش..."
                  title="اكتب القيمة النقدية التي تم دفعها للمورد تحت الحساب"
                />
              </div>
            )}
          </div>

          {/* Mathematical Totals & Save Button */}
          <div className="bg-card2 p-4 rounded-3xl border border-border space-y-3.5 text-xs">
            <div className="flex justify-between items-center font-bold">
              <span className="text-text-dim">إجمالي الأصناف الأساسي:</span>
              <span className="font-mono text-sm text-text-main">{subtotal.toLocaleString('ar-EG')} ج.م</span>
            </div>
            
            <div className="flex justify-between items-center font-bold">
              <span className="text-text-dim flex items-center gap-1">
                <span>🧾</span> ضريبة القيمة المضافة ({vatPercentage}%):
              </span>
              <span className="font-mono text-sm text-text-main">{vatAmount.toLocaleString('ar-EG')} ج.م</span>
            </div>

            <hr className="border-border/60" />

            <div className="flex justify-between items-center font-black text-sm">
              <span className="text-text-main">الإجمالي النهائي للفاتورة:</span>
              <span className="font-mono text-lg text-gold">{finalTotal.toLocaleString('ar-EG')} ج.م</span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-bold">
              <div className="bg-card p-2.5 rounded-2xl border border-border text-center">
                <div className="text-text-dim">المبلغ المدفوع (نقداً)</div>
                <div className="text-emerald-400 font-mono text-sm mt-0.5">{paidVal.toLocaleString('ar-EG')} ج.م</div>
              </div>
              <div className="bg-card p-2.5 rounded-2xl border border-border text-center">
                <div className="text-text-dim">الآجل المتبقي للمورد</div>
                <div className="text-red-400 font-mono text-sm mt-0.5">{deferredVal.toLocaleString('ar-EG')} ج.m</div>
              </div>
            </div>

            <button 
              onClick={handleSavePurchase} 
              className="w-full bg-gold hover:bg-gold2 text-black p-3.5 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
              title="تثبيت الفاتورة وتوريد الأصناف للمخازن وتعديل الأرصدة فوراً"
            >
              <span>💾</span>
              <span>{editingId ? 'تعديل وحفظ التغييرات الفاتورة' : 'حفظ الفاتورة وترحيلها للحسابات'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Purchase logs / database list */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <span>⏱️</span>
          <span>سجل فواتير المشتريات المودعة ({purchases.length})</span>
        </h2>
        <button
          type="button"
          onClick={() => setShowPurchasesColModal(true)}
          className="bg-card hover:bg-card2 border border-border px-3.5 py-2 rounded-xl text-xs font-bold text-text-main flex items-center gap-1.5 transition-all"
        >
          <span>⚙️ تخصيص الأعمدة</span>
        </button>
      </div>

      {showPurchasesColModal && (
        <ColumnManagerModal
          tableName="purchases"
          allColumns={PURCHASES_COLUMNS}
          defaultVisibleKeys={PURCHASES_DEFAULT_VISIBLE}
          currentVisibleKeys={purchasesVisibleKeys}
          currentOrderedKeys={purchasesOrderedKeys}
          onSave={(vis, ord) => {
            setPurchasesVisibleKeys(vis);
            setPurchasesOrderedKeys(ord);
          }}
          onClose={() => setShowPurchasesColModal(false)}
        />
      )}

      <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-card2 text-text-dim border-b border-border font-bold">
              <tr>
                {purchasesOrderedKeys.map(colKey => {
                  if (!purchasesVisibleKeys.includes(colKey)) return null;
                  const colDef = PURCHASES_COLUMNS.find(c => c.key === colKey);
                  return <th key={colKey} className="p-3.5">{colDef?.label}</th>;
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {purchases.map((p, idx) => {
                const itemsCount = p.items?.length || 0;
                const rem = p.total - (p.paidAmount || 0);

                return (
                  <tr key={p.id || idx} className="hover:bg-card2/50 transition-colors">
                    {purchasesOrderedKeys.map(colKey => {
                      if (!purchasesVisibleKeys.includes(colKey)) return null;
                      switch (colKey) {
                        case 'purchaseNumber':
                          return (
                            <td key={colKey} className="p-3.5 font-mono font-bold text-text-main">
                              #{p.id.slice(0, 8)}
                            </td>
                          );
                        case 'invoiceNumber':
                          return (
                            <td key={colKey} className="p-3.5 font-mono text-text-main">
                              {p.invoiceNumber || '-'}
                            </td>
                          );
                        case 'date':
                          return (
                            <td key={colKey} className="p-3.5 text-text-dim font-mono">
                              {p.date ? new Date(p.date).toLocaleString('ar-EG') : 'غير محدد'}
                            </td>
                          );
                        case 'supplier':
                          return (
                            <td key={colKey} className="p-3.5 font-bold text-text-main">
                              {p.supplierName || 'مورد عام'}
                            </td>
                          );
                        case 'cashier':
                          return (
                            <td key={colKey} className="p-3.5 text-text-dim">
                              {(p as any).createdBy || 'المدير'}
                            </td>
                          );
                        case 'paymentMethod':
                          return (
                            <td key={colKey} className="p-3.5">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.paymentMethod === 'cash' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                              }`}>
                                {getMethodText(p.paymentMethod)}
                              </span>
                            </td>
                          );
                        case 'itemCount':
                          return (
                            <td key={colKey} className="p-3.5 text-text-main font-bold">
                              {itemsCount} أصناف
                            </td>
                          );
                        case 'total':
                          return (
                            <td key={colKey} className="p-3.5 font-black text-gold">
                              {p.total.toLocaleString('ar-EG')} ج.م
                            </td>
                          );
                        case 'discount':
                          return (
                            <td key={colKey} className="p-3.5 font-bold text-red-400">
                              {((p as any).discount || 0).toLocaleString('ar-EG')} ج.م
                            </td>
                          );
                        case 'tax':
                          return (
                            <td key={colKey} className="p-3.5 text-blue-400 font-bold">
                              {((p as any).taxAmount || 0).toLocaleString('ar-EG')} ج.م
                            </td>
                          );
                        case 'finalTotal':
                          return (
                            <td key={colKey} className="p-3.5 font-black text-emerald-400">
                              {(((p as any).finalTotal || p.total || 0)).toLocaleString('ar-EG')} ج.م
                            </td>
                          );
                        case 'paidAmount':
                          return (
                            <td key={colKey} className="p-3.5 font-bold text-emerald-400">
                              {(p.paidAmount || 0).toLocaleString('ar-EG')} ج.م
                            </td>
                          );
                        case 'remaining':
                          return (
                            <td key={colKey} className="p-3.5 font-bold text-danger">
                              {rem > 0 ? `${rem.toLocaleString('ar-EG')} ج.م` : '-'}
                            </td>
                          );
                        case 'status':
                          return (
                            <td key={colKey} className="p-3.5">
                              <span className="bg-card2 px-2 py-0.5 rounded-md text-[10px] font-bold text-text-dim">
                                {rem <= 0 ? 'مسدد' : 'آجل'}
                              </span>
                            </td>
                          );
                        case 'notes':
                          return (
                            <td key={colKey} className="p-3.5 text-text-dim max-w-[150px] truncate" title={p.notes || ''}>
                              {p.notes || '-'}
                            </td>
                          );
                        case 'actions':
                          return (
                            <td key={colKey} className="p-3.5 text-center">
                              {isAdmin ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => startEdit(p)}
                                    className="bg-card2 border border-border hover:border-gold text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all"
                                  >
                                    ✏️ تعديل
                                  </button>
                                  {deleteConfirmId === p.id ? (
                                    <div className="flex items-center gap-1 bg-danger/20 border border-danger p-1 rounded-xl">
                                      <button
                                        onClick={() => handleDelete(p.id)}
                                        className="bg-danger text-white text-[10px] px-2 py-0.5 rounded-md font-bold"
                                      >
                                        تأكيد
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirmId(null)}
                                        className="bg-card2 text-[10px] px-2 py-0.5 rounded-md font-bold text-text-dim"
                                      >
                                        إلغاء
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setDeleteConfirmId(p.id)}
                                      className="bg-danger/10 text-danger border border-danger/30 hover:bg-danger hover:text-white text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all"
                                    >
                                      🗑️ حذف
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-text-dim">🔒</span>
                              )}
                            </td>
                          );
                        default:
                          return null;
                      }
                    })}
                  </tr>
                );
              })}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={purchasesVisibleKeys.length} className="p-8 text-center text-text-dim text-xs">
                    لا توجد فواتير مشتريات مسجلة حالياً
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================
          QUICK ADD SUPPLIER MODAL (إضافة مورد سريع)
          ========================================================= */}
      {showAddSupplierModal && (
        <div className="fixed inset-0 z-[10000] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-card p-6 rounded-3xl w-full max-w-sm border border-border space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-black text-base text-text-main flex items-center gap-2">
                <span className="text-gold text-lg">🚚</span>
                <span>إضافة مورد جديد سريع</span>
              </h3>
              <button onClick={() => setShowAddSupplierModal(false)} className="text-text-dim hover:text-danger">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block text-text-dim font-bold mb-1">اسم المورد *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: شركة النور للتجارة والتوريدات"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-bold focus:outline-none focus:border-gold text-text-main"
                  value={quickSupplierName}
                  onChange={e => setQuickSupplierName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-text-dim font-bold mb-1">رقم الهاتف / الموبايل</label>
                <input
                  type="text"
                  placeholder="مثال: 01012345678"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-mono focus:outline-none focus:border-gold text-text-main"
                  value={quickSupplierPhone}
                  onChange={e => setQuickSupplierPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-text-dim font-bold mb-1">اسم الشركة أو المصنع</label>
                <input
                  type="text"
                  placeholder="مثال: مصنع الهدى للبلاستيك والكرتون"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl focus:outline-none focus:border-gold text-text-main"
                  value={quickSupplierCompany}
                  onChange={e => setQuickSupplierCompany(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-text-dim font-bold mb-1">الرصيد الافتتاحي له (مستحقات سابقة للمورد)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-mono focus:outline-none focus:border-gold text-text-main"
                  value={quickSupplierBalance}
                  onChange={e => setQuickSupplierBalance(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingSupplier}
                  className="flex-1 bg-gold hover:bg-gold2 text-white py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSavingSupplier ? 'جاري الحفظ...' : 'حفظ المورد واختياره'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddSupplierModal(false)}
                  className="bg-card2 border border-border text-text-dim hover:text-white px-3 py-2.5 rounded-xl font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          QUICK ADD PRODUCT MODAL (إضافة صنف سريع)
          ========================================================= */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-[10000] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-card p-6 rounded-3xl w-full max-w-sm border border-border space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-black text-base text-text-main flex items-center gap-2">
                <span className="text-gold text-lg">📦</span>
                <span>إضافة صنف جديد سريع</span>
              </h3>
              <button onClick={() => setShowAddProductModal(false)} className="text-text-dim hover:text-danger">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="space-y-3 text-xs">
              <div>
                <label className="block text-text-dim font-bold mb-1">اسم الصنف / المنتج *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: علبة شاش طبي معقم"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-bold focus:outline-none focus:border-gold text-text-main"
                  value={quickProductName}
                  onChange={e => setQuickProductName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-text-dim font-bold mb-1">باركود الصنف (SKU)</label>
                <input
                  type="text"
                  placeholder="اتركه فارغاً للتوليد التلقائي"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-mono focus:outline-none focus:border-gold text-text-main"
                  value={quickProductSku}
                  onChange={e => setQuickProductSku(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-text-dim font-bold mb-1">سعر الشراء (التكلفة)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    className="w-full bg-card2 border border-border p-2.5 rounded-xl font-mono focus:outline-none focus:border-gold text-text-main"
                    value={quickProductCost}
                    onChange={e => setQuickProductCost(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-text-dim font-bold mb-1">سعر البيع الافتراضي</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="0"
                    className="w-full bg-card2 border border-border p-2.5 rounded-xl font-mono focus:outline-none focus:border-gold text-text-main"
                    value={quickProductPrice}
                    onChange={e => setQuickProductPrice(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-text-dim font-bold mb-1">الالكمية الابتدائية في المخزن</label>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-mono focus:outline-none focus:border-gold text-text-main"
                  value={quickProductQuantity}
                  onChange={e => setQuickProductQuantity(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="flex-1 bg-gold hover:bg-gold2 text-white py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSavingProduct ? 'جاري الحفظ...' : 'حفظ المنتج واختياره'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="bg-card2 border border-border text-text-dim hover:text-white px-3 py-2.5 rounded-xl font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
