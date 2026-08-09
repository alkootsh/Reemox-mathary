/**
 * Unified Notifications & Manager Alerts Service (WhatsApp & Email)
 * 
 * Supports:
 * 1. Direct 1-Click WhatsApp (wa.me / WhatsApp Web / Desktop / Mobile) - 100% reliable, zero server setup needed.
 * 2. Server-side automatic WhatsApp via Twilio / API backend.
 * 3. Server-side Email via Nodemailer SMTP.
 */

export interface ManagerNotificationConfig {
  managerPhone: string;
  managerWhatsApp: string;
  countryCode: string;
  managerWhatsAppCountryCode: string;
  managerEmail: string;
  businessName: string;
  enableLowStockAlert: boolean;
  notifyLowStock: boolean;
  enableDailySummaryAlert: boolean;
  notifyDailySummary: boolean;
  enablePriceOverrideAlert: boolean;
  notifyPriceOverride: boolean;
  enablePurchaseAlert: boolean;
  notifyPurchase: boolean;
  preferredMethod: 'direct-whatsapp' | 'server' | 'both';
}

export const DEFAULT_NOTIFICATION_CONFIG: ManagerNotificationConfig = {
  managerPhone: '',
  managerWhatsApp: '',
  countryCode: '+20',
  managerWhatsAppCountryCode: '+20',
  managerEmail: '',
  businessName: 'نظام المبيعات والمخزون',
  enableLowStockAlert: true,
  notifyLowStock: true,
  enableDailySummaryAlert: true,
  notifyDailySummary: true,
  enablePriceOverrideAlert: true,
  notifyPriceOverride: true,
  enablePurchaseAlert: false,
  notifyPurchase: false,
  preferredMethod: 'both',
};

/**
 * Get saved notification configuration from LocalStorage
 */
export function getNotificationConfig(): ManagerNotificationConfig {
  try {
    const savedPhone = localStorage.getItem('managerWhatsApp') || localStorage.getItem('businessPhone') || '';
    const savedCode = localStorage.getItem('managerWhatsAppCountryCode') || '+20';
    const savedEmail = localStorage.getItem('managerEmail') || '';
    const savedBusiness = localStorage.getItem('businessName') || 'نظام المبيعات والمخزون';
    const savedLowStock = localStorage.getItem('notify_low_stock') !== 'false';
    const savedDailySummary = localStorage.getItem('notify_daily_summary') !== 'false';
    const savedPriceOverride = localStorage.getItem('notify_price_override') !== 'false';
    const savedPurchase = localStorage.getItem('notify_purchase') === 'true';
    const savedMethod = (localStorage.getItem('notify_preferred_method') as any) || 'both';

    return {
      managerPhone: savedPhone,
      managerWhatsApp: savedPhone,
      countryCode: savedCode,
      managerWhatsAppCountryCode: savedCode,
      managerEmail: savedEmail,
      businessName: savedBusiness,
      enableLowStockAlert: savedLowStock,
      notifyLowStock: savedLowStock,
      enableDailySummaryAlert: savedDailySummary,
      notifyDailySummary: savedDailySummary,
      enablePriceOverrideAlert: savedPriceOverride,
      notifyPriceOverride: savedPriceOverride,
      enablePurchaseAlert: savedPurchase,
      notifyPurchase: savedPurchase,
      preferredMethod: savedMethod,
    };
  } catch (e) {
    return DEFAULT_NOTIFICATION_CONFIG;
  }
}

/**
 * Format international phone number for WhatsApp
 * E.g. '01012345678' + '+20' => '201012345678'
 */
export function formatWhatsAppPhoneNumber(phone: string, defaultCountryCode: string = '+20'): string {
  if (!phone) return '';
  // Strip all non-digit characters except leading plus
  let cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
  
  if (cleaned.startsWith('+')) {
    return cleaned.replace('+', '');
  }

  const cleanPrefix = defaultCountryCode.replace('+', '');

  // If starts with 00 (e.g. 00201012345678)
  if (cleaned.startsWith('00')) {
    return cleaned.substring(2);
  }

  // If starts with 0 (e.g. 01012345678 in Egypt)
  if (cleaned.startsWith('0')) {
    return cleanPrefix + cleaned.substring(1);
  }

  // If already starts with country code without plus (e.g. 2010... or 9665...)
  if (cleaned.startsWith(cleanPrefix)) {
    return cleaned;
  }

  return cleanPrefix + cleaned;
}

/**
 * Generate Direct WhatsApp Link for 1-click messaging
 */
