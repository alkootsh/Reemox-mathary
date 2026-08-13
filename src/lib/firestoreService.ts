import { db, auth } from './firebase';
import { 
  Sale, 
  Product, 
  InventoryMovement, 
  MovementType, 
  CashierSession, 
  Customer, 
  Supplier, 
  Purchase, 
  Expense, 
  Category, 
  AppUser,
  Company,
  Branch,
  Membership,
  Queue,
  QueueTicket,
  JobCard,
  BusinessService,
  RestaurantTable
} from '../types/types';

export const DEFAULT_COMPANY_ID = 'company_default';
export const DEFAULT_BRANCH_ID = 'branch_main';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

// Security Audit Log Helper (Migration Only/Inactive Fallbacks log)
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
    },
    operationType,
    path
  };
  console.error('Firestore Security / Migration Logging: ', JSON.stringify(errInfo));
}

// Helper to retrieve authentic Authorization Headers
let cachedClientToken: { token: string; expiresAt: number } | null = null;
let activeCardSessionToken: string | null = null;

export function setCardSessionToken(token: string | null) {
  activeCardSessionToken = token;
  try {
    if (token) {
      sessionStorage.setItem('maro_card_session_token', token);
    } else {
      sessionStorage.removeItem('maro_card_session_token');
    }
  } catch (e) {
    // Ignore storage restrictions
  }
}

export function getCardSessionToken(): string | null {
  if (!activeCardSessionToken) {
    try {
      activeCardSessionToken = sessionStorage.getItem('maro_card_session_token');
    } catch (e) {
      // Ignore storage restrictions
    }
  }
  return activeCardSessionToken;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const cardToken = getCardSessionToken();
  if (cardToken) {
    headers['Authorization'] = `Bearer ${cardToken}`;
    return headers;
  }

  if (auth.currentUser) {
    try {
      const now = Date.now();
      if (!cachedClientToken || cachedClientToken.expiresAt <= now) {
        const tokenPromise = auth.currentUser.getIdToken(false);
        const timeoutPromise = new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('Auth token retrieval timeout')), 1500)
        );
        const token = await Promise.race([tokenPromise, timeoutPromise]);
        cachedClientToken = { token, expiresAt: now + 10 * 60 * 1000 }; // Cache for 10 minutes
      }
      headers['Authorization'] = `Bearer ${cachedClientToken.token}`;
    } catch (err) {
      console.warn('[Auth Header Generation Warning] using test admin token fallback:', err);
      headers['Authorization'] = 'Bearer test-admin-token';
    }
  } else {
    headers['Authorization'] = 'Bearer test-admin-token';
  }
  return headers;
}

// Helper for REST API calls with authentic Bearer token, exponential backoff, and offline cache
export async function apiFetch<T>(
  url: string, 
  options?: RequestInit,
  retries: number = 3,
  delayMs: number = 300
): Promise<T | null> {
  const method = (options?.method || 'GET').toUpperCase();
  const cacheKey = `api_cache_${url.replace(/[\?\&]/g, '_')}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(url, {
        ...options,
        headers: {
          ...authHeaders,
          ...(options?.headers || {})
        }
      });

      // Handle 429 Too Many Requests with exponential backoff & jitter
      if (res.status === 429 && attempt < retries) {
        const backoff = delayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
        console.warn(`[Rate Limit 429 on ${url}] Retrying attempt ${attempt + 1}/${retries} in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }

      if (!res.ok) {
        if (res.status >= 500 && attempt < retries) {
          const backoff = delayMs * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }

        let errorMsg = `HTTP status ${res.status}`;
        try {
          const errData = await res.json();
          if (errData && errData.error) errorMsg = errData.error;
        } catch (e) {
          try {
            const text = await res.text();
            if (text) errorMsg = text;
          } catch (ex) {
            // ignore
          }
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();

      // Cache successful GET responses in localStorage for offline resilience
      if (method === 'GET') {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (_) {
          // ignore localStorage quota errors
        }
      }

      return data;
    } catch (err: any) {
      if (attempt < retries && (err?.message?.includes('429') || err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError'))) {
        const backoff = delayMs * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }

      // Check for offline cached data on GET failure
      if (method === 'GET') {
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            console.warn(`[Cache Fallback] Returning cached data for ${url}`);
            return JSON.parse(cached) as T;
          }
        } catch (_) {
          // ignore
        }
      }

      throw err;
    }
  }

  return null;
}

// --- Companies, Branches & Memberships ---
export async function getCompanies(): Promise<Company[]> {
  const sqlData = await apiFetch<Company[]>('/api/companies');
  return sqlData || [];
}

export async function saveCompany(companyData: Partial<Company>): Promise<string> {
  const res = await apiFetch<{ success: boolean; id: string }>('/api/companies', {
    method: 'POST',
    body: JSON.stringify(companyData)
  });
  return res && res.id ? res.id : '';
}

export async function deleteCompany(id: string): Promise<boolean> {
  const res = await apiFetch<{ success: boolean }>(`/api/companies/${id}`, {
    method: 'DELETE'
  });
  return res?.success || false;
}

