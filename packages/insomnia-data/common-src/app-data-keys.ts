export const organizationDataKeys = {
  all: ['organization-data'],
  byOrganizationId: (organizationId: string) => [...organizationDataKeys.all, organizationId],
};

export const workspaceChildrenKeys = {
  all: ['workspaceChildrenAndMetas'],
  byWorkspaceId: (workspaceId: string) => [...workspaceChildrenKeys.all, workspaceId],
};
