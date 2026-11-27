const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const SPOKEN_NUMBERS = {
  "واحد":"1", "واحدة":"1", "اتنين":"2", "اثنين":"2",
  "تلاتة":"3", "ثلاثة":"3", "اربعة":"4", "أربعة":"4",
  "خمسة":"5", "ستة":"6", "سبعة":"7", "تمانية":"8",
  "تمنية":"8", "ثمانية":"8", "تسعة":"9", "عشرة":"10",
  "حداشر":"11", "احداشر":"11", "اتناشر":"12", "اثناشر":"12"
};
function replaceSpokenNumbers(text) {
  const words = Object.keys(SPOKEN_NUMBERS).join("|");
  return text.replace(new RegExp("(^|\\s)(" + words + ")(?=$|\\s)", "g"), (all, prefix, word) => prefix + SPOKEN_NUMBERS[word]);
}
export function normalizeTaskText(value) {
  return String(value || "")
    .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[،.!؟?؛,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ar");
}
function nextClockTime(hour, minute, dayPart, explicitDay, now) {
  let hours = hour;
  if (dayPart && /مساء|بالليل|ليل/.test(dayPart) && hours < 12) hours += 12;
  if (dayPart && /صباح|الصبح/.test(dayPart) && hours === 12) hours = 0;
  if (hours > 23 || minute > 59) return null;
  const target = new Date(now);
  target.setSeconds(0, 0);
  target.setHours(hours, minute, 0, 0);
  if (explicitDay === "tomorrow") target.setDate(target.getDate() + 1);
  else if (explicitDay === "afterTomorrow") target.setDate(target.getDate() + 2);
  else if (target.getTime() <= now.getTime() && !dayPart && hours > 0 && hours < 12) {
    const afternoon = new Date(target);
    afternoon.setHours(hours + 12, minute, 0, 0);
    if (afternoon.getTime() > now.getTime()) return afternoon;
    target.setDate(target.getDate() + 1);
  } else if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target;
}
function parseSchedule(text, now = new Date()) {
  const durationPatterns = [
    [/بعد\s+نص\s+ساعه|بعد\s+نصف\s+ساعه/, 30 * 60 * 1000],
    [/بعد\s+ربع\s+ساعه/, 15 * 60 * 1000],
    [/بعد\s+ساعتين/, 2 * 60 * 60 * 1000],
    [/بعد\s+ساعه/, 60 * 60 * 1000]
  ];
  for (const [pattern, duration] of durationPatterns) if (pattern.test(text)) return new Date(now.getTime() + duration);
  const relative = text.match(/بعد\s+(\d+)\s*(دقيقه|دقيقة|دقائق|ساعه|ساعة|ساعات)/);
  if (relative) {
    const amount = Number(relative[1]);
    const ms = /ساع/.test(relative[2]) ? amount * 60 * 60 * 1000 : amount * 60 * 1000;
    if (amount > 0 && amount <= 10000) return new Date(now.getTime() + ms);
  }
  const clockText = replaceSpokenNumbers(text);
  const match = clockText.match(/(?:الساعه\s*|الساعة\s*)?(\d{1,2})(?::(\d{2}))?\s*(صباحا|صباح|الصبح|مساء|بالليل|ليل)?/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const dayPart = match[3] || "";
  if (hour < 0 || hour > 23 || minute > 59) return null;
  const day = /بعد بكره|بعد بكرة|بعد غد/.test(text) ? "afterTomorrow" : /بكره|بكرة|غدا/.test(text) ? "tomorrow" : null;
  const date = nextClockTime(hour, minute, dayPart, day, now);
  return date && date > now ? date : null;
}
function stripCommandWords(text) {
  const numberWords = Object.keys(SPOKEN_NUMBERS).join("|");
  return text
    .replace(/(?:يا\s*)?سولينا/g, " ")
    .replace(/(?:من فضلك|لو سمحتي|لو سمحت|ممكن|عايزك|عاوزك|اعملي|اعمل|سجلي|سجل|ضيفي|ضيف|فكريني|فكرني|ذكريني|ذكرني|صحيني|اصحيني|اصحى|منبه|تذكير|تذكيرني|بكره|بكرة|غدا|بعد بكره|بعد بكرة|بعد غد|بعد|نص|نصف|ساعه|ساعة|ساعتين|دقيقه|دقيقة|دقائق|النهارده|اليوم|الساعه|الساعة|صباحا|صباح|الصبح|مساء|بالليل|ليل)/g, " ")
    .replace(new RegExp("(^|\\s)(?:" + numberWords + ")(?=$|\\s)", "g"), " ")
    .replace(/\d{1,2}(?::\d{2})?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function parseTaskCommand(value, now = new Date()) {
  const text = normalizeTaskText(value);
  if (!text) return null;
  const isFajr = /الفجر|صلاه الفجر|صلاة الفجر/.test(text);
  const isAlarm = /صحيني|اصحيني|اصحى|(?:اعملي|اعمل|سجلي|سجل|اضبطي|اضبط)\s+منبه|منبه\s+(?:الساعه|الساعة|\d)/.test(text);
  const isReminder = /فكريني|فكرني|ذكريني|ذكرني|تذكير|تذكيرني|سجل.*مهمه|سجلي.*مهمه/.test(text);
  const isList = /(?:وريني|اعرضي|اعرض|قوليلي|شوفي).*(?:التذكيرات|التذكير|المنبهات|المنبه|المهام)|(?:التذكيرات|التذكير|المنبهات|المنبه|المهام).*(?:عندي|المحفوظ|الموجود)/.test(text);
  const isCancel = /(?:الغي|الغى|احذفي|امسحي|الغاء).*(?:تذكير|منبه|مهمه)|(?:الغى|الغي).*(?:كل|اخر|آخر).*(?:التذكيرات|المنبهات)/.test(text);
  if (isList) return { action: "list" };
  if (isCancel) {
    const all = /كل/.test(text);
    const type = /منبه/.test(text) ? "alarm" : /تذكير/.test(text) ? "reminder" : null;
    return { action: "cancel", all, type };
  }
  if (!isAlarm && !isReminder) return null;
  if (isFajr && isAlarm) return { action: "needs_fajr_time" };
  const scheduledAt = parseSchedule(text, now);
  if (!scheduledAt) return { action: "needs_time", type: isAlarm ? "alarm" : "reminder" };
  const title = isAlarm ? "منبه سولينا" : stripCommandWords(text);
  if (!isAlarm && title.length < 2) return { action: "needs_title", type: "reminder", scheduledAt };
  return { action: "create", type: isAlarm ? "alarm" : "reminder", title: title.slice(0, 120), scheduledAt: scheduledAt.toISOString() };
}
export function formatTaskDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "موعد غير صالح";
  return new Intl.DateTimeFormat("ar-EG", { weekday:"short", day:"numeric", month:"short", hour:"numeric", minute:"2-digit" }).format(date);
}
