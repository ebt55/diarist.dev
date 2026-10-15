/**
 * `bun run dev`: builds, serves dist/ on http://localhost:4321 and rebuilds when
 * src/, site.config.json, a local docs source, the benchmark data or a screenshot
 * changes. The release is looked up once per session. Changes to the build scripts
 * need a restart.
 */
import { existsSync, statSync, watch } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { build, DIST, ROOT, SRC, type Release } from "./build.ts";

const PORT = 4321;
let release: Release | undefined;
let building = false;
let queued = false;

async function rebuild(reason: string) {
  if (building) {
    queued = true;
    return;
  }
  building = true;
  console.log(`\n[dev] building (${reason})`);
  try {
    const result = await build({ release });
    release ??= result.release;
    console.log(result.ok ? "[dev] ok" : "[dev] build finished with errors (see above)");
  } catch (e) {
    console.error(`[dev] build failed: ${e instanceof Error ? e.message : e}`);
  } finally {
    building = false;
    if (queued) {
      queued = false;
      void rebuild("queued change");
    }
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;
function schedule(reason: string) {
  clearTimeout(timer);
  timer = setTimeout(() => void rebuild(reason), 150);
}

await rebuild("start");

watch(SRC, { recursive: true }, (_event, file) => schedule(`src/${file ?? ""}`));
watch(path.join(ROOT, "site.config.json"), () => schedule("site.config.json"));

// Local sources (docs, benchmark data, screenshots), when the sibling checkout is used.
const config = JSON.parse(await readFile(path.join(ROOT, "site.config.json"), "utf8"));
const sibling = path.resolve(ROOT, config.localSource);
if (existsSync(sibling) && process.env.DOCS_SOURCE !== "remote") {
  const sources = new Set<string>([
    ...config.docs.map((d: { source: string }) => path.resolve(sibling, d.source)),
    path.resolve(sibling, config.benchmarks),
    path.resolve(sibling, config.screenshot.source, `${config.screenshot.light}.png`),
    path.resolve(sibling, config.screenshot.source, `${config.screenshot.dark}.png`),
  ]);
  for (const dir of new Set([...sources].map((s) => path.dirname(s)))) {
    watch(dir, (_event, file) => {
      if (file && sources.has(path.resolve(dir, file.toString()))) schedule(`docs source ${file}`);
    });
  }
}

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
};

Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  async fetch(req) {
    const url = new URL(req.url);
    let rel: string;
    try {
      rel = decodeURIComponent(url.pathname);
    } catch {
      return new Response("Bad request", { status: 400 });
    }
    const file = path.resolve(DIST, `.${rel}`);
    if (file !== DIST && !file.startsWith(DIST + path.sep)) return new Response("Forbidden", { status: 403 });

    let target = file;
    if (existsSync(target) && statSync(target).isDirectory()) {
      // Like GitHub Pages: /docs/install redirects to /docs/install/.
      if (!url.pathname.endsWith("/")) return Response.redirect(`${url.pathname}/${url.search}`, 301);
      target = path.join(target, "index.html");
    }
    if (!existsSync(target)) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });
    const type = TYPES[path.extname(target).toLowerCase()] ?? "application/octet-stream";
    return new Response(Bun.file(target), { headers: { "content-type": type, "cache-control": "no-store" } });
  },
});

console.log(`[dev] serving dist/ at http://localhost:${PORT}/ (127.0.0.1)`);
