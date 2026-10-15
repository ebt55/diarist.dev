/**
 * `bun run check`: checks the built site in dist/.
 *
 *  1. HTML well-formedness: tags open and close in order, attributes are quoted and
 *     unique, ids are unique, no stray "<" or "&", plus a few page rules (lang, title,
 *     one h1, heading order, img alt and size).
 *  2. Internal links: every href, src and srcset inside dist/ resolves to a file, and
 *     every #fragment to an id. External URLs are listed by host; an external resource
 *     that a page would load (image, script, stylesheet) is an error.
 *  3. Voice: the visible text of every page is searched for the words DESIGN.md
 *     section 2 rules out, exclamation marks and emoji (code blocks are skipped); the
 *     site's own pages also for the comparatives and slogans it rules out.
 *  4. Weight: the landing page's HTML plus CSS (60 KB) and its total with images
 *     (600 KB); the models page's HTML plus CSS (120 KB).
 *  5. Hosting files: dist/_headers and dist/404.html for Cloudflare Workers static assets,
 *     no _redirects line Workers would skip, and no leftover GitHub Pages files.
 *
 * Exits non-zero on any error.
 */
import { existsSync, statSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const DIST = path.join(ROOT, "dist");

const errors: string[] = [];
const warnings: string[] = [];
const rel = (f: string) => path.relative(DIST, f).split(path.sep).join("/");

// ---------------------------------------------------------------- parser

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style", "title", "textarea"]);
const NO_VOICE_CHECK = new Set(["code", "pre", "script", "style"]);
const CLOSES_P = new Set([
  "address", "article", "aside", "blockquote", "details", "div", "dl", "fieldset", "figcaption", "figure",
  "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "main", "nav", "ol", "p", "pre",
  "section", "table", "ul",
]);

type El = { name: string; attrs: Map<string, string>; line: number; picture: number | null };
type Parsed = {
  elements: El[];
  text: { text: string; line: number }[];
  ids: Set<string>;
  hasDoctype: boolean;
  title: string;
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[n as "amp"]);
}

