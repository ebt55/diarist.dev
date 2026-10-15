# diarist.dev

The website for [Diarist](https://github.com/ebt55/diarist), a meeting transcriber for
Windows that runs entirely on your own PC. One landing page, a `/models/` page with
benchmark charts, and a `/docs` section rendered from the app repository's Markdown.
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
7. Writes `dist/_headers` and `dist/_redirects` for Cloudflare Pages (see Deployment).

Docs rendering follows DESIGN.md section 7: headings get GitHub-style ids, links to another
rendered file go to its site page, other relative links go to the file on GitHub, relative
images go to raw.githubusercontent.com, raw HTML is escaped.

The charts have no `viewBox` on purpose: bar lengths are percentages of the chart's width,
so a chart fills its column, while the text keeps its CSS size and stays legible at 360 px.

## Deployment

The site is hosted on **Cloudflare Pages**, connected to this GitHub repository. Every push
to `main` is built and published by Cloudflare; GitHub Actions only runs the checks
(`check.yml`) and the weekly refresh (`refresh.yml`). The output is plain static files, so
`dist/` can be hosted anywhere else without changes.

### Pages project settings

Create the project in the Cloudflare dashboard (Workers & Pages, Create, Pages, Connect to
Git, repository `ebt55/diarist.dev`) with:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Build command | `bun install --frozen-lockfile && bun run build` |
| Build output directory | `dist` |
| Environment variable `DOCS_SOURCE` | `remote` |
| Environment variable `BUN_VERSION` | `1.2.1` (the build image then uses the pinned bun) |

Set both variables for Production and Preview. Preview deployments for other branches are
fine; they build the same way.

### Custom domain

In the Pages project, Custom domains, add `diarist.dev` and `www.diarist.dev`.

- If the `diarist.dev` zone is on Cloudflare (nameservers at Porkbun pointed at Cloudflare,
  as for ebinbt.dev), Pages creates the DNS records itself.
- Otherwise, at Porkbun add `CNAME diarist.dev` pointing at `<project>.pages.dev` (the
  project's `*.pages.dev` hostname) and the same for `www`, and let Cloudflare verify them.

`.dev` is on the HSTS preload list, so the site only works over HTTPS; Cloudflare provides
the certificate. `dist/_redirects` sends `https://www.diarist.dev/*` to `https://diarist.dev/`
with a 301. Cloudflare documents `_redirects` sources as paths, so if that line is ignored,
add a Redirect Rule for `www.diarist.dev` in the zone (Rules, Redirect Rules) instead.

### Weekly refresh

The docs, the benchmark data and the release version come from the app repository at build
time, so a rebuild without a commit keeps them current. `.github/workflows/refresh.yml` runs
every Monday at 05:17 UTC and on manual dispatch, and POSTs to a Cloudflare Pages deploy
hook. One-time setup:

1. In the Pages project: Settings, Builds and deployments, Deploy hooks, create a hook for
   the `main` branch and copy its URL.
2. In this repository on GitHub: Settings, Secrets and variables, Actions, add a repository
   secret named `CF_PAGES_DEPLOY_HOOK` with that URL.

Without the secret the workflow prints a notice and does nothing.

### Checks

`.github/workflows/check.yml` runs on every push and pull request:
`bun install --frozen-lockfile`, `DOCS_SOURCE=remote bun run build`, `bun run check`. It
does not deploy.

### Headers and redirects

`bun run build` writes two files Cloudflare Pages reads from the output directory:

- `dist/_headers`: for every page, `Content-Security-Policy: default-src 'self'; img-src
  'self' data:; style-src 'self'; script-src 'none'; frame-ancestors 'none'` (matching the
  meta CSP in each page), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`
  and `Permissions-Policy: camera=(), microphone=(), geolocation=()`; and for `/assets/h/*`,
  whose file names carry a content hash, `Cache-Control: public, max-age=31536000,
  immutable`. HTML stays on Cloudflare's default caching.
- `dist/_redirects`: the `www` to apex redirect above.

## Layout

```
DESIGN.md              the brief
site.config.json       URLs, the docs list, the benchmark and screenshot sources, fallback release
src/index.html         landing page template ({{name}} slots, {{> partial}} includes)
src/models.html        models page template; the charts are filled in by the build
src/docs.html          docs page template
src/partials/          head, header, footer
src/styles.css         the one stylesheet
src/assets/            marks, icons, social preview
build/build.ts         the build
build/charts.ts        the SVG chart writer and the benchmarks.json schema check
build/dev.ts           dev server with rebuild on change
build/check.ts         checks over dist/
build/icons.ts         renders the PNG icons from logo.svg
.github/workflows/     check.yml (build and check) and refresh.yml (weekly deploy hook)
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
