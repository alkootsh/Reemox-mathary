import { db, createPool } from './index.ts';
import { 
  companies, branches, users, memberships, products, categories, units,
  sales, saleItems, payments, inventoryMovements, cashierSessions, 
  customers, suppliers, purchases, purchaseItems, expenses, counters,
  customerTransactions, supplierTransactions, cashierTransactions, expenseCategories,
  saleReturns, saleReturnItems, purchaseReturns, purchaseReturnItems, auditLogs,
  userPermissions, productPrices, accounts, journalEntries, journalItems, costCenters,
  billsOfMaterials, bomItems, employees, payroll, loyaltyPoints, customerInteractions, productBatches,
  aiConfigs, userAiMemories, systemTelemetry,
  companyModuleOverrides, branchModuleOverrides, customFieldDefinitions
} from './schema.ts';
import { eq, and, sql, desc, ne } from 'drizzle-orm';

// Helper to sanitize tenant company ID
function requireTenant(companyId?: string): string {
  if (!companyId || companyId.trim() === '') {
    return 'company_default';
  }
  return companyId.trim();
}

// ----------------------------------------------------
// STARTUP MIGRATIONS
// ----------------------------------------------------
export async function runStartupMigrations() {
  const pool = createPool();
  try {
    // Attempt column additions individually to avoid complete failure if one fails (e.g. permission issues)
    const migrationStatements = [
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code text`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_card_id text`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS card_status text DEFAULT 'ACTIVE'`,
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS status text DEFAULT 'ACTIVE'`,
      `CREATE UNIQUE INDEX IF NOT EXISTS users_employee_card_id_idx ON users(employee_card_id) WHERE employee_card_id IS NOT NULL`,
      `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS branch_id text`
    ];

    for (const stmt of migrationStatements) {
      try {
        await pool.query(stmt);
      } catch (err: any) {
        // Log notice instead of throwing if it's a permission issue or already exists
        if (err.code === '42501' || err.code === '42701') {
          console.warn(`[Migration Warning] Statement skipped: ${stmt.substring(0, 50)}... - Error: ${err.message}`);
        } else {
          throw err;
        }
      }
    }

    // Seed logic usually works fine if we have INSERT permissions
    await pool.query(`
      -- Seed default company & branch if not exists
      INSERT INTO companies (id, name, tax_number, phone, address, currency, vat_percentage)
      VALUES ('company_default', 'شركة مارو للأعمال - MARO ERP Business', '300000000000003', '01000000000', 'المقر الرئيسي', 'SAR', '15')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO branches (id, company_id, name, code, is_main)
      VALUES ('branch_main', 'company_default', 'الفرع الرئيسي', 'MAIN', true)
      ON CONFLICT (id) DO NOTHING;

      -- Seed Chart of Accounts (COA) - Basic Level 1
      INSERT INTO accounts (id, company_id, code, name, type, level, is_group)
      VALUES
        ('acc_1', 'company_default', '1', 'الأصول', 'ASSET', 1, true),
        ('acc_2', 'company_default', '2', 'الخصوم', 'LIABILITY', 1, true),
        ('acc_3', 'company_default', '3', 'حقوق الملكية', 'EQUITY', 1, true),
        ('acc_4', 'company_default', '4', 'الإيرادات', 'REVENUE', 1, true),
        ('acc_5', 'company_default', '5', 'المصروفات', 'EXPENSE', 1, true)
      ON CONFLICT (id) DO NOTHING;

      -- Seed COA - Level 2 (Cash & Bank)
      INSERT INTO accounts (id, company_id, code, name, parent_account_id, type, level, is_group)
      VALUES
        ('acc_11', 'company_default', '11', 'الأصول المتداولة', 'acc_1', 'ASSET', 2, true),
        ('acc_111', 'company_default', '111', 'النقدية وما في حكمها', 'acc_11', 'ASSET', 3, true),
        ('acc_cash_main', 'company_default', '111001', 'الخزينة الرئيسية', 'acc_111', 'ASSET', 4, false),
        ('acc_bank_main', 'company_default', '111002', 'البنك الأهلي', 'acc_111', 'ASSET', 4, false)
      ON CONFLICT (id) DO NOTHING;

      -- Seed default demo users with card IDs if not exist
      INSERT INTO users (id, uid, email, name, pin, role, cashier_type, company_id, branch_id, employee_code, employee_card_id, card_status, status)
      VALUES 
        ('usr-admin', 'usr-admin', 'admin@maro-pos.local', 'المدير العام', '1234', 'admin', 'retail', 'company_default', 'branch_main', 'EMP-001', 'CARD-ADMIN-999', 'ACTIVE', 'ACTIVE'),
        ('usr-cashier', 'usr-cashier', 'cashier@maro-pos.local', 'كاشير الفرع', '0000', 'cashier', 'retail', 'company_default', 'branch_main', 'EMP-002', 'CARD-CASHIER-101', 'ACTIVE', 'ACTIVE')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO memberships (id, user_id, uid, company_id, branch_id, role, status)
      VALUES
        ('mem-admin', 'usr-admin', 'usr-admin', 'company_default', 'branch_main', 'ADMIN', 'ACTIVE'),
        ('mem-cashier', 'usr-cashier', 'usr-cashier', 'company_default', 'branch_main', 'CASHIER', 'ACTIVE')
      ON CONFLICT (id) DO NOTHING;
    `);
    console.log('[PostgreSQL Migration] Startup migrations and user cards seed applied successfully');
  } catch (err) {
    console.error('[PostgreSQL Migration Error]:', err);
  }
}

