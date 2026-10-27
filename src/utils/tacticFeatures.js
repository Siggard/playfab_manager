// Tactic features (feature_tactic): since 2026-10-28 CustomData is an object
//   { learn: { matches: N }, effects: [ ...effect records... ] }
// learn.matches — matches played with the tactic (after the coach's weeks) before a
// feature learned in the Tactical class switches on; integer >= 1, required.
// The old shape — a bare array of effect records — is still read by the game
// (matches = 1 with a warning) but new data is written as the object.

export const TACTIC_FEATURE_CLASS = 'feature_tactic'
export const DEFAULT_LEARN_MATCHES = 1

export function parseTacticFeature(customData) {
  if (!customData) return { shape: 'empty', matches: null, effects: [] }
  let data
  try { data = typeof customData === 'string' ? JSON.parse(customData) : customData } catch { return { shape: 'invalid', matches: null, effects: [] } }
  if (Array.isArray(data)) return { shape: 'legacy', matches: null, effects: data }
  if (!data || typeof data !== 'object') return { shape: 'invalid', matches: null, effects: [] }
  const raw = data.learn?.matches
  const matches = typeof raw === 'number' ? raw : (typeof raw === 'string' && /^\d+$/.test(raw) ? parseInt(raw, 10) : null)
  return {
    shape: 'object',
    matches,
    effects: Array.isArray(data.effects) ? data.effects : null,
    data
  }
}

// The new-shape object with learn.matches set; a legacy array becomes the effects list
export function withLearnMatches(customData, matches) {
  const parsed = parseTacticFeature(customData)
  const n = Math.max(1, parseInt(matches, 10) || DEFAULT_LEARN_MATCHES)
  if (parsed.shape === 'object') {
    const next = { ...parsed.data, learn: { ...(parsed.data.learn || {}), matches: n } }
    if (!Array.isArray(next.effects)) next.effects = []
    return next
  }
  return { learn: { matches: n }, effects: parsed.shape === 'legacy' ? parsed.effects : [] }
}

export function tacticFeatureIssues(entity) {
  if (entity.ItemClass !== TACTIC_FEATURE_CLASS) return []
  const parsed = parseTacticFeature(entity.CustomData)
  if (parsed.shape === 'empty' || parsed.shape === 'invalid') return []
  if (parsed.shape === 'legacy') {
    return [{
      severity: 'warning',
      message: 'Старый формат: голый массив эффектов — игра возьмёт learn.matches = 1'
    }]
  }
  const issues = []
  if (!Number.isInteger(parsed.matches) || parsed.matches < 1) {
    issues.push({ severity: 'error', message: 'learn.matches: нужно целое число ≥ 1 — сколько матчей сыграть, чтобы свойство включилось' })
  }
  if (!parsed.effects) {
    issues.push({ severity: 'error', message: 'effects: должен быть массивом записей эффекта' })
  }
  return issues
}
