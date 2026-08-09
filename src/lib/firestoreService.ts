import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc, 
  query, 
  where, 
  orderBy, 
  runTransaction, 
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { Sale, Product, InventoryMovement, MovementType, CashierSession, Customer, Supplier, Purchase, Expense, Category, AppUser } from '../types/types';

// Collections
const PRODUCTS_COL = 'products';
const SALES_COL = 'sales';
const MOVEMENTS_COL = 'inventoryMovements';
const SESSIONS_COL = 'cashierSessions';
const CUSTOMERS_COL = 'customers';
const SUPPLIERS_COL = 'suppliers';
const PURCHASES_COL = 'purchases';
const EXPENSES_COL = 'expenses';
const CATEGORIES_COL = 'categories';
const USERS_COL = 'users';
const COUNTERS_COL = 'counters';

// --- Products ---
export async function getProducts(): Promise<Product[]> {
  const snapshot = await getDocs(collection(db, PRODUCTS_COL));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
}

export async function saveProduct(product: Partial<Product>): Promise<string> {
  if (product.id) {
    const docRef = doc(db, PRODUCTS_COL, product.id);
    await updateDoc(docRef, product);
    return product.id;
  } else {
    const docRef = await addDoc(collection(db, PRODUCTS_COL), {
      ...product,
      quantity: product.quantity || 0,
      cost: product.cost || 0,
      price: product.price || 0
    });
    return docRef.id;
  }
}

export interface InvoiceSequenceConfig {
  current: number;
  prefix: string;
  padding: number;
}

// Fetch invoice sequence counter settings
export async function getInvoiceCounter(): Promise<InvoiceSequenceConfig> {
  try {
    const docRef = doc(db, COUNTERS_COL, 'sales');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        current: Number(data.current || 1000),
        prefix: data.prefix ?? 'INV-',
        padding: Number(data.padding ?? 5)
      };
    }
  } catch (e) {
    console.error('Error fetching invoice counter:', e);
  }
  return { current: 1000, prefix: 'INV-', padding: 5 };
}

