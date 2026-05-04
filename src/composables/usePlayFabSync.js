import { ref } from 'vue'
import { useSettings } from './useSettings'
import { usePlayFabData } from './usePlayFabData'

const isBusy = ref(false)
const lastError = ref('')
const lastStatus = ref('')

export function usePlayFabSync() {
  const { settings } = useSettings()
  const { loadJSON, exportJSON, state } = usePlayFabData()

  function isConfigured() {
    return !!(settings.playfab?.workerUrl && settings.playfab?.editorPassword)
  }

  function buildUrl(path) {
    const base = (settings.playfab.workerUrl || '').replace(/\/+$/, '')
    return `${base}${path}`
  }

  async function callWorker(path, body) {
    const res = await fetch(buildUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Editor-Auth': settings.playfab.editorPassword
      },
      body: JSON.stringify(body || {})
    })

    let data
    try { data = await res.json() } catch { data = null }

    if (!res.ok) {
      const msg = data?.error || `HTTP ${res.status}`
      const detail = data?.playfab?.errorMessage ? ` — ${data.playfab.errorMessage}` : ''
      throw new Error(`${msg}${detail}`)
    }

    return data
  }

  async function testConnection() {
    if (!settings.playfab?.workerUrl) {
      throw new Error('Worker URL is empty')
    }
    const res = await fetch(buildUrl('/health'))
    if (!res.ok) throw new Error(`Health check failed: HTTP ${res.status}`)
    const data = await res.json()
    if (!data.ok) throw new Error('Worker reported not OK')
    return data
  }

  async function pull() {
    if (!isConfigured()) {
      throw new Error('PlayFab sync not configured (Settings → PlayFab)')
    }
    isBusy.value = true
    lastError.value = ''
    lastStatus.value = 'Pulling from PlayFab...'
    try {
      const data = await callWorker('/pull', {
        CatalogVersion: settings.playfab.catalogVersion || 'Main'
      })
      if (!Array.isArray(data?.Catalog)) {
        throw new Error('Worker response missing Catalog array')
      }
      loadJSON(data)
      lastStatus.value = `Pulled ${data.Catalog.length} items`
      return data
    } catch (e) {
      lastError.value = e.message
      lastStatus.value = ''
      throw e
    } finally {
      isBusy.value = false
    }
  }

  async function push() {
    if (!isConfigured()) {
      throw new Error('PlayFab sync not configured (Settings → PlayFab)')
    }
    if (!state.catalogData) {
      throw new Error('No catalog loaded — load JSON or Pull first')
    }
    isBusy.value = true
    lastError.value = ''
    lastStatus.value = 'Pushing to PlayFab...'
    try {
      const jsonStr = exportJSON()
      const payload = JSON.parse(jsonStr)
      payload.CatalogVersion = settings.playfab.catalogVersion || payload.CatalogVersion || 'Main'

      const data = await callWorker('/push', payload)
      lastStatus.value = `Pushed ${data.count ?? payload.Catalog.length} items`
      return data
    } catch (e) {
      lastError.value = e.message
      lastStatus.value = ''
      throw e
    } finally {
      isBusy.value = false
    }
  }

  return {
    isBusy,
    lastError,
    lastStatus,
    isConfigured,
    testConnection,
    pull,
    push
  }
}
