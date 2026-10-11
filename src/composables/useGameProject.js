import { ref, computed, watch } from 'vue'
import { openDB } from 'idb'
import { usePlayFabData } from './usePlayFabData'

// The game reads its design data from <game project>/data/catalog:
//   index.json        — list of files to load
//   <ItemClass>.json  — one file per ItemClass, items sorted by ItemId
// Field names mirror PlayFab's GetCatalogItems so the game's parser barely changes,
// except CustomData is a real JSON object (no 1000-byte PlayFab limit).
export const CATALOG_SUBPATH = ['data', 'catalog']
export const CATALOG_FORMAT = 'fcm-catalog'
export const CATALOG_FORMAT_VERSION = 1
const INDEX_FILE = 'index.json'

const DB_NAME = 'playfab-editor-project'
const DB_VERSION = 1
const META_STORE = 'meta'
const HANDLE_KEY = 'projectDirHandle'
// Hashes of data/catalog files as of the last load/save, kept across reloads so a
// save can tell whether something else (a Claude session, a teammate's git pull)
// changed the files since the editor last synced with them.
const BASELINE_KEY = 'playfab-editor-game-baseline'

let dbInstance = null
let cachedHandle = null
let watcherInstalled = false

const projectName = ref('')
const pointsAtCatalog = ref(false) // true if the picked folder is data/catalog itself
const permissionGranted = ref(false)
const isBusy = ref(false)
const lastStatus = ref('')
const lastError = ref('')
const lastSavedAt = ref(null)
const baseline = ref(loadBaseline())    // { fileName: hash } on disk at last sync
const currentHashes = ref(null)         // { fileName: hash } the editor would write now

// cyrb53 — fast, sync, plenty for change detection
function hashText(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

function loadBaseline() {
  try {
    return JSON.parse(localStorage.getItem(BASELINE_KEY) || 'null')
  } catch {
    return null
  }
}

function setBaseline(hashes) {
  baseline.value = hashes
  if (hashes) localStorage.setItem(BASELINE_KEY, JSON.stringify(hashes))
  else localStorage.removeItem(BASELINE_KEY)
}

function sameHashes(a, b) {
  if (!a || !b) return false
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every(k => a[k] === b[k])
}

async function getDB() {
  if (!dbInstance) {
    dbInstance = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE)
        }
      }
    })
  }
  return dbInstance
}

async function loadHandle() {
  if (cachedHandle) return cachedHandle
  const db = await getDB()
  const stored = (await db.get(META_STORE, HANDLE_KEY)) || null
  cachedHandle = stored?.handle || null
  pointsAtCatalog.value = !!stored?.pointsAtCatalog
  projectName.value = cachedHandle?.name || ''
  return cachedHandle
}

async function hasEntry(dir, name, kind) {
  try {
    if (kind === 'directory') await dir.getDirectoryHandle(name)
    else await dir.getFileHandle(name)
    return true
  } catch {
    return false
  }
}

async function readText(dir, name) {
  const fh = await dir.getFileHandle(name)
  return (await fh.getFile()).text()
}

async function readTextOrNull(dir, name) {
  try {
    return await readText(dir, name)
  } catch {
    return null
  }
}

async function writeText(dir, name, text) {
  const fh = await dir.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  await w.write(text)
  await w.close()
}

function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), 'en', { numeric: true })
}

function toJSONText(obj) {
  return JSON.stringify(obj, null, 2) + '\n'
}

function fileNameForClass(itemClass) {
  return `${itemClass || 'unknown'}.json`
}

// Editor entity (PlayFab shape, CustomData as string) → game item
function entityToGameItem(entity, errors) {
  const item = {
    ItemId: entity.ItemId,
    ItemClass: entity.ItemClass,
    DisplayName: entity.DisplayName || ''
  }
  if (entity.Description) item.Description = entity.Description
  if (Array.isArray(entity.Tags) && entity.Tags.length > 0) item.Tags = [...entity.Tags]
  if (entity.Bundle) {
    item.Bundle = { BundledItems: [...(entity.Bundle.BundledItems || [])] }
  }
  if (entity.CustomData && String(entity.CustomData).trim()) {
    try {
      const data = typeof entity.CustomData === 'string'
        ? JSON.parse(entity.CustomData)
        : entity.CustomData
      // Written as-is: composite features keep CustomData as an array, never wrap it.
      // Only null and an empty object are dropped.
      const isEmptyObject = data && typeof data === 'object' && !Array.isArray(data) &&
        Object.keys(data).length === 0
      if (data !== null && !isEmptyObject) {
        item.CustomData = data
      }
    } catch (e) {
      errors.push(`${entity.ItemId}: CustomData — невалидный JSON (${e.message})`)
    }
  }
  return item
}

