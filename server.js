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
const OPENROUTER_DAILY_FREE_LIMIT_MS = 24 * 60 * 60 * 1000;
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
 gemini:{key:()=>getKey("gemini","GEMINI_API_KEY"), model:()=>process.env.GEMINI_MODEL||process.env.AI_MODEL||"gemini-3.8-flash", url:"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"},
 groq:{key:()=>getKey("groq","GROQ_API_KEY"), model:()=>process.env.GROQ_MODEL||"llama-3.3-70b-versatile", url:"https://api.groq.com/openai/v1/chat/completions"},
 openai:{key:()=>getKey("openai","OPENAI_API_KEY"), model:()=>process.env.OPENAI_MODEL||"gpt-4.1-mini", url:"https://api.openai.com/v1/chat/completions"},
 anthropic:{key:()=>getKey("anthropic","ANTHROPIC_API_KEY"), model:()=>process.env.ANTHROPIC_MODEL||"claude-sonnet-4-5", url:"https://api.anthropic.com/v1/messages"},
 openrouter:{key:()=>getKey("openrouter","OPENROUTER_API_KEY"), model:()=>{const configured=process.env.OPENROUTER_MODEL?.trim();return !configured?"openrouter/free":configured;}, url:"https://openrouter.ai/api/v1/chat/completions"},
 // Pollinations: استفاده فقط با کلید معتبر؛ endpoint قدیمی anonymous دیگر قابل اتکا نیست.
 pollinations:{key:()=>getKey("pollinations","POLLINATIONS_API_KEY"),model:()=>process.env.POLLINATIONS_MODEL||"openai",url:"https://gen.pollinations.ai/v1/chat/completions"}
};
// انتخاب مدل بر اساس نوع درخواست؛ در صورت خطا، سرویس بعدی امتحان می‌شود.
function priority(messages=[]){
 const text=messages.map(m=>String(m?.content||"")).join("\n").toLowerCase();
 const code=/\b(code|coding|program|programming|debug|javascript|typescript|python|github|repository|repo|api|sql|html|css|react|node|bug|stack trace|mql5)\b/i.test(text)||/کد|کدنویسی|برنامه.?نویسی|باگ|خطا|گیت.?هاب|متاتریدر/i.test(text);
 const deep=/\b(reason|reasoning|prove|proof|math|analy[sz]e|architecture|design system|research|strategy|compare|trade.?off)\b/i.test(text)||/استدلال|تحلیل عمیق|اثبات|ریاضی|معماری|مقایسه|تحقیق/i.test(text);
 const fast=/\b(quick|brief|short|translate|summari[sz]e|simple)\b/i.test(text)||/ترجمه|خلاصه|کوتاه|ساده/i.test(text);
 const taskOrder=code?["anthropic","openai","openrouter","gemini","groq"]:deep?["openai","anthropic","gemini","openrouter","groq"]:fast?["groq","gemini","openrouter","openai","anthropic"]:["gemini","openai","groq","anthropic","openrouter"];
 const configured=(process.env.AI_PROVIDER_PRIORITY||process.env.AI_PROVIDER||"").split(",").map(x=>x.trim().toLowerCase()).filter(x=>providers[x]);
 return [...new Set([...configured,...taskOrder,...Object.keys(providers)])].filter(x=>providers[x]);
}
function shouldCool(status,body){const s=String(body||"").toLowerCase();return status===429||status>=500||/quota|rate.?limit|resource_exhausted|overloaded|timeout|temporarily unavailable|billing|credit balance/.test(s);}
function wantsGoogleSearch(messages=[]){
 const q=messages.filter(m=>m?.role==="user").map(m=>String(m.content||"")).join("\n").toLowerCase();
 return /\b(latest|current|today|right now|news|recent|search the web|google search|look up|research|sources|citations|this week|this year|price today|weather|who won|what happened)\b/i.test(q)
 || /الان|امروز|جدیدترین|آخرین|اخبار|خبرهای|به.?روز|جست.?وجو|سرچ|گوگل|تحقیق|پژوهش|در وب|وب.?گردی|منابع|لینک منبع|قیمت روز|این هفته|امسال|چه اتفاقی افتاد|بررسی کن|اطلاعات جدید/i.test(q);
}

