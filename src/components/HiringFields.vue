<template>
  <div class="form-group hiring-fields">
    <label>
      {{ title }}
      <span class="hf-hint">поля меняют Custom Data ниже</span>
    </label>

    <div v-if="!data" class="hf-warn">
      Custom Data — невалидный JSON. Исправьте его ниже, и поля появятся снова.
    </div>

    <!-- Staff pack -->
    <div v-else-if="itemClass === 'staff_pack'" class="hf-grid">
      <span class="hf-label">Досье</span>
      <div class="hf-inline">
        <select :value="data.dossier || ''" @change="set(['dossier'], $event.target.value)">
          <option value="">— выберите Досье —</option>
          <option
            v-if="data.dossier && !dossiers.some(d => d.ItemId === data.dossier)"
            :value="data.dossier"
          >
            {{ data.dossier }} (не найдено)
          </option>
          <option v-for="d in dossiers" :key="d.ItemId" :value="d.ItemId">
            {{ d.DisplayName || d.ItemId }} — {{ d.ItemId }}{{ rarityTag(d) }}
          </option>
        </select>
        <button
          v-if="dossierEntity"
          type="button"
          class="hf-btn"
          title="Взять фишки из on_leave.staff этого Досье"
          @click="copyStaffFromDossier"
        >
          Фишки как у Досье
        </button>
      </div>

      <span class="hf-label">Фишки персонала</span>
      <div class="hf-staff">
        <label v-for="type in STAFF_TYPES" :key="type" class="hf-staff-item">
          <span>{{ STAFF_TYPE_LABELS[type] }}</span>
          <input
            type="number"
            min="0"
            :value="data.staff?.[type] || 0"
            @change="setStaff(['staff'], type, $event.target.value)"
          />
        </label>
        <span v-if="staffTotal(data.staff) === 0" class="hf-note">нет фишек — «чистое Досье»</span>
      </div>

      <span class="hf-label">Порог репутации</span>
      <div class="hf-inline">
        <label class="hf-check">
          <input
            type="checkbox"
            :checked="hasThreshold"
            @change="toggleThreshold($event.target.checked)"
          />
          есть порог
        </label>
        <input
          v-if="hasThreshold"
          type="number"
          class="hf-num"
          :value="data.reputation_min"
          @change="set(['reputation_min'], toInt($event.target.value))"
        />
        <span class="hf-note">{{ hasThreshold ? 'репутация клуба не ниже этого числа' : 'нанять можно при любой репутации' }}</span>
      </div>

      <span class="hf-label">Подъёмные</span>
      <input
        type="number"
        class="hf-num"
        :value="data.signing_fee ?? 0"
        @change="set(['signing_fee'], toInt($event.target.value))"
      />
    </div>

    <!-- Dossier -->
    <div v-else-if="itemClass === 'dossier'" class="hf-grid">
      <span class="hf-label">Тип</span>
      <select :value="data.kind" @change="set(['kind'], $event.target.value)">
        <option v-for="k in DOSSIER_KINDS" :key="k.value" :value="k.value">{{ k.label }} ({{ k.value }})</option>
      </select>

      <span class="hf-label">Редкость</span>
      <select :value="data.rarity" @change="set(['rarity'], $event.target.value)">
        <option v-for="r in DOSSIER_RARITIES" :key="r.value" :value="r.value">{{ r.label }} ({{ r.value }})</option>
      </select>

      <span class="hf-label">Контракт, недель</span>
      <input type="number" min="1" class="hf-num" :value="data.contract_weeks" @change="set(['contract_weeks'], toInt($event.target.value))" />

      <span class="hf-label">Доплаты ФОТ</span>
      <input type="number" class="hf-num" :value="data.payroll" @change="set(['payroll'], toInt($event.target.value))" />

      <span class="hf-label">Приход: репутация</span>
      <input type="number" class="hf-num" :value="data.on_join?.reputation ?? 0" @change="set(['on_join', 'reputation'], toInt($event.target.value))" />

      <span class="hf-label">Уход: репутация</span>
      <input type="number" class="hf-num" :value="data.on_leave?.reputation ?? 0" @change="set(['on_leave', 'reputation'], toInt($event.target.value))" />

      <span class="hf-label">Уход: фишки</span>
      <div class="hf-staff">
        <label v-for="type in STAFF_TYPES" :key="type" class="hf-staff-item">
          <span>{{ STAFF_TYPE_LABELS[type] }}</span>
          <input
            type="number"
            min="0"
            :value="data.on_leave?.staff?.[type] || 0"
            @change="setStaff(['on_leave', 'staff'], type, $event.target.value)"
          />
        </label>
      </div>

      <span class="hf-label">Способность</span>
      <div class="hf-effect">
        <select :value="data.effect?.type || ''" @change="setEffectType($event.target.value)">
          <option value="">— нет —</option>
          <option
            v-if="data.effect?.type && !DOSSIER_EFFECTS[data.effect.type]"
            :value="data.effect.type"
          >
            {{ data.effect.type }} (неизвестный)
          </option>
          <option v-for="(e, type) in DOSSIER_EFFECTS" :key="type" :value="type">
            {{ e.label }} ({{ type }})
          </option>
        </select>
        <label v-for="(value, key) in (data.effect?.params || {})" :key="key" class="hf-param">
          <span>{{ key }}</span>
          <input
            v-if="typeof value === 'number'"
            type="number"
            class="hf-num"
            :value="value"
            @change="set(['effect', 'params', key], toInt($event.target.value))"
          />
          <code v-else>{{ JSON.stringify(value) }}</code>
        </label>
      </div>

      <template v-if="packsUsingThis.length > 0">
        <span class="hf-label">В паках</span>
        <div class="hf-note">
          <span v-for="p in packsUsingThis" :key="p.ItemId" class="hf-chip">{{ p.DisplayName || p.ItemId }} ({{ p.ItemId }})</span>
        </div>
      </template>
    </div>

    <!-- Staff pack deck -->
    <div v-else-if="itemClass === 'staff_pack_deck'" class="hf-deck">
      <div v-if="!Array.isArray(data.packs) || data.packs.length === 0" class="hf-note">
        Колода пустая — добавьте паки.
      </div>
      <div v-for="(entry, i) in (Array.isArray(data.packs) ? data.packs : [])" :key="i" class="hf-deck-row">
        <select :value="entry.pack || ''" @change="setDeck(i, 'pack', $event.target.value)">
          <option value="">— пак —</option>
          <option
            v-if="entry.pack && !packs.some(p => p.ItemId === entry.pack)"
            :value="entry.pack"
          >
            {{ entry.pack }} (не найден)
          </option>
          <option v-for="p in packs" :key="p.ItemId" :value="p.ItemId">
            {{ p.DisplayName || p.ItemId }} — {{ p.ItemId }}{{ packRarityTag(p) }}
          </option>
        </select>
        <select class="hf-mode" :value="countMode(entry.count)" @change="setDeckMode(i, $event.target.value)">
          <option v-for="m in DECK_COUNT_MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
        <input
          v-if="countMode(entry.count) === 'number'"
          type="number"
          min="1"
          class="hf-num"
          :value="entry.count"
          @change="setDeck(i, 'count', Math.max(1, toInt($event.target.value)))"
        />
        <span v-else class="hf-num-placeholder"></span>
        <button type="button" class="hf-btn hf-remove" title="Убрать из колоды" @click="removeDeckRow(i)">✕</button>
      </div>
      <div class="hf-inline">
        <button type="button" class="hf-btn" @click="addDeckRow">+ Добавить пак</button>
        <span class="hf-note">копии задаются числом, а не повторами</span>
      </div>
    </div>

    <ul v-if="issues.length > 0" class="hf-issues">
      <li v-for="(issue, i) in issues" :key="i" :class="issue.severity">{{ issue.message }}</li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePlayFabData } from '../composables/usePlayFabData'
