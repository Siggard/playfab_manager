<template>
  <div class="contract-fields">
    <div v-if="!data" class="cf-warn">
      Custom Data контракта — невалидный JSON. Исправьте его, и поля появятся снова.
    </div>

    <div v-else class="cf-grid">
      <span class="cf-label">Игрок</span>
      <div class="cf-inline">
        <template v-if="lockPlayer">
          <span class="cf-fixed">{{ playerLabel }}</span>
        </template>
        <select v-else :value="data.player_id || ''" @change="setPlayer($event.target.value)">
          <option value="">— выберите игрока —</option>
          <option
            v-if="data.player_id && !players.some(p => p.ItemId === data.player_id)"
            :value="data.player_id"
          >
            {{ data.player_id }} (не найден)
          </option>
          <option v-for="p in players" :key="p.ItemId" :value="p.ItemId">
            {{ p.DisplayName || p.ItemId }} — {{ p.ItemId }}{{ clubTag(p) }}
          </option>
        </select>
      </div>

      <span class="cf-label">Клуб</span>
      <div class="cf-inline">
        <select :value="data.club_id || ''" @change="set('club_id', $event.target.value)">
          <option value="">— выберите клуб —</option>
          <option
            v-if="data.club_id && !clubs.some(c => c.ItemId === data.club_id)"
            :value="data.club_id"
          >
            {{ data.club_id }} (не найден)
          </option>
          <option v-for="c in clubs" :key="c.ItemId" :value="c.ItemId">
            {{ c.DisplayName || c.ItemId }} — {{ c.ItemId }}
          </option>
        </select>
        <button
          v-if="bundleClub && bundleClub.ItemId !== data.club_id"
          type="button"
          class="cf-btn"
          :title="`Игрок лежит в бандле ${bundleClub.ItemId}`"
          @click="set('club_id', bundleClub.ItemId)"
        >
          Из бандла: {{ bundleClub.DisplayName || bundleClub.ItemId }}
        </button>
      </div>

      <span class="cf-label">Ставка за период</span>
      <div class="cf-inline">
        <input
          type="number"
          min="1"
          class="cf-num"
          :value="data.wage ?? ''"
          @change="setInt('wage', $event.target.value)"
        />
        <span class="cf-note">$ за {{ PAY_PERIOD_WEEKS }} недели</span>
        <button
          v-if="playerPower > 0 && playerPower !== toInt(data.wage)"
          type="button"
          class="cf-btn"
          title="Стартовая ставка равна каталожной силе игрока"
          @click="set('wage', playerPower)"
        >
          По силе: {{ playerPower }}
        </button>
      </div>

      <span class="cf-label">Срок</span>
      <div class="cf-inline">
        <input
          type="number"
          min="1"
          class="cf-num"
          :value="data.length_periods ?? ''"
          @change="setLength($event.target.value)"
        />
        <span class="cf-note">периодов{{ weeksNote(data.length_periods) }}</span>
      </div>

      <span class="cf-label"></span>
      <div class="cf-inline cf-presets">
        <button
          v-for="n in TERM_PRESETS"
          :key="n"
          type="button"
          class="cf-chip"
          :class="{ active: toInt(data.length_periods) === n }"
          :title="`${n} периодов = ${n * PAY_PERIOD_WEEKS} недель`"
          @click="setLength(n)"
        >
          {{ n }}
        </button>
        <span class="cf-note">пресеты срока</span>
      </div>

      <span class="cf-label">Осталось</span>
      <div class="cf-inline">
        <input
          type="number"
          min="1"
          :max="toInt(data.length_periods) || undefined"
          class="cf-num"
          :value="data.periods_left ?? ''"
          @change="setInt('periods_left', $event.target.value)"
        />
        <span class="cf-note">выплат из {{ data.length_periods ?? '?' }} на старте партии; меньше срока — только для «уже отработанного» контракта</span>
      </div>

      <span class="cf-label">Подписан</span>
      <div class="cf-inline">
        <input
          type="number"
          min="0"
          class="cf-num"
          :value="data.signed_week ?? ''"
          @change="setInt('signed_week', $event.target.value)"
        />
        <span class="cf-note">{{ toInt(data.signed_week) === 0 ? 'неделя 0 — до начала партии' : 'сквозная неделя партии' }}</span>
      </div>
    </div>

    <ul v-if="issues.length > 0" class="cf-issues">
      <li v-for="(issue, i) in issues" :key="i" :class="issue.severity">
        {{ issue.message }}
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePlayFabData } from '../composables/usePlayFabData'
import {
  CONTRACT_CLASS,
  PAY_PERIOD_WEEKS,
  contractIssues,
  findClubOfPlayer,
  parseData,
  toInt
} from '../utils/contracts'

