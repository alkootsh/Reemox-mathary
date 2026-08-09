import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingBag, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Phone, 
  User, 
  Tag, 
  Printer, 
  DollarSign, 
  Sparkles, 
  Search, 
  Barcode, 
  Layers, 
  RotateCcw, 
  Check, 
  Percent, 
  TrendingUp, 
  X, 
  Palette, 
  UserPlus, 
  History, 
  Package, 
  Scan, 
  Lock, 
  Unlock, 
  CheckCircle,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { Product, Customer, Sale, AppUser } from '../../types/types';
import { POSCartItem } from '../POS';
import { validateCoupon, PREDEFINED_COUPONS } from './CouponSystem';

interface EmeraldPOSLayoutProps {
  products: Product[];
  customers: Customer[];
  cart: POSCartItem[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  barcodeInputRef: React.RefObject<HTMLInputElement>;
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  onAddToCart: (product: Product, color?: string, size?: string, unit?: string, customPrice?: number) => void;
  onRemoveFromCart: (index: number) => void;
  onUpdateQuantity: (index: number, qty: number) => void;
  onChangeUnit: (index: number, unit: string) => void;
  subtotal: number;
  discountAmount: number;
  discountValue: number;
  setDiscountValue: (val: number) => void;
  discountType: 'percentage' | 'fixed';
  setDiscountType: (type: 'percentage' | 'fixed') => void;
  taxAmount: number;
  finalTotal: number;
  taxEnabled: boolean;
  taxRate: number;
  onOpenPaymentModal: () => void;
  onQuickCheckoutAndPrint: () => void;
  onClearCart: () => void;
  onOpenDesignSelector: () => void;
  onOpenQuickCustomerModal: () => void;
  onOpenRecentSales: () => void;
  onStartPriceEdit: (index: number) => void;
  canUserEditPrice: boolean;
  isOnlineState: boolean;
  pendingOfflineCount: number;
  onManualOfflineSync: () => void;
  currentUser: AppUser | null;
  completedSale: Sale | null;
  onOpenReceipt: () => void;
  orderNumber?: number | string;
}

export default function EmeraldPOSLayout({
  products,
  customers,
  cart,
  searchTerm,
  setSearchTerm,
  barcodeInputRef,
  selectedCustomerId,
  setSelectedCustomerId,
  onAddToCart,
  onRemoveFromCart,
  onUpdateQuantity,
  onChangeUnit,
  subtotal,
  discountAmount,
  discountValue,
  setDiscountValue,
  discountType,
  setDiscountType,
  taxAmount,
  finalTotal,
  taxEnabled,
  taxRate,
  onOpenPaymentModal,
  onQuickCheckoutAndPrint,
  onClearCart,
  onOpenDesignSelector,
  onOpenQuickCustomerModal,
  onOpenRecentSales,
  onStartPriceEdit,
  canUserEditPrice,
  isOnlineState,
  pendingOfflineCount,
  onManualOfflineSync,
  currentUser,
  completedSale,
  onOpenReceipt,
  orderNumber = 51
}: EmeraldPOSLayoutProps) {
  // Active Mobile View: 'cart' (الفاتورة) or 'products' (المنتجات)
  const [activeTab, setActiveTab] = useState<'cart' | 'products'>('cart');
  
  // Selected Category filter for Products
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');

  // Customer quick pills inputs
  const [cardInput, setCardInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  
  // Coupon State
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCouponMsg, setAppliedCouponMsg] = useState<string | null>(null);
  const [isCouponOpen, setIsCouponOpen] = useState(false);

  // Calculate estimated total profit for invoice (Price - Cost)
  const estimatedCost = cart.reduce((sum, item) => {
    const cost = item.product?.cost ?? 0;
    return sum + (cost * item.quantity);
  }, 0);
  const estimatedProfit = Math.max(0, Math.round((subtotal - discountAmount - estimatedCost) * 100) / 100);

  // Categories list
  const categories = ['الكل', ...Array.from(new Set(products.map(p => p.category || 'عام')))];

  // Filtered Products
  const filteredProducts = products.filter(p => {
    if (p.archived) return false;
    const matchCategory = selectedCategory === 'الكل' || p.category === selectedCategory;
    const matchSearch = !searchTerm || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcodes && p.barcodes.some(b => b.includes(searchTerm)));
    return matchCategory && matchSearch;
  });

  // Auto-fill phone when customer selected
  useEffect(() => {
    const cust = customers.find(c => c.id === selectedCustomerId);
    if (cust) {
      if (cust.phone && cust.phone !== '0000000000') {
        setPhoneInput(cust.phone);
      }
    }
  }, [selectedCustomerId, customers]);

