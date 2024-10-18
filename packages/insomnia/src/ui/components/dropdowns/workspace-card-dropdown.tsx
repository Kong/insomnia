import React, { type FC, Fragment, useCallback, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import { parseApiSpec } from '../../../common/api-specs';
import { getProductName } from '../../../common/constants';
import { exportGlobalEnvironmentToFile, exportMockServerToFile } from '../../../common/export';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { RENDER_PURPOSE_NO_RENDER } from '../../../common/render';
import type { ApiSpec } from '../../../models/api-spec';
import type { MockServer } from '../../../models/mock-server';
import { isRemoteProject, type Project } from '../../../models/project';
import type { Workspace } from '../../../models/workspace';
import { WorkspaceScopeKeys } from '../../../models/workspace';
import type { DocumentAction } from '../../../plugins';
import { getDocumentActions } from '../../../plugins';
import * as pluginContexts from '../../../plugins/context';
import { useLoadingRecord } from '../../hooks/use-loading-record';
import { Dropdown, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { Icon } from '../icon';
import { showError, showPrompt } from '../modals';
import { ExportRequestsModal } from '../modals/export-requests-modal';
import { ImportModal } from '../modals/import-modal';
import { WorkspaceDuplicateModal } from '../modals/workspace-duplicate-modal';
import { WorkspaceSettingsModal } from '../modals/workspace-settings-modal';
import { SvgIcon } from '../svg-icon';

interface Props {
  workspace: Workspace;
  apiSpec?: ApiSpec;
  mockServer?: MockServer;
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
      await p.action(context, parseApiSpec(apiSpec?.contents || ''));
    } catch (err) {
      showError({
        title: 'Document Action Failed',
        error: err,
      });
    } finally {
      stopLoading(p.label);
    }
  }, [apiSpec?.contents, project._id, startLoading, stopLoading]);

  const renderPluginDropdownItems: any = useCallback(() => actionPlugins.map(p => (
    <DropdownItem
      key={`${p.plugin.name}:${p.label}`}
      aria-label={p.label}
    >
      <ItemContent
        icon={isLoading(p.label) ? 'refresh fa-spin' : undefined}
        label={p.label}
        stayOpenAfterClick={!p.hideAfterClick}
        onClick={() => handleClick(p)}
      />
    </DropdownItem>
  )), [actionPlugins, handleClick, isLoading]);

  return { renderPluginDropdownItems, refresh };
};

