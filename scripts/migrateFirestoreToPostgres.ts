import { collection, getDocs } from 'firebase/firestore';
import { db, ensureAuth } from '../src/lib/firebase.ts';
import { 
  saveCompany, saveBranch, saveUser, saveMembership, 
  saveCategory, saveProduct, createSaleTransaction, 
  saveCustomer, saveSupplier, createPurchaseTransaction, 
  saveExpense, saveCashierSession 
} from '../src/db/repository.ts';

export async function runMigration() {
  console.log('=== STARTING FIRESTORE TO POSTGRES MIGRATION ===');
  await ensureAuth();

  const stats = {
    companies: 0,
    branches: 0,
    users: 0,
    memberships: 0,
    categories: 0,
    products: 0,
    sales: 0,
    customers: 0,
    suppliers: 0,
    purchases: 0,
    expenses: 0,
    cashierSessions: 0
  };

  try {
    // 1. Companies
    const compDocs = await getDocs(collection(db, 'companies'));
    for (const docSnap of compDocs.docs) {
      const d = docSnap.data();
      await saveCompany({
        id: docSnap.id,
        name: d.name || 'الشركة الرئيسيّة',
        taxNumber: d.taxNumber || '',
        phone: d.phone || '',
        address: d.address || '',
        currency: d.currency || 'SAR',
        vatPercentage: d.vatPercentage || 15
      });
      stats.companies++;
    }

    // 2. Branches
    const branchDocs = await getDocs(collection(db, 'branches'));
    for (const docSnap of branchDocs.docs) {
      const d = docSnap.data();
      await saveBranch({
        id: docSnap.id,
        companyId: d.companyId || 'company_default',
        name: d.name || 'الفرع الرئيسي',
        code: d.code || 'MAIN',
        phone: d.phone || '',
        address: d.address || '',
        isMain: d.isMain ?? true
      });
      stats.branches++;
    }

    // 3. Users
    const userDocs = await getDocs(collection(db, 'users'));
    for (const docSnap of userDocs.docs) {
      const d = docSnap.data();
      await saveUser({
        id: docSnap.id,
        uid: d.uid || docSnap.id,
        email: d.email || `${docSnap.id}@example.com`,
        name: d.name || 'User',
        pin: d.pin || '1234',
        companyId: d.companyId || 'company_default',
        branchId: d.branchId || 'branch_main',
        role: d.role || 'cashier'
      });
      stats.users++;
    }

    // 4. Memberships
    const memDocs = await getDocs(collection(db, 'memberships'));
    for (const docSnap of memDocs.docs) {
      const d = docSnap.data();
      await saveMembership({
        id: docSnap.id,
        uid: d.uid || d.userId || docSnap.id,
        userId: d.userId || d.uid || docSnap.id,
        companyId: d.companyId || 'company_default',
        branchId: d.branchId || 'branch_main',
        role: d.role || 'cashier',
        status: d.status || 'ACTIVE'
      });
      stats.memberships++;
    }

    // 5. Categories
    const catDocs = await getDocs(collection(db, 'categories'));
    for (const docSnap of catDocs.docs) {
      const d = docSnap.data();
      await saveCategory({
        id: docSnap.id,
        companyId: d.companyId || 'company_default',
        name: d.name || 'تصنيف عام',
        description: d.description || ''
      });
      stats.categories++;
    }

    // 6. Products
    const prodDocs = await getDocs(collection(db, 'products'));
    for (const docSnap of prodDocs.docs) {
      const d = docSnap.data();
      await saveProduct({
        id: docSnap.id,
        companyId: d.companyId || 'company_default',
        sku: d.sku || '',
        barcode: d.barcode || '',
        name: d.name || 'منتج',
        price: Number(d.price || 0),
        costPrice: Number(d.costPrice || 0),
        stock: Number(d.stock || 0),
        minStock: Number(d.minStock || 0),
        categoryId: d.categoryId || '',
        isWeighted: d.isWeighted ?? false
      });
      stats.products++;
    }

    // 7. Customers
    const custDocs = await getDocs(collection(db, 'customers'));
    for (const docSnap of custDocs.docs) {
      const d = docSnap.data();
      await saveCustomer({
        id: docSnap.id,
        companyId: d.companyId || 'company_default',
        name: d.name || 'عميل',
        phone: d.phone || '',
        email: d.email || '',
        balance: Number(d.balance || 0),
        creditLimit: Number(d.creditLimit || 0)
      });
      stats.customers++;
    }

    // 8. Suppliers
    const suppDocs = await getDocs(collection(db, 'suppliers'));
    for (const docSnap of suppDocs.docs) {
      const d = docSnap.data();
      await saveSupplier({
        id: docSnap.id,
        companyId: d.companyId || 'company_default',
        name: d.name || 'مورد',
        phone: d.phone || '',
        email: d.email || '',
        companyName: d.companyName || '',
        balance: Number(d.balance || 0)
      });
      stats.suppliers++;
    }

    // 9. Sales
    const saleDocs = await getDocs(collection(db, 'sales'));
    for (const docSnap of saleDocs.docs) {
      const d = docSnap.data();
      const rawItems = Array.isArray(d.items) ? d.items : [];
      await createSaleTransaction({
        id: docSnap.id,
        companyId: d.companyId || 'company_default',
        branchId: d.branchId || 'branch_main',
        invoiceNumber: d.invoiceNumber || `INV-${docSnap.id.slice(-6)}`,
        subtotal: Number(d.subtotal || 0),
        vatAmount: Number(d.vatAmount || 0),
        total: Number(d.total || 0),
        discount: Number(d.discount || 0),
        paymentMethod: d.paymentMethod || 'CASH',
        cashierId: d.cashierId || '',
        cashierName: d.cashierName || '',
        customerId: d.customerId || '',
        isCredit: d.isCredit ?? false,
        offlineSaleId: d.offlineSaleId || undefined,
        items: rawItems.map((i: any) => ({
          productId: i.productId || i.id || 'prod_unknown',
          productName: i.productName || i.name || 'منتج',
          quantity: Number(i.quantity || 1),
          price: Number(i.price || 0),
          total: Number(i.total || (i.price * i.quantity) || 0)
        }))
      });
      stats.sales++;
    }

    // 10. Purchases
    const purchDocs = await getDocs(collection(db, 'purchases'));
    for (const docSnap of purchDocs.docs) {
      const d = docSnap.data();
      const rawItems = Array.isArray(d.items) ? d.items : [];
      await createPurchaseTransaction({
        id: docSnap.id,
        companyId: d.companyId || 'company_default',
        branchId: d.branchId || 'branch_main',
        purchaseNumber: d.purchaseNumber || `PUR-${docSnap.id.slice(-6)}`,
        supplierId: d.supplierId || '',
        supplierName: d.supplierName || '',
        subtotal: Number(d.subtotal || 0),
        vatAmount: Number(d.vatAmount || 0),
        total: Number(d.total || 0),
        items: rawItems.map((i: any) => ({
          productId: i.productId || i.id || 'prod_unknown',
          productName: i.productName || i.name || 'منتج',
          quantity: Number(i.quantity || 1),
          costPrice: Number(i.costPrice || i.price || 0),
          total: Number(i.total || 0)
        }))
      });
      stats.purchases++;
    }

    // 11. Expenses
    const expDocs = await getDocs(collection(db, 'expenses'));
    for (const docSnap of expDocs.docs) {
      const d = docSnap.data();
      await saveExpense({
        id: docSnap.id,
        companyId: d.companyId || 'company_default',
        branchId: d.branchId || 'branch_main',
        title: d.title || 'مصروف',
        amount: Number(d.amount || 0),
        category: d.category || 'عام',
        notes: d.notes || '',
        createdBy: d.createdBy || ''
      });
      stats.expenses++;
    }

    // 12. Cashier Sessions
    const csDocs = await getDocs(collection(db, 'cashierSessions'));
    for (const docSnap of csDocs.docs) {
      const d = docSnap.data();
      await saveCashierSession({
        id: docSnap.id,
        companyId: d.companyId || 'company_default',
        branchId: d.branchId || 'branch_main',
        cashierId: d.cashierId || 'cashier_main',
        cashierName: d.cashierName || 'كاشير',
        openingBalance: Number(d.openingBalance || 0),
        closingBalance: Number(d.closingBalance || 0),
        totalSales: Number(d.totalSales || 0),
        totalCash: Number(d.totalCash || 0),
        totalCard: Number(d.totalCard || 0),
        status: d.status || 'OPEN'
      });
      stats.cashierSessions++;
    }

    console.log('=== FIRESTORE TO POSTGRES MIGRATION COMPLETED SUCCESSFULLY ===');
    console.log(JSON.stringify(stats, null, 2));
    return { success: true, stats };
  } catch (err: any) {
    console.error('Migration Error:', err);
    return { success: false, error: err?.message || String(err), stats };
  }
}
