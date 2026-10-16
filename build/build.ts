/**
 * Builds diarist.dev into dist/.
 *
 *  1. Copies the static files (src/assets) and writes styles.css under a hashed name,
 *     plus _headers and 404.html for Cloudflare Workers static assets.
 *  2. Renders the docs pages from the app repository's Markdown.
 *  3. Injects the current release (version, installer size, download URL) from
 *     the updater manifest, falling back to site.config.json without a network.
 *  4. Reads the hero screenshots from the app repository and converts them to AVIF
 *     and WebP with sharp.
 *  5. Reads docs/eval/benchmarks.json from the app repository and builds /models/
 *     with five inline SVG charts (build/charts.ts).
 *
 * Exits non-zero when a source is missing, empty or malformed: never publish an
 * empty page or a chart without its data.
 *
 * Environment:
 *   DOCS_SOURCE=local|remote  where the app repository's files come from. Default:
 *                             remote in CI, otherwise the sibling checkout
 *                             (../meet-assist) when it exists.
 *   OFFLINE=1                 skip the release lookup and use site.config.json.
 */
import { existsSync } from "node:fs";
import { copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import MarkdownIt from "markdown-it";
import { asrChart, diarizationChart, languagesChart, measuredChart, parseBenchmarks, vramChart, type ChartSummary } from "./charts.ts";

export const ROOT = path.resolve(import.meta.dir, "..");
export const SRC = path.join(ROOT, "src");
export const DIST = path.join(ROOT, "dist");
const CACHE = path.join(ROOT, "node_modules", ".cache", "diarist-site");

/** Files whose names carry a content hash live here; _headers marks them immutable. */
const HASHED = "assets/h";

export type Release = {
  version: string;
  installerName: string;
  installerSize: number;
  downloadUrl: string;
};

type DocEntry = { slug: string; label: string; source: string; summary: string };

type Config = {
  siteUrl: string;
  repo: string;
  repoUrl: string;
  issuesUrl: string;
  roadmapUrl: string;
  manifestUrl: string;
  rawBase: string;
  blobBase: string;
  editBase: string;
  localSource: string;
  benchmarks: string;
  screenshot: { source: string; light: string; dark: string; widths: number[]; sizes: string; alt: string };
  release: Release;
  docs: DocEntry[];
};

export type BuildOptions = {
  /** Reuse a release looked up earlier (the dev server does this). */
  release?: Release;
};

export type BuildResult = {
  ok: boolean;
  release: Release;
  errors: string[];
  warnings: string[];
  pages: string[];
  charts: ChartSummary[];
};

// ---------------------------------------------------------------- helpers

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function formatSize(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/** "2026-10-15" as "15 Oct 2026". */
function longDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "user-agent": "diarist.dev-build", ...(init.headers as Record<string, string> | undefined) },
    });
  } finally {
    clearTimeout(timer);
  }
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function pngSize(buf: Uint8Array): { width: number; height: number } {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (view.getUint32(0) !== 0x89504e47) throw new Error("not a PNG file");
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

const shortHash = (data: Uint8Array | string) => Bun.hash(data).toString(16).padStart(16, "0").slice(0, 10);

/** Writes data as assets/h/<base>.<hash><ext> and returns that path, relative to dist/. */
async function emitHashed(name: string, data: Uint8Array | string): Promise<string> {
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  const rel = `${HASHED}/${base}.${shortHash(data)}${ext}`;
  await mkdir(path.join(DIST, HASHED), { recursive: true });
  await writeFile(path.join(DIST, rel), data);
  return rel;
}

// ---------------------------------------------------------------- release

async function resolveRelease(config: Config, warnings: string[]): Promise<Release> {
  if (process.env.OFFLINE === "1") {
    warnings.push(`OFFLINE=1: using the release in site.config.json (${config.release.version})`);
    return config.release;
  }
  try {
    const res = await fetchWithTimeout(config.manifestUrl);
    if (!res.ok) throw new Error(`manifest: HTTP ${res.status}`);
    const manifest = (await res.json()) as {
      version?: string;
      platforms?: Record<string, { url?: string }>;
    };
    const version = String(manifest.version ?? "");
    if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
      throw new Error(`manifest has no valid version ("${version}")`);
    }
    const url = String(manifest.platforms?.["windows-x86_64"]?.url ?? "");
    if (!url.startsWith(`${config.repoUrl}/releases/download/`)) {
      throw new Error(`manifest URL is not a release asset of ${config.repo}: "${url}"`);
    }
    const head = await fetchWithTimeout(url, { method: "HEAD", redirect: "follow" });
    if (!head.ok) throw new Error(`HEAD ${url}: HTTP ${head.status}`);
    const size = Number(head.headers.get("content-length"));
    if (!Number.isFinite(size) || size <= 0) throw new Error(`no Content-Length for ${url}`);
    const release: Release = {
      version,
      installerName: decodeURIComponent(url.slice(url.lastIndexOf("/") + 1)),
      installerSize: size,
      downloadUrl: url,
    };
    if (version !== config.release.version || size !== config.release.installerSize) {
      console.log(
        `note: the published release is ${version} (${size} bytes); the fallback in site.config.json is ` +
          `${config.release.version} (${config.release.installerSize} bytes). Update it when convenient.`,
      );
    }
    return release;
  } catch (e) {
    warnings.push(
      `could not read the release from the network (${errorText(e)}); ` +
        `using the fallback in site.config.json (${config.release.version})`,
    );
    return config.release;
  }
}

