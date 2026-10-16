/**
 * The charts on /models/: five horizontal bar charts written as inline SVG from
 * docs/eval/benchmarks.json in the app repository. No charting library, no script.
 *
 * Every chart is a `<figure>` with the SVG, a caption naming the source, and a
 * `<details>` table with the same numbers, so the data reads without the graphic.
 *
 * The SVG has no viewBox on purpose: bar lengths and grid lines are percentages of
 * the SVG's width, so the chart fills whatever column it is in, while text keeps
 * its CSS size (13 px) at 360 px as well as at 1080 px. A viewBox would scale the
 * text down with the width and make a phone-width chart unreadable.
 */

// ---------------------------------------------------------------- data

export type DiarRow = {
  system: string;
  short?: string;
  value: number;
  licence: string;
  local: boolean | string;
  used: boolean;
};

export type AsrRow = {
  model: string;
  short?: string;
  value: number | null;
  approximate?: boolean;
  timestamps: boolean | string;
  runs: boolean;
  streaming: boolean;
  note?: string;
};

export type Session = {
  name: string;
  group: string;
  minutes: number;
  speakers: number;
  en: number;
  n35: number;
};

export type VramRow = { scenario: string; short?: string; gb: number; note?: string };

/** One language of the FLEURS smoke test: Diarist's runtime against the model card. */
export type LangRow = {
  language: string;
  code: string;
  tag: string;
  unit: string;
  ref_units: number;
  given: number;
  auto: number;
  card_given: number;
  card_auto: number;
};

export type Benchmarks = {
  updated: string;
  machine: string;
  diarization_published: { from: string; source: string; url: string | null; metric: string; rows: DiarRow[] };
  asr_published: { from: string; source: string; url: string | null; metric: string; rows: AsrRow[] };
  asr_measured: {
    from: string;
    source: string;
    metric: string;
    series: { en: string; n35: string };
    sessions: Session[];
    note?: string;
  };
  vram_measured: { from: string; source: string; metric: string; rows: VramRow[] };
  speed_measured: { from: string; import_realtime_factor: number; live_first_text_s: number };
  languages_measured: {
    from: string;
    source: string;
    metric: string;
    model: string;
    series: { given: string; auto: string; card_given: string; card_auto: string };
    rows: LangRow[];
    en_model_english?: { given: number; note?: string };
    note?: string;
  };
};

class SchemaError extends Error {}

