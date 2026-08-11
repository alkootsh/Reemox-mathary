# MARO Lite - Phase 1: Full System Audit & SQL Migration Plan

Date: 2026-08-09
System Version: MARO Lite Multi-Tenant ERP / POS

---

## 1. Current Architecture

Currently, MARO Lite operates as a multi-tenant web application using:
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Lucide React.
- **Backend / Storage**: Firebase Firestore as the live operational database with optional offline caching, paired with Firebase Authentication.
- **Local Persistence & Context**: Browser `localStorage` holds tenant selection (`maro_tenant_company_id`, `maro_tenant_branch_id`), active user/role (`maro_user`, `maro_role`), and pending offline POS transactions (`maro_offline_sales_queue`).

### High-Level Data Flow (Current)
```
[ React UI / Pages ] 
     │
     ├──> [ TenantContext / localStorage ] (Company ID, Branch ID, Active User)
     │
     └──> [ src/lib/firestoreService.ts ]
                 │
                 └──> Direct Client Firestore SDK Queries (products, sales, inventory, etc.)
```

---

## 2. Firestore Collections

| Collection Name | Usage & Description | Key Fields / Document Structure |
| :--- | :--- | :--- |
| `companies` | Multi-tenant company profiles | `id`, `name`, `taxNumber`, `phone`, `address`, `currency`, `vatPercentage`, `createdAt` |
| `branches` | Physical store locations per tenant | `id`, `companyId`, `name`, `code`, `phone`, `address`, `isMain` |
| `memberships` | User-to-company role mappings | `id` (`uid_companyId`), `uid`, `userId`, `companyId`, `role` (`ADMIN` \| `CASHIER`), `status` |
| `users` | User credentials / profiles | `id`, `uid`, `companyId`, `branchId`, `name`, `email`, `role`, `pin` |
| `products` | Inventory catalog | `id`, `companyId`, `sku`, `barcode`, `name`, `price`, `costPrice`, `stock`, `minStock`, `categoryId`, `isWeighted` |
| `categories` | Product classification | `id`, `companyId`, `name`, `description` |
| `sales` | Invoices and transactions | `id`, `companyId`, `branchId`, `invoiceNumber`, `subtotal`, `vatAmount`, `total`, `discount`, `paymentMethod`, `splitPayments`, `cashierId`, `cashierName`, `customerId`, `isCredit`, `items[]`, `createdAt` |
| `inventoryMovements` | Stock audit ledger | `id`, `companyId`, `branchId`, `productId`, `productName`, `quantity`, `type` (`SALE`, `PURCHASE`, `ADJUSTMENT`, `TRANSFER_IN`, `TRANSFER_OUT`), `referenceId`, `createdAt` |
| `cashierSessions` | Shifts & drawer management | `id`, `companyId`, `branchId`, `cashierId`, `cashierName`, `openingBalance`, `closingBalance`, `totalSales`, `totalCash`, `totalCard`, `status` (`OPEN`, `CLOSED`), `openedAt`, `closedAt` |
| `customers` | Client directory & balances | `id`, `companyId`, `name`, `phone`, `email`, `balance`, `creditLimit` |
| `suppliers` | Vendor directory & balances | `id`, `companyId`, `name`, `phone`, `email`, `companyName`, `balance` |
| `purchases` | Vendor purchase orders | `id`, `companyId`, `branchId`, `purchaseNumber`, `supplierId`, `supplierName`, `subtotal`, `vatAmount`, `total`, `items[]`, `createdAt` |
| `expenses` | Operating expenses log | `id`, `companyId`, `branchId`, `title`, `amount`, `category`, `notes`, `createdBy`, `createdAt` |
| `counters` | Invoice & document auto-numbering | `id` (`sale_companyId`, `purchase_companyId`), `currentValue` |

---

## 3. Firestore Dependencies

1. **SDK Imports**: `firebase/firestore` (`collection`, `doc`, `getDocs`, `getDoc`, `addDoc`, `updateDoc`, `deleteDoc`, `setDoc`, `query`, `where`, `runTransaction`).
2. **`src/lib/firestoreService.ts`**: Central service layer containing ~40 Firestore helper functions used across all React components.
3. **`src/lib/firebase.ts`**: Firebase client initialization and `ensureAuth()` helper.
4. **`firestore.rules`**: Security rules for collection matchers and tenant scoping.

---

## 4. localStorage Dependencies

- `maro_tenant_company_id`: Active tenant identifier.
- `maro_tenant_branch_id`: Active branch identifier.
- `maro_user`: Cached user object.
- `maro_role`: User role badge (`ADMIN` / `CASHIER`).
- `maro_offline_sales_queue`: Local array storing invoices created while offline.

---

## 5. Authentication & Tenant Logic

- Currently using Firebase Auth (or anonymous fallback) paired with `memberships` and `users` Firestore collections.
- Frontend context (`TenantContext.tsx`) manages active `companyId` and `branchId`.
- **Target Architecture Change**: Frontend MUST NOT dictate permissions or switch roles via `localStorage`. Server-side Express middleware will authenticate requests via Firebase ID tokens and verify user roles/tenancy from PostgreSQL `memberships`.

---

## 6. Business Module Dependencies

1. **POS Module (`src/pages/POS.tsx`)**:
   - Fetches products & categories for active branch.
   - Manages barcode scanning (`@zxing/library` & `react-zxing`).
   - Supports weighted products (`21` prefix barcodes).
   - Handles split payments (`CASH`, `CARD`, `WALLET`, `CREDIT`).
   - Processes customer credit sales and balance updates.
   - Writes to `sales`, `inventoryMovements`, `cashierSessions`, `customers`.
   - Queues offline sales to `maro_offline_sales_queue` when disconnected.

