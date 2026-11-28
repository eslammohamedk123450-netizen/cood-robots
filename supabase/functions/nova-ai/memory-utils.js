const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const STOP_WORDS = new Set([
  "فاكر","فاكرة","فاكره","فاكراه","تفتكر","تفتكري","افتكر","افتكري",
  "هات","هاتي","رجع","رجعي","استرجع","استرجعي","حافظاه","حافظه",
  "حفظتها","حفظته","حفظتيها","تحفظيها","تحفظها","عن","المعلومه","معلومه",
  "الرقم","رقم","كلمة","الكلمة","كلمه","الكلمه","احفظيها","احفظها",
  "احفظي","احفظ","خليكي","خليك","سولينا","لينا","سيلينا","سلينا",
  "او","صححيه","صححه","صححتيه","صححته","عدلتيه","عدلته","تعدليه",
  "تعدله","قولت","قلتلك","قولي","قول","لي","لك","لها",
  "عندي","اللي","قلت","قلته","حفظ","حفظتي","ملاحظات","ملاحظة",
  "اتصحح","اتعدل","قبل","التصحيح","القيمة","القديمة","الحاجة","المعلومة",
  "معلومات","ايه","إيه","من","في","على","ده","دي",
  "دا","هو","هي","انا","انت","كان","قال","قالي",
  "ليه","ازاي","مع","ولا","امبارح","أمس","مبارح","النهارده",
  "احذفي","احذف","امسحي","امسح","شيل","شيلي","فيها","فيه",
  "التي","الذي","الخاصة","الخاص","بخصوص","بشأن","المحفوظة","المحفوظ",
  "النهاردة","اليوم","الساعة","الساعه","ساعة","صباح","الصبح","مساء",
  "بالليل","ليل","فاكراني"
]);

export function normalizeMemoryText(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ar");
}

const MEMORY_WEEKDAY_OFFSETS = Object.freeze({
  "السبت": 0,
  "الاحد": 1,
  "الاثنين": 2,
  "الثلاثاء": 3,
  "الاربعاء": 4,
  "الخميس": 5,
  "الجمعة": 6,
});

export function classifyMemoryPeriodRequest(value) {
  const normalized = normalizeMemoryText(value);
  const asksToday = /(?:النهارده|النهاردة|اليوم)/u.test(normalized);
  const asksYesterday = /(?:امبارح|مبارح|امس)/u.test(normalized);
  const asksThisWeek = /(?:الاسبوع ده|الاسبوع الحالي|اسبوعنا ده)/u.test(normalized);
  const asksWholeWeek = /(?:الاسبوع كله|كل الاسبوع|كل اللي حفظته|كل المحفوظ|اعرضي?لي? كل|وريني كل|كله)/u.test(normalized);
  const words = new Set(normalized.split(" "));
  const requestedWeekday = Object.keys(MEMORY_WEEKDAY_OFFSETS).find((day) => words.has(day)) || null;
  return {
    asksToday,
    asksYesterday,
    asksThisWeek,
    asksWholeWeek,
    requestedWeekday,
    shouldClarifyWeek: asksThisWeek && !asksWholeWeek && !asksToday && !asksYesterday && !requestedWeekday,
  };
}

export function getCairoWeekDateKeys(now = new Date()) {
  const dateOptions = { year: "numeric", month: "2-digit", day: "2-digit" };
  const cairoDateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", ...dateOptions });
  const utcDateKey = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", ...dateOptions });
  const todayKey = cairoDateKey.format(now);
  const todayAnchor = new Date(todayKey + "T12:00:00.000Z");
  const yesterdayDate = new Date(todayAnchor);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const localWeekday = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", weekday: "short" }).format(todayAnchor);
  const daysSinceSaturday = ({ Sat: 0, Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6 })[localWeekday] ?? 0;
  const weekStartDate = new Date(todayAnchor);
  weekStartDate.setUTCDate(weekStartDate.getUTCDate() - daysSinceSaturday);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6);
  const weekdayKeys = {};
  for (const [day, offset] of Object.entries(MEMORY_WEEKDAY_OFFSETS)) {
    const date = new Date(weekStartDate);
    date.setUTCDate(date.getUTCDate() + offset);
    weekdayKeys[day] = utcDateKey.format(date);
  }
  return {
    todayKey,
    yesterdayKey: utcDateKey.format(yesterdayDate),
    weekStartKey: utcDateKey.format(weekStartDate),
    weekEndKey: utcDateKey.format(weekEndDate),
    weekdayKeys,
  };
}

