# Copilot Agent Dashboard

A fast, clean, **fully client-side** dashboard for your GitHub Copilot cloud
agent tasks/sessions and their status. It replaces the cluttered github.com
agents UI with something that loads instantly and works great on mobile and
desktop.

- **No backend.** It's a statically generated SPA (`nuxi generate`) that you can
  drop on any static host (Netlify, Azure Static Web Apps, GitHub Pages, an S3
  bucket, …). There are **no server routes** of any kind.
- **Your token stays in your browser.** You enter your own GitHub credentials in
  a settings screen; they're saved to `localStorage` and every API call goes
  **directly from your browser to the GitHub API**. The token is only ever sent
  as an `Authorization` header to the API host you configure — nowhere else. No
  analytics, no external fonts/CDNs, so it works on a locked-down corporate
  network once the JS is served.

> [!IMPORTANT]
> The GitHub **agent tasks REST API is in public preview** (verified July 2026,
> API version `2026-03-10`). Its shape and behaviour can change or break without
> notice. This app is written to tolerate unknown fields and unknown task states
> so it degrades gracefully, but a breaking change upstream may still require an
> update here.

---

## Features

- Lists all agent tasks across the repos you can access, newest activity first.
- Clear **state badges** with sensible colours: `in_progress` (blue, pulsing),
  `queued` (gray), `waiting_for_user` (loud amber — needs your attention),
  `completed` (green), `failed`/`timed_out` (red), `cancelled`/`idle` (muted).
  Unknown/preview states render their raw name in gray.
- **Filter chips**: All / Active / Done / Problems (client-side, with counts).
- **PR indicator** when a task has an associated pull request.
- Tapping a task opens its page on GitHub in a new tab (that's the whole "detail
  view" for v1 — by design).
- **Smart polling** (there is no public push channel for agent tasks):
  - Adaptive interval — ~12s while anything is active, backing off to 60s then
    120s once everything is settled; any state change snaps back to fast.
  - **Conditional requests** via `ETag`/`If-None-Match`; a `304 Not Modified`
    is cheap and doesn't count against your rate limit.
  - **Incremental** `since=` fetches after the first full load, with a full
    reconcile every ~10 minutes or on manual refresh.
  - Polling **pauses when the tab is hidden** and resumes with an immediate
    refresh when you come back.
  - Rate-limit exhaustion is surfaced with the reset time, and polling pauses
    until then.
- Dark/light theme via `prefers-color-scheme` (dark is the primary experience).

---

## Create the fine-grained personal access token

You need a **user-to-server token** with the **“Agent tasks” repository
permission (read)**. A fine-grained PAT is the easiest option. (OAuth / GitHub
App **user** tokens also work. GitHub App **installation** tokens are rejected.)

1. Go to **Settings → Developer settings → Fine-grained personal access
   tokens**, or directly to
   <https://github.com/settings/personal-access-tokens>.
2. Click **Generate new token**.
3. Choose the **resource owner** and the repositories you want the dashboard to
   see (or "All repositories").
4. Under **Permissions → Repository permissions**, find **“Agent tasks”** and
   set it to **Read-only**.
5. Generate the token and copy it (it starts with `github_pat_…`). You won't be
   able to see it again.
6. Paste it into the dashboard's **Settings** screen and click **Test
   connection**.

### GHE.com data residency / GitHub Enterprise

If your organization uses GHE.com data residency, set the **API host** in
Settings to your tenant's API host, e.g.:

```
https://api.SUBDOMAIN.ghe.com
```

The app derives the matching web host for the "create a token" link
automatically (e.g. `https://SUBDOMAIN.ghe.com/settings/personal-access-tokens`).
The default host is `https://api.github.com`. Trailing slashes are normalized.

---

## Run locally

```bash
npm install
npm run dev
```

Then open the URL it prints (default <http://localhost:3000>). On first visit
you'll be taken to **Settings** to enter your API host + token.

## Build (static site)

```bash
npm run generate
```

The static site is emitted to **`.output/public/`**. Serve that folder with any
static file server, for example:

```bash
npx serve .output/public
# or
npm run preview
```

Because it's a client-only SPA, deep links (e.g. `/settings`) rely on SPA
fallback routing — Nuxt emits a `200.html` fallback for hosts that support it
(Netlify, Azure Static Web Apps, etc.). For GitHub Pages you may want to copy
`200.html` to `404.html` so refreshes on `/settings` resolve.

---

## How it's built

- **Nuxt 3**, `ssr: false` → pure client-side SPA, no Nitro server handlers.
- TypeScript throughout. No Pinia, no axios, no UI framework — just Nuxt +
  `fetch` and a couple of small composables. Plain CSS with a single global
  stylesheet.

Key files:

| Path | What it does |
| --- | --- |
| `types/agent.ts` | Task types (tolerant of unknown fields/states) + state groups |
| `utils/githubApi.ts` | Low-level `fetch` client: required headers, ETag/304, rate-limit parsing, friendly errors |
| `composables/useSettings.ts` | `localStorage` settings, host normalization, token-page link |
| `composables/useTasks.ts` | The polling engine (adaptive interval, incremental `since`, visibility + rate-limit handling) |
| `pages/settings.vue` | Onboarding / settings with **Test connection** |
| `pages/index.vue` | The dashboard (list, filters, states, refresh) |
| `components/*` | `StateBadge`, `TaskCard`, `FilterChips`, `AppHeader` |

### Security notes

- No secrets are committed. Tokens live only in your browser's `localStorage`.
- Requests are sent with `credentials: 'omit'` so no cookies are ever attached —
  only the bearer token, and only to the configured API host.
- A `401` mid-session sends you back to Settings to re-enter the token.

---

## License

MIT
