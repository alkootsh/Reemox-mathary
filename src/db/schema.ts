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
  enableEmployeeCards: boolean('enable_employee_cards').default(false),
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
  isActive: boolean('is_active').default(true),
});

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  uid: text('uid').unique(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  pin: text('pin'),
  employeeCode: text('employee_code'),
  employeeCardId: text('employee_card_id').unique(),
  cardStatus: text('card_status').default('ACTIVE'), // ACTIVE, DISABLED
  status: text('status').default('ACTIVE'), // ACTIVE, DISABLED, INACTIVE
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
  branchId: text('branch_id'),
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
  isActive: boolean('is_active').default(true),
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
  isActive: boolean('is_active').default(true),
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
  priceLevel: text('price_level').default('RETAIL'),
  balance: numeric('balance').default('0'),
  creditLimit: numeric('credit_limit').default('0'),
  createdAt: timestamp('created_at').defaultNow(),
  isActive: boolean('is_active').default(true),
});

export const productPrices = pgTable('product_prices', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  companyId: text('company_id').notNull(),
  priceLevel: text('price_level').notNull(),
  price: numeric('price').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const userPermissions = pgTable('user_permissions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  companyId: text('company_id').notNull(),
  permissionKey: text('permission_key').notNull(),
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
  isActive: boolean('is_active').default(true),
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
// FINANCIAL ACCOUNTING (GENERAL LEDGER)
// ----------------------------------------------------

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  companyId: text('company_id').references(() => companies.id).notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  parentAccountId: text('parent_account_id'),
  type: text('type').notNull(), // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
  level: integer('level').default(1),
  isGroup: boolean('is_group').default(false),
  balance: numeric('balance').default('0'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const journalEntries = pgTable('journal_entries', {
  id: text('id').primaryKey(),
  companyId: text('company_id').references(() => companies.id).notNull(),
  reference: text('reference').notNull(), // Invoice #, Receipt #, etc.
  date: timestamp('date').defaultNow(),
  description: text('description'),
  status: text('status').default('POSTED'), // DRAFT, POSTED
  createdAt: timestamp('created_at').defaultNow(),
});

export const journalItems = pgTable('journal_items', {
  id: text('id').primaryKey(),
  journalId: text('journal_id').references(() => journalEntries.id).notNull(),
  accountId: text('account_id').references(() => accounts.id).notNull(),
  debit: numeric('debit').default('0'),
  credit: numeric('credit').default('0'),
  costCenterId: text('cost_center_id'),
  partnerId: text('partner_id'), // Customer or Supplier ID
  notes: text('notes'),
});

export const costCenters = pgTable('cost_centers', {
  id: text('id').primaryKey(),
  companyId: text('company_id').references(() => companies.id).notNull(),
  name: text('name').notNull(),
  code: text('code'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ----------------------------------------------------
// MANUFACTURING (BOM & PRODUCTION)
// ----------------------------------------------------

export const billsOfMaterials = pgTable('bills_of_materials', {
  id: text('id').primaryKey(),
  companyId: text('company_id').references(() => companies.id).notNull(),
  productId: text('product_id').references(() => products.id).notNull(),
  name: text('name').notNull(),
  totalCost: numeric('total_cost').default('0'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const bomItems = pgTable('bom_items', {
  id: text('id').primaryKey(),
  bomId: text('bom_id').references(() => billsOfMaterials.id).notNull(),
  productId: text('product_id').notNull(),
  quantity: numeric('quantity').notNull(),
  unitCost: numeric('unit_cost').default('0'),
});

// ----------------------------------------------------
// HUMAN RESOURCES (HR & PAYROLL)
// ----------------------------------------------------

export const employees = pgTable('employees', {
  id: text('id').primaryKey(),
  companyId: text('company_id').references(() => companies.id).notNull(),
  name: text('name').notNull(),
  code: text('code').unique(),
  position: text('position'),
  department: text('department'),
  salary: numeric('salary').default('0'),
  joiningDate: timestamp('joining_date'),
  status: text('status').default('ACTIVE'), // ACTIVE, TERMINATED, ON_LEAVE
  createdAt: timestamp('created_at').defaultNow(),
});

export const payroll = pgTable('payroll', {
  id: text('id').primaryKey(),
  employeeId: text('employee_id').references(() => employees.id).notNull(),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  basicSalary: numeric('basic_salary').notNull(),
  allowances: numeric('allowances').default('0'),
  deductions: numeric('deductions').default('0'),
  netSalary: numeric('net_salary').notNull(),
  status: text('status').default('DRAFT'), // DRAFT, APPROVED, PAID
  createdAt: timestamp('created_at').defaultNow(),
});

// ----------------------------------------------------
// CRM & LOYALTY
// ----------------------------------------------------

export const loyaltyPoints = pgTable('loyalty_points', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').references(() => customers.id).notNull(),
  points: integer('points').default(0),
  lastUpdated: timestamp('last_updated').defaultNow(),
});

export const customerInteractions = pgTable('customer_interactions', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').references(() => customers.id).notNull(),
  type: text('type').notNull(), // CALL, MEETING, NOTE, COMPLAINT
  notes: text('notes'),
  date: timestamp('date').defaultNow(),
  userId: text('user_id').references(() => users.id),
});

// ----------------------------------------------------
// PRODUCT EXTENSIONS (BATCHES & SERIALS)
// ----------------------------------------------------

export const productBatches = pgTable('product_batches', {
  id: text('id').primaryKey(),
  productId: text('product_id').references(() => products.id).notNull(),
  batchNumber: text('batch_number').notNull(),
  expiryDate: timestamp('expiry_date'),
  quantity: numeric('quantity').default('0'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ----------------------------------------------------
// AI CO-PILOT MODULE
// ----------------------------------------------------

export const aiConfigs = pgTable('ai_configs', {
  id: text('id').primaryKey(),
  companyId: text('company_id').references(() => companies.id).notNull(),
  isEnabled: boolean('is_enabled').default(false),
  licenseKey: text('license_key'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const userAiMemories = pgTable('user_ai_memories', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id).notNull(),
  onboardingCompleted: boolean('onboarding_completed').default(false),
  interactionStyle: text('interaction_style').default('PROFESSIONAL'), // FRIENDLY, CONCISE, PROFESSIONAL
  preferences: jsonb('preferences').default({}),
  lastInteractionAt: timestamp('last_interaction_at').defaultNow(),
});

export const systemTelemetry = pgTable('system_telemetry', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // ERROR, PERFORMANCE, SECURITY
  component: text('component'),
  severity: text('severity'), // LOW, MEDIUM, HIGH, CRITICAL
  message: text('message').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const companyModuleOverrides = pgTable('company_module_overrides', {
  id: text('id').primaryKey(),
  companyId: text('company_id').references(() => companies.id).notNull(),
  moduleName: text('module_name').notNull(),
  isEnabled: boolean('is_enabled').default(false).notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: text('updated_by')
});

export const branchModuleOverrides = pgTable('branch_module_overrides', {
  id: text('id').primaryKey(),
  branchId: text('branch_id').references(() => branches.id).notNull(),
  moduleName: text('module_name').notNull(),
  isEnabled: boolean('is_enabled').default(false).notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: text('updated_by')
});

export const customFieldDefinitions = pgTable('custom_field_definitions', {
  id: text('id').primaryKey(),
  companyId: text('company_id').references(() => companies.id).notNull(),
  entityType: text('entity_type').notNull(), // PRODUCT, CUSTOMER, etc.
  fieldKey: text('field_key').notNull(),
  label: text('label').notNull(),
  dataType: text('data_type').notNull(), // TEXT, NUMBER, BOOLEAN, SELECT
  isRequired: boolean('is_required').default(false),
  optionsJson: jsonb('options_json').default([]), // For SELECT fields
  createdAt: timestamp('created_at').defaultNow()
});

export const counters = pgTable('counters', {
  id: text('id').primaryKey(), // e.g. sale_company_default
  companyId: text('company_id').notNull(),
  name: text('name').notNull(),
  currentValue: integer('current_value').default(0),
});
