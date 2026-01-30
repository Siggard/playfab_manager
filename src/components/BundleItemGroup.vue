<template>
  <div class="bundle-item-group" :class="{ collapsed: isCollapsed }">
    <div class="group-header" :class="groupStatus" @click="isCollapsed = !isCollapsed">
      <span class="toggle-icon">{{ isCollapsed ? '>' : 'v' }}</span>
      <span class="type-icon">{{ typeIcon }}</span>
      <h4>{{ typeLabel }} ({{ totalCount }}{{ linkedItems.length > 0 ? `, ${linkedItems.length} linked` : '' }}{{ recommendationLabel }})</h4>
      <span v-if="totalPower > 0 && type !== 'staff'" class="group-stats">
        Power: {{ totalPower }}
      </span>
      <span v-if="totalSalary > 0 && type === 'staff'" class="group-stats">
        Salary: {{ totalSalary }}
      </span>
      <button
        v-if="!isCollapsed"
        @click.stop="$emit('quick-add', type)"
        class="btn-add-small"
      >
        + Add
      </button>
    </div>

    <div v-show="!isCollapsed" class="group-content">
      <!-- Empty state -->
      <div v-if="!hasAnyItems" class="empty-group">
        <p>No {{ typeLabel.toLowerCase() }} yet</p>
        <button @click="$emit('quick-add', type)" class="btn-add">
          + Add {{ typeLabel }}
        </button>
      </div>

      <!-- Items grid -->
      <div
        v-else
        class="items-grid"
        @drop="handleDrop"
        @dragover.prevent
        @dragenter.prevent="dragOver = true"
        @dragleave="dragOver = false"
        :class="{ 'drag-over': dragOver, 'type-location': type === 'location' }"
      >
        <!-- Regular items -->
        <div
          v-for="item in items"
          :key="item.ItemId"
          class="item-wrapper"
          @dblclick="$emit('edit-item', item)"
        >
          <EntityCard :entity="item" />
          <button
            @click.stop="$emit('remove-item', item.ItemId)"
            class="btn-remove-overlay"
            title="Remove from bundle"
          >
            x
          </button>
        </div>

        <!-- Linked items (from other entities like staff) -->
        <div
          v-for="linked in linkedItems"
          :key="'linked-' + linked.item.ItemId"
          class="item-wrapper linked-item"
          @dblclick="$emit('edit-item', linked.item)"
          :title="'Linked from ' + linked.sourceItem.DisplayName"
        >
          <EntityCard :entity="linked.item" />
          <span class="linked-badge" :title="'Linked from ' + linked.sourceItem.DisplayName">
            🔗
          </span>
        </div>
      </div>

      <!-- Quick add zone -->
      <div v-if="hasAnyItems" class="quick-add-zone">
        <button @click="$emit('quick-add', type)" class="btn-add-outlined">
          + Add another {{ typeLabel.toLowerCase() }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import EntityCard from './EntityCard.vue'

const props = defineProps({
  type: String,
  items: Array,
  linkedItems: {
    type: Array,
    default: () => []
  },
  recommendations: Object,
  bundleId: String
})

const emit = defineEmits(['remove-item', 'add-item', 'quick-add', 'edit-item'])

const isCollapsed = ref(props.type === 'team')
const dragOver = ref(false)

const typeLabels = {
  player: 'Players',
  staff: 'Staff',
  team: 'Team',
  tactic: 'Tactics',
  location: 'Locations',
  feature: 'Features'
}

const typeIcons = {
  player: '[P]',
  staff: '[S]',
  team: '[T]',
  tactic: '[X]',
  location: '[L]',
  feature: '[F]'
}

const typeLabel = computed(() => typeLabels[props.type] || props.type)
const typeIcon = computed(() => typeIcons[props.type] || '[?]')

// Total count including linked items
const totalCount = computed(() => props.items.length + props.linkedItems.length)
const hasAnyItems = computed(() => totalCount.value > 0)

const recommendationLabel = computed(() => {
  if (!props.recommendations?.label) return ''
  return ` / recommended: ${props.recommendations.label}`
})

const groupStatus = computed(() => {
  const count = props.items.length
  const { min, max } = props.recommendations || {}

  if (min !== undefined && count < min) return 'insufficient'
  if (max !== undefined && count > max) return 'excessive'
  if (min !== undefined && max !== undefined && count >= min && count <= max) return 'optimal'

  return 'neutral'
})

const totalPower = computed(() => {
  return props.items.reduce((sum, item) => {
    return sum + (getItemPower(item) || 0)
  }, 0)
})

const totalSalary = computed(() => {
  return props.items.reduce((sum, item) => {
    return sum + (getItemSalary(item) || 0)
  }, 0)
})

function getItemPower(item) {
  try {
    const data = JSON.parse(item.CustomData || '{}')
    return parseInt(data.power) || 0
  } catch {
    return 0
  }
}

function getItemSalary(item) {
  try {
    const data = JSON.parse(item.CustomData || '{}')
    return parseInt(data.salary) || 0
  } catch {
    return 0
  }
}

function getItemLevel(item) {
  try {
    const data = JSON.parse(item.CustomData || '{}')
    return parseInt(data.level) || 0
  } catch {
    return 0
  }
}

function getItemPosition(item) {
  try {
    const data = JSON.parse(item.CustomData || '{}')
    const positions = []
    if (data.gk && JSON.parse(data.gk)?.state) positions.push('GK')
    if (data.def && JSON.parse(data.def)?.state) positions.push('DEF')
    if (data.mid && JSON.parse(data.mid)?.state) positions.push('MID')
    if (data.att && JSON.parse(data.att)?.state) positions.push('ATT')
    return positions.join('/')
  } catch {
    return ''
  }
}

function handleDrop(event) {
  dragOver.value = false
  const itemId = event.dataTransfer.getData('itemId')
  const itemClass = event.dataTransfer.getData('itemClass')

  // Only accept items of matching type
  if (itemClass === props.type) {
    emit('add-item', itemId)
  }
}
</script>

<style scoped>
.bundle-item-group {
  margin-bottom: 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: white;
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  cursor: pointer;
  background: #f9fafb;
  border-left: 4px solid transparent;
  transition: all 0.15s;
}

.group-header:hover {
  background: #f3f4f6;
}

.group-header.insufficient {
  border-left-color: #ef4444;
  background: #fef2f2;
}

.group-header.optimal {
  border-left-color: #10b981;
  background: #f0fdf4;
}

.group-header.excessive {
  border-left-color: #f59e0b;
  background: #fffbeb;
}

.toggle-icon {
  font-size: 12px;
  color: #6b7280;
  font-family: monospace;
  width: 12px;
}

.type-icon {
  font-size: 12px;
  color: #6b7280;
  font-family: monospace;
}

.group-header h4 {
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.group-stats {
  font-size: 12px;
  color: #6b7280;
  margin-right: 8px;
}

.btn-add-small {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  color: #374151;
}

.btn-add-small:hover {
  background: #f9fafb;
  border-color: #9ca3af;
}

.group-content {
  padding: 12px;
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
  min-height: 60px;
  padding: 8px;
  border: 2px dashed transparent;
  border-radius: 6px;
  transition: all 0.15s;
}

.items-grid.drag-over {
  border-color: #3b82f6;
  background: #eff6ff;
}

.items-grid.type-location {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.item-wrapper {
  position: relative;
}

.item-wrapper:deep(.entity-card) {
  margin-bottom: 0;
}

.btn-remove-overlay {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  background: #ef4444;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 10;
}

.item-wrapper:hover .btn-remove-overlay {
  opacity: 1;
}

.btn-remove-overlay:hover {
  background: #dc2626;
}

/* Linked items styling */
.item-wrapper.linked-item {
  position: relative;
}

.item-wrapper.linked-item :deep(.entity-card) {
  background: #f0f9ff;
  border: 1px dashed #93c5fd;
  border-left: 4px solid #3b82f6;
}

.linked-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #dbeafe;
  border: 1px solid #93c5fd;
  border-radius: 50%;
  font-size: 10px;
  cursor: help;
  z-index: 10;
}

.empty-group {
  text-align: center;
  padding: 24px;
  color: #6b7280;
}

.empty-group p {
  margin-bottom: 12px;
  font-size: 13px;
}

.btn-add {
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-add:hover {
  background: #2563eb;
}

.quick-add-zone {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e5e7eb;
}

.btn-add-outlined {
  width: 100%;
  padding: 10px;
  border: 2px dashed #d1d5db;
  background: transparent;
  color: #6b7280;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}

.btn-add-outlined:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}
</style>
