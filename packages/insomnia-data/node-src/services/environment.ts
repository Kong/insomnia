import * as crypto from 'node:crypto';

import type { Environment, Query } from 'insomnia-data';
import { database as db, models } from 'insomnia-data';

import * as projectService from './project';
import * as workspaceService from './workspace';

const { type, prefix, vaultEnvironmentPath } = models.environment;
const { EnvironmentKvPairDataType, EnvironmentType } = models.environment;

export function create(patch: Partial<Environment> = {}) {
  if (!patch.parentId) {
    throw new Error(`New Environment missing \`parentId\`: ${JSON.stringify(patch)}`);
  }
  return db.docCreate<Environment>(type, patch);
}

export function update(environment: Environment, patch: Partial<Environment>) {
  return db.docUpdate(environment, patch);
}

export function list(query?: Query<Environment>, sort?: Record<string, any>, limit?: number) {
  return db.find<Environment>(type, query, sort, limit);
}

export function get(query?: Query<Environment>, sort?: Record<string, any>) {
  return db.findOne<Environment>(type, query, sort);
}

export function remove(environment: Environment) {
  return db.remove(environment);
}

// remove all secret items when user reset vault key
export const removeAllSecrets = async (organizationIds: string[]) => {
  const allProjects = await projectService.listByOrganizationIds(organizationIds);
  const allProjectIds = allProjects.map(project => project._id);
  const allGlobalEnvironmentWorkspaces = await workspaceService.list({
    parentId: { $in: allProjectIds },
    scope: models.workspace.WorkspaceScopeKeys.environment,
  });
  const allGlobalBaseEnvironments = await list({
    parentId: {
      $in: allGlobalEnvironmentWorkspaces.map(w => w._id),
    },
  });
  const allGlobalSubEnvironments = await list({
    parentId: {
      $in: allGlobalBaseEnvironments.map(e => e._id),
    },
  });
  const allGlobalEnvironments = allGlobalBaseEnvironments.concat(allGlobalSubEnvironments);
  const allGlobalPrivateEnvironments = allGlobalEnvironments.filter(env => env.isPrivate);
  allGlobalPrivateEnvironments.forEach(async privateEnv => {
    const { kvPairData, data } = privateEnv;
    if (vaultEnvironmentPath in data) {
      const { [vaultEnvironmentPath]: secretData, ...restData } = data;
      const filteredKvPairData = kvPairData?.filter(kvPair => kvPair.type !== EnvironmentKvPairDataType.SECRET);
      await update(privateEnv, { data: restData, kvPairData: filteredKvPairData });
    }
  });
};

export function listByParentId(parentId: string) {
  return list(
    {
      parentId,
    },
    {
      metaSortKey: 1,
    },
  );
}

export async function getOrCreateForParentId(parentId: string) {
  const environments = await list({ parentId });

  if (!environments.length) {
    // Deterministic base env ID. It helps reduce sync complexity since we won't have to
    // de-duplicate environments.
    const baseEnvironmentId = `${prefix}_${crypto.createHash('sha1').update(parentId).digest('hex')}`;
    try {
      const baseEnvironment = await create({
        parentId,
        name: 'Base Environment',
        // set default environment type to key-value type
        environmentType: EnvironmentType.KVPAIR,
        _id: baseEnvironmentId,
      });

      return baseEnvironment;
    } catch (e) {
      const existingEnvironment = await getById(baseEnvironmentId);

      if (existingEnvironment) {
        return existingEnvironment;
      }

      throw e;
    }
  }

  return environments[environments.length - 1];
}

export function getById(id: string): Promise<Environment | undefined> {
  return get({ _id: id });
}

export function getByParentId(parentId: string): Promise<Environment | undefined> {
  return get({ parentId });
}

export async function duplicate(environment: Environment) {
  const name = `${environment.name} (Copy)`;
  // Get sort key of next environment
  const q = {
    metaSortKey: {
      $gt: environment.metaSortKey,
    },
  };
  const nextEnvironment = await get(q, { metaSortKey: 1 });
  const nextSortKey = nextEnvironment ? nextEnvironment.metaSortKey : environment.metaSortKey + 100;
  // Calculate new sort key
  const metaSortKey = (environment.metaSortKey + nextSortKey) / 2;
  return db.duplicate(environment, {
    name,
    metaSortKey,
  });
}
