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
        <strong>directly</strong> to the API host below — never to any other server.
      </p>

      <div v-if="showAuthReason" class="notice notice--warn" role="alert">
        Your session was rejected (401). The token may be invalid or expired — please re-enter it.
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
            placeholder="github_pat_…"
          />
          <p class="field__help">
            The token needs the <strong>“Agent tasks” repository permission (read)</strong>. Only
            user-to-server tokens work (a fine-grained PAT or OAuth/GitHub App user token) — GitHub
            App <em>installation</em> tokens are rejected.
            <a :href="tokenSettingsUrl" target="_blank" rel="noopener noreferrer">
              Create a token on {{ webBaseLabel }} →
            </a>
          </p>
        </div>

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
            {{ testing ? 'Testing…' : 'Test connection' }}
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

useHead({ title: 'Settings · Copilot Agents' })

const { apiHost, token, isConfigured, save, clear } = useSettings()
const { reset } = useTasks()
const route = useRoute()

// Local form state, seeded from persisted settings.
const hostInput = ref(apiHost.value)
const tokenInput = ref(token.value)

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
  })
  testing.value = false
  if (res.ok) {
    testResult.value = {
      ok: true,
      message: 'Success — the token works and the agent tasks API is reachable.',
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
  save({ apiHost: hostInput.value, token: tokenInput.value })
  // Wipe any cached tasks so the dashboard reloads fresh with the new creds.
  reset()
  navigateTo('/')
}

function signOut() {
  clear()
  reset()
  hostInput.value = apiHost.value // reset back to default host
  tokenInput.value = ''
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
.icon-btn__text {
  display: none;
}
@media (min-width: 480px) {
  .icon-btn__text {
    display: inline;
  }
}
</style>
