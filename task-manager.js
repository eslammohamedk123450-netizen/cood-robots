const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const SPOKEN_NUMBERS = {
  "واحد":"1", "واحدة":"1", "اتنين":"2", "اثنين":"2", "تلاتة":"3", "ثلاثة":"3",
  "اربعة":"4", "أربعة":"4", "خمسة":"5", "خمس":"5", "ستة":"6", "سبعة":"7",
  "تمانية":"8", "تمنية":"8", "ثمانية":"8", "تسعة":"9", "عشرة":"10",
  "حداشر":"11", "احداشر":"11", "اتناشر":"12", "اثناشر":"12", "عشرين":"20", "تلاتين":"30", "ثلاثين":"30", "اربعين":"40", "أربعين":"40", "خمسة واربعين":"45", "خمسة وأربعين":"45", "خمس واربعين":"45", "خمس وأربعين":"45", "خمسين":"50"
};
export function normalizeTaskText(value) {
  return String(value || "").replace(/[٠-٩]/g, digit => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[ًٌٍَُِّْـ]/g, "").replace(/[،.!؟?؛,]/g, " ")
    .replace(/\s+/g, " ").trim().toLocaleLowerCase("ar");
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
  if (/(?:بعد|كمان)\s+شويه|بعد\s+شوية|بعد\s+قليل/.test(text)) return new Date(now.getTime() + 5 * 60 * 1000);
  if (/بعد\s+(?:نص|نصف)\s+(?:ساعه|ساعة)/.test(text)) return new Date(now.getTime() + 30 * 60 * 1000);
  if (/بعد\s+ربع\s+(?:ساعه|ساعة)/.test(text)) return new Date(now.getTime() + 15 * 60 * 1000);
  if (/بعد\s+(?:دقيقتين|دقيقتان)/.test(text)) return new Date(now.getTime() + 2 * 60 * 1000);
  if (/بعد\s+(?:ثلاث\s+دقايق|ثلاث\s+دقائق)/.test(text)) return new Date(now.getTime() + 3 * 60 * 1000);
  const fiveRelative = text.match(/بعد\s+(?:خمس|خمسة)(?:\s+(دقايق|دقائق|دقيقه|دقيقة|ساعات|ساعة|ساعه))?/);
  if (fiveRelative) return new Date(now.getTime() + 5 * (/ساع/.test(fiveRelative[1] || "") ? 60 * 60 * 1000 : 60 * 1000));
  if (/بعد\s+(?:عشر\s+دقايق|عشر\s+دقائق)/.test(text)) return new Date(now.getTime() + 10 * 60 * 1000);
  if (/بعد\s+(?:دقيقه|دقيقة)(?:\s+واحده|\s+واحدة)?/.test(text)) return new Date(now.getTime() + 60 * 1000);
  if (/بعد\s+ساعتين/.test(text)) return new Date(now.getTime() + 2 * 60 * 60 * 1000);
  if (/بعد\s+(?:ساعه|ساعة)/.test(text)) return new Date(now.getTime() + 60 * 60 * 1000);
  const spokenRelative = text.match(/بعد\s+(واحد|واحدة|واحده|اتنين|اثنين|تلاتة|تلاته|ثلاثة|ثلاثه|اربعة|أربعة|اربعه|خمسة|خمس|ستة|سته|سبعة|سبعه|تمانية|تمنية|ثمانية|تسعة|تسعه|عشرة|عشره|حداشر|احداشر|اتناشر|اثناشر)(?:\s+(دقايق|دقائق|دقيقه|دقيقة|ساعات|ساعة|ساعه))?/);
  if (spokenRelative) {
    const amount = Number(SPOKEN_NUMBERS[spokenRelative[1]]);
    const isHours = /ساع/.test(spokenRelative[0]);
    if (amount > 0) return new Date(now.getTime() + amount * (isHours ? 60 * 60 * 1000 : 60 * 1000));
  }
  const relative = text.match(/بعد\s+(\d+)\s*(دقيقه|دقيقة|دقائق|دقايق|ساعه|ساعة|ساعات)/);
  if (relative) {
    const amount = Number(relative[1]);
    const ms = /ساع/.test(relative[2]) ? amount * 60 * 60 * 1000 : amount * 60 * 1000;
    if (amount > 0 && amount <= 10000) return new Date(now.getTime() + ms);
  }
  const clockText = text.replace(/خمسة\s+وأ?ربعين|خمس\s+وأ?ربعين/g, "45").replace(/(^|\s)(واحده|واحد|واحدة|اتنين|اثنين|تلاته|تلاتة|ثلاثه|ثلاثة|ثلاث|اربعه|اربعة|أربعة|خمسه|خمسة|خمس|سته|ستة|سبعه|سبعة|تمانيه|تمانية|تمنية|ثمانية|تسعه|تسعة|عشره|عشرة|حداشر|احداشر|اتناشر|اثناشر|عشرين|تلاتين|ثلاثين|اربعين|أربعين|خمسين)(?=$|\s)/g,
    (all, prefix, word) => prefix + (SPOKEN_NUMBERS[word] || word));
  const spokenClock = clockText.match(/(?:الساعه\s*|الساعة\s*)?(\d{1,2})\s+و\s*(\d{1,2})\s*(?:دقيقه|دقيقة)?\s*(صباحا|صباح|الصبح|مساء|بالليل|ليل)?/);
  const match = spokenClock || clockText.match(/(?:الساعه\s*|الساعة\s*)?(\d{1,2})(?::(\d{2}))?\s*(صباحا|صباح|الصبح|مساء|بالليل|ليل)?/);
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(spokenClock ? match[2] : (match[2] || 0)), dayPart = (spokenClock ? match[3] : match[3]) || "";
  if (hour > 23 || minute > 59) return null;
  const day = /بعد بكره|بعد بكرة|بعد غد/.test(text) ? "afterTomorrow" : /بكره|بكرة|غدا/.test(text) ? "tomorrow" : null;
  const date = nextClockTime(hour, minute, dayPart, day, now);
  return date && date > now ? date : null;
}
function stripCommandWords(text) {
  return text.replace(/(?:يا\s*)?سولينا/g, " ").replace(/ورايا/g, " ")
    .replace(/^(?:(?:إن|ان)\s+)?(?:أنا|انا)\s+/g, " ")
    .replace(/\b(?:إن|ان)\s+(?:أنا|انا)\b/g, " ")
    .replace(/(?:من فضلك|لو سمحتي|لو سمحت|ممكن|عايزك|عاوزك|اعملي|اعمل|سجلي|سجل|ضيفي|ضيف|فكريني|فكرني|ذكريني|ذكرني|صحيني|صحييني|اصحيني|اصحى|صحينيلي|صحينى|منبه|المنبه|تذكير|تذكيرني|معاد|موعد|عندي|بكره|بكرة|غدا|بعد بكره|بعد بكرة|بعد غد|بعد|نص|نصف|ربع|ساعه|ساعة|ساعتين|دقيقه|دقيقة|دقائق|دقايق|ثلاث|النهارده|اليوم|الساعه|الساعة|صباحا|صباح|الصبح|مساء|بالليل|ليل)/g, " ")
    .replace(/(^|\s)(واحده|واحد|واحدة|اتنين|اثنين|تلاته|تلاتة|ثلاثه|ثلاثة|اربعه|اربعة|أربعة|خمسه|خمسة|خمس|سته|ستة|سبعه|سبعة|تمانيه|تمانية|تمنية|ثمانية|تسعه|تسعة|عشره|عشرة|حداشر|احداشر|اتناشر|اثناشر)(?=$|\s)/g, " ")
    .replace(/\d{1,2}(?::\d{2})?/g, " ").replace(/\s+/g, " ").trim();
}
export function parseTaskCommand(value, now = new Date()) {
  const text = normalizeTaskText(value);
  if (!text) return null;
  const isFajr = /الفجر|صلاه الفجر/.test(text);
  if (/(?:الصلاحيات|الصلاحية|صلاحيات|صلاحية|الاذن|الإذن).*(?:المنبه|التذكير|الميكروفون|الاشعارات|الإشعارات|سولينا|التطبيق)?/.test(text)
      || /(?:عايز|عاوز|محتاج|ممكن).*(?:اديك|اديلك|أديكي|أديك|اسمحلك|اسمحلكي).*(?:الصلاحية|صلاحية|اذن|إذن)/.test(text)
      || /(?:افتحي|افتح).*(?:صلاحيات|اذونات|أذونات)/.test(text)) return { action: "open_permissions" };
  const settingsCommand = text.match(/^(?:(?:يا\s*)?سولينا\s*)?(?:افتحي|افتح|شغلي|شغل)\s+(?:(?:لي|لنا)\s+)?(?:تطبيق\s+)?(.+)$/);
  if (settingsCommand) {
    const appName = settingsCommand[1].trim();
    if (/^(?:الإعدادات|الاعدادات|اعدادات|الضبط|ضبط|settings)$/i.test(appName)) return { action: "open_settings" };
    if (/^(?:ال)?(?:بلوتوث|واي\s*فاي|وايفاي|فلاش|كشاف)$/i.test(appName)) return { action: "unsupported_device", command: text };
    if (appName.length >= 2 && appName.length <= 60) return { action: "open_app", appName };
  }
  const isAlarm = /صحيني|صحييني|اصحيني|اصحى|صحينيلي|صحينى|فوقيني|نبهيني|(?:اعملي|اعمل|سجلي|سجل|اضبطي|اضبط|ظبطي|ظبط|ظبطلي)\s+(?:لي\s+)?(?:منبه|الساعة)|منبه\s+(?:الساعه|الساعة|\d|بعد|بكره|بكرة|الفجر)/.test(text);
  const isReminder = /فكريني|فكرني|ذكريني|ذكرني|نبهيني|نبهني|تذكير|تذكيرني|سجل.*مهمه|سجلي.*مهمه|عندي.*(?:معاد|موعد)|(?:معاد|موعد).*(?:بكره|بكرة|غدا|النهارده|اليوم)/.test(text);
  const isList = /(?:وريني|اعرضي|اعرض|قوليلي|شوفي).*(?:التذكيرات|التذكير|المنبهات|المنبه|المهام)|(?:التذكيرات|التذكير|المنبهات|المنبه|المهام).*(?:عندي|المحفوظ|الموجود)/.test(text);
  const isCancel = /(?:الغي|الغى|احذفي|امسحي|الغاء).*(?:تذكير|منبه|مهمه)|(?:الغى|الغي).*(?:كل|اخر|آخر).*(?:التذكيرات|المنبهات)/.test(text);
  if (isList) return { action: "list" };
  if (isCancel) return { action: "cancel", all: /كل/.test(text), type: /منبه/.test(text) ? "alarm" : /تذكير/.test(text) ? "reminder" : null };
  if (!isAlarm && !isReminder && /^(?:(?:يا\s*)?سولينا\s*)?(?:شغلي?|اقفلي?|اطفي?|طفي|فعلي?|اتصلي?|اتصل|ابعتي?|ابعت|زودي?|قللي?|وطي|علي)\s+.*(?:البلوتوث|بلوتوث|الواي\s*فاي|وايفاي|الفلاش|الكشاف|الصوت|الموقع|الإنترنت|الانترنت|بيانات الهاتف|الشاشة|رسالة|رسائل|اتصال|مكالمة)/.test(text)) return { action: "unsupported_device", command: text };
  if (!isAlarm && !isReminder) return null;
  if (isFajr && isAlarm) return { action: "needs_fajr_time" };
  const scheduledAt = parseSchedule(text, now);
  if (!scheduledAt) return { action: "needs_time", type: isAlarm ? "alarm" : "reminder" };
  const timeMatch = text.match(/(?:الساعه|الساعة)\s*(\d{1,2}|واحده|واحد|واحدة|اتنين|اثنين|تلاته|تلاتة|ثلاثه|ثلاثة|اربعه|اربعة|أربعة|خمسه|خمسة|خمس|سته|ستة|سبعه|سبعة|تمانيه|تمانية|تمنية|ثمانية|تسعه|تسعة|عشره|عشرة|حداشر|احداشر|اتناشر|اثناشر)/);
  const hasDayPart = /صباحا|صباح|الصبح|مساء|بالليل|ليل/.test(text);
  if (timeMatch && Number(SPOKEN_NUMBERS[timeMatch[1]] || timeMatch[1]) >= 1 && Number(SPOKEN_NUMBERS[timeMatch[1]] || timeMatch[1]) <= 12 && !hasDayPart) return { action: "needs_period", type: isAlarm ? "alarm" : "reminder" };
  const title = isAlarm ? "منبه سولينا" : stripCommandWords(text)
    .replace(/^(?:(?:إن|ان)\s+)?(?:أنا|انا)\s+/g, "")
    .replace(/^(?:إني|اني)\s+/g, "")
    .replace(/^(?:إن|ان)\s+/g, "")
    .replace(/(?:شويه|شوية|قليل|كمان)/g, " ").replace(/\s+/g, " ").trim();
  if (!isAlarm && title.length < 2) return { action: "needs_title", type: "reminder", scheduledAt: scheduledAt.toISOString() };
  return { action: "create", type: isAlarm ? "alarm" : "reminder", title: title.slice(0, 120), scheduledAt: scheduledAt.toISOString() };
}
export function formatTaskDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "موعد غير صالح";
  return new Intl.DateTimeFormat("ar-EG", { weekday:"short", day:"numeric", month:"short", hour:"numeric", minute:"2-digit" }).format(date);
}