  // Handle Phone Match
  const handlePhoneChange = (val: string) => {
    setPhoneInput(val);
    if (val.length >= 4) {
      const match = customers.find(c => c.phone && c.phone.includes(val));
      if (match) {
        setSelectedCustomerId(match.id);
      }
    }
  };

  // Handle Card Match
  const handleCardChange = (val: string) => {
    setCardInput(val);
    if (val.length >= 3) {
      // Find customer by id or card
      const match = customers.find(c => c.id.toLowerCase() === val.toLowerCase() || c.phone === val);
      if (match) {
        setSelectedCustomerId(match.id);
      }
    }
  };

  // Apply Coupon
  const handleApplyCoupon = (codeToApply?: string) => {
    const code = codeToApply || couponCodeInput;
    if (!code.trim()) return;

    const res = validateCoupon(code, subtotal);
    if (res.isValid && res.coupon) {
      setDiscountType(res.coupon.type);
      setDiscountValue(res.coupon.value);
      setAppliedCouponMsg(res.message);
      setIsCouponOpen(false);
    } else {
      alert(res.message);
    }
  };

  const selectedCustomerObj = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="flex flex-col min-h-screen bg-[#f4f7f5] dark:bg-[#0d1512] text-slate-800 dark:text-slate-100 font-sans pb-24 selection:bg-emerald-500 selection:text-white">
      
      {/* 🌿 TOP EMERALD HEADER BAR (matching screenshot) */}
      <div className="bg-[#14532d] dark:bg-[#0f3d21] text-white pt-4 pb-5 px-4 sm:px-6 rounded-b-[28px] shadow-lg border-b border-emerald-700/40 relative z-20">
        <div className="max-w-7xl mx-auto space-y-4">
          
          {/* Top Title & Badges Row */}
          <div className="flex items-center justify-between gap-3">
            {/* Title & Cart Icon */}
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-800/80 rounded-2xl border border-emerald-600/40 shadow-inner">
                <ShoppingBag className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <span>الفاتورة</span>
              </h1>
            </div>

            {/* Badges: Invoice Number & Items Count */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Invoice Number Badge */}
              <div className="bg-[#0b331b] border border-emerald-700/60 text-emerald-200 text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-full shadow-inner flex items-center gap-1.5">
                <span className="text-emerald-400 font-medium text-xs">رقم:</span>
                <span className="font-mono text-white font-bold">{orderNumber}</span>
              </div>

              {/* Items Count Badge */}
              <div className="bg-[#0b331b] border border-emerald-700/60 text-emerald-200 text-xs sm:text-sm font-black px-3.5 py-1.5 rounded-full shadow-inner flex items-center gap-1.5">
                <span className="font-bold text-white">{cart.reduce((sum, i) => sum + i.quantity, 0)}</span>
                <span className="text-emerald-400 font-medium text-xs">الأصناف</span>
              </div>

              {/* Design Selector Toggle Button */}
              <button
                type="button"
                onClick={onOpenDesignSelector}
                className="bg-emerald-700/60 hover:bg-emerald-600 border border-emerald-500/50 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                title="تغيير شكل وتصميم شاشة البيع"
              >
                <Palette size={13} className="text-emerald-200" />
                <span className="hidden sm:inline">تغيير الديزاين</span>
              </button>

              {/* Recent Invoices */}
              <button
                type="button"
                onClick={onOpenRecentSales}
                className="bg-emerald-800/80 hover:bg-emerald-700 border border-emerald-600/40 text-emerald-100 p-1.5 rounded-full transition-all"
                title="فواتير اليوم"
              >
                <History size={16} />
              </button>
            </div>
          </div>

