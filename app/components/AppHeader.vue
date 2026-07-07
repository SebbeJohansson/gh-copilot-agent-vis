<template>
  <header class="app-header">
    <div class="app-header__inner container">
      <NuxtLink to="/" class="brand" aria-label="Copilot Agent Dashboard home">
        <span class="brand__mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <rect width="24" height="24" rx="6" fill="var(--accent)" />
            <circle cx="9.3" cy="12" r="1.5" fill="#fff" />
            <circle cx="14.7" cy="12" r="1.5" fill="#fff" />
            <path
              d="M8 8.2C8.4 6.9 9.6 6 12 6s3.6.9 4 2.2"
              stroke="#fff"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </span>
        <span class="brand__text">
          <span class="brand__title">Copilot Agents</span>
          <span class="brand__sub">Dashboard</span>
        </span>
      </NuxtLink>

      <div class="app-header__actions">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
// Presentational only; pages provide their own action buttons via the slot.
</script>

<style scoped>
.app-header {
  background: var(--surface-1);
  border-bottom: 1px solid var(--border-1);
}
.app-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 56px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  color: var(--text-1);
}
.brand__mark {
  display: inline-flex;
}
.brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.05;
}
.brand__title {
  font-weight: 700;
  font-size: 1rem;
}
.brand__sub {
  font-size: 0.72rem;
  color: var(--text-3);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.app-header__actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
</style>
