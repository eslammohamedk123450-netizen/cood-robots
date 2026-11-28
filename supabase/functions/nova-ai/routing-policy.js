const EXPLICIT_PERSONAL_ACTION = /(?:^|\s)(?:فكريني|فكرني|ذكريني|ذكرني|منبه|تذكير|احفظي|احفظ|خليكي فاكرة|فاكرة الرقم|هات الرقم|الساعة كام|الوقت كام)(?:\s|$)/iu;
const EXPLICIT_RESEARCH = /(?:بحث شامل|ابحث عن مصادر|هات مصادر|قارن بين|مقارنة شاملة|حلل بعمق|تحليل مفصل|دراسة جدوى|تقييم شامل|راجع الخيارات|موازنة بين|خطة تنفيذ كاملة|عدة مراحل|عدة أنظمة|أكثر من بديل|مصادر متعددة|research and compare|comprehensive research|deep analysis|trade.?off|multi.step plan)/iu;
const SUBSTANTIVE_TASK = /(?:اشرح|حلل|قارن|صمم|نفذ|راجع|ابن|خطط|دراسة|بحث|مصادر|تحليل|architecture|implement|debug|build|research|compare|analy[sz]e)/iu;
const MULTI_REQUIREMENT = /(?:أولاً|ثانيًا|ثالثًا|بالإضافة إلى|وفي نفس الوقت|مع مراعاة|من ناحية.*ومن ناحية|بشرط.*وكمان)/iu;

/**
 * Keep personal actions, memory recall and ordinary chat cheap and deterministic.
 * Independent model calls are reserved for explicit research or substantial plans.
 */
export function requiresMultiAgentWork(text) {
  const value = String(text || "").trim();
  if (!value || EXPLICIT_PERSONAL_ACTION.test(value)) return false;
  if (EXPLICIT_RESEARCH.test(value)) return true;
  if (value.length < 90) return false;
  const substantialTask = value.length >= 900 && SUBSTANTIVE_TASK.test(value);
  const multiRequirement = value.length >= 260 && MULTI_REQUIREMENT.test(value);
  return substantialTask || multiRequirement;
}