/** Parses and validates the data file; throws a message naming the bad field. */
export function parseBenchmarks(text: string): Benchmarks {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new SchemaError(`benchmarks.json is not valid JSON: ${e instanceof Error ? e.message : e}`);
  }
  const at = (path: string) => `benchmarks.json: ${path}`;
  const obj = (v: unknown, path: string): Record<string, unknown> => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) throw new SchemaError(`${at(path)} must be an object`);
    return v as Record<string, unknown>;
  };
  const str = (v: unknown, path: string): string => {
    if (typeof v !== "string" || !v.trim()) throw new SchemaError(`${at(path)} must be a non-empty string`);
    return v;
  };
  const optStr = (v: unknown, path: string): string | undefined => (v === undefined ? undefined : str(v, path));
  const num = (v: unknown, path: string): number => {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new SchemaError(`${at(path)} must be a non-negative number`);
    return v;
  };
  const bool = (v: unknown, path: string): boolean => {
    if (typeof v !== "boolean") throw new SchemaError(`${at(path)} must be true or false`);
    return v;
  };
  const boolOrStr = (v: unknown, path: string): boolean | string => (typeof v === "boolean" ? v : str(v, path));
  const arr = (v: unknown, path: string): unknown[] => {
    if (!Array.isArray(v) || v.length === 0) throw new SchemaError(`${at(path)} must be a non-empty array`);
    return v;
  };
  const block = (root: Record<string, unknown>, key: string) => {
    const b = obj(root[key], key);
    str(b.from, `${key}.from`);
    return b;
  };

  const root = obj(data, "(root)");
  const updated = str(root.updated, "updated");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(updated)) throw new SchemaError(`${at("updated")} must be a YYYY-MM-DD date`);

  const dp = block(root, "diarization_published");
  const diarRows = arr(dp.rows, "diarization_published.rows").map((r, i) => {
    const p = `diarization_published.rows[${i}]`;
    const o = obj(r, p);
    return {
      system: str(o.system, `${p}.system`),
      short: optStr(o.short, `${p}.short`),
      value: num(o.value, `${p}.value`),
      licence: str(o.licence, `${p}.licence`),
      local: boolOrStr(o.local, `${p}.local`),
      used: bool(o.used, `${p}.used`),
    };
  });
  if (diarRows.filter((r) => r.used).length !== 1) throw new SchemaError(`${at("diarization_published.rows")}: exactly one row must have "used": true`);

  const ap = block(root, "asr_published");
  const asrRows = arr(ap.rows, "asr_published.rows").map((r, i) => {
    const p = `asr_published.rows[${i}]`;
    const o = obj(r, p);
    return {
      model: str(o.model, `${p}.model`),
      short: optStr(o.short, `${p}.short`),
      value: o.value === null ? null : num(o.value, `${p}.value`),
      approximate: o.approximate === undefined ? undefined : bool(o.approximate, `${p}.approximate`),
      timestamps: boolOrStr(o.timestamps, `${p}.timestamps`),
      runs: bool(o.runs, `${p}.runs`),
      streaming: bool(o.streaming, `${p}.streaming`),
      note: optStr(o.note, `${p}.note`),
    };
  });

  const am = block(root, "asr_measured");
  const series = obj(am.series, "asr_measured.series");
  const sessions = arr(am.sessions, "asr_measured.sessions").map((r, i) => {
    const p = `asr_measured.sessions[${i}]`;
    const o = obj(r, p);
    return {
      name: str(o.name, `${p}.name`),
      group: str(o.group, `${p}.group`),
      minutes: num(o.minutes, `${p}.minutes`),
      speakers: num(o.speakers, `${p}.speakers`),
      en: num(o.en, `${p}.en`),
      n35: num(o.n35, `${p}.n35`),
    };
  });

  const vm = block(root, "vram_measured");
  const vramRows = arr(vm.rows, "vram_measured.rows").map((r, i) => {
    const p = `vram_measured.rows[${i}]`;
    const o = obj(r, p);
    return {
      scenario: str(o.scenario, `${p}.scenario`),
      short: optStr(o.short, `${p}.short`),
      gb: num(o.gb, `${p}.gb`),
      note: optStr(o.note, `${p}.note`),
    };
  });

  const sp = block(root, "speed_measured");

  const lm = block(root, "languages_measured");
  const lmSeries = obj(lm.series, "languages_measured.series");
  const langRows = arr(lm.rows, "languages_measured.rows").map((r, i) => {
    const p = `languages_measured.rows[${i}]`;
    const o = obj(r, p);
    return {
      language: str(o.language, `${p}.language`),
      code: str(o.code, `${p}.code`),
      tag: str(o.tag, `${p}.tag`),
      unit: str(o.unit, `${p}.unit`),
      ref_units: num(o.ref_units, `${p}.ref_units`),
      given: num(o.given, `${p}.given`),
      auto: num(o.auto, `${p}.auto`),
      card_given: num(o.card_given, `${p}.card_given`),
      card_auto: num(o.card_auto, `${p}.card_auto`),
    };
  });
  let enModel: { given: number; note?: string } | undefined;
  if (lm.en_model_english !== undefined) {
    const e = obj(lm.en_model_english, "languages_measured.en_model_english");
    enModel = { given: num(e.given, "languages_measured.en_model_english.given"), note: optStr(e.note, "languages_measured.en_model_english.note") };
  }

  return {
    updated,
    machine: str(root.machine, "machine"),
    diarization_published: {
      from: dp.from as string,
      source: str(dp.source, "diarization_published.source"),
      url: dp.url === null || dp.url === undefined ? null : str(dp.url, "diarization_published.url"),
      metric: str(dp.metric, "diarization_published.metric"),
      rows: diarRows,
    },
    asr_published: {
      from: ap.from as string,
      source: str(ap.source, "asr_published.source"),
      url: ap.url === null || ap.url === undefined ? null : str(ap.url, "asr_published.url"),
      metric: str(ap.metric, "asr_published.metric"),
      rows: asrRows,
    },
    asr_measured: {
      from: am.from as string,
      source: str(am.source, "asr_measured.source"),
      metric: str(am.metric, "asr_measured.metric"),
      series: { en: str(series.en, "asr_measured.series.en"), n35: str(series.n35, "asr_measured.series.n35") },
      sessions,
      note: optStr(am.note, "asr_measured.note"),
    },
    vram_measured: {
      from: vm.from as string,
      source: str(vm.source, "vram_measured.source"),
      metric: str(vm.metric, "vram_measured.metric"),
      rows: vramRows,
    },
    speed_measured: {
      from: sp.from as string,
      import_realtime_factor: num(sp.import_realtime_factor, "speed_measured.import_realtime_factor"),
      live_first_text_s: num(sp.live_first_text_s, "speed_measured.live_first_text_s"),
    },
    languages_measured: {
      from: lm.from as string,
      source: str(lm.source, "languages_measured.source"),
      metric: str(lm.metric, "languages_measured.metric"),
      model: str(lm.model, "languages_measured.model"),
      series: {
        given: str(lmSeries.given, "languages_measured.series.given"),
        auto: str(lmSeries.auto, "languages_measured.series.auto"),
        card_given: str(lmSeries.card_given, "languages_measured.series.card_given"),
        card_auto: str(lmSeries.card_auto, "languages_measured.series.card_auto"),
      },
      rows: langRows,
      en_model_english: enModel,
      note: optStr(lm.note, "languages_measured.note"),
    },
  };
}

