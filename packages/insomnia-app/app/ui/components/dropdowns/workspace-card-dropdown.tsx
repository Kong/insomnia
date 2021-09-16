import { SvgIcon } from 'insomnia-components';
import React, { FC, useCallback, useState } from 'react';

import { parseApiSpec } from '../../../common/api-specs';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import * as models from '../../../models';
import type { ApiSpec } from '../../../models/api-spec';
import getWorkspaceName from '../../../models/helpers/get-workspace-name';
import * as workspaceOperations from '../../../models/helpers/workspace-operations';
import { Project } from '../../../models/project';
import type { Workspace } from '../../../models/workspace';
import { WorkspaceScopeKeys } from '../../../models/workspace';
import type { DocumentAction } from '../../../plugins';
import { getDocumentActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context';
import { useLoadingRecord } from '../../hooks/use-loading-record';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { showError, showModal, showPrompt } from '../modals';
import AskModal from '../modals/ask-modal';
import { showWorkspaceDuplicateModal } from '../modals/workspace-duplicate-modal';

interface Props {
  workspace: Workspace;
  apiSpec: ApiSpec;
  project: Project;
}

const spinner = <i className="fa fa-refresh fa-spin" />;

const useWorkspaceHandlers = ({ workspace, apiSpec }: Props) => {
  const handleDuplicate = useCallback(() => {
    showWorkspaceDuplicateModal({ workspace, apiSpec });
  }, [apiSpec, workspace]);

  const handleRename = useCallback(() => {
    showPrompt({
      title: `Rename ${getWorkspaceLabel(workspace).singular}`,
      defaultValue: getWorkspaceName(workspace, apiSpec),
      submitName: 'Rename',
      selectText: true,
      label: 'Name',
      onComplete: async name => {
        await workspaceOperations.rename(workspace, apiSpec, name);
      },
    });
  }, [apiSpec, workspace]);

  const handleDelete = useCallback(() => {
    const label = getWorkspaceLabel(workspace);
    showModal(AskModal, {
      title: `Delete ${label.singular}`,
      message: `Do you really want to delete "${getWorkspaceName(workspace, apiSpec)}"?`,
      yesText: 'Yes',
      noText: 'Cancel',
      onDone: async (isYes: boolean) => {
        if (!isYes) {
          return;
        }

        await models.stats.incrementDeletedRequestsForDescendents(workspace);
        await models.workspace.remove(workspace);
      },
    });
  }, [apiSpec, workspace]);

  return { handleDelete, handleDuplicate, handleRename };
};

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
      // @ts-expect-error -- TSCONVERSION
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
      value={p}
      onClick={handleClick}
      stayOpenAfterClick={!p.hideAfterClick}
    >
      {isLoading(p.label) && spinner}
      {p.label}
    </DropdownItem>
  )), [actionPlugins, handleClick, isLoading]);

  return { renderPluginDropdownItems, refresh };
};

export const WorkspaceCardDropdown: FC<Props> = props => {
  const { handleDelete, handleDuplicate, handleRename } = useWorkspaceHandlers(props);
  const { refresh, renderPluginDropdownItems } = useDocumentActionPlugins(props);

  return (
    <Dropdown beside onOpen={refresh}>
      <DropdownButton><SvgIcon icon="ellipsis" /></DropdownButton>

      <DropdownItem onClick={handleDuplicate}>Duplicate</DropdownItem>
      <DropdownItem onClick={handleRename}>Rename</DropdownItem>

      {renderPluginDropdownItems()}

      <DropdownDivider />

      <DropdownItem className="danger" onClick={handleDelete}>Delete</DropdownItem>
    </Dropdown>
  );
};
