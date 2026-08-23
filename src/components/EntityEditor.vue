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
            <div class="input-with-btn">
              <input
                type="text"
                :value="form.ItemId"
                disabled
                class="readonly"
              />
              <button type="button" @click="openRename" class="btn-generate">
                Rename
              </button>
            </div>
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

        <!-- Rename with reference rewrite -->
        <div v-if="renaming" class="rename-panel">
          <label>Rename to</label>
          <div class="input-with-btn">
            <input
              type="text"
              v-model="renameId"
              :class="{ error: renameError }"
              placeholder="new item id"
              @keyup.enter="confirmRename"
            />
            <button type="button" @click="confirmRename" class="btn-rename" :disabled="!!renameError">
              Apply
            </button>
            <button type="button" @click="renaming = false" class="btn-cancel-rename">
              Cancel
            </button>
          </div>

          <span v-if="renameError" class="error-text">{{ renameError }}</span>
          <span v-else-if="renameFormatWarning" class="warn-text">{{ renameFormatWarning }}</span>

          <div class="rename-preview">
            <div v-if="renameReferences.length === 0" class="rename-empty">
              Nothing else in the catalog points at this ID — only the entity itself changes.
            </div>
            <div v-else>
              <div class="rename-preview-title">
                Will also rewrite {{ renamePathCount }}
                {{ renamePathCount === 1 ? 'reference' : 'references' }}
                in {{ renameReferences.length }}
                {{ renameReferences.length === 1 ? 'entity' : 'entities' }}:
              </div>
              <div
                v-for="ref in renameReferences"
                :key="ref.entity.ItemId"
                class="rename-ref"
              >
                <span class="rename-ref-icon">{{ getTypeIcon(ref.entity.ItemClass) }}</span>
                <span class="rename-ref-name">{{ ref.entity.DisplayName || ref.entity.ItemId }}</span>
                <span class="rename-ref-id">{{ ref.entity.ItemId }}</span>
                <span class="rename-ref-paths">{{ ref.paths.join(', ') }}</span>
              </div>
            </div>

            <div v-if="renameImageNote" class="rename-note">{{ renameImageNote }}</div>
          </div>
        </div>

        <!-- Assigned To (reverse references) -->
        <div v-if="!isNew && assignedTo.length > 0" class="assigned-to-section">
          <label>Assigned To</label>
          <div class="assigned-to-list">
            <div
              v-for="(a, idx) in assignedTo"
              :key="idx"
              class="assigned-to-item"
              :class="'ref-' + a.type"
              @click="openLinkedFeature(a.entity)"
            >
              <span class="assigned-to-type">{{ assignmentTypeLabels[a.type] || a.type }}</span>
              <span class="assigned-to-icon">{{ getTypeIcon(a.entity.ItemClass) }}</span>
              <span class="assigned-to-name">{{ a.entity.DisplayName || a.entity.ItemId }}</span>
              <span class="assigned-to-id">{{ a.entity.ItemId }}</span>
            </div>
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

        <!-- Linked Debuffs (for players) -->
        <div v-if="linkedDebuffs.length > 0" class="form-group linked-debuffs">
          <label>Linked Debuffs</label>
          <div class="features-list">
            <div
              v-for="link in linkedDebuffs"
              :key="link.entity.ItemId"
              class="feature-item"
              @click="openLinkedFeature(link.entity)"
            >
              <span class="feature-position debuff">{{ link.position }}</span>
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
        <button
          v-if="!isNew"
          @click="handleDuplicate"
          class="btn btn-secondary"
          title="Create a copy with a new ItemId (image not copied)"
        >
          Duplicate
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
          <p>Каждая группа = 1 слот для метки персонала.</p>
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
import { getTypeIcon, isValidJSON, typeIcons, isDeprecatedClass } from '../utils/entityHelpers'
import ImageUploader from './ImageUploader.vue'
import EntityCard from './EntityCard.vue'

const props = defineProps({
  entity: Object,
  isNew: Boolean
})

const emit = defineEmits(['close', 'save', 'delete', 'open-linked', 'duplicate'])

