import Link from "next/link";
import { getJson } from "@/lib/github";
import { listWeeks } from "@/lib/ontology";
import type { AgentTodoFile } from "@/lib/types";
import { TodoItemRow } from "./TodoItemRow";

export const dynamic = "force-static";
export const revalidate = false;

export async function generateStaticParams() {
  const weeks = await listWeeks();
  return weeks.map((week) => ({ week }));
}

export default async function TodoPage({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  const { week } = await params;
  const todoFile = await getJson<AgentTodoFile>("state/agent-todo.json");
  const items = todoFile?.items ?? [];

  const pending = items.filter((t) => t.status === "pending");
  const decided = items.filter(
    (t) => t.status === "approved" || t.status === "rejected"
  );
  const applied = items.filter((t) => t.status === "applied" || t.status === "failed");

  return (
    <article className="space-y-10">
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <p className="text-sm text-zinc-500">{week}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Pending Decisions</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          self-optimize 提议的优化项。Approve 后由下一次 weekly-digest cron 应用到图谱。
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <Link
            href={`/weekly/${week}`}
            className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            ← Back to digest
          </Link>
          <Link
            href={`/weekly/${week}/audit`}
            className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            audit →
          </Link>
        </div>
        <div className="mt-3 flex gap-4 text-sm text-zinc-500">
          <span>待审 {pending.length}</span>
          <span>已决 {decided.length}</span>
          <span>已应用/失败 {applied.length}</span>
        </div>
      </header>

      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          还没有任何 agent-todo。等 self-optimize cron 跑过几天就会有了。
        </div>
      )}

      {pending.length > 0 && (
        <Section title="待审">
          <ul className="space-y-3">
            {pending.map((t) => (
              <TodoItemRow key={t.id} todo={t} />
            ))}
          </ul>
        </Section>
      )}

      {decided.length > 0 && (
        <Section title="已决（待执行）">
          <ul className="space-y-3">
            {decided.map((t) => (
              <TodoItemRow key={t.id} todo={t} />
            ))}
          </ul>
        </Section>
      )}

      {applied.length > 0 && (
        <Section title="历史">
          <ul className="space-y-3">
            {applied.map((t) => (
              <TodoItemRow key={t.id} todo={t} />
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
