const $=id=>document.getElementById(id);
const form=$("chatForm"),input=$("messageInput"),messages=$("messages"),welcome=$("welcome"),history=$("history");
const DEFAULT_API_BASE_URL="https://af4-ai.onrender.com";
const STORAGE="af4-ai-history-v1",SETTINGS="af4-ai-settings-v2",PROFILE_KEY="af4-ai-profile-v1",MEMORY_KEY="af4-ai-local-memory-v1";
let profile={name:"",about:"",tone:"friendly"};let localMemoryNotes="";let deferredInstallPrompt=null;let recognition=null;let listening=false;
let sessions=[],currentSession=[],sending=false;
const prefersDark=()=>window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;
try{sessions=JSON.parse(localStorage.getItem(STORAGE)||"[]");if(!Array.isArray(sessions))sessions=[];}catch{}
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(sessions.slice(-40)));}catch{}}
function settingsValue(){const entered=String($("apiBaseUrl")?.value||"").trim();return{name:"AF4 AI",color:"purple",theme:"dark",compact:false,apiBaseUrl:(entered||DEFAULT_API_BASE_URL).replace(/\/+$/,"")};}
function loadProfile(){try{const p=JSON.parse(localStorage.getItem(PROFILE_KEY)||"{}");profile={name:String(p.name||"").slice(0,60),about:String(p.about||"").slice(0,1200),tone:["friendly","professional","concise","detailed"].includes(p.tone)?p.tone:"friendly"};}catch{profile={name:"",about:"",tone:"friendly"};} $("profileName").value=profile.name;$("profileAbout").value=profile.about;$("toneSelect").value=profile.tone||"friendly";updateIdentity();}
function loadLocalMemory(){
 try{localMemoryNotes=String(localStorage.getItem(MEMORY_KEY)||"").slice(0,2000);}catch{localMemoryNotes="";}
 const field=$("localMemoryNotes");if(field)field.value=localMemoryNotes;
 const status=$("localMemoryStatus");if(status)status.textContent=localMemoryNotes?"حافظهٔ محلی بارگذاری شد.":"هنوز یادداشتی ذخیره نشده است.";
}
function saveLocalMemory(){
 const field=$("localMemoryNotes");localMemoryNotes=String(field?.value||"").trim().slice(0,2000);
 try{localStorage.setItem(MEMORY_KEY,localMemoryNotes);}catch{}
 if(field)field.value=localMemoryNotes;
 const status=$("localMemoryStatus");if(status)status.textContent=localMemoryNotes?"حافظهٔ محلی ذخیره شد.":"حافظه خالی است.";
}
function clearLocalMemory(){
 localMemoryNotes="";try{localStorage.removeItem(MEMORY_KEY);}catch{}
 const field=$("localMemoryNotes");if(field)field.value="";
 const status=$("localMemoryStatus");if(status)status.textContent="حافظهٔ محلی پاک شد.";
}
function rememberExplicitly(raw){
 const match=String(raw||"").trim().match(/^(?:یادت باشه|به خاطر بسپار|یادت بمونه|یادت نره|این رو یادداشت کن)\s*[:،-]?\s*(.{3,240})$/i);
 if(!match)return;
 const note=match[1].trim();
 if(/رمز|پسورد|گذرواژه|کد ملی|شماره کارت|شماره حساب|api[ -]?key|token|password|secret/i.test(note))return;
 const items=localMemoryNotes.split(/\n/).map(x=>x.trim()).filter(Boolean);
 if(items.some(x=>x.toLowerCase()===note.toLowerCase()))return;
 items.push(note);localMemoryNotes=items.slice(-20).join("\n").slice(0,2000);
 try{localStorage.setItem(MEMORY_KEY,localMemoryNotes);}catch{}
 const field=$("localMemoryNotes");if(field)field.value=localMemoryNotes;
 const status=$("localMemoryStatus");if(status)status.textContent="این نکته در حافظهٔ محلی همین دستگاه ذخیره شد.";
}
function saveProfile(){profile={name:$("profileName").value.trim().slice(0,60),about:$("profileAbout").value.trim().slice(0,1200),tone:$("toneSelect").value};try{localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));}catch{}updateIdentity();}
function updateIdentity(){$("topUserName").textContent=profile.name||"پروفایل شما";$("welcomeName").textContent=profile.name||"دوست من";$("profileButton").setAttribute("aria-label",profile.name?("پروفایل "+profile.name):"پروفایل کاربر");}
function saveSettings(){try{localStorage.setItem(SETTINGS,JSON.stringify(settingsValue()));}catch{}}
function applySettings(){document.body.classList.remove("accent-blue","accent-green","accent-pink","compact");document.body.classList.add("dark");$("themeSelect").value="dark";$("assistantName").value="AF4 AI";$("accentColor").value="purple";$("compactMode").checked=false;$("themeToggle").textContent="☾";$("themeToggle").title="ظاهر تاریک AF4";document.querySelector('meta[name="theme-color"]')?.setAttribute("content","#0b0b12");}
try{const s=JSON.parse(localStorage.getItem(SETTINGS)||"{}");if(s.name)$("assistantName").value=s.name;if(s.color)$("accentColor").value=s.color;if(s.theme)$("themeSelect").value=s.theme;else if(s.dark)$("themeSelect").value="dark";if(s.compact)$("compactMode").checked=true;$("apiBaseUrl").value=s.apiBaseUrl||DEFAULT_API_BASE_URL;}catch{$("apiBaseUrl").value=DEFAULT_API_BASE_URL;}
function renderHistory(){history.replaceChildren();const valid=sessions.filter(s=>s&&Array.isArray(s.items)&&s.items.length);if(!valid.length){const p=document.createElement("p");p.className="empty-history";p.textContent="گفت‌وگوهای جدیدت اینجا می‌مانند.";history.append(p);return;}valid.slice().reverse().forEach(s=>{const b=document.createElement("button");b.className="history-item";b.textContent=s.title||"گفت‌وگوی جدید";b.title=b.textContent;b.onclick=()=>loadSession(s);history.append(b);});}
function startNewChat(){currentSession=[];messages.replaceChildren();welcome.hidden=false;input.value="";input.style.height="auto";$("sidebar").classList.remove("open");$("mobileScrim").classList.remove("active");renderHistory();input.focus();}
function loadSession(s){currentSession=s.items;messages.replaceChildren();welcome.hidden=!currentSession.length;currentSession.forEach(m=>addMessage(m.role,m.text,false,m.provider,m.model));$("sidebar").classList.remove("open");$("mobileScrim").classList.remove("active");}
function addMessage(role,text,save=true,provider=null,model=null){const article=document.createElement("article");article.className="message "+role;const label=document.createElement("div");label.className="message-label";if(role==="user")label.textContent=profile.name||"شما";else if(provider==="sticker")label.textContent="AF4 AI · استیکر";else if(provider){label.textContent="پاسخ از "+({gemini:"Gemini",groq:"Groq",openrouter:"OpenRouter"}[provider]||provider)+(model?" · "+model:"");label.dataset.provider=provider;}else label.textContent=$("assistantName").value.trim()||"AF4 AI";const body=document.createElement("div");body.className="message-body";if(provider==="sticker"&&model){const img=document.createElement("img");img.className="chat-sticker";img.src=model;img.alt=text||"استیکر AF4";img.loading="lazy";body.append(img);}else body.textContent=text;article.append(label,body);if(role==="assistant"&&provider!=="sticker"&&text&&text!=="دارم پاسخ رو آماده می‌کنم…"){const speak=document.createElement("button");speak.type="button";speak.className="message-speak";speak.textContent="🔊";speak.title="خواندن پاسخ با صدا";speak.setAttribute("aria-label","خواندن پاسخ با صدا");speak.addEventListener("click",()=>speakText(text));article.append(speak);}messages.append(article);if(save){currentSession.push({role,text,...(provider?{provider}:{}),...(model?{model}:{})});let s=sessions.find(x=>x.items===currentSession);if(!s){s={title:role==="user"?text.slice(0,38):"گفت‌وگوی جدید",items:currentSession};sessions.push(s);}if(s.title==="گفت‌وگوی جدید"&&role==="user")s.title=text.slice(0,38);persist();renderHistory();}const area=$("chatArea");area.scrollTop=area.scrollHeight;return article;}
function normalizeQuickText(value){return String(value||"").toLowerCase().replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/[\u200c\u200d]/g," ").replace(/[؟?!.,،؛:؛"'`()[\]{}]+/g," ").replace(/\s+/g," ").trim();}
function getInstantReply(raw){
 const q=normalizeQuickText(raw);
 if(!q||q.length>100)return null;
 const who=profile.name?profile.name.trim():"دوست من";
 const matches=(re)=>re.test(q);
 if(matches(/^(سلام|سلام علیکم|درود|های|هی|هلو|hello|hi|hey)( داداش| رفیق| عزیز| af4| ای آی)?( خوبی| چطوری| حالت چطوره| حالت خوبه)?$/))return "سلام "+who+"! حالت چطوره؟ چطور می‌تونم کمکت کنم؟";
 if(matches(/^(صبح بخیر|صبحت بخیر|صبح به خیر)$/))return "صبح بخیر "+who+"! امیدوارم روز خوبی داشته باشی. چه کمکی از دستم برمیاد؟";
 if(matches(/^(شب بخیر|شبت بخیر|شب به خیر)$/))return "شب بخیر "+who+"! امیدوارم شب آرومی داشته باشی.";
 if(matches(/^(عصر بخیر|عصرت بخیر|روز بخیر)$/))return "روزت بخیر "+who+"! بگو ببینم چطور می‌تونم کمکت کنم؟";
 if(matches(/^(خوبی|خوبی تو|حالت چطوره|حالت چطوره تو|چطوری|چه طوری|چطوری داداش|چطوری رفیق|حالت خوبه|خوب هستی|خوبی؟)$/))return "مرسی "+who+"، خوبم و آماده‌ام کمکت کنم! تو چطوری؟";
 if(matches(/^(چه خبر|چخبر|خبری هست|اوضاع چطوره)$/))return "خبر خاصی نیست، من آماده‌ام هر کاری از دستم برمیاد برات انجام بدم! تو چه خبر؟";
 if(matches(/^(ممنون|مرسی|ممنونم|دمت گرم|سپاس|سپاسگزارم|تشکر|خیلی ممنون|متشکرم)( ازت| داداش| رفیق)?$/))return "خواهش می‌کنم "+who+"! هر وقت خواستی من اینجام.";
 if(matches(/^(خداحافظ|خدانگهدار|فعلا|فعلاً|بای|بای بای|میبینمت|می بینمت)$/))return "فعلاً "+who+"! هر وقت برگشتی، از همین‌جا ادامه می‌دیم.";
 if(matches(/^(تو کی هستی|تو چی هستی|خودتو معرفی کن|خودت رو معرفی کن|اسم تو چیه|اسمت چیه|نامت چیه|تو چه اسمی داری)$/))return "من AF4 AI هستم؛ دستیار هوشمند با برند AF4. اینجام تا به سؤال‌هات جواب بدم و توی کارهات کمکت کنم.";
 if(matches(/^(برندت چیه|اسم برندت چیه|برند تو چیه|اسم برند شما چیه|اسم برنامه چیه|اسم این برنامه چیه)$/))return "برند من AF4 و اسم دستیار AF4 AI هست.";
 if(matches(/^(سازنده ات کیه|سازنده ات چیه|سازنده ت کیه|سازنده تو کیه|اسم سازنده ات چیه|نام سازنده ات چیست|کی تو رو ساخته|کی تو را ساخته|چه کسی تو را ساخته|چه کسی تو رو ساخته|چه کسی ساخته ات|کی ساختت|صاحب تو کیه|سازنده af4 کیه|سازنده af4 ai کیه)$/))return "من توسط عباس فراوانی ساخته شده‌ام و روی توسعه‌ام کار می‌کند.";
 if(matches(/^(اسم من چیه|نام من چیه|من کی هستم|من کی ام)$/))return profile.name?"اسمی که در پروفایلت ثبت کردی «"+profile.name+"» هست.":"هنوز اسمت رو در پروفایل بهم نگفتی؛ اگر بگی، می‌تونم در همین برنامه ازش استفاده کنم.";
 if(matches(/^(میتونی کمکم کنی|می تونی کمکم کنی|میتونی کمک کنی|کمکم میکنی|کمکم می کنی|میشه کمکم کنی)$/))return "حتماً "+who+"! بگو چی لازم داری تا با هم حلش کنیم.";
 if(matches(/^(چیکار میکنی|چه کار میکنی|چه کاری بلدی|چه کمکی میتونی بکنی|چه کارهایی بلدی)$/))return "می‌تونم به سؤال‌هات جواب بدم، متن بنویسم، ایده‌پردازی کنم، مفاهیم رو توضیح بدم و در کارهای فنی کمکت کنم. برای سؤال‌های نیازمند اطلاعات روز، باید به سرویس آنلاین و جست‌وجو دسترسی داشته باشم.";
 if(matches(/^(تو هوش مصنوعی هستی|هوش مصنوعی هستی|رباتی|تو رباتی)$/))return "بله، من AF4 AI هستم؛ یک دستیار هوش مصنوعی با برند AF4.";
 if(matches(/^(چی صدات کنم|چطور صدات کنم|چجوری صدات کنم|به چه اسمی صدات کنم|اسم دستیار چیه|نام دستیار چیه)$/))return "می‌تونی من رو AF4 AI صدا کنی.";
 if(matches(/^(چند سالته|سن تو چقدره|چند سال داری|چند سالته تو)$/))return "من هوش مصنوعی‌ام و مثل انسان سن یا تاریخ تولد شخصی ندارم.";
 if(matches(/^(اهل کجایی|کجایی|کجا زندگی میکنی|کجا زندگی می کنی|تو کجا هستی|از کجا اومدی)$/))return "من مکان زندگی فیزیکی ندارم؛ داخل برنامه AF4 AI در دسترسم.";
 if(matches(/^(انسان هستی|تو انسانی|واقعی هستی|تو واقعی هستی|آدمی|تو آدمی)$/))return "من انسان نیستم؛ یک دستیار هوش مصنوعی هستم که برای گفتگو و کمک طراحی شده.";
 if(matches(/^(احساس داری|احساسات داری|خوشحالی|ناراحت میشی|عصبانی میشی)$/))return "من احساسات انسانی ندارم، اما می‌تونم با دقت و همدلی به حرف‌هات پاسخ بدم.";
 if(matches(/^(فارسی بلدی|فارسی حرف میزنی|میتونی فارسی حرف بزنی|میشه فارسی صحبت کنیم|زبان فارسی بلدی)$/))return "بله، فارسی رو پشتیبانی می‌کنم؛ راحت و فارسی باهام صحبت کن.";
 if(matches(/^(چه زبان هایی بلدی|چه زبانهایی بلدی|به چه زبان هایی صحبت میکنی|زبانت چیه)$/))return "می‌تونم به فارسی و چندین زبان رایج دیگه کمک کنم؛ زبان موردنظرت رو بگو.";
 if(matches(/^(یادت میاد من کیم|منو میشناسی|منو می شناسی|منو یادت هست|منو به یاد داری)$/))return profile.name?"در این برنامه نامی که در پروفایلت ثبت شده «"+profile.name+"» هست. اطلاعاتی خارج از چیزهایی که در دسترسمه رو حدس نمی‌زنم.":"هنوز نامی در پروفایلت ثبت نشده؛ اگر دوست داری از بخش پروفایل واردش کن.";
 if(matches(/^(آنلاین هستی|وصل هستی|به اینترنت وصلی|سرور وصله|الان کار میکنی|الان کار می کنی)$/))return "پاسخ‌های ساده مثل سلام و احوال‌پرسی رو مستقیم روی گوشی می‌دم؛ برای سؤال‌های پیچیده یا اطلاعات روز، اتصال اینترنت و سرویس هوش مصنوعی لازمه.";
 if(matches(/^(آفلاین کار میکنی|بدون اینترنت کار میکنی|بدون اینترنت کار می کنی|اینترنت لازم داری)$/))return "پاسخ‌های آماده و ساده رو بدون اینترنت می‌دم؛ اما سؤال‌های پیچیده و جست‌وجوی وب به اتصال اینترنت نیاز دارن.";
 if(matches(/^(خوشبختم|از آشناییت خوشبختم|از آشنایی باهات خوشحالم)$/))return "من هم خوشحالم که باهات آشنا شدم "+who+"! هر وقت خواستی صحبت کنیم.";
 if(matches(/^(من خوبم|خوبم مرسی|من خوبم مرسی|عالی ام|عالی‌ام|منم خوبم|من هم خوبم)$/))return "چه عالی "+who+"! امیدوارم همیشه حالت خوب باشه. امروز چطور می‌تونم کمکت کنم؟";
 if(matches(/^(ببخشید|معذرت میخوام|معذرت می خواهم|شرمنده|ببخشیدا)$/))return "اشکالی نداره "+who+"، راحت باش!";
 if(matches(/^(بله|آره|اره|آری)$/))return "باشه "+who+"، بگو ادامه بدیم.";
 if(matches(/^(نه|نخیر|نه ممنون|نه مرسی)$/))return "باشه، هر وقت نظرت عوض شد من اینجام.";
 if(matches(/^(شروع کنیم|بزن بریم|بریم سراغش|آماده ای|آماده‌ای)$/))return "آماده‌ام "+who+"! بگو از کجا شروع کنیم.";
 if(matches(/^(یه جوک بگو|جوک بگو|میتونی بخندونیم|یه چیزی بامزه بگو)$/))return "یه برنامه‌نویس به قهوه‌اش گفت: لطفاً بدون باگ باش! قهوه گفت: من فقط جاوا دارم! 😄";
 if(matches(/^(خسته نباشی|خسته نباشید)$/))return "ممنون "+who+"! تو هم خسته نباشی. بگو ببینم چه کاری انجام بدیم؟";
 if(matches(/^(باشه|باش|اوکی|اوک|okay|ok|قبوله|درسته|فهمیدم)$/))return "باشه "+who+"، هر وقت آماده‌ای ادامه بدیم.";
 if(matches(/^(آفرین|عالیه|عالی|دمت گرم عالی بود|درود بر تو)$/))return "ممنون "+who+"! خوشحالم که به کارت اومد.";
 if(matches(/^(لطفا|لطفاً|خواهش میکنم|خواهش می کنم)$/))return "حتماً! بگو چه کمکی از دستم برمیاد.";
 if(matches(/^(روزت بخیر|روز خوبی داشته باشی)$/))return "ممنون "+who+"! تو هم روز خوبی داشته باشی.";
 return null;
}

/* AF4 AI Offline Language Layer v2: local-first colloquial Persian, varied replies, fuzzy matching, and compact offline facts. */
const AF4_OFFLINE_LANGUAGE = (() => {
 const tidy = s => String(s||"").toLowerCase().replace(/[يى]/g,"ی").replace(/ك/g,"ک").replace(/ۀ/g,"ه").replace(/[أإٱ]/g,"ا").replace(/ؤ/g,"و").replace(/ئ/g,"ی").replace(/[\u064B-\u065F\u0670]/g,"").replace(/[\u200c\u200d\u200e\u200f]/g," ").replace(/[ـ]+/g,"").replace(/[!！?؟.,،؛:…"'~*_+=()[\]{}<>\\/\\|@#$%^&-]+/g," ").replace(/\s+/g," ").trim();
 const soften = s => tidy(s).replace(/\b(لطفا|لطفاً|یه|یک|من|تو|شما|رو|را|به|از|با|واسه|برای|اصلا|اصلاً|خب|آخه|یعنی|دیگه|هم|همین|الان|ببین|بگو|داداش|رفیق|مشتی|سلطان|عزیزم|عزیز|جان|جون|سی سی|سیسی)\b/g," ").replace(/\s+/g," ").trim();
 const pick = a => a[Math.floor(Math.random()*a.length)];
 const who = () => (typeof profile!=="undefined" && profile.name ? profile.name.trim() : "دوست من");
 const greetings = [
  {re:/^(سلام|درود|هلو|های|هی|hello|hi|hey)( .*)?$/, a:()=>["سلام "+who()+"! خوبی داداش؟ بگو ببینم چه خبره؟","به‌به "+who()+"! خوش اومدی مشتی 😎 چطور می‌تونم کمکت کنم؟","سلام سلطان! 👋 حالت چطوره؟ من آماده‌ام، بگو چی تو ذهنته.","سلام رفیق جان! چه خبر ازت؟ بزن بریم ببینیم چی کار داریم."]},
  {re:/^(خوبی|چطوری|چه طوری|حالت چطوره|حالت خوبه|چه خبر|چخبر|اوضاع چطوره)( .*)?$/, a:()=>["خوبم "+who()+"، مرسی که پرسیدی! تو چطوری؟","روبه‌راهم داداش، آماده‌ام کمکت کنم 😄 تو چه خبر؟","همه‌چی مرتبه سلطان! بگو ببینم تو چطوری؟"]},
  {re:/^(ممنون|ممنونم|مرسی|سپاس|تشکر|دمت گرم|دستت درد نکنه|قربونت|فدات|عشقی)( .*)?$/, a:()=>["قربونت "+who()+"! هر کاری داشتی روی من حساب کن.","چاکریم داداش! خوشحالم به دردت خورد 🤝","خواهش می‌کنم سلطان، کاری نکردم!"]},
  {re:/^(خداحافظ|خدانگهدار|فعلا|بای|بای بای|تا بعد|میبینمت)( .*)?$/, a:()=>["فعلاً "+who()+"! هر وقت برگشتی از همین‌جا ادامه می‌دیم.","بدرود رفیق، مراقب خودت باش! 👋","فعلاً سلطان، به امید گپ بعدی!"]},
  {re:/^(خسته نباشی|خسته نباشید)$/, a:()=>["ممنون رفیق! تو هم خسته نباشی، بریم سراغ کارمون.","دمت گرم "+who()+"! تو هم خسته نباشی داداش."]},
  {re:/^(یه )?(جوک بگو|یه چیزی بامزه بگو|بخندونم|بخندون)$/, a:()=>["یه باگ رفت دکتر، دکتر گفت: مشکلت چیه؟ گفت: هر بار اجرا می‌شم یه جای کارم می‌لنگه! 😄","به کامپیوتر گفتن چرا سردته؟ گفت چون ویندوزم بازه! 😂","برنامه‌نویس چرا از طبیعت خوشش میاد؟ چون اونجا کمتر باگ می‌بینه! 😄"]}
 ];
 const facts = [
  {k:["هوش مصنوعی","ai"],v:"هوش مصنوعی شاخه‌ای از فناوریه که سیستم‌ها رو قادر می‌کنه کارهایی مثل فهم زبان، تشخیص الگو، پاسخ‌گویی و تولید محتوا رو انجام بدن. کیفیتش به مدل، داده و توان پردازشی بستگی داره."},
  {k:["اینترنت"],v:"اینترنت شبکه‌ای جهانی از دستگاه‌ها و سرورهاست که با استانداردهای مشترک با هم ارتباط می‌گیرن."},
  {k:["ربات"],v:"ربات سامانه‌ایه که می‌تونه طبق برنامه یا ورودی حسگرها، کارهایی رو به‌صورت خودکار انجام بده؛ همهٔ ربات‌ها هم شبیه انسان نیستن."},
  {k:["برنامه نویسی","کدنویسی"],v:"برنامه‌نویسی یعنی نوشتن دستورهایی که به کامپیوتر می‌گن چه کاری انجام بده؛ مثلاً با JavaScript، Python یا Java."},
  {k:["اپلیکیشن","برنامه موبایل"],v:"اپلیکیشن یا برنامه، نرم‌افزاریه که برای انجام کار مشخصی روی گوشی، رایانه یا وب استفاده می‌شه."},
  {k:["apk","فایل apk"],v:"APK قالب بستهٔ نصب برنامه‌های اندرویده. فایل رو فقط از منبعی نصب کن که بهش اعتماد داری."},
  {k:["وی پی ان","vpn"],v:"VPN ارتباط دستگاهت رو از یک سرور واسطه عبور می‌ده و ممکنه مسیر اتصال و نشانی IP قابل‌مشاهده رو تغییر بده؛ به معنی ناشناس‌بودن کامل نیست."},
  {k:["کریپتو","ارز دیجیتال","رمزارز"],v:"رمزارز دارایی دیجیتالیه که معمولاً روی شبکه‌های رمزنگاری‌شده یا بلاک‌چین جابه‌جا می‌شه. قیمتش پرنوسانه و ممکنه بخشی یا همهٔ سرمایه از دست بره."},
  {k:["بلاک چین","بلاکچین"],v:"بلاک‌چین نوعی دفترکل دیجیتالیه که داده‌ها در قالب بلوک‌های مرتبط ثبت می‌شن و تغییر سوابق معمولاً دشوارتره."},
  {k:["ترید","معامله گری"],v:"ترید یعنی خریدوفروش دارایی با هدف کسب سود از تغییر قیمت. مدیریت ریسک، حد ضرر و ثبت نتایج برای تصمیم‌گیری مسئولانه مهم‌اند."},
  {k:["تورم"],v:"تورم یعنی بالا رفتن عمومی سطح قیمت‌ها در طول زمان؛ در نتیجه، با مقدار ثابتی پول معمولاً می‌شه کالا و خدمات کمتری خرید."},
  {k:["پسورد","رمز عبور"],v:"رمز عبور قوی و یکتا بساز، برای هر سرویس رمز جدا داشته باش و در صورت امکان تأیید دومرحله‌ای رو روشن کن. رمزت رو در چت برای کسی نفرست."},
  {k:["هوش مصنوعی آفلاین","آفلاین"],v:"هوش مصنوعی آفلاین بدون درخواست به سرور می‌تونه از مدل یا قواعدی که روی دستگاه نصب شده استفاده کنه. برای دانش گسترده، مدل محلی به فضای ذخیره‌سازی و حافظهٔ کافی نیاز داره."}
 ];
 const catalog = [
  {k:["کمکم کن","کمک میخوام","میشه کمکم کنی","میتونی کمکم کنی"],a:()=> "حتماً "+who()+"! بگو دقیقاً چی می‌خوای؛ قدم‌به‌قدم با هم جلو می‌ریم."},
  {k:["حوصلم سر رفته","حوصله ندارم"],a:()=>pick(["بیا یه کاری کنیم "+who()+"؛ دوست داری گپ بزنیم، یه بازی کلمه‌ای انجام بدیم یا یه ایدهٔ تازه پیدا کنیم؟","پس یه چالش کوچیک: سه تا چیزی که دوست داری رو بگو تا یه پیشنهاد باحال بدم."])},
  {k:["ناراحتم","حالم بده","غمگینم","اعصابم خورده"],a:()=>pick(["متأسفم که این‌طوری‌ای "+who()+". اگه دوست داری بگو چی شده؛ گوش می‌دم و با هم بررسیش می‌کنیم.","می‌خوای درباره‌ش حرف بزنی؟ لازم نیست همه‌چیز رو یک‌جا توضیح بدی، از هرجا راحتی شروع کن."])},
  {k:["خوشحالم","خیلی خوشحالم"],a:()=>pick(["چه خوب "+who()+"! 😄 چی شده که این‌قدر خوشحالی؟","این انرژی خوبه سلطان! تعریف کن ببینم چه خبر شده."])},
  {k:["دوستت دارم","عاشقتم"],a:()=> "محبتهات قشنگه "+who()+" ❤️ من احساس انسانی ندارم، ولی با روی خوش اینجام که باهات گپ بزنم و کمکت کنم."},
  {k:["احساس تنهایی","تنهایی"],a:()=> "تنهایی می‌تونه سخت باشه "+who()+". اگه دوست داری بگو چه چیزی باعث شده این حس رو داشته باشی؛ با هم درباره‌ش حرف می‌زنیم."},
  {k:["اسمت چیه","اسم تو چیه","تو کی هستی"],a:()=> "من AF4 AI هستم؛ دستیار هوشمند پروژهٔ AF4. پاسخ‌های ساده رو روی خود دستگاه می‌دم و برای سؤال‌های پیچیده‌تر ممکنه به مدل آنلاین نیاز داشته باشم."},
  {k:["چه کارهایی بلدی","چه کمکی میتونی بکنی"],a:()=> "می‌تونم در نوشتن و ویرایش متن، توضیح مفاهیم، ایده‌پردازی، برنامه‌ریزی و حل مسئله کمک کنم. پاسخ آفلاینم به دانش داخلی و قواعد محلی محدوده؛ برای اطلاعات تازه یا تحلیل عمیق ممکنه سرویس آنلاین لازم باشه."},
  {k:["حافظه داری","یادت میمونه","یاد میگیری"],a:()=> "در این نسخه، گفت‌وگوها در تاریخچهٔ همین برنامه ذخیره می‌شن؛ اما این به معنی آموزش خودکار مدل یا یادگیری دائمی از هر پیام نیست."}
 ];
 const distance=(a,b)=>{if(Math.abs(a.length-b.length)>3)return 99;let p=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const c=[i];for(let j=1;j<=b.length;j++)c[j]=Math.min(c[j-1]+1,p[j]+1,p[j-1]+(a[i-1]===b[j-1]?0:1));p=c;}return p[b.length];};
 const similarity=(a,b)=>{if(!a||!b)return 0;if(a===b)return 1;const A=new Set(a.split(" ")),B=new Set(b.split(" "));let n=0;for(const t of A)if(B.has(t))n++;const dice=2*n/(A.size+B.size||1);const x=a.replace(/\s/g,""),y=b.replace(/\s/g,"");return Math.max(dice,1-distance(x,y)/Math.max(x.length,y.length,1));};
 const answer=raw=>{
  const q=tidy(raw),s=soften(raw);if(!q||q.length>300)return null;
  for(const g of greetings)if(g.re.test(q))return pick(g.a());
  const aliases=[[/^(سلم|سلاام|سلوم|سلاممم|سلا|سلااام)( .*)?$/,"سلام"],[/^(خبی|خوبیی|خوبییی|چطوریی)( .*)?$/,"خوبی"],[/^(مرسیی|مچکرم|ممنونم|سپاسگزارم)( .*)?$/,"ممنون"],[/^(داداش|مشتی|سلطان|رفیق|عزیزم|سی سی|سیسی)$/,"ندای دوستانه"]];
  for(const [re,type] of aliases)if(re.test(q))return type==="سلام"?"بله "+who()+" جان؟ بگو داداش!":pick(["جانم سلطان؟ 😄","بفرما رفیق، گوشم با توئه!","جان دلم؟ بگو ببینم چی شده."]);
  for(const f of facts)if(f.k.some(k=>q===tidy(k)||s===soften(k)||q==="معنی "+tidy(k)||q==="معنی "+tidy(k)+" چیه"||q===tidy(k)+" چیه"||q===tidy(k)+" چیست"))return f.v;
  const m=q.match(/^(?:معنی )?(.+?)(?: یعنی چی| چیه| چیست| به چه معنیه| به چه معناست)$/);
  if(m){const term=soften(m[1]);for(const f of facts)if(f.k.some(k=>similarity(term,soften(k))>=0.78))return f.v;}
  for(const c of catalog)if(c.k.some(k=>q===tidy(k)||s===soften(k)))return c.a();
  const fuzzy=[{k:["کمکم کن","میشه کمکم کنی","میتونی کمکم کنی"],a:()=> "حتماً "+who()+"! بگو چی لازم داری تا با هم حلش کنیم."},{k:["حالت چطوره","خوبی","چطوری"],a:()=>pick(["خوبم رفیق، تو چطوری؟","روبه‌راهم داداش! تو چه خبر؟"])},{k:["ممنون","مرسی","دمت گرم"],a:()=>pick(["قربونت "+who()+"!","چاکریم سلطان!","خواهش می‌کنم رفیق."])},{k:["خداحافظ","فعلا","بای"],a:()=> "فعلاً "+who()+"! مراقب خودت باش."}];
  for(const c of fuzzy)for(const k of c.k)if(similarity(s,soften(k))>=0.84)return c.a();
  return null;
 };
 return {answer,tidy,soften};
})();
const AF4_OFFLINE_LANGUAGE_V2 = getInstantReply;
getInstantReply = function(raw) { return AF4_OFFLINE_LANGUAGE.answer(raw) || AF4_OFFLINE_LANGUAGE_V2(raw); };

function setConnectionStatus(state,label){const pill=$("connectionPill"),text=$("connectionText");if(!pill||!text)return;pill.dataset.state=state;text.textContent=label;}
async function checkConnection(){const base=(String($("apiBaseUrl")?.value||"").trim()||DEFAULT_API_BASE_URL).replace(/\/+$/,"");const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),7000);try{const r=await fetch(base+"/api/health",{method:"GET",cache:"no-store",signal:controller.signal});if(!r.ok)throw new Error("health check failed");const data=await r.json();if(data&&data.ok){setConnectionStatus("online","سرور در دسترس");return true;}throw new Error("invalid health response");}catch{setConnectionStatus("offline","عدم اتصال به سرور");return false;}finally{clearTimeout(timer);}}
function setSending(value){sending=value;const b=form.querySelector('button[type="submit"]');if(b){b.disabled=value;b.textContent=value?"…":"↑";}input.disabled=value;}
async function localModelReply(value,pending){
 const bridge=window.Capacitor?.Plugins?.LocalLLM;
 if(!bridge||typeof bridge.generate!=="function")return null;
 let progressListener=null;
 try{
  if(typeof bridge.addListener==="function"){
   progressListener=await bridge.addListener("modelProgress",event=>{
    const body=pending?.querySelector(".message-body");
    if(body){
     const percent=Number(event?.percent);
     body.textContent=Number.isFinite(percent)&&percent>0&&percent<100
      ? "بار اول دارم مغز آفلاین را آماده می‌کنم… "+percent+"٪"
      : "دارم پاسخ را با مغز آفلاین آماده می‌کنم…";
    }
   });
  }
  const transcript=currentSession.slice(-12).map(m=>(m.role==="user"?"کاربر":"AF4 AI")+": "+m.text).join("\n");
  const memory=localMemoryNotes.trim()?"\n\nحافظهٔ محلی که کاربر خودش ذخیره کرده؛ فقط برای شخصی‌سازی از آن استفاده کن:\n"+localMemoryNotes:"";const prompt="تو AF4 AI هستی؛ به فارسی طبیعی و محاوره‌ای پاسخ بده و لحن را با کاربر هماهنگ کن. نام کاربر: "+(profile.name||"نامشخص")+"؛ سبک پاسخ: "+(profile.tone||"friendly")+" . سابقهٔ اخیر گفت‌وگو را در نظر بگیر، تکرار بی‌دلیل نکن و به آخرین پیام پاسخ بده. اگر سؤال به اطلاعات زنده نیاز دارد و اینترنت در دسترس نیست، این محدودیت را شفاف بگو."+memory+"\n\n"+transcript+"\n\nپاسخ به آخرین پیام:";
  const result=await bridge.generate({text:prompt});
  const answer=String(result?.text||"").trim();
  return answer||null;
 }finally{
  try{await progressListener?.remove?.();}catch{}
 }
}
async function sendMessage(text,options={}){
 const value=(text??input.value).trim();
 if(!value||sending)return;
 welcome.hidden=true;
 if(!options.retry){addMessage("user",value);rememberExplicitly(value);}
 input.value="";input.style.height="auto";
 if(!options.retry){const instant=getInstantReply(value);if(instant){addMessage("assistant",instant,true);return;}}
 setConnectionStatus("checking","در حال آماده‌سازی پاسخ…");
 setSending(true);
 const pending=addMessage("assistant","دارم پاسخ رو آماده می‌کنم…",false);
 try{
  if(navigator.onLine===false){
   setConnectionStatus("offline","حالت آفلاین");
   const body=pending.querySelector(".message-body");
   if(body)body.textContent="اینترنت در دسترس نیست؛ دارم مغز آفلاین را آماده می‌کنم…";
   const local=await localModelReply(value,pending);
   if(local){pending.remove();setConnectionStatus("offline","پاسخ با مدل محلی");addMessage("assistant",local,true,"AF4 Local","Qwen3-1.7B");return;}
   throw new Error("مدل محلی هنوز در دسترس نیست یا این نسخهٔ برنامه از اجرای مدل بومی پشتیبانی نمی‌کند.");
  }
  const base=(String($("apiBaseUrl")?.value||"").trim()||DEFAULT_API_BASE_URL).replace(/\/+$/,"");
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),55000);
  let r;let fetchError;
  const apiBases=[...new Set([base,DEFAULT_API_BASE_URL])];
  try{
   for(const apiBase of apiBases){
    try{
     r=await fetch(apiBase+"/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profile:{name:profile.name,about:profile.about,tone:profile.tone},messages:currentSession.map(m=>({role:m.role,content:m.text}))}),signal:controller.signal,cache:"no-store"});
     break;
    }catch(err){fetchError=err;if(err.name==="AbortError")throw err;}
   }
   if(!r)throw fetchError||new Error("سرور از این اتصال در دسترس نیست.");
  }finally{clearTimeout(timer);}
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||"ارتباط با دستیار برقرار نشد.");
  if(typeof data.reply!=="string"||!data.reply.trim())throw new Error("سرور پاسخ متنی معتبر نفرستاد.");
  setConnectionStatus("online","سرور در دسترس");
  pending.remove();
  addMessage("assistant",data.reply.trim(),true,data.provider,data.model);
 }catch(e){
  const body=pending.querySelector(".message-body");
  if(body)body.textContent="اتصال آنلاین پاسخ نداد؛ دارم مدل آفلاین را امتحان می‌کنم…";
  let local=null;let localError=null;
  try{local=await localModelReply(value,pending);}catch(err){localError=err;}
  if(local){
   pending.remove();
   setConnectionStatus("offline","پاسخ با مدل محلی");
   addMessage("assistant",local,true,"AF4 Local","Qwen3-1.7B");
   return;
  }
  pending.remove();
  const reason=e.name==="AbortError"?"زمان انتظار سرور تمام شد.":(e.message||"اتصال برقرار نشد.");
  const extra=localError?.message?("\n\nمدل آفلاین: "+localError.message):"";
  setConnectionStatus("offline","پاسخ دریافت نشد");
  const error=addMessage("assistant","فعلاً نتونستم پاسخ بگیرم. پیام تو پاک نشده؛ می‌تونی دوباره تلاش کنی.\n\nجزئیات: "+reason+extra,false);
  const retry=document.createElement("button");
  retry.type="button";retry.className="message-retry";retry.textContent="تلاش دوباره";
  retry.addEventListener("click",()=>{error.remove();sendMessage(value,{retry:true});});
  error.append(retry);
 }finally{
  setSending(false);input.focus();
 }
}
async function refreshLocalModelStatus(){
 const status=$("localModelStatus"),button=$("prepareLocalModel");
 if(!status||!button)return;
 const bridge=window.Capacitor?.Plugins?.LocalLLM;
 if(!bridge||typeof bridge.status!=="function"){
  status.textContent="مغز زبانی کامل مخصوص اندروید است؛ نسخهٔ وب پاسخ‌های فوری و پایهٔ آفلاین را دارد.";
  button.textContent="فقط در نسخهٔ اندروید";
  button.disabled=true;
  return;
 }
 try{
  const state=await bridge.status();
  if(state.ready){status.textContent="مغز آفلاین آماده است؛ می‌توانی بدون اینترنت هم گفت‌وگو کنی.";button.textContent="مدل آفلاین آماده است";button.disabled=false;}
  else if(state.available){status.textContent="فایل مدل روی دستگاه هست؛ برای بارگذاری و شروع چت آفلاین آماده‌اش کن.";button.textContent="بارگذاری مغز آفلاین";button.disabled=false;}
  else{status.textContent="مدل همراه برنامه است؛ برای آماده‌سازی اولیه و بررسی سلامت فایل، دکمه را بزن.";button.textContent="آماده‌سازی مغز آفلاین";button.disabled=false;}
 }catch{status.textContent="وضعیت مدل آفلاین قابل بررسی نیست؛ می‌توانی آماده‌سازی را امتحان کنی.";button.disabled=false;}
}
async function prepareLocalModel(){
 const bridge=window.Capacitor?.Plugins?.LocalLLM;
 const status=$("localModelStatus"),button=$("prepareLocalModel");
 if(!bridge||typeof bridge.prepare!=="function"){await refreshLocalModelStatus();return;}
 button.disabled=true;
 button.textContent="در حال آماده‌سازی…";
 status.textContent="ممکن است اولین بار چند دقیقه طول بکشد؛ برنامه را نبند.";
 let listener=null;
 try{
  if(typeof bridge.addListener==="function"){
   listener=await bridge.addListener("modelProgress",event=>{
    const percent=Number(event?.percent);
    if(Number.isFinite(percent)&&percent>=0)status.textContent="در حال کپی و بررسی مدل آفلاین: "+percent+"٪";
   });
  }
  await bridge.prepare();
  status.textContent="مغز آفلاین آماده است؛ گفت‌وگوی متنی می‌تواند روی همین دستگاه اجرا شود.";
  button.textContent="مدل آفلاین آماده است";
 }catch(error){
  status.textContent="آماده‌سازی ناموفق بود: "+String(error?.message||error||"خطای نامشخص");
  button.textContent="تلاش دوباره برای آماده‌سازی";
 }finally{
  try{await listener?.remove?.();}catch{}
  button.disabled=false;
 }
}
function closePanels(){ $("sidebar").classList.remove("open");$("settingsPanel").hidden=true;$("mobileScrim").classList.remove("active");}
form.addEventListener("submit",e=>{e.preventDefault();sendMessage();});input.addEventListener("input",()=>{input.style.height="auto";input.style.height=Math.min(input.scrollHeight,160)+"px";});input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();form.requestSubmit();}});
$("newChat").addEventListener("click",startNewChat);document.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>sendMessage(b.dataset.prompt)));$("settingsToggle").addEventListener("click",()=>{$("settingsPanel").hidden=false;if(window.innerWidth<=800)$("mobileScrim").classList.add("active");});$("prepareLocalModel").addEventListener("click",prepareLocalModel);
$("saveLocalMemory").addEventListener("click",saveLocalMemory);
$("clearLocalMemory").addEventListener("click",clearLocalMemory);
$("stickerButton").addEventListener("click",()=>{$("stickerTray").hidden=!$("stickerTray").hidden;});
document.querySelectorAll(".sticker-choice").forEach(button=>button.addEventListener("click",()=>{
 const tray=$("stickerTray"),src=button.dataset.sticker,caption=button.dataset.alt||"استیکر AF4";
 if(src)addMessage("user",caption,true,"sticker",src);
 if(tray)tray.hidden=true;
}));
document.addEventListener("click",event=>{const tray=$("stickerTray");if(tray&&!tray.hidden&&!event.target.closest("#stickerTray")&&!event.target.closest("#stickerButton"))tray.hidden=true;});
$("settingsClose").addEventListener("click",closePanels);$("settingsDone").addEventListener("click",closePanels);$("menuToggle").addEventListener("click",()=>{$("sidebar").classList.toggle("open");$("mobileScrim").classList.toggle("active",$("sidebar").classList.contains("open"));});$("sidebarClose").addEventListener("click",closePanels);$("mobileScrim").addEventListener("click",closePanels);
$("themeToggle").addEventListener("click",()=>{$("themeSelect").value=document.body.classList.contains("dark")?"light":"dark";applySettings();saveSettings();});
["assistantName","accentColor","compactMode","apiBaseUrl","themeSelect"].forEach(id=>$(id).addEventListener("change",()=>{applySettings();saveSettings();if(id==="apiBaseUrl")checkConnection();}));$("assistantName").addEventListener("input",()=>{applySettings();saveSettings();});
$("toneSelect").addEventListener("change",saveProfile);$("profileNav").addEventListener("click",()=>{closePanels();sendMessage("لطفاً بر اساس اطلاعاتی که درباره سازنده‌ات داری، خودت را معرفی کن و توضیح بده چه چیزهایی درباره من، علایقم و پروژه‌های AF4 می‌دانی. اگر چیزی را نمی‌دانی حدس نزن.");});$("profileButton").addEventListener("click",()=>{$("settingsPanel").hidden=false;if(window.innerWidth<=800)$("mobileScrim").classList.add("active");});$("homeNav").addEventListener("click",startNewChat);
$("clearHistory").addEventListener("click",()=>{if(!sessions.length)return;if(confirm("همه گفت‌وگوهای ذخیره‌شده در این مرورگر پاک شوند؟")){sessions=[];persist();startNewChat();}});
$("composerPlus").addEventListener("click",()=>{input.value=input.value?input.value+"\n":"کمکم کن این ایده را مرحله‌به‌مرحله بررسی کنم: ";input.focus();input.dispatchEvent(new Event("input"));});
window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change",()=>{if($("themeSelect").value==="system")applySettings();});
applySettings();loadProfile();loadLocalMemory();renderHistory();checkConnection();refreshLocalModelStatus();

