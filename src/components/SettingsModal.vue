<template>
  <div class="modal-overlay">
    <div class="modal-content settings-modal">
      <div class="modal-header">
        <h2>Settings</h2>
        <button @click="$emit('close')" class="close-btn">x</button>
      </div>

      <div class="settings-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.icon }} {{ tab.label }}
        </button>
      </div>

      <div class="modal-body">
        <!-- Templates Tab -->
        <div v-if="activeTab === 'templates'" class="tab-content">
          <section class="settings-section">
            <h3>Item Templates</h3>
            <p class="section-desc">Templates for creating new entities</p>
            <div class="template-list">
              <div
                v-for="(template, id) in settings.templates.items"
                :key="id"
                class="template-item"
              >
                <div class="template-info">
                  <span class="template-icon">{{ getTypeIcon(template.ItemClass) }}</span>
                  <span class="template-name">{{ id }}</span>
                  <span class="template-class">{{ template.ItemClass }}</span>
                </div>
                <div class="template-actions">
                  <button @click="editItemTemplate(id)" class="btn-small">Edit</button>
                  <button @click="deleteItemTemplate(id)" class="btn-small btn-danger">Delete</button>
                </div>
              </div>
            </div>
            <button @click="createItemTemplate" class="btn-add">+ Add Item Template</button>
          </section>

          <section class="settings-section">
            <h3>Bundle Templates</h3>
            <p class="section-desc">Presets for creating bundles with auto-populated items</p>
            <div class="template-list">
              <div
                v-for="(template, id) in settings.templates.bundles"
                :key="id"
                class="template-item"
              >
                <div class="template-info">
                  <span class="template-icon">{{ getTypeIcon(template.bundleClass) }}</span>
                  <span class="template-name">{{ template.name }}</span>
                  <span class="template-class">{{ template.bundleClass }}</span>
                </div>
                <div class="template-actions">
                  <button @click="editBundleTemplate(id)" class="btn-small">Edit</button>
                  <button @click="deleteBundleTemplate(id)" class="btn-small btn-danger">Delete</button>
                </div>
              </div>
            </div>
            <button @click="createBundleTemplate" class="btn-add">+ Add Bundle Template</button>
          </section>
        </div>

        <!-- UI Tab -->
        <div v-if="activeTab === 'ui'" class="tab-content">
          <section class="settings-section">
            <h3>Appearance</h3>

            <div class="form-group">
              <label>Theme</label>
              <select v-model="settings.uiPreferences.theme">
                <option value="light">Light</option>
                <option value="dark">Dark (coming soon)</option>
              </select>
            </div>

            <div class="form-group">
              <label>Bundle Grid Columns: {{ settings.uiPreferences.bundleGridColumns }}</label>
              <input
                type="range"
                v-model.number="settings.uiPreferences.bundleGridColumns"
                min="2"
                max="6"
              />
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="settings.uiPreferences.showPreviews" />
                <span>Show image previews in cards</span>
              </label>
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="settings.uiPreferences.autoCollapseWarnings" />
                <span>Auto-collapse warnings dashboard</span>
              </label>
            </div>
          </section>

          <section class="settings-section">
            <h3>Auto-save</h3>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" v-model="settings.lastSession.autoSaveEnabled" />
                <span>Enable auto-save (every 30 seconds)</span>
              </label>
            </div>
          </section>
        </div>

        <!-- Data Tab -->
        <div v-if="activeTab === 'data'" class="tab-content">
          <section class="settings-section">
            <h3>Export / Import Settings</h3>
            <p class="section-desc">Backup or transfer your templates and preferences</p>
            <div class="data-actions">
              <button @click="handleExportSettings" class="btn btn-secondary">
                Export Settings
              </button>
              <button @click="triggerImportSettings" class="btn btn-secondary">
                Import Settings
              </button>
              <input
                ref="importInput"
                type="file"
                accept=".json"
                @change="handleImportSettings"
                style="display: none"
              />
            </div>
          </section>

          <section class="settings-section">
            <h3>Clear Data</h3>
            <p class="section-desc">Remove stored images or reset settings</p>
            <div class="data-actions">
              <button @click="handleClearImages" class="btn btn-warning">
                Clear All Images
              </button>
              <button @click="handleResetSettings" class="btn btn-danger">
                Reset to Defaults
              </button>
            </div>
          </section>
        </div>
      </div>

      <!-- Template Editor Modal -->
      <div v-if="showTemplateEditor" class="template-editor-overlay">
        <div class="template-editor">
          <div class="editor-header">
            <h3>{{ editingTemplateId ? 'Edit' : 'Create' }} {{ editingTemplateType === 'item' ? 'Item' : 'Bundle' }} Template</h3>
            <button @click="closeTemplateEditor" class="close-btn">x</button>
          </div>
          <div class="editor-body">
            <div class="form-group">
              <label>Template ID</label>
              <input
                v-model="templateForm.id"
                :disabled="!!editingTemplateId"
                placeholder="e.g., player_striker"
              />
            </div>

            <template v-if="editingTemplateType === 'item'">
              <div class="form-group">
                <label>Item Class</label>
                <select v-model="templateForm.data.ItemClass">
                  <option value="player">player</option>
                  <option value="staff">staff</option>
                  <option value="team">team</option>
                  <option value="tactic">tactic</option>
                  <option value="club">club</option>
                  <option value="location">location</option>
                </select>
              </div>
              <div class="form-group">
                <label>Display Name</label>
                <input v-model="templateForm.data.DisplayName" placeholder="New Player" />
              </div>
              <div class="form-group">
                <label>Custom Data (JSON)</label>
                <textarea
                  v-model="templateForm.customDataStr"
                  rows="8"
                  class="code"
                  placeholder="{}"
                ></textarea>
              </div>
            </template>

            <template v-else>
              <div class="form-group">
                <label>Template Name</label>
                <input v-model="templateForm.data.name" placeholder="Starter Club" />
              </div>
              <div class="form-group">
                <label>Description</label>
                <input v-model="templateForm.data.description" placeholder="Basic club for new players" />
              </div>
              <div class="form-group">
                <label>Bundle Class</label>
                <select v-model="templateForm.data.bundleClass">
                  <option value="club">club</option>
                  <option value="market_deck">market_deck</option>
                  <option value="lootbox">lootbox</option>
                </select>
              </div>
              <div class="form-group">
                <label>Item Requirements (JSON)</label>
                <textarea
                  v-model="templateForm.requirementsStr"
                  rows="6"
                  class="code"
                  placeholder='{"player": {"count": 5}}'
                ></textarea>
              </div>
            </template>
          </div>
          <div class="editor-footer">
            <button @click="closeTemplateEditor" class="btn btn-secondary">Cancel</button>
            <button @click="saveTemplate" class="btn btn-primary">Save Template</button>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button @click="$emit('close')" class="btn btn-primary">
          Done
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useSettings } from '../composables/useSettings'
import { useImageManager } from '../composables/useImageManager'
import { getTypeIcon } from '../utils/entityHelpers'

