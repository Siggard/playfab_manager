import { reactive, watch } from 'vue'

const SETTINGS_KEY = 'playfab-editor-settings'

const defaultSettings = {
  version: '1.1.0',

  templates: {
    items: {
      player: {
        ItemClass: 'player',
        DisplayName: 'New Player',
        CustomData: {
          level: '1',
          power: '1',
          power_limit: '5'
        },
        Tags: [],
        IsStackable: false,
        IsTradable: false
      },
      staff: {
        ItemClass: 'staff',
        DisplayName: 'New Staff Member',
        CustomData: {
          level: '1',
          salary: '1000',
          specialty: 'coach'
        },
        Tags: [],
        IsStackable: false,
        IsTradable: false
      },
      team: {
        ItemClass: 'team',
        DisplayName: 'New Team',
        CustomData: {
          balance: '0',
          power: '12'
        },
        Tags: [],
        IsStackable: false,
        IsTradable: false
      },
      tactic: {
        ItemClass: 'tactic',
        DisplayName: 'New Tactic',
        CustomData: {
          style: 'BALANCED'
        },
        Tags: [],
        IsStackable: false,
        IsTradable: false
      },
      club: {
        ItemClass: 'club',
        DisplayName: 'New Club',
        CustomData: {
          infrastructure: {
            training_base: { level: 1, modules: [] },
            academy: { level: 0, modules: [] },
            main_office: { level: 0, modules: [] },
            stadium: { level: 0, modules: [] }
          }
        },
        Tags: [],
        Bundle: {
          BundledItems: [],
          BundledResultTables: [],
          BundledVirtualCurrencies: null
        },
        IsStackable: false,
        IsTradable: false
      }
    },
    bundles: {
      starter_club: {
        name: 'Starter Club',
        description: 'Basic club for new players',
        bundleClass: 'club',
        customData: {
          infrastructure: {
            training_base: { level: 1, modules: [{ id: 'loc_gym' }] },
            academy: { level: 0, modules: [] },
            main_office: { level: 0, modules: [] },
            stadium: { level: 0, modules: [] }
          }
        },
        virtualCurrencies: {
          CO: 1000
        },
        itemRequirements: {
          team: { count: 1, min: 1, max: 1, label: '1' },
          player: { count: 5, min: 5, max: 7, label: '5-7' },
          staff: { count: 1, min: 1, max: 2, label: '1-2' },
          tactic: { count: 1, min: 1, max: 1, label: '1' },
          location: { min: 0, max: 5, label: 'optional' }
        }
      }
    }
  },

  uiPreferences: {
    theme: 'light',
    bundleGridColumns: 4,
    entityCardSize: 'medium',
    showPreviews: true,
    autoCollapseWarnings: false
  },

  lastSession: {
    filePath: null,
    timestamp: null,
    autoSaveEnabled: true
  }
}

const settings = reactive(JSON.parse(JSON.stringify(defaultSettings)))

let initialized = false

export function useSettings() {

  function loadSettings() {
    if (initialized) return

    try {
      const saved = localStorage.getItem(SETTINGS_KEY)
      if (saved) {
        const data = JSON.parse(saved)
        // Merge with defaults to handle new settings
        deepMerge(settings, data)
      }
      initialized = true
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    } catch (e) {
      console.error('Failed to save settings:', e)
    }
  }

  function resetSettings() {
    Object.assign(settings, JSON.parse(JSON.stringify(defaultSettings)))
    saveSettings()
  }

  function exportSettings() {
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'playfab-editor-settings.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function importSettings(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result)
          deepMerge(settings, imported)
          saveSettings()
          resolve()
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  function getTemplate(type, templateId) {
    if (type === 'item') {
      return settings.templates.items[templateId]
    } else if (type === 'bundle') {
      return settings.templates.bundles[templateId]
    }
    return null
  }

  function saveTemplate(type, templateId, template) {
    if (type === 'item') {
      settings.templates.items[templateId] = template
    } else if (type === 'bundle') {
      settings.templates.bundles[templateId] = template
    }
    saveSettings()
  }

  function deleteTemplate(type, templateId) {
    if (type === 'item') {
      delete settings.templates.items[templateId]
    } else if (type === 'bundle') {
      delete settings.templates.bundles[templateId]
    }
    saveSettings()
  }

  function getItemTemplates() {
    return Object.keys(settings.templates.items)
  }

  function getBundleTemplates() {
    return Object.keys(settings.templates.bundles)
  }

  // Deep merge helper
  function deepMerge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {}
        deepMerge(target[key], source[key])
      } else {
        target[key] = source[key]
      }
    }
    return target
  }

  // Auto-save on changes
  watch(
    () => settings,
    () => saveSettings(),
    { deep: true }
  )

  // Initialize on first use
  loadSettings()

  return {
    settings,
    loadSettings,
    saveSettings,
    resetSettings,
    exportSettings,
    importSettings,
    getTemplate,
    saveTemplate,
    deleteTemplate,
    getItemTemplates,
    getBundleTemplates
  }
}
