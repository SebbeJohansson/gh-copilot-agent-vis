<template>
  <div>
    <AppHeader>
      <template #actions>
        <NuxtLink v-if="isConfigured" to="/" class="icon-btn" aria-label="Back to dashboard">
          <svg viewBox="0 0 16 16" width="18" height="18" fill="currentColor" aria-hidden="true">
            <path
              d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 1.06L4.81 7h8.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06Z"
            />
          </svg>
          <span class="icon-btn__text">Dashboard</span>
        </NuxtLink>
      </template>
    </AppHeader>

    <main class="container page">
      <h1 class="page__title">Settings</h1>
      <p class="page__lead">
        Your credentials are stored only in this browser (localStorage) and are sent
        <strong>directly</strong> to the API host below, never to any other server.
      </p>

      <div v-if="showAuthReason" class="notice notice--warn" role="alert">
        Your session was rejected (401). The token may be invalid or expired. Please re-enter it.
      </div>

      <form class="card form" @submit.prevent="saveAndContinue">
        <!-- API host -->
        <div class="field">
          <label class="field__label" for="apiHost">API host</label>
          <input
            id="apiHost"
            v-model="hostInput"
            class="input"
            type="url"
            inputmode="url"
            autocomplete="off"
            spellcheck="false"
            placeholder="https://api.github.com"
          />
          <p class="field__help">
            Default is <code>https://api.github.com</code>. For GHE.com data residency use
            <code>https://api.SUBDOMAIN.ghe.com</code>. Trailing slashes are fine.
          </p>
        </div>

        <!-- Token -->
        <div class="field">
          <label class="field__label" for="token">Fine-grained personal access token</label>
          <input
            id="token"
            v-model="tokenInput"
            class="input"
            type="password"
            autocomplete="off"
            spellcheck="false"
            placeholder="github_pat_..."
          />
          <p class="field__help">
            The token needs the <strong>"Agent tasks" repository permission (read)</strong>. Only
            user-to-server tokens work (a fine-grained PAT or OAuth/GitHub App user token). GitHub
            App <em>installation</em> tokens are rejected.
            <a :href="tokenSettingsUrl" target="_blank" rel="noopener noreferrer">
              Create a token on {{ webBaseLabel }} &rarr;
            </a>
          </p>
        </div>

        <!-- CORS proxy (advanced / optional) -->
        <details class="field details-field">
          <summary class="details-field__summary">Advanced</summary>
          <div class="field details-field__body">
            <label class="field__label" for="corsProxy">
              CORS proxy URL
              <span class="field__optional">(optional)</span>
            </label>
            <input
              id="corsProxy"
              v-model="corsProxyInput"
              class="input"
              type="url"
              inputmode="url"
              autocomplete="off"
              spellcheck="false"
              placeholder="https://your-cors-proxy.example.com/"
            />
            <p class="field__help">
              Only needed when deploying as a static site and the browser cannot reach the GitHub
              agent-tasks preview API directly due to CORS. Leave blank when running
              <code>nuxt dev</code>; the built-in dev proxy handles it automatically.
              <br />
              The full GitHub API URL is appended to whatever you enter here (trailing slash), so
              use the
              <a
                href="https://github.com/Rob--W/cors-anywhere"
                target="_blank"
                rel="noopener noreferrer"
                >CORS-Anywhere</a
              >
              format: <code>https://your-proxy.example.com/</code>.
            </p>
            <p class="field__help field__help--warn">
              <strong>Security:</strong> your token is forwarded through this proxy as a plain
              Bearer header. Only use a proxy you own or fully trust; never use a public shared
              proxy for a credential-bearing request.
            </p>
          </div>
        </details>

        <!-- Test result -->
        <div
          v-if="testResult"
          class="notice"
          :class="testResult.ok ? 'notice--ok' : 'notice--error'"
          role="status"
        >
          {{ testResult.message }}
        </div>

        <div class="form__actions">
          <button
            type="button"
            class="btn"
            :disabled="testing || !tokenInput.trim()"
            @click="testConnection"
          >
            <span v-if="testing" class="spinner" aria-hidden="true" />
            {{ testing ? 'Testing...' : 'Test connection' }}
          </button>

          <button type="submit" class="btn btn--primary" :disabled="!tokenInput.trim()">
            Save &amp; continue
          </button>

          <button v-if="isConfigured" type="button" class="btn btn--ghost btn--danger" @click="signOut">
            Sign out
          </button>
        </div>
      </form>

      <p class="page__footnote">
        The agent tasks API is in <strong>public preview</strong> and may change or break without
        notice.
      </p>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { normalizeHost, useSettings, webBaseFromApiHost } from '~/composables/useSettings'
