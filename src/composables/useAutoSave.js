import { ref, watch, onMounted, onUnmounted } from 'vue'
import { usePlayFabData } from './usePlayFabData'

const AUTO_SAVE_INTERVAL = 30000 // 30 seconds
const AUTO_SAVE_KEY = 'playfab-editor-autosave'

let saveTimer = null
let isInitialized = false

export function useAutoSave() {
  const { state, loadJSON } = usePlayFabData()

  const hasUnsavedChanges = ref(false)
  const lastSaveTime = ref(null)
  const autoSaveEnabled = ref(true)

  function save() {
    if (!state.catalogData) return

    try {
      const dataToSave = {
        timestamp: Date.now(),
        catalogData: {
          CatalogVersion: state.catalogData.CatalogVersion,
          Catalog: state.entities
        }
      }

      localStorage.setItem(AUTO_SAVE_KEY, JSON.stringify(dataToSave))
      hasUnsavedChanges.value = false
      lastSaveTime.value = new Date()

      console.log('Auto-saved at', lastSaveTime.value.toLocaleTimeString())
    } catch (e) {
      console.error('Auto-save failed:', e)
    }
  }

  function startAutoSave() {
    stopAutoSave()

    if (!autoSaveEnabled.value) return

    saveTimer = setInterval(() => {
      if (hasUnsavedChanges.value && state.catalogData) {
        save()
      }
    }, AUTO_SAVE_INTERVAL)
  }

  function stopAutoSave() {
    if (saveTimer) {
      clearInterval(saveTimer)
      saveTimer = null
    }
  }

  function loadAutoSave() {
    try {
      const saved = localStorage.getItem(AUTO_SAVE_KEY)
      if (!saved) return null

      const data = JSON.parse(saved)
      return {
        ...data,
        age: Date.now() - data.timestamp
      }
    } catch (e) {
      console.error('Failed to load auto-save:', e)
      return null
    }
  }

  function clearAutoSave() {
    localStorage.removeItem(AUTO_SAVE_KEY)
  }

  function formatAge(ms) {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m ago`
    if (minutes > 0) return `${minutes}m ago`
    return `${seconds}s ago`
  }

  function restoreAutoSave(autoSave) {
    if (!autoSave || !autoSave.catalogData) return false

    // Validate data structure before loading
    if (!Array.isArray(autoSave.catalogData.Catalog)) {
      console.error('Failed to restore auto-save: invalid data structure')
      return false
    }

    try {
      // Pass object directly to loadJSON (not stringified)
      loadJSON(autoSave.catalogData)
      hasUnsavedChanges.value = false
      return true
    } catch (e) {
      console.error('Failed to restore auto-save:', e)
      return false
    }
  }

  function checkForAutoSave() {
    const autoSave = loadAutoSave()
    if (autoSave && !state.catalogData) {
      return {
        exists: true,
        age: autoSave.age,
        formattedAge: formatAge(autoSave.age),
        data: autoSave
      }
    }
    return { exists: false }
  }

  function markAsChanged() {
    hasUnsavedChanges.value = true
  }

  function init() {
    if (isInitialized) return

    // Watch for changes
    watch(
      () => state.entities,
      () => {
        if (state.catalogData) {
          hasUnsavedChanges.value = true
        }
      },
      { deep: true }
    )

    // Handle page unload
    window.addEventListener('beforeunload', handleBeforeUnload)

    startAutoSave()
    isInitialized = true
  }

  function cleanup() {
    stopAutoSave()
    window.removeEventListener('beforeunload', handleBeforeUnload)
    isInitialized = false
  }

  function handleBeforeUnload(e) {
    if (hasUnsavedChanges.value) {
      e.preventDefault()
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?'
      return e.returnValue
    }
  }

  return {
    hasUnsavedChanges,
    lastSaveTime,
    autoSaveEnabled,
    save,
    startAutoSave,
    stopAutoSave,
    loadAutoSave,
    clearAutoSave,
    restoreAutoSave,
    checkForAutoSave,
    formatAge,
    markAsChanged,
    init,
    cleanup
  }
}
