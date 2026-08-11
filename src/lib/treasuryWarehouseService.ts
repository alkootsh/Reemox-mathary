export interface Treasury {
  id: string;
  name: string;
  type: 'main' | 'wholesale' | 'retail' | 'sub';
  notes?: string;
  openingBalance?: number;
}

export interface Warehouse {
  id: string;
  name: string;
  location?: string;
  notes?: string;
}

const DEFAULT_TREASURIES: Treasury[] = [
  { id: 'treasury-main', name: 'الخزنة الرئيسية (العامة)', type: 'main', notes: 'الخزنة المالية المركزية للنظام' },
  { id: 'treasury-wholesale', name: 'خزنة الجملة', type: 'wholesale', notes: 'خزنة تحصيل مبيعات الجملة والكاشير' },
  { id: 'treasury-retail', name: 'خزنة المحل (القطاعي)', type: 'retail', notes: 'خزنة تحصيل الدرج اليومي للمحل' },
];

const DEFAULT_WAREHOUSES: Warehouse[] = [
  { id: 'wh-main', name: 'المخزن الرئيسي', location: 'المبنى الرئيسي', notes: 'المخزن الرئيسي المعتمد' },
  { id: 'wh-wholesale', name: 'مخزن الجملة', location: 'قسم الجملة', notes: 'مخزن بضاعة واختزانات الجملة' },
  { id: 'wh-retail', name: 'مخزن المحل / المعرض', location: 'المعرض التجاري', notes: 'مخزن العرض المباشر والقطاعي' },
];

const TREASURIES_STORAGE_KEY = 'maro_treasuries_list';
const WAREHOUSES_STORAGE_KEY = 'maro_warehouses_list';

export function getTreasuries(): Treasury[] {
  try {
    const raw = localStorage.getItem(TREASURIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error reading treasuries:', e);
  }
  // Initialize defaults
  localStorage.setItem(TREASURIES_STORAGE_KEY, JSON.stringify(DEFAULT_TREASURIES));
  return DEFAULT_TREASURIES;
}

export function saveTreasury(treasury: Partial<Treasury>): Treasury[] {
  const current = getTreasuries();
  let updated: Treasury[];

  if (treasury.id) {
    updated = current.map(t => t.id === treasury.id ? { ...t, ...treasury } as Treasury : t);
  } else {
    const newT: Treasury = {
      id: `treasury_${Date.now()}`,
      name: treasury.name || 'خزنة جديدة',
      type: treasury.type || 'sub',
      notes: treasury.notes || '',
      openingBalance: treasury.openingBalance || 0
    };
    updated = [...current, newT];
  }

  localStorage.setItem(TREASURIES_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteTreasury(id: string): Treasury[] {
  const current = getTreasuries();
  if (current.length <= 1) {
    throw new Error('لا يمكن حذف جميع الخزن. يجب الإبقاء على خزنة واحدة على الأقل بالنظام.');
  }
  const updated = current.filter(t => t.id !== id);
  localStorage.setItem(TREASURIES_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function getWarehouses(): Warehouse[] {
  try {
    const raw = localStorage.getItem(WAREHOUSES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error('Error reading warehouses:', e);
  }
  // Initialize defaults
  localStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(DEFAULT_WAREHOUSES));
  return DEFAULT_WAREHOUSES;
}

export function saveWarehouse(warehouse: Partial<Warehouse>): Warehouse[] {
  const current = getWarehouses();
  let updated: Warehouse[];

  if (warehouse.id) {
    updated = current.map(w => w.id === warehouse.id ? { ...w, ...warehouse } as Warehouse : w);
  } else {
    const newW: Warehouse = {
      id: `wh_${Date.now()}`,
      name: warehouse.name || 'مخزن جديد',
      location: warehouse.location || '',
      notes: warehouse.notes || ''
    };
    updated = [...current, newW];
  }

  localStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteWarehouse(id: string): Warehouse[] {
  const current = getWarehouses();
  if (current.length <= 1) {
    throw new Error('لا يمكن حذف جميع المخازن. يجب الإبقاء على مخزن واحد على الأقل بالنظام.');
  }
  const updated = current.filter(w => w.id !== id);
  localStorage.setItem(WAREHOUSES_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
