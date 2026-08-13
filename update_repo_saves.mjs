import fs from 'fs';

let repo = fs.readFileSync('src/db/repository.ts', 'utf8');

// Update saveProduct
if (!repo.includes("validateAndSanitizeCustomAttributes(cId, 'PRODUCT'")) {
  repo = repo.replace(
    /export async function saveProduct\(data: \{[\s\S]*?\}\) \{/,
    `export async function saveProduct(data: { 
  id?: string; companyId: string; sku?: string; barcode?: string; name: string; 
  price: number; wholesalePrice?: number; halfWholesalePrice?: number; minPrice?: number; costPrice?: number; stock: number; minStock?: number; 
  categoryId?: string; brandId?: string; unitId?: string; isWeighted?: boolean; customAttributes?: any;
}) {
  const cId = requireTenant(data.companyId);
  const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, 'PRODUCT', data.customAttributes);`
  );
  repo = repo.replace(
    /const payload = \{\s*id,\s*companyId: cId,[\s\S]*?\};/,
    `const payload = {
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
  };`
  );
}

// Update saveCustomer
if (!repo.includes("validateAndSanitizeCustomAttributes(cId, 'CUSTOMER'")) {
  repo = repo.replace(
    /export async function saveCustomer\(data: \{ id\?: string; companyId: string; name: string; phone\?: string; email\?: string; balance\?: number; creditLimit\?: number \}\) \{/,
    `export async function saveCustomer(data: { id?: string; companyId: string; name: string; phone?: string; email?: string; balance?: number; creditLimit?: number; customAttributes?: any }) {
  const cId = requireTenant(data.companyId);
  const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, 'CUSTOMER', data.customAttributes);`
  );
  repo = repo.replace(
    /const payload = \{\s*id,\s*companyId: cId,\s*name: data\.name,[\s\S]*?\};/,
    `const payload = {
    id,
    companyId: cId,
    name: data.name,
    phone: data.phone || '',
    email: data.email || '',
    priceLevel: data.priceLevel || 'RETAIL',
    balance: String(data.balance || 0),
    creditLimit: String(data.creditLimit || 0),
    customAttributes: sanitizedAttrs
  };`
  );
}

// Update saveSupplier
if (!repo.includes("validateAndSanitizeCustomAttributes(cId, 'SUPPLIER'")) {
  repo = repo.replace(
    /export async function saveSupplier\(data: \{ id\?: string; companyId: string; name: string; phone\?: string; email\?: string; companyName\?: string; balance\?: number \}\) \{/,
    `export async function saveSupplier(data: { id?: string; companyId: string; name: string; phone?: string; email?: string; companyName?: string; balance?: number; customAttributes?: any }) {
  const cId = requireTenant(data.companyId);
  const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, 'SUPPLIER', data.customAttributes);`
  );
  repo = repo.replace(
    /const payload = \{\s*id,\s*companyId: cId,\s*name: data\.name,[\s\S]*?\};/,
    `const payload = {
    id,
    companyId: cId,
    name: data.name,
    phone: data.phone || '',
    email: data.email || '',
    companyName: data.companyName || '',
    balance: String(data.balance || 0),
    customAttributes: sanitizedAttrs
  };`
  );
}

// Update createEmployee
if (!repo.includes("validateAndSanitizeCustomAttributes(cId, 'EMPLOYEE'")) {
  repo = repo.replace(
    /export async function createEmployee\(companyId: string, data: any\) \{/,
    `export async function createEmployee(companyId: string, data: any) {
  const cId = requireTenant(companyId);
  const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, 'EMPLOYEE', data.customAttributes);`
  );
  repo = repo.replace(
    /await db\.insert\(employees\)\.values\(\{ \.\.\.data, id, companyId: cId \}\);/,
    `await db.insert(employees).values({ ...data, id, companyId: cId, customAttributes: sanitizedAttrs });`
  );
}

fs.writeFileSync('src/db/repository.ts', repo);
console.log('Successfully updated save functions in src/db/repository.ts');
