import { faker } from "@faker-js/faker";

export const UNDISCARDABLE_WARNING_TEXT =
  "This change is only Insomnia internally reformatting the file";

export function buildReorderedCollectionFile(
  collectionName: string,
  options: { oldSchema?: boolean } = {},
) {
  const id = faker.string.alphanumeric({ length: 16, casing: "lower" });
  const folders = [
    { id: `fld_b${id}`, name: faker.string.alpha(10), created: 3000 },
    { id: `fld_a${id}`, name: faker.string.alpha(10), created: 2000 },
  ];
  // Keep folders in canonical order so an old-schema file differs only by schema normalization.
  if (options.oldSchema) folders.reverse();
  const content = [
    "type: collection.insomnia.rest/5.0",
    ...(options.oldSchema ? [] : ['schema_version: "5.1"']),
    `name: ${collectionName}`,
    "meta:",
    `  id: wrk_${id}`,
    "  created: 1000",
    "  modified: 1000",
    "collection:",
    ...folders.flatMap((folder) => [
      `  - name: ${folder.name}`,
      "    meta:",
      `      id: ${folder.id}`,
      `      created: ${folder.created}`,
      `      modified: ${folder.created}`,
      "    children:",
      `      - url: https://example.com/${folder.id}`,
      `        name: Request in ${folder.name}`,
      "        meta:",
      `          id: req_${folder.id}`,
      "          created: 5000",
      "          modified: 5000",
      "        method: GET",
      "        headers:",
      "          - name: X-Folder",
      `            value: ${folder.id}`,
      ...(options.oldSchema ? ["            id: pair_1"] : []),
    ]),
    "cookieJar:",
    "  name: Default Jar",
    "  meta:",
    `    id: jar_${id}`,
    "    created: 1000",
    "    modified: 1000",
    "environments:",
    "  name: Base Environment",
    "  meta:",
    `    id: env_${id}`,
    "    created: 1000",
    "    modified: 1000",
    "",
  ].join("\n");
  return { content, requestName: `Request in ${folders[0].name}` };
}
