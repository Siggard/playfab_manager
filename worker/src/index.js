const ALLOWED_METHODS = 'GET, POST, OPTIONS'
const ALLOWED_HEADERS = 'Content-Type, X-Editor-Auth'

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  }
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin)
    }
  })
}

async function callPlayFab(env, path, body) {
  const res = await fetch(`https://${env.PLAYFAB_TITLE_ID}.playfabapi.com${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-SecretKey': env.PLAYFAB_SECRET_KEY
    },
    body: JSON.stringify(body)
  })
  let data
  try { data = await res.json() } catch { data = null }
  return { res, data }
}

async function handlePull(request, env, origin) {
  let body = {}
  try { body = await request.json() } catch {}
  const catalogVersion = body.CatalogVersion || 'Main'

  const { res, data } = await callPlayFab(env, '/Admin/GetCatalogItems', {
    CatalogVersion: catalogVersion
  })

  if (!res.ok || !data || data.code !== 200) {
    return jsonResponse(
      { error: 'PlayFab error', status: res.status, playfab: data },
      res.status || 502,
      origin
    )
  }

  return jsonResponse({
    CatalogVersion: catalogVersion,
    Catalog: data.data?.Catalog || []
  }, 200, origin)
}

async function handlePush(request, env, origin) {
  let body
  try { body = await request.json() } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400, origin)
  }

  if (!body || !Array.isArray(body.Catalog)) {
    return jsonResponse({ error: 'Body must include Catalog array' }, 400, origin)
  }

  const catalogVersion = body.CatalogVersion || 'Main'

  const { res, data } = await callPlayFab(env, '/Admin/SetCatalogItems', {
    CatalogVersion: catalogVersion,
    Catalog: body.Catalog,
    SetAsDefaultCatalog: false
  })

  if (!res.ok || !data || data.code !== 200) {
    return jsonResponse(
      { error: 'PlayFab error', status: res.status, playfab: data },
      res.status || 502,
      origin
    )
  }

  return jsonResponse({
    ok: true,
    CatalogVersion: catalogVersion,
    count: body.Catalog.length
  }, 200, origin)
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    const url = new URL(request.url)
    const path = url.pathname

    if (path === '/' || path === '/health') {
      return jsonResponse({ ok: true, service: 'playfab-bundle-proxy' }, 200, origin)
    }

    const auth = request.headers.get('X-Editor-Auth')
    if (!env.EDITOR_PASSWORD || auth !== env.EDITOR_PASSWORD) {
      return jsonResponse({ error: 'Unauthorized' }, 401, origin)
    }

    if (!env.PLAYFAB_TITLE_ID || !env.PLAYFAB_SECRET_KEY) {
      return jsonResponse(
        { error: 'Worker not configured: missing PLAYFAB_TITLE_ID or PLAYFAB_SECRET_KEY' },
        500,
        origin
      )
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405, origin)
    }

    if (path === '/pull') return handlePull(request, env, origin)
    if (path === '/push') return handlePush(request, env, origin)

    return jsonResponse({ error: 'Not found' }, 404, origin)
  }
}
