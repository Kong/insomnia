// @flow
import type { Database } from '../index';
import type { UnitTestSuite } from './types';
import { loadApiSpec } from './api-spec';
import { MultipleFoundError, mustFindSingleOrNone, NoneFoundError } from '../index';
import { AutoComplete } from 'enquirer';
import flattenDeep from 'lodash.flattendeep';
import { generateIdIsh, getDbChoice, matchIdIsh } from './util';
import { loadWorkspace } from './workspace';
import consola from 'consola';

const loadSuite = (db: Database, identifier: string): ?UnitTestSuite => {
  // Identifier is for one specific suite; find it
  const [suite, err] = mustFindSingleOrNone(
    db.UnitTestSuite,
    s => matchIdIsh(s, identifier) || s.name === identifier,
  );

  if (err) {
    if (err instanceof NoneFoundError) {
      consola.warn('No base environment found for the workspace; expected one.');
      return null;
    }

    if (err instanceof MultipleFoundError) {
      consola.warn('Multiple base environments found for the workspace; expected one.');
      return null;
    }

    throw err;
  }

  consola.success('Found');
  return suite;
};

export const loadTestSuites = (db: Database, identifier: string): Array<UnitTestSuite> => {
  const apiSpec = loadApiSpec(db, identifier);
  const workspace = loadWorkspace(db, apiSpec?.parentId || identifier);

  // if identifier is for an apiSpec or a workspace, return all suites for that workspace
  if (workspace) {
    return db.UnitTestSuite.filter(s => s.parentId === workspace._id);
  }

  // load particular suite
  const result = loadSuite(db, identifier);
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
  ]).filter(c => c.length > 1);

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
