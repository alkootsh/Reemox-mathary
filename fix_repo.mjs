import fs from 'fs';

let repo = fs.readFileSync('src/db/repository.ts', 'utf8');

// Replace duplicate cId declarations
repo = repo.replace(/const cId = requireTenant\(data\.companyId\);\s*const sanitizedAttrs = await validateAndSanitizeCustomAttributes\([^)]+\);\s*const cId = requireTenant\(data\.companyId\);/g, (match) => {
  return match.split('const cId = requireTenant(data.companyId);')[0] + 'const cId = requireTenant(data.companyId);\n  const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, ...);';
});

// Let's do more precise replacements for each function:
// 1. saveProduct
repo = repo.replace(
  /export async function saveProduct\(data: \{[\s\S]*?\}\) \{\s*const cId = requireTenant\(data\.companyId\);\s*const sanitizedAttrs = await validateAndSanitizeCustomAttributes\(cId, 'PRODUCT', data\.customAttributes\);\s*const cId = requireTenant\(data\.companyId\);/,
  `export async function saveProduct(data: { 
  id?: string; companyId: string; sku?: string; barcode?: string; name: string; 
  price: number; wholesalePrice?: number; halfWholesalePrice?: number; minPrice?: number; costPrice?: number; stock: number; minStock?: number; 
  categoryId?: string; brandId?: string; unitId?: string; isWeighted?: boolean; customAttributes?: any;
}) {
  const cId = requireTenant(data.companyId);
  const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, 'PRODUCT', data.customAttributes);`
);

// 2. saveCustomer
repo = repo.replace(
  /export async function saveCustomer\(data: \{[\s\S]*?\}\) \{\s*const cId = requireTenant\(data\.companyId\);\s*const sanitizedAttrs = await validateAndSanitizeCustomAttributes\(cId, 'CUSTOMER', data\.customAttributes\);\s*const cId = requireTenant\(data\.companyId\);/,
  `export async function saveCustomer(data: { id?: string; companyId: string; name: string; phone?: string; email?: string; balance?: number; creditLimit?: number; customAttributes?: any }) {
  const cId = requireTenant(data.companyId);
  const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, 'CUSTOMER', data.customAttributes);`
);

// 3. saveSupplier
repo = repo.replace(
  /export async function saveSupplier\(data: \{[\s\S]*?\}\) \{\s*const cId = requireTenant\(data\.companyId\);\s*const sanitizedAttrs = await validateAndSanitizeCustomAttributes\(cId, 'SUPPLIER', data\.customAttributes\);\s*const cId = requireTenant\(data\.companyId\);/,
  `export async function saveSupplier(data: { id?: string; companyId: string; name: string; phone?: string; email?: string; companyName?: string; balance?: number; customAttributes?: any }) {
  const cId = requireTenant(data.companyId);
  const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, 'SUPPLIER', data.customAttributes);`
);

// 4. createEmployee
repo = repo.replace(
  /export async function createEmployee\(companyId: string, data: any\) \{\s*const cId = requireTenant\(companyId\);\s*const sanitizedAttrs = await validateAndSanitizeCustomAttributes\(cId, 'EMPLOYEE', data\.customAttributes\);\s*const cId = requireTenant\(companyId\);/,
  `export async function createEmployee(companyId: string, data: any) {
  const cId = requireTenant(companyId);
  const sanitizedAttrs = await validateAndSanitizeCustomAttributes(cId, 'EMPLOYEE', data.customAttributes);`
);

fs.writeFileSync('src/db/repository.ts', repo);
console.log('Fixed src/db/repository.ts');
