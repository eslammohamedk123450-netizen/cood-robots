(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const HASH="nova.owner.pin.hash.v1", SALT="nova.owner.pin.salt.v1", ATTEMPTS="nova.owner.pin.attempts.v1", LOCK="nova.owner.pin.lockUntil.v1";
  const hex = bytes => Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
  const fromHex = value => new Uint8Array((value.match(/.{1,2}/g)||[]).map(part=>parseInt(part,16)));
  function message(text,error=false){const node=$("pinFeedback");if(node){node.textContent=text;node.style.color=error?"#ff9d91":"";}}
  function showSetup(first){
    $("authGate").hidden=false;$("pinSetupForm").hidden=!first;$("pinLoginForm").hidden=first;
    $("pinGateTitle").textContent=first?"أنشئ كود الدخول":"أهلاً بعودتك";
    $("pinGateDescription").textContent=first?"دي أول مرة على الجهاز ده. أنشئ كودًا خاصًا من 6 إلى 12 رقمًا.":"اكتب كودك الشخصي لفتح NOVA.";message("");
  }
  async function hashPin(pin,salt){
    if(!window.crypto||!crypto.subtle)throw new Error("التشفير الآمن غير متاح. افتح رابط التطبيق HTTPS.");
    const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(pin),"PBKDF2",false,["deriveBits"]);
    const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:fromHex(salt),iterations:210000,hash:"SHA-256"},key,256);
    return hex(new Uint8Array(bits));
  }
  function openApp(){
    $("authGate").hidden=true;
    if($("connectionLabel"))$("connectionLabel").textContent="الوضع الشخصي المحلي";
    if($("greeting"))$("greeting").textContent="أهلاً يا إسلام، نورتني.";
    if($("authFeedback"))$("authFeedback").textContent="الوضع المحلي مفتوح. ربط الخدمات السحابية مؤجل.";
    if($("providerList"))$("providerList").textContent="إعدادات الخدمات السحابية ستتوفر بعد تفعيل الربط لاحقًا.";
  }
  async function savePin(event){
    event.preventDefault();const pin=$("newOwnerPin").value.trim(),confirm=$("confirmOwnerPin").value.trim();
    if(!/^\d{6,12}$/.test(pin))return message("الكود لازم يكون من 6 إلى 12 رقمًا.",true);
    if(pin!==confirm)return message("الكودان غير متطابقين. اكتبهم مرة تانية.",true);
    const button=$("saveOwnerPinButton");button.disabled=true;button.textContent="جاري حفظ الكود...";
    try{
      const salt=hex(crypto.getRandomValues(new Uint8Array(16))),digest=await hashPin(pin,salt);
      localStorage.setItem(SALT,salt);localStorage.setItem(HASH,digest);localStorage.removeItem(ATTEMPTS);localStorage.removeItem(LOCK);
      $("pinSetupForm").reset();openApp();
    }catch(error){message(error?.message||"تعذر حفظ الكود على الجهاز.",true);}
    finally{button.disabled=false;button.textContent="حفظ الكود وفتح التطبيق";}
  }
  async function unlockPin(event){
    event.preventDefault();const pin=$("ownerPin").value.trim();
    if(!/^\d{6,12}$/.test(pin))return message("اكتب كودًا من 6 إلى 12 رقمًا.",true);
    const until=Number(localStorage.getItem(LOCK)||0);
    if(Date.now()<until)return message("انتظر "+Math.ceil((until-Date.now())/1000)+" ثانية ثم حاول.",true);
    const button=$("unlockOwnerButton");button.disabled=true;button.textContent="جاري التحقق...";
    try{
      const salt=localStorage.getItem(SALT),expected=localStorage.getItem(HASH);
      if(!salt||!expected){showSetup(true);return;}
      const actual=await hashPin(pin,salt);
      if(actual!==expected){
        const count=Number(localStorage.getItem(ATTEMPTS)||0)+1;
        if(count>=5){localStorage.setItem(LOCK,String(Date.now()+30000));localStorage.setItem(ATTEMPTS,"0");message("الكود غير صحيح. تم إيقاف المحاولات لمدة 30 ثانية.",true);}
        else{localStorage.setItem(ATTEMPTS,String(count));message("الكود غير صحيح. متبقي "+(5-count)+" محاولات.",true);}
        $("ownerPin").value="";return;
      }
      localStorage.removeItem(ATTEMPTS);localStorage.removeItem(LOCK);$("pinLoginForm").reset();openApp();
    }catch(error){message(error?.message||"تعذر التحقق من الكود.",true);}
    finally{button.disabled=false;button.textContent="دخول";}
  }
  function start(){
    if(!$("pinSetupForm")||!$("pinLoginForm")||!$("authGate")){console.error("NOVA PIN: required elements are missing.");return;}
    $("pinSetupForm").addEventListener("submit",savePin);$("pinLoginForm").addEventListener("submit",unlockPin);
    try{showSetup(!localStorage.getItem(HASH)||!localStorage.getItem(SALT));}
    catch(_){showSetup(true);message("المتصفح منع التخزين المحلي. فعّل التخزين للموقع ثم أعد المحاولة.",true);}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();
