import type { Page } from "@playwright/test";

/**
 * Queries the app's database through the same `window.database` bridge the
 * renderer uses, so tests read the documents the app acts on rather than
 * parsing its on-disk NeDB files. `dbFile` is the model's file name
 * (`insomnia.Request.db`), kept so callers still name the model they mean.
 */
export async function findDocs(
  page: Page,
  dbFile: string,
  query: Record<string, unknown> = {},
): Promise<any[]> {
  const type = /^insomnia\.(.+)\.db$/.exec(dbFile)?.[1];
  if (!type) throw new Error(`Not a model db file name: ${dbFile}`);
  return page.evaluate(
    ([t, q]) =>
      (window as any).database.invoke("find", t, q) as Promise<any[]>,
    [type, query] as const,
  );
}
