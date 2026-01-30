import { computed } from 'vue'
import { usePlayFabData } from './usePlayFabData'

export function useBundleStats() {
  const { getBundleEntities, state } = usePlayFabData()

  // Parse CustomData safely
  function parseCustomData(entity) {
    if (!entity?.CustomData) return null
    try {
      return JSON.parse(entity.CustomData)
    } catch {
      return null
    }
  }

  // Get stats for a single bundle
  function getBundleStats(bundleId) {
    const entities = getBundleEntities(bundleId)

    let totalPower = 0
    let totalBalance = 0
    let totalLevel = 0
    let playerCount = 0
    let staffCount = 0
    let teamCount = 0
    let tacticCount = 0
    let locationCount = 0

    entities.forEach(entity => {
      const data = parseCustomData(entity)

      // Count by type
      if (entity.ItemClass === 'player') {
        playerCount++
        if (data?.power) totalPower += parseInt(data.power, 10) || 0
        if (data?.level) totalLevel += parseInt(data.level, 10) || 0
      } else if (entity.ItemClass === 'staff') {
        staffCount++
      } else if (entity.ItemClass === 'team') {
        teamCount++
        if (data?.power) totalPower += parseInt(data.power, 10) || 0
        if (data?.balance) totalBalance += parseInt(data.balance, 10) || 0
      } else if (entity.ItemClass === 'tactic') {
        tacticCount++
      } else if (entity.ItemClass === 'location') {
        locationCount++
      }
    })

    return {
      itemCount: entities.length,
      totalPower,
      totalBalance,
      avgLevel: playerCount > 0 ? (totalLevel / playerCount).toFixed(1) : 0,
      playerCount,
      staffCount,
      teamCount,
      tacticCount,
      locationCount
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
