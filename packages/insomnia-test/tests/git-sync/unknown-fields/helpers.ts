import { faker } from "@faker-js/faker";

export function buildCollectionFileWithUnknownField(
  collectionName: string,
  options: { requestName?: string; unknownField?: string } = {},
) {
  const id = faker.string.alphanumeric({ length: 16, casing: "lower" });
  const requestName = options.requestName ?? faker.string.alpha(10);
  const unknownField = options.unknownField ?? "futureField";
  const unknownValue = faker.string.alpha(10);
  // Folder B is listed first but was created after Folder A, as if someone reordered the file by hand,
  // so the file is also an undiscardable change on top of the unknown field
  const folders = [
    { id: `fld_b${id}`, name: faker.string.alpha(10), created: 3000 },
    { id: `fld_a${id}`, name: faker.string.alpha(10), created: 2000 },
  ];
  const content = [
    "type: collection.insomnia.rest/5.0",
    'schema_version: "5.1"',
    `name: ${collectionName}`,
    "meta:",
    `  id: wrk_${id}`,
    "  created: 1000",
    "  modified: 1000",
    '  description: ""',
    "collection:",
    `  - url: https://example.com/${id}`,
    `    name: ${requestName}`,
    "    meta:",
    `      id: req_${id}`,
    "      created: 5000",
    "      modified: 5000",
    "      isPrivate: false",
    '      description: ""',
    "      sortKey: 0",
    "    method: GET",
    `    ${unknownField}: ${unknownValue}`,
    "    settings:",
    "      renderRequestBody: true",
    "      encodeUrl: true",
    "      followRedirects: global",
    "      cookies:",
    "        send: true",
    "        store: true",
    "      rebuildPath: true",
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
    "    isPrivate: false",
    "",
  ].join("\n");
  return { content, requestName, unknownField, unknownValue };
}
