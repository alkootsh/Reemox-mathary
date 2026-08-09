export enum BusinessType {
  GENERAL = 'عام',
  GROCERY = 'بقالة',
  HOUSEHOLD_APPLIANCES = 'أجهزة منزلية',
  ELECTRICAL = 'أدوات كهربائية',
  SANITARY = 'أدوات صحية',
  HARDWARE_PAINTS = 'حديد وبويات',
  TIRES_BATTERIES = 'إطارات وبطاريات',
  MOBILE_ACCESSORIES = 'محمول واكسسوار',
  BOOKSTORE = 'مكتبة',
  AGRICULTURAL_PESTICIDES = 'مبيدات زراعية',
  ANIMAL_FEED = 'أعلاف',
  PHARMACY = 'صيدلية',
  VETERINARY = 'أدوية بيطرية',
  AUTO_SPARE_PARTS = 'قطع غيار سيارات وموتسيكلات وتوكتوك',
}

export interface ProductUnit {
  name: string; // e.g. "علبة", "شريط", "قرص", "كرتونة", "قطعة", "دستة"
  conversionFactor: number; // e.g. 1 for base unit (علبة), 0.3333 for strip if 3 strips in a box (or quantity of base units per 1 unit)
  price: number; // Sale price for this unit
  cost?: number; // Cost for this unit
  barcode?: string; // Dedicated barcode for this unit
  isBase?: boolean; // Primary inventory unit
}

export interface ProductBatch {
  id?: string;
  batchNumber: string; // رقم التشغيلة
  expirationDate: string; // تاريخ الصلاحية YYYY-MM-DD
  quantity: number; // الرصيد المتوفر من هذه التشغيلة
  cost?: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcodes?: string[];
  serial?: string;
  price: number;
  cost: number;
  quantity: number;
  colors?: string[];
  sizes?: string[];
  units?: string[];
  multiUnits?: ProductUnit[]; // Multi-unit selling (Pack, Strip, Tablet, etc.)
  batches?: ProductBatch[]; // Batch / Lot tracking
  batchNumber?: string; // Main batch number
  category?: string;
  lowStockThreshold?: number;
  image?: string;
  expirationDate?: string;
  subcategory?: string;
  isWeighted?: boolean;
  weightUnit?: 'kg' | 'g';
  archived?: boolean;
  branchId?: string;
  brand?: string;
  openingStock?: number; // رصيد أول المدة
  openingCost?: number; // تكلفة رصيد أول المدة
  isPharmacy?: boolean; // صنف صيدلاني
  stripsPerBox?: number; // عدد الأشرطة بالعلبة
  stripPrice?: number; // سعر بيع الشريط
  stripBarcode?: string; // باركود الشريط
}

