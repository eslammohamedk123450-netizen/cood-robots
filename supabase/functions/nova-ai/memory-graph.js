const MAX_FACTS = 48;
const MAX_ENTITIES = 32;
const MAX_RELATIONS = 48;

function clean(value, max = 500) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function normalizeEvidence(value) {
  return String(value ?? "").normalize("NFKC")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\\p{L}\\p{N}\\s]/gu, " ")
    .replace(/\\s+/g, " ").trim().toLocaleLowerCase("ar");
}

function uniqueRows(rows, keyOf, limit) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const key = keyOf(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(row);
    if (result.length >= limit) break;
  }
  return result;
}

/**
 * A memory graph is a semantic index over the original note, not a replacement
 * for it. The model proposes facts; this boundary validates and bounds them.
 */
export function buildMemoryGraph(originalText, proposed) {
  const source = clean(originalText, 12000);
  const data = proposed && typeof proposed === "object" && !Array.isArray(proposed) ? proposed : {};
  const entities = (Array.isArray(data.entities) ? data.entities : []).map((item) => ({
    id: clean(item?.id, 80),
    name: clean(item?.name, 180),
    kind: clean(item?.kind, 80),
    context: clean(item?.context, 240),
  })).filter((item) => item.name);
  const normalizedSource = normalizeEvidence(source);
  const facts = (Array.isArray(data.facts) ? data.facts : []).map((item) => ({
    subject: clean(item?.subject, 180),
    predicate: clean(item?.predicate, 120),
    value: clean(item?.value, 500),
    value_type: clean(item?.value_type, 80),
    context: clean(item?.context, 300),
    qualifiers: Array.isArray(item?.qualifiers) ? item.qualifiers.map((v) => clean(v, 120)).filter(Boolean).slice(0, 8) : [],
    evidence: clean(item?.evidence, 500),
    confidence: Number.isFinite(Number(item?.confidence)) ? Math.max(0, Math.min(1, Number(item.confidence))) : 0.5,
  })).filter((item) => item.subject && item.predicate && item.value && item.evidence && normalizedSource.includes(normalizeEvidence(item.evidence)));
  const relations = (Array.isArray(data.relations) ? data.relations : []).map((item) => ({
    from: clean(item?.from, 180),
    relation: clean(item?.relation, 120),
    to: clean(item?.to, 180),
    context: clean(item?.context, 240),
  })).filter((item) => item.from && item.relation && item.to);
  const topics = uniqueRows((Array.isArray(data.topics) ? data.topics : []).map((v) => clean(v, 100)).filter(Boolean), (v) => v, 16);
  return {
    version: 1,
    source_text: source,
    summary: clean(data.summary, 700),
    entities: uniqueRows(entities, (v) => (v.id || v.name).toLocaleLowerCase(), MAX_ENTITIES),
    facts: uniqueRows(facts, (v) => [v.subject, v.predicate, v.value, v.context].join("|").toLocaleLowerCase(), MAX_FACTS),
    relations: uniqueRows(relations, (v) => [v.from, v.relation, v.to].join("|").toLocaleLowerCase(), MAX_RELATIONS),
    topics,
    extraction_status: facts.length || entities.length ? "complete" : "empty",
  };
}

export function parseMemoryModelJson(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  const text = String(value ?? "").trim().replace(/^\uFEFF/, "");
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function validateSemanticRecallIds(proposed, availableIds) {
  const allowed = new Set(availableIds.filter((id) => typeof id === "string"));
  const ids = Array.isArray(proposed?.selected_ids) ? proposed.selected_ids : [];
  return uniqueRows(ids.filter((id) => typeof id === "string" && allowed.has(id)), (id) => id, 8);
}