import {
  STAFF_TYPES,
  STAFF_TYPE_LABELS,
  DOSSIER_KINDS,
  DOSSIER_RARITIES,
  DOSSIER_EFFECTS,
  DECK_COUNT_MODES,
  hiringIssues
} from '../utils/hiring'

const props = defineProps({
  modelValue: String,
  itemClass: String,
  itemId: String
})

const emit = defineEmits(['update:modelValue'])

const { state } = usePlayFabData()

const TITLES = {
  staff_pack: 'Пак персонала',
  dossier: 'Досье',
  staff_pack_deck: 'Колода паков'
}
const title = computed(() => TITLES[props.itemClass] || props.itemClass)

const data = computed(() => {
  const text = (props.modelValue || '').trim()
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
})

const dossiers = computed(() =>
  state.entities.filter(e => e.ItemClass === 'dossier').sort(byId)
)
const packs = computed(() =>
  state.entities.filter(e => e.ItemClass === 'staff_pack').sort(byId)
)

const collator = new Intl.Collator(undefined, { numeric: true })
function byId(a, b) {
  return collator.compare(a.ItemId, b.ItemId)
}

function parseEntity(entity) {
  try {
    return JSON.parse(entity?.CustomData || '{}') || {}
  } catch {
    return {}
  }
}

const dossierEntity = computed(() =>
  dossiers.value.find(d => d.ItemId === data.value?.dossier) || null
)

