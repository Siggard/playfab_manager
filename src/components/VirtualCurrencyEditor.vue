<template>
  <div class="currency-editor">
    <div class="currency-list" v-if="currencies.length > 0">
      <div
        v-for="(currency, idx) in currencies"
        :key="idx"
        class="currency-row"
      >
        <input
          type="text"
          v-model="currency.code"
          placeholder="Code"
          class="currency-code"
          maxlength="10"
        />
        <input
          type="number"
          v-model.number="currency.amount"
          placeholder="Amount"
          class="currency-amount"
          min="0"
        />
        <button type="button" @click="removeCurrency(idx)" class="btn-remove">×</button>
      </div>
    </div>
    <div v-else class="no-currencies">
      No virtual currencies
    </div>
    <button type="button" @click="addCurrency" class="btn-add">
      + Add Currency
    </button>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  modelValue: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue'])

const currencies = ref([])

onMounted(() => {
  if (props.modelValue && typeof props.modelValue === 'object') {
    currencies.value = Object.entries(props.modelValue).map(([code, amount]) => ({
      code,
      amount: parseInt(amount, 10) || 0
    }))
  }
})

watch(currencies, (newVal) => {
  if (newVal.length === 0) {
    emit('update:modelValue', null)
  } else {
    const result = {}
    newVal.forEach(c => {
      if (c.code) {
        result[c.code] = c.amount
      }
    })
    emit('update:modelValue', Object.keys(result).length > 0 ? result : null)
  }
}, { deep: true })

function addCurrency() {
  currencies.value.push({ code: '', amount: 0 })
}

function removeCurrency(index) {
  currencies.value.splice(index, 1)
}
</script>

<style scoped>
.currency-editor {
  width: 100%;
}

.currency-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}

.currency-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.currency-code {
  width: 80px;
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
  text-transform: uppercase;
}

.currency-amount {
  flex: 1;
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 14px;
}

.btn-remove {
  background: #fee2e2;
  color: #dc2626;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 18px;
}

.btn-remove:hover {
  background: #fecaca;
}

.no-currencies {
  color: #9ca3af;
  font-size: 13px;
  padding: 8px;
  text-align: center;
  background: #f9fafb;
  border-radius: 4px;
  margin-bottom: 8px;
}

.btn-add {
  width: 100%;
  padding: 8px;
  background: #f3f4f6;
  border: 1px dashed #d1d5db;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: #6b7280;
}

.btn-add:hover {
  background: #e5e7eb;
  color: #374151;
}
</style>
