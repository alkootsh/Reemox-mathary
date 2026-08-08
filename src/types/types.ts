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
  color?: string;
  size?: string;
  unitCost?: number;
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

