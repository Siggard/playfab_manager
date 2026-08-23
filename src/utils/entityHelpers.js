// Icon mapping for entity types
export const typeIcons = {
  player: '⚽',
  team: '🏆',
  tactic: '📋',
  location: '🏟️',
  club: '🏛️',
  feature_player: '⭐',
  feature_tactic: '⭐',
  feature_tactic_slot: '🎯',
  bot_bonus: '🃏',
  bot_bonus_deck: '🎴',
  player_deck: '🂠',
  debuff_player: '💀',
  status_token: '🎫',
  personal_connection: '🤝'
}

// Classes removed from the game design; hidden from creation UI but still
// rendered if present in a loaded catalog so they can be found and deleted.
export const deprecatedClasses = new Set(['staff', 'feature_staff'])

export function isDeprecatedClass(itemClass) {
  return deprecatedClasses.has(itemClass)
}

// Club infrastructure: a fixed row of slots, each holding at most one location.
// A slot climbs the chain locked -> closed -> negotiating -> deploying -> active;
// 'locked' cannot even be opened.
export const INFRA_SLOT_COUNT = 6
export const INFRA_SLOT_STATES = ['locked', 'closed', 'negotiating', 'deploying', 'active']

export function emptyInfraSlots(count = INFRA_SLOT_COUNT) {
  return Array.from({ length: count }, (_, i) => ({
    index: i + 1,
    state: 'closed',
    location_id: null,
    level: 0,
    timer: null
  }))
}

// Reputation is a token walking a -10…+10 scale that has no zero position.
// Stored on the club bundle as { value: <magnitude>, face: 'negative' | 'positive' }.
export const REPUTATION_MAX = 10
export const REPUTATION_FACES = ['negative', 'positive']

// `value` is the signed position on the scale and `face` is which side of the token
// is up — the two are independent, a positive face can sit at -10.
export function getReputation(customDataString) {
  const data = parseCustomData(customDataString)
  const rep = data?.reputation

  if (!rep || typeof rep !== 'object' || Array.isArray(rep)) return null

  return {
    value: parseInt(rep.value, 10) || 0,
    face: rep.face === 'positive' ? 'positive' : 'negative'
  }
}

export function formatReputationValue(value) {
  return value > 0 ? `+${value}` : String(value)
}

// Staff is no longer a card — it lives as counters in the club bundle CustomData
export const DEFAULT_STAFF_ROLES = [
  'coaching_staff',
  'medical_staff',
  'scouting_staff',
  'assistant',
  'secretary'
]

// Color mapping for entity types
export const typeColors = {
  player: '#3B82F6',       // blue
  team: '#EF4444',         // red
  tactic: '#8B5CF6',       // purple
  location: '#F59E0B',     // orange
  club: '#EC4899',         // pink
  feature_player: '#6366F1', // indigo
  feature_tactic: '#A855F7', // violet
  feature_tactic_slot: '#F97316', // orange
  bot_bonus: '#06B6D4',     // cyan
  bot_bonus_deck: '#0891B2', // darker cyan
  player_deck: '#2563EB',   // royal blue
  debuff_player: '#DC2626',  // red
  status_token: '#84CC16',   // lime
  personal_connection: '#14B8A6' // teal
}

// Get icon for entity type
export function getTypeIcon(itemClass) {
  return typeIcons[itemClass] || '📦'
}

// Get color for entity type
export function getTypeColor(itemClass) {
  return typeColors[itemClass] || '#6B7280'
}

// Parse CustomData safely
export function parseCustomData(customDataString) {
  if (!customDataString) return null
  try {
    return JSON.parse(customDataString)
  } catch {
    return null
  }
}

// Format CustomData for display
export function formatCustomData(customDataString) {
  const data = parseCustomData(customDataString)
  if (!data) return null

  return JSON.stringify(data, null, 2)
}

// Parse positions from player data (new format: positions are just booleans)
function parsePositions(data) {
  if (!data) return null
  const positions = []
  if (data.gk === true) positions.push('GK')
  if (data.def === true) positions.push('DEF')
  if (data.mid === true) positions.push('MID')
  if (data.att === true) positions.push('ATT')
  return positions.length > 0 ? positions.join('/') : null
}

// Parse tactic slot with feature info (new format: positions are booleans, features is array on slot level)
function parseTacticSlot(slotData) {
  if (!slotData) return { pos: '', hasFeature: false }
  const positions = []

  const posKeys = ['gk', 'def', 'mid', 'att']
  for (const key of posKeys) {
    // New format: position is just true/false
    if (slotData[key] === true) {
      positions.push(key.toUpperCase())
    }
  }

  // Features are now at slot level, not per-position
  const hasFeature = Array.isArray(slotData.feature_ids) && slotData.feature_ids.length > 0

  return {
    pos: positions.join('/'),
    hasFeature
  }
}

