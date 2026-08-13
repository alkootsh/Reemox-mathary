import fs from 'fs';

let repo = fs.readFileSync('src/db/repository.ts', 'utf8');

// 1. Fix saveBranch if corrupted
const correctBranch = `export async function saveBranch(data: { id?: string; companyId: string; name: string; code?: string; phone?: string; address?: string; isMain?: boolean }) {
  const cId = requireTenant(data.companyId);
  const id = data.id || \`branch_\${Date.now()}\`;
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
}`;

// Find saveBranch and replace
repo = repo.replace(/export async function saveBranch[\s\S]*?return id;\n}/, correctBranch);

// 2. Fix saveCategory if corrupted
const correctCategory = `export async function saveCategory(data: { id?: string; companyId: string; name: string; description?: string }) {
  const cId = requireTenant(data.companyId);
  const id = data.id || \`cat_\${Date.now()}\`;
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
}`;

repo = repo.replace(/export async function saveCategory[\s\S]*?return id;\n}/, correctCategory);

// 3. Ensure saveProduct correctly uses sanitizedAttrs
const correctProduct = `export async function saveProduct(data: { 
  id?: string; companyId: string; sku?: string; barcode?: string; name: string; 
  price: number; wholesalePrice?: number; halfWholesalePrice?: number; minPrice?: number; costPrice?: number; stock: number; minStock?: number; 
  categoryId?: string; brandId?: string; unitId?: string; isWeighted?: boolean; customAttributes?: any;
}) {
  const cId = requireTenant(data.companyId);
  const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, 'PRODUCT', data.customAttributes);
  const id = data.id || \`prod_\${Date.now()}\`;
  const payload = {
    id,
    companyId: cId,
    sku: data.sku || \`SKU-\${Date.now().toString().slice(-6)}\`,
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
    isWeighted: data.isWeighted ?? false,
    customAttributes: sanitizedAttrs
  };
  await db.insert(products).values(payload).onConflictDoUpdate({
    target: products.id,
    set: payload
  });
  return id;
}`;

repo = repo.replace(/export async function saveProduct[\s\S]*?return id;\n}/, correctProduct);

// 4. Ensure saveCustomer correctly uses sanitizedAttrs
const correctCustomer = `export async function saveCustomer(data: { id?: string; companyId: string; name: string; phone?: string; email?: string; balance?: number; creditLimit?: number; customAttributes?: any }) {
  const cId = requireTenant(data.companyId);
  const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, 'CUSTOMER', data.customAttributes);
  const id = data.id || \`cust_\${Date.now()}\`;
  const payload = {
    id,
    companyId: cId,
    name: data.name,
    phone: data.phone || '',
    email: data.email || '',
    priceLevel: data.priceLevel || 'RETAIL',
    balance: String(data.balance || 0),
    creditLimit: String(data.creditLimit || 0),
    customAttributes: sanitizedAttrs
  };
  await db.insert(customers).values(payload).onConflictDoUpdate({
    target: customers.id,
    set: payload
  });
  return id;
}`;

repo = repo.replace(/export async function saveCustomer[\s\S]*?return id;\n}/, correctCustomer);

// 5. Ensure saveSupplier correctly uses sanitizedAttrs
const correctSupplier = `export async function saveSupplier(data: { id?: string; companyId: string; name: string; phone?: string; email?: string; companyName?: string; balance?: number; customAttributes?: any }) {
  const cId = requireTenant(data.companyId);
  const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, 'SUPPLIER', data.customAttributes);
  const id = data.id || \`supp_\${Date.now()}\`;
  const payload = {
    id,
    companyId: cId,
    name: data.name,
    phone: data.phone || '',
    email: data.email || '',
    companyName: data.companyName || '',
    balance: String(data.balance || 0),
    customAttributes: sanitizedAttrs
  };
  await db.insert(suppliers).values(payload).onConflictDoUpdate({
    target: suppliers.id,
    set: payload
  });
  return id;
}`;

repo = repo.replace(/export async function saveSupplier[\s\S]*?return id;\n}/, correctSupplier);

// 6. Ensure createEmployee correctly uses sanitizedAttrs
const correctEmployee = `export async function createEmployee(companyId: string, data: any) {
  const cId = requireTenant(companyId);
  const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, 'EMPLOYEE', data.customAttributes);
  const id = \`emp_\${Date.now()}\`;
  await db.insert(employees).values({ ...data, id, companyId: cId, customAttributes: sanitizedAttrs });
  return id;
}`;

repo = repo.replace(/export async function createEmployee[\s\S]*?return id;\n}/, correctEmployee);

fs.writeFileSync('src/db/repository.ts', repo);
console.log('Successfully finalized src/db/repository.ts');
