// Type definitions matching signal/SCHEMA.md in froleaf/signal-catcher.
// These are intentionally permissive — graphs evolve faster than types.

export type EntityRef = string | { "@id": string };

export interface OntologyNode {
  "@type": string;
  "@id": string;
  name?: string;
  title?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface Source extends OntologyNode {
  "@type": "Source";
  tier?: "thinker" | "lab" | "practice" | "adjacent" | "tool" | "classic_reference" | "passive" | "dormant";
  aliases?: string[];
  url?: string;
  topics?: EntityRef[];
}

export interface Material extends OntologyNode {
  "@type": "Material" | "Classic";
  title: string;
  url: string;
  source?: EntityRef;
  publishedAt?: string;
  collectedAt: string;
  status: "pushed" | "curated" | "classic";
  contentType?: "article" | "podcast" | "paper" | "talk" | "thread" | "interview" | "report";
  briefingType?: string;
  topics?: EntityRef[];
  tags?: string[];
  summary?: string;
  mentionedCompanies?: EntityRef[];
  mentionedPersons?: EntityRef[];
  mentionedProducts?: EntityRef[];
  reflections?: EntityRef[];
}

export interface Signal extends OntologyNode {
  "@type": "Signal";
  title: string;
  description: string;
  status: "emerging" | "active" | "stabilized" | "faded";
  strength: "weak" | "moderate" | "strong";
  thesis: string;
  topics?: EntityRef[];
  evidenceMaterials?: EntityRef[];
  contraEvidenceMaterials?: EntityRef[];
  firstDetectedAt: string;
  lastUpdatedAt: string;
}

export interface TopicCluster extends OntologyNode {
  "@type": "TopicCluster";
  status?: "active" | "dormant";
  activityLevel?: "high" | "medium" | "low" | "dormant";
  lastActiveAt?: string;
  materialCount?: number;
  signalCount?: number;
}

export interface Reflection extends OntologyNode {
  "@type": "Reflection";
  title: string;
  thesis: string;
  synthesis: string;
  triggeredBy: EntityRef;
  relatedFrameworks?: string[];
}

export interface CompanyEntity extends OntologyNode {
  "@type": "Company";
  aliases?: string[];
  type?: string;
  url?: string;
  mentionedIn?: EntityRef[];
  firstMentionedAt?: string;
  lastMentionedAt?: string;
}
export interface PersonEntity extends OntologyNode {
  "@type": "Person";
  aliases?: string[];
  role?: string;
  affiliations?: EntityRef[];
  mentionedIn?: EntityRef[];
}
export interface ProductEntity extends OntologyNode {
  "@type": "Product";
  aliases?: string[];
  company?: EntityRef;
  category?: string;
  status?: string;
  mentionedIn?: EntityRef[];
}

export interface Ontology {
  "@context"?: unknown;
  "@graph": OntologyNode[];
}

export interface AuditData {
  week: string;
  generated_at: string;
  highlights?: {
    through_line?: string;
    top_materials?: { item_id: string; title: string; why_picked?: string }[];
    new_signals?: { sig_id: string; thesis: string; evidence_count?: number }[];
    active_entities?: {
      companies?: string[];
      persons?: string[];
      products?: string[];
    };
    papers?: { arxiv_id: string; title: string; take_summary?: string }[];
  };
  eval_summary?: {
    items_evaluated?: number;
    dominant_themes?: { theme: string; occurrence_count: number; example_quotes?: string[] }[];
    source_quality_signals?: Record<string, string>;
    route_corrections?: { item_id: string; should_be: string; was: string }[];
    free_text_count?: number;
  };
  applied_todos?: TodoItem[];
  new_pending_todos?: TodoItem[];
  next_week_suggestions?: string[];
}

export interface TodoItem {
  id: string;
  created_at: string;
  type: string;
  rationale: string;
  evidence: Record<string, unknown>;
  confidence?: "high" | "medium" | "low";
  status: "pending" | "approved" | "rejected" | "applied" | "failed";
  decided_at?: string | null;
  applied_at?: string | null;
  failure_reason?: string;
}

export interface AgentTodoFile {
  version: number;
  updated_at: string;
  items: TodoItem[];
}

export interface EvalLogEntry {
  ts: string;
  item_id: string;
  item_type: "Material" | "Signal" | "Reflection";
  feedback: string;
  source?: string;
}

/** Normalize an EntityRef to its @id string. */
export function refId(ref: EntityRef | undefined): string | null {
  if (!ref) return null;
  return typeof ref === "string" ? ref : ref["@id"];
}
