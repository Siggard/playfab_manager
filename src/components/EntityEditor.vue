<template>
  <div class="modal-overlay">
    <div class="modal-container" :class="{ 'with-help': showHelp }">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ isNew ? 'Create New Entity' : 'Edit Entity' }}</h3>
          <button class="close-btn" @click="$emit('close')">×</button>
        </div>

      <div class="modal-body">
        <!-- Template Selector (only for new entities) -->
        <div v-if="isNew && availableTemplates.length > 0" class="form-group template-selector">
          <label>Use Template</label>
          <div class="template-chips">
            <button
              v-for="tpl in availableTemplates"
              :key="tpl"
              type="button"
              class="template-chip"
              :class="{ active: selectedTemplate === tpl }"
              @click="applyTemplate(tpl)"
            >
              {{ getTypeIcon(tpl) }} {{ tpl }}
            </button>
            <button
              type="button"
              class="template-chip"
              :class="{ active: !selectedTemplate }"
              @click="clearTemplate"
            >
              None
            </button>
          </div>
        </div>

        <!-- Item ID & Item Class in one row -->
        <div v-if="isNew" class="form-row">
          <div class="form-group flex-1">
            <label>Item ID</label>
            <div class="input-with-btn">
              <input
                type="text"
                v-model="form.ItemId"
                placeholder="e.g., p_31"
                :class="{ error: idError }"
              />
              <button type="button" @click="generateId" class="btn-generate">
                Generate
              </button>
            </div>
            <span v-if="idError" class="error-text">{{ idError }}</span>
          </div>
          <div class="form-group flex-1">
            <label>Item Class</label>
            <select v-model="form.ItemClass">
              <option v-for="cls in itemClasses" :key="cls" :value="cls">
                {{ getTypeIcon(cls) }} {{ cls }}
              </option>
            </select>
          </div>
        </div>

        <div v-else class="form-row">
          <div class="form-group flex-1">
            <label>Item ID</label>
            <input
              type="text"
              :value="form.ItemId"
              disabled
              class="readonly"
            />
          </div>
          <div class="form-group flex-1">
            <label>Item Class</label>
            <input
              type="text"
              :value="form.ItemClass"
              disabled
              class="readonly"
            />
          </div>
        </div>

        <div class="form-group">
          <label>Display Name</label>
          <input
            type="text"
            v-model="form.DisplayName"
            placeholder="Enter display name"
          />
        </div>

        <div class="form-group">
          <label>Description</label>
          <textarea
            v-model="form.Description"
            placeholder="Optional description"
            rows="2"
          ></textarea>
        </div>

        <div class="form-group">
          <label>
            Custom Data (JSON)
            <button type="button" class="btn-help" @click="showHelp = !showHelp" title="Show format reference">?</button>
          </label>
          <textarea
            v-model="form.CustomData"
            placeholder='{"power": "5", "level": "3"}'
            rows="12"
            :class="{ error: customDataError }"
            class="code"
          ></textarea>
          <span v-if="customDataError" class="error-text">{{ customDataError }}</span>
          <div class="json-buttons">
            <button type="button" @click="formatCustomData" class="btn-format">
              Format JSON
            </button>
            <button type="button" @click="fixNestedJson" class="btn-format btn-fix">
              Fix Nested JSON
            </button>
          </div>
        </div>

        <!-- Linked Features (for players) -->
        <div v-if="linkedFeatures.length > 0" class="form-group linked-features">
          <label>Linked Features</label>
          <div class="features-list">
            <div
              v-for="link in linkedFeatures"
              :key="link.entity.ItemId"
              class="feature-item"
              @click="openLinkedFeature(link.entity)"
            >
              <span class="feature-position">{{ link.position }}</span>
              <EntityCard :entity="link.entity" />
            </div>
          </div>
        </div>

        <!-- Image Upload -->
        <div class="form-group">
          <label>Image</label>
          <ImageUploader
            :item-class="form.ItemClass"
            :item-id="form.ItemId || 'new'"
            :current-image="form.imagePath"
            @update="handleImageUpdate"
          />
        </div>

        <div class="form-group">
          <label>Tags</label>
          <div class="tags-input">
            <span
              v-for="(tag, idx) in form.Tags"
              :key="idx"
              class="tag-chip"
            >
              {{ tag }}
              <button type="button" @click="removeTag(idx)">×</button>
            </span>
            <input
              type="text"
              v-model="newTag"
              placeholder="Add tag..."
              @keydown.enter.prevent="addTag"
            />
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button
          v-if="!isNew"
          @click="handleDelete"
          class="btn btn-danger"
        >
          Delete
        </button>
        <div class="spacer"></div>
        <button @click="$emit('close')" class="btn btn-secondary">
          Cancel
        </button>
        <button @click="handleSave" class="btn btn-primary" :disabled="hasErrors">
          {{ isNew ? 'Create' : 'Save' }}
        </button>
      </div>
    </div>

    <!-- Help Panel -->
    <div v-if="showHelp" class="help-panel">
      <div class="help-header">
        <h3>Location — requirements</h3>
        <button class="close-btn" @click="showHelp = false">×</button>
      </div>
      <div class="help-content">
        <section class="help-section">
          <h4>Структура</h4>
          <ul>
            <li><code>requirements</code> — массив вариантов активации (ИЛИ между вариантами)</li>
            <li><code>groups</code> — массив групп в варианте (И между группами)</li>
            <li><code>marks</code> — массив меток в группе (ИЛИ между метками)</li>
            <li><code>strict: true</code> — метку нельзя заменить джокером (по умолчанию false)</li>
            <li><code>bonus_marks</code> — бонусные метки для усиления эффекта</li>
          </ul>
          <p>Каждая группа = 1 слот для метки staff.</p>
        </section>

        <section class="help-section">
          <h4>1. Простой случай — нужна 1 метка</h4>
          <p>Отображение: <code>[*]coaching_staff</code></p>
          <pre>"requirements": [
  {
    "groups": [
      { "marks": [{ "type": "coaching_staff" }] }
    ]
  }
]</pre>
        </section>

        <section class="help-section">
          <h4>2. Строгая метка — нельзя джокером</h4>
          <p>Отображение: <code>[!]trainer</code></p>
          <pre>"requirements": [
  {
    "groups": [
      { "marks": [{ "type": "trainer", "strict": true }] }
    ]
  }
]</pre>
        </section>

        <section class="help-section">
          <h4>3. Выбор — scout ИЛИ trainer</h4>
          <p>Отображение: <code>([*]scout | [!]trainer)</code></p>
          <pre>"requirements": [
  {
    "groups": [
      {
        "marks": [
          { "type": "scout" },
          { "type": "trainer", "strict": true }
        ]
      }
    ]
  }
]</pre>
        </section>

        <section class="help-section">
          <h4>4. Две метки — coach И manager</h4>
          <p>Отображение: <code>[*]coach + [*]manager</code></p>
          <pre>"requirements": [
  {
    "groups": [
      { "marks": [{ "type": "coach" }] },
      { "marks": [{ "type": "manager" }] }
    ]
  }
]</pre>
        </section>

        <section class="help-section">
          <h4>5. Две одинаковых метки</h4>
          <p>Отображение: <code>[*]top_management ×2</code></p>
          <pre>"requirements": [
  {
    "groups": [
      { "marks": [{ "type": "top_management" }] },
      { "marks": [{ "type": "top_management" }] }
    ]
  }
]</pre>
        </section>

        <section class="help-section">
          <h4>6. Два варианта активации</h4>
          <p>Отображение: <code>[*]scout // [!]trainer</code></p>
          <pre>"requirements": [
  {
    "groups": [
      { "marks": [{ "type": "scout" }] }
    ]
  },
  {
    "groups": [
      { "marks": [{ "type": "trainer", "strict": true }] }
    ]
  }
]</pre>
        </section>

        <section class="help-section">
          <h4>7. Бонусные метки</h4>
          <p>Отображение: <code>+scouting×2</code></p>
          <pre>"bonus_marks": {
  "scouting": 2
}</pre>
        </section>

      </div>
    </div>
  </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { usePlayFabData } from '../composables/usePlayFabData'
