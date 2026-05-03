import { NextResponse } from "next/server";
import { appendJsonlLine } from "@/lib/github";
import type { EvalLogEntry } from "@/lib/types";

export const runtime = "nodejs";

interface EvalRequestBody {
  item_id: string;
  item_type: "Material" | "Signal" | "Reflection";
  feedback: string;
  source?: string;
}

export async function POST(req: Request) {
  let body: EvalRequestBody;
  try {
    body = (await req.json()) as EvalRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { item_id, item_type, feedback, source } = body;

  if (!item_id || typeof item_id !== "string") {
    return NextResponse.json(
      { error: "item_id is required (string)" },
      { status: 400 }
    );
  }
  if (!["Material", "Signal", "Reflection"].includes(item_type)) {
    return NextResponse.json(
      { error: "item_type must be Material | Signal | Reflection" },
      { status: 400 }
    );
  }
  if (!feedback || typeof feedback !== "string" || feedback.trim().length === 0) {
    return NextResponse.json(
      { error: "feedback is required (non-empty string)" },
      { status: 400 }
    );
  }

  const entry: EvalLogEntry = {
    ts: new Date().toISOString(),
    item_id,
    item_type,
    feedback: feedback.trim(),
    ...(source ? { source } : {}),
  };

  try {
    await appendJsonlLine(
      "state/eval-log.jsonl",
      entry,
      `eval: feedback for ${item_id}`
    );
    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    console.error("[/api/eval] failed to write eval-log", err);
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: "failed to write eval-log", detail: message },
      { status: 500 }
    );
  }
}
