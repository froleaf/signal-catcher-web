import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";
import type { EvalLogEntry } from "@/lib/types";

export const runtime = "nodejs";

interface BatchEntry {
  item_id: string;
  item_type: "Material" | "Signal" | "Reflection";
  feedback: string;
  source?: string;
}

interface BatchBody {
  entries: BatchEntry[];
}

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.NEXT_PUBLIC_DATA_REPO || "froleaf/signal-catcher";
const [OWNER, REPO_NAME] = REPO.split("/");
const PATH = "state/eval-log.jsonl";

export async function POST(req: Request) {
  let body: BatchBody;
  try {
    body = (await req.json()) as BatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return NextResponse.json(
      { error: "entries must be a non-empty array" },
      { status: 400 }
    );
  }

  // Validate each entry
  const cleaned: EvalLogEntry[] = [];
  for (let i = 0; i < body.entries.length; i++) {
    const e = body.entries[i];
    if (!e.item_id || typeof e.item_id !== "string") {
      return NextResponse.json(
        { error: `entries[${i}].item_id missing or not string` },
        { status: 400 }
      );
    }
    if (!["Material", "Signal", "Reflection"].includes(e.item_type)) {
      return NextResponse.json(
        { error: `entries[${i}].item_type must be Material | Signal | Reflection` },
        { status: 400 }
      );
    }
    if (!e.feedback || !e.feedback.trim()) {
      return NextResponse.json(
        { error: `entries[${i}].feedback empty` },
        { status: 400 }
      );
    }
    cleaned.push({
      ts: new Date().toISOString(),
      item_id: e.item_id,
      item_type: e.item_type,
      feedback: e.feedback.trim(),
      ...(e.source ? { source: e.source } : {}),
    });
  }

  // Single read-modify-write cycle: read existing, append all lines, single commit
  const octokit = new Octokit({ auth: TOKEN });
  try {
    let prevContent = "";
    let sha: string | undefined;
    try {
      const existing = await octokit.repos.getContent({
        owner: OWNER,
        repo: REPO_NAME,
        path: PATH,
      });
      if (!Array.isArray(existing.data) && existing.data.type === "file") {
        prevContent = Buffer.from(existing.data.content, "base64").toString("utf-8");
        sha = existing.data.sha;
      }
    } catch (err: unknown) {
      if (
        typeof err === "object" &&
        err !== null &&
        "status" in err &&
        (err as { status: number }).status !== 404
      ) {
        throw err;
      }
      // 404 → file doesn't exist yet, will create
    }

    const newLines = cleaned.map((entry) => JSON.stringify(entry)).join("\n");
    const trail =
      prevContent.length === 0 || prevContent.endsWith("\n") ? "" : "\n";
    const newContent = prevContent + trail + newLines + "\n";

    await octokit.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: REPO_NAME,
      path: PATH,
      message: `eval: batch ${cleaned.length} feedback entries`,
      content: Buffer.from(newContent, "utf-8").toString("base64"),
      sha,
    });

    return NextResponse.json({
      ok: true,
      committed: cleaned.length,
      entries: cleaned.map((e) => ({ item_id: e.item_id, ts: e.ts })),
    });
  } catch (err) {
    console.error("[/api/eval/batch] failed", err);
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: "failed to commit eval-log batch", detail: message },
      { status: 500 }
    );
  }
}