// ---------------------------------------------------------------- SVG writer

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Prints a value as its source wrote it: 5.63 stays 5.63, 6.4 stays 6.4, and a whole
 * number in a series written with decimals (12.0 among 5.1 and 7.8) keeps one decimal.
 */
const fixed = (n: number, decimals: number) => (Number.isInteger(n) && decimals >= 1 ? n.toFixed(1) : String(n));

/** The most decimals any value in a series was written with (6.4 and 6.93 give 2). */
function decimalsOf(values: number[]): number {
  return Math.max(0, ...values.map((v) => (String(v).split(".")[1] ?? "").length));
}

/** A bar, optionally with a mark: a short vertical line at a second value on the same scale. */
type Bar = { value: number | null; text: string; series: 0 | 1; faded?: boolean; empty?: string; marker?: number };
/**
 * One row: a bold label (optionally with a muted note after it, and a short variant for
 * narrow screens), up to two muted lines of meta text, then one or two bars. Meta lines
 * are kept under about 55 characters so they fit a 328 px chart at 12 px.
 */
type Row = { label: string; short?: string; labelNote?: string; meta?: string; note?: string; bars: Bar[] };
/** A legend entry: a swatch in a series colour, or the mark glyph. */
type LegendItem = { label: string; kind: "s0" | "s1" | "mark" };
type ChartSpec = {
  id: string;
  title: string;
  desc: string;
  axis: string;
  axisMax: number;
  ticks: number[];
  rows: Row[];
  legend?: LegendItem[];
};

// Layout, in CSS pixels. The bar scale ends at BAR_MAX percent of the width so the
// value printed after the longest bar still fits at 328 px (360 minus the gutters).
const BAR_MAX = 84;
const PAD_TOP = 8;
const LABEL_H = 17;
const META_H = 16;
const BAR_H = 14;
const BAR_GAP = 4;
const ROW_GAP = 12;
const LEGEND_H = 24;
const TICK_H = 18;
const AXIS_H = 20;

const pct = (value: number, max: number) => `${((Math.min(value, max) / max) * BAR_MAX).toFixed(2)}%`;

/**
 * Lays the legend out left to right at an estimated 7.2 px per character, wrapping to a
 * new line when an entry would run past 328 px (the chart's width on a 360 px phone), so
 * a three-entry legend never overflows the SVG. Returns the entries' positions and the
 * number of lines.
 */
function legendLayout(items: LegendItem[]): { placed: { item: LegendItem; x: number; line: number }[]; lines: number } {
  const MAX_W = 328;
  const SWATCH = 14;
  const GAP = 18;
  const placed: { item: LegendItem; x: number; line: number }[] = [];
  let x = 0;
  let line = 0;
  for (const item of items) {
    const w = SWATCH + 6 + Math.round(item.label.length * 7.2);
    if (x > 0 && x + w > MAX_W) {
      x = 0;
      line++;
    }
    placed.push({ item, x, line });
    x += w + GAP;
  }
  return { placed, lines: line + 1 };
}

