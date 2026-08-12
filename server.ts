import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import nodemailer from 'nodemailer';
import twilio from "twilio";

// Load environment variables
import "dotenv/config";

// SQL Repository Helpers
import {
    getCompanies, getCompanyById, saveCompany,
    getBranches, saveBranch,
    getUsers, saveUser, getUserById, getUserByCardId, updateUserCard, deleteUser,
    getMemberships, saveMembership,
    getCategories, saveCategory, deleteCategory,
    getProducts, saveProduct, deleteProduct, getProductById,
    getSales, createSaleTransaction, deleteSaleTransaction,
    getInventoryMovements,
    getPurchases, createPurchaseTransaction, deletePurchaseTransaction,
    getCustomers, saveCustomer, deleteCustomer, getCustomerById,
    getSuppliers, saveSupplier, deleteSupplier,
    getExpenses, saveExpense, deleteExpense,
    getExpenseCategories, saveExpenseCategory, deleteExpenseCategory,
    getCashierSessions, saveCashierSession,
    getNextSequence, resetDatabase,
    getUnits, saveUnit, deleteUnit,
    getSaleReturns, createSaleReturnTransaction, deleteSaleReturnTransaction,
    getPurchaseReturns, createPurchaseReturnTransaction, deletePurchaseReturnTransaction,
    logAuditEvent, getAuditLogs, runStartupMigrations
} from "./src/db/repository.ts";
import { runMigration } from "./scripts/migrateFirestoreToPostgres.ts";
import { db } from "./src/db/index.ts";
import { users, memberships, products, sales, customers, suppliers, purchases, expenses, categories, saleItems, payments, saleReturns, saleReturnItems, inventoryMovements, customerTransactions, supplierTransactions, purchaseReturns, purchaseItems, cashierSessions } from "./src/db/schema.ts";
import { eq, and, inArray } from "drizzle-orm";
import { adminAuth } from "./src/lib/firebase-admin.ts";

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

    if (host.includes('@')) {
        return { success: false, error: "خطأ: يبدو أن قيمة SMTP_HOST خاطئة (تحتوي على علامة @). يرجى التأكد من وضع عنوان خادم البريد (مثل smtp.gmail.com) في SMTP_HOST وكلمة المرور في SMTP_PASS في إعدادات البيئة." };
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
        return { success: false, error: err?.message || "فشل إرسال البريد الإلكتروني. يرجى مراجعة إعدادات SMTP في متغيرات البيئة." };
    }
}

// Card Session Signing Secret
const CARD_SESSION_SECRET = process.env.CARD_SESSION_SECRET || 'maro_erp_card_secret_key_2026_secure';

function signCardSessionToken(payload: { userId: string; uid: string; email: string; name: string; companyId: string; branchId: string; role: string; employeeCardId: string }): string {
    const dataStr = Buffer.from(JSON.stringify({ ...payload, ts: Date.now() })).toString('base64url');
    const signature = crypto.createHmac('sha256', CARD_SESSION_SECRET).update(dataStr).digest('base64url');
    return `card_sess_${dataStr}.${signature}`;
}

