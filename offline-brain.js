/* AF4 AI Local Brain — offline-first Persian typo recovery and conversational fallback.
 * This module runs entirely in the browser/WebView; it does not send text anywhere.
 */
(function () {
  "use strict";
  const normalize = (s) => String(s || "")
    .toLowerCase()
    .replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[ۀة]/g, "ه")
    .replace(/[أإٱ]/g, "ا").replace(/[ؤ]/g, "و")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[ـ]/g, "")
    .replace(/[!！?？،,؛;:.…]+/g, " ")
    .replace(/[\u200c\u200f\u200e]/g, " ")
    .replace(/\s+/g, " ").trim();

  const aliases = new Map(Object.entries({
    "سلاام":"سلام","سلااام":"سلام","سلوم":"سلام","سلم":"سلام","سلاممم":"سلام",
    "خبه":"خوبه","خوبب":"خوب","خبی":"خوبی","خوبیی":"خوبی","چطوریی":"چطوری",
    "میخام":"میخوام","میخاهم":"میخوام","میخوامم":"میخوام","مرسیی":"مرسی",
    "ممنونم":"ممنونم","چخبر":"چه خبر","نمیدونم":"نمی‌دونم","نمیدونی":"نمی‌دونی",
    "عالیی":"عالی","عالییی":"عالی","میتونیی":"میتونی","میشهه":"میشه",
    "ببخشیدد":"ببخشید","لطفاا":"لطفا","کجاییی":"کجایی","چراا":"چرا"
  }));
  const vocabulary = Array.from(new Set((
    "سلام خداحافظ خوبی خوب چطوری چه خبر ممنون مرسی لطفا ببخشید آره نه شاید چرا چطور چگونه معنی مفهوم توضیح کمک سوال جواب مشکل برنامه گوشی اینترنت آفلاین هوش مصنوعی خلاقانه دوست دارم ناراحتم خوشحالم استرس خسته حوصله ترید بازار معامله ریسک سرمایه ورزش غذا خواب امروز فردا دیروز الان بعدا کجا کی چی کدام میخوام میشه میتونی هست نیست بود شد دارم داری داریم دارید دارند گفت بگو بگم بگویم بساز درست کن حرفه‌ای عالی ممنونم سپاسگزارم"
  ).split(/\s+/)));
  function distance(a,b) {
    if (a === b) return 0;
    if (Math.abs(a.length-b.length)>2) return 99;
    let prev = Array.from({length:b.length+1},(_,i)=>i);
    for(let i=1;i<=a.length;i++){
      const row=[i];
      for(let j=1;j<=b.length;j++) row[j]=Math.min(row[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      prev=row;
    }
    return prev[b.length];
  }
  function correct(text) {
    return String(text||"").split(/(\s+)/).map(token=>{
      if(!token.trim()) return token;
      const clean=normalize(token);
      if(!clean) return token;
      if(aliases.has(clean)) return token.replace(clean,aliases.get(clean));
      if(clean.length<4 || /\d|https?:|@/.test(clean)) return token;
      let best=null,score=99,tie=false;
      for(const word of vocabulary){
        if(Math.abs(word.length-clean.length)>1) continue;
        const d=distance(clean,word);
        if(d<score){best=word;score=d;tie=false;} else if(d===score) tie=true;
      }
      if(best && score===1 && !tie && clean.length>=5) return token.replace(clean,best);
      return token;
    }).join("");
  }
  const pick = (items) => items[Math.floor(Math.random()*items.length)];
  function fallback(text) {
    const q=normalize(text);
    if(!q) return null;
    if(/^(سلام|درود|صبح بخیر|شب بخیر|سلام علیکم)$/.test(q))
      return pick(["سلام رفیق! 😄 بگو ببینم چه خبر؟","سلام داداش 🌟 چطور می‌تونم کمکت کنم؟","درود! من آماده‌ام؛ از کجا شروع کنیم؟"]);
    if(/^(خوبی|چطوری|حالت چطوره|چه خبر)$/.test(q))
      return pick(["من آماده‌ام باهات گپ بزنم 😄 تو چطوری؟","همه‌چی روبه‌راهه؛ تو چه خبر؟ ✨","خوبم رفیق، بگو امروز چه خبرهاست؟"]);
    if(/^(مرسی|ممنون|دمت گرم|مچکرم)$/.test(q))
      return pick(["قربونت رفیق ❤️","خواهش می‌کنم، هر وقت خواستی من هستم 🌟","کاری نکردم داداش 😄"]);
    if(/^(خداحافظ|فعلا|فعلاً|شب بخیر)$/.test(q))
      return pick(["فعلاً رفیق، مراقب خودت باش ❤️","تا بعد داداش! هر وقت برگشتی ادامه می‌دیم 👋","شب آرومی داشته باشی 🌙"]);
    if(/^(شوخی کن|یه جوک بگو|جوک بگو)$/.test(q))
      return pick(["به کامپیوتر گفتن چرا سرما خوردی؟ گفت کلی ویروس ریخته تو سیستمم! 😂","یه تریدر به بازار گفت: امروز منو غافلگیر نکن. بازار گفت: من خودِ غافلگیری‌ام! 😅","به وای‌فای گفتن چرا ساکتی؟ گفت دارم ارتباطمو با خودم پیدا می‌کنم! 🤣"]);
    if(/^(حالم بده|ناراحتم|حوصله ندارم|خسته ام|خسته‌ام)$/.test(q))
      return pick(["متأسفم که این‌طوری‌ای ❤️ دوست داری بگی چی شده؟ گوش می‌دم.","می‌فهمم، بعضی روزها واقعاً سنگین می‌گذرن. می‌خوای با هم بازش کنیم؟","لازم نیست همین الان همه‌چیز رو حل کنی؛ از هرجا راحتی شروع کن 🌿"]);
    return null;
  }
  const prior = typeof window.getInstantReply === "function" ? window.getInstantReply : null;
  window.AF4LocalBrain = { normalize, correct, fallback, version: "0.1.0" };
  if (prior) {
    window.getInstantReply = function (raw) {
      const fixed=correct(raw);
      const first=prior(fixed);
      return first || fallback(fixed);
    };
  }
})();