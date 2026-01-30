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
          <span class="stat-item">
            <span class="stat-label">Power:</span>
            <span class="stat-value">{{ totalPower }}</span>
          </span>
          <span v-if="balance > 0" class="stat-item">
            <span class="stat-label">Balance:</span>
            <span class="stat-value">{{ balance }}</span>
          </span>
        </div>
        <!-- Infrastructure -->
        <div v-if="infrastructure" class="infrastructure-row">
          <span
            v-for="(info, key) in infrastructure"
            :key="key"
            class="infra-item"
            :class="{ 'has-modules': info.modules.length > 0 }"
          >
            <span class="infra-name">{{ formatInfraName(key) }}</span>
            <span class="infra-level">{{ info.level }}lv</span>
            <span v-if="info.modules.length > 0" class="infra-modules">
              [<span
                v-for="(moduleId, idx) in info.modules"
                :key="moduleId"
              ><span
                  class="module-link"
                  @click.stop="openModuleEntity(moduleId)"
                  :title="getModuleDisplayName(moduleId)"
                >{{ moduleId }}</span><span v-if="idx < info.modules.length - 1">, </span></span>]
            </span>
          </span>
        </div>
      </div>

      <button @click="$emit('edit-bundle', bundle)" class="btn-edit-info">
        [=] Edit Info
      </button>
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
          :linked-items="linkedItemsMap[group.type] || []"
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
          <h3>Add {{ formatType(quickAddType) }}</h3>
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
              type="checkbox"
              :value="item.ItemId"
              v-model="quickAddSelected"
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
              Add Selected
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

const props = defineProps({
  bundleId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['exit', 'edit-bundle', 'edit-item'])

const { state, addEntityToBundle, removeEntityFromBundle, allTags } = usePlayFabData()
const { getTemplate } = useSettings()

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

// Get bundle items
const bundleItemIds = computed(() =>
  bundle.value?.Bundle?.BundledItems || []
)

const bundleItems = computed(() =>
  bundleItemIds.value
    .map(id => state.entities.find(e => e.ItemId === id))
    .filter(Boolean)
)

// Collect linked items from bundle items (e.g., tactics from staff's special.tactics)
const linkedItemsMap = computed(() => {
  const linked = {} // { itemType: [{ item, sourceItem, sourceType }] }

  bundleItems.value.forEach(item => {
    if (item.ItemClass === 'staff') {
      try {
        const data = JSON.parse(item.CustomData || '{}')
        if (data.special?.tactics && Array.isArray(data.special.tactics)) {
          data.special.tactics.forEach(tacticId => {
            const tacticEntity = state.entities.find(e => e.ItemId === tacticId)
            if (tacticEntity) {
              if (!linked['tactic']) linked['tactic'] = []
              // Avoid duplicates
              if (!linked['tactic'].some(l => l.item.ItemId === tacticId)) {
                linked['tactic'].push({
                  item: tacticEntity,
                  sourceItem: item,
                  sourceType: 'staff'
                })
              }
            }
          })
        }
      } catch {}
    }
  })

  return linked
})

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

// Non-bundle entities
const nonBundleEntities = computed(() =>
  state.entities.filter(e => e.Bundle === null)
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

  // Create groups from existing items
  bundleItems.value.forEach(item => {
    const type = item.ItemClass
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
  const defaultTypes = ['team', 'player', 'staff', 'tactic', 'location']
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
  const order = ['team', 'player', 'tactic', 'staff', 'location', 'feature']

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

// Infrastructure from bundle CustomData
const infrastructure = computed(() => {
  if (!bundle.value?.CustomData) return null
  try {
    const data = JSON.parse(bundle.value.CustomData)
    if (!data.infrastructure) return null

    const result = {}
    for (const [key, value] of Object.entries(data.infrastructure)) {
      result[key] = {
        level: value.level || 0,
        modules: (value.modules || []).map(m => m.id)
      }
    }
    return result
  } catch {
    return null
  }
})

function formatInfraName(key) {
  const names = {
    training_base: 'Training',
    academy: 'Academy',
    main_office: 'Office',
    stadium: 'Stadium'
  }
  return names[key] || key
}

function getModuleDisplayName(moduleId) {
  const entity = state.entities.find(e => e.ItemId === moduleId)
  return entity?.DisplayName || moduleId
}

function openModuleEntity(moduleId) {
  const entity = state.entities.find(e => e.ItemId === moduleId)
  if (entity) {
    emit('edit-item', entity)
  }
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
      staff: { min: 1, max: 2, label: '1-2' },
      tactic: { min: 1, max: 1, label: '1' },
      location: { min: 0, max: 5, label: 'optional' }
    }
  }

  return defaults[bundleType]?.[itemType] || { label: 'optional' }
}

function formatType(type) {
  const labels = {
    player: 'Players',
    staff: 'Staff',
    team: 'Team',
    tactic: 'Tactics',
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
  addEntityToBundle(itemId, props.bundleId)
}

function removeFromBundle(itemId) {
  removeEntityFromBundle(itemId, props.bundleId)
}

function openQuickAdd(type) {
  quickAddType.value = type
  quickAddSearch.value = ''
  quickAddSelected.value = []
  quickAddOnlyUnassigned.value = true
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

/* Infrastructure */
.infrastructure-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
}

.infra-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  padding: 4px 8px;
  background: #f1f5f9;
  border-radius: 4px;
  color: #64748b;
}

.infra-item.has-modules {
  background: #dbeafe;
  color: #1e40af;
}

.infra-name {
  font-weight: 500;
}

.infra-level {
  color: #475569;
}

.infra-item.has-modules .infra-level {
  color: #1d4ed8;
}

.infra-modules {
  font-size: 11px;
  color: #3b82f6;
  font-family: monospace;
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
