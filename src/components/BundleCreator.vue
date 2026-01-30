<template>
  <div class="modal-overlay">
    <div class="modal-content bundle-creator">
      <div class="modal-header">
        <h2>Create Bundle from Template</h2>
        <button @click="$emit('close')" class="close-btn">x</button>
      </div>

      <div class="modal-body">
        <!-- Template Selection -->
        <section class="creator-section">
          <h3>Select Template</h3>
          <div class="template-list">
            <div
              v-for="(template, id) in bundleTemplates"
              :key="id"
              class="template-option"
              :class="{ selected: selectedTemplate === id }"
              @click="selectTemplate(id)"
            >
              <div class="template-name">{{ template.name }}</div>
              <div class="template-desc">{{ template.description }}</div>
              <div class="template-meta">
                <span class="meta-badge">{{ template.bundleClass }}</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Preview -->
        <section v-if="selectedTemplate" class="creator-section">
          <h3>Requirements Preview</h3>
          <div class="requirements-preview">
            <div
              v-for="(req, itemClass) in currentTemplate.itemRequirements"
              :key="itemClass"
              class="requirement-row"
            >
              <span class="req-icon">{{ getTypeIcon(itemClass) }}</span>
              <span class="req-class">{{ itemClass }}</span>
              <span class="req-count">x{{ req.count }}</span>
              <span v-if="req.filters" class="req-filters">
                ({{ formatFilters(req.filters) }})
              </span>
              <span class="req-available" :class="{ warning: getAvailableCount(itemClass, req) < req.count }">
                Available: {{ getAvailableCount(itemClass, req) }}
              </span>
            </div>
          </div>
        </section>

        <!-- Bundle Settings -->
        <section v-if="selectedTemplate" class="creator-section">
          <h3>Bundle Settings</h3>
          <div class="form-group">
            <label>Item ID</label>
            <div class="input-with-btn">
              <input v-model="bundleSettings.itemId" placeholder="e.g., club_9" />
              <button type="button" @click="generateBundleId" class="btn-generate">
                Generate
              </button>
            </div>
            <span v-if="idError" class="error-text">{{ idError }}</span>
          </div>

          <div class="form-group">
            <label>Display Name</label>
            <input v-model="bundleSettings.displayName" placeholder="Enter bundle name" />
          </div>

          <div class="form-group">
            <label>Selection Mode</label>
            <div class="selection-modes">
              <label class="mode-option">
                <input type="radio" v-model="bundleSettings.selectionMode" value="random" />
                <span class="mode-label">
                  <strong>Random</strong>
                  <small>Auto-select items matching requirements</small>
                </span>
              </label>
              <label class="mode-option">
                <input type="radio" v-model="bundleSettings.selectionMode" value="manual" />
                <span class="mode-label">
                  <strong>Manual</strong>
                  <small>Create empty bundle, add items later</small>
                </span>
              </label>
            </div>
          </div>
        </section>

        <!-- Selected Items Preview (Random mode) -->
        <section v-if="selectedTemplate && bundleSettings.selectionMode === 'random'" class="creator-section">
          <h3>
            Selected Items
            <button type="button" @click="randomizeSelection" class="btn-randomize">
              Randomize
            </button>
          </h3>
          <div class="selected-items-preview">
            <div v-if="selectedItems.length === 0" class="empty-selection">
              Click "Randomize" to auto-select items
            </div>
            <div v-else class="selected-items-list">
              <div v-for="item in selectedItems" :key="item.ItemId" class="selected-item">
                <span class="item-icon">{{ getTypeIcon(item.ItemClass) }}</span>
                <span class="item-name">{{ item.DisplayName || item.ItemId }}</span>
                <span class="item-class">{{ item.ItemClass }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="modal-footer">
        <button @click="$emit('close')" class="btn btn-secondary">
          Cancel
        </button>
        <button
          @click="handleCreate(false)"
          class="btn btn-outline"
          :disabled="!canCreate"
        >
          Create
        </button>
        <button
          @click="handleCreate(true)"
          class="btn btn-primary"
          :disabled="!canCreate"
        >
          Create & Edit
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { usePlayFabData } from '../composables/usePlayFabData'
import { useSettings } from '../composables/useSettings'
import { getTypeIcon } from '../utils/entityHelpers'

const emit = defineEmits(['close', 'created', 'created-and-edit'])

const { state, createEntity, generateItemId, isEntityInBundle } = usePlayFabData()
const { settings } = useSettings()

const selectedTemplate = ref(null)
const bundleSettings = ref({
  itemId: '',
  displayName: '',
  selectionMode: 'random'
})
const selectedItems = ref([])

const bundleTemplates = computed(() => settings.templates.bundles)

const currentTemplate = computed(() => {
  if (!selectedTemplate.value) return null
  return bundleTemplates.value[selectedTemplate.value]
})

const idError = computed(() => {
  if (!bundleSettings.value.itemId) return 'Item ID is required'
  if (state.entities.some(e => e.ItemId === bundleSettings.value.itemId)) {
    return 'Item ID already exists'
  }
  return null
})

const canCreate = computed(() => {
  if (!selectedTemplate.value) return false
  if (idError.value) return false
  if (!bundleSettings.value.displayName) return false
  if (bundleSettings.value.selectionMode === 'random' && selectedItems.value.length === 0) {
    return false
  }
  return true
})

function selectTemplate(templateId) {
  selectedTemplate.value = templateId
  const template = bundleTemplates.value[templateId]
  bundleSettings.value.displayName = template.name
  generateBundleId()
  selectedItems.value = []
}

function generateBundleId() {
  if (!currentTemplate.value) return
  bundleSettings.value.itemId = generateItemId(currentTemplate.value.bundleClass)
}

function formatFilters(filters) {
  return Object.entries(filters)
    .map(([key, val]) => `${key} ${val}`)
    .join(', ')
}

function getAvailableCount(itemClass, req) {
  return getAvailableItems(itemClass, req.filters).length
}

function getAvailableItems(itemClass, filters = {}) {
  return state.entities.filter(item => {
    if (item.ItemClass !== itemClass) return false
    if (item.Bundle !== null) return false
    if (isEntityInBundle(item.ItemId)) return false

    // Check filters
    if (filters && Object.keys(filters).length > 0) {
      try {
        const data = JSON.parse(item.CustomData || '{}')
        for (const [key, condition] of Object.entries(filters)) {
          const value = data[key]
          if (typeof condition === 'string') {
            if (condition.startsWith('<=')) {
              const threshold = parseInt(condition.substring(2))
              if (parseInt(value) > threshold) return false
            } else if (condition.startsWith('>=')) {
              const threshold = parseInt(condition.substring(2))
              if (parseInt(value) < threshold) return false
            } else if (value !== condition) {
              return false
            }
          }
        }
      } catch {
        return false
      }
    }

    return true
  })
}

function randomSample(array, count) {
  const shuffled = [...array].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, array.length))
}

