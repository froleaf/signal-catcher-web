export const dynamic = "force-static";
export const revalidate = false;

export default function WikiIndexPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Wiki</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Company / Person / Product 跨 Material 聚合视图。
      </p>
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
        即将上线（P0-10）。
      </div>
    </div>
  );
}