export function extractMemoryTokens(value) {
  const normalized = normalizeMemoryText(value);
  const hasClock = /(?:الساعة|الساعه|ساعة)\s*\d/u.test(normalized);
  return [...new Set((normalized.match(/[\p{L}\p{N}]{2,}/gu) || []).filter((word) =>
    !STOP_WORDS.has(word) && !(hasClock && /^\d{1,2}$/u.test(word))
  ))].slice(0, 8);
}

function startsWithExplicitMemorySave(value) {
  const text = normalizeMemoryText(value).replace(/^(?:(?:يا\s+)?(?:سولينا|لينا|سيلينا|سلينا)\s+)+/u, "");
  return /^(?:خلي(?:كي|ك)\s+(?:فاكر(?:ة|ه|اه)?|في\s+بالك)(?:\s+عندك)?|احفظ(?:ي)?(?![\p{L}\p{N}_])|سجل(?:ي)?(?![\p{L}\p{N}_])|افتكر(?:ي)?\s+(?:ان|بأن|عندك))(?:\s|$)/u.test(text);
}

export function isCorrectionHistoryRecall(value) {
  const text = normalizeMemoryText(value).replace(/^(?:(?:يا\s+)?(?:سولينا|لينا|سيلينا|سلينا)\s+)+/u, "");
  const explicitHistory = /(?:قبل\s+(?:ما\s+)?(?:التصحيح|التعديل|ما\s+يتصحح)|(?:القيمة|الرقم)\s+(?:القديم|القديمة|السابقة|قبل\s+التصحيح)|القديم\s+كان|اتصحح|اتعدل|بعد\s+التصحيح|بعد\s+التعديل|اللي\s+اتصحح|اللي\s+اتعدل|اللي\s+(?:(?:قلت|قولت)\s+(?:لك|لي)\s+)?(?:تصحح|تصحيه|تصححيه|اتصحح)|(?:صحح(?:تيه|ته|يه|ه)|عدل(?:تيه|ته|يه|ه)|تصحح(?:ه|يه)?))/u.test(text)
    && /(?:رقم|الرقم|قيمة|القيمة|تصحيح|التصحيح|اتصحح|اتعدل|تعديل|قديم|قديمة|السابق|السابقة)/u.test(text);
  const genericOldValueRecall = /(?:فاكر(?:ة|ه|اه)?|تفتكر(?:ي|ه)?|قولي|قول|هات|هاتي).{0,90}(?:القديم|القديمة|السابق|السابقة|قبل\s+التعديل|قبل\s+التصحيح)/u.test(text);
  return explicitHistory || genericOldValueRecall;
}

export function isWordMemoryRecall(value) {
  const text = normalizeMemoryText(value).replace(/^(?:(?:يا\s+)?(?:سولينا|لينا|سيلينا|سلينا)\s+)+/u, "");
  return /(?:فاكر(?:ة|ه|اه)?|تفتكر(?:ي|ه)?|هات|هاتي|رجع|رجعي|قولي|قول).{0,100}(?:الكلمة|كلمة|الكلمه|كلمه)(?:\s|$)|(?:الكلمة|كلمة|الكلمه|كلمه).{0,100}(?:اللي\s+قلت|احفظتيها|حفظتيها|قلت\s+لك)/u.test(text);
}

