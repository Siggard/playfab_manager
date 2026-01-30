<template>
  <div
    class="entity-card"
    :class="cardClasses"
    :style="{ borderLeftColor: typeColor }"
    :data-item-id="entity.ItemId"
    @dblclick="$emit('edit', entity)"
  >
    <!-- Validation badge -->
    <div v-if="hasEntityErrors" class="validation-badge error" :title="errorTooltip">!</div>
    <div v-else-if="hasEntityWarnings" class="validation-badge warning" :title="warningTooltip">?</div>

    <div class="card-content">
      <div class="entity-header">
        <span class="icon">{{ typeIcon }}</span>
        <span class="name" :title="entity.DisplayName">{{ entity.DisplayName || 'Unnamed' }}</span>
      </div>
      <div class="entity-id">{{ entity.ItemId }}</div>
      <!-- Feature tactic description -->
      <div v-if="entity.ItemClass === 'feature_tactic' && entity.Description" class="feature-description">
        {{ entity.Description }}
      </div>
      <div class="entity-stats" v-if="hasStats">
        <span v-if="displayInfo.power" class="stat">
          <span class="stat-icon">⚡</span>{{ displayInfo.power }}<span v-if="displayInfo.powerLimit">/{{ displayInfo.powerLimit }}</span>
        </span>
        <span v-if="displayInfo.level" class="stat">
          <span class="stat-icon">Lv</span>{{ displayInfo.level }}<span v-if="displayInfo.maxLevel">/{{ displayInfo.maxLevel }}</span>
        </span>
        <span v-if="displayInfo.balance" class="stat">
          <span class="stat-icon">💰</span>{{ displayInfo.balance }}
        </span>
        <span v-if="displayInfo.salary" class="stat">
          <span class="stat-icon">$</span>{{ displayInfo.salary }}
        </span>
        <span v-if="displayInfo.position" class="stat position">
          {{ displayInfo.position }}
        </span>
      </div>
      <!-- Player tags -->
      <div class="player-tags" v-if="displayInfo.playerTags">
        <span
          v-for="tag in displayInfo.playerTags"
          :key="tag"
          class="player-tag"
        >{{ formatStyle(tag) }}</span>
      </div>
      <!-- Staff marks -->
      <div class="staff-marks" v-if="displayInfo.activeMarks || displayInfo.hasTactics">
        <span v-if="displayInfo.activeMarks" class="mark">{{ displayInfo.activeMarks }}</span>
        <span v-if="displayInfo.hasTactics" class="tactics-badge" title="Has linked tactics">📋</span>
      </div>
      <!-- Location info -->
      <div class="location-info" v-if="displayInfo.directions">
        <span class="upgradeable-icon" :class="{ active: displayInfo.upgradeable }" :title="displayInfo.upgradeable ? 'Upgradeable' : 'Not upgradeable'">
          {{ displayInfo.upgradeable ? '↑' : '−' }}
        </span>
        <span v-if="displayInfo.actionDuration" class="duration-tag" :title="displayInfo.actionDuration + ' week(s)'">
          🕐{{ displayInfo.actionDuration }}w
        </span>
        <span
          v-for="dir in displayInfo.directions"
          :key="dir"
          class="direction-tag"
        >{{ dir }}</span>
      </div>
      <!-- Location requirements -->
      <div class="location-requirements" v-if="displayInfo.requirementsDisplay || displayInfo.bonusMarksDisplay">
        <span v-if="displayInfo.requirementsDisplay" class="req-text">{{ displayInfo.requirementsDisplay }}</span>
        <span v-if="displayInfo.bonusMarksDisplay" class="bonus-text">{{ displayInfo.bonusMarksDisplay }}</span>
      </div>
      <!-- Tactic styles -->
      <div class="tactic-styles" v-if="displayInfo.tacticStyles">
        <span
          v-for="style in displayInfo.tacticStyles"
          :key="style"
          class="tactic-style-tag"
        >{{ formatStyle(style) }}</span>
      </div>
      <!-- Tactic slots -->
      <div class="tactic-slots" v-if="displayInfo.slots">
        <span
          v-for="(slot, idx) in displayInfo.slots"
          :key="idx"
          class="slot"
          :class="{ empty: !slot.pos, 'has-feature': slot.hasFeature }"
        >{{ slot.pos || '-' }}</span>
      </div>
      <div class="entity-tags" v-if="entity.Tags?.length">
        <span v-for="tag in entity.Tags.slice(0, 2)" :key="tag" class="tag">
          {{ tag }}
        </span>
        <span v-if="entity.Tags.length > 2" class="tag more">
          +{{ entity.Tags.length - 2 }}
        </span>
      </div>
    </div>
    <div v-if="imageUrl" class="entity-thumbnail">
      <img :src="imageUrl" :alt="entity.DisplayName" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { getTypeIcon, getTypeColor, getEntityDisplayInfo } from '../utils/entityHelpers'