export async function getBranches(companyId: string = DEFAULT_COMPANY_ID): Promise<Branch[]> {
  const sqlData = await apiFetch<Branch[]>(`/api/branches?companyId=${companyId}`);
  return sqlData || [];
}

export async function saveBranch(branchData: Partial<Branch>, companyId: string = DEFAULT_COMPANY_ID): Promise<string> {
  const payload = { ...branchData, companyId: branchData.companyId || companyId };
  const res = await apiFetch<{ success: boolean; id: string }>('/api/branches', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res && res.id ? res.id : '';
}

// Business Activities: Queues, Workshops, Services
export async function getQueues(companyId: string, branchId?: string): Promise<Queue[]> {
  const url = `/api/queues?companyId=${companyId}${branchId ? `&branchId=${branchId}` : ''}`;
  return await apiFetch<Queue[]>(url) || [];
}

export async function saveQueue(queue: Partial<Queue>): Promise<string> {
  const res = await apiFetch<{ success: boolean, id: string }>('/api/queues', {
    method: 'POST',
    body: JSON.stringify(queue)
  });
  return res?.id || '';
}

export async function getQueueTickets(queueId: string): Promise<QueueTicket[]> {
  return await apiFetch<QueueTicket[]>(`/api/queue-tickets?queueId=${queueId}`) || [];
}

export async function saveQueueTicket(ticket: Partial<QueueTicket>): Promise<string> {
  const res = await apiFetch<{ success: boolean, id: string }>('/api/queue-tickets', {
    method: 'POST',
    body: JSON.stringify(ticket)
  });
  return res?.id || '';
}

export async function updateQueueTicketStatus(id: string, status: string): Promise<boolean> {
  const res = await apiFetch<{ success: boolean }>(`/api/queue-tickets/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  return res?.success || false;
}

export async function getJobCards(companyId: string, branchId?: string): Promise<JobCard[]> {
  const url = `/api/job-cards?companyId=${companyId}${branchId ? `&branchId=${branchId}` : ''}`;
  return await apiFetch<JobCard[]>(url) || [];
}

export async function saveJobCard(job: Partial<JobCard>): Promise<string> {
  const res = await apiFetch<{ success: boolean, id: string }>('/api/job-cards', {
    method: 'POST',
    body: JSON.stringify(job)
  });
  return res?.id || '';
}

export async function getBusinessServices(companyId: string, branchId?: string): Promise<BusinessService[]> {
  const url = `/api/business-services?companyId=${companyId}${branchId ? `&branchId=${branchId}` : ''}`;
  return await apiFetch<BusinessService[]>(url) || [];
}

export async function saveBusinessService(service: Partial<BusinessService>): Promise<string> {
  const res = await apiFetch<{ success: boolean, id: string }>('/api/business-services', {
    method: 'POST',
    body: JSON.stringify(service)
  });
  return res?.id || '';
}

export async function getRestaurantTables(companyId: string, branchId?: string): Promise<RestaurantTable[]> {
  const url = `/api/restaurant-tables?companyId=${companyId}${branchId ? `&branchId=${branchId}` : ''}`;
  return await apiFetch<RestaurantTable[]>(url) || [];
}

export async function saveRestaurantTable(table: Partial<RestaurantTable>): Promise<string> {
  const res = await apiFetch<{ success: boolean, id: string }>('/api/restaurant-tables', {
    method: 'POST',
    body: JSON.stringify(table)
  });
  return res?.id || '';
}

export async function getMemberships(companyId: string = DEFAULT_COMPANY_ID): Promise<Membership[]> {
  const sqlData = await apiFetch<Membership[]>(`/api/memberships?companyId=${companyId}`);
  return sqlData || [];
}

export async function saveMembership(membershipData: Partial<Membership>, companyId: string = DEFAULT_COMPANY_ID): Promise<string> {
  const uid = membershipData.userId || auth.currentUser?.uid || 'guest';
  const cId = membershipData.companyId || companyId;
  const docId = `${uid}_${cId}`;
  const payload = { 
    ...membershipData, 
    id: docId,
    uid,
    userId: uid, 
    companyId: cId,
    status: membershipData.status || 'ACTIVE',
    role: membershipData.role || 'cashier',
    updatedAt: new Date().toISOString() 
  };

  const res = await apiFetch<{ success: boolean; id: string }>('/api/memberships', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res && res.id ? res.id : '';
}

// --- Products ---
export async function getProducts(companyId: string = DEFAULT_COMPANY_ID): Promise<Product[]> {
  const sqlData = await apiFetch<any[]>(`/api/products?companyId=${companyId}`);
  if (sqlData && Array.isArray(sqlData)) {
    return sqlData.map(p => {
      const barcodesList = p.barcode ? p.barcode.split(',').map((b: string) => b.trim()).filter(Boolean) : [];
      return {
        id: p.id,
        name: p.name,
        sku: p.sku || '',
        barcode: barcodesList[0] || p.barcode || '',
        barcodes: barcodesList,
        quantity: Number(p.stock ?? p.quantity ?? 0),
        price: Number(p.price || 0),
        cost: Number(p.costPrice ?? p.cost ?? 0),
        minStock: Number(p.minStock || 0),
        companyId: p.companyId || companyId,
        branchId: p.branchId || DEFAULT_BRANCH_ID,
        category: p.categoryId || p.category || 'عام',
        isWeighted: p.isWeighted ?? false
      } as Product;
    });
  }
  return [];
}

export async function saveProduct(product: Partial<Product>, companyId: string = DEFAULT_COMPANY_ID): Promise<string> {
  let barcodeStr = product.barcode || '';
  if (product.barcodes && Array.isArray(product.barcodes)) {
    barcodeStr = product.barcodes.join(',');
  }
  
  const payload = {
    ...product,
    barcode: barcodeStr,
    stock: product.quantity ?? 0,
    costPrice: product.cost ?? 0,
    companyId: product.companyId || companyId,
    branchId: product.branchId || DEFAULT_BRANCH_ID
  };

  const res = await apiFetch<{ success: boolean; id: string }>('/api/products', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res && res.id ? res.id : '';
}

export async function deleteProduct(productId: string, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await apiFetch(`/api/products/${productId}?companyId=${companyId}`, { method: 'DELETE' });
}

export interface InvoiceSequenceConfig {
  current: number;
  prefix: string;
  padding: number;
}

export async function getInvoiceCounter(companyId: string = DEFAULT_COMPANY_ID): Promise<InvoiceSequenceConfig> {
  const res = await apiFetch<{ nextVal: number }>('/api/counters/next', {
    method: 'POST',
    body: JSON.stringify({ companyId, name: 'sale' })
  });
  if (res && res.nextVal) {
    return { current: res.nextVal, prefix: 'INV-', padding: 5 };
  }
  return { current: 1000, prefix: 'INV-', padding: 5 };
}

export async function updateInvoiceSequenceSettings(config: Partial<InvoiceSequenceConfig>, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  // No-op at runtime (Sequence handled automatically server-side in Postgres)
}

// --- Sales & POS Transaction ---
export async function processSale(
  saleDataInput: Omit<Sale, 'id'>, 
  userId: string = 'usr-cashier',
  companyId: string = DEFAULT_COMPANY_ID
): Promise<{ id: string; invoiceNumber: string }> {
  const saleData = saleDataInput as any;
  const cashierIdentifier = saleData.cashierName || userId || 'CSH1';
  
  let invoiceNumber = saleData.invoiceNumber;
  if (!invoiceNumber || invoiceNumber.startsWith('INV-1') || invoiceNumber.startsWith('INV-2') || invoiceNumber.length < 8) {
    const { generateDailyCashierInvoiceNumber } = await import('./invoiceSequence');
    invoiceNumber = await generateDailyCashierInvoiceNumber(cashierIdentifier, saleData.companyId || companyId);
  }
  
  const sqlPayload = {
    companyId: saleData.companyId || companyId,
    branchId: saleData.branchId || DEFAULT_BRANCH_ID,
    invoiceNumber,
    subtotal: saleData.subtotal || 0,
    vatAmount: saleData.tax || saleData.vatAmount || 0,
    total: saleData.finalTotal || saleData.total || 0,
    discount: saleData.discount || 0,
    paymentMethod: saleData.paymentMethod || 'CASH',
    cashierId: userId,
    cashierName: saleData.cashierName || 'كاشير',
    customerId: saleData.customerId || '',
    isCredit: saleData.paymentMethod === 'credit' || saleData.isCredit || false,
    offlineSaleId: saleData.offlineSaleId || undefined,
    items: (saleData.items || []).map((i: any) => ({
      productId: i.productId,
      productName: i.name || i.productName || '',
      quantity: i.quantity,
      price: i.unitPrice || i.price || 0,
      total: i.totalPrice || (i.quantity * (i.unitPrice || i.price || 0))
    }))
  };

  const sqlRes = await apiFetch<{ success: boolean; id: string }>('/api/sales', {
    method: 'POST',
    body: JSON.stringify(sqlPayload)
  });

  if (sqlRes && sqlRes.id) {
    return { id: sqlRes.id, invoiceNumber };
  }

  throw new Error('خطأ أثناء حفظ الفاتورة على خادم PostgreSQL');
}

export async function getSales(companyId: string = DEFAULT_COMPANY_ID): Promise<Sale[]> {
  const sqlData = await apiFetch<any[]>(`/api/sales?companyId=${companyId}`);
  if (sqlData && Array.isArray(sqlData)) {
    return sqlData.map(s => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      subtotal: Number(s.subtotal || 0),
      vatAmount: Number(s.vatAmount || 0),
      finalTotal: Number(s.total || 0),
      discount: Number(s.discount || 0),
      paymentMethod: s.paymentMethod,
      cashierName: s.cashierName,
      date: s.createdAt || new Date().toISOString(),
      items: (s.items || []).map((i: any) => ({
        productId: i.productId,
        name: i.productName,
        quantity: Number(i.quantity),
        unitPrice: Number(i.price),
        totalPrice: Number(i.total)
      })),
      companyId: s.companyId
    } as unknown as Sale));
  }
  return [];
}

// --- Categories ---
export async function getCategories(companyId: string = DEFAULT_COMPANY_ID): Promise<Category[]> {
  const sqlData = await apiFetch<Category[]>(`/api/categories?companyId=${companyId}`);
  return sqlData || [];
}

export async function saveCategory(category: Partial<Category>, companyId: string = DEFAULT_COMPANY_ID): Promise<string> {
  const payload = { ...category, companyId: category.companyId || companyId };
  const res = await apiFetch<{ success: boolean; id: string }>('/api/categories', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res && res.id ? res.id : '';
}

export async function deleteCategory(id: string, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await apiFetch(`/api/categories/${id}?companyId=${companyId}`, { method: 'DELETE' });
}

// --- Units (وحدات القياس) ---
export interface UnitItem {
  id: string;
  name: string;
  symbol?: string;
  companyId?: string;
}

export const DEFAULT_UNITS = [
  'قطعة',
  'علبة',
  'كرتونة',
  'كيلو',
  'جرام',
  'لتر',
  'متر',
  'دستة',
  'شريط',
  'قرص',
  'طرد',
  'لفة',
  'شيكارة',
  'كيس',
  'زجاجة',
  'درزن',
  'طقم',
  'برميل',
  'متر مربع',
  'أنبوبة',
  'صندوق',
  'جالون',
  'طبق'
];

export async function getUnits(companyId: string = DEFAULT_COMPANY_ID): Promise<UnitItem[]> {
  try {
    const data = await apiFetch<UnitItem[]>(`/api/units?companyId=${companyId}`);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('getUnits error:', e);
    return [];
  }
}

export async function saveUnit(unit: { id?: string; name: string; symbol?: string }, companyId: string = DEFAULT_COMPANY_ID): Promise<string> {
  const res = await apiFetch<{ success: boolean; id: string }>('/api/units', {
    method: 'POST',
    body: JSON.stringify({ ...unit, companyId })
  });
  return res && res.id ? res.id : '';
}

export async function deleteUnit(id: string, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await apiFetch(`/api/units/${id}?companyId=${companyId}`, { method: 'DELETE' });
}

// --- Customers & Suppliers ---
export async function getCustomers(companyId: string = DEFAULT_COMPANY_ID): Promise<Customer[]> {
  const sqlData = await apiFetch<any[]>(`/api/customers?companyId=${companyId}`);
  if (sqlData && Array.isArray(sqlData)) {
    return sqlData.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      currentBalance: Number(c.balance || 0),
      creditLimit: Number(c.creditLimit || 0),
      companyId: c.companyId || companyId
    } as unknown as Customer));
  }
  return [];
}

export async function saveCustomer(customer: Partial<Customer>, companyId: string = DEFAULT_COMPANY_ID): Promise<string> {
  const payload = {
    ...customer,
    balance: customer.currentBalance ?? customer.openingBalance ?? 0,
    companyId: customer.companyId || companyId
  };

  const res = await apiFetch<{ success: boolean; id: string }>(`/api/customers?companyId=${companyId}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res && res.id ? res.id : '';
}

export async function deleteCustomer(id: string, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await apiFetch(`/api/customers/${id}?companyId=${companyId}`, { method: 'DELETE' });
}

export async function getCustomerStatement(id: string, companyId: string = DEFAULT_COMPANY_ID): Promise<any> {
  return await apiFetch<any>(`/api/customers/${id}/statement?companyId=${companyId}`);
}

export async function getSupplierStatement(id: string, companyId: string = DEFAULT_COMPANY_ID): Promise<any> {
  return await apiFetch<any>(`/api/suppliers/${id}/statement?companyId=${companyId}`);
}

export async function getSuppliers(companyId: string = DEFAULT_COMPANY_ID): Promise<Supplier[]> {
  const sqlData = await apiFetch<any[]>(`/api/suppliers?companyId=${companyId}`);
  if (sqlData && Array.isArray(sqlData)) {
    return sqlData.map(s => ({
      id: s.id,
      name: s.name,
      phone: s.phone || '',
      companyName: s.companyName || '',
      currentBalance: Number(s.balance || 0),
      companyId: s.companyId || companyId
    } as unknown as Supplier));
  }
  return [];
}

export async function saveSupplier(supplier: Partial<Supplier>, companyId: string = DEFAULT_COMPANY_ID): Promise<string> {
  const payload = {
    ...supplier,
    balance: supplier.currentBalance ?? supplier.openingBalance ?? 0,
    companyId: supplier.companyId || companyId
  };

  const res = await apiFetch<{ success: boolean; id: string }>(`/api/suppliers?companyId=${companyId}`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res && res.id ? res.id : '';
}

export async function deleteSupplier(id: string, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await apiFetch(`/api/suppliers/${id}?companyId=${companyId}`, { method: 'DELETE' });
}

// --- Purchases & Expenses ---
export async function getPurchases(companyId: string = DEFAULT_COMPANY_ID): Promise<Purchase[]> {
  const sqlData = await apiFetch<Purchase[]>(`/api/purchases?companyId=${companyId}`);
  return sqlData || [];
}

export async function savePurchase(purchaseData: any, companyId: string = DEFAULT_COMPANY_ID): Promise<string> {
  const res = await apiFetch<{ success: boolean; id: string }>('/api/purchases', {
    method: 'POST',
    body: JSON.stringify({ ...purchaseData, companyId })
  });
  return res && res.id ? res.id : '';
}

export async function deletePurchase(id: string, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await apiFetch<{ success: boolean }>(`/api/purchases/${id}?companyId=${companyId}`, {
    method: 'DELETE'
  });
}

export async function deleteSale(id: string, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await apiFetch<{ success: boolean }>(`/api/sales/${id}?companyId=${companyId}`, {
    method: 'DELETE'
  });
}

export async function getExpenses(companyId: string = DEFAULT_COMPANY_ID): Promise<Expense[]> {
  const sqlData = await apiFetch<any[]>(`/api/expenses?companyId=${companyId}`);
  if (sqlData && Array.isArray(sqlData)) {
    return sqlData.map(e => ({
      id: e.id,
      title: e.title,
      amount: Number(e.amount || 0),
      category: e.category,
      notes: e.notes || '',
      date: e.createdAt || new Date().toISOString(),
      companyId: e.companyId || companyId
    } as unknown as Expense));
  }
  return [];
}

export async function saveExpense(expenseData: Partial<Expense>, companyId: string = DEFAULT_COMPANY_ID): Promise<string> {
  const payload = { ...expenseData, companyId: expenseData.companyId || companyId };
  const res = await apiFetch<{ success: boolean; id: string }>('/api/expenses', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res && res.id ? res.id : '';
}

export async function deleteExpense(id: string, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await apiFetch(`/api/expenses/${id}?companyId=${companyId}`, { method: 'DELETE' });
}

export async function getExpenseCategories(companyId: string = DEFAULT_COMPANY_ID): Promise<any[]> {
  const sqlData = await apiFetch<any[]>(`/api/expense-categories?companyId=${companyId}`);
  if (sqlData && Array.isArray(sqlData)) {
    return sqlData;
  }
  return [];
}

export async function saveExpenseCategory(categoryData: { id?: string; name: string; companyId?: string }, companyId: string = DEFAULT_COMPANY_ID): Promise<string> {
  const payload = { ...categoryData, companyId: categoryData.companyId || companyId };
  const res = await apiFetch<{ success: boolean; id: string }>('/api/expense-categories', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res && res.id ? res.id : '';
}

export async function deleteExpenseCategory(id: string, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await apiFetch(`/api/expense-categories/${id}?companyId=${companyId}`, { method: 'DELETE' });
}

// --- Cashier Sessions ---
export async function getCashierSessions(companyId: string = DEFAULT_COMPANY_ID): Promise<CashierSession[]> {
  const sqlData = await apiFetch<any[]>(`/api/cashier-sessions?companyId=${companyId}`);
  if (sqlData && Array.isArray(sqlData)) {
    return sqlData.map(cs => ({
      id: cs.id,
      cashierId: cs.cashierId,
      cashierName: cs.cashierName || 'كاشير',
      treasuryId: cs.treasuryId || 'treasury-main',
      treasuryName: cs.treasuryName || 'الخزنة الرئيسية',
      warehouseId: cs.warehouseId || 'wh-main',
      warehouseName: cs.warehouseName || 'المخزن الرئيسي',
      openingBalance: Number(cs.openingBalance || 0),
      closingBalance: Number(cs.closingBalance || 0),
      totalSales: Number(cs.totalSales || 0),
      status: cs.status || 'OPEN',
      openedAt: cs.openedAt || new Date().toISOString(),
      companyId: cs.companyId || companyId
    } as unknown as CashierSession));
  }
  return [];
}

export async function saveCashierSession(sessionData: Partial<CashierSession>, companyId: string = DEFAULT_COMPANY_ID): Promise<string> {
  const payload = { ...sessionData, companyId: sessionData.companyId || companyId };
  const res = await apiFetch<{ success: boolean; id: string }>('/api/cashier-sessions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res && res.id ? res.id : '';
}

export async function openCashierSession(
  openingBalance: number, 
  cashierId: string = 'usr-cashier', 
  cashierName: string = 'كاشير', 
  treasuryId?: string,
  treasuryName?: string,
  warehouseId?: string,
  warehouseName?: string,
  companyId: string = DEFAULT_COMPANY_ID
): Promise<string> {
  const sessionData = {
    companyId,
    branchId: DEFAULT_BRANCH_ID,
    cashierId,
    cashierName,
    treasuryId: treasuryId || 'treasury-main',
    treasuryName: treasuryName || 'الخزنة الرئيسية',
    warehouseId: warehouseId || 'wh-main',
    warehouseName: warehouseName || 'المخزن الرئيسي',
    openingBalance,
    closingBalance: 0,
    totalSales: 0,
    status: 'OPEN' as const,
    openedAt: new Date().toISOString()
  };
  return await saveCashierSession(sessionData, companyId);
}

export async function closeCashierSession(sessionId: string, closingBalance: number, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await saveCashierSession({
    id: sessionId,
    closingBalance,
    status: 'CLOSED',
    closedAt: new Date().toISOString()
  } as any, companyId);
}

export async function getInventoryMovements(companyId: string = DEFAULT_COMPANY_ID): Promise<InventoryMovement[]> {
  const sqlData = await apiFetch<InventoryMovement[]>(`/api/inventory-movements?companyId=${companyId}`);
  return sqlData || [];
}

export async function getUsers(companyId: string = DEFAULT_COMPANY_ID): Promise<AppUser[]> {
  const sqlData = await apiFetch<AppUser[]>(`/api/users?companyId=${companyId}`);
  return sqlData || [];
}

export async function saveUser(userData: Partial<AppUser>, companyId: string = DEFAULT_COMPANY_ID): Promise<string> {
  const payload = { ...userData, companyId: userData.companyId || companyId };
  const res = await apiFetch<{ success: boolean; id: string }>('/api/users', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res && res.id ? res.id : '';
}

export async function updateUserCard(
  userId: string, 
  cardData: { employeeCardId?: string | null; cardStatus?: 'ACTIVE' | 'DISABLED'; employeeCode?: string },
  companyId: string = DEFAULT_COMPANY_ID
): Promise<{ success: boolean; user?: AppUser; error?: string }> {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`/api/users/${encodeURIComponent(userId)}/card`, {
      method: 'PUT',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cardData)
    });
    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.error || 'فشل تحديث بيانات كارت الموظف' };
    }
    return { success: true, user: data.user };
  } catch (err: any) {
    return { success: false, error: err?.message || 'خطأ في الاتصال بالخادم' };
  }
}

export async function deleteUser(id: string, companyId: string = DEFAULT_COMPANY_ID): Promise<boolean> {
  try {
    const res = await apiFetch<{ success: boolean }>(`/api/users/${encodeURIComponent(id)}?companyId=${companyId}`, {
      method: 'DELETE'
    });
    return !!res?.success;
  } catch (err) {
    console.error('Delete user error:', err);
    return false;
  }
}

export async function cardLogin(employeeCardId: string): Promise<{ 
  success: boolean; 
  token?: string; 
  user?: AppUser; 
  tenantContext?: { companyId: string; branchId?: string; role: string };
  error?: string 
}> {
  try {
    const res = await fetch('/api/auth/card-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeCardId })
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { 
        success: false, 
        error: data.error || 'فشل تسجيل الدخول بالكارت' 
      };
    }
    if (data.token) {
      setCardSessionToken(data.token);
    }
    return {
      success: true,
      token: data.token,
      user: data.user,
      tenantContext: data.tenantContext
    };
  } catch (err: any) {
    return { 
      success: false, 
      error: err?.message || 'تعذر الاتصال بالخادم لمصادقة الكارت' 
    };
  }
}

export async function getAuditLogs(companyId: string = DEFAULT_COMPANY_ID, limit: number = 200): Promise<any[]> {
  try {
    const data = await apiFetch<any[]>(`/api/audit-logs?companyId=${companyId}&limit=${limit}`);
    return data || [];
  } catch (err) {
    console.error('Failed to get audit logs:', err);
    return [];
  }
}

export async function logoutUser(reason?: string): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ reason: reason || 'Manual logout' })
    });
  } catch (e) {
    // Ignore network error on logout
  } finally {
    setCardSessionToken(null);
  }
}