// ----------------------------------------------------
// AUDIT LOGGING
// ----------------------------------------------------
export async function logAuditEvent(data: {
  id?: string;
  companyId: string;
  userId?: string;
  branchId?: string;
  action: string;
  details?: any;
}) {
  try {
    const id = data.id || `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const cId = requireTenant(data.companyId);
    await db.insert(auditLogs).values({
      id,
      companyId: cId,
      userId: data.userId || null,
      branchId: data.branchId || null,
      action: data.action,
      details: data.details || null,
    });
    return id;
  } catch (err) {
    console.error('logAuditEvent error:', err);
    return null;
  }
}

export async function getAuditLogs(companyId: string, limitCount = 200) {
  const cId = requireTenant(companyId);
  try {
    return await db.select().from(auditLogs).where(eq(auditLogs.companyId, cId)).orderBy(desc(auditLogs.createdAt)).limit(limitCount);
  } catch (err) {
    console.error('getAuditLogs error:', err);
    return [];
  }
}

// ----------------------------------------------------
// COMPANIES & BRANCHES
// ----------------------------------------------------

export async function getCompanies() {
  try {
    return await db.select().from(companies);
  } catch (err) {
    console.error('getCompanies error:', err);
    return [];
  }
}

export async function getCompanyById(id: string) {
  try {
    const res = await db.select().from(companies).where(eq(companies.id, id));
    return res[0] || null;
  } catch (err) {
    console.error('getCompanyById error:', err);
    return null;
  }
}

export async function saveCompany(data: { id?: string; name: string; taxNumber?: string; phone?: string; address?: string; currency?: string; vatPercentage?: number | string }) {
  const id = data.id || `comp_${Date.now()}`;
  const payload = {
    id,
    name: data.name,
    taxNumber: data.taxNumber || '',
    phone: data.phone || '',
    address: data.address || '',
    currency: data.currency || 'SAR',
    vatPercentage: (data.vatPercentage !== undefined ? String(data.vatPercentage) : '15')
  };

  await db.insert(companies).values(payload).onConflictDoUpdate({
    target: companies.id,
    set: payload
  });
  return id;
}

export async function getBranches(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    return await db.select().from(branches).where(eq(branches.companyId, cId));
  } catch (err) {
    console.error('getBranches error:', err);
    return [];
  }
}

export async function saveBranch(data: { id?: string; companyId: string; name: string; code?: string; phone?: string; address?: string; isMain?: boolean }) {
  const cId = requireTenant(data.companyId);
  const id = data.id || `branch_${Date.now()}`;
  const payload = {
    id,
    companyId: cId,
    name: data.name,
    code: data.code || '',
    phone: data.phone || '',
    address: data.address || '',
    isMain: data.isMain ?? false
  };

  await db.insert(branches).values(payload).onConflictDoUpdate({
    target: branches.id,
    set: payload
  });
  return id;
}

// ----------------------------------------------------
// USERS & MEMBERSHIPS
// ----------------------------------------------------

export async function getUsers(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    return await db.select().from(users).where(eq(users.companyId, cId));
  } catch (err) {
    console.error('getUsers error:', err);
    return [];
  }
}

export async function getUserById(id: string, companyId?: string) {
  try {
    const conditions = companyId ? and(eq(users.id, id), eq(users.companyId, requireTenant(companyId))) : eq(users.id, id);
    const res = await db.select().from(users).where(conditions).limit(1);
    return res[0] || null;
  } catch (err) {
    console.error('getUserById error:', err);
    return null;
  }
}

export async function getUserByCardId(cardId: string) {
  if (!cardId || !cardId.trim()) return null;
  try {
    const res = await db.select().from(users).where(eq(users.employeeCardId, cardId.trim())).limit(1);
    return res[0] || null;
  } catch (err) {
    console.error('getUserByCardId error:', err);
    return null;
  }
}

export async function saveUser(data: {
  id?: string;
  uid?: string;
  email?: string;
  name: string;
  pin?: string;
  employeeCode?: string;
  employeeCardId?: string | null;
  cardStatus?: string;
  status?: string;
  companyId?: string;
  branchId?: string;
  role?: string;
  cashierType?: string;
}) {
  const id = data.id || `usr_${Date.now()}`;
  const cId = requireTenant(data.companyId);
  const payload: any = {
    id,
    uid: data.uid || id,
    email: data.email || `${data.name.replace(/\s+/g, '').toLowerCase()}@maro-pos.local`,
    name: data.name,
    pin: data.pin || '1234',
    companyId: cId,
    branchId: data.branchId || '',
    role: data.role || 'cashier',
    cashierType: data.cashierType || 'retail',
  };

  if (data.employeeCode !== undefined) payload.employeeCode = data.employeeCode;
  if (data.employeeCardId !== undefined) payload.employeeCardId = data.employeeCardId;
  if (data.cardStatus !== undefined) payload.cardStatus = data.cardStatus;
  if (data.status !== undefined) payload.status = data.status;

  await db.insert(users).values(payload).onConflictDoUpdate({
    target: users.id,
    set: payload
  });
  return id;
}

export async function updateUserCard(userId: string, cardData: {
  employeeCardId?: string | null;
  cardStatus?: string;
  employeeCode?: string;
}, companyId?: string) {
  const cId = companyId ? requireTenant(companyId) : undefined;
  
  // 1. Check if user exists
  const existingUser = await getUserById(userId, cId);
  if (!existingUser) {
    throw new Error('User not found');
  }

  // Check company setting
  const company = await db.select().from(companies).where(eq(companies.id, cId)).limit(1);
  const enableEmployeeCards = company.length > 0 ? company[0].enableEmployeeCards : false;

  // 2. If assigning a new non-empty cardId, check uniqueness across other users
  if (cardData.employeeCardId && cardData.employeeCardId.trim() !== '') {
    if (!enableEmployeeCards) {
      throw new Error('ميزة كارت الموظف غير مفعلة لهذه الشركة');
    }
    const cleanCard = cardData.employeeCardId.trim();
    const duplicate = await db.select().from(users).where(and(eq(users.employeeCardId, cleanCard), sql`${users.id} != ${userId}`)).limit(1);
    if (duplicate.length > 0) {
      throw new Error(`كارت الموظف (${cleanCard}) مسجل بالفعل للموظف: ${duplicate[0].name}`);
    }
  }

  const updateFields: any = {};
  if (cardData.employeeCardId !== undefined) {
    updateFields.employeeCardId = cardData.employeeCardId && cardData.employeeCardId.trim() !== '' ? cardData.employeeCardId.trim() : null;
  }
  if (cardData.cardStatus !== undefined) {
    updateFields.cardStatus = cardData.cardStatus;
  }
  if (cardData.employeeCode !== undefined) {
    updateFields.employeeCode = cardData.employeeCode.trim();
  }

  await db.update(users).set(updateFields).where(eq(users.id, userId));
  const updated = await getUserById(userId);
  return updated;
}

export async function deleteUser(id: string, companyId: string) {
  const cId = requireTenant(companyId);
  await db.delete(users).where(and(eq(users.id, id), eq(users.companyId, cId)));
  await db.delete(memberships).where(and(eq(memberships.userId, id), eq(memberships.companyId, cId)));
}

export async function getMemberships(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    return await db.select().from(memberships).where(eq(memberships.companyId, cId));
  } catch (err) {
    console.error('getMemberships error:', err);
    return [];
  }
}

export async function saveMembership(data: { id?: string; uid: string; userId?: string; companyId: string; branchId?: string; role?: string; status?: string }) {
  const cId = requireTenant(data.companyId);
  const docId = data.id || `${data.uid}_${cId}`;
  const payload = {
    id: docId,
    uid: data.uid,
    userId: data.userId || data.uid,
    companyId: cId,
    branchId: data.branchId || '',
    role: data.role || 'cashier',
    status: data.status || 'ACTIVE'
  };

  await db.insert(memberships).values(payload).onConflictDoUpdate({
    target: memberships.id,
    set: payload
  });
  return docId;
}

// ----------------------------------------------------
// CATEGORIES & PRODUCTS
// ----------------------------------------------------

export async function getCategories(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    return await db.select().from(categories).where(eq(categories.companyId, cId));
  } catch (err) {
    console.error('getCategories error:', err);
    return [];
  }
}

export async function saveCategory(data: { id?: string; companyId: string; name: string; description?: string }) {
  const cId = requireTenant(data.companyId);
  const id = data.id || `cat_${Date.now()}`;
  const payload = {
    id,
    companyId: cId,
    name: data.name,
    description: data.description || ''
  };

  await db.insert(categories).values(payload).onConflictDoUpdate({
    target: categories.id,
    set: payload
  });
  return id;
}

export async function deleteCategory(id: string, companyId: string) {
  const cId = requireTenant(companyId);
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.companyId, cId)));
}

export async function getProducts(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    const raw = await db.select().from(products).where(eq(products.companyId, cId));
    return raw.map(p => ({
      ...p,
      price: Number(p.price || 0),
      wholesalePrice: Number(p.wholesalePrice || 0),
      halfWholesalePrice: Number(p.halfWholesalePrice || 0),
      minPrice: Number(p.minPrice || 0),
      costPrice: Number(p.costPrice || 0),
      stock: Number(p.stock || 0),
      minStock: Number(p.minStock || 0)
    }));
  } catch (err) {
    console.error('getProducts error:', err);
    return [];
  }
}

export async function saveProduct(data: { 
  id?: string; companyId: string; sku?: string; barcode?: string; name: string; 
  price: number; wholesalePrice?: number; halfWholesalePrice?: number; minPrice?: number; costPrice?: number; stock: number; minStock?: number; 
  categoryId?: string; brandId?: string; unitId?: string; isWeighted?: boolean;
}) {
  const cId = requireTenant(data.companyId);
  const id = data.id || `prod_${Date.now()}`;
  const payload = {
    id,
    companyId: cId,
    sku: data.sku || `SKU-${Date.now().toString().slice(-6)}`,
    barcode: data.barcode || '',
    name: data.name,
    price: String(data.price || 0),
    wholesalePrice: String(data.wholesalePrice || 0),
    halfWholesalePrice: String(data.halfWholesalePrice || 0),
    minPrice: String(data.minPrice || 0),
    costPrice: String(data.costPrice || 0),
    stock: String(data.stock || 0),
    minStock: String(data.minStock || 0),
    categoryId: data.categoryId || '',
    brandId: data.brandId || '',
    unitId: data.unitId || '',
    isWeighted: data.isWeighted ?? false
  };

  await db.insert(products).values(payload).onConflictDoUpdate({
    target: products.id,
    set: payload
  });
  return id;
}

export async function deleteProduct(id: string, companyId: string) {
  const cId = requireTenant(companyId);
  await db.delete(products).where(and(eq(products.id, id), eq(products.companyId, cId)));
}

// ----------------------------------------------------
// ATOMIC SALES TRANSACTION & POS (SQL TRANSACTION)
// ----------------------------------------------------

export async function createSaleTransaction(saleData: {
  id?: string;
  companyId: string;
  branchId?: string;
  invoiceNumber: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  discount?: number;
  paymentMethod: string;
  splitPayments?: Array<{ method: string; amount: number }>;
  cashierId?: string;
  cashierName?: string;
  customerId?: string;
  isCredit?: boolean;
  offlineSaleId?: string;
  userRole?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    total: number;
  }>;
}) {
  const cId = requireTenant(saleData.companyId);
  const saleId = saleData.id || `sale_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  // Auto-generate invoice number if missing
  if (!saleData.invoiceNumber) {
    const nextVal = await getNextSequence(cId, 'sale');
    saleData.invoiceNumber = `INV-${nextVal.toString().padStart(5, '0')}`;
  }

  // Idempotency check for offline sales
  if (saleData.offlineSaleId) {
    const existing = await db.select().from(sales).where(and(eq(sales.companyId, cId), eq(sales.offlineSaleId, saleData.offlineSaleId)));
    if (existing.length > 0) {
      console.log(`Sale with offlineSaleId ${saleData.offlineSaleId} already processed. Skipping duplicate.`);
      return existing[0].id;
    }
  }

  // Split payment validation
  if (saleData.paymentMethod === 'SPLIT' && saleData.splitPayments && saleData.splitPayments.length > 0) {
    const splitTotal = saleData.splitPayments.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(splitTotal - saleData.total) > 0.01) {
      throw new Error(`Payment amounts do not equal sale total (${splitTotal} != ${saleData.total})`);
    }
  }

  // Credit Limit Validation
  if (saleData.customerId && saleData.isCredit) {
    const customer = await db.select().from(customers).where(and(eq(customers.id, saleData.customerId), eq(customers.companyId, cId))).limit(1);
    if (customer.length > 0) {
      const cust = customer[0];
      if (!cust.isActive) throw new Error('CUSTOMER_INACTIVE');
      const currentDebt = await getCustomerDebt(cId, saleData.customerId);
      const newDebt = currentDebt + saleData.total;
      if (Number(cust.creditLimit) > 0 && newDebt > Number(cust.creditLimit)) {
        throw new Error('CREDIT_LIMIT_EXCEEDED');
      }
    }
  }

  // Product Active Validation & Price Resolution
  let calculatedSubtotal = 0;
  for (const item of saleData.items) {
    const prodRes = await db.select().from(products).where(and(eq(products.id, item.productId), eq(products.companyId, cId))).limit(1);
    if (prodRes.length === 0) throw new Error('PRODUCT_NOT_FOUND');
    const prod = prodRes[0];
    if (!prod.isActive) throw new Error('PRODUCT_INACTIVE');

    // Price Resolution Logic
    const serverPriceStr = await getPriceForCustomer(item.productId, saleData.customerId || '', cId);
    const serverPrice = Number(serverPriceStr);
    
    // Override logic: if requested price differs from server price, check if user has permission
    const requestedPrice = Number(item.price);
    const isOverride = requestedPrice > 0 && Math.abs(requestedPrice - serverPrice) > 0.01;
    
    if (isOverride) {
      const canOverride = saleData.userRole === 'ADMIN' || saleData.userRole === 'MANAGER';
      if (!canOverride) {
        // Enforce server price for Cashier or unauthorized roles
        item.price = serverPrice;
      }
      // If MANAGER/ADMIN, we keep the requestedPrice as item.price
    } else {
      // Use serverPrice if no override or requestedPrice is <= 0
      item.price = serverPrice;
    }
    
    item.total = item.price * item.quantity;
    calculatedSubtotal += item.total;
  }

  // Recalculate totals to be sure
  const vatRate = 0.15; // Should ideally come from company settings
  const vatAmount = calculatedSubtotal * vatRate;
  const total = calculatedSubtotal + vatAmount;

  // Update saleData with safe values
  saleData.subtotal = calculatedSubtotal;
  saleData.vatAmount = vatAmount;
  saleData.total = total;

  // SQL Transaction
  return await db.transaction(async (tx) => {
    // 1. Insert Sales Header
    await tx.insert(sales).values({
      id: saleId,
      companyId: cId,
      branchId: saleData.branchId || 'branch_main',
      invoiceNumber: saleData.invoiceNumber,
      subtotal: String(saleData.subtotal),
      vatAmount: String(saleData.vatAmount),
      total: String(saleData.total),
      discount: String(saleData.discount || 0),
      paymentMethod: saleData.paymentMethod || 'CASH',
      cashierId: saleData.cashierId || '',
      cashierName: saleData.cashierName || '',
      customerId: saleData.customerId || '',
      isCredit: saleData.isCredit ?? false,
      offlineSaleId: saleData.offlineSaleId || null
    });

    // 2. Insert Sale Items & Deduct Inventory
    for (const item of saleData.items) {
      const itemId = `sitem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await tx.insert(saleItems).values({
        id: itemId,
        saleId: saleId,
        companyId: cId,
        productId: item.productId,
        productName: item.productName,
        quantity: String(item.quantity),
        price: String(item.price),
        total: String(item.total)
      });

      // Stock Row-Level Lock & Deduct
      const pRes = await tx.select().from(products).where(and(eq(products.id, item.productId), eq(products.companyId, cId))).for('update');
      if (pRes.length > 0) {
        const currentStock = Number(pRes[0].stock || 0);
        const newStock = Math.max(0, currentStock - item.quantity);
        await tx.update(products).set({ stock: String(newStock) }).where(and(eq(products.id, item.productId), eq(products.companyId, cId)));
      }

      // Record Inventory Movement
      const movId = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await tx.insert(inventoryMovements).values({
        id: movId,
        companyId: cId,
        branchId: saleData.branchId || 'branch_main',
        productId: item.productId,
        productName: item.productName,
        quantity: String(-item.quantity),
        type: 'SALE',
        referenceId: saleId
      });
    }

    // 3. Record Payment Breakdown
    if (saleData.splitPayments && saleData.splitPayments.length > 0) {
      for (const sp of saleData.splitPayments) {
        const payId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        await tx.insert(payments).values({
          id: payId,
          saleId,
          companyId: cId,
          method: sp.method,
          amount: String(sp.amount)
        });
      }
    } else {
      const payId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await tx.insert(payments).values({
        id: payId,
        saleId,
        companyId: cId,
        method: saleData.paymentMethod || 'CASH',
        amount: String(saleData.total)
      });
    }

    // 4. Update Customer Balance if Credit Sale
    if (saleData.isCredit && saleData.customerId) {
      const custRes = await tx.select().from(customers).where(and(eq(customers.id, saleData.customerId), eq(customers.companyId, cId)));
      if (custRes.length > 0) {
        const currentBal = Number(custRes[0].balance || 0);
        const newBal = currentBal + saleData.total;
        await tx.update(customers).set({ balance: String(newBal) }).where(and(eq(customers.id, saleData.customerId), eq(customers.companyId, cId)));

        const ctxId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        await tx.insert(customerTransactions).values({
          id: ctxId,
          companyId: cId,
          customerId: saleData.customerId,
          type: 'CREDIT_SALE',
          amount: String(saleData.total),
          referenceId: saleId,
          notes: `فاتورة مبيعات آجل #${saleData.invoiceNumber}`
        });
      }
    }

    // 5. Update Active Cashier Session Totals
    const openSessions = await tx.select()
      .from(cashierSessions)
      .where(and(eq(cashierSessions.companyId, cId), eq(cashierSessions.status, 'OPEN')))
      .orderBy(desc(cashierSessions.openedAt))
      .limit(1);

    if (openSessions.length > 0) {
      const session = openSessions[0];
      let newTotalSales = Number(session.totalSales || 0) + saleData.total;
      let newTotalCash = Number(session.totalCash || 0);
      let newTotalCard = Number(session.totalCard || 0);

      if (saleData.paymentMethod === 'SPLIT' && saleData.splitPayments) {
        saleData.splitPayments.forEach(sp => {
          if (sp.method === 'CASH') newTotalCash += sp.amount;
          if (sp.method === 'CARD') newTotalCard += sp.amount;
        });
      } else {
        if (saleData.paymentMethod === 'CASH') newTotalCash += saleData.total;
        if (saleData.paymentMethod === 'CARD') newTotalCard += saleData.total;
      }

      await tx.update(cashierSessions)
        .set({ 
          totalSales: String(newTotalSales),
          totalCash: String(newTotalCash),
          totalCard: String(newTotalCard)
        })
        .where(eq(cashierSessions.id, session.id));
    }

    return saleId;
  });
}

