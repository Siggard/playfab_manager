<template>
  <div class="bundle-grid">
    <div class="grid-header">
      <h2>Bundles</h2>
      <div class="header-actions">
        <select v-model="selectedBundleClass" class="bundle-filter">
          <option value="all">All Types</option>
          <option v-for="cls in bundleClasses" :key="cls" :value="cls">
            {{ getTypeIcon(cls) }} {{ cls }} ({{ getBundleCountByClass(cls) }})
          </option>
        </select>
      </div>
    </div>

    <!-- Bundle Type Tabs -->
    <div class="bundle-tabs" v-if="bundleClasses.length > 1">
      <button
        class="tab-btn"
        :class="{ active: selectedBundleClass === 'all' }"
        @click="selectedBundleClass = 'all'"
      >
        All ({{ state.bundles.length }})
      </button>
      <button
        v-for="cls in bundleClasses"
        :key="cls"
        class="tab-btn"
        :class="{ active: selectedBundleClass === cls }"
        @click="selectedBundleClass = cls"
      >
        {{ getTypeIcon(cls) }} {{ cls }} ({{ getBundleCountByClass(cls) }})
      </button>
    </div>

    <div class="grid-stats">
      <span>{{ globalStats.bundleCount }} bundles</span>
      <span>{{ globalStats.assignedEntities }} assigned</span>
      <span>{{ globalStats.unassignedEntities }} unassigned</span>
    </div>

    <div class="grid-content">
      <BundlePanel
        v-for="bundle in filteredBundles"
        :key="bundle.ItemId"
        :bundle="bundle"
        @edit="$emit('edit', $event)"
        @edit-bundle="$emit('edit-bundle', $event)"
        @focus="$emit('focus', $event)"
      />

      <div v-if="filteredBundles.length === 0" class="no-bundles">
        No bundles found
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import BundlePanel from './BundlePanel.vue'
import { usePlayFabData } from '../composables/usePlayFabData'
import { useBundleStats } from '../composables/useBundleStats'
import { getTypeIcon } from '../utils/entityHelpers'

const { state } = usePlayFabData()
const { globalStats } = useBundleStats()

defineEmits(['edit', 'edit-bundle', 'focus'])

const selectedBundleClass = ref('all')

const bundleClasses = computed(() => Array.from(state.bundleClasses).sort())

const filteredBundles = computed(() => {
  if (selectedBundleClass.value === 'all') {
    return state.bundles
  }
  return state.bundles.filter(b => b.ItemClass === selectedBundleClass.value)
})

function getBundleCountByClass(cls) {
  return state.bundles.filter(b => b.ItemClass === cls).length
}
</script>

<style scoped>
.bundle-grid {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f1f5f9;
}

.grid-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
}

.grid-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.bundle-filter {
  padding: 6px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
}

.bundle-filter:focus {
  border-color: #3b82f6;
}

.bundle-tabs {
  display: flex;
  gap: 4px;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  overflow-x: auto;
}

.tab-btn {
  padding: 6px 12px;
  background: #f3f4f6;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  color: #64748b;
  transition: all 0.15s;
}

.tab-btn:hover {
  background: #e5e7eb;
}

.tab-btn.active {
  background: #3b82f6;
  color: white;
}

.grid-stats {
  display: flex;
  gap: 16px;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  font-size: 13px;
  color: #64748b;
}

.grid-content {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  padding: 16px;
  overflow-y: auto;
  flex: 1 1 0;
  min-height: 0;
}

.no-bundles {
  width: 100%;
  text-align: center;
  color: #9ca3af;
  padding: 48px;
  font-size: 14px;
}
</style>