const { state, generateItemId, updateEntity, createEntity, deleteEntity, getEntityAssignments, findReferences, renameEntity } = usePlayFabData()
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

// Rename: ItemId is the join key, so every reference is rewritten in the same pass
const renaming = ref(false)
const renameId = ref('')

function openRename() {
  renameId.value = form.ItemId
  renaming.value = true
}

const renameReferences = computed(() =>
  props.isNew ? [] : findReferences(props.entity?.ItemId)
)

const renamePathCount = computed(() =>
  renameReferences.value.reduce((sum, ref) => sum + ref.paths.length, 0)
)

const renameError = computed(() => {
  const next = renameId.value.trim()
  if (!next) return 'ID cannot be empty'
  if (next === form.ItemId) return 'The ID is unchanged'
  if (/\s/.test(next)) return 'ID cannot contain spaces'
  if (state.entities.some(e => e.ItemId === next)) return `ID "${next}" is already taken`
  return ''
})

const renameFormatWarning = computed(() => {
  const next = renameId.value.trim()
  const expected = `${form.ItemClass}_`
  if (!next || renameError.value) return ''
  return next.startsWith(expected)
    ? ''
    : `Heads up: ${form.ItemClass} IDs normally start with "${expected}"`
})

// An explicit imagePath keeps pointing at the same file, a convention-based one does not
const renameImageNote = computed(() => {
  if (props.isNew) return ''
  return form.imagePath
    ? ''
    : 'This entity has no explicit imagePath, so any image found by the old ID convention will need re-linking.'
})

function confirmRename() {
  if (renameError.value) return

  const next = renameId.value.trim()
  const result = renameEntity(props.entity.ItemId, next)
  if (!result.ok) {
    console.error('Rename failed:', result.error)
    return
  }

  form.ItemId = next
  // The entity's own CustomData may have been rewritten too
  form.CustomData = props.entity.CustomData
    ? JSON.stringify(JSON.parse(props.entity.CustomData), null, 2)
    : ''
  renaming.value = false
}

// Merge classes from loaded data + config (typeIcons is the source of truth)
const itemClasses = computed(() => {
  const fromData = Array.from(state.itemClasses)
  const fromConfig = Object.keys(typeIcons).filter(c => !c.endsWith('_deck'))
  return [...new Set([...fromConfig, ...fromData])]
    .filter(c => !isDeprecatedClass(c))
    .sort()
})
const availableTemplates = computed(() => getItemTemplates())

// Extract linked features from player's, tactic's or staff's CustomData
const linkedFeatures = computed(() => {
  if (!props.entity || props.isNew) return []

  const itemClass = props.entity.ItemClass
  if (itemClass !== 'player' && itemClass !== 'tactic') return []

  try {
    const data = JSON.parse(props.entity.CustomData || '{}')
    const features = []

    if (itemClass === 'player') {
      // Player: features in top-level feature_ids array
      if (Array.isArray(data.feature_ids)) {
        data.feature_ids.forEach((featureId, index) => {
          const featureEntity = state.entities.find(e => e.ItemId === featureId)
          if (featureEntity) {
            features.push({
              position: `FEATURE #${index + 1}`,
              entity: featureEntity
            })
          }
        })
      }
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
    }

    return features
  } catch {
    return []
  }
})

const linkedDebuffs = computed(() => {
  if (!props.entity || props.isNew) return []
  if (props.entity.ItemClass !== 'player') return []

  try {
    const data = JSON.parse(props.entity.CustomData || '{}')
    const debuffs = []

    if (data.debuff_ids && typeof data.debuff_ids === 'object') {
      Object.keys(data.debuff_ids).forEach((debuffId, index) => {
        const debuffEntity = state.entities.find(e => e.ItemId === debuffId)
        if (debuffEntity) {
          debuffs.push({
            position: `DEBUFF #${index + 1}`,
            entity: debuffEntity
          })
        }
      })
    }

    return debuffs
  } catch {
    return []
  }
})