export function isExplicitMemoryRecall(value) {
  const text = normalizeMemoryText(value).replace(/^(?:(?:يا\s+)?(?:سولينا|لينا|سيلينا|سلينا)\s+)+/u, "");
  // A direct "خليكي فاكرة..." command is a save instruction, not a recall question.
  if (startsWithExplicitMemorySave(text)) return false;
  if (isCorrectionHistoryRecall(text)) return true;
  return /(?:فاكر(?:ة|ه|اه)?|تفتكر(?:ي|ه)?)\s+(?:ال)?(?:رقم|الحاجة|المعلومة|كلمة|كلمه|اللي|كنا|احنا|الموضوع)|(?:هات|هاتي|قولي|قول|رجعلي|رجعيلي|استرجع|استرجعي|اعرض|اعرضي|وريني|جيبلي|طلعلي)\s*(?:لي)?\s*(?:كل\s*)?(?:ال)?(?:رقم|الحاجة|معلومات|معلومة|ملاحظات?|محفوظات|محفوظ|اللي\s+عندك)|(?:ايه|إيه)\s*(?:هو\s*)?(?:ال)?(?:رقم|الحاجة|المعلومة)|(?:اللي\s+حفظ(?:تي|ت|ته)|(?:الكلمة|كلمة|الكلمه|كلمه)\s+(?:اللي\s+)?(?:قلت|قولت)|الملاحظ(?:ة|ات)\s*(?:اللي|بتاعتي)|ملاحظاتي|اللي\s+قلت(?:ه|لك)|فاكراني\s+رقم)/u.test(text);
}