function decodeHtml(s=""){return String(s).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));}
async function searchWebWithoutKey(messages=[]){
 const query=messages.filter(m=>m?.role==="user").map(m=>String(m.content||"")).slice(-1).join(" ").trim().slice(0,280);
 if(!query)return "";
 try{
  const response=await fetch("https://html.duckduckgo.com/html/?q="+encodeURIComponent(query),{headers:{"User-Agent":"Mozilla/5.0 (compatible; AF4AI/1.0)","Accept":"text/html"},signal:AbortSignal.timeout(2500)});
  if(!response.ok)return "";
  const html=await response.text();
  const results=[];
  const re=/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<(?:a|div)[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/gi;
  let m;
  while((m=re.exec(html))&&results.length<4){
   let url=decodeHtml(m[1]).replace(/^\/\/duckduckgo\.com\/l\/\?uddg=/,"");
   try{if(url.startsWith("http")){}else if(url.includes("uddg="))url=new URL("https://duckduckgo.com"+m[1]).searchParams.get("uddg")||url;}catch{}
   const title=decodeHtml(m[2].replace(/<[^>]*>/g,"")).trim();
   const snippet=decodeHtml(m[3].replace(/<[^>]*>/g,"")).trim();
   if(title&&url.startsWith("http"))results.push({title,url,snippet});
  }
  if(!results.length)return "";
  return "\n\nنتایج جست‌وجوی زنده وب (DuckDuckGo؛ بدون کلید API). فقط از این نتایج برای اطلاعات به‌روز استفاده کن، ادعاها را با احتیاط بیان کن و منابع مرتبط را به‌صورت لینک بیاور:\n"+results.map((x,i)=>`[${i+1}] ${x.title}\n${x.snippet}\nURL: ${x.url}`).join("\n\n");
 }catch(e){console.warn("Keyless web search unavailable:",e?.name||"Error");return "";}
}

function geminiGroundedPayload(messages, userContext, model){
 return {
  contents:messages.map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]})),
  systemInstruction:{parts:[{text:systemInstructions+userContext}]},
  tools:[{google_search:{}}],
  generationConfig:{maxOutputTokens:1600,temperature:0.7}
 };
}

