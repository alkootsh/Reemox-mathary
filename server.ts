import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from 'nodemailer';
import twilio from "twilio";

// Load environment variables
import "dotenv/config";

// WhatsApp Twilio Client Cache
let twilioClientCache: twilio.Twilio | null = null;

function getTwilioClient(): { client: twilio.Twilio | null; error?: string } {
    if (twilioClientCache) return { client: twilioClientCache };
    const accountSid = process.env.TWILIO_ACCOUNT_SID ? process.env.TWILIO_ACCOUNT_SID.trim() : '';
    const authToken = process.env.TWILIO_AUTH_TOKEN ? process.env.TWILIO_AUTH_TOKEN.trim() : '';

    if (!accountSid || !authToken) {
        return { client: null, error: "بيانات Twilio غير مضبوطة (TWILIO_ACCOUNT_SID أو TWILIO_AUTH_TOKEN مفقودة)" };
    }

    if (!accountSid.startsWith('AC')) {
        return { client: null, error: `معرف الحساب TWILIO_ACCOUNT_SID غير صحيح، يجب أن يبدأ بـ 'AC'. الحالي: ${accountSid.substring(0, 4)}...` };
    }

    try {
        twilioClientCache = twilio(accountSid, authToken);
        return { client: twilioClientCache };
    } catch (error: any) {
        return { client: null, error: `فشل تهيئة عميل Twilio: ${error?.message || error}` };
    }
}

/**
 * Format international phone number for WhatsApp
 */
function cleanPhoneNumber(phone: string): string {
    if (!phone) return '';
    let cleaned = phone.trim().replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
    if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
    // If starts with 0 and no country prefix, default to 20 for Egypt or keep as is
    if (cleaned.startsWith('0') && cleaned.length === 11) {
        cleaned = '2' + cleaned;
    }
    return cleaned;
}

async function sendWhatsAppNotification(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { client, error } = getTwilioClient();
    if (!client) {
        return { success: false, error: error || "Twilio client not initialized" };
    }

    const fromNumber = process.env.TWILIO_PHONE_NUMBER ? process.env.TWILIO_PHONE_NUMBER.trim() : '';
    if (!fromNumber) {
        return { success: false, error: "رقم هاتف Twilio المرسل (TWILIO_PHONE_NUMBER) غير محدد في متغيرات البيئة" };
    }

    const target = cleanPhoneNumber(to || process.env.ADMIN_WHATSAPP_NUMBER || '');
    if (!target) {
        return { success: false, error: "رقم هاتف المدير المستلم غير محدد" };
    }

    try {
        const cleanFrom = fromNumber.replace(/^whatsapp:/, '').replace(/^\+/, '');
        const msg = await client.messages.create({
            body: message,
            from: `whatsapp:+${cleanFrom}`,
            to: `whatsapp:+${target}`,
        });
        console.log(`[WhatsApp Success] Sent message to +${target}, SID: ${msg.sid}`);
        return { success: true, messageId: msg.sid };
    } catch (err: any) {
        console.error("[WhatsApp Error]", err?.message || err);
        return { success: false, error: err?.message || "خطأ أثناء إرسال رسالة واتساب عبر Twilio" };
    }
}