// ---------------------------------------------------------------- sources in the app repository

type SourceMode = "local" | "remote";

function sourceMode(config: Config): SourceMode {
  const env = process.env.DOCS_SOURCE;
  if (env === "local" || env === "remote") return env;
  if (process.env.CI) return "remote";
  return existsSync(path.resolve(ROOT, config.localSource)) ? "local" : "remote";
}

async function readSourceBytes(
  rel: string,
  mode: SourceMode,
  config: Config,
): Promise<{ bytes: Uint8Array } | { error: string }> {
  if (mode === "local") {
    const file = path.resolve(ROOT, config.localSource, rel);
    if (!existsSync(file)) return { error: `not found: ${file}` };
    const bytes = new Uint8Array(await readFile(file));
    if (!bytes.length) return { error: `empty file: ${file}` };
    return { bytes };
  }
  const url = config.rawBase + rel;
  try {
    const res = await fetchWithTimeout(url, {}, 30000);
    if (!res.ok) return { error: `HTTP ${res.status}: ${url}` };
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length) return { error: `empty response: ${url}` };
    return { bytes };
  } catch (e) {
    return { error: `${errorText(e)}: ${url}` };
  }
}

async function readSource(rel: string, mode: SourceMode, config: Config): Promise<{ text: string } | { error: string }> {
  const r = await readSourceBytes(rel, mode, config);
  if ("error" in r) return r;
  const text = new TextDecoder("utf-8").decode(r.bytes).replace(/\r\n/g, "\n");
  if (!text.trim()) return { error: `empty: ${rel}` };
  return { text };
}

// ---------------------------------------------------------------- Markdown

type RenderEnv = {
  title?: string;
  rewriteLink: (href: string) => string;
  rewriteImage: (src: string) => string;
};

/** GitHub-style heading slug, so deep links match the ones on github.com. */
function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
    .replace(/ /g, "-");
}

function inlineText(token: { children: Array<{ type: string; content: string }> | null }): string {
  return (token.children ?? [])
    .filter((t) => t.type === "text" || t.type === "code_inline" || t.type === "text_special")
    .map((t) => t.content)
    .join("");
}

function createMarkdown(): MarkdownIt {
  // html: false escapes any raw HTML in the source instead of rendering it.
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false });

  md.core.ruler.push("diarist_ids_and_links", (state) => {
    const env = state.env as RenderEnv;
    const used = new Map<string, number>();
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.type === "heading_open") {
        const text = inlineText(tokens[i + 1] as never);
        let slug = slugify(text) || "section";
        const n = used.get(slug) ?? 0;
        used.set(slug, n + 1);
        if (n > 0) slug = `${slug}-${n}`;
        tok.attrSet("id", slug);
        if (tok.tag === "h1" && env.title === undefined) env.title = text.trim();
      }
      if (tok.type === "inline" && tok.children) {
        for (const child of tok.children) {
          if (child.type === "link_open") {
            const href = child.attrGet("href");
            if (href !== null) child.attrSet("href", env.rewriteLink(href));
          } else if (child.type === "image") {
            const src = child.attrGet("src");
            if (src !== null) child.attrSet("src", env.rewriteImage(src));
          }
        }
      }
    }
    return true;
  });

  // Wide tables scroll inside their own box instead of widening the page.
  md.renderer.rules.table_open = () =>
    '<div class="table-wrap" tabindex="0" role="region" aria-label="Table">\n<table>\n';
  md.renderer.rules.table_close = () => "</table>\n</div>\n";
  return md;
}

