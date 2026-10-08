import type { StorageRules } from 'insomnia-api';
import { models } from 'insomnia-data';
import React, { type FC } from 'react';
import { Heading } from 'react-aria-components';
import { useParams } from 'react-router';

import { useRootLoaderData } from '~/root';
import { useGitCredentials } from '~/ui/hooks/use-git-credentials';

import { ProjectCreateForm } from '../project/project-create-form';

interface Props {
  storageRules: StorageRules;
}

export const NoProjectView: FC<Props> = ({ storageRules }) => {
  const { organizationId } = useParams() as { organizationId: string };
  const { settings } = useRootLoaderData()!;
  const { credentials, providers } = useGitCredentials();

  // Konnect projects come exclusively from sync, so there is nothing for the user to create here.
  if (models.organization.isKonnectOrganizationId(organizationId)) {
    return (
      <div className="flex h-full w-full flex-col items-center gap-3 pt-[15%] text-center text-(--color-font)">
        <span className="text-xl font-semibold">No control planes synced yet</span>
        <span className="max-w-md text-(--hl)">
          Projects here mirror your Konnect control planes.
          {settings.hasKonnectPat
            ? ' Sync from Konnect to pull them in.'
            : ' Connect a Konnect personal access token from the sidebar to get started.'}
        </span>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto text-(--color-font)">
      <div className="mx-auto flex w-[min(700px,100%)] flex-col gap-4 p-16">
        <div>
          <p className="mb-3 text-3xl font-semibold">Welcome to your organization!</p>
          <Heading className="mb-3">Create a new project to get started</Heading>
        </div>
        <ProjectCreateForm
          storageRules={storageRules}
          defaultProjectName="My first project"
          credentials={credentials}
          providers={providers}
        />
      </div>
    </div>
  );
};
