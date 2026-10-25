# diarist.dev: design

Status: v0.2, 15 Oct 2026. Author: Fable 5.1 (planner). Implementation: Opus 5.5 agents. Owner: Ebin.

v0.2 changes, after Ebin's review of v0.1: the tone is plainer (section 2), two pages are added (a models page with charts, section 5, and a known-issues page, section 6), and the navigation changes with them. Everything else from v0.1 stands.

This file is the brief for the site and the record of why it looks the way it does. The product it describes lives at https://github.com/ebt55/diarist; its README, `docs/04-model-guide.md`, `docs/eval/`, `docs/KNOWN-ISSUES.md` and `PRIVACY.md` are the only sources of facts and numbers. Never invent a number; if a figure is not in those files, leave it out.

## 1. What the site is for

One page that makes three things clear in under a minute, then gets out of the way:

1. **What it does.** Meeting transcripts where every line says who spoke, recorded live or from a file, stored in a searchable database on your own PC.
2. **What it refuses to do.** Nothing leaves the machine. No account, no cloud, no telemetry, no Python.
3. **What kind of software it is.** A harness for speech and speaker models: the models are files you own, swap and measure.

Primary action: download the Windows beta. Secondary: open the GitHub repository. Tertiary: the models page, the docs and the known issues.

The audience is a person who searched for local or offline meeting transcription with speaker labels, or who wants to run NVIDIA's Nemotron speech models on their own GPU without a Python stack. Assume they are technical enough to own a GPU and sceptical enough to check the privacy page. Write for that person.

## 2. Voice: state things, do not pitch them

The README has the voice: plain, direct, specific. Keep it, and apply these rules, which v0.1 broke in places:

- **No pitch.** Say what the app does and how it is built. Never say what it does better, what others fail at, or what the reader will love. Delete any sentence whose job is persuasion rather than information.
- **No comparatives about other tools.** "Most transcription apps are…", "Most local transcribers give you…" are out. The benchmark tables may list other systems by name with their numbers and sources, because that is information.
- **Headings name the subject**, not a slogan: "Speaker separation", "Privacy", "Status". Not "Speakers are the point", "Measured, not promised", "A harness, not a wrapper".
- **Philosophy is stated as a design decision**, in the first person plural or the passive: "The runtime and the models are files in folders you own. The app runs them together and stays out of the way." Not framed against anyone.
- Short sentences. "You" for the reader, "Diarist" or "the app" for the product.
- Never: "AI-powered", "revolutionary", "seamless", "unlock", "supercharge", "effortless", "the point", "promised", exclamation marks, emoji.
- Numbers only when measured or published, with the source and date next to them. Caveats sit beside the claim.
- Say what is untested. The beta label is information, not an apology.
- Do not explain ComfyUI. One aside acknowledges it for people who know it; everyone else gets the idea from plain words.

## 3. Landing page structure

### Header

Wordmark (`wordmark.svg` / `wordmark-dark.svg` by colour scheme, 28 px tall; it contains the mark, so do not add `logo.svg` beside it). Links: How it works, Speakers, Models (to `/models/`), Privacy, Issues (to `/docs/known-issues/`), Docs, GitHub. A compact "Download" button on the right. Sticky on desktop, plain on phones.

### Hero

Headline (H1):

> **Meeting transcripts with speaker labels, on your own PC.**

Subhead:

> Diarist records a meeting, or imports a recording, separates up to eight speakers, and stores the transcript in a searchable database on your computer. No cloud, no account, no Python.

Primary button: **Download for Windows** with a small "beta" tag. Under it, one muted line: "0.1.0-beta.1, 6.7 MB installer. First run downloads the runtime and models, about 870 MB. Windows 10 and 11, NVIDIA GPU recommended. Release notes and checksum." Secondary button: **View on GitHub**.

Platform line, small: "Linux is planned. macOS is not: nobody on the project owns a Mac."

Agent line, small: "If you use a coding agent (Claude Code, Codex or similar), the agent setup guide lets it check your PC, pick the models and set everything up." with "agent setup guide" linking to `/docs/agent-setup/`.