function barChart(spec: ChartSpec): string {
  const out: string[] = [];
  const legend = spec.legend ? legendLayout(spec.legend) : null;
  const rowsTop = PAD_TOP + (legend ? LEGEND_H * legend.lines : 0);
  let y = rowsTop;
  const metaLines = (r: Row) => (r.meta ? 1 : 0) + (r.note ? 1 : 0);
  const rowHeights = spec.rows.map(
    (r) => LABEL_H + metaLines(r) * META_H + r.bars.length * BAR_H + (r.bars.length - 1) * BAR_GAP + ROW_GAP,
  );
  const rowsBottom = rowsTop + rowHeights.reduce((a, b) => a + b, 0);
  const height = rowsBottom + TICK_H + AXIS_H;

  out.push(
    `<svg class="chart" width="100%" height="${height}" role="img" aria-labelledby="${spec.id}-title ${spec.id}-desc" xmlns="http://www.w3.org/2000/svg">`,
    `<title id="${spec.id}-title">${esc(spec.title)}</title>`,
    `<desc id="${spec.id}-desc">${esc(spec.desc)}</desc>`,
  );

  // Grid lines behind the bars, one per tick.
  for (const t of spec.ticks) {
    const x = pct(t, spec.axisMax);
    out.push(`<line class="c-grid" x1="${x}" x2="${x}" y1="${rowsTop - 4}" y2="${rowsBottom - ROW_GAP + 6}"></line>`);
  }

  if (legend) {
    for (const { item, x, line } of legend.placed) {
      const top = PAD_TOP + line * LEGEND_H;
      if (item.kind === "mark") {
        const at = `x1="${x + 7}" x2="${x + 7}" y1="${top}" y2="${top + 14}"`;
        out.push(`<line class="c-mark-halo" ${at}></line>`, `<line class="c-mark" ${at}></line>`);
      } else {
        out.push(`<rect class="c-bar ${item.kind}" x="${x}" y="${top + 2}" width="14" height="10" rx="2"></rect>`);
      }
      out.push(`<text class="c-legend" x="${x + 20}" y="${top + 11}">${esc(item.label)}</text>`);
    }
  }

  spec.rows.forEach((row, i) => {
    const labelY = y + 13;
    const note = row.labelNote ? `<tspan class="c-note"> · ${esc(row.labelNote)}</tspan>` : "";
    if (row.short) {
      out.push(
        `<text class="c-label c-long" x="0" y="${labelY}">${esc(row.label)}${note}</text>`,
        `<text class="c-label c-short" x="0" y="${labelY}">${esc(row.short)}${note}</text>`,
      );
    } else {
      out.push(`<text class="c-label" x="0" y="${labelY}">${esc(row.label)}${note}</text>`);
    }
    let barY = y + LABEL_H;
    for (const line of [row.meta, row.note]) {
      if (!line) continue;
      out.push(`<text class="c-meta" x="0" y="${barY + 12}">${esc(line)}</text>`);
      barY += META_H;
    }
    for (const bar of row.bars) {
      if (bar.value === null) {
        out.push(`<text class="c-empty" x="0" y="${barY + 11}">${esc(bar.empty ?? "no published number")}</text>`);
      } else {
        const w = pct(bar.value, spec.axisMax);
        const cls = `c-bar s${bar.series}${bar.faded ? " faded" : ""}`;
        out.push(
          `<rect class="${cls}" x="0" y="${barY}" width="${w}" height="${BAR_H}" rx="2"></rect>`,
          `<text class="c-value" x="${w}" dx="7" y="${barY + 11}">${esc(bar.text)}</text>`,
        );
        if (bar.marker !== undefined) {
          const mx = pct(bar.marker, spec.axisMax);
          const at = `x1="${mx}" x2="${mx}" y1="${barY - 2}" y2="${barY + BAR_H + 2}"`;
          out.push(`<line class="c-mark-halo" ${at}></line>`, `<line class="c-mark" ${at}></line>`);
        }
      }
      barY += BAR_H + BAR_GAP;
    }
    y += rowHeights[i];
  });

  // Ticks and the axis label.
  const tickY = rowsBottom - ROW_GAP + 20;
  spec.ticks.forEach((t, i) => {
    const anchor = i === 0 ? "start" : "middle";
    out.push(`<text class="c-tick" x="${pct(t, spec.axisMax)}" y="${tickY}" text-anchor="${anchor}">${t}</text>`);
  });
  out.push(`<text class="c-axis" x="0" y="${tickY + AXIS_H}">${esc(spec.axis)}</text>`, "</svg>");
  return out.join("\n");
}

