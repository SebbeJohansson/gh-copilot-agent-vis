<template>
  <div v-if="isConfigured">
    <div class="stuck">
      <AppHeader>
        <template #actions>
          <span class="sync" :title="`Last successful sync at ${syncClock}`">
            <span
              class="sync__dot"
              :class="{ 'sync__dot--live': refreshing }"
              aria-hidden="true"
            />
            <span class="sync__label">Updated</span>
            <span class="sync__time">{{ syncClock }}</span>
          </span>

          <button
            type="button"
            class="icon-btn"
            :disabled="refreshing"
            aria-label="Refresh now"
            @click="refreshNow"
          >
            <svg
              viewBox="0 0 16 16"
              width="17"
              height="17"
              fill="currentColor"
              aria-hidden="true"
              :class="{ 'spin': refreshing }"
            >
              <path
                d="M8 3a5 5 0 1 0 4.546 2.914.75.75 0 0 1 1.362-.626A6.5 6.5 0 1 1 8 1.5v-.75a.25.25 0 0 1 .41-.192l2.36 1.966a.25.25 0 0 1 0 .384l-2.36 1.966A.25.25 0 0 1 8 4.682V3Z"
              />
            </svg>
          </button>

          <NuxtLink to="/settings" class="icon-btn" aria-label="Settings">
            <svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden="true">
              <path
                d="M8 0a8.2 8.2 0 0 1 .701.031C9.444.095 9.99.645 10.16 1.29l.288 1.107c.018.066.079.158.212.224.231.114.454.243.668.386.123.082.233.09.299.071l1.103-.303c.644-.176 1.392.021 1.82.63.27.385.506.792.704 1.218.315.675.111 1.422-.364 1.891l-.814.806c-.049.048-.098.147-.088.294.016.257.016.515 0 .772-.01.147.039.246.088.294l.814.806c.475.469.679 1.216.364 1.891a7.977 7.977 0 0 1-.704 1.217c-.428.61-1.176.807-1.82.63l-1.102-.302c-.067-.019-.177-.011-.3.071a5.909 5.909 0 0 1-.668.386c-.133.066-.194.158-.211.224l-.29 1.106c-.168.646-.715 1.196-1.458 1.26a8.006 8.006 0 0 1-1.402 0c-.743-.064-1.289-.614-1.458-1.26l-.289-1.106c-.018-.066-.079-.158-.212-.224a5.738 5.738 0 0 1-.668-.386c-.123-.082-.233-.09-.299-.071l-1.103.303c-.644.176-1.392-.021-1.82-.63a8.12 8.12 0 0 1-.704-1.218c-.315-.675-.111-1.422.363-1.891l.815-.806c.05-.048.098-.147.088-.294a6.214 6.214 0 0 1 0-.772c-.01-.147-.038-.246-.088-.294l-.815-.806C.635 6.045.431 5.298.746 4.623a7.92 7.92 0 0 1 .704-1.217c.428-.61 1.176-.807 1.82-.63l1.102.302c.067.019.177.011.3-.071.214-.143.437-.272.668-.386.133-.066.194-.158.211-.224l.29-1.106C6.51.645 7.056.095 7.799.03A8.2 8.2 0 0 1 8 0Zm1.973 8a1.973 1.973 0 1 0-3.946 0 1.973 1.973 0 0 0 3.946 0Z"
              />
            </svg>
          </NuxtLink>
        </template>
      </AppHeader>

      <div class="toolbar">
        <div class="container toolbar__inner">
          <FilterChips v-model="filter" :counts="counts" />
        </div>
      </div>
    </div>

    <main class="container list-page">
      <!-- Rate-limit banner -->
      <div v-if="rateLimitedUntil" class="notice notice--warn" role="alert">
        Rate limit reached. Polling is paused until <strong>{{ rateLimitClock }}</strong
        >. It will resume automatically.
      </div>

      <!-- Non-fatal error banner (we still have tasks to show) -->
      <div v-else-if="error && tasks.length" class="notice notice--error" role="alert">
        {{ error.message }}
        <button type="button" class="notice__action" @click="refreshNow">Retry</button>
      </div>

      <!-- Loading skeleton (first load, nothing yet) -->
      <div v-if="loading && !tasks.length" class="task-list" aria-hidden="true">
        <div v-for="n in 6" :key="n" class="skeleton">
          <div class="skeleton__badge" />
          <div class="skeleton__line skeleton__line--title" />
          <div class="skeleton__line skeleton__line--meta" />
        </div>
      </div>

      <!-- Fatal error (nothing to show) -->
      <div v-else-if="error && !tasks.length" class="state-card state-card--error" role="alert">
        <h2 class="state-card__title">Couldn't load tasks</h2>
        <p class="state-card__body">{{ error.message }}</p>
        <div class="state-card__actions">
          <button type="button" class="btn btn--primary" @click="refreshNow">Try again</button>
          <NuxtLink to="/settings" class="btn btn--ghost">Open settings</NuxtLink>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else-if="!filteredTasks.length" class="state-card">
        <h2 class="state-card__title">
          {{ tasks.length ? 'Nothing in this filter' : 'No agent tasks yet' }}
        </h2>
        <p class="state-card__body">
          <template v-if="tasks.length">
            No tasks match the "{{ filter }}" filter right now.
          </template>
          <template v-else>
            When you start a Copilot coding agent task, it'll show up here. Tasks refresh
            automatically.
          </template>
        </p>
        <div class="state-card__actions">
          <button v-if="tasks.length" type="button" class="btn" @click="filter = 'all'">
            Show all
          </button>
          <button v-else type="button" class="btn btn--primary" @click="refreshNow">Refresh</button>
        </div>
      </div>

      <!-- The list -->
      <div v-else class="task-list">
        <TaskCard v-for="task in filteredTasks" :key="String(task.id)" :task="task" :now="now" />
      </div>
    </main>
  </div>

  <!-- Not configured yet: onMounted redirects to /settings; avoid flashing the
       empty dashboard in the meantime. -->
  <div v-else class="container redirecting">
    <p>Redirecting to settings…</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useNow } from '~/composables/useNow'