export async function getSales(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    const rawSales = await db.select().from(sales).where(eq(sales.companyId, cId)).orderBy(desc(sales.createdAt));
    const rawItems = await db.select().from(saleItems).where(eq(saleItems.companyId, cId));

    const itemsBySale = new Map<string, any[]>();
    for (const item of rawItems) {
      if (!itemsBySale.has(item.saleId)) {
        itemsBySale.set(item.saleId, []);
      }
      itemsBySale.get(item.saleId)!.push({
        ...item,
        quantity: Number(item.quantity),
        price: Number(item.price),
        total: Number(item.total)
      });
    }

    return rawSales.map(s => ({
      ...s,
      subtotal: Number(s.subtotal),
      vatAmount: Number(s.vatAmount),
      total: Number(s.total),
      discount: Number(s.discount),
      items: itemsBySale.get(s.id) || []
    }));
  } catch (err) {
    console.error('getSales error:', err);
    return [];
  }
}

// ----------------------------------------------------
// INVENTORY MOVEMENTS & PURCHASES
// ----------------------------------------------------

export async function getInventoryMovements(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    const raw = await db.select().from(inventoryMovements).where(eq(inventoryMovements.companyId, cId)).orderBy(desc(inventoryMovements.createdAt));
    return raw.map(m => ({
      ...m,
      quantity: Number(m.quantity)
    }));
  } catch (err) {
    console.error('getInventoryMovements error:', err);
    return [];
  }
}

export async function createPurchaseTransaction(purchaseData: {
  id?: string;
  companyId: string;
  branchId?: string;
  purchaseNumber?: string;
  supplierId?: string;
  supplierName?: string;
  subtotal?: number;
  vatAmount?: number;
  paymentMethod?: string;
  paidAmount?: number;
  total: number;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    costPrice?: number;
    cost?: number;
    total?: number;
  }>;
}) {
  const cId = requireTenant(purchaseData.companyId);
  const purchaseId = purchaseData.id || `purch_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const pNum = purchaseData.purchaseNumber || `PUR-${Date.now().toString().slice(-6)}`;

  return await db.transaction(async (tx) => {
    // Header
    await tx.insert(purchases).values({
      id: purchaseId,
      companyId: cId,
      branchId: purchaseData.branchId || 'branch_main',
      purchaseNumber: pNum,
      supplierId: purchaseData.supplierId || '',
      supplierName: purchaseData.supplierName || '',
      paymentMethod: purchaseData.paymentMethod || 'cash',
      paidAmount: String(purchaseData.paidAmount || 0),
      subtotal: String(purchaseData.subtotal || purchaseData.total || 0),
      vatAmount: String(purchaseData.vatAmount || 0),
      total: String(purchaseData.total || 0)
    });

    // Items & Stock Increment
    for (const item of purchaseData.items) {
      const itemId = `pitem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const costPriceVal = item.costPrice !== undefined ? item.costPrice : (item.cost !== undefined ? item.cost : 0);
      const totalVal = item.total !== undefined ? item.total : ((item.quantity || 0) * costPriceVal);

      await tx.insert(purchaseItems).values({
        id: itemId,
        purchaseId: purchaseId,
        companyId: cId,
        productId: item.productId,
        productName: item.productName,
        quantity: String(item.quantity || 0),
        costPrice: String(costPriceVal),
        total: String(totalVal)
      });

      const pRes = await tx.select().from(products).where(and(eq(products.id, item.productId), eq(products.companyId, cId))).for('update');
      if (pRes.length > 0) {
        const currentStock = Number(pRes[0].stock || 0);
        const newStock = currentStock + (item.quantity || 0);
        await tx.update(products).set({ stock: String(newStock), costPrice: String(costPriceVal) }).where(and(eq(products.id, item.productId), eq(products.companyId, cId)));
      }

      const movId = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await tx.insert(inventoryMovements).values({
        id: movId,
        companyId: cId,
        branchId: purchaseData.branchId || 'branch_main',
        productId: item.productId,
        productName: item.productName,
        quantity: String(item.quantity || 0),
        type: 'PURCHASE',
        referenceId: purchaseId
      });
    }

    // Supplier Balance Update
    if (purchaseData.supplierId) {
      const suppRes = await tx.select().from(suppliers).where(and(eq(suppliers.id, purchaseData.supplierId), eq(suppliers.companyId, cId)));
      if (suppRes.length > 0) {
        const currentBal = Number(suppRes[0].balance || 0);
        const newBal = currentBal + (purchaseData.total || 0);
        await tx.update(suppliers).set({ balance: String(newBal) }).where(and(eq(suppliers.id, purchaseData.supplierId), eq(suppliers.companyId, cId)));

        const stxId = `stx_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        await tx.insert(supplierTransactions).values({
          id: stxId,
          companyId: cId,
          supplierId: purchaseData.supplierId,
          type: 'PURCHASE',
          amount: String(purchaseData.total || 0),
          referenceId: purchaseId,
          notes: `فاتورة شراء #${pNum}`
        });
      }
    }

    return purchaseId;
  });
}

