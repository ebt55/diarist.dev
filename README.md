# diarist.dev

Live at [diarist.dev](https://diarist.dev). The website for [Diarist](https://github.com/ebt55/diarist), a meeting transcriber for
Windows that runs entirely on your own PC. One landing page, a `/models/` page with
benchmark charts, a `/code-signing/` policy page, and a `/docs` section rendered from the
app repository's Markdown.
Hand-written HTML and CSS, a small bun build script, no client-side framework, no
JavaScript on the pages, no web fonts, no analytics, and no requests to any other host.

`DESIGN.md` is the brief: what the pages say, how they look and why.

## Build and preview

Needs [bun](https://bun.sh) (1.2 or newer).

```sh
bun install          # markdown-it and sharp, pinned to exact versions
bun run build        # writes dist/
bun run dev          # builds, serves dist/ on http://localhost:4321, rebuilds on change
bun run check        # HTML well-formedness, internal links, voice rules, page weight, hosting files
bun run icons        # re-renders favicon.png and apple-touch-icon.png from logo.svg
```

What `bun run build` does:

1. Copies `src/assets/` into `dist/assets/` and writes `src/styles.css` as
   `dist/assets/h/styles.<hash>.css`. Files under `assets/h/` carry a content hash in
   their name, so `_headers` lets browsers cache them for a year.
2. Reads the app repository's files. Locally it reads the sibling checkout `../meet-assist`
   when that folder exists (the app's folder on the author's PC still has its old name);
   in CI, on Cloudflare, or with `DOCS_SOURCE=remote`, it fetches from
   `https://raw.githubusercontent.com/ebt55/diarist/main/`. A missing, empty or malformed
   source fails the build with a non-zero exit, so an empty page is never published.
3. Renders `dist/docs/<page>/index.html` from the Markdown files listed under `docs` in
   `site.config.json`.
4. Builds `dist/models/index.html` from `src/models.html` and `docs/eval/benchmarks.json`:
   four horizontal bar charts as inline SVG (`build/charts.ts`, no charting library), each
   followed by a `<details>` table with the same numbers. The data file names, per block,
   the file in the app repository its numbers come from.
5. Reads the current release from
   `https://raw.githubusercontent.com/ebt55/diarist/main/updater/latest.json`, and the
   installer size from a HEAD request on the installer URL. Without a network it falls back
   to `release` in `site.config.json` and prints a warning (`OFFLINE=1` forces that).
   Update the fallback when a new release ships.
6. Reads the hero screenshots (`docs/screenshots/meeting-light.png` and `meeting-dark.png`)
   from the app repository and converts them to AVIF and WebP (828 and 1652 px wide) with
   sharp, into `dist/assets/h/`. Without sharp it ships the PNGs and says so. Look at a new
   screenshot at full size in the app repository before it is committed there: the site
   publishes whatever is on `main`.
7. Writes `dist/404.html` and `dist/_headers` for Cloudflare Workers static assets (see
   Deployment).

Docs rendering follows DESIGN.md section 7: headings get GitHub-style ids, links to another
rendered file go to its site page, other relative links go to the file on GitHub, relative
images go to raw.githubusercontent.com, raw HTML is escaped.

The charts have no `viewBox` on purpose: bar lengths are percentages of the chart's width,
so a chart fills its column, while the text keeps its CSS size and stays legible at 360 px.

## Deployment

The site is hosted on **Cloudflare Workers** as static assets, built and deployed by
**Workers Builds** from this GitHub repository (the same setup as ebinbt.dev; Cloudflare
steers new static sites to Workers rather than Pages). Every push to `main` is built and
published by Cloudflare; GitHub Actions runs the checks (`check.yml`) and the weekly refresh
(`refresh.yml`). `wrangler.jsonc` at the repository root is the Worker's configuration: no
Worker script, just `dist/` as the assets directory and `404.html` for paths without a file.
The output is plain static files, so `dist/` can be hosted anywhere else without changes.

### Workers Builds settings

Create the Worker in the Cloudflare dashboard (Workers & Pages, Create, Import a repository,
`ebt55/diarist.dev`) with:

| Setting | Value |
|---|---|
| Project name | `diarist-dev` (the same as `name` in `wrangler.jsonc`) |
| Production branch | `main` |
| Build command | `bun install --frozen-lockfile && bun run build` |
| Deploy command | `npx wrangler deploy` (the default) |
| Preview command | leave the default; `npx wrangler versions upload` also works and gives a version URL per branch instead of a preview URL |
| Enable Preview builds | on is fine; other branches build the same way |
| Protect with Cloudflare Access | off |
| Advanced settings, build variable `DOCS_SOURCE` | `remote` |
| Advanced settings, build variable `BUN_VERSION` | `1.2.1` |

Build variables are build-time only; the site has nothing at runtime. The Workers Builds
image reads `BUN_VERSION` the way the Pages image did and uses that bun release; without it
the image's default bun (1.2.15 at the time of writing) is used, which also works. `npx
wrangler deploy` fetches the current wrangler, which is not a dependency of this repository.
`bunx wrangler deploy --dry-run` runs the same configuration locally, without credentials,
and reports what it would upload.

### Custom domain

In the Worker: Settings, Domains & Routes, Add, Custom domain, `diarist.dev`; then the same
for `www.diarist.dev`. The `diarist.dev` zone is on Cloudflare (nameservers at Porkbun point
at Cloudflare), so Cloudflare creates the DNS records itself. Unlike Pages, a Workers custom
domain needs its zone on Cloudflare. `.dev` is on the HSTS preload list, so the site only
works over HTTPS; Cloudflare provides the certificate.

A custom domain matches its hostname exactly, and Workers static assets skip any
`_redirects` line whose source names a host (wrangler prints "Only relative URLs are
allowed"), so the `www` to apex redirect is a rule in the zone: Rules, Redirect Rules,
create a rule for incoming requests where Hostname equals `www.diarist.dev`, type Dynamic,
expression `concat("https://diarist.dev", http.request.uri.path)`, status 301, preserve
query string. Redirect Rules run before the Worker. The build therefore writes no
`_redirects` (Pages honoured the host-level line; DESIGN.md section 8).

### Weekly refresh

The docs, the benchmark data and the release version come from the app repository at build
time, so a rebuild without a commit keeps them current. Workers Builds builds on a push, so
`.github/workflows/refresh.yml` builds the site in GitHub Actions every Monday at 05:17 UTC
and on manual dispatch, runs the checks, and deploys `dist/` with
[`cloudflare/wrangler-action`](https://github.com/cloudflare/wrangler-action) (`wrangler
deploy`, the same command Workers Builds runs). One-time setup, two repository secrets
(GitHub: Settings, Secrets and variables, Actions):

1. `CLOUDFLARE_API_TOKEN`: in the Cloudflare dashboard, Manage account, Account API tokens,
   Create Token, template **Edit Cloudflare Workers**, scoped to this account. Its account
   permission, Workers Scripts: Edit, is what `wrangler deploy` needs.
2. `CLOUDFLARE_ACCOUNT_ID`: the account id shown on the Workers & Pages overview page.

Without both secrets the workflow prints a notice and does nothing.

### Checks

`.github/workflows/check.yml` runs on every push and pull request:
`bun install --frozen-lockfile`, `DOCS_SOURCE=remote bun run build`, `bun run check`. It
does not deploy.

### Headers and the 404 page

`bun run build` writes two files Cloudflare Workers reads from the assets directory:

- `dist/_headers`: for every page, `Content-Security-Policy: default-src 'self'; img-src
  'self' data:; style-src 'self'; script-src 'none'; frame-ancestors 'none'` (matching the
  meta CSP in each page), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`
  and `Permissions-Policy: camera=(), microphone=(), geolocation=()`; and for `/assets/h/*`,
  whose file names carry a content hash, `Cache-Control: public, max-age=31536000,
  immutable`. HTML stays on Cloudflare's default caching. Workers applies the file to static
  asset responses with the same syntax and limits as Pages (100 rules, 2,000 characters a
  line), and does not serve the file itself.
- `dist/404.html`: served with status 404 for any path without a file
  (`not_found_handling: "404-page"` in `wrangler.jsonc`). Its links are root-relative because
  it is shown at any URL.

## Layout

```
DESIGN.md              the brief
site.config.json       URLs, the docs list, the benchmark and screenshot sources, fallback release
wrangler.jsonc         Cloudflare Workers configuration: static assets from dist/, no Worker script
src/index.html         landing page template ({{name}} slots, {{> partial}} includes)
src/models.html        models page template; the charts are filled in by the build
src/docs.html          docs page template
src/code-signing.html  the code signing policy page SignPath Foundation's terms require
src/404.html           the not-found page
src/partials/          head, header, footer
src/styles.css         the one stylesheet
src/assets/            marks, icons, social preview
build/build.ts         the build
build/charts.ts        the SVG chart writer and the benchmarks.json schema check
build/dev.ts           dev server with rebuild on change
build/check.ts         checks over dist/
build/icons.ts         renders the PNG icons from logo.svg
.github/workflows/     check.yml (build and check) and refresh.yml (weekly build and deploy)
```

## Licence

The code in this repository (HTML, CSS and build scripts) is MIT licensed: see `LICENSE`.

The Diarist marks in `src/assets` (`logo.svg`, `logo-mono.svg`, `wordmark.svg`,
`wordmark-dark.svg`, `social.png`, and `favicon.png` and `apple-touch-icon.png` rendered
from `logo.svg`) are licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): reuse and adapt them with
attribution to the Diarist project. The letterforms in the wordmark and social preview are
outlines of Inter by The Inter Project Authors, licensed under the SIL Open Font License 1.1.
The screenshots are read at build time from the app repository's `docs/screenshots`.