// Update invoice sequence counter or prefix
export async function updateInvoiceSequenceSettings(config: Partial<InvoiceSequenceConfig>): Promise<void> {
  const docRef = doc(db, COUNTERS_COL, 'sales');
  await setDoc(docRef, {
    ...config,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

// --- Sales & Inventory Atomic Transaction with Sequential Invoice Numbering ---
export async function processSale(
  saleData: Omit<Sale, 'id'>, 
  userId: string = 'admin'
): Promise<{ id: string; invoiceNumber: string }> {
  return await runTransaction(db, async (transaction) => {
    // 1. Check stock for all items
    const productReads = await Promise.all(
      saleData.items.map(item => transaction.get(doc(db, PRODUCTS_COL, item.productId)))
    );

    const productUpdates: { ref: any; newQty: number; product: Product; stockBefore: number; deductedQty: number }[] = [];

    for (let i = 0; i < saleData.items.length; i++) {
      const item = saleData.items[i];
      const prodDoc = productReads[i];
      if (!prodDoc.exists()) {
        throw new Error(`المنتج غير موجود: ${item.name}`);
      }
      const product = { id: prodDoc.id, ...prodDoc.data() } as Product;
      const stockBefore = product.quantity;

      // Calculate quantity deduction considering multi-units (e.g. strips vs box)
      let qtyToDeduct = item.quantity;
      if (item.unit === 'شريط' && product.stripsPerBox && product.stripsPerBox > 1) {
        qtyToDeduct = Math.round((item.quantity / product.stripsPerBox) * 1000) / 1000;
      } else if (item.unit && product.multiUnits && product.multiUnits.length > 0) {
        const matchedUnit = product.multiUnits.find(u => u.name === item.unit);
        if (matchedUnit && matchedUnit.conversionFactor && matchedUnit.conversionFactor > 0) {
          qtyToDeduct = Math.round((item.quantity / matchedUnit.conversionFactor) * 1000) / 1000;
        }
      }

      const newQty = Math.max(0, Math.round((stockBefore - qtyToDeduct) * 1000) / 1000);

      if (stockBefore < qtyToDeduct && stockBefore <= 0) {
        throw new Error(`الكمية غير متاحة في المخزون للمنتج: ${product.name} (المتاح: ${stockBefore}, المطلوب: ${item.quantity} ${item.unit || 'وحدة'})`);
      }

      productUpdates.push({
        ref: doc(db, PRODUCTS_COL, product.id),
        newQty,
        product,
        stockBefore,
        deductedQty: qtyToDeduct
      });
    }

    // 2. Fetch and increment atomic sequential invoice counter
    const counterRef = doc(db, COUNTERS_COL, 'sales');
    const counterDoc = await transaction.get(counterRef);
    let nextInvoiceSeq = 1001;
    let prefix = 'INV-';
    let padding = 5;

    if (counterDoc.exists()) {
      const data = counterDoc.data();
      const currentVal = Number(data.current || data.lastNumber || 0);
      nextInvoiceSeq = currentVal + 1;
      if (data.prefix !== undefined) prefix = data.prefix;
      if (data.padding !== undefined) padding = Number(data.padding);
    } else {
      nextInvoiceSeq = 1001;
    }

    // Format consecutive serial number e.g. INV-01001 or custom
    const formattedInvoiceNumber = saleData.invoiceNumber && !saleData.invoiceNumber.startsWith('OFFLINE-')
      ? saleData.invoiceNumber
      : `${prefix}${String(nextInvoiceSeq).padStart(padding, '0')}`;

    // 3. Create Sale document ref
    const saleRef = doc(collection(db, SALES_COL));
    const saleId = saleRef.id;

    const saleRecord: Sale = {
      ...saleData,
      id: saleId,
      invoiceNumber: formattedInvoiceNumber,
      userId,
      date: saleData.date || new Date().toISOString()
    };

    // 4. Create Inventory Movements
    const movementRefs = productUpdates.map(u => ({
      ref: doc(collection(db, MOVEMENTS_COL)),
      data: {
        productId: u.product.id,
        productName: u.product.name,
        branchId: saleData.branchId || 'default',
        movementType: 'SALE' as const,
        quantity: -u.deductedQty,
        unitCost: u.product.cost,
        stockBefore: u.stockBefore,
        stockAfter: u.newQty,
        referenceType: 'SALE' as const,
        referenceId: formattedInvoiceNumber,
        userId,
        createdAt: new Date().toISOString()
      } as Omit<InventoryMovement, 'id'>
    }));

    // 5. Update customer balance if credit / unpaid
    let customerRef = null;
    let customerNewBalance = 0;
    if (saleData.customerId && saleData.customerId !== 'cash-customer') {
      customerRef = doc(db, CUSTOMERS_COL, saleData.customerId);
      const custDoc = await transaction.get(customerRef);
      if (custDoc.exists()) {
        const custData = custDoc.data() as Customer;
        const totalPaid = saleData.payments.reduce((sum, p) => sum + p.amount, 0);
        const remaining = saleData.finalTotal - totalPaid;
        customerNewBalance = (custData.currentBalance ?? custData.openingBalance ?? 0) + remaining;
      }
    }

    // --- Execute Atomic Writes ---
    // Update counter
    transaction.set(counterRef, {
      current: nextInvoiceSeq,
      prefix,
      padding,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Update products
    productUpdates.forEach(u => {
      transaction.update(u.ref, { quantity: u.newQty });
    });

    // Save movements
    movementRefs.forEach(m => {
      transaction.set(m.ref, m.data);
    });

    // Save sale
    transaction.set(saleRef, saleRecord);

    // Update customer balance if applicable
    if (customerRef) {
      transaction.update(customerRef, { currentBalance: customerNewBalance });
    }

    return { id: saleId, invoiceNumber: formattedInvoiceNumber };
  });
}

// --- Sales Return ---
export async function processSaleReturn(saleId: string, returnedItems: { productId: string, quantity: number }[], userId: string = 'admin'): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const saleRef = doc(db, SALES_COL, saleId);
    const saleDoc = await transaction.get(saleRef);
    if (!saleDoc.exists()) {
      throw new Error('الفاتورة غير موجودة');
    }
    const sale = saleDoc.data() as Sale;

    for (const ret of returnedItems) {
      const itemInSale = sale.items.find(i => i.productId === ret.productId);
      if (!itemInSale || ret.quantity > itemInSale.quantity) {
        throw new Error(`الكمية المرتجعة أكبر من الكمية المباعة للمنتج`);
      }

      const prodRef = doc(db, PRODUCTS_COL, ret.productId);
      const prodDoc = await transaction.get(prodRef);
      if (!prodDoc.exists()) continue;
      const product = { id: prodDoc.id, ...prodDoc.data() } as Product;
      const stockBefore = product.quantity;
      const newQty = stockBefore + ret.quantity;

      // Update product stock
      transaction.update(prodRef, { quantity: newQty });

      // Record movement
      const movRef = doc(collection(db, MOVEMENTS_COL));
      transaction.set(movRef, {
        productId: product.id,
        productName: product.name,
        branchId: sale.branchId || 'default',
        movementType: 'SALE_RETURN',
        quantity: ret.quantity,
        unitCost: product.cost,
        stockBefore,
        stockAfter: newQty,
        referenceType: 'RETURN',
        referenceId: saleId,
        userId,
        createdAt: new Date().toISOString()
      });
    }

    transaction.update(saleRef, { isReturned: true, status: 'returned' });
  });
}

// --- Inventory Adjustments & Settlements ---
export async function recordInventoryAdjustment(
  product: Product, 
  newQuantity: number, 
  reason: string = 'تسوية جرد دوري',
  userId: string = 'admin'
): Promise<void> {
  const stockBefore = product.quantity;
  const diff = newQuantity - stockBefore;
  if (diff === 0) return;

  const movementType: MovementType = diff > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
  const movementRef = doc(collection(db, MOVEMENTS_COL));
  const productRef = doc(db, PRODUCTS_COL, product.id);

  await runTransaction(db, async (transaction) => {
    transaction.update(productRef, { 
      quantity: newQuantity,
      updatedAt: new Date().toISOString()
    });

    transaction.set(movementRef, {
      productId: product.id,
      productName: product.name,
      branchId: product.branchId || 'default',
      movementType,
      quantity: Math.abs(diff),
      unitCost: product.cost || 0,
      stockBefore,
      stockAfter: newQuantity,
      referenceType: 'ADJUSTMENT',
      referenceId: `ADJ-${Date.now().toString().slice(-6)}`,
      userId,
      createdAt: new Date().toISOString(),
      notes: `${reason} (${diff > 0 ? 'زيادة' : 'عجز'}: ${Math.abs(diff)})`
    });
  });
}

export async function recordBatchInventorySettlement(
  adjustments: { product: Product; newQuantity: number; notes?: string }[],
  sessionTitle: string = 'جرد وتسوية المخزن',
  userId: string = 'admin'
): Promise<{ settledCount: number; totalDiffValue: number }> {
  const batchSessionId = `AUDIT-${Date.now().toString().slice(-6)}`;
  let settledCount = 0;
  let totalDiffValue = 0;

  for (const item of adjustments) {
    const diff = item.newQuantity - item.product.quantity;
    if (diff !== 0) {
      await recordInventoryAdjustment(
        item.product,
        item.newQuantity,
        `${sessionTitle} [${batchSessionId}] ${item.notes || ''}`,
        userId
      );
      settledCount++;
      totalDiffValue += diff * (item.product.cost || 0);
    }
  }

  return { settledCount, totalDiffValue };
}

// --- Cashier Sessions ---
export async function openCashierSession(cashierName: string, openingCash: number, branchId: string = 'default'): Promise<string> {
  const sessionRef = doc(collection(db, SESSIONS_COL));
  const session: CashierSession = {
    id: sessionRef.id,
    cashierName,
    branchId,
    openingCash,
    openedAt: new Date().toISOString(),
    status: 'ACTIVE'
  };
  await setDoc(sessionRef, session);
  return sessionRef.id;
}

export async function closeCashierSession(sessionId: string, actualCash: number, expectedCash: number, summary: Partial<CashierSession>): Promise<void> {
  const sessionRef = doc(db, SESSIONS_COL, sessionId);
  await updateDoc(sessionRef, {
    status: 'CLOSED',
    closedAt: new Date().toISOString(),
    actualCash,
    expectedCash,
    difference: actualCash - expectedCash,
    ...summary
  });
}

// --- Generic Fetchers ---
async function getCollection<T>(colName: string): Promise<T[]> {
  const snapshot = await getDocs(collection(db, colName));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
}

export const getSales = () => getCollection<Sale>(SALES_COL);
export const getCustomers = () => getCollection<Customer>(CUSTOMERS_COL);
export const getSuppliers = () => getCollection<Supplier>(SUPPLIERS_COL);
export const getPurchases = () => getCollection<Purchase>(PURCHASES_COL);
export const getExpenses = () => getCollection<Expense>(EXPENSES_COL);
export const getInventoryMovements = () => getCollection<InventoryMovement>(MOVEMENTS_COL);
export const getCashierSessions = () => getCollection<CashierSession>(SESSIONS_COL);

export async function saveCustomer(customer: Partial<Customer>): Promise<string> {
  if (customer.id) {
    await updateDoc(doc(db, CUSTOMERS_COL, customer.id), customer);
    return customer.id;
  } else {
    const ref = await addDoc(collection(db, CUSTOMERS_COL), { ...customer, currentBalance: customer.openingBalance || 0 });
    return ref.id;
  }
}

export async function saveSupplier(supplier: Partial<Supplier>): Promise<string> {
  if (supplier.id) {
    await updateDoc(doc(db, SUPPLIERS_COL, supplier.id), supplier);
    return supplier.id;
  } else {
    const ref = await addDoc(collection(db, SUPPLIERS_COL), { ...supplier, currentBalance: supplier.openingBalance || 0 });
    return ref.id;
  }
}

export async function saveExpense(expense: Partial<Expense>): Promise<string> {
  const ref = await addDoc(collection(db, EXPENSES_COL), expense);
  return ref.id;
}

export async function savePurchase(purchase: Partial<Purchase>): Promise<string> {
  const ref = await addDoc(collection(db, PURCHASES_COL), purchase);
  return ref.id;
}

export const getCategories = () => getCollection<Category>(CATEGORIES_COL);

export async function saveCategory(category: Partial<Category>): Promise<string> {
  if (category.id) {
    await updateDoc(doc(db, CATEGORIES_COL, category.id), category);
    return category.id;
  } else {
    const ref = await addDoc(collection(db, CATEGORIES_COL), category);
    return ref.id;
  }
}

export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, CATEGORIES_COL, id));
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(db, PRODUCTS_COL, id));
}

