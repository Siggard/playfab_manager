<template>
  <div class="export-wrapper">
    <button @click="toggleMenu" class="btn-export" :disabled="!hasData">
      <span class="icon">💾</span>
      Export
      <span class="arrow">▼</span>
    </button>

    <div v-if="showMenu" class="export-menu">
      <button @click="handleExportJSON" class="menu-item">
        <span class="menu-icon">📄</span>
        Export JSON only
      </button>
      <button @click="handleExportZIP" class="menu-item">
        <span class="menu-icon">📦</span>
        Export ZIP with images
        <span v-if="imageCount > 0" class="image-badge">{{ imageCount }}</span>
      </button>
    </div>

    <div v-if="showMenu" class="menu-backdrop" @click="showMenu = false"></div>

    <div v-if="isExporting" class="export-status">
      Exporting...
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { usePlayFabData } from '../composables/usePlayFabData'
import { useImageManager } from '../composables/useImageManager'

const { state, exportJSON } = usePlayFabData()
const { getAllImages, getImageCount } = useImageManager()

const showMenu = ref(false)
const isExporting = ref(false)
const imageCount = ref(0)

const hasData = computed(() => state.catalogData !== null)

onMounted(async () => {
  imageCount.value = await getImageCount()
})

function toggleMenu() {
  if (!hasData.value) return
  showMenu.value = !showMenu.value
  updateImageCount()
}

async function updateImageCount() {
  imageCount.value = await getImageCount()
}

function handleExportJSON() {
  showMenu.value = false

  const jsonStr = exportJSON()
  if (!jsonStr) return

  const blob = new Blob([jsonStr], { type: 'application/json' })
  saveAs(blob, 'catalog-export.json')
}

async function handleExportZIP() {
  showMenu.value = false
  isExporting.value = true

  try {
    const zip = new JSZip()

    // Add JSON file
    const jsonStr = exportJSON()
    if (jsonStr) {
      zip.file('catalog.json', jsonStr)
    }

    // Add images
    const images = await getAllImages()
    const imageEntries = Object.entries(images)

    if (imageEntries.length > 0) {
      for (const [path, blob] of imageEntries) {
        zip.file(path, blob)
      }
      console.log(`Added ${imageEntries.length} images to ZIP`)
    }

    // Generate and download
    const content = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })

    const timestamp = new Date().toISOString().slice(0, 10)
    saveAs(content, `playfab-catalog-${timestamp}.zip`)

  } catch (e) {
    console.error('Export failed:', e)
    alert('Export failed: ' + e.message)
  } finally {
    isExporting.value = false
  }
}
</script>

<style scoped>
.export-wrapper {
  position: relative;
}

.btn-export {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.btn-export:hover:not(:disabled) {
  background: #059669;
}

.btn-export:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon {
  font-size: 16px;
}

.arrow {
  font-size: 10px;
  margin-left: 4px;
}

.export-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 1000;
  min-width: 220px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 16px;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  color: #1e293b;
  transition: background 0.15s;
}

.menu-item:hover {
  background: #f1f5f9;
}

.menu-icon {
  font-size: 16px;
}

.image-badge {
  margin-left: auto;
  background: #3b82f6;
  color: white;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 10px;
}

.menu-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}

.export-status {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  padding: 8px 12px;
  background: #1e293b;
  color: white;
  border-radius: 6px;
  font-size: 13px;
  white-space: nowrap;
}
</style>