export async function getPurchases(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    const rawP = await db.select().from(purchases).where(eq(purchases.companyId, cId)).orderBy(desc(purchases.createdAt));
    const rawItems = await db.select().from(purchaseItems).where(eq(purchaseItems.companyId, cId));

    const itemsByP = new Map<string, any[]>();
    for (const item of rawItems) {
      if (!itemsByP.has(item.purchaseId)) {
        itemsByP.set(item.purchaseId, []);
      }
      itemsByP.get(item.purchaseId)!.push({
        ...item,
        quantity: Number(item.quantity),
        costPrice: Number(item.costPrice),
        cost: Number(item.costPrice),
        total: Number(item.total)
      });
    }

    return rawP.map(p => ({
      ...p,
      subtotal: Number(p.subtotal),
      vatAmount: Number(p.vatAmount),
      total: Number(p.total),
      paymentMethod: p.paymentMethod || 'cash',
      paidAmount: Number(p.paidAmount || 0),
      date: p.createdAt ? p.createdAt.toISOString() : new Date().toISOString(),
      items: itemsByP.get(p.id) || []
    }));
  } catch (err) {
    console.error('getPurchases error:', err);
    return [];
  }
}

export async function deletePurchaseTransaction(purchaseId: string, companyId: string) {
  const cId = requireTenant(companyId);
  return await db.transaction(async (tx) => {
    // Get purchase items to revert stock
    const items = await tx.select().from(purchaseItems).where(and(eq(purchaseItems.purchaseId, purchaseId), eq(purchaseItems.companyId, cId)));
    for (const item of items) {
      const pRes = await tx.select().from(products).where(and(eq(products.id, item.productId), eq(products.companyId, cId))).for('update');
      if (pRes.length > 0) {
        const currentStock = Number(pRes[0].stock || 0);
        const qty = Number(item.quantity || 0);
        const newStock = Math.max(0, currentStock - qty);
        await tx.update(products).set({ stock: String(newStock) }).where(and(eq(products.id, item.productId), eq(products.companyId, cId)));
      }
    }

    // Adjust supplier balance if needed
    const purch = await tx.select().from(purchases).where(and(eq(purchases.id, purchaseId), eq(purchases.companyId, cId)));
    if (purch.length > 0 && purch[0].supplierId) {
      const supplierId = purch[0].supplierId;
      const totalAmount = Number(purch[0].total || 0);
      const suppRes = await tx.select().from(suppliers).where(and(eq(suppliers.id, supplierId), eq(suppliers.companyId, cId)));
      if (suppRes.length > 0) {
        const currentBal = Number(suppRes[0].balance || 0);
        const newBal = Math.max(0, currentBal - totalAmount);
        await tx.update(suppliers).set({ balance: String(newBal) }).where(and(eq(suppliers.id, supplierId), eq(suppliers.companyId, cId)));
      }
    }

    // Delete purchase items
    await tx.delete(purchaseItems).where(and(eq(purchaseItems.purchaseId, purchaseId), eq(purchaseItems.companyId, cId)));

    // Delete from inventory movements
    await tx.delete(inventoryMovements).where(and(eq(inventoryMovements.referenceId, purchaseId), eq(inventoryMovements.companyId, cId)));

    // Delete supplier transaction record
    await tx.delete(supplierTransactions).where(and(eq(supplierTransactions.referenceId, purchaseId), eq(supplierTransactions.companyId, cId)));

    // Delete purchase header
    await tx.delete(purchases).where(and(eq(purchases.id, purchaseId), eq(purchases.companyId, cId)));

    return true;
  });
}

export async function deleteSaleTransaction(saleId: string, companyId: string) {
  const cId = requireTenant(companyId);
  return await db.transaction(async (tx) => {
    // 1. Get sale details
    const saleRes = await tx.select().from(sales).where(and(eq(sales.id, saleId), eq(sales.companyId, cId)));
    const saleData = saleRes.length > 0 ? saleRes[0] : null;

    // 2. Get sale items to return stock to products
    const items = await tx.select().from(saleItems).where(and(eq(saleItems.saleId, saleId), eq(saleItems.companyId, cId)));
    for (const item of items) {
      if (item.productId) {
        const pRes = await tx.select().from(products).where(and(eq(products.id, item.productId), eq(products.companyId, cId))).for('update');
        if (pRes.length > 0) {
          const currentStock = Number(pRes[0].stock || 0);
          const qty = Number(item.quantity || 0);
          const newStock = currentStock + qty;
          await tx.update(products).set({ stock: String(newStock) }).where(and(eq(products.id, item.productId), eq(products.companyId, cId)));
        }
      }
    }

    // 3. Adjust customer balance if it was a credit sale
    if (saleData && saleData.customerId) {
      const customerId = saleData.customerId;
      const totalAmt = Number(saleData.total || 0);
      const isCredit = saleData.isCredit || String(saleData.paymentMethod).toLowerCase() === 'credit';
      
      if (isCredit) {
        const custRes = await tx.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.companyId, cId)));
        if (custRes.length > 0) {
          const currentBal = Number(custRes[0].balance || 0);
          const newBal = Math.max(0, currentBal - totalAmt);
          await tx.update(customers).set({ balance: String(newBal) }).where(and(eq(customers.id, customerId), eq(customers.companyId, cId)));
        }
      }
    }

    // 4. Adjust active cashier session totals if applicable
    if (saleData) {
      const openSessions = await tx.select()
        .from(cashierSessions)
        .where(and(eq(cashierSessions.companyId, cId), eq(cashierSessions.status, 'OPEN')))
        .orderBy(desc(cashierSessions.openedAt))
        .limit(1);

      if (openSessions.length > 0) {
        const session = openSessions[0];
        const saleTotal = Number(saleData.total || 0);
        let newTotalSales = Math.max(0, Number(session.totalSales || 0) - saleTotal);
        let newTotalCash = Number(session.totalCash || 0);
        let newTotalCard = Number(session.totalCard || 0);

        const method = String(saleData.paymentMethod || 'CASH').toUpperCase();
        if (method === 'CASH') {
          newTotalCash = Math.max(0, newTotalCash - saleTotal);
        } else if (method === 'CARD') {
          newTotalCard = Math.max(0, newTotalCard - saleTotal);
        }

        await tx.update(cashierSessions)
          .set({
            totalSales: String(newTotalSales),
            totalCash: String(newTotalCash),
            totalCard: String(newTotalCard)
          })
          .where(eq(cashierSessions.id, session.id));
      }
    }

    // 5. Delete related child records
    await tx.delete(saleItems).where(and(eq(saleItems.saleId, saleId), eq(saleItems.companyId, cId)));
    await tx.delete(payments).where(and(eq(payments.saleId, saleId), eq(payments.companyId, cId)));
    await tx.delete(inventoryMovements).where(and(eq(inventoryMovements.referenceId, saleId), eq(inventoryMovements.companyId, cId)));
    await tx.delete(customerTransactions).where(and(eq(customerTransactions.referenceId, saleId), eq(customerTransactions.companyId, cId)));

    // 6. Delete main sale record
    await tx.delete(sales).where(and(eq(sales.id, saleId), eq(sales.companyId, cId)));

    return true;
  });
}

// ----------------------------------------------------
// CUSTOMERS & SUPPLIERS
// ----------------------------------------------------

export async function getCustomers(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    const raw = await db.select().from(customers).where(eq(customers.companyId, cId));
    return raw.map(c => ({
      ...c,
      balance: Number(c.balance || 0),
      creditLimit: Number(c.creditLimit || 0)
    }));
  } catch (err) {
    console.error('getCustomers error:', err);
    return [];
  }
}

export async function getCustomerDebt(companyId: string, customerId: string): Promise<number> {
  const cId = requireTenant(companyId);
  const transactions = await db
    .select({
      type: customerTransactions.type,
      amount: customerTransactions.amount,
    })
    .from(customerTransactions)
    .where(and(eq(customerTransactions.companyId, cId), eq(customerTransactions.customerId, customerId)));

  let debt = 0;
  for (const t of transactions) {
    const amount = parseFloat(t.amount);
    if (t.type === 'CREDIT_SALE') debt += amount;
    else if (t.type === 'PAYMENT') debt -= amount;
    else if (t.type === 'RETURN') debt -= amount;
  }
  return debt;
}

