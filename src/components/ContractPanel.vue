<template>
  <div class="contract-panel">
    <div class="cp-header">
      <h3>📝 Контракт — {{ player.DisplayName || player.ItemId }}</h3>
      <button class="close-btn" @click="$emit('close')">×</button>
    </div>

    <div class="cp-content">
      <div class="cp-club">
        <template v-if="club">
          Клуб: <strong>{{ club.DisplayName || club.ItemId }}</strong>
          <span class="cp-id">{{ club.ItemId }}</span>
        </template>
        <template v-else>
          Игрок не лежит ни в одном бандле клуба — контракт ему не обязателен.
        </template>
      </div>

      <!-- No contract yet -->
      <div v-if="!contract" class="cp-empty">
        <div v-if="contractId" class="cp-error">
          В contract_id указан «{{ contractId }}», но такого контракта нет.
        </div>
        <p v-else>У игрока нет контракта.</p>

        <div v-if="strays.length > 0" class="cp-strays">
          <div class="cp-strays-title">Контракты, выписанные на этого игрока:</div>
          <div v-for="c in strays" :key="c.ItemId" class="cp-stray">
            <span class="cp-stray-name">{{ c.DisplayName || c.ItemId }}</span>
            <span class="cp-id">{{ c.ItemId }}</span>
            <span class="cp-stray-summary">{{ contractSummary(c) }}</span>
            <button type="button" class="btn btn-small" @click="link(c)">Привязать</button>
          </div>
        </div>

        <button type="button" class="btn btn-primary" @click="create">
          Создать контракт
        </button>
        <p class="cp-hint">
          Ставка — по силе игрока, срок — {{ DEFAULT_CONTRACT_PERIODS }} периодов,
          клуб — из бандла. Игроку сразу проставится contract_id.
        </p>
      </div>

      <!-- Existing contract -->
      <template v-else>
        <div class="cp-row">
          <span class="cp-id-label">{{ contract.ItemId }}</span>
          <button type="button" class="cp-link" @click="$emit('open-entity', contract)">
            открыть как сущность →
          </button>
        </div>

        <div class="form-group">
          <label>Название</label>
          <input type="text" v-model="form.DisplayName" />
        </div>

        <div class="form-group">
          <label>Описание</label>
          <textarea v-model="form.Description" rows="2"></textarea>
        </div>

        <ContractFields
          v-model="form.CustomData"
          :item-id="contract.ItemId"
          lock-player
        />

        <div v-if="strays.length > 0" class="cp-strays">
          <div class="cp-strays-title">На игрока также указывают:</div>
          <div v-for="c in strays" :key="c.ItemId" class="cp-stray">
            <span class="cp-stray-name">{{ c.DisplayName || c.ItemId }}</span>
            <span class="cp-id">{{ c.ItemId }}</span>
            <span class="cp-stray-summary">{{ contractSummary(c) }}</span>
            <button type="button" class="btn btn-small" @click="link(c)">Привязать вместо</button>
          </div>
        </div>
      </template>
    </div>

    <div v-if="contract" class="cp-footer">
      <button type="button" class="btn btn-danger" @click="remove">Удалить</button>
      <div class="spacer"></div>
      <span v-if="dirty" class="cp-dirty">не сохранено</span>
      <button type="button" class="btn btn-secondary" :disabled="!dirty" @click="reset">
        Отменить
      </button>
      <button type="button" class="btn btn-primary" :disabled="!dirty || !!jsonError" @click="save">
        Сохранить контракт
      </button>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed, watch } from 'vue'
import { usePlayFabData } from '../composables/usePlayFabData'
import ContractFields from './ContractFields.vue'
import {
  CONTRACT_CLASS,
  DEFAULT_CONTRACT_PERIODS,
  contractSummary,
  defaultContractData,
  defaultContractDescription,
  defaultContractName,
  findClubOfPlayer,
  findContractsOfPlayer
} from '../utils/contracts'

const props = defineProps({
  player: { type: Object, required: true },
  contractId: { type: String, default: '' } // player's current contract_id (from the form)
})

// linked: the player's contract_id must become this value ('' = no contract)
const emit = defineEmits(['close', 'linked', 'open-entity'])

const { state, createEntity, updateEntity, deleteEntity, generateItemId } = usePlayFabData()

