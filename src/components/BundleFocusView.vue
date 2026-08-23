<template>
  <div class="bundle-focus-view">
    <!-- Header -->
    <div class="focus-header">
      <button @click="$emit('exit')" class="back-btn">
        &lt;- Back to All Bundles
      </button>

      <div class="bundle-info">
        <h1>{{ bundle?.DisplayName || bundleId }}</h1>
        <p v-if="bundle?.Description" class="bundle-description">{{ bundle.Description }}</p>
        <div class="bundle-stats">
          <span class="stat-item">
            <span class="stat-label">Type:</span>
            <span class="stat-value">{{ bundle?.ItemClass }}</span>
          </span>
          <span class="stat-item">
            <span class="stat-label">Items:</span>
            <span class="stat-value">{{ itemCount }}</span>
          </span>
<span v-if="isClub && balance > 0" class="stat-item">
            <span class="stat-label">Balance:</span>
            <span class="stat-value">{{ balance }}</span>
          </span>
        </div>
      </div>

      <button @click="$emit('edit-bundle', bundle)" class="btn-edit-info">
        [=] Edit Info
      </button>
    </div>

    <!-- Club sub-header: single team, staff counters, infrastructure -->
    <div v-if="isClub" class="bundle-subheader">
      <!-- Team: always exactly one -->
      <div class="sub-row">
        <span class="sub-label">TEAM</span>
        <div
          v-if="teamEntity"
          class="team-chip"
          @click="$emit('edit-item', teamEntity)"
          title="Open team editor"
        >
          <span class="team-icon">{{ getTypeIcon('team') }}</span>
          <span class="team-name">{{ teamEntity.DisplayName || teamEntity.ItemId }}</span>
          <span class="team-id">{{ teamEntity.ItemId }}</span>
          <span v-if="teamInfo.power" class="team-stat">&#9889;{{ teamInfo.power }}</span>
          <span v-if="teamInfo.level" class="team-stat">Lv{{ teamInfo.level }}</span>
          <span v-if="teamInfo.balance" class="team-stat">&#128176;{{ teamInfo.balance }}</span>
        </div>
        <span v-else class="sub-empty">No team assigned</span>

        <div class="sub-actions">
          <button @click="openQuickAdd('team')" class="btn-sub">
            {{ teamEntity ? 'Change' : 'Set Team' }}
          </button>
          <button
            v-if="teamEntity"
            @click="removeFromBundle(teamEntity.ItemId)"
            class="btn-sub btn-sub-danger"
          >
            Remove
          </button>
        </div>
      </div>

      <!-- Staff: counters stored in bundle CustomData.staff -->
      <div class="sub-row">
        <span class="sub-label">STAFF</span>
        <div class="staff-counters">
          <div
            v-for="role in staffRoles"
            :key="role"
            class="staff-counter"
            :class="{ 'is-zero': !staffCounts[role] }"
          >
            <span class="staff-role">{{ role }}</span>
            <button
              class="staff-btn"
              @click="changeStaffCount(role, -1)"
              :disabled="!staffCounts[role]"
              title="Decrease"
            >&minus;</button>
            <input
              type="number"
              min="0"
              class="staff-value"
              :value="staffCounts[role]"
              @change="setStaffCount(role, $event.target.value)"
            />
            <button class="staff-btn" @click="changeStaffCount(role, 1)" title="Increase">+</button>
          </div>
        </div>
        <span class="staff-total">total {{ staffTotal }}</span>
      </div>

      <!-- Reputation: a token on a -10…+10 scale, no zero position -->
      <div class="sub-row">
        <span class="sub-label">REP</span>
        <div class="face-toggle">
          <button
            v-for="face in REPUTATION_FACES"
            :key="face"
            class="face-btn"
            :class="[`face-${face}`, { active: reputationFace === face }]"
            @click="setReputationFace(face)"
          >{{ face }}</button>
        </div>
        <div class="staff-counter rep-counter">
          <button
            class="staff-btn"
            @click="stepReputation(-1)"
            :disabled="reputationValue <= -REPUTATION_MAX"
            title="Move token towards negative"
          >&minus;</button>
          <input
            type="number"
            class="staff-value rep-value"
            :value="reputationValue"
            @change="setReputationValue($event.target.value)"
          />
          <button
            class="staff-btn"
            @click="stepReputation(1)"
            :disabled="reputationValue >= REPUTATION_MAX"
            title="Move token towards positive"
          >+</button>
        </div>
        <span class="rep-hint">&minus;{{ REPUTATION_MAX }}…+{{ REPUTATION_MAX }}, no zero</span>
      </div>

      <!-- Infrastructure: one row of location slots -->
      <div v-if="infraSlots" class="sub-row">
        <span class="sub-label">INFRA</span>
        <div class="infrastructure-row">
          <span
            v-for="slot in infraSlots"
            :key="slot.index"
            class="infra-slot"
            :class="`state-${slot.state}`"
            :title="slotTooltip(slot)"
          >
            <span class="slot-index">{{ slot.index }}</span>
            <span v-if="slot.showState" class="slot-state">{{ slot.state }}</span>
            <span
              v-if="slot.locationId"
              class="slot-location"
              :class="{ missing: slot.missing }"
              @click.stop="openSlotLocation(slot)"
            >{{ slot.locationId }}</span>
            <span v-if="slot.level" class="slot-level">Lv{{ slot.level }}</span>
            <span v-if="slot.timer" class="slot-timer">&#9203;{{ slot.timer }}</span>
          </span>
        </div>

        <span v-if="unslottedLocations.length > 0" class="infra-warning">
          not in any slot:
          <span
            v-for="(loc, idx) in unslottedLocations"
            :key="loc.ItemId"
          ><span class="module-link" @click.stop="$emit('edit-item', loc)">{{ loc.ItemId }}</span><span v-if="idx < unslottedLocations.length - 1">, </span></span>
        </span>
      </div>
    </div>

    <!-- Progress bar -->
    <div v-if="progressPercent > 0" class="progress-section">
      <div class="progress-label">
        Bundle Progress: {{ filledGroups }}/{{ totalGroups }} groups filled
      </div>
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="focus-content">
      <!-- Left: Entity Pool -->
      <div class="focus-sidebar">
        <h3>Entity Pool</h3>

        <div class="pool-filters">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search..."
            class="search-input"
          />

          <select v-model="selectedType" class="type-select">
            <option value="all">All Types</option>
            <option v-for="type in availableTypes" :key="type" :value="type">
              {{ formatType(type) }}
            </option>
          </select>

          <select v-model="selectedTag" class="tag-select">
            <option value="all">All Tags</option>
            <option v-for="tag in allTags" :key="tag" :value="tag">
              {{ tag }}
            </option>
          </select>

          <label class="checkbox-label">
            <input type="checkbox" v-model="showOnlyUnassigned" />
            <span>Unassigned only ({{ unassignedCount }})</span>
          </label>
        </div>

        <div class="pool-list">
          <div
            v-for="entity in filteredEntities"
            :key="entity.ItemId"
            class="pool-item-wrapper"
            draggable="true"
            @dragstart="handleDragStart($event, entity)"
            @dblclick="addToBundle(entity.ItemId)"
          >
            <EntityCard :entity="entity" />
          </div>

          <div v-if="filteredEntities.length === 0" class="pool-empty">
            No items match filters
          </div>
        </div>
      </div>

      <!-- Right: Bundle Contents Grouped -->
      <div class="focus-main">
        <h3>Bundle Contents</h3>

        <BundleItemGroup
          v-for="group in itemGroups"
          :key="group.type"
          :type="group.type"
          :items="group.items"
          :recommendations="group.recommendations"
          :bundle-id="bundleId"
          @remove-item="removeFromBundle"
          @add-item="addToBundle"
          @quick-add="openQuickAdd"
          @edit-item="(item) => $emit('edit-item', item)"
        />

        <div v-if="itemGroups.length === 0" class="no-groups">
          <p>No items in this bundle yet.</p>
          <p>Drag items from the Entity Pool or use the + Add buttons.</p>
        </div>
      </div>
    </div>

    <!-- Quick Add Modal -->
    <div v-if="quickAddType" class="quick-add-modal" @click.self="quickAddType = null">
      <div class="quick-add-content">
        <div class="quick-add-header">
          <h3>{{ quickAddSingle ? 'Select' : 'Add' }} {{ formatType(quickAddType) }}</h3>
          <button @click="quickAddType = null" class="btn-close">x</button>
        </div>

        <div class="quick-add-filters">
          <input
            v-model="quickAddSearch"
            type="text"
            placeholder="Search..."
            class="quick-add-search"
          />
          <label class="quick-add-filter-checkbox">
            <input type="checkbox" v-model="quickAddOnlyUnassigned" />
            <span>Only unassigned</span>
          </label>
        </div>

        <div class="quick-add-list">
          <label
            v-for="item in quickAddItems"
            :key="item.ItemId"
            class="quick-add-item"
            :class="{ 'is-selected': quickAddSelected.includes(item.ItemId) }"
          >
            <input
              :type="quickAddSingle ? 'radio' : 'checkbox'"
              :value="item.ItemId"
              :checked="quickAddSelected.includes(item.ItemId)"
              @change="toggleQuickAddSelection(item.ItemId)"
            />
            <div class="quick-add-entity-wrapper">
              <EntityCard :entity="item" />
              <span v-if="isItemInOtherBundle(item.ItemId)" class="qa-used-badge">
                In use
              </span>
            </div>
          </label>

          <div v-if="quickAddItems.length === 0" class="quick-add-empty">
            No available {{ formatType(quickAddType).toLowerCase() }}
          </div>
        </div>

        <div class="quick-add-footer">
          <span>Selected: {{ quickAddSelected.length }} / Available: {{ quickAddItems.length }}</span>
          <div class="quick-add-actions">
            <button @click="quickAddType = null" class="btn-secondary">Cancel</button>
            <button
              @click="confirmQuickAdd"
              class="btn-primary"
              :disabled="quickAddSelected.length === 0"
            >
              {{ quickAddSingle ? 'Select' : 'Add Selected' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import BundleItemGroup from './BundleItemGroup.vue'
import EntityCard from './EntityCard.vue'
import { usePlayFabData } from '../composables/usePlayFabData'
import { useSettings } from '../composables/useSettings'
import {
  getTypeIcon,
  getEntityDisplayInfo,
  DEFAULT_STAFF_ROLES,
  REPUTATION_MAX,
  REPUTATION_FACES,
  getReputation
} from '../utils/entityHelpers'

const props = defineProps({
  bundleId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['exit', 'edit-bundle', 'edit-item'])

const { state, addEntityToBundle, removeEntityFromBundle, updateEntity, allTags } = usePlayFabData()
const { getTemplate, getBundleTemplateForClass } = useSettings()

// Filters
const searchQuery = ref('')
const selectedType = ref('all')
const selectedTag = ref('all')
const showOnlyUnassigned = ref(true)

// Quick add
const quickAddType = ref(null)
const quickAddSearch = ref('')
const quickAddSelected = ref([])
const quickAddOnlyUnassigned = ref(true)

// Get bundle
const bundle = computed(() =>
  state.entities.find(e => e.ItemId === props.bundleId)
)

const isClub = computed(() => bundle.value?.ItemClass === 'club')

// Get bundle items
const bundleItemIds = computed(() =>
  bundle.value?.Bundle?.BundledItems || []
)

const bundleItems = computed(() =>
  bundleItemIds.value
    .map(id => state.entities.find(e => e.ItemId === id))
    .filter(Boolean)
)

// Team: a club holds exactly one, shown in the sub-header instead of a group
const teamEntity = computed(() =>
  bundleItems.value.find(item => item.ItemClass === 'team') || null
)

const teamInfo = computed(() =>
  teamEntity.value ? getEntityDisplayInfo(teamEntity.value) : {}
)

// Staff: no longer cards, just counters inside the bundle's own CustomData
const bundleData = computed(() => {
  if (!bundle.value?.CustomData) return {}
  try {
    return JSON.parse(bundle.value.CustomData) || {}
  } catch {
    return {}
  }
})

const staffData = computed(() => {
  const staff = bundleData.value.staff
  return staff && typeof staff === 'object' && !Array.isArray(staff) ? staff : {}
})

// Roles come from the bundle template (Settings -> Templates), plus anything
// already present in this bundle's JSON so nothing gets hidden.
const staffRoles = computed(() => {
  const template = getBundleTemplateForClass(bundle.value?.ItemClass)
  const fromTemplate = template?.customData?.staff
  const roles = fromTemplate && typeof fromTemplate === 'object'
    ? Object.keys(fromTemplate)
    : DEFAULT_STAFF_ROLES

  return [...new Set([...roles, ...Object.keys(staffData.value)])]
})

const staffCounts = computed(() => {
  const counts = {}
  staffRoles.value.forEach(role => {
    counts[role] = parseInt(staffData.value[role], 10) || 0
  })
  return counts
})

const staffTotal = computed(() =>
  Object.values(staffCounts.value).reduce((sum, n) => sum + n, 0)
)

function writeStaffCounts(counts) {
  if (!bundle.value) return

  const data = { ...bundleData.value, staff: counts }
  updateEntity(props.bundleId, { CustomData: JSON.stringify(data) })
}

function setStaffCount(role, value) {
  const next = Math.max(0, parseInt(value, 10) || 0)
  writeStaffCounts({ ...staffCounts.value, [role]: next })
}

function changeStaffCount(role, delta) {
  setStaffCount(role, (staffCounts.value[role] || 0) + delta)
}

// Reputation: `value` is the signed position on the scale, `face` is which side of
// the token is up. They are independent — a positive face can sit at -10.
const reputation = computed(() => getReputation(bundle.value?.CustomData))
const reputationValue = computed(() => reputation.value?.value ?? 0)
const reputationFace = computed(() => reputation.value?.face ?? 'negative')

function writeReputation(patch) {
  if (!bundle.value) return

  const data = {
    ...bundleData.value,
    reputation: {
      ...(bundleData.value.reputation || {}),
      value: reputationValue.value,
      face: reputationFace.value,
      ...patch
    }
  }

  updateEntity(props.bundleId, { CustomData: JSON.stringify(data) })
}

function setReputationValue(raw) {
  const parsed = parseInt(raw, 10)
  const next = Number.isNaN(parsed) ? reputationValue.value : parsed
  writeReputation({ value: Math.max(-REPUTATION_MAX, Math.min(REPUTATION_MAX, next)) })
}

function stepReputation(delta) {
  let next = reputationValue.value + delta
  if (next === 0) next = delta > 0 ? 1 : -1 // the scale has no zero to land on
  writeReputation({ value: Math.max(-REPUTATION_MAX, Math.min(REPUTATION_MAX, next)) })
}

// The face is flipped by hand only — stepping the scale never touches it
function setReputationFace(face) {
  writeReputation({ face })
}

// Get items in any bundle
const itemsInBundles = computed(() => {
  const inBundle = new Set()
  state.entities.forEach(entity => {
    if (entity.Bundle?.BundledItems) {
      entity.Bundle.BundledItems.forEach(id => inBundle.add(id))
    }
  })
  return inBundle
})

// Non-bundle entities. A PlayFab Pull omits the Bundle field entirely on plain
// items, so test for the absence of BundledItems rather than for an explicit null.
const nonBundleEntities = computed(() =>
  state.entities.filter(e => !e.Bundle?.BundledItems)
)

// Available types
const availableTypes = computed(() => {
  const types = new Set()
  nonBundleEntities.value.forEach(e => types.add(e.ItemClass))
  return Array.from(types).sort()
})

// Unassigned count
const unassignedCount = computed(() =>
  nonBundleEntities.value.filter(e => !itemsInBundles.value.has(e.ItemId)).length
)

// Filtered entities for pool
const filteredEntities = computed(() => {
  let items = nonBundleEntities.value

  // Exclude items already in this bundle
  items = items.filter(e => !bundleItemIds.value.includes(e.ItemId))

  // Filter by unassigned
  if (showOnlyUnassigned.value) {
    items = items.filter(e => !itemsInBundles.value.has(e.ItemId))
  }

  // Filter by type
  if (selectedType.value !== 'all') {
    items = items.filter(e => e.ItemClass === selectedType.value)
  }

  // Filter by search
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    items = items.filter(e =>
      (e.DisplayName?.toLowerCase() || '').includes(query) ||
      e.ItemId.toLowerCase().includes(query)
    )
  }

  // Filter by tag
  if (selectedTag.value !== 'all') {
    items = items.filter(e =>
      e.Tags && Array.isArray(e.Tags) && e.Tags.includes(selectedTag.value)
    )
  }

  return items
})

// Group items by type
const itemGroups = computed(() => {
  const groups = {}
  const bundleType = bundle.value?.ItemClass || 'club'

  // Create groups from existing items ('team' lives in the sub-header for clubs)
  bundleItems.value.forEach(item => {
    const type = item.ItemClass
    if (isClub.value && type === 'team') return

    if (!groups[type]) {
      groups[type] = {
        type,
        items: [],
        recommendations: getRecommendations(bundleType, type)
      }
    }
    groups[type].items.push(item)
  })

  // Add empty groups for recommended types
  const defaultTypes = isClub.value
    ? ['player', 'tactic', 'personal_connection', 'location']
    : ['team', 'player', 'tactic', 'location']

  defaultTypes.forEach(type => {
    if (!groups[type]) {
      groups[type] = {
        type,
        items: [],
        recommendations: getRecommendations(bundleType, type)
      }
    }
  })

  // Sort groups by priority
  const order = ['team', 'player', 'tactic', 'personal_connection', 'location', 'feature']

  return Object.values(groups).sort((a, b) => {
    const aIndex = order.indexOf(a.type)
    const bIndex = order.indexOf(b.type)

    if (aIndex === -1 && bIndex === -1) return 0
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1

    return aIndex - bIndex
  })
})

// Stats
const itemCount = computed(() => bundleItems.value.length)

const totalPower = computed(() => {
  return bundleItems.value.reduce((sum, item) => {
    try {
      const data = JSON.parse(item.CustomData || '{}')
      return sum + (parseInt(data.power) || 0)
    } catch {
      return sum
    }
  }, 0)
})

const balance = computed(() => {
  const team = bundleItems.value.find(item => item.ItemClass === 'team')
  if (team) {
    try {
      const data = JSON.parse(team.CustomData || '{}')
      return parseInt(data.balance) || 0
    } catch {
      return 0
    }
  }
  return 0
})

// Infrastructure: a fixed row of slots, each holding at most one location
const infraSlots = computed(() => {
  const slots = bundleData.value.infrastructure?.slots
  if (!Array.isArray(slots)) return null

  return slots.map((slot, i) => {
    const locationId = slot?.location_id || null
    const entity = locationId
      ? state.entities.find(e => e.ItemId === locationId) || null
      : null
    const slotState = slot?.state || 'closed'

    return {
      index: slot?.index ?? i + 1,
      state: slotState,
      locationId,
      entity,
      // A location_id with no entity behind it is a broken reference
      missing: !!locationId && !entity,
      level: parseInt(slot?.level, 10) || 0,
      timer: slot?.timer ?? null,
      // 'active with a location' is the self-evident case, name the state otherwise
      showState: !(slotState === 'active' && locationId)
    }
  })
})

// Location cards sitting in the bundle that no slot points at
const unslottedLocations = computed(() => {
  if (!infraSlots.value) return []

  const taken = new Set(infraSlots.value.map(s => s.locationId).filter(Boolean))
  return bundleItems.value.filter(
    item => item.ItemClass === 'location' && !taken.has(item.ItemId)
  )
})

function slotTooltip(slot) {
  const parts = [`Slot ${slot.index} — ${slot.state}`]
  if (slot.missing) {
    parts.push(`${slot.locationId}: no such entity in the catalog`)
  } else if (slot.entity) {
    parts.push(slot.entity.DisplayName || slot.locationId)
  }
  if (slot.timer) parts.push(`timer: ${slot.timer}`)
  return parts.join('\n')
}

function openSlotLocation(slot) {
  if (slot.entity) emit('edit-item', slot.entity)
}

function writeInfraSlots(slots) {
  if (!bundle.value) return

  const data = {
    ...bundleData.value,
    infrastructure: { ...(bundleData.value.infrastructure || {}), slots }
  }

  updateEntity(props.bundleId, { CustomData: JSON.stringify(data) })
}

// Slots and location cards are kept in step: a card added to the club takes the
// first free slot, and removing the card empties the slot it occupied.
function assignLocationToSlot(locationId) {
  const slots = bundleData.value.infrastructure?.slots
  if (!Array.isArray(slots)) return
  if (slots.some(s => s?.location_id === locationId)) return

  const freeIndex = slots.findIndex(s => !s?.location_id && s?.state !== 'locked')
  if (freeIndex === -1) return // no room; the warning line reports the leftover card

  writeInfraSlots(slots.map((slot, i) => i === freeIndex
    ? { ...slot, state: 'active', location_id: locationId, level: slot.level || 1 }
    : slot))
}

function clearLocationSlot(locationId) {
  const slots = bundleData.value.infrastructure?.slots
  if (!Array.isArray(slots)) return
  if (!slots.some(s => s?.location_id === locationId)) return

  writeInfraSlots(slots.map(slot => slot?.location_id === locationId
    ? { ...slot, state: 'closed', location_id: null, level: 0, timer: null }
    : slot))
}

// Progress
const filledGroups = computed(() =>
  itemGroups.value.filter(g => g.items.length > 0).length
)

const totalGroups = computed(() => itemGroups.value.length)

const progressPercent = computed(() => {
  if (totalGroups.value === 0) return 0
  return Math.round((filledGroups.value / totalGroups.value) * 100)
})

// Quick add items
const quickAddItems = computed(() => {
  if (!quickAddType.value) return []

  let items = nonBundleEntities.value.filter(e =>
    e.ItemClass === quickAddType.value &&
    !bundleItemIds.value.includes(e.ItemId)
  )

  // Filter by unassigned only
  if (quickAddOnlyUnassigned.value) {
    items = items.filter(e => !itemsInBundles.value.has(e.ItemId))
  }

  // Filter by search
  if (quickAddSearch.value) {
    const query = quickAddSearch.value.toLowerCase()
    items = items.filter(e =>
      (e.DisplayName?.toLowerCase() || '').includes(query) ||
      e.ItemId.toLowerCase().includes(query)
    )
  }

  return items
})

// Check if item is in another bundle (not current one)
function isItemInOtherBundle(itemId) {
  return itemsInBundles.value.has(itemId) && !bundleItemIds.value.includes(itemId)
}

// Get item stat from CustomData
function getItemStat(item, key) {
  try {
    const data = JSON.parse(item.CustomData || '{}')
    return data[key] || null
  } catch {
    return null
  }
}

// Get player position from CustomData
function getItemPosition(item) {
  try {
    const data = JSON.parse(item.CustomData || '{}')
    const positions = []
    if (data.gk && JSON.parse(data.gk)?.state) positions.push('GK')
    if (data.def && JSON.parse(data.def)?.state) positions.push('DEF')
    if (data.mid && JSON.parse(data.mid)?.state) positions.push('MID')
    if (data.att && JSON.parse(data.att)?.state) positions.push('ATT')
    return positions.length > 0 ? positions.join('/') : null
  } catch {
    return null
  }
}

function getRecommendations(bundleType, itemType) {
  // Try to get from template settings first
  const template = getTemplate('bundle', bundleType)
  if (template?.itemRequirements?.[itemType]) {
    const req = template.itemRequirements[itemType]
    return {
      min: req.min,
      max: req.max,
      label: req.label || (req.min === req.max ? String(req.min) : `${req.min}-${req.max}`)
    }
  }

  // Fallback defaults
  const defaults = {
    club: {
      team: { min: 1, max: 1, label: '1' },
      player: { min: 5, max: 7, label: '5-7' },
      tactic: { min: 1, max: 1, label: '1' },
      personal_connection: { min: 0, max: 5, label: 'optional' },
      location: { min: 0, max: 5, label: 'optional' }
    }
  }

  return defaults[bundleType]?.[itemType] || { label: 'optional' }
}

function formatType(type) {
  const labels = {
    player: 'Players',
    team: 'Team',
    tactic: 'Tactics',
    personal_connection: 'Личные связи',
    location: 'Locations',
    feature: 'Features',
    club: 'Club'
  }
  return labels[type] || type
}

function handleDragStart(event, entity) {
  event.dataTransfer.setData('itemId', entity.ItemId)
  event.dataTransfer.setData('itemClass', entity.ItemClass)
  event.dataTransfer.effectAllowed = 'move'
}

function addToBundle(itemId) {
  const incoming = state.entities.find(e => e.ItemId === itemId)

  if (isClub.value) {
    // A club holds exactly one team — adding another replaces the current one
    if (incoming?.ItemClass === 'team' && teamEntity.value && teamEntity.value.ItemId !== itemId) {
      removeEntityFromBundle(teamEntity.value.ItemId, props.bundleId)
    }
  }

  addEntityToBundle(itemId, props.bundleId)

  if (isClub.value && incoming?.ItemClass === 'location') {
    assignLocationToSlot(itemId)
  }
}

function removeFromBundle(itemId) {
  const outgoing = state.entities.find(e => e.ItemId === itemId)

  removeEntityFromBundle(itemId, props.bundleId)

  if (isClub.value && outgoing?.ItemClass === 'location') {
    clearLocationSlot(itemId)
  }
}

// Team is a single slot, everything else is a multi-select
const quickAddSingle = computed(() => isClub.value && quickAddType.value === 'team')

function toggleQuickAddSelection(itemId) {
  if (quickAddSingle.value) {
    quickAddSelected.value = [itemId]
    return
  }

  const index = quickAddSelected.value.indexOf(itemId)
  if (index === -1) {
    quickAddSelected.value.push(itemId)
  } else {
    quickAddSelected.value.splice(index, 1)
  }
}

function openQuickAdd(type) {
  quickAddType.value = type
  quickAddSearch.value = ''
  quickAddSelected.value = []
  // Teams always live in some club, so swapping one needs the full list
  quickAddOnlyUnassigned.value = !(isClub.value && type === 'team')
}

function confirmQuickAdd() {
  quickAddSelected.value.forEach(itemId => {
    addToBundle(itemId)
  })
  quickAddType.value = null
  quickAddSelected.value = []
}

// Keyboard shortcuts
function handleKeydown(e) {
  if (e.key === 'Escape') {
    if (quickAddType.value) {
      quickAddType.value = null
    } else {
      emit('exit')
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.bundle-focus-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  flex: 1;
  background: #f1f5f9;
}

/* Header */
.focus-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
}

.back-btn {
  padding: 8px 16px;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #475569;
}

.back-btn:hover {
  background: #e2e8f0;
}

.bundle-info {
  flex: 1;
}

.bundle-info h1 {
  font-size: 20px;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 4px 0;
}

.bundle-description {
  font-size: 13px;
  color: #64748b;
  margin: 0 0 6px 0;
}

.bundle-stats {
  display: flex;
  gap: 16px;
}

.stat-item {
  font-size: 13px;
}

.stat-label {
  color: #64748b;
}

.stat-value {
  color: #1e293b;
  font-weight: 500;
  margin-left: 4px;
}

/* Sub-header (club): team, staff, infrastructure */
.bundle-subheader {
  background: white;
  border-bottom: 1px solid #e2e8f0;
  padding: 4px 0;
}

.sub-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 24px;
}

.sub-row + .sub-row {
  border-top: 1px solid #f1f5f9;
}

.sub-label {
  flex-shrink: 0;
  width: 44px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #94a3b8;
}

.sub-empty {
  flex: 1;
  font-size: 13px;
  color: #94a3b8;
  font-style: italic;
}

.sub-actions {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.btn-sub {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid #cbd5e1;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  color: #475569;
}

.btn-sub:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.btn-sub-danger:hover {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #b91c1c;
}

/* Team chip */
.team-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-left: 3px solid #ef4444;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.team-chip:hover {
  background: #fee2e2;
  border-color: #f87171;
}

.team-icon {
  font-size: 13px;
}

.team-name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}

.team-id {
  font-size: 11px;
  font-family: monospace;
  color: #94a3b8;
}

.team-stat {
  font-size: 12px;
  color: #475569;
}

/* Staff counters */
.staff-counters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.staff-counter {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px 3px 8px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}

.staff-counter.is-zero {
  opacity: 0.55;
}

.staff-role {
  font-size: 11px;
  font-family: monospace;
  color: #475569;
  margin-right: 2px;
}

.staff-btn {
  width: 18px;
  height: 18px;
  padding: 0;
  border: 1px solid #cbd5e1;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  color: #475569;
}

.staff-btn:hover:not(:disabled) {
  background: #e2e8f0;
}

.staff-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.staff-value {
  width: 34px;
  padding: 2px 4px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 12px;
  text-align: center;
  color: #1e293b;
  background: white;
}

.staff-value:focus {
  outline: none;
  border-color: #3b82f6;
}

/* Reputation */
.face-toggle {
  display: inline-flex;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.face-btn {
  padding: 4px 10px;
  border: none;
  background: #f1f5f9;
  cursor: pointer;
  font-size: 11px;
  font-family: monospace;
  color: #64748b;
}

.face-btn + .face-btn {
  border-left: 1px solid #e2e8f0;
}

.face-btn:hover {
  background: #e2e8f0;
}

.face-btn.face-negative.active {
  background: #fee2e2;
  color: #b91c1c;
  font-weight: 600;
}

.face-btn.face-positive.active {
  background: #dcfce7;
  color: #15803d;
  font-weight: 600;
}

.rep-counter {
  padding: 3px 6px;
}

.rep-value {
  width: 46px;
}

.rep-hint {
  font-size: 11px;
  color: #cbd5e1;
  font-family: monospace;
}

.staff-total {
  margin-left: auto;
  font-size: 12px;
  color: #94a3b8;
}

/* Infrastructure slots */
.infrastructure-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.infra-slot {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  padding: 3px 8px;
  border: 1px solid transparent;
  border-radius: 4px;
  background: #f1f5f9;
  color: #64748b;
}

.slot-index {
  font-size: 10px;
  font-weight: 700;
  opacity: 0.6;
}

.slot-state {
  font-size: 11px;
  font-family: monospace;
}

.slot-location {
  font-size: 11px;
  font-family: monospace;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
}

.slot-location:hover {
  text-decoration-style: solid;
}

.slot-location.missing {
  color: #b91c1c;
  font-weight: 600;
  cursor: default;
  text-decoration: none;
}

.slot-level,
.slot-timer {
  font-size: 11px;
}

.infra-slot.state-locked {
  background: #e2e8f0;
  color: #94a3b8;
  border-color: #cbd5e1;
  border-style: dashed;
}

.infra-slot.state-closed {
  background: #f1f5f9;
  color: #94a3b8;
}

.infra-slot.state-negotiating {
  background: #fef3c7;
  color: #92400e;
}

.infra-slot.state-deploying {
  background: #dbeafe;
  color: #1e40af;
}

.infra-slot.state-active {
  background: #dcfce7;
  color: #15803d;
}

.infra-warning {
  margin-left: auto;
  font-size: 11px;
  color: #b45309;
}

.module-link {
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
}

.module-link:hover {
  color: #1d4ed8;
  text-decoration-style: solid;
}

.btn-edit-info {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-edit-info:hover {
  background: #2563eb;
}

/* Progress */
.progress-section {
  padding: 12px 24px;
  background: white;
  border-bottom: 1px solid #e2e8f0;
}

.progress-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 6px;
}

.progress-bar {
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #10b981;
  border-radius: 3px;
  transition: width 0.3s;
}

/* Content */
.focus-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Sidebar */
.focus-sidebar {
  width: 280px;
  background: white;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.focus-sidebar h3 {
  padding: 16px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  border-bottom: 1px solid #e2e8f0;
}

.pool-filters {
  padding: 12px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-input,
.type-select,
.tag-select {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.search-input:focus,
.type-select:focus,
.tag-select:focus {
  outline: none;
  border-color: #3b82f6;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
}

.pool-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.pool-item-wrapper {
  cursor: grab;
}

.pool-item-wrapper:active {
  cursor: grabbing;
}

.pool-item-wrapper:deep(.entity-card) {
  margin-bottom: 4px;
}

.pool-empty {
  text-align: center;
  padding: 24px;
  color: #94a3b8;
  font-size: 13px;
}

/* Main */
.focus-main {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

.focus-main h3 {
  margin: 0 0 16px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.no-groups {
  text-align: center;
  padding: 48px;
  color: #64748b;
}

.no-groups p {
  margin: 8px 0;
}

/* Quick Add Modal */
.quick-add-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.quick-add-content {
  background: white;
  border-radius: 12px;
  width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
}

.quick-add-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.quick-add-header h3 {
  margin: 0;
  font-size: 16px;
  color: #1e293b;
}

.btn-close {
  width: 28px;
  height: 28px;
  border: none;
  background: #f1f5f9;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #64748b;
}

.btn-close:hover {
  background: #e2e8f0;
}

.quick-add-filters {
  padding: 12px 20px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-add-search {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  box-sizing: border-box;
}

.quick-add-search:focus {
  outline: none;
  border-color: #3b82f6;
}

.quick-add-filter-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
  cursor: pointer;
}

.quick-add-filter-checkbox input {
  width: 14px;
  height: 14px;
}

.quick-add-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px;
  max-height: 350px;
}

.quick-add-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.quick-add-item:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.quick-add-item.is-selected {
  background: #eff6ff;
  border-color: #3b82f6;
}

.quick-add-item > input[type="checkbox"] {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.quick-add-entity-wrapper {
  flex: 1;
  min-width: 0;
  position: relative;
}

.quick-add-entity-wrapper :deep(.entity-card) {
  margin-bottom: 0;
  box-shadow: none;
  background: transparent;
  border-left-width: 3px;
  padding: 6px 8px;
}

.qa-used-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 10px;
  padding: 2px 6px;
  background: #fef3c7;
  color: #92400e;
  border-radius: 4px;
  font-weight: 500;
}

.quick-add-empty {
  text-align: center;
  padding: 24px;
  color: #94a3b8;
  font-size: 13px;
}

.quick-add-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  font-size: 13px;
  color: #64748b;
}

.quick-add-actions {
  display: flex;
  gap: 8px;
}

.btn-primary {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 8px 16px;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-secondary:hover {
  background: #e2e8f0;
}
</style>