export interface Branch {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  subcategories?: string[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  openingBalance: number;
  currentBalance?: number;
  whatsappReminders?: boolean;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  openingBalance: number;
  currentBalance?: number;
  purchases?: { id: string, amount: number, date: string }[];
  payments?: { id: string, amount: number, date: string }[];
}

export interface AppConfig {
  businessType: BusinessType;
  enableWeight: boolean;
  enableExpiry: boolean;
  enableSerial: boolean;
  allowNegativeStock?: boolean;
  allowCashierPriceEdit?: boolean;
  preventSellBelowCost?: boolean;
  requireSupervisorPinForPriceEdit?: boolean;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  cost: number;
}

export interface Purchase {
  id: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  total: number;
  paymentMethod: 'cash' | 'deferred-full' | 'deferred-partial';
  paidAmount: number;
  date: string;
  branchId?: string;
}

export type SaleStatus = 'paid' | 'unpaid' | 'partially-paid' | 'returned' | 'COMPLETED';

export interface SaleItem {
  productId: string;
  product?: Product;
  name: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  isCustomPrice?: boolean;
  unit?: string;
  conversionFactor?: number; // Factor to multiply/divide base quantity
  batchNumber?: string;
  expirationDate?: string;
  color?: string;
  size?: string;
  unitCost?: number;
}

export interface InventoryCountItem {
  productId: string;
  productName: string;
  sku: string;
  category?: string;
  bookQuantity: number; // الرصيد الدفتري المسجل بالنظام
  physicalQuantity: number; // الرصيد الفعلي بعد الجرد
  difference: number; // الفارق = الفعلي - الدفتري (موجب = زيادة، سالب = عجز)
  unitCost: number; // تكلفة الوحدة
  differenceValue: number; // قيمة العجز أو الزيادة بالجنيه
  expirationDate?: string;
  batchNumber?: string;
  status: 'MATCH' | 'DEFICIT' | 'SURPLUS';
  notes?: string;
}

export interface InventoryCountSession {
  id: string;
  title: string;
  date: string;
  branchId?: string;
  status: 'DRAFT' | 'SETTLED' | 'CANCELLED';
  items: InventoryCountItem[];
  totalBookQuantity: number;
  totalPhysicalQuantity: number;
  totalDeficitValue: number;
  totalSurplusValue: number;
  netDifferenceValue: number;
  settledAt?: string;
  settledBy?: string;
  notes?: string;
}

export interface Payment {
  id: string;
  saleId: string;
  method: 'CASH' | 'CARD' | 'WALLET' | 'CREDIT';
  amount: number;
  createdAt: string;
  userId?: string;
  reference?: string;
  notes?: string;
}

export interface Sale {
  id: string;
  invoiceNumber?: string;
  customerId: string;
  customerName: string;
  items: SaleItem[];
  total: number;
  subtotal?: number;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  tax?: number;
  taxRate?: number;
  taxAmount?: number;
  taxType?: 'exclusive' | 'inclusive';
  finalTotal: number;
  payments?: Payment[];
  paymentMethod?: 'cash' | 'card' | 'wallet' | 'credit';
  paidAmount?: number;
  remainingAmount?: number;
  changeAmount?: number;
  date: string;
  isInstallment?: boolean;
  installmentDetails?: {
    totalInstallments: number;
    paidInstallments: number;
    amountPerInstallment: number;
  };
  status: SaleStatus;
  dueDate?: string;
  branchId?: string;
  userId?: string;
  userName?: string;
  isReturned?: boolean;
}

export type MovementType = 
  | 'PURCHASE' 
  | 'SALE' 
  | 'SALE_RETURN' 
  | 'PURCHASE_RETURN' 
  | 'ADJUSTMENT_IN' 
  | 'ADJUSTMENT_OUT' 
  | 'DAMAGE' 
  | 'OPENING_BALANCE';

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  branchId: string;
  warehouseId?: string;
  movementType: MovementType;
  quantity: number;
  unitCost: number;
  stockBefore: number;
  stockAfter: number;
  referenceType: 'SALE' | 'PURCHASE' | 'RETURN' | 'ADJUSTMENT';
  referenceId: string;
  userId?: string;
  createdAt: string;
  notes?: string;
}

export interface CashierSession {
  id: string;
  cashierName: string;
  branchId: string;
  openingCash: number;
  openedAt: string;
  status: 'OPEN' | 'ACTIVE' | 'CLOSED';
  closedAt?: string;
  actualCash?: number;
  expectedCash?: number;
  difference?: number;
  cashSales?: number;
  cardSales?: number;
  walletSales?: number;
  creditSales?: number;
  withdrawals?: number;
  deposits?: number;
  refunds?: number;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  paymentMethod: string;
  date: string;
  notes?: string;
  branchId?: string;
}

export type UserRole = 'admin' | 'cashier' | 'accountant' | 'inventory_manager';

export interface AppUser {
  id: string;
  name: string;
  username: string;
  pin: string;
  role: UserRole;
  phone?: string;
  allowedScreens?: string[];
  branchId?: string;
  createdAt?: string;
  canEditPrice?: boolean;
  canGiveDiscount?: boolean;
  maxDiscountPercentage?: number;
}

