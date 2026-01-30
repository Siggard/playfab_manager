<template>
  <div class="modal-overlay">
    <div class="modal-content bundle-editor" v-if="editData">
      <div class="modal-header">
        <h2>Edit Bundle: {{ editData.ItemId }}</h2>
        <button @click="$emit('close')" class="close-btn">×</button>
      </div>

      <div class="modal-body">
        <!-- Basic Info -->
        <section class="editor-section">
          <h3>Basic Info</h3>
          <div class="form-group">
            <label>Item ID</label>
            <input :value="editData.ItemId" readonly disabled class="readonly" />
          </div>
          <div class="form-group">
            <label>Item Class</label>
            <input :value="editData.ItemClass" readonly disabled class="readonly" />
          </div>
          <div class="form-group">
            <label>Display Name</label>
            <input v-model="editData.DisplayName" placeholder="Enter display name" />
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea v-model="editData.Description" rows="2" placeholder="Optional description"></textarea>
          </div>
        </section>

        <!-- Tags -->
        <section class="editor-section">
          <h3>Tags</h3>
          <TagEditor v-model="editData.Tags" />
        </section>

        <!-- Image -->
        <section class="editor-section">
          <h3>Bundle Image</h3>
          <ImageUploader
            :item-class="editData.ItemClass"
            :item-id="editData.ItemId"
            :current-image="bundleImagePath"
            @update="handleImageUpdate"
          />
        </section>

        <!-- CustomData -->
        <section class="editor-section">
          <h3>Custom Data (JSON)</h3>
          <div class="json-editor" :class="{ 'has-error': !customDataValid }">
            <textarea
              v-model="customDataString"
              @input="validateCustomData"
              rows="12"
              class="code"
              placeholder="{}"
            ></textarea>
            <div class="json-status">
              <span v-if="customDataValid" class="status-valid">
                Valid JSON
              </span>
              <span v-else class="status-error">
                {{ customDataError }}
              </span>
              <button type="button" @click="formatJSON" class="btn-format">Format</button>
            </div>
          </div>
        </section>

        <!-- Bundle Contents (Read-only) -->
        <section class="editor-section">
          <h3>Bundle Contents ({{ bundleItemsCount }} items)</h3>
          <div class="bundle-contents-readonly">
            <ul v-if="bundleItemsCount > 0">
              <li v-for="itemId in editData.Bundle.BundledItems" :key="itemId">
                <span class="item-icon">{{ getItemIcon(itemId) }}</span>
                {{ getItemDisplay(itemId) }}
              </li>
            </ul>
            <p v-else class="empty-bundle">No items in bundle</p>
            <p class="info-text">
              Edit composition via drag & drop in main view
            </p>
          </div>
        </section>

      </div>

      <div class="modal-footer">
        <button @click="handleDelete" class="btn btn-danger">
          Delete Bundle
        </button>
        <div class="spacer"></div>
        <button @click="$emit('close')" class="btn btn-secondary">
          Cancel
        </button>
        <button @click="handleSave" class="btn btn-primary" :disabled="!customDataValid">
          Save
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import TagEditor from './TagEditor.vue'
import ImageUploader from './ImageUploader.vue'
import { usePlayFabData } from '../composables/usePlayFabData'
import { getTypeIcon, isValidJSON } from '../utils/entityHelpers'

const props = defineProps({
  bundle: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'save', 'delete'])

const { getEntityById, updateEntity, deleteEntity, state } = usePlayFabData()

const editData = ref(null)
const customDataString = ref('')
const customDataValid = ref(true)
const customDataError = ref('')
const bundleImagePath = ref(null)

onMounted(() => {
  // Deep clone bundle data
  editData.value = JSON.parse(JSON.stringify(props.bundle))

  // Initialize CustomData string and extract imagePath
  if (editData.value.CustomData) {
    try {
      const parsed = JSON.parse(editData.value.CustomData)
      bundleImagePath.value = parsed.imagePath || null
      customDataString.value = JSON.stringify(parsed, null, 2)
    } catch {
      customDataString.value = editData.value.CustomData
    }
  } else {
    customDataString.value = '{}'
  }
})

