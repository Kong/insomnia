import React, { FC, Fragment, useCallback, useState } from 'react';
import { useFetcher, useParams } from 'react-router-dom';

import { parseApiSpec } from '../../../common/api-specs';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import type { ApiSpec } from '../../../models/api-spec';
import getWorkspaceName from '../../../models/helpers/get-workspace-name';
import { Project } from '../../../models/project';
import type { Workspace } from '../../../models/workspace';
import { WorkspaceScopeKeys } from '../../../models/workspace';
import type { DocumentAction } from '../../../plugins';
import { getDocumentActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context';
import { useLoadingRecord } from '../../hooks/use-loading-record';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown/dropdown';
import { showError, showModal, showPrompt } from '../modals';
import { AskModal } from '../modals/ask-modal';
import { WorkspaceDuplicateModal } from '../modals/workspace-duplicate-modal';
import { SvgIcon } from '../svg-icon';

interface Props {
  workspace: Workspace;
  apiSpec: ApiSpec;
  project: Project;
  projects: Project[];
}

const useDocumentActionPlugins = ({ workspace, apiSpec, project }: Props) => {
  const [actionPlugins, setActionPlugins] = useState<DocumentAction[]>([]);
  const { startLoading, stopLoading, isLoading } = useLoadingRecord();

  const refresh = useCallback(async () => {
    // Only load document plugins if the scope is design, for now
    if (workspace.scope === WorkspaceScopeKeys.design) {
      setActionPlugins(await getDocumentActions());
    }
  }, [workspace.scope]);

  const handleClick = useCallback(async (p: DocumentAction) => {
    startLoading(p.label);

    try {
      const context = {
        ...pluginContexts.app.init(RENDER_PURPOSE_NO_RENDER),
        ...pluginContexts.data.init(project._id),
        ...pluginContexts.store.init(p.plugin),
      };
      await p.action(context, parseApiSpec(apiSpec.contents));
    } catch (err) {
      showError({
        title: 'Document Action Failed',
        error: err,
      });
    } finally {
      stopLoading(p.label);
    }
  }, [apiSpec.contents, project._id, startLoading, stopLoading]);

  const renderPluginDropdownItems = useCallback(() => actionPlugins.map(p => (
    <DropdownItem
      key={`${p.plugin.name}:${p.label}`}
    // stayOpenAfterClick={!p.hideAfterClick}
    >
      <ItemContent icon={isLoading(p.label) ? 'refresh fa-spin' : undefined} label={p.label} onClick={() => handleClick(p)} />
    </DropdownItem>
  )), [actionPlugins, handleClick, isLoading]);

  return { renderPluginDropdownItems, refresh };
};

export const WorkspaceCardDropdown: FC<Props> = props => {
  const { workspace, apiSpec, projects } = props;
  const { organizationId } = useParams<{ organizationId: string }>();
  const fetcher = useFetcher();
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  const workspaceName = getWorkspaceName(workspace, apiSpec);

  const { refresh, renderPluginDropdownItems } = useDocumentActionPlugins(props);

  return (
    <Fragment>
      <Dropdown
        onOpen={refresh}
        triggerButton={
          <DropdownButton variant='text'>
            <SvgIcon icon="ellipsis" />
          </DropdownButton>
        }
      >
        <DropdownItem>
          <ItemContent label="Duplicate" onClick={() => setIsDuplicateModalOpen(true)} />
        </DropdownItem>
        <DropdownItem>
          <ItemContent
            label="Rename"
            onClick={() => {
              showPrompt({
                title: `Rename ${getWorkspaceLabel(workspace).singular}`,
                defaultValue: workspaceName,
                submitName: 'Rename',
                selectText: true,
                label: 'Name',
                onComplete: name =>
                  fetcher.submit(
                    { name, workspaceId: workspace._id },
                    {
                      action: `/organization/${organizationId}/project/${workspace.parentId}/workspace/update`,
                      method: 'post',
                    }
                  ),
              });
            }}
          />
        </DropdownItem>

        {renderPluginDropdownItems()}

        <DropdownSection>
          <DropdownItem> {/* className="danger" */}
            <ItemContent
              label="Delete"
              className="danger"
              onClick={() => {
                const label = getWorkspaceLabel(workspace);
                showModal(AskModal, {
                  title: `Delete ${label.singular}`,
                  message: `Do you really want to delete "${workspaceName}"?`,
                  yesText: 'Yes',
                  noText: 'Cancel',
                  onDone: async (isYes: boolean) => {
                    if (!isYes) {
                      return;
                    }

                    fetcher.submit(
                      { workspaceId: workspace._id },
                      {
                        action: `/organization/${organizationId}/project/${workspace.parentId}/workspace/delete`,
                        method: 'post',
                      }
                    );
                  },
                });
              }}
            />
          </DropdownItem>
        </DropdownSection>
      </Dropdown>
      {isDuplicateModalOpen && (
        <WorkspaceDuplicateModal
          onHide={() => setIsDuplicateModalOpen(false)}
          workspace={workspace}
          projects={projects}
        />
      )}
    </Fragment>
  );
};
