"use client";

import { useState } from "react";

interface Props {
  item_id: string;
  item_type: "Material" | "Signal" | "Reflection";
  title: string;
  url?: string;
  summary?: string;
  source_name?: string;
  source_cron?: string;
  collected_at?: string;
  existing_feedback?: string;
}

export function EvalItem({
  item_id,
  item_type,
  title,
  url,
  summary,
  source_name,
  source_cron,
  collected_at,
  existing_feedback,
}: Props) {
  const [feedback, setFeedback] = useState(existing_feedback ?? "");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!feedback.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/eval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id,
          item_type,
          feedback,
          source: source_cron,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error || `HTTP ${res.status}`);
      }
      setSavedAt(new Date().toLocaleTimeString("zh-CN"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  const hasExisting = Boolean(existing_feedback);

  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2"
            >
              {title}
            </a>
          ) : (
            <h3 className="font-medium">{title}</h3>
          )}
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-500">
            <span>{item_type}</span>
            {source_name && <span>· {source_name}</span>}
            {source_cron && <span>· {source_cron}</span>}
            {collected_at && (
              <time>· {new Date(collected_at).toLocaleDateString("zh-CN")}</time>
            )}
          </div>
        </div>
        {hasExisting && !savedAt && (
          <span className="shrink-0 rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            ✓ 已评
          </span>
        )}
      </div>

      {summary && (
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {summary}
        </p>
      )}

      <div className="mt-4">
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="写下你的反馈：质量、深度、Lenny's Take 是否到位、应该走哪条线、为什么……（free text）"
          rows={3}
          className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:placeholder:text-zinc-600"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !feedback.trim()}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-700"
          >
            {saving ? "保存中…" : hasExisting ? "追加反馈" : "保存"}
          </button>
          {savedAt && (
            <span className="text-xs text-emerald-700 dark:text-emerald-300">
              已保存 · {savedAt}
            </span>
          )}
          {error && (
            <span className="text-xs text-red-600 dark:text-red-400">
              ✗ {error}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