function parse(html: string, file: string): Parsed {
  const where = rel(file);
  const lineStarts = [0];
  for (let k = 0; k < html.length; k++) if (html[k] === "\n") lineStarts.push(k + 1);
  const lineAt = (pos: number) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const err = (pos: number, msg: string) => errors.push(`${where}:${lineAt(pos)}: ${msg}`);

  const out: Parsed = { elements: [], text: [], ids: new Set(), hasDoctype: false, title: "" };
  const stack: { name: string; line: number; picture: number | null }[] = [];
  let pictureCount = 0;
  const currentPicture = () => {
    for (let k = stack.length - 1; k >= 0; k--) if (stack[k].name === "picture") return stack[k].picture;
    return null;
  };

  const handleText = (text: string, pos: number) => {
    const amp = /&(?![a-zA-Z][a-zA-Z0-9]*;|#\d+;|#x[0-9a-fA-F]+;)/.exec(text);
    if (amp) err(pos + amp.index, 'unescaped "&" in text');
    if (!stack.some((s) => NO_VOICE_CHECK.has(s.name)) && text.trim()) {
      out.text.push({ text: decodeEntities(text), line: lineAt(pos) });
    }
  };

  let i = 0;
  const len = html.length;
  while (i < len) {
    const lt = html.indexOf("<", i);
    const textEnd = lt === -1 ? len : lt;
    if (textEnd > i) handleText(html.slice(i, textEnd), i);
    if (lt === -1) break;

    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      if (end === -1) {
        err(lt, "unterminated comment");
        break;
      }
      i = end + 3;
      continue;
    }
    if (/^<!doctype\s+html\s*>/i.test(html.slice(lt, lt + 20))) {
      if (out.elements.length || out.hasDoctype) err(lt, "doctype must come first, once");
      out.hasDoctype = true;
      i = html.indexOf(">", lt) + 1;
      continue;
    }
    if (html.startsWith("</", lt)) {
      const m = /^<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>/.exec(html.slice(lt, lt + 80));
      if (!m) {
        err(lt, "malformed end tag");
        i = lt + 2;
        continue;
      }
      const name = m[1].toLowerCase();
      if (VOID.has(name)) err(lt, `end tag for void element </${name}>`);
      else {
        const top = stack.pop();
        if (!top) err(lt, `stray </${name}>`);
        else if (top.name !== name) {
          err(lt, `</${name}> closes <${top.name}> opened on line ${top.line}`);
          const idx = stack.map((s) => s.name).lastIndexOf(name);
          if (idx >= 0) stack.length = idx;
          else stack.push(top);
        }
      }
      i = lt + m[0].length;
      continue;
    }
    const m = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(lt, lt + 80));
    if (!m) {
      err(lt, 'unescaped "<" in text');
      i = lt + 1;
      continue;
    }
    const name = m[1].toLowerCase();
    const attrs = new Map<string, string>();
    let j = lt + m[0].length;
    let selfClosing = false;
    let closed = false;
    while (j < len) {
      const before = j;
      while (j < len && /\s/.test(html[j])) j++;
      if (html[j] === ">") {
        j++;
        closed = true;
        break;
      }
      if (html.startsWith("/>", j)) {
        selfClosing = true;
        closed = true;
        j += 2;
        break;
      }
      if (j === before && attrs.size > 0) err(j, `attributes of <${name}> need whitespace between them`);
      const am = /^[^\s"'>/=]+/.exec(html.slice(j, j + 200));
      if (!am) {
        err(j, `bad attribute syntax in <${name}>`);
        j++;
        continue;
      }
      const aname = am[0].toLowerCase();
      j += am[0].length;
      while (j < len && /\s/.test(html[j])) j++;
      let value = "";
      if (html[j] === "=") {
        j++;
        while (j < len && /\s/.test(html[j])) j++;
        const q = html[j];
        if (q === '"' || q === "'") {
          const end = html.indexOf(q, j + 1);
          if (end === -1) {
            err(j, "unterminated attribute value");
            j = len;
            break;
          }
          value = html.slice(j + 1, end);
          j = end + 1;
        } else {
          const vm = /^[^\s>]+/.exec(html.slice(j, j + 500));
          value = vm ? vm[0] : "";
          if (/["'=<>`]/.test(value)) err(j, `unquoted attribute value with special characters in <${name}>`);
          j += value.length;
        }
      }
      if (attrs.has(aname)) err(j, `duplicate attribute "${aname}" on <${name}>`);
      attrs.set(aname, decodeEntities(value));
    }
    if (!closed) err(lt, `unterminated <${name}> tag`);
    if (selfClosing && !VOID.has(name)) err(lt, `self-closing syntax on non-void <${name}/>`);
    if (CLOSES_P.has(name) && stack.at(-1)?.name === "p") err(lt, `<${name}> inside <p> (browsers would close the paragraph)`);

    const line = lineAt(lt);
    if (name === "picture" && !selfClosing) pictureCount++;
    out.elements.push({ name, attrs, line, picture: name === "picture" ? pictureCount : currentPicture() });
    const id = attrs.get("id");
    if (id !== undefined) {
      if (!id) err(lt, "empty id");
      else if (out.ids.has(id)) err(lt, `duplicate id "${id}"`);
      out.ids.add(id);
    }

    if (!VOID.has(name) && !selfClosing) {
      if (RAW.has(name)) {
        const close = new RegExp(`</${name}\\s*>`, "i");
        const rest = html.slice(j);
        const cm = close.exec(rest);
        if (!cm) {
          err(lt, `<${name}> is never closed`);
          break;
        }
        const content = rest.slice(0, cm.index);
        if (name === "title") {
          const t = decodeEntities(content).trim();
          // The first <title> is the page's; later ones belong to the inline SVG charts.
          if (!out.title) out.title = t;
          out.text.push({ text: t, line });
        }
        i = j + cm.index + cm[0].length;
        continue;
      }
      stack.push({ name, line, picture: name === "picture" ? pictureCount : null });
    }
    i = j;
  }
  for (const open of stack) errors.push(`${where}:${open.line}: <${open.name}> is never closed`);
  return out;
}

// ---------------------------------------------------------------- files

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

if (!existsSync(path.join(DIST, "index.html"))) {
  console.error("dist/index.html not found: run `bun run build` first.");
  process.exit(1);
}

const allFiles = await walk(DIST);
const htmlFiles = allFiles.filter((f) => f.endsWith(".html"));
const cssFiles = allFiles.filter((f) => f.endsWith(".css"));
const parsed = new Map<string, Parsed>();
for (const f of htmlFiles) parsed.set(f, parse(await readFile(f, "utf8"), f));
const parseErrors = errors.length;

// ---------------------------------------------------------------- page rules

const config = JSON.parse(await readFile(path.join(ROOT, "site.config.json"), "utf8"));
for (const d of config.docs as { slug: string }[]) {
  if (!existsSync(path.join(DIST, "docs", d.slug, "index.html"))) errors.push(`missing page: docs/${d.slug}/index.html`);
}
if (!existsSync(path.join(DIST, "models", "index.html"))) errors.push("missing page: models/index.html");

// Cloudflare Workers reads _headers from the assets directory and serves 404.html for paths
// without a file (DESIGN.md section 8, wrangler.jsonc).
const headersFile = path.join(DIST, "_headers");
if (!existsSync(headersFile)) errors.push("missing dist/_headers");
else {
  const text = await readFile(headersFile, "utf8");
  for (const name of ["Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Cache-Control"]) {
    if (!text.includes(`\n  ${name}: `)) errors.push(`dist/_headers does not set ${name}`);
  }
  text.split("\n").forEach((line, i) => {
    if (line.length > 2000) errors.push(`dist/_headers:${i + 1}: over Cloudflare's 2000-character line limit`);
  });
}
if (!existsSync(path.join(DIST, "404.html"))) errors.push("missing dist/404.html");
// Workers static assets honour _redirects but skip any line whose source names a host, so a
// www redirect written there would silently do nothing (it is a Redirect Rule in the zone).
const redirectsFile = path.join(DIST, "_redirects");
if (existsSync(redirectsFile)) {
  (await readFile(redirectsFile, "utf8")).split("\n").forEach((line, i) => {
    if (/^\s*[a-z]+:\/\//i.test(line)) errors.push(`dist/_redirects:${i + 1}: Workers skips redirect sources with a host; use a Redirect Rule in the zone`);
  });
}
for (const stale of ["CNAME", ".nojekyll"]) {
  if (existsSync(path.join(DIST, stale))) errors.push(`dist/${stale} belongs to GitHub Pages, which no longer hosts the site`);
}

for (const [file, p] of parsed) {
  const where = rel(file);
  if (!p.hasDoctype) errors.push(`${where}: missing <!doctype html>`);
  const html = p.elements.find((e) => e.name === "html");
  if (!html?.attrs.get("lang")) errors.push(`${where}: <html> needs a lang attribute`);
  if (!p.title) errors.push(`${where}: missing or empty <title>`);
  if (!p.elements.some((e) => e.name === "meta" && e.attrs.has("charset"))) errors.push(`${where}: missing <meta charset>`);
  if (!p.elements.some((e) => e.name === "meta" && e.attrs.get("name") === "viewport")) errors.push(`${where}: missing viewport meta`);
  if (!p.elements.some((e) => e.name === "main")) errors.push(`${where}: missing <main> landmark`);

  const headings = p.elements.filter((e) => /^h[1-6]$/.test(e.name));
  const h1s = headings.filter((h) => h.name === "h1").length;
  if (h1s !== 1) errors.push(`${where}: ${h1s} <h1> elements, expected exactly one`);
  let prev = 0;
  for (const h of headings) {
    const level = Number(h.name[1]);
    if (prev && level > prev + 1) {
      const msg = `${where}:${h.line}: heading jumps from h${prev} to h${level}`;
      // Docs pages carry the app repository's own heading structure.
      (where.startsWith("docs/") ? warnings : errors).push(msg);
    }
    prev = level;
  }
  for (const img of p.elements.filter((e) => e.name === "img")) {
    if (!img.attrs.has("alt")) errors.push(`${where}:${img.line}: <img> without alt`);
    if (!where.startsWith("docs/") && (!img.attrs.has("width") || !img.attrs.has("height"))) {
      errors.push(`${where}:${img.line}: <img> without width and height`);
    }
  }
}

// ---------------------------------------------------------------- links

const linkHosts = new Map<string, number>();
const resourceHosts = new Map<string, number>();
let internalChecked = 0;

const NOT_LOADED_REL = new Set(["canonical", "alternate", "me", "license", "author", "help"]);
const URL_ATTRS: Record<string, string[]> = {
  a: ["href"],
  link: ["href"],
  img: ["src", "srcset"],
  source: ["src", "srcset"],
  script: ["src"],
  iframe: ["src"],
  video: ["src", "poster"],
  audio: ["src"],
  track: ["src"],
  embed: ["src"],
  object: ["data"],
  form: ["action"],
  use: ["href"],
};

function urlsOf(attr: string, value: string): string[] {
  if (attr !== "srcset") return [value.trim()];
  return value
    .split(",")
    .map((c) => c.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function checkInternal(from: string, url: string, line: number) {
  const where = `${rel(from)}:${line}`;
  const hashAt = url.indexOf("#");
  let p = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const hash = hashAt >= 0 ? url.slice(hashAt + 1) : "";
  p = p.split("?")[0];
  let target: string;
  if (p === "") target = from;
  else {
    let decoded = p;
    try {
      decoded = decodeURIComponent(p);
    } catch {
      errors.push(`${where}: bad percent-encoding in "${url}"`);
    }
    if (decoded.startsWith("/")) {
      // 404.html is served at any URL, so its links have to be root-relative.
      if (rel(from) !== "404.html") warnings.push(`${where}: root-relative link "${url}" breaks under a project-page URL; prefer a relative link`);
      target = path.join(DIST, decoded);
    } else target = path.resolve(path.dirname(from), decoded);
  }
  internalChecked++;
  if (target !== DIST && !target.startsWith(DIST + path.sep)) {
    errors.push(`${where}: link "${url}" leaves dist/`);
    return;
  }
  if (existsSync(target) && statSync(target).isDirectory()) {
    if (p && !p.endsWith("/")) warnings.push(`${where}: "${url}" points at a folder without a trailing slash`);
    target = path.join(target, "index.html");
  }
  if (!existsSync(target)) {
    errors.push(`${where}: broken link "${url}" (no ${rel(target)})`);
    return;
  }
  if (hash && target.endsWith(".html")) {
    const t = parsed.get(target);
    const id = decodeURIComponent(hash);
    if (t && !t.ids.has(id)) errors.push(`${where}: "${url}": no id "${id}" in ${rel(target)}`);
  }
}

for (const [file, p] of parsed) {
  const where = rel(file);
  const isDocs = where.startsWith("docs/");
  for (const el of p.elements) {
    const attrs = URL_ATTRS[el.name];
    if (!attrs) continue;
    for (const attr of attrs) {
      const value = el.attrs.get(attr);
      if (value === undefined) continue;
      if (el.name === "a" && !value) {
        errors.push(`${where}:${el.line}: <a> with an empty href`);
        continue;
      }
      const loaded = !(el.name === "a" || (el.name === "link" && NOT_LOADED_REL.has((el.attrs.get("rel") ?? "").toLowerCase())));
      for (const url of urlsOf(attr, value)) {
        if (/^(mailto|tel):/i.test(url)) continue;
        if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//")) {
          let host = "";
          try {
            host = new URL(url, "https://diarist.dev/").host;
          } catch {
            errors.push(`${where}:${el.line}: unparseable URL "${url}"`);
            continue;
          }
          if (!/^https?:|^\/\//i.test(url)) {
            errors.push(`${where}:${el.line}: unexpected URL scheme in "${url}"`);
            continue;
          }
          if (loaded) {
            resourceHosts.set(host, (resourceHosts.get(host) ?? 0) + 1);
            const msg = `${where}:${el.line}: <${el.name} ${attr}> loads a third-party resource: ${url}`;
            if (isDocs && el.name === "img" && host === "raw.githubusercontent.com") warnings.push(msg);
            else errors.push(msg);
          } else {
            linkHosts.set(host, (linkHosts.get(host) ?? 0) + 1);
            if (url.startsWith("http:")) warnings.push(`${where}:${el.line}: plain http link ${url}`);
          }
          continue;
        }
        checkInternal(file, url, el.line);
      }
    }
  }
}

for (const css of cssFiles) {
  const text = await readFile(css, "utf8");
  if (/@import/i.test(text)) errors.push(`${rel(css)}: @import is not allowed`);
  for (const m of text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
    const url = m[2];
    if (url.startsWith("data:")) continue;
    if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith("//")) errors.push(`${rel(css)}: loads a third-party resource ${url}`);
    else checkInternal(css, url, 0);
  }
}

// ---------------------------------------------------------------- voice

const FORBIDDEN: [RegExp, string][] = [
  [/\bAI[-\s]?powered\b/i, "AI-powered"],
  [/\brevolutionar(y|ies|ise|ize)\b/i, "revolutionary"],
  [/\bseamless(ly)?\b/i, "seamless"],
  [/\bunlock(s|ed|ing)?\b/i, "unlock"],
  [/\bsupercharg(e|es|ed|ing)\b/i, "supercharge"],
  [/\beffortless(ly)?\b/i, "effortless"],
  [/!/, "exclamation mark"],
  [/[\p{Emoji_Presentation}\u{FE0F}]/u, "emoji"],
];
// The comparatives and slogans DESIGN.md section 2 rules out of the site's own copy. The
// rendered docs carry the app repository's text (the model guide compares models by their
// numbers), so they are checked for the words above but not for these.
const COMPARATIVES: [RegExp, string][] = [
  [/\bMost /, 'comparative "Most "'],
  [/\bbetter than\b/i, 'comparative "better than"'],
  [/\bthe point\b/i, 'slogan "the point"'],
  [/\bpromised\b/i, 'slogan "promised"'],
];
const isRenderedDoc = (where: string) => /^docs\/[^/]+\/index\.html$/.test(where);
let voiceHits = 0;
for (const [file, p] of parsed) {
  const where = rel(file);
  const rules = isRenderedDoc(where) ? FORBIDDEN : [...FORBIDDEN, ...COMPARATIVES];
  const chunks = [...p.text];
  for (const el of p.elements) {
    for (const a of ["alt", "aria-label", "title"]) {
      const v = el.attrs.get(a);
      if (v) chunks.push({ text: v, line: el.line });
    }
    if (el.name === "meta" && /description|og:/.test(`${el.attrs.get("name") ?? ""}${el.attrs.get("property") ?? ""}`)) {
      const v = el.attrs.get("content");
      if (v && !/^https?:/.test(v)) chunks.push({ text: v, line: el.line });
    }
  }
  for (const { text, line } of chunks) {
    for (const [re, label] of rules) {
      const m = re.exec(text);
      if (m) {
        voiceHits++;
        const at = Math.max(0, m.index - 30);
        errors.push(`${where}:${line}: ${label}: "...${text.slice(at, m.index + 30).replace(/\s+/g, " ").trim()}..."`);
      }
    }
  }
}

// ---------------------------------------------------------------- page weight

const KB = (n: number) => `${(n / 1024).toFixed(1)} KB`;

// Images a light-scheme desktop browser fetches: per <picture> the first source without a
// media query (or the img), at its largest srcset candidate, plus the SVG favicon.
const largest = (srcset: string) => {
  const cands = srcset.split(",").map((c) => c.trim().split(/\s+/));
  cands.sort((a, b) => parseInt(b[1] ?? "0") - parseInt(a[1] ?? "0"));
  return cands[0][0];
};

function pageWeight(relPage: string) {
  const file = path.join(DIST, relPage);
  const dir = path.dirname(file);
  const page = parsed.get(file);
  if (!page) return { htmlBytes: 0, cssBytes: 0, imageBytes: 0, total: 0 };
  const htmlBytes = statSync(file).size;
  const cssBytes = page.elements
    .filter((e) => e.name === "link" && e.attrs.get("rel") === "stylesheet")
    .reduce((sum, e) => {
      const css = path.resolve(dir, e.attrs.get("href")!);
      return sum + (existsSync(css) ? statSync(css).size : 0);
    }, 0);
  const imageFiles = new Set<string>();
  for (const img of page.elements.filter((e) => e.name === "img")) {
    let chosen = img.attrs.get("srcset") ? largest(img.attrs.get("srcset")!) : img.attrs.get("src")!;
    if (img.picture !== null) {
      const source = page.elements.find((e) => e.name === "source" && e.picture === img.picture && !e.attrs.has("media"));
      if (source) chosen = largest(source.attrs.get("srcset")!);
    }
    imageFiles.add(path.resolve(dir, chosen));
  }
  const svgIcon = page.elements.find((e) => e.name === "link" && e.attrs.get("rel") === "icon" && e.attrs.get("type") === "image/svg+xml");
  if (svgIcon) imageFiles.add(path.resolve(dir, svgIcon.attrs.get("href")!));
  const imageBytes = [...imageFiles].reduce((s, f) => s + (existsSync(f) ? statSync(f).size : 0), 0);
  return { htmlBytes, cssBytes, imageBytes, total: htmlBytes + cssBytes + imageBytes };
}

const index = pageWeight("index.html");
const models = pageWeight(path.join("models", "index.html"));
if (index.htmlBytes + index.cssBytes > 60 * 1024) errors.push(`landing page HTML plus CSS is ${KB(index.htmlBytes + index.cssBytes)}, over the 60 KB budget`);
if (index.total > 600 * 1024) errors.push(`landing page total is ${KB(index.total)}, over the 600 KB budget`);
if (models.htmlBytes + models.cssBytes > 120 * 1024) errors.push(`models page HTML plus CSS is ${KB(models.htmlBytes + models.cssBytes)}, over the 120 KB budget`);
const distBytes = allFiles.reduce((s, f) => s + statSync(f).size, 0);

// ---------------------------------------------------------------- report

const list = (m: Map<string, number>) =>
  m.size ? [...m.entries()].sort().map(([h, n]) => `${h} (${n})`).join(", ") : "none";

console.log(`check: ${htmlFiles.length} pages, ${cssFiles.length} stylesheet(s), ${allFiles.length} files in dist/`);
console.log(`  HTML well-formedness: ${parseErrors ? `${parseErrors} error(s)` : "ok"}`);
console.log(`  internal links and fragments checked: ${internalChecked}`);
console.log(`  external hosts linked: ${list(linkHosts)}`);
console.log(`  external hosts loaded as resources: ${list(resourceHosts)}`);
console.log(`  voice (forbidden words, comparatives, "!", emoji): ${voiceHits ? `${voiceHits} hit(s)` : "clean"}`);
console.log(
  `  landing page: HTML ${KB(index.htmlBytes)} + CSS ${KB(index.cssBytes)} = ${KB(index.htmlBytes + index.cssBytes)}; ` +
    `with images (light scheme, largest candidates) ${KB(index.total)}`,
);
console.log(
  `  models page: HTML ${KB(models.htmlBytes)} + CSS ${KB(models.cssBytes)} = ${KB(models.htmlBytes + models.cssBytes)}; ` +
    `with images ${KB(models.total)}`,
);
console.log(`  dist/ total: ${KB(distBytes)}`);
for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length) {
  console.error(`\nCHECK FAILED: ${errors.length} error(s)`);
  for (const e of errors) console.error(`  error: ${e}`);
  process.exit(1);
}
console.log("\ncheck passed");
