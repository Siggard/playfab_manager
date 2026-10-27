<template>
  <div class="bundle-item-group" :class="{ collapsed: isCollapsed }">
    <div class="group-header" :class="groupStatus" @click="isCollapsed = !isCollapsed">
      <span class="toggle-icon">{{ isCollapsed ? '>' : 'v' }}</span>
      <span class="type-icon">{{ typeIcon }}</span>
      <h4>{{ typeLabel }} ({{ totalCount }}{{ recommendationLabel }})</h4>
      <span v-if="totalPower > 0" class="group-stats">
        Power: {{ totalPower }}
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
        <p>No {{ typeLabelInline }} yet</p>
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
        :class="{ 'drag-over': dragOver, 'type-location': type === 'location', 'type-tactic': type === 'tactic', 'type-connection': type === 'personal_connection' }"
      >
        <!-- Regular items; a Dossier that came with a staff pack sits inside the pack's frame -->
        <div
          v-for="item in items"
          :key="item.ItemId"
          class="item-wrapper"
          :class="{ 'pack-frame': packs[item.ItemId] }"
          @dblclick="$emit('edit-item', item)"
        >
          <div
            v-if="packs[item.ItemId]"
            class="pack-head"
            title="Пак персонала, с которым пришла связь — открыть"
            @click.stop="$emit('edit-item', packs[item.ItemId])"
            @dblclick.stop="$emit('edit-item', packs[item.ItemId])"
          >
            <span class="pack-title">🧳 {{ packs[item.ItemId].DisplayName || packs[item.ItemId].ItemId }}</span>
            <span class="pack-id">{{ packs[item.ItemId].ItemId }}</span>
          </div>
          <EntityCard :entity="item" />
          <div v-if="packs[item.ItemId]" class="pack-foot">
            <span v-for="(line, i) in packLines(packs[item.ItemId], item)" :key="i" class="pack-line">{{ line }}</span>
          </div>
          <button
            @click.stop="$emit('remove-item', item.ItemId)"
            class="btn-remove-overlay"
            :title="packs[item.ItemId] ? 'Убрать пак у клуба' : 'Remove from bundle'"
          >
            x
          </button>
        </div>
      </div>

      <!-- Quick add zone -->
      <div v-if="hasAnyItems" class="quick-add-zone">
        <button @click="$emit('quick-add', type)" class="btn-add-outlined">
          + Add another {{ typeLabelInline }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import EntityCard from './EntityCard.vue'
import { parseCustomData } from '../utils/entityHelpers'
import { STAFF_TYPE_LABELS } from '../utils/hiring'

const props = defineProps({
  type: String,
  items: Array,
  recommendations: Object,
  bundleId: String,
  // personal connections of a club: { dossierId: staff_pack entity } for Dossiers
  // that came with a starting pack
  packs: { type: Object, default: () => ({}) }
})

function staffWords(staff) {
  return Object.entries(staff || {})
    .filter(([, n]) => Number(n) > 0)
    .map(([role, n]) => `${(STAFF_TYPE_LABELS[role] || role).toLowerCase()} ${n}`)
    .join(', ')
}

// What the pack brought and what happens when its Dossier leaves
function packLines(pack, dossier) {
  const p = parseCustomData(pack?.CustomData) || {}
  const d = parseCustomData(dossier?.CustomData) || {}
  const lines = []
  const brought = staffWords(p.staff)
  lines.push(brought ? `принёс фишки: ${brought}` : 'без фишек — чистое Досье')
  if (d.contract_weeks) lines.push(`контракт ${d.contract_weeks} нед.`)
  const leave = []
  if (d.on_leave?.reputation) leave.push(`репутация ${d.on_leave.reputation > 0 ? '+' : ''}${d.on_leave.reputation}`)
  const leaveStaff = staffWords(d.on_leave?.staff)
  if (leaveStaff) leave.push(`уходят фишки: ${leaveStaff}`)
  if (leave.length) lines.push(`при уходе: ${leave.join('; ')}`)
  return lines
}

const emit = defineEmits(['remove-item', 'add-item', 'quick-add', 'edit-item'])

const isCollapsed = ref(props.type === 'team')
const dragOver = ref(false)

const typeLabels = {
  player: 'Players',
  team: 'Team',
  tactic: 'Tactics',
  personal_connection: 'Личные связи',
  location: 'Locations',
  feature: 'Features'
}

const typeIcons = {
  player: '[P]',
  team: '[T]',
  tactic: '[X]',
  personal_connection: '[C]',
  location: '[L]',
  feature: '[F]'
}

const typeLabel = computed(() => typeLabels[props.type] || props.type)
// Only English labels read well lowercased inside a sentence
const typeLabelInline = computed(() =>
  /^[ -~]+$/.test(typeLabel.value) ? typeLabel.value.toLowerCase() : typeLabel.value
)
const typeIcon = computed(() => typeIcons[props.type] || '[?]')

const totalCount = computed(() => props.items.length)
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

function getItemPower(item) {
  try {
    const data = JSON.parse(item.CustomData || '{}')
    return parseInt(data.power) || 0
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

  // Only accept items of matching type; personal connections also take a
  // staff pack or its Dossier (the focus view routes them into staff_packs)
  const connectionDrop = props.type === 'personal_connection' &&
    (itemClass === 'staff_pack' || itemClass === 'dossier')
  if (itemClass === props.type || connectionDrop) {
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

.items-grid.type-location,
.items-grid.type-tactic,
.items-grid.type-connection {
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.item-wrapper {
  position: relative;
}

/* A Dossier framed by the staff pack it came with */
.item-wrapper.pack-frame {
  border: 1px solid #7dd3fc;
  border-radius: 8px;
  background: #f0f9ff;
  padding: 0 6px 6px;
}

.pack-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 5px 2px 6px;
  cursor: pointer;
  color: #0c4a6e;
  font-size: 12px;
  font-weight: 600;
}

.pack-head:hover .pack-title {
  text-decoration: underline;
}

.pack-id {
  font-family: monospace;
  font-weight: normal;
  font-size: 11px;
  color: #64748b;
}

.pack-foot {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 2px 0;
  font-size: 11px;
  color: #475569;
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