function figure(id: string, chart: string, caption: string, table: string): string {
  return [
    `<figure class="chart-figure" id="${id}">`,
    chart,
    `<figcaption>${caption}</figcaption>`,
    `<details class="chart-data">`,
    `<summary>Show as a table</summary>`,
    `<div class="table-wrap" tabindex="0" role="region" aria-label="Table">`,
    table,
    `</div>`,
    `</details>`,
    `</figure>`,
  ].join("\n");
}

const yesNo = (v: boolean | string) => (v === true ? "yes" : v === false ? "no" : esc(v));

const sourceLink = (label: string, url: string | null) => (url ? `<a href="${esc(url)}">${esc(label)}</a>` : esc(label));

/** Each chart's title and the numbers behind it, for the build log and the report. */
export type ChartSummary = { title: string; from: string; values: string };

// ---------------------------------------------------------------- the five charts

export function diarizationChart(b: Benchmarks, blobBase: string): { html: string; summary: ChartSummary } {
  const d = b.diarization_published;
  const rows = [...d.rows].sort((a, z) => a.value - z.value);
  const dec = decimalsOf(rows.map((r) => r.value));
  const axisMax = Math.ceil(Math.max(...rows.map((r) => r.value)) / 5) * 5;
  const ticks = [];
  for (let t = 0; t <= axisMax; t += 10) ticks.push(t);
  const title = "Diarization error rate on VoiceArena Diarization-Bench v1";
  const chart = barChart({
    id: "c-diar",
    title,
    desc: `Horizontal bars, lowest first: ${rows.map((r) => `${r.system} ${fixed(r.value, dec)}`).join("; ")}. Nemotron 3 Diarization is the system Diarist uses.`,
    axis: "DER, percent (lower is better)",
    axisMax,
    ticks,
    rows: rows.map((r) => ({
      label: r.system,
      short: r.short,
      labelNote: r.used ? "used by Diarist" : undefined,
      meta: `${r.licence} · ${r.local === true ? "runs locally without a token" : r.local === false ? "not local" : `local: ${r.local}`}`,
      bars: [{ value: r.value, text: fixed(r.value, dec), series: 0, faded: !r.used }],
    })),
  });
  const caption =
    `${sourceLink(d.source, d.url)}, as cited in the <a href="${esc(blobBase)}docs/04-model-guide.md">model guide</a> on ${esc(b.updated)}. ` +
    `DER is the share of audio time assigned to the wrong speaker, missed or falsely detected; collar 0 means no leeway around speaker changes, and overlapping speech is scored. Published numbers, not ours.`;
  const table = [
    "<table>",
    "<thead><tr><th scope=\"col\">System</th><th scope=\"col\">DER</th><th scope=\"col\">Licence</th><th scope=\"col\">Runs locally without a token</th></tr></thead>",
    "<tbody>",
    ...rows.map(
      (r) =>
        `<tr><th scope="row">${esc(r.system)}${r.used ? " <span class=\"used\">used by Diarist</span>" : ""}</th><td>${fixed(r.value, dec)}</td><td>${esc(r.licence)}</td><td>${yesNo(r.local)}</td></tr>`,
    ),
    "</tbody></table>",
  ].join("\n");
  return {
    html: figure("chart-diarization", chart, caption, table),
    summary: { title, from: d.from, values: rows.map((r) => `${r.system} ${r.value}`).join("; ") },
  };
}