export async function saveCustomer(data: { id?: string; companyId: string; name: string; phone?: string; email?: string; balance?: number; creditLimit?: number }) {
  const cId = requireTenant(data.companyId);
  const id = data.id || `cust_${Date.now()}`;
  const payload = {
    id,
    companyId: cId,
    name: data.name,
    phone: data.phone || '',
    email: data.email || '',
    balance: String(data.balance || 0),
    creditLimit: String(data.creditLimit || 0)
  };

  await db.insert(customers).values(payload).onConflictDoUpdate({
    target: customers.id,
    set: payload
  });
  return id;
}

export async function deleteCustomer(id: string, companyId: string) {
  const cId = requireTenant(companyId);
  return await db.transaction(async (tx) => {
    try {
      await tx.delete(customerTransactions).where(and(eq(customerTransactions.customerId, id), eq(customerTransactions.companyId, cId)));
    } catch (e) {
      console.warn('Delete customer transactions warning:', e);
    }
    try {
      await tx.update(sales).set({ customerId: '' }).where(and(eq(sales.customerId, id), eq(sales.companyId, cId)));
    } catch (e) {
      console.warn('Update sales customer warning:', e);
    }
    await tx.delete(customers).where(and(eq(customers.id, id), eq(customers.companyId, cId)));
  });
}

export async function getSuppliers(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    const raw = await db.select().from(suppliers).where(eq(suppliers.companyId, cId));
    return raw.map(s => ({
      ...s,
      balance: Number(s.balance || 0)
    }));
  } catch (err) {
    console.error('getSuppliers error:', err);
    return [];
  }
}

export async function saveSupplier(data: { id?: string; companyId: string; name: string; phone?: string; email?: string; companyName?: string; balance?: number }) {
  const cId = requireTenant(data.companyId);
  const id = data.id || `supp_${Date.now()}`;
  const payload = {
    id,
    companyId: cId,
    name: data.name,
    phone: data.phone || '',
    email: data.email || '',
    companyName: data.companyName || '',
    balance: String(data.balance || 0)
  };

  await db.insert(suppliers).values(payload).onConflictDoUpdate({
    target: suppliers.id,
    set: payload
  });
  return id;
}

export async function deleteSupplier(id: string, companyId: string) {
  const cId = requireTenant(companyId);
  return await db.transaction(async (tx) => {
    try {
      await tx.delete(supplierTransactions).where(and(eq(supplierTransactions.supplierId, id), eq(supplierTransactions.companyId, cId)));
    } catch (e) {
      console.warn('Delete supplier transactions warning:', e);
    }
    try {
      await tx.update(purchases).set({ supplierId: '' }).where(and(eq(purchases.supplierId, id), eq(purchases.companyId, cId)));
    } catch (e) {
      console.warn('Update purchases supplier warning:', e);
    }
    await tx.delete(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.companyId, cId)));
  });
}

// ----------------------------------------------------
// EXPENSES
// ----------------------------------------------------

export async function getExpenses(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    const raw = await db.select().from(expenses).where(eq(expenses.companyId, cId)).orderBy(desc(expenses.createdAt));
    return raw.map(e => ({
      ...e,
      amount: Number(e.amount || 0)
    }));
  } catch (err) {
    console.error('getExpenses error:', err);
    return [];
  }
}

export async function saveExpense(data: { id?: string; companyId: string; branchId?: string; title: string; amount: number; category: string; notes?: string; createdBy?: string }) {
  const cId = requireTenant(data.companyId);
  const id = data.id || `exp_${Date.now()}`;
  const amountStr = String(data.amount || 0);
  
  const payload = {
    id,
    companyId: cId,
    branchId: data.branchId || 'branch_main',
    title: data.title,
    amount: amountStr,
    category: data.category || 'عام',
    notes: data.notes || '',
    createdBy: data.createdBy || ''
  };

  return await db.transaction(async (tx) => {
    // 1. Save Expense record
    await tx.insert(expenses).values(payload).onConflictDoUpdate({
      target: expenses.id,
      set: payload
    });

    // 2. Update Cashier Session (Treasury) if it's a new expense and we have an open session
    if (!data.id) {
      const openSessions = await tx.select()
        .from(cashierSessions)
        .where(and(eq(cashierSessions.companyId, cId), eq(cashierSessions.status, 'OPEN')))
        .orderBy(desc(cashierSessions.openedAt))
        .limit(1);

      if (openSessions.length > 0) {
        const session = openSessions[0];
        const currentCash = Number(session.totalCash || 0);
        const newCash = currentCash - data.amount;

        await tx.update(cashierSessions)
          .set({ totalCash: String(newCash) })
          .where(eq(cashierSessions.id, session.id));

        // 3. Record in Cashier Transactions (Ledger)
        const ctxId = `ctx_exp_${Date.now()}`;
        await tx.insert(cashierTransactions).values({
          id: ctxId,
          sessionId: session.id,
          companyId: cId,
          type: 'CASH_OUT',
          amount: amountStr,
          description: `مصروف: ${data.title} - ${data.notes || ''}`
        });
      }
    }

    return id;
  });
}

export async function deleteExpense(id: string, companyId: string) {
  const cId = requireTenant(companyId);
  await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.companyId, cId)));
}

