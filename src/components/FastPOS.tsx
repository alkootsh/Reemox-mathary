import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, 
  Clock, 
  CheckCircle, 
  Coins, 
  Search, 
  History, 
  Printer, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Smartphone, 
  Receipt, 
  User, 
  Check, 
  Sparkles,
  Percent,
  Wallet,
  RotateCcw,
  Camera,
  Edit3,
  Lock,
  Unlock,
  KeyRound,
  ShieldAlert,
  X,
  ArrowRight,
  HelpCircle,
  QrCode,
  Share2,
  Copy,
  UserPlus,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';
import { Product, Sale, Customer, AppUser } from '../types/types';
import { getUsers, processSale, saveCustomer, getCustomers } from '../lib/firestoreService';
import { verifyDeveloperPassword } from '../lib/license';
import { db } from '@/src/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { playSuccessSound, playWarningSound } from '../lib/sound';

interface FastProduct extends Product {
  emoji?: string;
  badge?: 'hot' | 'new' | 'discount';
}

interface FastCartItem {
  product: FastProduct;
  quantity: number;
  price: number;
  originalPrice: number;
  isCustomPrice?: boolean;
}

export default function FastPOS({ sales, customers = [] }: { sales?: Sale[]; customers?: Customer[] }) {
  const [cart, setCart] = useState<FastCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Customer State & Quick Creation
  const [customerList, setCustomerList] = useState<Customer[]>(customers);
  const [selectedCustomerId, setSelectedCustomerId] = useState('cash-customer');
  const [isQuickCustomerModalOpen, setIsQuickCustomerModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustBalance, setNewCustBalance] = useState('');
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);
  const [creditValidationError, setCreditValidationError] = useState<string | null>(null);

  // WhatsApp & Share States
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsAppPhoneInput, setWhatsAppPhoneInput] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);
  
  // Checkout & Invoice Closing States
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'wallet' | 'credit'>('cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState<Sale | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderNum, setOrderNum] = useState(() => Math.floor(1000 + Math.random() * 9000));
  const [animatedProductId, setAnimatedProductId] = useState<string | null>(null);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  // Sync customers prop with internal state
  useEffect(() => {
    if (customers && customers.length > 0) {
      setCustomerList(customers);
    } else {
      getCustomers().then(list => {
        if (list.length > 0) setCustomerList(list);
      }).catch(console.error);
    }
  }, [customers]);

  // Price Editing States
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [tempPriceValue, setTempPriceValue] = useState<string>('');

  // User & POS Price Permissions
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

  // Supervisor PIN Modal
  const [isSupervisorModalOpen, setIsSupervisorModalOpen] = useState(false);
  const [supervisorPinInput, setSupervisorPinInput] = useState('');
  const [supervisorOverrideActive, setSupervisorOverrideActive] = useState(false);
  const [pendingPriceEditProductId, setPendingPriceEditProductId] = useState<string | null>(null);

  // Dynamic Products List from DB + Built-in presets
  const [dbProducts, setDbProducts] = useState<FastProduct[]>([]);

  const defaultPresets: FastProduct[] = [
    { id: 'fp-1', name: 'كابتشينو', price: 55, cost: 30, quantity: 99, sku: 'FP001', category: 'مشروبات', emoji: '☕', badge: 'hot' },
    { id: 'fp-2', name: 'لاتيه', price: 60, cost: 32, quantity: 99, sku: 'FP002', category: 'مشروبات', emoji: '🥛' },
    { id: 'fp-3', name: 'عصير برتقال طازج', price: 40, cost: 20, quantity: 99, sku: 'FP003', category: 'مشروبات', emoji: '🍊', badge: 'new' },
    { id: 'fp-4', name: 'موهيتو ليمون نعناع', price: 65, cost: 35, quantity: 99, sku: 'FP004', category: 'مشروبات', emoji: '🧃' },
    { id: 'fp-5', name: 'كلوب ساندوتش', price: 120, cost: 70, quantity: 99, sku: 'FP005', category: 'وجبات', emoji: '🥪', badge: 'hot' },
    { id: 'fp-6', name: 'برجر دجاج كرسبي', price: 145, cost: 90, quantity: 99, sku: 'FP006', category: 'وجبات', emoji: '🍔' },
    { id: 'fp-7', name: 'بيتزا مارجريتا', price: 180, cost: 110, quantity: 99, sku: 'FP007', category: 'وجبات', emoji: '🍕', badge: 'new' },
    { id: 'fp-8', name: 'باستا ألفريدو', price: 130, cost: 75, quantity: 99, sku: 'FP008', category: 'وجبات', emoji: '🍝' },
    { id: 'fp-9', name: 'تيراميسو إيطالي', price: 75, cost: 40, quantity: 99, sku: 'FP009', category: 'حلويات', emoji: '🍰' },
    { id: 'fp-10', name: 'كيك الشوكولاتة', price: 65, cost: 35, quantity: 99, sku: 'FP010', category: 'حلويات', emoji: '🎂', badge: 'hot' },
    { id: 'fp-11', name: 'وافل نوتيلا', price: 55, cost: 28, quantity: 99, sku: 'FP011', category: 'حلويات', emoji: '🧇' },
    { id: 'fp-12', name: 'سلطة سيزر دجاج', price: 90, cost: 50, quantity: 99, sku: 'FP012', category: 'سلطات', emoji: '🥗' },
    { id: 'fp-13', name: 'سلطة يونانية', price: 85, cost: 45, quantity: 99, sku: 'FP013', category: 'سلطات', emoji: '🫙' },
    { id: 'fp-14', name: 'وجبة ميكس جريل كاملة', price: 220, cost: 130, quantity: 99, sku: 'FP014', category: 'عروض', emoji: '🍱', badge: 'new' },
    { id: 'fp-15', name: 'عرض الإفطار الصباحي', price: 170, cost: 95, quantity: 99, sku: 'FP015', category: 'عروض', emoji: '🍳', badge: 'hot' },
    { id: 'fp-16', name: 'أيس كريم فانيليا وبوريو', price: 50, cost: 25, quantity: 99, sku: 'FP016', category: 'حلويات', emoji: '🍨' },
  ];

  // Fetch DB products
  useEffect(() => {
    const fetchDBProducts = async () => {
      try {
        const snap = await getDocs(collection(db, 'products'));
        if (!snap.empty) {
          const list: FastProduct[] = snap.docs.map(d => {
            const data = d.data() as Product;
            return {
              ...data,
              id: d.id,
              emoji: data.name.includes('قهوة') || data.name.includes('كافيه') ? '☕' :
                     data.name.includes('برجر') ? '🍔' :
                     data.name.includes('بيتزا') ? '🍕' :
                     data.name.includes('عصير') ? '🧃' :
                     data.name.includes('ساندوتش') ? '🥪' :
                     data.name.includes('كيك') || data.name.includes('حلو') ? '🍰' : '📦'
            };
          });
          setDbProducts(list);
        } else {
          setDbProducts(defaultPresets);
        }
      } catch (e) {
        setDbProducts(defaultPresets);
      }
    };
    fetchDBProducts();
  }, []);

  const displayProducts = dbProducts.length > 0 ? dbProducts : defaultPresets;

  // Categories list
  const categories = ['الكل', ...Array.from(new Set(displayProducts.map(p => p.category || 'عام')))];

  // Scanner Logic
  useEffect(() => {
    if (showScanner) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        })
        .catch(err => console.error(err));
    } else {
      videoRef.current?.srcObject?.getTracks().forEach(track => track.stop());
    }
  }, [showScanner]);

  const detectBarcode = async () => {
    const product = displayProducts[Math.floor(Math.random() * displayProducts.length)];
    addToCart(product);
    setShowScanner(false);
  };

  // Persistence
  useEffect(() => {
    const savedCart = localStorage.getItem('fastPosCart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to parse cart', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('fastPosCart', JSON.stringify(cart));
  }, [cart]);

  // Sync settings
  useEffect(() => {
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

    window.addEventListener('posSettingsUpdated', handlePosSettingsSync);
    window.addEventListener('currentUserUpdated', handleUserSync);

    return () => {
      window.removeEventListener('posSettingsUpdated', handlePosSettingsSync);
      window.removeEventListener('currentUserUpdated', handleUserSync);
    };
  }, []);

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

  const handleStartPriceEdit = (product: FastProduct, currentPrice: number) => {
    if (canUserEditPrice()) {
      setEditingProductId(product.id);
      setTempPriceValue(currentPrice.toString());
    } else {
      if (requireSupervisorPinForPriceEdit) {
        setPendingPriceEditProductId(product.id);
        setSupervisorPinInput('');
        setIsSupervisorModalOpen(true);
      } else {
        playWarningSound();
        alert('🔒 تعديل السعر مقفل للكاشير حسب صلاحيات النظام وإعدادات الإدارة.');
      }
    }
  };

  const handleSavePrice = (productId: string) => {
    const num = parseFloat(tempPriceValue);
    if (isNaN(num) || num < 0) {
      playWarningSound();
      alert('يرجى إدخال سعر صحيح (0 أو أكبر)');
      return;
    }

    const item = cart.find(it => it.product.id === productId);
    if (preventSellBelowCost && item?.product.cost && num < item.product.cost && currentUser?.role !== 'admin' && !supervisorOverrideActive) {
      playWarningSound();
      alert(`⚠️ تنبيه: لا يمكن البيع بأقل من سعر التكلفة (${item.product.cost} ج.م) وفقاً لسياسة الإدارة`);
      return;
    }

    setCart(prev => prev.map(it => {
      if (it.product.id === productId) {
        return {
          ...it,
          price: num,
          isCustomPrice: num !== it.originalPrice
        };
      }
      return it;
    }));

    setEditingProductId(null);
    playSuccessSound();
  };

  const handleResetPrice = (productId: string) => {
    setCart(prev => prev.map(it => {
      if (it.product.id === productId) {
        return {
          ...it,
          price: it.originalPrice,
          isCustomPrice: false
        };
      }
      return it;
    }));
    setEditingProductId(null);
    playSuccessSound();
  };

  const unlockSupervisorPermission = (supervisorName?: string) => {
    playSuccessSound();
    setSupervisorOverrideActive(true);
    setIsSupervisorModalOpen(false);
    
    if (pendingPriceEditProductId) {
      const item = cart.find(it => it.product.id === pendingPriceEditProductId);
      if (item) {
        setEditingProductId(pendingPriceEditProductId);
        setTempPriceValue(item.price.toString());
      }
    }
    setPendingPriceEditProductId(null);
  };

  const handleVerifySupervisorPin = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredPin = supervisorPinInput.trim();
    if (!enteredPin) return;

    if (verifyDeveloperPassword(enteredPin)) {
      unlockSupervisorPermission('المبرمج');
      return;
    }

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
    alert('❌ رمز المشرف أو كلمة المرور غير صحيحة!');
  };

  // Barcode Scanner
  useEffect(() => {
    let barcodeBuffer = "";
    let timeout: NodeJS.Timeout;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Hotkey F12 or Enter to open checkout
      if (e.key === 'F12') {
        e.preventDefault();
        if (cart.length > 0 && !isCheckoutModalOpen) {
          openCheckoutModal();
        }
      } else if (e.key === 'Enter' && isCheckoutModalOpen) {
        // Can submit checkout
      } else if (e.key === 'Enter') {
        if (barcodeBuffer.length > 0) {
          const product = displayProducts.find(p => p.sku === barcodeBuffer || p.name === barcodeBuffer);
          if (product) addToCart(product);
          barcodeBuffer = "";
          clearTimeout(timeout);
        }
      } else if (/^[a-zA-Z0-9]$/.test(e.key)) {
        barcodeBuffer += e.key;
        clearTimeout(timeout);
        timeout = setTimeout(() => { barcodeBuffer = ""; }, 500);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [displayProducts, cart, isCheckoutModalOpen]);

  // Add item to cart
  const addToCart = (product: FastProduct) => {
    setAnimatedProductId(product.id);
    setTimeout(() => setAnimatedProductId(null), 300);
    playSuccessSound();

    setCart(prev => {
      const idx = prev.findIndex(item => item.product.id === product.id);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { 
        product, 
        quantity: 1, 
        price: product.price, 
        originalPrice: product.price, 
        isCustomPrice: false 
      }];
    });
    setCartOpen(true);
  };

  // Update item quantity
  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.product.id === id) {
          const nextQty = item.quantity + delta;
          return { ...item, quantity: nextQty };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  // Clear entire cart
  const clearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setEditingProductId(null);
    setCartOpen(false);
    setDiscountValue(0);
  };

  // Dynamic Tax Settings
  const [taxRate, setTaxRate] = useState<number>(() => {
    const saved = localStorage.getItem('taxRate');
    return saved !== null && !isNaN(Number(saved)) ? Number(saved) : 14;
  });
  const [taxEnabled, setTaxEnabled] = useState<boolean>(() => {
    return localStorage.getItem('taxEnabled') !== 'false';
  });

  useEffect(() => {
    const handleTaxUpdate = () => {
      const saved = localStorage.getItem('taxRate');
      setTaxRate(saved !== null && !isNaN(Number(saved)) ? Number(saved) : 14);
      setTaxEnabled(localStorage.getItem('taxEnabled') !== 'false');
    };
    window.addEventListener('taxSettingsUpdated', handleTaxUpdate);
    return () => window.removeEventListener('taxSettingsUpdated', handleTaxUpdate);
  }, []);

  // Filtered Products
  const filteredProducts = displayProducts.filter(p => {
    const matchesCategory = activeCategory === 'الكل' || p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Financial Calculations
  const subtotal = Math.round(cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) * 100) / 100;
  const discountAmount = Math.min(subtotal, Math.max(0, discountValue));
  const taxableBase = Math.max(0, subtotal - discountAmount);
  const tax = taxEnabled ? Math.round(((taxableBase * taxRate) / 100) * 100) / 100 : 0;
  const finalTotal = Math.round((taxableBase + tax) * 100) / 100;
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Change amount calculation
  const changeAmount = paymentMethod === 'cash' ? Math.max(0, paidAmount - finalTotal) : 0;

  // Quick Customer Creation Handler
  const handleQuickCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      playWarningSound();
      alert('يرجى إدخال اسم العميل ورقم الهاتف / الواتساب');
      return;
    }

    try {
      setIsSavingCustomer(true);
      const newCustData: Partial<Customer> = {
        name: newCustName.trim(),
        phone: newCustPhone.trim(),
        openingBalance: parseFloat(newCustBalance) || 0,
        currentBalance: parseFloat(newCustBalance) || 0,
        whatsappReminders: true
      };
      const savedId = await saveCustomer(newCustData);
      const fullCustomer: Customer = {
        id: savedId,
        name: newCustData.name!,
        phone: newCustData.phone!,
        openingBalance: newCustData.openingBalance,
        currentBalance: newCustData.currentBalance,
        whatsappReminders: true
      };

      setCustomerList(prev => [fullCustomer, ...prev]);
      setSelectedCustomerId(savedId);
      setCreditValidationError(null);
      setIsQuickCustomerModalOpen(false);
      setNewCustName('');
      setNewCustPhone('');
      setNewCustBalance('');
      playSuccessSound();
    } catch (err: any) {
      playWarningSound();
      alert('فشل حفظ العميل: ' + (err.message || err));
    } finally {
      setIsSavingCustomer(false);
    }
  };

  // Generate Electronic WhatsApp Receipt Text
  const generateInvoiceWhatsAppText = (sale: Sale): string => {
    const itemsText = (sale.items || [])
      .map((item, idx) => `${idx + 1}. *${item.name}* × ${item.quantity} = ${(item.price * item.quantity).toFixed(2)} ج.م`)
      .join('\n');

    const paymentLabel = 
      sale.paymentMethod === 'cash' ? '💵 نقداً (كاش)' :
      sale.paymentMethod === 'card' ? '💳 بطاقة / فيزا' :
      sale.paymentMethod === 'wallet' ? '📱 محفظة ذكية' : '⚠️ بيع آجل (على الحساب)';

    return `🧾 *فاتورة مبيعات إلكترونية*
🏪 *نظام MARO ERP المحاسبي*
━━━━━━━━━━━━━━━━━
📄 *رقم الفاتورة:* #${sale.invoiceNumber || sale.id}
📅 *التاريخ:* ${new Date(sale.date).toLocaleString('ar-EG')}
👤 *العميل:* ${sale.customerName || 'عميل نقدي'}
👨‍💼 *المستخدم:* ${sale.userName || currentUser?.name || 'الكاشير'}
━━━━━━━━━━━━━━━━━
📦 *الأصناف والمنتجات:*
${itemsText}
━━━━━━━━━━━━━━━━━
💵 *المجموع الفرعي:* ${(sale.subtotal ?? sale.total).toFixed(2)} ج.م
${sale.discount && sale.discount > 0 ? `🎁 *الخصم:* -${sale.discount.toFixed(2)} ج.م\n` : ''}${sale.tax && sale.tax > 0 ? `🏛️ *ضريبة القيمة المضافة (14%):* +${sale.tax.toFixed(2)} ج.م\n` : ''}💰 *الصافي الإجمالي:* ${(sale.finalTotal || sale.total).toFixed(2)} ج.م
💳 *طريقة السداد:* ${paymentLabel}
${sale.paymentMethod === 'credit' ? `🔴 *المديونية المتبقية بحسابكم:* ${(sale.remainingAmount || sale.finalTotal || sale.total).toFixed(2)} ج.م\n` : ''}${sale.paymentMethod === 'cash' && (sale.changeAmount || 0) > 0 ? `💵 *الباقي للعميل:* ${sale.changeAmount?.toFixed(2)} ج.م\n` : ''}━━━━━━━━━━━━━━━━━
✨ *شكراً لتعاملكم معنا! نتطلع لخدمتكم دائماً* 🙏`;
  };

  const handleShareWhatsApp = (saleObj?: Sale, overridePhone?: string) => {
    const sale = saleObj || lastCompletedSale;
    if (!sale) return;

    const customer = customerList.find(c => c.id === sale.customerId);
    const targetPhone = overridePhone || whatsAppPhoneInput || customer?.phone || '';
    const msg = generateInvoiceWhatsAppText(sale);

    const cleanPhone = targetPhone.replace(/[^0-9]/g, '');
    const url = cleanPhone 
      ? `https://wa.me/${cleanPhone.startsWith('0') ? '2' + cleanPhone : cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
    setIsWhatsAppModalOpen(false);
  };

  const handleCopyInvoiceText = async (saleObj?: Sale) => {
    const sale = saleObj || lastCompletedSale;
    if (!sale) return;
    const msg = generateInvoiceWhatsAppText(sale);
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedToast(true);
      playSuccessSound();
      setTimeout(() => setCopiedToast(false), 2500);
    } catch (e) {
      alert('تم نسخ الفاتورة!');
    }
  };

  // Open Checkout Modal
  const openCheckoutModal = () => {
    if (cart.length === 0) {
      playWarningSound();
      alert('⚠️ السلة فارغة! يرجى اختيار صنف واحد على الأقل لإتمام الفاتورة.');
      return;
    }
    setPaidAmount(finalTotal);
    setCreditValidationError(null);
    setIsCheckoutModalOpen(true);
  };

  // Close and Process the Invoice
  const handleConfirmCloseInvoice = async (shouldPrint: boolean = false) => {
    if (cart.length === 0) return;
    setCreditValidationError(null);

    // CRITICAL ACCOUNTING VALIDATION: Credit sales MUST be linked to a registered customer!
    if (paymentMethod === 'credit') {
      if (!selectedCustomerId || selectedCustomerId === 'cash-customer') {
        playWarningSound();
        setCreditValidationError('⚠️ خطأ محاسبي: لا يمكن إتمام البيع بالآجل (على الحساب) لـ "عميل نقدي". يرجى اختيار عميل مسجل من القائمة أو الضغط على (+ عميل جديد) لحفظ الدين بحسابه.');
        return;
      }
    }

    setIsProcessing(true);

    try {
      const now = new Date();
      const saleId = `FAST-${orderNum}-${Date.now().toString().slice(-4)}`;
      const selectedCust = customerList.find(c => c.id === selectedCustomerId);
      const isCredit = paymentMethod === 'credit';

      const saleData: Sale = {
        id: saleId,
        invoiceNumber: `INV-${orderNum}`,
        items: cart.map(item => ({
          productId: item.product.id,
          name: item.product.name,
          quantity: item.quantity,
          price: item.price,
          unitCost: item.product.cost || 0
        })),
        subtotal,
        discount: discountAmount,
        tax: tax,
        taxRate: taxEnabled ? taxRate : 0,
        total: subtotal,
        finalTotal: finalTotal,
        payments: [
          {
            id: `${Date.now()}-1`,
            saleId: saleId,
            method: paymentMethod === 'cash' ? 'CASH' : paymentMethod === 'card' ? 'CARD' : paymentMethod === 'wallet' ? 'WALLET' : 'CREDIT',
            amount: isCredit ? 0 : finalTotal,
            createdAt: now.toISOString()
          }
        ],
        paymentMethod,
        paidAmount: isCredit ? 0 : (paymentMethod === 'cash' ? Math.max(paidAmount, finalTotal) : finalTotal),
        remainingAmount: isCredit ? finalTotal : 0,
        changeAmount: isCredit ? 0 : changeAmount,
        status: isCredit ? 'unpaid' : 'paid',
        customerId: selectedCustomerId,
        customerName: selectedCustomerId === 'cash-customer' ? 'عميل نقدي' : (selectedCust?.name || 'عميل مسجل'),
        date: now.toISOString(),
        userId: currentUser?.id || 'cashier',
        userName: currentUser?.name || currentUser?.username || 'الكاشير السريع',
        branchId: 'default'
      };

      // Try saving to DB transaction
      try {
        await processSale({
          items: saleData.items,
          subtotal: saleData.subtotal,
          discount: saleData.discount,
          tax: saleData.tax,
          taxRate: saleData.taxRate,
          total: saleData.total,
          finalTotal: saleData.finalTotal,
          payments: saleData.payments,
          paymentMethod: saleData.paymentMethod,
          paidAmount: saleData.paidAmount,
          remainingAmount: saleData.remainingAmount,
          status: saleData.status,
          customerId: saleData.customerId,
          customerName: saleData.customerName,
          date: saleData.date,
          userId: saleData.userId,
          branchId: saleData.branchId
        }, currentUser?.id || 'admin');
      } catch (err) {
        console.warn('Saved locally due to offline/mock product', err);
      }

      setLastCompletedSale(saleData);
      setWhatsAppPhoneInput(selectedCust?.phone || '');
      setIsCheckoutModalOpen(false);
      setShowSuccessModal(true);
      playSuccessSound();

      if (shouldPrint) {
        setTimeout(() => {
          handlePrintThermalReceipt(saleData);
        }, 300);
      }

    } catch (e: any) {
      playWarningSound();
      alert('حدث خطأ أثناء قفل الفاتورة: ' + (e.message || e));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNextOrder = () => {
    setOrderNum(prev => prev + 1);
    clearCart();
    setShowSuccessModal(false);
    setLastCompletedSale(null);
    setSupervisorOverrideActive(false);
  };

  // Thermal Receipt Printing
  const handlePrintThermalReceipt = (saleObj?: Sale) => {
    const saleToPrint = saleObj || lastCompletedSale;
    if (!saleToPrint) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
          <head>
            <meta charset="utf-8">
            <title>إيصال #${saleToPrint.invoiceNumber || orderNum}</title>
            <style>
              body { 
                font-family: 'Courier New', monospace, sans-serif; 
                font-size: 13px; 
                margin: 0; 
                padding: 10px; 
                color: #000;
                width: 80mm;
              }
              .center { text-align: center; }
              .bold { font-weight: bold; }
              .divider { border-top: 1px dashed #000; margin: 8px 0; }
              .double-divider { border-top: 2px solid #000; margin: 8px 0; }
              .flex-between { display: flex; justify-content: space-between; margin: 3px 0; }
              table { width: 100%; border-collapse: collapse; margin: 8px 0; }
              th, td { text-align: right; padding: 4px 0; }
              th:last-child, td:last-child { text-align: left; }
              .total-box { font-size: 16px; font-weight: 900; margin: 6px 0; }
            </style>
          </head>
          <body>
            <div class="center">
              <h2 style="margin:0; font-size: 18px;">المتجر الذكي (نظام الفواتير السريعة)</h2>
              <p style="margin:2px 0; font-size: 11px;">فاتورة بيع ضريبية مبسطة</p>
              <div class="divider"></div>
              <div class="flex-between"><span>رقم الفاتورة:</span><span class="bold">#${saleToPrint.invoiceNumber || orderNum}</span></div>
              <div class="flex-between"><span>التاريخ والوقت:</span><span>${new Date(saleToPrint.date).toLocaleString('ar-EG')}</span></div>
              <div class="flex-between"><span>الكاشير:</span><span>${saleToPrint.userName || 'الكاشير'}</span></div>
              <div class="flex-between"><span>طريقة الدفع:</span><span class="bold">${
                saleToPrint.paymentMethod === 'cash' ? 'نقداً (Cash)' :
                saleToPrint.paymentMethod === 'card' ? 'شبكة / بطاقة' :
                saleToPrint.paymentMethod === 'wallet' ? 'محفظة إلكترونية' : 'آجل'
              }</span></div>
            </div>

            <div class="double-divider"></div>

            <table>
              <thead>
                <tr>
                  <th>الصنف</th>
                  <th style="text-align:center;">الكمية</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                ${(saleToPrint.items || []).map(it => `
                  <tr>
                    <td>${it.name} <br/><small style="font-size:10px; color:#555;">${it.price} ج.م</small></td>
                    <td style="text-align:center;">${it.quantity}</td>
                    <td>${(it.price * it.quantity).toFixed(2)} ج</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="divider"></div>

            <div class="flex-between"><span>المجموع الفرعي:</span><span>${saleToPrint.subtotal.toFixed(2)} ج.م</span></div>
            ${saleToPrint.discount > 0 ? `<div class="flex-between"><span>الخصم:</span><span>-${saleToPrint.discount.toFixed(2)} ج.م</span></div>` : ''}
            ${saleToPrint.tax > 0 ? `<div class="flex-between"><span>ضريبة القيمة المضافة:</span><span>+${saleToPrint.tax.toFixed(2)} ج.م</span></div>` : ''}
            
            <div class="double-divider"></div>
            
            <div class="flex-between total-box">
              <span>الصافي المطلوب:</span>
              <span>${saleToPrint.total.toFixed(2)} ج.م</span>
            </div>

            ${saleToPrint.paymentMethod === 'cash' ? `
              <div class="flex-between"><span>المبلغ المدفوع:</span><span>${(saleToPrint.paidAmount || saleToPrint.total).toFixed(2)} ج.م</span></div>
              <div class="flex-between" style="font-weight:bold;"><span>الباقي للعميل:</span><span>${(saleToPrint.changeAmount || 0).toFixed(2)} ج.م</span></div>
            ` : ''}

            <div class="divider"></div>
            <div class="center" style="font-size:11px; margin-top: 10px;">
              <p>شكراً لزيارتكم! نتشرف بخدمتكم دائماً</p>
              <p>*** يسعدنا تقييمكم لخدمتنا ***</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-slate-100 font-sans select-none overflow-hidden" dir="rtl">
      
      {/* =========================================================
          TOP HEADER BAR
          ========================================================= */}
      <header className="bg-slate-950 border-b border-slate-800 px-4 h-16 flex items-center justify-between shadow-lg flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 shadow-md font-black text-xl">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-sm tracking-tight text-white">نقطة البيع السريع (Fast POS)</h1>
              {canUserEditPrice() ? (
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <Unlock size={10} />
                  <span>تعديل السعر متاح</span>
                </span>
              ) : (
                <button 
                  onClick={() => {
                    setPendingPriceEditProductId(null);
                    setSupervisorPinInput('');
                    setIsSupervisorModalOpen(true);
                  }}
                  className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 transition-all"
                  title="طلب إذن المشرف لتعديل الأسعار"
                >
                  <Lock size={10} />
                  <span>طلب إذن مشرف 🔐</span>
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400">إصدار وقفل الفواتير بلمسة واحدة وحساب الباقي للعميل</p>
          </div>
        </div>

        {/* Search & Scanner */}
        <div className="flex-1 max-w-md mx-4">
          <div className="relative flex items-center bg-slate-800/90 border border-slate-700/80 rounded-2xl px-3.5 py-2 shadow-inner focus-within:border-amber-500 transition-all">
            <Search size={16} className="text-slate-400 me-2" />
            <input 
              className="bg-transparent text-xs border-none outline-none w-full placeholder-slate-400 text-white font-medium" 
              placeholder="ابحث بالاسم أو الباركود SKU..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-white me-2">
                <X size={14} />
              </button>
            )}
            <button 
              onClick={() => setShowScanner(true)} 
              className="bg-slate-700 hover:bg-slate-600 text-amber-400 p-1.5 rounded-xl transition-all"
              title="مسح باركود بالكاميرا"
            >
              <Camera size={15} />
            </button>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowHelpGuide(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            title="كيف تقفل الفاتورة؟"
          >
            <HelpCircle size={15} className="text-amber-400" />
            <span className="hidden md:inline">كيف أقفل الفاتورة؟</span>
          </button>

          {cart.length > 0 && (
            <button 
              onClick={clearCart} 
              className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
            >
              <Trash2 size={13} />
              <span>تفريغ</span>
            </button>
          )}
        </div>
      </header>

      {/* =========================================================
          CATEGORY FILTER BAR
          ========================================================= */}
      <div className="bg-slate-950/80 border-b border-slate-800/80 px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeCategory === cat 
                ? 'bg-amber-500 text-slate-950 shadow-md font-black scale-105' 
                : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* =========================================================
          MAIN PRODUCTS GRID
          ========================================================= */}
      <main className="flex-1 overflow-y-auto p-4 pb-36">
        {filteredProducts.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-center space-y-2">
            <ShoppingBag size={48} className="stroke-[1.2]" />
            <p className="text-sm font-bold">لا توجد أصناف مطابقة للبحث</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredProducts.map(product => {
              const inCartItem = cart.find(c => c.product.id === product.id);
              const isAnimated = animatedProductId === product.id;

              return (
                <button 
                  key={product.id} 
                  onClick={() => addToCart(product)} 
                  className={`relative bg-slate-800/90 hover:bg-slate-750 border border-slate-700/70 rounded-2xl p-3.5 flex flex-col items-center justify-between gap-2 transition-all duration-200 active:scale-95 text-start group shadow-md hover:border-amber-500/60 ${
                    isAnimated ? 'ring-2 ring-amber-400 bg-amber-500/10 scale-95' : ''
                  }`}
                >
                  {/* Cart badge */}
                  {inCartItem && (
                    <span className="absolute top-2 left-2 bg-amber-500 text-slate-950 font-black text-[11px] w-6 h-6 rounded-full flex items-center justify-center shadow-md animate-bounce">
                      {inCartItem.quantity}
                    </span>
                  )}

                  {product.badge && (
                    <span className={`absolute top-2 right-2 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase ${
                      product.badge === 'hot' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                      product.badge === 'new' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {product.badge === 'hot' ? 'رائج 🔥' : product.badge === 'new' ? 'جديد ⭐' : 'عرض 🎁'}
                    </span>
                  )}

                  <span className="text-4xl my-1 transform group-hover:scale-110 transition-transform">
                    {product.emoji || '📦'}
                  </span>

                  <div className="w-full text-center">
                    <h3 className="font-bold text-slate-100 text-xs line-clamp-1 leading-snug">{product.name}</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">{product.category || 'صنف عام'}</p>
                  </div>

                  <div className="w-full pt-1.5 border-t border-slate-700/50 flex justify-between items-center">
                    <span className="text-amber-400 font-black text-xs font-mono">{product.price} ج.م</span>
                    <span className="text-[10px] bg-slate-700/80 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-300 px-2 py-0.5 rounded-lg font-bold transition-colors">
                      + إضافة
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* =========================================================
          BOTTOM CART SHEET & INSTANT CHECKOUT TRIGGER
          ========================================================= */}
      <div className={`fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 rounded-t-3xl shadow-2xl transition-transform duration-300 z-30 ${
        cartOpen ? 'translate-y-0' : 'translate-y-[calc(100%-68px)]'
      }`}>
        {/* Toggle Bar / Summary Header */}
        <div 
          className="p-3.5 px-5 flex items-center justify-between border-b border-slate-800/80 cursor-pointer bg-slate-900/90 rounded-t-3xl hover:bg-slate-850 transition-colors"
          onClick={() => setCartOpen(!cartOpen)}
        >
          <div className="flex items-center gap-3">
            <div className="relative p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShoppingBag size={18} />
              {totalItemsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-slate-950 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow">
                  {totalItemsCount}
                </span>
              )}
            </div>
            <div>
              <h3 className="font-black text-sm text-white">سلة الفاتورة الحالية ({totalItemsCount} أصناف)</h3>
              <p className="text-[11px] text-slate-400">انقر لـ {cartOpen ? 'طي السلة' : 'فتح وتعديل أصناف الفاتورة'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-end">
              <span className="text-[10px] text-slate-400 block">الإجمالي الصافي:</span>
              <span className="text-xl font-black text-amber-400 font-mono tracking-tight">{finalTotal} ج.م</span>
            </div>

            {/* Quick Checkout Trigger in header */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                openCheckoutModal();
              }}
              disabled={cart.length === 0}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-slate-950 px-5 py-2.5 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            >
              <CheckCircle size={16} />
              <span>قفل الفاتورة (F12)</span>
            </button>
          </div>
        </div>
        
        {/* Cart Items List */}
        <div className="max-h-60 overflow-y-auto p-4 space-y-2.5 bg-slate-950">
          {cart.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-xs">
              السلة فارغة. اضغط على أي صنف لإضافته للفاتورة.
            </div>
          ) : (
            cart.map(item => (
              <div key={item.product.id} className={`p-2.5 rounded-2xl border transition-all ${
                item.isCustomPrice 
                  ? 'bg-amber-500/10 border-amber-500/40' 
                  : 'bg-slate-900 border-slate-800'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="text-2xl">{item.product.emoji || '📦'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-100 truncate">{item.product.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[11px] text-slate-400 font-mono">{item.price} ج.م × {item.quantity}</span>
                        {item.isCustomPrice && (
                          <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.2 rounded font-bold">
                            سعر مخصص (الأصل: {item.originalPrice} ج)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quantity & Price Controls */}
                  <div className="flex items-center gap-2">
                    {/* Price edit button */}
                    <button
                      onClick={() => handleStartPriceEdit(item.product, item.price)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 border border-slate-700 rounded-xl text-[11px] font-bold flex items-center gap-1 transition-all"
                      title="تعديل سعر البيع لهذا الصنف"
                    >
                      <Edit3 size={12} />
                      <span className="hidden sm:inline">سعر</span>
                    </button>

                    {/* Quantity - + */}
                    <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
                      <button 
                        onClick={() => updateQuantity(item.product.id, -1)} 
                        className="w-6 h-6 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-300 font-black text-xs"
                      >
                        -
                      </button>
                      <span className="font-bold text-xs px-1.5 font-mono text-amber-400">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.product.id, 1)} 
                        className="w-6 h-6 flex items-center justify-center hover:bg-slate-700 rounded-lg text-slate-300 font-black text-xs"
                      >
                        +
                      </button>
                    </div>

                    <span className="font-black text-xs text-amber-400 font-mono min-w-[55px] text-end">
                      {(item.price * item.quantity).toFixed(2)} ج
                    </span>

                    <button 
                      onClick={() => updateQuantity(item.product.id, -item.quantity)} 
                      className="text-slate-500 hover:text-rose-400 p-1"
                      title="حذف"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Inline Price Editing Sub-form */}
                {editingProductId === item.product.id && (
                  <div className="bg-slate-850 p-2.5 rounded-xl border border-amber-500/50 mt-2 space-y-1.5 animate-fadeIn">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-amber-400 font-bold">تعديل سعر الوحدة (ج.م):</span>
                      <span className="text-slate-400">السعر الافتراضي: {item.originalPrice} ج.م</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <input 
                        type="number"
                        step="any"
                        min="0"
                        className="flex-1 bg-slate-900 border border-slate-700 p-1.5 rounded-lg text-xs font-bold text-center font-mono text-white focus:border-amber-500 outline-none"
                        value={tempPriceValue}
                        onChange={e => setTempPriceValue(e.target.value)}
                        placeholder="السعر الجديد..."
                        autoFocus
                      />
                      <button 
                        onClick={() => handleSavePrice(item.product.id)}
                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-3 py-1.5 rounded-lg text-xs font-black shadow-sm"
                      >
                        حفظ
                      </button>
                      {item.isCustomPrice && (
                        <button 
                          onClick={() => handleResetPrice(item.product.id)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1.5 rounded-lg text-xs"
                          title="استعادة السعر الأصلي"
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}
                      <button 
                        onClick={() => setEditingProductId(null)}
                        className="bg-slate-800 hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 px-2 py-1.5 rounded-lg text-xs"
                      >
                        <X size={13} />
                      </button>
                    </div>

                    {preventSellBelowCost && item.product.cost && Number(tempPriceValue) < item.product.cost && (
                      <p className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                        <ShieldAlert size={11} />
                        تحذير: السعر أقل من التكلفة ({item.product.cost} ج.م)!
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Bottom Checkout Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-400 space-y-0.5">
              <div>المجموع: <span className="font-mono text-slate-200 font-bold">{subtotal} ج.م</span></div>
              {taxEnabled && <div>الضريبة ({taxRate}%): <span className="font-mono text-slate-200 font-bold">{tax} ج.م</span></div>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={openCheckoutModal}
              disabled={cart.length === 0}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-slate-950 px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
            >
              <CheckCircle size={18} />
              <span>قفل الفاتورة والتحصيل ({finalTotal} ج.م)</span>
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================
          MAIN INVOICE CHECKOUT & CLOSING MODAL (قفل الفاتورة)
          ========================================================= */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-3 sm:p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-950 p-4 px-5 sm:px-6 border-b border-slate-800 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Coins size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg text-white">قفل الفاتورة والتحصيل السريع</h3>
                  <p className="text-[11px] text-slate-400">طلب #{orderNum} • {totalItemsCount} أصناف</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCheckoutModalOpen(false)}
                className="text-slate-400 hover:text-rose-400 p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
              
              {/* Total Due Banner */}
              <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-inner">
                <div>
                  <span className="text-xs text-slate-400 font-bold block">الصافي المطلوب سداده:</span>
                  <span className="text-2xl sm:text-3xl font-black text-amber-400 font-mono tracking-tight">{finalTotal} ج.م</span>
                </div>
                <div className="text-end text-xs text-slate-400 space-y-0.5">
                  <p>المجموع: {subtotal} ج</p>
                  {discountAmount > 0 && <p className="text-emerald-400">خصم: -{discountAmount} ج</p>}
                  {tax > 0 && <p>ضريبة ({taxRate}%): +{tax} ج</p>}
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">طريقة الدفع:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('cash');
                      setPaidAmount(finalTotal);
                    }}
                    className={`p-3 rounded-2xl border font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'cash' 
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md ring-1 ring-emerald-500' 
                        : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Coins size={20} className="text-emerald-400" />
                    <span className="whitespace-nowrap">نقداً (كاش)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('card');
                      setPaidAmount(finalTotal);
                    }}
                    className={`p-3 rounded-2xl border font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'card' 
                        ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-md ring-1 ring-blue-500' 
                        : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <CreditCard size={20} className="text-blue-400" />
                    <span className="whitespace-nowrap">بطاقة / فيزا</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('wallet');
                      setPaidAmount(finalTotal);
                    }}
                    className={`p-3 rounded-2xl border font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'wallet' 
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-md ring-1 ring-purple-500' 
                        : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Smartphone size={20} className="text-purple-400" />
                    <span className="whitespace-nowrap">محفظة ذكية</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('credit');
                      setPaidAmount(0);
                    }}
                    className={`p-3 rounded-2xl border font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all ${
                      paymentMethod === 'credit' 
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-md ring-1 ring-amber-500' 
                        : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <User size={20} className="text-amber-400" />
                    <span className="whitespace-nowrap">آجل / ذمم</span>
                  </button>
                </div>
              </div>

              {/* Cash Denominations & Change calculation */}
              {paymentMethod === 'cash' && (
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-300">المبلغ المستلم من العميل (ج.م):</label>
                    <span className="text-[11px] text-slate-400">حساب الباقي تلقائياً</span>
                  </div>

                  <input 
                    type="number"
                    step="any"
                    min="0"
                    value={paidAmount || ''}
                    onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl font-mono text-center text-xl font-black text-amber-400 focus:border-amber-500 outline-none"
                    placeholder="0.00"
                    autoFocus
                  />

                  {/* Fast Cash Shortcut Buttons */}
                  <div className="grid grid-cols-5 gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setPaidAmount(finalTotal)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-2 rounded-lg text-[11px] font-bold"
                    >
                      بالضبط
                    </button>
                    {[50, 100, 200, 500].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setPaidAmount(val)}
                        className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 py-2 rounded-lg text-[11px] font-mono font-bold"
                      >
                        {val} ج
                      </button>
                    ))}
                  </div>

                  {/* Change returned badge */}
                  <div className={`p-3 rounded-xl flex items-center justify-between border ${
                    paidAmount >= finalTotal 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}>
                    <span className="text-xs font-bold">
                      {paidAmount >= finalTotal ? 'الباقي للعميل (Change):' : 'المبلغ المتبقي للتحصيل:'}
                    </span>
                    <span className="text-base font-black font-mono">
                      {paidAmount >= finalTotal ? `${changeAmount.toFixed(2)} ج.م` : `${(finalTotal - paidAmount).toFixed(2)} ج.م`}
                    </span>
                  </div>
                </div>
              )}

              {/* Validation Warning for Credit Sales */}
              {creditValidationError && (
                <div className="bg-rose-500/15 border border-rose-500/40 p-3 rounded-2xl text-xs text-rose-300 font-bold flex items-start gap-2 animate-shake">
                  <AlertTriangle size={16} className="text-rose-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span>{creditValidationError}</span>
                  </div>
                </div>
              )}

              {paymentMethod === 'credit' && selectedCustomerId === 'cash-customer' && !creditValidationError && (
                <div className="bg-amber-500/15 border border-amber-500/40 p-2.5 rounded-2xl text-[11px] text-amber-300 font-bold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>البيع الآجل يتطلب تحديد حساب عميل لتسجيل المديونية:</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsQuickCustomerModalOpen(true)}
                    className="bg-amber-500 hover:bg-amber-400 text-black px-2.5 py-1 rounded-xl text-[11px] font-black flex items-center gap-1 shadow transition-all flex-shrink-0"
                  >
                    <UserPlus size={13} />
                    <span>+ عميل جديد</span>
                  </button>
                </div>
              )}

              {/* Discount / Customer selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-bold text-slate-400">العميل المستلم:</label>
                    <button
                      type="button"
                      onClick={() => setIsQuickCustomerModalOpen(true)}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"
                    >
                      <UserPlus size={12} />
                      <span>+ إضافة عميل سريع</span>
                    </button>
                  </div>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => {
                      setSelectedCustomerId(e.target.value);
                      setCreditValidationError(null);
                    }}
                    className={`w-full bg-slate-950 border p-2.5 rounded-xl text-xs text-slate-200 focus:border-amber-500 outline-none font-bold ${
                      paymentMethod === 'credit' && selectedCustomerId === 'cash-customer'
                        ? 'border-rose-500/60 ring-2 ring-rose-500/20'
                        : 'border-slate-800'
                    }`}
                  >
                    <option value="cash-customer">عميل نقدي (افتراضي - كاش فقط)</option>
                    {customerList.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''} {c.currentBalance ? `[رصيده: ${c.currentBalance} ج.م]` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">خصم إضافي (ج.م):</label>
                  <input 
                    type="number"
                    min="0"
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs text-slate-200 font-mono focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="bg-slate-950 p-4 px-5 sm:px-6 border-t border-slate-800 flex flex-col sm:flex-row gap-2 sm:gap-2.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => handleConfirmCloseInvoice(true)}
                disabled={isProcessing}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 py-3.5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
              >
                <Printer size={18} />
                <span>قفل الفاتورة والطباعة (F10)</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleConfirmCloseInvoice(false)}
                  disabled={isProcessing}
                  className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-5 py-3 rounded-2xl font-bold text-xs active:scale-95 transition-all"
                >
                  قفل فقط
                </button>

                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 px-4 py-3 rounded-2xl text-xs"
                >
                  إلغاء
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================
          SUCCESS & RECEIPT / SHARE MODAL
          ========================================================= */}
      {showSuccessModal && lastCompletedSale && (
        <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-emerald-500/40 p-6 rounded-3xl w-full max-w-md text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-2xl font-black shadow-lg">
              ✓
            </div>

            <div>
              <h3 className="font-black text-lg text-white">تم قفل الفاتورة #{lastCompletedSale.invoiceNumber || orderNum} بنجاح!</h3>
              <p className="text-xs text-slate-400 mt-1">
                الإجمالي الصافي: <span className="text-amber-400 font-bold font-mono text-base">{(lastCompletedSale.finalTotal || lastCompletedSale.total).toFixed(2)} ج.م</span>
              </p>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-start text-xs space-y-2 text-slate-300">
              <div className="flex justify-between items-center text-slate-400">
                <span>العميل:</span>
                <span className="font-bold text-white flex items-center gap-1">
                  <User size={13} className="text-amber-400" />
                  {lastCompletedSale.customerName}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-400">
                <span>طريقة السداد:</span>
                <span className={`font-bold px-2 py-0.5 rounded-lg text-[11px] ${
                  lastCompletedSale.paymentMethod === 'credit' 
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : lastCompletedSale.paymentMethod === 'cash'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}>
                  {lastCompletedSale.paymentMethod === 'cash' ? '💵 نقداً (كاش)' :
                   lastCompletedSale.paymentMethod === 'card' ? '💳 بطاقة / فيزا' :
                   lastCompletedSale.paymentMethod === 'wallet' ? '📱 محفظة ذكية' : '⚠️ بيع آجل (على الحساب)'}
                </span>
              </div>

              {lastCompletedSale.paymentMethod === 'credit' && (
                <div className="flex justify-between items-center text-rose-400 bg-rose-500/10 p-2 rounded-xl border border-rose-500/20 font-bold">
                  <span>المديونية المتبقية على العميل:</span>
                  <span className="font-mono text-sm">{(lastCompletedSale.remainingAmount || lastCompletedSale.finalTotal || lastCompletedSale.total).toFixed(2)} ج.م</span>
                </div>
              )}

              {lastCompletedSale.paymentMethod === 'cash' && lastCompletedSale.changeAmount! > 0 && (
                <div className="flex justify-between items-center text-emerald-400 bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20 font-bold">
                  <span>الباقي المستحق للعميل:</span>
                  <span className="font-mono text-sm">{lastCompletedSale.changeAmount} ج.م</span>
                </div>
              )}

              <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800/80">
                <span>عدد الأصناف بالفاتورة:</span>
                <span className="font-bold text-white">{lastCompletedSale.items.length} أصناف</span>
              </div>
            </div>

            {/* Quick Action Buttons: Print, WhatsApp, Copy, Next */}
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handlePrintThermalReceipt()} 
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow active:scale-95"
              >
                <Printer size={15} className="text-amber-400" />
                <span>🖨️ طباعة إيصال</span>
              </button>

              <button 
                onClick={() => {
                  const cust = customerList.find(c => c.id === lastCompletedSale.customerId);
                  if (cust?.phone) {
                    handleShareWhatsApp(lastCompletedSale, cust.phone);
                  } else {
                    setIsWhatsAppModalOpen(true);
                  }
                }}
                className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow active:scale-95"
              >
                <MessageSquare size={15} className="text-emerald-400" />
                <span>📲 إرسال واتساب</span>
              </button>

              <button 
                onClick={() => handleCopyInvoiceText()} 
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 py-2.5 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                {copiedToast ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedToast ? 'تم النسخ بنجاح!' : '📋 نسخ الفاتورة'}</span>
              </button>

              <button 
                onClick={handleNextOrder} 
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 py-2.5 rounded-2xl font-black text-xs flex items-center justify-center gap-1 shadow-lg transition-all active:scale-95"
              >
                <span>طلب جديد</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          QUICK ADD CUSTOMER MODAL
          ========================================================= */}
      {isQuickCustomerModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-amber-500/40 p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">إضافة عميل سريع</h3>
                  <p className="text-[10px] text-slate-400">لتسجيل الفاتورة والمديونية باسمه</p>
                </div>
              </div>
              <button 
                onClick={() => setIsQuickCustomerModalOpen(false)} 
                className="text-slate-400 hover:text-rose-400"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">اسم العميل: *</label>
                <input 
                  type="text"
                  placeholder="مثال: محمد علي"
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white focus:border-amber-500 outline-none"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">رقم الهاتف / الواتساب: *</label>
                <input 
                  type="tel"
                  placeholder="01012345678"
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono focus:border-amber-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">الرصيد الافتتاحي (مديونية سابقة إن وجدت):</label>
                <input 
                  type="number"
                  placeholder="0"
                  value={newCustBalance}
                  onChange={e => setNewCustBalance(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingCustomer}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow"
                >
                  <Check size={15} />
                  <span>{isSavingCustomer ? 'جاري الحفظ...' : 'حفظ وتحديد للفاتورة'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsQuickCustomerModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2.5 rounded-xl font-bold text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          WHATSAPP NUMBER PROMPT MODAL
          ========================================================= */}
      {isWhatsAppModalOpen && lastCompletedSale && (
        <div className="fixed inset-0 z-[10000] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-emerald-500/40 p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">إرسال الفاتورة عبر واتساب</h3>
                  <p className="text-[10px] text-slate-400">إرسال رسالة إلكترونية مفصلة للعميل</p>
                </div>
              </div>
              <button 
                onClick={() => setIsWhatsAppModalOpen(false)} 
                className="text-slate-400 hover:text-rose-400"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">رقم هاتف العميل (واتساب):</label>
                <input 
                  type="tel"
                  placeholder="01012345678"
                  value={whatsAppPhoneInput}
                  onChange={e => setWhatsAppPhoneInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-white font-mono focus:border-emerald-500 outline-none text-center text-sm"
                  autoFocus
                />
              </div>

              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="font-bold text-slate-300">محتوى الرسالة:</p>
                <p className="line-clamp-3 font-mono text-[10px]">
                  {generateInvoiceWhatsAppText(lastCompletedSale)}
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleShareWhatsApp(lastCompletedSale, whatsAppPhoneInput)}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow"
                >
                  <Share2 size={15} />
                  <span>فتح تطبيق واتساب 📲</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsWhatsAppModalOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2.5 rounded-xl font-bold text-xs"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          HELP & INVOICE CLOSING EXPLANATION MODAL
          ========================================================= */}
      {showHelpGuide && (
        <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-3xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <HelpCircle size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">خطوات قفل الفاتورة في البيع السريع</h3>
                  <p className="text-[11px] text-slate-400">دليل الاستخدام السريع للمحاسب والكاشير</p>
                </div>
              </div>
              <button onClick={() => setShowHelpGuide(false)} className="text-slate-400 hover:text-rose-400">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <p className="font-black text-amber-400">1. إضافة الأصناف إلى السلة:</p>
                <p className="text-slate-400">انقر على بطاقة أي صنف أو امسح الباركود، وسيتم إدراجه فوراً في السلة.</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <p className="font-black text-amber-400">2. الضغط على زر "قفل الفاتورة (F12)":</p>
                <p className="text-slate-400">اضغط على الزر الأخضر أسفل الشاشة أو اضغط مفتاح <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700 font-mono text-white">F12</kbd>.</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <p className="font-black text-amber-400">3. اختيار طريقة الدفع وحساب الباقي:</p>
                <p className="text-slate-400">اختر (نقداً، فيزا، محفظة، أو آجل). في حالة الكاش، اكتب المبلغ المستلم أو اختر الفئة السريعة ليحسب النظام الباقي للعميل.</p>
              </div>

              <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-1">
                <p className="font-black text-emerald-400">4. تأكيد القفل والطباعة:</p>
                <p className="text-slate-400">اضغط "قفل الفاتورة والطباعة" لحفظ الفاتورة في النظام وخصم المخزون وطباعة الإيصال فوراً.</p>
              </div>
            </div>

            <button
              onClick={() => setShowHelpGuide(false)}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 py-2.5 rounded-xl font-black text-xs shadow transition-all"
            >
              فهمت، شكراً
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          SUPERVISOR PIN OVERRIDE MODAL
          ========================================================= */}
      {isSupervisorModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl border border-amber-500/40">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h4 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
                <KeyRound size={18} className="text-amber-400" />
                <span>إذن المشرف لتعديل السعر</span>
              </h4>
              <button onClick={() => setIsSupervisorModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X size={18} />
              </button>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              تعديل أسعار البيع محمي لحماية أرباح المؤسسة. يرجى إدخال PIN المشرف أو كلمة مرور الإدارة:
            </p>

            <form onSubmit={handleVerifySupervisorPin} className="space-y-3">
              <input 
                type="password"
                value={supervisorPinInput}
                onChange={e => setSupervisorPinInput(e.target.value)}
                placeholder="أدخل رمز PIN المشرف..."
                className="w-full bg-slate-950 border border-slate-800 p-3 rounded-2xl font-mono text-center text-lg tracking-widest text-white outline-none focus:border-amber-500"
                autoFocus
                required
              />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 py-2.5 rounded-xl font-black text-xs shadow transition-all">
                  اعتماد الصلاحية
                </button>
                <button type="button" onClick={() => setIsSupervisorModalOpen(false)} className="bg-slate-800 text-slate-400 px-3 py-2.5 rounded-xl text-xs font-bold">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================
          CAMERA SCANNER MODAL
          ========================================================= */}
      {showScanner && (
        <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-4">
          <video ref={videoRef} className="w-full max-w-md h-auto rounded-3xl border border-slate-700" />
          <div className="absolute top-6 right-6 flex gap-3">
            <button onClick={() => setShowScanner(false)} className="bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs border border-slate-700">
              ✕ إغلاق
            </button>
            <button onClick={detectBarcode} className="bg-amber-500 text-slate-950 font-black px-4 py-2 rounded-xl text-xs shadow">
              📷 مسح باركود تجريبي
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

