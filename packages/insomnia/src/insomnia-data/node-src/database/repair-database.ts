import { database, type GitRepository } from '~/insomnia-data';
import type { CookieJar } from '~/models/cookie-jar';
import { type Environment } from '~/models/environment';
import * as models from '~/models/index';
import type { Workspace } from '~/models/workspace';

import * as apiSpecServices from '../services/api-spec';

/**
 * Run various database repair scripts
 */
export async function repairDatabase() {
  console.log('[fix] Running database repairs');

  for (const workspace of await database.find<Workspace>(models.workspace.type)) {
    await _repairBaseEnvironments(workspace);
    await _fixMultipleCookieJars(workspace);
    await _applyApiSpecName(workspace);
  }

  for (const gitRepository of await database.find<GitRepository>(models.gitRepository.type)) {
    await _fixOldGitURIs(gitRepository);
  }
}

/**
 * This function ensures that apiSpec exists for each workspace
 * If the filename on the apiSpec is not set or is the default initialized name
 * It will apply the workspace name to it
 */
async function _applyApiSpecName(workspace: Workspace) {
  const apiSpec = await apiSpecServices.getByParentId(workspace._id);
  const existsAndFilenameIsDefaultOrMissing =
    apiSpec && (!apiSpec.fileName || apiSpec.fileName === models.apiSpec.init().fileName);
  if (existsAndFilenameIsDefaultOrMissing) {
    await apiSpecServices.update(apiSpec, { fileName: workspace.name });
  }
}

/**
 * This function repairs workspaces that have multiple base environments. Since a workspace
 * can only have one, this function walks over all base environments, merges the data, and
 * moves all children as well.
 */
async function _repairBaseEnvironments(workspace: Workspace) {
  const baseEnvironments = await database.find<Environment>(models.environment.type, {
    parentId: workspace._id,
  });

  // Nothing to do here
  if (baseEnvironments.length <= 1) {
    return;
  }

  const chosenBase = baseEnvironments[0];

  for (const baseEnvironment of baseEnvironments) {
    if (baseEnvironment._id === chosenBase._id) {
      continue;
    }

    chosenBase.data = Object.assign(baseEnvironment.data, chosenBase.data);
    const subEnvironments = await database.find<Environment>(models.environment.type, {
      parentId: baseEnvironment._id,
    });

    for (const subEnvironment of subEnvironments) {
      await database.docUpdate(subEnvironment, {
        parentId: chosenBase._id,
      });
    }

    // Remove unnecessary base env
    await database.remove(baseEnvironment);
  }

  // Update remaining base env
  await database.update(chosenBase);
  console.log(`[fix] Merged ${baseEnvironments.length} base environments under ${workspace.name}`);
}

/**
 * This function repairs workspaces that have multiple cookie jars. Since a workspace
 * can only have one, this function walks over all jars and merges them and their cookies
 * together.
 */
async function _fixMultipleCookieJars(workspace: Workspace) {
  const cookieJars = await database.find<CookieJar>(models.cookieJar.type, {
    parentId: workspace._id,
  });

  // Nothing to do here
  if (cookieJars.length <= 1) {
    return;
  }

  const chosenJar = cookieJars[0];

  for (const cookieJar of cookieJars) {
    if (cookieJar._id === chosenJar._id) {
      continue;
    }

    for (const cookie of cookieJar.cookies) {
      if (chosenJar.cookies.find(c => c.id === cookie.id)) {
        continue;
      }

      chosenJar.cookies.push(cookie);
    }

    // Remove unnecessary jar
    await database.remove(cookieJar);
  }

  // Update remaining jar
  await database.update(chosenJar);
  console.log(`[fix] Merged ${cookieJars.length} cookie jars under ${workspace.name}`);
}

// Append .git to old git URIs to mimic previous isomorphic-git behavior
async function _fixOldGitURIs(doc: GitRepository) {
  if (!doc.uriNeedsMigration) {
    return;
  }

  if (!doc.uri.endsWith('.git')) {
    doc.uri += '.git';
  }

  doc.uriNeedsMigration = false;
  await database.update(doc);
  console.log(`[fix] Fixed git URI for ${doc._id}`);
}
