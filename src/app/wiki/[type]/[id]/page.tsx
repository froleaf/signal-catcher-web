import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCompanies,
  getMaterials,
  getPersons,
  getProducts,
  loadOntology,
  nodeById,
} from "@/lib/ontology";
import { refId } from "@/lib/types";
import type {
  CompanyEntity,
  Material,
  OntologyNode,
  PersonEntity,
  ProductEntity,
} from "@/lib/types";

export const dynamic = "force-static";
export const revalidate = false;

const TYPE_ALIASES = {
  companies: "Company",
  persons: "Person",
  products: "Product",
} as const;

type EntityType = keyof typeof TYPE_ALIASES;

export async function generateStaticParams() {
  const [companies, persons, products] = await Promise.all([
    getCompanies(),
    getPersons(),
    getProducts(),
  ]);
  const params: { type: EntityType; id: string }[] = [];
  for (const c of companies) params.push({ type: "companies", id: c["@id"] });
  for (const p of persons) params.push({ type: "persons", id: p["@id"] });
  for (const p of products) params.push({ type: "products", id: p["@id"] });
  return params;
}

export default async function EntityPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id: rawId } = await params;
  const id = decodeURIComponent(rawId);

  if (!(type in TYPE_ALIASES)) notFound();
  const entityTypeName = TYPE_ALIASES[type as EntityType];

  const ontology = await loadOntology();
  const entity = nodeById<OntologyNode>(ontology, id);
  if (!entity || entity["@type"] !== entityTypeName) notFound();

  // Resolve mentioned Materials
  const materials = await getMaterials();
  const matById = new Map(materials.map((m) => [m["@id"], m]));
  const mentionedRefs = (entity.mentionedIn as unknown[]) ?? [];
  const mentioned = mentionedRefs
    .map((ref) => {
      const refStr = typeof ref === "string" ? ref : (ref as { "@id"?: string })["@id"];
      return refStr ? matById.get(refStr) : undefined;
    })
    .filter((m): m is Material => Boolean(m))
    .sort((a, b) => (a.collectedAt > b.collectedAt ? -1 : 1));

  const aliases = (entity.aliases as string[]) ?? [];
  const description = entity.description as string | undefined;
  const url = entity.url as string | undefined;
  const rolling = entity.rollingSummary as string | undefined;

  return (
    <article className="space-y-8">
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <Link
          href="/wiki"
          className="text-sm text-zinc-500 underline-offset-2 hover:underline"
        >
          ← Wiki
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">
            {entity.name ?? entity["@id"]}
          </h1>
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {entityTypeName}
          </span>
        </div>
        <p className="mt-1 font-mono text-xs text-zinc-500">{entity["@id"]}</p>
        {aliases.length > 0 && (
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="text-zinc-500">aliases:</span> {aliases.join(" · ")}
          </p>
        )}
        {url && (
          <p className="mt-1 text-sm">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300"
            >
              {url}
            </a>
          </p>
        )}
      </header>

      {description && (
        <Section title="Description">
          <p className="leading-7 text-zinc-700 dark:text-zinc-300">{description}</p>
        </Section>
      )}

      {rolling && (
        <Section title="Rolling summary">
          <p className="leading-7 text-zinc-700 dark:text-zinc-300">{rolling}</p>
        </Section>
      )}

      <RelatedEntities entity={entity} ontology={ontology} type={type as EntityType} />

      <Section title={`Mentioned in (${mentioned.length})`}>
        {mentioned.length === 0 ? (
          <p className="text-sm text-zinc-500">还没有任何 Material 提到。</p>
        ) : (
          <ul className="space-y-3">
            {mentioned.map((m) => (
              <li
                key={m["@id"]}
                className="rounded border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                {m.url ? (
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-2"
                  >
                    {m.title}
                  </a>
                ) : (
                  <span className="font-medium">{m.title}</span>
                )}
                <div className="mt-1 flex gap-3 text-xs text-zinc-500">
                  {m.briefingType && <span>{m.briefingType}</span>}
                  {m.collectedAt && (
                    <time>{new Date(m.collectedAt).toLocaleDateString("zh-CN")}</time>
                  )}
                </div>
                {m.summary && (
                  <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {m.summary}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-medium tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function RelatedEntities({
  entity,
  ontology,
  type,
}: {
  entity: OntologyNode;
  ontology: Awaited<ReturnType<typeof loadOntology>>;
  type: EntityType;
}) {
  const sections: { label: string; type: EntityType; ids: string[] }[] = [];

  if (type === "companies") {
    const e = entity as CompanyEntity;
    if (e.relatedPersons?.length) {
      sections.push({
        label: "Related persons",
        type: "persons",
        ids: e.relatedPersons.map((r) => refId(r)).filter((x): x is string => x !== null),
      });
    }
    if (e.relatedProducts?.length) {
      sections.push({
        label: "Products",
        type: "products",
        ids: e.relatedProducts.map((r) => refId(r)).filter((x): x is string => x !== null),
      });
    }
  } else if (type === "persons") {
    const e = entity as PersonEntity;
    if (e.affiliations?.length) {
      sections.push({
        label: "Affiliations",
        type: "companies",
        ids: e.affiliations.map((r) => refId(r)).filter((x): x is string => x !== null),
      });
    }
  } else if (type === "products") {
    const e = entity as ProductEntity;
    if (e.company) {
      const cid = refId(e.company);
      if (cid) {
        sections.push({ label: "Company", type: "companies", ids: [cid] });
      }
    }
  }

  if (sections.length === 0) return null;

  return (
    <Section title="Connections">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <div key={s.label}>
            <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">
              {s.label}
            </h3>
            <ul className="space-y-1 text-sm">
              {s.ids.map((id) => {
                const node = nodeById<OntologyNode>(ontology, id);
                return (
                  <li key={id}>
                    <Link
                      href={`/wiki/${s.type}/${encodeURIComponent(id)}`}
                      className="text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300"
                    >
                      {node?.name ?? id}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}
