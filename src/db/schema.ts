import { pgTable, text, numeric, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

// ----------------------------------------------------
// CORE & TENANT MANAGEMENT
// ----------------------------------------------------

export const companies = pgTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  taxNumber: text('tax_number'),
  phone: text('phone'),
  address: text('address'),
  currency: text('currency').default('SAR'),
  vatPercentage: numeric('vat_percentage').default('15'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const branches = pgTable('branches', {
  id: text('id').primaryKey(),
  companyId: text('company_id').references(() => companies.id).notNull(),
  name: text('name').notNull(),
  code: text('code'),
  phone: text('phone'),
  address: text('address'),
  isMain: boolean('is_main').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  uid: text('uid').unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  pin: text('pin'),
  companyId: text('company_id'),
  branchId: text('branch_id'),
  role: text('role').default('cashier'),
  cashierType: text('cashier_type').default('retail'), // retail, wholesale
  createdAt: timestamp('created_at').defaultNow(),
});

export const memberships = pgTable('memberships', {
  id: text('id').primaryKey(), // `${uid}_${companyId}`
  uid: text('uid').notNull(),
  userId: text('user_id'),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  role: text('role').notNull().default('cashier'), // ADMIN, CASHIER, MANAGER
  status: text('status').default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const roles = pgTable('roles', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const permissions = pgTable('permissions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category'),
  description: text('description'),
});

export const rolePermissions = pgTable('role_permissions', {
  id: text('id').primaryKey(),
  roleId: text('role_id').notNull(),
  permissionName: text('permission_name').notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  userId: text('user_id'),
  action: text('action').notNull(),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  userId: text('user_id'),
  title: text('title').notNull(),
  message: text('message').notNull(),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// ----------------------------------------------------
// PRODUCT & CATALOG MANAGEMENT
// ----------------------------------------------------

export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const brands = pgTable('brands', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const units = pgTable('units', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  name: text('name').notNull(),
  symbol: text('symbol'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  sku: text('sku'),
  barcode: text('barcode'),
  name: text('name').notNull(),
  price: numeric('price').notNull().default('0'), // retail price
  wholesalePrice: numeric('wholesale_price').default('0'),
  halfWholesalePrice: numeric('half_wholesale_price').default('0'),
  minPrice: numeric('min_price').default('0'),
  costPrice: numeric('cost_price').default('0'),
  stock: numeric('stock').notNull().default('0'),
  minStock: numeric('min_stock').default('0'),
  categoryId: text('category_id'),
  brandId: text('brand_id'),
  unitId: text('unit_id'),
  isWeighted: boolean('is_weighted').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const productBarcodes = pgTable('product_barcodes', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  companyId: text('company_id').notNull(),
  barcode: text('barcode').notNull(),
});

export const productVariants = pgTable('product_variants', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  companyId: text('company_id').notNull(),
  name: text('name').notNull(),
  sku: text('sku'),
  barcode: text('barcode'),
  price: numeric('price').default('0'),
  stock: numeric('stock').default('0'),
});

export const productPrices = pgTable('product_prices', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  companyId: text('company_id').notNull(),
  priceType: text('price_type').notNull(), // RETAIL, WHOLESALE
  price: numeric('price').notNull(),
});

// ----------------------------------------------------
// SALES & POS MANAGEMENT
// ----------------------------------------------------

export const sales = pgTable('sales', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  invoiceNumber: text('invoice_number').notNull(),
  saleType: text('sale_type').default('retail'), // retail, wholesale, half_wholesale
  subtotal: numeric('subtotal').notNull().default('0'),
  vatAmount: numeric('vat_amount').notNull().default('0'),
  total: numeric('total').notNull().default('0'),
  discount: numeric('discount').default('0'),
  paymentMethod: text('payment_method').notNull().default('CASH'),
  cashierId: text('cashier_id'),
  cashierName: text('cashier_name'),
  customerId: text('customer_id'),
  isCredit: boolean('is_credit').default(false),
  offlineSaleId: text('offline_sale_id').unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const saleItems = pgTable('sale_items', {
  id: text('id').primaryKey(),
  saleId: text('sale_id').notNull(),
  companyId: text('company_id').notNull(),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  quantity: numeric('quantity').notNull(),
  price: numeric('price').notNull(),
  total: numeric('total').notNull(),
});

export const payments = pgTable('payments', {
  id: text('id').primaryKey(),
  saleId: text('sale_id').notNull(),
  companyId: text('company_id').notNull(),
  method: text('method').notNull(), // CASH, CARD, WALLET, CREDIT
  amount: numeric('amount').notNull(),
  reference: text('reference'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const saleReturns = pgTable('sale_returns', {
  id: text('id').primaryKey(),
  saleId: text('sale_id').notNull(),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  returnNumber: text('return_number').notNull(),
  totalRefund: numeric('total_refund').notNull(),
  reason: text('reason'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const saleReturnItems = pgTable('sale_return_items', {
  id: text('id').primaryKey(),
  returnId: text('return_id').notNull(),
  companyId: text('company_id').notNull(),
  productId: text('product_id').notNull(),
  quantity: numeric('quantity').notNull(),
  refundAmount: numeric('refund_amount').notNull(),
});

// ----------------------------------------------------
// INVENTORY MANAGEMENT
// ----------------------------------------------------

export const warehouses = pgTable('warehouses', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  name: text('name').notNull(),
  location: text('location'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const inventoryBalances = pgTable('inventory_balances', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  warehouseId: text('warehouse_id'),
  productId: text('product_id').notNull(),
  quantity: numeric('quantity').notNull().default('0'),
});

export const inventoryMovements = pgTable('inventory_movements', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  quantity: numeric('quantity').notNull(),
  type: text('type').notNull(), // SALE, PURCHASE, ADJUSTMENT, TRANSFER_IN, TRANSFER_OUT, RETURN
  referenceId: text('reference_id'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const inventoryAdjustments = pgTable('inventory_adjustments', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  productId: text('product_id').notNull(),
  oldQuantity: numeric('old_quantity').notNull(),
  newQuantity: numeric('new_quantity').notNull(),
  reason: text('reason'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const inventoryTransfers = pgTable('inventory_transfers', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  fromBranchId: text('from_branch_id').notNull(),
  toBranchId: text('to_branch_id').notNull(),
  productId: text('product_id').notNull(),
  quantity: numeric('quantity').notNull(),
  status: text('status').default('COMPLETED'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ----------------------------------------------------
// CUSTOMERS & SUPPLIERS
// ----------------------------------------------------

export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  customerType: text('customer_type').default('retail'), // retail, wholesale, half_wholesale
  balance: numeric('balance').default('0'),
  creditLimit: numeric('credit_limit').default('0'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const customerTransactions = pgTable('customer_transactions', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  customerId: text('customer_id').notNull(),
  type: text('type').notNull(), // CREDIT_SALE, PAYMENT, RETURN
  amount: numeric('amount').notNull(),
  referenceId: text('reference_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const customerPayments = pgTable('customer_payments', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  customerId: text('customer_id').notNull(),
  amount: numeric('amount').notNull(),
  paymentMethod: text('payment_method').default('CASH'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const suppliers = pgTable('suppliers', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'),
  companyName: text('company_name'),
  balance: numeric('balance').default('0'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const supplierTransactions = pgTable('supplier_transactions', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  supplierId: text('supplier_id').notNull(),
  type: text('type').notNull(), // PURCHASE, PAYMENT, RETURN
  amount: numeric('amount').notNull(),
  referenceId: text('reference_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const supplierPayments = pgTable('supplier_payments', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  supplierId: text('supplier_id').notNull(),
  amount: numeric('amount').notNull(),
  paymentMethod: text('payment_method').default('CASH'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ----------------------------------------------------
// PURCHASING & EXPENSES
// ----------------------------------------------------

export const purchases = pgTable('purchases', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  purchaseNumber: text('purchase_number').notNull(),
  supplierId: text('supplier_id'),
  supplierName: text('supplier_name'),
  paymentMethod: text('payment_method').default('cash'),
  paidAmount: numeric('paid_amount').default('0'),
  subtotal: numeric('subtotal').notNull().default('0'),
  vatAmount: numeric('vat_amount').notNull().default('0'),
  total: numeric('total').notNull().default('0'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const purchaseItems = pgTable('purchase_items', {
  id: text('id').primaryKey(),
  purchaseId: text('purchase_id').notNull(),
  companyId: text('company_id').notNull(),
  productId: text('product_id').notNull(),
  productName: text('product_name').notNull(),
  quantity: numeric('quantity').notNull(),
  costPrice: numeric('cost_price').notNull(),
  total: numeric('total').notNull(),
});

export const purchaseReturns = pgTable('purchase_returns', {
  id: text('id').primaryKey(),
  purchaseId: text('purchase_id').notNull(),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  returnNumber: text('return_number').notNull(),
  totalRefund: numeric('total_refund').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const purchaseReturnItems = pgTable('purchase_return_items', {
  id: text('id').primaryKey(),
  returnId: text('return_id').notNull(),
  companyId: text('company_id').notNull(),
  productId: text('product_id').notNull(),
  quantity: numeric('quantity').notNull(),
  refundAmount: numeric('refund_amount').notNull(),
});

export const expenseCategories = pgTable('expense_categories', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  name: text('name').notNull(),
});

export const expenses = pgTable('expenses', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  title: text('title').notNull(),
  amount: numeric('amount').notNull(),
  category: text('category').notNull(),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ----------------------------------------------------
// CASHIER SHIFTS & CLOSURES
// ----------------------------------------------------

export const cashierSessions = pgTable('cashier_sessions', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull(),
  branchId: text('branch_id'),
  cashierId: text('cashier_id').notNull(),
  cashierName: text('cashier_name'),
  openingBalance: numeric('opening_balance').default('0'),
  closingBalance: numeric('closing_balance').default('0'),
  totalSales: numeric('total_sales').default('0'),
  totalCash: numeric('total_cash').default('0'),
  totalCard: numeric('total_card').default('0'),
  status: text('status').default('OPEN'), // OPEN, CLOSED
  openedAt: timestamp('opened_at').defaultNow(),
  closedAt: timestamp('closed_at'),
});

export const cashierTransactions = pgTable('cashier_transactions', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  companyId: text('company_id').notNull(),
  type: text('type').notNull(), // CASH_IN, CASH_OUT, SALE, REFUND
  amount: numeric('amount').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const cashierClosures = pgTable('cashier_closures', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  companyId: text('company_id').notNull(),
  totalSales: numeric('total_sales').notNull(),
  expectedCash: numeric('expected_cash').notNull(),
  actualCash: numeric('actual_cash').notNull(),
  difference: numeric('difference').notNull(),
  notes: text('notes'),
  closedAt: timestamp('closed_at').defaultNow(),
});

// ----------------------------------------------------
// COUNTERS & SEQUENCES
// ----------------------------------------------------

export const counters = pgTable('counters', {
  id: text('id').primaryKey(), // e.g. sale_company_default
  companyId: text('company_id').notNull(),
  name: text('name').notNull(),
  currentValue: integer('current_value').default(0),
});
