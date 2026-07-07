import { computed, ref } from 'vue'

/**
 * Settings composable.
 *
 * Persists `{ apiHost, token }` in `localStorage` and exposes derived values
 * (the normalized API base, the matching web UI base for building the PAT
 * creation link, and an `isConfigured` flag).
 *
 * The token NEVER leaves the browser except as an `Authorization` header sent
 * to the configured `apiHost`. Nothing here talks to any other origin.
 *
 * State is module-level (a singleton) so every component shares one source of
 * truth. This is safe because the app is a pure client-side SPA (ssr:false).
 */

const STORAGE_KEY = 'copilot-agent-dashboard:settings'
const DEFAULT_API_HOST = 'https://api.github.com'

interface StoredSettings {
  apiHost: string
  token: string
}

const apiHost = ref<string>(DEFAULT_API_HOST)
const token = ref<string>('')
let loaded = false

/** Normalize a host: add https:// if missing, trim, strip trailing slashes. */
export function normalizeHost(input: string): string {
  let h = (input || '').trim()
  if (!h) return DEFAULT_API_HOST
  if (!/^https?:\/\//i.test(h)) h = `https://${h}`
  h = h.replace(/\/+$/, '')
  return h
}

/**
 * Derive the web UI base from an API host so we can link to the token settings
 * page on the right host.
 *  - https://api.github.com            -> https://github.com
 *  - https://api.acme.ghe.com          -> https://acme.ghe.com   (data residency)
 *  - https://ghe.example.com/api/v3    -> https://ghe.example.com (GHES)
 *
 * Assumption (preview API + host variety): stripping a leading `api.` label or
 * a trailing `/api/v3` path covers github.com, GHE.com and GHES. If it can't be
 * parsed we fall back to the input as-is.
 */
export function webBaseFromApiHost(host: string): string {
  const normalized = normalizeHost(host)
  try {
    const url = new URL(normalized)
    // GitHub Enterprise Server: API lives under /api/v3
    if (/\/api\/v3\/?$/i.test(url.pathname)) {
      return `${url.protocol}//${url.host}`
    }
    // github.com and GHE.com data-residency use an `api.` hostname prefix
    const hostname = url.hostname.replace(/^api\./i, '')
    return `${url.protocol}//${hostname}`
  } catch {
    return normalized
  }
}

function load(): void {
  if (loaded) return
  loaded = true
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<StoredSettings>
    if (parsed.apiHost) apiHost.value = normalizeHost(parsed.apiHost)
    if (typeof parsed.token === 'string') token.value = parsed.token
  } catch {
    // Corrupt storage — ignore and fall back to defaults.
  }
}

/**
 * Read the current resolved credentials without allocating computed refs.
 * Handy for non-reactive callers like the polling engine.
 */
export function getResolvedSettings(): { apiBase: string; token: string } {
  load()
  return { apiBase: normalizeHost(apiHost.value), token: token.value }
}

export function useSettings() {
  load()

  const apiBase = computed(() => normalizeHost(apiHost.value))
  const webBase = computed(() => webBaseFromApiHost(apiHost.value))
  const isConfigured = computed(() => Boolean(token.value && apiBase.value))
  /** Deep link to the fine-grained PAT creation page on the configured host. */
  const tokenSettingsUrl = computed(() => `${webBase.value}/settings/personal-access-tokens`)

  /** Persist the given settings and update in-memory state. */
  function save(next: { apiHost: string; token: string }): void {
    apiHost.value = normalizeHost(next.apiHost)
    token.value = next.token.trim()
    if (typeof window !== 'undefined') {
      const payload: StoredSettings = { apiHost: apiHost.value, token: token.value }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    }
  }

  /** Sign out: clear the token + persisted storage (host resets to default). */
  function clear(): void {
    token.value = ''
    apiHost.value = DEFAULT_API_HOST
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  }

  return {
    // reactive raw values
    apiHost,
    token,
    // derived
    apiBase,
    webBase,
    isConfigured,
    tokenSettingsUrl,
    // actions
    save,
    clear,
    DEFAULT_API_HOST,
  }
}