// Reverse references — who points to this entity
const assignedTo = computed(() => {
  if (!props.entity || props.isNew) return []
  return getEntityAssignments(props.entity.ItemId)
})

const assignmentTypeLabels = {
  bundle: 'Bundle',
  infra_ref: 'Infra slot of',
  roster_ref: 'Roster of',
  custom_ref: 'Referenced by',
  feature_ref: 'Feature of',
  slot_ref: 'Slot in',
  debuff_ref: 'Debuff of',
  mark_ref: 'Mark in',
  tactic_ref: 'Tactic of'
}

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
  } else if (props.isNew && props.entity?.ItemClass) {
    // Pre-select ItemClass when creating from Entity Browser
    form.ItemClass = props.entity.ItemClass
    form.ItemId = generateItemId(props.entity.ItemClass)
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

function handleDuplicate() {
  // Build CustomData from current form, stripping imagePath (image is not copied)
  let customDataObj = {}
  if (form.CustomData.trim()) {
    try {
      customDataObj = JSON.parse(form.CustomData)
    } catch {}
  }
  delete customDataObj.imagePath
  const customData = Object.keys(customDataObj).length > 0
    ? JSON.stringify(customDataObj)
    : null

  const newId = generateItemId(form.ItemClass)
  const created = createEntity({
    ItemId: newId,
    ItemClass: form.ItemClass,
    DisplayName: form.DisplayName,
    Description: form.Description,
    CustomData: customData,
    Tags: form.Tags.length > 0 ? [...form.Tags] : null
  })

  emit('duplicate', created)
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

/* Assigned To section */
.rename-panel {
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  background: #eff6ff;
}

.rename-panel label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #1e40af;
}

.btn-rename {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  background: #2563eb;
  color: white;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

.btn-rename:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-rename:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-cancel-rename {
  padding: 8px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: white;
  color: #475569;
  font-size: 13px;
  cursor: pointer;
}

.btn-cancel-rename:hover {
  background: #f1f5f9;
}

.warn-text {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #b45309;
}

.rename-preview {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #bfdbfe;
  font-size: 12px;
  color: #1e3a8a;
}

.rename-preview-title {
  margin-bottom: 6px;
  font-weight: 600;
}

.rename-empty {
  color: #475569;
}

.rename-ref {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 3px 0;
}

.rename-ref-name {
  font-weight: 500;
}

.rename-ref-id,
.rename-ref-paths {
  font-family: monospace;
  font-size: 11px;
  color: #64748b;
}

.rename-ref-paths {
  margin-left: auto;
  text-align: right;
}

.rename-note {
  margin-top: 8px;
  font-size: 11px;
  color: #b45309;
}

.assigned-to-section {
  margin-bottom: 16px;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.assigned-to-section label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.assigned-to-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.assigned-to-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.assigned-to-item:hover {
  border-color: #3b82f6;
  background: #eff6ff;
}

.assigned-to-type {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

.assigned-to-item.ref-bundle .assigned-to-type {
  background: #dbeafe;
  color: #1d4ed8;
}

.assigned-to-item.ref-feature_ref .assigned-to-type,
.assigned-to-item.ref-slot_ref .assigned-to-type {
  background: #ede9fe;
  color: #6d28d9;
}

.assigned-to-item.ref-debuff_ref .assigned-to-type {
  background: #fee2e2;
  color: #dc2626;
}

.assigned-to-item.ref-mark_ref .assigned-to-type {
  background: #d1fae5;
  color: #065f46;
}

.assigned-to-item.ref-tactic_ref .assigned-to-type {
  background: #f3e8ff;
  color: #7c3aed;
}

.assigned-to-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.assigned-to-name {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.assigned-to-id {
  font-size: 11px;
  color: #94a3b8;
  font-family: monospace;
  white-space: nowrap;
  flex-shrink: 0;
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

.feature-position.debuff {
  color: #dc2626;
  background: #fee2e2;
}

.linked-debuffs label {
  color: #dc2626;
}

.feature-item :deep(.entity-card) {
  flex: 1;
  margin-bottom: 0;
  box-shadow: none;
  background: transparent;
}
</style>
