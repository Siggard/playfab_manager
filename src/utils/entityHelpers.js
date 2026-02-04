// Icon mapping for entity types
export const typeIcons = {
  player: '⚽',
  staff: '👔',
  team: '🏆',
  tactic: '📋',
  location: '🏟️',
  club: '🏛️',
  feature_player: '⭐',
  feature_staff: '⭐',
  feature_tactic: '⭐',
  feature_tactic_slot: '🎯',
  bot_bonus: '🃏',
  bot_bonus_deck: '🎴'
}

// Color mapping for entity types
export const typeColors = {
  player: '#3B82F6',       // blue
  staff: '#10B981',        // green
  team: '#EF4444',         // red
  tactic: '#8B5CF6',       // purple
  location: '#F59E0B',     // orange
  club: '#EC4899',         // pink
  feature_player: '#6366F1', // indigo
  feature_staff: '#14B8A6',  // teal
  feature_tactic: '#A855F7', // violet
  feature_tactic_slot: '#F97316', // orange
  bot_bonus: '#06B6D4',     // cyan
  bot_bonus_deck: '#0891B2' // darker cyan
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

  // Parse active marks for staff
  let activeMarks = null
  let hasTactics = false
  if (entity?.ItemClass === 'staff') {
    if (data.marks && Array.isArray(data.marks)) {
      const active = data.marks
        .filter(m => m.status === 'active')
        .map(m => m.type)
      if (active.length > 0) {
        activeMarks = active.join('/')
      }
    }
    // Check for linked tactics
    if (data.special?.tactics && Array.isArray(data.special.tactics) && data.special.tactics.length > 0) {
      hasTactics = true
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
    activeMarks: activeMarks,
    hasTactics: hasTactics,
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