export const WorkspaceCardDropdown: FC<Props> = props => {
  const { workspace, mockServer, project } = props;
  const fetcher = useFetcher();
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDeleteRemoteWorkspaceModalOpen, setIsDeleteRemoteWorkspaceModalOpen] = useState(false);
  const {
    organizationId,
    projectId,
  } = useParams() as { organizationId: string; projectId: string };

  const deleteWorkspaceFetcher = useFetcher();

  const workspaceName = workspace.name;
  const projectName = project.name ?? getProductName();
  const { refresh, renderPluginDropdownItems } = useDocumentActionPlugins(props);
  return (
    <Fragment>
      <Dropdown
        aria-label='Workspace Actions Dropdown'
        onOpen={refresh}
        triggerButton={
          <Button aria-label='Workspace actions menu button' className="px-4 py-1 flex flex-1 items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
            <SvgIcon icon="ellipsis" />
          </Button>
        }
      >
        <DropdownItem aria-label='Duplicate / Move'>
          <ItemContent
            label="Duplicate / Move"
            icon="copy"
            onClick={() => setIsDuplicateModalOpen(true)}
          />
        </DropdownItem>
        <DropdownItem aria-label='Rename'>
          <ItemContent
            label="Rename"
            icon="pen-to-square"
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
                      encType: 'application/json',
                    }
                  ),
              });
            }}
          />
        </DropdownItem>
        <DropdownSection aria-label='Meta section'>
          <DropdownItem aria-label='Import'>
            <ItemContent
              label="Import"
              icon="file-import"
              onClick={() => setIsImportModalOpen(true)}
            />
          </DropdownItem>
          <DropdownItem aria-label='Export'>
            <ItemContent
              label="Export"
              icon="file-export"
              onClick={() => {
                if (workspace.scope === 'mock-server') {
                  return exportMockServerToFile(workspace);
                }
                if (workspace.scope === 'environment') {
                  return exportGlobalEnvironmentToFile(workspace);
                }
                return setIsExportModalOpen(true);
              }}
            />
          </DropdownItem>
          <DropdownItem aria-label='Settings'>
            <ItemContent
              label="Settings"
              icon="gear"
              onClick={() => setIsSettingsModalOpen(true)}
            />
          </DropdownItem>
        </DropdownSection>
        {renderPluginDropdownItems()}

        <DropdownSection aria-label='Delete section'>
          <DropdownItem aria-label='Delete'>
            <ItemContent
              label="Delete"
              icon="trash-o"
              className="danger"
              onClick={() => {
                setIsDeleteRemoteWorkspaceModalOpen(true);
              }}
            />
          </DropdownItem>
        </DropdownSection>
      </Dropdown>
      {isDuplicateModalOpen && (
        <WorkspaceDuplicateModal
          onHide={() => setIsDuplicateModalOpen(false)}
          workspace={workspace}
        />
      )}
      {isImportModalOpen && (
        <ImportModal
          onHide={() => setIsImportModalOpen(false)}
          from={{ type: 'file' }}
          projectName={projectName}
          workspaceName={workspaceName}
          organizationId={organizationId}
          defaultProjectId={projectId}
          defaultWorkspaceId={workspace._id}
        />
      )}
      {isExportModalOpen && (
        <ExportRequestsModal
          workspaceIdToExport={workspace._id}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}
      {isSettingsModalOpen && (
        <WorkspaceSettingsModal
          workspace={workspace}
          mockServer={mockServer}
          onClose={() => setIsSettingsModalOpen(false)}
        />
      )}
      {isDeleteRemoteWorkspaceModalOpen && (
        <ModalOverlay
          isOpen
          onOpenChange={() => {
            setIsDeleteRemoteWorkspaceModalOpen(false);
          }}
          isDismissable
          className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30"
        >
          <Modal
            onOpenChange={() => {
              setIsDeleteRemoteWorkspaceModalOpen(false);
            }}
            className="max-w-2xl w-full rounded-md border border-solid border-[--hl-sm] p-[--padding-lg] max-h-full bg-[--color-bg] text-[--color-font]"
          >
            <Dialog
              className="outline-none"
            >
              {({ close }) => (
                <div className='flex flex-col gap-4'>
                  <div className='flex gap-2 items-center justify-between'>
                    <Heading className='text-2xl'>Delete {getWorkspaceLabel(workspace).singular}</Heading>
                    <Button
                      className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                      onPress={close}
                    >
                      <Icon icon="x" />
                    </Button>
                  </div>
                  <deleteWorkspaceFetcher.Form
                    action={`/organization/${organizationId}/project/${workspace.parentId}/workspace/delete`}
                    method="POST"
                    className='flex flex-col gap-4'
                  >
                    <input type="hidden" name="workspaceId" value={workspace._id} />
                    <p>
                      This will permanently delete the {<strong style={{ whiteSpace: 'pre-wrap' }}>{workspace?.name}</strong>}{' '}
                      {getWorkspaceLabel(workspace).singular} {isRemoteProject(project) ? 'remotely' : ''}.
                    </p>
                    {deleteWorkspaceFetcher.data && deleteWorkspaceFetcher.data.error && (
                      <p className="notice error margin-bottom-sm no-margin-top">
                        {deleteWorkspaceFetcher.data.error}
                      </p>
                    )}
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        className="hover:no-underline bg-[--color-danger] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-danger] transition-colors rounded-sm"
                      >
                        Delete
                      </Button>
                    </div>
                  </deleteWorkspaceFetcher.Form>
                </div>
              )}
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
      { }
    </Fragment>
  );
};