import { useSettings } from '../composables/useSettings'
import { useImageManager } from '../composables/useImageManager'
import { getTypeIcon, isValidJSON, typeIcons } from '../utils/entityHelpers'
import ImageUploader from './ImageUploader.vue'
import EntityCard from './EntityCard.vue'

const props = defineProps({
  entity: Object,
  isNew: Boolean
})

const emit = defineEmits(['close', 'save', 'delete', 'open-linked'])

const { state, generateItemId, updateEntity, createEntity, deleteEntity } = usePlayFabData()
const { getItemTemplates, getTemplate } = useSettings()
const { generateImagePath, hasImage } = useImageManager()

const form = reactive({
  ItemId: '',
  ItemClass: 'player',
  DisplayName: '',
  Description: null,
  CustomData: '',
  Tags: [],
  imagePath: null
})

const newTag = ref('')
const selectedTemplate = ref(null)
const showHelp = ref(false)

// Merge classes from loaded data + config (typeIcons is the source of truth)
const itemClasses = computed(() => {
  const fromData = Array.from(state.itemClasses)
  const fromConfig = Object.keys(typeIcons).filter(c => !c.endsWith('_deck'))
  return [...new Set([...fromConfig, ...fromData])].sort()
})
const availableTemplates = computed(() => getItemTemplates())

