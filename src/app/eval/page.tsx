import Link from "next/link";
import { getJsonl } from "@/lib/github";
import { getMaterials, getSources, listWeeks } from "@/lib/ontology";
import { buildEvalItems } from "@/lib/evalView";
import type { EvalLogEntry, PushedMessage } from "@/lib/types";
import { EvalItem } from "./EvalItem";
import { SubmitBar } from "./SubmitBar";

export const dynamic = "force-dynamic";

const RECENT_DAYS = 14;

export default async function EvalIndexPage() {
  const [materials, sources, pushedMessages, evalLog, weeks] = await Promise.all([
    getMaterials(),
    getSources(),
    getJsonl<PushedMessage>("state/pushed-messages.jsonl"),
    getJsonl<EvalLogEntry>("state/eval-log.jsonl"),
    listWeeks(),
  ]);

  const feedbackByItem = new Map<string, string[]>();
  for (const entry of evalLog) {
    const list = feedbackByItem.get(entry.item_id) ?? [];
    list.push(entry.feedback);
    feedbackByItem.set(entry.item_id, list);
  }

  const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
  const recent = buildEvalItems(materials, pushedMessages, sources)
    .filter((it) => it.ts !== null && new Date(it.ts) >= cutoff)
    .sort((a, b) => ((a.ts ?? "") > (b.ts ?? "") ? -1 : 1));

  const evaluated = recent.filter((it) => feedbackByItem.has(it.item_id));
  const pending = recent.filter((it) => !feedbackByItem.has(it.item_id));

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
          <h2 className="mb-4 text-lg font-medium">已评 ({evaluated.length})</h2>
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
