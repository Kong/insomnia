import React, { Fragment } from 'react';
import { FC } from 'react';

import {
  ACTIVITY_DEBUG,
  ACTIVITY_SPEC,
  GlobalActivity,
} from '../../common/constants';
import { fuzzyMatchAll } from '../../common/misc';
import { strings } from '../../common/strings';
import { ApiSpec } from '../../models/api-spec';
import { Project } from '../../models/project';
import { isDesign, Workspace } from '../../models/workspace';
import { Highlight } from './base/highlight';
import { Card } from './card';
import { WorkspaceCardDropdown } from './dropdowns/workspace-card-dropdown';
import { TimeFromNow } from './time-from-now';

export interface WorkspaceCardProps {
  apiSpec: ApiSpec;
  workspace: Workspace;
  filter: string;
  activeProject: Project;
  lastActiveBranch?: string | null;
  lastModifiedTimestamp: number;
  lastCommitTime?: number | null;
  lastCommitAuthor?: string | null;
  modifiedLocally?: number;
  spec: Record<string, any> | null;
  specFormat: 'openapi' | 'swagger' | null;
  specFormatVersion: string | null;
  hasUnsavedChanges: boolean;
  onSelect: (workspaceId: string, activity: GlobalActivity) => void;
}

/** note: numbers are not technically valid (and, indeed, we throw a lint error), but we need to handle this case otherwise a user will not be able to import a spec with a malformed version and even _see_ that it's got the error. */
export const getVersionDisplayment = (version?: string | number | null) => {
  if (version === null || version === undefined || version === '') {
    return version;
  }

  if (typeof version === 'number') {
    console.warn(`OpenAPI documents must not use number data types for $.info.version, found ${version}`);
    version = String(version);
  } else if (typeof version !== 'string') {
    console.error('unable to parse spec version');
    return '';
  }

  if (!version.startsWith('v')) {
    return `v${version}`;
  }

  return version;
};

export const WorkspaceCard: FC<WorkspaceCardProps> = ({
  apiSpec,
  filter,
  lastActiveBranch,
  lastModifiedTimestamp,
  workspace,
  activeProject,
  lastCommitTime,
  modifiedLocally,
  lastCommitAuthor,
  spec,
  specFormat,
  specFormatVersion,
  hasUnsavedChanges,
  onSelect,
}) => {
  let branch = lastActiveBranch;

  let log = <TimeFromNow timestamp={lastModifiedTimestamp} />;

  if (hasUnsavedChanges) {
    // Show locally unsaved changes for spec
    // NOTE: this doesn't work for non-spec workspaces
    branch = lastActiveBranch + '*';
    if (modifiedLocally) {
      log = (
        <Fragment>
          <TimeFromNow
            className="text-danger"
            timestamp={modifiedLocally}
          />{' '}
          (unsaved)
        </Fragment>
      );
    }
  } else if (lastCommitTime) {
    // Show last commit time and author
    log = (
      <Fragment>
        <TimeFromNow timestamp={lastCommitTime} />{' '}
        {lastCommitAuthor && `by ${lastCommitAuthor}`}
      </Fragment>
    );
  }
  const docMenu = (
    <WorkspaceCardDropdown
      apiSpec={apiSpec}
      workspace={workspace}
      project={activeProject}
    />
  );

  const version = getVersionDisplayment(spec?.info?.version);
  let label: string = strings.collection.singular;
  let format = '';
  let labelIcon = <i className="fa fa-bars" />;
  let defaultActivity = ACTIVITY_DEBUG;
  let title = workspace.name;

  if (isDesign(workspace)) {
    label = strings.document.singular;
    labelIcon = <i className="fa fa-file-o" />;

    if (specFormat === 'openapi') {
      format = `OpenAPI ${specFormatVersion}`;
    } else if (specFormat === 'swagger') {
      // NOTE: This is not a typo, we're labeling Swagger as OpenAPI also
      format = `OpenAPI ${specFormatVersion}`;
    }

    defaultActivity = ACTIVITY_SPEC;
    title = apiSpec.fileName || title;
  }

  // Filter the card by multiple different properties
  const matchResults = fuzzyMatchAll(filter, [title, label, branch || '', version || ''], {
    splitSpace: true,
    loose: true,
  });

  // Return null if we don't match the filter
  if (filter && !matchResults) {
    return null;
  }

  return (
    <Card
      docBranch={branch ? <Highlight search={filter} text={branch} /> : undefined}
      docTitle={title ? <Highlight search={filter} text={title} /> : undefined}
      docVersion={version ? <Highlight search={filter} text={version} /> : undefined}
      tagLabel={label ? (
        <>
          <span className="margin-right-xs">{labelIcon}</span>
          <Highlight search={filter} text={label} />
        </>
      ) : undefined}
      docLog={log}
      docMenu={docMenu}
      docFormat={format}
      onClick={() => onSelect(workspace._id, defaultActivity)}
    />
  );
};
