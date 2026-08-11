import { db } from '../src/db/index.ts';
import { 
  products, sales, saleItems, inventoryMovements, 
  customers, suppliers, purchases, expenses, 
  cashierSessions, categories, users, companies, branches, memberships
} from '../src/db/schema.ts';
import { eq, and, ne, count } from 'drizzle-orm';
import { collection, getDocs } from 'firebase/firestore';
import { db as firestoreDb, ensureAuth } from '../src/lib/firebase.ts';

async function audit() {
  console.log('=== STARTING INDEPENDENT DATA MIGRATION AUDIT ===\n');

  try {
    await ensureAuth();
  } catch (err) {
    console.warn('Firebase Auth Warning:', err);
  }

  const entities = [
    { name: 'users', table: users, col: 'users', companyField: users.companyId },
    { name: 'categories', table: categories, col: 'categories', companyField: categories.companyId },
    { name: 'products', table: products, col: 'products', companyField: products.companyId },
    { name: 'sales', table: sales, col: 'sales', companyField: sales.companyId },
    { name: 'saleItems', table: saleItems, col: 'saleItems', companyField: null }, // linked via saleId
    { name: 'inventoryMovements', table: inventoryMovements, col: 'inventoryMovements', companyField: inventoryMovements.companyId },
    { name: 'customers', table: customers, col: 'customers', companyField: customers.companyId },
    { name: 'suppliers', table: suppliers, col: 'suppliers', companyField: suppliers.companyId },
    { name: 'purchases', table: purchases, col: 'purchases', companyField: purchases.companyId },
    { name: 'expenses', table: expenses, col: 'expenses', companyField: expenses.companyId },
    { name: 'cashierSessions', table: cashierSessions, col: 'cashierSessions', companyField: cashierSessions.companyId },
  ];

  const results: any[] = [];

  for (const ent of entities) {
    // 1. Get Firestore Count
    let fsCount = 0;
    try {
      const snap = await getDocs(collection(firestoreDb, ent.col));
      fsCount = snap.size;
    } catch (e) {
      fsCount = 0;
    }

    // 2. Get PostgreSQL Final Count
    const pgFinalRes = await db.select({ val: count() }).from(ent.table as any);
    const pgFinalCount = Number(pgFinalRes[0]?.val || 0);

    // 3. Get PostgreSQL Migrated Original Count (companyId = 'company_default')
    let pgMigratedOriginal = 0;
    let pgTestCount = 0;

    if (ent.companyField) {
      const origRes = await db.select({ val: count() })
        .from(ent.table as any)
        .where(eq(ent.companyField, 'company_default'));
      pgMigratedOriginal = Number(origRes[0]?.val || 0);

      const testRes = await db.select({ val: count() })
        .from(ent.table as any)
        .where(ne(ent.companyField, 'company_default'));
      pgTestCount = Number(testRes[0]?.val || 0);
    } else if (ent.name === 'saleItems') {
      // SaleItems are joined with sales to check companyId
      const origRes = await db.select({ val: count() })
        .from(saleItems)
        .innerJoin(sales, eq(saleItems.saleId, sales.id))
        .where(eq(sales.companyId, 'company_default'));
      pgMigratedOriginal = Number(origRes[0]?.val || 0);

      const testRes = await db.select({ val: count() })
        .from(saleItems)
        .innerJoin(sales, eq(saleItems.saleId, sales.id))
        .where(ne(sales.companyId, 'company_default'));
      pgTestCount = Number(testRes[0]?.val || 0);
    }

    const difference = pgMigratedOriginal - fsCount;

    results.push({
      Entity: ent.name,
      'Firestore Original Count': fsCount,
      'PostgreSQL Migrated Original Count': pgMigratedOriginal,
      'Post-Migration Test Records': pgTestCount,
      'PostgreSQL Final Count': pgFinalCount,
      Difference: difference
    });
  }

  console.table(results);
}

audit().then(() => process.exit(0)).catch(err => {
  console.error('Audit Error:', err);
  process.exit(1);
});
