"use client";

import { useEffect, useRef, useState } from "react";
import { discardDraft, getDraft, setDraft, subscribe } from "@/lib/evalDrafts";

interface Props {
  item_id: string;
  item_type: "Material" | "Signal" | "Reflection";
  title: string;
  url?: string;
  summary?: string;
  lenny_take?: string;
  so_what?: string;
  classic_callback?: { classicId: string; relation: string; note: string };
  source?: {
    name?: string;
    tier?: string;
    description?: string;
    url?: string;
  };
  curator?: string;
  source_cron?: string;
  published_at?: string;
  collected_at?: string;
  existing_feedback?: string;
}

export function EvalItem({
  item_id,
  item_type,
  title,
  url,
  summary,
  lenny_take,
  so_what,
  classic_callback,
  source,
  curator,
  source_cron,
  published_at,
  collected_at,
  existing_feedback,
}: Props) {
  const displayDate = published_at ?? collected_at;
  const isCollectedFallback = !published_at && Boolean(collected_at);
  const hasExisting = Boolean(existing_feedback);

  // Initialize from localStorage (set in effect to avoid SSR mismatch).
  const [draft, setDraftState] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsHydrated(true);
    const existing = getDraft(item_id);
    if (existing) setDraftState(existing.feedback);
    return subscribe(() => {
      const cur = getDraft(item_id);
      setDraftState(cur?.feedback ?? "");
    });
  }, [item_id]);

  function handleChange(value: string) {
    setDraftState(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim()) {
        setDraft({
          item_id,
          item_type,
          feedback: value,
          source: source_cron,
        });
      } else {
        discardDraft(item_id);
      }
    }, 300);
  }

  function handleDiscard() {
    setDraftState("");
    discardDraft(item_id);
  }

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
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-500">
            <span>{item_type}</span>
            {source?.name && (
              <>
                <span>·</span>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-zinc-700 hover:underline dark:hover:text-zinc-300"
                    title={source.description ?? source.name}
                  >
                    {source.name}
                  </a>
                ) : (
                  <span title={source.description ?? source.name}>{source.name}</span>
                )}
                {source.tier && (
                  <span
                    className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    title="Source tier"
                  >
                    {source.tier}
                  </span>
                )}
              </>
            )}
            {curator && (
              <>
                <span>·</span>
                <span>via {curator}</span>
              </>
            )}
            {source_cron && (
              <>
                <span>·</span>
                <span>{source_cron}</span>
              </>
            )}
            {displayDate && (
              <>
                <span>·</span>
                <time
                  dateTime={displayDate}
                  title={
                    isCollectedFallback
                      ? `agent 抓取时间（无原始 publishedAt）`
                      : `原文发布时间`
                  }
                  className={isCollectedFallback ? "italic" : undefined}
                >
                  {new Date(displayDate).toLocaleDateString("zh-CN")}
                  {isCollectedFallback && " ⓘ"}
                </time>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {hasExisting && (
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
              ✓ 已评
            </span>
          )}
          {isHydrated && draft.trim() && (
            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
              📝 草稿
            </span>
          )}
        </div>
      </div>

      {summary && (
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {summary}
        </p>
      )}

      {lenny_take && (
        <div className="mt-3 rounded border-l-2 border-amber-400 bg-amber-50 px-3 py-2 dark:border-amber-600 dark:bg-amber-950/30">
          <div className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Lenny&apos;s Take
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {lenny_take}
          </p>
        </div>
      )}

      {so_what && (
        <div className="mt-2 rounded border-l-2 border-sky-400 bg-sky-50 px-3 py-2 dark:border-sky-600 dark:bg-sky-950/30">
          <div className="text-xs font-medium uppercase tracking-wide text-sky-800 dark:text-sky-300">
            So what
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {so_what}
          </p>
        </div>
      )}

      {classic_callback && (
        <div className="mt-2 rounded border-l-2 border-violet-400 bg-violet-50 px-3 py-2 dark:border-violet-600 dark:bg-violet-950/30">
          <div className="text-xs font-medium uppercase tracking-wide text-violet-800 dark:text-violet-300">
            经典回溯 · {classic_callback.relation}
          </div>
          <p className="mt-1 text-xs text-zinc-500">{classic_callback.classicId}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            {classic_callback.note}
          </p>
        </div>
      )}

      <div className="mt-4">
        <textarea
          value={draft}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={
            hasExisting
              ? "追加新反馈（也会先缓存，等你点上方批量提交）……"
              : "写下你的反馈：质量、深度、Lenny's Take 是否到位、应该走哪条线、为什么……（free text，自动缓存）"
          }
          rows={3}
          className="w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:placeholder:text-zinc-600"
        />
        {isHydrated && draft.trim() && (
          <div className="mt-1 flex items-center justify-end gap-3 text-xs">
            <button
              type="button"
              onClick={handleDiscard}
              className="text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline dark:hover:text-zinc-300"
            >
              丢弃此条草稿
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
