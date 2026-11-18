import * as fs from "node:fs";
import path from "node:path";

export interface BackendProjectMeta {
  dir: string;
  id: string;
  rootDocumentId: string;
}

/**
 * Reads every `<projectsDir>/<dir>/meta.json` of the cloud-sync version-control
 * store. Directories without a `meta.json` (e.g. mid-deletion) are skipped.
 */
export async function readBackendProjectMetas(
  projectsDir: string,
): Promise<BackendProjectMeta[]> {
  const dirs = await fs.promises.readdir(projectsDir);
  const metas = await Promise.all(
    dirs.map(async (dir) => {
      try {
        const meta = JSON.parse(
          await fs.promises.readFile(
            path.join(projectsDir, dir, "meta.json"),
            "utf8",
          ),
        );
        return { dir, id: meta.id, rootDocumentId: meta.rootDocumentId };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
    }),
  );
  return metas.filter((meta) => meta !== undefined);
}
