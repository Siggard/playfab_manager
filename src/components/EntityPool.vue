<template>
  <div class="entity-pool">
    <div class="pool-header">
      <h2>Entity Pool</h2>
      <span class="count">{{ displayedEntities.length }}</span>
    </div>

    <div class="pool-filters">
      <input
        type="text"
        v-model="state.filters.search"
        placeholder="Search by name or ID..."
        class="search-input"
      />

      <select v-model="state.filters.type" class="type-filter">
        <option value="all">All Types</option>
        <option v-for="cls in entityClasses" :key="cls" :value="cls">
          {{ getTypeIcon(cls) }} {{ cls }}
        </option>
      </select>

      <select v-model="state.filters.tag" class="tag-filter">
        <option value="all">All Tags</option>
        <option v-for="tag in allTags" :key="tag" :value="tag">
          {{ tag }}
        </option>
      </select>

      <select v-model="state.sortBy" class="sort-filter">
        <option value="name">Sort: Name</option>
        <option value="type">Sort: Type</option>
        <option value="id">Sort: ID</option>
      </select>

      <label class="checkbox-filter">
        <input type="checkbox" v-model="showOnlyUnassigned" />
        <span>Show only unassigned</span>
        <span class="unassigned-count">{{ unassignedEntities.length }}</span>
      </label>
    </div>

    <div class="pool-actions">
      <button @click="$emit('create')" class="btn-create">
        + New Entity
      </button>
    </div>

    <div class="pool-list">
      <draggable
        v-model="dragList"
        group="entities"
        item-key="ItemId"
        :animation="150"
        ghost-class="ghost"
        chosen-class="chosen"
        @change="handleChange"
      >
        <template #item="{ element }">
          <EntityCard
            :entity="element"
            @edit="$emit('edit', element)"
          />
        </template>
      </draggable>

      <div v-if="displayedEntities.length === 0" class="empty-state">
        <span v-if="state.filters.search || state.filters.type !== 'all' || state.filters.tag !== 'all'">
          No entities match your filters
        </span>
        <span v-else-if="showOnlyUnassigned">
          All entities are assigned to bundles
        </span>
        <span v-else>
          No entities available
        </span>
        <button
          v-if="showOnlyUnassigned && unassignedEntities.length === 0"
          @click="showOnlyUnassigned = false"
          class="btn-show-all"
        >
          Show all entities
        </button>
      </div>
    </div>

    <div class="pool-stats">
      <span>Total: {{ state.entities.length }}</span>
      <span>Unassigned: {{ unassignedEntities.length }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import draggable from 'vuedraggable'
import EntityCard from './EntityCard.vue'
import { usePlayFabData } from '../composables/usePlayFabData'
import { getTypeIcon } from '../utils/entityHelpers'

const { state, filteredEntities, unassignedEntities, entityClasses, allTags } = usePlayFabData()

defineEmits(['edit', 'create'])

const showOnlyUnassigned = ref(true)

// Displayed entities based on unassigned filter
const displayedEntities = computed(() => {
  let entities = showOnlyUnassigned.value ? unassignedEntities.value : state.entities

  // Exclude bundles themselves
  entities = entities.filter(e => !state.bundleClasses.has(e.ItemClass) || !e.Bundle?.BundledItems)

  // Apply type filter
  if (state.filters.type !== 'all') {
    entities = entities.filter(e => e.ItemClass === state.filters.type)
  }

  // Apply search filter
  if (state.filters.search) {
    const search = state.filters.search.toLowerCase()
    entities = entities.filter(e =>
      e.DisplayName?.toLowerCase().includes(search) ||
      e.ItemId.toLowerCase().includes(search)
    )
  }

  // Apply tag filter
  if (state.filters.tag !== 'all') {
    entities = entities.filter(e =>
      e.Tags && Array.isArray(e.Tags) && e.Tags.includes(state.filters.tag)
    )
  }

  // Apply sort
  entities = [...entities].sort((a, b) => {
    switch (state.sortBy) {
      case 'name':
        return (a.DisplayName || '').localeCompare(b.DisplayName || '')
      case 'type':
        return a.ItemClass.localeCompare(b.ItemClass)
      case 'id':
        return a.ItemId.localeCompare(b.ItemId)
      default:
        return 0
    }
  })

  return entities
})

// Computed for draggable v-model
const dragList = computed({
  get: () => displayedEntities.value,
  set: (value) => {
    // Items added here are removed from bundles
  }
})

function handleChange(evt) {
  if (evt.added) {
    console.log('Entity added to pool:', evt.added.element.ItemId)
  }
}
</script>

<style scoped>
.entity-pool {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
}

.pool-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
}

.pool-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.count {
  background: #3b82f6;
  color: white;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 600;
}

.pool-filters {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
}

.search-input,
.type-filter,
.tag-filter,
.sort-filter {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.search-input:focus,
.type-filter:focus,
.tag-filter:focus,
.sort-filter:focus {
  border-color: #3b82f6;
}

.checkbox-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #4b5563;
  cursor: pointer;
  padding: 4px 0;
}

.checkbox-filter input {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.unassigned-count {
  background: #f59e0b;
  color: white;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
  margin-left: auto;
}

.pool-actions {
  padding: 12px;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
}

.btn-create {
  width: 100%;
  padding: 10px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-create:hover {
  background: #059669;
}

.pool-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  color: #9ca3af;
  padding: 32px 16px;
  font-size: 13px;
}

.btn-show-all {
  padding: 6px 12px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.btn-show-all:hover {
  background: #e5e7eb;
}

.pool-stats {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  background: #fff;
  border-top: 1px solid #e2e8f0;
  font-size: 12px;
  color: #64748b;
}

.ghost {
  opacity: 0.5;
  background: #dbeafe;
}

.chosen {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
</style>