// Game item → editor entity (full PlayFab shape the rest of the editor expects)
function gameItemToEntity(item, fallbackClass) {
  const hasData = item.CustomData !== undefined && item.CustomData !== null
  return {
    ItemId: item.ItemId,
    ItemClass: item.ItemClass || fallbackClass,
    CatalogVersion: 'Main',
    DisplayName: item.DisplayName || '',
    Description: item.Description ?? null,
    VirtualCurrencyPrices: null,
    RealCurrencyPrices: null,
    Tags: item.Tags ?? null,
    CustomData: hasData
      ? (typeof item.CustomData === 'string' ? item.CustomData : JSON.stringify(item.CustomData))
      : null,
    Consumable: { UsageCount: null, UsagePeriod: null, UsagePeriodGroup: null },
    Container: null,
    Bundle: item.Bundle ? { BundledItems: [...(item.Bundle.BundledItems || [])] } : null,
    CanBecomeCharacter: false,
    IsStackable: false,
    IsTradable: false,
    ItemImageUrl: null,
    IsLimitedEdition: false,
    InitialLimitedEditionCount: 0,
    ActivatedMembership: null
  }
}

// Build { fileName: text } for the whole catalog. Throws if any CustomData is broken,
// so a half-valid catalog never lands in the game project.
export function buildGameFiles(entities) {
  const errors = []
  const byClass = new Map()

  for (const entity of entities) {
    const item = entityToGameItem(entity, errors)
    const cls = entity.ItemClass || 'unknown'
    if (!byClass.has(cls)) byClass.set(cls, [])
    byClass.get(cls).push(item)
  }

  const seen = new Set()
  for (const entity of entities) {
    if (seen.has(entity.ItemId)) errors.push(`${entity.ItemId}: повторяющийся ItemId`)
    seen.add(entity.ItemId)
  }

  if (errors.length > 0) {
    const err = new Error(`Нельзя сохранить — исправьте ошибки:\n${errors.join('\n')}`)
    err.details = errors
    throw err
  }

  const files = {}
  const classes = [...byClass.keys()].sort(naturalCompare)
  for (const cls of classes) {
    const items = byClass.get(cls).sort((a, b) => naturalCompare(a.ItemId, b.ItemId))
    files[fileNameForClass(cls)] = toJSONText({
      format: CATALOG_FORMAT,
      version: CATALOG_FORMAT_VERSION,
      item_class: cls,
      items
    })
  }

  const index = {
    format: CATALOG_FORMAT,
    version: CATALOG_FORMAT_VERSION,
    files: Object.keys(files)
  }

  return { files, index, indexText: toJSONText(index) }
}

function hashFiles(files, indexText) {
  const out = {}
  for (const [name, text] of Object.entries(files)) out[name] = hashText(text)
  out[INDEX_FILE] = hashText(indexText)
  return out
}

function hashesOf(entities) {
  try {
    const { files, indexText } = buildGameFiles(entities)
    return hashFiles(files, indexText)
  } catch {
    // Broken CustomData — never equal to what's on disk
    return { invalid: String(Date.now()) }
  }
}

// Thrown by saveToGame when files on disk changed since the editor last synced
export class GameFilesConflictError extends Error {
  constructor(files, { neverSynced }) {
    super(neverSynced
      ? `В папке уже есть данные, которые отличаются от редактора: ${files.join(', ')}`
      : `Файлы изменены вне редактора: ${files.join(', ')}`)
    this.name = 'GameFilesConflictError'
    this.files = files
    this.neverSynced = neverSynced
  }
}