export async function deletePurchase(id: string): Promise<void> {
  await deleteDoc(doc(db, PURCHASES_COL, id));
}

export async function deleteExpense(id: string): Promise<void> {
  await deleteDoc(doc(db, EXPENSES_COL, id));
}

export async function deleteSale(id: string): Promise<void> {
  await deleteDoc(doc(db, SALES_COL, id));
}

export async function deleteCustomer(id: string): Promise<void> {
  await deleteDoc(doc(db, CUSTOMERS_COL, id));
}

export async function deleteSupplier(id: string): Promise<void> {
  await deleteDoc(doc(db, SUPPLIERS_COL, id));
}

// --- Users Management ---
export const getUsers = () => getCollection<AppUser>(USERS_COL);

export async function saveUser(user: Partial<AppUser>): Promise<string> {
  if (user.id) {
    await updateDoc(doc(db, USERS_COL, user.id), user);
    return user.id;
  } else {
    const ref = await addDoc(collection(db, USERS_COL), {
      ...user,
      createdAt: new Date().toISOString()
    });
    return ref.id;
  }
}

export async function deleteUser(id: string): Promise<void> {
  await deleteDoc(doc(db, USERS_COL, id));
}

export async function seedInitialData(): Promise<void> {
  try {
    const users = await getUsers();
    if (users.length === 0) {
      // Seed default Admin & Cashier users
      await addDoc(collection(db, USERS_COL), {
        name: 'المدير العام',
        username: 'admin',
        pin: '1234',
        role: 'admin',
        phone: '01000000001',
        createdAt: new Date().toISOString()
      });
      await addDoc(collection(db, USERS_COL), {
        name: 'كاشير الفرع الرئيسي',
        username: 'cashier',
        pin: '0000',
        role: 'cashier',
        phone: '01000000002',
        createdAt: new Date().toISOString()
      });
      await addDoc(collection(db, USERS_COL), {
        name: 'محاسب الشركة',
        username: 'accountant',
        pin: '1111',
        role: 'accountant',
        phone: '01000000003',
        createdAt: new Date().toISOString()
      });
    }

    const prods = await getProducts();
    if (prods.length === 0) {
      // Seed products
      await addDoc(collection(db, PRODUCTS_COL), { name: 'قميص قطني رجالي', sku: 'SKU-001', price: 250, cost: 180, quantity: 45, category: 'ملابس', lowStockThreshold: 5 });
      await addDoc(collection(db, PRODUCTS_COL), { name: 'حذاء رياضي أنيق', sku: 'SKU-002', price: 650, cost: 450, quantity: 20, category: 'أحذية', lowStockThreshold: 5 });
      await addDoc(collection(db, PRODUCTS_COL), { name: 'إطار سيارة 16 بوصة', sku: 'SKU-003', price: 1800, cost: 1400, quantity: 12, category: 'إطارات وبطاريات', lowStockThreshold: 3 });
    }

    const custs = await getCustomers();
    if (custs.length === 0) {
      await addDoc(collection(db, CUSTOMERS_COL), { name: 'شركة النور للتجارة', phone: '01012345678', openingBalance: 1500, currentBalance: 1500 });
      await addDoc(collection(db, CUSTOMERS_COL), { name: 'أحمد محمود', phone: '01123456789', openingBalance: 0, currentBalance: 0 });
    }

    const supps = await getSuppliers();
    if (supps.length === 0) {
      await addDoc(collection(db, SUPPLIERS_COL), { name: 'مؤسسة الأمل للملابس', contactPerson: 'محمد الأمل', phone: '01234567890', openingBalance: 5000, currentBalance: 5000 });
    }

    const cats = await getCategories();
    if (cats.length === 0) {
      await addDoc(collection(db, CATEGORIES_COL), { name: 'ملابس', subcategories: ['قمصان', 'بناطيل', 'جاكت'] });
      await addDoc(collection(db, CATEGORIES_COL), { name: 'أحذية', subcategories: ['ررياضي', 'رسمي'] });
      await addDoc(collection(db, CATEGORIES_COL), { name: 'إطارات وبطاريات', subcategories: ['إطارات', 'بطاريات'] });
    }
  } catch (err) {
    console.error('Error seeding initial data:', err);
  }
}

