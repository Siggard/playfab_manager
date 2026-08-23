import { computed } from 'vue'
import { usePlayFabData } from './usePlayFabData'
import { getReputation } from '../utils/entityHelpers'

export function useBundleStats() {
  const { getBundleEntities, getEntityById, state } = usePlayFabData()

  // Parse CustomData safely
  function parseCustomData(entity) {
    if (!entity?.CustomData) return null
    try {
      return JSON.parse(entity.CustomData)
    } catch {
      return null
    }
  }

  // Get stats for a single bundle. Cards give players, tactics and connections;
  // staff, infrastructure and reputation live in the bundle's own CustomData.
  function getBundleStats(bundleId) {
    const bundle = getEntityById(bundleId)
    const entities = getBundleEntities(bundleId)
    const data = parseCustomData(bundle) || {}

    let totalPower = 0
    let totalBalance = 0
    let totalLevel = 0
    let playerCount = 0
    let connectionCount = 0
    let teamCount = 0
    let tacticCount = 0
    let locationCount = 0

    entities.forEach(entity => {
      const itemData = parseCustomData(entity)

      if (entity.ItemClass === 'player') {
        playerCount++
        if (itemData?.power) totalPower += parseInt(itemData.power, 10) || 0
        if (itemData?.level) totalLevel += parseInt(itemData.level, 10) || 0
      } else if (entity.ItemClass === 'personal_connection') {
        connectionCount++
      } else if (entity.ItemClass === 'team') {
        teamCount++
        if (itemData?.power) totalPower += parseInt(itemData.power, 10) || 0
        if (itemData?.balance) totalBalance += parseInt(itemData.balance, 10) || 0
      } else if (entity.ItemClass === 'tactic') {
        tacticCount++
      } else if (entity.ItemClass === 'location') {
        locationCount++
      }
    })

    // Staff are counters on the bundle, not cards
    const staff = data.staff && typeof data.staff === 'object' ? data.staff : null
    const staffTotal = staff
      ? Object.values(staff).reduce((sum, n) => sum + (parseInt(n, 10) || 0), 0)
      : 0

    // Infrastructure is a fixed row of slots
    const slots = Array.isArray(data.infrastructure?.slots) ? data.infrastructure.slots : []
    const infraTotal = slots.length
    const infraUsed = slots.filter(slot => slot?.location_id).length
    // Location cards the slots don't account for, and slots pointing at nothing
    const slotIds = new Set(slots.map(slot => slot?.location_id).filter(Boolean))
    const unslottedLocations = entities.filter(
      e => e.ItemClass === 'location' && !slotIds.has(e.ItemId)
    ).length
    const brokenSlots = [...slotIds].filter(id => !getEntityById(id)).length

    return {
      itemCount: entities.length,
      totalPower,
      totalBalance,
      avgLevel: playerCount > 0 ? (totalLevel / playerCount).toFixed(1) : 0,
      playerCount,
      connectionCount,
      teamCount,
      tacticCount,
      locationCount,
      hasStaff: !!staff,
      staffTotal,
      infraUsed,
      infraTotal,
      unslottedLocations,
      brokenSlots,
      reputation: getReputation(bundle?.CustomData)
    }
  }

  // Get global stats
  const globalStats = computed(() => {
    const bundleCount = state.bundles.length
    let totalAssigned = 0
    let totalPower = 0
    let totalBalance = 0

    state.bundles.forEach(bundle => {
      const stats = getBundleStats(bundle.ItemId)
      totalAssigned += stats.itemCount
      totalPower += stats.totalPower
      totalBalance += stats.totalBalance
    })

    return {
      bundleCount,
      totalEntities: state.entities.length,
      assignedEntities: totalAssigned,
      unassignedEntities: state.entities.length - totalAssigned - bundleCount,
      avgPower: bundleCount > 0 ? (totalPower / bundleCount).toFixed(1) : 0,
      totalBalance
    }
  })

  return {
    parseCustomData,
    getBundleStats,
    globalStats
  }
}