import { useImageManager } from '../composables/useImageManager'
import { useValidation } from '../composables/useValidation'

const props = defineProps({
  entity: {
    type: Object,
    required: true
  }
})

defineEmits(['edit'])

const { getImagePreview, generateImagePath } = useImageManager()
const { hasErrors, hasWarnings, getIssues } = useValidation()

const imageUrl = ref(null)

const typeIcon = computed(() => getTypeIcon(props.entity.ItemClass))
const typeColor = computed(() => getTypeColor(props.entity.ItemClass))
const displayInfo = computed(() => getEntityDisplayInfo(props.entity))

function formatStyle(style) {
  // Convert snake_case to readable format
  return style.replace(/_/g, ' ')
}
const hasStats = computed(() => {
  const info = displayInfo.value
  return info.power || info.level || info.balance || info.position || info.salary || info.slots
})

const hasEntityErrors = computed(() => hasErrors(props.entity))
const hasEntityWarnings = computed(() => hasWarnings(props.entity))

const entityIssues = computed(() => getIssues(props.entity))
const errorTooltip = computed(() => {
  const errors = entityIssues.value.filter(i => i.severity === 'error')
  return errors.map(e => e.message).join('\n')
})
const warningTooltip = computed(() => {
  const warnings = entityIssues.value.filter(i => i.severity === 'warning')
  return warnings.map(w => w.message).join('\n')
})

const cardClasses = computed(() => [
  `type-${props.entity.ItemClass}`,
  {
    'has-image': imageUrl.value,
    'has-errors': hasEntityErrors.value,
    'has-warnings': hasEntityWarnings.value && !hasEntityErrors.value
  }
])

// Get image path from CustomData or generate default
function getImagePath() {
  if (props.entity.CustomData) {
    try {
      const data = JSON.parse(props.entity.CustomData)
      if (data.imagePath) return data.imagePath
    } catch {}
  }
  // Try default path pattern
  return generateImagePath(props.entity.ItemClass, props.entity.ItemId)
}

// Load image preview
async function loadImage() {
  // Cleanup previous URL
  if (imageUrl.value && imageUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(imageUrl.value)
  }

  const path = getImagePath()
  imageUrl.value = await getImagePreview(path)
}

onMounted(() => {
  loadImage()
})

// Watch for entity changes
watch(() => props.entity.ItemId, () => {
  loadImage()
})

// Cleanup on unmount
onUnmounted(() => {
  if (imageUrl.value && imageUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(imageUrl.value)
  }
})
</script>

