# Copilot Agent Dashboard

A fast, clean, fully client-side dashboard for your GitHub Copilot cloud agent
tasks and their status. It replaces the cluttered github.com agents UI with
something that loads instantly and works on mobile and desktop.

- No backend. It is a statically generated SPA (`nuxi generate`) you can drop
  on any static host (Netlify, Azure Static Web Apps, GitHub Pages, an S3
  bucket). There are no server routes of any kind.
- Your token stays in your browser. You enter your GitHub credentials in a
  settings screen; they are saved to `localStorage` and every API call goes
  directly from your browser to the GitHub API. The token is sent only as an
  `Authorization` header to the API host you configure, nowhere else. No
  analytics, no external fonts or CDNs, so it works on a locked-down corporate
  network once the JS is served.

> [!IMPORTANT]
> The GitHub agent tasks REST API is in public preview (verified July 2026,
> API version `2026-03-10`). Its shape and behaviour can change or break without
> notice. This app tolerates unknown fields and unknown task states so it
> degrades gracefully, but a breaking change upstream may still require an
> update here.

---

## Features

- Lists all agent tasks across the repos you can access, newest activity first.
- State badges with sensible colours: `in_progress` (blue, pulsing),
  `queued` (gray), `waiting_for_user` (loud amber, needs your attention),
  `completed` (green), `failed`/`timed_out` (red), `cancelled`/`idle` (muted).
  Unknown/preview states render their raw name in gray.
- Filter chips: All / Active / Done / Problems (client-side, with counts).
- PR indicator when a task has an associated pull request.
- Tapping a task opens its page on GitHub in a new tab (that is the whole
  "detail view" for v1, by design).
- Smart polling (there is no public push channel for agent tasks):
  - Adaptive interval: ~12s while anything is active, backing off to 60s then
    120s once everything is settled; any state change snaps back to fast.
  - Conditional requests via `ETag`/`If-None-Match`; a `304 Not Modified`
    is cheap and does not count against your rate limit.
  - Incremental `since=` fetches after the first full load, with a full
    reconcile every ~10 minutes or on manual refresh.
  - Polling pauses when the tab is hidden and resumes with an immediate
    refresh when you come back.
  - Rate-limit exhaustion is surfaced with the reset time, and polling pauses
    until then.
- Dark/light theme via `prefers-color-scheme` (dark is the primary experience).

---

## Create the fine-grained personal access token

You need a user-to-server token with the "Agent tasks" repository permission
(read). A fine-grained PAT is the easiest option. OAuth tokens and GitHub App
user tokens also work. GitHub App installation tokens are rejected.

1. Go to Settings > Developer settings > Fine-grained personal access tokens,
   or directly to <https://github.com/settings/personal-access-tokens>.
2. Click Generate new token.
3. Choose the resource owner and the repositories you want the dashboard to
   see (or "All repositories").
4. Under Permissions > Repository permissions, find "Agent tasks" and set it
   to Read-only.
5. Generate the token and copy it (it starts with `github_pat_`). You will not
   be able to see it again.
6. Paste it into the dashboard's Settings screen and click Test connection.

### GHE.com data residency / GitHub Enterprise

If your organization uses GHE.com data residency, set the API host in Settings
to your tenant's API host, e.g.:

```
https://api.SUBDOMAIN.ghe.com
```

The app derives the matching web host for the token creation link
automatically (e.g. `https://SUBDOMAIN.ghe.com/settings/personal-access-tokens`).
The default host is `https://api.github.com`. Trailing slashes are normalized.

---

## CORS and the CORS proxy setting

The dashboard calls the GitHub REST API directly from your browser. On
`localhost` the dev server includes a pass-through proxy, so CORS is not an
issue during development. On a static host (including GitHub Pages) the browser
makes the request directly to `api.github.com`. GitHub sends the correct CORS
headers for the agent tasks endpoint, so this should work out of the box in
most cases.

If you see a CORS error in the browser console after deploying, you can set a
CORS proxy URL in Settings (Advanced section). The app will route all API
requests through that URL by prepending it to the original request URL.

**Only use a proxy that you own or fully trust.** The proxy receives your
bearer token in every request. A malicious or compromised proxy can read and
replay your token.

---

## Token storage

The token is stored in `localStorage` in plain text, which is standard practice
for client-side credential stores. It is accessible to any JavaScript running
on the same origin. The production build includes a Content-Security-Policy
`<meta>` tag that blocks inline scripts and scripts from external origins, which
is the main defence against token theft via XSS. Do not deploy this app on a
shared origin alongside untrusted content.

---

## Run locally

```bash
npm install
npm run dev
```

Then open the URL it prints (default <http://localhost:3000>). On first visit
you will be taken to Settings to enter your API host and token.

## Build (static site)

```bash
npm run generate
```

The static site is emitted to `.output/public/`. Serve that folder with any
static file server, for example:

```bash
npx serve .output/public
# or
npm run preview
```

Because it is a client-only SPA, deep links (e.g. `/settings`) rely on SPA
fallback routing. Nuxt emits a `200.html` fallback for hosts that support it
(Netlify, Azure Static Web Apps, etc.). For GitHub Pages, copy `index.html` to
`404.html` so refreshes on `/settings` resolve.

If you are deploying to a subpath (e.g. `https://user.github.io/repo/`), set
`NUXT_APP_BASE_URL=/repo/` before running `nuxt generate`.

---

## How it is built

- Nuxt 3, `ssr: false`, pure client-side SPA, no Nitro server handlers in
  production.
- TypeScript throughout. No Pinia, no axios, no UI framework; just Nuxt,
  `fetch`, and a couple of small composables. Plain CSS with a single global
  stylesheet.

Key files:

| Path | What it does |
| --- | --- |
| `types/agent.ts` | Task types (tolerant of unknown fields/states) + state groups |
| `utils/githubApi.ts` | Low-level `fetch` client: required headers, ETag/304, rate-limit parsing, friendly errors |
| `composables/useSettings.ts` | `localStorage` settings, host normalization, token-page link |
| `composables/useTasks.ts` | The polling engine (adaptive interval, incremental `since`, visibility + rate-limit handling) |
| `pages/settings.vue` | Onboarding / settings with Test connection |
| `pages/index.vue` | The dashboard (list, filters, states, refresh) |
| `components/*` | `StateBadge`, `TaskCard`, `FilterChips`, `AppHeader` |

### Security notes

- No secrets are committed. Tokens live only in your browser's `localStorage`.
- Requests are sent with `credentials: 'omit'` so no cookies are attached;
  only the bearer token, and only to the configured API host.
- A `401` mid-session sends you back to Settings to re-enter the token.
- The dev-only proxy (used during `nuxt dev`) accepts only requests targeting
  `api.github.com` or `api.*.ghe.com` over HTTPS. IP addresses and loopback
  hosts are rejected with 403 to prevent SSRF.

---

## License

MIT
