# diarist.dev

The website for [Diarist](https://github.com/ebt55/diarist), a meeting transcriber for
Windows that runs entirely on your own PC. One landing page and a `/docs` section rendered
from the app repository's Markdown. Hand-written HTML and CSS, a small bun build script, no
client-side framework, no web fonts, no analytics, and no requests to any other host.

`DESIGN.md` is the brief: what the page says, how it looks and why.

## Build and preview

Needs [bun](https://bun.sh) (1.2 or newer).

```sh
bun install          # markdown-it and sharp, pinned to exact versions
bun run build        # writes dist/
bun run dev          # builds, serves dist/ on http://localhost:4321, rebuilds on change
bun run check        # HTML well-formedness, internal links, voice rules, page weight
bun run icons        # re-renders favicon.png and apple-touch-icon.png from logo.svg
```

What `bun run build` does:

1. Copies `src/assets/`, `src/styles.css`, `CNAME` and `.nojekyll` into `dist/`.
2. Renders `dist/docs/<page>/index.html` from the app repository's Markdown (the list is
   `docs` in `site.config.json`). Locally it reads the sibling checkout `../meet-assist`
   when that folder exists (the app's folder on the author's PC still has its old name);
   in CI, or with `DOCS_SOURCE=remote`, it fetches from
   `https://raw.githubusercontent.com/ebt55/diarist/main/`. A missing or empty source fails
   the build with a non-zero exit, so an empty page is never published.
3. Reads the current release from
   `https://raw.githubusercontent.com/ebt55/diarist/main/updater/latest.json`, and the
   installer size from a HEAD request on the installer URL. Without a network it falls back
   to `release` in `site.config.json` and prints a warning (`OFFLINE=1` forces that).
   Update the fallback when a new release ships.
4. Converts the screenshots in `src/assets/screenshots/` to AVIF and WebP (828 and 1652 px
   wide) with sharp. Without sharp it ships the PNGs and says so.

Docs rendering follows DESIGN.md section 5: headings get GitHub-style ids, links to another
rendered file go to its site page, other relative links go to the file on GitHub, relative
images go to raw.githubusercontent.com, raw HTML is escaped.

The screenshots were checked by eye for personal names before they were added. Look at any
replacement at full size before committing it.

## Deployment

GitHub Pages, deployed by `.github/workflows/pages.yml` on every push to `main`, on manual
dispatch and weekly (Monday 05:17 UTC), so the docs and the version stay current without a
commit. The workflow builds with the docs fetched from GitHub, runs `bun run check`, and
publishes `dist/` with `actions/upload-pages-artifact` and `actions/deploy-pages`.

One-time setup in the repository on GitHub:

1. Settings, Pages, Build and deployment: Source **GitHub Actions**.
2. Settings, Pages, Custom domain: `diarist.dev`. Tick **Enforce HTTPS** once GitHub has
   issued the certificate.

All links are relative, so the site also works at `https://ebt55.github.io/diarist.dev/`
before the domain is set up.

### DNS records

At the registrar for `diarist.dev`:

| Name | Type | Value |
|---|---|---|
| `diarist.dev` (apex, `@`) | A | `185.199.108.153` |
| `diarist.dev` (apex, `@`) | A | `185.199.109.153` |
| `diarist.dev` (apex, `@`) | A | `185.199.110.153` |
| `diarist.dev` (apex, `@`) | A | `185.199.111.153` |
| `diarist.dev` (apex, `@`) | AAAA | `2606:50c0:8000::153` |
| `diarist.dev` (apex, `@`) | AAAA | `2606:50c0:8001::153` |
| `diarist.dev` (apex, `@`) | AAAA | `2606:50c0:8002::153` |
| `diarist.dev` (apex, `@`) | AAAA | `2606:50c0:8003::153` |
| `www` | CNAME | `ebt55.github.io` |

`.dev` is on the HSTS preload list, so the site only works over HTTPS; GitHub Pages
provides the certificate.

## Layout

```
DESIGN.md              the brief
site.config.json       URLs, the docs list, screenshot settings, fallback release
src/index.html         landing page template ({{name}} slots, {{> partial}} includes)
src/docs.html          docs page template
src/partials/          head, header, footer
src/styles.css         the one stylesheet
src/assets/            marks, icons, social preview, screenshots (PNG sources)
build/build.ts         the build
build/dev.ts           dev server with rebuild on change
build/check.ts         checks over dist/
build/icons.ts         renders the PNG icons from logo.svg
.github/workflows/     the Pages deployment
CNAME, .nojekyll       copied into dist/
```

## Licence

The code in this repository (HTML, CSS and build scripts) is MIT licensed: see `LICENSE`.

The Diarist marks in `src/assets` (`logo.svg`, `logo-mono.svg`, `wordmark.svg`,
`wordmark-dark.svg`, `social.png`, and `favicon.png` and `apple-touch-icon.png` rendered
from `logo.svg`) are licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): reuse and adapt them with
attribution to the Diarist project. The letterforms in the wordmark and social preview are
outlines of Inter by The Inter Project Authors, licensed under the SIL Open Font License 1.1.
The screenshots come from the app repository's `docs/screenshots`.
