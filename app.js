const $ = (id) => document.getElementById(id);
const state = { persona: 'soly', emotion: 'neutral', mic: false, camera: false, stream: null };
const personas = {
  soly: { name: 'سولي', color: '#69a0ff', accent: '#2760c7', avatar: 'S', intro: 'سولي جاهز يسمعك' },
  soleen: { name: 'سولين', color: '#f58bc4', accent: '#b62aa5', avatar: 'ن', intro: 'سولين جاهزة تكلمك' }
};
const emotions = { neutral: 'عادي', listening: 'بيسمع', thinking: 'بيفكر', speaking: 'بيتكلم', happy: 'سعيد' };
const replies = {
  greet: 'أهلاً يا Andrewwest! أنا معاك.',
  happy: 'حاضر، خليت تعبير وشي سعيد.',
  wave: 'اتنفذت حركة الترحيب في وضع المحاكاة.',
  status: 'كل شيء جاهز: الصوت محلي، الكاميرا اختيارية، والهوية في وضع التجربة.',
  wake: 'صحيت! قولّي الأمر اللي بعده.'
};

function setEmotion(emotion) {
  if (!emotions[emotion]) return;
  state.emotion = emotion;
  const head = $('robotHead');
  const mouth = $('mouth');
  document.querySelectorAll('[data-emotion]').forEach((button) => button.classList.toggle('active', button.dataset.emotion === emotion));
  document.querySelectorAll('.eye').forEach((eye) => eye.style.height = emotion === 'happy' ? '30px' : emotion === 'thinking' ? '35px' : emotion === 'surprised' ? '51px' : '45px');
  document.querySelectorAll('.brow').forEach((brow) => brow.style.transform = emotion === 'sad' ? 'rotate(20deg)' : emotion === 'happy' ? 'rotate(-4deg)' : '');
  mouth.classList.toggle('open', emotion === 'speaking');
  mouth.classList.toggle('sad', emotion === 'sad');
  if (emotion === 'listening') { document.querySelectorAll('.eye span').forEach((p) => p.style.transform = 'translateY(-3px)'); }
  else if (emotion === 'thinking') { document.querySelectorAll('.eye span').forEach((p) => p.style.transform = 'translate(7px,-6px)'); }
  else { document.querySelectorAll('.eye span').forEach((p) => p.style.transform = ''); }
  $('stageCaption').textContent = `${personas[state.persona].name} ${emotions[emotion]}`;
}
function setPersona(persona) {
  state.persona = persona;
  const p = personas[persona];
  document.documentElement.style.setProperty('--accent', p.color);
  document.documentElement.style.setProperty('--head', p.color);
  $('personaTitle').textContent = p.name;
  $('identityStatus').textContent = `${p.name} · مالك`;
  $('stageCaption').textContent = p.intro;
  $('robotHead').classList.toggle('pink', persona === 'soleen');
  $('hair').style.display = persona === 'soleen' ? 'block' : 'none';
  $('hair').style.background = persona === 'soleen' ? 'linear-gradient(90deg,#8c237f 75%,#f5c746 75%)' : 'linear-gradient(90deg,#253653 75%,transparent 75%)';
  $('bow').style.display = persona === 'soleen' ? 'block' : 'none';
  document.querySelectorAll('[data-persona]').forEach((button) => button.classList.toggle('selected', button.dataset.persona === persona));
  document.querySelector('.blue-avatar').textContent = p.avatar;
  document.querySelector('.message-avatar').textContent = p.avatar;
  setEmotion(state.emotion);
}
function animate(action) {
  const stage = $('robotStage');
  stage.classList.remove('wave', 'nod');
  void stage.offsetWidth;
  stage.classList.add(action);
  setTimeout(() => stage.classList.remove(action), 1100);
}
function addMessage(text, from = 'robot') {
  const log = $('chatLog');
  const row = document.createElement('div');
  row.className = `message ${from === 'user' ? 'user-message' : 'robot-message'}`;
  const avatar = from === 'user' ? 'A' : personas[state.persona].avatar;
  row.innerHTML = `<div class="message-avatar ${from === 'user' ? '' : state.persona === 'soleen' ? 'pink-avatar' : 'blue-avatar'}">${avatar}</div><div><span class="message-meta">${from === 'user' ? 'أنت' : personas[state.persona].name} · الآن</span><p>${escapeHtml(text)}</p></div>`;
  log.insertBefore(row, $('commandResult'));
  log.scrollTop = log.scrollHeight;
}
function escapeHtml(value) { return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function speak(text) { if (!('speechSynthesis' in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'ar-EG'; utterance.rate = .95; utterance.onstart = () => setEmotion('speaking'); utterance.onend = () => setEmotion('neutral'); window.speechSynthesis.speak(utterance); }
function processCommand(raw) {
  const text = raw.trim(); if (!text) return;
  addMessage(text, 'user'); setEmotion('thinking'); $('systemStatus').textContent = 'جاري فهم الأمر…';
  setTimeout(() => {
    const t = text.toLowerCase(); let reply = replies.status; let title = 'تم التنفيذ';
    if (t.includes('ترحيب') || t.includes('رحب') || t.includes('حركة')) { reply = replies.wave; animate('wave'); title = 'حركة ترحيب'; }
    else if (t.includes('سعيد') || t.includes('ابتسم') || t.includes('اضحك')) { reply = replies.happy; setEmotion('happy'); title = 'تعبير سعيد'; }
    else if (t.includes('صح') || t.includes('اصحى') || t.includes('استيقظ')) { reply = replies.wake; animate('nod'); title = 'وضع الاستماع'; }
    else if (t.includes('حالة') || t.includes('جاهز')) { reply = replies.status; title = 'حالة النظام'; }
    else if (t.includes('سولي')) { reply = replies.greet; title = 'تحية'; setEmotion('happy'); }
    else { reply = `سمعتك: “${text}”. في الخطوة التالية سيتصل الأمر بعقل الذكاء الاصطناعي عبر Supabase Edge Function.`; title = 'تم استقبال الأمر'; }
    addMessage(reply); $('resultTitle').textContent = title; $('resultText').textContent = 'تم التنفيذ في وضع المحاكاة المحلي'; $('commandResult').classList.remove('hidden'); $('systemStatus').textContent = 'جاهز للتجربة'; $('commandInput').value = ''; speak(reply);
  }, 550);
}
async function toggleCamera() {
  if (state.camera) { state.stream?.getTracks().forEach((track) => track.stop()); state.stream = null; state.camera = false; $('cameraVideo').srcObject = null; $('cameraPreview')?.classList.remove('active'); $('cameraPlaceholder').parentElement.classList.remove('active'); $('cameraBtn').textContent = 'تشغيل الكاميرا'; $('cameraStatus').textContent = 'غير مفعلة'; $('cameraLed').classList.remove('on'); $('enrollBtn').disabled = true; return; }
  if (!navigator.mediaDevices?.getUserMedia) { showToast('الكاميرا تحتاج HTTPS ومتصفحًا يدعم getUserMedia'); return; }
  try { state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }); state.camera = true; $('cameraVideo').srcObject = state.stream; $('cameraPreview')?.classList.add('active'); $('cameraVideo').parentElement.classList.add('active'); $('cameraBtn').textContent = 'إيقاف الكاميرا'; $('cameraStatus').textContent = 'تعمل محليًا'; $('cameraLed').classList.add('on'); $('scanLabel').textContent = 'FACE PRESENCE / LOCAL'; $('enrollBtn').disabled = false; showToast('تم تشغيل الكاميرا محليًا'); } catch (error) { showToast('لم يتم السماح بالكاميرا أو لا توجد كاميرا متاحة'); }
}
function startMic() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) { showToast('التعرف الصوتي غير مدعوم في هذا المتصفح — استخدم الكتابة'); return; }
  if (state.mic) return;
  const recognition = new Recognition(); recognition.lang = 'ar-EG'; recognition.interimResults = false; recognition.maxAlternatives = 1; state.mic = true; $('micBtn').classList.add('listening'); $('micStatus').textContent = 'استمع…'; setEmotion('listening');
  recognition.onresult = (event) => { $('commandInput').value = event.results[0][0].transcript; processCommand($('commandInput').value); };
  recognition.onerror = () => showToast('لم أستطع فهم الصوت، جرب مرة أخرى');
  recognition.onend = () => { state.mic = false; $('micBtn').classList.remove('listening'); $('micStatus').textContent = 'الميكروفون متوقف'; setEmotion('neutral'); };
  recognition.start();
}
function showToast(text) { const toast = $('toast'); toast.textContent = text; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2800); }
function saveSettings() { localStorage.setItem('nova-settings', JSON.stringify({ url: $('supabaseUrl').value, key: $('supabaseKey').value, endpoint: $('aiEndpoint').value })); $('settingsNote').textContent = 'تم حفظ الإعدادات على هذا الجهاز فقط.'; showToast('تم حفظ إعدادات التجربة محليًا'); }
function loadSettings() { try { const data = JSON.parse(localStorage.getItem('nova-settings') || '{}'); $('supabaseUrl').value = data.url || ''; $('supabaseKey').value = data.key || ''; $('aiEndpoint').value = data.endpoint || ''; } catch (_) {} }

