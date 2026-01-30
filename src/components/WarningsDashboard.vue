<template>
  <div class="warnings-dashboard" :class="{ collapsed: isCollapsed }">
    <div class="dashboard-header" @click="toggleCollapse">
      <h3>
        <span class="header-icon">{{ totalErrors > 0 ? '!' : '?' }}</span>
        Warnings & Errors
        <span class="count-badge" :class="{ 'has-errors': totalErrors > 0 }">
          {{ totalErrors > 0 ? `${totalErrors} errors` : `${totalWarnings} warnings` }}
        </span>
      </h3>
      <button class="toggle-btn">
        {{ isCollapsed ? '...' : '^' }}
      </button>
    </div>

    <div v-show="!isCollapsed" class="dashboard-content">
      <div class="dashboard-filters">
        <label class="filter-checkbox">
          <input type="checkbox" v-model="showErrors" />
          <span class="filter-label error">Errors ({{ totalErrors }})</span>
        </label>
        <label class="filter-checkbox">
          <input type="checkbox" v-model="showWarnings" />
          <span class="filter-label warning">Warnings ({{ totalWarnings }})</span>
        </label>
      </div>

      <div class="issues-list">
        <div
          v-for="issue in filteredIssues"
          :key="issue.id"
          class="issue-item"
          :class="`severity-${issue.severity}`"
        >
          <div class="issue-icon">
            {{ issue.severity === 'error' ? '!' : '?' }}
          </div>

          <div class="issue-details">
            <div class="issue-item-name">
              {{ issue.item.DisplayName || issue.item.ItemId }}
              <span class="item-class">({{ issue.item.ItemClass }})</span>
            </div>
            <div class="issue-message">
              {{ issue.message }}
            </div>
          </div>

          <div class="issue-actions">
            <button @click="viewItem(issue.item)" class="btn-small">
              View
            </button>
            <button
              v-if="issue.canAutoFix"
              @click="handleAutoFix(issue)"
              class="btn-small btn-fix"
            >
              Fix
            </button>
          </div>
        </div>

        <div v-if="filteredIssues.length === 0" class="no-issues">
          <span class="success-icon">OK</span>
          No issues found!
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useValidation } from '../composables/useValidation'

const emit = defineEmits(['view-item'])

const { allIssues, errorCount, warningCount, autoFix } = useValidation()

const isCollapsed = ref(true)
const showErrors = ref(true)
const showWarnings = ref(true)

const totalErrors = computed(() => errorCount.value)
const totalWarnings = computed(() => warningCount.value)

const filteredIssues = computed(() => {
  return allIssues.value.filter(issue => {
    if (issue.severity === 'error' && !showErrors.value) return false
    if (issue.severity === 'warning' && !showWarnings.value) return false
    return true
  })
})

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

function viewItem(item) {
  emit('view-item', item)

  // Try to scroll to and highlight the item
  const element = document.querySelector(`[data-item-id="${item.ItemId}"]`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    element.classList.add('highlight-flash')
    setTimeout(() => element.classList.remove('highlight-flash'), 2000)
  }
}

function handleAutoFix(issue) {
  if (autoFix(issue)) {
    // Issue was fixed
    console.log(`Auto-fixed: ${issue.ruleId} for ${issue.item.ItemId}`)
  }
}
</script>

<style scoped>
.warnings-dashboard {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 16px;
}

.dashboard-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f9fafb;
  cursor: pointer;
  user-select: none;
}

.dashboard-header:hover {
  background: #f3f4f6;
}

.dashboard-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fef3c7;
  color: #d97706;
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
}

.count-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #fef3c7;
  color: #92400e;
}

.count-badge.has-errors {
  background: #fee2e2;
  color: #dc2626;
}

.toggle-btn {
  background: none;
  border: none;
  font-size: 14px;
  color: #6b7280;
  cursor: pointer;
  padding: 4px 8px;
}

.dashboard-content {
  border-top: 1px solid #e5e7eb;
}

.dashboard-filters {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e5e7eb;
}

.filter-checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
}

.filter-checkbox input {
  cursor: pointer;
}

.filter-label.error {
  color: #dc2626;
}

.filter-label.warning {
  color: #d97706;
}

.issues-list {
  max-height: 300px;
  overflow-y: auto;
}

.issue-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.issue-item:last-child {
  border-bottom: none;
}

.issue-item:hover {
  background: #f9fafb;
}

.issue-item.severity-error {
  background: #fef2f2;
}

.issue-item.severity-error:hover {
  background: #fee2e2;
}

.issue-item.severity-warning {
  background: #fffbeb;
}

.issue-item.severity-warning:hover {
  background: #fef3c7;
}

.issue-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 12px;
  font-weight: bold;
  flex-shrink: 0;
}

.severity-error .issue-icon {
  background: #fee2e2;
  color: #dc2626;
}

.severity-warning .issue-icon {
  background: #fef3c7;
  color: #d97706;
}

.issue-details {
  flex: 1;
  min-width: 0;
}

.issue-item-name {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 2px;
}

.item-class {
  font-weight: 400;
  color: #6b7280;
}

.issue-message {
  font-size: 12px;
  color: #6b7280;
}

.issue-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-small {
  padding: 4px 10px;
  font-size: 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-small:hover {
  background: #f3f4f6;
}

.btn-fix {
  background: #dbeafe;
  border-color: #3b82f6;
  color: #1d4ed8;
}

.btn-fix:hover {
  background: #bfdbfe;
}

.no-issues {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: #10b981;
  font-size: 14px;
}

.success-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #d1fae5;
  color: #059669;
  border-radius: 50%;
  font-size: 11px;
  font-weight: bold;
}

/* Collapsed state */
.warnings-dashboard.collapsed .dashboard-header {
  border-radius: 8px;
}
</style>
