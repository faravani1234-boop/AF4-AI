import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const webSearchEnabled = process.env.AF4_ENABLE_WEB_SEARCH !== "false";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));
app.use("/api/", rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false }));

const systemInstructions = "تو AF4 AI هستی؛ دستیار شخصی هوش مصنوعی عباس فراوانی، سازنده پروژه AF4 AI. با فارسی روان و طبیعی حرف بزن؛ اگر کاربر خودمانی نوشت، صمیمی اما دقیق و محترمانه جواب بده. پاسخ‌ها را کاربردی و روشن بده و برای فرد مبتدی مراحل ساده و قابل کپی ارائه کن. AF4 برند شخصی/تجاری کاربر است و پروژه‌های شناخته‌شده‌اش شامل AF4 AI، اکسپرت مدیریت ریسک متاتریدر ۵، تولید محصول، طراحی و ساخت، هوش مصنوعی و معامله‌گری است. فقط وقتی مرتبط است از این اطلاعات استفاده کن. اگر چیزی را نمی‌دانی یا حافظه‌ای در دسترس نیست، وانمود نکن که می‌دانی. اطلاعات روز را با جست‌وجوی وب بررسی کن وقتی ابزار فعال است. هرگز ادعا نکن چیزی را آزمایش کرده‌ای مگر واقعاً انجام شده باشد. کلیدها و اطلاعات محرمانه را افشا نکن.";

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, assistant: "AF4 AI", model, modelConfigured: Boolean(apiKey), webSearchEnabled });
});

app.post("/api/chat", async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(503).json({ error: "هنوز کلید API روی سرور تنظیم نشده است. برای فعال‌شدن پاسخ واقعی، متغیر OPENAI_API_KEY را در تنظیمات امن سرور وارد کن." });
    }
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) {
      return res.status(400).json({ error: "ساختار پیام‌ها معتبر نیست." });
    }
    const input = messages.map((m) => {
      if (!m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string") throw new Error("ساختار یکی از پیام‌ها معتبر نیست.");
      return { role: m.role, content: m.content.slice(0, 12000) };
    });
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, instructions: systemInstructions, input, max_output_tokens: 1600, ...(webSearchEnabled ? { tools: [{ type: "web_search" }] } : {}) }),
      signal: AbortSignal.timeout(60_000)
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error("AI provider request failed:", upstream.status);
      return res.status(502).json({ error: "ارتباط با سرویس هوش مصنوعی ناموفق بود. تنظیمات مدل و کلید API را بررسی کن." });
    }
    const text = Array.isArray(data.output)
      ? data.output.flatMap(item => Array.isArray(item.content) ? item.content : []).filter(item => item.type === "output_text").map(item => item.text).join("\n")
      : "";
    if (!text) return res.status(502).json({ error: "پاسخ متنی از مدل دریافت نشد." });
    res.json({ reply: text, model });
  } catch (error) {
    if (error?.message === "ساختار یکی از پیام‌ها معتبر نیست.") return res.status(400).json({ error: error.message });
    console.error("AF4 AI chat error:", error?.name || "Error");
    res.status(500).json({ error: "خطای داخلی رخ داد. لطفاً دوباره تلاش کن." });
  }
});
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.listen(port, () => console.log(`AF4 AI is running on port ${port}`));