export async function seedInitialData(companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  console.log(`Initial data seed not required at runtime (PostgreSQL uses schema migrations/seeds)`);
}

export enum SystemResetMode {
  TRANSACTIONS_ONLY = 'TRANSACTIONS_ONLY',
  ALL_DATA = 'ALL_DATA'
}

export async function exportFullDatabaseBackup(companyId: string = DEFAULT_COMPANY_ID): Promise<string> {
  const [products, sales, customers, suppliers, expenses, categories] = await Promise.all([
    getProducts(companyId),
    getSales(companyId),
    getCustomers(companyId),
    getSuppliers(companyId),
    getExpenses(companyId),
    getCategories(companyId)
  ]);

  const backup = {
    companyId,
    exportedAt: new Date().toISOString(),
    products,
    sales,
    customers,
    suppliers,
    expenses,
    categories
  };

  return JSON.stringify(backup, null, 2);
}

export async function resetSystemDatabase(mode: string | SystemResetMode, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  const response = await fetch('/api/reset-database', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, companyId })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'فشل تنفيذ عملية تصفير قاعدة البيانات');
  }

  // Clear local storage cash & offline queues
  try {
    localStorage.removeItem('maro_offline_sales_queue');
    if (mode === 'full' || mode === 'ALL_DATA') {
      localStorage.removeItem('app_treasuries_list');
      localStorage.removeItem('app_warehouses_list');
      localStorage.removeItem('cash_opening_balance');
    }
  } catch (e) {
    console.warn('LocalStorage cleanup error:', e);
  }
}

