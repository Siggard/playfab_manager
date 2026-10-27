// Hiring board (FCM issue #39): staff packs carry a Dossier card and staff tokens,
// and a staff_pack_deck lists how many copies of each pack a session gets.
import { DEFAULT_STAFF_ROLES } from './entityHelpers'

export const HIRING_CLASSES = ['staff_pack', 'dossier', 'staff_pack_deck']

export function hasHiringFields(itemClass) {
  return HIRING_CLASSES.includes(itemClass)
}

export const STAFF_TYPES = DEFAULT_STAFF_ROLES

export const STAFF_TYPE_LABELS = {
  coaching_staff: 'Тренер',
  medical_staff: 'Врач',
  scouting_staff: 'Скаут',
  assistant: 'Ассистент',
  secretary: 'Секретарь'
}

export const DOSSIER_KINDS = [
  { value: 'link', label: 'Связь' },
  { value: 'skill', label: 'Навык' }
]

export const DOSSIER_RARITIES = [
  { value: 'common', label: 'Обычная' },
  { value: 'rare', label: 'Редкая' },
  { value: 'unique', label: 'Уникальная' }
]

// count in a deck entry: a number, "players" or "players-1" (never below 1)
export const DECK_COUNT_MODES = [
  { value: 'number', label: 'Число' },
  { value: 'players', label: 'По числу игроков' },
  { value: 'players-1', label: 'Игроков − 1 (мин. 1)' }
]

export function isValidDeckCount(count) {
  return count === 'players' || count === 'players-1' ||
    (Number.isInteger(count) && count >= 1)
}

function parse(entity) {
  try {
    const data = JSON.parse(entity?.CustomData || '{}')
    return data && typeof data === 'object' ? data : {}
  } catch {
    return null
  }
}

// Problems for one hiring entity: [{ severity, message }]. Used by the warnings
// dashboard and inline in the editor, so both always agree.
export function hiringIssues(itemClass, data, allItems) {
  if (!hasHiringFields(itemClass) || !data) return []
  const issues = []
  const byId = new Map(allItems.map(i => [i.ItemId, i]))

  const checkStaff = (staff, where) => {
    if (staff === undefined || staff === null) return
    if (typeof staff !== 'object' || Array.isArray(staff)) {
      issues.push({ severity: 'error', message: `${where}: должен быть объектом {тип: число}` })
      return
    }
    for (const [type, n] of Object.entries(staff)) {
      if (!STAFF_TYPES.includes(type)) {
        issues.push({ severity: 'warning', message: `${where}: неизвестный тип персонала «${type}»` })
      }
      if (!Number.isInteger(n) || n < 0) {
        issues.push({ severity: 'error', message: `${where}.${type}: нужно целое число ≥ 0` })
      }
    }
  }

  if (itemClass === 'staff_pack') {
    if (!data.dossier) {
      issues.push({ severity: 'error', message: 'Не указано Досье (dossier) — игра не загрузит каталог' })
    } else {
      const ref = byId.get(data.dossier)
      if (!ref) issues.push({ severity: 'error', message: `Досье «${data.dossier}» не найдено` })
      else if (ref.ItemClass !== 'dossier') {
        issues.push({ severity: 'error', message: `«${data.dossier}» — не Досье, а ${ref.ItemClass}` })
      }
    }
    checkStaff(data.staff, 'staff')
    if (data.reputation_min !== undefined && data.reputation_min !== null &&
        !Number.isInteger(data.reputation_min)) {
      issues.push({ severity: 'error', message: 'reputation_min: нужно целое число или убрать порог' })
    }
    if (data.signing_fee !== undefined && typeof data.signing_fee !== 'number') {
      issues.push({ severity: 'error', message: 'signing_fee: нужно число' })
    }
  }

  if (itemClass === 'dossier') {
    if (!DOSSIER_KINDS.some(k => k.value === data.kind)) {
      issues.push({ severity: 'error', message: `kind: нужно link или skill (сейчас ${JSON.stringify(data.kind)})` })
    }
    if (!DOSSIER_RARITIES.some(r => r.value === data.rarity)) {
      issues.push({ severity: 'error', message: `rarity: нужно common, rare или unique (сейчас ${JSON.stringify(data.rarity)})` })
    }
    for (const key of ['contract_weeks', 'payroll']) {
      if (typeof data[key] !== 'number') issues.push({ severity: 'error', message: `${key}: нужно число` })
    }
    checkStaff(data.on_leave?.staff, 'on_leave.staff')
    if (data.effect && !data.effect.type) {
      issues.push({ severity: 'error', message: 'effect: не указан type' })
    }
  }

  if (itemClass === 'staff_pack_deck') {
    if (!Array.isArray(data.packs)) {
      issues.push({ severity: 'error', message: 'packs: должен быть массивом' })
      return issues
    }
    const seen = new Set()
    data.packs.forEach((entry, i) => {
      const where = `packs[${i}]`
      const pack = byId.get(entry?.pack)
      if (!entry?.pack) {
        issues.push({ severity: 'error', message: `${where}: не выбран пак` })
      } else if (!pack) {
        issues.push({ severity: 'error', message: `${where}: пак «${entry.pack}» не найден` })
      } else if (pack.ItemClass !== 'staff_pack') {
        issues.push({ severity: 'error', message: `${where}: «${entry.pack}» — не пак, а ${pack.ItemClass}` })
      }
      if (entry?.pack && seen.has(entry.pack)) {
        issues.push({ severity: 'warning', message: `${where}: пак «${entry.pack}» указан дважды — копии задаются count` })
      }
      seen.add(entry?.pack)
      if (!isValidDeckCount(entry?.count)) {
        issues.push({ severity: 'error', message: `${where}: count — целое ≥ 1, "players" или "players-1"` })
      }
      // A unique Dossier may sit in the deck as exactly one copy (checked by the game on load)
      if (pack) {
        const dossierId = parse(pack)?.dossier
        const rarity = parse(byId.get(dossierId))?.rarity
        if (rarity === 'unique' && entry.count !== 1) {
          issues.push({
            severity: 'error',
            message: `${where}: Досье «${dossierId}» уникальное — в колоде может быть только 1 копия (count: 1)`
          })
        }
      }
    })
  }

  return issues
}