2. **Inventory Module (`src/pages/Inventory.tsx` & `src/pages/StockAdjustments.tsx`)**:
   - Product CRUD, barcode generation, min-stock alerts.
   - Stock adjustments and branch transfers.
   - Direct stock decrement / increment logic.

3. **Purchases & Suppliers (`src/pages/Purchases.tsx` & `src/pages/Suppliers.tsx`)**:
   - Creates purchase orders, increments stock, updates supplier debt balances.

4. **Customers & Receivables (`src/pages/Customers.tsx`)**:
   - Client account tracking, credit limits, payment receipts.

5. **Expenses (`src/pages/Expenses.tsx`)**:
   - Operating expense logging and category reports.

6. **Reports & Shift Closures (`src/pages/Reports.tsx` & `src/pages/CashierClosure.tsx`)**:
   - Generates X-Report (live shift summary) and Z-Report (final shift closure).
   - Generates sales analysis, top products, profit/loss, and inventory valuation.

---

## 7. Migration Risks & Mitigation Strategies

| Risk | Impact | Mitigation Strategy |
| :--- | :--- | :--- |
| **Race Conditions / Overselling** | High | Use PostgreSQL `BEGIN...COMMIT` transactions with `FOR UPDATE` row locks on stock. |
| **Offline Idempotency** | Medium | Use `offlineSaleId` / client UUIDs in `sales` table with unique constraint. |
| **Role Escalation via Client** | High | Server-side Express middleware verifies session and membership from DB; ignores client claims. |
| **Data Loss during Migration** | Critical | Build a non-destructive migration script (`scripts/migrateFirestoreToPostgres.ts`) that copies documents from Firestore to PostgreSQL without deleting Firestore data. |
| **Frontend Breaking Changes** | High | Abstract API repository layer (`src/repositories/*`) keeping API signatures matching existing TypeScript models. |

---

## 8. Recommended PostgreSQL Schema (Drizzle ORM)

### Core System Tables
- `companies`: `id` (text, PK), `name`, `tax_number`, `phone`, `address`, `currency`, `vat_percentage`, `created_at`
- `branches`: `id` (text, PK), `company_id` (FK), `name`, `code`, `phone`, `address`, `is_main`
- `users`: `id` (text, PK), `uid` (text, unique), `email`, `name`, `pin`, `created_at`
- `memberships`: `id` (text, PK), `user_id` (FK), `company_id` (FK), `branch_id` (FK), `role` (`ADMIN` \| `CASHIER`), `status`, `created_at`
- `roles` & `permissions`: Granular RBAC tables.
- `audit_logs`: `id`, `company_id`, `user_id`, `action`, `details`, `created_at`

### Products & Catalog Tables
- `categories`: `id`, `company_id`, `name`, `description`
- `products`: `id`, `company_id`, `sku`, `barcode`, `name`, `price`, `cost_price`, `stock`, `min_stock`, `category_id`, `is_weighted`, `created_at`

### Sales & Invoices
- `sales`: `id`, `company_id`, `branch_id`, `invoice_number`, `subtotal`, `vat_amount`, `total`, `discount`, `payment_method`, `cashier_id`, `cashier_name`, `customer_id`, `is_credit`, `offline_sale_id`, `created_at`
- `sale_items`: `id`, `sale_id` (FK), `product_id` (FK), `product_name`, `quantity`, `price`, `total`
- `payments`: `id`, `sale_id` (FK), `method` (`CASH`, `CARD`, `WALLET`, `CREDIT`), `amount`
- `sale_returns` & `sale_return_items`: Return processing tables.

### Inventory Management
- `inventory_balances`: `id`, `company_id`, `branch_id`, `product_id`, `quantity`
- `inventory_movements`: `id`, `company_id`, `branch_id`, `product_id`, `product_name`, `quantity`, `type`, `reference_id`, `created_at`

### Accounts & Entities
- `customers`: `id`, `company_id`, `name`, `phone`, `email`, `balance`, `credit_limit`
- `suppliers`: `id`, `company_id`, `name`, `phone`, `email`, `company_name`, `balance`

### Purchases & Expenses
- `purchases`: `id`, `company_id`, `branch_id`, `purchase_number`, `supplier_id`, `subtotal`, `vat_amount`, `total`, `created_at`
- `purchase_items`: `id`, `purchase_id`, `product_id`, `quantity`, `cost_price`, `total`
- `expenses`: `id`, `company_id`, `branch_id`, `title`, `amount`, `category`, `notes`, `created_by`, `created_at`

### Cashier Sessions
- `cashier_sessions`: `id`, `company_id`, `branch_id`, `cashier_id`, `cashier_name`, `opening_balance`, `closing_balance`, `total_sales`, `total_cash`, `total_card`, `status`, `opened_at`, `closed_at`

---

## 9. Next Steps (Phases 2-6)
1. Present Cloud SQL Setup UI to obtain approval.
2. Initialize Cloud SQL instance and Drizzle ORM schema.
3. Build Express API server routes & repositories (`/api/*`).
4. Execute Firestore to PostgreSQL migration script.
5. Re-bind React frontend data hooks to Express `/api/*` routes.
6. Verify POS, Stock, Reports, and Multi-tenant security tests.
