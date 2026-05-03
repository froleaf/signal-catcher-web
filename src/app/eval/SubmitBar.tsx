"use client";

import { useEffect, useState } from "react";
import { clearDrafts, listDrafts, subscribe, type DraftEntry } from "@/lib/evalDrafts";

export function SubmitBar() {
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ count: number; ts: string } | null>(null);

  useEffect(() => {
    setDrafts(listDrafts());
    return subscribe(() => setDrafts(listDrafts()));
  }, []);

  async function handleSubmit() {
    if (drafts.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/eval/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: drafts.map((d) => ({
            item_id: d.item_id,
            item_type: d.item_type,
            feedback: d.feedback,
            source: d.source,
          })),
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      clearDrafts(drafts.map((d) => d.item_id));
      setSuccess({
        count: data.committed ?? drafts.length,
        ts: new Date().toLocaleTimeString("zh-CN"),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "batch submit failed");
    } finally {
      setBusy(false);
    }
  }

  if (drafts.length === 0 && !success) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
        没有待提交的草稿。在下方卡片里写反馈，会自动缓存在浏览器，凑够一批再批量提交。
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-20 -mx-2 flex flex-wrap items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm shadow-sm dark:border-amber-700 dark:bg-amber-950/50">
      <span className="font-medium text-amber-900 dark:text-amber-200">
        💾 {drafts.length} 条草稿（本地缓存）
      </span>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={drafts.length === 0 || busy}
        className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
      >
        {busy ? "提交中…" : `批量提交 ${drafts.length} 条`}
      </button>
      {success && (
        <span className="text-xs text-emerald-700 dark:text-emerald-300">
          ✓ 已提交 {success.count} 条 · {success.ts}
        </span>
      )}
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">✗ {error}</span>
      )}
      <span className="ml-auto text-xs text-amber-700 dark:text-amber-400">
        草稿在浏览器 localStorage 内，关掉网页不丢
      </span>
    </div>
  );
}
