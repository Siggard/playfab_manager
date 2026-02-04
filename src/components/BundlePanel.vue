<template>
  <div class="bundle-panel" :class="panelClasses">
    <div
      class="bundle-header"
      :style="{ borderTopColor: typeColor }"
      @dblclick="$emit('edit-bundle', bundle)"
      title="Double-click to edit bundle"
    >
      <div class="bundle-title">
        <span class="bundle-icon">{{ typeIcon }}</span>
        <span class="bundle-name" :title="bundle.DisplayName">
          {{ bundle.DisplayName || 'Unnamed Bundle' }}
        </span>
        <span v-if="isDeck" class="deck-count">{{ stats.itemCount }} cards</span>
        <button class="focus-btn" @click.stop="$emit('focus', bundle)" title="Open full view">
          ↗
        </button>
      </div>
      <div class="bundle-id">{{ bundle.ItemId }}</div>
      <div class="bundle-description">{{ bundle.Description || '' }}</div>
    </div>

    <div v-if="isClub" class="bundle-stats">
      <div class="stat-item" data-tooltip="Total Power">
        <span class="stat-label">⚡</span>
        <span class="stat-value">{{ stats.totalPower }}</span>
      </div>
      <div class="stat-item" v-if="stats.totalBalance > 0" data-tooltip="Total Balance">
        <span class="stat-label">💰</span>
        <span class="stat-value">{{ stats.totalBalance }}</span>
      </div>
      <div class="stat-item" data-tooltip="Items Count">
        <span class="stat-label">📦</span>
        <span class="stat-value">{{ stats.itemCount }}</span>
      </div>
    </div>

    <div class="bundle-content">
      <draggable
        v-model="bundleItems"
        group="entities"
        item-key="ItemId"
        :animation="150"
        ghost-class="ghost"
        chosen-class="chosen"
        @change="handleChange"
        @start="isDragOver = false"
        @end="isDragOver = false"
        class="draggable-area"
      >
        <template #item="{ element }">
          <EntityCard
            :entity="element"
            @edit="$emit('edit', element)"
          />
        </template>
      </draggable>

      <div v-if="bundleItems.length === 0" class="empty-drop">
        Drop entities here
      </div>
    </div>

    <div v-if="isClub" class="bundle-footer">
      <div class="type-counts">
        <div v-if="stats.playerCount" class="stat-item" data-tooltip="Players">
          <span class="stat-label">⚽</span>
          <span class="stat-value">{{ stats.playerCount }}</span>
        </div>
        <div v-if="stats.staffCount" class="stat-item" data-tooltip="Staff">
          <span class="stat-label">👔</span>
          <span class="stat-value">{{ stats.staffCount }}</span>
        </div>
        <div v-if="stats.teamCount" class="stat-item" data-tooltip="Teams">
          <span class="stat-label">🏆</span>
          <span class="stat-value">{{ stats.teamCount }}</span>
        </div>
        <div v-if="stats.tacticCount" class="stat-item" data-tooltip="Tactics">
          <span class="stat-label">📋</span>
          <span class="stat-value">{{ stats.tacticCount }}</span>
        </div>
        <div v-if="stats.locationCount" class="stat-item" data-tooltip="Locations">
          <span class="stat-label">🏟️</span>
          <span class="stat-value">{{ stats.locationCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import draggable from 'vuedraggable'
import EntityCard from './EntityCard.vue'
import { usePlayFabData } from '../composables/usePlayFabData'
import { useBundleStats } from '../composables/useBundleStats'
import { getTypeIcon, getTypeColor } from '../utils/entityHelpers'

const props = defineProps({
  bundle: {
    type: Object,
    required: true
  }
})

defineEmits(['edit', 'edit-bundle', 'focus'])

const { getBundleEntities, addEntityToBundle, removeEntityFromBundle } = usePlayFabData()
const { getBundleStats } = useBundleStats()

const isDragOver = ref(false)

const typeIcon = computed(() => getTypeIcon(props.bundle.ItemClass))
const typeColor = computed(() => getTypeColor(props.bundle.ItemClass))

const isClub = computed(() => props.bundle.ItemClass === 'club')
const isDeck = computed(() => props.bundle.ItemClass.endsWith('_deck'))

const panelClasses = computed(() => ({
  'drag-over': isDragOver.value,
  'layout-club': isClub.value,
  'layout-deck': isDeck.value
}))

const stats = computed(() => getBundleStats(props.bundle.ItemId))

// Two-way binding for draggable
const bundleItems = computed({
  get: () => getBundleEntities(props.bundle.ItemId),
  set: (newItems) => {
    // Update bundle's BundledItems array
    props.bundle.Bundle.BundledItems = newItems.map(item => item.ItemId)
  }
})

function handleChange(evt) {
  if (evt.added) {
    // Entity dropped into this bundle
    const entityId = evt.added.element.ItemId
    console.log(`Added ${entityId} to ${props.bundle.ItemId}`)
  }
  if (evt.removed) {
    // Entity removed from this bundle
    const entityId = evt.removed.element.ItemId
    console.log(`Removed ${entityId} from ${props.bundle.ItemId}`)
  }
}
</script>

<style scoped>
.bundle-panel {
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  min-width: 0;
  transition: box-shadow 0.15s;
}

.bundle-panel.drag-over {
  box-shadow: 0 0 0 2px #3b82f6;
}

/* Deck layout - full width, horizontal cards */
.bundle-panel.layout-deck {
  grid-column: 1 / -1;
  height: fit-content;
}

.bundle-panel.layout-deck .bundle-content {
  max-height: none;
  overflow-x: auto;
  overflow-y: visible;
  padding: 8px 10px;
}

.bundle-panel.layout-deck .draggable-area {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 70px;
}

.bundle-panel.layout-deck .draggable-area > * {
  min-width: 180px;
  max-width: 220px;
  flex-shrink: 0;
}

.bundle-panel.layout-deck .bundle-header {
  padding: 8px 12px;
}

.bundle-panel.layout-deck .bundle-description {
  height: auto;
  -webkit-line-clamp: 1;
}

.bundle-panel.layout-deck .empty-drop {
  min-width: 180px;
  height: 60px;
}

.bundle-header {
  padding: 10px 12px;
  border-top: 4px solid #e5e7eb;
  border-radius: 8px 8px 0 0;
  background: #f8fafc;
  cursor: pointer;
  transition: background 0.15s;
}

.bundle-header:hover {
  background: #f1f5f9;
}

.focus-btn {
  background: #e0f2fe;
  border: 1px solid #7dd3fc;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  color: #0284c7;
  margin-left: auto;
  transition: all 0.15s;
}

.focus-btn:hover {
  background: #0ea5e9;
  border-color: #0ea5e9;
  color: #fff;
}

.bundle-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bundle-icon {
  font-size: 16px;
}

.bundle-name {
  font-weight: 600;
  font-size: 14px;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.deck-count {
  font-size: 12px;
  color: #64748b;
  background: #e2e8f0;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 8px;
}

.bundle-id {
  font-size: 11px;
  color: #64748b;
  font-family: monospace;
  margin-top: 2px;
}

.bundle-description {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 4px;
  line-height: 1.3;
  height: 43px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.bundle-stats {
  display: flex;
  gap: 10px;
  padding: 6px 12px;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
  font-size: 12px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-label {
  color: #64748b;
}

.stat-value {
  font-weight: 600;
  color: #1e293b;
}

.bundle-content {
  flex: 1;
  padding: 10px;
  overflow-y: auto;
  max-height: 400px;
}

.draggable-area {
  min-height: 100px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 6px;
  align-content: start;
}

.empty-drop {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80px;
  border: 2px dashed #d1d5db;
  border-radius: 6px;
  color: #9ca3af;
  font-size: 13px;
}

.bundle-footer {
  padding: 6px 12px;
  background: #f1f5f9;
  border-top: 1px solid #e2e8f0;
  border-radius: 0 0 8px 8px;
}

.type-counts {
  display: flex;
  gap: 10px;
  font-size: 12px;
}

/* Tooltip styles */
[data-tooltip] {
  position: relative;
  cursor: default;
}

[data-tooltip]:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #1e293b;
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  z-index: 100;
  margin-bottom: 4px;
}

[data-tooltip]:hover::before {
  content: '';
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: #1e293b;
  z-index: 100;
}

.ghost {
  opacity: 0.5;
  background: #dbeafe;
}

.chosen {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
</style>