          {/* 💳 CUSTOMER QUICK PILLS ROW (3 rounded white/light cards from screenshot) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            
            {/* 1. رقم الكارت (Card Number) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-2.5 px-3 shadow-sm border border-emerald-100 dark:border-slate-800 flex items-center justify-between gap-2 group focus-within:ring-2 focus-within:ring-emerald-400 transition-all">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 text-xs font-bold shrink-0">
                <CreditCard size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span>رقم الكارت</span>
              </div>
              <input
                type="text"
                value={cardInput}
                onChange={e => handleCardChange(e.target.value)}
                placeholder="رقم العضوية..."
                className="w-full bg-transparent text-left text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none placeholder:text-slate-400 placeholder:text-right"
              />
            </div>

            {/* 2. الموبايل (Phone) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-2.5 px-3 shadow-sm border border-emerald-100 dark:border-slate-800 flex items-center justify-between gap-2 group focus-within:ring-2 focus-within:ring-emerald-400 transition-all">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 text-xs font-bold shrink-0">
                <Phone size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span>الموبايل</span>
              </div>
              <input
                type="tel"
                value={phoneInput}
                onChange={e => handlePhoneChange(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full bg-transparent text-left text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none placeholder:text-slate-400 placeholder:text-right"
              />
            </div>

            {/* 3. الاسم (Customer Name) */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-2.5 px-3 shadow-sm border border-emerald-100 dark:border-slate-800 flex items-center justify-between gap-2 group focus-within:ring-2 focus-within:ring-emerald-400 transition-all">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 text-xs font-bold shrink-0">
                <User size={16} className="text-emerald-600 dark:text-emerald-400" />
                <span>الاسم</span>
              </div>
              <div className="flex items-center gap-1.5 w-full justify-end">
                <select
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer max-w-[140px] truncate"
                >
                  <option value="cash-customer">عميل نقدي سريع</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.currentBalance && c.currentBalance > 0 ? `(عليه ${c.currentBalance} ج)` : ''}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onOpenQuickCustomerModal}
                  className="p-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:hover:bg-emerald-900 text-emerald-600 dark:text-emerald-400 transition-colors"
                  title="إضافة عميل جديد سريعاً"
                >
                  <UserPlus size={14} />
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 📦 MAIN CONTENT AREA (Responsive: Split on Desktop, Tabbed on Mobile) */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4 flex-1">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* ============================================================== */}
          {/* 🛒 LEFT/MAIN: INVOICE / CART SECTION (Matching the screenshot) */}
          {/* ============================================================== */}
          <div className={`lg:col-span-5 flex flex-col space-y-4 ${activeTab === 'cart' ? 'block' : 'hidden lg:block'}`}>
            
            {/* Cart Items Container */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-3 min-h-[300px]">
              
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-3">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <ShoppingBag size={28} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-600 dark:text-slate-300">سلة الفاتورة فارغة</h3>
                    <p className="text-xs text-slate-400 mt-1">امسح الباركود أو اختر منتجات من قائمة الأصناف</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('products')}
                    className="lg:hidden mt-2 bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm flex items-center gap-1.5"
                  >
                    <Package size={14} />
                    <span>تصفح المنتجات الآن</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                  {cart.map((item, idx) => {
                    const itemTotal = Math.round((item.price * item.quantity) * 100) / 100;
                    return (
                      <div
                        key={`${item.product.id}-${idx}`}
                        className="bg-[#f9fbf9] dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all shadow-xs"
                      >
                        {/* Delete Button (Left side as in screenshot) */}
                        <button
                          type="button"
                          onClick={() => onRemoveFromCart(idx)}
                          className="p-2 rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                          title="حذف الصنف"
                        >
                          <Trash2 size={16} />
                        </button>

                        {/* Product Info & Quantity Controls */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-black text-sm text-slate-800 dark:text-white truncate">
                              {item.product.name}
                            </h4>
                            <span className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
                              {itemTotal} ج.م
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-2 pt-1 border-t border-slate-200/40 dark:border-slate-700/40 text-xs">
                            {/* Unit Price & Price edit */}
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                              <span>السعر:</span>
                              <span className="font-bold text-slate-700 dark:text-slate-200 font-mono">
                                {item.price}
                              </span>
                              {canUserEditPrice && (
                                <button
                                  type="button"
                                  onClick={() => onStartPriceEdit(idx)}
                                  className="text-[10px] text-emerald-600 hover:underline"
                                  title="تعديل السعر"
                                >
                                  (تعديل)
                                </button>
                              )}
                            </div>

                            {/* Quantity Stepper */}
                            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-0.5 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(idx, Math.max(1, item.quantity - 1))}
                                className="text-slate-500 hover:text-rose-500 p-0.5 transition-colors"
                              >
                                <Minus size={13} />
                              </button>
                              <span className="font-mono font-bold text-xs px-1 text-slate-800 dark:text-white">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => onUpdateQuantity(idx, item.quantity + 1)}
                                className="text-slate-500 hover:text-emerald-500 p-0.5 transition-colors"
                              >
                                <Plus size={13} />
                              </button>
                            </div>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}

              {/* 🏷️ FINANCIAL SUMMARY BLOCK (Exact layout from screenshot) */}
              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
                
                {/* Row 1: المجموع & خصم (Orange-bordered pill) */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-bold text-sm">
                    <span>المجموع:</span>
                    <span className="font-mono text-base font-black text-slate-900 dark:text-white">
                      {subtotal.toFixed(2)}
                    </span>
                  </div>

                  {/* 🏷️ خصم (Orange bordered pill from screenshot) */}
                  <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-2xl px-3 py-1.5 flex items-center gap-2 shadow-2xs">
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <span>خصم:</span>
                      <Tag size={13} className="text-amber-500" />
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={discountValue || ''}
                      onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-16 bg-transparent text-center font-mono font-black text-amber-600 dark:text-amber-400 text-xs focus:outline-none placeholder:text-amber-300"
                    />
                  </div>
                </div>

                {/* Row 2: كوبون (Pink-bordered pill 'كود الخصم') */}
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    كوبون:
                  </div>

                  <div className="relative flex-1 max-w-[200px]">
                    <div className="bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-2xl px-3 py-1.5 flex items-center justify-between gap-1 shadow-2xs">
                      <input
                        type="text"
                        value={couponCodeInput}
                        onChange={e => setCouponCodeInput(e.target.value.toUpperCase())}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleApplyCoupon();
                        }}
                        placeholder="كود الخصم"
                        className="w-full bg-transparent text-center font-mono font-bold text-xs text-rose-600 dark:text-rose-300 focus:outline-none placeholder:text-rose-300"
                      />
                      {couponCodeInput && (
                        <button
                          type="button"
                          onClick={() => handleApplyCoupon()}
                          className="text-[10px] bg-rose-500 text-white font-bold px-2 py-0.5 rounded-lg shadow-2xs hover:bg-rose-600"
                        >
                          تطبيق
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {appliedCouponMsg && (
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 p-1.5 px-2.5 rounded-xl flex items-center justify-between">
                    <span>{appliedCouponMsg}</span>
                    <button onClick={() => { setAppliedCouponMsg(null); setDiscountValue(0); }} className="text-slate-400 hover:text-slate-600">
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Row 3: الإجمالي النهائي (Large font) & ربح الفاتورة (Green badge) */}
                <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-400 font-medium">الإجمالي النهائي</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
                        {finalTotal.toFixed(2)}
                      </span>
                      <span className="text-xs font-bold text-slate-500">ج.م</span>
                    </div>
                  </div>

                  {/* 🟢 ربح الفاتورة (Green pill badge from screenshot) */}
                  <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-black px-3 py-1.5 rounded-xl shadow-2xs flex items-center gap-1.5">
                    <TrendingUp size={13} className="text-emerald-500" />
                    <span>ربح الفاتورة:</span>
                    <span className="font-mono font-black">{estimatedProfit.toFixed(2)} ج.م</span>
                  </div>
                </div>

                {/* 🚀 BIG ACTION BUTTONS (from screenshot) */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  
                  {/* Left: دفع وطباعة (Mint Green #10b981) */}
                  <button
                    type="button"
                    onClick={onQuickCheckoutAndPrint}
                    disabled={cart.length === 0}
                    className="bg-[#10b981] hover:bg-[#059669] active:scale-[0.98] disabled:opacity-50 text-white font-black text-sm sm:text-base py-3.5 px-4 rounded-2xl shadow-md transition-all flex flex-col items-center justify-center gap-1 group cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <Printer size={18} className="group-hover:animate-pulse" />
                      <span>دفع وطباعة</span>
                    </div>
                  </button>

                  {/* Right: تحصيل ودفع (Dark Forest Green #14532d) */}
                  <button
                    type="button"
                    onClick={onOpenPaymentModal}
                    disabled={cart.length === 0}
                    className="bg-[#14532d] hover:bg-[#0b331b] active:scale-[0.98] disabled:opacity-50 text-white font-black text-sm sm:text-base py-3.5 px-4 rounded-2xl shadow-md transition-all flex flex-col items-center justify-center gap-1 group cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <DollarSign size={18} className="text-emerald-300" />
                      <span>تحصيل ودفع</span>
                    </div>
                  </button>
                </div>

                {/* Cancel / Clear order link (إلغاء الطلب والتفريغ) */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (cart.length === 0) return;
                      if (confirm('هل أنت متأكد من تفريغ سلة الفاتورة الحالية؟')) {
                        onClearCart();
                      }
                    }}
                    disabled={cart.length === 0}
                    className="text-xs font-bold text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition-colors disabled:opacity-30 inline-flex items-center gap-1"
                  >
                    <RotateCcw size={12} />
                    <span>إلغاء الطلب والتفريغ</span>
                  </button>
                </div>

              </div>

            </div>
          </div>


          {/* ============================================================== */}
          {/* 📦 RIGHT/CATALOG: PRODUCTS SELECTION & BARCODE AREA */}
          {/* ============================================================== */}
          <div className={`lg:col-span-7 flex flex-col space-y-4 ${activeTab === 'products' ? 'block' : 'hidden lg:block'}`}>
            
            {/* Search & Barcode Input Card */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-3">
              
              <div className="relative">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="امسح الباركود بالماسح أو ابحث بالاسم / SKU... (F2 للتركيز)"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-[#f4f7f5] dark:bg-slate-800/80 border-2 border-emerald-500/30 focus:border-emerald-500 p-3.5 pr-11 pl-4 rounded-2xl text-sm font-medium text-slate-800 dark:text-white focus:outline-none shadow-inner transition-all placeholder:text-slate-400"
                />
                <div className="absolute right-3.5 top-3.5 text-emerald-600 dark:text-emerald-400 pointer-events-none">
                  <Search size={20} />
                </div>
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute left-3.5 top-3.5 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Categories Pills Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {categories.map((cat) => {
                  const isSel = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${
                        isSel
                          ? 'bg-[#14532d] text-white shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>

            </div>

            {/* Products Grid */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-200/80 dark:border-slate-800 flex-1 min-h-[400px]">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800 text-xs font-bold text-slate-500">
                <span>قائمة المنتجات المتاحة ({filteredProducts.length})</span>
                <span className="text-emerald-600 dark:text-emerald-400">انقر لإضافة المنتج فوراً للسلة ⚡</span>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="py-20 text-center text-slate-400 space-y-2">
                  <Package className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700" />
                  <p className="text-sm font-bold">لا توجد منتجات تطابق البحث</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 pt-3 max-h-[520px] overflow-y-auto pr-1">
                  {filteredProducts.map((p) => {
                    const isLowStock = p.quantity <= (p.lowStockThreshold ?? 5);
                    const isOutOfStock = p.quantity <= 0;

                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          onAddToCart(p);
                        }}
                        className="bg-[#f9fbf9] dark:bg-slate-800/60 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 border border-slate-200/60 dark:border-slate-700 rounded-2xl p-3 text-right flex flex-col justify-between hover:border-emerald-400 dark:hover:border-emerald-600 transition-all group active:scale-[0.98] shadow-2xs"
                      >
                        <div className="space-y-1">
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-[10px] bg-slate-200/60 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-mono">
                              {p.sku || 'N/A'}
                            </span>
                            {isOutOfStock ? (
                              <span className="text-[9px] bg-rose-500/10 text-rose-500 font-bold px-1.5 py-0.5 rounded">
                                نفد
                              </span>
                            ) : isLowStock ? (
                              <span className="text-[9px] bg-amber-500/10 text-amber-500 font-bold px-1.5 py-0.5 rounded">
                                رصيد {p.quantity}
                              </span>
                            ) : (
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-600 font-bold px-1.5 py-0.5 rounded">
                                رصيد {p.quantity}
                              </span>
                            )}
                          </div>

                          <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white line-clamp-2 pt-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400">
                            {p.name}
                          </h4>
                        </div>

                        <div className="pt-3 flex items-center justify-between border-t border-slate-200/40 dark:border-slate-700/40 mt-2">
                          <span className="font-black text-sm text-slate-900 dark:text-white font-mono">
                            {p.price} <span className="text-[10px] font-normal text-slate-500">ج.م</span>
                          </span>
                          <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
                            <Plus size={14} />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

            </div>

          </div>

        </div>

      </div>

      {/* ============================================================== */}
      {/* 📱 FLOATING BOTTOM NAVIGATION DOCK (Exact 2 tabs from screenshot) */}
      {/* ============================================================== */}
      <div className="lg:hidden fixed bottom-3 inset-x-0 z-40 px-4">
        <div className="max-w-md mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-3xl p-1.5 shadow-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2">
          
          {/* Tab 1: المنتجات 📦 */}
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all ${
              activeTab === 'products'
                ? 'bg-[#14532d] text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Package size={18} />
            <span>المنتجات</span>
          </button>

          {/* Tab 2: الفاتورة 🛒 with Badge Counter */}
          <button
            type="button"
            onClick={() => setActiveTab('cart')}
            className={`py-3 rounded-2xl text-xs font-black flex items-center justify-center gap-2 transition-all relative ${
              activeTab === 'cart'
                ? 'bg-[#14532d] text-white shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <ShoppingBag size={18} />
            <span>الفاتورة</span>
            {cart.length > 0 && (
              <span className="bg-rose-500 text-white font-mono text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </button>

        </div>
      </div>

    </div>
  );
}
