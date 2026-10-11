<template>
  <div class="bundle-panel layout-deck" :class="{ 'has-errors': issues.length > 0 }">
    <div
      class="bundle-header"
      :style="{ borderTopColor: typeColor }"
      @dblclick="$emit('edit', deck)"
      title="Двойной клик — открыть колоду"
    >
      <div class="bundle-title">
        <span class="bundle-icon">{{ typeIcon }}</span>
        <span class="bundle-name" :title="deck.DisplayName">{{ deck.DisplayName || deck.ItemId }}</span>
        <span class="deck-count">{{ items.length }} паков</span>
        <span class="deck-copies" :title="'Сколько копий окажется в колоде сессии'">
          копий: {{ copiesFor(1) }} / {{ copiesFor(2) }} / {{ copiesFor(4) }}
          <span class="deck-copies-hint">(1 / 2 / 4 игрока)</span>
        </span>
      </div>
      <div class="bundle-id">{{ deck.ItemId }}</div>
      <div class="bundle-description">{{ deck.Description || 'Копии паков задаются количеством у каждого пака' }}</div>
    </div>

    <div class="bundle-content">
      <draggable
        v-model="items"
        group="entities"
        item-key="ItemId"
        :animation="150"
        ghost-class="ghost"
        chosen-class="chosen"
        class="draggable-area"
      >
        <template #item="{ element, index }">
          <div class="pack-slot">
            <EntityCard :entity="element" @edit="$emit('edit', element)" />
            <div class="pack-count" @mousedown.stop>
              <select
                :value="countMode(entryCount(index))"
                @change="setMode(index, $event.target.value)"
                title="Сколько копий пака в колоде"
              >
                <option v-for="m in DECK_COUNT_MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
              <input
                v-if="countMode(entryCount(index)) === 'number'"
                type="number"
                min="1"
                :value="entryCount(index)"
                @change="setCount(index, Math.max(1, parseInt($event.target.value, 10) || 1))"
              />
            </div>
            <div v-if="isUnique(element)" class="pack-unique" :class="{ bad: entryCount(index) !== 1 }">
              ★ уникальное Досье{{ entryCount(index) !== 1 ? ' — только 1 копия' : '' }}
            </div>
          </div>
        </template>
      </draggable>

      <div v-if="items.length === 0" class="empty-drop">
        Перетащите сюда паки персонала
      </div>
      <div v-if="rejected" class="drop-note">{{ rejected }}</div>
    </div>

    <ul v-if="issues.length > 0" class="deck-issues">
      <li v-for="(issue, i) in issues" :key="i" :class="issue.severity">{{ issue.message }}</li>
    </ul>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import draggable from 'vuedraggable'
import EntityCard from './EntityCard.vue'
import { usePlayFabData } from '../composables/usePlayFabData'
import { getTypeIcon, getTypeColor } from '../utils/entityHelpers'
import {
  DECK_COUNT_MODES,
  getDeckEntries,
  withDeckEntries,
  deckCopies,
  hiringIssuesForEntity
} from '../utils/hiring'

const props = defineProps({
  deck: { type: Object, required: true }
})

defineEmits(['edit'])

const { state, updateEntity } = usePlayFabData()

const typeIcon = computed(() => getTypeIcon(props.deck.ItemClass))
const typeColor = computed(() => getTypeColor(props.deck.ItemClass))

const entries = computed(() => getDeckEntries(props.deck))
const rejected = ref('')

function entityById(id) {
  return state.entities.find(e => e.ItemId === id)
}

// Entries whose pack is missing still exist in the data; they're reported in issues
// and kept on reorder, but have no card to drag.
const items = computed({
  get: () => entries.value.map(e => entityById(e?.pack)).filter(Boolean),
  set: (next) => {
    rejected.value = ''
    const byPack = new Map(entries.value.map(e => [e?.pack, e]))
    const kept = []
    const skipped = []
    for (const entity of next) {
      if (entity.ItemClass !== 'staff_pack') {
        skipped.push(entity.DisplayName || entity.ItemId)
        continue
      }
      if (kept.some(e => e.pack === entity.ItemId)) continue
      kept.push(byPack.get(entity.ItemId) || { pack: entity.ItemId, count: 1 })
    }
    // Entries pointing at unknown packs aren't draggable — keep them at the end
    const orphans = entries.value.filter(e => !entityById(e?.pack))
    if (skipped.length > 0) rejected.value = `В колоду паков можно класть только паки персонала (не подошло: ${skipped.join(', ')})`
    write([...kept, ...orphans])
  }
})

function write(nextEntries) {
  updateEntity(props.deck.ItemId, { CustomData: withDeckEntries(props.deck, nextEntries) })
}

function entryFor(index) {
  const id = items.value[index]?.ItemId
  return entries.value.find(e => e?.pack === id)
}

function entryCount(index) {
  return entryFor(index)?.count
}

function setCount(index, count) {
  const target = entryFor(index)
  write(entries.value.map(e => (e === target ? { ...e, count } : e)))
}

function setMode(index, mode) {
  setCount(index, mode === 'number' ? 1 : mode)
}

function countMode(count) {
  return count === 'players' || count === 'players-1' ? count : 'number'
}

function parse(entity) {
  try {
    return JSON.parse(entity?.CustomData || '{}') || {}
  } catch {
    return {}
  }
}

function isUnique(pack) {
  return parse(entityById(parse(pack).dossier)).rarity === 'unique'
}

function copiesFor(players) {
  return entries.value.reduce((sum, e) => sum + deckCopies(e?.count, players), 0)
}

const issues = computed(() => hiringIssuesForEntity(props.deck, state.entities))
</script>

<style scoped>
.bundle-panel {
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  min-width: 0;
  grid-column: 1 / -1;
  height: fit-content;
}

.bundle-panel.has-errors {
  box-shadow: 0 0 0 1px #fca5a5;
}

.bundle-header {
  padding: 8px 12px;
  border-top: 4px solid #e5e7eb;
  border-radius: 8px 8px 0 0;
  background: #f8fafc;
  cursor: pointer;
}

.bundle-header:hover {
  background: #f1f5f9;
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

.deck-count,
.deck-copies {
  font-size: 12px;
  color: #64748b;
  background: #e2e8f0;
  padding: 2px 8px;
  border-radius: 10px;
  margin-left: 8px;
  white-space: nowrap;
}

.deck-copies-hint {
  color: #94a3b8;
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
}

.bundle-content {
  padding: 8px 10px;
  overflow-x: auto;
}

.draggable-area {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 70px;
}

.pack-slot {
  min-width: 180px;
  max-width: 220px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pack-count {
  display: flex;
  gap: 4px;
}

.pack-count select,
.pack-count input {
  padding: 3px 6px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 12px;
  background: white;
}

.pack-count select {
  flex: 1;
  min-width: 0;
}

.pack-count input {
  width: 52px;
}

.pack-unique {
  font-size: 11px;
  color: #a16207;
}

.pack-unique.bad {
  color: #dc2626;
  font-weight: 600;
}

.empty-drop {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 180px;
  height: 60px;
  border: 2px dashed #d1d5db;
  border-radius: 6px;
  color: #9ca3af;
  font-size: 13px;
}

.drop-note {
  margin-top: 6px;
  font-size: 12px;
  color: #b45309;
}

.deck-issues {
  margin: 0;
  padding: 6px 12px 8px 28px;
  font-size: 12px;
  border-top: 1px solid #fee2e2;
}

.deck-issues .error {
  color: #dc2626;
}

.deck-issues .warning {
  color: #b45309;
}

.ghost {
  opacity: 0.5;
}
</style>