export function getDirectWhatsAppUrl(phone: string, message: string, countryCode: string = '+20'): string {
  const formattedPhone = formatWhatsAppPhoneNumber(phone, countryCode);
  const encodedText = encodeURIComponent(message);
  if (formattedPhone) {
    return `https://wa.me/${formattedPhone}?text=${encodedText}`;
  }
  // Fallback to generic share url if no phone number specified
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Open Direct WhatsApp Chat in a new window/tab
 */
export function openDirectWhatsAppChat(phone: string, message: string, countryCode: string = '+20'): Window | null {
  const url = getDirectWhatsAppUrl(phone, message, countryCode);
  return window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Build Formatted Arabic Low Stock Alert Message
 */
export function buildLowStockMessage(data: {
  productName: string;
  currentQuantity: number;
  threshold: number;
  unitCost?: number;
  price?: number;
  sku?: string;
  businessName?: string;
}): string {
  const storeName = data.businessName || localStorage.getItem('businessName') || 'نظام إدارة المخزون والمبيعات';
  const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const date = new Date().toLocaleDateString('ar-EG');

  return `🚨 *تنبيه نقص مخزون حرج*
🏪 *المنشأة:* ${storeName}
📅 *الوقت:* ${date} - ${time}

⚠️ *الصنف:* ${data.productName}
${data.sku ? `🏷️ *الباركود / الكود:* ${data.sku}\n` : ''}📦 *الرصيد المتبقي الحالى:* ${data.currentQuantity} قطعة
🛑 *حد الطلب الأدنى:* ${data.threshold} قطعة
${data.unitCost ? `💵 *سعر التكلفة التقريبي:* ${data.unitCost} ج.م\n` : ''}${data.price ? `🏷️ *سعر البيع:* ${data.price} ج.م\n` : ''}
💡 *الإجراء المطلوب:* يرجى التواصل مع المورد وإصدار أمر شراء لتعويض النواقص فوراً.`;
}

/**
 * Build Formatted Arabic Bulk Low Stock Summary Message
 */
export function buildBulkLowStockMessage(products: any[], businessName?: string): string {
  const storeName = businessName || localStorage.getItem('businessName') || 'نظام إدارة المخزون والمبيعات';
  const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  const date = new Date().toLocaleDateString('ar-EG');

  let itemsList = '';
  products.forEach((p, idx) => {
    const qty = p.quantity || 0;
    const threshold = p.lowStockThreshold ?? 5;
    const status = qty <= 0 ? '🔴 نفد تماماً (0)' : `🟡 رصيد حرج (${qty})`;
    itemsList += `${idx + 1}. *${p.name}* [${status} - حد الطلب: ${threshold}]\n`;
  });

  return `🚨 *تقرير النواقص والأصناف الحرجة بالمخزون*
🏪 *المنشأة:* ${storeName}
📅 *التاريخ:* ${date} (${time})
📦 *إجمالي الأصناف التي تحتاج إعادة توريد:* ${products.length} صنف

📋 *قائمة الأصناف:*
${itemsList}
💡 *ملاحظة:* يرجى مراجعة الموردين واعتماد أوامر التوريد لضمان استمرار المبيعات.`;
}

/**
 * Build Formatted Arabic Daily Sales & Shift Summary
 */
export function buildDailySalesSummaryMessage(data: {
  businessName?: string;
  dateStr?: string;
  totalSales: number;
  invoicesCount: number;
  cashTotal: number;
  cardTotal: number;
  deferredTotal: number;
  netProfit?: number;
  cashierName?: string;
}): string {
  const storeName = data.businessName || localStorage.getItem('businessName') || 'نظام إدارة المبيعات';
  const date = data.dateStr || new Date().toLocaleDateString('ar-EG');
  const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  return `📊 *تقرير ملخص المبيعات والوردية*
🏪 *المنشأة:* ${storeName}
📅 *التاريخ:* ${date} (${time})
${data.cashierName ? `👤 *الكاشير / المسؤول:* ${data.cashierName}\n` : ''}
🧾 *عدد الفواتير المنفذة:* ${data.invoicesCount} فاتورة
💰 *إجمالي الإيراد العام:* ${data.totalSales.toLocaleString('ar-EG')} ج.م

💵 *تفاصيل طرق الدفع:*
• النقدية (كاش): ${data.cashTotal.toLocaleString('ar-EG')} ج.م
• بطاقات ودفع إلكتروني (فيزا / فوري): ${data.cardTotal.toLocaleString('ar-EG')} ج.م
• آجل وذمم (عملاء): ${data.deferredTotal.toLocaleString('ar-EG')} ج.م
${data.netProfit !== undefined ? `\n📈 *صافي الأرباح التقديري:* ${data.netProfit.toLocaleString('ar-EG')} ج.م` : ''}

✅ تم إغلاق الوردية وحفظ كافة الحركات المحاسبية بنجاح.`;
}

/**
 * Build Formatted Arabic Price Override / Warning Alert
 */
export function buildPriceOverrideAlertMessage(data: {
  productName: string;
  originalPrice: number;
  newPrice: number;
  cost?: number;
  cashierName?: string;
  businessName?: string;
}): string {
  const storeName = data.businessName || localStorage.getItem('businessName') || 'نظام نقاط البيع';
  const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

  return `⚠️ *تنبيه: تعديل سعر بيع صنف*
🏪 *المنشأة:* ${storeName}
⏰ *الوقت:* ${time}
${data.cashierName ? `👤 *الكاشير:* ${data.cashierName}\n` : ''}
📦 *الصنف:* ${data.productName}
🏷️ *السعر الأصلي بالنظام:* ${data.originalPrice} ج.م
🔻 *السعر المعدل بالفاتورة:* ${data.newPrice} ج.م
${data.cost ? `💵 *سعر التكلفة:* ${data.cost} ج.م\n` : ''}
${data.cost && data.newPrice < data.cost ? `🚨 *تحذير:* تم البيع بأقل من سعر التكلفة بفارق ${(data.cost - data.newPrice)} ج.م!` : 'تم اعتماد السعر بواسطة صلاحية المشرف.'}`;
}

/**
 * Dispatch notification to Server (Twilio WhatsApp + Nodemailer Email)
 */
export async function sendServerNotification(payload: {
  phone?: string;
  email?: string;
  subject: string;
  message: string;
  productName?: string;
  quantity?: number;
}): Promise<{ success: boolean; whatsapp: boolean; email: boolean; message: string }> {
  let whatsappSent = false;
  let emailSent = false;
  let statusMessages: string[] = [];

  const config = getNotificationConfig();
  const targetPhone = payload.phone || config.managerPhone;
  const targetEmail = payload.email || config.managerEmail;

  // 1. Send WhatsApp via Server
  if (targetPhone) {
    try {
      const formattedPhone = formatWhatsAppPhoneNumber(targetPhone, config.countryCode);
      const res = await fetch('/api/notify-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formattedPhone,
          message: payload.message,
          subject: payload.subject,
        }),
      });
      const data = await res.json();
      if (data.success) {
        whatsappSent = true;
        statusMessages.push('تم إرسال واتساب عبر السيرفر بنجاح');
      } else {
        statusMessages.push(data.reason || 'تعذر الإرسال التلقائي عبر Twilio');
      }
    } catch (e) {
      console.warn('Server WhatsApp call failed:', e);
      statusMessages.push('فشل الاتصال بخادم واتساب');
    }
  }

  // 2. Send Email via Server
  if (targetEmail) {
    try {
      const res = await fetch('/api/notify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: targetEmail,
          subject: payload.subject,
          message: payload.message,
          productName: payload.productName,
          quantity: payload.quantity,
        }),
      });
      const data = await res.json();
      if (data.success) {
        emailSent = true;
        statusMessages.push('تم إرسال البريد الإلكتروني بنجاح');
      } else {
        statusMessages.push(data.reason || 'تعذر إرسال الإيميل');
      }
    } catch (e) {
      console.warn('Server Email call failed:', e);
      statusMessages.push('فشل الاتصال بخادم البريد');
    }
  }

  return {
    success: whatsappSent || emailSent,
    whatsapp: whatsappSent,
    email: emailSent,
    message: statusMessages.join(' | '),
  };
}

