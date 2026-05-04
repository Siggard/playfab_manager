import { ref } from 'vue'
import { openDB } from 'idb'

const DB_NAME = 'playfab-editor-images'
const DB_VERSION = 2
const META_STORE = 'meta'
const HANDLE_KEY = 'imagesDirHandle'

let dbInstance = null
let cachedHandle = null

const folderName = ref('')
const permissionGranted = ref(false)

async function getDB() {
  if (!dbInstance) {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE)
        }
        // Old "images" store from v1 (raw IDB blob storage) is no longer
        // used; left in place to avoid surprising users who still rely on
        // the ZIP export of older entries.
      }
    })
  }
  return dbInstance
}

async function loadHandle() {
  if (cachedHandle) return cachedHandle
  const db = await getDB()
  cachedHandle = (await db.get(META_STORE, HANDLE_KEY)) || null
  folderName.value = cachedHandle?.name || ''
  return cachedHandle
}

async function checkPermission(handle) {
  if (!handle) return false
  const state = await handle.queryPermission({ mode: 'readwrite' })
  permissionGranted.value = state === 'granted'
  return permissionGranted.value
}

async function getRootHandle() {
  const handle = await loadHandle()
  if (!handle) return null
  const ok = await checkPermission(handle)
  return ok ? handle : null
}

function splitPath(relPath) {
  const parts = relPath.split('/').filter(Boolean)
  return { dirParts: parts.slice(0, -1), fileName: parts[parts.length - 1] }
}

async function getDirHandle(rootHandle, dirParts, { create = false } = {}) {
  let dir = rootHandle
  for (const part of dirParts) {
    dir = await dir.getDirectoryHandle(part, { create })
  }
  return dir
}

async function* walkAll(dirHandle, prefix) {
  for await (const [name, entry] of dirHandle.entries()) {
    const path = prefix ? `${prefix}/${name}` : name
    if (entry.kind === 'file') {
      yield { path, handle: entry }
    } else if (entry.kind === 'directory') {
      yield* walkAll(entry, path)
    }
  }
}

function extFromFile(file) {
  const fromName = file.name && file.name.match(/\.([a-z0-9]+)$/i)?.[1]
  if (fromName) return fromName.toLowerCase()
  const fromMime = file.type && file.type.split('/')[1]
  return (fromMime || 'bin').toLowerCase()
}

export function useImageManager() {

  function isSupported() {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window
  }

  // Must be invoked from a user gesture (click handler).
  async function pickFolder() {
    if (!isSupported()) {
      throw new Error('File System Access API is not supported in this browser. Use Chrome, Edge, or Safari.')
    }
    const handle = await window.showDirectoryPicker({
      id: 'playfab-images',
      mode: 'readwrite'
    })
    const perm = await handle.requestPermission({ mode: 'readwrite' })
    if (perm !== 'granted') {
      throw new Error('Read/write permission denied')
    }
    const db = await getDB()
    await db.put(META_STORE, handle, HANDLE_KEY)
    cachedHandle = handle
    folderName.value = handle.name
    permissionGranted.value = true
    return handle.name
  }

  // Must be invoked from a user gesture if state is 'prompt'.
  async function requestPermission() {
    const handle = await loadHandle()
    if (!handle) throw new Error('No folder picked yet')
    const perm = await handle.requestPermission({ mode: 'readwrite' })
    permissionGranted.value = perm === 'granted'
    return permissionGranted.value
  }

  async function refreshPermissionState() {
    const handle = await loadHandle()
    if (!handle) {
      permissionGranted.value = false
      return false
    }
    return checkPermission(handle)
  }

  async function forgetFolder() {
    const db = await getDB()
    await db.delete(META_STORE, HANDLE_KEY)
    cachedHandle = null
    folderName.value = ''
    permissionGranted.value = false
  }

  async function uploadImage(file, itemClass, itemId) {
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image')
    }
    const root = await getRootHandle()
    if (!root) {
      throw new Error('No image folder configured. Open Settings → PlayFab → Pick Folder.')
    }

    const ext = extFromFile(file)
    const path = `${itemClass}/${itemId}.${ext}`

    const { dirParts, fileName } = splitPath(path)
    const dir = await getDirHandle(root, dirParts, { create: true })
    const fileHandle = await dir.getFileHandle(fileName, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(file)
    await writable.close()

    console.log(`Image written: ${path} (${file.size} bytes)`)
    return path
  }

  async function getImagePreview(path) {
    if (!path) return null
    const root = await getRootHandle()
    if (!root) return null
    try {
      const { dirParts, fileName } = splitPath(path)
      const dir = await getDirHandle(root, dirParts, { create: false })
      const fileHandle = await dir.getFileHandle(fileName, { create: false })
      const file = await fileHandle.getFile()
      return URL.createObjectURL(file)
    } catch {
      return null
    }
  }

  async function removeImage(path) {
    if (!path) return
    const root = await getRootHandle()
    if (!root) return
    try {
      const { dirParts, fileName } = splitPath(path)
      const dir = await getDirHandle(root, dirParts, { create: false })
      await dir.removeEntry(fileName)
      console.log(`Image removed: ${path}`)
    } catch (e) {
      console.warn(`Remove image failed: ${e.message}`)
    }
  }

  async function hasImage(path) {
    if (!path) return false
    const root = await getRootHandle()
    if (!root) return false
    try {
      const { dirParts, fileName } = splitPath(path)
      const dir = await getDirHandle(root, dirParts, { create: false })
      await dir.getFileHandle(fileName, { create: false })
      return true
    } catch {
      return false
    }
  }

  async function getAllImages() {
    const root = await getRootHandle()
    if (!root) return {}
    const result = {}
    for await (const entry of walkAll(root, '')) {
      result[entry.path] = await entry.handle.getFile()
    }
    return result
  }

  async function getImageCount() {
    const root = await getRootHandle()
    if (!root) return 0
    let count = 0
    for await (const _ of walkAll(root, '')) count++
    return count
  }

  // Folder is shared with the user's game project, so we must not wipe its
  // contents. "Clear" here just forgets the folder handle in the editor;
  // files on disk stay untouched.
  async function clearAllImages() {
    await forgetFolder()
  }

  function generateImagePath(itemClass, itemId, ext = 'png') {
    return `${itemClass}/${itemId}.${ext}`
  }

  return {
    isSupported,
    pickFolder,
    requestPermission,
    refreshPermissionState,
    forgetFolder,
    folderName,
    permissionGranted,

    uploadImage,
    getImagePreview,
    removeImage,
    hasImage,
    getAllImages,
    getImageCount,
    clearAllImages,
    generateImagePath
  }
}
