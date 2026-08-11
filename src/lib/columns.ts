export interface ColumnDefinition {
  key: string;
  label: string;
}

// 1. Sales Columns Definition
export const SALES_COLUMNS: ColumnDefinition[] = [
  { key: 'invoiceNumber', label: 'رقم الفاتورة' },
  { key: 'date', label: 'التاريخ والوقت' },
  { key: 'customer', label: 'العميل' },
  { key: 'cashier', label: 'الكاشير' },
  { key: 'branch', label: 'الفرع' },
  { key: 'saleType', label: 'نوع البيع' },
  { key: 'paymentMethod', label: 'طريقة الدفع' },
  { key: 'itemCount', label: 'عدد البنود' },
  { key: 'total', label: 'الإجمالي قبل الخصم' },
  { key: 'discount', label: 'الخصم' },
  { key: 'tax', label: 'الضريبة' },
  { key: 'finalTotal', label: 'الصافي النهائي' },
  { key: 'paid', label: 'المدفوع' },
  { key: 'remaining', label: 'المتبقي' },
  { key: 'status', label: 'الحالة' },
  { key: 'shiftNumber', label: 'رقم الوردية' },
  { key: 'notes', label: 'ملاحظات' },
  { key: 'actions', label: 'الإجراءات' }
];

export const SALES_DEFAULT_VISIBLE = [
  'invoiceNumber',
  'date',
  'customer',
  'paymentMethod',
  'itemCount',
  'finalTotal',
  'paid',
  'remaining',
  'status',
  'actions'
];

// 2. Purchases Columns Definition
export const PURCHASES_COLUMNS: ColumnDefinition[] = [
  { key: 'purchaseNumber', label: 'رقم مستند الشراء' },
  { key: 'invoiceNumber', label: 'رقم فاتورة المورد' },
  { key: 'date', label: 'التاريخ والوقت' },
  { key: 'supplier', label: 'المورد' },
  { key: 'cashier', label: 'الكاشير / الموظف' },
  { key: 'paymentMethod', label: 'طريقة الدفع' },
  { key: 'itemCount', label: 'عدد الأصناف' },
  { key: 'total', label: 'الإجمالي قبل الضريبة' },
  { key: 'discount', label: 'الخصم' },
  { key: 'tax', label: 'الضريبة' },
  { key: 'finalTotal', label: 'إجمالي الشراء الصافي' },
  { key: 'paidAmount', label: 'المبلغ المدفوع' },
  { key: 'remaining', label: 'المبلغ المتبقي' },
  { key: 'status', label: 'الحالة' },
  { key: 'notes', label: 'ملاحظات' },
  { key: 'actions', label: 'الإجراءات' }
];

export const PURCHASES_DEFAULT_VISIBLE = [
  'purchaseNumber',
  'invoiceNumber',
  'date',
  'supplier',
  'paymentMethod',
  'total',
  'paidAmount',
  'remaining',
  'status',
  'actions'
];

// 3. Returns Columns Definition
export const RETURNS_COLUMNS: ColumnDefinition[] = [
  { key: 'returnNumber', label: 'رقم مستند المرتجع' },
  { key: 'invoiceNumber', label: 'رقم الفاتورة الأصلية' },
  { key: 'date', label: 'التاريخ والوقت' },
  { key: 'customerOrSupplier', label: 'العميل / المورد' },
  { key: 'type', label: 'نوع المرتجع' },
  { key: 'totalRefund', label: 'مبلغ الاسترداد' },
  { key: 'paymentMethod', label: 'طريقة رد المبلغ' },
  { key: 'reason', label: 'سبب المرتجع' },
  { key: 'cashier', label: 'المستخدم الصارف' },
  { key: 'itemCount', label: 'عدد البنود المرتجعة' },
  { key: 'actions', label: 'الإجراءات' }
];

export const RETURNS_DEFAULT_VISIBLE = [
  'returnNumber',
  'invoiceNumber',
  'date',
  'customerOrSupplier',
  'type',
  'totalRefund',
  'reason',
  'actions'
];

// 4. Customers Columns Definition
export const CUSTOMERS_COLUMNS: ColumnDefinition[] = [
  { key: 'id', label: 'رقم المعرف' },
  { key: 'name', label: 'الاسم الكامل' },
  { key: 'phone', label: 'رقم الهاتف' },
  { key: 'address', label: 'العنوان' },
  { key: 'email', label: 'البريد الإلكتروني' },
  { key: 'openingBalance', label: 'الرصيد الافتتاحي' },
  { key: 'currentBalance', label: 'الرصيد الحالي المستحق' },
  { key: 'createdAt', label: 'تاريخ التسجيل' },
  { key: 'notes', label: 'ملاحظات' },
  { key: 'actions', label: 'الإجراءات' }
];

export const CUSTOMERS_DEFAULT_VISIBLE = [
  'id',
  'name',
  'phone',
  'currentBalance',
  'notes',
  'actions'
];

// 5. Suppliers Columns Definition
export const SUPPLIERS_COLUMNS: ColumnDefinition[] = [
  { key: 'id', label: 'رقم المعرف' },
  { key: 'name', label: 'الاسم / الشركة الموردة' },
  { key: 'contactPerson', label: 'اسم المسؤول' },
  { key: 'phone', label: 'رقم الهاتف' },
  { key: 'address', label: 'العنوان' },
  { key: 'email', label: 'البريد الإلكتروني' },
  { key: 'openingBalance', label: 'الرصيد الافتتاحي' },
  { key: 'currentBalance', label: 'الرصيد دائن/مدين' },
  { key: 'createdAt', label: 'تاريخ التسجيل' },
  { key: 'actions', label: 'الإجراءات' }
];

