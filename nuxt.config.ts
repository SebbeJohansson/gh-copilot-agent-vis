// https://nuxt.com/docs/api/configuration/nuxt-config

// Content-Security-Policy injected as a <meta http-equiv> tag.
// Conditioned on NODE_ENV=production so that the Vite dev server's
// HMR and devtools overlay are not blocked during `nuxt dev`.
//
// Notes on the policy:
//   script-src 'self'         - blocks injected external scripts (XSS defence)
//   style-src  'unsafe-inline'- Vue scoped styles and Nuxt inject <style> tags
//   connect-src https:        - allows the GitHub API and any HTTPS CORS proxy
//                               the user configures; blocks plain-HTTP exfil
//   object-src 'none'         - disallows Flash / plugins entirely
//   base-uri   'self'         - prevents <base> tag injection changing all links
//   form-action 'self'        - no forms post to third-party URLs
//
// frame-ancestors is intentionally omitted: it only works as an HTTP header,
// not as a <meta> tag, so it would be silently ignored here.
const cspContent = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https:",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

const isProd = process.env.NODE_ENV === 'production'

export default defineNuxtConfig({
  compatibilityDate: '2026-03-10',
  devtools: { enabled: true },

  // Fully client-side, statically generated SPA.
  // ssr:false means `nuxi generate` emits a static client-only shell with
  // no server-rendered HTML and no Nitro server routes or handlers.
  // Auth and all GitHub API calls happen entirely in the user's browser.
  ssr: false,

  // No analytics, no external fonts or CDNs; everything is bundled and
  // served locally so the app works on a locked-down corporate network.
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
        // CSP only in production builds; dev keeps it off to avoid blocking
        // Vite's HMR and the devtools error overlay.
        ...(isProd
          ? [{ 'http-equiv': 'Content-Security-Policy', content: cspContent }]
          : []),
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  css: ['~/assets/css/main.css'],

  // Keep the generated output a pure static SPA. A 200.html fallback is
  // emitted so deep links (e.g. /settings) resolve on static hosts that
  // support SPA fallback routing.
  nitro: {
    static: true,
  },

  vite: {
    optimizeDeps: {
      include: ['@vue/devtools-core', '@vue/devtools-kit'],
    },
  },

  typescript: {
    strict: true,
  },
})
