import { reactive, computed } from 'vue'

const state = reactive({
  // Original JSON data
  catalogData: null,

  // All entities from Catalog
  entities: [],

  // Bundles (items with Bundle !== null)
  bundles: [],

  // Unique ItemClass types found in data
  itemClasses: new Set(),

  // Bundle ItemClasses (types that are bundles)
  bundleClasses: new Set(),

  // Filters
  filters: {
    type: 'all',
    search: '',
    tag: 'all'
  },

  // Sort option
  sortBy: 'name'
})

export function usePlayFabData() {

  function loadJSON(jsonData) {
    if (!jsonData || !Array.isArray(jsonData.Catalog)) {
      console.error('Invalid JSON data: missing or invalid Catalog array')
      return
    }

    state.catalogData = jsonData
    state.entities = jsonData.Catalog

    // Find all unique ItemClasses
    state.itemClasses.clear()
    state.bundleClasses.clear()

    state.entities.forEach(item => {
      state.itemClasses.add(item.ItemClass)

      // Identify bundle classes (items that have Bundle with BundledItems)
      if (item.Bundle && item.Bundle.BundledItems && item.Bundle.BundledItems.length >= 0) {
        state.bundleClasses.add(item.ItemClass)
      }
    })

    // Get all bundles
    state.bundles = state.entities.filter(item =>
      item.Bundle && item.Bundle.BundledItems
    )
  }

  function addEntityToBundle(entityId, bundleId) {
    const bundle = state.bundles.find(b => b.ItemId === bundleId)
    if (bundle && !bundle.Bundle.BundledItems.includes(entityId)) {
      bundle.Bundle.BundledItems.push(entityId)
    }
  }

  function removeEntityFromBundle(entityId, bundleId) {
    const bundle = state.bundles.find(b => b.ItemId === bundleId)
    if (bundle) {
      bundle.Bundle.BundledItems = bundle.Bundle.BundledItems.filter(
        id => id !== entityId
      )
    }
  }

  function moveEntityBetweenBundles(entityId, fromBundleId, toBundleId) {
    removeEntityFromBundle(entityId, fromBundleId)
    addEntityToBundle(entityId, toBundleId)
  }

  function updateEntity(itemId, updates) {
    const entity = state.entities.find(e => e.ItemId === itemId)
    if (entity) {
      Object.assign(entity, updates)
    }
  }

  function deleteEntity(itemId) {
    // Remove from all bundles first
    state.bundles.forEach(bundle => {
      if (bundle.Bundle.BundledItems.includes(itemId)) {
        bundle.Bundle.BundledItems = bundle.Bundle.BundledItems.filter(id => id !== itemId)
      }
    })

    // Remove from entities
    const index = state.entities.findIndex(e => e.ItemId === itemId)
    if (index !== -1) {
      state.entities.splice(index, 1)
    }
  }

  function createEntity(newEntity) {
    // Create full entity structure
    const entity = {
      ItemId: newEntity.ItemId,
      ItemClass: newEntity.ItemClass,
      CatalogVersion: state.catalogData?.CatalogVersion || 'Main',
      DisplayName: newEntity.DisplayName || '',
      Description: newEntity.Description || null,
      VirtualCurrencyPrices: null,
      RealCurrencyPrices: null,
      Tags: newEntity.Tags || null,
      CustomData: newEntity.CustomData || null,
      Consumable: {
        UsageCount: null,
        UsagePeriod: null,
        UsagePeriodGroup: null
      },
      Container: null,
      Bundle: newEntity.Bundle || null,
      CanBecomeCharacter: false,
      IsStackable: false,
      IsTradable: false,
      ItemImageUrl: null,
      IsLimitedEdition: false,
      InitialLimitedEditionCount: 0,
      ActivatedMembership: null
    }

    state.entities.push(entity)
    state.itemClasses.add(entity.ItemClass)

    // If it's a bundle, add to bundles list
    if (entity.Bundle) {
      state.bundles.push(entity)
      state.bundleClasses.add(entity.ItemClass)
    }

    return entity
  }

  function generateItemId(itemClass) {
    // Find prefix based on ItemClass
    const prefixes = {
      player: 'player_',
      staff: 'staff_',
      team: 'team_',
      tactic: 'tactic_',
      location: 'location_',
      club: 'club_',
      feature_player: 'feature_player_',
      feature_staff: 'feature_staff_',
      feature_tactic: 'feature_tactic_',
      feature_tactic_slot: 'feature_tactic_slot_',
      bot_bonus: 'bot_bonus_',
      bot_bonus_deck: 'bot_bonus_deck_'
    }

    const prefix = prefixes[itemClass] || `${itemClass}_`

    // Find max number with this prefix
    let maxNum = 0
    state.entities.forEach(e => {
      if (e.ItemId.startsWith(prefix)) {
        const numPart = e.ItemId.replace(prefix, '')
        const num = parseInt(numPart, 10)
        if (!isNaN(num) && num > maxNum) {
          maxNum = num
        }
      }
    })

    return `${prefix}${maxNum + 1}`
  }

  function exportJSON() {
    if (!state.catalogData) return null

    // Create output preserving structure
    const output = {
      CatalogVersion: state.catalogData.CatalogVersion,
      Catalog: state.entities
    }

    return JSON.stringify(output, null, 2)
  }

  function downloadJSON(filename = 'catalog-export.json') {
    const jsonStr = exportJSON()
    if (!jsonStr) return

    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // Get entity by ID
  function getEntityById(itemId) {
    return state.entities.find(e => e.ItemId === itemId)
  }

  // Get all entities in a bundle
  function getBundleEntities(bundleId) {
    const bundle = state.bundles.find(b => b.ItemId === bundleId)
    if (!bundle || !bundle.Bundle?.BundledItems) return []

    return bundle.Bundle.BundledItems
      .map(itemId => getEntityById(itemId))
      .filter(Boolean)
  }

  // Check if entity is in any bundle
  function isEntityInBundle(itemId) {
    return state.bundles.some(bundle =>
      bundle.Bundle?.BundledItems?.includes(itemId)
    )
  }

  // Get unassigned entities (not in any bundle and not a bundle itself)
  const unassignedEntities = computed(() => {
    return state.entities.filter(e => {
      // Skip bundles themselves
      if (state.bundleClasses.has(e.ItemClass) && e.Bundle?.BundledItems) {
        return false
      }

      // Check if in any bundle
      return !isEntityInBundle(e.ItemId)
    })
  })

  // Filtered entities for Entity Pool
  const filteredEntities = computed(() => {
    let result = unassignedEntities.value

    // Filter by type
    if (state.filters.type !== 'all') {
      result = result.filter(e => e.ItemClass === state.filters.type)
    }

    // Filter by search
    if (state.filters.search) {
      const search = state.filters.search.toLowerCase()
      result = result.filter(e =>
        e.DisplayName?.toLowerCase().includes(search) ||
        e.ItemId.toLowerCase().includes(search)
      )
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (state.sortBy) {
        case 'name':
          return (a.DisplayName || '').localeCompare(b.DisplayName || '')
        case 'type':
          return a.ItemClass.localeCompare(b.ItemClass)
        case 'id':
          return a.ItemId.localeCompare(b.ItemId)
        default:
          return 0
      }
    })

    return result
  })

  // Get non-bundle ItemClasses for filtering
  const entityClasses = computed(() => {
    const classes = new Set()
    state.entities.forEach(e => {
      if (!state.bundleClasses.has(e.ItemClass) || !e.Bundle?.BundledItems) {
        classes.add(e.ItemClass)
      }
    })
    return Array.from(classes).sort()
  })

  // Get all unique tags for filtering
  const allTags = computed(() => {
    const tags = new Set()
    state.entities.forEach(e => {
      if (e.Tags && Array.isArray(e.Tags)) {
        e.Tags.forEach(tag => tags.add(tag))
      }
    })
    return Array.from(tags).sort()
  })

  return {
    state,
    loadJSON,
    addEntityToBundle,
    removeEntityFromBundle,
    moveEntityBetweenBundles,
    updateEntity,
    deleteEntity,
    createEntity,
    generateItemId,
    exportJSON,
    downloadJSON,
    getEntityById,
    getBundleEntities,
    isEntityInBundle,
    unassignedEntities,
    filteredEntities,
    entityClasses,
    allTags
  }
}