// Get display info from CustomData
export function getEntityDisplayInfo(entity) {
  const data = parseCustomData(entity?.CustomData)
  if (!data) return {}

  // Parse positions from gk/def/mid/att fields (for players)
  const position = parsePositions(data)

  // Parse player tags (new format: tags is an array)
  let playerTags = null
  if (entity?.ItemClass === 'player') {
    if (Array.isArray(data.tags) && data.tags.length > 0) {
      playerTags = data.tags
    }
  }

  // Parse tactic slots and styles
  let slots = null
  let tacticStyles = null
  if (entity?.ItemClass === 'tactic') {
    if (data.slots && Array.isArray(data.slots)) {
      slots = data.slots.map(slot => parseTacticSlot(slot))
    }

    // Extract active tactic styles (new format: styles array)
    if (Array.isArray(data.styles) && data.styles.length > 0) {
      tacticStyles = data.styles
    }
  }

  // Parse location data
  let directions = null
  let upgradeable = null
  let requirementsDisplay = null
  let bonusMarksDisplay = null

  // Parse bot_bonus data (new format: array of effects)
  let bonusEffects = null
  let bonusLevel = null
  if (entity?.ItemClass === 'bot_bonus') {
    if (Array.isArray(data) && data.length > 0) {
      bonusEffects = data
      bonusLevel = data[0].level
    } else if (data.level !== undefined) {
      // Old format fallback
      bonusLevel = data.level
      bonusEffects = [data]
    }
  }

  // Parse location data
  let actionDuration = null

  if (entity?.ItemClass === 'location') {
    if (data.directions && Array.isArray(data.directions)) {
      directions = data.directions
    }
    upgradeable = data.upgradeable === true
    actionDuration = data.action_duration || null

    // Parse requirements
    if (data.requirements && Array.isArray(data.requirements)) {
      requirementsDisplay = formatRequirements(data.requirements)
    }

    // Parse bonus marks
    if (data.bonus_marks && typeof data.bonus_marks === 'object') {
      bonusMarksDisplay = formatBonusMarks(data.bonus_marks)
    }
  }

  return {
    power: data.power,
    basePower: data.base_power,
    powerLimit: data.power_limit,
    level: data.level,
    maxLevel: data.max_level,
    balance: data.balance,
    position: position,
    playerTags: playerTags,
    style: data.style,
    salary: data.salary,
    slots: slots,
    tacticStyles: tacticStyles,
    directions: directions,
    upgradeable: upgradeable,
    actionDuration: actionDuration,
    requirementsDisplay: requirementsDisplay,
    bonusMarksDisplay: bonusMarksDisplay,
    bonusEffects: bonusEffects,
    bonusLevel: bonusLevel
  }
}

// Format a single mark for display
function formatMark(mark) {
  const prefix = mark.strict ? '[!]' : '[*]'
  return prefix + mark.type
}

// Format a group (marks with OR between them)
function formatGroup(group) {
  if (!group.marks || group.marks.length === 0) return null

  if (group.marks.length === 1) {
    return formatMark(group.marks[0])
  }

  // Multiple marks = OR, wrap in parentheses
  const marksStr = group.marks.map(formatMark).join(' | ')
  return '(' + marksStr + ')'
}

// Format a variant (groups with AND between them, collapse duplicates)
function formatVariant(variant) {
  if (!variant.groups || variant.groups.length === 0) return null

  // Group identical groups together for ×N display
  const groupStrings = variant.groups.map(formatGroup).filter(Boolean)

  // Count duplicates
  const counts = {}
  for (const gs of groupStrings) {
    counts[gs] = (counts[gs] || 0) + 1
  }

  // Format with ×N for duplicates
  const parts = []
  const seen = new Set()
  for (const gs of groupStrings) {
    if (seen.has(gs)) continue
    seen.add(gs)
    if (counts[gs] > 1) {
      parts.push(gs + ' ×' + counts[gs])
    } else {
      parts.push(gs)
    }
  }

  return parts.join(' + ')
}

// Format requirements array (variants with // between them)
function formatRequirements(requirements) {
  if (!requirements || requirements.length === 0) return null

  const variants = requirements.map(formatVariant).filter(Boolean)
  if (variants.length === 0) return null

  return variants.join(' // ')
}

// Format bonus marks
function formatBonusMarks(bonusMarks) {
  const parts = []
  for (const [type, count] of Object.entries(bonusMarks)) {
    if (count > 1) {
      parts.push('+' + type + '×' + count)
    } else {
      parts.push('+' + type)
    }
  }
  return parts.length > 0 ? parts.join(' ') : null
}

// Validate JSON string
export function isValidJSON(str) {
  try {
    JSON.parse(str)
    return true
  } catch {
    return false
  }
}

// Check if ItemId is unique
export function isUniqueItemId(itemId, entities) {
  return !entities.some(e => e.ItemId === itemId)
}