// Expense Categories
export async function getExpenseCategories(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    const raw = await db.select().from(expenseCategories).where(eq(expenseCategories.companyId, cId));
    if (raw.length === 0) {
      const defaults = ['إيجار', 'كهرباء ومياه', 'رواتب وأجور', 'صيانة وإصلاحات', 'أدوات مكتبية', 'ضيافة وانتقالات', 'مصروفات متنوعة'];
      for (const name of defaults) {
        const id = `ecat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        await db.insert(expenseCategories).values({ id, companyId: cId, name }).onConflictDoNothing();
      }
      return await db.select().from(expenseCategories).where(eq(expenseCategories.companyId, cId));
    }
    return raw;
  } catch (err) {
    console.error('getExpenseCategories error:', err);
    return [];
  }
}

export async function saveExpenseCategory(data: { id?: string; companyId: string; name: string }) {
  const cId = requireTenant(data.companyId);
  const id = data.id || `ecat_${Date.now()}`;
  await db.insert(expenseCategories).values({
    id,
    companyId: cId,
    name: data.name
  }).onConflictDoUpdate({
    target: expenseCategories.id,
    set: { name: data.name }
  });
  return id;
}

export async function deleteExpenseCategory(id: string, companyId: string) {
  const cId = requireTenant(companyId);
  await db.delete(expenseCategories).where(and(eq(expenseCategories.id, id), eq(expenseCategories.companyId, cId)));
}


// ----------------------------------------------------
// CASHIER SESSIONS
// ----------------------------------------------------

export async function getCashierSessions(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    const raw = await db.select().from(cashierSessions).where(eq(cashierSessions.companyId, cId)).orderBy(desc(cashierSessions.openedAt));
    return raw.map(cs => ({
      ...cs,
      openingBalance: Number(cs.openingBalance || 0),
      openingCash: Number(cs.openingBalance || 0),
      closingBalance: Number(cs.closingBalance || 0),
      closingCash: Number(cs.closingBalance || 0),
      totalSales: Number(cs.totalSales || 0),
      totalCash: Number(cs.totalCash || 0),
      totalCard: Number(cs.totalCard || 0)
    }));
  } catch (err) {
    console.error('getCashierSessions error:', err);
    return [];
  }
}

export async function saveCashierSession(data: {
  id?: string;
  companyId: string;
  branchId?: string;
  cashierId?: string;
  cashierName?: string;
  openingBalance?: number;
  closingBalance?: number;
  totalSales?: number;
  totalCash?: number;
  totalCard?: number;
  status?: string;
  openedAt?: string;
  closedAt?: string;
}) {
  const cId = requireTenant(data.companyId);
  const id = data.id || `cs_${Date.now()}`;

  if (!data.id || data.status === 'OPEN') {
    const openSessions = await db.select().from(cashierSessions).where(and(eq(cashierSessions.companyId, cId), eq(cashierSessions.status, 'OPEN')));
    if (openSessions.length > 0 && (!data.id || openSessions[0].id !== data.id)) {
      throw new Error('⚠️ توجد وردية مفتوحة حالياً بالفعل! يجب إغلاق الوردية الحالية قبل فتح وردية جديدة.');
    }
  }

  let existingCashierId = data.cashierId || '';
  if (!existingCashierId && data.id) {
    const existing = await db.select().from(cashierSessions).where(and(eq(cashierSessions.id, data.id), eq(cashierSessions.companyId, cId)));
    if (existing.length > 0) {
      existingCashierId = existing[0].cashierId || 'cashier_main';
    }
  }
  if (!existingCashierId) existingCashierId = 'cashier_main';

  const payload = {
    id,
    companyId: cId,
    branchId: data.branchId || 'branch_main',
    cashierId: existingCashierId,
    cashierName: data.cashierName || 'كاشير',
    openingBalance: String(data.openingBalance || 0),
    closingBalance: String(data.closingBalance || 0),
    totalSales: String(data.totalSales || 0),
    totalCash: String(data.totalCash || 0),
    totalCard: String(data.totalCard || 0),
    status: data.status || 'OPEN'
  };

  await db.insert(cashierSessions).values(payload).onConflictDoUpdate({
    target: cashierSessions.id,
    set: payload
  });
  return id;
}

// ----------------------------------------------------
// COUNTERS / SEQUENCES
// ----------------------------------------------------

export async function getNextSequence(companyId: string, name: string): Promise<number> {
  const cId = requireTenant(companyId);
  const counterId = `${name}_${cId}`;

  return await db.transaction(async (tx) => {
    const res = await tx.select().from(counters).where(and(eq(counters.id, counterId), eq(counters.companyId, cId))).for('update');
    if (res.length === 0) {
      await tx.insert(counters).values({
        id: counterId,
        companyId: cId,
        name,
        currentValue: 1
      });
      return 1;
    } else {
      const nextVal = (res[0].currentValue || 0) + 1;
      await tx.update(counters).set({ currentValue: nextVal }).where(and(eq(counters.id, counterId), eq(counters.companyId, cId)));
      return nextVal;
    }
  });
}

export async function getProductById(id: string, companyId: string) {
  const cId = requireTenant(companyId);
  try {
    const raw = await db.select().from(products).where(and(eq(products.id, id), eq(products.companyId, cId))).limit(1);
    if (raw.length === 0) return null;
    const p = raw[0];
    return {
      ...p,
      price: Number(p.price || 0),
      costPrice: Number(p.costPrice || 0),
      stock: Number(p.stock || 0),
      minStock: Number(p.minStock || 0)
    };
  } catch (err) {
    console.error('getProductById error:', err);
    return null;
  }
}

export async function getCustomerById(id: string, companyId: string) {
  const cId = requireTenant(companyId);
  try {
    const raw = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.companyId, cId))).limit(1);
    if (raw.length === 0) return null;
    const c = raw[0];
    return {
      ...c,
      balance: Number(c.balance || 0),
      creditLimit: Number(c.creditLimit || 0)
    };
  } catch (err) {
    console.error('getCustomerById error:', err);
    return null;
  }
}

export async function resetDatabase(mode: string, companyId: string = 'company_default') {
  const cId = requireTenant(companyId);

  try {
    // Delete transaction child & main tables first
    await db.delete(payments).where(eq(payments.companyId, cId));
    await db.delete(saleItems).where(eq(saleItems.companyId, cId));
    await db.delete(sales).where(eq(sales.companyId, cId));
    await db.delete(purchaseItems).where(eq(purchaseItems.companyId, cId));
    await db.delete(purchases).where(eq(purchases.companyId, cId));
    await db.delete(expenses).where(eq(expenses.companyId, cId));
    await db.delete(cashierTransactions).where(eq(cashierTransactions.companyId, cId));
    await db.delete(cashierSessions).where(eq(cashierSessions.companyId, cId));
    await db.delete(inventoryMovements).where(eq(inventoryMovements.companyId, cId));
    await db.delete(customerTransactions).where(eq(customerTransactions.companyId, cId));
    await db.delete(supplierTransactions).where(eq(supplierTransactions.companyId, cId));
    await db.delete(counters).where(eq(counters.companyId, cId));

    if (mode === 'full' || mode === 'ALL_DATA') {
      await db.delete(products).where(eq(products.companyId, cId));
      await db.delete(categories).where(eq(categories.companyId, cId));
      await db.delete(customers).where(eq(customers.companyId, cId));
      await db.delete(suppliers).where(eq(suppliers.companyId, cId));
      await db.delete(expenseCategories).where(eq(expenseCategories.companyId, cId));
    } else if (mode === 'balances_only') {
      await db.update(products).set({ stock: '0' }).where(eq(products.companyId, cId));
      await db.update(customers).set({ balance: '0' }).where(eq(customers.companyId, cId));
      await db.update(suppliers).set({ balance: '0' }).where(eq(suppliers.companyId, cId));
    }
    return { success: true };
  } catch (err) {
    console.error('resetDatabase error:', err);
    throw err;
  }
}

// ----------------------------------------------------
// UNITS (وحدات القياس)
// ----------------------------------------------------

export async function getUnits(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    return await db.select().from(units).where(eq(units.companyId, cId));
  } catch (err) {
    console.error('getUnits error:', err);
    return [];
  }
}

export async function saveUnit(data: { id?: string; name: string; symbol?: string }, companyId: string) {
  const cId = requireTenant(companyId);
  const id = data.id || `unit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const payload = {
    id,
    companyId: cId,
    name: data.name,
    symbol: data.symbol || ''
  };

  await db.insert(units).values(payload).onConflictDoUpdate({
    target: units.id,
    set: payload
  });
  return id;
}

export async function deleteUnit(id: string, companyId: string) {
  const cId = requireTenant(companyId);
  await db.delete(units).where(and(eq(units.id, id), eq(units.companyId, cId)));
}

// ----------------------------------------------------
// RETURNS (المرتجعات - مبيعات ومشتريات)
// ----------------------------------------------------

export async function getSaleReturns(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    const rawReturns = await db.select().from(saleReturns).where(eq(saleReturns.companyId, cId)).orderBy(desc(saleReturns.createdAt));
    const rawItems = await db.select().from(saleReturnItems).where(eq(saleReturnItems.companyId, cId));

    const itemsByReturn = new Map<string, any[]>();
    for (const item of rawItems) {
      if (!itemsByReturn.has(item.returnId)) {
        itemsByReturn.set(item.returnId, []);
      }
      itemsByReturn.get(item.returnId)!.push({
        ...item,
        quantity: Number(item.quantity),
        refundAmount: Number(item.refundAmount)
      });
    }

    return rawReturns.map(r => ({
      ...r,
      totalRefund: Number(r.totalRefund || 0),
      items: itemsByReturn.get(r.id) || []
    }));
  } catch (err) {
    console.error('getSaleReturns error:', err);
    return [];
  }
}

export async function createSaleReturnTransaction(returnData: {
  id?: string;
  companyId: string;
  branchId?: string;
  saleId: string;
  returnNumber: string;
  totalRefund: number;
  reason?: string;
  createdBy?: string;
  items: { productId: string; quantity: number; refundAmount: number }[];
}) {
  const cId = requireTenant(returnData.companyId);
  const returnId = returnData.id || `sret_${Date.now()}`;

  return await db.transaction(async (tx) => {
    await tx.insert(saleReturns).values({
      id: returnId,
      saleId: returnData.saleId,
      companyId: cId,
      branchId: returnData.branchId || 'branch_main',
      returnNumber: returnData.returnNumber,
      totalRefund: String(returnData.totalRefund),
      reason: returnData.reason || '',
      createdBy: returnData.createdBy || ''
    });

    for (const item of returnData.items) {
      const sItemId = `sritem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await tx.insert(saleReturnItems).values({
        id: sItemId,
        returnId,
        companyId: cId,
        productId: item.productId,
        quantity: String(item.quantity),
        refundAmount: String(item.refundAmount)
      });

      // Restore stock
      const pRes = await tx.select().from(products).where(and(eq(products.id, item.productId), eq(products.companyId, cId))).for('update');
      if (pRes.length > 0) {
        const currentStock = Number(pRes[0].stock || 0);
        const newStock = currentStock + item.quantity;
        await tx.update(products).set({ stock: String(newStock) }).where(and(eq(products.id, item.productId), eq(products.companyId, cId)));
      }

      // Movement
      const movId = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await tx.insert(inventoryMovements).values({
        id: movId,
        companyId: cId,
        branchId: returnData.branchId || 'branch_main',
        productId: item.productId,
        productName: 'مرتجع مبيعات',
        quantity: String(item.quantity),
        type: 'SALE_RETURN',
        referenceId: returnId
      });
    }

    return returnId;
  });
}

export async function deleteSaleReturnTransaction(returnId: string, companyId: string) {
  const cId = requireTenant(companyId);
  return await db.transaction(async (tx) => {
    const items = await tx.select().from(saleReturnItems).where(and(eq(saleReturnItems.returnId, returnId), eq(saleReturnItems.companyId, cId)));
    for (const item of items) {
      if (item.productId) {
        const pRes = await tx.select().from(products).where(and(eq(products.id, item.productId), eq(products.companyId, cId))).for('update');
        if (pRes.length > 0) {
          const currentStock = Number(pRes[0].stock || 0);
          const qty = Number(item.quantity || 0);
          const newStock = Math.max(0, currentStock - qty);
          await tx.update(products).set({ stock: String(newStock) }).where(and(eq(products.id, item.productId), eq(products.companyId, cId)));
        }
      }
    }

    await tx.delete(saleReturnItems).where(and(eq(saleReturnItems.returnId, returnId), eq(saleReturnItems.companyId, cId)));
    await tx.delete(inventoryMovements).where(and(eq(inventoryMovements.referenceId, returnId), eq(inventoryMovements.companyId, cId)));
    await tx.delete(saleReturns).where(and(eq(saleReturns.id, returnId), eq(saleReturns.companyId, cId)));

    return true;
  });
}

export async function getPurchaseReturns(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    const rawReturns = await db.select().from(purchaseReturns).where(eq(purchaseReturns.companyId, cId)).orderBy(desc(purchaseReturns.createdAt));
    const rawItems = await db.select().from(purchaseReturnItems).where(eq(purchaseReturnItems.companyId, cId));

    const itemsByReturn = new Map<string, any[]>();
    for (const item of rawItems) {
      if (!itemsByReturn.has(item.returnId)) {
        itemsByReturn.set(item.returnId, []);
      }
      itemsByReturn.get(item.returnId)!.push({
        ...item,
        quantity: Number(item.quantity),
        refundAmount: Number(item.refundAmount)
      });
    }

    return rawReturns.map(r => ({
      ...r,
      totalRefund: Number(r.totalRefund || 0),
      items: itemsByReturn.get(r.id) || []
    }));
  } catch (err) {
    console.error('getPurchaseReturns error:', err);
    return [];
  }
}

export async function createPurchaseReturnTransaction(returnData: {
  id?: string;
  companyId: string;
  branchId?: string;
  purchaseId: string;
  returnNumber: string;
  totalRefund: number;
  reason?: string;
  items: { productId: string; quantity: number; refundAmount: number }[];
}) {
  const cId = requireTenant(returnData.companyId);
  const returnId = returnData.id || `pret_${Date.now()}`;

  return await db.transaction(async (tx) => {
    await tx.insert(purchaseReturns).values({
      id: returnId,
      purchaseId: returnData.purchaseId,
      companyId: cId,
      branchId: returnData.branchId || 'branch_main',
      returnNumber: returnData.returnNumber,
      totalRefund: String(returnData.totalRefund),
      reason: returnData.reason || ''
    });

    for (const item of returnData.items) {
      const pItemId = `pritəm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await tx.insert(purchaseReturnItems).values({
        id: pItemId,
        returnId,
        companyId: cId,
        productId: item.productId,
        quantity: String(item.quantity),
        refundAmount: String(item.refundAmount)
      });

      // Deduct stock for purchase return
      const pRes = await tx.select().from(products).where(and(eq(products.id, item.productId), eq(products.companyId, cId))).for('update');
      if (pRes.length > 0) {
        const currentStock = Number(pRes[0].stock || 0);
        const newStock = Math.max(0, currentStock - item.quantity);
        await tx.update(products).set({ stock: String(newStock) }).where(and(eq(products.id, item.productId), eq(products.companyId, cId)));
      }

      // Movement
      const movId = `mov_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await tx.insert(inventoryMovements).values({
        id: movId,
        companyId: cId,
        branchId: returnData.branchId || 'branch_main',
        productId: item.productId,
        productName: 'مرتجع مشتريات',
        quantity: String(-item.quantity),
        type: 'PURCHASE_RETURN',
        referenceId: returnId
      });
    }

    return returnId;
  });
}

export async function getChartOfAccounts(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    const allAccounts = await db.select().from(accounts).where(eq(accounts.companyId, cId)).orderBy(accounts.code);
    return allAccounts.map(acc => ({
      ...acc,
      balance: Number(acc.balance || 0)
    }));
  } catch (err) {
    console.error('getChartOfAccounts error:', err);
    return [];
  }
}

export async function createJournalEntry(companyId: string, entryData: {
  reference: string;
  description?: string;
  date?: string;
  items: { accountId: string; debit: number; credit: number; costCenterId?: string; partnerId?: string; notes?: string }[];
}) {
  const cId = requireTenant(companyId);
  const journalId = `jou_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  return await db.transaction(async (tx) => {
    // 1. Insert Header
    await tx.insert(journalEntries).values({
      id: journalId,
      companyId: cId,
      reference: entryData.reference,
      description: entryData.description || '',
      date: entryData.date ? new Date(entryData.date) : new Date(),
    });

    // 2. Insert Items and Update Balances
    for (const item of entryData.items) {
      const itemId = `jitm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await tx.insert(journalItems).values({
        id: itemId,
        journalId,
        accountId: item.accountId,
        debit: String(item.debit),
        credit: String(item.credit),
        costCenterId: item.costCenterId,
        partnerId: item.partnerId,
        notes: item.notes
      });

      // Update Account Balance
      const acc = await tx.select().from(accounts).where(and(eq(accounts.id, item.accountId), eq(accounts.companyId, cId))).for('update');
      if (acc.length > 0) {
        const currentBalance = Number(acc[0].balance || 0);
        // Balance increases with Debit for Assets/Expenses, and with Credit for Liabilities/Equity/Revenue
        const isDebitNormal = ['ASSET', 'EXPENSE'].includes(acc[0].type);
        const effect = isDebitNormal ? (item.debit - item.credit) : (item.credit - item.debit);
        const newBalance = currentBalance + effect;
        await tx.update(accounts).set({ balance: String(newBalance) }).where(and(eq(accounts.id, item.accountId), eq(accounts.companyId, cId)));
      }
    }

    return journalId;
  });
}

export async function getItemLedger(companyId: string, productId: string) {
  const cId = requireTenant(companyId);
  try {
    // Fetch all movements for this product
    const movements = await db.select()
      .from(inventoryMovements)
      .where(and(eq(inventoryMovements.productId, productId), eq(inventoryMovements.companyId, cId)))
      .orderBy(inventoryMovements.createdAt);

    let runningBalance = 0;
    return movements.map(m => {
      const qty = Number(m.quantity);
      runningBalance += qty;
      return {
        ...m,
        quantity: qty,
        balance: runningBalance
      };
    });
  } catch (err) {
    console.error('getItemLedger error:', err);
    return [];
  }
}

export async function getFinancialSummary(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    const accs = await db.select().from(accounts).where(eq(accounts.companyId, cId));
    
    const summary = {
      totalAssets: 0,
      totalLiabilities: 0,
      totalEquity: 0,
      totalRevenue: 0,
      totalExpense: 0,
      netProfit: 0
    };

    accs.forEach(acc => {
      const balance = Number(acc.balance || 0);
      if (acc.type === 'ASSET') summary.totalAssets += balance;
      else if (acc.type === 'LIABILITY') summary.totalLiabilities += balance;
      else if (acc.type === 'EQUITY') summary.totalEquity += balance;
      else if (acc.type === 'REVENUE') summary.totalRevenue += balance;
      else if (acc.type === 'EXPENSE') summary.totalExpense += balance;
    });

    summary.netProfit = summary.totalRevenue - summary.totalExpense;
    return summary;
  } catch (err) {
    console.error('getFinancialSummary error:', err);
    return null;
  }
}

export async function getBOMs(companyId: string) {
  const cId = requireTenant(companyId);
  try {
    const boms = await db.select().from(billsOfMaterials).where(eq(billsOfMaterials.companyId, cId));
    const fullBoms = [];
    for (const bom of boms) {
      const items = await db.select().from(bomItems).where(eq(bomItems.bomId, bom.id));
      fullBoms.push({ ...bom, items });
    }
    return fullBoms;
  } catch (err) {
    console.error('getBOMs error:', err);
    return [];
  }
}

export async function createBOM(companyId: string, bomData: {
  productId: string;
  name: string;
  items: { productId: string; quantity: number; unitCost: number }[];
}) {
  const cId = requireTenant(companyId);
  const bomId = `bom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  let totalCost = 0;
  bomData.items.forEach(it => totalCost += (it.quantity * it.unitCost));

  return await db.transaction(async (tx) => {
    await tx.insert(billsOfMaterials).values({
      id: bomId,
      companyId: cId,
      productId: bomData.productId,
      name: bomData.name,
      totalCost: String(totalCost)
    });

    for (const item of bomData.items) {
      await tx.insert(bomItems).values({
        id: `bitm_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        bomId,
        productId: item.productId,
        quantity: String(item.quantity),
        unitCost: String(item.unitCost)
      });
    }
    return bomId;
  });
}

// ----------------------------------------------------
// HR & PAYROLL FUNCTIONS
// ----------------------------------------------------

export async function getEmployees(companyId: string) {
  const cId = requireTenant(companyId);
  return await db.select().from(employees).where(eq(employees.companyId, cId));
}

export async function createEmployee(companyId: string, data: any) {
  const cId = requireTenant(companyId);
  const id = `emp_${Date.now()}`;
  await db.insert(employees).values({ ...data, id, companyId: cId });
  return id;
}

export async function getPayroll(companyId: string) {
  const cId = requireTenant(companyId);
  // Simple join or filtering for the company
  const allEmployees = await db.select().from(employees).where(eq(employees.companyId, cId));
  const empIds = allEmployees.map(e => e.id);
  if (empIds.length === 0) return [];
  return await db.select().from(payroll).where(sql`${payroll.employeeId} IN (${sql.join(empIds, sql`, `)})`);
}

// ----------------------------------------------------
// CRM FUNCTIONS
// ----------------------------------------------------

export async function getCustomerInteractions(customerId: string) {
  return await db.select().from(customerInteractions).where(eq(customerInteractions.customerId, customerId)).orderBy(desc(customerInteractions.date));
}

export async function addCustomerInteraction(data: any) {
  const id = `int_${Date.now()}`;
  await db.insert(customerInteractions).values({ ...data, id });
  return id;
}

export async function getLoyaltyPoints(customerId: string) {
  const res = await db.select().from(loyaltyPoints).where(eq(loyaltyPoints.customerId, customerId));
  return res[0] || { points: 0 };
}

// ----------------------------------------------------
// AI CO-PILOT FUNCTIONS
// ----------------------------------------------------

export async function getAiConfig(companyId: string) {
  const cId = requireTenant(companyId);
  const res = await db.select().from(aiConfigs).where(eq(aiConfigs.companyId, cId));
  return res[0] || null;
}

export async function updateAiConfig(companyId: string, isEnabled: boolean, licenseKey?: string) {
  const cId = requireTenant(companyId);
  const existing = await getAiConfig(cId);
  if (existing) {
    await db.update(aiConfigs).set({ isEnabled, licenseKey, updatedAt: new Date() }).where(eq(aiConfigs.companyId, cId));
  } else {
    await db.insert(aiConfigs).values({
      id: `aicf_${Date.now()}`,
      companyId: cId,
      isEnabled,
      licenseKey: licenseKey || ''
    });
  }
}

export async function getUserAiMemory(userId: string) {
  const res = await db.select().from(userAiMemories).where(eq(userAiMemories.userId, userId));
  return res[0] || null;
}

export async function updateUserAiMemory(userId: string, data: any) {
  const existing = await getUserAiMemory(userId);
  if (existing) {
    await db.update(userAiMemories).set({ ...data, lastInteractionAt: new Date() }).where(eq(userAiMemories.userId, userId));
  } else {
    await db.insert(userAiMemories).values({
      id: `aimem_${Date.now()}`,
      userId,
      ...data
    });
  }
}

export async function logSystemTelemetry(type: string, component: string, message: string, severity: string = 'LOW', metadata: any = {}) {
  await db.insert(systemTelemetry).values({
    id: `tel_${Date.now()}`,
    type,
    component,
    message,
    severity,
    metadata
  });
}

export async function getSystemTelemetry(limit: number = 50) {
  return await db.select().from(systemTelemetry).orderBy(desc(systemTelemetry.createdAt)).limit(limit);
}

// ----------------------------------------------------
// DYNAMIC ENGINE CONFIGURATION
// ----------------------------------------------------

export async function getCompanyModuleOverrides(companyId: string) {
  const cId = requireTenant(companyId);
  return await db.select().from(companyModuleOverrides).where(eq(companyModuleOverrides.companyId, cId));
}

export async function setCompanyModuleOverride(companyId: string, moduleName: string, isEnabled: boolean, updatedBy: string) {
  const cId = requireTenant(companyId);
  // Module Dependencies Validation
  const dependencies: Record<string, string[]> = {
    'POS': ['SALES', 'INVENTORY'],
    'SALES': ['INVENTORY'],
    'PURCHASES': ['INVENTORY']
  };

  const existingConfig = await getCompanyModuleOverrides(cId);
  const enabledModules = new Set(existingConfig.filter(m => m.isEnabled).map(m => m.moduleName));
  
  if (isEnabled) {
    // Check if dependencies are met
    const deps = dependencies[moduleName] || [];
    for (const dep of deps) {
      if (!enabledModules.has(dep)) {
        throw new Error(`Cannot enable ${moduleName}. Missing dependency: ${dep}`);
      }
    }
  } else {
    // Check if other enabled modules depend on this
    for (const [mod, deps] of Object.entries(dependencies)) {
      if (enabledModules.has(mod) && deps.includes(moduleName) && mod !== moduleName) {
         throw new Error(`Cannot disable ${moduleName}. It is required by active module: ${mod}`);
      }
    }
  }

  const existing = existingConfig.find(m => m.moduleName === moduleName);
  if (existing) {
    await db.update(companyModuleOverrides)
      .set({ isEnabled, updatedAt: new Date(), updatedBy })
      .where(and(eq(companyModuleOverrides.companyId, cId), eq(companyModuleOverrides.moduleName, moduleName)));
  } else {
    await db.insert(companyModuleOverrides).values({
      id: `cmo_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      companyId: cId,
      moduleName,
      isEnabled,
      updatedBy
    });
  }
}

export async function getBranchModuleOverrides(branchId: string) {
  return await db.select().from(branchModuleOverrides).where(eq(branchModuleOverrides.branchId, branchId));
}

export async function setBranchModuleOverride(branchId: string, moduleName: string, isEnabled: boolean, updatedBy: string) {
  const existing = await db.select().from(branchModuleOverrides)
    .where(and(eq(branchModuleOverrides.branchId, branchId), eq(branchModuleOverrides.moduleName, moduleName)));
  
  if (existing.length > 0) {
    await db.update(branchModuleOverrides)
      .set({ isEnabled, updatedAt: new Date(), updatedBy })
      .where(and(eq(branchModuleOverrides.branchId, branchId), eq(branchModuleOverrides.moduleName, moduleName)));
  } else {
    await db.insert(branchModuleOverrides).values({
      id: `bmo_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      branchId,
      moduleName,
      isEnabled,
      updatedBy
    });
  }
}

export async function getCustomFieldDefinitions(companyId: string, entityType?: string) {
  const cId = requireTenant(companyId);
  if (entityType) {
    return await db.select().from(customFieldDefinitions)
      .where(and(eq(customFieldDefinitions.companyId, cId), eq(customFieldDefinitions.entityType, entityType)));
  }
  return await db.select().from(customFieldDefinitions).where(eq(customFieldDefinitions.companyId, cId));
}

export async function createCustomFieldDefinition(companyId: string, data: any) {
  const cId = requireTenant(companyId);
  await db.insert(customFieldDefinitions).values({
    id: `cfd_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    companyId: cId,
    entityType: data.entityType,
    fieldKey: data.fieldKey,
    label: data.label,
    dataType: data.dataType,
    isRequired: data.isRequired || false,
    optionsJson: data.optionsJson || []
  });
}

// END_OF_REPOSITORY_FUNCTIONS

export async function softDeleteEntity(
  companyId: string,
  entityType: 'customers' | 'suppliers' | 'products' | 'categories' | 'branches',
  entityId: string
) {
  const cId = requireTenant(companyId);
  return await db.transaction(async (tx) => {
    // 1. Check Financial History
    let hasHistory = false;
    if (entityType === 'customers') {
      const salesRes = await tx.select().from(sales).where(and(eq(sales.customerId, entityId), eq(sales.companyId, cId))).limit(1);
      const transRes = await tx.select().from(customerTransactions).where(and(eq(customerTransactions.customerId, entityId), eq(customerTransactions.companyId, cId))).limit(1);
      if (salesRes.length > 0 || transRes.length > 0) hasHistory = true;
    } else if (entityType === 'suppliers') {
      const purRes = await tx.select().from(purchases).where(and(eq(purchases.supplierId, entityId), eq(purchases.companyId, cId))).limit(1);
      const transRes = await tx.select().from(supplierTransactions).where(and(eq(supplierTransactions.supplierId, entityId), eq(supplierTransactions.companyId, cId))).limit(1);
      if (purRes.length > 0 || transRes.length > 0) hasHistory = true;
    } else if (entityType === 'products') {
      const invRes = await tx.select().from(inventoryMovements).where(and(eq(inventoryMovements.productId, entityId), eq(inventoryMovements.companyId, cId))).limit(1);
      if (invRes.length > 0) hasHistory = true;
    }

    if (hasHistory) {
      throw new Error('RECORD_HAS_FINANCIAL_HISTORY');
    }

    // 2. Perform Soft Delete (Deactivate)
    const table = entityType === 'customers' ? customers : 
                  entityType === 'suppliers' ? suppliers :
                  entityType === 'products' ? products :
                  entityType === 'categories' ? categories : branches;

    await tx.update(table).set({ isActive: false }).where(and(eq(table.id, entityId), eq(table.companyId, cId)));
    
    return true;
  });
}

export async function deletePurchaseReturnTransaction(returnId: string, companyId: string) {
  const cId = requireTenant(companyId);
  return await db.transaction(async (tx) => {
    const items = await tx.select().from(purchaseReturnItems).where(and(eq(purchaseReturnItems.returnId, returnId), eq(purchaseReturnItems.companyId, cId)));
    for (const item of items) {
      if (item.productId) {
        const pRes = await tx.select().from(products).where(and(eq(products.id, item.productId), eq(products.companyId, cId))).for('update');
        if (pRes.length > 0) {
          const currentStock = Number(pRes[0].stock || 0);
          const qty = Number(item.quantity || 0);
          const newStock = currentStock + qty;
          await tx.update(products).set({ stock: String(newStock) }).where(and(eq(products.id, item.productId), eq(products.companyId, cId)));
        }
      }
    }

    await tx.delete(purchaseReturnItems).where(and(eq(purchaseReturnItems.returnId, returnId), eq(purchaseReturnItems.companyId, cId)));
    await tx.delete(inventoryMovements).where(and(eq(inventoryMovements.referenceId, returnId), eq(inventoryMovements.companyId, cId)));
    await tx.delete(purchaseReturns).where(and(eq(purchaseReturns.id, returnId), eq(purchaseReturns.companyId, cId)));

    return true;
  });
}

export async function hasPermission(userId: string, companyId: string, permission: string): Promise<boolean> {
  const perms = await db
    .select()
    .from(userPermissions)
    .where(and(eq(userPermissions.userId, userId), eq(userPermissions.companyId, companyId), eq(userPermissions.permissionKey, permission)));
  return perms.length > 0;
}

export async function getPriceForCustomer(productId: string, customerId: string, companyId: string): Promise<string> {
  const cId = requireTenant(companyId);
  // Get customer price level
  const cust = await db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.companyId, cId))).limit(1);
  const level = cust.length > 0 ? (cust[0].priceLevel || 'RETAIL') : 'RETAIL';
  
  // Get product price
  const pRes = await db.select().from(productPrices).where(and(eq(productPrices.productId, productId), eq(productPrices.companyId, cId), eq(productPrices.priceLevel, level))).limit(1);
  
  if (pRes.length > 0) return pRes[0].price;
  
  // Fallback to product retail price
  const prod = await db.select().from(products).where(and(eq(products.id, productId), eq(products.companyId, cId))).limit(1);
  return prod.length > 0 ? prod[0].price : '0';
}

