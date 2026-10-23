import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use((req,res,next)=>{res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Methods","GET, POST, OPTIONS");res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");if(req.method==="OPTIONS")return res.sendStatus(204);next();});
app.use(express.json({limit:"1mb"}));
app.use(express.static(__dirname));
app.use("/api/",rateLimit({windowMs:60_000,limit:20,standardHeaders:true,legacyHeaders:false}));

const systemInstructions="تو AF4 AI هستی؛ دستیار شخصی هوش مصنوعی. با فارسی روان و طبیعی پاسخ بده. برای فرد مبتدی مراحل ساده و قابل اجرا بده. اگر چیزی را نمی‌دانی، صادقانه بگو و ادعای انجام کار نکن. کلیدها و اطلاعات محرمانه را افشا نکن.";
const cooldowns = new Map();
const providers = {
 gemini:{key:()=>process.env.GEMINI_API_KEY, model:()=>process.env.GEMINI_MODEL||"gemini-2.5-flash", url:"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"},
 groq:{key:()=>process.env.GROQ_API_KEY, model:()=>process.env.GROQ_MODEL||"llama-3.3-70b-versatile", url:"https://api.groq.com/openai/v1/chat/completions"},
 openrouter:{key:()=>process.env.OPENROUTER_API_KEY, model:()=>process.env.OPENROUTER_MODEL||"openrouter/free", url:"https://openrouter.ai/api/v1/chat/completions"}
};
function priority(){const requested=(process.env.AI_PROVIDER_PRIORITY||process.env.AI_PROVIDER||"gemini,groq,openrouter").split(",").map(x=>x.trim().toLowerCase());return [...new Set([...requested,"gemini","groq","openrouter"])].filter(x=>providers[x]);}
function shouldCool(status,body){const s=String(body||"").toLowerCase();return status===429||status>=500||/quota|rate.?limit|resource_exhausted|overloaded|timeout|temporarily unavailable/.test(s);}
app.get("/api/health",(_req,res)=>{const order=priority();res.json({ok:true,assistant:"AF4 AI",providers:order.map(name=>({name,configured:Boolean(providers[name].key()),available:Date.now()>=(cooldowns.get(name)||0)}))});});
app.post("/api/chat",async(req,res)=>{
 const messages=req.body?.messages;
 if(!Array.isArray(messages)||!messages.length||messages.length>40)return res.status(400).json({error:"ساختار پیام‌ها معتبر نیست."});
 const input=[];
 for(const m of messages){if(!m||!["user","assistant"].includes(m.role)||typeof m.content!=="string")return res.status(400).json({error:"ساختار یکی از پیام‌ها معتبر نیست."});input.push({role:m.role,content:m.content.slice(0,12000)});}
 const order=priority();let lastError="فعلاً هیچ سرویس آماده‌ای با کلید معتبر پیدا نشد.";
 for(const name of order){
  const p=providers[name],key=p.key();if(!key||Date.now()<(cooldowns.get(name)||0))continue;
  try{
   const response=await fetch(p.url,{method:"POST",headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json",...(name==="openrouter"?{"HTTP-Referer":"https://af4-ai.onrender.com","X-Title":"AF4 AI"}:{})},body:JSON.stringify({model:p.model(),messages:[{role:"system",content:systemInstructions},...input],max_tokens:1600}),signal:AbortSignal.timeout(45000)});
   const raw=await response.text();let data={};try{data=JSON.parse(raw)}catch{}
   if(!response.ok){lastError=data?.error?.message||raw||("HTTP "+response.status);if(shouldCool(response.status,lastError)){cooldowns.set(name,Date.now()+(response.status===429?5*60_000:60_000));console.warn("Provider cooldown:",name,response.status);continue;}return res.status(502).json({error:"سرویس "+name+" درخواست را نپذیرفت: "+String(lastError).slice(0,240)});}
   const reply=data.choices?.[0]?.message?.content;
   if(typeof reply!=="string"||!reply.trim()){lastError="پاسخ متنی دریافت نشد";cooldowns.set(name,Date.now()+60_000);continue;}
   return res.json({reply:reply.trim(),provider:name,model:p.model()});
  }catch(e){lastError=e?.name==="TimeoutError"?"مهلت پاسخ تمام شد":(e?.message||"خطای اتصال");cooldowns.set(name,Date.now()+60_000);console.warn("Provider failed:",name,e?.name||"Error");}
 }
 res.status(503).json({error:"همه سرویس‌های تنظیم‌شده فعلاً در دسترس نیستند. "+lastError});
});
app.get("*",(_req,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.listen(port,()=>console.log("AF4 AI running on "+port));
