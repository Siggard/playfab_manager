import { openDB } from 'idb'

const DB_NAME = 'playfab-editor-images'
const DB_VERSION = 1
const STORE_NAME = 'images'

let dbInstance = null

async function getDB() {
  if (!dbInstance) {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }
    })
  }
  return dbInstance
}

export function useImageManager() {

  /**
   * Upload image and store in IndexedDB
   * @param {File} file - Image file
   * @param {string} itemClass - Entity class (player, staff, etc.)
   * @param {string} itemId - Entity ID
   * @returns {string} Image path
   */
  async function uploadImage(file, itemClass, itemId) {
    const db = await getDB()

    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image')
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Image must be less than 5MB')
    }

    // Resize image if needed
    const resizedBlob = await resizeImage(file, 512)

    // Generate path
    const ext = file.type === 'image/png' ? 'png' : 'jpg'
    const path = `images/${itemClass}/${itemId}.${ext}`

    // Store in IndexedDB
    await db.put(STORE_NAME, resizedBlob, path)

    console.log(`Image uploaded: ${path}`)
    return path
  }

  /**
   * Get image preview URL from IndexedDB
   * @param {string} path - Image path
   * @returns {string|null} Object URL or null
   */
  async function getImagePreview(path) {
    if (!path) return null

    try {
      const db = await getDB()
      const blob = await db.get(STORE_NAME, path)

      if (blob) {
        return URL.createObjectURL(blob)
      }
    } catch (e) {
      console.error('Failed to get image preview:', e)
    }

    return null
  }

  /**
   * Remove image from IndexedDB
   * @param {string} path - Image path
   */
  async function removeImage(path) {
    if (!path) return

    try {
      const db = await getDB()
      await db.delete(STORE_NAME, path)
      console.log(`Image removed: ${path}`)
    } catch (e) {
      console.error('Failed to remove image:', e)
    }
  }

  /**
   * Get all stored images
   * @returns {Object} Map of path -> blob
   */
  async function getAllImages() {
    const db = await getDB()
    const keys = await db.getAllKeys(STORE_NAME)
    const images = {}

    for (const key of keys) {
      const blob = await db.get(STORE_NAME, key)
      if (blob) {
        images[key] = blob
      }
    }

    return images
  }

  /**
   * Get image count
   * @returns {number}
   */
  async function getImageCount() {
    const db = await getDB()
    const keys = await db.getAllKeys(STORE_NAME)
    return keys.length
  }

  /**
   * Clear all images
   */
  async function clearAllImages() {
    const db = await getDB()
    await db.clear(STORE_NAME)
    console.log('All images cleared')
  }

  /**
   * Check if image exists
   * @param {string} path
   * @returns {boolean}
   */
  async function hasImage(path) {
    if (!path) return false

    try {
      const db = await getDB()
      const blob = await db.get(STORE_NAME, path)
      return !!blob
    } catch {
      return false
    }
  }

  /**
   * Resize image to max dimension
   * @param {File} file
   * @param {number} maxSize
   * @returns {Blob}
   */
  function resizeImage(file, maxSize) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = (e) => {
        const img = new Image()

        img.onload = () => {
          let width = img.width
          let height = img.height

          // Only resize if larger than maxSize
          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = Math.round((height / width) * maxSize)
              width = maxSize
            } else {
              width = Math.round((width / height) * maxSize)
              height = maxSize
            }
          }

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error('Failed to create blob'))
              }
            },
            file.type,
            0.85
          )
        }

        img.onerror = () => reject(new Error('Failed to load image'))
        img.src = e.target.result
      }

      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  /**
   * Generate image path for an entity
   * @param {string} itemClass
   * @param {string} itemId
   * @param {string} ext
   * @returns {string}
   */
  function generateImagePath(itemClass, itemId, ext = 'png') {
    return `images/${itemClass}/${itemId}.${ext}`
  }

  return {
    uploadImage,
    getImagePreview,
    removeImage,
    getAllImages,
    getImageCount,
    clearAllImages,
    hasImage,
    generateImagePath
  }
}
