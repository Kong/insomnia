import { fetch } from './fetch';

interface TeamProjects {
  data: {
    id: string;
    name: string;
  }[];
}

export const fetchTeamProjects = ({ sessionId, organizationId }: { sessionId: string; organizationId: string }) => {
  return fetch<TeamProjects>({
    method: 'GET',
    path: `/v1/organizations/${organizationId}/team-projects`,
    sessionId,
  });
};

export const deleteTeamProject = ({
  sessionId,
  organizationId,
  projectRemoteId,
}: {
  sessionId: string;
  organizationId: string;
  projectRemoteId: string;
}) => {
  return fetch({
    method: 'DELETE',
    path: `/v1/organizations/${organizationId}/team-projects/${projectRemoteId}`,
    sessionId,
  });
};

export const createTeamProject = ({
  sessionId,
  organizationId,
  name,
}: {
  sessionId: string;
  organizationId: string;
  name: string;
}) => {
  return fetch<{ id: string; name: string }>({
    method: 'POST',
    path: `/v1/organizations/${organizationId}/team-projects`,
    data: {
      name,
    },
    sessionId,
  });
};

export const updateTeamProject = ({
  organizationId,
  projectRemoteId,
  sessionId,
  name,
}: {
  organizationId: string;
  projectRemoteId: string;
  sessionId: string;
  name: string;
}) => {
  return fetch({
    method: 'PATCH',
    path: `/v1/organizations/${organizationId}/team-projects/${projectRemoteId}`,
    sessionId,
    data: {
      name,
    },
  });
};

export const updateGitProjectCount = async ({
  organizationId,
  sessionId,
  gitProjectsCount,
}: {
  organizationId: string;
  sessionId: string;
  gitProjectsCount: number;
}) => {
  return fetch({
    method: 'PATCH',
    path: `/v1/organizations/${organizationId}/git-projects`,
    sessionId,
    data: {
      count: gitProjectsCount,
    },
  });
};