export function useGameProject() {
  const { state, loadJSON } = usePlayFabData()

  function isSupported() {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window
  }

  const isConfigured = computed(() => !!projectName.value)

  const hasUnsavedChanges = computed(() =>
    state.catalogData !== null &&
    baseline.value !== null &&
    currentHashes.value !== null &&
    !sameHashes(currentHashes.value, baseline.value)
  )

  // Track whether the editor differs from what's on disk. Debounced: building the
  // signature serializes the whole catalog.
  function installWatcher() {
    if (watcherInstalled) return
    watcherInstalled = true
    let timer = null
    watch(
      () => state.entities,
      () => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          currentHashes.value = hashesOf(state.entities)
        }, 300)
      },
      { deep: true }
    )
  }

  async function init() {
    installWatcher()
    const handle = await loadHandle()
    if (handle) {
      const st = await handle.queryPermission({ mode: 'readwrite' })
      permissionGranted.value = st === 'granted'
    }
  }

  // Must be invoked from a user gesture. Accepts either the game project root
  // (has project.godot) or the data/catalog folder itself.
  async function pickFolder() {
    if (!isSupported()) {
      throw new Error('Браузер не поддерживает доступ к папкам. Используйте Chrome или Edge.')
    }
    const handle = await window.showDirectoryPicker({ id: 'fcm-game-project', mode: 'readwrite' })
    const perm = await handle.requestPermission({ mode: 'readwrite' })
    if (perm !== 'granted') throw new Error('Нет разрешения на запись в папку')

    const isProjectRoot = await hasEntry(handle, 'project.godot', 'file')
    const isCatalogDir = !isProjectRoot && (
      handle.name === 'catalog' || await hasEntry(handle, INDEX_FILE, 'file')
    )

    if (!isProjectRoot && !isCatalogDir) {
      const ok = confirm(
        `Папка «${handle.name}» не похожа на проект игры (в ней нет project.godot).\n\n` +
        `Нужно выбрать корень проекта игры, например C:\\Work\\FCM_2.\n\n` +
        `Всё равно использовать эту папку? Файлы будут записаны в ${handle.name}/data/catalog.`
      )
      if (!ok) return null
    }

    const db = await getDB()
    await db.put(META_STORE, { handle, pointsAtCatalog: isCatalogDir }, HANDLE_KEY)
    cachedHandle = handle
    projectName.value = handle.name
    pointsAtCatalog.value = isCatalogDir
    permissionGranted.value = true
    setBaseline(null) // a different folder — nothing synced with it yet
    return handle.name
  }

  async function forgetFolder() {
    const db = await getDB()
    await db.delete(META_STORE, HANDLE_KEY)
    cachedHandle = null
    projectName.value = ''
    pointsAtCatalog.value = false
    permissionGranted.value = false
    setBaseline(null)
  }

  // Resolve data/catalog, asking for permission again if the browser dropped it.
  // Must run inside a user gesture when permission is in 'prompt' state.
  async function getCatalogDir({ create }) {
    const handle = await loadHandle()
    if (!handle) throw new Error('Папка проекта игры не выбрана')
    let st = await handle.queryPermission({ mode: 'readwrite' })
    if (st !== 'granted') st = await handle.requestPermission({ mode: 'readwrite' })
    permissionGranted.value = st === 'granted'
    if (st !== 'granted') throw new Error('Нет доступа к папке проекта игры')

    if (pointsAtCatalog.value) return handle
    let dir = handle
    for (const part of CATALOG_SUBPATH) {
      dir = await dir.getDirectoryHandle(part, { create })
    }
    return dir
  }

  const displayPath = computed(() =>
    !projectName.value
      ? ''
      : pointsAtCatalog.value
        ? projectName.value
        : `${projectName.value}/${CATALOG_SUBPATH.join('/')}`
  )

  // force: overwrite even if the files changed outside the editor
  async function saveToGame({ force = false } = {}) {
    if (!state.catalogData) throw new Error('Каталог не загружен')
    isBusy.value = true
    lastError.value = ''
    try {
      const { files, index, indexText } = buildGameFiles(state.entities)
      const dir = await getCatalogDir({ create: true })

      // Files listed in the previous index but gone now (e.g. a removed ItemClass)
      let oldFiles = []
      const oldIndexText = await readTextOrNull(dir, INDEX_FILE)
      if (oldIndexText) {
        try { oldFiles = JSON.parse(oldIndexText).files || [] } catch { oldFiles = [] }
      }

      // Read everything this save could touch
      const names = new Set([
        ...Object.keys(files), ...oldFiles, ...Object.keys(baseline.value || {})
      ])
      names.delete(INDEX_FILE)
      const disk = {}
      for (const name of names) disk[name] = await readTextOrNull(dir, name)

      if (!force) {
        const base = baseline.value
        const conflicts = []
        for (const name of names) {
          const onDisk = disk[name]
          const ours = files[name] ?? null
          if (onDisk === ours) continue // disk already matches — nothing to lose
          if (base) {
            // Changed on disk since the last load/save?
            const was = base[name] ?? null
            const now = onDisk === null ? null : hashText(onDisk)
            if (was !== now) conflicts.push(name)
          } else if (onDisk !== null) {
            // Never synced with this folder: any differing existing file is at risk
            conflicts.push(name)
          }
        }
        if (conflicts.length > 0) {
          throw new GameFilesConflictError(conflicts.sort(naturalCompare), { neverSynced: !base })
        }
      }

      let written = 0
      for (const [name, text] of Object.entries(files)) {
        if (disk[name] === text) continue
        await writeText(dir, name, text)
        written++
      }

      let removed = 0
      for (const name of oldFiles) {
        if (files[name] || name === INDEX_FILE) continue
        try {
          await dir.removeEntry(name)
          removed++
        } catch { /* already gone */ }
      }

      // Index last: the game never sees a list pointing at files not yet written
      if ((await readTextOrNull(dir, INDEX_FILE)) !== indexText) {
        await writeText(dir, INDEX_FILE, indexText)
      }

      const hashes = hashFiles(files, indexText)
      setBaseline(hashes)
      currentHashes.value = hashes
      lastSavedAt.value = new Date()

      const parts = [`${state.entities.length} сущностей в ${index.files.length} файлах`]
      parts.push(written === 0 && removed === 0 ? 'без изменений' : `обновлено файлов: ${written}`)
      if (removed > 0) parts.push(`удалено: ${removed}`)
      lastStatus.value = `Сохранено — ${parts.join(', ')}`
      return { written, removed, files: index.files }
    } catch (e) {
      if (!(e instanceof GameFilesConflictError)) lastError.value = e.message
      throw e
    } finally {
      isBusy.value = false
    }
  }

  async function loadFromGame() {
    isBusy.value = true
    lastError.value = ''
    try {
      const dir = await getCatalogDir({ create: false }).catch(e => {
        if (e.name === 'NotFoundError') {
          throw new Error(`В проекте нет папки ${CATALOG_SUBPATH.join('/')} — сначала сохраните каталог в игру`)
        }
        throw e
      })
      const indexText = await readTextOrNull(dir, INDEX_FILE)
      if (!indexText) {
        throw new Error(`Не найден ${CATALOG_SUBPATH.join('/')}/${INDEX_FILE} — сначала сохраните каталог в игру`)
      }
      const index = JSON.parse(indexText)
      if (index.format !== CATALOG_FORMAT) {
        throw new Error(`${INDEX_FILE}: неизвестный формат «${index.format}»`)
      }

      const catalog = []
      const diskHashes = { [INDEX_FILE]: hashText(indexText) }
      for (const name of index.files || []) {
        const text = await readTextOrNull(dir, name)
        if (text === null) throw new Error(`Файл ${name} указан в ${INDEX_FILE}, но не найден`)
        diskHashes[name] = hashText(text)
        let data
        try { data = JSON.parse(text) } catch (e) { throw new Error(`${name}: невалидный JSON (${e.message})`) }
        for (const item of data.items || []) {
          catalog.push(gameItemToEntity(item, data.item_class))
        }
      }

      loadJSON({ CatalogVersion: 'Main', Catalog: catalog })

      // Baseline is what's on disk; if it was hand-edited (other formatting),
      // the dot stays until the next save normalizes it
      setBaseline(diskHashes)
      currentHashes.value = hashesOf(state.entities)
      lastSavedAt.value = null
      lastStatus.value = `Загружено ${catalog.length} сущностей из ${index.files.length} файлов`
      return catalog.length
    } catch (e) {
      lastError.value = e.message
      throw e
    } finally {
      isBusy.value = false
    }
  }

  return {
    isSupported,
    isConfigured,
    projectName,
    displayPath,
    permissionGranted,
    isBusy,
    lastStatus,
    lastError,
    lastSavedAt,
    hasUnsavedChanges,
    init,
    pickFolder,
    forgetFolder,
    saveToGame,
    loadFromGame
  }
}