<style scoped>
.entity-card {
  background: #fff;
  border-radius: 6px;
  padding: 8px 10px;
  border-left: 4px solid #ccc;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  cursor: grab;
  transition: all 0.15s ease;
  font-size: 13px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.entity-card.has-image {
  padding-right: 6px;
}

.entity-card:hover {
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  transform: translateY(-1px);
}

.entity-card:active {
  cursor: grabbing;
}

.card-content {
  flex: 1;
  min-width: 0;
}

.entity-thumbnail {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background: #f3f4f6;
}

.entity-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.entity-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.icon {
  font-size: 14px;
}

.name {
  font-weight: 600;
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.entity-id {
  font-size: 11px;
  color: #6b7280;
  font-family: monospace;
  margin-bottom: 4px;
}

.feature-description {
  font-size: 11px;
  color: #64748b;
  line-height: 1.3;
  margin-bottom: 4px;
}

.entity-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
}

.stat {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 11px;
  color: #374151;
  background: #f3f4f6;
  padding: 2px 5px;
  border-radius: 4px;
}

.stat-icon {
  font-size: 10px;
}

.stat.position {
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 600;
}

/* Tactic slots */
.tactic-slots {
  display: flex;
  gap: 3px;
  margin-bottom: 4px;
}

.slot {
  font-size: 9px;
  padding: 2px 4px;
  background: #dbeafe;
  color: #1d4ed8;
  border-radius: 3px;
  font-weight: 500;
  min-width: 14px;
  text-align: center;
}

.slot.empty {
  background: #f3f4f6;
  color: #9ca3af;
}

.slot.has-feature {
  background: #c7d2fe;
  border: 1px solid #6366f1;
  color: #4338ca;
}

/* Tactic styles */
.tactic-styles {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}

.tactic-style-tag {
  font-size: 9px;
  padding: 2px 5px;
  background: #fef3c7;
  color: #92400e;
  border-radius: 3px;
  font-weight: 500;
  text-transform: capitalize;
}

/* Player tags (same style as tactic styles) */
.player-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}

.player-tag {
  font-size: 9px;
  padding: 2px 5px;
  background: #fef3c7;
  color: #92400e;
  border-radius: 3px;
  font-weight: 500;
  text-transform: capitalize;
}

/* Staff marks */
.staff-marks {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.staff-marks .mark {
  font-size: 10px;
  padding: 2px 6px;
  background: #d1fae5;
  color: #065f46;
  border-radius: 3px;
  font-weight: 500;
}

.staff-marks .tactics-badge {
  font-size: 12px;
  cursor: help;
}

/* Location info */
.location-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 4px;
}

.upgradeable-icon {
  font-size: 10px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e5e7eb;
  color: #9ca3af;
  border-radius: 3px;
  font-weight: bold;
}

.upgradeable-icon.active {
  background: #fef3c7;
  color: #d97706;
}

.duration-tag {
  font-size: 10px;
  padding: 2px 5px;
  background: #e0e7ff;
  color: #4338ca;
  border-radius: 3px;
  font-weight: 500;
}

.direction-tag {
  font-size: 10px;
  padding: 2px 6px;
  background: #fed7aa;
  color: #c2410c;
  border-radius: 3px;
  font-weight: 500;
}

/* Location requirements */
.location-requirements {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 10px;
  font-family: monospace;
}

.req-text {
  color: #6b7280;
}

.bonus-text {
  color: #059669;
  font-weight: 500;
}

.entity-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tag {
  font-size: 10px;
  background: #e5e7eb;
  color: #4b5563;
  padding: 1px 5px;
  border-radius: 3px;
}

.tag.more {
  background: #d1d5db;
}

/* Ghost style during drag */
.sortable-ghost {
  opacity: 0.4;
  background: #f0f9ff;
}

.sortable-chosen {
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

/* Validation styles */
.entity-card {
  position: relative;
}

.entity-card.has-errors {
  border-color: #ef4444 !important;
  background-color: #fef2f2;
}

.entity-card.has-warnings {
  border-color: #f59e0b !important;
  background-color: #fffbeb;
}

.validation-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 11px;
  font-weight: bold;
  z-index: 10;
}

.validation-badge.error {
  background: #ef4444;
  color: white;
}

.validation-badge.warning {
  background: #f59e0b;
  color: white;
}

/* Highlight flash animation */
.entity-card.highlight-flash {
  animation: highlight-flash 2s ease-out;
}

@keyframes highlight-flash {
  0% {
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5);
  }
  100% {
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
}
</style>