const packsUsingThis = computed(() =>
  packs.value.filter(p => props.itemId && parseEntity(p).dossier === props.itemId)
)

const issues = computed(() =>
  data.value ? hiringIssues(props.itemClass, data.value, state.entities) : []
)

const hasThreshold = computed(() =>
  data.value?.reputation_min !== undefined && data.value?.reputation_min !== null
)

function rarityTag(dossier) {
  return parseEntity(dossier).rarity === 'unique' ? ' ★ уникальное' : ''
}

function packRarityTag(pack) {
  const dossier = dossiers.value.find(d => d.ItemId === parseEntity(pack).dossier)
  return dossier ? rarityTag(dossier) : ''
}

function staffTotal(staff) {
  return Object.values(staff || {}).reduce((sum, n) => sum + (Number(n) || 0), 0)
}

function toInt(value) {
  const n = parseInt(value, 10)
  return Number.isNaN(n) ? 0 : n
}

// Edit a copy and write it back as formatted JSON; unknown keys survive untouched
function update(mutate) {
  if (!data.value) return
  const next = JSON.parse(JSON.stringify(data.value))
  mutate(next)
  emit('update:modelValue', JSON.stringify(next, null, 2))
}

function set(path, value) {
  update(obj => {
    let target = obj
    for (const key of path.slice(0, -1)) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {}
      target = target[key]
    }
    target[path[path.length - 1]] = value
  })
}

// Zero removes the type, so the JSON lists only the tokens that are there
function setStaff(path, type, value) {
  const n = Math.max(0, toInt(value))
  update(obj => {
    let target = obj
    for (const key of path) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {}
      target = target[key]
    }
    if (n > 0) target[type] = n
    else delete target[type]
  })
}

function toggleThreshold(on) {
  update(obj => {
    if (on) obj.reputation_min = 0
    else delete obj.reputation_min
  })
}

function copyStaffFromDossier() {
  const staff = parseEntity(dossierEntity.value).on_leave?.staff || {}
  update(obj => { obj.staff = { ...staff } })
}

function setEffectType(type) {
  update(obj => {
    if (!type) {
      delete obj.effect
      return
    }
    if (obj.effect?.type === type) return
    const defaults = DOSSIER_EFFECTS[type]?.params || {}
    obj.effect = { type, params: { ...defaults } }
  })
}

function countMode(count) {
  return count === 'players' || count === 'players-1' ? count : 'number'
}

function setDeck(i, key, value) {
  update(obj => { obj.packs[i][key] = value })
}

function setDeckMode(i, mode) {
  setDeck(i, 'count', mode === 'number' ? 1 : mode)
}

function addDeckRow() {
  update(obj => {
    if (!Array.isArray(obj.packs)) obj.packs = []
    obj.packs.push({ pack: '', count: 1 })
  })
}

function removeDeckRow(i) {
  update(obj => { obj.packs.splice(i, 1) })
}
</script>

<style scoped>
.hiring-fields {
  overflow: hidden;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
}

.hf-hint {
  font-weight: normal;
  color: #94a3b8;
  font-size: 12px;
  margin-left: 6px;
}

.hf-grid {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 8px 12px;
  align-items: center;
}

.hf-label {
  font-size: 13px;
  color: #475569;
}

.hf-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.hiring-fields select,
.hiring-fields input[type="number"] {
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  background: white;
}

.hf-inline select,
.hf-effect select {
  flex: 1 1 180px;
  min-width: 0;
}

.hf-num {
  width: 64px;
}

.hf-num-placeholder {
  width: 64px;
  flex-shrink: 0;
}

.hf-staff {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  align-items: center;
}

.hf-staff-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #334155;
}

.hf-staff-item input {
  width: 48px;
}

.hf-check {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.hf-effect {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.hf-param {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #334155;
}

.hf-note {
  font-size: 12px;
  color: #64748b;
}

.hf-chip {
  display: inline-block;
  background: #e0f2fe;
  color: #075985;
  border-radius: 4px;
  padding: 1px 6px;
  margin: 0 4px 4px 0;
}

.hf-deck {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hf-deck-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.hf-deck-row select:first-child {
  flex: 1;
  min-width: 0;
}

.hf-deck-row .hf-mode {
  flex: 0 0 130px;
  min-width: 0;
}

.hf-btn {
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: white;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.hf-btn:hover {
  background: #f1f5f9;
}

.hf-remove {
  color: #dc2626;
}

.hf-warn {
  color: #b45309;
  font-size: 13px;
}

.hf-issues {
  margin: 10px 0 0 18px;
  font-size: 12px;
}

.hf-issues .error {
  color: #dc2626;
}

.hf-issues .warning {
  color: #b45309;
}
</style>
