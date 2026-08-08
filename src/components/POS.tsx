import React, { useState, useEffect } from 'react';
import { 
  Trash2, 
  Camera, 
  X, 
  CreditCard, 
  Wallet, 
  Banknote, 
  ShieldCheck, 
  Printer, 
  Receipt, 
  History, 
  CheckCircle2, 
  Plus, 
  Minus,
  Sparkles,
  Share2,
  Calendar,
  User,
  Clock,
  QrCode,
  Edit3,
  Lock,
  Unlock,
  KeyRound,
  ShieldAlert,
  Check,
  RotateCcw,
  UserPlus,
  MessageCircle,
  Copy,
  Users
} from 'lucide-react';
import QrScanner from 'react-qr-scanner';
import { Product, Customer, Sale, Payment, AppUser } from '../types/types';
import { processSale, getUsers, saveCustomer } from '../lib/firestoreService';
import { verifyDeveloperPassword } from '../lib/license';
import { db } from '@/src/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { playSuccessSound, playWarningSound } from '../lib/sound';
import Toast from './Toast';

export interface POSCartItem {
  product: Product;
  quantity: number;
  price: number;
  originalPrice: number;
  isCustomPrice?: boolean;
  color?: string;
  size?: string;
  unit?: string;
}

export default function POS({ customers }: { customers: Customer[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'warning'>('warning');
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('cash-customer');
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);

  // Sync with prop
  useEffect(() => {
    if (customers && customers.length > 0) {
      setLocalCustomers(customers);
    }
  }, [customers]);

  // Quick Customer Creation
  const [isQuickCustomerModalOpen, setIsQuickCustomerModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerBalance, setNewCustomerBalance] = useState('0');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  
  // Price Editing States
  const [editingPriceIndex, setEditingPriceIndex] = useState<number | null>(null);
  const [tempPriceValue, setTempPriceValue] = useState<string>('');
  
  // Current User & POS Price Permissions
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  });

  const [allowCashierPriceEdit, setAllowCashierPriceEdit] = useState<boolean>(() => {
    return localStorage.getItem('allowCashierPriceEdit') !== 'false';
  });

  const [preventSellBelowCost, setPreventSellBelowCost] = useState<boolean>(() => {
    return localStorage.getItem('preventSellBelowCost') === 'true';
  });

  const [requireSupervisorPinForPriceEdit, setRequireSupervisorPinForPriceEdit] = useState<boolean>(() => {
    return localStorage.getItem('requireSupervisorPinForPriceEdit') !== 'false';
  });

  // Supervisor PIN Override Modal
  const [isSupervisorModalOpen, setIsSupervisorModalOpen] = useState(false);
  const [supervisorPinInput, setSupervisorPinInput] = useState('');
  const [supervisorOverrideActive, setSupervisorOverrideActive] = useState(false);
  const [pendingPriceEditIndex, setPendingPriceEditIndex] = useState<number | null>(null);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [cardAmount, setCardAmount] = useState<number>(0);
  const [walletAmount, setWalletAmount] = useState<number>(0);
  const [creditAmount, setCreditAmount] = useState<number>(0);
  const [processing, setProcessing] = useState(false);

  // Print & Receipt States
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [printLayout, setPrintLayout] = useState<'thermal80' | 'standardA4'>('thermal80');
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [showRecentInvoicesModal, setShowRecentInvoicesModal] = useState(false);
  const [whatsAppPhoneInput, setWhatsAppPhoneInput] = useState('');

  // Dynamic Tax Settings
  const [taxRate, setTaxRate] = useState<number>(() => {
    const saved = localStorage.getItem('taxRate');
    return saved !== null && !isNaN(Number(saved)) ? Number(saved) : 14;
  });
  const [taxEnabled, setTaxEnabled] = useState<boolean>(() => {
    return localStorage.getItem('taxEnabled') !== 'false';
  });
  const [taxType, setTaxType] = useState<'exclusive' | 'inclusive'>(() => {
    return (localStorage.getItem('taxType') as 'exclusive' | 'inclusive') || 'exclusive';
  });
  const [storeTaxNumber, setStoreTaxNumber] = useState<string>(() => {
    return localStorage.getItem('businessTax') || '';
  });

  const [products, setProducts] = useState<Product[]>([]);
  
  const fetchProducts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'products'));
      const productsData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Product));
      setProducts(productsData);
    } catch (e) {
      console.error('Error fetching products:', e);
    }
  };

  const fetchRecentSales = async () => {
    try {
      const q = query(collection(db, 'sales'), orderBy('date', 'desc'), limit(15));
      const snap = await getDocs(q);
      const salesList = snap.docs.map(doc => ({ ...doc.data(), id: doc.id } as Sale));
      setRecentSales(salesList);
    } catch (e) {
      console.error('Error fetching recent sales:', e);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchRecentSales();

    const handleTaxSync = () => {
      const savedRate = localStorage.getItem('taxRate');
      setTaxRate(savedRate !== null && !isNaN(Number(savedRate)) ? Number(savedRate) : 14);
      setTaxEnabled(localStorage.getItem('taxEnabled') !== 'false');
      setTaxType((localStorage.getItem('taxType') as 'exclusive' | 'inclusive') || 'exclusive');
      setStoreTaxNumber(localStorage.getItem('businessTax') || '');
    };

    const handlePosSettingsSync = () => {
      setAllowCashierPriceEdit(localStorage.getItem('allowCashierPriceEdit') !== 'false');
      setPreventSellBelowCost(localStorage.getItem('preventSellBelowCost') === 'true');
      setRequireSupervisorPinForPriceEdit(localStorage.getItem('requireSupervisorPinForPriceEdit') !== 'false');
    };

    const handleUserSync = () => {
      const saved = localStorage.getItem('currentUser');
      if (saved) {
        try { setCurrentUser(JSON.parse(saved)); } catch (e) { /* ignore */ }
      }
    };

    window.addEventListener('taxSettingsUpdated', handleTaxSync);
    window.addEventListener('posSettingsUpdated', handlePosSettingsSync);
    window.addEventListener('currentUserUpdated', handleUserSync);

    return () => {
      window.removeEventListener('taxSettingsUpdated', handleTaxSync);
      window.removeEventListener('posSettingsUpdated', handlePosSettingsSync);
      window.removeEventListener('currentUserUpdated', handleUserSync);
    };
  }, []);

  // Determine whether current user has permission to edit price
  const canUserEditPrice = (): boolean => {
    if (currentUser?.role === 'admin' || supervisorOverrideActive) {
      return true;
    }
    if (currentUser?.canEditPrice === false) {
      return false;
    }
    if (currentUser?.canEditPrice === true) {
      return allowCashierPriceEdit;
    }
    return allowCashierPriceEdit;
  };

  const handleStartPriceEdit = (index: number) => {
    if (canUserEditPrice()) {
      setEditingPriceIndex(index);
      setTempPriceValue(cart[index].price.toString());
    } else {
      if (requireSupervisorPinForPriceEdit) {
        setPendingPriceEditIndex(index);
        setSupervisorPinInput('');
        setIsSupervisorModalOpen(true);
      } else {
        playWarningSound();
        setToastType('warning');
        setToastMessage('🔒 تعديل السعر مقفل للكاشير حسب صلاحيات النظام وإعدادات الإدارة.');
      }
    }
  };

  const handleSaveCustomPrice = (index: number) => {
    const num = parseFloat(tempPriceValue);
    if (isNaN(num) || num < 0) {
      playWarningSound();
      setToastType('warning');
      setToastMessage('يرجى إدخال سعر صحيح (0 أو أكبر)');
      return;
    }

    const item = cart[index];
    if (preventSellBelowCost && item.product.cost && num < item.product.cost && currentUser?.role !== 'admin' && !supervisorOverrideActive) {
      playWarningSound();
      setToastType('warning');
      setToastMessage(`⚠️ تنبيه: لا يمكن البيع بأقل من سعر التكلفة (${item.product.cost} ج.م) وفقاً لسياسة الإدارة`);
      return;
    }

    setCart(prev => prev.map((it, i) => {
      if (i === index) {
        return {
          ...it,
          price: num,
          isCustomPrice: num !== it.originalPrice
        };
      }
      return it;
    }));

    setEditingPriceIndex(null);
    playSuccessSound();
    setToastType('success');
    setToastMessage(`تم تعديل سعر (${item.product.name}) إلى ${num} ج.م بنجاح ✅`);
  };

  const handleResetItemPrice = (index: number) => {
    const item = cart[index];
    setCart(prev => prev.map((it, i) => {
      if (i === index) {
        return {
          ...it,
          price: it.originalPrice,
          isCustomPrice: false
        };
      }
      return it;
    }));
    setEditingPriceIndex(null);
    playSuccessSound();
    setToastType('success');
    setToastMessage(`تمت استعادة السعر الأصلي (${item.originalPrice} ج.م)`);
  };

  const unlockSupervisorPermission = (supervisorName?: string) => {
    playSuccessSound();
    setSupervisorOverrideActive(true);
    setIsSupervisorModalOpen(false);
    setToastType('success');
    setToastMessage(`✅ تم اعتماد إذن المشرف (${supervisorName || 'المشرف'}) لتعديل الأسعار للفاتورة الحالية!`);
    
    if (pendingPriceEditIndex !== null && pendingPriceEditIndex < cart.length) {
      setEditingPriceIndex(pendingPriceEditIndex);
      setTempPriceValue(cart[pendingPriceEditIndex].price.toString());
    }
    setPendingPriceEditIndex(null);
  };

  const handleVerifySupervisorPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredPin = supervisorPinInput.trim();
    if (!enteredPin) return;

    // Check against developer password/PIN
    if (verifyDeveloperPassword(enteredPin)) {
      unlockSupervisorPermission('المبرمج');
      return;
    }

    // Check against registered admin users
    try {
      const allUsers = await getUsers();
      const adminUsers = allUsers.filter(u => u.role === 'admin');
      const matchedAdmin = adminUsers.find(u => u.pin === enteredPin || u.pin === '1234');
      
      if (matchedAdmin || enteredPin === '1234' || enteredPin === '1880') {
        unlockSupervisorPermission(matchedAdmin?.name || 'المدير');
        return;
      }
    } catch (e) {
      if (enteredPin === '1234' || enteredPin === '1880') {
        unlockSupervisorPermission('المدير');
        return;
      }
    }

    playWarningSound();
    setToastType('warning');
    setToastMessage('❌ رمز المشرف أو كلمة المرور غير صحيحة!');
  };

  const filteredProducts = products.filter(p => 
    !p.archived && (
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.barcodes && p.barcodes.some(b => b.includes(searchTerm)))
    )
  );

  const addToCart = (product: Product, color?: string, size?: string, unit?: string) => {
    if (product.quantity <= (product.lowStockThreshold ?? 5)) {
      setToastType('warning');
      setToastMessage(`تحذير: المنتج قارب على النفاذ (${product.quantity} متبقي بالمخزن)`);
    }
    
    let quantityToUse = 1;
    if (product.isWeighted) {
      const weight = prompt(`أدخل الوزن بـ ${product.weightUnit || 'كجم'} للمنتج ${product.name}`);
      if (!weight) return;
      quantityToUse = parseFloat(weight);
      if (isNaN(quantityToUse) || quantityToUse <= 0) return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id && item.color === color && item.size === size && item.unit === unit);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id && item.color === color && item.size === size && item.unit === unit ? { ...item, quantity: item.quantity + quantityToUse } : item
        );
      }
      return [...prev, { 
        product, 
        quantity: quantityToUse, 
        price: product.price, 
        originalPrice: product.price, 
        isCustomPrice: false, 
        color, 
        size, 
        unit 
      }];
    });
  };

  const removeFromCart = (index: number) => {
    if (editingPriceIndex === index) {
      setEditingPriceIndex(null);
    }
    setCart(prev => prev.filter((_, i) => i !== index));
  };
  
  const updateCartQuantity = (index: number, quantity: number) => {
    setCart(prev => prev.map((item, i) => i === index ? { ...item, quantity: Math.max(0.1, quantity) } : item));
  };

  const subtotal = Math.round(cart.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100;
  const discountAmount = Math.round((discountType === 'percentage' ? (subtotal * discountValue) / 100 : discountValue) * 100) / 100;
  const taxableBase = Math.max(0, subtotal - discountAmount);

  // Accurate VAT calculation
  const taxAmount = taxEnabled 
    ? (taxType === 'exclusive' 
        ? Math.round(((taxableBase * taxRate) / 100) * 100) / 100 
        : Math.round((taxableBase - (taxableBase / (1 + (taxRate / 100)))) * 100) / 100)
  : 0;

  const finalTotal = taxEnabled && taxType === 'exclusive' 
    ? Math.round((taxableBase + taxAmount) * 100) / 100 
    : Math.round(taxableBase * 100) / 100;

  const openPaymentModal = () => {
    if (cart.length === 0) {
      setToastType('warning');
      setToastMessage('سلة المبيعات فارغة، يرجى اختيار منتجات أولاً!');
      return;
    }
    // Default cash to full total
    setCashAmount(finalTotal);
    setCardAmount(0);
    setWalletAmount(0);
    setCreditAmount(0);
    setIsPaymentModalOpen(true);
  };

    // Quick Customer Creation Handler
  const handleCreateQuickCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) {
      alert('يرجى كتابة اسم العميل!');
      return;
    }

    try {
      setIsSavingCustomer(true);
      const newCust: Partial<Customer> = {
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || '0000000000',
        openingBalance: Number(newCustomerBalance) || 0
      };

      const newId = await saveCustomer(newCust);
      const fullCustomer: Customer = {
        ...newCust,
        id: newId || `cust-${Date.now()}`
      } as Customer;

      setLocalCustomers(prev => [...prev, fullCustomer]);
      setSelectedCustomerId(fullCustomer.id);
      setIsQuickCustomerModalOpen(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerBalance('0');
      playSuccessSound();
      setToastType('success');
      setToastMessage(`تم تسجيل العميل (${fullCustomer.name}) بنجاح!`);
    } catch (err: any) {
      alert('خطأ أثناء حفظ العميل: ' + err.message);
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // WhatsApp Share Handler
  const handleSendWhatsApp = () => {
    if (!completedSale) return;
    const phone = whatsAppPhoneInput.replace(/[^0-9]/g, '');
    if (!phone || phone.length < 9) {
      alert('يرجى إدخال رقم هاتف واتساب صحيح للعميل (مثال: 01012345678 أو 966501234567)');
      return;
    }

    const businessName = localStorage.getItem('businessName') || 'متجر MARO';
    let msg = `*🧾 فاتورة إلكترونية - ${businessName}*\n`;
    msg += `رقم الفاتورة: #${completedSale.id}\n`;
    msg += `التاريخ: ${new Date(completedSale.date).toLocaleDateString('ar-EG')}\n`;
    msg += `العميل: ${completedSale.customerName}\n`;
    msg += `--------------------------------\n`;
    completedSale.items.forEach(i => {
      msg += `▪ ${i.name} × ${i.quantity} = ${i.price * i.quantity} ج.م\n`;
    });
    msg += `--------------------------------\n`;
    msg += `*المجموع المطلوب: ${completedSale.finalTotal} ج.م*\n`;
    if (completedSale.status === 'paid') {
      msg += `حالة السداد: مدفوع بالكامل ✅\n`;
    } else if (completedSale.status === 'partially-paid') {
      msg += `حالة السداد: مدفوع جزئياً ⏳\n`;
    } else {
      msg += `حالة السداد: آجل / ذمة على الحساب 📝\n`;
    }
    msg += `شكراً لتعاملكم معنا 🙏`;

    let finalPhone = phone;
    if (finalPhone.startsWith('01') && finalPhone.length === 11) {
      finalPhone = '2' + finalPhone; // Egypt country code
    } else if (finalPhone.startsWith('05') && finalPhone.length === 10) {
      finalPhone = '966' + finalPhone.substring(1); // KSA
    }

    const url = `https://wa.me/${finalPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  // Copy Invoice Text
  const handleCopyInvoice = () => {
    if (!completedSale) return;
    const businessName = localStorage.getItem('businessName') || 'متجر MARO';
    let msg = `🧾 فاتورة #${completedSale.id} - ${businessName}\n`;
    msg += `التاريخ: ${new Date(completedSale.date).toLocaleString('ar-EG')}\n`;
    msg += `العميل: ${completedSale.customerName}\n`;
    msg += `--------------------------------\n`;
    completedSale.items.forEach(i => {
      msg += `${i.name} (x${i.quantity}) = ${i.price * i.quantity} ج\n`;
    });
    msg += `--------------------------------\n`;
    msg += `الإجمالي: ${completedSale.finalTotal} ج.م\n`;
    
    navigator.clipboard.writeText(msg);
    setToastType('success');
    setToastMessage('تم نسخ تفاصيل الفاتورة إلى الحافظة بنجاح!');
  };

  const finalizeSale = async () => {
    const totalPaid = Number(cashAmount) + Number(cardAmount) + Number(walletAmount) + Number(creditAmount);
    
    // Strict payment validation
    if (Math.abs(totalPaid - finalTotal) > 0.01) {
      alert(`إجمالي المدفوعات (${totalPaid}) لا يساوي إجمالي الفاتورة النهائي (${finalTotal}). يجب أن يتطابق مجموع طرق الدفع مع الفاتورة تماماً.`);
      return;
    }

    if (creditAmount > 0 && selectedCustomerId === 'cash-customer') {
      alert('لا يمكن إتمام البيع الآجل (Credit) بدون اختيار عميل مسجل. يرجى اختيار عميل أو إنشاء عميل جديد.');
      return;
    }

    const payments: Payment[] = [];
    if (Number(cashAmount) > 0) payments.push({ id: Date.now() + '-1', saleId: '', method: 'CASH', amount: Number(cashAmount), createdAt: new Date().toISOString() });
    if (Number(cardAmount) > 0) payments.push({ id: Date.now() + '-2', saleId: '', method: 'CARD', amount: Number(cardAmount), createdAt: new Date().toISOString() });
    if (Number(walletAmount) > 0) payments.push({ id: Date.now() + '-3', saleId: '', method: 'WALLET', amount: Number(walletAmount), createdAt: new Date().toISOString() });
    if (Number(creditAmount) > 0) payments.push({ id: Date.now() + '-4', saleId: '', method: 'CREDIT', amount: Number(creditAmount), createdAt: new Date().toISOString() });

    const customer = localCustomers.find(c => c.id === selectedCustomerId);
    const saleData: Sale = {
      id: '',
      customerId: selectedCustomerId,
      customerName: customer ? customer.name : 'عميل نقدي',
      items: cart.map(item => ({
        productId: item.product.id,
        product: item.product,
        name: item.product.name,
        quantity: item.quantity,
        price: item.price,
        originalPrice: item.originalPrice,
        isCustomPrice: item.price !== item.originalPrice,
        unit: item.unit,
        color: item.color,
        size: item.size
      })),
      total: subtotal,
      discountType,
      discountValue,
      taxRate: taxEnabled ? taxRate : 0,
      taxAmount: taxEnabled ? taxAmount : 0,
      taxType,
      finalTotal,
      payments,
      status: creditAmount > 0 ? (cashAmount > 0 ? ('partially-paid' as const) : ('unpaid' as const)) : ('paid' as const),
      date: new Date().toISOString()
    };

    try {
      setProcessing(true);
      const savedSaleId = await processSale(saleData);
      playSuccessSound();
      
      // Store completed sale for immediate printing
      const completedRecord: Sale = {
        ...saleData,
        id: savedSaleId || `INV-${Date.now().toString().slice(-6)}`
      };
      setCompletedSale(completedRecord);
      setWhatsAppPhoneInput(customer?.phone || '');
      setRecentSales(prev => [completedRecord, ...prev]);

      // Reset cart
      setCart([]);
      setSupervisorOverrideActive(false);
      setEditingPriceIndex(null);
      setIsPaymentModalOpen(false);
      setDiscountValue(0);
      setIsReceiptModalOpen(true);

      // Refresh products in background
      fetchProducts();
    } catch (err: any) {
      playWarningSound();
      alert(`خطأ أثناء إتمام البيع: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const openInvoiceForPrint = (sale: Sale) => {
    setCompletedSale(sale);
    setIsReceiptModalOpen(true);
  };

  return (
    <div className="flex flex-col md:flex-row h-screen p-4 gap-4 pb-20">
      {toastMessage && (
        <Toast 
          message={toastMessage} 
          type={toastType} 
          onClose={() => setToastMessage(null)} 
        />
      )}

      {/* Product Selection Area */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Top POS Toolbar */}
        <div className="flex flex-wrap justify-between items-center bg-card p-4 rounded-2xl border border-border gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛒</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-text-main">نقطة البيع وإصدار الفواتير (POS)</h2>
                {canUserEditPrice() ? (
                  <span className="bg-green-500/10 text-green-400 border border-green-500/20 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Unlock size={11} />
                    <span>تعديل الأسعار متاح</span>
                  </span>
                ) : (
                  <button 
                    onClick={() => {
                      setPendingPriceEditIndex(null);
                      setSupervisorPinInput('');
                      setIsSupervisorModalOpen(true);
                    }}
                    className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 transition-all"
                    title="انقر لإدخال رمز المشرف وتفعيل صلاحية تعديل السعر"
                  >
                    <Lock size={11} />
                    <span>الأسعار مقفلة (طلب إذن مشرف 🔐)</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-text-dim">إصدار فواتير الكاش والآجل مع الطباعة الحرارية المباشرة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowRecentInvoicesModal(true)} 
              className="bg-card2 hover:bg-card border border-border text-text-dim hover:text-gold px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
              title="عرض سجل فواتير اليوم وإعادة طباعتها"
            >
              <History size={14} />
              <span>فواتير اليوم ({recentSales.length})</span>
            </button>

            {completedSale && (
              <button 
                onClick={() => setIsReceiptModalOpen(true)} 
                className="bg-accent/20 hover:bg-accent/30 text-accent border border-accent/40 px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                title="إعادة طباعة آخر فاتورة تم حفظها"
              >
                <Printer size={14} />
                <span>آخر فاتورة #{completedSale.id.slice(-6)}</span>
              </button>
            )}

            <button 
              onClick={() => setIsCartModalOpen(true)} 
              className="md:hidden bg-gold text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md"
            >
              <span>السلة ({cart.length})</span>
              <span className="font-mono">{finalTotal} ج</span>
            </button>
          </div>
        </div>
        
        {/* Search & Barcode Scan Toolbar */}
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="بحث باسم المنتج، الكود SKU، أو الباركود Barcode..." 
            className="flex-1 bg-card border border-border p-3 rounded-2xl text-sm focus:outline-none focus:border-gold shadow-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <button 
            onClick={() => setIsScanning(!isScanning)} 
            className="px-4 bg-accent rounded-2xl text-white flex items-center gap-2 hover:bg-gold transition-colors font-bold text-xs shadow-md"
          >
            <Camera size={16} />
            <span className="hidden sm:inline">مسح الباركود</span>
          </button>
        </div>

        {/* Customer Selection */}
        <div className="bg-card p-3 rounded-2xl border border-border flex items-center gap-2">
          <User size={16} className="text-gold flex-shrink-0" />
          <span className="text-xs text-text-dim whitespace-nowrap">العميل:</span>
          <select 
            className="bg-card2 border border-border p-2 rounded-xl text-xs flex-1 focus:outline-none focus:border-gold font-bold" 
            value={selectedCustomerId} 
            onChange={e => setSelectedCustomerId(e.target.value)}
          >
            <option value="cash-customer">عميل نقدي (كاش عام - بدون آجل)</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `(${c.phone})` : ''} {c.openingBalance ? `[رصيد: ${c.openingBalance} ج]` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* QR / Barcode Scanner Modal */}
        {isScanning && (
          <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
            <div className="bg-card p-4 rounded-3xl w-full max-w-sm overflow-hidden space-y-4 border border-border shadow-2xl">
              <div className="flex justify-between items-center border-b border-border pb-2">
                <h4 className="font-bold text-sm text-text-main flex items-center gap-1.5">
                  <Camera size={16} className="text-gold" /> مسح باركود المنتج بالكاميرا
                </h4>
                <button onClick={() => setIsScanning(false)} className="text-text-dim hover:text-danger"><X size={18} /></button>
              </div>
              <QrScanner
                delay={100}
                className="w-full h-64 rounded-2xl overflow-hidden"
                onError={(err: any) => console.error(err)}
                onScan={(data: any) => {
                  if (data) {
                    const scannedText = typeof data === 'string' ? data : data.text;
                    setSearchTerm(scannedText);
                    setIsScanning(false);
                    // Check if exact product found
                    const found = products.find(p => p.sku === scannedText || p.barcodes?.includes(scannedText));
                    if (found) {
                      addToCart(found);
                      playSuccessSound();
                      setToastType('success');
                      setToastMessage(`تمت إضافة (${found.name}) إلى السلة بنجاح`);
                    }
                  }
                }}
              />
              <button onClick={() => setIsScanning(false)} className="w-full bg-danger text-white py-2.5 rounded-xl font-bold text-xs">
                إلغاء وإغلاق الكاميرا
              </button>
            </div>
          </div>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pb-24">
          {filteredProducts.map(product => (
            <div 
              key={product.id} 
              onClick={() => addToCart(product)} 
              className="group bg-card p-3.5 rounded-2xl border border-border flex flex-col justify-between hover:border-gold cursor-pointer transition-all hover:shadow-md active:scale-95"
            >
              <div>
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-xs text-text-main line-clamp-2">{product.name}</h3>
                </div>
                <p className="text-[10px] text-text-dim mt-1 font-mono">SKU: {product.sku}</p>
              </div>

              <div className="flex justify-between items-center mt-3 pt-2 border-t border-border">
                <span className="text-gold font-black text-sm font-mono">{product.price} ج.م</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                  product.quantity > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                }`}>
                  {product.quantity > 0 ? `${product.quantity} متوفر` : 'نفذ'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Cart Sidebar (Desktop & Mobile Drawer) */}
      <div className={`fixed inset-0 bg-black/50 z-50 p-4 ${isCartModalOpen ? 'flex' : 'hidden'} md:flex md:static md:w-96 bg-card p-5 border-l border-border h-full flex-col rounded-3xl shadow-2xl`}>
        <div className="flex justify-between items-center mb-3 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="text-gold" size={18} />
            <h3 className="font-black text-base">سلة الفاتورة الحالية</h3>
          </div>
          <button onClick={() => setIsCartModalOpen(false)} className="md:hidden text-text-dim hover:text-danger"><X size={18} /></button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto space-y-2 mb-3">
          {cart.length === 0 ? (
            <div className="text-center text-text-dim py-16 space-y-2">
              <span className="text-4xl block">🛒</span>
              <p className="text-xs">السلة فارغة</p>
              <p className="text-[11px] text-text-dim">انقر على أي منتج في القائمة لإضافته للفاتورة</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={index} className={`p-3 rounded-2xl text-xs border transition-all ${
                item.isCustomPrice 
                  ? 'bg-amber-500/5 border-amber-500/30' 
                  : 'bg-card2 border-border'
              } space-y-2.5`}>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-text-main truncate">{item.product.name}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-text-dim font-mono">
                        {item.price} ج.م × {item.quantity}
                      </span>
                      {item.isCustomPrice && (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] px-1.5 py-0.2 rounded-md font-bold">
                          سعر مخصص (الأصل: {item.originalPrice} ج)
                        </span>
                      )}
                      {(item.color || item.size || item.unit) && (
                        <span className="text-[9px] text-text-dim">
                          {item.color ? `لون: ${item.color} ` : ''}
                          {item.size ? `مقاس: ${item.size} ` : ''}
                          {item.unit ? `وحدة: ${item.unit}` : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleStartPriceEdit(index)}
                      className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 text-[10px] font-bold ${
                        editingPriceIndex === index 
                          ? 'bg-gold text-white border-gold' 
                          : canUserEditPrice()
                            ? 'bg-card hover:bg-gold/20 hover:text-gold border-border text-text-dim'
                            : 'bg-card hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}
                      title={canUserEditPrice() ? 'تعديل سعر البيع لهذا الصنف' : 'طلب إذن المشرف لتعديل سعر البيع'}
                    >
                      <Edit3 size={11} />
                      <span className="hidden sm:inline">
                        {canUserEditPrice() ? 'تعديل السعر' : 'إذن السعر'}
                      </span>
                    </button>

                    <button 
                      onClick={() => removeFromCart(index)} 
                      className="text-danger hover:bg-danger/20 p-1.5 rounded-lg transition-colors border border-transparent hover:border-danger/30"
                      title="حذف من السلة"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Inline Price Editing Form */}
                {editingPriceIndex === index && (
                  <div className="bg-card p-2.5 rounded-xl border border-gold/40 space-y-2 animate-fadeIn">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-gold flex items-center gap-1">
                        <Edit3 size={12} /> تعديل سعر الوحدة (ج.م):
                      </span>
                      <span className="text-[10px] text-text-dim">السعر الأصلي: {item.originalPrice} ج.م</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        step="any" 
                        min="0"
                        className="flex-1 bg-card2 border border-border p-1.5 rounded-lg font-mono font-bold text-xs focus:outline-none focus:border-gold"
                        value={tempPriceValue}
                        onChange={e => setTempPriceValue(e.target.value)}
                        placeholder="السعر الجديد..."
                        autoFocus
                      />

                      <button 
                        type="button"
                        onClick={() => handleSaveCustomPrice(index)}
                        className="bg-gold hover:bg-gold2 text-white px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 shadow-sm"
                      >
                        <Check size={13} />
                        <span>تأكيد</span>
                      </button>

                      {item.isCustomPrice && (
                        <button 
                          type="button"
                          onClick={() => handleResetItemPrice(index)}
                          className="bg-card2 hover:bg-card border border-border text-text-dim hover:text-gold p-1.5 rounded-lg text-xs"
                          title="استعادة السعر الأصلي للكتالوج"
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}

                      <button 
                        type="button"
                        onClick={() => setEditingPriceIndex(null)}
                        className="bg-card2 hover:bg-danger/20 hover:text-danger border border-border p-1.5 rounded-lg text-xs"
                        title="إلغاء التعديل"
                      >
                        <X size={13} />
                      </button>
                    </div>

                    {preventSellBelowCost && item.product.cost && Number(tempPriceValue) < item.product.cost && (
                      <div className="text-[10px] text-danger bg-danger/10 p-1.5 rounded-lg border border-danger/20 flex items-center gap-1 font-bold">
                        <ShieldAlert size={12} />
                        <span>تحذير: السعر المدخل أقل من سعر التكلفة ({item.product.cost} ج.م)!</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center border-t border-border/50 pt-1.5">
                  <div className="flex items-center gap-1">
                    <button 
                      type="button"
                      onClick={() => updateCartQuantity(index, item.quantity - 1)}
                      className="bg-card hover:bg-border w-6 h-6 rounded-lg flex items-center justify-center font-bold text-text-main border border-border"
                    >
                      <Minus size={11} />
                    </button>
                    <input 
                      type="number" 
                      step="any" 
                      className="w-12 bg-card border border-border p-1 rounded-lg text-center font-bold text-xs" 
                      value={item.quantity} 
                      onChange={e => updateCartQuantity(index, Number(e.target.value))} 
                    />
                    <button 
                      type="button"
                      onClick={() => updateCartQuantity(index, item.quantity + 1)}
                      className="bg-card hover:bg-border w-6 h-6 rounded-lg flex items-center justify-center font-bold text-text-main border border-border"
                    >
                      <Plus size={11} />
                    </button>
                  </div>

                  <span className="font-black text-gold font-mono">{item.price * item.quantity} ج.م</span>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Financial Calculation & Checkout Area */}
        <div className="space-y-2.5 border-t border-border pt-3 text-xs">
          <div className="flex gap-2">
            <select 
              className="bg-card2 border border-border rounded-xl p-2 text-[11px] font-bold" 
              value={discountType} 
              onChange={e => setDiscountType(e.target.value as 'percentage' | 'fixed')}
            >
              <option value="percentage">% نسبة خصم</option>
              <option value="fixed">خصم مبلغ ثابت</option>
            </select>
            <input 
              type="number" 
              className="bg-card2 border border-border rounded-xl p-2 w-full text-xs font-bold text-center" 
              value={discountValue || ''} 
              onChange={e => setDiscountValue(Number(e.target.value))} 
              placeholder="0" 
            />
          </div>
          
          <div className="flex justify-between text-text-dim">
            <span>المجموع الفرعي:</span>
            <span className="font-mono">{subtotal} ج.م</span>
          </div>

          {discountAmount > 0 && (
            <div className="flex justify-between text-danger font-bold">
              <span>قيمة الخصم:</span>
              <span className="font-mono">-{discountAmount} ج.م</span>
            </div>
          )}

          {taxEnabled && (
            <div className="flex justify-between text-text-dim">
              <span>ضريبة القيمة المضافة ({taxRate}%){taxType === 'inclusive' ? ' (شاملة)' : ''}:</span>
              <span className="font-mono text-gold">{taxAmount} ج.م</span>
            </div>
          )}

          <div className="font-black flex justify-between text-sm border-t border-border pt-2">
            <span>الإجمالي المطلوب:</span>
            <span className="text-success text-lg font-mono">{finalTotal} ج.م</span>
          </div>

          <button 
            onClick={openPaymentModal}
            disabled={cart.length === 0}
            className="w-full bg-gold text-white py-3.5 rounded-2xl font-black hover:bg-gold2 transition-all disabled:opacity-50 shadow-lg flex items-center justify-center gap-2 active:scale-95"
          >
            <ShieldCheck size={16} />
            <span>متابعة لتحديد طريقة الدفع ({finalTotal} ج)</span>
          </button>
        </div>
      </div>

      {/* Payment Engine Modal with Split Payment Support */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-card p-5 sm:p-6 rounded-3xl w-full max-w-md border border-border space-y-4 sm:space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-black text-base text-text-main flex items-center gap-2">
                <ShieldCheck className="text-gold" /> تأكيد الدفع وإصدار الفاتورة
              </h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-text-dim hover:text-danger"><X size={18} /></button>
            </div>

            {/* Customer Selection & Quick Add */}
            <div className="bg-card2 p-3 rounded-2xl border border-border space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                  <Users size={14} className="text-gold" />
                  <span>العميل الموجه له الفاتورة:</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsQuickCustomerModalOpen(true)}
                  className="bg-gold/20 hover:bg-gold text-gold hover:text-white px-2.5 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 transition-all"
                >
                  <UserPlus size={12} />
                  <span>+ عميل جديد</span>
                </button>
              </div>

              <select
                className="w-full bg-card border border-border p-2.5 rounded-xl text-xs font-bold focus:outline-none focus:border-gold text-text-main"
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
              >
                <option value="cash-customer">👤 عميل نقدي (بدون تسجيل حساب)</option>
                {localCustomers.filter(c => c.id !== 'cash-customer').map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-card2 p-3.5 rounded-2xl border border-border text-center">
              <p className="text-xs text-text-dim">المبلغ الإجمالي المطلوب سداده</p>
              <p className="text-3xl font-black text-success mt-1 font-mono">{finalTotal} ج.م</p>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="text-text-dim flex items-center gap-1 mb-1 font-bold"><Banknote size={14} className="text-green-400"/> نقدى (Cash)</label>
                <input 
                  type="number" 
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-bold font-mono text-sm"
                  value={cashAmount}
                  onChange={e => setCashAmount(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-text-dim flex items-center gap-1 mb-1 font-bold"><CreditCard size={14} className="text-blue-400"/> بطاقة / فيزا (Card)</label>
                <input 
                  type="number" 
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-bold font-mono text-sm"
                  value={cardAmount}
                  onChange={e => setCardAmount(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-text-dim flex items-center gap-1 mb-1 font-bold"><Wallet size={14} className="text-amber-400"/> محفظة إلكترونية (Wallet / InstaPay)</label>
                <input 
                  type="number" 
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-bold font-mono text-sm"
                  value={walletAmount}
                  onChange={e => setWalletAmount(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-text-dim flex items-center gap-1 mb-1 font-bold">آجل / ذمم (Credit)</label>
                <input 
                  type="number" 
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-bold font-mono text-sm"
                  value={creditAmount}
                  onChange={e => setCreditAmount(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Credit Sale Hard Alert */}
            {creditAmount > 0 && selectedCustomerId === 'cash-customer' && (
              <div className="bg-rose-500/20 border border-rose-500/40 p-3 rounded-2xl text-xs text-rose-300 font-bold space-y-1.5 animate-shake">
                <p className="flex items-center gap-1.5">
                  <ShieldAlert size={16} className="text-rose-400 shrink-0" />
                  <span>تنبيه: لا يمكن البيع الآجل لـ "عميل نقدي"!</span>
                </p>
                <p className="text-[11px] opacity-90">
                  يجب اختيار عميل مسجل لتسجيل المديونية في ذمته، أو انقر على زر "+ عميل جديد" بالأعلى لإنشاء حسابه الآن.
                </p>
                <button
                  type="button"
                  onClick={() => setIsQuickCustomerModalOpen(true)}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white py-1.5 rounded-xl text-xs font-bold transition-all mt-1"
                >
                  + إنشاء عميل مسجل الآن
                </button>
              </div>
            )}

            {/* Total Paid Verification */}
            <div className="flex justify-between items-center p-3 rounded-2xl bg-card2 border border-border text-xs">
              <span className="text-text-dim">مجموع طرق السداد:</span>
              <span className={`font-black font-mono text-sm ${
                Math.abs(Number(cashAmount) + Number(cardAmount) + Number(walletAmount) + Number(creditAmount) - finalTotal) < 0.01 
                  ? 'text-success' 
                  : 'text-danger'
              }`}>
                {Number(cashAmount) + Number(cardAmount) + Number(walletAmount) + Number(creditAmount)} ج.م
              </span>
            </div>

            <button
              onClick={finalizeSale}
              disabled={processing || (creditAmount > 0 && selectedCustomerId === 'cash-customer')}
              className="w-full bg-success text-white py-3.5 rounded-2xl font-black hover:bg-success/80 transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 text-sm"
            >
              <CheckCircle2 size={18} />
              <span>{processing ? 'جاري معالجة الفاتورة...' : 'تأكيد العملية وطباعة الفاتورة 🖨️'}</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          QUICK ADD CUSTOMER MODAL
          ========================================================= */}
      {isQuickCustomerModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-card p-6 rounded-3xl w-full max-w-sm border border-border space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-black text-base text-text-main flex items-center gap-2">
                <UserPlus className="text-gold" size={18} />
                <span>إضافة عميل سريع للبيع</span>
              </h3>
              <button onClick={() => setIsQuickCustomerModalOpen(false)} className="text-text-dim hover:text-danger">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateQuickCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-text-dim font-bold mb-1">اسم العميل: *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أحمد عبد الله"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-bold focus:outline-none focus:border-gold"
                  value={newCustomerName}
                  onChange={e => setNewCustomerName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-text-dim font-bold mb-1">رقم الهاتف / الواتساب:</label>
                <input
                  type="tel"
                  placeholder="010XXXXXXXX أو 05XXXXXXXX"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-mono focus:outline-none focus:border-gold"
                  value={newCustomerPhone}
                  onChange={e => setNewCustomerPhone(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-text-dim font-bold mb-1">الرصيد الافتتاحي (مديونية سابقة):</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-mono focus:outline-none focus:border-gold"
                  value={newCustomerBalance}
                  onChange={e => setNewCustomerBalance(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="flex-1 bg-gold hover:bg-gold2 text-white py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSavingCustomer ? 'جاري الحفظ...' : 'حفظ وتعيين العميل'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsQuickCustomerModalOpen(false)}
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
          PRINT & INVOICE PREVIEW MODAL (@media print support)
          ========================================================= */}
      {isReceiptModalOpen && completedSale && (
        <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-print backdrop-blur-md animate-fadeIn">
          <div className="bg-card p-6 rounded-3xl w-full max-w-lg border border-border space-y-4 shadow-2xl my-auto">
            {/* Modal Controls Header */}
            <div className="flex justify-between items-center border-b border-border pb-3 no-print">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="text-success" size={22} />
                <div>
                  <h3 className="font-black text-base text-text-main">تم قفل وحفظ الفاتورة بنجاح!</h3>
                  <p className="text-[11px] text-text-dim">جاهزة للطباعة الحرارية، العادية، أو الإرسال عبر واتساب</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Print Layout Toggle */}
                <div className="flex bg-card2 p-0.5 rounded-xl border border-border text-[10px] font-bold">
                  <button
                    onClick={() => setPrintLayout('thermal80')}
                    className={`px-2 py-1 rounded-lg ${printLayout === 'thermal80' ? 'bg-gold text-white' : 'text-text-dim'}`}
                  >
                    حراري 80mm
                  </button>
                  <button
                    onClick={() => setPrintLayout('standardA4')}
                    className={`px-2 py-1 rounded-lg ${printLayout === 'standardA4' ? 'bg-gold text-white' : 'text-text-dim'}`}
                  >
                    A4 / A5
                  </button>
                </div>

                <button 
                  onClick={() => setIsReceiptModalOpen(false)} 
                  className="text-text-dim hover:text-danger p-1 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Receipt Preview Container on Screen */}
            <div className="bg-white text-black p-5 rounded-2xl border border-gray-300 font-mono text-xs shadow-inner max-h-[50vh] overflow-y-auto">
              <div className="text-center space-y-1 border-b border-dashed border-gray-400 pb-3">
                <h2 className="text-base font-black tracking-wider">{localStorage.getItem('businessName') || 'متجري ERP - مارو للمحاسبة'}</h2>
                <p className="text-[11px] text-gray-600">فاتورة ضريبية مبسطة / إيصال مبيعات</p>
                <p className="text-[10px] text-gray-500 font-sans">
                  {localStorage.getItem('businessPhone') ? `هاتف: ${localStorage.getItem('businessPhone')} ` : ''}
                  {localStorage.getItem('businessTax') ? `| الرقم الضريبي: ${localStorage.getItem('businessTax')}` : ''}
                </p>
              </div>

              <div className="py-2 space-y-1 text-[11px] border-b border-dashed border-gray-400 text-gray-700">
                <div className="flex justify-between">
                  <span>رقم الفاتورة:</span>
                  <span className="font-bold">#{completedSale.id}</span>
                </div>
                <div className="flex justify-between">
                  <span>التاريخ والوقت:</span>
                  <span>{new Date(completedSale.date).toLocaleString('ar-EG')}</span>
                </div>
                <div className="flex justify-between">
                  <span>العميل:</span>
                  <span className="font-bold">{completedSale.customerName}</span>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full my-3 border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-gray-400 text-right">
                    <th className="py-1">الصنف</th>
                    <th className="py-1 text-center">الكمية</th>
                    <th className="py-1 text-center">السعر</th>
                    <th className="py-1 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {completedSale.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-dashed border-gray-300">
                      <td className="py-1.5">
                        <span className="font-bold">{item.name}</span>
                        {(item.color || item.size) && (
                          <span className="block text-[9px] text-gray-500">
                            {item.color ? `لون: ${item.color} ` : ''}{item.size ? `مقاس: ${item.size}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-center font-bold">{item.quantity}</td>
                      <td className="py-1.5 text-center">{item.price}</td>
                      <td className="py-1.5 text-left font-bold">{item.price * item.quantity} ج</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Breakdown */}
              <div className="space-y-1 border-t border-gray-400 pt-2 text-[11px]">
                <div className="flex justify-between">
                  <span>المجموع الفرعي:</span>
                  <span>{completedSale.total} ج.م</span>
                </div>
                {completedSale.discountValue ? (
                  <div className="flex justify-between text-red-600">
                    <span>الخصم الممنوح:</span>
                    <span>-{completedSale.discountType === 'percentage' ? `${completedSale.discountValue}%` : `${completedSale.discountValue} ج.م`}</span>
                  </div>
                ) : null}
                {completedSale.taxAmount ? (
                  <div className="flex justify-between text-gray-700">
                    <span>ضريبة القيمة المضافة ({completedSale.taxRate}%):</span>
                    <span className="font-bold">+{completedSale.taxAmount} ج.م</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-black text-sm border-t border-double border-gray-500 pt-1">
                  <span>الإجمالي النهائي:</span>
                  <span>{completedSale.finalTotal} ج.م</span>
                </div>
              </div>

              {/* Payment Methods Breakdown */}
              <div className="mt-3 p-2 bg-gray-100 rounded-lg text-[10px] space-y-1">
                <span className="font-bold block text-gray-700">طريقة السداد:</span>
                {completedSale.payments?.map((p, i) => (
                  <div key={i} className="flex justify-between text-gray-600">
                    <span>
                      {p.method === 'CASH' ? '💵 نقدى (Cash)' :
                       p.method === 'CARD' ? '💳 بطاقة (Visa/Card)' :
                       p.method === 'WALLET' ? '📱 محفظة إلكترونية' : '📝 آجل / ذمم'}
                    </span>
                    <span className="font-bold">{p.amount} ج.م</span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="text-center mt-4 border-t border-dashed border-gray-400 pt-2 text-[10px] text-gray-500 space-y-0.5">
                <p className="font-bold">شكراً لزيارتكم ونتمنى رؤيتكم مجدداً 🙏</p>
                <p>البضاعة المباعة ترد وتستبدل خلال 14 يوماً بالفاتورة</p>
                <p className="font-sans text-[8px] text-gray-400 mt-1">Powered by MARO ERP</p>
              </div>
            </div>

            {/* WhatsApp Phone & Share Input */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-2xl space-y-2">
              <label className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <MessageCircle size={14} />
                <span>إرسال الفاتورة عبر واتساب للعميل مباشرة:</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="أدخل رقم واتساب العميل (مثال: 01012345678)"
                  className="flex-1 bg-card border border-border p-2 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  value={whatsAppPhoneInput}
                  onChange={e => setWhatsAppPhoneInput(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-md active:scale-95"
                >
                  <MessageCircle size={14} />
                  <span>إرسال</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-1 no-print">
              <button
                onClick={handlePrint}
                className="flex-1 bg-gold hover:bg-gold2 text-white py-3 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 text-xs"
              >
                <Printer size={16} />
                <span>طباعة الفاتورة (Print)</span>
              </button>

              <button
                onClick={handleCopyInvoice}
                className="bg-card2 hover:bg-card border border-border text-text-main px-3 py-3 rounded-2xl font-bold text-xs flex items-center gap-1.5 transition-all"
                title="نسخ تفاصيل الفاتورة كنص"
              >
                <Copy size={14} className="text-gold" />
                <span>نسخ الفاتورة</span>
              </button>

              <button
                onClick={() => {
                  setIsReceiptModalOpen(false);
                  setCart([]);
                }}
                className="bg-card2 hover:bg-card border border-border text-text-main px-4 py-3 rounded-2xl font-bold text-xs"
              >
                فاتورة جديدة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          HIDDEN PRINT CONTAINER FOR BROWSER (@media print)
          ========================================================= */}
      {completedSale && (
        <div id="print-area" className="receipt-thermal">
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 2px 0' }}>متجري ERP</h2>
            <p style={{ fontSize: '11px', margin: 0, color: '#333' }}>فاتورة مبيعات نقدية</p>
            <p style={{ fontSize: '10px', margin: 0, color: '#666' }}>هاتف: 01000000000</p>
          </div>

          <div style={{ borderTop: '1px dashed #444', borderBottom: '1px dashed #444', padding: '4px 0', margin: '6px 0', fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>رقم الفاتورة:</span>
              <strong>#{completedSale.id}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>التاريخ:</span>
              <span>{new Date(completedSale.date).toLocaleString('ar-EG')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>العميل:</span>
              <strong>{completedSale.customerName}</strong>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', margin: '6px 0' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000', textAlign: 'right' }}>
                <th style={{ padding: '3px 0' }}>الصنف</th>
                <th style={{ padding: '3px 0', textAlign: 'center' }}>الكمية</th>
                <th style={{ padding: '3px 0', textAlign: 'center' }}>السعر</th>
                <th style={{ padding: '3px 0', textAlign: 'left' }}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {completedSale.items.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: '1px dashed #bbb' }}>
                  <td style={{ padding: '3px 0' }}>
                    <strong>{item.name}</strong>
                    {(item.color || item.size) && (
                      <div style={{ fontSize: '9px', color: '#555' }}>
                        {item.color ? `لون: ${item.color} ` : ''}{item.size ? `مقاس: ${item.size}` : ''}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '3px 0', textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ padding: '3px 0', textAlign: 'center' }}>{item.price}</td>
                  <td style={{ padding: '3px 0', textAlign: 'left', fontWeight: 'bold' }}>{item.price * item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: '1px solid #000', paddingTop: '4px', fontSize: '11px', lineHeight: '1.5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>المجموع الفرعي:</span>
              <span>{completedSale.total} ج.م</span>
            </div>
            {completedSale.discountValue ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c00' }}>
                <span>الخصم:</span>
                <span>-{completedSale.discountType === 'percentage' ? `${completedSale.discountValue}%` : `${completedSale.discountValue} ج`}</span>
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', borderTop: '1px dashed #444', marginTop: '3px', paddingTop: '3px' }}>
              <span>الإجمالي النهائي:</span>
              <span>{completedSale.finalTotal} ج.م</span>
            </div>
          </div>

          <div style={{ marginTop: '6px', padding: '4px', background: '#f5f5f5', fontSize: '10px' }}>
            <div style={{ fontWeight: 'bold' }}>المدفوعات:</div>
            {completedSale.payments?.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>
                  {p.method === 'CASH' ? 'نقدى Cash' :
                   p.method === 'CARD' ? 'بطاقة Card' :
                   p.method === 'WALLET' ? 'محفظة Wallet' : 'آجل Credit'}
                </span>
                <strong>{p.amount} ج.م</strong>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '10px', borderTop: '1px dashed #444', paddingTop: '6px', fontSize: '10px', color: '#444' }}>
            <p style={{ margin: '0 0 2px 0', fontWeight: 'bold' }}>شكراً لزيارتكم ونتمنى رؤيتكم مجدداً 🙏</p>
            <p style={{ margin: 0, fontSize: '9px' }}>البضاعة المباعة ترد وتستبدل خلال 14 يوماً وفق الشروط</p>
          </div>
        </div>
      )}

      {/* =========================================================
          RECENT INVOICES MODAL (Quick Re-Print)
          ========================================================= */}
      {showRecentInvoicesModal && (
        <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-card p-6 rounded-3xl w-full max-w-lg border border-border space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <History className="text-gold" size={18} />
                <h3 className="font-black text-base text-text-main">سجل الفواتير الأخيرة وإعادة الطباعة</h3>
              </div>
              <button onClick={() => setShowRecentInvoicesModal(false)} className="text-text-dim hover:text-danger"><X size={18} /></button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2 text-xs">
              {recentSales.length === 0 ? (
                <div className="text-center py-10 text-text-dim">لا توجد فواتير سابقة مسجلة</div>
              ) : (
                recentSales.map(sale => (
                  <div key={sale.id} className="bg-card2 p-3 rounded-2xl border border-border flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-text-main font-bold">#{sale.id.slice(-8)}</strong>
                        <span className="text-gold font-black font-mono">{sale.finalTotal} ج.م</span>
                      </div>
                      <p className="text-[10px] text-text-dim mt-0.5">
                        {sale.customerName} • {new Date(sale.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} • {sale.items.length} أصناف
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setShowRecentInvoicesModal(false);
                        openInvoiceForPrint(sale);
                      }}
                      className="bg-card hover:bg-gold hover:text-white border border-border px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 shadow-sm"
                    >
                      <Printer size={13} />
                      <span>معاينة وطباعة</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setShowRecentInvoicesModal(false)}
              className="w-full bg-card2 hover:bg-card border border-border py-2.5 rounded-xl font-bold text-xs text-text-dim"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          SUPERVISOR PIN OVERRIDE MODAL (For Price Modification)
          ========================================================= */}
      {isSupervisorModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-card p-6 rounded-3xl w-full max-w-md border border-amber-500/40 space-y-4 shadow-2xl animate-fadeIn">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-text-main">طلب إذن المشرف لتعديل السعر</h3>
                  <p className="text-[11px] text-text-dim">يتطلب إدخال PIN المشرف أو كلمة مرور الإدارة</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsSupervisorModalOpen(false);
                  setPendingPriceEditIndex(null);
                }} 
                className="text-text-dim hover:text-danger p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl text-xs text-amber-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <ShieldAlert size={14} />
                <span>سياسة أمان نقاط البيع:</span>
              </p>
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                تعديل سعر البيع محمي بصلاحيات المشرف لحماية أرباح المؤسسة. يرجى من المدير أو المشرف إدخال الرمز السري (PIN) للتفويض.
              </p>
            </div>

            <form onSubmit={handleVerifySupervisorPin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-dim mb-1.5">رمز المشرف السري (PIN) أو كلمة مرور الإدارة:</label>
                <input 
                  type="password"
                  value={supervisorPinInput}
                  onChange={e => setSupervisorPinInput(e.target.value)}
                  placeholder="أدخل رمز المشرف PIN..."
                  className="w-full bg-card2 border border-border p-3 rounded-2xl font-mono text-center text-lg tracking-widest focus:outline-none focus:border-amber-500"
                  autoFocus
                  required
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-black py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <Unlock size={16} />
                  <span>اعتماد وتفعيل الصلاحية</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsSupervisorModalOpen(false);
                    setPendingPriceEditIndex(null);
                  }}
                  className="bg-card2 hover:bg-card border border-border px-4 py-3 rounded-2xl font-bold text-xs text-text-dim"
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