// Extract linked features from player's, tactic's or staff's CustomData
const linkedFeatures = computed(() => {
  if (!props.entity || props.isNew) return []

  const itemClass = props.entity.ItemClass
  if (itemClass !== 'player' && itemClass !== 'tactic' && itemClass !== 'staff') return []

  try {
    const data = JSON.parse(props.entity.CustomData || '{}')
    const features = []

    if (itemClass === 'player') {
      // Player: features in position objects (gk, def, mid, att)
      const positions = ['gk', 'def', 'mid', 'att']
      const positionLabels = { gk: 'GK', def: 'DEF', mid: 'MID', att: 'ATT' }

      console.log('[LinkedFeatures] Player CustomData:', data)

      for (const pos of positions) {
        const posData = data[pos]
        console.log(`[LinkedFeatures] Position ${pos}:`, posData)
        if (posData && posData.feature_id) {
          console.log(`[LinkedFeatures] Looking for feature_id: "${posData.feature_id}"`)
          const featureEntity = state.entities.find(e => e.ItemId === posData.feature_id)
          console.log(`[LinkedFeatures] Found entity:`, featureEntity)
          if (featureEntity) {
            features.push({
              position: positionLabels[pos],
              entity: featureEntity
            })
          }
        }
      }
      console.log('[LinkedFeatures] Total features found:', features.length)
    } else if (itemClass === 'tactic') {
      // Tactic: general feature_ids (array of features)
      if (Array.isArray(data.feature_ids)) {
        data.feature_ids.forEach((featureId, index) => {
          const featureEntity = state.entities.find(e => e.ItemId === featureId)
          if (featureEntity) {
            features.push({
              position: `TACTIC #${index + 1}`,
              entity: featureEntity
            })
          }
        })
      }

      // Tactic: slot features in slots[index].feature_ids[]
      if (Array.isArray(data.slots)) {
        data.slots.forEach((slot, slotIndex) => {
          if (!slot || typeof slot !== 'object') return

          if (Array.isArray(slot.feature_ids)) {
            slot.feature_ids.forEach((featureId) => {
              const featureEntity = state.entities.find(e => e.ItemId === featureId)
              if (featureEntity) {
                features.push({
                  position: `SLOT #${slotIndex + 1}`,
                  entity: featureEntity
                })
              }
            })
          }
        })
      }
    } else if (itemClass === 'staff') {
      // Staff: features in marks[].feature_id
      if (Array.isArray(data.marks)) {
        data.marks.forEach((mark) => {
          if (mark && mark.feature_id) {
            const featureEntity = state.entities.find(e => e.ItemId === mark.feature_id)
            if (featureEntity) {
              const markType = mark.type || 'mark'
              features.push({
                position: markType.toUpperCase().replace(/_/g, ' '),
                entity: featureEntity
              })
            }
          }
        })
      }

      // Staff: linked tactics in special.tactics[]
      if (data.special && Array.isArray(data.special.tactics)) {
        data.special.tactics.forEach((tacticId) => {
          const tacticEntity = state.entities.find(e => e.ItemId === tacticId)
          if (tacticEntity) {
            features.push({
              position: 'TACTIC',
              entity: tacticEntity
            })
          }
        })
      }
    }

    return features
  } catch {
    return []
  }
})

