// @flow
import type { ApiSpec, BaseModel, Environment, UnitTestSuite } from './types';
import { AutoComplete } from 'enquirer';
import type { Database } from './index';
import { findSingle } from './index';

const matchIdIsh = ({ _id }: BaseModel, identifier: string) => _id.startsWith(identifier);
const generateIdIsh = ({ _id }: BaseModel, count: number = 10) => _id.substr(0, count);

export async function getApiSpecFromIdentifier(
  db: Database,
  identifier?: string,
): Promise<?ApiSpec> {
  if (!db.ApiSpec.length) {
    return null;
  }

  if (identifier) {
    return findSingle(db.ApiSpec, s => matchIdIsh(s, identifier) || s.fileName === identifier);
  }

  const prompt = new AutoComplete({
    name: 'apiSpec',
    message: 'Select an API Specification',
    choices: db.ApiSpec.map(s => `${s.fileName} - ${generateIdIsh(s)}`),
  });

  const [, idIsh] = (await prompt.run()).split(' - ');
  return findSingle(db.ApiSpec, s => matchIdIsh(s, idIsh));
}

export async function getTestSuiteFromIdentifier(
  db: Database,
  identifier?: string,
): Promise<?UnitTestSuite> {
  if (!db.UnitTestSuite.length) {
    return null;
  }

  if (identifier) {
    return findSingle(db.UnitTestSuite, s => matchIdIsh(s, identifier) || s.name === identifier);
  }

  const prompt = new AutoComplete({
    name: 'testSuite',
    message: 'Select a Unit Test Suite',
    choices: db.UnitTestSuite.map(suite => {
      // Find the ApiSpec that has the same parent as the Unit Test (ie. under the same workspace)
      const apiSpec = findSingle(db.ApiSpec, ({ parentId }) => parentId === suite.parentId);

      return `${apiSpec.fileName} / ${suite.name} - ${generateIdIsh(suite)}`;
    }),
  });

  const [idIsh] = (await prompt.run()).split(' - ').reverse();
  return findSingle(db.UnitTestSuite, s => matchIdIsh(s, idIsh));
}

export async function getEnvironmentFromIdentifier(
  db: Database,
  workspaceId: string,
  identifier?: string,
): Promise<?Environment> {
  if (!db.Environment.length) {
    return null;
  }

  // Get the sub environments
  const baseWorkspaceEnv = findSingle(db.Environment, e => e.parentId === workspaceId);
  const subEnvs = db.Environment.filter(e => e.parentId === baseWorkspaceEnv._id);

  if (identifier) {
    const result =
      findSingle(subEnvs, e => matchIdIsh(e, identifier) || e.name === identifier) ||
      baseWorkspaceEnv;

    return result;
  }

  if (!subEnvs.length) {
    return baseWorkspaceEnv;
  }

  const baseEnv = 'No environment';

  const prompt = new AutoComplete({
    name: 'environment',
    message: `Select an environment`,
    choices: subEnvs.map(e => `${e.name} - ${generateIdIsh(e, 14)}`).concat(baseEnv),
  });

  const selection = await prompt.run();
  if (selection === baseEnv) {
    return baseWorkspaceEnv;
  }

  const [idIsh] = selection.split(' - ').reverse();
  return findSingle(db.Environment, e => matchIdIsh(e, idIsh));
}
