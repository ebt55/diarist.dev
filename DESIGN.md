# diarist.dev: design

Status: v0.1, 15 Oct 2026. Author: Fable 5.1 (planner). Implementation: Opus 5.5 agent. Owner: Ebin.

This file is the brief for the site and the record of why it looks the way it does. The product it describes lives at https://github.com/ebt55/diarist; its README, `docs/04-model-guide.md` and `PRIVACY.md` are the only sources of facts and numbers. Never invent a number; if a figure is not in those files, leave it out.

## 1. What the site is for

One page that makes three things clear in under a minute, then gets out of the way:

1. **What it does.** Meeting transcripts where every line says who spoke, recorded live or from a file, stored in a searchable database on your own PC.
2. **What it refuses to do.** Nothing leaves the machine. No account, no cloud, no telemetry, no Python.
3. **What kind of software it is.** Not a wrapper around one model: a harness that treats speech and speaker models as files you own, swap and measure.

Primary action: download the Windows beta. Secondary: open the GitHub repository. Tertiary: read the docs.

The audience is a person who searched for local or offline meeting transcription with speaker labels, or who wants to run NVIDIA's Nemotron speech models on their own GPU without a Python stack. Assume they are technical enough to own a GPU and sceptical enough to check the privacy page. Write for that person.

## 2. Voice

The README already has the voice: plain, direct, specific, no hype. Keep it.

- Short sentences. One idea each. "You" for the reader, "Diarist" or "the app" for the product.
- Never: "AI-powered", "revolutionary", "seamless", "unlock", "supercharge", "effortless", exclamation marks, emoji.
- Numbers only when measured, and say where they come from ("on an RTX 3080"). Caveats sit next to the claim, not in a footnote.
- Say what is untested. The beta label is a feature of the honesty, not an apology.
- Do not explain ComfyUI. One aside acknowledges it for people who know it; everyone else gets the idea from plain words.

## 3. Page structure (single page, then /docs)

### Header

Mark (`logo.svg`, 28 px) and the name "Diarist" set from `wordmark.svg` / `wordmark-dark.svg` by colour scheme, never retyped. Links: How it works, Speakers, Models, Privacy, Docs, GitHub. A compact "Download" button on the right. Sticky on desktop, plain on phones.

### Hero

Headline (H1):

> **Transcripts that know who said what.**

Subhead:

> Diarist records your meetings, or imports a recording, separates up to eight speakers, and keeps everything in a searchable database on your own PC. No cloud, no account, no Python.

Primary button: **Download for Windows** with a small "beta" tag. Under it, one line in a muted colour: "0.1.0-beta.1, 6.7 MB installer. First run downloads the runtime and models, about 870 MB. Windows 10 and 11, NVIDIA GPU recommended." Secondary button: **View on GitHub**.

Platform line under the buttons, small: "Linux is planned. macOS is not: nobody on the project owns a Mac."

Visual, right of the copy on desktop and below it on phones: a **transcript card built in HTML**, not a screenshot, so it is crisp at every size and matches the mark exactly. A rounded ink-coloured tile (`#1b1f27`) with a turned corner, like the logo at large size, holding four lines of a transcript. Each line: a timestamp in a muted monospace, a speaker pill in that speaker's colour (bar or pill on the tile, never coloured text on white), the speaker name, the words. Use these exact lines; they are fictional and contain no real names:

```
00:04  Speaker 1   Let's start with last week's numbers.
00:09  Speaker 2   An hour of audio came back in under three minutes.
00:15  me          And nothing left the machine.
00:18  Speaker 3   Then we ship the beta.
```

Speaker 1 blue `#4e79a7`, Speaker 2 orange `#f28e2b`, Speaker 3 red `#e15759`, "me" slate `#64748b`, the same order as the lines in the logo. A small red recording dot pulsing slowly in the card's corner is allowed (`#dc2626`, respect `prefers-reduced-motion`). Nothing else moves on the page.

Below the hero, full width, one real screenshot in a thin frame: `docs/screenshots/meeting-light.png`, swapped for `meeting-dark.png` in dark mode. Check both images for personal names before shipping them; if any appear, use `library-light.png` / `library-dark.png` instead and report it.