const emit = defineEmits(['close'])

const { settings, exportSettings, importSettings, resetSettings, saveTemplate: saveSettingsTemplate, deleteTemplate } = useSettings()
const { clearAllImages } = useImageManager()

const importInput = ref(null)

const tabs = [
  { id: 'templates', icon: '[ ]', label: 'Templates' },
  { id: 'ui', icon: '[#]', label: 'Interface' },
  { id: 'data', icon: '[D]', label: 'Data' }
]

const activeTab = ref('templates')

// Template Editor State
const showTemplateEditor = ref(false)
const editingTemplateType = ref('item')
const editingTemplateId = ref(null)
const templateForm = reactive({
  id: '',
  data: {},
  customDataStr: '{}',
  requirementsStr: '{}',
  currenciesStr: '{}'
})

function editItemTemplate(id) {
  editingTemplateType.value = 'item'
  editingTemplateId.value = id
  const template = settings.templates.items[id]
  templateForm.id = id
  templateForm.data = { ...template }
  templateForm.customDataStr = JSON.stringify(template.CustomData || {}, null, 2)
  showTemplateEditor.value = true
}

function createItemTemplate() {
  editingTemplateType.value = 'item'
  editingTemplateId.value = null
  templateForm.id = ''
  templateForm.data = {
    ItemClass: 'player',
    DisplayName: 'New Item',
    Tags: [],
    IsStackable: false,
    IsTradable: false
  }
  templateForm.customDataStr = '{}'
  showTemplateEditor.value = true
}

function deleteItemTemplate(id) {
  if (confirm(`Delete item template "${id}"?`)) {
    deleteTemplate('item', id)
  }
}

