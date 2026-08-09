import React, { useState } from 'react';
import { 
  Zap, 
  ShoppingBag, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Coins, 
  Printer, 
  RotateCcw, 
  Search, 
  Tag, 
  Palette, 
  User, 
  History, 
  X, 
  CheckCircle2, 
  UserPlus 
} from 'lucide-react';
import { Product, Customer, Sale, AppUser } from '../../types/types';
import { POSCartItem } from '../POS';

interface TouchPOSLayoutProps {
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
  subtotal: number;
  discountAmount: number;
  discountValue: number;
  setDiscountValue: (val: number) => void;
  finalTotal: number;
  onOpenPaymentModal: () => void;
  onQuickCheckoutAndPrint: () => void;
  onClearCart: () => void;
  onOpenDesignSelector: () => void;
  onOpenQuickCustomerModal: () => void;
  onOpenRecentSales: () => void;
  orderNumber?: number | string;
}

export default function TouchPOSLayout({
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
  subtotal,
  discountAmount,
  discountValue,
  setDiscountValue,
  finalTotal,
  onOpenPaymentModal,
  onQuickCheckoutAndPrint,
  onClearCart,
  onOpenDesignSelector,
  onOpenQuickCustomerModal,
  onOpenRecentSales,
  orderNumber = 51
}: TouchPOSLayoutProps) {
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const categories = ['الكل', ...Array.from(new Set(products.map(p => p.category || 'عام')))];

  // Fast cash presets
  const cashPresets = [10, 20, 50, 100, 200, 500];

  const filteredProducts = products.filter(p => {
    if (p.archived) return false;
    const matchCategory = selectedCategory === 'الكل' || p.category === selectedCategory;
    const matchSearch = !searchTerm || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="flex flex-col min-h-screen bg-amber-950/10 dark:bg-zinc-950 text-text-main pb-20">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-amber-950 text-white p-4 px-6 rounded-b-3xl shadow-lg flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-700/60 rounded-2xl border border-amber-500/40">
            <Zap className="w-6 h-6 text-amber-300 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black flex items-center gap-2">
              <span>كاشير التاتش السريع (Touch POS)</span>
              <span className="text-xs bg-amber-500/30 text-amber-200 px-2.5 py-0.5 rounded-full font-mono">
                فاتورة #{orderNumber}
              </span>
            </h1>
            <p className="text-xs text-amber-200/80">واجهة لمسية فائقة السرعة للمطاعم والكافيهات ومحلات التجزئة</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenDesignSelector}
            className="bg-amber-700/80 hover:bg-amber-600 border border-amber-500/50 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Palette size={14} className="text-amber-300" />
            <span>تغيير التصميم</span>
          </button>

          <button
            type="button"
            onClick={onOpenRecentSales}
            className="bg-amber-900 hover:bg-amber-800 border border-amber-700 text-amber-200 p-2 rounded-xl"
            title="فواتير اليوم"
          >
            <History size={16} />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto w-full p-4 grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        
        {/* Left: Products Touch Grid (7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          
          {/* Categories Horizontal Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-black shrink-0 transition-all ${
                  selectedCategory === cat
                    ? 'bg-amber-600 text-white shadow-md scale-105'
                    : 'bg-card border border-border text-text-dim hover:bg-amber-500/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative">
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="ابحث أو امسح الباركود سريعاً..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-card border-2 border-border focus:border-amber-500 p-3 pr-10 pl-4 rounded-2xl text-sm font-bold focus:outline-none"
            />
            <Search size={18} className="absolute right-3.5 top-3.5 text-amber-500" />
          </div>

          {/* Big Touch Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[500px] overflow-y-auto pr-1">
            {filteredProducts.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => onAddToCart(p)}
                className="bg-card hover:bg-amber-500/10 active:scale-95 border-2 border-border hover:border-amber-500 rounded-3xl p-3.5 text-center flex flex-col justify-between items-center min-h-[110px] transition-all shadow-sm group"
              >
                <div className="text-center w-full">
                  <div className="text-[10px] font-mono text-text-dim">{p.sku}</div>
                  <h4 className="font-black text-sm text-text-main group-hover:text-amber-600 line-clamp-2 mt-0.5">
                    {p.name}
                  </h4>
                </div>

                <div className="w-full pt-2 border-t border-border/60 flex items-center justify-between">
                  <span className="font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                    {p.price} ج
                  </span>
                  <span className="w-6 h-6 rounded-full bg-amber-600 text-white flex items-center justify-center text-xs font-bold">
                    +
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Cart & Fast Checkout Panel (5 cols) */}
        <div className="lg:col-span-5 bg-card border-2 border-border rounded-3xl p-4 shadow-xl flex flex-col justify-between space-y-4">
          
          {/* Customer Selection */}
          <div className="bg-card2 p-3 rounded-2xl border border-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold">
              <User size={16} className="text-amber-500" />
              <span>العميل:</span>
            </div>
            <div className="flex items-center gap-1.5 flex-1 justify-end">
              <select
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
                className="bg-card text-xs font-bold p-1.5 rounded-xl border border-border max-w-[170px]"
              >
                <option value="cash-customer">عميل نقدي سريع</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={onOpenQuickCustomerModal}
                className="p-1.5 rounded-xl bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
              >
                <UserPlus size={14} />
              </button>
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 max-h-[260px] overflow-y-auto space-y-2 pr-1">
            {cart.length === 0 ? (
              <div className="py-12 text-center text-text-dim text-xs">
                السلة فارغة، المس أي صنف لإضافته فوراً
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="bg-card2 p-2.5 rounded-2xl border border-border flex items-center justify-between gap-2">
                  <button
                    onClick={() => onRemoveFromCart(idx)}
                    className="text-rose-400 hover:text-rose-600 p-1"
                  >
                    <Trash2 size={15} />
                  </button>
                  <div className="flex-1 min-w-0 text-right">
                    <div className="font-bold text-xs truncate">{item.product.name}</div>
                    <div className="text-[11px] text-text-dim font-mono">{item.price} × {item.quantity} = {item.price * item.quantity} ج</div>
                  </div>
                  <div className="flex items-center gap-1 bg-card px-2 py-0.5 rounded-xl border border-border">
                    <button onClick={() => onUpdateQuantity(idx, Math.max(1, item.quantity - 1))} className="text-text-dim hover:text-text-main">
                      <Minus size={12} />
                    </button>
                    <span className="font-mono font-bold text-xs px-1">{item.quantity}</span>
                    <button onClick={() => onUpdateQuantity(idx, item.quantity + 1)} className="text-text-dim hover:text-text-main">
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick Cash Presets */}
          <div className="space-y-1.5 pt-2 border-t border-border">
            <div className="text-[11px] font-bold text-text-dim flex items-center gap-1">
              <Coins size={12} className="text-amber-500" />
              <span>فئات النقدية السريعة:</span>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {cashPresets.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => alert(`تم تحديد استلام نقدي: ${preset} ج.م`)}
                  className="bg-card2 hover:bg-amber-500/20 text-xs font-mono font-bold p-1.5 rounded-xl border border-border text-center"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Total & Action Buttons */}
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-text-dim">المطلوب سداده:</span>
              <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
                {finalTotal.toFixed(2)} <span className="text-xs">ج.م</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onQuickCheckoutAndPrint}
                disabled={cart.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm py-3 rounded-2xl shadow-md flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                <Printer size={16} />
                <span>طباعة فورية</span>
              </button>

              <button
                type="button"
                onClick={onOpenPaymentModal}
                disabled={cart.length === 0}
                className="bg-amber-600 hover:bg-amber-700 text-white font-black text-sm py-3 rounded-2xl shadow-md flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
              >
                <CreditCard size={16} />
                <span>تحصيل وسداد</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
