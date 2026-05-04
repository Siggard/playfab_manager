<template>
  <div class="entity-browser">
    <!-- Toolbar -->
    <div class="browser-toolbar">
      <div class="toolbar-row">
        <button class="btn-back" @click="$emit('back')" title="Back to Bundles">
          <span class="back-arrow">&larr;</span>
          <span>Bundles</span>
        </button>

        <div class="type-tabs">
          <button
            class="type-tab"
            :class="{ active: selectedType === 'all' }"
            @click="selectedType = 'all'"
          >
            <span class="tab-label">All</span>
            <span class="tab-count">{{ totalEntityCount }}</span>
          </button>
          <button
            v-for="cls in entityClasses"
            :key="cls"
            class="type-tab"
            :class="{ active: selectedType === cls }"
            :style="selectedType === cls ? { borderBottomColor: getTypeColor(cls) } : {}"
            @click="selectedType = cls"
          >
            <span class="tab-icon">{{ getTypeIcon(cls) }}</span>
            <span class="tab-label">{{ formatClassName(cls) }}</span>
            <span class="tab-count">{{ getTypeCount(cls) }}</span>
          </button>
        </div>
      </div>

      <div class="toolbar-row toolbar-filters">
        <div class="search-box">
          <span class="search-icon">&#128269;</span>
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Search by name or ID..."
            class="search-input"
          />
          <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">&times;</button>
        </div>

        <div class="filter-group">
          <div class="filter-chips">
            <button
              class="chip"
              :class="{ active: assignedFilter === 'all' }"
              @click="assignedFilter = 'all'"
            >All</button>
            <button
              class="chip"
              :class="{ active: assignedFilter === 'assigned' }"
              @click="assignedFilter = 'assigned'"
            >Assigned</button>
            <button
              class="chip"
              :class="{ active: assignedFilter === 'unassigned' }"
              @click="assignedFilter = 'unassigned'"
            >Unassigned</button>
          </div>

          <select v-model="sortBy" class="sort-select">
            <option value="name">Sort: Name</option>
            <option value="type">Sort: Type</option>
            <option value="id">Sort: ID</option>
          </select>
        </div>

        <div class="view-toggle theme-toggle" :title="`Table theme: ${tableTheme}`">
          <button
            class="toggle-btn"
            :class="{ active: tableTheme === 'light' }"
            @click="setTableTheme('light')"
            title="Light row background"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="8" cy="8" r="3"/>
              <g stroke="currentColor" stroke-width="1.2" stroke-linecap="round">
                <line x1="8" y1="1" x2="8" y2="3"/>
                <line x1="8" y1="13" x2="8" y2="15"/>
                <line x1="1" y1="8" x2="3" y2="8"/>
                <line x1="13" y1="8" x2="15" y2="8"/>
                <line x1="3" y1="3" x2="4.5" y2="4.5"/>
                <line x1="11.5" y1="11.5" x2="13" y2="13"/>
                <line x1="3" y1="13" x2="4.5" y2="11.5"/>
                <line x1="11.5" y1="4.5" x2="13" y2="3"/>
              </g>
            </svg>
          </button>
          <button
            class="toggle-btn"
            :class="{ active: tableTheme === 'dark' }"
            @click="setTableTheme('dark')"
            title="Dark row background (better for light images)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 1.5a6.5 6.5 0 1 0 8.5 8.5A5.5 5.5 0 0 1 6 1.5z"/>
            </svg>
          </button>
        </div>

        <div class="view-toggle">
          <button
            class="toggle-btn"
            :class="{ active: viewType === 'grid' }"
            @click="viewType = 'grid'"
            title="Card view"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="1" width="6" height="6" rx="1"/>
              <rect x="9" y="1" width="6" height="6" rx="1"/>
              <rect x="1" y="9" width="6" height="6" rx="1"/>
              <rect x="9" y="9" width="6" height="6" rx="1"/>
            </svg>
          </button>
          <button
            class="toggle-btn"
            :class="{ active: viewType === 'table' }"
            @click="viewType = 'table'"
            title="Table view"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="1" width="14" height="3" rx="0.5"/>
              <rect x="1" y="6" width="14" height="3" rx="0.5"/>
              <rect x="1" y="11" width="14" height="3" rx="0.5"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Results info -->
    <div class="results-bar">
      <span class="results-count">{{ filteredEntities.length }} entities</span>
      <span v-if="hasActiveFilters" class="results-filter-hint">
        (filtered)
        <button class="btn-clear-filters" @click="clearFilters">Clear filters</button>
      </span>
      <button class="btn-add-entity" @click="$emit('create', selectedType !== 'all' ? selectedType : null)">
        + New {{ selectedType !== 'all' ? formatClassName(selectedType) : 'Entity' }}
      </button>
    </div>

    <!-- Grid View -->
    <div v-if="viewType === 'grid'" class="browser-grid" ref="gridContainer">
      <div
        v-for="entity in filteredEntities"
        :key="entity.ItemId"
        class="grid-item"
        @click="$emit('edit', entity)"
      >
        <EntityCard :entity="entity" />
        <div class="grid-item-overlay">
          <span class="assigned-badge" :class="isEntityAssigned(entity.ItemId) ? 'is-assigned' : 'is-unassigned'">
            {{ isEntityAssigned(entity.ItemId) ? 'Assigned' : 'Unassigned' }}
          </span>
        </div>
      </div>

      <div v-if="filteredEntities.length === 0" class="empty-state">
        <div class="empty-icon">&#128270;</div>
        <div class="empty-text">No entities match your filters</div>
        <button class="btn-clear-filters-lg" @click="clearFilters">Clear all filters</button>
      </div>
    </div>

    <!-- Table View -->
    <div v-if="viewType === 'table'" class="browser-table-wrap" :class="`theme-${tableTheme}`">
      <table class="browser-table">
        <thead>
          <tr>
            <th class="th-type">Type</th>
            <th class="th-name th-sortable" :class="{ 'is-sorted': sortBy === 'name' }" @click="toggleSort('name')">
              Name
              <span class="sort-arrow">{{ sortBy === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅' }}</span>
            </th>
            <th class="th-id th-sortable" :class="{ 'is-sorted': sortBy === 'id' }" @click="toggleSort('id')">
              Item ID
              <span class="sort-arrow">{{ sortBy === 'id' ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅' }}</span>
            </th>
            <th class="th-stats">Stats</th>
            <th class="th-details">Details</th>
            <th class="th-tags">Tags</th>
            <th class="th-assigned">Assigned To</th>
            <th class="th-image">Image</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entity in filteredEntities"
            :key="entity.ItemId"
            class="table-row"
            @click="$emit('edit', entity)"
          >
            <td class="td-type">
              <span class="type-dot" :style="{ background: getTypeColor(entity.ItemClass) }"></span>
              <span class="type-icon">{{ getTypeIcon(entity.ItemClass) }}</span>
              <span class="type-name">{{ formatClassName(entity.ItemClass) }}</span>
            </td>
            <td class="td-name">
              <span class="entity-name">{{ entity.DisplayName || 'Unnamed' }}</span>
              <span v-if="entity.Description" class="entity-desc">{{ entity.Description }}</span>
            </td>
            <td class="td-id">
              <code>{{ entity.ItemId }}</code>
            </td>
            <td class="td-stats">
              <template v-if="getDisplayInfo(entity)">
                <span v-if="getDisplayInfo(entity).power" class="mini-stat">
                  &#9889;{{ getDisplayInfo(entity).power }}
                </span>
                <span v-if="getDisplayInfo(entity).level" class="mini-stat">
                  Lv{{ getDisplayInfo(entity).level }}
                </span>
                <span v-if="getDisplayInfo(entity).balance" class="mini-stat">
                  &#128176;{{ getDisplayInfo(entity).balance }}
                </span>
                <span v-if="getDisplayInfo(entity).salary" class="mini-stat">
                  ${{ getDisplayInfo(entity).salary }}
                </span>
                <span v-if="getDisplayInfo(entity).position" class="mini-stat stat-position">
                  {{ getDisplayInfo(entity).position }}
                </span>
              </template>
            </td>
            <td class="td-details">
              <template v-if="getDisplayInfo(entity)">
                <!-- Player tags -->
                <span
                  v-for="tag in (getDisplayInfo(entity).playerTags || [])"
                  :key="tag"
                  class="detail-chip player"
                >{{ formatStyle(tag) }}</span>
                <!-- Tactic styles -->
                <span
                  v-for="style in (getDisplayInfo(entity).tacticStyles || [])"
                  :key="style"
                  class="detail-chip tactic"
                >{{ formatStyle(style) }}</span>
                <!-- Staff marks -->
                <span v-if="getDisplayInfo(entity).activeMarks" class="detail-chip staff">
                  {{ getDisplayInfo(entity).activeMarks }}
                </span>
                <!-- Location directions -->
                <span
                  v-for="dir in (getDisplayInfo(entity).directions || [])"
                  :key="dir"
                  class="detail-chip location"
                >{{ dir }}</span>
                <!-- Tactic slots summary -->
                <span v-if="getDisplayInfo(entity).slots" class="detail-chip slots">
                  {{ getDisplayInfo(entity).slots.filter(s => s.pos).length }}/{{ getDisplayInfo(entity).slots.length }} slots
                </span>
                <!-- Bot bonus -->
                <span v-if="getDisplayInfo(entity).bonusLevel !== undefined && getDisplayInfo(entity).bonusLevel !== null" class="detail-chip bonus">
                  Lv{{ getDisplayInfo(entity).bonusLevel }}
                </span>
              </template>
            </td>
            <td class="td-tags">
              <span v-for="tag in (entity.Tags || []).slice(0, 3)" :key="tag" class="table-tag">
                {{ tag }}
              </span>
              <span v-if="entity.Tags && entity.Tags.length > 3" class="table-tag more">
                +{{ entity.Tags.length - 3 }}
              </span>
            </td>
            <td class="td-assigned">
              <template v-if="getEntityAssignments(entity.ItemId).length">
                <span
                  v-for="(a, idx) in getEntityAssignments(entity.ItemId).slice(0, 3)"
                  :key="idx"
                  class="assigned-link"
                  :class="'ref-' + a.type"
                  :title="a.entity.DisplayName || a.entity.ItemId"
                  @click.stop="$emit('edit', a.entity)"
                >{{ a.entity.DisplayName || a.entity.ItemId }}</span>
                <span v-if="getEntityAssignments(entity.ItemId).length > 3" class="assigned-more">
                  +{{ getEntityAssignments(entity.ItemId).length - 3 }}
                </span>
              </template>
              <span v-else class="status-free">Free</span>
            </td>
            <td class="td-image">
              <EntityThumbnail :entity="entity" :size="32" />
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="filteredEntities.length === 0" class="empty-state">
        <div class="empty-icon">&#128270;</div>
        <div class="empty-text">No entities match your filters</div>
        <button class="btn-clear-filters-lg" @click="clearFilters">Clear all filters</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import EntityCard from './EntityCard.vue'
import EntityThumbnail from './EntityThumbnail.vue'
import { usePlayFabData } from '../composables/usePlayFabData'
import { getTypeIcon, getTypeColor, getEntityDisplayInfo, typeIcons } from '../utils/entityHelpers'

const { state, entityClasses: dataEntityClasses, isEntityInBundle, getEntityAssignments, isEntityAssigned } = usePlayFabData()

// Show all registered classes (from typeIcons), plus any classes present in data,
// minus bundle classes. This way newly registered types appear as tabs even before
// any entity of that type exists.
const entityClasses = computed(() => {
  const fromData = new Set(dataEntityClasses.value)
  for (const cls of Object.keys(typeIcons)) {
    if (cls.endsWith('_deck')) continue
    if (state.bundleClasses.has(cls)) continue
    fromData.add(cls)
  }
  return Array.from(fromData).sort()
})

const naturalCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

defineEmits(['edit', 'back', 'create'])

const selectedType = ref('all')
const searchQuery = ref('')
const assignedFilter = ref('all')
const sortBy = ref('name')
const sortDirection = ref('asc')
const viewType = ref('table')

const TABLE_THEME_KEY = 'playfab-editor-entity-table-theme'
const tableTheme = ref(localStorage.getItem(TABLE_THEME_KEY) === 'dark' ? 'dark' : 'light')

function setTableTheme(theme) {
  tableTheme.value = theme
  try { localStorage.setItem(TABLE_THEME_KEY, theme) } catch {}
}

function toggleSort(column) {
  if (sortBy.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = column
    sortDirection.value = 'asc'
  }
}

// All non-bundle entities
const allEntities = computed(() => {
  return state.entities.filter(e => !state.bundleClasses.has(e.ItemClass) || !e.Bundle?.BundledItems)
})

const totalEntityCount = computed(() => allEntities.value.length)

function getTypeCount(cls) {
  return allEntities.value.filter(e => e.ItemClass === cls).length
}

const filteredEntities = computed(() => {
  let result = allEntities.value

  // Type filter
  if (selectedType.value !== 'all') {
    result = result.filter(e => e.ItemClass === selectedType.value)
  }

  // Search filter
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(e =>
      e.DisplayName?.toLowerCase().includes(q) ||
      e.ItemId.toLowerCase().includes(q)
    )
  }

  // Assigned filter
  if (assignedFilter.value === 'assigned') {
    result = result.filter(e => isEntityAssigned(e.ItemId))
  } else if (assignedFilter.value === 'unassigned') {
    result = result.filter(e => !isEntityAssigned(e.ItemId))
  }

  // Sort (natural: debuff_player_2 < debuff_player_10)
  const dir = sortDirection.value === 'desc' ? -1 : 1
  const cmp = (x, y) => naturalCollator.compare(x || '', y || '')
  result = [...result].sort((a, b) => {
    switch (sortBy.value) {
      case 'name':
        return dir * cmp(a.DisplayName, b.DisplayName)
      case 'type':
        return dir * (cmp(a.ItemClass, b.ItemClass) || cmp(a.DisplayName, b.DisplayName))
      case 'id':
        return dir * cmp(a.ItemId, b.ItemId)
      default:
        return 0
    }
  })

  return result
})

const hasActiveFilters = computed(() => {
  return selectedType.value !== 'all' || searchQuery.value || assignedFilter.value !== 'all'
})

function clearFilters() {
  selectedType.value = 'all'
  searchQuery.value = ''
  assignedFilter.value = 'all'
}

function formatClassName(cls) {
  return cls.replace(/_/g, ' ')
}

function formatStyle(style) {
  return style.replace(/_/g, ' ')
}

function truncate(str, len) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '...' : str
}

function getDisplayInfo(entity) {
  return getEntityDisplayInfo(entity)
}
</script>

<style scoped>
.entity-browser {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  flex: 1;
  background: #f1f5f9;
}

/* Toolbar */
.browser-toolbar {
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 20px;
}

.toolbar-row:first-child {
  border-bottom: 1px solid #e2e8f0;
}

.toolbar-filters {
  padding: 12px 20px;
  gap: 16px;
}

/* Back button */
.btn-back {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: none;
  border: none;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s;
  white-space: nowrap;
  border-right: 1px solid #e2e8f0;
  margin-right: 4px;
}

.btn-back:hover {
  color: #3b82f6;
}

.back-arrow {
  font-size: 16px;
}

/* Type tabs */
.type-tabs {
  display: flex;
  gap: 0;
  overflow-x: auto;
  scrollbar-width: thin;
  scrollbar-color: #cbd5e1 transparent;
  flex: 1;
}

.type-tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 12px 14px;
  background: none;
  border: none;
  border-bottom: 3px solid transparent;
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.type-tab:hover {
  color: #1e293b;
  background: #f8fafc;
}

.type-tab.active {
  color: #1e293b;
  border-bottom-color: #3b82f6;
  font-weight: 600;
}

.tab-icon {
  font-size: 14px;
}

.tab-count {
  background: #e2e8f0;
  color: #64748b;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
}

.type-tab.active .tab-count {
  background: #dbeafe;
  color: #3b82f6;
}

/* Search box */
.search-box {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 14px;
  color: #94a3b8;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 8px 32px 8px 34px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  background: #f8fafc;
}

.search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  background: #fff;
}

.search-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.search-clear:hover {
  color: #64748b;
}

/* Filter group */
.filter-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-chips {
  display: flex;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
}

.chip {
  padding: 6px 14px;
  background: none;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;
}

.chip:hover {
  color: #1e293b;
}

.chip.active {
  background: #fff;
  color: #1e293b;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  font-weight: 600;
}

.sort-select {
  padding: 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
  color: #374151;
  background: #fff;
  cursor: pointer;
  outline: none;
}

.sort-select:focus {
  border-color: #3b82f6;
}

/* View toggle */
.view-toggle {
  display: flex;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 2px;
  gap: 2px;
  margin-left: auto;
}

.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  background: none;
  border: none;
  border-radius: 6px;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-btn:hover {
  color: #64748b;
}

.toggle-btn.active {
  background: #fff;
  color: #1e293b;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Results bar */
.results-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  font-size: 12px;
  color: #64748b;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
}

.btn-clear-filters {
  background: none;
  border: none;
  color: #3b82f6;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.btn-clear-filters:hover {
  color: #2563eb;
}

.btn-add-entity {
  margin-left: auto;
  padding: 5px 14px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  text-transform: capitalize;
}

.btn-add-entity:hover {
  background: #059669;
}

/* Grid View */
.browser-grid {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  align-content: start;
}

.grid-item {
  position: relative;
  cursor: pointer;
  border-radius: 8px;
  transition: transform 0.15s, box-shadow 0.15s;
}

.grid-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.grid-item :deep(.entity-card) {
  cursor: pointer;
  border-radius: 8px;
}

.grid-item-overlay {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 5;
}

.assigned-badge {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.assigned-badge.is-assigned {
  background: #dcfce7;
  color: #166534;
}

.assigned-badge.is-unassigned {
  background: #fef3c7;
  color: #92400e;
}

/* Table View */
.browser-table-wrap {
  flex: 1;
  overflow: auto;
  padding: 0;
}

.browser-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.browser-table thead {
  position: sticky;
  top: 0;
  z-index: 10;
}

.browser-table th {
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
  padding: 10px 14px;
  text-align: left;
  font-weight: 600;
  color: #475569;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.th-sortable {
  cursor: pointer;
  user-select: none;
  transition: background 0.15s, color 0.15s;
}

.th-sortable:hover {
  background: #eef2f7;
  color: #1e293b;
}

.th-sortable.is-sorted {
  color: #1e293b;
}

.sort-arrow {
  display: inline-block;
  margin-left: 6px;
  font-size: 10px;
  color: #cbd5e1;
  transition: color 0.15s;
}

.th-sortable.is-sorted .sort-arrow {
  color: #3b82f6;
}

.th-sortable:hover .sort-arrow {
  color: #94a3b8;
}

.th-sortable.is-sorted:hover .sort-arrow {
  color: #2563eb;
}

.table-row {
  cursor: pointer;
  transition: background 0.1s;
  border-bottom: 1px solid #f1f5f9;
}

.table-row:hover {
  background: #f0f9ff;
}

.table-row td {
  padding: 10px 14px;
  vertical-align: middle;
  background: #fff;
}

.table-row:hover td {
  background: #f0f9ff;
}

/* Type cell */
.td-type {
  white-space: nowrap;
}

.type-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.type-icon {
  margin-right: 4px;
  font-size: 14px;
}

.type-name {
  font-size: 12px;
  color: #64748b;
  text-transform: capitalize;
}

/* Name cell */
.td-name {
  min-width: 280px;
}

.entity-name {
  display: block;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entity-desc {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.4;
}

/* ID cell */
.td-id code {
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

/* Stats cell */
.td-stats {
  white-space: nowrap;
}

.mini-stat {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: #374151;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  margin-right: 4px;
}

.mini-stat.stat-position {
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 600;
}

/* Details cell */
.td-details {
  max-width: 200px;
}

.detail-chip {
  display: inline-block;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  margin-right: 3px;
  margin-bottom: 2px;
  font-weight: 500;
  text-transform: capitalize;
}

.detail-chip.player {
  background: #fef3c7;
  color: #92400e;
}

.detail-chip.tactic {
  background: #ede9fe;
  color: #6d28d9;
}

.detail-chip.staff {
  background: #d1fae5;
  color: #065f46;
}

.detail-chip.location {
  background: #fed7aa;
  color: #c2410c;
}

.detail-chip.slots {
  background: #dbeafe;
  color: #1d4ed8;
}

.detail-chip.bonus {
  background: #cffafe;
  color: #0e7490;
}

/* Tags cell */
.table-tag {
  display: inline-block;
  font-size: 10px;
  background: #e5e7eb;
  color: #4b5563;
  padding: 1px 6px;
  border-radius: 3px;
  margin-right: 3px;
  margin-bottom: 2px;
}

.table-tag.more {
  background: #d1d5db;
}

/* Assigned To cell */
.td-assigned {
  max-width: 220px;
}

.assigned-link {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  margin-right: 4px;
  margin-bottom: 2px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}

.assigned-link.ref-bundle {
  background: #dbeafe;
  color: #1d4ed8;
}

.assigned-link.ref-bundle:hover {
  background: #bfdbfe;
}

.assigned-link.ref-feature_ref,
.assigned-link.ref-slot_ref {
  background: #ede9fe;
  color: #6d28d9;
}

.assigned-link.ref-feature_ref:hover,
.assigned-link.ref-slot_ref:hover {
  background: #ddd6fe;
}

.assigned-link.ref-debuff_ref {
  background: #fee2e2;
  color: #dc2626;
}

.assigned-link.ref-debuff_ref:hover {
  background: #fecaca;
}

.assigned-link.ref-mark_ref {
  background: #d1fae5;
  color: #065f46;
}

.assigned-link.ref-mark_ref:hover {
  background: #a7f3d0;
}

.assigned-link.ref-tactic_ref {
  background: #f3e8ff;
  color: #7c3aed;
}

.assigned-link.ref-tactic_ref:hover {
  background: #e9d5ff;
}

.assigned-more {
  font-size: 10px;
  color: #64748b;
  vertical-align: middle;
}

.status-free {
  font-size: 11px;
  color: #94a3b8;
  font-style: italic;
}

/* Column widths */
.th-type { width: 140px; }
.th-name { width: auto; }
.th-id { width: 180px; }
.th-stats { width: 180px; }
.th-details { width: 180px; }
.th-tags { width: 140px; }
.th-assigned { width: 200px; }
.th-image { width: 48px; text-align: center; }

.td-image {
  text-align: center;
  padding: 4px 8px !important;
}

/* Dark table theme — for visibility of light/white images */
.browser-table-wrap.theme-dark .browser-table {
  background: #1f2937;
}

.browser-table-wrap.theme-dark .browser-table th {
  background: #111827;
  color: #cbd5e1;
  border-bottom-color: #374151;
}

.browser-table-wrap.theme-dark .th-sortable:hover {
  background: #1f2937;
  color: #f1f5f9;
}

.browser-table-wrap.theme-dark .th-sortable .sort-arrow {
  color: #4b5563;
}

.browser-table-wrap.theme-dark .th-sortable.is-sorted .sort-arrow {
  color: #60a5fa;
}

.browser-table-wrap.theme-dark .table-row {
  border-bottom-color: #374151;
}

.browser-table-wrap.theme-dark .table-row td {
  background: #1f2937;
  color: #e5e7eb;
}

.browser-table-wrap.theme-dark .table-row:hover td {
  background: #273449;
}

.browser-table-wrap.theme-dark .entity-name {
  color: #f1f5f9;
}

.browser-table-wrap.theme-dark .entity-desc,
.browser-table-wrap.theme-dark .type-name,
.browser-table-wrap.theme-dark .status-free,
.browser-table-wrap.theme-dark .assigned-more {
  color: #94a3b8;
}

.browser-table-wrap.theme-dark .td-id code {
  background: #0f172a;
  color: #cbd5e1;
}

.browser-table-wrap.theme-dark .mini-stat {
  background: #374151;
  color: #e5e7eb;
}

.browser-table-wrap.theme-dark .table-tag {
  background: #374151;
  color: #d1d5db;
}

.browser-table-wrap.theme-dark .table-tag.more {
  background: #4b5563;
}

/* Theme toggle spacing */
.theme-toggle {
  margin-left: auto;
  margin-right: 0;
}

.view-toggle.theme-toggle + .view-toggle {
  margin-left: 8px;
}

/* Empty state */
.empty-state {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #94a3b8;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-text {
  font-size: 15px;
  margin-bottom: 16px;
}

.btn-clear-filters-lg {
  padding: 8px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-clear-filters-lg:hover {
  background: #2563eb;
}

/* Scrollbar styling */
.browser-grid::-webkit-scrollbar,
.browser-table-wrap::-webkit-scrollbar {
  width: 8px;
}

.browser-grid::-webkit-scrollbar-track,
.browser-table-wrap::-webkit-scrollbar-track {
  background: transparent;
}

.browser-grid::-webkit-scrollbar-thumb,
.browser-table-wrap::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.browser-grid::-webkit-scrollbar-thumb:hover,
.browser-table-wrap::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Type tabs scrollbar */
.type-tabs::-webkit-scrollbar {
  height: 4px;
}

.type-tabs::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 2px;
}
</style>