$("onboardingForm").addEventListener("submit",e=>{e.preventDefault();$("profileName").value=$("onboardingName").value.trim();$("profileAbout").value=$("onboardingAbout").value.trim();saveProfile();$("onboarding").hidden=true;input.focus();});
if(!profile.name){$("onboardingName").value="";$("onboardingAbout").value="";$("onboarding").hidden=false;}
["profileName","profileAbout"].forEach(id=>$(id).addEventListener("change",saveProfile));
function speakText(text){if(!("speechSynthesis" in window)){alert("خواندن صوتی در این مرورگر پشتیبانی نمی‌شود.");return;}window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="fa-IR";u.rate=0.96;const voices=window.speechSynthesis.getVoices();const fa=voices.find(v=>v.lang.toLowerCase().startsWith("fa"));if(fa)u.voice=fa;window.speechSynthesis.speak(u);}
$("voiceButton").addEventListener("click",()=>{const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SpeechRecognition){alert("ورودی صوتی در این مرورگر در دسترس نیست. از Chrome به‌روز روی اندروید امتحان کن.");return;}if(listening){recognition?.stop();return;}recognition=new SpeechRecognition();recognition.lang="fa-IR";recognition.interimResults=false;recognition.maxAlternatives=1;recognition.onstart=()=>{listening=true;$("voiceButton").classList.add("active");$("voiceButton").textContent="■";};recognition.onresult=e=>{const spoken=e.results?.[0]?.[0]?.transcript||"";input.value=(input.value?input.value+" ":"")+spoken;input.dispatchEvent(new Event("input"));};recognition.onerror=()=>{};recognition.onend=()=>{listening=false;$("voiceButton").classList.remove("active");$("voiceButton").textContent="🎙";};recognition.start();});
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;$("installButton").hidden=false;});
$("installButton").addEventListener("click",async()=>{if(!deferredInstallPrompt){alert("برای نصب: از منوی مرورگر گزینهٔ «افزودن به صفحهٔ اصلی» یا «نصب برنامه» را انتخاب کن.");return;}deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$("installButton").hidden=true;});
window.addEventListener("appinstalled",()=>{$("installButton").hidden=true;});
document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();startNewChat();}});
