import { db } from '../src/db/index.ts';
import { products } from '../src/db/schema.ts';
import { collection, getDocs } from 'firebase/firestore';
import { db as firestoreDb, ensureAuth } from '../src/lib/firebase.ts';

async function compare() {
  await ensureAuth();
  const fsSnap = await getDocs(collection(firestoreDb, 'products'));
  const fsProds = fsSnap.docs.map(d => ({ id: d.id, name: d.data().name }));

  const pgProds = await db.select().from(products);

  console.log('--- Firestore Products ---');
  fsProds.forEach(p => console.log(`FS_ID: ${p.id}, Name: ${p.name}`));

  console.log('\n--- PostgreSQL Products (Migrated or Test) ---');
  pgProds.forEach(p => console.log(`PG_ID: ${p.id}, Company: ${p.companyId}, Name: ${p.name}`));
}

compare().then(() => process.exit(0));
