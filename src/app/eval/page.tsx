export const dynamic = "force-static";
export const revalidate = false;

export default function EvalIndexPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Eval 工作台</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        对每条 Material / Signal / Reflection 给反馈。第一版 free text，反推维度。
      </p>
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
        即将上线（P0-8）。等待 self-optimize cron 写入数据 + API endpoint 实现。
      </div>
    </div>
  );
}
