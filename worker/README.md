# PlayFab Bundle Proxy

Cloudflare Worker that proxies PlayFab Admin Catalog API for the Bundle Editor frontend.
Lets the editor (running on GitHub Pages or `npm run dev`) Pull/Push the catalog
without exposing the PlayFab developer secret to the browser.

## First-time setup

1. `cd worker && npm install`
2. `npx wrangler login` — opens browser to authenticate with your Cloudflare account.
3. Set the three secrets (each command prompts for the value):
   ```
   npx wrangler secret put PLAYFAB_TITLE_ID
   npx wrangler secret put PLAYFAB_SECRET_KEY
   npx wrangler secret put EDITOR_PASSWORD
   ```
   - `PLAYFAB_TITLE_ID` — PlayFab Title ID (e.g. `8A0DA`)
   - `PLAYFAB_SECRET_KEY` — Title developer secret from PlayFab Game Manager → Title settings → Secret Keys
   - `EDITOR_PASSWORD` — any shared password the two of you will paste into the editor's Settings → PlayFab tab
4. `npm run deploy` — deploys to `https://playfab-bundle-proxy.<your-cf-subdomain>.workers.dev`. Wrangler prints the URL on success.
5. In the editor: Settings → PlayFab → paste the Worker URL and `EDITOR_PASSWORD` → Save.

## Endpoints

- `GET /` or `/health` — health check, no auth.
- `POST /pull` — body `{ "CatalogVersion": "Main" }`, returns `{ CatalogVersion, Catalog: [...] }` ready for `loadJSON`.
- `POST /push` — body `{ CatalogVersion, Catalog: [...] }`, calls `Admin/SetCatalogItems` (full replace).

All non-health requests require header `X-Editor-Auth: <EDITOR_PASSWORD>`.

## Local dev

```
npx wrangler dev
```

Put secrets in `.dev.vars` (gitignored):
```
PLAYFAB_TITLE_ID=...
PLAYFAB_SECRET_KEY=...
EDITOR_PASSWORD=...
```

## Logs

`npm run tail` — tails live Worker logs from Cloudflare.

## Updating secrets

Re-run `npx wrangler secret put <NAME>` with the new value. To delete: `npx wrangler secret delete <NAME>`.