const contract = computed(() =>
  state.entities.find(e => e.ItemId === props.contractId && e.ItemClass === CONTRACT_CLASS) || null
)
const club = computed(() => findClubOfPlayer(props.player.ItemId, state.entities))
const strays = computed(() =>
  findContractsOfPlayer(props.player.ItemId, state.entities).filter(c => c.ItemId !== props.contractId)
)

const form = reactive({ DisplayName: '', Description: '', CustomData: '' })

function formatted(text) {
  try { return JSON.stringify(JSON.parse(text || '{}'), null, 2) } catch { return text || '' }
}

function reset() {
  form.DisplayName = contract.value?.DisplayName || ''
  form.Description = contract.value?.Description || ''
  form.CustomData = formatted(contract.value?.CustomData)
}

watch(contract, reset, { immediate: true })

const jsonError = computed(() => {
  try { JSON.parse(form.CustomData || '{}'); return null } catch (e) { return e.message }
})

const dirty = computed(() => {
  if (!contract.value) return false
  return form.DisplayName !== (contract.value.DisplayName || '') ||
    form.Description !== (contract.value.Description || '') ||
    form.CustomData !== formatted(contract.value.CustomData)
})

function create() {
  const data = defaultContractData(props.player, club.value)
  const created = createEntity({
    ItemId: generateItemId(CONTRACT_CLASS),
    ItemClass: CONTRACT_CLASS,
    DisplayName: defaultContractName(props.player),
    Description: defaultContractDescription(club.value),
    CustomData: JSON.stringify(data)
  })
  emit('linked', created.ItemId)
}

function link(stray) {
  emit('linked', stray.ItemId)
}

function save() {
  if (!contract.value || jsonError.value) return
  updateEntity(contract.value.ItemId, {
    DisplayName: form.DisplayName,
    Description: form.Description || null,
    CustomData: JSON.stringify(JSON.parse(form.CustomData || '{}'))
  })
  reset()
}

function remove() {
  if (!contract.value) return
  if (!confirm(`Удалить контракт «${contract.value.DisplayName || contract.value.ItemId}»?`)) return
  deleteEntity(contract.value.ItemId)
  emit('linked', '')
}
</script>

<style scoped>
.contract-panel {
  background: #f8fafc;
  width: 480px;
  max-height: 90vh;
  border-radius: 0 12px 12px 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  border-left: 1px solid #e2e8f0;
}

.cp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: white;
  border-radius: 0 12px 0 0;
}

.cp-header h3 {
  margin: 0;
  font-size: 16px;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #9ca3af;
  cursor: pointer;
  line-height: 1;
}

.close-btn:hover {
  color: #374151;
}

.cp-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.cp-club {
  font-size: 13px;
  color: #475569;
  margin-bottom: 12px;
}

.cp-id,
.cp-id-label {
  font-family: monospace;
  font-size: 12px;
  color: #64748b;
  margin-left: 6px;
}

.cp-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.cp-link {
  background: none;
  border: none;
  color: #0d9488;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}

.cp-link:hover {
  text-decoration: underline;
}

.cp-empty p {
  font-size: 14px;
  color: #475569;
  margin: 0 0 12px;
}

.cp-error {
  font-size: 13px;
  color: #b91c1c;
  margin-bottom: 12px;
}

.cp-hint {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 8px;
}

.cp-strays {
  margin: 12px 0;
  padding: 10px 12px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
}

.cp-strays-title {
  font-size: 12px;
  color: #92400e;
  margin-bottom: 6px;
}

.cp-stray {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 4px 0;
}

.cp-stray-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cp-stray-summary {
  font-size: 12px;
  color: #64748b;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: #0d9488;
}

.cp-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid #e2e8f0;
  background: white;
  border-radius: 0 0 12px 0;
}

.spacer {
  flex: 1;
}

.cp-dirty {
  font-size: 12px;
  color: #b45309;
  white-space: nowrap;
}

.cp-footer .btn {
  white-space: nowrap;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-small {
  padding: 4px 10px;
  font-size: 12px;
  background: #ccfbf1;
  color: #0f766e;
}

.btn-primary {
  background: #0d9488;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0f766e;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-danger {
  background: #fee2e2;
  color: #b91c1c;
}

.btn-danger:hover {
  background: #fecaca;
}
</style>