// =========================================================
// OFFLINE SALES & LOCAL STORAGE SYNCHRONIZATION ENGINE
// =========================================================
const OFFLINE_SALES_KEY = 'pending_offline_sales';

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine;
}

export function getOfflineSales(): Sale[] {
  try {
    const raw = localStorage.getItem(OFFLINE_SALES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading offline sales:', e);
    return [];
  }
}

export function saveOfflineSale(saleData: Omit<Sale, 'id'>, userId: string = 'admin'): string {
  const offlineId = `OFFLINE-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const offlineSale: Sale = {
    ...saleData,
    id: offlineId,
    userId,
    date: new Date().toISOString()
  };

  try {
    const existing = getOfflineSales();
    const updated = [offlineSale, ...existing];
    localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(updated));
    
    // Dispatch custom event for UI updates across tabs/components
    window.dispatchEvent(new CustomEvent('offlineSalesUpdated', { detail: { count: updated.length } }));
  } catch (e) {
    console.error('Failed to save offline sale to localStorage:', e);
  }

  return offlineId;
}

export function removeOfflineSale(saleId: string): void {
  try {
    const existing = getOfflineSales();
    const filtered = existing.filter(s => s.id !== saleId);
    localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent('offlineSalesUpdated', { detail: { count: filtered.length } }));
  } catch (e) {
    console.error('Error removing offline sale:', e);
  }
}

export async function syncOfflineSalesToFirestore(): Promise<{
  syncedCount: number;
  failedCount: number;
  errors: string[];
}> {
  const pending = getOfflineSales();
  if (pending.length === 0) {
    return { syncedCount: 0, failedCount: 0, errors: [] };
  }

  let syncedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const offlineSale of pending) {
    try {
      // Prepare sale data for Firestore transaction
      const { id: _, ...saleDataWithoutId } = offlineSale;
      await processSale(saleDataWithoutId, offlineSale.userId || 'admin');
      
      // Remove successfully synced sale from local storage
      removeOfflineSale(offlineSale.id);
      syncedCount++;
    } catch (err: any) {
      console.error(`Failed to sync offline sale ${offlineSale.id}:`, err);
      failedCount++;
      errors.push(`فاتورة #${offlineSale.id}: ${err.message || 'خطأ غير متوقع'}`);
    }
  }

  window.dispatchEvent(new CustomEvent('offlineSalesSynced', { 
    detail: { syncedCount, failedCount, errors } 
  }));

  return { syncedCount, failedCount, errors };
}