function openLinkedFeature(entity) {
  emit('open-linked', entity)
}

// Initialize form
onMounted(async () => {
  if (props.entity && !props.isNew) {
    form.ItemId = props.entity.ItemId
    form.ItemClass = props.entity.ItemClass
    form.DisplayName = props.entity.DisplayName || ''
    form.Description = props.entity.Description
    form.CustomData = props.entity.CustomData || ''
    form.Tags = props.entity.Tags ? [...props.entity.Tags] : []

    // Format CustomData for display and extract imagePath
    if (form.CustomData) {
      try {
        const parsed = JSON.parse(form.CustomData)
        form.imagePath = parsed.imagePath || null
        form.CustomData = JSON.stringify(parsed, null, 2)
      } catch {}
    }

    // If no imagePath in CustomData, try default generated path
    if (!form.imagePath) {
      const defaultPath = generateImagePath(form.ItemClass, form.ItemId)
      if (await hasImage(defaultPath)) {
        form.imagePath = defaultPath
      }
    }
  }
})

// Apply template to form
function applyTemplate(templateName) {
  const template = getTemplate('item', templateName)
  if (!template) return

  selectedTemplate.value = templateName
  form.ItemClass = template.ItemClass
  form.DisplayName = template.DisplayName || ''
  form.Tags = template.Tags ? [...template.Tags] : []

  if (template.CustomData) {
    form.CustomData = JSON.stringify(template.CustomData, null, 2)
  } else {
    form.CustomData = ''
  }

  // Generate ID for the new item class
  generateId()
}

function clearTemplate() {
  selectedTemplate.value = null
  form.DisplayName = ''
  form.CustomData = ''
  form.Tags = []
}

function handleImageUpdate(imagePath) {
  form.imagePath = imagePath
}

// Validation
const idError = computed(() => {
  if (!props.isNew) return null
  if (!form.ItemId) return 'Item ID is required'
  if (state.entities.some(e => e.ItemId === form.ItemId)) {
    return 'Item ID already exists'
  }
  return null
})

const customDataError = computed(() => {
  if (!form.CustomData || form.CustomData.trim() === '') return null
  if (!isValidJSON(form.CustomData)) {
    return 'Invalid JSON'
  }
  return null
})

const hasErrors = computed(() => {
  return !!idError.value || !!customDataError.value
})

function generateId() {
  form.ItemId = generateItemId(form.ItemClass)
}

function formatCustomData() {
  if (form.CustomData && isValidJSON(form.CustomData)) {
    form.CustomData = JSON.stringify(JSON.parse(form.CustomData), null, 2)
  }
}

function fixNestedJson() {
  if (!form.CustomData || !isValidJSON(form.CustomData)) return

  try {
    const data = JSON.parse(form.CustomData)
    let fixed = false

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && value.length > 1) {
        const trimmed = value.trim()
        // Check if value looks like stringified JSON object or array
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            data[key] = JSON.parse(trimmed)
            fixed = true
          } catch {
            // Not valid JSON, keep as string
          }
        }
      }
    }

    if (fixed) {
      form.CustomData = JSON.stringify(data, null, 2)
    }
  } catch {
    // Ignore errors
  }
}

function addTag() {
  const tag = newTag.value.trim()
  if (tag && !form.Tags.includes(tag)) {
    form.Tags.push(tag)
  }
  newTag.value = ''
}

function removeTag(index) {
  form.Tags.splice(index, 1)
}

function handleSave() {
  if (hasErrors.value) return

  // Prepare CustomData with imagePath
  let customDataObj = {}
  if (form.CustomData.trim()) {
    try {
      customDataObj = JSON.parse(form.CustomData)
    } catch {}
  }

  // Add or update imagePath
  if (form.imagePath) {
    customDataObj.imagePath = form.imagePath
  } else {
    delete customDataObj.imagePath
  }

  const customData = Object.keys(customDataObj).length > 0
    ? JSON.stringify(customDataObj)
    : null

  if (props.isNew) {
    createEntity({
      ItemId: form.ItemId,
      ItemClass: form.ItemClass,
      DisplayName: form.DisplayName,
      Description: form.Description,
      CustomData: customData,
      Tags: form.Tags.length > 0 ? form.Tags : null
    })
  } else {
    updateEntity(form.ItemId, {
      DisplayName: form.DisplayName,
      Description: form.Description,
      CustomData: customData,
      Tags: form.Tags.length > 0 ? form.Tags : null
    })
  }

  emit('save')
  emit('close')
}

