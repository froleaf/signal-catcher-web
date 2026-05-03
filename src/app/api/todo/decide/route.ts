import { NextResponse } from "next/server";
import { updateJsonFile } from "@/lib/github";
import type { AgentTodoFile, TodoItem } from "@/lib/types";

export const runtime = "nodejs";

interface DecideBody {
  todo_id: string;
  decision: "approve" | "reject";
}

export async function POST(req: Request) {
  let body: DecideBody;
  try {
    body = (await req.json()) as DecideBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { todo_id, decision } = body;
  if (!todo_id || typeof todo_id !== "string") {
    return NextResponse.json(
      { error: "todo_id is required (string)" },
      { status: 400 }
    );
  }
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json(
      { error: "decision must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }

  const newStatus: TodoItem["status"] = decision === "approve" ? "approved" : "rejected";

  try {
    let found = false;
    await updateJsonFile<AgentTodoFile>(
      "state/agent-todo.json",
      (current) => {
        const file: AgentTodoFile = current ?? {
          version: 1,
          updated_at: new Date().toISOString(),
          items: [],
        };
        const items = file.items.map((it) => {
          if (it.id === todo_id) {
            found = true;
            if (it.status !== "pending") {
              return it; // already decided; preserve
            }
            return {
              ...it,
              status: newStatus,
              decided_at: new Date().toISOString(),
            };
          }
          return it;
        });
        return {
          ...file,
          updated_at: new Date().toISOString(),
          items,
        };
      },
      `todo: ${decision} ${todo_id}`
    );

    if (!found) {
      return NextResponse.json(
        { error: `todo_id ${todo_id} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, todo_id, status: newStatus });
  } catch (err) {
    console.error("[/api/todo/decide] failed", err);
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: "failed to update agent-todo", detail: message },
      { status: 500 }
    );
  }
}
