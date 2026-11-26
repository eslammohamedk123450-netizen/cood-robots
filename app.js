const $ = (id) => document.getElementById(id);

const state = {
  persona: 'soly',
  emotion: 'idle',
  listening: false,
  recognition: null,
  restartRecognition: false,
  ownerName: 'إسلام'
};

const personas = {
  soly: { name: 'سولي', description: 'صاحبك الأزرق 💙', color: '#69a0ff', accent: '#2760c7', intro: 'سولي معاك' },
  soleen: { name: 'سولين', description: 'صاحبتك الوردية 💗', color: '#f58bc4', accent: '#b62aa5', intro: 'سولين معاكي' }
};

function setStatus(label, stateName = 'idle') {
  state.emotion = stateName;
  $('characterStatus').textContent = label;
  $('voiceState').textContent = label;
  document.body.dataset.mood = stateName;
}

function setPersona(persona) {
  if (!personas[persona]) return;
  state.persona = persona;
  const current = personas[persona];
  document.documentElement.style.setProperty('--persona', current.color);
  document.documentElement.style.setProperty('--persona-deep', current.accent);
  $('personaName').textContent = current.name;
  $('personaDescription').textContent = current.description;
  $('characterStatus').textContent = current.intro;
  $('robotHead').classList.toggle('pink', persona === 'soleen');
  $('hair').hidden = persona !== 'soleen';
  $('bow').hidden = persona !== 'soleen';
  document.querySelectorAll('[data-persona]').forEach((button) => {
    button.classList.toggle('selected', button.dataset.persona === persona);
    button.setAttribute('aria-pressed', String(button.dataset.persona === persona));
  });
  setStatus(current.intro, state.listening ? 'listening' : 'idle');
}

function animateCharacter(kind) {
  const stage = $('characterStage');
  const className = 'gesture-' + kind;
  stage.classList.remove('gesture-wave', 'gesture-happy', 'gesture-thinking', 'gesture-nod');
  void stage.offsetWidth;
  stage.classList.add(className);
  window.setTimeout(() => stage.classList.remove(className), 1500);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function addConversationLine(text, speaker) {
  const log = $('conversationLog');
  const empty = log.querySelector('.empty-conversation');
  if (empty) empty.remove();
  const line = document.createElement('div');
  line.className = 'conversation-line ' + speaker;
  const label = speaker === 'owner' ? state.ownerName : personas[state.persona].name;
  line.innerHTML = '<span>' + escapeHtml(label) + '</span><p>' + escapeHtml(text) + '</p>';
  log.append(line);
  log.scrollTop = log.scrollHeight;
}

function speak(text) {
  if (!('speechSynthesis' in window)) {
    setStatus('الصوت غير مدعوم في المتصفح ده', 'error');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ar-EG';
  utterance.rate = 0.96;
  utterance.pitch = state.persona === 'soleen' ? 1.08 : 0.98;
  utterance.onstart = () => {
    setStatus(personas[state.persona].name + ' بيتكلم', 'speaking');
    animateCharacter('happy');
  };
  utterance.onend = () => setStatus(state.listening ? 'سامعك، كمل كلامك' : 'مستنيك تبدأ', state.listening ? 'listening' : 'idle');
  utterance.onerror = () => setStatus('حصلت مشكلة في تشغيل الصوت', 'error');
  window.speechSynthesis.speak(utterance);
}

function createDemoReply() {
  // Honest placeholder until the authenticated AI endpoint is connected.
  return 'وصلني كلامك يا ' + state.ownerName + '. أنا لسه في مرحلة تجهيز عقل المحادثة، ومش هفتي عليك برد تمثيلي. أول ما نوصل الذكاء الاصطناعي هنتكلم بشكل طبيعي ونكمل من هنا.';
}

function handleRecognizedText(text) {
  const clean = text.trim();
  if (!clean) return;
  $('liveTranscript').textContent = 'أنت قلت: “' + clean + '”';
  addConversationLine(clean, 'owner');
  setStatus('بفكر في كلامك...', 'thinking');
  animateCharacter('thinking');
  const reply = createDemoReply();
  window.setTimeout(() => {
    addConversationLine(reply, 'nova');
    $('liveTranscript').textContent = reply;
    speak(reply);
  }, 350);
}

function stopListening() {
  state.listening = false;
  state.restartRecognition = false;
  $('micButton').classList.remove('active');
  $('micButton').setAttribute('aria-pressed', 'false');
  $('micButton').setAttribute('aria-label', 'ابدأ المحادثة الصوتية');
  $('voiceHint').textContent = 'اضغط على الميكروفون عشان تبدأ محادثة صوتية';
  try { state.recognition?.stop(); } catch (_) {}
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  setStatus('أنا موجود، لما تحب نتكلم', 'idle');
}

function startListening() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    $('liveTranscript').textContent = 'المتصفح ده مش بيدعم التعرف على الكلام. جرّب Chrome أو استخدم الكتابة.';
    showToast('التعرف الصوتي غير متاح في المتصفح الحالي');
    return;
  }
  if (state.listening) return;
  state.listening = true;
  state.restartRecognition = true;
  $('micButton').classList.add('active');
  $('micButton').setAttribute('aria-pressed', 'true');
  $('micButton').setAttribute('aria-label', 'إيقاف المحادثة الصوتية');
  $('voiceHint').textContent = 'أنا سامعك — اضغط الميكروفون مرة تانية للإيقاف';
  setStatus('سامعك يا ' + state.ownerName, 'listening');

  const recognition = new Recognition();
  state.recognition = recognition;
  recognition.lang = 'ar-EG';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  let lastFinal = '';

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const transcript = event.results[i][0].transcript.trim();
      if (event.results[i].isFinal && transcript && transcript !== lastFinal) {
        lastFinal = transcript;
        handleRecognizedText(transcript);
      } else if (!event.results[i].isFinal) {
        interim += transcript;
      }
    }
    if (interim) {
      $('liveTranscript').textContent = interim;
      setStatus('بسمعك...', 'listening');
    }
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      stopListening();
      showToast('اسمح للمتصفح باستخدام الميكروفون من إعدادات الموقع');
    } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
      $('liveTranscript').textContent = 'الصوت اتقطع لحظة. بحاول أرجع أسمعك.';
    }
  };

  recognition.onend = () => {
    if (state.restartRecognition && state.listening) {
      window.setTimeout(() => {
        if (!state.listening || !state.restartRecognition) return;
        try { recognition.start(); } catch (_) {}
      }, 300);
    } else {
      state.listening = false;
      $('micButton').classList.remove('active');
      $('micButton').setAttribute('aria-pressed', 'false');
      setStatus('أنا موجود، لما تحب نتكلم', 'idle');
    }
  };

  try { recognition.start(); }
  catch (_) {
    state.listening = false;
    state.restartRecognition = false;
    showToast('مش قادر أشغل الميكروفون دلوقتي. جرّب تاني.');
  }
}

