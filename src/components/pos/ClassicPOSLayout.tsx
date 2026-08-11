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
  X, 
  UserPlus, 
  History, 
  Package, 
  Scan, 
  HelpCircle,
  Receipt,
  CheckCircle,
  KeyRound
} from 'lucide-react';
import { Product, Customer, Sale, AppUser } from '../../types/types';
import { POSCartItem } from '../POS';

interface ClassicPOSLayoutProps {
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

export default function ClassicPOSLayout({
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
  orderNumber = '1'
}: ClassicPOSLayoutProps) {
  // Live autocomplete states
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Manage outside clicks for product search
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter products as search query updates
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    const q = searchTerm.trim().toLowerCase();
    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.barcodes && p.barcodes.some(b => b.toLowerCase().includes(q)))
    );
    setSearchResults(filtered.slice(0, 8));
  }, [searchTerm, products]);

  // Handle barcode reader Enter triggers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0) {
        // Add first matching product
        const firstProd = searchResults[0];
        onAddToCart(firstProd, undefined, undefined, 'علبة');
        setSearchTerm('');
        setSearchResults([]);
        setIsSearchFocused(false);
      }
    }
  };

  // Find currently selected customer
  const activeCustomer = customers.find(c => c.id === selectedCustomerId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-1">
      
      {/* 1. Left Section: Classic Wholesale Invoice Table Grid (8 Columns) */}
      <div className="lg:col-span-8 flex flex-col space-y-4">
        
        {/* Search Bar HUD */}
        <div className="bg-card p-4 rounded-3xl border border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-sm relative" ref={searchContainerRef}>
          <div className="flex-1 relative">
            <span className="absolute right-3 top-3.5 text-text-dim">
              <Search className="w-4 h-4" />
            </span>
            <input
              ref={barcodeInputRef}
              type="text"
              inputMode="text"
              placeholder="اكتب اسم الصنف أو باركود السلعة لإضافتها فوراً (F2)..."
              className="w-full bg-card2 border border-border p-3 pr-9 rounded-2xl text-xs font-bold text-text-main focus:outline-none focus:border-gold"
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setIsSearchFocused(true);
              }}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={handleKeyDown}
              title="امسح الباركود بجهاز قارئ الليزر أو اكتب كود/اسم الصنف"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSearchResults([]);
                }}
                className="absolute left-3 top-3 text-text-dim hover:text-white"
              >
                ✕
              </button>
            )}

            {/* Custom Search Drops */}
            {isSearchFocused && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-border">
                {searchResults.map(prod => (
                  <button
                    key={prod.id}
                    type="button"
                    onClick={() => {
                      onAddToCart(prod, undefined, undefined, 'علبة');
                      setSearchTerm('');
                      setSearchResults([]);
                      setIsSearchFocused(false);
                    }}
                    className="w-full text-right p-3 hover:bg-gold/10 flex justify-between items-center transition-colors text-xs"
                  >
                    <div>
                      <div className="font-bold text-text-main">{prod.name}</div>
                      <div className="text-[10px] text-text-dim font-mono">الباركود/كود: {prod.sku || prod.barcode || 'لا يوجد'}</div>
                    </div>
                    <div className="text-[10px] font-mono bg-card2 border border-border px-2 py-0.5 rounded-full text-gold">
                      سعر البيع: {prod.price} ج.م | مخزن: {prod.quantity}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span 
              className="text-[10px] bg-card2 border border-border p-2.5 px-3 rounded-xl font-bold font-mono text-text-dim hidden sm:block"
              title="حالة الاتصال والخدمة السحابية والنسخ الاحتياطي التلقائي للبيانات"
            >
              {isOnlineState ? '🟢 سحابي نشط' : '🔴 غير متصل - حفظ مؤقت'}
            </span>
            <button
              onClick={onOpenDesignSelector}
              type="button"
              className="bg-card2 border border-border hover:border-gold hover:text-gold p-2.5 rounded-xl transition-all flex items-center justify-center gap-1 text-xs text-text-dim"
              title="تبديل قالب وتصميم شاشة البيع الحالية"
            >
              🎨 القوالب
            </button>
          </div>
        </div>

        {/* Invoice Grid Table */}
        <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-md flex-1 min-h-[400px] flex flex-col justify-between">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs divide-y divide-border">
              <thead className="bg-card2">
                <tr className="text-text-dim font-black">
                  <th className="p-3 text-center w-10" title="الرقم المسلسل للبند بالفاتورة">م</th>
                  <th className="p-3 w-28" title="كود الصنف أو الباركود SKU">الكود</th>
                  <th className="p-3" title="الاسم التجاري للمنتج المباع">اسم الصنف</th>
                  <th className="p-3 w-28" title="اختر تعبئة البيع الحالية صنف جملة">الوحدة</th>
                  <th className="p-3 w-24 text-center" title="سعر البيع للوحدة بالفاتورة الحالية">السعر *</th>
                  <th className="p-3 w-24 text-center" title="الكمية المطلوبة بيعها">الكمية *</th>
                  <th className="p-3" title="ملاحظات توضع على مستوى هذا البند بالذات">ملاحظات البند</th>
                  <th className="p-3 w-24 text-left" title="الإجمالي = السعر × الكمية">الإجمالي</th>
                  <th className="p-3 w-10 text-center">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-bold text-text-main">
                {cart.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-16 text-center text-text-dim space-y-2">
                      <div className="text-4xl">🛒</div>
                      <div className="text-sm font-black">فاتورة البيع الحالية فارغة!</div>
                      <div className="text-xs">امسح الباركود أو ابحث عن المنتجات بالأعلى لبدء تسجيل الفاتورة الكلاسيكية.</div>
                    </td>
                  </tr>
                ) : (
                  cart.map((item, idx) => {
                    return (
                      <tr key={`${item.product?.id || idx}-${idx}`} className="hover:bg-card2/30 transition-colors">
                        <td className="p-3 text-center text-text-dim font-mono text-[11px]">{idx + 1}</td>
                        <td className="p-3 text-text-dim font-mono text-[10px] truncate max-w-[100px]" title={item.product?.sku || (item.product?.barcodes && item.product?.barcodes[0])}>{item.product?.sku || (item.product?.barcodes && item.product?.barcodes[0]) || 'لا يوجد'}</td>
                        <td className="p-3 text-xs font-black">
                          {item.product?.name || ''}
                          {(item.color || item.size) && (
                            <span className="text-[9px] bg-gold/10 text-gold px-1 rounded mr-1">
                              {item.color} {item.size}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <select
                            className="w-full bg-card border border-border rounded-lg p-1 text-xs focus:outline-none focus:border-gold"
                            value={item.unit || 'علبة'}
                            onChange={e => onChangeUnit(idx, e.target.value)}
                            title="اختر التعبئة أو الوحدة المخصصة لهذا البند"
                          >
                            <option value="علبة">علبة</option>
                            <option value="كرتونة">كرتونة</option>
                            <option value="حبة">حبة</option>
                            <option value="كيلو">كيلو</option>
                            <option value="متر">متر</option>
                            <option value="كيس">كيس</option>
                          </select>
                        </td>
                        <td className="p-3">
                          {canUserEditPrice ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              className="w-full bg-card border border-border rounded-lg p-1 text-xs font-mono font-bold text-center focus:outline-none focus:border-gold"
                              value={item.price}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                onStartPriceEdit(idx);
                                item.price = val;
                              }}
                              placeholder="0"
                              title="سعر البيع الافتراضي للوحدة، يمكنك تعديله بالصلاحيات المناسبة"
                            />
                          ) : (
                            <div className="text-center font-mono text-xs cursor-not-allowed" title="تحتاج لصلاحية المدير العام لتعديل الأسعار">
                              {item.price} ج.م
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center bg-card border border-border rounded-lg overflow-hidden max-w-[90px] mx-auto">
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(idx, Math.max(1, item.quantity - 1))}
                              className="p-1 px-1.5 hover:bg-border text-text-dim text-[10px]"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              inputMode="decimal"
                              className="w-full bg-transparent text-center font-mono font-bold text-xs focus:outline-none text-gold min-w-0"
                              value={item.quantity}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 1;
                                onUpdateQuantity(idx, val);
                              }}
                              title="اكتب الكمية المباعة بدقة"
                            />
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(idx, item.quantity + 1)}
                              className="p-1 px-1.5 hover:bg-border text-text-dim text-[10px]"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            inputMode="text"
                            className="w-full bg-card border border-border rounded-lg p-1 text-xs focus:outline-none focus:border-gold font-normal"
                            placeholder="ملاحظات..."
                            value={item.notes || ''}
                            onChange={e => {
                              item.notes = e.target.value;
                            }}
                            title="ملاحظة خاصة بهذا البند تظهر بالفاتورة والطباعة"
                          />
                        </td>
                        <td className="p-3 text-left font-mono text-xs">{((item.price * item.quantity)).toLocaleString('ar-EG')} ج.م</td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => onRemoveFromCart(idx)}
                            className="text-danger hover:bg-danger/20 p-1 rounded-lg transition-all"
                            title="حذف هذا البند من الفاتورة"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Quick Stats Summary Footer */}
          <div className="p-4 bg-card2 border-t border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs text-text-dim">
            <div className="flex items-center gap-2 flex-wrap">
              <span>عدد بنود الفاتورة: <b className="text-text-main">{cart.length}</b></span>
              <span>|</span>
              <span>إجمالي الوحدات: <b className="text-text-main">{cart.reduce((sum, item) => sum + item.quantity, 0)}</b> وحدة</span>
              {completedSale && (
                <>
                  <span>|</span>
                  <button 
                    onClick={onOpenReceipt}
                    className="text-gold font-bold underline flex items-center gap-0.5"
                    title="مشاهدة وطباعة إيصال آخر عملية بيع محفوظة بالمنظومة"
                  >
                    📄 إيصال آخر عملية بيع
                  </button>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onOpenRecentSales}
                className="bg-card border border-border hover:border-gold text-[11px] px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all"
                title="عرض قائمة آخر الفواتير المحفوظة لتعديلها أو مراجعتها"
              >
                <History className="w-3 h-3 text-text-dim" />
                <span>أرشيف الفواتير الأخيرة</span>
              </button>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={onClearCart}
                  className="bg-danger/10 hover:bg-danger text-danger hover:text-white border border-danger/20 text-[11px] px-3 py-1.5 rounded-xl font-bold transition-all"
                  title="تصفير وتفريغ سلة الفاتورة الحالية والبدء من جديد"
                >
                  🧹 تفريغ السلة
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Right Section: Customer Selection & Detailed Billing Calculations */}
      <div className="lg:col-span-4 space-y-4">
        
        {/* Customer Card */}
        <div className="bg-card p-5 rounded-3xl border border-border space-y-3.5 shadow-sm">
          <div className="flex justify-between items-center">
            <h3 className="font-black text-xs text-text-dim flex items-center gap-1.5">
              <User className="w-4 h-4 text-gold" />
              <span>بيانات العميل والذمم المالية</span>
            </h3>
            <button
              onClick={onOpenQuickCustomerModal}
              type="button"
              className="text-gold hover:underline text-[10px] font-bold"
              title="إضافة عميل مالي جديد سريعاً دون مغادرة الفاتورة"
            >
              ➕ عميل جديد
            </button>
          </div>

          <div className="space-y-2">
            <select
              className="bg-card2 border border-border p-3 rounded-2xl w-full text-xs font-bold focus:outline-none focus:border-gold"
              value={selectedCustomerId}
              onChange={e => setSelectedCustomerId(e.target.value)}
              title="اختر العميل المسجل لتسجيل الفاتورة على حسابه وتحديث أرصدة الآجل"
            >
              <option value="default_customer">-- عميل نقدي افتراضي (Cash) --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  👤 {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>

            {activeCustomer && (
              <div className="bg-card2 p-3 rounded-2xl border border-border text-[11px] space-y-1 text-text-main font-bold">
                <div className="flex justify-between">
                  <span className="text-text-dim">رقم الموبايل:</span>
                  <span className="font-mono">{activeCustomer.phone || 'غير مسجل'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-dim">الحساب الجاري المستحق:</span>
                  <span className={`font-mono ${activeCustomer.currentBalance > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {activeCustomer.currentBalance?.toLocaleString('ar-EG') || 0} ج.م
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-text-dim">
                  <span>الرصيد الافتتاحي:</span>
                  <span>{activeCustomer.openingBalance?.toLocaleString('ar-EG') || 0} ج.م</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Calculations Block */}
        <div className="bg-card p-5 rounded-3xl border border-border space-y-4 shadow-md text-xs relative">
          <h3 className="font-black text-xs text-text-dim pb-1 border-b border-border flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-gold" />
            <span>ملخص الاحتساب والضرائب</span>
          </h3>

          <div className="space-y-3 font-bold">
            <div className="flex justify-between items-center text-text-dim">
              <span>إجمالي المبيعات الخام:</span>
              <span className="font-mono text-sm text-text-main">{subtotal.toLocaleString('ar-EG')} ج.م</span>
            </div>

            {/* Discount Section */}
            <div className="p-3 bg-card2 border border-border rounded-2xl space-y-2">
              <div className="flex justify-between items-center text-text-dim text-[11px]">
                <span>خصم الفاتورة الإجمالي:</span>
                <span className="text-gold font-mono">{discountAmount.toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex bg-card rounded-xl border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setDiscountType('percentage')}
                    className={`flex-1 p-1.5 font-bold transition-all text-[10px] ${discountType === 'percentage' ? 'bg-gold text-black' : 'hover:bg-border text-text-dim'}`}
                    title="خصم نسبة مئوية مقتطعة من إجمالي الفاتورة"
                  >
                    % نسبة
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={`flex-1 p-1.5 font-bold transition-all text-[10px] ${discountType === 'fixed' ? 'bg-gold text-black' : 'hover:bg-border text-text-dim'}`}
                    title="خصم مبلغ مالي ثابت مقطوع ومباشر"
                  >
                    ج.م مبلغ
                  </button>
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  className="bg-card border border-border p-1.5 rounded-xl font-mono text-center font-bold text-xs w-full focus:outline-none focus:border-gold text-gold"
                  value={discountValue === 0 ? '' : discountValue}
                  onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                  placeholder="0.0"
                  title="اكتب قيمة الخصم المعتمدة للفاتورة"
                />
              </div>
            </div>

            {/* Tax Section */}
            {taxEnabled && (
              <div className="flex justify-between items-center text-text-dim">
                <span className="flex items-center gap-1">
                  <span>🧾</span> ضريبة القيمة المضافة ({taxRate}%):
                </span>
                <span className="font-mono text-sm text-text-main">{taxAmount.toLocaleString('ar-EG')} ج.م</span>
              </div>
            )}

            <hr className="border-border/60" />

            <div className="flex justify-between items-center font-black text-sm pt-1">
              <span className="text-text-main text-sm">صافي إجمالي الفاتورة:</span>
              <span className="font-mono text-lg text-gold">{finalTotal.toLocaleString('ar-EG')} ج.م</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <button
              onClick={onOpenPaymentModal}
              disabled={cart.length === 0}
              type="button"
              className="w-full bg-gold hover:bg-gold2 disabled:opacity-50 text-black p-3.5 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
              title="فتح نافذة الدفع المتقدم لتحديد مبلغ المدفوع وطريقة السداد (فيزا، كاش، آجل)"
            >
              <CreditCard className="w-4 h-4 text-black" />
              <span>التحصيل الذكي والدفع المحاسبي (F4)</span>
            </button>

            <button
              onClick={onQuickCheckoutAndPrint}
              disabled={cart.length === 0}
              type="button"
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white p-3.5 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
              title="دفع الفاتورة كاش فوراً وإصدار إيصال الطباعة المباشر بضغطة زر واحدة"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>تحصيل فوري كاش وطباعة سريعة (F8)</span>
            </button>
          </div>

          {/* Help Tips */}
          <div className="p-3 bg-card2 rounded-2xl border border-border text-[10px] text-text-dim space-y-1">
            <div className="font-bold text-text-main">💡 إرشادات سريعة لقارئ الباركود:</div>
            <div>• اضغط على حقل البحث بالأعلى لتفعيل ماسح الباركود الليزري.</div>
            <div>• عند مسح باركود أي منتج، يتم إضافته تلقائياً للفاتورة مع تلميحات بصرية.</div>
            <div>• اضغط F2 للتركيز على البحث، F4 للتحصيل والدفع المتقدم، F8 للطباعة الفورية النقدية.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
