const $ = id => document.getElementById(id);
const form = $("chatForm"), input = $("messageInput"), messages = $("messages"), welcome = $("welcome"), history = $("history");
const STORAGE = "af4-ai-history-v1", SETTINGS = "af4-ai-settings-v1";
let sessions = [];
let currentSession = [];
let sending = false;
try { sessions = JSON.parse(localStorage.getItem(STORAGE) || "[]"); if (!Array.isArray(sessions)) sessions = []; } catch { sessions = []; }
function persist() { try { localStorage.setItem(STORAGE, JSON.stringify(sessions.slice(-30))); } catch {} }
function saveSettings() { try { localStorage.setItem(SETTINGS, JSON.stringify({name:$("assistantName").value,color:$("accentColor").value,compact:$("compactMode").checked,apiBaseUrl:$("apiBaseUrl")?.value.trim()||""})); } catch {} }
function applySettings() {
  document.body.classList.remove("accent-blue","accent-green","accent-pink");
  if ($("accentColor").value !== "purple") document.body.classList.add("accent-" + $("accentColor").value);
  document.body.classList.toggle("compact", $("compactMode").checked);
  document.querySelectorAll(".message.assistant .message-label").forEach(el => el.textContent = $("assistantName").value.trim() || "AF4 AI");
}
try { const s = JSON.parse(localStorage.getItem(SETTINGS) || "{}"); if(s.name) $("assistantName").value=s.name; if(s.color) $("accentColor").value=s.color; if(s.compact) $("compactMode").checked=true; if(s.apiBaseUrl && $("apiBaseUrl")) $("apiBaseUrl").value=s.apiBaseUrl; } catch {}
function renderHistory() {
  history.replaceChildren();
  const valid = sessions.filter(s => s && Array.isArray(s.items) && s.items.length);
  if (!valid.length) { const p=document.createElement("p"); p.className="empty-history"; p.textContent="هنوز گفت‌وگویی نداری"; history.append(p); return; }
  valid.slice().reverse().forEach(s => { const b=document.createElement("button"); b.className="history-item"; b.textContent=s.title; b.onclick=()=>loadSession(s); history.append(b); });
}
function startNewChat() { currentSession=[]; messages.replaceChildren(); welcome.hidden=false; input.value=""; input.style.height="auto"; renderHistory(); input.focus(); }
function loadSession(s) { currentSession=s.items; messages.replaceChildren(); welcome.hidden=!currentSession.length; currentSession.forEach(m=>addMessage(m.role,m.text,false)); $("sidebar").classList.remove("open"); }
function addMessage(role,text,save=true) {
  const article=document.createElement("article"); article.className="message "+role;
  const label=document.createElement("div"); label.className="message-label"; label.textContent=role==="user"?"تو":($("assistantName").value.trim()||"AF4 AI");
  const body=document.createElement("div"); body.textContent=text; article.append(label,body); messages.append(article);
  if(save) {
    currentSession.push({role,text});
    let s=sessions.find(x=>x.items===currentSession);
    if(!s) { s={title:role==="user"?text.slice(0,35):"گفت‌وگوی جدید",items:currentSession}; sessions.push(s); }
    if(s.title==="گفت‌وگوی جدید"&&role==="user") s.title=text.slice(0,35);
    persist(); renderHistory();
  }
  $("chatArea").scrollTop=$("chatArea").scrollHeight; return article;
}
function setSending(value) { sending=value; const b=form.querySelector('button[type="submit"]'); if(b){b.disabled=value;b.textContent=value?"…":"↑";} input.disabled=value; }
async function sendMessage(text) {
  const value=(text ?? input.value).trim(); if(!value||sending)return;
  welcome.hidden=true; addMessage("user",value); input.value=""; input.style.height="auto"; setSending(true);
  const pending=addMessage("assistant","دارم فکر می‌کنم…",false);
  try {
    const base=(window.AF4_API_BASE_URL || $("apiBaseUrl")?.value || "").trim().replace(/\/+$/, "");
    const r=await fetch(`${base}/api/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:currentSession.map(m=>({role:m.role,content:m.text}))})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(data.error||"ارتباط با دستیار برقرار نشد.");
    pending.remove(); addMessage("assistant",data.reply||"پاسخی دریافت نشد.");
  } catch(e) { pending.remove(); addMessage("assistant",e.message||"ارتباط برقرار نشد؛ اتصال اینترنت و تنظیمات سرور را بررسی کن."); }
  finally { setSending(false); input.focus(); }
}
form.addEventListener("submit",e=>{e.preventDefault();sendMessage();});
input.addEventListener("input",()=>{input.style.height="auto";input.style.height=Math.min(input.scrollHeight,150)+"px";});
input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();form.requestSubmit();}});
$("newChat").addEventListener("click",startNewChat);
document.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>sendMessage(b.dataset.prompt)));
$("settingsToggle").addEventListener("click",()=>{$("settingsPanel").hidden=false;});
$("settingsClose").addEventListener("click",()=>{$("settingsPanel").hidden=true;});
$("menuToggle").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
["assistantName","accentColor","compactMode","apiBaseUrl"].forEach(id=>{ if($(id)) $(id).addEventListener("change",()=>{applySettings();saveSettings();}); });
$("assistantName").addEventListener("input",()=>{applySettings();saveSettings();});
applySettings(); renderHistory(); startNewChat();