// =========================================================
// DATABASE BACKUP & SYSTEM RESET ENGINE
// =========================================================
export interface FullSystemBackup {
  products: Product[];
  sales: Sale[];
  customers: Customer[];
  suppliers: Supplier[];
  categories: Category[];
  expenses: Expense[];
  purchases: Purchase[];
  offlineSales: Sale[];
  settings: Record<string, string>;
  timestamp: string;
  version: string;
}

export async function exportFullDatabaseBackup(): Promise<FullSystemBackup> {
  const safeFetch = async <T>(fetcher: () => Promise<T[]>, fallbackName: string): Promise<T[]> => {
    try {
      return await fetcher();
    } catch (e) {
      console.warn(`Backup: could not fetch ${fallbackName}, returning empty array`, e);
      return [];
    }
  };

  const [products, sales, customers, suppliers, categories, expenses, purchases] = await Promise.all([
    safeFetch(getProducts, 'products'),
    safeFetch(getSales, 'sales'),
    safeFetch(getCustomers, 'customers'),
    safeFetch(getSuppliers, 'suppliers'),
    safeFetch(getCategories, 'categories'),
    safeFetch(getExpenses, 'expenses'),
    safeFetch(getPurchases, 'purchases')
  ]);

  const offlineSales = getOfflineSales();

  // Extract localStorage settings
  const settingsKeys = [
    'businessName', 'businessAddress', 'businessPhone', 'businessTax', 'businessLogoUrl',
    'currency', 'invoiceNotes', 'taxRate', 'taxEnabled', 'taxType', 'paperSize', 'showLogo',
    'allowCashierPriceEdit', 'preventSellBelowCost', 'requireSupervisorPinForPriceEdit',
    'managerWhatsApp', 'managerEmail', 'posDesign', 'posTouchMode', 'posPrimaryColor',
    'posButtonSize', 'posViewMode'
  ];

  const settings: Record<string, string> = {};
  settingsKeys.forEach(k => {
    const val = localStorage.getItem(k);
    if (val !== null) settings[k] = val;
  });

  return {
    products,
    sales,
    customers,
    suppliers,
    categories,
    expenses,
    purchases,
    offlineSales,
    settings,
    timestamp: new Date().toISOString(),
    version: '2.5.0'
  };
}

