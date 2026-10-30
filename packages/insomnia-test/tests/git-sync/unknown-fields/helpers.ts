import { faker } from "@faker-js/faker";

export type UnknownFieldValue = string | number | boolean | null | UnknownFieldValue[] | { [key: string]: UnknownFieldValue };

// Where in the collection file an extra unknown field is injected. Folder targets apply to every folder.
export type UnknownFieldTarget =
  | "root"
  | "workspace.meta"
  | "request"
  | "request.meta"
  | "request.settings"
  | "request.settings.cookies"
  | "folder"
  | "folder.meta"
  | "folder.request"
  | "folder.request.meta"
  | "cookieJar"
  | "cookieJar.meta"
  | "environments"
  | "environments.meta";

export interface ExtraUnknownField {
  target: UnknownFieldTarget;
  name: string;
  // Defaults to a random string. Objects and arrays are rendered as nested YAML, so the field can be arbitrarily deep.
  value?: UnknownFieldValue;
}

const isScalar = (value: UnknownFieldValue): value is string | number | boolean | null => value === null || typeof value !== "object";
const isEmpty = (value: UnknownFieldValue) => (Array.isArray(value) ? value.length === 0 : typeof value === "object" && value !== null && Object.keys(value).length === 0);

function renderYamlValue(value: string | number | boolean | null) {
  return typeof value === "string" ? JSON.stringify(value) : String(value);
}

// Renders `name: value` as YAML lines at the given indent (in spaces), recursing into objects and arrays
function renderYamlField(indent: number, name: string, value: UnknownFieldValue): string[] {
  const pad = " ".repeat(indent);
  if (isScalar(value)) {
    return [`${pad}${name}: ${renderYamlValue(value)}`];
  }
  if (isEmpty(value)) {
    return [`${pad}${name}: ${Array.isArray(value) ? "[]" : "{}"}`];
  }
  return [`${pad}${name}:`, ...renderYamlBody(indent + 2, value)];
}

function renderYamlBody(indent: number, value: UnknownFieldValue): string[] {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (isScalar(item)) {
        return [`${pad}- ${renderYamlValue(item)}`];
      }
      if (isEmpty(item)) {
        return [`${pad}- ${Array.isArray(item) ? "[]" : "{}"}`];
      }
      // Render the item one level deeper, then replace the first line's indent with the "- " marker
      const [first, ...rest] = renderYamlBody(indent + 2, item);
      return [`${pad}- ${first.trimStart()}`, ...rest];
    });
  }
  return Object.entries(value as Record<string, UnknownFieldValue>).flatMap(([key, child]) => renderYamlField(indent, key, child));
}

export function buildCollectionFileWithUnknownField(
  collectionName: string,
  options: {
    requestName?: string;
    unknownField?: string;
    anchoredUnknownField?: boolean;
    omitDefaultUnknownField?: boolean;
    extraUnknownFields?: ExtraUnknownField[];
  } = {},
) {
  const id = faker.string.alphanumeric({ length: 16, casing: "lower" });
  const requestName = options.requestName ?? faker.string.alpha(10);
  const unknownField = options.unknownField ?? "futureField";
  const unknownValue = faker.string.alpha(10);
  const extraUnknownFields = (options.extraUnknownFields ?? []).map((field) => ({
    ...field,
    value: field.value ?? faker.string.alpha(10),
  }));
  // Lines for the extra unknown fields that target `target`, to be appended at the end of that block
  const extras = (target: UnknownFieldTarget, indent: number) =>
    extraUnknownFields.filter((field) => field.target === target).flatMap((field) => renderYamlField(indent, field.name, field.value));
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
    ...extras("workspace.meta", 2),
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
    ...extras("request.meta", 6),
    "    method: GET",
    ...extras("request", 4),
    ...(options.omitDefaultUnknownField
      ? []
      : options.anchoredUnknownField
        ? [`    ${unknownField}: &${unknownField}Anchor`, `      nested: ${unknownValue}`, `    ${unknownField}Copy: *${unknownField}Anchor`]
        : [`    ${unknownField}: ${unknownValue}`]),
    "    settings:",
    "      renderRequestBody: true",
    "      encodeUrl: true",
    "      followRedirects: global",
    "      cookies:",
    "        send: true",
    "        store: true",
    ...extras("request.settings.cookies", 8),
    "      rebuildPath: true",
    ...extras("request.settings", 6),
    ...folders.flatMap((folder) => [
      `  - name: ${folder.name}`,
      "    meta:",
      `      id: ${folder.id}`,
      `      created: ${folder.created}`,
      `      modified: ${folder.created}`,
      ...extras("folder.meta", 6),
      ...extras("folder", 4),
      "    children:",
      `      - url: https://example.com/${folder.id}`,
      `        name: Request in ${folder.name}`,
      "        meta:",
      `          id: req_${folder.id}`,
      "          created: 5000",
      "          modified: 5000",
      ...extras("folder.request.meta", 10),
      "        method: GET",
      ...extras("folder.request", 8),
    ]),
    "cookieJar:",
    "  name: Default Jar",
    "  meta:",
    `    id: jar_${id}`,
    "    created: 1000",
    "    modified: 1000",
    ...extras("cookieJar.meta", 4),
    ...extras("cookieJar", 2),
    "environments:",
    "  name: Base Environment",
    "  meta:",
    `    id: env_${id}`,
    "    created: 1000",
    "    modified: 1000",
    "    isPrivate: false",
    ...extras("environments.meta", 4),
    ...extras("environments", 2),
    ...extras("root", 0),
    "",
  ].join("\n");
  return { content, requestName, unknownField, unknownValue, extraUnknownFields };
}
