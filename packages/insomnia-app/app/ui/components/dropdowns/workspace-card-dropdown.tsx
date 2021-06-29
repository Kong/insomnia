import React, { FC, useCallback, useState } from 'react';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';
import { showError, showModal, showPrompt } from '../modals';
import type { DocumentAction } from '../../../plugins';
import { getDocumentActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import type { ApiSpec } from '../../../models/api-spec';
import { parseApiSpec } from '../../../common/api-specs';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import * as models from '../../../models';
import AskModal from '../modals/ask-modal';
import type { Workspace } from '../../../models/workspace';
import getWorkspaceName from '../../../models/helpers/get-workspace-name';
import * as workspaceOperations from '../../../models/helpers/workspace-operations';
import { WorkspaceScopeKeys } from '../../../models/workspace';
import { useDispatch } from 'react-redux';
import { setActiveWorkspace } from '../../redux/modules/global';
import { useLoadingRecord } from '../../hooks/use-loading-record';
import { SvgIcon } from 'insomnia-components';

interface Props {
  workspace: Workspace;
  apiSpec: ApiSpec;
}

const spinner = <i className="fa fa-refresh fa-spin" />;

const useWorkspaceHandlers = ({ workspace, apiSpec }: { workspace: Workspace; apiSpec: ApiSpec; }) => {
  const dispatch = useDispatch();

  const handleDuplicate = useCallback(() => {
    showPrompt({
      title: `Duplicate ${getWorkspaceLabel(workspace).singular}`,
      defaultValue: getWorkspaceName(workspace, apiSpec),
      submitName: 'Create',
      selectText: true,
      label: 'New Name',
      onComplete: async newName => {
        const newWorkspace = await workspaceOperations.duplicate(workspace, newName);
        dispatch(setActiveWorkspace(newWorkspace._id));
      },
    });
  }, [apiSpec, workspace, dispatch]);

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

const useDocumentActionPlugins = ({ workspace, apiSpec }: { workspace: Workspace; apiSpec: ApiSpec; }) => {
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
        ...pluginContexts.data.init(),
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
  }, [apiSpec.contents, startLoading, stopLoading]);

  const renderPluginDropdownItems = useCallback(() => actionPlugins.map(p => (
    <DropdownItem
      key={`${p.plugin.name}:${p.label}`}
      value={p}
      onClick={handleClick}
      stayOpenAfterClick={!p.hideAfterClick}>
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
