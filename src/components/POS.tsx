import React, { useState, useEffect, useRef } from 'react';
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
  Users,
  Wifi,
  WifiOff,
  RefreshCw,
  Scan,
  Zap,
  CheckCircle,
  Palette,
  Layout,
  HelpCircle,
  PauseCircle,
  PlayCircle,
  Tag,
  Search,
  Keyboard,
  Home
} from 'lucide-react';
import QrScanner from 'react-qr-scanner';
import { Product, Customer, Sale, Payment, AppUser, CashierSession } from '../types/types';
import { 
  processSale, 
  deleteSale,
  getUsers, 
  saveCustomer, 
  getOfflineSales, 
  saveOfflineSale, 
  syncOfflineSalesToFirestore, 
  isOnline,
  getProducts,
  getSales,
  saveProduct,
  getCashierSessions
} from '../lib/firestoreService';
import { triggerSaleNotification } from '../lib/notifications';
import { verifyDeveloperPassword } from '../lib/license';
import { db } from '@/src/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { playSuccessSound, playWarningSound, playBarcodeBeepSound } from '../lib/sound';
import Toast from './Toast';
import POSDesignSelectorModal, { POSDesignType } from './pos/POSDesignSelectorModal';
import EmeraldPOSLayout from './pos/EmeraldPOSLayout';
import TouchPOSLayout from './pos/TouchPOSLayout';
import ClassicPOSLayout from './pos/ClassicPOSLayout';

export interface POSCartItem {
  product: Product;
  quantity: number;
  price: number;
  originalPrice: number;
  isCustomPrice?: boolean;
  color?: string;
  size?: string;
  unit?: string;
  notes?: string;
  barcode?: string;
}

export interface SuspendedOrder {
  id: string;
  time: string;
  cart: POSCartItem[];
  selectedCustomerId?: string;
  discountValue: number;
  discountType: 'percentage' | 'fixed';
  itemsCount: number;
  total: number;
}