export function asrChart(b: Benchmarks, blobBase: string): { html: string; summary: ChartSummary } {
  const a = b.asr_published;
  const withValue = a.rows.filter((r) => r.value !== null) as (AsrRow & { value: number })[];
  const rows = [...withValue].sort((x, z) => x.value - z.value).concat(a.rows.filter((r) => r.value === null));
  const dec = decimalsOf(withValue.map((r) => r.value));
  const axisMax = Math.ceil(Math.max(...withValue.map((r) => r.value)) / 2) * 2;
  const ticks = [];
  for (let t = 0; t <= axisMax; t += 2) ticks.push(t);
  const flags = (r: AsrRow) =>
    [
      r.timestamps === true ? "word timestamps" : r.timestamps === false ? "no word timestamps" : `word timestamps: ${r.timestamps}`,
      r.runs ? "runs in Diarist" : "not in Diarist",
      r.streaming ? "streaming" : null,
    ]
      .filter(Boolean)
      .join(" · ");
  const noteOf = (r: AsrRow) => [r.approximate ? "an approximate figure" : null, r.note ?? null].filter(Boolean).join("; ") || undefined;
  const title = "Average word error rate on the Open ASR leaderboard";
  const chart = barChart({
    id: "c-asr",
    title,
    desc: `Horizontal bars, lowest first: ${withValue.map((r) => `${r.model} ${fixed(r.value, dec)}${r.approximate ? " (about)" : ""}`).join("; ")}. ${a.rows
      .filter((r) => r.value === null)
      .map((r) => `${r.model}: ${r.note ?? "no published number"}`)
      .join("; ")}.`,
    axis: "Average WER, percent (lower is better)",
    axisMax,
    ticks,
    rows: rows.map((r) => ({
      label: r.model,
      short: r.short,
      meta: flags(r),
      note: r.value === null ? undefined : noteOf(r),
      bars: [
        r.value === null
          ? { value: null, text: "", series: 0, empty: r.note ?? "no published number" }
          : { value: r.value, text: fixed(r.value, dec), series: 0, faded: !r.runs },
      ],
    })),
  });
  const caption =
    `${sourceLink(a.source, a.url)}, as cited in the <a href="${esc(blobBase)}docs/04-model-guide.md">model guide</a> on ${esc(b.updated)}. ` +
    `Average WER over the leaderboard's English test sets; lower is better. Published numbers, not ours. Bars for models Diarist cannot run are drawn lighter.`;
  const table = [
    "<table>",
    "<thead><tr><th scope=\"col\">Model</th><th scope=\"col\">Average WER</th><th scope=\"col\">Word timestamps</th><th scope=\"col\">Runs in Diarist</th><th scope=\"col\">Streaming</th><th scope=\"col\">Note</th></tr></thead>",
    "<tbody>",
    ...rows.map(
      (r) =>
        `<tr><th scope="row">${esc(r.model)}</th><td>${r.value === null ? "not listed" : `${r.approximate ? "about " : ""}${fixed(r.value, dec)}`}</td><td>${yesNo(r.timestamps)}</td><td>${yesNo(r.runs)}</td><td>${yesNo(r.streaming)}</td><td>${esc(r.note ?? "")}</td></tr>`,
    ),
    "</tbody></table>",
  ].join("\n");
  return {
    html: figure("chart-asr", chart, caption, table),
    summary: {
      title,
      from: a.from,
      values: a.rows.map((r) => `${r.model} ${r.value === null ? "no number" : r.value}`).join("; "),
    },
  };
}