const isAbsoluteUrl = (u: string) => /^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith("//");

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const encodeRepoPath = (p: string) => p.split("/").map(encodeURIComponent).join("/");

function makeRewriters(
  doc: DocEntry,
  docsBySource: Map<string, DocEntry>,
  config: Config,
  warnings: string[],
) {
  const split = (u: string) => {
    const hashAt = u.indexOf("#");
    let pathPart = hashAt >= 0 ? u.slice(0, hashAt) : u;
    const hash = hashAt >= 0 ? u.slice(hashAt) : "";
    const q = pathPart.indexOf("?");
    const query = q >= 0 ? pathPart.slice(q) : "";
    if (q >= 0) pathPart = pathPart.slice(0, q);
    const decoded = safeDecode(pathPart);
    let resolved = decoded.startsWith("/")
      ? path.posix.normalize(decoded.slice(1))
      : path.posix.normalize(path.posix.join(path.posix.dirname(doc.source), decoded));
    if (resolved.startsWith("../")) {
      warnings.push(`${doc.source}: link "${u}" points outside the repository`);
      resolved = resolved.replace(/^(\.\.\/)+/, "");
    }
    resolved = resolved.replace(/\/+$/, "");
    if (resolved === ".") resolved = "";
    return { resolved, query, hash };
  };

  return {
    rewriteLink(href: string): string {
      if (!href || href.startsWith("#") || isAbsoluteUrl(href)) return href;
      const { resolved, query, hash } = split(href);
      const target = docsBySource.get(resolved);
      if (target) {
        if (target.slug === doc.slug) return hash || "./";
        return `../${target.slug}/${hash}`;
      }
      if (resolved === "") return `${config.repoUrl}${hash}`;
      return `${config.blobBase}${encodeRepoPath(resolved)}${query}${hash}`;
    },
    rewriteImage(src: string): string {
      if (!src || isAbsoluteUrl(src)) return src;
      const { resolved, query } = split(src);
      return `${config.rawBase}${encodeRepoPath(resolved)}${query}`;
    },
  };
}

// ---------------------------------------------------------------- templates

const PARTIAL_RE = /\{\{>\s*([a-z0-9_-]+)\s*\}\}/gi;
const VAR_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

async function loadTemplate(file: string): Promise<string> {
  let html = await readFile(path.join(SRC, file), "utf8");
  for (let depth = 0; PARTIAL_RE.test(html); depth++) {
    PARTIAL_RE.lastIndex = 0;
    if (depth > 4) throw new Error(`${file}: partials nested too deeply`);
    const names = [...html.matchAll(PARTIAL_RE)].map((m) => m[1]);
    for (const name of new Set(names)) {
      const partialFile = path.join(SRC, "partials", `${name}.html`);
      if (!existsSync(partialFile)) throw new Error(`${file}: missing partial ${partialFile}`);
      const partial = (await readFile(partialFile, "utf8")).trimEnd();
      html = html.replaceAll(new RegExp(`\\{\\{>\\s*${name}\\s*\\}\\}`, "g"), () => partial);
    }
  }
  PARTIAL_RE.lastIndex = 0;
  return html;
}

/** One pass: inserted values are never scanned again, so Markdown containing "{{" is safe. */
function fill(template: string, vars: Record<string, string>, where: string): string {
  return template.replace(VAR_RE, (_, key: string) => {
    if (!(key in vars)) throw new Error(`${where}: unknown placeholder {{${key}}}`);
    return vars[key];
  });
}

