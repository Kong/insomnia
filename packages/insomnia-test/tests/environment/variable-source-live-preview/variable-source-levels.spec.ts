import path from "node:path";

import { faker } from "@faker-js/faker";
import { expect } from "@playwright/test";

import { ProjectType } from "../../../enums/project-types";
import { test } from "../../../misc/fixtures";
import { Collection } from "../../../models/collection";
import { Project } from "../../../models/project";
import type { FlowManager } from "../../../flows/flow-manager";
import type { VariableSourceLanding } from "../../../flows/variable-source.flow";

const cascadeFixture = path.join(__dirname, "environment-cascade-collection.yaml");
const globalCollectionFixture = path.join(__dirname, "collection-for-global-environments.yaml");
const globalEnvironmentFixture = path.join(__dirname, "global-environment.yaml");

interface Scenario {
  id: string;
  collection: string;
  fixtures: string[];
  request: string;
  environment: string;
  linkedProjectEnvironment?: string;
  field: string;
  snippet: string;
  chipName: string;
  value: string;
  source: string;
  landing: VariableSourceLanding;
  landingRow?: string;
}

const scenarios: Scenario[] = [
  {
    id: "collection base environment",
    collection: "Environment Cascade",
    fixtures: [cascadeFixture],
    request: "cascade request no folder",
    environment: "Base Environment",
    field: "cascadeVar",
    snippet: "cascadeVar",
    chipName: "_.cascadeVar",
    value: "fromBase",
    source: "Collection Environment : Base Environment",
    landing: "environments-modal",
    landingRow: "Base Environment",
  },
  {
    id: "collection sub environment overriding base",
    collection: "Environment Cascade",
    fixtures: [cascadeFixture],
    request: "cascade request no folder",
    environment: "SubEnvA",
    field: "cascadeVar",
    snippet: "cascadeVar",
    chipName: "_.cascadeVar",
    value: "fromSubA",
    source: "Collection Environment : SubEnvA",
    landing: "environments-modal",
    landingRow: "SubEnvA",
  },
  {
    id: "folder environment winning over base and sub",
    collection: "Environment Cascade",
    fixtures: [cascadeFixture],
    request: "cascade request",
    environment: "Base Environment",
    field: "cascadeVar",
    snippet: "cascadeVar",
    chipName: "_.cascadeVar",
    value: "fromFolder",
    source: "Folder Environment : cascadeFolder",
    landing: "folder-pane",
  },
  {
    id: "nested folder environment overriding the outer folder",
    collection: "Environment Cascade",
    fixtures: [cascadeFixture],
    request: "inner request",
    environment: "Base Environment",
    field: "folderOverride",
    snippet: "folderOverride",
    chipName: "_.folderOverride",
    value: "fromInnerFolder",
    source: "Folder Environment : innerFolder",
    landing: "folder-pane",
  },
  {
    id: "project environment",
    collection: "collection-for-global-environments",
    fixtures: [globalCollectionFixture, globalEnvironmentFixture],
    request: "Global Var Request",
    environment: "Base Environment",
    linkedProjectEnvironment: "global-environment",
    field: "global-base",
    snippet: "global-base",
    chipName: "_['global-base']",
    value: "4444",
    source: "Project Environment : Base Environment",
    landing: "environment-page",
    landingRow: "Base Environment",
  },
];

async function selectScenarioEnvironment(
  flowManager: FlowManager,
  collection: Collection,
  scenario: Scenario,
): Promise<void> {
  const { environmentFlow, variableSourceFlow } = flowManager;
  if (scenario.linkedProjectEnvironment) {
    await variableSourceFlow.selectProjectEnvironment(
      collection,
      scenario.linkedProjectEnvironment,
    );
    return;
  }
  await environmentFlow.activate(collection, scenario.environment);
}

for (const scenario of scenarios) {
  test(`Verify ${scenario.id} is sent, previewed in the tag modal, and opens its source from the modal`, async ({
    user,
  }) => {
    const { workspaceFlow, importFlow, httpRequestFlow, variableSourceFlow } =
      user.flowManager;

    const project = await workspaceFlow.createProject(
      new Project(faker.string.alphanumeric(10), ProjectType.Local),
    );
    for (const fixture of scenario.fixtures) {
      await importFlow.importFile(project, fixture);
    }
    const collection = new Collection(scenario.collection);
    await selectScenarioEnvironment(user.flowManager, collection, scenario);

    const request = await httpRequestFlow.get(scenario.request);
    const response = await httpRequestFlow.send(request!);
    const modal = await variableSourceFlow.inspectVariableModal(
      scenario.snippet,
      scenario.value,
    );
    await variableSourceFlow.openSourceFromModal();
    const navigation = await variableSourceFlow.getNavigation(
      scenario.landing,
      scenario.landingRow,
    );

    expect(response.statusCode).toBe(200);
    expect(
      JSON.parse((response.body as { data: string }).data)[scenario.field],
    ).toBe(scenario.value);
    expect(modal.source).toContain(scenario.source);
    expect(modal.preview).toBe(scenario.value);
    expect(navigation.selectedEnvironmentRow).toBe(
      scenario.landingRow === undefined ? undefined : true,
    );
    expect(navigation.environmentTabSelected).toBe(
      scenario.landing === "folder-pane" ? true : undefined,
    );
    expect(navigation.url).toMatch(
      scenario.landing === "folder-pane"
        ? /debug\/request-group\//
        : scenario.landing === "environment-page"
          ? /\/environment\/?$/
          : /.*/,
    );
  });

  test(`Verify hovering the ${scenario.id} tag shows its value and source in the tooltip`, async ({
    user,
  }) => {
    const { workspaceFlow, importFlow, httpRequestFlow, variableSourceFlow } =
      user.flowManager;

    const project = await workspaceFlow.createProject(
      new Project(faker.string.alphanumeric(10), ProjectType.Local),
    );
    for (const fixture of scenario.fixtures) {
      await importFlow.importFile(project, fixture);
    }
    const collection = new Collection(scenario.collection);
    await selectScenarioEnvironment(user.flowManager, collection, scenario);

    await httpRequestFlow.get(scenario.request);
    const hovered = await variableSourceFlow.hoverVariable(scenario.snippet);

    expect(hovered.tooltip).toContain(scenario.value);
    expect(hovered.tooltip).toContain(scenario.source);
    expect(hovered.chip).toBe(scenario.chipName);
  });
}