export type SystemResetMode = 'full' | 'balances_only' | 'sales_purchases_only';

export async function resetSystemDatabase(mode: SystemResetMode): Promise<void> {
  const deleteCollectionDocs = async (colName: string) => {
    try {
      const snap = await getDocs(collection(db, colName));
      const deletePromises = snap.docs.map(d => deleteDoc(doc(db, colName, d.id)));
      await Promise.all(deletePromises);
    } catch (e) {
      console.warn(`Error clearing collection ${colName}:`, e);
    }
  };

  if (mode === 'full') {
    // Complete wipe: delete all business entities
    await Promise.all([
      deleteCollectionDocs(PRODUCTS_COL),
      deleteCollectionDocs(SALES_COL),
      deleteCollectionDocs(CUSTOMERS_COL),
      deleteCollectionDocs(SUPPLIERS_COL),
      deleteCollectionDocs(EXPENSES_COL),
      deleteCollectionDocs(PURCHASES_COL),
      deleteCollectionDocs(CATEGORIES_COL),
      deleteCollectionDocs(MOVEMENTS_COL),
      deleteCollectionDocs(SESSIONS_COL)
    ]);

    // Clear offline sales & local cache
    localStorage.removeItem(OFFLINE_SALES_KEY);
    indexedDB.deleteDatabase('firestoreCached');
  } 
  else if (mode === 'balances_only') {
    // Reset stock quantities to 0 for all products
    try {
      const prodSnap = await getDocs(collection(db, PRODUCTS_COL));
      const prodUpdates = prodSnap.docs.map(d => updateDoc(doc(db, PRODUCTS_COL, d.id), { quantity: 0 }));
      await Promise.all(prodUpdates);
    } catch (e) {
      console.warn('Error resetting product quantities:', e);
    }

    // Reset customer balances
    try {
      const custSnap = await getDocs(collection(db, CUSTOMERS_COL));
      const custUpdates = custSnap.docs.map(d => {
        const data = d.data();
        return updateDoc(doc(db, CUSTOMERS_COL, d.id), { currentBalance: data.openingBalance || 0 });
      });
      await Promise.all(custUpdates);
    } catch (e) {
      console.warn('Error resetting customer balances:', e);
    }

    // Reset supplier balances
    try {
      const suppSnap = await getDocs(collection(db, SUPPLIERS_COL));
      const suppUpdates = suppSnap.docs.map(d => {
        const data = d.data();
        return updateDoc(doc(db, SUPPLIERS_COL, d.id), { currentBalance: data.openingBalance || 0 });
      });
      await Promise.all(suppUpdates);
    } catch (e) {
      console.warn('Error resetting supplier balances:', e);
    }

    // Delete transactions & movements history
    await Promise.all([
      deleteCollectionDocs(SALES_COL),
      deleteCollectionDocs(PURCHASES_COL),
      deleteCollectionDocs(EXPENSES_COL),
      deleteCollectionDocs(MOVEMENTS_COL),
      deleteCollectionDocs(SESSIONS_COL)
    ]);

    localStorage.removeItem(OFFLINE_SALES_KEY);
  } 
  else if (mode === 'sales_purchases_only') {
    // Delete sales, purchases, expenses & movements history ONLY (keep products & current stock as is)
    await Promise.all([
      deleteCollectionDocs(SALES_COL),
      deleteCollectionDocs(PURCHASES_COL),
      deleteCollectionDocs(EXPENSES_COL),
      deleteCollectionDocs(MOVEMENTS_COL),
      deleteCollectionDocs(SESSIONS_COL)
    ]);

    localStorage.removeItem(OFFLINE_SALES_KEY);
  }
}



