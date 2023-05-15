import React, { Fragment } from 'react';
import { FC } from 'react';
import { useFetcher } from 'react-router-dom';
import styled from 'styled-components';

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
import { BackendProject } from '../../sync/types';
import { Highlight } from './base/highlight';
import { Card } from './card';
import { WorkspaceCardDropdown } from './dropdowns/workspace-card-dropdown';
import { TimeFromNow } from './time-from-now';

const Label = styled.div({
  display: 'flex',
  alignItems: 'center',
  overflow: 'hidden',
  gap: 'var(--padding-sm)',
  height: '1.5rem',
  paddingRight: 'var(--padding-sm)',
});

const LabelIcon = styled.div({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.2rem',
  height: '1rem',
});

export interface WorkspaceMetadata {
  apiSpec: ApiSpec | null;
  workspace: Workspace;
  lastActiveBranch?: string | null;
  lastModifiedTimestamp: number;
  lastCommitTime?: number | null;
  lastCommitAuthor?: string | null;
  modifiedLocally?: number;
  spec: Record<string, any> | null;
  specFormat: 'openapi' | 'swagger' | null;
  specFormatVersion: string | null;
  hasUnsavedChanges: boolean;
}

export type WorkspaceCardProps = {
  filter: string;
  activeProject: Project;
  onSelect: (workspaceId: string, activity: GlobalActivity) => void;
  projects: Project[];
} & WorkspaceMetadata;

export type RemoteWorkspaceCardProps = {
  filter: string;
  onSelect: (backendProjectId: string) => void;
  remoteId: string;
  projectId: string;
  organizationId: string;
} & BackendProject;

/** note: numbers are not technically valid (and, indeed, we throw a lint error), but we need to handle this case otherwise a user will not be able to import a spec with a malformed version and even _see_ that it's got the error. */
export const getVersionDisplayment = (version?: string | number | null) => {
  if (version === null || version === undefined || version === '') {
    return version;
  }

  if (typeof version === 'number') {
    console.warn(
      `OpenAPI documents must not use number data types for $.info.version, found ${version}`
    );
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
  hasUnsavedChanges,
  spec,
  specFormat,
  specFormatVersion,
  lastCommitAuthor,
  lastCommitTime,
  modifiedLocally,
  lastActiveBranch,
  lastModifiedTimestamp,
  workspace,
  activeProject,
  projects,
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
          <TimeFromNow className="text-danger" timestamp={modifiedLocally} />{' '}
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
    title = apiSpec?.fileName || title;
  }

  // Filter the card by multiple different properties
  const matchResults = fuzzyMatchAll(
    filter,
    [title, label, branch || '', version || ''],
    {
      splitSpace: true,
      loose: true,
    }
  );

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
        version ? <Highlight search={filter} text={version} /> : undefined
      }
      tagLabel={
        label ? (
          <Label>
            <LabelIcon
              style={{
                color: isDesign(workspace) ? 'var(--color-font-info)' : 'var(--color-font-surprise)',
                backgroundColor: isDesign(workspace) ? 'var(--color-info)' : 'var(--color-surprise)',
              }}
            >{labelIcon}</LabelIcon>
            <Highlight search={filter} text={label} />
          </Label>
        ) : undefined
      }
      docLog={log}
      docMenu={
        <WorkspaceCardDropdown
          apiSpec={apiSpec}
          workspace={workspace}
          project={activeProject}
          projects={projects}
        />
      }
      docFormat={format}
      onClick={() => onSelect(workspace._id, defaultActivity)}
    />
  );
};

export const RemoteWorkspaceCard: FC<RemoteWorkspaceCardProps> = ({
  id,
  name,
  filter,
  remoteId,
  projectId,
  organizationId,
}) => {
  const { submit, state } = useFetcher();

  const isLoading = state !== 'idle';

  // Filter the card by multiple different properties
  const matchResults = fuzzyMatchAll(
    filter,
    [name],
    {
      splitSpace: true,
      loose: true,
    }
  );

  // Return null if we don't match the filter
  if (filter && !matchResults) {
    return null;
  }

  return (
    <div
      className={isLoading && 'fa-fade'}
      style={{
        opacity: isLoading ? 0.5 : 1,
        pointerEvents: isLoading ? 'none' : 'auto',
      }}
    >
      <Card
        docTitle={<Highlight search={filter} text={name} />}
        tagLabel={
          <Label>
            <LabelIcon
              style={{
                backgroundColor: 'var(--color-warning)',
                color: 'var(--color-font-warning)',
              }}
            ><i className={isLoading ? 'fa fa-spinner fa-spin' : 'fa fa-cloud-download'} /></LabelIcon>
            <Highlight search={filter} text={'Remote'} />
          </Label>
        }
        onClick={() => {
          submit(
            {
              remoteId,
              backendProjectId: id,
            },
            {
              action: `/organization/${organizationId}/project/${projectId}/remote-collections/pull`,
              method: 'post',
            }
          );
        }}
      />
    </div>
  );
};
