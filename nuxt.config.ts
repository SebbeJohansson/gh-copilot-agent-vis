// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-03-10',
  devtools: { enabled: true },

  // Fully client-side, statically generated SPA.
  // ssr:false means `nuxi generate` emits a static client-only shell with no
  // server-rendered HTML and, crucially, NO Nitro server routes/handlers.
  // Auth + all GitHub API calls happen entirely in the user's browser.
  ssr: false,

  // No analytics, no external fonts/CDNs — everything is bundled and served
  // locally so the app works on a locked-down corporate network.
  app: {
    head: {
      title: 'Copilot Agent Dashboard',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        {
          name: 'description',
          content:
            'A fast, clean dashboard for your GitHub Copilot cloud agent tasks and their status.',
        },
        { name: 'color-scheme', content: 'dark light' },
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  css: ['~/assets/css/main.css'],

  // Keep the generated output a pure static SPA. A 200.html fallback is emitted
  // so deep links (e.g. /settings) resolve on static hosts that support SPA
  // fallback routing.
  nitro: {
    static: true,
  },

  typescript: {
    strict: true,
  },
})