### How it works (id `how`)

Two columns, "Live" and "From a file", each a short paragraph and three facts.

**Live.** Press Record. Your microphone is "me"; the sound your computer plays (Teams, Zoom, Meet, a browser) is split into the other speakers. Text appears in about a second. When you stop, the recording is processed once more with the full context, and the names you gave people during the meeting carry over.

**From a file.** Drop in m4a, mp3, wav, flac, ogg, mp4, mkv and more. On an RTX 3080 an hour of audio takes two to three minutes, about 27 times faster than real time.

Then one line across both: "Rename Speaker 2 to Alice once and the name sticks. Merge labels, recolour, move a line to the right person. Search every transcript at once. Export Markdown, text, JSON, SRT or VTT."

### Speakers are the point (id `speakers`)

Lead: "Most local transcribers give you words. Diarist gives you who said them."

Body: Speaker separation runs on NVIDIA's Nemotron 3 Diarization, the best system on the one independent benchmark that scores every diarizer the same way (DER 14.7 against 19 to 31 for the alternatives). Up to eight speakers per recording.

Measured on the author's own Zoom meetings, RTX 3080: 0.2 to 0.6 percent of words went to the wrong speaker; within a second of a speaker change, 7 to 9 percent.

Caveats, as a short list under the heading "Where it struggles": people talking over each other; far-field microphones and noisy rooms; a ninth speaker, who is merged into an existing label; live labels, which are provisional until the pass after Stop.

Link: "How we measure" to `/docs/eval` (see section 5).

### A harness, not a wrapper (id `harness`)

This is the section that carries the philosophy. Give it room.

Lead: "Most transcription apps are a wrapper around one model. Diarist is built the other way round. The app is a harness; the models are files you own."

Five short blocks, each a bold phrase and two sentences:

