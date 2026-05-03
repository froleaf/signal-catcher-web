import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuditData, getMaterials, listWeeks, nodeById, loadOntology } from "@/lib/ontology";
import type { Material } from "@/lib/types";

export const dynamic = "force-static";
export const revalidate = false;

export async function generateStaticParams() {
  const weeks = await listWeeks();
  return weeks.map((week) => ({ week }));
}

export default async function WeeklyDetailPage({
  params,
}: {
  params: Promise<{ week: string }>;
}) {
  const { week } = await params;
  const audit = await getAuditData(week);
  if (!audit) notFound();

  const ontology = await loadOntology();
  const materialById = new Map(
    (await getMaterials()).map((m) => [m["@id"], m])
  );

  const topMaterials = (audit.highlights?.top_materials ?? []).map((entry) => ({
    ...entry,
    material: materialById.get(entry.item_id),
  }));

  return (
    <article className="space-y-12">
      <header className="border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <p className="text-sm text-zinc-500 dark:text-zinc-500">{week}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Weekly Digest</h1>
        <div className="mt-4 flex gap-4 text-sm">
          <Link
            href={`/weekly/${week}/audit`}
            className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            诊断报告 →
          </Link>
          <Link
            href={`/weekly/${week}/todo`}
            className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            待审 todo →
          </Link>
          <Link
            href={`/eval/${week}`}
            className="text-zinc-600 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            本周 eval →
          </Link>
        </div>
      </header>

      {audit.highlights?.through_line && (
        <Section title="本周 Through-line">
          <p className="leading-7 text-zinc-700 dark:text-zinc-300">
            {audit.highlights.through_line}
          </p>
        </Section>
      )}

      {topMaterials.length > 0 && (
        <Section title="Top Materials">
          <ul className="space-y-4">
            {topMaterials.map(({ item_id, title, why_picked, material }) => (
              <li
                key={item_id}
                className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                {material?.url ? (
                  <a
                    href={material.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-2"
                  >
                    {title}
                  </a>
                ) : (
                  <h3 className="font-medium">{title}</h3>
                )}
                {why_picked && (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {why_picked}
                  </p>
                )}
                {material?.summary && (
                  <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-500">
                    {material.summary}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {audit.highlights?.new_signals && audit.highlights.new_signals.length > 0 && (
        <Section title="New Signals">
          <ul className="space-y-3">
            {audit.highlights.new_signals.map((s) => (
              <li
                key={s.sig_id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="font-medium">{s.thesis}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                  {s.sig_id}
                  {s.evidence_count !== undefined && ` · ${s.evidence_count} evidence`}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {audit.highlights?.papers && audit.highlights.papers.length > 0 && (
        <Section title="Papers This Week">
          <ul className="space-y-3">
            {audit.highlights.papers.map((p) => (
              <li
                key={p.arxiv_id}
                className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <a
                  href={`https://arxiv.org/abs/${p.arxiv_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium underline underline-offset-2"
                >
                  {p.title}
                </a>
                {p.take_summary && (
                  <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {p.take_summary}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {audit.highlights?.active_entities && (
        <Section title="Active Entities">
          <ActiveEntities active={audit.highlights.active_entities} ontology={ontology} />
        </Section>
      )}

      {audit.next_week_suggestions && audit.next_week_suggestions.length > 0 && (
        <Section title="下周建议">
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            {audit.next_week_suggestions.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-medium tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function ActiveEntities({
  active,
  ontology,
}: {
  active: NonNullable<NonNullable<Awaited<ReturnType<typeof getAuditData>>>["highlights"]>["active_entities"];
  ontology: Awaited<ReturnType<typeof loadOntology>>;
}) {
  const items: { type: "companies" | "persons" | "products"; ids: string[] }[] = [
    { type: "companies", ids: active?.companies ?? [] },
    { type: "persons", ids: active?.persons ?? [] },
    { type: "products", ids: active?.products ?? [] },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map(({ type, ids }) => (
        <div key={type}>
          <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">
            {type}
          </h3>
          <ul className="space-y-1 text-sm">
            {ids.length === 0 ? (
              <li className="text-zinc-500 dark:text-zinc-500">—</li>
            ) : (
              ids.map((id) => {
                const node = nodeById<Material>(ontology, id);
                return (
                  <li key={id}>
                    <Link
                      href={`/wiki/${type}/${encodeURIComponent(id)}`}
                      className="text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                    >
                      {node?.name ?? id}
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}
