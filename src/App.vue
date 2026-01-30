<template>
  <div class="app" :class="{ loaded: isLoaded }">
    <!-- Header -->
    <header class="app-header">
      <div class="header-left">
        <h1>PlayFab Bundle Editor</h1>
        <span class="version">v1.1</span>
      </div>
      <div class="header-center" v-if="isLoaded">
        <!-- Undo/Redo controls -->
        <div class="history-controls">
          <button
            @click="undo"
            :disabled="!canUndo"
            class="btn-icon"
            title="Undo (Ctrl+Z)"
          >
            <span>Undo</span>
          </button>
          <button
            @click="redo"
            :disabled="!canRedo"
            class="btn-icon"
            title="Redo (Ctrl+Y)"
          >
            <span>Redo</span>
          </button>
        </div>
        <!-- Auto-save status -->
        <div class="autosave-status" v-if="isLoaded">
          <span v-if="hasUnsavedChanges" class="status-unsaved">
            * Unsaved
          </span>
          <span v-else class="status-saved">
            Saved
          </span>
        </div>
      </div>
      <div class="header-right">
        <button v-if="isLoaded" @click="openBundleCreator" class="btn-header">
          + Bundle
        </button>
        <FileUploader @loaded="handleLoaded" />
        <ExportButton />
        <button @click="openSettings" class="btn-header btn-settings" title="Settings">
          [=]
        </button>
      </div>
    </header>

    <!-- Main content -->
    <main class="app-main" v-if="isLoaded">
      <!-- Grid View (default) -->
      <template v-if="viewMode === 'grid'">
        <aside class="sidebar">
          <EntityPool
            @edit="openEditor"
            @create="openCreator"
          />
        </aside>
        <section class="content">
          <!-- Warnings Dashboard -->
          <WarningsDashboard
            class="warnings-panel"
            @view-item="handleViewItem"
          />
          <BundleGrid
            @edit="openEditor"
            @edit-bundle="openBundleEditor"
            @focus="enterFocusMode"
          />
        </section>
      </template>

      <!-- Focus View -->
      <BundleFocusView
        v-else-if="viewMode === 'focus' && focusedBundleId"
        :bundle-id="focusedBundleId"
        @exit="exitFocusMode"
        @edit-bundle="openBundleEditor"
        @edit-item="openEditor"
      />
    </main>

    <!-- Welcome screen -->
    <div v-if="!isLoaded" class="welcome">
      <!-- Auto-save restore dialog -->
      <div v-if="showRestoreDialog" class="restore-dialog-overlay">
        <div class="restore-dialog">
          <h3>Restore Previous Session?</h3>
          <p>Found auto-saved data from {{ autoSaveAge }}.</p>
          <p>Would you like to restore it?</p>
          <div class="restore-actions">
            <button @click="handleRestore(true)" class="btn-primary">
              Restore
            </button>
            <button @click="handleRestore(false)" class="btn-secondary">
              Discard
            </button>
          </div>
        </div>
      </div>
      <div class="welcome-content">
        <h2>Welcome to PlayFab Bundle Editor</h2>
        <p>Load a PlayFab catalog JSON file to get started.</p>
        <div class="welcome-features">
          <div class="feature">
            <span class="feature-icon">📦</span>
            <span>Drag & drop entities between bundles</span>
          </div>
          <div class="feature">
            <span class="feature-icon">✏️</span>
            <span>Edit entity and bundle properties</span>
          </div>
          <div class="feature">
            <span class="feature-icon">📊</span>
            <span>View bundle statistics automatically</span>
          </div>
          <div class="feature">
            <span class="feature-icon">💾</span>
            <span>Export changes back to JSON</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Entity Editor Modal -->
    <EntityEditor
      v-if="editorVisible"
      :entity="editingEntity"
      :is-new="isCreating"
      @close="closeEditor"
      @save="handleSave"
      @delete="handleDelete"
      @open-linked="handleOpenLinked"
    />

    <!-- Bundle Editor Modal -->
    <BundleEditor
      v-if="bundleEditorVisible"
      :bundle="editingBundle"
      @close="closeBundleEditor"
      @save="handleBundleSave"
      @delete="handleBundleDelete"
    />

    <!-- Bundle Creator Modal -->
    <BundleCreator
      v-if="bundleCreatorVisible"
      @close="closeBundleCreator"
      @created="handleBundleCreated"
      @created-and-edit="handleBundleCreatedAndEdit"
    />

    <!-- Settings Modal -->
    <SettingsModal
      v-if="settingsVisible"
      @close="closeSettings"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import FileUploader from './components/FileUploader.vue'
import ExportButton from './components/ExportButton.vue'
import EntityPool from './components/EntityPool.vue'
import BundleGrid from './components/BundleGrid.vue'
import EntityEditor from './components/EntityEditor.vue'
import BundleEditor from './components/BundleEditor.vue'
import BundleCreator from './components/BundleCreator.vue'
import SettingsModal from './components/SettingsModal.vue'
import WarningsDashboard from './components/WarningsDashboard.vue'
import BundleFocusView from './components/BundleFocusView.vue'
import { usePlayFabData } from './composables/usePlayFabData'
import { useSettings } from './composables/useSettings'
import { useHistory } from './composables/useHistory'
import { useAutoSave } from './composables/useAutoSave'

const { state } = usePlayFabData()
const { loadSettings } = useSettings()
const { undo, redo, canUndo, canRedo, setupKeyboardShortcuts, cleanupKeyboardShortcuts } = useHistory()
const {
  hasUnsavedChanges: autoSaveUnsaved,
  checkForAutoSave,
  restoreAutoSave,
  clearAutoSave,
  init: initAutoSave,
  cleanup: cleanupAutoSave
} = useAutoSave()