function submitText(text) {
  const clean = text.trim();
  if (!clean) return;
  $('textInput').value = '';
  handleRecognizedText(clean);
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2800);
}

function openSettings() { $('settingsDialog').showModal(); }
function closeSettings() { $('settingsDialog').close(); }

$('micButton').addEventListener('click', () => state.listening ? stopListening() : startListening());
$('textToggle').addEventListener('click', () => {
  $('textForm').classList.toggle('hidden');
  if (!$('textForm').classList.contains('hidden')) $('textInput').focus();
});
$('transcriptToggle').addEventListener('click', () => $('conversationPanel').classList.toggle('hidden'));
$('textForm').addEventListener('submit', (event) => {
  event.preventDefault();
  submitText($('textInput').value);
});
$('clearConversation').addEventListener('click', () => {
  $('conversationLog').innerHTML = '<p class="empty-conversation">لسه مفيش كلام بينا. ابدأ أول محادثة ❤️</p>';
});
$('settingsButton').addEventListener('click', openSettings);
document.querySelectorAll('[data-persona]').forEach((button) => button.addEventListener('click', () => setPersona(button.dataset.persona)));
$('ownerName').addEventListener('change', (event) => {
  state.ownerName = event.target.value.trim() || 'إسلام';
  $('greeting').textContent = 'أهلاً يا ' + state.ownerName + '، نورتني.';
  showToast('اتحدث اسم النداء على الجهاز ده');
});
$('saveConnection').addEventListener('click', () => {
  showToast('الحفظ الآمن لسه قيد التجهيز — لم يتم تخزين المفتاح في المتصفح');
});
$('settingsDialog').addEventListener('click', (event) => {
  if (event.target === $('settingsDialog')) closeSettings();
});

setPersona('soly');
setStatus('سولي معاك', 'idle');
window.nova = { setPersona, startListening, stopListening, animateCharacter };
