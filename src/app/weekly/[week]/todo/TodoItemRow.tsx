"use client";

import { useState } from "react";
import type { TodoItem } from "@/lib/types";

export function TodoItemRow({ todo }: { todo: TodoItem }) {
  const [status, setStatus] = useState(todo.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/todo/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ todo_id: todo.id, decision }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setStatus(data.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "decide failed");
    } finally {
      setBusy(false);
    }
  }

  const statusBadge = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    rejected: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    applied: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  }[status];

  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-mono text-xs text-zinc-500">{todo.type}</span>
            {todo.confidence && (
              <span className="text-xs text-zinc-500">
                · confidence: {todo.confidence}
              </span>
            )}
            <span className="text-xs text-zinc-500">· {todo.id}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {todo.rationale}
          </p>
          {todo.evidence && Object.keys(todo.evidence).length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-zinc-500 underline-offset-2 hover:underline">
                evidence
              </summary>
              <pre className="mt-2 overflow-x-auto rounded bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                {JSON.stringify(todo.evidence, null, 2)}
              </pre>
            </details>
          )}
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-xs ${statusBadge}`}
        >
          {status}
        </span>
      </div>

      {status === "pending" && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => decide("approve")}
            disabled={busy}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {busy ? "..." : "Approve"}
          </button>
          <button
            type="button"
            onClick={() => decide("reject")}
            disabled={busy}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Reject
          </button>
          {error && (
            <span className="text-xs text-red-600 dark:text-red-400">
              ✗ {error}
            </span>
          )}
        </div>
      )}
    </li>
  );
}
