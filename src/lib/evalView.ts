import { refId } from "./types";
import type { Material, PushedMessage, Source } from "./types";

export interface EvalItemProps {
  title: string;
  url?: string;
  body?: string;
  lenny_take?: string;
  so_what?: string;
  classic_callback?: { classicId: string; relation: string; note: string };
  source?: {
    name?: string;
    tier?: string;
    description?: string;
    url?: string;
  };
  source_label?: string;
  watch?: string;
  curator?: string;
  source_cron?: string;
  published_at?: string;
  collected_at?: string;
}

export interface EvalItemView {
  item_id: string;
  /** Sortable timestamp; pushed.ts preferred, falls back to material.collectedAt. */
  ts: string | null;
  props: EvalItemProps;
}

function extractCurator(tags?: string[]): string | undefined {
  if (!tags) return undefined;
  for (const t of tags) {
    if (t.startsWith("via:")) return t.slice(4).trim();
  }
  return undefined;
}

/**
 * Build unified eval items by union-joining pushed-messages.jsonl (primary
 * display source — verbatim Telegram bytes) with ontology Material entities
 * (secondary — entity refs, source tier, legacy fallback for items without
 * a pushed-messages line).
 *
 * Field precedence per id:
 *   - body / lenny_take / so_what / source_label / watch  ← pushed-message
 *   - title                                                ← pushed-message > Material
 *   - source (with tier, url, ...)                         ← Material → Source ref
 *   - source_cron                                          ← pushed.cron > Material.briefingType
 *   - collected_at                                         ← pushed.ts > Material.collectedAt
 *
 * Items appear in result if EITHER source has them.
 */
export function buildEvalItems(
  materials: Material[],
  pushedMessages: PushedMessage[],
  sources: Source[],
): EvalItemView[] {
  const sourceById = new Map(sources.map((s) => [s["@id"], s]));
  const pushedById = new Map(pushedMessages.map((p) => [p.item_id, p]));
  const materialById = new Map(materials.map((m) => [m["@id"], m]));

  const allIds = new Set<string>([
    ...pushedMessages.map((p) => p.item_id),
    ...materials.map((m) => m["@id"]),
  ]);

  type WithExtraFields = {
    lennyTake?: string;
    soWhat?: string;
    classicCallback?: { classicId: string; relation: string; note: string };
  };

  return Array.from(allIds).map((id) => {
    const pushed = pushedById.get(id);
    const m = materialById.get(id);
    const extra = m as (Material & WithExtraFields) | undefined;

    const srcId = m ? refId(m.source) : null;
    const src = srcId ? sourceById.get(srcId) : null;

    const ts = pushed?.ts ?? m?.collectedAt ?? null;

    return {
      item_id: id,
      ts,
      props: {
        title: pushed?.title ?? m?.title ?? "(untitled)",
        url: m?.url,
        body: pushed?.body ?? m?.summary,
        lenny_take: pushed?.lenny_take ?? extra?.lennyTake,
        so_what: pushed?.so_what ?? extra?.soWhat,
        classic_callback: extra?.classicCallback,
        source: src
          ? {
              name: src.name,
              tier: src.tier,
              description: src.description,
              url: src.url,
            }
          : undefined,
        source_label: pushed?.source_label,
        watch: pushed?.watch,
        curator: extractCurator(m?.tags),
        source_cron: pushed?.cron ?? m?.briefingType,
        published_at: m?.publishedAt,
        collected_at: pushed?.ts ?? m?.collectedAt,
      },
    };
  });
}