import { useSettings } from '~/composables/useSettings'
import { useTasks } from '~/composables/useTasks'
import { formatClock } from '~/utils/time'

useHead({ title: 'Copilot Agent Dashboard' })

const { isConfigured } = useSettings()
const {
  tasks,
  filteredTasks,
  counts,
  filter,
  loading,
  refreshing,
  error,
  authError,
  lastChecked,
  rateLimitedUntil,
  start,
  stop,
  refreshNow,
} = useTasks()

const now = useNow()

const syncClock = computed(() => formatClock(lastChecked.value))
const rateLimitClock = computed(() =>
  rateLimitedUntil.value ? formatClock(rateLimitedUntil.value * 1000) : '',
)

onMounted(() => {
  // Client-only guard: no token yet -> go set one up.
  if (!isConfigured.value) {
    navigateTo('/settings')
    return
  }
  start()
})

onBeforeUnmount(() => stop())

// A 401 mid-session routes to settings with a message (URL is preserved as the
// dashboard root, so returning after re-auth lands right back here).
watch(authError, (isAuthError) => {
  if (isAuthError) {
    stop()
    navigateTo('/settings?reason=auth')
  }
})
</script>

<style scoped>
.stuck {
  position: sticky;
  top: 0;
  z-index: 20;
}
.toolbar {
  background: var(--surface-1);
  border-bottom: 1px solid var(--border-1);
  backdrop-filter: saturate(1.1);
}
.toolbar__inner {
  padding-block: 0.6rem;
}

.list-page {
  padding-block: 1rem 3rem;
}

.redirecting {
  padding-block: 3rem;
  color: var(--text-2);
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

/* sync indicator in the header */
.sync {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  color: var(--text-3);
  white-space: nowrap;
}
.sync__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--state-success-fg);
}
.sync__dot--live {
  animation: badge-pulse 1s ease-in-out infinite;
}
.sync__label {
  display: none;
}
@media (min-width: 560px) {
  .sync__label {
    display: inline;
  }
}

.spin {
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes badge-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
@media (prefers-reduced-motion: reduce) {
  .spin,
  .sync__dot--live {
    animation: none !important;
  }
}

/* skeletons */
.skeleton {
  border: 1px solid var(--border-1);
  border-radius: var(--radius);
  background: var(--surface-1);
  padding: 0.9rem 1rem;
}
.skeleton__badge {
  width: 84px;
  height: 20px;
  border-radius: 999px;
  margin-bottom: 0.6rem;
}
.skeleton__line {
  height: 12px;
  border-radius: 6px;
}
.skeleton__line--title {
  width: 65%;
  margin-bottom: 0.5rem;
}
.skeleton__line--meta {
  width: 35%;
}
.skeleton__badge,
.skeleton__line {
  background: linear-gradient(
    90deg,
    var(--surface-2) 25%,
    var(--surface-3) 37%,
    var(--surface-2) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}
@keyframes shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton__badge,
  .skeleton__line {
    animation: none !important;
  }
}
</style>
