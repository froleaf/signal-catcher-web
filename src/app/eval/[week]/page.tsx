import { getJsonl } from "@/lib/github";
import { getAuditData, getMaterials, getSources } from "@/lib/ontology";
import { buildEvalItems } from "@/lib/evalView";
import type { EvalLogEntry, PushedMessage } from "@/lib/types";
import { EvalItem } from "../EvalItem";
import { SubmitBar } from "../SubmitBar";

export const dynamic = "force-dynamic";

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
  const [audit, materials, sources, pushedMessages, evalLog] = await Promise.all([
    getAuditData(week),
    getMaterials(),
    getSources(),
    getJsonl<PushedMessage>("state/pushed-messages.jsonl"),
    getJsonl<EvalLogEntry>("state/eval-log.jsonl"),
  ]);

  const feedbackByItem = new Map<string, string[]>();
  for (const entry of evalLog) {
    const list = feedbackByItem.get(entry.item_id) ?? [];
    list.push(entry.feedback);
    feedbackByItem.set(entry.item_id, list);
  }

  const range = isoWeekRange(week);
  const inWeek = range
    ? buildEvalItems(materials, pushedMessages, sources)
        .filter((it) => {
          if (!it.ts) return false;
          const ts = new Date(it.ts);
          return ts >= range[0] && ts < range[1];
        })
        .sort((a, b) => ((a.ts ?? "") > (b.ts ?? "") ? -1 : 1))
    : [];

  const evaluated = inWeek.filter((it) => feedbackByItem.has(it.item_id));
  const pending = inWeek.filter((it) => !feedbackByItem.has(it.item_id));

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
            {pending.map((it) => (
              <EvalItem
                key={it.item_id}
                item_id={it.item_id}
                item_type="Material"
                {...it.props}
              />
            ))}
          </ul>
        </section>
      )}

      {evaluated.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-medium">已评</h2>
          <ul className="space-y-3">
            {evaluated.map((it) => {
              const fbList = feedbackByItem.get(it.item_id) ?? [];
              return (
                <EvalItem
                  key={it.item_id}
                  item_id={it.item_id}
                  item_type="Material"
                  {...it.props}
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
