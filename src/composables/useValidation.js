import { computed } from 'vue'
import { usePlayFabData } from './usePlayFabData'

const validationRules = [
  {
    id: 'json_syntax',
    severity: 'error',
    message: 'Invalid JSON in CustomData',
    check: (item) => {
      if (!item.CustomData) return null
      try {
        JSON.parse(item.CustomData)
        return null
      } catch (e) {
        return { message: `Invalid JSON: ${e.message}` }
      }
    }
  },
  {
    id: 'unique_itemid',
    severity: 'error',
    message: 'Duplicate ItemId',
    check: (item, allItems) => {
      const duplicates = allItems.filter(i => i.ItemId === item.ItemId)
      if (duplicates.length > 1) {
        return { message: `Duplicate ItemId: ${item.ItemId}` }
      }
      return null
    }
  },
  {
    id: 'empty_display_name',
    severity: 'warning',
    message: 'Empty DisplayName',
    check: (item) => {
      if (!item.DisplayName || item.DisplayName.trim() === '') {
        return { message: 'DisplayName is empty' }
      }
      return null
    }
  },
  {
    id: 'empty_bundle',
    severity: 'warning',
    message: 'Empty bundle',
    check: (item) => {
      if (item.Bundle && (!item.Bundle.BundledItems || item.Bundle.BundledItems.length === 0)) {
        return { message: 'Bundle has no items' }
      }
      return null
    }
  },
  {
    id: 'bundle_item_not_found',
    severity: 'error',
    message: 'Bundle references non-existent item',
    check: (item, allItems) => {
      if (!item.Bundle || !item.Bundle.BundledItems) return null

      const allIds = new Set(allItems.map(i => i.ItemId))
      const missing = item.Bundle.BundledItems.filter(id => !allIds.has(id))

      if (missing.length > 0) {
        return { message: `Missing items: ${missing.join(', ')}` }
      }
      return null
    }
  },
  {
    id: 'invalid_itemid_format',
    severity: 'warning',
    message: 'Non-standard ItemId format',
    check: (item) => {
      const patterns = {
        player: /^player_\d+$/,
        staff: /^staff_\d+$/,
        team: /^team_\d+$/,
        club: /^club_\d+$/,
        tactic: /^tactic_\d+$/,
        location: /^location_[a-z0-9_]+$/i,
        feature_player: /^feature_player_\d+$/,
        feature_staff: /^feature_staff_\d+$/,
        feature_tactic: /^feature_tactic_\d+$/,
        feature_tactic_slot: /^feature_tactic_slot_\d+$/
      }

      const pattern = patterns[item.ItemClass]
      if (pattern && !pattern.test(item.ItemId)) {
        return { message: `ItemId doesn't match standard format for ${item.ItemClass}` }
      }
      return null
    }
  },
  {
    id: 'nested_stringified_json',
    severity: 'warning',
    message: 'Nested stringified JSON in CustomData',
    check: (item) => {
      if (!item.CustomData) return null
      try {
        const data = JSON.parse(item.CustomData)
        const nestedFields = []

        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'string' && value.length > 2) {
            const trimmed = value.trim()
            // Check if value looks like stringified JSON object or array
            if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
              try {
                JSON.parse(trimmed)
                nestedFields.push(key)
              } catch {
                // Not valid JSON, ignore
              }
            }
          }
        }

        if (nestedFields.length > 0) {
          return { message: `Double-stringified JSON in: ${nestedFields.join(', ')}` }
        }
        return null
      } catch {
        return null // Invalid JSON handled by json_syntax rule
      }
    }
  }
]

export function useValidation() {
  const { state } = usePlayFabData()

  function validateItem(item, allItems) {
    const issues = []

    for (const rule of validationRules) {
      const result = rule.check(item, allItems)
      if (result) {
        issues.push({
          id: `${item.ItemId}-${rule.id}`,
          ruleId: rule.id,
          severity: rule.severity,
          message: result.message || rule.message,
          item: item,
          canAutoFix: rule.id === 'empty_display_name'
        })
      }
    }

    return issues
  }

  const allIssues = computed(() => {
    const issues = []

    for (const item of state.entities) {
      const itemIssues = validateItem(item, state.entities)
      issues.push(...itemIssues)
    }

    // Sort by severity (errors first)
    return issues.sort((a, b) => {
      if (a.severity === 'error' && b.severity !== 'error') return -1
      if (a.severity !== 'error' && b.severity === 'error') return 1
      return 0
    })
  })

  const errorCount = computed(() =>
    allIssues.value.filter(i => i.severity === 'error').length
  )

  const warningCount = computed(() =>
    allIssues.value.filter(i => i.severity === 'warning').length
  )

  function getIssues(item) {
    return validateItem(item, state.entities)
  }

  function hasErrors(item) {
    const issues = getIssues(item)
    return issues.some(i => i.severity === 'error')
  }

  function hasWarnings(item) {
    const issues = getIssues(item)
    return issues.some(i => i.severity === 'warning')
  }

  function autoFix(issue) {
    switch (issue.ruleId) {
      case 'empty_display_name':
        issue.item.DisplayName = issue.item.ItemId
        return true
      default:
        return false
    }
  }

  return {
    allIssues,
    errorCount,
    warningCount,
    getIssues,
    hasErrors,
    hasWarnings,
    validateItem,
    autoFix
  }
}