export const SUPPLIERS_DEFAULT_VISIBLE = [
  'id',
  'name',
  'contactPerson',
  'phone',
  'currentBalance',
  'actions'
];

// 6. Products & Inventory Columns Definition
export const PRODUCTS_COLUMNS: ColumnDefinition[] = [
  { key: 'sku', label: 'الباركود / SKU' },
  { key: 'name', label: 'اسم المنتج' },
  { key: 'category', label: 'القسم / الفئة' },
  { key: 'cost', label: 'سعر الشراء (التكلفة)' },
  { key: 'price', label: 'سعر بيع التجزئة' },
  { key: 'wholesalePrice', label: 'سعر بيع الجملة' },
  { key: 'stock', label: 'الكمية المتاحة' },
  { key: 'minStock', label: 'الحد الأدنى للطلب' },
  { key: 'unit', label: 'الوحدة' },
  { key: 'totalCostValue', label: 'إجمالي قيمة التكلفة' },
  { key: 'totalSaleValue', label: 'إجمالي قيمة البيع' },
  { key: 'status', label: 'حالة التوفر' },
  { key: 'actions', label: 'الإجراءات' }
];

export const PRODUCTS_DEFAULT_VISIBLE = [
  'sku',
  'name',
  'category',
  'cost',
  'price',
  'stock',
  'unit',
  'status',
  'actions'
];

// 7. Expenses Columns Definition
export const EXPENSES_COLUMNS: ColumnDefinition[] = [
  { key: 'id', label: 'رقم السند' },
  { key: 'title', label: 'بيان الصرف / العنوان' },
  { key: 'amount', label: 'المبلغ المصروف' },
  { key: 'category', label: 'تصنيف المصروف' },
  { key: 'paymentMethod', label: 'طريقة الدفع' },
  { key: 'notes', label: 'الملاحظات الإضافية' },
  { key: 'createdBy', label: 'المستخدم الصارف' },
  { key: 'createdAt', label: 'التاريخ والوقت' },
  { key: 'actions', label: 'الإجراءات' }
];

export const EXPENSES_DEFAULT_VISIBLE = [
  'id',
  'title',
  'amount',
  'category',
  'notes',
  'createdAt',
  'actions'
];

// 8. Shifts / Cashier Sessions Columns Definition
export const SHIFTS_COLUMNS: ColumnDefinition[] = [
  { key: 'id', label: 'رقم الوردية' },
  { key: 'cashierName', label: 'اسم الكاشير' },
  { key: 'openedAt', label: 'وقت الفتح' },
  { key: 'closedAt', label: 'وقت الإغلاق' },
  { key: 'openingBalance', label: 'العهدة الافتتاحية' },
  { key: 'totalSales', label: 'إجمالي المبيعات' },
  { key: 'totalCash', label: 'المبيعات النقدية' },
  { key: 'totalCard', label: 'المبيعات بالبطاقات' },
  { key: 'totalExpenses', label: 'مصروفات الوردية' },
  { key: 'closingBalance', label: 'المسجل عند الإغلاق' },
  { key: 'difference', label: 'العجز / الزيادة' },
  { key: 'status', label: 'حالة الوردية' },
  { key: 'actions', label: 'الإجراءات' }
];

export const SHIFTS_DEFAULT_VISIBLE = [
  'id',
  'cashierName',
  'openedAt',
  'closedAt',
  'totalSales',
  'closingBalance',
  'difference',
  'status',
  'actions'
];

// 9. Customer / Supplier Statement Columns Definition
export const STATEMENT_COLUMNS: ColumnDefinition[] = [
  { key: 'documentNumber', label: 'رقم المستند / الحركة' },
  { key: 'date', label: 'التاريخ والوقت' },
  { key: 'type', label: 'نوع المعاملة' },
  { key: 'notes', label: 'بيان المعاملة بالتفصيل' },
  { key: 'debit', label: 'مدين (+ / -)' },
  { key: 'credit', label: 'دائن (+ / -)' },
  { key: 'runningBalance', label: 'الرصيد المتسلسل' },
  { key: 'cashier', label: 'الموظف المسجل' },
  { key: 'actions', label: 'تفاصيل الأصناف' }
];

export const STATEMENT_DEFAULT_VISIBLE = [
  'documentNumber',
  'date',
  'notes',
  'debit',
  'credit',
  'runningBalance',
  'actions'
];

// 10. Inventory Movements Columns Definition
export const INVENTORY_MOVEMENTS_COLUMNS: ColumnDefinition[] = [
  { key: 'id', label: 'رقم الحركة' },
  { key: 'date', label: 'التاريخ والوقت' },
  { key: 'productName', label: 'اسم الصنف' },
  { key: 'sku', label: 'الباركود' },
  { key: 'movementType', label: 'نوع الحركة' },
  { key: 'quantity', label: 'الكمية' },
  { key: 'unitPrice', label: 'سعر الوحدة' },
  { key: 'referenceNumber', label: 'رقم المرجع' },
  { key: 'createdBy', label: 'المستخدم' },
  { key: 'notes', label: 'ملاحظات' }
];

export const INVENTORY_MOVEMENTS_DEFAULT_VISIBLE = [
  'id',
  'date',
  'productName',
  'sku',
  'movementType',
  'quantity',
  'referenceNumber',
  'createdBy'
];
