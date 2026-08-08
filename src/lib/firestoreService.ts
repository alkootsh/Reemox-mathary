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
import { Sale, Product, InventoryMovement, CashierSession, Customer, Supplier, Purchase, Expense, Category, AppUser } from '../types/types';

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

// --- Sales & Inventory Atomic Transaction ---
export async function processSale(saleData: Omit<Sale, 'id'>, userId: string = 'admin'): Promise<string> {
  return await runTransaction(db, async (transaction) => {
    // 1. Check stock for all items
    const productReads = await Promise.all(
      saleData.items.map(item => transaction.get(doc(db, PRODUCTS_COL, item.productId)))
    );

    const productUpdates: { ref: any, newQty: number, product: Product, stockBefore: number }[] = [];

    for (let i = 0; i < saleData.items.length; i++) {
      const item = saleData.items[i];
      const prodDoc = productReads[i];
      if (!prodDoc.exists()) {
        throw new Error(`المنتج غير موجود: ${item.name}`);
      }
      const product = { id: prodDoc.id, ...prodDoc.data() } as Product;
      const stockBefore = product.quantity;
      const newQty = stockBefore - item.quantity;

      if (newQty < 0) {
        throw new Error(`الكمية غير متاحة في المخزون للمنتج: ${product.name} (المتاح: ${stockBefore}, المطلوب: ${item.quantity})`);
      }

      productUpdates.push({
        ref: doc(db, PRODUCTS_COL, product.id),
        newQty,
        product,
        stockBefore
      });
    }

    // 2. Create Sale document ref
    const saleRef = doc(collection(db, SALES_COL));
    const saleId = saleRef.id;

    const saleRecord: Sale = {
      ...saleData,
      id: saleId,
      userId,
      date: new Date().toISOString()
    };

    // 3. Create Inventory Movements
    const movementRefs = productUpdates.map(u => ({
      ref: doc(collection(db, MOVEMENTS_COL)),
      data: {
        productId: u.product.id,
        productName: u.product.name,
        branchId: saleData.branchId || 'default',
        movementType: 'SALE' as const,
        quantity: -saleData.items.find(i => i.productId === u.product.id)!.quantity,
        unitCost: u.product.cost,
        stockBefore: u.stockBefore,
        stockAfter: u.newQty,
        referenceType: 'SALE' as const,
        referenceId: saleId,
        userId,
        createdAt: new Date().toISOString()
      } as Omit<InventoryMovement, 'id'>
    }));

    // 4. Update customer balance if credit / unpaid
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

    // --- Execute Writes ---
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

    return saleId;
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


