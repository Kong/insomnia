import type { Database } from '../index';
import type { UnitTestSuite } from './types';
import { loadApiSpec } from './api-spec';
// @ts-expect-error the enquirer types are incomplete https://github.com/enquirer/enquirer/pull/307
import { AutoComplete } from 'enquirer';
import flattenDeep from 'lodash.flattendeep';
import {
  ensureSingleOrNone,
  generateIdIsh,
  getDbChoice,
  matchIdIsh,
} from './util';
import { loadWorkspace } from './workspace';
import { logger } from '../../logger';

export const loadUnitTestSuite = (
  db: Database,
  identifier: string,
): UnitTestSuite | null | undefined => {
  // Identifier is for one specific suite; find it
  logger.trace(
    'Load unit test suite with identifier `%s` from data store',
    identifier,
  );
  const items = db.UnitTestSuite.filter(
    suite => matchIdIsh(suite, identifier) || suite.name === identifier,
  );
  logger.trace('Found %d.', items.length);
  return ensureSingleOrNone(items, 'unit test suite');
};
export const loadTestSuites = (
  db: Database,
  identifier: string,
): Array<UnitTestSuite> => {
  const apiSpec = loadApiSpec(db, identifier);
  const workspace = loadWorkspace(db, apiSpec?.parentId || identifier); // if identifier is for an apiSpec or a workspace, return all suites for that workspace

  if (workspace) {
    return db.UnitTestSuite.filter(s => s.parentId === workspace._id);
  } // load particular suite

  const result = loadUnitTestSuite(db, identifier);
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
    ...db.UnitTestSuite.filter(
      suite => suite.parentId === spec.parentId,
    ).map(suite =>
      getDbChoice(generateIdIsh(suite), suite.name, {
        indent: 1,
      }),
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
  logger.trace('Prompt for document or test suite');
  const [idIsh] = (await prompt.run()).split(' - ').reverse();
  return loadTestSuites(db, idIsh);
};