Visual, right of the copy on desktop and below it on phones: the **transcript card built in HTML** from v0.1, unchanged: ink tile, turned corner, four lines with timestamp, speaker pill and words:

```
00:04  Speaker 1   Let's start with last week's numbers.
00:09  Speaker 2   An hour of audio came back in under three minutes.
00:15  me          And nothing left the machine.
00:18  Speaker 3   Then we ship the beta.
```

Speaker 1 blue `#4e79a7`, Speaker 2 orange `#f28e2b`, Speaker 3 red `#e15759`, "me" slate `#64748b`. Card label "Example transcript". The slow red recording dot stays (respect `prefers-reduced-motion`). Nothing else moves on the page.

Below the hero, full width, one real screenshot in a thin frame: `docs/screenshots/meeting-light.png`, swapped for `meeting-dark.png` in dark mode, taken from the app repository's current files (they are being recaptured under the Diarist name; use whatever is in `../meet-assist/docs/screenshots` at build time and report if the app's corner still reads "meet-assist").

### How it works (id `how`)

Unchanged from v0.1: two columns, "Live" and "From a file", each a short paragraph and three facts, then the one line about renaming, merging, search and export.

### Speaker separation (id `speakers`)

No lead sentence. Body:

> Speaker separation runs on NVIDIA's Nemotron 3 Diarization. On VoiceArena Diarization-Bench v1, the one independent benchmark that scores every diarizer the same way, it has the lowest error rate of the systems listed: DER 14.7, against 19 to 31 for the others. Up to eight speakers per recording.

> Measured on the author's own Zoom meetings on an RTX 3080: 0.2 to 0.6 percent of words went to the wrong speaker; within a second of a speaker change, 7 to 9 percent.

"Where it struggles", as a short list: people talking over each other; far-field microphones and noisy rooms; a ninth speaker, who is merged into an existing label; live labels, which are provisional until the pass after Stop.

Links: "The numbers, with charts" to `/models/#diarization`; "How we measure" to `/docs/eval/`.

### Models are files you own (id `harness`)

Lead:

> Diarist is a harness for speech models, not an application built around one model. The runtime and the models are files in folders on your disk. The app's job is to run them together, tell you what it is doing, and stay out of the way.

Five short blocks, each a bold phrase and two sentences:

