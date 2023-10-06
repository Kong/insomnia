import React, { useEffect } from 'react';
import { Button, Heading } from 'react-aria-components';
import { ActionFunction, LoaderFunction, redirect, useFetcher } from 'react-router-dom';

import { getCurrentSessionId, logout } from '../../account/session';
import FileSystemDriver from '../../sync/store/drivers/file-system-driver';
import { migrateCollectionsIntoRemoteProject } from '../../sync/vcs/migrate-collections';
import { migrateLocalToCloudProjects, shouldRunMigration } from '../../sync/vcs/migrate-to-cloud-projects';
import { VCS } from '../../sync/vcs/vcs';
import { Icon } from '../components/icon';

export const loader: LoaderFunction = async () => {
  if (!shouldRunMigration()) {
    return redirect('/organization');
  }

  return null;
};

interface MigrationActionData {
  error?: string;
}

export const action: ActionFunction = async () => {
  const sessionId = getCurrentSessionId();
  if (!sessionId) {
    await logout();
    return redirect('/auth/login');
  }

  try {
    const driver = FileSystemDriver.create(process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'));
    const vcs = new VCS(driver);
    await migrateCollectionsIntoRemoteProject(vcs);
    await migrateLocalToCloudProjects(vcs);

    return redirect('/organization');
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Error while migrating data.',
    };
  }
};

export const Migrate = () => {
  const migrationFetcher = useFetcher<MigrationActionData>();
  const logoutFetcher = useFetcher();

  useEffect(() => {
    if (migrationFetcher.state === 'idle' && !migrationFetcher.data) {
      migrationFetcher.submit({}, {
        action: '/auth/migrate',
        method: 'post',
      });
    }
  }, [migrationFetcher]);

  const isMigrating = migrationFetcher.state !== 'idle';
  const error = migrationFetcher.data?.error;

  return (
    <div className="flex flex-col gap-[--padding-md] text-[--color-font]">
      <Heading className="text-2xl font-bold text-center px-3">
        Migrating data to Insomnia Cloud
      </Heading>
      {isMigrating && (
        <div className="flex flex-col gap-3 rounded-md bg-[--hl-sm] p-[--padding-md]">
          <Heading className="text-lg flex items-center p-8 gap-8">
            <Icon icon="spinner" className="fa-spin" />
            <span>Running migration...</span>
          </Heading>
        </div>
      )}
      {error && !isMigrating && (
        <div className="flex flex-col gap-3 rounded-md bg-[--hl-sm] p-[--padding-md]">
          <Heading className="text-lg flex items-center p-8 gap-8">
            <Icon icon="exclamation-circle" />
            <span>{error}</span>
          </Heading>
          <Button
            className="px-4 py-1 font-bold flex flex-1 items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
            onPress={() => {
              migrationFetcher.submit({}, {
                action: '/auth/migrate',
                method: 'post',
              });
            }}
          >
            <span>Try again</span>
          </Button>
          <Button
            className="px-4 py-1 font-bold flex flex-1 items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
            onPress={() => {
              logoutFetcher.submit({}, {
                action: '/auth/logout',
                method: 'POST',
              });
            }}
          >
            <span>Log out</span>
          </Button>
        </div>
      )}
    </div>
  );
};
