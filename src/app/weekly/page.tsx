import Link from "next/link";
import { getAuditData, listWeeks } from "@/lib/ontology";

export const dynamic = "force-static";
export const revalidate = false;

export default async function WeeklyListPage() {
  const weeks = await listWeeks();
  const audits = await Promise.all(
    weeks.map(async (w) => ({ week: w, audit: await getAuditData(w) }))
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Weekly Digest</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          每周一次，编辑视角的精选与诊断。
        </p>
      </header>

      {weeks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          还没有任何周报。第一份会在下个周日由 weekly-digest cron 生成。
        </div>
      ) : (
        <ul className="space-y-3">
          {audits.map(({ week, audit }) => (
            <li key={week}>
              <Link
                href={`/weekly/${week}`}
                className="block rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-zinc-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
              >
                <div className="flex items-baseline justify-between">
                  <h2 className="font-medium">{week}</h2>
                  {audit?.generated_at && (
                    <time className="text-xs text-zinc-500 dark:text-zinc-500">
                      {new Date(audit.generated_at).toLocaleDateString("zh-CN")}
                    </time>
                  )}
                </div>
                {audit?.highlights?.through_line && (
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {audit.highlights.through_line}
                  </p>
                )}
                <div className="mt-3 flex gap-3 text-xs text-zinc-500 dark:text-zinc-500">
                  {audit?.highlights?.top_materials && (
                    <span>{audit.highlights.top_materials.length} 精选</span>
                  )}
                  {audit?.highlights?.new_signals && (
                    <span>{audit.highlights.new_signals.length} signals</span>
                  )}
                  {audit?.highlights?.papers && (
                    <span>{audit.highlights.papers.length} papers</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