- **Plain folders.** The runtime and every model are ordinary files under `models\` and `engine\` in your data folder. Drop a file in, press Refresh, use it.
- **Your PC, your choice.** CUDA, Vulkan or CPU runtime; models by how much GPU memory you have. The setup screen proposes, you decide, and you can change it later.
- **No gates.** Skip setup and start anyway. Add a model the app has never heard of, by URL or by file. Pin a runtime version. Roll back by moving a folder.
- **Nothing silent.** Every download shows its address, hash, size and destination, with Retry and Copy link. When the app cannot do something, it says what is missing and offers the fix.
- **Measured swaps.** Try a new model and compare it on your own recordings with the evaluation tools in the repository before you trust it.

Aside, small and muted, at the end: "If you have used ComfyUI, this will feel familiar. If you have not, you do not need to."

### Nothing leaves your PC (id `privacy`)

Lead: "Audio, transcripts, names, settings and logs stay in one folder on your computer."

Body: "The app connects to the internet only when you press a button that says so: installing the runtime (from GitHub), downloading a model (from Hugging Face), checking for a newer runtime, or checking for updates. It never checks anything on its own. There is no account, no analytics and no crash reporting."

One more line: "This website is the same: no cookies, no analytics, no third-party requests."

Link: "Read the privacy page" to `/docs/privacy`.

### What you need (id `models`)

Two small tables, taken from the README's "Choosing your package and models".

Runtime package by GPU: NVIDIA with a CUDA 13 driver (R580 or newer; 610.88 measured) → CUDA, measured on an RTX 3080; AMD, Intel or older NVIDIA driver → Vulkan, shipped by NVIDIA, untested by us; no usable GPU → CPU, untested, much slower than real time.

GPU memory tiers: 4 GB, file mode with Nemotron 3.5 and low-VRAM mode, live is borderline; 6 GB, live and file comfortably; 8 GB and up, everything.

Other requirements as one line: Windows 10 (1803 or newer) or Windows 11, 64-bit; about 1.6 GB of disk for the runtime and default models; recordings about 90 MB per hour; 8 GB of RAM is comfortable.

Models as one line each: Nemotron 3 Diarization (speakers, 102 MB); Nemotron Speech Streaming EN 0.6B (English, default, 668 MB); Nemotron 3.5 ASR Streaming (40+ languages, optional, 742 MB). Link: "Which model for which PC" to `/docs/models`.

### Measured, not promised (id `status`)

Lead: "0.1.0-beta.1 is the first public release."

Body, as two short lists. "Measured on the development machine (Windows 11, RTX 3080 10 GB): file import, live recording, the post-pass, search, export, the installer and updater." "Untested so far: the Vulkan and CPU runtime packages, and every machine that is not the author's."

"Next: punctuation restoration, better handling of speaker changes, recording without headphones, and recognising the same person across meetings."

Link: "Roadmap and changelog" to `/docs/changelog` and the repository's `docs/plans/00-roadmap.md`.

### Open source (id `open`)

"MIT licence. The runtime (Apache-2.0) and the models (OpenMDW-1.1, NVIDIA Open Model License) are downloaded at first run under their own licences. Issues and pull requests on GitHub." Buttons: GitHub, Report a problem (issues URL), Contributing.

### Footer

Mark, "A diarist keeps a record.", then links: Docs, Changelog, Privacy, Licences, GitHub. Last line, small: "Diarist is an independent open-source project and is not affiliated with NVIDIA."

## 4. Visual direction

- **Palette** from `branding/README.md`: ink `#1b1f27`, slate `#64748b`, blue `#4e79a7`, orange `#f28e2b`, red `#e15759`, recording `#dc2626`, paper `#f6f3ec`. Light page: paper or white background, ink text. Dark page: `#0f1115` background, `#f3f4f6` text. Define every colour as a token on `:root`, redefine for dark under `prefers-color-scheme: dark`, and give `body` an explicit background. The speaker colours appear only as pills or bars on the ink tile, or as thin accents, never as body text on a light background (orange fails contrast on white, see the brand README).
- **Type**: system font stack (`system-ui, -apple-system, "Segoe UI", Roboto, Inter, sans-serif`) for everything except the wordmark, which is an SVG. No web fonts: the page must make zero third-party requests. Monospace for timestamps, paths and the hash: `ui-monospace, "Cascadia Mono", Consolas, monospace`.
- **Layout**: one centred column, max width about 1080 px, generous vertical rhythm, 16 px side gutters on phones, no horizontal scroll at 360 px. Sections separated by space, not boxes. The transcript card is the one strong graphic; everything else is text, two tables and one screenshot.
- **Motion**: the recording dot only. Respect `prefers-reduced-motion`.
- **Weight budget**: HTML plus CSS under 60 KB; the screenshot delivered as WebP (and AVIF if easy) with width and height attributes and `loading="lazy"`; the whole landing page under 600 KB including images. No JavaScript is needed on the landing page except an optional few lines that keep the download link honest (see section 6); the page must work with JavaScript off.
- **Icons**: none, or inline SVG only. The favicon is `logo.svg` plus a 32 px PNG fallback and an `apple-touch-icon` (the colour mark carries its own background).
- **Accessibility**: landmarks, one H1, heading order, `alt` text on the screenshot that says what is on it, visible focus rings, contrast at least 4.5:1 for text in both schemes, the transcript card readable by a screen reader as a list.

## 5. /docs

Yes, the site has docs, but it writes none of its own. The repository's Markdown is the single source and GitHub stays canonical. The build renders these files into pages with the site's header, a left-hand list of pages, and an "Edit on GitHub" link at the top of each:

| Page | Source in ebt55/diarist |
|---|---|
| `/docs/` (index) | a short generated page listing the entries below |
| `/docs/install` | `docs/INSTALL.md` |
| `/docs/models` | `docs/04-model-guide.md` |
| `/docs/privacy` | `PRIVACY.md` |
| `/docs/eval` | `docs/05-eval-data.md` |
| `/docs/changelog` | `CHANGELOG.md` |
| `/docs/contributing` | `CONTRIBUTING.md` |
| `/docs/licences` | `LICENSES.md` |

Rendering rules: GitHub-flavoured Markdown with tables; headings get ids for deep links; relative links that point at another rendered file are rewritten to the site page, every other relative link is rewritten to the file on GitHub (`https://github.com/ebt55/diarist/blob/main/<path>`); relative images are rewritten to `https://raw.githubusercontent.com/ebt55/diarist/main/<path>`; raw HTML in the Markdown is escaped, not rendered. The first H1 of each file becomes the page title. The docs CSS is the landing page's CSS plus a few rules for tables, code and the sidebar.