export function measuredChart(b: Benchmarks, blobBase: string): { html: string; summary: ChartSummary } {
  const m = b.asr_measured;
  const all = m.sessions.flatMap((s) => [s.en, s.n35]);
  const dec = decimalsOf(all);
  const axisMax = Math.ceil(Math.max(...all) / 5) * 5;
  const ticks = [];
  for (let t = 0; t <= axisMax; t += 5) ticks.push(t);
  const legend: LegendItem[] = [
    { label: "EN model", kind: "s0" },
    { label: "Nemotron 3.5", kind: "s1" },
  ];
  const title = "Word error rate with speaker attribution (cpWER) per evaluation session, EN model against Nemotron 3.5";
  const chart = barChart({
    id: "c-measured",
    title,
    desc: `Pairs of horizontal bars per session: ${m.sessions.map((s) => `${s.name} EN ${fixed(s.en, dec)}, Nemotron 3.5 ${fixed(s.n35, dec)}`).join("; ")}.`,
    axis: "cpWER, percent (lower is better)",
    axisMax,
    ticks,
    legend,
    rows: m.sessions.map((s) => ({
      label: s.name,
      labelNote: `${s.minutes} min, ${s.speakers} speaker${s.speakers === 1 ? "" : "s"}`,
      meta: s.group,
      bars: [
        { value: s.en, text: fixed(s.en, dec), series: 0 },
        { value: s.n35, text: fixed(s.n35, dec), series: 1 },
      ],
    })),
  });
  const caption =
    `Measured on an RTX 3080 10 GB, ${esc(b.updated)}, with the evaluation harness in the repository (<a href="${esc(blobBase)}docs/eval/">docs/eval</a>). ` +
    `cpWER is the word error rate after matching each speaker's words to the reference speaker, so a word on the wrong speaker counts as an error. ` +
    (m.note ? esc(m.note) : "");
  const table = [
    "<table>",
    `<thead><tr><th scope="col">Session</th><th scope="col">Group</th><th scope="col">Minutes</th><th scope="col">Speakers</th><th scope="col">${esc(m.series.en)}</th><th scope="col">${esc(m.series.n35)}</th></tr></thead>`,
    "<tbody>",
    ...m.sessions.map(
      (s) =>
        `<tr><th scope="row">${esc(s.name)}</th><td>${esc(s.group)}</td><td>${s.minutes}</td><td>${s.speakers}</td><td>${fixed(s.en, dec)}</td><td>${fixed(s.n35, dec)}</td></tr>`,
    ),
    "</tbody></table>",
  ].join("\n");
  return {
    html: figure("chart-measured", chart, caption, table),
    summary: { title, from: m.from, values: m.sessions.map((s) => `${s.name} EN ${s.en} / 3.5 ${s.n35}`).join("; ") },
  };
}

export function vramChart(b: Benchmarks, blobBase: string): { html: string; summary: ChartSummary } {
  const v = b.vram_measured;
  const rows = v.rows;
  const dec = decimalsOf(rows.map((r) => r.gb));
  const axisMax = Math.ceil(Math.max(...rows.map((r) => r.gb)));
  const ticks = [];
  for (let t = 0; t <= axisMax; t += 1) ticks.push(t);
  const title = "Peak GPU memory per scenario";
  const chart = barChart({
    id: "c-vram",
    title,
    desc: `Horizontal bars: ${rows.map((r) => `${r.scenario} ${fixed(r.gb, dec)} GB`).join("; ")}.`,
    axis: "Peak GPU memory, GB (lower is better)",
    axisMax,
    ticks,
    rows: rows.map((r) => ({
      label: r.scenario,
      short: r.short,
      meta: r.note,
      bars: [{ value: r.gb, text: `${fixed(r.gb, dec)} GB`, series: 0 }],
    })),
  });
  const caption = `${esc(v.source)}, ${esc(b.updated)}; from the <a href="${esc(blobBase)}docs/04-model-guide.md">model guide</a>. Live recording and a file job never run at the same time: file jobs wait until the recording stops.`;
  const table = [
    "<table>",
    "<thead><tr><th scope=\"col\">Scenario</th><th scope=\"col\">Peak GPU memory</th><th scope=\"col\">Note</th></tr></thead>",
    "<tbody>",
    ...rows.map((r) => `<tr><th scope="row">${esc(r.scenario)}</th><td>${fixed(r.gb, dec)} GB</td><td>${esc(r.note ?? "")}</td></tr>`),
    "</tbody></table>",
  ].join("\n");
  return {
    html: figure("chart-vram", chart, caption, table),
    summary: { title, from: v.from, values: rows.map((r) => `${r.scenario} ${r.gb} GB`).join("; ") },
  };
}