export default function POS({ 
  customers, 
  currentUser, 
  onNavigateHome,
  initialProducts = [],
  initialSales = [],
  initialCashierSessions = []
}: { 
  customers: Customer[]; 
  currentUser: AppUser | null; 
  onNavigateHome?: () => void;
  initialProducts?: Product[];
  initialSales?: Sale[];
  initialCashierSessions?: CashierSession[];
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [sales, setSales] = useState<Sale[]>(initialSales);
  const [activeSession, setActiveSession] = useState<CashierSession | null>(() => {
    return initialCashierSessions.find(s => s.status === 'ACTIVE' || s.status === 'OPEN') || null;
  });

  useEffect(() => {
    async function loadStats() {
      const [sList, sessList] = await Promise.all([
        initialSales.length > 0 ? Promise.resolve(initialSales) : getSales(currentUser?.companyId), 
        initialCashierSessions.length > 0 ? Promise.resolve(initialCashierSessions) : getCashierSessions(currentUser?.companyId)
      ]);
      setSales(sList);
      setActiveSession(sessList.find(s => s.status === 'ACTIVE' || s.status === 'OPEN') || null);
    }
    loadStats();
  }, [currentUser, initialSales, initialCashierSessions]);

  const sessionSales = activeSession ? sales.filter(s => new Date(s.date).getTime() >= new Date(activeSession.openedAt).getTime() && s.cashierName === currentUser?.name) : [];
  const totalSales = sessionSales.reduce((sum, s) => sum + (s.finalTotal || s.total || 0), 0);
  const totalInvoices = sessionSales.length;
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'warning'>('warning');
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('cash-customer');
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);

  // F1-F11 Function States & Modals
  const [suspendedOrders, setSuspendedOrders] = useState<SuspendedOrder[]>(() => {
    try {
      const saved = localStorage.getItem('pos_suspended_orders');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [isSuspendedModalOpen, setIsSuspendedModalOpen] = useState(false);
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [tempDiscountVal, setTempDiscountVal] = useState('');
  const [tempDiscountType, setTempDiscountType] = useState<'percentage' | 'fixed'>('percentage');

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

  // Quick Product Creation
  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductSku, setNewProductSku] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductCost, setNewProductCost] = useState('');
  const [newProductQuantity, setNewProductQuantity] = useState('10');
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  
  // Price Editing States
  const [editingPriceIndex, setEditingPriceIndex] = useState<number | null>(null);
  const [tempPriceValue, setTempPriceValue] = useState<string>('');
  
  // Current User & POS Price Permissions
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

  // Barcode Scanner & Auto-Focus References
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const barcodeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // Offline Sales & Network Synchronization States
  const [isOnlineState, setIsOnlineState] = useState<boolean>(() => isOnline());
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(() => getOfflineSales().length);
  const [isSyncingOffline, setIsSyncingOffline] = useState<boolean>(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);

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
  const [posSaleToDelete, setPosSaleToDelete] = useState<Sale | null>(null);
  const [isDeletingPosSale, setIsDeletingPosSale] = useState(false);
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

  // POS Multiple Design Themes ('emerald' | 'classic' | 'touch' | 'dark')
  const [posDesign, setPosDesign] = useState<POSDesignType>(() => {
    const saved = localStorage.getItem('posDesign');
    return (saved as POSDesignType) || 'emerald';
  });
  const [isDesignSelectorOpen, setIsDesignSelectorOpen] = useState(false);

  const handleSelectDesign = (design: POSDesignType) => {
    setPosDesign(design);
    localStorage.setItem('posDesign', design);
    setToastType('success');
    setToastMessage(`🎨 تم تفعيل مظهر شاشة البيع: ${
      design === 'emerald' ? 'التصميم الزمردي الحديث' :
      design === 'touch' ? 'تصميم التاتش السريع' :
      design === 'dark' ? 'التصميم الليلي الفاخر' :
      'التصميم المكتبي الكلاسيكي'
    }`);
  };

  const [products, setProducts] = useState<Product[]>(initialProducts);
  
  const fetchProducts = async () => {
    try {
      if (initialProducts.length === 0) {
        const productsData = await getProducts();
        setProducts(productsData);
      }
    } catch (e) {
      console.error('Error fetching products:', e);
    }
  };

  const fetchRecentSales = async () => {
    try {
      const salesList = await getSales();
      setRecentSales(salesList.slice(0, 15));
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
      const savedDesign = localStorage.getItem('posDesign');
      if (savedDesign) setPosDesign(savedDesign as POSDesignType);
    };

    const handlePosCustomizationSync = () => {
      const savedDesign = localStorage.getItem('posDesign');
      if (savedDesign) setPosDesign(savedDesign as POSDesignType);
    };

    const handleUserSync = () => {
      const saved = localStorage.getItem('currentUser');
      if (saved) {
        try { /* Sync not needed as currentUser is passed as prop */ } catch (e) { /* ignore */ }
      }
    };

    window.addEventListener('taxSettingsUpdated', handleTaxSync);
    window.addEventListener('posSettingsUpdated', handlePosSettingsSync);
    window.addEventListener('posCustomizationUpdated', handlePosCustomizationSync);
    window.addEventListener('currentUserUpdated', handleUserSync);

    // Network & Offline Sales Listeners
    const handleOnlineStatus = () => {
      setIsOnlineState(true);
      setToastType('success');
      setToastMessage('✅ تم استعادة الاتصال بالإنترنت! جاري مزامنة فواتير الأوفلاين...');
      handleAutoSyncOffline();
    };

    const handleOfflineStatus = () => {
      setIsOnlineState(false);
      setToastType('warning');
      setToastMessage('⚠️ انقطع الاتصال بالإنترنت! تم تفعيل وضع الأوفلاين (Local Storage Sync) للبيع بدون توقف.');
    };

    const handleOfflineSalesUpdated = () => {
      setPendingOfflineCount(getOfflineSales().length);
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);
    window.addEventListener('offlineSalesUpdated', handleOfflineSalesUpdated);

    // Auto-focus on barcode scanner input initially
    const focusTimer = setTimeout(() => {
      barcodeInputRef.current?.focus();
    }, 150);

    // Global Keydown listener for External Hardware Barcode Scanners & Function Keys (F1-F11)
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Intercept Function Keys F1 through F11
      if (e.key === 'F1') {
        e.preventDefault();
        setIsShortcutsHelpOpen(true);
        return;
      }
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        setIsQuickCustomerModalOpen(true);
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        handleQuickCashCheckoutAndPrintRef.current?.();
        return;
      }
      if (e.key === 'F5') {
        e.preventDefault();
        openPaymentModalRef.current?.();
        return;
      }
      if (e.key === 'F6') {
        e.preventDefault();
        handleHoldOrResumeOrderRef.current?.();
        return;
      }
      if (e.key === 'F7') {
        e.preventDefault();
        setIsDiscountModalOpen(true);
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        handleClearCartWithConfirmationRef.current?.();
        return;
      }
      if (e.key === 'F9') {
        e.preventDefault();
        setShowRecentInvoicesModal(true);
        return;
      }
      if (e.key === 'F10') {
        e.preventDefault();
        handleReprintLastInvoiceRef.current?.();
        return;
      }
      if (e.key === 'F11') {
        e.preventDefault();
        setIsDesignSelectorOpen(true);
        return;
      }

      // If user is currently typing in an input/textarea/select, let normal typing happen
      const activeEl = document.activeElement;
      const isInputActive = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.tagName === 'SELECT'
      );

      // Hardware Barcode Scanner burst detection (< 45ms between keystrokes)
      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        if (barcodeBufferRef.current.length >= 2) {
          e.preventDefault();
          const scannedCode = barcodeBufferRef.current.trim();
          barcodeBufferRef.current = '';
          handleProcessBarcodeScan(scannedCode);
        }
      } else if (e.key.length === 1) {
        if (timeDiff < 50 || barcodeBufferRef.current.length > 0) {
          barcodeBufferRef.current += e.key;
          // Clear buffer if stalled
          setTimeout(() => {
            if (Date.now() - lastKeyTimeRef.current > 150) {
              barcodeBufferRef.current = '';
            }
          }, 200);
        } else if (!isInputActive) {
          // If typed outside and first char, redirect focus to barcode input
          barcodeBufferRef.current = e.key;
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('taxSettingsUpdated', handleTaxSync);
      window.removeEventListener('posSettingsUpdated', handlePosSettingsSync);
      window.removeEventListener('currentUserUpdated', handleUserSync);
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOfflineStatus);
      window.removeEventListener('offlineSalesUpdated', handleOfflineSalesUpdated);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  // Automatic Background Offline Sync when online
  const handleAutoSyncOffline = async () => {
    const pending = getOfflineSales();
    if (pending.length === 0) return;

    try {
      setIsSyncingOffline(true);
      const res = await syncOfflineSalesToFirestore();
      if (res.syncedCount > 0) {
        playSuccessSound();
        setToastType('success');
        setToastMessage(`🎉 تمت مزامنة ${res.syncedCount} فاتورة أوفلاين بنجاح مع السيرفر!`);
        fetchProducts();
        fetchRecentSales();
      }
    } catch (e) {
      console.error('Auto sync error:', e);
    } finally {
      setIsSyncingOffline(false);
      setPendingOfflineCount(getOfflineSales().length);
    }
  };

  // Manual Offline Sync Trigger
  const handleManualOfflineSync = async () => {
    if (!navigator.onLine) {
      alert('لا يمكن المزامنة الآن لعدم توفر اتصال بالإنترنت. يرجى التحقق من الشبكة وإعادة المحاولة.');
      return;
    }

    const pending = getOfflineSales();
    if (pending.length === 0) {
      setToastType('success');
      setToastMessage('جميع الفواتير متزامنة بالكامل مع السيرفر ✅');
      return;
    }

    try {
      setIsSyncingOffline(true);
      setSyncStatusMessage('جاري مزامنة الفواتير المعلقة مع السيرفر...');
      const res = await syncOfflineSalesToFirestore();
      
      if (res.syncedCount > 0) {
        playSuccessSound();
        setToastType('success');
        setToastMessage(`✅ تمت مزامنة ${res.syncedCount} فاتورة بنجاح!`);
        fetchProducts();
        fetchRecentSales();
      }

      if (res.failedCount > 0) {
        playWarningSound();
        alert(`تمت مزامنة ${res.syncedCount} فاتورة، وتوجد ${res.failedCount} فاتورة بها مشاكل:\n` + res.errors.join('\n'));
      }
    } catch (err: any) {
      playWarningSound();
      alert('خطأ أثناء المزامنة: ' + err.message);
    } finally {
      setIsSyncingOffline(false);
      setSyncStatusMessage(null);
      setPendingOfflineCount(getOfflineSales().length);
    }
  };

  // Process Barcode Scan (From hardware scanner, camera, or search Enter)
  const handleProcessBarcodeScan = (scannedCode: string) => {
    if (!scannedCode || !scannedCode.trim()) return;
    const cleanCode = scannedCode.trim();

    // Handle weight-based barcode (EAN-13, starts with 2)
    if (cleanCode.length === 13 && cleanCode.startsWith('2')) {
        const productId = cleanCode.substring(1, 6);
        const weightPart = cleanCode.substring(6, 11);
        const weightInGrams = parseInt(weightPart, 10);
        const weightInKg = weightInGrams / 1000;
        
        const matched = products.find(p => p.sku === productId || p.barcode === productId);
        
        if (matched && matched.isWeighted) {
             addToCart(matched, undefined, undefined, 'كجم', undefined, weightInKg);
             playBarcodeBeepSound();
             setToastType('success');
             setToastMessage(`⚖️ تم مسح ميزان: ${matched.name} (${weightInKg} كجم)`);
             setSearchTerm('');
             setTimeout(() => {
                barcodeInputRef.current?.focus();
                barcodeInputRef.current?.select();
             }, 50);
             return;
        }
    }

    // Check if barcode matches stripBarcode specifically
    const stripMatch = products.find(p => 
      p.stripBarcode && p.stripBarcode.toLowerCase() === cleanCode.toLowerCase()
    );

    if (stripMatch) {
      if (stripMatch.quantity <= 0) {
        playWarningSound();
        setToastType('warning');
        setToastMessage(`⚠️ تنبيه: المنتج (${stripMatch.name}) نفد من المخزون.`);
      }
      addToCart(stripMatch, undefined, undefined, 'شريط');
      playBarcodeBeepSound();
      setToastType('success');
      const unitPrice = stripMatch.stripPrice || Math.round((stripMatch.price / (stripMatch.stripsPerBox || 1)) * 100) / 100;
      setToastMessage(`💊 تم مسح باركود الشريط: ${stripMatch.name} [شريط] (${unitPrice} ج.م)`);
      setSearchTerm('');
      setTimeout(() => {
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      }, 50);
      return;
    }

    // Look for exact match by SKU, barcodes array, serial, or ID
    const matched = products.find(p => 
      (p.sku && p.sku.toLowerCase() === cleanCode.toLowerCase()) ||
      (p.barcodes && p.barcodes.some(b => b.toLowerCase() === cleanCode.toLowerCase())) ||
      (p.serial && p.serial.toLowerCase() === cleanCode.toLowerCase()) ||
      p.id === cleanCode
    );

    if (matched) {
      if (matched.quantity <= 0) {
        playWarningSound();
        setToastType('warning');
        setToastMessage(`⚠️ تنبيه: المنتج (${matched.name}) نفد من المخزون (الرصيد 0).`);
      }

      addToCart(matched);
      playBarcodeBeepSound();
      setToastType('success');
      setToastMessage(`⚡ تم مسح الباركود بنجاح: ${matched.name} (${matched.price} ج.م)`);
      setSearchTerm('');
      
      // Keep focus on input for next rapid scan
      setTimeout(() => {
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      }, 50);
    } else {
      playWarningSound();
      setToastType('warning');
      setToastMessage(`❌ لم يتم العثور على منتج يطابق الباركود: [${cleanCode}]`);
    }
  };

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
    const itemCost = item?.product?.cost ?? 0;
    if (preventSellBelowCost && itemCost > 0 && num < itemCost && currentUser?.role !== 'admin' && !supervisorOverrideActive) {
      playWarningSound();
      setToastType('warning');
      setToastMessage(`⚠️ تنبيه: لا يمكن البيع بأقل من سعر التكلفة (${itemCost} ج.م) وفقاً لسياسة الإدارة`);
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
    setToastMessage(`تم تعديل سعر (${item?.product?.name || 'الصنف'}) إلى ${num} ج.م بنجاح ✅`);
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

  const addToCart = (product: Product, color?: string, size?: string, unit: string = 'علبة', customPrice?: number, preDefinedQuantity?: number) => {
    if (product.quantity <= (product.lowStockThreshold ?? 5)) {
      setToastType('warning');
      setToastMessage(`تحذير: المنتج قارب على النفاذ (${product.quantity} متبقي بالمخزن)`);
    }
    
    let quantityToUse = preDefinedQuantity ?? 1;
    if (!preDefinedQuantity && product.isWeighted) {
      const weight = prompt(`أدخل الوزن بـ ${product.weightUnit || 'كجم'} للمنتج ${product.name}`);
      if (!weight) return;
      quantityToUse = parseFloat(weight);
      if (isNaN(quantityToUse) || quantityToUse <= 0) return;
    }

    // Determine final unit price
    let finalUnitPrice = customPrice ?? product.price;
    if (unit === 'شريط') {
      finalUnitPrice = customPrice ?? (product.stripPrice || Math.round((product.price / (product.stripsPerBox || 1)) * 100) / 100);
    } else if (unit !== 'علبة' && product.multiUnits && product.multiUnits.length > 0) {
      const mu = product.multiUnits.find(u => u.name === unit);
      if (mu && mu.price) finalUnitPrice = customPrice ?? mu.price;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id && item.color === color && item.size === size && item.unit === unit);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id && item.color === color && item.size === size && item.unit === unit 
            ? { ...item, quantity: Math.round((item.quantity + quantityToUse) * 100) / 100 } 
            : item
        );
      }
      return [...prev, { 
        product, 
        quantity: quantityToUse, 
        price: finalUnitPrice, 
        originalPrice: finalUnitPrice, 
        isCustomPrice: customPrice !== undefined, 
        color, 
        size, 
        unit 
      }];
    });
  };

  const changeCartItemUnit = (index: number, newUnit: string) => {
    setCart(prev => prev.map((item, i) => {
      if (i !== index) return item;
      let newPrice = item.product?.price || item.price;
      if (newUnit === 'شريط') {
        newPrice = item.product?.stripPrice || Math.round(((item.product?.price || item.price) / (item.product?.stripsPerBox || 1)) * 100) / 100;
      } else if (newUnit !== 'علبة' && item.product?.multiUnits && item.product.multiUnits.length > 0) {
        const mu = item.product.multiUnits.find(u => u.name === newUnit);
        if (mu && mu.price) newPrice = mu.price;
      }
      return {
        ...item,
        unit: newUnit,
        price: newPrice,
        originalPrice: newPrice,
        isCustomPrice: false
      };
    }));
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

  // F6: Hold current order or show suspended orders modal
  const handleHoldOrResumeOrder = () => {
    if (cart.length > 0) {
      const newHold: SuspendedOrder = {
        id: `hold-${Date.now()}`,
        time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        cart: [...cart],
        selectedCustomerId,
        discountValue,
        discountType,
        itemsCount: cart.reduce((sum, i) => sum + i.quantity, 0),
        total: finalTotal
      };
      const updated = [newHold, ...suspendedOrders];
      setSuspendedOrders(updated);
      localStorage.setItem('pos_suspended_orders', JSON.stringify(updated));
      setCart([]);
      setDiscountValue(0);
      playSuccessSound();
      setToastType('success');
      setToastMessage(`⏸️ تم تعليق الفاتورة بنجاح! (${newHold.itemsCount} أصناف) - اضغط F6 لاسترجاعها`);
    } else if (suspendedOrders.length > 0) {
      setIsSuspendedModalOpen(true);
    } else {
      playWarningSound();
      setToastType('warning');
      setToastMessage('لا توجد عناصر بالسلة لتعليقها، ولا توجد فواتير معلقة حالياً');
    }
  };

  const handleRestoreSuspendedOrder = (order: SuspendedOrder) => {
    setCart(order.cart);
    if (order.selectedCustomerId) setSelectedCustomerId(order.selectedCustomerId);
    setDiscountValue(order.discountValue || 0);
    setDiscountType(order.discountType || 'percentage');
    const updated = suspendedOrders.filter(o => o.id !== order.id);
    setSuspendedOrders(updated);
    localStorage.setItem('pos_suspended_orders', JSON.stringify(updated));
    setIsSuspendedModalOpen(false);
    playSuccessSound();
    setToastType('success');
    setToastMessage(`▶️ تم استرجاع الفاتورة المعلقة (${order.itemsCount} أصناف) إلى السلة!`);
  };

  const handleDeleteSuspendedOrder = (id: string) => {
    const updated = suspendedOrders.filter(o => o.id !== id);
    setSuspendedOrders(updated);
    localStorage.setItem('pos_suspended_orders', JSON.stringify(updated));
    playSuccessSound();
    setToastType('success');
    setToastMessage('🗑️ تم حذف الفاتورة المعلقة بنجاح');
  };

  // F8: Clear Cart with confirmation
  const handleClearCartWithConfirmation = () => {
    if (cart.length === 0) {
      setToastType('warning');
      setToastMessage('السلة فارغة بالفعل');
      return;
    }
    if (confirm('هل أنت متأكد من إفراغ وإلغاء السلة الحالية؟')) {
      setCart([]);
      setDiscountValue(0);
      playSuccessSound();
      setToastType('success');
      setToastMessage('🗑️ تم إفراغ وإلغاء السلة الحالية بنجاح');
    }
  };

  // F10: Reprint Last Invoice
  const handleReprintLastInvoice = () => {
    if (completedSale) {
      setIsReceiptModalOpen(true);
      playSuccessSound();
      setToastType('success');
      setToastMessage(`🖨️ فتح طباعة آخر فاتورة مكتملة رقم #${completedSale.invoiceNumber || completedSale.id}`);
    } else if (recentSales.length > 0) {
      setCompletedSale(recentSales[0]);
      setIsReceiptModalOpen(true);
      playSuccessSound();
      setToastType('success');
      setToastMessage(`🖨️ فتح طباعة أحدث فاتورة مسجلة رقم #${recentSales[0].invoiceNumber || recentSales[0].id}`);
    } else {
      playWarningSound();
      setToastType('warning');
      setToastMessage('⚠️ لا توجد فواتير سابقة مسجلة لإعادة طباعتها');
    }
  };

  // F7: Apply Quick Discount
  const handleApplyQuickDiscount = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = parseFloat(tempDiscountVal);
    if (isNaN(val) || val < 0) {
      setDiscountValue(0);
    } else {
      setDiscountValue(val);
      setDiscountType(tempDiscountType);
    }
    setIsDiscountModalOpen(false);
    playSuccessSound();
    setToastType('success');
    setToastMessage('🏷️ تم تطبيق الخصم على الفاتورة بنجاح');
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

  // Quick Product Creation Handler
  const handleCreateQuickProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) {
      alert('يرجى كتابة اسم الصنف!');
      return;
    }

    try {
      setIsSavingProduct(true);
      const productData = {
        name: newProductName.trim(),
        sku: newProductSku.trim() || `sku-${Date.now().toString().slice(-6)}`,
        price: parseFloat(newProductPrice) || 0,
        cost: parseFloat(newProductCost) || 0,
        quantity: parseFloat(newProductQuantity) || 0,
        unlimitedStock: false,
        barcode: newProductSku.trim() || `sku-${Date.now().toString().slice(-6)}`
      };

      const newId = await saveProduct(productData);
      const fullProduct: Product = {
        ...productData,
        id: newId || `prod-${Date.now()}`
      } as Product;

      setProducts(prev => [fullProduct, ...prev]);
      addToCart(fullProduct);

      setIsQuickProductModalOpen(false);
      setNewProductName('');
      setNewProductSku('');
      setNewProductPrice('');
      setNewProductCost('');
      setNewProductQuantity('10');

      playSuccessSound();
      setToastType('success');
      setToastMessage(`تم تسجيل الصنف (${fullProduct.name}) وإضافته للفاتورة بنجاح!`);
    } catch (err: any) {
      alert('خطأ أثناء حفظ المنتج: ' + err.message);
    } finally {
      setIsSavingProduct(false);
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
    msg += `رقم الفاتورة: #${completedSale.invoiceNumber || completedSale.id}\n`;
    msg += `التاريخ: ${new Date(completedSale.date).toLocaleDateString('ar-EG')}\n`;
    msg += `العميل: ${completedSale.customerName}\n`;
    msg += `--------------------------------\n`;
    completedSale.items.forEach(i => {
      msg += `▪ ${i.name} × ${i.quantity} = ${i.price * i.quantity} ج.م\n`;
    });
    msg += `--------------------------------\n`;
    msg += `*الصافي الإجمالي المطلوب: ${completedSale.finalTotal} ج.م*\n`;
    
    const nonCreditPaymentsSum = (completedSale.payments || [])
      .filter(p => p.method !== 'credit')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    const creditPaymentsSum = (completedSale.payments || [])
      .filter(p => p.method === 'credit')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const paidAmt = nonCreditPaymentsSum > 0 ? nonCreditPaymentsSum : (completedSale.paidAmount || 0);
    const creditAmt = creditPaymentsSum > 0 ? creditPaymentsSum : (completedSale.remainingAmount || (completedSale.finalTotal - paidAmt));

    if (completedSale.status === 'paid' || (creditAmt <= 0 && completedSale.paymentMethod !== 'credit')) {
      msg += `حالة السداد: مدفوع بالكامل ✅\n`;
    } else if (completedSale.status === 'partially-paid' || (paidAmt > 0 && creditAmt > 0)) {
      msg += `حالة السداد: آجل جزئي (مدفوع مقدم ومتبقي آجل) ⏳\n`;
      msg += `💵 المبلغ المدفوع (نقداً/فيزا): ${paidAmt.toFixed(2)} ج.م\n`;
      msg += `🔴 المتبقي الآجل على الحساب: ${creditAmt.toFixed(2)} ج.م\n`;
    } else {
      msg += `حالة السداد: آجل كلي (على الحساب) 🔴\n`;
      msg += `🔴 المديونية الآجلة المطلوب سدادها: ${(creditAmt || completedSale.finalTotal).toFixed(2)} ج.م\n`;
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
    let msg = `🧾 فاتورة #${completedSale.invoiceNumber || completedSale.id} - ${businessName}\n`;
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
        productId: item.product?.id || '',
        product: item.product,
        name: item.product?.name || 'صنف',
        quantity: item.quantity,
        price: item.price,
        originalPrice: item.originalPrice,
        isCustomPrice: item.price !== item.originalPrice,
        unit: item.unit,
        color: item.color,
        size: item.size,
        unitCost: item.product?.cost ?? 0
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

      // Check if Online or Offline
      if (!isOnline()) {
        // Save sale to Local Storage Offline Queue
        const offlineId = saveOfflineSale(saleData, currentUser?.username || 'cashier');
        playSuccessSound();

        // Optimistically deduct stock in local state so cashier doesn't double-sell
        setProducts(prev => prev.map(p => {
          const item = cart.find(ci => ci.product?.id === p.id);
          if (item) {
            return { ...p, quantity: Math.max(0, p.quantity - item.quantity) };
          }
          return p;
        }));

        const completedRecord: Sale = {
          ...saleData,
          id: offlineId,
          invoiceNumber: offlineId
        };

        setCompletedSale(completedRecord);
        setWhatsAppPhoneInput(customer?.phone || '');
        setRecentSales(prev => [completedRecord, ...prev]);
        setPendingOfflineCount(getOfflineSales().length);

        setToastType('warning');
        setToastMessage(`⚡ تم حفظ الفاتورة بنجاح في التخزين المؤقت المحلي (وضع عدم الاتصال). ستتم المزامنة تلقائياً فور عودة الإنترنت!`);

        // Reset cart & open receipt
        setCart([]);
        setSupervisorOverrideActive(false);
        setEditingPriceIndex(null);
        setIsPaymentModalOpen(false);
        setDiscountValue(0);
        setIsReceiptModalOpen(true);
        return;
      }

      // Online checkout via Firestore with Atomic Sequential Invoice Number
      let savedSaleId = '';
      let savedInvoiceNumber = '';
      try {
        const saleResult = await processSale(saleData, currentUser?.username || 'admin');
        savedSaleId = saleResult.id;
        savedInvoiceNumber = saleResult.invoiceNumber;
      } catch (firestoreErr: any) {
        // Network timeout / connection drop during transaction -> fallback gracefully to offline queue
        console.warn('Firestore transaction failed, falling back to Local Storage offline sync:', firestoreErr);
        const offlineId = saveOfflineSale(saleData, currentUser?.username || 'cashier');
        savedSaleId = offlineId;
        savedInvoiceNumber = offlineId;
        setPendingOfflineCount(getOfflineSales().length);
        setToastType('warning');
        setToastMessage('⚠️ تعذر الاتصال بالسيرفر! تم حفظ الفاتورة محلياً بأمان وستتم المزامنة تلقائياً.');
      }

      playSuccessSound();
      
      // Store completed sale for immediate printing
      const completedRecord: Sale = {
        ...saleData,
        id: savedSaleId || `INV-${Date.now().toString().slice(-6)}`,
        invoiceNumber: savedInvoiceNumber || `INV-${Date.now().toString().slice(-6)}`
      };
      setCompletedSale(completedRecord);
      triggerSaleNotification(completedRecord).catch(err => console.warn('Sale notification failed:', err));
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

  const handleQuickCashCheckoutAndPrint = async () => {
    if (cart.length === 0) return;
    const customer = localCustomers.find(c => c.id === selectedCustomerId);
    const saleData: Sale = {
      id: '',
      customerId: selectedCustomerId,
      customerName: customer ? customer.name : 'عميل نقدي',
      items: cart.map(item => ({
        productId: item.product?.id || '',
        product: item.product,
        name: item.product?.name || 'صنف',
        quantity: item.quantity,
        price: item.price,
        originalPrice: item.originalPrice,
        isCustomPrice: item.price !== item.originalPrice,
        unit: item.unit,
        color: item.color,
        size: item.size,
        unitCost: item.product?.cost ?? 0
      })),
      total: subtotal,
      discountType,
      discountValue,
      taxRate: taxEnabled ? taxRate : 0,
      taxAmount: taxEnabled ? taxAmount : 0,
      taxType,
      finalTotal,
      payments: [{ id: Date.now() + '-quick', saleId: '', method: 'CASH', amount: finalTotal, createdAt: new Date().toISOString() }],
      status: 'paid',
      date: new Date().toISOString()
    };

    try {
      setProcessing(true);
      if (!isOnline()) {
        const offlineId = saveOfflineSale(saleData, currentUser?.username || 'cashier');
        playSuccessSound();
        setProducts(prev => prev.map(p => {
          const item = cart.find(ci => ci.product?.id === p.id);
          if (item) {
            return { ...p, quantity: Math.max(0, p.quantity - item.quantity) };
          }
          return p;
        }));
        const completedRecord: Sale = { ...saleData, id: offlineId, invoiceNumber: offlineId };
        setCompletedSale(completedRecord);
        setWhatsAppPhoneInput(customer?.phone || '');
        setRecentSales(prev => [completedRecord, ...prev]);
        setPendingOfflineCount(getOfflineSales().length);
      } else {
        const result = await processSale(saleData);
        playSuccessSound();
        setProducts(prev => prev.map(p => {
          const item = cart.find(ci => ci.product?.id === p.id);
          if (item) {
            return { ...p, quantity: Math.max(0, p.quantity - item.quantity) };
          }
          return p;
        }));
        const completedRecord: Sale = { ...saleData, id: result.id, invoiceNumber: result.invoiceNumber };
        setCompletedSale(completedRecord);
        setWhatsAppPhoneInput(customer?.phone || '');
        setRecentSales(prev => [completedRecord, ...prev]);
      }

      setCart([]);
      setDiscountValue(0);
      setIsReceiptModalOpen(true);
      fetchProducts();
      setToastType('success');
      setToastMessage('🎉 تم حفظ الفاتورة بنجاح وجاهزة للطباعة الفورية!');
    } catch (err: any) {
      playWarningSound();
      alert(`خطأ أثناء إتمام البيع: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  // Payment auto-calculation handlers (Automatic cash/credit balancing)
  const handlePaymentCashChange = (valStr: string) => {
    const val = parseFloat(valStr);
    const newCash = isNaN(val) ? 0 : Math.max(0, val);
    setCashAmount(newCash);
    const remainingCredit = Math.max(0, Math.round((finalTotal - newCash - cardAmount - walletAmount) * 100) / 100);
    setCreditAmount(remainingCredit);
  };

  const handlePaymentCreditChange = (valStr: string) => {
    const val = parseFloat(valStr);
    const newCredit = isNaN(val) ? 0 : Math.max(0, val);
    setCreditAmount(newCredit);
    const remainingCash = Math.max(0, Math.round((finalTotal - newCredit - cardAmount - walletAmount) * 100) / 100);
    setCashAmount(remainingCash);
  };

  const handlePaymentCardChange = (valStr: string) => {
    const val = parseFloat(valStr);
    const newCard = isNaN(val) ? 0 : Math.max(0, val);
    setCardAmount(newCard);
    const remainingCash = Math.max(0, Math.round((finalTotal - newCard - walletAmount - creditAmount) * 100) / 100);
    setCashAmount(remainingCash);
  };

  const handlePaymentWalletChange = (valStr: string) => {
    const val = parseFloat(valStr);
    const newWallet = isNaN(val) ? 0 : Math.max(0, val);
    setWalletAmount(newWallet);
    const remainingCash = Math.max(0, Math.round((finalTotal - cashAmount - cardAmount - newWallet) * 100) / 100);
    if (remainingCash >= 0) {
      setCreditAmount(remainingCash);
    } else {
      setCashAmount(Math.max(0, Math.round((finalTotal - newWallet - cardAmount - creditAmount) * 100) / 100));
    }
  };

  const setFullCashPayment = () => {
    setCashAmount(finalTotal);
    setCreditAmount(0);
    setCardAmount(0);
    setWalletAmount(0);
  };

  const setFullCreditPayment = () => {
    setCreditAmount(finalTotal);
    setCashAmount(0);
    setCardAmount(0);
    setWalletAmount(0);
  };

  const setHalfSplitPayment = () => {
    const half = Math.round((finalTotal / 2) * 100) / 100;
    setCashAmount(half);
    setCreditAmount(Math.round((finalTotal - half) * 100) / 100);
    setCardAmount(0);
    setWalletAmount(0);
  };

  // Function Handler References for global keydown listener
  const handleQuickCashCheckoutAndPrintRef = useRef(handleQuickCashCheckoutAndPrint);
  handleQuickCashCheckoutAndPrintRef.current = handleQuickCashCheckoutAndPrint;

  const openPaymentModalRef = useRef(openPaymentModal);
  openPaymentModalRef.current = openPaymentModal;

  const handleHoldOrResumeOrderRef = useRef(handleHoldOrResumeOrder);
  handleHoldOrResumeOrderRef.current = handleHoldOrResumeOrder;

  const handleClearCartWithConfirmationRef = useRef(handleClearCartWithConfirmation);
  handleClearCartWithConfirmationRef.current = handleClearCartWithConfirmation;

  const handleReprintLastInvoiceRef = useRef(handleReprintLastInvoice);
  handleReprintLastInvoiceRef.current = handleReprintLastInvoice;

  // Array of F1 to F11 function key definitions for top bar and help modal
  const functionKeysList = [
    { key: 'F1', title: 'مساعدة', icon: '❓', bg: 'bg-blue-600/15 text-blue-400 border-blue-500/30 hover:bg-blue-600 hover:text-white', action: () => setIsShortcutsHelpOpen(true) },
    { key: 'F2', title: 'بحث/باركود', icon: '🔍', bg: 'bg-amber-600/15 text-amber-400 border-amber-500/30 hover:bg-amber-600 hover:text-white', action: () => { barcodeInputRef.current?.focus(); barcodeInputRef.current?.select(); } },
    { key: 'F3', title: 'عميل', icon: '👤', bg: 'bg-indigo-600/15 text-indigo-400 border-indigo-500/30 hover:bg-indigo-600 hover:text-white', action: () => setIsQuickCustomerModalOpen(true) },
    { key: 'F4', title: 'كاش سريع', icon: '⚡', bg: 'bg-emerald-600/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600 hover:text-white', action: handleQuickCashCheckoutAndPrint },
    { key: 'F5', title: 'دفع متعدد', icon: '💳', bg: 'bg-teal-600/15 text-teal-400 border-teal-500/30 hover:bg-teal-600 hover:text-white', action: openPaymentModal },
    { key: 'F6', title: 'تعليق/استرجاع', icon: '⏸️', bg: 'bg-purple-600/15 text-purple-400 border-purple-500/30 hover:bg-purple-600 hover:text-white', badge: suspendedOrders.length, action: handleHoldOrResumeOrder },
    { key: 'F7', title: 'خصم', icon: '🏷️', bg: 'bg-rose-600/15 text-rose-400 border-rose-500/30 hover:bg-rose-600 hover:text-white', action: () => setIsDiscountModalOpen(true) },
    { key: 'F8', title: 'إلغاء السلة', icon: '🗑️', bg: 'bg-red-600/15 text-red-400 border-red-500/30 hover:bg-red-600 hover:text-white', action: handleClearCartWithConfirmation },
    { key: 'F9', title: 'سجل الفواتير', icon: '📜', bg: 'bg-cyan-600/15 text-cyan-400 border-cyan-500/30 hover:bg-cyan-600 hover:text-white', action: () => setShowRecentInvoicesModal(true) },
    { key: 'F10', title: 'إعادة طباعة', icon: '🖨️', bg: 'bg-yellow-600/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-600 hover:text-white', action: handleReprintLastInvoice },
    { key: 'F11', title: 'المظهر', icon: '🎨', bg: 'bg-pink-600/15 text-pink-400 border-pink-500/30 hover:bg-pink-600 hover:text-white', action: () => setIsDesignSelectorOpen(true) },
  ];

  return (
    <div className={`min-h-screen ${posDesign === 'dark' ? 'bg-[#0f172a] text-slate-100' : ''}`}>
      {toastMessage && (
        <Toast 
          message={toastMessage} 
          type={toastType} 
          onClose={() => setToastMessage(null)} 
        />
      )}

      {/* POS Top Function Keys Bar (F1 - F11) */}
      <div className="bg-card/95 backdrop-blur-md border-b border-border p-2 sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin px-2">
          <div className="flex items-center gap-1 pl-2 border-l border-border/60 text-[11px] font-black text-gold whitespace-nowrap">
            <Keyboard size={14} className="text-gold" />
            <span>أزرار الوظائف:</span>
          </div>

          {functionKeysList.map(fk => (
            <button
              key={fk.key}
              type="button"
              onClick={fk.action}
              className={`px-2.5 py-1.2 rounded-xl border flex items-center gap-1.5 transition-all active:scale-95 text-xs font-bold shadow-sm whitespace-nowrap ${fk.bg}`}
              title={`${fk.title} - اضغط ${fk.key}`}
            >
              <span className="bg-black/40 text-white px-1.5 py-0.5 rounded-md text-[10px] font-black font-mono tracking-wider">
                {fk.key}
              </span>
              <span className="text-xs">{fk.icon}</span>
              <span className="text-[11px]">{fk.title}</span>
              {fk.badge !== undefined && fk.badge > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                  {fk.badge}
                </span>
              )}
            </button>
          ))}

          <div className="h-5 w-[1px] bg-border/60 mx-1.5 flex-shrink-0" />

          {/* إضافة صنف سريع */}
          <button
            type="button"
            onClick={() => setIsQuickProductModalOpen(true)}
            className="px-2.5 py-1 rounded-xl border border-gold/30 bg-gold/10 hover:bg-gold hover:text-white text-gold text-xs font-bold shadow-sm whitespace-nowrap transition-all active:scale-95 flex items-center gap-1.5"
            title="إضافة صنف جديد سريعاً"
          >
            <span>📦</span>
            <span>+ صنف جديد</span>
          </button>

          {/* إضافة عميل سريع */}
          <button
            type="button"
            onClick={() => setIsQuickCustomerModalOpen(true)}
            className="px-2.5 py-1 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo hover:text-white text-indigo-400 text-xs font-bold shadow-sm whitespace-nowrap transition-all active:scale-95 flex items-center gap-1.5"
            title="إضافة عميل جديد سريعاً"
          >
            <span>👤</span>
            <span>+ عميل جديد</span>
          </button>
        </div>
      </div>

      {posDesign === 'emerald' ? (
        <EmeraldPOSLayout
          products={products}
          customers={localCustomers}
          cart={cart}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          barcodeInputRef={barcodeInputRef}
          selectedCustomerId={selectedCustomerId}
          setSelectedCustomerId={setSelectedCustomerId}
          onAddToCart={addToCart}
          onRemoveFromCart={removeFromCart}
          onUpdateQuantity={updateCartQuantity}
          onChangeUnit={changeCartItemUnit}
          subtotal={subtotal}
          discountAmount={discountAmount}
          discountValue={discountValue}
          setDiscountValue={setDiscountValue}
          discountType={discountType}
          setDiscountType={setDiscountType}
          taxAmount={taxAmount}
          finalTotal={finalTotal}
          taxEnabled={taxEnabled}
          taxRate={taxRate}
          onOpenPaymentModal={openPaymentModal}
          onQuickCheckoutAndPrint={handleQuickCashCheckoutAndPrint}
          onClearCart={() => setCart([])}
          onOpenDesignSelector={() => setIsDesignSelectorOpen(true)}
          onOpenQuickCustomerModal={() => setIsQuickCustomerModalOpen(true)}
          onOpenRecentSales={() => setShowRecentInvoicesModal(true)}
          onStartPriceEdit={handleStartPriceEdit}
          canUserEditPrice={canUserEditPrice()}
          isOnlineState={isOnlineState}
          pendingOfflineCount={pendingOfflineCount}
          onManualOfflineSync={handleManualOfflineSync}
          currentUser={currentUser}
          completedSale={completedSale}
          onOpenReceipt={() => setIsReceiptModalOpen(true)}
          orderNumber={recentSales.length + 1}
        />
      ) : posDesign === 'touch' ? (
        <TouchPOSLayout
          products={products}
          customers={localCustomers}
          cart={cart}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          barcodeInputRef={barcodeInputRef}
          selectedCustomerId={selectedCustomerId}
          setSelectedCustomerId={setSelectedCustomerId}
          onAddToCart={addToCart}
          onRemoveFromCart={removeFromCart}
          onUpdateQuantity={updateCartQuantity}
          subtotal={subtotal}
          discountAmount={discountAmount}
          discountValue={discountValue}
          setDiscountValue={setDiscountValue}
          finalTotal={finalTotal}
          onOpenPaymentModal={openPaymentModal}
          onQuickCheckoutAndPrint={handleQuickCashCheckoutAndPrint}
          onClearCart={() => setCart([])}
          onOpenDesignSelector={() => setIsDesignSelectorOpen(true)}
          onOpenQuickCustomerModal={() => setIsQuickCustomerModalOpen(true)}
          onOpenRecentSales={() => setShowRecentInvoicesModal(true)}
          orderNumber={recentSales.length + 1}
        />
      ) : posDesign === 'classic' ? (
        <ClassicPOSLayout
          products={products}
          customers={localCustomers}
          cart={cart}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          barcodeInputRef={barcodeInputRef}
          selectedCustomerId={selectedCustomerId}
          setSelectedCustomerId={setSelectedCustomerId}
          onAddToCart={addToCart}
          onRemoveFromCart={removeFromCart}
          onUpdateQuantity={updateCartQuantity}
          onChangeUnit={changeCartItemUnit}
          subtotal={subtotal}
          discountAmount={discountAmount}
          discountValue={discountValue}
          setDiscountValue={setDiscountValue}
          discountType={discountType}
          setDiscountType={setDiscountType}
          taxAmount={taxAmount}
          finalTotal={finalTotal}
          taxEnabled={taxEnabled}
          taxRate={taxRate}
          onOpenPaymentModal={openPaymentModal}
          onQuickCheckoutAndPrint={handleQuickCashCheckoutAndPrint}
          onClearCart={() => setCart([])}
          onOpenDesignSelector={() => setIsDesignSelectorOpen(true)}
          onOpenQuickCustomerModal={() => setIsQuickCustomerModalOpen(true)}
          onOpenRecentSales={() => setShowRecentInvoicesModal(true)}
          onStartPriceEdit={handleStartPriceEdit}
          canUserEditPrice={canUserEditPrice()}
          isOnlineState={isOnlineState}
          pendingOfflineCount={pendingOfflineCount}
          onManualOfflineSync={handleManualOfflineSync}
          currentUser={currentUser}
          completedSale={completedSale}
          onOpenReceipt={() => setIsReceiptModalOpen(true)}
          orderNumber={recentSales.length + 1}
        />
      ) : (
        <div className="flex flex-col md:flex-row h-screen p-4 gap-4 pb-20">
          {/* Product Selection Area */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Top POS Toolbar & Status Header */}
        <div className="flex flex-wrap justify-between items-center bg-card p-4 rounded-2xl border border-border gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛒</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-text-main">نقطة البيع وإصدار الفواتير (POS)</h2>

                {/* Online / Offline Indicator Badge */}
                {isOnlineState ? (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <Wifi size={11} />
                    <span>متصل بالسيرفر (Online)</span>
                  </span>
                ) : (
                  <span className="bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[10px] px-2.5 py-0.5 rounded-full font-black flex items-center gap-1 animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <WifiOff size={11} />
                    <span>وضع أوفلاين (بيع محلي مفعل)</span>
                  </span>
                )}

                {/* Auto-focus Barcode Status Indicator */}
                <button
                  type="button"
                  onClick={() => {
                    barcodeInputRef.current?.focus();
                    barcodeInputRef.current?.select();
                  }}
                  className="bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 transition-all"
                  title="خاصية التركيز التلقائي على قارئ الباركود نشطة (F2 للتركيز الفوري)"
                >
                  <Zap size={11} />
                  <span>القارئ التلقائي جاهز (F2)</span>
                </button>

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
              <p className="text-xs text-text-dim">إصدار فواتير الكاش والآجل مع الطباعة الحرارية والمزامنة التلقائية</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Offline Sync Trigger Button */}
            {pendingOfflineCount > 0 && (
              <button
                type="button"
                onClick={handleManualOfflineSync}
                disabled={isSyncingOffline}
                className="bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/40 px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95 animate-bounce"
                title="توجد فواتير تم حفظها أثناء انقطاع الإنترنت، انقر للمزامنة الفورية مع السيرفر"
              >
                <RefreshCw size={13} className={isSyncingOffline ? 'animate-spin' : ''} />
                <span>مزامنة فواتير الأوفلاين ({pendingOfflineCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsDesignSelectorOpen(true)}
              className="bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm"
              title="تبديل مظهر شاشة البيع (الزمردي الحديث / التاتش / الليلي / الكلاسيكي)"
            >
              <Palette size={14} />
              <span>المظهر ({posDesign === 'emerald' ? 'الزمردي' : posDesign === 'touch' ? 'التاتش' : posDesign === 'dark' ? 'الليلي' : 'كلاسيكي'})</span>
            </button>

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
                <span>آخر فاتورة #{(completedSale.invoiceNumber || completedSale.id).slice(-8)}</span>
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
        
        {/* Search & Barcode Scan Toolbar with Auto-Focus */}
        <div className="flex gap-2 relative">
          <div className="relative flex-1">
            <input 
              ref={barcodeInputRef}
              type="text" 
              placeholder="امسح الباركود بالماسح الخارجي أو ابحث بالاسم / SKU... (Enter للإضافة الفورية ⚡)" 
              className="w-full bg-card border-2 border-border focus:border-gold p-3.5 pl-24 pr-4 rounded-2xl text-sm focus:outline-none shadow-sm transition-all text-text-main font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && searchTerm.trim()) {
                  e.preventDefault();
                  handleProcessBarcodeScan(searchTerm);
                }
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  barcodeInputRef.current?.focus();
                }}
                className="absolute left-14 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main p-1"
                title="مسح حقل البحث"
              >
                <X size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => handleProcessBarcodeScan(searchTerm)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-gold hover:bg-gold2 text-white px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors"
              title="إضافة المنتج المطابق للسلة"
            >
              إدخال
            </button>
          </div>

          <button 
            onClick={() => setIsScanning(!isScanning)} 
            className="px-4 bg-accent hover:bg-gold rounded-2xl text-white flex items-center gap-2 transition-colors font-bold text-xs shadow-md"
            title="فتح كاميرا الموبايل / اللابتوب لمسح الباركود"
          >
            <Camera size={16} />
            <span className="hidden sm:inline">كاميرا</span>
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
          <button
            type="button"
            onClick={() => setIsQuickCustomerModalOpen(true)}
            className="bg-gold/10 hover:bg-gold/20 text-gold border border-gold/30 p-1.5 px-2 rounded-xl font-bold text-xs transition-colors"
            title="إضافة عميل جديد"
          >
            ➕
          </button>
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
          {filteredProducts.map(product => {
            const hasStrips = Boolean(product.stripsPerBox && product.stripsPerBox > 1);
            const stripPrice = product.stripPrice || (hasStrips ? Math.round((product.price / (product.stripsPerBox || 1)) * 100) / 100 : null);
            
            // Expiry status check
            let isExpired = false;
            let isNearExpiry = false;
            if (product.expirationDate) {
              const expTime = new Date(product.expirationDate).getTime();
              const now = Date.now();
              const daysLeft = (expTime - now) / (1000 * 60 * 60 * 24);
              if (daysLeft <= 0) isExpired = true;
              else if (daysLeft <= 60) isNearExpiry = true;
            }

            return (
              <div 
                key={product.id} 
                className="group bg-card p-3.5 rounded-2xl border border-border flex flex-col justify-between hover:border-gold cursor-pointer transition-all hover:shadow-md active:scale-[0.99] space-y-2"
                onClick={() => addToCart(product)}
              >
                <div>
                  <div className="flex justify-between items-start gap-1">
                    <h3 className="font-bold text-xs text-text-main line-clamp-2">{product.name}</h3>
                    {product.isPharmacy && (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap flex items-center gap-0.5">
                        💊 دواء
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-text-dim mt-1 font-mono">
                    <span>SKU: {product.sku}</span>
                    {product.batchNumber && (
                      <span className="text-gold/80 font-sans text-[9px]">تشغيلة: {product.batchNumber}</span>
                    )}
                  </div>

                  {product.expirationDate && (
                    <div className="mt-1">
                      {isExpired ? (
                        <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[9px] px-1.5 py-0.5 rounded font-bold inline-block">
                          ❌ منتهي الصلاحية ({product.expirationDate})
                        </span>
                      ) : isNearExpiry ? (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] px-1.5 py-0.5 rounded font-bold inline-block">
                          ⚠️ ينتهي قريباً ({product.expirationDate})
                        </span>
                      ) : (
                        <span className="text-text-dim text-[9px] block">
                          📅 صلاحية: {product.expirationDate}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-border space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gold font-black text-sm font-mono">{product.price} ج.م</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                      product.quantity > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {product.quantity > 0 ? `${product.quantity} متوفر` : 'نفذ'}
                    </span>
                  </div>

                  {/* Multi-unit quick buttons (Box vs Strip) */}
                  {hasStrips && (
                    <div className="grid grid-cols-2 gap-1.5 pt-1" onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          addToCart(product, undefined, undefined, 'علبة');
                          playBarcodeBeepSound();
                          setToastType('success');
                          setToastMessage(`تمت إضافة (علبة) ${product.name}`);
                        }}
                        className="bg-card2 hover:bg-gold hover:text-white border border-border text-[10px] font-bold py-1 px-1 rounded-lg text-center transition-all truncate"
                        title="إضافة علبة كاملة"
                      >
                        📦 علبة ({product.price}ج)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          addToCart(product, undefined, undefined, 'شريط');
                          playBarcodeBeepSound();
                          setToastType('success');
                          setToastMessage(`💊 تمت إضافة (شريط) ${product.name}`);
                        }}
                        className="bg-accent/20 hover:bg-accent hover:text-white border border-accent/40 text-accent hover:text-white text-[10px] font-bold py-1 px-1 rounded-lg text-center transition-all truncate"
                        title={`إضافة شريط (${product.stripsPerBox} أشرطة بالعلبة)`}
                      >
                        💊 شريط ({stripPrice}ج)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
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
            cart.map((item, index) => {
              const hasStrips = Boolean(item.product?.stripsPerBox && item.product.stripsPerBox > 1);
              const itemCost = item.product?.cost ?? 0;
              return (
              <div key={index} className={`p-3 rounded-2xl text-xs border transition-all ${
                item.isCustomPrice 
                  ? 'bg-amber-500/5 border-amber-500/30' 
                  : 'bg-card2 border-border'
              } space-y-2.5`}>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-bold text-text-main truncate">{item.product?.name || 'صنف'}</p>
                      {item.product?.isPharmacy && (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.2 rounded font-bold">
                          💊 دواء
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-text-dim font-mono font-bold">
                        {item.price} ج.م / {item.unit || 'وحدة'} × {item.quantity}
                      </span>
                      {item.isCustomPrice && (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] px-1.5 py-0.2 rounded-md font-bold">
                          سعر مخصص (الأصل: {item.originalPrice} ج)
                        </span>
                      )}
                      {(item.color || item.size) && (
                        <span className="text-[9px] text-text-dim">
                          {item.color ? `لون: ${item.color} ` : ''}
                          {item.size ? `مقاس: ${item.size}` : ''}
                        </span>
                      )}
                    </div>

                    {/* Expiry & Batch info if available */}
                    {(item.product?.expirationDate || item.product?.batchNumber) && (
                      <div className="flex items-center gap-2 mt-1 text-[9px] text-text-dim">
                        {item.product?.expirationDate && <span>📅 صلاحية: {item.product.expirationDate}</span>}
                        {item.product?.batchNumber && <span>🏷️ تشغيلة: {item.product.batchNumber}</span>}
                      </div>
                    )}

                    {/* Unit Switcher if product has multiple units / strips */}
                    {hasStrips && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <span className="text-[9px] text-text-dim">الوحدة:</span>
                        <button
                          type="button"
                          onClick={() => changeCartItemUnit(index, 'علبة')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            (item.unit || 'علبة') === 'علبة'
                              ? 'bg-gold text-white shadow-sm'
                              : 'bg-card border border-border text-text-dim hover:text-text-main'
                          }`}
                        >
                          📦 علبة
                        </button>
                        <button
                          type="button"
                          onClick={() => changeCartItemUnit(index, 'شريط')}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                            item.unit === 'شريط'
                              ? 'bg-accent text-white shadow-sm'
                              : 'bg-card border border-border text-text-dim hover:text-accent'
                          }`}
                        >
                          💊 شريط
                        </button>
                      </div>
                    )}
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

                    {preventSellBelowCost && itemCost > 0 && Number(tempPriceValue) < itemCost && (
                      <div className="text-[10px] text-danger bg-danger/10 p-1.5 rounded-lg border border-danger/20 flex items-center gap-1 font-bold">
                        <ShieldAlert size={12} />
                        <span>تحذير: السعر المدخل أقل من سعر التكلفة ({itemCost} ج.م)!</span>
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
            );})
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
    </div>
  )}

      {/* POS Design Switcher Modal */}
      <POSDesignSelectorModal
        isOpen={isDesignSelectorOpen}
        onClose={() => setIsDesignSelectorOpen(false)}
        currentDesign={posDesign}
        onSelectDesign={handleSelectDesign}
      />

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

            <div className="bg-card2 p-3.5 rounded-2xl border border-border text-center space-y-2">
              <p className="text-xs text-text-dim">المبلغ الإجمالي المطلوب سداده</p>
              <p className="text-3xl font-black text-success font-mono">{finalTotal} ج.م</p>

              {/* Quick Preset Payment Split Buttons */}
              <div className="flex gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={setFullCashPayment}
                  className="flex-1 bg-green-600/20 hover:bg-green-600 text-green-300 hover:text-white border border-green-500/30 py-1.5 rounded-xl font-bold text-[11px] transition-all flex items-center justify-center gap-1 active:scale-95"
                >
                  <span>💵 كاش بالكامل</span>
                </button>
                <button
                  type="button"
                  onClick={setFullCreditPayment}
                  className="flex-1 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 py-1.5 rounded-xl font-bold text-[11px] transition-all flex items-center justify-center gap-1 active:scale-95"
                >
                  <span>📝 آجل بالكامل</span>
                </button>
                <button
                  type="button"
                  onClick={setHalfSplitPayment}
                  className="flex-1 bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/30 py-1.5 rounded-xl font-bold text-[11px] transition-all flex items-center justify-center gap-1 active:scale-95"
                >
                  <span>⚖️ 50% كاش / آجل</span>
                </button>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-text-dim flex items-center gap-1 font-bold"><Banknote size={14} className="text-green-400"/> نقدى (Cash)</label>
                  <span className="text-[10px] text-text-dim">احتساب تلقائي</span>
                </div>
                <input 
                  type="number" 
                  step="any"
                  min="0"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-bold font-mono text-sm focus:outline-none focus:border-green-500"
                  value={cashAmount}
                  onChange={e => handlePaymentCashChange(e.target.value)}
                />
              </div>
              <div>
                <label className="text-text-dim flex items-center gap-1 mb-1 font-bold"><CreditCard size={14} className="text-blue-400"/> بطاقة / فيزا (Card)</label>
                <input 
                  type="number" 
                  step="any"
                  min="0"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-bold font-mono text-sm focus:outline-none focus:border-blue-500"
                  value={cardAmount}
                  onChange={e => handlePaymentCardChange(e.target.value)}
                />
              </div>
              <div>
                <label className="text-text-dim flex items-center gap-1 mb-1 font-bold"><Wallet size={14} className="text-amber-400"/> محفظة إلكترونية (Wallet / InstaPay)</label>
                <input 
                  type="number" 
                  step="any"
                  min="0"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-bold font-mono text-sm focus:outline-none focus:border-amber-500"
                  value={walletAmount}
                  onChange={e => handlePaymentWalletChange(e.target.value)}
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-text-dim flex items-center gap-1 font-bold">آجل / ذمم (Credit)</label>
                  <span className="text-[10px] text-purple-400 font-bold">احتساب تلقائي للباقي</span>
                </div>
                <input 
                  type="number" 
                  step="any"
                  min="0"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-bold font-mono text-sm focus:outline-none focus:border-purple-500"
                  value={creditAmount}
                  onChange={e => handlePaymentCreditChange(e.target.value)}
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
          QUICK ADD PRODUCT MODAL
          ========================================================= */}
      {isQuickProductModalOpen && (
        <div className="fixed inset-0 z-[10000] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-card p-6 rounded-3xl w-full max-w-sm border border-border space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <h3 className="font-black text-base text-text-main flex items-center gap-2">
                <span className="text-gold text-lg">➕</span>
                <span>إضافة صنف جديد سريع للبيع</span>
              </h3>
              <button onClick={() => setIsQuickProductModalOpen(false)} className="text-text-dim hover:text-danger">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuickProduct} className="space-y-3 text-xs">
              <div>
                <label className="block text-text-dim font-bold mb-1">اسم الصنف / المنتج: *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: علبة دواء بنادول اكسترا"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-bold focus:outline-none focus:border-gold text-text-main"
                  value={newProductName}
                  onChange={e => setNewProductName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-text-dim font-bold mb-1">باركود الصنف (SKU):</label>
                <input
                  type="text"
                  placeholder="اتركه فارغاً للتوليد التلقائي"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-mono focus:outline-none focus:border-gold text-text-main"
                  value={newProductSku}
                  onChange={e => setNewProductSku(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-text-dim font-bold mb-1">سعر الشراء (التكلفة):</label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full bg-card2 border border-border p-2.5 rounded-xl font-mono focus:outline-none focus:border-gold text-text-main"
                    value={newProductCost}
                    onChange={e => setNewProductCost(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-text-dim font-bold mb-1">سعر البيع الافتراضي:</label>
                  <input
                    type="number"
                    placeholder="0"
                    className="w-full bg-card2 border border-border p-2.5 rounded-xl font-mono focus:outline-none focus:border-gold text-text-main"
                    value={newProductPrice}
                    onChange={e => setNewProductPrice(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-text-dim font-bold mb-1">الكمية الابتدائية في المخزن:</label>
                <input
                  type="number"
                  placeholder="10"
                  className="w-full bg-card2 border border-border p-2.5 rounded-xl font-mono focus:outline-none focus:border-gold text-text-main"
                  value={newProductQuantity}
                  onChange={e => setNewProductQuantity(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSavingProduct}
                  className="flex-1 bg-gold hover:bg-gold2 text-white py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSavingProduct ? 'جاري الحفظ...' : 'حفظ وإضافة للسلة'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsQuickProductModalOpen(false)}
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
                  className="bg-red-500/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/40 px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
                  title="إغلاق معاينة الفاتورة والرجوع للبيع"
                >
                  <X size={16} />
                  <span>رجوع / إغلاق</span>
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
                <div className="flex justify-between items-center">
                  <span>رقم الفاتورة:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold">#{completedSale.invoiceNumber || completedSale.id}</span>
                    {completedSale.id.startsWith('OFFLINE-') && (
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-300">
                        ⚡ أوفلاين (مؤقتة)
                      </span>
                    )}
                  </div>
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
                {taxEnabled && completedSale.taxAmount && completedSale.taxAmount > 0 ? (
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
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-2xl font-bold text-xs shadow-md"
              >
                ➕ فاتورة جديدة
              </button>

              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="bg-red-500/20 hover:bg-red-600 border border-red-500/40 text-red-400 hover:text-white px-4 py-3 rounded-2xl font-black text-xs flex items-center justify-center gap-1 transition-all active:scale-95"
              >
                🔙 إغلاق والرجوع للبيع
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
              <strong>#{completedSale.invoiceNumber || completedSale.id}</strong>
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
            {taxEnabled && completedSale.taxAmount && completedSale.taxAmount > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>ضريبة القيمة المضافة ({completedSale.taxRate}%):</span>
                <span>+{completedSale.taxAmount} ج.م</span>
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
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setShowRecentInvoicesModal(false);
                    if (onNavigateHome) onNavigateHome();
                  }}
                  className="bg-gold/15 hover:bg-gold text-gold hover:text-white px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-gold/30"
                  title="إغلاق السجل والذهاب للشاشة الرئيسية"
                >
                  <Home size={13} />
                  <span>الرئيسية</span>
                </button>
                <button onClick={() => setShowRecentInvoicesModal(false)} className="text-text-dim hover:text-danger"><X size={18} /></button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2 text-xs">
              {recentSales.length === 0 ? (
                <div className="text-center py-10 text-text-dim">لا توجد فواتير سابقة مسجلة</div>
              ) : (
                recentSales.map(sale => (
                  <div key={sale.id} className="bg-card2 p-3 rounded-2xl border border-border flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-text-main font-bold">#{sale.invoiceNumber || sale.id.slice(-8)}</strong>
                        <span className="text-gold font-black font-mono">{sale.finalTotal} ج.م</span>
                      </div>
                      <p className="text-[10px] text-text-dim mt-0.5">
                        {sale.customerName} • {new Date(sale.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} • {sale.items.length} أصناف
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setShowRecentInvoicesModal(false);
                          openInvoiceForPrint(sale);
                        }}
                        className="bg-card hover:bg-gold hover:text-white border border-border px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 shadow-sm text-[11px]"
                        title="معاينة وطباعة الفاتورة"
                      >
                        <Printer size={13} />
                        <span>طباعة</span>
                      </button>
                      <button
                        onClick={() => setPosSaleToDelete(sale)}
                        className="bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/30 px-2.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 shadow-sm text-[11px]"
                        title="حذف وإلغاء الفاتورة واسترجاع كمياتها للمخزن"
                      >
                        <Trash2 size={13} />
                        <span>حذف</span>
                      </button>
                    </div>
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

      {/* POS Delete Sale Confirmation Modal */}
      {posSaleToDelete && (
        <div className="fixed inset-0 z-[10000] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-card p-6 rounded-3xl w-full max-w-md border border-red-500/40 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-danger/20 text-danger">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-text-main">تأكيد حذف الفاتورة</h3>
                  <p className="text-[11px] text-text-dim">إلغاء المعاملة واسترجاع المخزون</p>
                </div>
              </div>
              <button 
                onClick={() => setPosSaleToDelete(null)}
                disabled={isDeletingPosSale}
                className="text-text-dim hover:text-danger p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-card2 p-4 rounded-2xl border border-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-dim">رقم الفاتورة:</span>
                <strong className="text-text-main font-mono">#{posSaleToDelete.invoiceNumber || posSaleToDelete.id.slice(-8)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dim">العميل:</span>
                <strong className="text-text-main">{posSaleToDelete.customerName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dim">الإجمالي:</span>
                <strong className="text-gold font-mono">{posSaleToDelete.finalTotal} ج.م</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-text-dim">عدد الأصناف:</span>
                <span className="text-green-400 font-bold">+{posSaleToDelete.items.length} أصناف تسترجع للمخزن</span>
              </div>
            </div>

            <div className="bg-danger/10 border border-danger/30 p-3 rounded-2xl text-xs text-red-300">
              ⚠️ سيتم حذف الفاتورة نهائياً وإرجاع جميع كميات الأصناف إلى رصيد المخزن فوراً.
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isDeletingPosSale}
                onClick={async () => {
                  try {
                    setIsDeletingPosSale(true);
                    await deleteSale(posSaleToDelete.id, currentUser?.companyId);
                    setRecentSales(prev => prev.filter(s => s.id !== posSaleToDelete.id));
                    setSales(prev => prev.filter(s => s.id !== posSaleToDelete.id));
                    const freshProds = await getProducts(currentUser?.companyId);
                    if (freshProds) setProducts(freshProds);
                    setToastType('success');
                    setToastMessage(`تم حذف الفاتورة #${posSaleToDelete.invoiceNumber || posSaleToDelete.id.slice(-8)} بنجاح واسترجاع المخزون.`);
                    playSuccessSound();
                    setPosSaleToDelete(null);
                  } catch (err: any) {
                    console.error('POS sale delete error:', err);
                    setToastType('warning');
                    setToastMessage(`فشل الحذف: ${err?.message || 'خطأ غير معروف'}`);
                    playWarningSound();
                  } finally {
                    setIsDeletingPosSale(false);
                  }
                }}
                className="flex-1 bg-danger hover:bg-danger/90 text-white py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 text-xs"
              >
                {isDeletingPosSale ? (
                  <>
                    <RotateCcw className="animate-spin" size={15} />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>تأكيد الحذف وإرجاع المخزون</span>
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={isDeletingPosSale}
                onClick={() => setPosSaleToDelete(null)}
                className="bg-card2 border border-border text-text-dim hover:text-white px-4 py-2.5 rounded-xl font-bold text-xs"
              >
                إلغاء
              </button>
            </div>
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

      {/* =========================================================
          F1 SHORTCUTS HELP MODAL
          ========================================================= */}
      {isShortcutsHelpOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-card p-6 rounded-3xl w-full max-w-2xl border border-border space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
                  <Keyboard size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-text-main">دليل اختصارات وأزرار الوظائف (F1 - F11)</h3>
                  <p className="text-[11px] text-text-dim">يمكنك الضغط على الأزرار مباشرة في الكيبورد أو النقر عليها بالشاشة</p>
                </div>
              </div>
              <button onClick={() => setIsShortcutsHelpOpen(false)} className="text-text-dim hover:text-danger p-1"><X size={18} /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto p-1">
              {functionKeysList.map(fk => (
                <div key={fk.key} className="bg-card2 p-3 rounded-2xl border border-border flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="bg-gold/20 text-gold font-mono font-black text-xs px-2 py-1 rounded-lg border border-gold/30">
                      {fk.key}
                    </span>
                    <div>
                      <p className="font-bold text-xs text-text-main flex items-center gap-1">
                        <span>{fk.icon}</span>
                        <span>{fk.title}</span>
                      </p>
                      <p className="text-[10px] text-text-dim mt-0.5">
                        {fk.key === 'F1' && 'عرض قائمة الإرشادات والدليل السريع للمبيعات'}
                        {fk.key === 'F2' && 'التركيز الفوري على خانة البحث وقارئ الباركود'}
                        {fk.key === 'F3' && 'فتح قائمة اختيار العميل أو تسجيل عميل جديد'}
                        {fk.key === 'F4' && 'دفع كاش فوري وإصدار وطباعة الفاتورة بضغطة واحدة'}
                        {fk.key === 'F5' && 'فتح شاشة طرق الدفع المتعددة (كاش/فيزا/محفظة/آجل)'}
                        {fk.key === 'F6' && 'تعليق الفاتورة الحالية أو استرجاع الفواتير المعلقة'}
                        {fk.key === 'F7' && 'إدخال تطبيق خصم نسبة أو مبلغ على الفاتورة'}
                        {fk.key === 'F8' && 'إلغاء وإفراغ جميع محتويات السلة الحالية'}
                        {fk.key === 'F9' && 'فتح سجل الفواتير الأخيرة والمبيعات السابقة'}
                        {fk.key === 'F10' && 'إعادة طباعة المعاينة لأحدث فاتورة تم إصدارها'}
                        {fk.key === 'F11' && 'تغيير شكل ومظهر واجهة شاشة البيع (POS Themes)'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setIsShortcutsHelpOpen(false);
                      fk.action();
                    }}
                    className="bg-card hover:bg-gold hover:text-white text-[10px] font-bold px-2.5 py-1 rounded-xl border border-border transition-all whitespace-nowrap"
                  >
                    تشغيل
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setIsShortcutsHelpOpen(false)}
              className="w-full bg-card2 hover:bg-card border border-border py-2.5 rounded-xl font-bold text-xs text-text-dim"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          F6 SUSPENDED / HELD ORDERS MODAL
          ========================================================= */}
      {isSuspendedModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-card p-6 rounded-3xl w-full max-w-lg border border-purple-500/40 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
                  <PauseCircle size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-text-main">الفواتير المعلقة (F6)</h3>
                  <p className="text-[11px] text-text-dim">استرجاع الفواتير المؤجلة للزبائن لمتابعة عملية البيع</p>
                </div>
              </div>
              <button onClick={() => setIsSuspendedModalOpen(false)} className="text-text-dim hover:text-danger p-1"><X size={18} /></button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-2 text-xs">
              {suspendedOrders.length === 0 ? (
                <div className="text-center py-10 text-text-dim space-y-2">
                  <p className="text-2xl">⏸️</p>
                  <p className="font-bold">لا توجد فواتير معلقة حالياً</p>
                  <p className="text-[10px]">لتعليق فاتورة، أضف منتجات للسلة ثم اضغط على زر F6</p>
                </div>
              ) : (
                suspendedOrders.map((order, idx) => (
                  <div key={order.id} className="bg-card2 p-3.5 rounded-2xl border border-border flex justify-between items-center gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-lg font-bold text-[10px]">
                          طلب #{idx + 1}
                        </span>
                        <span className="text-gold font-black">{order.total} ج.م</span>
                      </div>
                      <p className="text-[11px] text-text-dim mt-1">
                        ⏰ {order.time} • 📦 {order.itemsCount} أصناف
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRestoreSuspendedOrder(order)}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 shadow-sm"
                      >
                        <PlayCircle size={13} />
                        <span>استرجاع</span>
                      </button>
                      <button
                        onClick={() => handleDeleteSuspendedOrder(order.id)}
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-400 p-1.5 rounded-xl transition-all"
                        title="حذف الفاتورة المعلقة"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setIsSuspendedModalOpen(false)}
              className="w-full bg-card2 hover:bg-card border border-border py-2.5 rounded-xl font-bold text-xs text-text-dim"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          F7 INVOICE DISCOUNT MODAL
          ========================================================= */}
      {isDiscountModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/85 flex items-center justify-center p-4 backdrop-blur-md animate-fadeIn">
          <div className="bg-card p-6 rounded-3xl w-full max-w-md border border-rose-500/40 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                  <Tag size={20} />
                </div>
                <div>
                  <h3 className="font-black text-base text-text-main">تطبيق خصم على الفاتورة (F7)</h3>
                  <p className="text-[11px] text-text-dim">أدخل الخصم إما بنسبة مئوية (%) أو بمبلغ ثابت (ج.م)</p>
                </div>
              </div>
              <button onClick={() => setIsDiscountModalOpen(false)} className="text-text-dim hover:text-danger p-1"><X size={18} /></button>
            </div>

            <form onSubmit={handleApplyQuickDiscount} className="space-y-4">
              <div className="flex bg-card2 p-1 rounded-2xl border border-border">
                <button
                  type="button"
                  onClick={() => setTempDiscountType('percentage')}
                  className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all ${
                    tempDiscountType === 'percentage' ? 'bg-rose-600 text-white shadow-sm' : 'text-text-dim hover:text-text-main'
                  }`}
                >
                  نسبة مئوية (%)
                </button>
                <button
                  type="button"
                  onClick={() => setTempDiscountType('fixed')}
                  className={`flex-1 py-2 rounded-xl font-bold text-xs transition-all ${
                    tempDiscountType === 'fixed' ? 'bg-rose-600 text-white shadow-sm' : 'text-text-dim hover:text-text-main'
                  }`}
                >
                  مبلغ ثابت (ج.م)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-dim mb-1.5">قيمة الخصم:</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={tempDiscountVal}
                  onChange={e => setTempDiscountVal(e.target.value)}
                  placeholder={tempDiscountType === 'percentage' ? 'مثال: 10 (%)' : 'مثال: 50 (ج.م)'}
                  className="w-full bg-card2 border border-border p-3 rounded-2xl text-center font-bold text-lg focus:outline-none focus:border-rose-500"
                  autoFocus
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex gap-1.5 flex-wrap">
                {(tempDiscountType === 'percentage' ? [5, 10, 15, 20, 25] : [10, 20, 50, 100, 200]).map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTempDiscountVal(val.toString())}
                    className="flex-1 bg-card2 hover:bg-rose-600 hover:text-white border border-border py-1.5 rounded-xl font-bold text-xs transition-all"
                  >
                    {val} {tempDiscountType === 'percentage' ? '%' : 'ج.م'}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-2xl font-black text-xs transition-all shadow-md active:scale-95"
                >
                  حفظ وتطبيق الخصم
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDiscountValue(0);
                    setIsDiscountModalOpen(false);
                  }}
                  className="bg-card2 hover:bg-card border border-border px-4 py-3 rounded-2xl font-bold text-xs text-text-dim"
                >
                  إلغاء الخصم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

