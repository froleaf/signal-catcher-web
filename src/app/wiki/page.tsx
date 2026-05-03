import Link from "next/link";
import { getCompanies, getPersons, getProducts } from "@/lib/ontology";

export const dynamic = "force-static";
export const revalidate = false;

export default async function WikiIndexPage() {
  const [companies, persons, products] = await Promise.all([
    getCompanies(),
    getPersons(),
    getProducts(),
  ]);

  const groups = [
    { type: "companies", label: "Companies", items: companies },
    { type: "persons", label: "Persons", items: persons },
    { type: "products", label: "Products", items: products },
  ] as const;

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Wiki</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Company / Person / Product 跨 Material 聚合视图。NER 自动维护。
        </p>
        <div className="mt-3 flex gap-4 text-sm text-zinc-500">
          <span>{companies.length} companies</span>
          <span>· {persons.length} persons</span>
          <span>· {products.length} products</span>
        </div>
      </header>

      {groups.map((g) => (
        <section key={g.type}>
          <h2 className="mb-4 text-lg font-medium">{g.label}</h2>
          {g.items.length === 0 ? (
            <p className="text-sm text-zinc-500">还没有该类型的实体。</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.items
                .slice()
                .sort((a, b) => {
                  const am = (a.mentionedIn?.length ?? 0);
                  const bm = (b.mentionedIn?.length ?? 0);
                  if (am !== bm) return bm - am;
                  return (a.name ?? "").localeCompare(b.name ?? "");
                })
                .map((entity) => (
                  <li key={entity["@id"]}>
                    <Link
                      href={`/wiki/${g.type}/${encodeURIComponent(entity["@id"])}`}
                      className="block rounded border border-zinc-200 bg-white px-4 py-2 text-sm transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium truncate">
                          {entity.name ?? entity["@id"]}
                        </span>
                        <span className="shrink-0 text-xs text-zinc-500">
                          {entity.mentionedIn?.length ?? 0}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