import { useTasks } from '~/composables/useTasks'
import { githubRequest, tasksPath } from '~/utils/githubApi'

useHead({ title: 'Settings - Copilot Agents' })

const { apiHost, token, corsProxyUrl, isConfigured, save, clear } = useSettings()
const { reset } = useTasks()
const route = useRoute()

// Local form state, seeded from persisted settings.
const hostInput = ref(apiHost.value)
const tokenInput = ref(token.value)
const corsProxyInput = ref(corsProxyUrl.value)

const showAuthReason = computed(() => route.query.reason === 'auth')

// Token-creation link follows whatever host the user is currently typing.
const tokenSettingsUrl = computed(
  () => `${webBaseFromApiHost(hostInput.value)}/settings/personal-access-tokens`,
)
const webBaseLabel = computed(() => webBaseFromApiHost(hostInput.value).replace(/^https?:\/\//, ''))

const testing = ref(false)
const testResult = ref<{ ok: boolean; message: string } | null>(null)

async function testConnection() {
  if (!tokenInput.value.trim()) {
    testResult.value = { ok: false, message: 'Enter a token first.' }
    return
  }
  testing.value = true
  testResult.value = null
  const apiBase = normalizeHost(hostInput.value)
  const res = await githubRequest(apiBase, tasksPath({ per_page: 1 }), {
    token: tokenInput.value.trim(),
    corsProxyUrl: corsProxyInput.value.trim() || undefined,
  })
  testing.value = false
  if (res.ok) {
    testResult.value = {
      ok: true,
      message: 'Success. The token works and the agent tasks API is reachable.',
    }
  } else {
    testResult.value = { ok: false, message: res.errorMessage ?? `Request failed (${res.status}).` }
  }
}

function saveAndContinue() {
  if (!tokenInput.value.trim()) {
    testResult.value = { ok: false, message: 'Enter a token first.' }
    return
  }
  save({ apiHost: hostInput.value, token: tokenInput.value, corsProxyUrl: corsProxyInput.value })
  // Wipe any cached tasks so the dashboard reloads fresh with the new creds.
  reset()
  navigateTo('/')
}

function signOut() {
  clear()
  reset()
  hostInput.value = apiHost.value // reset back to default host
  tokenInput.value = ''
  corsProxyInput.value = ''
  testResult.value = null
}
</script>

<style scoped>
.page {
  padding-block: 1.5rem 3rem;
  max-width: 640px;
}
.page__title {
  margin: 0 0 0.35rem;
  font-size: 1.6rem;
}
.page__lead {
  margin: 0 0 1.25rem;
  color: var(--text-2);
  line-height: 1.5;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.form__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
}
.page__footnote {
  margin-top: 1.5rem;
  font-size: 0.82rem;
  color: var(--text-3);
}
.field__optional {
  font-weight: 400;
  font-size: 0.8em;
  color: var(--text-3);
  margin-left: 0.3rem;
}
.field__help--warn {
  margin-top: 0.5rem;
  padding: 0.4rem 0.6rem;
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--state-attention-bg) 60%, transparent);
  border: 1px solid var(--state-attention-border);
  color: var(--text-1);
}
.details-field {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0;
  background: transparent;
}
.details-field__summary {
  padding: 0.6rem 0.75rem;
  cursor: pointer;
  font-size: 0.85rem;
  color: var(--text-2);
  user-select: none;
  list-style: none;
}
.details-field__summary::-webkit-details-marker {
  display: none;
}
.details-field__summary::before {
  content: '\25B6';
  display: inline-block;
  font-size: 0.65em;
  margin-right: 0.4rem;
  transition: transform 0.15s;
}
details[open] .details-field__summary::before {
  transform: rotate(90deg);
}
.details-field__body {
  padding: 0 0.75rem 0.75rem;
}
.icon-btn__text {
  display: none;
}
@media (min-width: 480px) {
  .icon-btn__text {
    display: inline;
  }
}
</style>