const props = defineProps({
  modelValue: String,   // contract CustomData as JSON text
  itemId: String,       // contract ItemId (for mutual-link checks)
  lockPlayer: Boolean   // true inside the player modal: the player cannot change
})

const emit = defineEmits(['update:modelValue'])

const { state } = usePlayFabData()

const TERM_PRESETS = [3, 6, 13, 26]

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

const collator = new Intl.Collator(undefined, { numeric: true })
const byId = (a, b) => collator.compare(a.ItemId, b.ItemId)

const players = computed(() => state.entities.filter(e => e.ItemClass === 'player').sort(byId))
const clubs = computed(() => state.entities.filter(e => e.ItemClass === 'club').sort(byId))

const player = computed(() =>
  players.value.find(p => p.ItemId === data.value?.player_id) || null
)
const playerLabel = computed(() =>
  player.value
    ? `${player.value.DisplayName || player.value.ItemId} — ${player.value.ItemId}`
    : (data.value?.player_id || '—')
)
const playerPower = computed(() => {
  const n = toInt(parseData(player.value).power)
  return Number.isInteger(n) ? n : 0
})
const bundleClub = computed(() =>
  data.value?.player_id ? findClubOfPlayer(data.value.player_id, state.entities) : null
)

function clubTag(p) {
  const club = findClubOfPlayer(p.ItemId, state.entities)
  return club ? ` (${club.DisplayName || club.ItemId})` : ''
}

const issues = computed(() =>
  data.value
    ? contractIssues(
        { ItemId: props.itemId, ItemClass: CONTRACT_CLASS, CustomData: JSON.stringify(data.value) },
        state.entities
      )
    : []
)

function weeksNote(periods) {
  const n = toInt(periods)
  return Number.isInteger(n) && n > 0 ? ` = ${n * PAY_PERIOD_WEEKS} недель` : ''
}

// Edit a copy and write it back as formatted JSON; unknown keys survive untouched
function update(mutate) {
  if (!data.value) return
  const next = JSON.parse(JSON.stringify(data.value))
  mutate(next)
  emit('update:modelValue', JSON.stringify(next, null, 2))
}

function set(key, value) {
  update(obj => { obj[key] = value })
}

function setInt(key, value) {
  const n = parseInt(value, 10)
  update(obj => { obj[key] = Number.isNaN(n) ? 0 : n })
}

// Changing the term keeps "left" in step unless it was deliberately shortened
function setLength(value) {
  const n = parseInt(value, 10)
  if (Number.isNaN(n)) return
  update(obj => {
    const oldLength = toInt(obj.length_periods)
    const left = toInt(obj.periods_left)
    obj.length_periods = n
    if (!Number.isInteger(left) || left === oldLength || left > n) obj.periods_left = n
  })
}

function setPlayer(playerId) {
  update(obj => {
    obj.player_id = playerId
    const club = playerId ? findClubOfPlayer(playerId, state.entities) : null
    if (club) obj.club_id = club.ItemId
  })
}
</script>

<style scoped>
.contract-fields {
  background: #f0fdfa;
  border: 1px solid #99f6e4;
  border-radius: 8px;
  padding: 12px;
}

.cf-warn {
  font-size: 13px;
  color: #b91c1c;
}

.cf-grid {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 8px 12px;
  align-items: center;
}

.cf-label {
  font-size: 13px;
  color: #475569;
}

.cf-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.cf-fixed {
  font-size: 13px;
  color: #0f172a;
  font-weight: 500;
}

.contract-fields select,
.contract-fields input[type="number"] {
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  background: white;
}

.cf-inline select {
  flex: 1 1 180px;
  min-width: 0;
}

.cf-num {
  width: 72px;
}

.cf-note {
  font-size: 12px;
  color: #64748b;
}

.cf-btn,
.cf-chip {
  padding: 4px 8px;
  border: 1px solid #5eead4;
  border-radius: 6px;
  background: white;
  color: #0f766e;
  font-size: 12px;
  cursor: pointer;
}

.cf-btn:hover,
.cf-chip:hover {
  background: #ccfbf1;
}

.cf-chip {
  padding: 3px 7px;
  min-width: 28px;
}

.cf-presets {
  margin-top: -4px;
}

.cf-chip.active {
  background: #0d9488;
  border-color: #0d9488;
  color: white;
}

.cf-issues {
  margin: 10px 0 0;
  padding-left: 18px;
  font-size: 12px;
}

.cf-issues li.error {
  color: #b91c1c;
}

.cf-issues li.warning {
  color: #b45309;
}
</style>