Source of the Markdown at build time: in CI, fetch from `https://raw.githubusercontent.com/ebt55/diarist/main/...`; locally, prefer a sibling checkout at `../meet-assist` when it exists (the repository folder on the author's PC still carries the old name) and fall back to fetching. The build must fail loudly if a source is missing, never publish an empty page.

## 6. Build and hosting

- **Repository**: `ebt55/diarist.dev` on GitHub, this folder (`C:\Users\ebin\claude-ground\diarist.dev`) is its working copy. The site is MIT like the app; the brand marks copied into it stay CC BY 4.0 (keep the attribution line from `branding/README.md`).
- **Stack**: hand-written HTML and CSS plus a small build script run by bun (`bun run build` → `dist/`). The build does four things: copies static files, renders the docs pages from Markdown, injects the current version, installer name, size and download URL from `https://raw.githubusercontent.com/ebt55/diarist/main/updater/latest.json` (size from a HEAD request on the installer URL; fall back to the values committed in `site.config.json` if the network is unavailable, and print a warning), and converts the screenshot to WebP. Dependencies pinned to exact versions; use a well-known Markdown renderer (for example `markdown-it`) and nothing that pulls in a framework. No client-side framework.
- **Dev loop**: `bun run dev` serves `dist/` with rebuild on change, on a fixed port (say 4321).
- **Hosting**: GitHub Pages from this repository, deployed by a workflow (`actions/upload-pages-artifact` and `actions/deploy-pages`) on push to `main`, on `workflow_dispatch`, and on a weekly schedule so the docs and version stay fresh without a commit. `CNAME` file containing `diarist.dev`. Add a `.nojekyll`.
- **Domain**: the owner adds DNS at the registrar. Apex `diarist.dev`: A records `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` and AAAA records `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`. `www`: CNAME to `ebt55.github.io`. Then in the repository's Pages settings, custom domain `diarist.dev` and Enforce HTTPS once the certificate is issued. `.dev` is on the HSTS preload list, so the site only works over HTTPS; GitHub Pages provides the certificate.
- **Honest download link**: the link points at the installer asset on the GitHub release, `https://github.com/ebt55/diarist/releases/download/v<version>/Diarist_<version>_x64-setup.exe`, injected at build time. Beside it, in small type, the SHA-256 is not shown (it changes per release and lives on the release page); instead a link "Release notes and checksum" goes to the release page.

## 7. What the agent delivers

```
diarist.dev/
  DESIGN.md              this file
  README.md              what the site is, how to build and deploy, DNS records
  LICENSE                MIT
  package.json           bun scripts: build, dev, check
  site.config.json       fallback version, installer name and size, repo URLs
  src/
    index.html           the landing page (template with {{version}} style slots)
    docs.html            docs page template
    styles.css
    assets/              logo.svg, logo-mono.svg, wordmark.svg, wordmark-dark.svg,
                         favicon.png, apple-touch-icon.png, screenshots (converted)
  build/
    build.ts             the build script
  .github/workflows/pages.yml
  CNAME, .nojekyll (copied into dist/)
```

Acceptance:

- `bun run build` produces `dist/` with `index.html`, `docs/*/index.html`, assets, `CNAME` and `.nojekyll`; it exits non-zero if any docs source is missing.
- The landing page renders correctly at 360, 768 and 1280 px wide in light and dark mode, with no horizontal scroll and the transcript card legible at every width.
- Zero requests to any host other than the page's own origin when viewing `dist/` (check the network panel). No cookies, no scripts from elsewhere.
- Every number and claim on the page appears in the README or the model guide. Every link resolves (run a link check over `dist/`).
- Screenshots used contain no personal names (look at them).
- The three brand rules checked: wordmark never retyped, speaker colours never as text on light backgrounds, no gradients or shadows on the mark.
- `git init`, first commit, no remote. The owner creates `ebt55/diarist.dev` and pushes, or asks the orchestrator to.

Out of scope for the first version: blog, screenshots gallery, Linux or macOS download buttons, newsletter, analytics of any kind, i18n.
