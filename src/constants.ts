import { Product } from './types/types';

export const MOCK_PRODUCTS: Product[] = [
  { id: '1', name: 'لابتوب ديل', sku: 'LAP001', price: 15000, cost: 12000, quantity: 10, category: 'إلكترونيات', colors: ['أسود', 'فضي'], image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300' },
  { id: '2', name: 'ماوس لاسلكي', sku: 'MOU001', price: 250, cost: 150, quantity: 2, category: 'إلكترونيات', image: 'https://images.unsplash.com/photo-1527814050087-379f807833a4?w=300' }, 
  { id: '3', name: 'تيشيرت قطن', sku: 'CLO001', price: 200, cost: 100, quantity: 15, category: 'ملابس', colors: ['أبيض', 'أسود'], sizes: ['S', 'M', 'L'], image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300' },
  { id: '4', name: 'حذاء رياضي', sku: 'SHO001', price: 500, cost: 300, quantity: 5, category: 'ملابس', colors: ['أزرق'], sizes: ['40', '42'], image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300' },
  { id: '5', name: 'أرز بسمتي', sku: 'GRO001', price: 50, cost: 30, quantity: 50, category: 'بقالة', units: ['كيلو', 'كيس 5 كيلو'], image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300' },
  { id: '6', name: 'سكر أبيض', sku: 'GRO002', price: 20, cost: 10, quantity: 100, category: 'بقالة', units: ['كيلو', 'كرتونة'], image: 'https://images.unsplash.com/photo-1582236378418-4e8932fc932f?w=300' },
];
