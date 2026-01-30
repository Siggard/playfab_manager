<template>
  <div class="image-uploader">
    <div
      class="upload-zone"
      :class="{ 'drag-over': isDragOver, 'has-image': previewUrl }"
      @click="triggerFileInput"
      @drop.prevent="handleDrop"
      @dragover.prevent="isDragOver = true"
      @dragleave="isDragOver = false"
    >
      <div v-if="previewUrl" class="preview">
        <img :src="previewUrl" :alt="itemId" />
        <div class="preview-overlay">
          <button type="button" @click.stop="handleRemove" class="btn-remove">
            Remove
          </button>
        </div>
      </div>
      <div v-else class="upload-prompt">
        <span class="upload-icon">📷</span>
        <p>Drag & drop image</p>
        <p class="hint">or click to browse</p>
        <p class="hint">PNG/JPG, max 5MB</p>
      </div>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/png,image/jpeg,image/jpg"
      @change="handleFileSelect"
      style="display: none"
    />

    <div v-if="currentPath" class="image-path">
      <span class="path-label">Path:</span>
      <code>{{ currentPath }}</code>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="isUploading" class="uploading">
      Uploading...
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useImageManager } from '../composables/useImageManager'

const props = defineProps({
  itemClass: {
    type: String,
    required: true
  },
  itemId: {
    type: String,
    required: true
  },
  currentImage: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update'])

const { uploadImage, getImagePreview, removeImage } = useImageManager()

const fileInput = ref(null)
const isDragOver = ref(false)
const previewUrl = ref(null)
const currentPath = ref(props.currentImage)
const error = ref('')
const isUploading = ref(false)

// Load existing image preview
onMounted(async () => {
  if (props.currentImage) {
    previewUrl.value = await getImagePreview(props.currentImage)
  }
})

// Cleanup object URL on unmount
onUnmounted(() => {
  if (previewUrl.value && previewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewUrl.value)
  }
})

// Watch for external changes to currentImage
watch(() => props.currentImage, async (newPath) => {
  currentPath.value = newPath
  if (newPath) {
    previewUrl.value = await getImagePreview(newPath)
  } else {
    previewUrl.value = null
  }
})

function triggerFileInput() {
  fileInput.value?.click()
}

async function handleFileSelect(event) {
  const file = event.target.files[0]
  if (file) {
    await processFile(file)
  }
  // Reset input
  event.target.value = ''
}

async function handleDrop(event) {
  isDragOver.value = false
  const file = event.dataTransfer.files[0]
  if (file) {
    await processFile(file)
  }
}

async function processFile(file) {
  error.value = ''
  isUploading.value = true

  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Please upload an image file (PNG or JPG)')
    }

    // Validate size
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image must be less than 5MB')
    }

    // Upload and store
    const imagePath = await uploadImage(file, props.itemClass, props.itemId)

    // Update state
    currentPath.value = imagePath
    previewUrl.value = await getImagePreview(imagePath)

    // Emit to parent
    emit('update', imagePath)

  } catch (e) {
    error.value = e.message
    console.error('Upload failed:', e)
  } finally {
    isUploading.value = false
  }
}

async function handleRemove() {
  if (!currentPath.value) return

  if (confirm('Remove this image?')) {
    await removeImage(currentPath.value)

    // Cleanup object URL
    if (previewUrl.value && previewUrl.value.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl.value)
    }

    previewUrl.value = null
    currentPath.value = null
    error.value = ''

    emit('update', null)
  }
}
</script>

<style scoped>
.image-uploader {
  width: 100%;
}

.upload-zone {
  position: relative;
  width: 100%;
  min-height: 150px;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
}

.upload-zone:hover {
  border-color: #3b82f6;
  background: #f0f9ff;
}

.upload-zone.drag-over {
  border-color: #3b82f6;
  background: #dbeafe;
}

.upload-zone.has-image {
  border-style: solid;
  border-color: #e5e7eb;
}

.preview {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview img {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
}

.preview-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}

.preview:hover .preview-overlay {
  opacity: 1;
}

.btn-remove {
  padding: 8px 16px;
  background: #ef4444;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.btn-remove:hover {
  background: #dc2626;
}

.upload-prompt {
  text-align: center;
  padding: 20px;
}

.upload-icon {
  font-size: 40px;
  display: block;
  margin-bottom: 8px;
}

.upload-prompt p {
  margin: 4px 0;
  color: #6b7280;
  font-size: 14px;
}

.upload-prompt .hint {
  font-size: 12px;
  color: #9ca3af;
}

.image-path {
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 6px;
}

.image-path code {
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.error-message {
  margin-top: 8px;
  padding: 8px;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 13px;
}

.uploading {
  margin-top: 8px;
  color: #3b82f6;
  font-size: 13px;
}
</style>
