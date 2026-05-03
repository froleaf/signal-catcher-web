import { Octokit } from "@octokit/rest";

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.NEXT_PUBLIC_DATA_REPO || "froleaf/signal-catcher";
const [OWNER, REPO_NAME] = REPO.split("/");

if (!TOKEN) {
  console.warn(
    "[github] GITHUB_TOKEN not set; octokit will be unauthenticated and may hit rate limits or 404 on private repos."
  );
}

export const octokit = new Octokit({ auth: TOKEN });

export const dataRepo = { owner: OWNER, repo: REPO_NAME };

/** Fetch and decode a single file from the data repo. Returns null on 404. */
export async function getFile(path: string): Promise<string | null> {
  try {
    const res = await octokit.repos.getContent({ ...dataRepo, path });
    if (Array.isArray(res.data) || res.data.type !== "file") return null;
    return Buffer.from(res.data.content, "base64").toString("utf-8");
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      (err as { status: number }).status === 404
    ) {
      return null;
    }
    throw err;
  }
}

export async function getJson<T = unknown>(path: string): Promise<T | null> {
  const text = await getFile(path);
  if (!text) return null;
  return JSON.parse(text) as T;
}

/** Read a JSONL file and return array of parsed objects (empty if missing). */
export async function getJsonl<T = unknown>(path: string): Promise<T[]> {
  const text = await getFile(path);
  if (!text) return [];
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

/** List files in a data-repo directory (empty if dir missing). */
export async function listDir(path: string): Promise<{ name: string; path: string }[]> {
  try {
    const res = await octokit.repos.getContent({ ...dataRepo, path });
    if (!Array.isArray(res.data)) return [];
    return res.data.map((item) => ({ name: item.name, path: item.path }));
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "status" in err &&
      (err as { status: number }).status === 404
    ) {
      return [];
    }
    throw err;
  }
}

/** Append a new line to a JSONL file in the data repo (commit + push). */
export async function appendJsonlLine(
  path: string,
  line: object,
  commitMessage: string
): Promise<void> {
  const existing = await octokit.repos.getContent({ ...dataRepo, path }).catch((e: unknown) => {
    if (
      typeof e === "object" &&
      e !== null &&
      "status" in e &&
      (e as { status: number }).status === 404
    )
      return null;
    throw e;
  });

  const prevContent =
    existing && !Array.isArray(existing.data) && existing.data.type === "file"
      ? Buffer.from(existing.data.content, "base64").toString("utf-8")
      : "";
  const sha =
    existing && !Array.isArray(existing.data) && existing.data.type === "file"
      ? existing.data.sha
      : undefined;

  const newContent =
    (prevContent.endsWith("\n") || prevContent.length === 0
      ? prevContent
      : prevContent + "\n") +
    JSON.stringify(line) +
    "\n";

  await octokit.repos.createOrUpdateFileContents({
    ...dataRepo,
    path,
    message: commitMessage,
    content: Buffer.from(newContent, "utf-8").toString("base64"),
    sha,
  });
}

/** Read-modify-write a JSON file in the data repo. */
export async function updateJsonFile<T>(
  path: string,
  mutate: (current: T | null) => T,
  commitMessage: string
): Promise<void> {
  const existing = await octokit.repos.getContent({ ...dataRepo, path }).catch((e: unknown) => {
    if (
      typeof e === "object" &&
      e !== null &&
      "status" in e &&
      (e as { status: number }).status === 404
    )
      return null;
    throw e;
  });

  const prev =
    existing && !Array.isArray(existing.data) && existing.data.type === "file"
      ? (JSON.parse(
          Buffer.from(existing.data.content, "base64").toString("utf-8")
        ) as T)
      : null;
  const sha =
    existing && !Array.isArray(existing.data) && existing.data.type === "file"
      ? existing.data.sha
      : undefined;

  const next = mutate(prev);

  await octokit.repos.createOrUpdateFileContents({
    ...dataRepo,
    path,
    message: commitMessage,
    content: Buffer.from(JSON.stringify(next, null, 2), "utf-8").toString("base64"),
    sha,
  });
}
