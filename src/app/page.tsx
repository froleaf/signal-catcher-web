import Link from "next/link";
import { listWeeks, getAuditData } from "@/lib/ontology";

export const dynamic = "force-static";
export const revalidate = false;

export default async function Home() {
  const weeks = await listWeeks();
  const latestWeek = weeks[0] ?? null;
  const latestAudit = latestWeek ? await getAuditData(latestWeek) : null;

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">signal-catcher</h1>
        <p className="mt-3 max-w-2xl text-zinc-600 dark:text-zinc-400">
          每周一次，把散落的信息收敛成可复盘的信号。Weekly digest · eval 工作台 · 实体 wiki。
        </p>
      </section>

      {latestAudit && latestWeek ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-medium">最新一期 · {latestWeek}</h2>
            <Link
              href={`/weekly/${latestWeek}`}
              className="text-sm text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              进入完整版 →
            </Link>
          </div>
          {latestAudit.highlights?.through_line && (
            <p className="mt-4 leading-7 text-zinc-700 dark:text-zinc-300">
              {latestAudit.highlights.through_line}
            </p>
          )}
        </section>
      ) : (
        <section className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          还没有 weekly digest。第一份会在下个周日生成。
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <EntryCard
          href="/weekly"
          title="Weekly"
          desc="周报列表 · 精选长文 · 信号 · 论文 · 实体活跃度"
        />
        <EntryCard
          href="/eval"
          title="Eval"
          desc="对每条 Material 给反馈。free text，反推维度。"
        />
        <EntryCard
          href="/wiki"
          title="Wiki"
          desc="Company / Person / Product 跨 Material 聚合"
        />
      </section>
    </div>
  );
}

function EntryCard({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-zinc-200 bg-white p-5 transition hover:border-zinc-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{desc}</p>
    </Link>
  );
}
