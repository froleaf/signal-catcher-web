import Link from "next/link";
import { getJsonl } from "@/lib/github";
import { getMaterials, getSources, listWeeks } from "@/lib/ontology";
import { refId } from "@/lib/types";
import type { EvalLogEntry, Material, Source } from "@/lib/types";
import { EvalItem } from "./EvalItem";
import { SubmitBar } from "./SubmitBar";

export const dynamic = "force-static";
export const revalidate = false;

const RECENT_DAYS = 14;

/** Pick `via:{name}` curator out of Material.tags. */
function extractCurator(tags?: string[]): string | undefined {
  if (!tags) return undefined;
  for (const t of tags) {
    if (t.startsWith("via:")) return t.slice(4).trim();
  }
  return undefined;
}

/** Pull all the props EvalItem cares about from a Material + Source. */
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

export default async function EvalIndexPage() {
  const [materials, sources, evalLog, weeks] = await Promise.all([
    getMaterials(),
    getSources(),
    getJsonl<EvalLogEntry>("state/eval-log.jsonl"),
    listWeeks(),
  ]);

  const sourceById = new Map(sources.map((s) => [s["@id"], s]));
  const feedbackByItem = new Map<string, string[]>();
  for (const entry of evalLog) {
    const list = feedbackByItem.get(entry.item_id) ?? [];
    list.push(entry.feedback);
    feedbackByItem.set(entry.item_id, list);
  }

  const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
  const recent = materials
    .filter((m) => {
      const ts = m.collectedAt ? new Date(m.collectedAt) : null;
      return ts !== null && ts >= cutoff;
    })
    .sort((a, b) => (a.collectedAt > b.collectedAt ? -1 : 1));

  const evaluated = recent.filter((m) => feedbackByItem.has(m["@id"]));
  const pending = recent.filter((m) => !feedbackByItem.has(m["@id"]));

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Eval 工作台</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          对每条 Material 给反馈。第一版 free text，等数据攒够了再反推维度。
        </p>
        <div className="mt-3 flex gap-3 text-sm text-zinc-500">
          <span>近 {RECENT_DAYS} 天 · {recent.length} 条</span>
          <span>· 已评 {evaluated.length}</span>
          <span>· 待评 {pending.length}</span>
        </div>
        {weeks.length > 0 && (
          <div className="mt-3 flex gap-2 text-sm">
            <span className="text-zinc-500">按周浏览:</span>
            {weeks.slice(0, 6).map((w) => (
              <Link
                key={w}
                href={`/eval/${w}`}
                className="text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                {w}
              </Link>
            ))}
          </div>
        )}
      </header>

      <SubmitBar />

      {pending.length === 0 && evaluated.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          近 {RECENT_DAYS} 天还没有 Material 被推送或收录。新的早晚报跑过后这里会有内容。
        </div>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-medium">待评 ({pending.length})</h2>
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
          <h2 className="mb-4 text-lg font-medium">已评 ({evaluated.length})</h2>
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