export function languagesChart(b: Benchmarks, blobBase: string, updatedLong: string): { html: string; summary: ChartSummary } {
  const l = b.languages_measured;
  const rows = l.rows;
  const ours = rows.flatMap((r) => [r.given, r.auto]);
  const cards = rows.flatMap((r) => [r.card_given, r.card_auto]);
  const dec = decimalsOf(ours);
  const decCard = decimalsOf(cards);
  const axisMax = Math.ceil(Math.max(...ours, ...cards) / 5) * 5;
  const ticks = [];
  for (let t = 0; t <= axisMax; t += 5) ticks.push(t);
  const units = (r: LangRow) => (r.unit === "CER" ? "characters" : "words");
  const legend: LegendItem[] = [
    { label: l.series.given, kind: "s0" },
    { label: l.series.auto, kind: "s1" },
    { label: "model card", kind: "mark" },
  ];
  const title = `Word error rate per language on FLEURS slices, ${l.model}, with the language given and with automatic detection, against the model card`;
  const chart = barChart({
    id: "c-lang",
    title,
    desc:
      `Pairs of horizontal bars per language, each with a mark at the model card's number: ${rows
        .map(
          (r) =>
            `${r.language} (${r.unit}) ${l.series.given} ${fixed(r.given, dec)} against ${fixed(r.card_given, decCard)} on the card, ${l.series.auto} ${fixed(r.auto, dec)} against ${fixed(r.card_auto, decCard)}`,
        )
        .join("; ")}.`,
    axis: `${l.metric}`,
    axisMax,
    ticks,
    legend,
    rows: rows.map((r) => ({
      label: r.language,
      labelNote: r.unit === "CER" ? `${r.tag}, CER` : r.tag,
      meta: `model card: ${fixed(r.card_given, decCard)} given, ${fixed(r.card_auto, decCard)} automatic`,
      bars: [
        { value: r.given, text: fixed(r.given, dec), series: 0, marker: r.card_given },
        { value: r.auto, text: fixed(r.auto, dec), series: 1, marker: r.card_auto },
      ],
    })),
  });
  // The note names its subject before the first "; " and adds a remark after it, so the
  // subject leads the sentence with the number and the remark follows as its own sentence.
  const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  let enModel = "";
  if (l.en_model_english) {
    const value = fixed(l.en_model_english.given, dec);
    const note = l.en_model_english.note;
    if (!note) {
      enModel = ` The EN model on the same English slice: ${value}.`;
    } else {
      const cut = note.indexOf("; ");
      enModel =
        cut === -1
          ? ` ${esc(capitalise(note))}: ${value}.`
          : ` ${esc(capitalise(note.slice(0, cut)))}: ${value}. ${esc(capitalise(note.slice(cut + 2)))}.`;
    }
  }
  const caption =
    `Measured on FLEURS slices in our runtime, ${esc(updatedLong)}: ${esc(l.source)}. ` +
    `The mark on each bar is the model card's number for the same language and mode. ` +
    (l.note ? `${esc(l.note)} ` : "") +
    `From <a href="${esc(blobBase)}docs/eval/2026-10-16-fleurs.md">docs/eval/2026-10-16-fleurs.md</a> and section 6 of the <a href="${esc(blobBase)}docs/04-model-guide.md">model guide</a>.${enModel}`;
  const table = [
    "<table>",
    `<thead><tr><th scope="col">Language</th><th scope="col">Tag passed</th><th scope="col">Reference</th><th scope="col">${esc(capitalise(l.series.given))}</th><th scope="col">${esc(capitalise(l.series.auto))}</th><th scope="col">${esc(capitalise(l.series.card_given))}</th><th scope="col">${esc(capitalise(l.series.card_auto))}</th></tr></thead>`,
    "<tbody>",
    ...rows.map(
      (r) =>
        `<tr><th scope="row">${esc(r.language)}${r.unit === "CER" ? " <span class=\"used\">CER</span>" : ""}</th><td><code>${esc(r.tag)}</code></td><td>${r.ref_units.toLocaleString("en-GB")} ${units(r)}</td><td>${fixed(r.given, dec)}</td><td>${fixed(r.auto, dec)}</td><td>${fixed(r.card_given, decCard)}</td><td>${fixed(r.card_auto, decCard)}</td></tr>`,
    ),
    "</tbody></table>",
  ].join("\n");
  return {
    html: figure("chart-languages", chart, caption, table),
    summary: {
      title,
      from: l.from,
      values: rows.map((r) => `${r.language} ${r.given} / ${r.auto} (card ${r.card_given} / ${r.card_auto})`).join("; "),
    },
  };
}
