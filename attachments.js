(() => {
  "use strict";
  const form=document.getElementById("chatForm");
  const composer=form?.querySelector(".composer");
  const input=document.getElementById("messageInput");
  if(!form||!composer||!input)return;
  let pending=[];
  const picker=document.createElement("input");
  picker.type="file";
  picker.accept="image/jpeg,image/png,image/webp,.txt,.md,.csv,.json,.log,.xml,.html,.css,.js,.py";
  picker.multiple=true;picker.hidden=true;
  picker.setAttribute("aria-label","انتخاب تصویر یا فایل متنی");
  const button=document.createElement("button");
  button.type="button";button.className="composer-tool attachment-button";button.id="attachmentButton";
  button.textContent="📎";button.title="پیوست تصویر یا فایل متنی";button.setAttribute("aria-label","پیوست تصویر یا فایل متنی");
  const tray=document.createElement("div");tray.className="attachment-tray";tray.hidden=true;tray.setAttribute("aria-label","پیوست‌های انتخاب‌شده");
  const help=document.createElement("p");help.className="attachment-help";help.textContent="تصویر: JPG/PNG/WebP تا ۴ مگابایت؛ فایل متنی تا ۱ مگابایت. تحلیل تصویر به مدل آنلاین سازگار نیاز دارد.";
  const wrap=document.createElement("div");wrap.append(picker,tray,help);
  composer.insertBefore(button,document.getElementById("voiceButton"));
  form.insertBefore(wrap,form.querySelector(".sticker-tray"));
  function render(){
    tray.replaceChildren();
    for(const [i,item] of pending.entries()){
      const chip=document.createElement("div");chip.className="attachment-chip";
      const label=document.createElement("span");label.textContent=(item.kind==="image"?"🖼 ":"📄 ")+item.name;label.title=item.name;
      const remove=document.createElement("button");remove.type="button";remove.textContent="×";remove.setAttribute("aria-label","حذف "+item.name);
      remove.addEventListener("click",()=>{pending.splice(i,1);render();});
      chip.append(label,remove);tray.append(chip);
    }
    tray.hidden=pending.length===0;button.classList.toggle("has-files",pending.length>0);
  }
  function readFile(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error("خواندن فایل ناموفق بود"));reader.onload=()=>resolve(String(reader.result||""));reader.readAsDataURL(file);});}
  button.addEventListener("click",()=>picker.click());
  picker.addEventListener("change",async()=>{
    const files=Array.from(picker.files||[]);picker.value="";
    for(const file of files){
      if(pending.length>=5){alert("حداکثر ۵ پیوست هم‌زمان می‌توانی انتخاب کنی.");break;}
      if(file.type.startsWith("image/")){
        if(!["image/jpeg","image/png","image/webp"].includes(file.type)){alert("این نوع تصویر پشتیبانی نمی‌شود؛ JPG، PNG یا WebP انتخاب کن.");continue;}
        if(file.size>4*1024*1024){alert("حجم تصویر باید حداکثر ۴ مگابایت باشد: "+file.name);continue;}
        try{const dataUrl=await readFile(file);const total=pending.reduce((sum,item)=>sum+(item.dataUrl?.length||0),0);if(total+dataUrl.length>6500000){alert("حجم مجموع تصاویر برای یک درخواست زیاد است؛ تصاویر کمتری یا کوچک‌تر انتخاب کن.");continue;}pending.push({kind:"image",name:file.name,dataUrl});}catch{alert("خواندن تصویر ناموفق بود: "+file.name);}
      }else{
        if(file.size>1024*1024){alert("حجم فایل متنی باید حداکثر ۱ مگابایت باشد: "+file.name);continue;}
        if(!/\.(txt|md|csv|json|log|xml|html|css|js|py)$/i.test(file.name)){alert("فعلاً فقط فایل‌های متنی مثل TXT، MD، CSV، JSON، HTML، CSS، JS و PY پشتیبانی می‌شوند.");continue;}
        try{
          const text=await file.text();
          const block="\n\n--- محتوای فایل: "+file.name+" ---\n"+text.slice(0,100000)+"\n--- پایان فایل ---\n";
          input.value=(input.value?input.value+"\n":"")+block;
          input.dispatchEvent(new Event("input",{bubbles:true}));
        }catch{alert("خواندن فایل متنی ناموفق بود: "+file.name);}
      }
    }
    render();
  });
  window.AF4Attachments={peek:()=>pending.slice(),consume:()=>{const out=pending.slice();pending=[];render();return out;}};
})();