<template>
  <div class="playfab-sync">
    <button
      @click="handlePull"
      :disabled="isBusy || !configured"
      class="btn-sync btn-pull"
      :title="configured ? 'Pull catalog from PlayFab (replaces current state)' : 'Configure in Settings → PlayFab'"
    >
      <span class="icon">⇣</span>
      Pull
    </button>
    <button
      @click="handlePush"
      :disabled="isBusy || !configured || !hasData"
      class="btn-sync btn-push"
      :title="configured ? 'Push current catalog to PlayFab (full replace)' : 'Configure in Settings → PlayFab'"
    >
      <span class="icon">⇡</span>
      Push
    </button>
    <span v-if="lastStatus" class="sync-status sync-ok">{{ lastStatus }}</span>
    <span v-if="lastError" class="sync-status sync-err">{{ lastError }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePlayFabSync } from '../composables/usePlayFabSync'
import { usePlayFabData } from '../composables/usePlayFabData'

const { isBusy, lastError, lastStatus, isConfigured, pull, push } = usePlayFabSync()
const { state } = usePlayFabData()

const configured = computed(() => isConfigured())
const hasData = computed(() => state.catalogData !== null)

async function handlePull() {
  if (hasData.value) {
    const ok = confirm('Pull from PlayFab will replace the current editor state. Continue?')
    if (!ok) return
  }
  try {
    await pull()
  } catch (e) {
    alert(`Pull failed: ${e.message}`)
  }
}

async function handlePush() {
  const count = state.entities.length
  const ok = confirm(
    `Push ${count} items to PlayFab?\n\n` +
    `This calls Admin/SetCatalogItems and FULLY REPLACES the catalog in PlayFab. ` +
    `Anything in PlayFab not in this editor will be deleted.`
  )
  if (!ok) return
  try {
    await push()
  } catch (e) {
    alert(`Push failed: ${e.message}`)
  }
}
</script>

<style scoped>
.playfab-sync {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-sync {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: white;
  transition: background 0.15s, opacity 0.15s;
}

.btn-pull {
  background: #8b5cf6;
}
.btn-pull:hover:not(:disabled) {
  background: #7c3aed;
}

.btn-push {
  background: #f59e0b;
}
.btn-push:hover:not(:disabled) {
  background: #d97706;
}

.btn-sync:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.icon {
  font-size: 14px;
  font-weight: bold;
}

.sync-status {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-ok {
  color: #34d399;
}

.sync-err {
  color: #f87171;
}
</style>