function editBundleTemplate(id) {
  editingTemplateType.value = 'bundle'
  editingTemplateId.value = id
  const template = settings.templates.bundles[id]
  templateForm.id = id
  templateForm.data = { ...template }
  templateForm.requirementsStr = JSON.stringify(template.itemRequirements || {}, null, 2)
  templateForm.currenciesStr = JSON.stringify(template.virtualCurrencies || {}, null, 2)
  showTemplateEditor.value = true
}

function createBundleTemplate() {
  editingTemplateType.value = 'bundle'
  editingTemplateId.value = null
  templateForm.id = ''
  templateForm.data = {
    name: 'New Bundle',
    description: '',
    bundleClass: 'club'
  }
  templateForm.requirementsStr = '{\n  "player": { "count": 5 },\n  "team": { "count": 1 }\n}'
  templateForm.currenciesStr = '{\n  "CO": 1000\n}'
  showTemplateEditor.value = true
}

function deleteBundleTemplate(id) {
  if (confirm(`Delete bundle template "${id}"?`)) {
    deleteTemplate('bundle', id)
  }
}

function closeTemplateEditor() {
  showTemplateEditor.value = false
  editingTemplateId.value = null
}

function saveTemplate() {
  if (!templateForm.id) {
    alert('Template ID is required')
    return
  }

  try {
    if (editingTemplateType.value === 'item') {
      const template = {
        ...templateForm.data,
        CustomData: JSON.parse(templateForm.customDataStr)
      }
      saveSettingsTemplate('item', templateForm.id, template)
    } else {
      const template = {
        ...templateForm.data,
        itemRequirements: JSON.parse(templateForm.requirementsStr),
        virtualCurrencies: JSON.parse(templateForm.currenciesStr)
      }
      saveSettingsTemplate('bundle', templateForm.id, template)
    }
    closeTemplateEditor()
  } catch (e) {
    alert('Invalid JSON: ' + e.message)
  }
}

function handleExportSettings() {
  exportSettings()
}

function triggerImportSettings() {
  importInput.value?.click()
}

async function handleImportSettings(event) {
  const file = event.target.files[0]
  if (file) {
    try {
      await importSettings(file)
      alert('Settings imported successfully')
    } catch (e) {
      alert('Failed to import settings: ' + e.message)
    }
  }
  event.target.value = ''
}

function handleClearImages() {
  if (confirm('This will delete all stored images. Continue?')) {
    clearAllImages()
    alert('All images cleared')
  }
}

function handleResetSettings() {
  if (confirm('This will reset all settings to defaults. Continue?')) {
    resetSettings()
    alert('Settings reset to defaults')
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
  max-width: 650px;
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
}

.settings-tabs {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  padding: 0 20px;
}

.settings-tabs button {
  padding: 12px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: #6b7280;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
}

.settings-tabs button:hover {
  color: #1e293b;
}

.settings-tabs button.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.tab-content {
  min-height: 300px;
}

.settings-section {
  margin-bottom: 28px;
}

.settings-section h3 {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
}

.section-desc {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 12px;
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.template-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.template-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.template-icon {
  font-size: 16px;
}

.template-name {
  font-weight: 500;
  color: #1e293b;
}

.template-class {
  font-size: 11px;
  color: #6b7280;
  background: #e5e7eb;
  padding: 2px 6px;
  border-radius: 3px;
}

.template-actions {
  display: flex;
  gap: 6px;
}

.btn-small {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  cursor: pointer;
}

.btn-small:hover {
  background: #f3f4f6;
}

.btn-small.btn-danger {
  color: #dc2626;
  border-color: #fecaca;
}

.btn-small.btn-danger:hover {
  background: #fef2f2;
}

.btn-add {
  width: 100%;
  padding: 10px;
  background: #f0f9ff;
  border: 1px dashed #3b82f6;
  border-radius: 6px;
  color: #3b82f6;
  font-size: 13px;
  cursor: pointer;
}

.btn-add:hover {
  background: #dbeafe;
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

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #3b82f6;
}

.form-group input[type="range"] {
  padding: 0;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input {
  width: auto;
}

.data-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
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

.btn-warning {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
}

.btn-warning:hover {
  background: #fde68a;
}

.btn-danger {
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
}

.btn-danger:hover {
  background: #fecaca;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
}

/* Template Editor Overlay */
.template-editor-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.template-editor {
  background: white;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.editor-header h3 {
  margin: 0;
  font-size: 16px;
}

.editor-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e5e7eb;
}

.code {
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
}
</style>
