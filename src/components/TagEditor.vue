<template>
  <div class="tag-editor">
    <div class="tags-list">
      <span
        v-for="(tag, idx) in modelValue"
        :key="idx"
        class="tag-chip"
      >
        {{ tag }}
        <button type="button" @click="removeTag(idx)" class="tag-remove">×</button>
      </span>
      <input
        type="text"
        v-model="newTag"
        placeholder="Add tag..."
        @keydown.enter.prevent="addTag"
        @keydown.tab.prevent="addTag"
        class="tag-input"
      />
    </div>
    <div class="tag-suggestions" v-if="showSuggestions && filteredSuggestions.length">
      <button
        v-for="suggestion in filteredSuggestions"
        :key="suggestion"
        type="button"
        @click="addSuggestion(suggestion)"
        class="suggestion-btn"
      >
        {{ suggestion }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Array,
    default: () => []
  },
  suggestions: {
    type: Array,
    default: () => ['starter_pack', 'premium', 'rare', 'common', 'legendary', 'event', 'season_1']
  }
})

const emit = defineEmits(['update:modelValue'])

const newTag = ref('')
const showSuggestions = ref(false)

const filteredSuggestions = computed(() => {
  if (!newTag.value) return props.suggestions.filter(s => !props.modelValue?.includes(s))
  const search = newTag.value.toLowerCase()
  return props.suggestions.filter(s =>
    s.toLowerCase().includes(search) && !props.modelValue?.includes(s)
  )
})

function addTag() {
  const tag = newTag.value.trim()
  if (tag && !props.modelValue?.includes(tag)) {
    const newTags = [...(props.modelValue || []), tag]
    emit('update:modelValue', newTags)
  }
  newTag.value = ''
}

function addSuggestion(tag) {
  if (!props.modelValue?.includes(tag)) {
    const newTags = [...(props.modelValue || []), tag]
    emit('update:modelValue', newTags)
  }
  newTag.value = ''
}

function removeTag(index) {
  const newTags = [...props.modelValue]
  newTags.splice(index, 1)
  emit('update:modelValue', newTags.length > 0 ? newTags : null)
}
</script>

<style scoped>
.tag-editor {
  width: 100%;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  min-height: 42px;
  background: #fff;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #e0e7ff;
  color: #3730a3;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 13px;
}

.tag-remove {
  background: none;
  border: none;
  color: #6366f1;
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  line-height: 1;
  margin-left: 2px;
}

.tag-remove:hover {
  color: #4338ca;
}

.tag-input {
  flex: 1;
  min-width: 100px;
  border: none;
  padding: 4px;
  font-size: 14px;
  outline: none;
}

.tag-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.suggestion-btn {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  color: #6b7280;
}

.suggestion-btn:hover {
  background: #e5e7eb;
  color: #374151;
}
</style>
