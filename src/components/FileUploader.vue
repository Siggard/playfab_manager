<template>
  <div class="file-uploader">
    <input
      type="file"
      ref="fileInput"
      accept=".json"
      @change="handleFileSelect"
      style="display: none"
    />
    <button @click="triggerFileInput" class="btn-upload">
      <span class="icon">📁</span>
      Load JSON
    </button>
    <span v-if="fileName" class="file-name">{{ fileName }}</span>
    <span v-if="error" class="error">{{ error }}</span>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { usePlayFabData } from '../composables/usePlayFabData'

const emit = defineEmits(['loaded'])

const { loadJSON } = usePlayFabData()

const fileInput = ref(null)
const fileName = ref('')
const error = ref('')

function triggerFileInput() {
  fileInput.value?.click()
}

function handleFileSelect(event) {
  const file = event.target.files[0]
  if (!file) return

  error.value = ''
  fileName.value = file.name

  const reader = new FileReader()

  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)

      // Validate structure
      if (!data.CatalogVersion) {
        throw new Error('Missing CatalogVersion field')
      }
      if (!Array.isArray(data.Catalog)) {
        throw new Error('Catalog must be an array')
      }

      loadJSON(data)
      emit('loaded', data)
    } catch (err) {
      error.value = `Error: ${err.message}`
      fileName.value = ''
    }
  }

  reader.onerror = () => {
    error.value = 'Failed to read file'
    fileName.value = ''
  }

  reader.readAsText(file)

  // Reset input so same file can be selected again
  event.target.value = ''
}
</script>

<style scoped>
.file-uploader {
  display: flex;
  align-items: center;
  gap: 10px;
}

.btn-upload {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-upload:hover {
  background: #2563eb;
}

.icon {
  font-size: 16px;
}

.file-name {
  font-size: 13px;
  color: #64748b;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.error {
  font-size: 13px;
  color: #ef4444;
}
</style>
