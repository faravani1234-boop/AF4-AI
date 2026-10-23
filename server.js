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

const systemInstructions = `تو AF4 AI هستی؛ دستیار هوش مصنوعی با برند AF4.
هویت و لحن:
- در پاسخ‌های معمولی مثل سلام‌وعلیک، احوال‌پرسی، پاسخ به سؤال‌ها و کمک‌های روزمره، نام سازنده یا صاحب برنامه را خودت پیش نکش و از نام شخصی او حرف نزن. برند AF4 / AF4 AI را در صورت مرتبط بودن می‌توانی ذکر کنی.
- فقط وقتی کاربر صریحاً می‌پرسد چه کسی تو را ساخته، چه کسی سازنده یا صاحب AF4 AI است، یا سؤال روشنی با همین معنا می‌پرسد، پاسخ بده: «عباس فراوانی من را ساخته و روی توسعه‌ام کار می‌کند.» در غیر این صورت نام عباس فراوانی را داوطلبانه مطرح نکن.
- با کاربر فعلی فارسی روان، صمیمی و محترمانه صحبت کن؛ اگر نامی در پروفایل او ثبت شده، همان نام را به کار ببر. لحن دوستانه‌اش را هماهنگ کن، اما پاسخ‌ها دقیق و حرفه‌ای بمانند.
- سازندهٔ برنامه، عباس فراوانی، در برنامه‌نویسی و ساخت نرم‌افزار مبتدی است؛ در گفتگو با خود او آموزش‌ها را ساده، مرحله‌به‌مرحله و بدون اصطلاحات بی‌توضیح ارائه کن. برای دیگر کاربران، نیازها و سطح مهارت خودشان را ملاک قرار بده.
- عباس فراوانی دوست دارد سازنده باشد و پروژه‌ها را واقعاً اجرا کند، نه فقط درباره‌شان حرف بزند. وقتی با او کار می‌کنی، کار را به قدم‌های کوچک و قابل‌آزمایش تقسیم کن و موفقیت را بدون بررسی ادعا نکن.
اطلاعات شناخته‌شده درباره صاحب پروژه:
- نام دقیق صاحب و سازنده: عباس فراوانی (املای درست نام خانوادگی: فراوانی). اگر پرسیدند چه کسی تو را ساخته، همین نام را بدون تغییر بگو.
- نام دستیار و برند پروژه: AF4 / AF4 AI.
- پروژه‌ها و علایق شناخته‌شدهٔ سازنده (نه لزوماً کاربر فعلی): توسعه همین دستیار هوش مصنوعی، ساخت ابزارها و نرم‌افزارها، یادگیری AI و برنامه‌نویسی، اکسپرت معاملاتی AF4 برای MetaTrader 5، معامله‌گری پرایس‌اکشن روی Dow Jones در تایم‌فریم ۵ دقیقه، و ایده‌های تولیدی و محصولات فیزیکی تحت برند AF4 از جمله پایه باند دیواری و دکور فلزی. همچنین در حوزه املاک فعالیت دارد.
- برای پروژه‌های فنی، تغییرات موجود را حفظ کن و بی‌دلیل ساختار یا قابلیت‌های دیگر را عوض نکن. ترجیح او این است که کار دقیق، حرفه‌ای و آماده آزمایش باشد.
قواعد پاسخ:
- اطلاعات مربوط به سازنده را با اطلاعات کاربر فعلی قاطی نکن. اگر اطلاعات کافی درباره هرکدام نداری، صادقانه بگو و از ساختن خاطره یا جزئیات خودداری کن.
- تاریخچه پیام‌های ارسال‌شده در درخواست فعلی را به‌عنوان زمینه استفاده کن، اما ادعا نکن که به تمام گفتگوهای قبلی یا اطلاعات دائمی خارج از آن دسترسی داری.
- هیچ‌وقت کلید API، رمز عبور یا اطلاعات محرمانه را در پاسخ بازگو نکن. هرگز ادعا نکن مستقیماً به سرورهای ChatGPT/OpenAI وصل هستی؛ فقط از سرویس و مدل واقعی‌ای که سرور گزارش می‌کند نام ببر.
- اگر چیزی را واقعاً اجرا، ذخیره، جست‌وجو یا آزمایش نکرده‌ای، نگو انجامش داده‌ای. `;
const cooldowns = new Map();
const keyIndexes = new Map();
function getKey(provider, legacyEnv) {
 const many = (process.env[provider.toUpperCase()+"_API_KEYS"] || "").split(",").map(x=>x.trim()).filter(Boolean);
 const legacy = process.env[legacyEnv]?.trim();
 const keys = [...new Set([...many, ...(legacy ? [legacy] : [])])];
 if (!keys.length) return "";
 const index = keyIndexes.get(provider) || 0;
 keyIndexes.set(provider, (index + 1) % keys.length);
 return keys[index % keys.length];
}
function hasKeys(provider, legacyEnv) {
 return Boolean((process.env[provider.toUpperCase()+"_API_KEYS"] || "").split(",").some(x=>x.trim()) || process.env[legacyEnv]?.trim());
}
const providers = {
 gemini:{key:()=>getKey("gemini","GEMINI_API_KEY"), model:()=>process.env.GEMINI_MODEL||process.env.AI_MODEL||"gemini-2.5-flash", url:"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"},
 groq:{key:()=>getKey("groq","GROQ_API_KEY"), model:()=>process.env.GROQ_MODEL||"llama-3.3-70b-versatile", url:"https://api.groq.com/openai/v1/chat/completions"},
 openai:{key:()=>getKey("openai","OPENAI_API_KEY"), model:()=>process.env.OPENAI_MODEL||"gpt-4.1-mini", url:"https://api.openai.com/v1/chat/completions"},
 anthropic:{key:()=>getKey("anthropic","ANTHROPIC_API_KEY"), model:()=>process.env.ANTHROPIC_MODEL||"claude-sonnet-4-5", url:"https://api.anthropic.com/v1/messages"},
 openrouter:{key:()=>getKey("openrouter","OPENROUTER_API_KEY"), model:()=>process.env.OPENROUTER_MODEL||"openrouter/free", url:"https://openrouter.ai/api/v1/chat/completions"}
};
// انتخاب مدل بر اساس نوع درخواست؛ در صورت خطا، سرویس بعدی امتحان می‌شود.
function priority(messages=[]){
 const text=messages.map(m=>String(m?.content||"")).join("\n").toLowerCase();
 const code=/\b(code|coding|program|programming|debug|javascript|typescript|python|github|repository|repo|api|sql|html|css|react|node|bug|stack trace|mql5)\b/i.test(text)||/کد|کدنویسی|برنامه.?نویسی|باگ|خطا|گیت.?هاب|متاتریدر/i.test(text);
 const deep=/\b(reason|reasoning|prove|proof|math|analy[sz]e|architecture|design system|research|strategy|compare|trade.?off)\b/i.test(text)||/استدلال|تحلیل عمیق|اثبات|ریاضی|معماری|مقایسه|تحقیق/i.test(text);
 const fast=/\b(quick|brief|short|translate|summari[sz]e|simple)\b/i.test(text)||/ترجمه|خلاصه|کوتاه|ساده/i.test(text);
 const taskOrder=code?["anthropic","openai","openrouter","gemini","groq"]:deep?["openai","anthropic","gemini","openrouter","groq"]:fast?["groq","gemini","openrouter","openai","anthropic"]:["gemini","openai","groq","anthropic","openrouter"];
 const configured=(process.env.AI_PROVIDER_PRIORITY||process.env.AI_PROVIDER||"").split(",").map(x=>x.trim().toLowerCase()).filter(x=>providers[x]);
 return [...new Set([...taskOrder,...configured,...Object.keys(providers)])].filter(x=>providers[x]);
}
function shouldCool(status,body){const s=String(body||"").toLowerCase();return status===429||status>=500||/quota|rate.?limit|resource_exhausted|overloaded|timeout|temporarily unavailable|billing|credit balance/.test(s);}
function safeError(value){let s=String(value||"خطای ناشناخته");for(const name of Object.keys(providers)){const env=name.toUpperCase()+"_API_KEYS";const all=[...(process.env[env]||"").split(",").map(x=>x.trim()).filter(Boolean),process.env[name.toUpperCase()+"_API_KEY"]].filter(Boolean);for(const k of all)s=s.split(k).join("[کلید محرمانه پنهان شد]");}return s.replace(/sk-or-v1-[a-f0-9]{20,}/gi,"[کلید محرمانه پنهان شد]").slice(0,220);}
app.get("/api/health",(_req,res)=>{const order=priority();res.json({ok:true,assistant:"AF4 AI",owner:"Abbas Faravani",providers:order.map(name=>({name,configured:hasKeys(name, name.toUpperCase()+"_API_KEY"),available:Date.now()>=(cooldowns.get(name)||0)}))});});
app.post("/api/chat",async(req,res)=>{
 const messages=req.body?.messages;
 if(!Array.isArray(messages)||!messages.length||messages.length>40)return res.status(400).json({error:"ساختار پیام‌ها معتبر نیست."});
 const profile=req.body?.profile&&typeof req.body.profile==="object"?req.body.profile:{};
 const profileName=typeof profile.name==="string"?profile.name.trim().slice(0,60):"";
 const profileAbout=typeof profile.about==="string"?profile.about.trim().slice(0,1200):"";
 const userContext=profileName||profileAbout?`\nاطلاعات پروفایل کاربر فعلی این دستگاه (اطلاعات او را با سازنده اشتباه نگیر):\n- نامی که کاربر گفته: ${profileName||"هنوز اعلام نکرده"}\n- اطلاعاتی که خودش برای یادآوری وارد کرده: ${profileAbout||"چیزی وارد نشده"}\nبا نامی که خودش انتخاب کرده خطابش کن. این پروفایل را فقط به‌عنوان زمینهٔ همین کاربر در نظر بگیر و جزئیات تأییدنشده را حدس نزن.`:"\nکاربر فعلی هنوز نامش را اعلام نکرده؛ با احترام از او بپرس دوست دارد چه صدایش کنی. سازندهٔ برنامه همچنان عباس فراوانی است.";
 const input=[];
 for(const m of messages){if(!m||!["user","assistant"].includes(m.role)||typeof m.content!=="string")return res.status(400).json({error:"ساختار یکی از پیام‌ها معتبر نیست."});input.push({role:m.role,content:m.content.slice(0,12000)});}
 const order=priority(input);let lastError="فعلاً هیچ سرویس آماده‌ای با کلید معتبر پیدا نشد.";
 for(const name of order){
  const p=providers[name],key=p.key();if(!key||Date.now()<(cooldowns.get(name)||0))continue;
  try{
   const isAnthropic=name==="anthropic";
   const headers=isAnthropic
    ?{"x-api-key":key,"anthropic-version":"2023-06-01","content-type":"application/json"}
    :{"Authorization":"Bearer "+key,"Content-Type":"application/json",...(name==="openrouter"?{"HTTP-Referer":"https://af4-ai.onrender.com","X-Title":"AF4 AI"}:{})};
   const payload=isAnthropic
    ?{model:p.model(),max_tokens:1600,system:systemInstructions+userContext,messages:input}
    :{model:p.model(),messages:[{role:"system",content:systemInstructions+userContext},...input],max_tokens:1600};
   const response=await fetch(p.url,{method:"POST",headers,body:JSON.stringify(payload),signal:AbortSignal.timeout(45000)});
   const raw=await response.text();let data={};try{data=JSON.parse(raw)}catch{}
   if(!response.ok){
    lastError=safeError(data?.error?.message||data?.message||raw||("HTTP "+response.status));
    const wait=response.status===429?5*60_000:(response.status>=500?60_000:((response.status===401||response.status===403)?0:10*60_000));
    if(wait)cooldowns.set(name,Date.now()+wait); else cooldowns.delete(name);
    console.warn("Provider rejected request; trying fallback:",name,response.status);
    continue;
   }
   const reply=isAnthropic?data.content?.filter(x=>x.type==="text").map(x=>x.text).join("\n"):data.choices?.[0]?.message?.content;
   if(typeof reply!=="string"||!reply.trim()){lastError="پاسخ متنی دریافت نشد";cooldowns.set(name,Date.now()+60_000);continue;}
   return res.json({reply:reply.trim(),provider:name,model:p.model()});
  }catch(e){lastError=safeError(e?.name==="TimeoutError"?"مهلت پاسخ تمام شد":(e?.message||"خطای اتصال"));cooldowns.set(name,Date.now()+60_000);console.warn("Provider failed:",name,e?.name||"Error");}
 }
 res.status(503).json({error:"همه سرویس‌های تنظیم‌شده فعلاً در دسترس نیستند. "+lastError});
});
app.get("*",(_req,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.listen(port,()=>console.log("AF4 AI running on "+port));