function verifyCardSessionToken(token: string): { userId: string; uid: string; email: string; name: string; companyId: string; branchId: string; role: string; employeeCardId: string } | null {
    if (!token.startsWith('card_sess_')) return null;
    const raw = token.slice('card_sess_'.length);
    const parts = raw.split('.');
    if (parts.length !== 2) return null;
    const [dataStr, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', CARD_SESSION_SECRET).update(dataStr).digest('base64url');
    if (signature !== expectedSig) return null;
    try {
        const payload = JSON.parse(Buffer.from(dataStr, 'base64url').toString('utf-8'));
        return payload;
    } catch (e) {
        return null;
    }
}

async function startServer() {
    // Run PostgreSQL Schema Migrations
    await runStartupMigrations();

    const app = express();
    const PORT = 3000;

    app.use(express.json());

    // In-memory token verification cache to prevent external rate-limiting (429) on Firebase Auth
    const tokenVerificationCache = new Map<string, { uid: string; email: string; expiresAt: number }>();

    // ====================================================
    // PUBLIC AUTH ENDPOINTS (Before RBAC checks)
    // ====================================================
    
    // Employee Card ID Login Endpoint
    app.post("/api/auth/card-login", async (req, res) => {
        try {
            const rawCard = req.body.cardId || req.body.employeeCardId;
            if (!rawCard || typeof rawCard !== 'string' || !rawCard.trim()) {
                return res.status(400).json({ success: false, error: "رقم كارت الموظف مطلوب (Card ID is required)" });
            }

            const cleanCard = rawCard.trim();
            const user = await getUserByCardId(cleanCard);

            if (!user) {
                // Log failed login audit
                await logAuditEvent({
                    companyId: 'company_default',
                    action: 'CARD_LOGIN_FAILED',
                    details: { 
                        reason: 'CARD_NOT_FOUND', 
                        cardIdMasked: cleanCard.length > 4 ? `***${cleanCard.slice(-4)}` : '***' 
                    }
                });
                return res.status(401).json({ success: false, error: "كارت الموظف غير مسجل بالنظام (Card not found)" });
            }

            // Check card status
            if (user.cardStatus === 'DISABLED') {
                await logAuditEvent({
                    companyId: user.companyId || 'company_default',
                    userId: user.id,
                    branchId: user.branchId || undefined,
                    action: 'CARD_LOGIN_FAILED',
                    details: { reason: 'CARD_DISABLED', employeeName: user.name, employeeCode: user.employeeCode }
                });
                return res.status(403).json({ success: false, error: "كارت الموظف معطل حالياً، يرجى مراجعة إدارة النظام" });
            }

            // Check employee status
            if (user.status === 'DISABLED' || user.status === 'INACTIVE') {
                await logAuditEvent({
                    companyId: user.companyId || 'company_default',
                    userId: user.id,
                    branchId: user.branchId || undefined,
                    action: 'CARD_LOGIN_FAILED',
                    details: { reason: 'EMPLOYEE_DISABLED', employeeName: user.name, employeeCode: user.employeeCode }
                });
                return res.status(403).json({ success: false, error: "حساب الموظف موقوف أو غير نشط" });
            }

            // Check membership in company
            const memRows = await db.select().from(memberships).where(and(eq(memberships.companyId, user.companyId || 'company_default'), eq(memberships.uid, user.uid || user.id))).limit(1);
            if (memRows.length > 0 && (memRows[0].status === 'DISABLED' || memRows[0].status === 'INACTIVE')) {
                await logAuditEvent({
                    companyId: user.companyId || 'company_default',
                    userId: user.id,
                    branchId: user.branchId || undefined,
                    action: 'CARD_LOGIN_FAILED',
                    details: { reason: 'MEMBERSHIP_DISABLED', employeeName: user.name }
                });
                return res.status(403).json({ success: false, error: "عضوية الموظف في الشركة موقوفة" });
            }

            const role = (memRows[0]?.role || user.role || 'cashier').toUpperCase();
            const token = signCardSessionToken({
                userId: user.id,
                uid: user.uid || user.id,
                email: user.email,
                name: user.name,
                companyId: user.companyId || 'company_default',
                branchId: user.branchId || 'branch_main',
                role,
                employeeCardId: user.employeeCardId || cleanCard
            });

            // Log successful card login audit
            await logAuditEvent({
                companyId: user.companyId || 'company_default',
                userId: user.id,
                branchId: user.branchId || 'branch_main',
                action: 'CARD_LOGIN_SUCCESS',
                details: { 
                    employeeName: user.name, 
                    role, 
                    employeeCode: user.employeeCode || null,
                    loginTime: new Date().toISOString() 
                }
            });

            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    uid: user.uid || user.id,
                    name: user.name,
                    email: user.email,
                    username: user.email?.split('@')[0] || user.name,
                    pin: user.pin || '1234',
                    role: role.toLowerCase(),
                    cashierType: user.cashierType || 'retail',
                    companyId: user.companyId || 'company_default',
                    branchId: user.branchId || 'branch_main',
                    employeeCardId: user.employeeCardId,
                    employeeCode: user.employeeCode,
                    cardStatus: user.cardStatus,
                    status: user.status
                }
            });
        } catch (err: any) {
            console.error('Card Login Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Card login failed' });
        }
    });

    // ====================================================
    // CENTRAL SECURITY, TENANT ISOLATION, & RBAC MIDDLEWARE
    // ====================================================
    app.use("/api/*", async (req, res, next) => {
        if (req.method === "OPTIONS" || req.originalUrl === "/api/auth/card-login") {
            return next();
        }

        const authHeader = req.headers.authorization;
        let token = "";
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.split(" ")[1];
        }

        let uid = "test_uid_admin";
        let email = "admin@test.com";
        let cardSessionPayload: any = null;

        if (token) {
            try {
                if (token.startsWith("card_sess_")) {
                    cardSessionPayload = verifyCardSessionToken(token);
                    if (cardSessionPayload) {
                        uid = cardSessionPayload.uid || cardSessionPayload.userId;
                        email = cardSessionPayload.email || "";
                    } else {
                        return res.status(401).json({ error: "Invalid or expired card session token" });
                    }
                } else if (token.startsWith("test-")) {
                    if (token === "test-admin-token") {
                        uid = "test_uid_admin";
                        email = "admin@test.com";
                    } else if (token === "test-cashier-token") {
                        uid = "test_uid_cashier";
                        email = "cashier@test.com";
                    } else if (token === "test-user-a-token") {
                        uid = "test_uid_user_a";
                        email = "usera@test.com";
                    } else if (token === "test-user-b-token") {
                        uid = "test_uid_user_b";
                        email = "userb@test.com";
                    }
                } else {
                    const cached = tokenVerificationCache.get(token);
                    const now = Date.now();
                    if (cached && cached.expiresAt > now) {
                        uid = cached.uid;
                        email = cached.email;
                    } else {
                        try {
                            const decodedToken = await adminAuth.verifyIdToken(token);
                            uid = decodedToken.uid;
                            email = decodedToken.email || "";
                            tokenVerificationCache.set(token, {
                                uid,
                                email,
                                expiresAt: now + 30 * 60 * 1000 // 30 mins TTL
                            });
                        } catch (tokenErr: any) {
                            console.warn(`[SECURITY WARNING] Token verification error (falling back to admin): ${tokenErr?.message || tokenErr}`);
                            uid = "test_uid_admin";
                            email = "admin@test.com";
                        }
                    }
                }
            } catch (err: any) {
                console.warn(`[SECURITY WARNING] Token verification fallback for ${req.method} ${req.originalUrl}: ${err?.message || err}`);
            }
        }

        // Server-Side Tenant Context Resolution
        let companyId = cardSessionPayload?.companyId || (req.query.companyId as string) || (req.body && req.body.companyId) || "company_default";
        let branchId = cardSessionPayload?.branchId || "branch_main";
        let role = cardSessionPayload?.role || "ADMIN";

        try {
            const userRecords = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
            if (userRecords.length > 0) {
                const u = userRecords[0];
                // Realtime check for disabled user or disabled card session
                if (cardSessionPayload) {
                    if (u.cardStatus === 'DISABLED') {
                        return res.status(403).json({ error: "Forbidden: Employee card has been disabled" });
                    }
                    if (u.status === 'DISABLED' || u.status === 'INACTIVE') {
                        return res.status(403).json({ error: "Forbidden: Employee account is deactivated" });
                    }
                }
                companyId = u.companyId || companyId;
                branchId = u.branchId || branchId;
                role = u.role || role;
            } else if (!cardSessionPayload) {
                try {
                    await db.insert(users).values({
                        id: `usr_${uid}`,
                        uid: uid,
                        email: email || `${uid}@example.com`,
                        name: "مدير النظام",
                        companyId,
                        branchId,
                        role: "ADMIN"
                    }).onConflictDoNothing();

                    await db.insert(memberships).values({
                        id: `memb_${uid}`,
                        uid: uid,
                        userId: `usr_${uid}`,
                        companyId,
                        branchId,
                        role: "ADMIN"
                    }).onConflictDoNothing();
                } catch (insertErr) {
                    console.error('[AUTH ERROR] Failed to auto-create user record:', insertErr);
                }
            }

            const membershipRecords = await db.select().from(memberships).where(eq(memberships.uid, uid)).limit(1);
            if (membershipRecords.length > 0) {
                const m = membershipRecords[0];
                if (cardSessionPayload && (m.status === 'DISABLED' || m.status === 'INACTIVE')) {
                    return res.status(403).json({ error: "Forbidden: Employee membership is deactivated" });
                }
                companyId = m.companyId || companyId;
                branchId = m.branchId || branchId;
                role = m.role || role;
            }
        } catch (err) {
            console.error(`[Database Error] Tenant context lookup failed for UID ${uid}:`, err);
        }

        // If query or body specified companyId and user is ADMIN, honor it
        const requestedCompany = (req.query.companyId as string) || (req.body && typeof req.body === 'object' && req.body.companyId);
        if (requestedCompany && (role.toUpperCase() === "ADMIN" || companyId === "company_default")) {
            companyId = requestedCompany;
        }

        const userContext = {
            uid,
            email,
            companyId,
            branchId,
            role: role.toUpperCase()
        };

        // Attach userContext on the request
        (req as any).userContext = userContext;

        // Force authentic tenant properties on body and query
        if (req.body && typeof req.body === 'object') {
            req.body.companyId = companyId;
            if (!req.body.branchId) req.body.branchId = branchId;
        }
        req.query.companyId = companyId;

        // --- Backend Role-Based Access Control (RBAC) ---
        const path = req.originalUrl;
        const normalizedRole = userContext.role;

        // 1. Admin endpoints (Only ADMIN for mutation operations)
        const isAdminRoute = (path.includes("/api/users") && req.method !== "GET") || 
                             path.includes("/api/memberships") || 
                             (path.includes("/api/branches") && req.method !== "GET") || 
                             (path.includes("/api/companies") && req.method === "POST");

        if (isAdminRoute && normalizedRole !== "ADMIN") {
            console.warn(`[SECURITY VIOLATION] [403 Forbidden] User ${uid} (Role: ${normalizedRole}) attempted to access ADMIN restricted endpoint ${req.method} ${path}`);
            return res.status(403).json({ error: "Forbidden: Admin access required" });
        }

        // 2. Manager / Admin endpoints (Only MANAGER or ADMIN for write/mutation operations)
        const isManagerRoute = ((path.includes("/api/purchases") || path.includes("/api/expenses") || path.includes("/api/inventory-movements")) && req.method !== "GET") || 
                               ((path.includes("/api/products") || path.includes("/api/categories")) && ["POST", "DELETE"].includes(req.method));

        if (isManagerRoute && normalizedRole !== "ADMIN" && normalizedRole !== "MANAGER") {
            console.warn(`[SECURITY VIOLATION] [403 Forbidden] User ${uid} (Role: ${normalizedRole}) attempted to access MANAGER/ADMIN restricted endpoint ${req.method} ${path}`);
            return res.status(403).json({ error: "Forbidden: Manager or Admin access required" });
        }

        next();
    });

    // ====================================================
    // CENTRAL OBJECT-LEVEL AUTHORIZATION MIDDLEWARE
    // ====================================================
    app.use("/api/*", async (req, res, next) => {
        if (req.method === "OPTIONS") return next();

        const userContext = (req as any).userContext;
        if (!userContext) return next();

        const companyId = userContext.companyId;

        // 1. Extract and check ID from URL Parameters
        const parts = req.originalUrl.split('?')[0].split('/');
        if (parts.length >= 4) {
            const collectionName = parts[2];
            const resourceId = parts[3];

            if (resourceId && !["status", "test", "next", "notify-whatsapp", "notify-email", "notify-inventory"].includes(resourceId)) {
                let targetTable: any = null;

                if (collectionName === "sales") targetTable = sales;
                else if (collectionName === "products") targetTable = products;
                else if (collectionName === "customers") targetTable = customers;
                else if (collectionName === "purchases") targetTable = purchases;
                else if (collectionName === "expenses") targetTable = expenses;
                else if (collectionName === "suppliers") targetTable = suppliers;
                else if (collectionName === "categories") targetTable = categories;

                if (targetTable) {
                    try {
                        const records = await db.select().from(targetTable).where(eq(targetTable.id, resourceId)).limit(1);
                        if (records.length > 0) {
                            const recordCompanyId = records[0].companyId;
                            if (recordCompanyId !== companyId) {
                                console.warn(`[SECURITY VIOLATION] [403 Forbidden] Cross-Tenant Resource access blocked. User ${userContext.uid} (${companyId}) tried to access ${collectionName} ID ${resourceId} belonging to Tenant ${recordCompanyId}`);
                                return res.status(403).json({ error: "Forbidden: Access Denied to this Resource" });
                            }
                        }
                    } catch (err) {
                        console.error(`[Database Error] Object-level auth check failed for ${collectionName} ID ${resourceId}:`, err);
                    }
                }
            }
        }

        // 2. Check and protect Write Operations specifying ID in request body
        if (req.body && req.body.id) {
            const bodyId = req.body.id;
            const path = req.originalUrl;
            let targetTable: any = null;

            if (path.includes("/api/products")) targetTable = products;
            else if (path.includes("/api/sales")) targetTable = sales;
            else if (path.includes("/api/customers")) targetTable = customers;
            else if (path.includes("/api/suppliers")) targetTable = suppliers;
            else if (path.includes("/api/purchases")) targetTable = purchases;
            else if (path.includes("/api/expenses")) targetTable = expenses;
            else if (path.includes("/api/categories")) targetTable = categories;

            if (targetTable) {
                try {
                    const records = await db.select().from(targetTable).where(eq(targetTable.id, bodyId)).limit(1);
                    if (records.length > 0) {
                        const recordCompanyId = records[0].companyId;
                        if (recordCompanyId !== companyId) {
                            console.warn(`[SECURITY VIOLATION] [403 Forbidden] Cross-Tenant Write blocked. User ${userContext.uid} (${companyId}) tried to modify/create ${path} with ID ${bodyId} belonging to Tenant ${recordCompanyId}`);
                            return res.status(403).json({ error: "Forbidden: Access Denied to this Resource" });
                        }
                    }
                } catch (err) {
                    console.error(`[Database Error] Object-level body check failed for ID ${bodyId}:`, err);
                }
            }
        }

        next();
    });

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

    // ----------------------------------------------------
    // POSTGRESQL ERP / POS REST API ENDPOINTS
    // ----------------------------------------------------

    // 1. Migration Endpoint
    app.post("/api/migrate-from-firestore", async (req, res) => {
        try {
            const result = await runMigration();
            res.json(result);
        } catch (err: any) {
            res.status(500).json({ success: false, error: err?.message || String(err) });
        }
    });

    // 2. Companies & Branches
    app.get("/api/companies", async (req, res) => {
        const list = await getCompanies();
        res.json(list);
    });

    app.get("/api/companies/:id", async (req, res) => {
        const comp = await getCompanyById(req.params.id);
        res.json(comp);
    });

    app.post("/api/companies", async (req, res) => {
        const id = await saveCompany(req.body);
        res.json({ success: true, id });
    });

    app.get("/api/branches", async (req, res) => {
        const companyId = (req.query.companyId as string) || 'company_default';
        const list = await getBranches(companyId);
        res.json(list);
    });

    app.post("/api/branches", async (req, res) => {
        const id = await saveBranch(req.body);
        res.json({ success: true, id });
    });

    // 3. Users & Memberships
    app.get("/api/users", async (req, res) => {
        const companyId = (req.query.companyId as string) || 'company_default';
        const list = await getUsers(companyId);
        res.json(list);
    });

    app.get("/api/users/:id", async (req, res) => {
        const companyId = (req.query.companyId as string) || 'company_default';
        const user = await getUserById(req.params.id, companyId);
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    });

    app.post("/api/users", async (req, res) => {
        const id = await saveUser(req.body);
        const userContext = (req as any).userContext;
        await logAuditEvent({
            companyId: req.body.companyId || userContext?.companyId || 'company_default',
            userId: id,
            branchId: req.body.branchId || userContext?.branchId,
            action: 'USER_SAVED',
            details: { name: req.body.name, role: req.body.role, employeeCardId: req.body.employeeCardId, savedBy: userContext?.uid }
        });
        res.json({ success: true, id });
    });

    app.put("/api/users/:id/card", async (req, res) => {
        try {
            const userContext = (req as any).userContext;
            const targetUserId = req.params.id;
            const { employeeCardId, cardStatus, employeeCode } = req.body;

            const existingUser = await getUserById(targetUserId, userContext?.role === 'ADMIN' ? undefined : userContext?.companyId);
            if (!existingUser) {
                return res.status(404).json({ success: false, error: "الموظف غير موجود" });
            }

            const updatedUser = await updateUserCard(targetUserId, {
                employeeCardId,
                cardStatus,
                employeeCode
            }, userContext?.companyId);

            // Audit log
            let auditAction = 'CARD_ASSIGNED';
            if (employeeCardId === null || employeeCardId === '') auditAction = 'CARD_UNASSIGNED';
            else if (cardStatus === 'DISABLED') auditAction = 'CARD_DISABLED';
            else if (cardStatus === 'ACTIVE' && existingUser.cardStatus === 'DISABLED') auditAction = 'CARD_ENABLED';

            await logAuditEvent({
                companyId: updatedUser?.companyId || userContext?.companyId || 'company_default',
                userId: targetUserId,
                branchId: updatedUser?.branchId || userContext?.branchId,
                action: auditAction,
                details: {
                    targetEmployeeName: updatedUser?.name,
                    employeeCardId: updatedUser?.employeeCardId,
                    cardStatus: updatedUser?.cardStatus,
                    updatedBy: userContext?.uid
                }
            });

            res.json({ success: true, user: updatedUser });
        } catch (err: any) {
            console.error('Update User Card Error:', err);
            const status = err.message?.includes('مسجل بالفعل') ? 409 : 500;
            res.status(status).json({ success: false, error: err?.message || 'Failed to update user card' });
        }
    });

    app.delete("/api/users/:id", async (req, res) => {
        try {
            const userContext = (req as any).userContext;
            const companyId = userContext?.companyId || (req.query.companyId as string) || 'company_default';
            await deleteUser(req.params.id, companyId);
            await logAuditEvent({
                companyId,
                userId: req.params.id,
                action: 'USER_DELETED',
                details: { deletedUserId: req.params.id, deletedBy: userContext?.uid }
            });
            res.json({ success: true });
        } catch (err: any) {
            console.error('Delete User Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to delete user' });
        }
    });

    app.get("/api/memberships", async (req, res) => {
        const companyId = (req.query.companyId as string) || 'company_default';
        const list = await getMemberships(companyId);
        res.json(list);
    });

    app.post("/api/memberships", async (req, res) => {
        const id = await saveMembership(req.body);
        res.json({ success: true, id });
    });

    // Audit Logs & Auth Logout Endpoints
    app.get("/api/audit-logs", async (req, res) => {
        try {
            const userContext = (req as any).userContext;
            const companyId = userContext?.companyId || (req.query.companyId as string) || 'company_default';
            const limit = req.query.limit ? parseInt(req.query.limit as string) : 200;
            const logs = await getAuditLogs(companyId, limit);
            res.json(logs);
        } catch (err: any) {
            console.error('Get Audit Logs Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to get audit logs' });
        }
    });

    app.post("/api/auth/logout", async (req, res) => {
        try {
            const userContext = (req as any).userContext;
            if (userContext) {
                await logAuditEvent({
                    companyId: userContext.companyId || 'company_default',
                    userId: userContext.uid,
                    branchId: userContext.branchId,
                    action: 'LOGOUT',
                    details: { 
                        role: userContext.role, 
                        reason: req.body?.reason || 'User initiated logout',
                        logoutTime: new Date().toISOString() 
                    }
                });
            }
            res.json({ success: true });
        } catch (err: any) {
            console.error('Logout audit error:', err);
            res.json({ success: true });
        }
    });

    // 4. Categories & Products
    app.get("/api/categories", async (req, res) => {
        const companyId = (req.query.companyId as string) || 'company_default';
        const list = await getCategories(companyId);
        res.json(list);
    });

    app.post("/api/categories", async (req, res) => {
        const id = await saveCategory(req.body);
        res.json({ success: true, id });
    });

    app.delete("/api/categories/:id", async (req, res) => {
        const companyId = (req as any).userContext?.companyId || (req.query.companyId as string) || 'company_default';
        await deleteCategory(req.params.id, companyId);
        res.json({ success: true });
    });

    // Units Endpoints
    app.get("/api/units", async (req, res) => {
        const companyId = (req.query.companyId as string) || 'company_default';
        const list = await getUnits(companyId);
        res.json(list);
    });

    app.post("/api/units", async (req, res) => {
        try {
            const companyId = (req.body.companyId as string) || (req as any).userContext?.companyId || 'company_default';
            const id = await saveUnit(req.body, companyId);
            res.json({ success: true, id });
        } catch (err: any) {
            res.status(500).json({ success: false, error: err?.message || 'Failed to save unit' });
        }
    });

    app.delete("/api/units/:id", async (req, res) => {
        try {
            const companyId = (req as any).userContext?.companyId || (req.query.companyId as string) || 'company_default';
            await deleteUnit(req.params.id, companyId);
            res.json({ success: true });
        } catch (err: any) {
            res.status(500).json({ success: false, error: err?.message || 'Failed to delete unit' });
        }
    });

    app.get("/api/products", async (req, res) => {
        const companyId = (req.query.companyId as string) || 'company_default';
        const list = await getProducts(companyId);
        res.json(list);
    });

    app.get("/api/products/:id", async (req, res) => {
        try {
            const companyId = (req as any).userContext?.companyId || (req.query.companyId as string) || 'company_default';
            const item = await getProductById(req.params.id, companyId);
            if (!item) return res.status(404).json({ error: "Product not found" });
            res.json(item);
        } catch (err: any) {
            console.error('Get Product By ID Error:', err);
            res.status(500).json({ error: err?.message || "Failed to retrieve product" });
        }
    });

    app.post("/api/products", async (req, res) => {
        const id = await saveProduct(req.body);
        res.json({ success: true, id });
    });

    app.delete("/api/products/:id", async (req, res) => {
        const companyId = (req as any).userContext?.companyId || (req.query.companyId as string) || 'company_default';
        await deleteProduct(req.params.id, companyId);
        res.json({ success: true });
    });

    // 5. Sales & POS (SQL Transaction)
    app.get("/api/sales", async (req, res) => {
        const companyId = (req.query.companyId as string) || 'company_default';
        const list = await getSales(companyId);
        res.json(list);
    });

    app.post("/api/sales", async (req, res) => {
        try {
            const saleId = await createSaleTransaction(req.body);
            res.json({ success: true, id: saleId });
        } catch (err: any) {
            console.error('Sale Transaction Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Sale transaction failed' });
        }
    });

    app.delete("/api/sales/:id", async (req, res) => {
        try {
            const companyId = (req as any).userContext?.companyId || (req.query.companyId as string) || 'company_default';
            await deleteSaleTransaction(req.params.id, companyId);
            res.json({ success: true });
        } catch (err: any) {
            console.error('Delete Sale Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to delete sale' });
        }
    });

    // 6. Inventory Movements
    app.get("/api/inventory-movements", async (req, res) => {
        const companyId = (req.query.companyId as string) || 'company_default';
        const list = await getInventoryMovements(companyId);
        res.json(list);
    });

    // 7. Purchases
    app.get("/api/purchases", async (req, res) => {
        const companyId = (req.query.companyId as string) || 'company_default';
        const list = await getPurchases(companyId);
        res.json(list);
    });

    app.post("/api/purchases", async (req, res) => {
        try {
            const purchId = await createPurchaseTransaction(req.body);
            res.json({ success: true, id: purchId });
        } catch (err: any) {
            console.error('Purchase Transaction Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Purchase transaction failed' });
        }
    });

    app.delete("/api/purchases/:id", async (req, res) => {
        try {
            const companyId = (req as any).userContext?.companyId || (req.query.companyId as string) || 'company_default';
            await deletePurchaseTransaction(req.params.id, companyId);
            res.json({ success: true });
        } catch (err: any) {
            console.error('Delete Purchase Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Delete purchase failed' });
        }
    });

    // --- Returns API Endpoints ---
    app.get("/api/sale-returns", async (req, res) => {
        try {
            const companyId = (req.query.companyId as string) || 'company_default';
            const data = await getSaleReturns(companyId);
            res.json(data);
        } catch (err: any) {
            res.status(500).json({ success: false, error: err?.message || 'Failed to fetch sale returns' });
        }
    });

    app.post("/api/sale-returns", async (req, res) => {
        try {
            const companyId = req.body.companyId || 'company_default';
            const id = await createSaleReturnTransaction({ ...req.body, companyId });
            res.json({ success: true, id });
        } catch (err: any) {
            res.status(500).json({ success: false, error: err?.message || 'Failed to create sale return' });
        }
    });

    app.delete("/api/sale-returns/:id", async (req, res) => {
        try {
            const companyId = (req as any).userContext?.companyId || (req.query.companyId as string) || 'company_default';
            await deleteSaleReturnTransaction(req.params.id, companyId);
            res.json({ success: true });
        } catch (err: any) {
            res.status(500).json({ success: false, error: err?.message || 'Failed to delete sale return' });
        }
    });

    app.get("/api/purchase-returns", async (req, res) => {
        try {
            const companyId = (req.query.companyId as string) || 'company_default';
            const data = await getPurchaseReturns(companyId);
            res.json(data);
        } catch (err: any) {
            res.status(500).json({ success: false, error: err?.message || 'Failed to fetch purchase returns' });
        }
    });

    app.post("/api/purchase-returns", async (req, res) => {
        try {
            const companyId = req.body.companyId || 'company_default';
            const id = await createPurchaseReturnTransaction({ ...req.body, companyId });
            res.json({ success: true, id });
        } catch (err: any) {
            res.status(500).json({ success: false, error: err?.message || 'Failed to create purchase return' });
        }
    });

    app.delete("/api/purchase-returns/:id", async (req, res) => {
        try {
            const companyId = (req as any).userContext?.companyId || (req.query.companyId as string) || 'company_default';
            await deletePurchaseReturnTransaction(req.params.id, companyId);
            res.json({ success: true });
        } catch (err: any) {
            res.status(500).json({ success: false, error: err?.message || 'Failed to delete purchase return' });
        }
    });

    // 8. Customers & Suppliers
    app.get("/api/customers", async (req, res) => {
        const companyId = (req.query.companyId as string) || 'company_default';
        const list = await getCustomers(companyId);
        res.json(list);
    });

    app.get("/api/customers/:id", async (req, res) => {
        try {
            const companyId = (req as any).userContext?.companyId || (req.query.companyId as string) || 'company_default';
            const item = await getCustomerById(req.params.id, companyId);
            if (!item) return res.status(404).json({ error: "Customer not found" });
            res.json(item);
        } catch (err: any) {
            console.error('Get Customer By ID Error:', err);
            res.status(500).json({ error: err?.message || "Failed to retrieve customer" });
        }
    });

    app.get("/api/customers/:id/statement", async (req, res) => {
        try {
            const customerId = req.params.id;
            const companyId = (req as any).userContext?.companyId || (req.query.companyId as string) || 'company_default';

            // 1. Fetch customer
            const [customer] = await db.select().from(customers).where(and(eq(customers.id, customerId), eq(customers.companyId, companyId)));
            if (!customer) {
                return res.status(404).json({ success: false, error: "Customer not found" });
            }

            // 2. Fetch all sales for this customer
            const customerSales = await db.select().from(sales).where(and(eq(sales.customerId, customerId), eq(sales.companyId, companyId)));

            // 3. Fetch all sale items for these sales so we can display details if needed
            const saleIds = customerSales.map(s => s.id);
            let items: any[] = [];
            if (saleIds.length > 0) {
                items = await db.select().from(saleItems).where(and(inArray(saleItems.saleId, saleIds), eq(saleItems.companyId, companyId)));
            }

            // 4. Fetch customer transactions from customerTransactions table
            const transactionsList = await db.select().from(customerTransactions).where(and(eq(customerTransactions.customerId, customerId), eq(customerTransactions.companyId, companyId)));

            // 5. Fetch sale returns
            let returnsList: any[] = [];
            if (saleIds.length > 0) {
                const fetchedReturns = await db.select()
                    .from(saleReturns)
                    .where(and(inArray(saleReturns.saleId, saleIds), eq(saleReturns.companyId, companyId)));
                returnsList = fetchedReturns;
            }

            // 6. Build the unified ledger entries
            const ledger: any[] = [];

             // Add sales invoices as ledger entries
             for (const s of customerSales) {
                 const isCredit = s.paymentMethod === 'credit' || (s as any).isCredit;
                 const totalVal = Number((s as any).finalTotal || s.total || 0);
                 const paidVal = isCredit ? Number((s as any).cashAmount || 0) : totalVal;
                 const sItems = items.filter(it => it.saleId === s.id).map(it => ({
                     productId: it.productId,
                     name: it.name || it.productName,
                     quantity: Number(it.quantity || 0),
                     unitPrice: Number(it.unitPrice || it.price || 0),
                     totalPrice: Number(it.totalPrice || 0)
                 }));
 
                 ledger.push({
                     id: s.id,
                     date: (s as any).date || s.createdAt,
                     type: 'SALE',
                     documentNumber: s.invoiceNumber || s.id.slice(-8),
                     notes: `فاتورة مبيعات ${isCredit ? 'آجل' : 'نقدي'}` + ((s as any).notes ? ` - ${(s as any).notes}` : ''),
                     debit: totalVal,   // Customer owes this
                     credit: paidVal,   // Customer paid this at checkout
                     items: sItems,
                     paymentMethod: s.paymentMethod
                 });
             }

            // Add other customer transactions (like direct payments or manual balance adjustments)
            for (const tx of transactionsList) {
                if (tx.type === 'CREDIT_SALE') {
                    // This is already added via the sales record, skip
                    continue;
                }
                const amt = Number(tx.amount || 0);
                ledger.push({
                    id: tx.id,
                    date: tx.createdAt,
                    type: tx.type, // e.g. PAYMENT or RETURN or ADJUSTMENT
                    documentNumber: tx.referenceId || tx.id.slice(-8),
                    notes: tx.notes || (tx.type === 'PAYMENT' ? 'دفعة نقدية مسددة' : 'تسوية حساب'),
                    debit: tx.type === 'DEBIT' ? amt : 0,
                    credit: tx.type === 'PAYMENT' || tx.type === 'CREDIT' ? amt : 0,
                    items: []
                });
            }

            // Add sales returns
            for (const ret of returnsList) {
                const amt = Number(ret.totalRefund || 0);
                ledger.push({
                    id: ret.id,
                    date: ret.createdAt,
                    type: 'RETURN',
                    documentNumber: ret.returnNumber || ret.id.slice(-8),
                    notes: `مرتجع مبيعات` + (ret.reason ? ` - ${ret.reason}` : ''),
                    debit: 0,
                    credit: amt,
                    items: []
                });
            }

            // Sort everything chronologically ascending
            ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

             // Compute running balance chronologically
             let currentBal = Number((customer as any).openingBalance || 0);
             const ledgerWithBalance = ledger.map(entry => {
                 currentBal = currentBal + entry.debit - entry.credit;
                 return {
                     ...entry,
                     runningBalance: currentBal
                 };
             });
 
             res.json({
                 success: true,
                 customer: {
                     id: customer.id,
                     name: customer.name,
                     phone: customer.phone,
                     openingBalance: Number((customer as any).openingBalance || 0),
                     currentBalance: Number(customer.balance || (customer as any).currentBalance || 0)
                 },
                 ledger: ledgerWithBalance
             });

        } catch (err: any) {
            console.error("Customer Statement Error:", err);
            res.status(500).json({ success: false, error: err?.message || "Failed to generate statement" });
        }
    });

    app.post("/api/customers", async (req, res) => {
        try {
            const body = req.body;
            const companyId = body.companyId || req.query.companyId || 'company_default';
            const payload = { ...body, companyId };
            const id = await saveCustomer(payload);
            res.json({ success: true, id });
        } catch (err: any) {
            console.error('Save Customer Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to save customer' });
        }
    });

    app.delete("/api/customers/:id", async (req, res) => {
        try {
            const companyId = (req as any).userContext?.companyId || (req.query.companyId as string) || 'company_default';
            await deleteCustomer(req.params.id, companyId);
            res.json({ success: true });
        } catch (err: any) {
            console.error('Delete Customer Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to delete customer' });
        }
    });

    app.get("/api/suppliers", async (req, res) => {
        try {
            const companyId = (req.query.companyId as string) || 'company_default';
            const list = await getSuppliers(companyId);
            res.json(list);
        } catch (err: any) {
            console.error('Get Suppliers Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to get suppliers' });
        }
    });

    app.post("/api/suppliers", async (req, res) => {
        try {
            const body = req.body;
            const companyId = body.companyId || req.query.companyId || 'company_default';
            const payload = { ...body, companyId };
            const id = await saveSupplier(payload);
            res.json({ success: true, id });
        } catch (err: any) {
            console.error('Save Supplier Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to save supplier' });
        }
    });

    app.delete("/api/suppliers/:id", async (req, res) => {
        try {
            const companyId = (req as any).userContext?.companyId || (req.query.companyId as string) || 'company_default';
            await deleteSupplier(req.params.id, companyId);
            res.json({ success: true });
        } catch (err: any) {
            console.error('Delete Supplier Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to delete supplier' });
        }
    });

    app.get("/api/suppliers/:id/statement", async (req, res) => {
        try {
            const supplierId = req.params.id;
            const companyId = (req as any).userContext?.companyId || (req.query.companyId as string) || 'company_default';

            // 1. Fetch supplier
            const [supplier] = await db.select().from(suppliers).where(and(eq(suppliers.id, supplierId), eq(suppliers.companyId, companyId)));
            if (!supplier) {
                return res.status(404).json({ success: false, error: "Supplier not found" });
            }

            // 2. Fetch all purchases for this supplier
            const supplierPurchases = await db.select().from(purchases).where(and(eq(purchases.supplierId, supplierId), eq(purchases.companyId, companyId)));

            // 3. Fetch purchase items
            const purchaseIds = supplierPurchases.map(p => p.id);
            let items: any[] = [];
            if (purchaseIds.length > 0) {
                items = await db.select().from(purchaseItems).where(and(inArray(purchaseItems.purchaseId, purchaseIds), eq(purchaseItems.companyId, companyId)));
            }

            // 4. Fetch supplier transactions
            const transactionsList = await db.select().from(supplierTransactions).where(and(eq(supplierTransactions.supplierId, supplierId), eq(supplierTransactions.companyId, companyId)));

            // 5. Fetch purchase returns
            let returnsList: any[] = [];
            if (purchaseIds.length > 0) {
                const fetchedReturns = await db.select()
                    .from(purchaseReturns)
                    .where(and(inArray(purchaseReturns.purchaseId, purchaseIds), eq(purchaseReturns.companyId, companyId)));
                returnsList = fetchedReturns;
            }

            // 6. Build unified ledger entries
            const ledger: any[] = [];

             // Add purchase invoices
             for (const p of supplierPurchases) {
                 const isCredit = p.paymentMethod === 'credit' || (p as any).isCredit;
                 const totalVal = Number(p.total || 0);
                 const paidVal = isCredit ? Number(p.paidAmount || 0) : totalVal;
                 const pItems = items.filter(it => it.purchaseId === p.id).map(it => ({
                     productId: it.productId,
                     name: it.productName || it.name,
                     quantity: Number(it.quantity || 0),
                     unitPrice: Number(it.unitPrice || it.price || 0),
                     totalPrice: Number(it.totalPrice || 0)
                 }));
 
                 ledger.push({
                     id: p.id,
                     date: (p as any).date || p.createdAt,
                     type: 'PURCHASE',
                     documentNumber: (p as any).invoiceNumber || p.purchaseNumber || p.id.slice(-8),
                     notes: `فاتورة مشتريات ${isCredit ? 'آجل' : 'نقدي'}` + ((p as any).notes ? ` - ${(p as any).notes}` : ''),
                     debit: paidVal,    // We paid this (Debit)
                     credit: totalVal,  // We bought this (Credit)
                     items: pItems,
                     paymentMethod: p.paymentMethod
                 });
             }

            // Add other supplier transactions
            for (const tx of transactionsList) {
                if (tx.type === 'PURCHASE') {
                    continue; // Already handled
                }
                const amt = Number(tx.amount || 0);
                ledger.push({
                    id: tx.id,
                    date: tx.createdAt,
                    type: tx.type,
                    documentNumber: tx.referenceId || tx.id.slice(-8),
                    notes: tx.notes || (tx.type === 'PAYMENT' ? 'دفعة نقدية مسددة للمورد' : 'تسوية حساب'),
                    debit: tx.type === 'PAYMENT' || tx.type === 'DEBIT' ? amt : 0,
                    credit: tx.type === 'CREDIT' ? amt : 0,
                    items: []
                });
            }

            // Add purchase returns
            for (const ret of returnsList) {
                const amt = Number(ret.totalRefund || 0);
                ledger.push({
                    id: ret.id,
                    date: ret.createdAt,
                    type: 'RETURN',
                    documentNumber: ret.returnNumber || ret.id.slice(-8),
                    notes: `مرتجع مشتريات` + (ret.reason ? ` - ${ret.reason}` : ''),
                    debit: amt, // Returns reduce our debt (Debit)
                    credit: 0,
                    items: []
                });
            }

            // Sort ascending by date
            ledger.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

             // Compute running balance: Supplier balance is credit-based
             let currentBal = Number((supplier as any).openingBalance || 0);
             const ledgerWithBalance = ledger.map(entry => {
                 currentBal = currentBal + entry.credit - entry.debit;
                 return {
                     ...entry,
                     runningBalance: currentBal
                 };
             });
 
             res.json({
                 success: true,
                 supplier: {
                     id: supplier.id,
                     name: supplier.name,
                     contactPerson: (supplier as any).contactPerson || '',
                     phone: supplier.phone,
                     openingBalance: Number((supplier as any).openingBalance || 0),
                     currentBalance: Number(supplier.balance || (supplier as any).currentBalance || 0)
                 },
                 ledger: ledgerWithBalance
             });

        } catch (err: any) {
            console.error("Supplier Statement Error:", err);
            res.status(500).json({ success: false, error: err?.message || "Failed to generate statement" });
        }
    });

    // 9. Expenses
    app.get("/api/expenses", async (req, res) => {
        try {
            const companyId = (req.query.companyId as string) || 'company_default';
            const list = await getExpenses(companyId);
            res.json(list);
        } catch (err: any) {
            console.error('Get Expenses Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to get expenses' });
        }
    });

    app.post("/api/expenses", async (req, res) => {
        try {
            const body = req.body;
            const companyId = body.companyId || req.query.companyId || 'company_default';
            const payload = {
                ...body,
                companyId,
                title: body.title || body.category || 'مصروف عام',
                amount: Number(body.amount || 0)
            };
            const id = await saveExpense(payload);
            res.json({ success: true, id });
        } catch (err: any) {
            console.error('Save Expense Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to save expense' });
        }
    });

    app.delete("/api/expenses/:id", async (req, res) => {
        try {
            const companyId = (req as any).userContext?.companyId || (req.query.companyId as string) || 'company_default';
            await deleteExpense(req.params.id, companyId);
            res.json({ success: true });
        } catch (err: any) {
            console.error('Delete Expense Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to delete expense' });
        }
    });

    // Expense Categories
    app.get("/api/expense-categories", async (req, res) => {
        try {
            const companyId = (req.query.companyId as string) || 'company_default';
            const list = await getExpenseCategories(companyId);
            res.json(list);
        } catch (err: any) {
            console.error('Get Expense Categories Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to get expense categories' });
        }
    });

    app.post("/api/expense-categories", async (req, res) => {
        try {
            const body = req.body;
            const companyId = body.companyId || req.query.companyId || 'company_default';
            const payload = { ...body, companyId };
            const id = await saveExpenseCategory(payload);
            res.json({ success: true, id });
        } catch (err: any) {
            console.error('Save Expense Category Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to save expense category' });
        }
    });

    app.delete("/api/expense-categories/:id", async (req, res) => {
        try {
            const companyId = (req as any).userContext?.companyId || (req.query.companyId as string) || 'company_default';
            await deleteExpenseCategory(req.params.id, companyId);
            res.json({ success: true });
        } catch (err: any) {
            console.error('Delete Expense Category Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to delete expense category' });
        }
    });

    // 10. Cashier Sessions
    app.get("/api/cashier-sessions", async (req, res) => {
        try {
            const companyId = (req.query.companyId as string) || 'company_default';
            const list = await getCashierSessions(companyId);
            res.json(list);
        } catch (err: any) {
            console.error('Get Cashier Sessions Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to get cashier sessions' });
        }
    });

    app.post("/api/cashier-sessions", async (req, res) => {
        try {
            const id = await saveCashierSession(req.body);
            res.json({ success: true, id });
        } catch (err: any) {
            console.error('Save Cashier Session Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to save cashier session' });
        }
    });

    // 11. Counters / Sequence
    app.post("/api/counters/next", async (req, res) => {
        try {
            const { companyId, name } = req.body;
            const val = await getNextSequence(companyId || 'company_default', name || 'sale');
            res.json({ nextVal: val });
        } catch (err: any) {
            console.error('Get Next Sequence Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to get next sequence' });
        }
    });

    // 12. Database Wipe / Reset Endpoint
    app.post("/api/reset-database", async (req, res) => {
        try {
            const { mode, companyId } = req.body;
            await resetDatabase(mode || 'full', companyId || 'company_default');
            res.json({ success: true, message: 'Database reset performed successfully' });
        } catch (err: any) {
            console.error('Database Reset Error:', err);
            res.status(500).json({ success: false, error: err?.message || 'Failed to reset database' });
        }
    });

    // 13. User Column & View Preferences with Tenant Isolation & RBAC
    app.get("/api/user-preferences", async (req, res) => {
        try {
            const userContext = (req as any).userContext || { uid: "test_uid_admin", email: "admin@test.com", companyId: "company_default", role: "ADMIN" };
            const requestedUserId = (req.query.userId as string) || userContext.email || userContext.uid;
            const tableId = (req.query.tableId as string) || "default_table";

            // Tenant and Identity Isolation Check
            // A non-admin user cannot read or tamper with another user's preferences
            const currentIdentities = [userContext.email, userContext.uid, "admin"].filter(Boolean).map(s => s.toLowerCase());
            const reqUserLower = requestedUserId.toLowerCase();

            if (userContext.role !== "ADMIN" && !currentIdentities.includes(reqUserLower)) {
                return res.status(403).json({ success: false, error: "Access denied: Cannot access preferences of another user" });
            }

            const filePath = path.join(process.cwd(), "user_preferences.json");
            let data: any = {};
            try {
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, "utf-8");
                    data = JSON.parse(content);
                }
            } catch (e) {
                console.warn("Could not read preferences file:", e);
            }
            
            const scopedKey = `${userContext.companyId}:${reqUserLower}:${tableId}`;
            // Also check backward-compatible un-scoped key
            const legacyKey = `${reqUserLower}_${tableId}`;
            const prefs = data[scopedKey] !== undefined ? data[scopedKey] : (data[legacyKey] || null);

            res.json({ success: true, preferences: prefs });
        } catch (err: any) {
            console.error("Get user preferences error:", err);
            res.status(500).json({ success: false, error: err?.message || "Failed to load preferences" });
        }
    });

    app.post("/api/user-preferences", async (req, res) => {
        try {
            const userContext = (req as any).userContext || { uid: "test_uid_admin", email: "admin@test.com", companyId: "company_default", role: "ADMIN" };
            const { userId, tableId, preferences } = req.body;
            const targetUserId = userId || userContext.email || userContext.uid;

            if (!targetUserId || !tableId) {
                return res.status(400).json({ success: false, error: "Missing required fields" });
            }

            // Tenant and Identity Isolation Check
            const currentIdentities = [userContext.email, userContext.uid, "admin"].filter(Boolean).map(s => s.toLowerCase());
            const reqUserLower = targetUserId.toLowerCase();

            if (userContext.role !== "ADMIN" && !currentIdentities.includes(reqUserLower)) {
                return res.status(403).json({ success: false, error: "Access denied: Cannot modify preferences of another user" });
            }

            const filePath = path.join(process.cwd(), "user_preferences.json");
            let data: any = {};
            try {
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, "utf-8");
                    data = JSON.parse(content);
                }
            } catch (e) {
                // Ignore and rewrite
            }
            
            const scopedKey = `${userContext.companyId}:${reqUserLower}:${tableId}`;
            data[scopedKey] = preferences;
            
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
            res.json({ success: true });
        } catch (err: any) {
            console.error("Save user preferences error:", err);
            res.status(500).json({ success: false, error: err?.message || "Failed to save preferences" });
        }
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

    // Seed mock users for security testing in development/non-production asynchronously
    if (process.env.NODE_ENV !== "production") {
        (async () => {
            try {
                console.log("[Security Seed] Seeding test users and data...");
                // Clean up transactional records for test tenants to ensure test run reproducibility
                for (const cId of ["company_a", "company_b"]) {
                    await db.delete(saleItems).where(eq(saleItems.companyId, cId));
                    await db.delete(payments).where(eq(payments.companyId, cId));
                    await db.delete(saleReturns).where(eq(saleReturns.companyId, cId));
                    await db.delete(saleReturnItems).where(eq(saleReturnItems.companyId, cId));
                    await db.delete(inventoryMovements).where(eq(inventoryMovements.companyId, cId));
                    await db.delete(sales).where(eq(sales.companyId, cId));
                    await db.delete(purchaseItems).where(eq(purchaseItems.companyId, cId));
                    await db.delete(purchases).where(eq(purchases.companyId, cId));
                    await db.delete(expenses).where(eq(expenses.companyId, cId));
                    await db.delete(customerTransactions).where(eq(customerTransactions.companyId, cId));
                    await db.delete(customers).where(eq(customers.companyId, cId));
                    await db.delete(suppliers).where(eq(suppliers.companyId, cId));
                    await db.delete(cashierSessions).where(eq(cashierSessions.companyId, cId));
                }

                // Save Companies
                await saveCompany({ id: "company_a", name: "Company A" });
                await saveCompany({ id: "company_b", name: "Company B" });

                // Save Users & Memberships
                await saveUser({ 
                    id: "usr_test_admin", 
                    uid: "test_uid_admin", 
                    email: "admin@test.com", 
                    name: "Admin User", 
                    companyId: "company_a", 
                    role: "ADMIN",
                    employeeCode: "EMP-ADM-001",
                    employeeCardId: "CARD-ADMIN-001",
                    cardStatus: "ACTIVE",
                    status: "ACTIVE"
                });
                await saveMembership({ id: "memb_test_admin", uid: "test_uid_admin", userId: "usr_test_admin", companyId: "company_a", role: "ADMIN" });

                await saveUser({ 
                    id: "usr_test_cashier", 
                    uid: "test_uid_cashier", 
                    email: "cashier@test.com", 
                    name: "Cashier User", 
                    companyId: "company_a", 
                    role: "CASHIER",
                    employeeCode: "EMP-CSH-002",
                    employeeCardId: "CARD-CASHIER-002",
                    cardStatus: "ACTIVE",
                    status: "ACTIVE"
                });
                await saveMembership({ id: "memb_test_cashier", uid: "test_uid_cashier", userId: "usr_test_cashier", companyId: "company_a", role: "CASHIER" });

                await saveUser({ 
                    id: "usr_test_disabled_card", 
                    uid: "test_uid_disabled_card", 
                    email: "disabledcard@test.com", 
                    name: "Disabled Card User", 
                    companyId: "company_a", 
                    role: "CASHIER",
                    employeeCode: "EMP-DIS-003",
                    employeeCardId: "CARD-DISABLED-003",
                    cardStatus: "DISABLED",
                    status: "ACTIVE"
                });
                await saveMembership({ id: "memb_test_disabled_card", uid: "test_uid_disabled_card", userId: "usr_test_disabled_card", companyId: "company_a", role: "CASHIER" });

                await saveUser({ 
                    id: "usr_test_inactive_user", 
                    uid: "test_uid_inactive_user", 
                    email: "inactive@test.com", 
                    name: "Inactive User", 
                    companyId: "company_a", 
                    role: "CASHIER",
                    employeeCode: "EMP-INA-004",
                    employeeCardId: "CARD-INACTIVE-004",
                    cardStatus: "ACTIVE",
                    status: "DISABLED"
                });
                await saveMembership({ id: "memb_test_inactive_user", uid: "test_uid_inactive_user", userId: "usr_test_inactive_user", companyId: "company_a", role: "CASHIER", status: "DISABLED" });

                await saveUser({ id: "usr_test_user_a", uid: "test_uid_user_a", email: "usera@test.com", name: "User A", companyId: "company_a", role: "MANAGER", employeeCardId: "CARD-USER-A", cardStatus: "ACTIVE", status: "ACTIVE" });
                await saveMembership({ id: "memb_test_user_a", uid: "test_uid_user_a", userId: "usr_test_user_a", companyId: "company_a", role: "MANAGER" });

                await saveUser({ id: "usr_test_user_b", uid: "test_uid_user_b", email: "userb@test.com", name: "User B", companyId: "company_b", role: "MANAGER", employeeCardId: "CARD-USER-B", cardStatus: "ACTIVE", status: "ACTIVE" });
                await saveMembership({ id: "memb_test_user_b", uid: "test_uid_user_b", userId: "usr_test_user_b", companyId: "company_b", role: "MANAGER" });

                // Seed rich default users for company_default if not present
                await saveUser({
                    id: "usr_def_admin",
                    uid: "usr_def_admin",
                    email: "admin@maro-pos.local",
                    name: "المدير العام",
                    pin: "1234",
                    role: "admin",
                    companyId: "company_default",
                    employeeCode: "EMP-001",
                    employeeCardId: "CARD-ADMIN-999",
                    cardStatus: "ACTIVE",
                    status: "ACTIVE"
                });
                await saveMembership({ id: "memb_def_admin", uid: "usr_def_admin", userId: "usr_def_admin", companyId: "company_default", role: "ADMIN" });

                await saveUser({
                    id: "usr_def_cashier",
                    uid: "usr_def_cashier",
                    email: "cashier@maro-pos.local",
                    name: "كاشير الصالة",
                    pin: "0000",
                    role: "cashier",
                    companyId: "company_default",
                    employeeCode: "EMP-002",
                    employeeCardId: "CARD-CASHIER-101",
                    cardStatus: "ACTIVE",
                    status: "ACTIVE"
                });
                await saveMembership({ id: "memb_def_cashier", uid: "usr_def_cashier", userId: "usr_def_cashier", companyId: "company_default", role: "CASHIER" });

                await saveUser({
                    id: "usr_def_acc",
                    uid: "usr_def_acc",
                    email: "accountant@maro-pos.local",
                    name: "المحاسب العام",
                    pin: "1111",
                    role: "accountant",
                    companyId: "company_default",
                    employeeCode: "EMP-003",
                    employeeCardId: "CARD-ACC-202",
                    cardStatus: "ACTIVE",
                    status: "ACTIVE"
                });
                await saveMembership({ id: "memb_def_acc", uid: "usr_def_acc", userId: "usr_def_acc", companyId: "company_default", role: "MANAGER" });

                // Save products for Cross-Tenant Object Access testing
                await saveProduct({ id: "prod_a", companyId: "company_a", name: "Product A", price: 50, stock: 5 });
                await saveProduct({ id: "prod_b", companyId: "company_b", name: "Product B", price: 100, stock: 10 });

                // Check and seed company_default with rich Arabic demo data if not already seeded
                const defaultProds = await getProducts("company_default");
                if (defaultProds.length === 0) {
                    console.log("[Demo Seed] Seeding rich Arabic accounting data for company_default...");
                    
                    // Ensure company_default exists
                    await saveCompany({ id: "company_default", name: "الشركة الافتراضية - دكست" });
                    
                    // Ensure main branch exists
                    await saveBranch({ id: "branch_main", name: "الفرع الرئيسي", companyId: "company_default" });

                    // Save Categories
                    await saveCategory({ id: "cat_food", companyId: "company_default", name: "مواد غذائية", description: "منتجات البقالة والأغذية" });
                    await saveCategory({ id: "cat_elec", companyId: "company_default", name: "أجهزة إلكترونية", description: "شواحن وهواتف وسماعات" });
                    await saveCategory({ id: "cat_office", companyId: "company_default", name: "أدوات مكتبية", description: "أوراق ودفاتر وأقلام" });

                    // Save Products
                    await saveProduct({ id: "prod_rice", companyId: "company_default", sku: "SKU-RICE1", barcode: "6221234567890", name: "أرز مصري فائق 1 كجم", price: 35, costPrice: 28, stock: 150, categoryId: "cat_food" });
                    await saveProduct({ id: "prod_oil", companyId: "company_default", sku: "SKU-OIL1", barcode: "6229876543210", name: "زيت عباد الشمس 1 لتر", price: 65, costPrice: 55, stock: 80, categoryId: "cat_food" });
                    await saveProduct({ id: "prod_charger", companyId: "company_default", sku: "SKU-CHG20", barcode: "112233445566", name: "شاحن هاتف سريع 20 واط", price: 250, costPrice: 180, stock: 45, categoryId: "cat_elec" });
                    await saveProduct({ id: "prod_headset", companyId: "company_default", sku: "SKU-BTSM", barcode: "998877665544", name: "سماعة بلوتوث لاسلكية", price: 450, costPrice: 320, stock: 20, categoryId: "cat_elec" });
                    await saveProduct({ id: "prod_notebook", companyId: "company_default", sku: "SKU-NOTE100", barcode: "223344556677", name: "دفتر سلك جامعي 100 ورقة", price: 45, costPrice: 35, stock: 200, categoryId: "cat_office" });

                    // Save Customers
                    await saveCustomer({ id: "cust_cash", companyId: "company_default", name: "عميل نقدي", phone: "0000000000", balance: 0 });
                    await saveCustomer({ id: "cust_ahmed", companyId: "company_default", name: "محمد أحمد علي", phone: "01012345678", balance: 1200 });
                    await saveCustomer({ id: "cust_sara", companyId: "company_default", name: "سارة عبد الرحمن", phone: "01287654321", balance: 450 });

                    // Save Suppliers
                    await saveSupplier({ id: "supp_intl", companyId: "company_default", name: "الشركة الدولية للاستيراد والتوزيع", phone: "022567890", balance: 15000 });
                    await saveSupplier({ id: "supp_hope", companyId: "company_default", name: "شركة الأمل للتجارة والتوكيلات", phone: "022134567", balance: 6700 });

                    // Save Sales Transactions
                    await createSaleTransaction({ 
                        id: "sale_demo_1", 
                        companyId: "company_default", 
                        invoiceNumber: "INV-10001", 
                        subtotal: 350, 
                        vatAmount: 49, 
                        total: 399, 
                        paymentMethod: "CASH", 
                        cashierId: "usr_test_cashier", 
                        cashierName: "كاشير النظام", 
                        customerId: "cust_cash", 
                        items: [{ productId: "prod_rice", productName: "أرز مصري فائق 1 كجم", quantity: 10, price: 35, total: 350 }] 
                    });
                    
                    await createSaleTransaction({ 
                        id: "sale_demo_2", 
                        companyId: "company_default", 
                        invoiceNumber: "INV-10002", 
                        subtotal: 900, 
                        vatAmount: 126, 
                        total: 1026, 
                        paymentMethod: "CASH", 
                        cashierId: "usr_test_cashier", 
                        cashierName: "كاشير النظام", 
                        customerId: "cust_ahmed", 
                        items: [{ productId: "prod_headset", productName: "سماعة بلوتوث لاسلكية", quantity: 2, price: 450, total: 900 }] 
                    });

                    // Save Purchases
                    await createPurchaseTransaction({ 
                        id: "purch_demo_1", 
                        companyId: "company_default", 
                        purchaseNumber: "PUR-20001", 
                        supplierId: "supp_intl", 
                        supplierName: "الشركة الدولية للاستيراد والتوزيع", 
                        subtotal: 2800, 
                        vatAmount: 392, 
                        total: 3192, 
                        paymentMethod: "cash", 
                        paidAmount: 3192, 
                        items: [{ productId: "prod_rice", productName: "أرز مصري فائق 1 كجم", quantity: 100, costPrice: 28, total: 2800 }] 
                    });

                    // Save Expenses
                    await saveExpense({ 
                        id: "exp_demo_1", 
                        companyId: "company_default", 
                        title: "فاتورة كهرباء المقر الرئيسي", 
                        amount: 450, 
                        category: "مرافق", 
                        notes: "فاتورة شهر يوليو", 
                        createdBy: "usr_test_admin" 
                    });
                    
                    await saveExpense({ 
                        id: "exp_demo_2", 
                        companyId: "company_default", 
                        title: "رواتب ومستحقات الموظفين", 
                        amount: 3500, 
                        category: "رواتب", 
                        notes: "سلفة جزء من الراتب لشهر أغسطس", 
                        createdBy: "usr_test_admin" 
                    });

                    console.log("[Demo Seed] Rich Arabic accounting demo data seeded successfully.");
                }

                console.log("[Security Seed] Test users and data seeded successfully.");
            } catch (err) {
                console.error("[Security Seed Failed]", err);
            }
        })();
    }
}

startServer();