document.querySelectorAll('.nav-link').forEach((button) => button.addEventListener('click', () => { document.querySelectorAll('.nav-link').forEach((b) => b.classList.remove('active')); document.querySelectorAll('.view').forEach((v) => v.classList.remove('active')); button.classList.add('active'); $(`view-${button.dataset.view}`).classList.add('active'); }));
document.querySelectorAll('[data-persona]').forEach((button) => button.addEventListener('click', () => setPersona(button.dataset.persona)));
document.querySelectorAll('[data-emotion]').forEach((button) => button.addEventListener('click', () => setEmotion(button.dataset.emotion)));
document.querySelectorAll('[data-command]').forEach((button) => button.addEventListener('click', () => processCommand(button.dataset.command)));
$('commandForm').addEventListener('submit', (event) => { event.preventDefault(); processCommand($('commandInput').value); }); $('micBtn').addEventListener('click', startMic); $('cameraBtn').addEventListener('click', toggleCamera); $('saveSettings').addEventListener('click', saveSettings);
$('clearChat').addEventListener('click', () => { document.querySelectorAll('.chat-log .message:not(:first-child)').forEach((node) => node.remove()); $('commandResult').classList.add('hidden'); showToast('تم تنظيف المحادثة'); });
$('ownerDemo').addEventListener('click', () => { setEmotion('listening'); showToast('تم التعرف على المالك في الوضع التجريبي'); setTimeout(() => setEmotion('happy'), 700); }); $('enrollBtn').addEventListener('click', () => showToast('تم حفظ لقطة الوجه كتجربة محلية — الربط الحقيقي يأتي عبر Face API + Supabase')); $('addPerson').addEventListener('click', () => showToast('إضافة الأشخاص ستُحفظ في Supabase في المرحلة التالية'));
const dialog = $('helpDialog'); $('helpBtn').addEventListener('click', () => dialog.showModal()); $('closeHelp').addEventListener('click', () => dialog.close()); $('dialogOk').addEventListener('click', () => dialog.close());
setInterval(() => { const eyes = document.querySelectorAll('.eye'); eyes.forEach((eye) => eye.style.height = '3px'); setTimeout(() => eyes.forEach((eye) => eye.style.height = state.emotion === 'happy' ? '30px' : '45px'), 120); }, 4200);
loadSettings(); setPersona('soly'); setEmotion('neutral');
window.robot = { setPersona, setEmotion, processCommand };
