import { Card } from 'insomnia-components';
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

  const version = spec?.info?.version || '';
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
  const matchResults = fuzzyMatchAll(filter, [title, label, branch, version], {
    splitSpace: true,
    loose: true,
  });

  // Return null if we don't match the filter
  if (filter && !matchResults) {
    return null;
  }

  return (
    <Card
      docBranch={
        branch ? <Highlight search={filter} text={branch} /> : undefined
      }
      docTitle={title ? <Highlight search={filter} text={title} /> : undefined}
      docVersion={
        version ? <Highlight search={filter} text={`v${version}`} /> : undefined
      }
      tagLabel={
        label ? (
          <>
            <span className="margin-right-xs">{labelIcon}</span>
            <Highlight search={filter} text={label} />
          </>
        ) : undefined
      }
      docLog={log}
      docMenu={docMenu}
      docFormat={format}
      onClick={() => onSelect(workspace._id, defaultActivity)}
    />
  );
};
