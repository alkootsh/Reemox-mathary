import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from 'nodemailer';
import twilio from "twilio";


// Load environment variables
import "dotenv/config";

// WhatsApp Notification Logic
let client: twilio.Twilio | null = null;

async function sendEmailNotification(to: string, message: string) {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    try {
        await transporter.sendMail({
            from: '"Inventory Manager" <no-reply@my-erp.com>',
            to,
            subject: 'تنبيه مخزون منخفض',
            text: message,
        });
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error("Error sending email", error);
    }
}

function getTwilioClient(): twilio.Twilio | null {
    if (client) return client;
    const accountSid = process.env.TWILIO_ACCOUNT_SID ? process.env.TWILIO_ACCOUNT_SID.trim() : '';
    const authToken = process.env.TWILIO_AUTH_TOKEN ? process.env.TWILIO_AUTH_TOKEN.trim() : '';

    if (!accountSid || !authToken) {
        console.error("Twilio initialization failed: TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is missing.");
        return null;
    }

    if (!accountSid.startsWith('AC')) {
        console.error(`Twilio initialization failed: TWILIO_ACCOUNT_SID must start with 'AC'. Provided: ${accountSid.substring(0, 4)}...`);
        return null;
    }

    try {
        client = twilio(accountSid, authToken);
    } catch (error) {
        console.error("Failed to initialize Twilio client:", error);
    }
    return client;
}

async function sendWhatsAppNotification(to: string, message: string) {
    const twilioClient = getTwilioClient();
    if (!twilioClient) {
        console.error("Twilio client not initialized");
        return;
    }
    try {
        await twilioClient.messages.create({
            body: message,
            from: `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`,
            to: `whatsapp:${to}`,
        });
        console.log(`WhatsApp message sent to ${to}`);
    } catch (error) {
        console.error("Error sending WhatsApp message", error);
    }
}

// Scheduled check for license expiration
setInterval(async () => {
    console.log("Checking for license expirations...");
}, 24 * 60 * 60 * 1000); // Check once a day

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(express.json());

    app.post("/api/notify-inventory", async (req, res) => {
        const { productName, quantity } = req.body;
        const message = `تنبيه: كمية المنتج ${productName} انخفضت إلى ${quantity}. يرجى إعادة الطلب.`;
        await sendWhatsAppNotification(process.env.ADMIN_WHATSAPP_NUMBER!, message);
        res.json({ success: true });
    });

    app.post("/api/notify-email", async (req, res) => {
        const { to, productName, quantity } = req.body;
        const message = `تنبيه: كمية المنتج ${productName} انخفضت إلى ${quantity}. يرجى إعادة الطلب.`;
        await sendEmailNotification(to, message);
        res.json({ success: true });
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
