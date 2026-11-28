const TOPIC_SWITCH = /(?:موضوع تاني|سؤال تاني|بعيدا عن|سيبك من|خلينا نتكلم عن|نغير الموضوع|على فكره سؤال|بالمناسبه سؤال)/iu;
const SHORT_FOLLOW_UP = /^(?:طب|طيب|وال|وإيه|وايه|ليه|ازاي|إزاي|يعني|هو|هي|ده|دي|دول|كده|وبعدين|تمام بس|طيب وبالنسبه|وبالنسبة|ممكن توضح|مش فاهم|مش فاهمه)(?:\s|$)/iu;
const PRONOUN_FOLLOW_UP = /(?:وده|ودي|وده ايه|ودي ايه|التاني|التانيه|اللي بعده|نفسه|نفسها|كمان|هناك|فيه|فيها)/iu;
const EXPLICIT_CONTINUATION = /(?:كمل|كملي|نكمل|زي ما قولت|زي ما قلتي|بالنسبه ل|بالنسبة ل|عن نفس الموضوع|اللي كنا بنتكلم فيه)/iu;

/**
 * Classifies only the conversational relationship of the latest user turn.
 * It does not search old conversations or infer missing facts.
 */
export function classifyConversationTurn(text, messages = []) {
  const current = String(text || "").trim();
  if (!current) return "new_topic";
  const normalized = current.toLocaleLowerCase("ar")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[،.!؟?؛,:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (TOPIC_SWITCH.test(normalized)) return "topic_change";
  const shortFollowUp = current.length <= 100 && SHORT_FOLLOW_UP.test(normalized);
  const hasRecentUserTurn = Array.isArray(messages) && messages.some((item) => item?.role === "user");
  const pronounFollowUp = hasRecentUserTurn && PRONOUN_FOLLOW_UP.test(normalized);
  if (shortFollowUp || pronounFollowUp || EXPLICIT_CONTINUATION.test(normalized)) return "follow_up";
  return "new_topic";
}
