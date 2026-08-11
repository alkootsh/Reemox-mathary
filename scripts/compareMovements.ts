import { db } from '../src/db/index.ts';
import { inventoryMovements } from '../src/db/schema.ts';
import { collection, getDocs } from 'firebase/firestore';
import { db as firestoreDb, ensureAuth } from '../src/lib/firebase.ts';

async function compare() {
  await ensureAuth();
  const fsSnap = await getDocs(collection(firestoreDb, 'inventoryMovements'));
  console.log('--- Firestore Inventory Movements ---');
  fsSnap.docs.forEach(d => {
    const data = d.data();
    console.log(`FS_ID: ${d.id}, ProductId: ${data.productId}, CompanyId: ${data.companyId}, Quantity: ${data.quantity || data.change}, Type: ${data.type}`);
  });

  const pgMovements = await db.select().from(inventoryMovements);
  console.log('\n--- PostgreSQL Inventory Movements ---');
  pgMovements.forEach(m => {
    console.log(`PG_ID: ${m.id}, ProductId: ${m.productId}, CompanyId: ${m.companyId}, Quantity: ${m.quantity}, Type: ${m.type}`);
  });
}

compare().then(() => process.exit(0));
