import { reactive, computed } from 'vue'
import { usePlayFabData } from './usePlayFabData'

const MAX_HISTORY = 50

const history = reactive({
  past: [],
  future: [],
  enabled: true
})

let playFabDataRef = null

export function useHistory() {
  if (!playFabDataRef) {
    playFabDataRef = usePlayFabData()
  }

  const { state, createEntity, deleteEntity, updateEntity, addEntityToBundle, removeEntityFromBundle } = playFabDataRef

  function addAction(action) {
    if (!history.enabled) return

    history.past.push({
      type: action.type,
      timestamp: Date.now(),
      data: JSON.parse(JSON.stringify(action.data)),
      reverseData: action.reverseData ? JSON.parse(JSON.stringify(action.reverseData)) : null
    })

    // Limit history size
    if (history.past.length > MAX_HISTORY) {
      history.past.shift()
    }

    // Clear future when new action is performed
    history.future = []
  }

  function undo() {
    if (history.past.length === 0) return

    const action = history.past.pop()
    executeReverse(action)
    history.future.push(action)
  }

  function redo() {
    if (history.future.length === 0) return

    const action = history.future.pop()
    executeForward(action)
    history.past.push(action)
  }

  function executeReverse(action) {
    history.enabled = false

    try {
      switch (action.type) {
        case 'create_item':
          // Remove the created item
          const createIdx = state.entities.findIndex(e => e.ItemId === action.data.ItemId)
          if (createIdx !== -1) {
            state.entities.splice(createIdx, 1)
          }
          break

        case 'delete_item':
          // Restore the deleted item
          state.entities.push(action.data)
          break

        case 'edit_item':
          // Restore old data
          const editItem = state.entities.find(e => e.ItemId === action.data.ItemId)
          if (editItem && action.reverseData) {
            Object.assign(editItem, action.reverseData)
          }
          break

        case 'add_to_bundle':
          // Remove from bundle
          const addBundle = state.entities.find(e => e.ItemId === action.data.bundleId)
          if (addBundle && addBundle.Bundle) {
            addBundle.Bundle.BundledItems = addBundle.Bundle.BundledItems.filter(
              id => id !== action.data.itemId
            )
          }
          break

        case 'remove_from_bundle':
          // Add back to bundle
          const removeBundle = state.entities.find(e => e.ItemId === action.data.bundleId)
          if (removeBundle && removeBundle.Bundle) {
            if (!removeBundle.Bundle.BundledItems.includes(action.data.itemId)) {
              removeBundle.Bundle.BundledItems.push(action.data.itemId)
            }
          }
          break

        case 'move_item':
          // Move item back
          const { itemId, fromBundleId, toBundleId } = action.data

          // Remove from destination
          if (toBundleId) {
            const destBundle = state.entities.find(e => e.ItemId === toBundleId)
            if (destBundle && destBundle.Bundle) {
              destBundle.Bundle.BundledItems = destBundle.Bundle.BundledItems.filter(
                id => id !== itemId
              )
            }
          }

          // Add back to source
          if (fromBundleId) {
            const srcBundle = state.entities.find(e => e.ItemId === fromBundleId)
            if (srcBundle && srcBundle.Bundle) {
              if (!srcBundle.Bundle.BundledItems.includes(itemId)) {
                srcBundle.Bundle.BundledItems.push(itemId)
              }
            }
          }
          break
      }
    } finally {
      history.enabled = true
    }
  }

  function executeForward(action) {
    history.enabled = false

    try {
      switch (action.type) {
        case 'create_item':
          state.entities.push(action.data)
          break

        case 'delete_item':
          const delIdx = state.entities.findIndex(e => e.ItemId === action.data.ItemId)
          if (delIdx !== -1) {
            state.entities.splice(delIdx, 1)
          }
          break

        case 'edit_item':
          const editItem = state.entities.find(e => e.ItemId === action.data.ItemId)
          if (editItem) {
            Object.assign(editItem, action.data)
          }
          break

        case 'add_to_bundle':
          const addBundle = state.entities.find(e => e.ItemId === action.data.bundleId)
          if (addBundle && addBundle.Bundle) {
            if (!addBundle.Bundle.BundledItems.includes(action.data.itemId)) {
              addBundle.Bundle.BundledItems.push(action.data.itemId)
            }
          }
          break

        case 'remove_from_bundle':
          const removeBundle = state.entities.find(e => e.ItemId === action.data.bundleId)
          if (removeBundle && removeBundle.Bundle) {
            removeBundle.Bundle.BundledItems = removeBundle.Bundle.BundledItems.filter(
              id => id !== action.data.itemId
            )
          }
          break

        case 'move_item':
          const { itemId, fromBundleId, toBundleId } = action.data

          // Remove from source
          if (fromBundleId) {
            const srcBundle = state.entities.find(e => e.ItemId === fromBundleId)
            if (srcBundle && srcBundle.Bundle) {
              srcBundle.Bundle.BundledItems = srcBundle.Bundle.BundledItems.filter(
                id => id !== itemId
              )
            }
          }

          // Add to destination
          if (toBundleId) {
            const destBundle = state.entities.find(e => e.ItemId === toBundleId)
            if (destBundle && destBundle.Bundle) {
              if (!destBundle.Bundle.BundledItems.includes(itemId)) {
                destBundle.Bundle.BundledItems.push(itemId)
              }
            }
          }
          break
      }
    } finally {
      history.enabled = true
    }
  }

  function clearHistory() {
    history.past = []
    history.future = []
  }

  const canUndo = computed(() => history.past.length > 0)
  const canRedo = computed(() => history.future.length > 0)

  const lastAction = computed(() => {
    if (history.past.length === 0) return null
    return history.past[history.past.length - 1]
  })

  function formatActionType(type) {
    const labels = {
      'create_item': 'Create',
      'delete_item': 'Delete',
      'edit_item': 'Edit',
      'add_to_bundle': 'Add to bundle',
      'remove_from_bundle': 'Remove from bundle',
      'move_item': 'Move'
    }
    return labels[type] || type
  }

  // Setup keyboard shortcuts
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', handleKeydown)
  }

  function cleanupKeyboardShortcuts() {
    document.removeEventListener('keydown', handleKeydown)
  }

  function handleKeydown(e) {
    // Ignore if focus is in an input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      return
    }

    // Ctrl+Z (Cmd+Z on Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      undo()
    }

    // Ctrl+Y or Ctrl+Shift+Z (Cmd+Shift+Z on Mac)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault()
      redo()
    }
  }

  return {
    addAction,
    undo,
    redo,
    clearHistory,
    setupKeyboardShortcuts,
    cleanupKeyboardShortcuts,
    canUndo,
    canRedo,
    lastAction,
    formatActionType,
    historySize: computed(() => history.past.length),
    isEnabled: computed(() => history.enabled)
  }
}