function handleDelete() {
  if (confirm(`Are you sure you want to delete "${form.DisplayName || form.ItemId}"?`)) {
    deleteEntity(form.ItemId)
    emit('delete')
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

.modal-container {
  display: flex;
  gap: 0;
  max-width: 500px;
  transition: max-width 0.2s ease;
}

.modal-container.with-help {
  max-width: 950px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}

.modal-container.with-help .modal-content {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

/* Help Panel */
.help-panel {
  background: #f8fafc;
  width: 450px;
  max-height: 90vh;
  border-radius: 0 12px 12px 0;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  border-left: 1px solid #e2e8f0;
}

.help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: white;
  border-radius: 0 12px 0 0;
}

.help-header h3 {
  margin: 0;
  font-size: 16px;
  color: #1e293b;
}

.help-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.help-section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e2e8f0;
}

.help-section:last-child {
  border-bottom: none;
}

.help-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px 0;
}

.help-section p {
  font-size: 13px;
  color: #64748b;
  margin: 8px 0;
}

.help-section ul {
  margin: 8px 0;
  padding-left: 20px;
}

.help-section li {
  font-size: 12px;
  color: #64748b;
  margin: 4px 0;
}

.help-section code {
  background: #e2e8f0;
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 11px;
}

.help-section pre {
  background: #1e293b;
  color: #e2e8f0;
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 11px;
  overflow-x: auto;
  margin: 8px 0;
  line-height: 1.4;
}

/* Help button */
.btn-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 6px;
  background: #e2e8f0;
  border: none;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  vertical-align: middle;
}

.btn-help:hover {
  background: #cbd5e1;
  color: #374151;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.modal-header h3 {
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

.form-group {
  margin-bottom: 16px;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row .form-group {
  margin-bottom: 16px;
}

.flex-1 {
  flex: 1;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
}

.form-group input,
.form-group select,
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
.form-group select:focus,
.form-group textarea:focus {
  border-color: #3b82f6;
}

.form-group input.readonly,
.form-group select.readonly {
  background: #f3f4f6;
  color: #6b7280;
}

.form-group input.error,
.form-group textarea.error {
  border-color: #ef4444;
}

.error-text {
  display: block;
  font-size: 12px;
  color: #ef4444;
  margin-top: 4px;
}

.code {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
}

.input-with-btn {
  display: flex;
  gap: 8px;
}

.input-with-btn input {
  flex: 1;
}

.btn-generate,
.btn-format {
  padding: 8px 12px;
  background: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.json-buttons {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.btn-fix {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #92400e;
}

.btn-fix:hover {
  background: #fde68a;
}

.btn-generate:hover,
.btn-format:hover {
  background: #e5e7eb;
}

.tags-input {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  min-height: 40px;
}

.tags-input input {
  flex: 1;
  min-width: 100px;
  border: none;
  padding: 4px;
  font-size: 14px;
}

.tags-input input:focus {
  outline: none;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #e0e7ff;
  color: #3730a3;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
}

.tag-chip button {
  background: none;
  border: none;
  color: #6366f1;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  line-height: 1;
}

.tag-chip button:hover {
  color: #4338ca;
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

/* Template selector */
.template-selector {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.template-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.template-chip {
  padding: 8px 14px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.template-chip:hover {
  background: #e5e7eb;
}

.template-chip.active {
  background: #dbeafe;
  border-color: #3b82f6;
  color: #1d4ed8;
}

/* Linked Features */
.linked-features {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.features-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.feature-item:hover {
  background: #eff6ff;
  border-color: #3b82f6;
}

.feature-position {
  font-size: 11px;
  font-weight: 600;
  color: #1d4ed8;
  background: #dbeafe;
  padding: 4px 8px;
  border-radius: 4px;
  min-width: 36px;
  text-align: center;
}

.feature-item :deep(.entity-card) {
  flex: 1;
  margin-bottom: 0;
  box-shadow: none;
  background: transparent;
}
</style>