/**
 * High-level helper: Trigger Low Stock Alert across all channels
 */
export async function triggerLowStockAlert(product: {
  id?: string;
  name: string;
  quantity: number;
  lowStockThreshold?: number;
  cost?: number;
  price?: number;
  sku?: string;
}): Promise<{
  directWhatsAppUrl: string;
  serverResult?: { success: boolean; whatsapp: boolean; email: boolean; message: string };
}> {
  const config = getNotificationConfig();
  if (!config.enableLowStockAlert) {
    return { directWhatsAppUrl: '' };
  }

  const threshold = product.lowStockThreshold ?? 5;
  const message = buildLowStockMessage({
    productName: product.name,
    currentQuantity: product.quantity,
    threshold: threshold,
    unitCost: product.cost,
    price: product.price,
    sku: product.sku,
  });

  const directUrl = getDirectWhatsAppUrl(config.managerPhone, message, config.countryCode);

  let serverRes;
  if (config.managerPhone || config.managerEmail) {
    serverRes = await sendServerNotification({
      phone: config.managerPhone,
      email: config.managerEmail,
      subject: `🚨 تنبيه نقص مخزون: ${product.name}`,
      message: message,
      productName: product.name,
      quantity: product.quantity,
    });
  }

  // Trigger browser event so any active component can show quick-action banner
  window.dispatchEvent(
    new CustomEvent('managerAlertTriggered', {
      detail: {
        type: 'low-stock',
        title: `🚨 تنبيه نقص مخزون: ${product.name}`,
        message,
        directUrl,
        product,
      },
    })
  );

  return {
    directWhatsAppUrl: directUrl,
    serverResult: serverRes,
  };
}