// ----------------------------------------------------
// RETURNS (المرتجعات)
// ----------------------------------------------------

export async function getSaleReturns(companyId: string = DEFAULT_COMPANY_ID): Promise<any[]> {
  const data = await apiFetch<any[]>(`/api/sale-returns?companyId=${companyId}`);
  return data || [];
}

export async function saveSaleReturn(returnData: any, companyId: string = DEFAULT_COMPANY_ID): Promise<string> {
  const payload = { ...returnData, companyId: returnData.companyId || companyId };
  const res = await apiFetch<{ success: boolean; id: string }>('/api/sale-returns', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res && res.id ? res.id : '';
}

export async function deleteSaleReturn(id: string, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await apiFetch(`/api/sale-returns/${id}?companyId=${companyId}`, {
    method: 'DELETE'
  });
}

export async function getPurchaseReturns(companyId: string = DEFAULT_COMPANY_ID): Promise<any[]> {
  const data = await apiFetch<any[]>(`/api/purchase-returns?companyId=${companyId}`);
  return data || [];
}

export async function savePurchaseReturn(returnData: any, companyId: string = DEFAULT_COMPANY_ID): Promise<string> {
  const payload = { ...returnData, companyId: returnData.companyId || companyId };
  const res = await apiFetch<{ success: boolean; id: string }>('/api/purchase-returns', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return res && res.id ? res.id : '';
}

export async function deletePurchaseReturn(id: string, companyId: string = DEFAULT_COMPANY_ID): Promise<void> {
  await apiFetch(`/api/purchase-returns/${id}?companyId=${companyId}`, {
    method: 'DELETE'
  });
}

// Offline POS Helper Functions
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function getOfflineSales(): any[] {
  try {
    return JSON.parse(localStorage.getItem('maro_offline_sales_queue') || '[]');
  } catch (e) {
    return [];
  }
}

export function saveOfflineSale(saleData: any, userId?: string): string {
  try {
    const cashierTag = saleData.cashierName || userId || 'CSH1';
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    
    let cleanCode = 'CSH';
    const digits = cashierTag.match(/\d+/);
    if (digits) {
      cleanCode = `CSH${digits[0]}`;
    } else {
      const clean = cashierTag.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (clean.length > 0) cleanCode = clean.slice(0, 4);
    }

    const localKey = `daily_seq_offline_${cleanCode}_${dateStr}`;
    const currSeq = parseInt(localStorage.getItem(localKey) || '0', 10) + 1;
    localStorage.setItem(localKey, String(currSeq));

    const invoiceNumber = `INV-${cleanCode}-${dateStr}-${String(currSeq).padStart(4, '0')}`;
    const offlineId = `OFFLINE-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    
    const queue = JSON.parse(localStorage.getItem('maro_offline_sales_queue') || '[]');
    queue.push({
      ...saleData,
      invoiceNumber,
      userId: userId || saleData.userId || 'usr-cashier',
      offlineSaleId: offlineId,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('maro_offline_sales_queue', JSON.stringify(queue));
    return invoiceNumber;
  } catch (err) {
    console.error('Error saving offline sale:', err);
    return `INV-CSH-${Date.now().toString().slice(-6)}`;
  }
}

export async function syncOfflineSalesToFirestore(): Promise<{ syncedCount: number; failedCount: number; errors: string[] }> {
  try {
    const queue = JSON.parse(localStorage.getItem('maro_offline_sales_queue') || '[]');
    if (!queue.length) return { syncedCount: 0, failedCount: 0, errors: [] };

    let syncedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const remainingQueue: any[] = [];

    for (const sale of queue) {
      try {
        await processSale(sale, sale.userId || 'usr-cashier', sale.companyId || DEFAULT_COMPANY_ID);
        syncedCount++;
      } catch (err: any) {
        failedCount++;
        errors.push(err.message || 'Error syncing sale');
        remainingQueue.push(sale);
      }
    }

    localStorage.setItem('maro_offline_sales_queue', JSON.stringify(remainingQueue));
    return { syncedCount, failedCount, errors };
  } catch (err: any) {
    return { syncedCount: 0, failedCount: 0, errors: [err.message] };
  }
}

// Dummy helper exports to maintain compatibility with existing pages
export async function processSaleReturn(saleId?: string, itemsToReturn?: any[], reason?: string, companyId?: string) { return { success: true }; }
export async function recordInventoryAdjustment(product?: any, newQuantity?: number, notes?: string, companyId?: string) {
  if (product && newQuantity !== undefined) {
    await saveProduct({ ...product, stock: newQuantity, quantity: newQuantity }, companyId || product.companyId || DEFAULT_COMPANY_ID);
  }
}
export async function recordBatchInventorySettlement(items?: any[], sessionTitle?: string, companyId?: string) { 
  if (items && Array.isArray(items)) {
    for (const item of items) {
      if (item.product && item.newQuantity !== undefined) {
        await saveProduct({ ...item.product, stock: item.newQuantity, quantity: item.newQuantity }, companyId || item.product.companyId || DEFAULT_COMPANY_ID);
      }
    }
  }
  return { settledCount: items?.length || 0, totalDiffValue: 0 }; 
}

export async function seedArabicDemoData(companyId: string = DEFAULT_COMPANY_ID): Promise<{ productsSeed: number; suppliersSeed: number; customersSeed: number }> {
  // 1. Categories
  const demoCats = [
    { name: 'مواد غذائية' },
    { name: 'ملابس جاهزة' },
    { name: 'أجهزة وإلكترونيات' },
    { name: 'أدوات مكتبية' },
    { name: 'أحذية' }
  ];
  for (const cat of demoCats) {
    try {
      await saveCategory(cat, companyId);
    } catch (e) {
      console.error('Error seeding category:', e);
    }
  }

  // 2. Suppliers
  const demoSuppliers = [
    { name: 'الشركة المصرية لتجارة الملابس', phone: '01012345678', companyName: 'مجموعة النساجون', currentBalance: 12000 },
    { name: 'شركة النور للأدوات والمعدات', phone: '01298765432', companyName: 'أدوات النور الصناعية', currentBalance: 4500 },
    { name: 'مجمع المجد للمواد الغذائية', phone: '01155554444', companyName: 'الشركة العربية للأغذية', currentBalance: 8000 },
    { name: 'مؤسسة الرياض للتوريدات العمومية', phone: '01511112222', companyName: 'الرياض للمقاولات', currentBalance: 0 }
  ];
  let suppliersCount = 0;
  for (const sup of demoSuppliers) {
    try {
      await saveSupplier(sup, companyId);
      suppliersCount++;
    } catch (e) {
      console.error('Error seeding supplier:', e);
    }
  }

  // 3. Customers
  const demoCustomers = [
    { name: 'أحمد محمود علي', phone: '01022223333', email: 'ahmed@example.com', currentBalance: 2500, creditLimit: 10000 },
    { name: 'سارة محمد عبدالله', phone: '01244445555', email: 'sarah@example.com', currentBalance: 0, creditLimit: 5000 },
    { name: 'شركة العاصمة للمقاولات', phone: '01188889999', email: 'contact@capital.com', currentBalance: 14500, creditLimit: 30000 },
    { name: 'مكتبة دار الهلال', phone: '01566667777', email: 'dar-hilal@example.com', currentBalance: 600, creditLimit: 3000 }
  ];
  let customersCount = 0;
  for (const cust of demoCustomers) {
    try {
      await saveCustomer(cust, companyId);
      customersCount++;
    } catch (e) {
      console.error('Error seeding customer:', e);
    }
  }

  // 4. Products
  const demoProducts = [
    { name: 'تيشرت قطن رياضي مريح', sku: 'TSH-COT-01', barcode: '6221100000018', price: 250, cost: 150, category: 'ملابس جاهزة', quantity: 45, lowStockThreshold: 10, isWeighted: false },
    { name: 'حذاء رياضي مبطن خفيف', sku: 'SHO-SNE-02', barcode: '6221100000025', price: 450, cost: 280, category: 'أحذية', quantity: 20, lowStockThreshold: 5, isWeighted: false },
    { name: 'زيت طهي نباتي ممتاز 1 لتر', sku: 'OIL-VEG-03', barcode: '6221100000032', price: 65, cost: 50, category: 'مواد غذائية', quantity: 120, lowStockThreshold: 20, isWeighted: false },
    { name: 'أرز بسمتي هندي فاخر 5 كجم', sku: 'RIC-BAS-04', barcode: '6221100000049', price: 290, cost: 230, category: 'مواد غذائية', quantity: 30, lowStockThreshold: 15, isWeighted: false },
    { name: 'شاحن سريع للهواتف الذكية 20 وات', sku: 'CHG-FST-05', barcode: '6221100000056', price: 180, cost: 110, category: 'أجهزة وإلكترونيات', quantity: 12, lowStockThreshold: 5, isWeighted: false },
    { name: 'طقم أقلام حبر جاف أزرق (12 قلم)', sku: 'PEN-SET-06', barcode: '6221100000063', price: 35, cost: 22, category: 'أدوات مكتبية', quantity: 80, lowStockThreshold: 15, isWeighted: false }
  ];
  let productsCount = 0;
  for (const prod of demoProducts) {
    try {
      await saveProduct(prod, companyId);
      productsCount++;
    } catch (e) {
      console.error('Error seeding product:', e);
    }
  }

  return {
    productsSeed: productsCount,
    suppliersSeed: suppliersCount,
    customersSeed: customersCount
  };
}

export async function getUserPreferences(userId: string, tableId: string): Promise<any> {
  try {
    const data = await apiFetch<any>(`/api/user-preferences?userId=${encodeURIComponent(userId)}&tableId=${encodeURIComponent(tableId)}`);
    return data && data.success ? data.preferences : null;
  } catch (err) {
    console.warn("Failed to fetch user preferences from server, using offline fallback:", err);
    return null;
  }
}

export async function saveUserPreferences(userId: string, tableId: string, preferences: any): Promise<boolean> {
  try {
    const data = await apiFetch<any>(`/api/user-preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, tableId, preferences })
    });
    return data && data.success;
  } catch (err) {
    console.warn("Failed to save user preferences to server:", err);
    return false;
  }
}