// A club's starting packs (CustomData.staff_packs) are personal: each must be a
// staff_pack that no hiring-board deck hands out — the game refuses the catalog otherwise
export function clubStaffPackIssues(data, allItems) {
  const packs = data?.staff_packs
  if (packs === undefined || packs === null) return []
  if (!Array.isArray(packs)) {
    return [{ severity: 'error', message: 'staff_packs: должен быть массивом id паков' }]
  }
  const issues = []
  const byId = new Map(allItems.map(i => [i.ItemId, i]))
  const decks = allItems.filter(i => i.ItemClass === 'staff_pack_deck')
  packs.forEach((packId, i) => {
    const where = `staff_packs[${i}]`
    const pack = byId.get(packId)
    if (!pack) {
      issues.push({ severity: 'error', message: `${where}: пак «${packId}» не найден` })
      return
    }
    if (pack.ItemClass !== 'staff_pack') {
      issues.push({ severity: 'error', message: `${where}: «${packId}» — не пак, а ${pack.ItemClass}` })
      return
    }
    const deck = decks.find(d => getDeckEntries(d).some(e => e?.pack === packId))
    if (deck) {
      issues.push({
        severity: 'error',
        message: `${where}: пак «${packId}» лежит в колоде ${deck.ItemId} — стартовый пак клуба не может быть в колоде планшета`
      })
    }
  })
  return issues
}

export function hiringIssuesForEntity(entity, allItems) {
  const data = parse(entity)
  if (!data) return []
  if (entity.ItemClass === 'club') return clubStaffPackIssues(data, allItems)
  return hiringIssues(entity.ItemClass, data, allItems)
}

// staff_pack_deck keeps its contents in CustomData.packs: [{ pack, count }]
export function getDeckEntries(deck) {
  const packs = parse(deck)?.packs
  return Array.isArray(packs) ? packs : []
}

// CustomData string for the deck with packs replaced; other keys kept as-is
export function withDeckEntries(deck, entries) {
  const data = parse(deck) || {}
  return JSON.stringify({ ...data, packs: entries })
}

// Copies a count turns into for a given number of people in the session
export function deckCopies(count, players) {
  if (count === 'players') return players
  if (count === 'players-1') return Math.max(1, players - 1)
  return Number.isInteger(count) ? count : 0
}
