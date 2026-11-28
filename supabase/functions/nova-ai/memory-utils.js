const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const STOP_WORDS = new Set([
  "فاكر","فاكرة","تفتكر","تفتكري","افتكر","افتكري","هات","هاتي","رجع","رجعي","استرجع","استرجعي",
  "قولي","قول","لي","لها","عندي","اللي","قلت","قلته","حفظ","حفظتي","حفظته","ملاحظات","ملاحظة",
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

export function parseExplicitMemorySave(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/(?:خلي(?:كي|ك)\s+(?:فاكر(?:ة)?|في\s+بالك)(?:\s+عندك)?|احفظ(?:ي)?|سجل(?:ي)?|افتكر(?:ي)?\s+(?:إن|ان|بأن|عندك))\s*(?:إن|ان|بأن)?\s*(?:ده|دي|دا)?\s*[:،]?\s*([\s\S]{2,12000})$/iu);
  const payload = match?.[1]?.trim().replace(/^["'«»]+|["'«»]+$/g, "").trim();
  return payload && payload.length >= 2 ? payload : null;
}

export function isExplicitMemoryRecall(value) {
  const text = normalizeMemoryText(value);
  return /(?:فاكر(?:ة)?|تفتكر(?:ي)?)\s+(?:الرقم|رقم|الحاجة|المعلومة|اللي|كنا|احنا|الموضوع)|(?:هات|هاتي|قولي|قول|رجعلي|رجعيلي|استرجع|استرجعي|اعرض|اعرضي)\s*(?:لي)?\s*(?:الرقم|رقم|الحاجة|المعلومة|الملاحظات?|المحفوظ)|(?:ايه|إيه)\s*(?:هو\s*)?(?:ال)?(?:رقم|الحاجة|المعلومة)|(?:اللي\s+حفظ(?:تي|ت|ته)|الملاحظ(?:ة|ات)\s*(?:اللي|بتاعتي)|ملاحظاتي|اللي\s+قلت(?:ه|لك)|فاكراني\s+رقم)/u.test(text);
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
