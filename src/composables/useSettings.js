import { reactive, watch } from 'vue'
import { emptyInfraSlots } from '../utils/entityHelpers'

const SETTINGS_KEY = 'playfab-editor-settings'

// ItemClasses dropped from the game design — pruned from saved settings on load
const DEPRECATED_ITEM_TEMPLATES = ['staff', 'feature_staff']

const defaultSettings = {
  version: '1.2.0',

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
      personal_connection: {
        ItemClass: 'personal_connection',
        DisplayName: 'New Connection',
        Description: '',
        CustomData: {},
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
          staff: {
            coaching_staff: 0,
            medical_staff: 0,
            scouting_staff: 0,
            assistant: 0,
            secretary: 0
          },
          reputation: {
            value: 0,
            face: 'negative'
          },
          infrastructure: {
            slots: emptyInfraSlots()
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
      },
      bot_bonus: {
        ItemClass: 'bot_bonus',
        DisplayName: 'New Bot Bonus',
        CustomData: {
          level: 1,
          effect_type: 'power',
          effect_value: 2
        },
        Tags: [],
        IsStackable: false,
        IsTradable: false
      },
      status_token: {
        ItemClass: 'status_token',
        DisplayName: 'New Status Token',
        Description: '',
        CustomData: {
          duration: { value: 1, unit: 'weeks' },
          power_effect: { type: 'penalty', value: 1 }
        },
        Tags: [],
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
          staff: {
            coaching_staff: 2,
            medical_staff: 1,
            scouting_staff: 0,
            assistant: 1,
            secretary: 1
          },
          reputation: {
            value: 0,
            face: 'negative'
          },
          infrastructure: {
            slots: emptyInfraSlots()
          }
        },
        virtualCurrencies: {
          CO: 1000
        },
        itemRequirements: {
          team: { count: 1, min: 1, max: 1, label: '1' },
          player: { count: 5, min: 5, max: 7, label: '5-7' },
          tactic: { count: 1, min: 1, max: 1, label: '1' },
          personal_connection: { min: 0, max: 5, label: 'optional' },
          location: { min: 0, max: 5, label: 'optional' }
        }
      },
      bot_bonus_deck: {
        name: 'Bot Bonus Deck',
        description: 'Deck of bonus cards for bot team',
        bundleClass: 'bot_bonus_deck',
        customData: {
          difficulty: 1
        },
        itemRequirements: {
          bot_bonus: { min: 1, max: 20, label: '1-20' }
        }
      },
      player_deck: {
        name: 'Player Deck',
        description: 'Deck of player cards (juniors, free agents, transfer market)',
        bundleClass: 'player_deck',
        customData: {
          deck_type: 'juniors'
        },
        itemRequirements: {
          player: { min: 1, max: 50, label: '1-50' }
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
  },

  playfab: {
    workerUrl: 'https://playfab-bundle-proxy.fcm.workers.dev',
    editorPassword: '',
    catalogVersion: 'Main'
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
        migrateSettings()
      }
      initialized = true
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
  }

  // Drop entities that no longer exist in the game design from saved settings
  function migrateSettings() {
    let changed = false

    for (const id of DEPRECATED_ITEM_TEMPLATES) {
      if (settings.templates.items[id]) {
        delete settings.templates.items[id]
        changed = true
      }
    }

    for (const bundle of Object.values(settings.templates.bundles || {})) {
      for (const id of DEPRECATED_ITEM_TEMPLATES) {
        if (bundle.itemRequirements?.[id]) {
          delete bundle.itemRequirements[id]
          changed = true
        }
      }
    }

    settings.version = defaultSettings.version

    if (changed) saveSettings()
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
          migrateSettings()
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

  // Find the bundle template that describes a given bundle ItemClass
  function getBundleTemplateForClass(bundleClass) {
    return Object.values(settings.templates.bundles || {})
      .find(t => t.bundleClass === bundleClass) || null
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
    getBundleTemplateForClass,
    saveTemplate,
    deleteTemplate,
    getItemTemplates,
    getBundleTemplates
  }
}
