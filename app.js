const $ = (id) => document.getElementById(id);
const form = $("chatForm");
const input = $("messageInput");
const messages = $("messages");
const welcome = $("welcome");
const history = $("history");
const sessions = [];
let currentSession = [];
let sessionNumber = 0;

function startNewChat() {
  currentSession = [];
  sessionNumber++;
  messages.replaceChildren();
  welcome.hidden = false;
  input.value = "";
  renderHistory();
  input.focus();
}
function renderHistory() {
  history.replaceChildren();
  const valid = sessions.filter(s => s.items.length);
  if (!valid.length) {
    const p = document.createElement("p");
    p.className = "empty-history";
    p.textContent = "هنوز گفت‌وگویی نداری";
    history.append(p);
    return;
  }
  valid.slice().reverse().forEach(session => {
    const b = document.createElement("button");
    b.className = "history-item";
    b.textContent = session.title;
    b.onclick = () => loadSession(session);
    history.append(b);
  });
}
function loadSession(session) {
  currentSession = session.items;
  messages.replaceChildren();
  welcome.hidden = currentSession.length > 0;
  currentSession.forEach(item => addMessage(item.role, item.text, false));
}
function addMessage(role, text, save = true) {
  const article = document.createElement("article");
  article.className = "message " + role;
  const label = document.createElement("div");
  label.className = "message-label";
  label.textContent = role === "user" ? "تو" : ($("assistantName").value.trim() || "AF4 AI");
  const body = document.createElement("div");
  body.textContent = text;
  article.append(label, body);
  messages.append(article);
  if (save) {
    currentSession.push({role, text});
    let session = sessions.find(s => s.items === currentSession);
    if (!session) {
      session = {title: text.slice(0, 35) || "گفت‌وگوی جدید", items: currentSession};
      sessions.push(session);
    }
    renderHistory();
  }
  $("chatArea").scrollTop = $("chatArea").scrollHeight;
}
function sendMessage(text) {
  const value = (text || input.value).trim();
  if (!value) return;
  welcome.hidden = true;
  addMessage("user", value);
  input.value = "";
  input.style.height = "auto";
  addMessage("assistant", "این نسخه فعلاً ظاهر و تعاملات اولیه را دارد و هنوز به موتور هوش مصنوعی وصل نشده است. قدم بعدی، ساخت بک‌اند امن و اتصال مدل هوش مصنوعی است.");
}
form.addEventListener("submit", e => { e.preventDefault(); sendMessage(); });
input.addEventListener("input", () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 150) + "px"; });
input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
$("newChat").addEventListener("click", startNewChat);
document.querySelectorAll("[data-prompt]").forEach(b => b.addEventListener("click", () => sendMessage(b.dataset.prompt)));
$("settingsToggle").addEventListener("click", () => { $("settingsPanel").hidden = false; });
$("settingsClose").addEventListener("click", () => { $("settingsPanel").hidden = true; });
$("menuToggle").addEventListener("click", () => $("sidebar").classList.toggle("open"));
$("assistantName").addEventListener("input", () => { document.querySelectorAll(".message.assistant .message-label").forEach(el => el.textContent = $("assistantName").value.trim() || "AF4 AI"); });
$("accentColor").addEventListener("change", e => {
  document.body.classList.remove("accent-blue", "accent-green", "accent-pink");
  if (e.target.value !== "purple") document.body.classList.add("accent-" + e.target.value);
});
$("compactMode").addEventListener("change", e => document.body.classList.toggle("compact", e.target.checked));
startNewChat();
