import express from "express";
import crypto from "node:crypto";

const router = express.Router();
const pending = new Map();
const processed = new Set();
const MAX_PENDING = 500;
const MAX_PROCESSED = 2000;

function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
function adminOnly(req, res, next) {
  const secret = process.env.INSTAGRAM_AGENT_ADMIN_TOKEN;
  if (!secret) return res.status(503).json({ error: "تنظیم مدیر ایجنت کامل نیست؛ توکن مدیر در Render تنظیم نشده." });
  const provided = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!constantTimeEqual(provided, secret)) return res.status(401).json({ error: "دسترسی غیرمجاز." });
  next();
}
function verifySignature(req) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret || !Buffer.isBuffer(req.rawBody)) return false;
  const supplied = String(req.get("x-hub-signature-256") || "");
  if (!/^sha256=[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(req.rawBody).digest("hex");
  return constantTimeEqual(supplied, expected);
}
function safeText(value, max = 2000) {
  return typeof value === "string" ? value.slice(0, max) : "";
}
function addPending(item) {
  if (item.id && processed.has(item.id)) return;
  if (pending.size >= MAX_PENDING) pending.delete(pending.keys().next().value);
  const id = item.id || crypto.randomUUID();
  pending.set(id, { ...item, id, status: "awaiting_approval", receivedAt: new Date().toISOString() });
  if (item.id) {
    processed.add(item.id);
    if (processed.size > MAX_PROCESSED) processed.delete(processed.values().next().value);
  }
}
function parseWebhook(body) {
  const events = [];
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
    for (const msg of Array.isArray(entry?.messaging) ? entry.messaging : []) {
      if (!msg?.message || msg.message.is_echo || !msg.message.mid) continue;
      events.push({
        id: String(msg.message.mid),
        kind: "message",
        accountId: String(entry.id || ""),
        senderId: String(msg.sender?.id || ""),
        text: safeText(msg.message.text),
        attachments: Array.isArray(msg.message.attachments) ? msg.message.attachments.map(a => ({ type: safeText(a.type, 50) })) : []
      });
    }
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change?.value || {};
      if (change?.field === "comments" && value.id) {
        events.push({
          id: String(value.id),
          kind: "comment",
          accountId: String(entry.id || ""),
          senderId: String(value.from?.id || ""),
          username: safeText(value.from?.username, 100),
          text: safeText(value.text)
        });
      }
    }
  }
  return events;
}

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const expected = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && constantTimeEqual(token, expected) && challenge) return res.status(200).type("text/plain").send(String(challenge));
  return res.sendStatus(403);
});

router.post("/webhook", (req, res) => {
  if (!verifySignature(req)) return res.status(401).json({ error: "امضای webhook معتبر نیست یا META_APP_SECRET تنظیم نشده است." });
  const events = parseWebhook(req.body);
  for (const event of events) addPending(event);
  // Acknowledge quickly; replies are deliberately NOT sent automatically.
  return res.sendStatus(200);
});

router.get("/status", adminOnly, (_req, res) => {
  res.json({
    ok: true,
    mode: process.env.INSTAGRAM_AGENT_MODE || "approval",
    configured: {
      webhookVerifyToken: Boolean(process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN),
      appSecret: Boolean(process.env.META_APP_SECRET),
      accessToken: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN),
      instagramAccountId: Boolean(process.env.INSTAGRAM_ACCOUNT_ID),
      adminToken: Boolean(process.env.INSTAGRAM_AGENT_ADMIN_TOKEN)
    },
    pendingCount: pending.size,
    note: "صف فعلی در حافظه است و با restart/redeploy پاک می‌شود؛ برای تولید واقعی باید ذخیره‌سازی پایدار فعال شود."
  });
});

router.get("/pending", adminOnly, (_req, res) => {
  res.json({ items: [...pending.values()].map(({ senderId, ...item }) => ({ ...item, senderId: senderId ? "[پنهان؛ برای ارسال لازم است]" : "" })) });
});

router.post("/approve/:id", adminOnly, async (req, res) => {
  const item = pending.get(String(req.params.id));
  if (!item) return res.status(404).json({ error: "موردی با این شناسه در صف نیست." });
  const reply = safeText(req.body?.reply, 1000).trim();
  if (!reply) return res.status(400).json({ error: "متن پاسخ خالی است." });
  if (item.kind !== "message" || !item.senderId) return res.status(400).json({ error: "ارسال پاسخ فقط برای دایرکت‌های دارای فرستنده پشتیبانی می‌شود؛ کامنت نیازمند endpoint جداگانه است." });
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID;
  const version = (process.env.META_GRAPH_API_VERSION || "v26.0").replace(/^v?/, "v");
  if (!token || !accountId) return res.status(503).json({ error: "توکن دسترسی و شناسه حساب Instagram در Render تنظیم نشده‌اند." });
  try {
    const response = await fetch(`https://graph.instagram.com/${version}/${encodeURIComponent(accountId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: item.senderId }, message: { text: reply } }),
      signal: AbortSignal.timeout(12000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(502).json({ error: "Meta پیام را نپذیرفت؛ مجوزها، توکن و پنجره مجاز پیام‌رسانی را بررسی کن.", metaCode: payload?.error?.code || null });
    pending.delete(item.id);
    return res.json({ ok: true, sent: true, messageId: payload?.message_id || null });
  } catch {
    return res.status(502).json({ error: "اتصال به Meta ناموفق بود؛ بعداً دوباره امتحان کن." });
  }
});

router.post("/dismiss/:id", adminOnly, (req, res) => {
  const deleted = pending.delete(String(req.params.id));
  return deleted ? res.json({ ok: true, dismissed: true }) : res.status(404).json({ error: "موردی با این شناسه در صف نیست." });
});

export default router;
