const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const STOP_WORDS = new Set([
  "فاكر","فاكرة","فاكره","فاكراه","تفتكر","تفتكري","افتكر","افتكري","هات","هاتي","رجع","رجعي","استرجع","استرجعي",
  "حافظاه","حافظه","خليكي","خليك","سولينا","لينا","سيلينا","سلينا","او","صححيه","صححه","صححتيه","صححته","عدلتيه","عدلته","تعدليه","تعدله","قولت","قلتلك",
  "قولي","قول","لي","لك","لها","عندي","اللي","قلت","قلته","حفظ","حفظتي","حفظته","ملاحظات","ملاحظة",
  "رقم","الرقم","الحاجة","المعلومة","معلومات","ايه","إيه","من","في","على","ده","دي","دا","هو","هي",
  "انا","انت","كان","قال","قالي","ليه","ازاي","مع","ولا","او","امبارح","أمس","مبارح","النهارده",
  "النهاردة","اليوم","الساعة","الساعه","ساعة","صباح","الصبح","مساء","بالليل","ليل","فاكراني"
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

export function extractMemoryTokens(value) {
  const normalized = normalizeMemoryText(value);
  const hasClock = /(?:الساعة|الساعه|ساعة)\s*\d/u.test(normalized);
  return [...new Set((normalized.match(/[\p{L}\p{N}]{2,}/gu) || []).filter((word) =>
    !STOP_WORDS.has(word) && !(hasClock && /^\d{1,2}$/u.test(word))
  ))].slice(0, 8);
}

function startsWithExplicitMemorySave(value) {
  const text = normalizeMemoryText(value).replace(/^(?:(?:يا\s+)?(?:سولينا|لينا|سيلينا|سلينا)\s+)+/u, "");
  return /^(?:خلي(?:كي|ك)\s+(?:فاكر(?:ة|ه|اه)?|في\s+بالك)(?:\s+عندك)?|احفظ(?:ي)?|سجل(?:ي)?|افتكر(?:ي)?\s+(?:ان|بأن|عندك))(?:\s|$)/u.test(text);
}

export function isCorrectionHistoryRecall(value) {
  const text = normalizeMemoryText(value);
  return /(?:الرقم|المعلومة).{0,70}(?:صححتيه|صححته|عدلتيه|عدلته)|(?:فاكر(?:ة|ه|اه)?|تفتكر(?:ي|ه)?).{0,100}(?:صححتيه|صححته|عدلتيه|عدلته)|(?:اللي|الذي).{0,50}(?:قلت|قولت).{0,30}(?:صححيه|صححه|تعدليه|تعدله)/u.test(text);
}

export function isExplicitMemoryRecall(value) {
  const text = normalizeMemoryText(value);
  // A direct "خليكي فاكرة..." command is a save instruction, not a recall question.
  if (startsWithExplicitMemorySave(text)) return false;
  return /(?:فاكر(?:ة|ه|اه)?|تفتكر(?:ي|ه)?)\s+(?:ال)?(?:رقم|الحاجة|المعلومة|اللي|كنا|احنا|الموضوع)|(?:هات|هاتي|قولي|قول|رجعلي|رجعيلي|استرجع|استرجعي|اعرض|اعرضي)\s*(?:لي)?\s*(?:الرقم|رقم|الحاجة|المعلومة|الملاحظات?|المحفوظ)|(?:ايه|إيه)\s*(?:هو\s*)?(?:ال)?(?:رقم|الحاجة|المعلومة)|(?:اللي\s+حفظ(?:تي|ت|ته)|الملاحظ(?:ة|ات)\s*(?:اللي|بتاعتي)|ملاحظاتي|اللي\s+قلت(?:ه|لك)|فاكراني\s+رقم)/u.test(text);
}

export function parseExplicitMemorySave(value) {
  const text = String(value ?? "").trim();
  if (!text || isExplicitMemoryRecall(text)) return null;
  const trigger = /(?:خلي(?:كي|ك)\s+(?:فاكر(?:ة|ه|اه)?|في\s+بالك)(?:\s+عندك)?|احفظ(?:ي)?|سجل(?:ي)?|افتكر(?:ي)?\s+(?:إن|ان|بأن|عندك))\s*(?:إن|ان|بأن)?\s*(?:ده|دي|دا)?\s*[:،]?\s*/giu;
  const matches = [...text.matchAll(trigger)];
  // Voice recognition may repeat the full save command after a wake word.
  // Use the last command marker so the payload does not absorb the repeated phrase.
  const match = matches[matches.length - 1];
  const payload = match ? text.slice((match.index ?? 0) + match[0].length).trim().replace(/^["'«»]+|["'«»]+$/g, "").trim() : null;
  return payload && payload.length >= 2 ? payload : null;
}

export function parseExplicitMemoryCorrection(value) {
  const text = String(value ?? "").trim();
  const targetMatch = text.match(/(?:صححي|صحح|عدلي|عدل|بدلي|استبدلي)\s+(?:لي\s+)?(?:ال)?(?:رقم|المعلومة)\s+(?:(?:الخاص\s+ب|بتاع|بتاعة|المتعلق\s+ب)\s*)?(.+?)\s+(?:وخليه|وخليها|إلى|الى|ب|بال|الصحيح|الصح|الجديد)\s*[:،]?\s*([\s\S]{2,12000})$/iu);
  if (targetMatch && !/^(?:المحفوظ|القديم|ده|دي|دا)$/u.test(normalizeMemoryText(targetMatch[1]))) {
    const target = targetMatch[1].trim().replace(/^(?:ال)?(?:رقم|المعلومة)\s+/u, "");
    const correctedValue = targetMatch[2].trim().replace(/^["'«»]+|["'«»]+$/g, "").trim();
    if (target && correctedValue.length >= 2) return { target, value: correctedValue };
  }
  const genericMatch = text.match(/(?:صححي|صحح|عدلي|عدل|بدلي|استبدلي)\s+(?:لي\s+)?(?:ال)?(?:رقم|المعلومة)(?:\s+(?:المحفوظ|القديم|ده|دي))?\s*(?:[:،]\s*|(?:غلط|خطا|مش\s+صحيح|غير\s+صحيح)[\s،:؛]*(?:وال)?(?:الصحيح|الصح|الجديد)\s*[:،]?\s*|(?:والصحيح|والصح|والجديد|وخليه|وخليها|الصحيح|الصح|الجديد|خليه|خليها|إلى|الى|ب)\s*[:،]?\s*)([\s\S]{2,12000})$/iu);
  const wrongOldMatch = text.match(/(?:الرقم|المعلومة)\s+(?:المحفوظ|القديم)\s+(?:غلط|خطا|مش\s+صحيح|غير\s+صحيح)[\s،:؛]*(?:وال)?(?:الصحيح|الصح|الجديد)\s*[:،]?\s*([\s\S]{2,12000})$/iu);
  const match = genericMatch || wrongOldMatch;
  const correctedValue = match?.[1]?.trim().replace(/^["'«»]+|["'«»]+$/g, "").trim();
  return correctedValue && correctedValue.length >= 2 ? { target: "", value: correctedValue } : null;
}

export function classifyMemoryKind(value) {
  const text = normalizeMemoryText(value);
  const spokenNumbers = (text.match(/(?:^|\s)(?:واحد|واحده|اتنين|اثنين|تلاته|ثلاثه|اربعه|خمسه|ستة|سته|سبعه|تمانيه|تمنيه|ثمانيه|تسعه|عشره|حداشر|احداشر|اتناشر|اثناشر|عشرين|تلاتين|ثلاثين|اربعين|خمسين|ميه|مائه|الف)(?=\s|$)/gu) || []).length;
  if (/(?:مشروع|تطبيق|موقع|شركة|منصة|نظام)/u.test(text)) return "project";
  if (/(?:قرار|اتفقنا|اعتمدنا|هنستخدم|هنعمل|اخترنا)/u.test(text)) return "decision";
  if (/(?:مهمة|لازم|مطلوب|متبقي|هعمل|هتعمل|تابع|خلص)/u.test(text)) return "task";
  if (/\d{3,}/u.test(text) || spokenNumbers >= 2) return "reference";
  return "note";
}