/** The per-page meta CSP. The response header in _headers repeats it for every page. */
function csp(extraImgHosts: string[]): string {
  const img = ["'self'", ...extraImgHosts].join(" ");
  return [
    "default-src 'self'",
    `img-src ${img}`,
    "style-src 'self'",
    "script-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}

// ---------------------------------------------------------------- Cloudflare files

function headersFile(extraImgHosts: string[]): string {
  const img = ["'self'", "data:", ...extraImgHosts].join(" ");
  return [
    "# Response headers for Cloudflare Workers static assets (DESIGN.md section 8). Written by build/build.ts.",
    "",
    "/*",
    `  Content-Security-Policy: default-src 'self'; img-src ${img}; style-src 'self'; script-src 'none'; frame-ancestors 'none'`,
    "  X-Content-Type-Options: nosniff",
    "  Referrer-Policy: no-referrer",
    "  Permissions-Policy: camera=(), microphone=(), geolocation=()",
    "",
    "# Files under assets/h/ carry a content hash in their name, so they can be cached for a year.",
    `/${HASHED}/*`,
    "  Cache-Control: public, max-age=31536000, immutable",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------- screenshots

async function buildScreenshot(
  config: Config,
  mode: SourceMode,
  warnings: string[],
  errors: string[],
): Promise<string> {
  const { source, light, dark, widths, sizes, alt } = config.screenshot;

  // sharp is optional: without it the PNGs ship as they are.
  let sharp: any = null;
  try {
    sharp = (await import("sharp")).default;
  } catch (e) {
    warnings.push(`sharp is not available (${errorText(e)}); shipping the screenshots as PNG`);
  }

  const settings = "avif-q62-e6|webp-q82-e6|v1";
  const made: Record<string, { width: number; height: number; avif: string[]; webp: string[]; png?: string }> = {};

  for (const name of [light, dark]) {
    const rel = `${source}/${name}.png`;
    const src = await readSourceBytes(rel, mode, config);
    if ("error" in src) {
      errors.push(`missing screenshot ${rel}: ${src.error}`);
      continue;
    }
    const buf = src.bytes;
    let size: { width: number; height: number };
    try {
      size = pngSize(buf);
    } catch (e) {
      errors.push(`screenshot ${rel}: ${errorText(e)}`);
      continue;
    }
    const entry = { ...size, avif: [] as string[], webp: [] as string[], png: undefined as string | undefined };

    if (sharp) {
      const key = `${shortHash(buf)}-${shortHash(settings)}`;
      await mkdir(CACHE, { recursive: true });
      const targets = [...new Set(widths.map((w) => Math.min(w, size.width)))].sort((a, b) => a - b);
      for (const w of targets) {
        for (const fmt of ["avif", "webp"] as const) {
          const cached = path.join(CACHE, `${key}-${name}-${w}.${fmt}`);
          if (!existsSync(cached)) {
            let img = sharp(buf);
            if (w < size.width) img = img.resize({ width: w });
            img = fmt === "avif" ? img.avif({ quality: 62, effort: 6 }) : img.webp({ quality: 82, effort: 6 });
            await img.toFile(cached);
          }
          const out = await emitHashed(`${name}-${w}.${fmt}`, new Uint8Array(await readFile(cached)));
          entry[fmt].push(`${out} ${w}w`);
        }
      }
    } else {
      entry.png = await emitHashed(`${name}.png`, buf);
    }
    made[name] = entry;
  }
  if (!made[light] || !made[dark]) return "";

  const L = made[light];
  const D = made[dark];
  const altAttr = escapeHtml(alt);
  const dims = `width="${L.width}" height="${L.height}"`;
  const dark_ = "(prefers-color-scheme: dark)";
  const lines: string[] = ["    <picture>"];
  if (sharp) {
    lines.push(
      `      <source media="${dark_}" type="image/avif" srcset="${D.avif.join(", ")}" sizes="${sizes}">`,
      `      <source media="${dark_}" type="image/webp" srcset="${D.webp.join(", ")}" sizes="${sizes}">`,
      `      <source type="image/avif" srcset="${L.avif.join(", ")}" sizes="${sizes}">`,
      `      <img src="${L.webp.at(-1)!.split(" ")[0]}" srcset="${L.webp.join(", ")}" sizes="${sizes}" ${dims} loading="lazy" decoding="async" alt="${altAttr}">`,
    );
  } else {
    lines.push(
      `      <source media="${dark_}" srcset="${D.png}">`,
      `      <img src="${L.png}" ${dims} loading="lazy" decoding="async" alt="${altAttr}">`,
    );
  }
  lines.push("    </picture>");
  return lines.join("\n");
}

// ---------------------------------------------------------------- build

async function copyStatic(errors: string[]): Promise<string> {
  await mkdir(path.join(DIST, "assets"), { recursive: true });
  await cp(path.join(SRC, "assets"), path.join(DIST, "assets"), { recursive: true });
  for (const required of ["favicon.png", "apple-touch-icon.png", "logo.svg", "wordmark.svg", "wordmark-dark.svg", "social.png"]) {
    if (!existsSync(path.join(SRC, "assets", required))) {
      errors.push(`missing src/assets/${required}${required.endsWith(".png") ? " (run: bun run icons)" : ""}`);
    }
  }
  const css = await readFile(path.join(SRC, "styles.css"), "utf8");
  return emitHashed("styles.css", css);
}

export async function build(opts: BuildOptions = {}): Promise<BuildResult> {
  const started = performance.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  const pages: string[] = [];
  const charts: ChartSummary[] = [];

  const config: Config = JSON.parse(await readFile(path.join(ROOT, "site.config.json"), "utf8"));
  const release = opts.release ?? (await resolveRelease(config, warnings));
  const mode = sourceMode(config);
  console.log(`sources: reading the app repository from ${mode === "local" ? path.resolve(ROOT, config.localSource) : config.rawBase}`);

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  const styles = await copyStatic(errors);

  // Values shared by every page.
  const pre = release.version.includes("-") ? release.version.split("-")[1].split(".")[0] : "";
  const common: Record<string, string> = {
    site_url: config.siteUrl,
    repo_url: config.repoUrl,
    issues_url: config.issuesUrl,
    roadmap_url: config.roadmapUrl,
    blob_base: config.blobBase,
    download_url: escapeHtml(release.downloadUrl),
    release_url: `${config.repoUrl}/releases/tag/v${encodeURIComponent(release.version)}`,
    version: escapeHtml(release.version),
    installer_size: formatSize(release.installerSize),
    prerelease_tag: pre ? ` <span class="tag">${escapeHtml(pre)}</span>` : "",
    styles,
    models_current: "",
    issues_current: "",
    docs_current: "",
  };

  // ------------------------------------------------ landing page
  const description =
    "Diarist records a meeting, or imports a recording, separates up to eight speakers, and stores the " +
    "transcript in a searchable database on your computer. No cloud, no account, no Python.";
  const indexTemplate = await loadTemplate("index.html");
  const screenshot = await buildScreenshot(config, mode, warnings, errors);
  const indexHtml = fill(
    indexTemplate,
    {
      ...common,
      root: "./",
      title: "Diarist: local meeting transcription with speaker labels",
      description: escapeHtml(description),
      canonical: `${config.siteUrl}/`,
      csp: csp([]),
      screenshot,
    },
    "src/index.html",
  );
  await writeFile(path.join(DIST, "index.html"), indexHtml);
  pages.push("index.html");

  // ------------------------------------------------ 404 page
  // Workers serves dist/404.html, with status 404, for any path without a file
  // (not_found_handling in wrangler.jsonc). It appears at any URL, so its links are
  // root-relative.
  const notFoundHtml = fill(
    await loadTemplate("404.html"),
    {
      ...common,
      root: "/",
      title: "Page not found - Diarist",
      description: "There is no page at this address on diarist.dev.",
      canonical: `${config.siteUrl}/404.html`,
      csp: csp([]),
    },
    "src/404.html",
  );
  await writeFile(path.join(DIST, "404.html"), notFoundHtml);
  pages.push("404.html");

  // ------------------------------------------------ code signing policy
  // SignPath Foundation's terms ask for a page titled "Code signing policy", linked from
  // the home and download pages: the footer and the hero's download line link here.
  const codeSigningHtml = fill(
    await loadTemplate("code-signing.html"),
    {
      ...common,
      root: "../",
      title: "Code signing policy - Diarist",
      description: escapeHtml(
        "How Diarist's Windows installer is signed through SignPath Foundation, who approves each release, what the app sends over the network, and how to check a download.",
      ),
      canonical: `${config.siteUrl}/code-signing/`,
      csp: csp([]),
    },
    "src/code-signing.html",
  );
  await mkdir(path.join(DIST, "code-signing"), { recursive: true });
  await writeFile(path.join(DIST, "code-signing", "index.html"), codeSigningHtml);
  pages.push("code-signing/index.html");

  // ------------------------------------------------ models page
  const benchSrc = await readSource(config.benchmarks, mode, config);
  if ("error" in benchSrc) {
    errors.push(`missing benchmark data ${config.benchmarks}: ${benchSrc.error}`);
  } else {
    try {
      const b = parseBenchmarks(benchSrc.text);
      const blob = config.blobBase;
      const updatedLong = longDate(b.updated);
      const made = [diarizationChart(b, blob), asrChart(b, blob), measuredChart(b, blob), vramChart(b, blob), languagesChart(b, blob, updatedLong)];
      charts.push(...made.map((m) => m.summary));
      // The Sources section lists where each block of the data file takes its numbers from,
      // straight from the file's `from` fields, so it cannot drift from the data.
      const blocks: [string, string][] = [
        ["Speaker diarization, published", b.diarization_published.from],
        ["Speech to text, published", b.asr_published.from],
        ["Measured in Diarist (cpWER)", b.asr_measured.from],
        ["Peak GPU memory", b.vram_measured.from],
        ["Speed", b.speed_measured.from],
        ["Languages, measured", b.languages_measured.from],
      ];
      const sourcesFrom = blocks.map(([name, from]) => `      <li><strong>${escapeHtml(name)}:</strong> ${escapeHtml(from)}</li>`).join("\n");
      const modelsTemplate = await loadTemplate("models.html");
      const modelsHtml = fill(
        modelsTemplate,
        {
          ...common,
          root: "../",
          models_current: ' aria-current="page"',
          title: "Choosing a runtime package and models - Diarist",
          description: escapeHtml(
            "Which runtime package and which speech and speaker models for your PC, with the published benchmarks and Diarist's own measurements as charts.",
          ),
          canonical: `${config.siteUrl}/models/`,
          csp: csp([]),
          chart_diarization: made[0].html,
          chart_asr: made[1].html,
          chart_measured: made[2].html,
          chart_vram: made[3].html,
          chart_languages: made[4].html,
          sources_from: sourcesFrom,
          machine: escapeHtml(b.machine),
          updated: escapeHtml(b.updated),
          updated_long: escapeHtml(updatedLong),
          import_factor: String(b.speed_measured.import_realtime_factor),
          live_first_text: String(b.speed_measured.live_first_text_s),
          benchmarks_url: `${config.blobBase}${encodeRepoPath(config.benchmarks)}`,
        },
        "src/models.html",
      );
      await mkdir(path.join(DIST, "models"), { recursive: true });
      await writeFile(path.join(DIST, "models", "index.html"), modelsHtml);
      pages.push("models/index.html");
    } catch (e) {
      errors.push(`malformed benchmark data ${config.benchmarks}: ${errorText(e)}`);
    }
  }

  // ------------------------------------------------ docs
  const docsTemplate = await loadTemplate("docs.html");
  const docsBySource = new Map(config.docs.map((d) => [d.source, d]));
  const md = createMarkdown();
  const missing: string[] = [];
  const docImageHosts = new Set<string>();

  const navFor = (current: string | null) => {
    const prefix = current === null ? "" : "../";
    const items = config.docs.map((d) => {
      const here = d.slug === current ? ' aria-current="page"' : "";
      return `      <li><a href="${prefix}${d.slug}/"${here}>${escapeHtml(d.label)}</a></li>`;
    });
    return `    <ul>\n${items.join("\n")}\n    </ul>`;
  };

  const sources = await Promise.all(config.docs.map((d) => readSource(d.source, mode, config)));

  for (const [i, doc] of config.docs.entries()) {
    const src = sources[i];
    if ("error" in src) {
      missing.push(`${doc.source} (for /docs/${doc.slug}/): ${src.error}`);
      continue;
    }
    const rewriters = makeRewriters(doc, docsBySource, config, warnings);
    const env: RenderEnv = { ...rewriters };
    const content = md.render(src.text, env);
    if (!env.title) warnings.push(`${doc.source} has no H1; using "${doc.label}" as the title`);
    const title = env.title ?? doc.label;
    const imgHosts = content.includes(`src="${config.rawBase}`) ? ["https://raw.githubusercontent.com"] : [];
    for (const h of imgHosts) docImageHosts.add(h);
    const html = fill(
      docsTemplate,
      {
        ...common,
        root: "../../",
        docs_root: "../",
        docs_current: ' aria-current="true"',
        issues_current: doc.slug === "known-issues" ? ' aria-current="page"' : "",
        docs_index_current: "",
        title: escapeHtml(`${title} - Diarist docs`),
        description: escapeHtml(doc.summary),
        canonical: `${config.siteUrl}/docs/${doc.slug}/`,
        csp: csp(imgHosts),
        docs_nav: navFor(doc.slug),
        edit_link: `    <p class="edit"><a href="${config.editBase}${encodeRepoPath(doc.source)}">Edit on GitHub</a></p>`,
        content,
      },
      `docs/${doc.slug}`,
    );
    const outDir = path.join(DIST, "docs", doc.slug);
    await mkdir(outDir, { recursive: true });
    await writeFile(path.join(outDir, "index.html"), html);
    pages.push(`docs/${doc.slug}/index.html`);
  }

  // Docs index: a short generated page listing the entries.
  const indexItems = config.docs
    .map(
      (d) =>
        `  <li><a href="${d.slug}/">${escapeHtml(d.label)}</a> <span>${escapeHtml(d.summary)}</span></li>`,
    )
    .join("\n");
  const docsIndexContent = [
    '<h1 id="docs">Docs</h1>',
    `<p>These pages are rendered from the Markdown files in the <a href="${config.repoUrl}">Diarist repository</a>, which stays the canonical copy. Each page links to its source on GitHub, where you can suggest a change. The <a href="../models/">models page</a> with the benchmark charts is built from the repository's data file.</p>`,
    `<ul class="doc-index">\n${indexItems}\n</ul>`,
  ].join("\n");
  const docsIndex = fill(
    docsTemplate,
    {
      ...common,
      root: "../",
      docs_root: "./",
      docs_current: ' aria-current="page"',
      docs_index_current: ' aria-current="page"',
      title: "Docs - Diarist",
      description: "Installing Diarist, choosing models, known issues, privacy, measurements, the changelog and licences.",
      canonical: `${config.siteUrl}/docs/`,
      csp: csp([]),
      docs_nav: navFor(null),
      edit_link: "",
      content: docsIndexContent,
    },
    "docs/index",
  );
  await writeFile(path.join(DIST, "docs", "index.html"), docsIndex);
  pages.push("docs/index.html");

  for (const m of missing) errors.push(`missing docs source: ${m}`);

  // ------------------------------------------------ Cloudflare files
  // No _redirects: the one redirect the site needs, www to apex, is a Redirect Rule in the
  // zone, because Workers static assets skip _redirects lines with a host in the source.
  if (docImageHosts.size) {
    warnings.push(`docs pages load images from ${[...docImageHosts].join(", ")}; _headers allows that host in img-src`);
  }
  await writeFile(path.join(DIST, "_headers"), headersFile([...docImageHosts]));

  // ------------------------------------------------ report
  const ms = Math.round(performance.now() - started);
  for (const w of warnings) console.warn(`warning: ${w}`);
  console.log(
    `release: ${release.version}, ${release.installerName}, ${release.installerSize} bytes (${formatSize(release.installerSize)})`,
  );
  for (const c of charts) console.log(`chart: ${c.title} [from ${c.from}]`);
  console.log(`built ${pages.length} pages into dist/ in ${ms} ms`);
  if (errors.length) {
    console.error("\nBUILD FAILED");
    for (const e of errors) console.error(`  error: ${e}`);
    console.error("");
  }
  return { ok: errors.length === 0, release, errors, warnings, pages, charts };
}

if (import.meta.main) {
  try {
    const result = await build();
    process.exit(result.ok ? 0 : 1);
  } catch (e) {
    console.error(`\nBUILD FAILED\n  error: ${errorText(e)}\n`);
    process.exit(1);
  }
}
