import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuditData, listWeeks } from "@/lib/ontology";

export const dynamic = "force-static";
export const revalidate = false;

export async function generateStaticParams() {
  const weeks = await listWeeks();
  return weeks.map((week) => ({ week }));
}

export default async function AuditPage({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  const { week } = await params;
  const audit = await getAuditData(week);
  if (!audit) notFound();

  const e = audit.eval_summary;

  return (
    <article className="space-y-10">
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <p className="text-sm text-zinc-500">{week}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Audit Report</h1>
        <div className="mt-3 flex gap-3 text-sm">
          <Link
            href={`/weekly/${week}`}
            className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Back to digest
          </Link>
          <Link
            href={`/weekly/${week}/todo`}
            className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            待审 todo →
          </Link>
        </div>
      </header>

      {!e || (e.items_evaluated ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          本周还没有 eval 反馈。去 <Link href="/eval" className="underline">/eval</Link> 给点反馈，下期就有 audit 了。
        </div>
      ) : (
        <>
          <Section title="本周反馈核心主题">
            {e.dominant_themes && e.dominant_themes.length > 0 ? (
              <ul className="space-y-4">
                {e.dominant_themes.map((t, i) => (
                  <li
                    key={i}
                    className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-medium">{t.theme}</h3>
                      <span className="text-xs text-zinc-500">
                        {t.occurrence_count} 次
                      </span>
                    </div>
                    {t.example_quotes && t.example_quotes.length > 0 && (
                      <ul className="mt-3 space-y-2">
                        {t.example_quotes.map((q, j) => (
                          <li
                            key={j}
                            className="border-l-2 border-zinc-300 pl-3 text-sm italic text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
                          >
                            “{q}”
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">未提炼出主题。</p>
            )}
          </Section>

          {e.source_quality_signals &&
            Object.keys(e.source_quality_signals).length > 0 && (
              <Section title="Source 质量信号">
                <ul className="space-y-2">
                  {Object.entries(e.source_quality_signals).map(([src, signal]) => (
                    <li
                      key={src}
                      className="rounded border border-zinc-200 bg-white px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <code className="text-xs text-zinc-500">{src}</code>
                      <span className="ml-3 text-zinc-700 dark:text-zinc-300">
                        {signal}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

          {e.route_corrections && e.route_corrections.length > 0 && (
            <Section title="Route 校正">
              <ul className="space-y-2">
                {e.route_corrections.map((rc, i) => (
                  <li
                    key={i}
                    className="rounded border border-zinc-200 bg-white px-4 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <code className="text-xs text-zinc-500">{rc.item_id}</code>
                    <span className="ml-2">应该走</span>
                    <span className="ml-1 font-medium">{rc.should_be}</span>
                    <span className="ml-1 text-zinc-500">(原是 {rc.was})</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}

      {audit.applied_todos && audit.applied_todos.length > 0 && (
        <Section title="本周已应用的优化">
          <ul className="space-y-2 text-sm">
            {audit.applied_todos.map((t) => (
              <li
                key={t.id}
                className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950"
              >
                <span className="font-mono text-xs text-zinc-500">{t.type}</span>
                <span className="ml-2">{t.rationale}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {audit.next_week_suggestions && audit.next_week_suggestions.length > 0 && (
        <Section title="下周建议">
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {audit.next_week_suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-medium tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
