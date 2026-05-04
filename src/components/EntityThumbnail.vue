<template>
  <div class="entity-thumb" :style="{ width: size + 'px', height: size + 'px' }">
    <img v-if="imageUrl" :src="imageUrl" :alt="entity.DisplayName || entity.ItemId" />
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useImageManager } from '../composables/useImageManager'

const props = defineProps({
  entity: { type: Object, required: true },
  size: { type: Number, default: 32 }
})

const { getImagePreview, generateImagePath } = useImageManager()
const imageUrl = ref(null)

function getImagePath() {
  if (props.entity.CustomData) {
    try {
      const data = JSON.parse(props.entity.CustomData)
      if (data.imagePath) return data.imagePath
    } catch {}
  }
  return generateImagePath(props.entity.ItemClass, props.entity.ItemId)
}

async function loadImage() {
  if (imageUrl.value && imageUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(imageUrl.value)
  }
  imageUrl.value = await getImagePreview(getImagePath())
}

onMounted(loadImage)
watch(() => props.entity.ItemId, loadImage)
onUnmounted(() => {
  if (imageUrl.value && imageUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(imageUrl.value)
  }
})
</script>

<style scoped>
.entity-thumb {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  overflow: hidden;
  background: transparent;
}

.entity-thumb img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
}
</style>