export function parseExplicitMemorySave(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const normalized = normalizeMemoryText(text);
  if (isExplicitMemoryRecall(text) && !startsWithExplicitMemorySave(text)) return null;
  const words = normalized.split(" ");
  // A correction may end with "احفظي القيمة القديمة". That is part of the
  // correction request, never a separate memory-save command.
  const correctionWords = new Set(["صحح", "صححي", "عدل", "عدلي", "بدل", "بدلي", "غير", "غيري", "استبدل", "استبدلي"]);
  if (words.some((word) => correctionWords.has(word))) return null;
  const trigger = /(?<![\p{L}\p{N}_])(?:خلي(?:كي|ك)\s+(?:فاكر(?:ة|ه|اه)?|في\s+بالك)(?:\s+عندك)?|احفظ(?:ي)?(?![\p{L}\p{N}_])|سجل(?:ي)?(?![\p{L}\p{N}_])|افتكر(?:ي)?\s+(?:إن|ان|بأن|عندك))\s*(?:إن|ان|بأن)?\s*(?:ده|دي|دا)?\s*[:،]?\s*/giu;
  const matches = [...text.matchAll(trigger)];
  const match = matches[matches.length - 1];
  const payload = match ? text.slice((match.index ?? 0) + match[0].length).trim().replace(/^["'«»]+|["'«»]+$/g, "").trim() : null;
  return payload && payload.length >= 2 ? payload : null;
}

export function parseExplicitMemoryCorrection(value) {
  let text = String(value ?? "").trim();
  text = text
    .replace(/^(?:(?:يا\s+)?(?:سولينا|لينا|سيلينا|سلينا)\s+)+/u, "")
    .replace(/^(?:(?:انا|أنا)\s+)?(?:عايزك|عاوزك|ممكن)\s+/u, "")
    .replace(/^ت(?=(?:صححي|صحح|عدلي|عدل|بدلي|استبدلي)\s)/u, "")
    .replace(/\s+(?:يا\s+)?(?:سولينا|لينا|سيلينا|سلينا)[.!؟،\s]*$/u, "")
    .trim();
  const targetMatch = text.match(/(?:صححي|صحح|عدلي|عدل|بدلي|استبدلي)\s+(?:لي\s+)?(?:ال)?(?:رقم|المعلومة)\s+(?:(?:الخاص\s+ب|بتاع|بتاعة|المتعلق\s+ب)\s*)?(.+?)\s+(?:وخليه|وخليها|إلى|الى|ب|بال|الصحيح|الصح|الجديد)\s*[:،]?\s*([\s\S]{2,12000})$/iu);
  if (targetMatch && !/^(?:المحفوظ|القديم|ده|دي|دا|اللي\s+(?:انت\s+)?حفظتيه)$/u.test(normalizeMemoryText(targetMatch[1]))) {
    const target = targetMatch[1].trim().replace(/^(?:ال)?(?:رقم|المعلومة)\s+/u, "");
    const correctedValue = targetMatch[2].trim().replace(/^["'«»]+|["'«»]+$/g, "").trim();
    if (target && correctedValue.length >= 2) return { target, value: correctedValue };
  }
  const genericMatch = text.match(/(?:صححي|صحح|عدلي|عدل|بدلي|استبدلي)\s+(?:لي\s+)?(?:ال)?(?:رقم|المعلومة)(?:\s+(?:المحفوظ|القديم|ده|دي|دا|اللي\s+(?:انت\s+)?حفظتيه))?\s*(?:[:،]\s*|(?:غلط|خطا|مش\s+صحيح|غير\s+صحيح)[\s،:؛]*(?:وال)?(?:الصحيح|الصح|الجديد)\s*[:،]?\s*|(?:والصحيح|والصح|والجديد|وخليه|وخليها|الصحيح|الصح|الجديد|خليه|خليها|إلى|الى|ب)\s*[:،]?\s*)([\s\S]{2,12000})$/iu);
  const wrongOldMatch = text.match(/(?:الرقم|المعلومة)\s+(?:المحفوظ|القديم)\s+(?:غلط|خطا|مش\s+صحيح|غير\s+صحيح)[\s،:؛]*(?:وال)?(?:الصحيح|الصح|الجديد)\s*[:،]?\s*([\s\S]{2,12000})$/iu);
  const match = genericMatch || wrongOldMatch;
  const correctedValue = match?.[1]?.trim().replace(/^["'«»]+|["'«»]+$/g, "").trim();
  return correctedValue && correctedValue.length >= 2 ? { target: "", value: correctedValue } : null;
}
const SPOKEN_DIGIT_VALUES = new Map([
  ["صفر","0"],["زيرو","0"],["واحد","1"],["واحدة","1"],["واحده","1"],
  ["اتنين","2"],["اثنين","2"],["تنين","2"],["تلاته","3"],["تلاتة","3"],["ثلاثه","3"],["ثلاثة","3"],
  ["اربعه","4"],["اربعة","4"],["أربعة","4"],["خمسه","5"],["خمسة","5"],
  ["سته","6"],["ستة","6"],["سبعه","7"],["سبعة","7"],["تمانيه","8"],["تمانية","8"],["تمنيه","8"],["ثمانية","8"],
  ["تسعه","9"],["تسعة","9"]
]);

function spokenDigitSequences(text) {
  const found = [];
  let current = "";
  const flush = () => { if (current.length >= 3) found.push(current); current = ""; };
  for (const raw of text.split(/\s+/u).filter(Boolean)) {
    const word = raw === "و" ? "" : raw;
    let digit = SPOKEN_DIGIT_VALUES.get(word);
    if (digit === undefined && word.startsWith("و")) digit = SPOKEN_DIGIT_VALUES.get(word.slice(1));
    if (digit !== undefined) current += digit;
    else flush();
  }
  flush();
  return found;
}

export function extractMemoryNumberSignature(value) {
  const text = normalizeMemoryText(value);
  const spaced = [...text.matchAll(/(?:^|\s)((?:\d\s+){2,}\d)(?=\s|$)/gu)]
    .map((match) => match[1].replace(/\s+/g, ""));
  const compact = [...text.matchAll(/(?:^|\s)(\d{3,})(?=\s|$)/gu)].map((match) => match[1]);
  const candidates = [...spaced, ...compact, ...spokenDigitSequences(text)].filter(Boolean);
  if (!candidates.length) return "";
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

export function classifyMemoryKind(value) {
  const text = normalizeMemoryText(value);
  const spokenNumbers = (text.match(/(?:^|\s)(?:واحد|واحده|اتنين|اثنين|تلاته|ثلاثه|اربعه|خمسه|ستة|سته|سبعه|تمانيه|تمنيه|ثمانيه|تسعه|عشره|حداشر|احداشر|اتناشر|اثناشر|عشرين|تلاتين|ثلاثين|اربعين|خمسين|ميه|مائه|الف)(?=\s|$)/gu) || []).length;
  if (/(?:مشروع|تطبيق|موقع|شركة|منصة|نظام)/u.test(text)) return "project";
  if (/(?:قرار|اتفقنا|اعتمدنا|هنستخدم|هنعمل|اخترنا)/u.test(text)) return "decision";
  if (/(?:مهمة|لازم|مطلوب|متبقي|هعمل|هتعمل|تابع|خلص)/u.test(text)) return "task";
  if (extractMemoryNumberSignature(text) || /\d{3,}/u.test(text) || spokenNumbers >= 2) return "reference";
  if (/(?:^|\s)(?:الكلمة|كلمة|الكلمه|كلمه)(?:\s|$)/u.test(text)) return "word";
  return "note";
}