async function sendEmailNotification(to: string, subject: string, message: string, html?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = parseInt(process.env.SMTP_PORT || '587');

    if (!host || !user || !pass) {
        return { success: false, error: "إعدادات SMTP غير مكتملة في متغيرات البيئة (SMTP_HOST أو SMTP_USER أو SMTP_PASS مفقودة)" };
    }

    const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });

    const defaultHtml = `
      <div dir="rtl" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; padding: 24px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 24px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <div style="text-align: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="color: #0f172a; margin: 0; font-size: 20px;">🔔 إشعار من نظام إدارة المبيعات والمخزون</h2>
          </div>
          <div style="font-size: 15px; line-height: 1.8; white-space: pre-line; color: #334155;">
            ${message}
          </div>
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8;">
            تم إرسال هذا التنبيه آلياً بواسطة نظام المحاسبة ونقاط البيع • ${new Date().toLocaleString('ar-EG')}
          </div>
        </div>
      </div>
    `;

    try {
        const info = await transporter.sendMail({
            from: `"نظام إدارة المخزون" <${user}>`,
            to,
            subject: subject || 'تنبيه من نظام المخزون والمبيعات',
            text: message,
            html: html || defaultHtml,
        });
        console.log(`[Email Success] Sent email to ${to}, ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (err: any) {
        console.error("[Email Error]", err?.message || err);
        return { success: false, error: err?.message || "خطأ أثناء إرسال البريد الإلكتروني عبر خادم SMTP" };
    }
}

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(express.json());

    // Status & Diagnostics Endpoint
    app.get("/api/notifications/status", (req, res) => {
        const hasTwilioSid = Boolean(process.env.TWILIO_ACCOUNT_SID?.trim());
        const hasTwilioToken = Boolean(process.env.TWILIO_AUTH_TOKEN?.trim());
        const hasTwilioPhone = Boolean(process.env.TWILIO_PHONE_NUMBER?.trim());
        const hasAdminPhone = Boolean(process.env.ADMIN_WHATSAPP_NUMBER?.trim());

        const hasSmtpHost = Boolean(process.env.SMTP_HOST?.trim());
        const hasSmtpUser = Boolean(process.env.SMTP_USER?.trim());
        const hasSmtpPass = Boolean(process.env.SMTP_PASS?.trim());

        res.json({
            twilio: {
                configured: hasTwilioSid && hasTwilioToken && hasTwilioPhone,
                hasSid: hasTwilioSid,
                hasToken: hasTwilioToken,
                hasFromPhone: hasTwilioPhone,
                hasAdminPhone: hasAdminPhone,
                fromPhone: hasTwilioPhone ? process.env.TWILIO_PHONE_NUMBER : undefined,
                adminPhone: hasAdminPhone ? process.env.ADMIN_WHATSAPP_NUMBER : undefined,
            },
            smtp: {
                configured: hasSmtpHost && hasSmtpUser && hasSmtpPass,
                host: process.env.SMTP_HOST || undefined,
                port: process.env.SMTP_PORT || '587',
                user: process.env.SMTP_USER ? (process.env.SMTP_USER.substring(0, 3) + '***@' + (process.env.SMTP_USER.split('@')[1] || '')) : undefined,
            },
            directWhatsAppAlwaysAvailable: true,
            serverTime: new Date().toISOString()
        });
    });

    // Notify WhatsApp API
    app.post("/api/notify-whatsapp", async (req, res) => {
        const { phone, message, subject } = req.body;
        const targetPhone = phone || process.env.ADMIN_WHATSAPP_NUMBER;
        
        if (!message) {
            return res.status(400).json({ success: false, reason: "نص الرسالة مطلوب" });
        }

        const result = await sendWhatsAppNotification(targetPhone, message);
        res.json({
            success: result.success,
            reason: result.error,
            messageId: result.messageId,
            targetPhone: targetPhone
        });
    });

    // Notify Email API
    app.post("/api/notify-email", async (req, res) => {
        const { to, subject, message, html, productName, quantity } = req.body;
        const recipient = to || process.env.SMTP_USER;

        if (!recipient) {
            return res.status(400).json({ success: false, reason: "البريد الإلكتروني للمستلم مطلوب" });
        }

        const emailSubject = subject || (productName ? `تنبيه مخزون منخفض: ${productName}` : 'تنبيه من نظام إدارة المبيعات');
        const emailMessage = message || (productName ? `تنبيه: كمية المنتج ${productName} انخفضت إلى ${quantity || 0}. يرجى إعادة الطلب فوراً.` : 'إشعار جديد من النظام.');

        const result = await sendEmailNotification(recipient, emailSubject, emailMessage, html);
        res.json({
            success: result.success,
            reason: result.error,
            messageId: result.messageId,
            recipient: recipient
        });
    });

    // Unified Notify Inventory API (Both WhatsApp & Email)
    app.post("/api/notify-inventory", async (req, res) => {
        const { productName, quantity, threshold, managerPhone, managerEmail, customMessage, businessName } = req.body;
        const storeName = businessName || 'المتجر';
        
        const defaultMsg = customMessage || `🚨 *تنبيه نقص مخزون حرج*
🏪 *المنشأة:* ${storeName}
⚠️ *الصنف:* ${productName}
📦 *الرصيد المتبقي:* ${quantity} قطعة
🛑 *حد الطلب الأدنى:* ${threshold ?? 5} قطعة
💡 يرجى إعادة طلب وتوريد الصنف لتعويض النواقص.`;

        const targetPhone = managerPhone || process.env.ADMIN_WHATSAPP_NUMBER;
        const targetEmail = managerEmail;

        let whatsappResult: { success: boolean; error?: string; messageId?: string } = { success: false, error: 'لم يتم تحديد رقم واتساب' };
        if (targetPhone) {
            whatsappResult = await sendWhatsAppNotification(targetPhone, defaultMsg);
        }

        let emailResult: { success: boolean; error?: string; messageId?: string } = { success: false, error: 'لم يتم تحديد بريد إلكتروني' };
        if (targetEmail) {
            emailResult = await sendEmailNotification(
                targetEmail,
                `🚨 تنبيه نقص مخزون: ${productName}`,
                defaultMsg
            );
        }

        res.json({
            success: whatsappResult.success || emailResult.success,
            whatsapp: {
                sent: whatsappResult.success,
                reason: whatsappResult.error,
                target: targetPhone
            },
            email: {
                sent: emailResult.success,
                reason: emailResult.error,
                target: targetEmail
            }
        });
    });

    // Test Notification Endpoint
    app.post("/api/notifications/test", async (req, res) => {
        const { type, target, message } = req.body;
        const testMsg = message || `🧪 *رسالة اختبار تجريبية*
✅ نظام إشعارات المبيعات والمخزون يعمل بنجاح!
📅 التاريخ: ${new Date().toLocaleDateString('ar-EG')}
⏰ الوقت: ${new Date().toLocaleTimeString('ar-EG')}`;

        if (type === 'whatsapp') {
            const result = await sendWhatsAppNotification(target, testMsg);
            return res.json({
                type: 'whatsapp',
                success: result.success,
                reason: result.error,
                messageId: result.messageId
            });
        } else if (type === 'email') {
            const result = await sendEmailNotification(target, '🧪 بريد إلكتروني تجريبي من نظام المبيعات', testMsg);
            return res.json({
                type: 'email',
                success: result.success,
                reason: result.error,
                messageId: result.messageId
            });
        }

        res.status(400).json({ success: false, reason: "النوع غير مدعوم (يجب أن يكون 'whatsapp' أو 'email')" });
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