function safeError(value){let s=String(value||"خطای ناشناخته");for(const name of Object.keys(providers)){const env=name.toUpperCase()+"_API_KEYS";const all=[...(process.env[env]||"").split(",").map(x=>x.trim()).filter(Boolean),process.env[name.toUpperCase()+"_API_KEY"]].filter(Boolean);for(const k of all)s=s.split(k).join("[کلید محرمانه پنهان شد]");}return s.replace(/sk-or-v1-[a-f0-9]{20,}/gi,"[کلید محرمانه پنهان شد]").slice(0,220);}
app.get("/api/health",(_req,res)=>{const order=priority();res.json({ok:true,assistant:"AF4 AI",owner:"Abbas Faravani",providers:order.map(name=>({name,configured:name==="pollinations"||hasKeys(name, name.toUpperCase()+"_API_KEY"),available:Date.now()>=(cooldowns.get(name)||0)}))});});
app.post("/api/chat",async(req,res)=>{
 const messages=req.body?.messages;
 if(!Array.isArray(messages)||!messages.length||messages.length>40)return res.status(400).json({error:"ساختار پیام‌ها معتبر نیست."});
 const profile=req.body?.profile&&typeof req.body.profile==="object"?req.body.profile:{};
 const profileName=typeof profile.name==="string"?profile.name.trim().slice(0,60):"";
 const profileAbout=typeof profile.about==="string"?profile.about.trim().slice(0,1200):"";
 const userContext=profileName||profileAbout?`\nاطلاعات پروفایل کاربر فعلی این دستگاه (اطلاعات او را با سازنده اشتباه نگیر):\n- نامی که کاربر گفته: ${profileName||"هنوز اعلام نکرده"}\n- اطلاعاتی که خودش برای یادآوری وارد کرده: ${profileAbout||"چیزی وارد نشده"}\nبا نامی که خودش انتخاب کرده خطابش کن. این پروفایل را فقط به‌عنوان زمینهٔ همین کاربر در نظر بگیر و جزئیات تأییدنشده را حدس نزن.`:"\nکاربر فعلی هنوز نامش را اعلام نکرده؛ محترمانه و بدون حدس زدن نام او پاسخ بده. نام سازنده را فقط در پاسخ به سؤال صریح دربارهٔ سازنده مطرح کن.";
 const input=[];
 for(const m of messages){if(!m||!["user","assistant"].includes(m.role)||typeof m.content!=="string")return res.status(400).json({error:"ساختار یکی از پیام‌ها معتبر نیست."});input.push({role:m.role,content:m.content.slice(0,12000)});}
 const requestDeadline=Date.now()+25000;
 const needsWeb=wantsGoogleSearch(input);
 const webContext=needsWeb?await searchWebWithoutKey(input):"";
 const webInstructions=needsWeb&&!webContext?"\nکاربر درخواست اطلاعات به‌روز یا پژوهش وب کرده است، اما جست‌وجوی وب در این درخواست نتیجه نداد؛ صادقانه بگو نتوانستی وب را بررسی کنی و اطلاعات تازه را حدس نزن.":"";
 const contextualInstructions=systemInstructions+userContext+(webContext||"")+webInstructions;
 const order=priority(input);let lastError="فعلاً هیچ سرویس آماده‌ای با کلید معتبر پیدا نشد.";let openRouterDailyLimit=false;
 for(const name of order){
  if(Date.now()>=requestDeadline)break;
  const p=providers[name];
  const key=p.key();
  if(!key||Date.now()<(cooldowns.get(name)||0))continue;
  const models=name==="openrouter"
   ? [...new Set([p.model(),"openrouter/free","nvidia/nemotron-3.5-lightning:free","nvidia/nemotron-3-ultra:free","nvidia/nemotron-3.5-super-vl:free","poolside/laguna-s-2.1:free","dots-studio/dots-3-note-preview:free"])]
   : [p.model()];
  let providerHadTransientFailure=false;
  for(const model of models){
   if(Date.now()>=requestDeadline)break;
   try{
    const isAnthropic=name==="anthropic";
    const useGoogleSearch=name==="gemini"&&wantsGoogleSearch(input);
    const headers=isAnthropic
     ?{"x-api-key":key,"anthropic-version":"2023-06-01","content-type":"application/json"}
     :{"Authorization":"Bearer "+key,"Content-Type":"application/json",...(name==="openrouter"?{"HTTP-Referer":"https://af4-ai.onrender.com","X-Title":"AF4 AI"}:{})};
    const endpoint=useGoogleSearch
     ?`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`
     :p.url;
    const requestHeaders=useGoogleSearch?{"Content-Type":"application/json"}:headers;
    const payload=useGoogleSearch
     ?geminiGroundedPayload(input,contextualInstructions,model)
     :isAnthropic
      ?{model,max_tokens:1600,system:contextualInstructions,messages:input}
      :{model,messages:[{role:"system",content:contextualInstructions},...input],max_tokens:1600};
    const response=await fetch(endpoint,{method:"POST",headers:requestHeaders,body:JSON.stringify(payload),signal:AbortSignal.timeout(Math.min(name==="pollinations"?6000:7000,Math.max(1000,requestDeadline-Date.now())))});
    const raw=await response.text();
    let data={};try{data=JSON.parse(raw)}catch{}
    if(!response.ok||data?.error){
     const status=response.status||Number(data?.error?.code)||502;
     lastError=safeError(data?.error?.message||data?.message||raw||("HTTP "+status));
     if(name==="openrouter"&&/free-models-per-day/i.test(lastError)){
      openRouterDailyLimit=true;
      providerHadTransientFailure=false;
      cooldowns.set(name,Date.now()+OPENROUTER_DAILY_FREE_LIMIT_MS);
      console.warn("OpenRouter daily free-model quota exhausted; pausing retries for 24 hours.");
      break;
     }
     if(shouldCool(status,lastError)||status===408){
      providerHadTransientFailure=true;
      console.warn("Provider/model temporarily unavailable; trying fallback:",name,model,status);
     }else{
      console.warn("Provider/model rejected request; trying fallback:",name,model,status);
     }
     continue;
    }
    const choice=data?.choices?.[0];
    const geminiCandidate=useGoogleSearch?data?.candidates?.[0]:null;
    let reply=useGoogleSearch
     ?(geminiCandidate?.content?.parts||[]).map(part=>part?.text||"").filter(Boolean).join("\n")
     :isAnthropic
      ?data.content?.filter(x=>x.type==="text").map(x=>x.text).join("\n")
      :(choice?.message?.content??choice?.text??data?.output_text);
    if(Array.isArray(reply))reply=reply.map(part=>typeof part==="string"?part:(part?.text||part?.content||"")).filter(Boolean).join("\n");
    if(useGoogleSearch&&typeof reply==="string"){
     const chunks=geminiCandidate?.groundingMetadata?.groundingChunks||[];
     const sources=[...new Map(chunks.map(x=>x?.web).filter(x=>x?.uri).map(x=>[x.uri,x])).values()].slice(0,5);
     if(sources.length)reply+="\n\nمنابع گوگل:\n"+sources.map((s,i)=>`[${i+1}] ${s.title||s.uri} — ${s.uri}`).join("\n");
    }
    if(typeof reply!=="string"||!reply.trim()){
     lastError="مدل پاسخ متنی خالی برگرداند";
     console.warn("Provider/model returned no text; trying fallback:",name,model);
     continue;
    }
    if(/^\s*(?:(?:user\s+safety|safety|moderation)\s*:\s*(?:safe|unsafe|allowed|blocked)\s*)+$/i.test(reply.trim())){
     lastError="مدل به‌جای پاسخ، برچسب ایمنی برگرداند";
     console.warn("Provider/model returned moderation metadata; trying fallback:",name,model);
     continue;
    }
    cooldowns.delete(name);
    return res.json({reply:reply.trim(),provider:name,model});
   }catch(e){
    lastError=safeError(e?.name==="TimeoutError"?"مهلت پاسخ تمام شد":(e?.message||"خطای اتصال"));
    providerHadTransientFailure=true;
    console.warn("Provider/model failed; trying fallback:",name,model,e?.name||"Error");
   }
  }
  // Cool down the provider only after all its candidate models failed.
  if(providerHadTransientFailure)cooldowns.set(name,Date.now()+30_000);
 }
 if(Date.now()>=requestDeadline)lastError="زمان تلاش برای سرویس‌ها تمام شد؛ لطفاً دوباره تلاش کن یا یک سرویس معتبر اضافه کن.";
 const hasAnyConfiguredProvider=Object.keys(providers).some(name=>hasKeys(name,name.toUpperCase()+"_API_KEY"));
 const help=openRouterDailyLimit
  ? (hasAnyConfiguredProvider?" سهمیه رایگان OpenRouter تمام شده است و سرویس‌های جایگزینِ دارای کلید هم پاسخ نداده‌اند.":" سهمیه رایگان OpenRouter تمام شده و هیچ سرویس جایگزین با کلید معتبر تنظیم نشده است. برای برگشت پاسخ‌گویی، باید یک کلید API رایگان معتبر به Environment در Render اضافه شود؛ بدون آن نمی‌شود پاسخ هوش مصنوعی را تضمین کرد.")
  : (!hasAnyConfiguredProvider?" هیچ سرویس هوش مصنوعی با کلید معتبر تنظیم نشده است. افزودن یک کلید API رایگان معتبر در Environment در Render لازم است؛ سرویس‌های بدون کلید قابل اتکا نیستند.":"");
 res.status(503).json({error:"فعلاً هیچ سرویس هوش مصنوعیِ قابل‌استفاده پاسخ نداد. "+lastError+help});
});
app.get("*",(_req,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.listen(port,()=>console.log("AF4 AI running on "+port));
