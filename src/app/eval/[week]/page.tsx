import { getJsonl } from "@/lib/github";
import { getAuditData, getMaterials, getSources, listWeeks } from "@/lib/ontology";
import { refId } from "@/lib/types";
import type { EvalLogEntry, Material, Source } from "@/lib/types";
import { EvalItem } from "../EvalItem";
import { SubmitBar } from "../SubmitBar";

function extractCurator(tags?: string[]): string | undefined {
  if (!tags) return undefined;
  for (const t of tags) {
    if (t.startsWith("via:")) return t.slice(4).trim();
  }
  return undefined;
}

function buildEvalProps(m: Material, src: Source | null | undefined) {
  type WithExtraFields = {
    lennyTake?: string;
    soWhat?: string;
    classicCallback?: { classicId: string; relation: string; note: string };
  };
  const extra = m as WithExtraFields;
  return {
    title: m.title,
    url: m.url,
    summary: m.summary,
    lenny_take: extra.lennyTake,
    so_what: extra.soWhat,
    classic_callback: extra.classicCallback,
    source: src
      ? {
          name: src.name,
          tier: src.tier,
          description: src.description,
          url: src.url,
        }
      : undefined,
    curator: extractCurator(m.tags),
    source_cron: m.briefingType,
    published_at: m.publishedAt,
    collected_at: m.collectedAt,
  };
}

export const dynamic = "force-static";
export const revalidate = false;

export async function generateStaticParams() {
  const weeks = await listWeeks();
  return weeks.map((week) => ({ week }));
}

/** Convert "YYYY-WNN" ISO week into [start, end) UTC dates. */
function isoWeekRange(week: string): [Date, Date] | null {
  const m = week.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const [, yearStr, weekStr] = m;
  const year = parseInt(yearStr, 10);
  const w = parseInt(weekStr, 10);

  // ISO week 1 is the week containing the first Thursday of the year.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1);
  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (w - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return [start, end];
}

export default async function EvalWeekPage({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  const { week } = await params;
  const [audit, materials, sources, evalLog] = await Promise.all([
    getAuditData(week),
    getMaterials(),
    getSources(),
    getJsonl<EvalLogEntry>("state/eval-log.jsonl"),
  ]);

  const sourceById = new Map(sources.map((s) => [s["@id"], s]));
  const feedbackByItem = new Map<string, string[]>();
  for (const entry of evalLog) {
    const list = feedbackByItem.get(entry.item_id) ?? [];
    list.push(entry.feedback);
    feedbackByItem.set(entry.item_id, list);
  }

  // Filter materials to those collected in this week's range.
  const range = isoWeekRange(week);
  const inWeek = range
    ? materials.filter((m) => {
        const ts = m.collectedAt ? new Date(m.collectedAt) : null;
        return ts && ts >= range[0] && ts < range[1];
      })
    : [];

  const evaluated = inWeek.filter((m) => feedbackByItem.has(m["@id"]));
  const pending = inWeek.filter((m) => !feedbackByItem.has(m["@id"]));

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm text-zinc-500">{week}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Eval · {week}</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {audit
            ? "本周已生成 weekly digest。下面是这周推送过的 Material。"
            : "本周还没有 weekly digest。"}
        </p>
        <div className="mt-3 text-sm text-zinc-500">
          {inWeek.length} 条 · 已评 {evaluated.length} · 待评 {pending.length}
        </div>
      </header>

      <SubmitBar />

      {pending.length === 0 && evaluated.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          这一周没有匹配到任何 Material。
        </div>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-medium">待评</h2>
          <ul className="space-y-3">
            {pending.map((m) => {
              const srcId = refId(m.source);
              const src = srcId ? sourceById.get(srcId) : null;
              return (
                <EvalItem
                  key={m["@id"]}
                  item_id={m["@id"]}
                  item_type="Material"
                  {...buildEvalProps(m, src)}
                />
              );
            })}
          </ul>
        </section>
      )}

      {evaluated.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-medium">已评</h2>
          <ul className="space-y-3">
            {evaluated.map((m) => {
              const srcId = refId(m.source);
              const src = srcId ? sourceById.get(srcId) : null;
              const fbList = feedbackByItem.get(m["@id"]) ?? [];
              return (
                <EvalItem
                  key={m["@id"]}
                  item_id={m["@id"]}
                  item_type="Material"
                  {...buildEvalProps(m, src)}
                  existing_feedback={fbList[fbList.length - 1]}
                />
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
