const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export function normalizeTaskText(value) {
  return String(value || "")
    .replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[،.!؟?؛,:]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("ar");
}
function nextClockTime(hour, minute, dayPart, explicitDay) {
  const now = new Date();
  let hours = hour;
  if (dayPart && /مساء|بالليل|ليل/.test(dayPart) && hours < 12) hours += 12;
  if (dayPart && /صباح|الصبح/.test(dayPart) && hours === 12) hours = 0;
  if (hours > 23 || minute > 59) return null;
  const target = new Date(now);
  target.setSeconds(0, 0);
  target.setHours(hours, minute, 0, 0);
  if (explicitDay === "tomorrow") target.setDate(target.getDate() + 1);
  else if (explicitDay === "afterTomorrow") target.setDate(target.getDate() + 2);
  else if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return target;
}
function parseSchedule(text, now = new Date()) {
  const relative = text.match(/بعد\s+(\d+)\s*(دقيقه|دقائق|دقيقه|ساعه|ساعات)/);
  if (relative) {
    const amount = Number(relative[1]);
    const ms = /ساع/.test(relative[2]) ? amount * 60 * 60 * 1000 : amount * 60 * 1000;
    if (amount > 0 && amount <= 10000) return new Date(now.getTime() + ms);
  }
  const match = text.match(/(?:الساعه\s*)?(\d{1,2})(?::(\d{2}))?\s*(صباحا|صباح|الصبح|مساء|مساء|بالليل|ليل)?/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const dayPart = match[3] || "";
  if (hour < 0 || hour > 23 || minute > 59) return null;
  const day = /بعد بكره|بعد غد/.test(text) ? "afterTomorrow" : /بكره|غدا/.test(text) ? "tomorrow" : null;
  const date = nextClockTime(hour, minute, dayPart, day);
  return date && date > now ? date : null;
}
function stripCommandWords(text) {
  return text
    .replace(/(?:يا\s*)?سولينا/g, " ")
    .replace(/(?:من فضلك|لو سمحتي|لو سمحت|ممكن|عايزك|عاوزك|اعملي|اعمل|سجلي|سجل|ضيفي|ضيف|فكريني|فكرني|ذكريني|ذكرني|صحيني|اصحيني|اصحى|صحيني|منبه|تذكير|تذكيرني|بكره|غدا|بعد بكره|بعد غد|النهارده|اليوم|الساعه|الساعة|صباحا|صباح|الصبح|مساء|بالليل|ليل)/g, " ")
    .replace(/\d{1,2}(?::\d{2})?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
export function parseTaskCommand(value, now = new Date()) {
  const text = normalizeTaskText(value);
  if (!text) return null;
  const isFajr = /الفجر|صلاه الفجر|صلاة الفجر/.test(text);
  const isAlarm = /صحيني|اصحيني|اصحى|منبه|منبهات|المنبه/.test(text);
  const isReminder = /فكريني|فكرني|ذكريني|ذكرني|تذكير|تذكيرني|سجل.*مهمه|سجلي.*مهمه/.test(text);
  const isList = /(?:وريني|اعرضي|اعرض|قوليلي|ايه|ما هي|شوفي).*(?:التذكيرات|التذكير|المنبهات|المنبه|المهام)|(?:التذكيرات|التذكير|المنبهات|المنبه|المهام).*(?:عندي|المحفوظ|الموجود)/.test(text);
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
