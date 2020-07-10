// @flow
import type { Database } from '../index';
import type { UnitTestSuite } from './types';
import { loadApiSpec } from './api-spec';
import { mustFindSingleOrNone } from '../index';
import { AutoComplete } from 'enquirer';
import flattenDeep from 'lodash.flattendeep';
import { generateIdIsh, getDbChoice, matchIdIsh } from './util';
import { loadWorkspace } from './workspace';

export const loadTestSuites = (db: Database, identifier: string): Array<UnitTestSuite> => {
  const apiSpec = loadApiSpec(db, identifier);
  const workspace = loadWorkspace(db, apiSpec?.parentId || identifier);

  // if identifier is for an apiSpec or a workspace, return all suites for that workspace
  if (workspace) {
    return db.UnitTestSuite.filter(s => s.parentId === workspace._id);
  }

  // Identifier is for one specific suite; find it
  const result = mustFindSingleOrNone(
    db.UnitTestSuite,
    s => matchIdIsh(s, identifier) || s.name === identifier,
  );

  return result ? [result] : [];
};

export const promptTestSuites = async (
  db: Database,
  ci: boolean,
): Promise<Array<UnitTestSuite>> => {
  if (ci) {
    return [];
  }

  const choices = db.ApiSpec.map(spec => [
    getDbChoice(generateIdIsh(spec), spec.fileName),
    ...db.UnitTestSuite.filter(suite => suite.parentId === spec.parentId).map(suite =>
      getDbChoice(generateIdIsh(suite), suite.name, { indent: 1 }),
    ),
  ]);

  if (!choices.length) {
    return [];
  }

  const prompt = new AutoComplete({
    name: 'testSuite',
    message: 'Select a document or unit test suite',
    choices: flattenDeep(choices),
  });

  const [idIsh] = (await prompt.run()).split(' - ').reverse();
  return loadTestSuites(db, idIsh);
};
