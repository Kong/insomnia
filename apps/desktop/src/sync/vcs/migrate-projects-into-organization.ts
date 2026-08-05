import type { RemoteProject } from 'insomnia-data';
import { models, services } from 'insomnia-data';

// Migration:
// Team ~= Project > Workspaces
// In the previous API: { _id: 'proj_team_123', remoteId: 'team_123', parentId: null }

// Organization > TeamProject > Workspaces
// In the new API: { _id: 'proj_team_123', remoteId: 'proj_team_123', parentId: 'team_123' }

// the remote id field previously tracked "team_id"
// (remote concept for matching 1:1 with this project) which is now org_id
// the _id field previously tracked the "proj_team_id"
// which was a wrapper for the team_id prefixing proj_to the above id,
// which is now the remoteId for tracking the projects within an org

export const shouldMigrateProjectUnderOrganization = async () => {
  const [localProjectCount, legacyRemoteProjectCount] = await Promise.all([
    services.project.count({
      remoteId: null,
      parentId: null,
    }),
    services.project.count({
      remoteId: { $ne: null },
      parentId: null,
    }),
  ]);

  return localProjectCount > 0 || legacyRemoteProjectCount > 0;
};

export const migrateProjectsIntoOrganization = async ({
  personalOrganizationId,
}: {
  personalOrganizationId: string;
}) => {
  // Legacy remote projects without organizations
  // Local projects without organizations except scratchpad
  const [legacyRemoteProjects, localProjects] = await Promise.all([
    services.project.list({
      remoteId: { $ne: null },
      parentId: null,
    }) as Promise<RemoteProject[]>,
    services.project.list({
      remoteId: null,
      parentId: null,
      _id: { $ne: models.project.SCRATCHPAD_PROJECT_ID },
    }),
  ]);

  const updatePromises = [];
  // Legacy remoteId should be orgId and legacy _id should be remoteId
  for (const remoteProject of legacyRemoteProjects) {
    updatePromises.push(
      services.project.update(remoteProject, {
        parentId: remoteProject.remoteId,
        remoteId: remoteProject._id,
      }),
    );
  }

  // Assign all local projects to personal organization
  for (const localProject of localProjects) {
    updatePromises.push(
      services.project.update(localProject, {
        parentId: personalOrganizationId,
      }),
    );
  }

  await Promise.all(updatePromises);
};
