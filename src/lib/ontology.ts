import { cache } from "react";
import { getJson, listDir } from "./github";
import type {
  AuditData,
  CompanyEntity,
  Material,
  Ontology,
  OntologyNode,
  PersonEntity,
  ProductEntity,
  Reflection,
  Signal,
  Source,
  TopicCluster,
} from "./types";

/**
 * Load the full Signal ontology. Deduplicated per request (React cache),
 * not per process — module-level caching would freeze data across requests
 * on warm Vercel Function instances and defeat `force-dynamic`.
 */
export const loadOntology = cache(async (): Promise<Ontology> => {
  const o = await getJson<Ontology>("signal/ontology.jsonld");
  return o ?? { "@graph": [] };
});

export function nodesByType<T extends OntologyNode>(
  ontology: Ontology,
  type: string
): T[] {
  return ontology["@graph"].filter((n) => n["@type"] === type) as T[];
}

export function nodeById<T extends OntologyNode>(
  ontology: Ontology,
  id: string
): T | null {
  return (ontology["@graph"].find((n) => n["@id"] === id) as T) ?? null;
}

export async function getMaterials(): Promise<Material[]> {
  const o = await loadOntology();
  return nodesByType<Material>(o, "Material").concat(
    nodesByType<Material>(o, "Classic")
  );
}

export async function getSignals(): Promise<Signal[]> {
  const o = await loadOntology();
  return nodesByType<Signal>(o, "Signal");
}

export async function getReflections(): Promise<Reflection[]> {
  const o = await loadOntology();
  return nodesByType<Reflection>(o, "Reflection");
}

export async function getSources(): Promise<Source[]> {
  const o = await loadOntology();
  return nodesByType<Source>(o, "Source");
}

export async function getTopicClusters(): Promise<TopicCluster[]> {
  const o = await loadOntology();
  return nodesByType<TopicCluster>(o, "TopicCluster");
}

export async function getCompanies(): Promise<CompanyEntity[]> {
  const o = await loadOntology();
  return nodesByType<CompanyEntity>(o, "Company");
}
export async function getPersons(): Promise<PersonEntity[]> {
  const o = await loadOntology();
  return nodesByType<PersonEntity>(o, "Person");
}
export async function getProducts(): Promise<ProductEntity[]> {
  const o = await loadOntology();
  return nodesByType<ProductEntity>(o, "Product");
}

/** Fetch audit data for a specific ISO week (e.g. "2026-W18"). Null if missing. */
export async function getAuditData(week: string): Promise<AuditData | null> {
  return getJson<AuditData>(`output/audit-data-${week}.json`);
}

/** List all weeks that have audit data, newest first. */
export async function listWeeks(): Promise<string[]> {
  const files = await listDir("output");
  const weeks = files
    .map((f) => f.name.match(/^audit-data-(\d{4}-W\d{2})\.json$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => m[1]);
  return weeks.sort().reverse();
}
