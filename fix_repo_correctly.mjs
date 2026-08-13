import fs from 'fs';

let repo = fs.readFileSync('src/db/repository.ts', 'utf8');

repo = repo.replace(
  /const sanitizedAttrs = await validateAndSanitizeCustomAttributes\(cId, \.\.\.\);/g,
  "const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, 'PRODUCT', data.customAttributes);"
);

// Specifically fix each:
repo = repo.replace(
  /export async function saveProduct([\s\S]*?)const cId = requireTenant\(data\.companyId\);\s*const sanitizedAttrs = await validateAndSanitizeCustomAttributes\(cId, '[^']+', data\.customAttributes\);/,
  `export async function saveProduct(data: { 
  id?: string; companyId: string; sku?: string; barcode?: string; name: string; 
  price: number; wholesalePrice?: number; halfWholesalePrice?: number; minPrice?: number; costPrice?: number; stock: number; minStock?: number; 
  categoryId?: string; brandId?: string; unitId?: string; isWeighted?: boolean; customAttributes?: any;
}) {
  const cId = requireTenant(data.companyId);
  const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, 'PRODUCT', data.customAttributes);`
);

repo = repo.replace(
  /export async function saveCustomer([\s\S]*?)const cId = requireTenant\(data\.companyId\);\s*const sanitizedAttrs = await validateAndSanitizeCustomAttributes\(cId, '[^']+', data\.customAttributes\);/,
  `export async function saveCustomer(data: { id?: string; companyId: string; name: string; phone?: string; email?: string; balance?: number; creditLimit?: number; customAttributes?: any }) {
  const cId = requireTenant(data.companyId);
  const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, 'CUSTOMER', data.customAttributes);`
);

repo = repo.replace(
  /export async function saveSupplier([\s\S]*?)const cId = requireTenant\(data\.companyId\);\s*const sanitizedAttrs = await validateAndSanitizeCustomAttributes\(cId, '[^']+', data\.customAttributes\);/,
  `export async function saveSupplier(data: { id?: string; companyId: string; name: string; phone?: string; email?: string; companyName?: string; balance?: number; customAttributes?: any }) {
  const cId = requireTenant(data.companyId);
  const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, 'SUPPLIER', data.customAttributes);`
);

repo = repo.replace(
  /export async function createEmployee([\s\S]*?)const cId = requireTenant\(companyId\);\s*const sanitizedAttrs = await validateAndSanitizeCustomAttributes\(cId, '[^']+', data\.customAttributes\);/,
  `export async function createEmployee(companyId: string, data: any) {
  const cId = requireTenant(companyId);
  const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, 'EMPLOYEE', data.customAttributes);`
);

fs.writeFileSync('src/db/repository.ts', repo);
console.log('Corrected src/db/repository.ts');