function handleImageUpdate(imagePath) {
  bundleImagePath.value = imagePath
}

const bundleItemsCount = computed(() =>
  editData.value?.Bundle?.BundledItems?.length || 0
)

function validateCustomData() {
  try {
    JSON.parse(customDataString.value)
    customDataValid.value = true
    customDataError.value = ''
  } catch (e) {
    customDataValid.value = false
    customDataError.value = e.message
  }
}

function formatJSON() {
  if (customDataValid.value) {
    try {
      const parsed = JSON.parse(customDataString.value)
      customDataString.value = JSON.stringify(parsed, null, 2)
    } catch {}
  }
}

function getItemDisplay(itemId) {
  const item = getEntityById(itemId)
  if (item) {
    return `${itemId} (${item.DisplayName || 'Unnamed'} - ${item.ItemClass})`
  }
  return `${itemId} (not found)`
}

function getItemIcon(itemId) {
  const item = getEntityById(itemId)
  return item ? getTypeIcon(item.ItemClass) : '?'
}

function handleSave() {
  if (!customDataValid.value) {
    alert('Cannot save: CustomData JSON is invalid')
    return
  }

  // Update CustomData as string (minified for storage) with imagePath
  try {
    const parsed = JSON.parse(customDataString.value)

    // Add or update imagePath
    if (bundleImagePath.value) {
      parsed.imagePath = bundleImagePath.value
    } else {
      delete parsed.imagePath
    }

    editData.value.CustomData = JSON.stringify(parsed)
  } catch {
    editData.value.CustomData = customDataString.value
  }

  // Update the bundle in state
  const bundleIndex = state.entities.findIndex(e => e.ItemId === editData.value.ItemId)
  if (bundleIndex !== -1) {
    Object.assign(state.entities[bundleIndex], editData.value)
  }

  emit('save', editData.value)
  emit('close')
}

function handleDelete() {
  if (confirm(`Are you sure you want to delete bundle "${editData.value.DisplayName || editData.value.ItemId}"?\n\nThis will also remove all items from this bundle.`)) {
    deleteEntity(editData.value.ItemId)
    emit('delete', editData.value.ItemId)
    emit('close')
  }
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

.close-btn:hover {
  color: #1e293b;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.editor-section {
  margin-bottom: 24px;
}

.editor-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid #e5e7eb;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #4b5563;
  margin-bottom: 4px;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group textarea:focus {
  border-color: #3b82f6;
}

.form-group input.readonly {
  background: #f3f4f6;
  color: #6b7280;
}

.json-editor {
  width: 100%;
}

.json-editor textarea {
  width: 100%;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  box-sizing: border-box;
}

.json-editor.has-error textarea {
  border-color: #ef4444;
  background: #fef2f2;
}

.json-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
}

.status-valid {
  color: #10b981;
}

.status-error {
  color: #ef4444;
  flex: 1;
  margin-right: 8px;
}

.btn-format {
  padding: 4px 12px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.btn-format:hover {
  background: #e5e7eb;
}

.bundle-contents-readonly {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 12px;
}

.bundle-contents-readonly ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.bundle-contents-readonly li {
  padding: 6px 0;
  font-size: 13px;
  color: #374151;
  border-bottom: 1px solid #e5e7eb;
}

.bundle-contents-readonly li:last-child {
  border-bottom: none;
}

.item-icon {
  margin-right: 6px;
}

.empty-bundle {
  color: #9ca3af;
  font-size: 13px;
  text-align: center;
  margin: 0;
}

.info-text {
  color: #6b7280;
  font-size: 12px;
  margin-top: 8px;
  font-style: italic;
}

.modal-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
}

.spacer {
  flex: 1;
}

.btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background 0.15s;
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

.btn-danger {
  background: #fee2e2;
  color: #dc2626;
}

.btn-danger:hover {
  background: #fecaca;
}

.code {
  font-family: 'Consolas', 'Monaco', monospace;
}
</style>