- **Plain folders.** The runtime and every model are ordinary files under `models\` and `engine\` in your data folder. Drop a file in, press Refresh, use it.
- **Your PC, your choice.** CUDA, Vulkan or CPU runtime; models by how much GPU memory you have. The setup screen proposes, you decide, and you can change it later.
- **No gates.** Setup can be skipped. Models the app has never heard of can be added by URL or by file. A runtime version can be pinned, and rolled back by moving a folder.
- **Nothing silent.** Every download shows its address, hash, size and destination, with Retry and Copy link. When the app cannot do something, it says what is missing and offers the fix.
- **Measured swaps.** A new model can be compared on your own recordings with the evaluation tools in the repository before you rely on it.

Aside, small and muted: "If you have used ComfyUI, this will feel familiar. If you have not, you do not need to."

### Privacy (id `privacy`)

Lead: "Audio, transcripts, names, settings and logs stay in one folder on your computer."

Body: "The app connects to the internet only when you press a button that says so: installing the runtime (from GitHub), downloading a model (from Hugging Face), checking for a newer runtime, or checking for updates. It never checks anything on its own. There is no account, no analytics and no crash reporting."

One more line: "This website is the same: no cookies, no analytics, no third-party requests."

Link: "The privacy page" to `/docs/privacy/`.

### Requirements (id `models`)

The two small tables from v0.1 (runtime package by GPU; GPU memory tiers), the one-line other requirements, and the three model lines. Heading "Requirements". Link: "Charts and the numbers behind these choices" to `/models/`.

### Status (id `status`)

Lead: "0.1.0-beta.1 is the first public release."

Two short lists. "Measured on the development machine (Windows 11, RTX 3080 10 GB): file import, live recording, the post-pass, search, export, the installer." (Not the updater: it is configured and signed but has not yet delivered an update.) "Untested so far: the Vulkan and CPU runtime packages, and every machine that is not the author's."

"Next: punctuation restoration, better handling of speaker changes, recording without headphones, and recognising the same person across meetings."

Links: "Roadmap" (repository `docs/plans/00-roadmap.md`), "changelog" (`/docs/changelog/`), "known issues" (`/docs/known-issues/`).

**16 Oct 2026: 0.1.0-beta.2.** The lead names the current release and that beta.1 copies reach it through Check for updates. Between the lead and the two lists, a "What's new in beta.2" list (`.whatsnew`): six items, each a bold phrase and one or two sentences in the site's words, only things the changelog states and, where there is a number, docs/04 or docs/eval back; then links to the changelog page's section and the release notes. The updater joins the measured list after its first delivered update; the untested list names what the Vulkan and CPU packages were run on. The hero's copy did not change: the version and size come from the manifest. Copy that no new fact touched was left as written.

**17 Oct 2026: 0.1.0-beta.3.** The lead names beta.3 as the current beta; the list is headed "What's new in beta.2 and beta.3" and ends with one item for beta.3's two fixes, from its changelog entry; the changelog link points at the beta.3 section. The fallback release in site.config.json and the status line on /code-signing/ follow the release.

**22 Oct 2026: 0.1.0-beta.4.** The lead names beta.4; the list is headed "What's new in beta.2, beta.3 and beta.4" and ends with two items for beta.4 from its changelog entry: recording with speakers, with the known-issues page's numbers labelled as measured on one PC and five recordings, and the copyright holder and the marks' terms. The changelog link points at the beta.4 section; the "Next" line drops recording without headphones and names echo cancellation in the live view instead. The Live column of How it works gains one sentence that recording without headphones is handled. Open source gains one sentence that the name, logo and icons are not MIT, from the app README's licence paragraph. The fallback release and the /code-signing/ status line follow the release.

### Open source (id `open`)

As v0.1 (MIT, runtime and model licences, buttons GitHub, Report a problem, Contributing), plus one factual line after the licence sentence: "There is no paid tier, no licence key and no account. Speaker separation is part of the app." Stated, not sold: no comparison to anyone.

### Footer

Mark, "A diarist keeps a record.", links Docs, Models, Issues, Changelog, Privacy, Licences, Code signing policy, GitHub. Last line: "Diarist is an independent open-source project and is not affiliated with NVIDIA."

**16 Oct 2026: `/code-signing/`.** A built page (`src/code-signing.html`, like `/models/`) titled **Code signing policy**, which SignPath Foundation's terms (signpath.org/terms) require before they sign the installer: their sentence "Free code signing provided by SignPath.io, certificate by SignPath Foundation", what is signed, how signed builds are made, the team roles, the privacy statement, how to check a download and how to report a bad file. The terms ask for the term "Code signing policy" on the home and download pages, so the footer (every page) and the hero's download line link to it; do not remove either link while releases are signed. The page's status line changes when the first signed release ships. The plan behind it is `docs/plans/14-code-signing-signpath.md` in the app repository.

**25 Oct 2026: not applied yet.** The page read as if signing were running: SignPath's sentence stood alone as the lede, the status said "being set up", and the controls listed multi-factor authentication on a SignPath account that does not exist. Nothing is set up: the owner has not applied, and every signing step in plan 14 is the owner's. The lede now says no release is signed and the project has not applied, and carries SignPath's wording inside that sentence; "What will be signed" and "How signed builds will be made" are in the future tense; the controls are split into "In place now" (the rulesets on main and the release tags) and "In place before the first signed release". The meta description says the same. When SignPath Foundation accepts the project and the first signed release ships, the lede goes back to their sentence verbatim ("Free code signing provided by SignPath.io, certificate by SignPath Foundation."), the sections go back to the present tense, and the two control lists merge.

## 4. Visual direction

Unchanged from v0.1: brand palette as tokens on `:root` with a dark redefinition, system font stack, no web fonts, one centred column up to about 1080 px, 16 px gutters on phones, no motion but the recording dot, HTML plus CSS under 60 KB per page, zero third-party requests, landmarks and contrast at least 4.5:1 in both schemes. Charts (section 5) follow the same rules.

## 5. The models page: `/models/`

A built page (not rendered from Markdown) titled **Choosing a runtime package and models**. Its purpose is to let someone pick by their minimum requirements and see the numbers behind the defaults. Every chart is an inline SVG generated by the build script from one data file, `docs/eval/benchmarks.json` in the app repository (fetched at build time like the docs; schema below). No JavaScript; the SVG text is real text.

Sections, in order:

1. **By your GPU** (id `pick`). One table, rows: no usable GPU; 4 GB; 6 GB; 8 GB and more. Columns: runtime package; speech model; diarizer; live recording; file transcription; note. Values from `docs/04-model-guide.md` section 4 and the README tiers. Under it, the CUDA driver rule (R580 or newer; 610.88 measured) and the compute-capability rule (sm_75 and up; below that, Vulkan), as one line each.
2. **Speaker diarization, published** (id `diarization`). Horizontal bar chart of DER on VoiceArena Diarization-Bench v1 for the six systems in docs/04 section 2, lowest at the top; the row Diarist uses is marked "used by Diarist" in text and drawn with the full-strength bar, the others at 60 percent opacity. Beside or under the chart, the licence and "runs locally without a token" columns. Caption with source, date and the metric's definition (collar 0, overlap scored).
3. **Speech to text, published** (id `asr`). Horizontal bar chart of Open ASR leaderboard average WER for the rows in docs/04 section 3, lowest at the top. Each row carries two flags in text: "word timestamps" and "runs in Diarist" (and "streaming"). The chart makes visible why the top two are not used: no timestamps, no runtime. Nemotron 3.5 has no leaderboard number and is listed without a bar, saying so.
4. **Measured in Diarist** (id `measured`). Grouped bars of cpWER per evaluation session, EN model against Nemotron 3.5, from `docs/eval/*.md` with the session shorthand from `docs/05-eval-data.md`, plus AMI ES2002a. A second small chart or table: peak GPU memory per scenario (live idle, live with two sessions, file EN, file 3.5, Parakeet). A line each for speed (import at about 27 times real time; live first text in about 0.2 s). Each with "measured on an RTX 3080 10 GB, 15 Oct 2026".
5. **Caveats** (id `caveats`): Parakeet's dropped span; eight speakers; punctuation; overlap and far-field; Vulkan and CPU untested. From docs/04 sections 3 and 7.
6. **Sources**: the leaderboards and the repository files, with dates.

Chart rules: horizontal bars only; value printed at the end of every bar; axis label with the metric and "lower is better"; bar colour the brand blue, text the page's ink, grid lines the muted colour; each `<svg>` has `<title>` and `<desc>`; every chart is followed by a `<details>` "Show as a table" containing the same numbers, so the data is readable without the graphic and by screen readers. Charts scale to the column width (`width: 100%`, `viewBox`), and remain legible at 360 px (shorten labels with a `data-short` variant if needed). Light and dark via CSS variables, since inline SVG inherits them.

Data file schema (the agent creates `docs/eval/benchmarks.json` in the app repository from docs/04 and docs/eval, commits it by path, and the site fetches it):

```json
{
  "updated": "2026-10-15",
  "machine": "Windows 11, RTX 3080 10 GB, driver 610.88",
  "diarization_published": {
    "source": "VoiceArena Diarization-Bench v1, 139 English conversations, collar 0, overlap scored",
    "url": "...", "metric": "DER, percent, lower is better",
    "rows": [{"system": "Nemotron 3 Diarization", "value": 14.7, "licence": "OpenMDW-1.1", "local": true, "used": true}]
  },
  "asr_published": {
    "source": "Open ASR leaderboard, October 2026", "url": "...", "metric": "average WER, percent, lower is better",
    "rows": [{"model": "Nemotron Speech Streaming EN 0.6B", "value": 6.93, "timestamps": true, "runs": true, "streaming": true, "note": "at 1.1 s latency"}]
  },
  "asr_measured": {
    "source": "docs/eval, 15 Oct 2026", "metric": "cpWER, percent, lower is better",
    "sessions": [{"name": "...", "en": 5.1, "n35": 5.4}]
  },
  "vram_measured": {"rows": [{"scenario": "...", "gb": 1.05}]},
  "speed_measured": {"import_realtime_factor": 27, "live_first_text_s": 0.2}
}
```

Every number in the file must be traceable to a line in docs/04 or docs/eval; put the file path in a `"from"` field per block.

**16 Oct 2026: a fifth chart, Languages measured (id `languages`),** between Measured in Diarist and Caveats, from the `languages_measured` block (Nemotron 3.5 on about 10 minutes of FLEURS per language, at the file setting, without diarization): one row per language, two bars (language given, automatic detection) with a 2 px mark in the text colour, on a background-colour halo, at the model card's number for the same mode; a third legend entry for the mark (the legend wraps to a second line when it would pass 328 px); "CER" flagged on Japanese; the model card's two numbers as the row's meta line; the data file's note in the caption. Caption: "Measured on FLEURS slices in our runtime, 16 Oct 2026". The Sources section ends with a list generated from each block's `from` field, so file names cannot go stale; the hand-written items name only the leaderboards, the model card, the model guide and docs/eval. Caveats gained the EN model's dropped quiet speech and the short-speaker merge; the Vulkan and CPU rows say what they were measured on (an RTX 3080 and a Ryzen 9 5900X, nothing about AMD or Intel). Numbers that changed with beta.2 (import speed 30 times, cpWER, words near a speaker change) were refreshed on both pages.

## 6. Known issues: `/docs/known-issues/`

Rendered from `docs/KNOWN-ISSUES.md` in the app repository, which the agent writes (it does not exist yet) from `docs/research/01-gguf-runtimes-windows.md`, `docs/research/08-runtime-cli-contract.md` (pitfalls), `docs/04-model-guide.md` section 7, the CHANGELOG's "Known limits" and `docs/05-eval-data.md`. One table per group, columns: **Issue**, **Affects**, **Status**, **What Diarist does meanwhile**, **Waiting on**. Groups: the runtime (NeMo-Speech.cpp), the models, Windows and the installer, Diarist itself. Seed list, each to be verified against the research docs and, for upstream issues, the GitHub issue (read-only):

- Plain `transcribe --diarize` mislabels the first minutes of long files (NVIDIA/NeMo-Speech.cpp#67, filed by the author); Diarist uses the streaming path, unaffected.
- WebSocket `commit` never returns a completion for utterances of a second or more (#49); Diarist does not depend on it.
- Streaming wedges after sustained all-zero audio (#48); Diarist adds 1-LSB dither before the engine.
- Word confidence is always 1.0 (#55); the UI cannot flag uncertain words yet.
- No speaker-label revisions over WebSocket or the C ABI; live labels are provisional until the post-pass.
- Parakeet TDT 0.6B v3 silently drops spans of speech on long files (model side); experimental, off by default.
- Nemotron models punctuate little; punctuation restoration is on the roadmap.
- At most eight speakers; a ninth is merged.
- The `offline` full-attention diarization preset scores worse than streaming; not used.
- Installer not code-signed (SmartScreen prompt); the NVIDIA runtime unsigned (Smart App Control may block it).
- Vulkan and CPU runtime packages untested.
- Recording without headphones: the far end leaks into the microphone channel; echo handling planned.
- Windows path limit of 260 characters for deep model paths; handled with the extended-length prefix.

Each row says plainly whether it is upstream, model-side, by design, or Diarist's own, and what version or event it waits on. The page is listed in the docs sidebar and index as "Known issues", and the header link "Issues" points at it.

## 7. Docs pages

As v0.1 section 5, plus `/docs/known-issues/` (source `docs/KNOWN-ISSUES.md`) and `/docs/agent-setup/` (source `docs/SETUP-WITH-AN-AGENT.md`, already on main). Sidebar order: Install, Set up with a coding agent, Models and hardware, Known issues, Privacy, How we measure, Changelog, Contributing, Licences.

## 8. Build and hosting (changed in v0.2: Cloudflare Pages, not GitHub Pages)

The build is as v0.1 section 6 (bun script, docs fetched from the app repository, version from `updater/latest.json`), with two additions: it fetches `docs/eval/benchmarks.json` the same way and fails loudly if it is missing or malformed, and the charts are generated in the build script (a small SVG writer, no charting library).

Hosting is **Cloudflare Pages**, because the owner already hosts ebinbt.dev on Cloudflare and the domain is registered at Porkbun:

- The source lives in the GitHub repository `ebt55/diarist.dev`. Cloudflare Pages is connected to that repository (Git integration) and builds on every push to `main`: build command `bun install --frozen-lockfile && bun run build`, output directory `dist`, environment variable `DOCS_SOURCE=remote`, and `BUN_VERSION=1.2.1` so the build image uses the pinned bun. Production branch `main`; preview deployments for other branches are fine.
- Custom domain `diarist.dev` (and `www.diarist.dev` redirecting to it) added in the Pages project. If the zone is on Cloudflare (nameservers at Porkbun pointed at Cloudflare, as for ebinbt.dev), Pages creates the records itself; otherwise the owner adds a `CNAME diarist.dev → <project>.pages.dev` at Porkbun. `.dev` is HSTS-preloaded, so HTTPS only, which Cloudflare provides.
- Weekly refresh so the docs and the version stay current without a commit: a Cloudflare Pages deploy hook, called from a scheduled GitHub Actions workflow (`refresh.yml`, cron weekly plus `workflow_dispatch`) with the hook URL in the repository secret `CF_PAGES_DEPLOY_HOOK`. The owner creates the hook in the Pages project and adds the secret.
- GitHub Actions also runs `check.yml` on every push and pull request: `bun install --frozen-lockfile`, `DOCS_SOURCE=remote bun run build`, `bun run check`. No GitHub Pages workflow, no `CNAME` file, no `.nojekyll`.
- `dist/_headers` sets the response headers Cloudflare Pages honours: `Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'none'; frame-ancestors 'none'` (matching the meta CSP), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and `Cache-Control: public, max-age=31536000, immutable` for `/assets/*` with hashed or versioned file names only (leave HTML uncached beyond Cloudflare's defaults). A `dist/_redirects` with `https://www.diarist.dev/* https://diarist.dev/:splat 301`.
- README.md of the site repository documents exactly this: the Pages settings to enter, the environment variables, the custom domain step for both DNS cases, the deploy hook and secret, and that the output is plain static files that can be hosted anywhere else.

**15 Oct 2026: Workers static assets instead of Pages.** The site is deployed as Cloudflare **Workers with static assets** through Workers Builds (Git integration), not Cloudflare Pages: the owner's other site, ebinbt.dev, is deployed that way, and Cloudflare steers new projects to Workers. The build command, variables and checks above are unchanged. What differs: a `wrangler.jsonc` at the repository root (`name: diarist-dev`, `compatibility_date`, `assets.directory: ./dist`, `not_found_handling: 404-page`, no Worker script) and a generated `dist/404.html` with root-relative links; custom domains added under the Worker's Settings, Domains & Routes, with the zone on Cloudflare (Workers requires that); `_headers` honoured as before, but Workers skips `_redirects` lines whose source names a host, so the `www` to apex redirect is a Redirect Rule in the zone and the build writes no `_redirects`; and, since Workers Builds only builds on a push, the weekly refresh builds in GitHub Actions and deploys with `cloudflare/wrangler-action` using the repository secrets `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit) and `CLOUDFLARE_ACCOUNT_ID`. README.md now documents the Workers Builds settings instead of the Pages ones.

## 9. Acceptance for v1.1

- Every heading and lead on the landing page matches section 3; the forbidden words and the comparatives in section 2 are absent (extend `bun run check` with "Most ", "better than", "the point", "promised").
- `/models/` renders four charts from `benchmarks.json`, each with a `<details>` table, legible at 360 px in both schemes, every number traceable to docs/04 or docs/eval.
- `/docs/known-issues/` renders from `docs/KNOWN-ISSUES.md`; every upstream row links to its issue; no row is speculation.
- The screenshot in the hero is the current file from the app repository; the report says whether it still shows the old name.
- `bun run build` and `bun run check` pass; zero third-party requests; landing page still under 60 KB of HTML plus CSS; the models page under 120 KB without images.
- Commits in the site repository with the Opus trailer; in the app repository only `docs/eval/benchmarks.json` and `docs/KNOWN-ISSUES.md`, staged by path, pushed to main.