const isLoaded = ref(false)

// Entity editor state
const editorVisible = ref(false)
const editingEntity = ref(null)
const isCreating = ref(false)

// Bundle editor state
const bundleEditorVisible = ref(false)
const editingBundle = ref(null)

// Bundle creator state
const bundleCreatorVisible = ref(false)

// Settings state
const settingsVisible = ref(false)

// Focus mode state
const viewMode = ref('grid') // 'grid' | 'focus'
const focusedBundleId = ref(null)

// Auto-save restore dialog
const showRestoreDialog = ref(false)
const autoSaveAge = ref('')
const pendingAutoSave = ref(null)

const hasUnsavedChanges = computed(() => autoSaveUnsaved.value)

onMounted(() => {
  loadSettings()
  setupKeyboardShortcuts()
  initAutoSave()

  // Check for auto-save
  const autoSave = checkForAutoSave()
  if (autoSave.exists) {
    autoSaveAge.value = autoSave.formattedAge
    pendingAutoSave.value = autoSave.data
    showRestoreDialog.value = true
  }
})

onUnmounted(() => {
  cleanupKeyboardShortcuts()
  cleanupAutoSave()
})

function handleLoaded(data) {
  isLoaded.value = true
  console.log('Loaded:', data.Catalog.length, 'entities')
}

// Entity editor functions
function openEditor(entity) {
  editingEntity.value = entity
  isCreating.value = false
  editorVisible.value = true
}

function openCreator() {
  editingEntity.value = null
  isCreating.value = true
  editorVisible.value = true
}

function closeEditor() {
  editorVisible.value = false
  editingEntity.value = null
}

function handleSave() {
  console.log('Entity saved')
}

function handleDelete() {
  console.log('Entity deleted')
}

function handleOpenLinked(entity) {
  // Close current editor and open the linked entity
  closeEditor()
  // Use nextTick to ensure the modal is closed before opening new one
  setTimeout(() => {
    openEditor(entity)
  }, 50)
}

// Bundle editor functions
function openBundleEditor(bundle) {
  editingBundle.value = bundle
  bundleEditorVisible.value = true
}

function closeBundleEditor() {
  bundleEditorVisible.value = false
  editingBundle.value = null
}

function handleBundleSave(bundle) {
  console.log('Bundle saved:', bundle.ItemId)
}

function handleBundleDelete(bundleId) {
  console.log('Bundle deleted:', bundleId)
}

// Bundle creator functions
function openBundleCreator() {
  bundleCreatorVisible.value = true
}

function closeBundleCreator() {
  bundleCreatorVisible.value = false
}

function handleBundleCreated(bundle) {
  console.log('Bundle created:', bundle.ItemId)
}

function handleBundleCreatedAndEdit(bundle) {
  console.log('Bundle created, entering focus mode:', bundle.ItemId)
  enterFocusMode(bundle)
}

// Settings functions
function openSettings() {
  settingsVisible.value = true
}

function closeSettings() {
  settingsVisible.value = false
}

// Auto-save restore handler
function handleRestore(shouldRestore) {
  if (shouldRestore && pendingAutoSave.value) {
    restoreAutoSave(pendingAutoSave.value)
    isLoaded.value = true
  } else {
    clearAutoSave()
  }
  showRestoreDialog.value = false
  pendingAutoSave.value = null
}

// View item from warnings dashboard
function handleViewItem(item) {
  openEditor(item)
}

// Focus mode functions
function enterFocusMode(bundle) {
  focusedBundleId.value = bundle.ItemId
  viewMode.value = 'focus'
}

function exitFocusMode() {
  viewMode.value = 'grid'
  focusedBundleId.value = null
}
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background: #f1f5f9;
  color: #1e293b;
  line-height: 1.5;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #1e293b;
  color: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-left h1 {
  font-size: 20px;
  font-weight: 600;
}

.version {
  background: #3b82f6;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.header-right {
  display: flex;
  gap: 12px;
}

.app-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 320px;
  min-width: 280px;
  max-width: 380px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.welcome {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
}

.welcome-content {
  text-align: center;
  max-width: 500px;
  padding: 40px;
}

.welcome-content h2 {
  font-size: 28px;
  color: #1e293b;
  margin-bottom: 12px;
}

.welcome-content p {
  font-size: 16px;
  color: #64748b;
  margin-bottom: 32px;
}

.welcome-features {
  display: grid;
  gap: 16px;
  text-align: left;
}

.feature {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.feature-icon {
  font-size: 24px;
}

.feature span:last-child {
  color: #374151;
  font-size: 14px;
}

/* Header center section */
.header-center {
  display: flex;
  align-items: center;
  gap: 20px;
}

.history-controls {
  display: flex;
  gap: 4px;
}

.btn-icon {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-icon:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.btn-icon:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.autosave-status {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 4px;
}

.status-unsaved {
  color: #fbbf24;
}

.status-saved {
  color: #34d399;
}

/* Warnings panel */
.warnings-panel {
  margin: 16px;
  margin-bottom: 0;
}

/* Restore dialog */
.restore-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.restore-dialog {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}

.restore-dialog h3 {
  margin-bottom: 12px;
  color: #1e293b;
}

.restore-dialog p {
  color: #64748b;
  margin-bottom: 8px;
  font-size: 14px;
}

.restore-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 20px;
}

.btn-primary {
  padding: 10px 24px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  padding: 10px 24px;
  background: #f3f4f6;
  color: #374151;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

/* Header buttons */
.btn-header {
  padding: 8px 14px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-header:hover {
  background: rgba(255, 255, 255, 0.2);
}

.btn-settings {
  padding: 8px 10px;
}
</style>