function randomizeSelection() {
  if (!currentTemplate.value) return

  const selected = []
  const requirements = currentTemplate.value.itemRequirements || {}

  for (const [itemClass, req] of Object.entries(requirements)) {
    const available = getAvailableItems(itemClass, req.filters)
    const picks = randomSample(available, req.count)
    selected.push(...picks)
  }

  selectedItems.value = selected
}

function handleCreate(andEdit = false) {
  if (!canCreate.value) return

  const template = currentTemplate.value

  // Create bundle entity
  const newBundle = {
    ItemId: bundleSettings.value.itemId,
    ItemClass: template.bundleClass,
    DisplayName: bundleSettings.value.displayName,
    Description: template.description,
    CustomData: template.customData ? JSON.stringify(template.customData) : null,
    Tags: [],
    Bundle: {
      BundledItems: bundleSettings.value.selectionMode === 'random'
        ? selectedItems.value.map(item => item.ItemId)
        : [],
      BundledResultTables: [],
      BundledVirtualCurrencies: template.virtualCurrencies || null
    },
    CanBecomeCharacter: false,
    IsStackable: false,
    IsTradable: false,
    ItemImageUrl: null,
    IsLimitedEdition: false,
    InitialLimitedEditionCount: 0
  }

  createEntity(newBundle)

  if (andEdit) {
    emit('created-and-edit', newBundle)
  } else {
    emit('created', newBundle)
  }
  emit('close')
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h2 {
  margin: 0;
  font-size: 18px;
  color: #1e293b;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.creator-section {
  margin-bottom: 24px;
}

.creator-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.template-option {
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.template-option:hover {
  border-color: #3b82f6;
  background: #f0f9ff;
}

.template-option.selected {
  border-color: #3b82f6;
  background: #dbeafe;
}

.template-name {
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
}

.template-desc {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 8px;
}

.template-meta {
  display: flex;
  gap: 8px;
}

.meta-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: #f3f4f6;
  border-radius: 4px;
  color: #4b5563;
}

.requirements-preview {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
}

.requirement-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid #e5e7eb;
  font-size: 13px;
}

.requirement-row:last-child {
  border-bottom: none;
}

.req-icon {
  font-size: 16px;
}

.req-class {
  font-weight: 500;
  color: #1e293b;
}

.req-count {
  color: #3b82f6;
  font-weight: 600;
}

.req-filters {
  color: #6b7280;
  font-size: 12px;
}

.req-available {
  margin-left: auto;
  font-size: 12px;
  color: #10b981;
}

.req-available.warning {
  color: #f59e0b;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #4b5563;
  margin-bottom: 6px;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #3b82f6;
}

.input-with-btn {
  display: flex;
  gap: 8px;
}

.input-with-btn input {
  flex: 1;
}

.btn-generate {
  padding: 10px 16px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.btn-generate:hover {
  background: #e5e7eb;
}

.error-text {
  font-size: 12px;
  color: #ef4444;
  margin-top: 4px;
}

.selection-modes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mode-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
}

.mode-option:hover {
  background: #f9fafb;
}

.mode-option input {
  margin-top: 2px;
}

.mode-label {
  display: flex;
  flex-direction: column;
}

.mode-label strong {
  color: #1e293b;
  font-size: 14px;
}

.mode-label small {
  color: #6b7280;
  font-size: 12px;
}

.btn-randomize {
  padding: 4px 12px;
  background: #dbeafe;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  color: #1d4ed8;
  font-size: 12px;
  cursor: pointer;
}

.btn-randomize:hover {
  background: #bfdbfe;
}

.selected-items-preview {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.empty-selection {
  text-align: center;
  color: #9ca3af;
  padding: 20px;
  font-size: 13px;
}

.selected-items-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.selected-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: white;
  border-radius: 4px;
  font-size: 13px;
}

.item-icon {
  font-size: 14px;
}

.item-name {
  flex: 1;
  color: #1e293b;
}

.item-class {
  font-size: 11px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 3px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
}

.btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-outline {
  background: white;
  color: #3b82f6;
  border: 2px solid #3b82f6;
}

.btn-outline:hover:not(:disabled) {
  background: #eff6ff;
}
</style>
