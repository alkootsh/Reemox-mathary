export interface Coupon {
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  description: string;
  minSubtotal?: number;
}

export const PREDEFINED_COUPONS: Coupon[] = [
  { code: 'VIP10', type: 'percentage', value: 10, description: 'خصم 10% لعملاء VIP المميزين' },
  { code: 'DISCOUNT20', type: 'percentage', value: 20, description: 'خصم 20% لفترة محدودة' },
  { code: 'SAVE50', type: 'fixed', value: 50, description: 'خصم 50 ج.م على المشتريات', minSubtotal: 200 },
  { code: 'PROMO15', type: 'percentage', value: 15, description: 'كوبون ترويجي 15%' },
  { code: 'WELCOME', type: 'percentage', value: 10, description: 'خصم ترحيبي 10%' },
  { code: 'RAMADAN', type: 'percentage', value: 25, description: 'عروض رمضان 25%' },
  { code: 'EID', type: 'percentage', value: 15, description: 'خصم العيد 15%' }
];

export function validateCoupon(code: string, subtotal: number): { isValid: boolean; coupon?: Coupon; message: string } {
  if (!code || !code.trim()) {
    return { isValid: false, message: 'يرجى إدخال كود الكوبون' };
  }

  const cleanCode = code.trim().toUpperCase();
  const matched = PREDEFINED_COUPONS.find(c => c.code.toUpperCase() === cleanCode);

  if (!matched) {
    // If it's a dynamic percentage like OFF10 or OFF20
    const matchPercent = cleanCode.match(/^OFF(\d{1,2})$/);
    if (matchPercent) {
      const val = parseInt(matchPercent[1], 10);
      if (val > 0 && val <= 90) {
        return {
          isValid: true,
          coupon: {
            code: cleanCode,
            type: 'percentage',
            value: val,
            description: `خصم ${val}% فوري`
          },
          message: `تم تطبيق خصم ${val}% بنجاح! 🏷️`
        };
      }
    }

    return { isValid: false, message: `كود الخصم (${cleanCode}) غير صحيح أو منتهي الصلاحية` };
  }

  if (matched.minSubtotal && subtotal < matched.minSubtotal) {
    return {
      isValid: false,
      message: `يتطلب هذا الكوبون حداً أدنى للمشتريات بقيمة ${matched.minSubtotal} ج.م (الإجمالي الحالي ${subtotal} ج.م)`
    };
  }

  return {
    isValid: true,
    coupon: matched,
    message: `✅ تم تطبيق الكوبون (${matched.code}): ${matched.description}`
  };
}
