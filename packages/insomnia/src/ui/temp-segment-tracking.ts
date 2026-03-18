import { database } from '~/common/database';
import { type Environment, models, type Project, type Workspace } from '~/insomnia-data';
import { hasTrackedToday, markTrackedToday, SegmentEvent } from '~/ui/analytics';

const TEMP_ORG_OPENED_PREFIX = 'temp_org_opened:';
const TEMP_PROJECT_OPENED_PREFIX = 'temp_project_opened:';

export interface OrganizationOpenedProperties extends Record<string, unknown> {
  project_count_total: number;
  project_count_local: number;
  project_count_cloud: number;
  project_count_git: number;
}

export interface ProjectOpenedProperties extends Record<string, unknown> {
  collection_count: number;
  document_count: number;
  mock_count: number;
  environment_count: number;
  mcp_client_count: number;
}

export async function trackTempOrganizationOpened(organizationId: string): Promise<void> {
  const trackingKey = `${TEMP_ORG_OPENED_PREFIX}${organizationId}`;

  if (hasTrackedToday(trackingKey)) {
    return;
  }

  const projects = await database.find<Project>(models.project.type, {
    parentId: organizationId,
  });

  const properties: OrganizationOpenedProperties = {
    project_count_total: projects.length,
    project_count_local: projects.filter(p => models.project.isLocalProject(p) && !models.project.isGitProject(p)).length,
    project_count_cloud: projects.filter(p => models.project.isRemoteProject(p)).length,
    project_count_git: projects.filter(p => models.project.isGitProject(p)).length,
  };

  window.main.trackSegmentEvent({ event: SegmentEvent.tempOrganizationOpened, properties });
  markTrackedToday(trackingKey);
}

export async function trackTempProjectOpened(projectId: string): Promise<void> {
  const trackingKey = `${TEMP_PROJECT_OPENED_PREFIX}${projectId}`;

  if (hasTrackedToday(trackingKey)) {
    return;
  }

  const workspaces = await database.find<Workspace>(models.workspace.type, {
    parentId: projectId,
  });

  const workspaceIds = workspaces.map(w => w._id);

  const baseEnvironments = await database.find<Environment>(models.environment.type, {
    parentId: { $in: workspaceIds },
  });

  const baseEnvironmentIds = baseEnvironments.map(e => e._id);

  const subEnvironments = await database.find<Environment>(models.environment.type, {
    parentId: { $in: baseEnvironmentIds },
  });

  const totalEnvironmentCount = baseEnvironments.length + subEnvironments.length;

  const properties: ProjectOpenedProperties = {
    collection_count: workspaces.filter(w => w.scope === 'collection').length,
    document_count: workspaces.filter(w => w.scope === 'design').length,
    mock_count: workspaces.filter(w => w.scope === 'mock-server').length,
    environment_count: totalEnvironmentCount,
    mcp_client_count: workspaces.filter(w => w.scope === 'mcp').length,
  };

  window.main.trackSegmentEvent({ event: SegmentEvent.tempProjectOpened, properties });
  markTrackedToday(trackingKey);
}
