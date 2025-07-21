import {
  exportGlobalEnvironmentToFile,
  exportMockServerToFile,
} from 'insomnia/src/ui/components/settings/import-export';
import React, { type FC, Fragment, useCallback, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router';

import { parseApiSpec } from '../../../common/api-specs';
import { getProductName } from '../../../common/constants';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import type { ApiSpec } from '../../../models/api-spec';
import type { MockServer } from '../../../models/mock-server';
import { isRemoteProject, type Project } from '../../../models/project';
import type { Workspace } from '../../../models/workspace';
import { WorkspaceScopeKeys } from '../../../models/workspace';
import type { DocumentAction } from '../../../plugins';
import { getDocumentActions } from '../../../plugins';
import * as pluginApp from '../../../plugins/context/app';
import * as pluginData from '../../../plugins/context/data';
import * as pluginStore from '../../../plugins/context/store';
import { SegmentEvent } from '../../analytics';
import { useLoadingRecord } from '../../hooks/use-loading-record';
import { Dropdown, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { Icon } from '../icon';
import { showError, showModal } from '../modals';
import { ExportRequestsModal } from '../modals/export-requests-modal';
import { ImportModal } from '../modals/import-modal';
import { PromptModal } from '../modals/prompt-modal';
import { WorkspaceDuplicateModal } from '../modals/workspace-duplicate-modal';
import { WorkspaceSettingsModal } from '../modals/workspace-settings-modal';
import { SvgIcon } from '../svg-icon';

interface Props {
  workspace: Workspace;
  gitFilePath?: string;
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

  const handleClick = useCallback(
    async (p: DocumentAction) => {
      startLoading(p.label);

      try {
        const context = {
          ...pluginApp.init(),
          ...pluginData.init(project._id),
          ...pluginStore.init(p.plugin),
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
    },
    [apiSpec?.contents, project._id, startLoading, stopLoading],
  );

  const renderPluginDropdownItems: any = useCallback(
    () =>
      actionPlugins.map(p => (
        <DropdownItem key={`${p.plugin.name}:${p.label}`} aria-label={p.label}>
          <ItemContent
            icon={isLoading(p.label) ? 'refresh fa-spin' : undefined}
            label={p.label}
            stayOpenAfterClick={!p.hideAfterClick}
            onClick={() => handleClick(p)}
          />
        </DropdownItem>
      )),
    [actionPlugins, handleClick, isLoading],
  );

  return { renderPluginDropdownItems, refresh };
};

export const WorkspaceCardDropdown: FC<Props> = props => {
  const { workspace, mockServer, project, gitFilePath } = props;
  const fetcher = useFetcher();
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDeleteRemoteWorkspaceModalOpen, setIsDeleteRemoteWorkspaceModalOpen] = useState(false);
  const { organizationId, projectId } = useParams() as { organizationId: string; projectId: string };

  const deleteWorkspaceFetcher = useFetcher();

  const workspaceName = workspace.name;
  const projectName = project.name ?? getProductName();
  const { refresh, renderPluginDropdownItems } = useDocumentActionPlugins(props);
  return (
    <Fragment>
      <Dropdown
        aria-label="Workspace Actions Dropdown"
        onOpen={refresh}
        triggerButton={
          <Button
            aria-label="Workspace actions menu button"
            className="flex flex-1 items-center justify-center gap-2 rounded-sm px-4 py-1 text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
          >
            <SvgIcon icon="ellipsis" />
          </Button>
        }
      >
        <DropdownItem aria-label="Duplicate / Move">
          <ItemContent label="Duplicate / Move" icon="copy" onClick={() => setIsDuplicateModalOpen(true)} />
        </DropdownItem>
        <DropdownItem aria-label="Rename">
          <ItemContent
            label="Rename"
            icon="pen-to-square"
            onClick={() => {
              showModal(PromptModal, {
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
                    },
                  ),
              });
            }}
          />
        </DropdownItem>
        <DropdownSection aria-label="Meta section">
          <DropdownItem aria-label="Import">
            <ItemContent
              label="Import"
              icon="file-import"
              onClick={() => {
                window.main.trackSegmentEvent({
                  event: SegmentEvent.importStarted,
                  properties: {
                    source: `${workspace.scope}-list`,
                  },
                });

                setIsImportModalOpen(true);
              }}
            />
          </DropdownItem>
          <DropdownItem aria-label="Export">
            <ItemContent
              label="Export"
              icon="file-export"
              onClick={() => {
                window.main.trackSegmentEvent({
                  event: SegmentEvent.exportStarted,
                  properties: {
                    source: `${workspace.scope}-list`,
                  },
                });

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
          <DropdownItem aria-label="Settings">
            <ItemContent label="Settings" icon="gear" onClick={() => setIsSettingsModalOpen(true)} />
          </DropdownItem>
        </DropdownSection>
        {renderPluginDropdownItems()}

        <DropdownSection aria-label="Delete section">
          <DropdownItem aria-label="Delete">
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
        <WorkspaceDuplicateModal onHide={() => setIsDuplicateModalOpen(false)} workspace={workspace} />
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
        <ExportRequestsModal workspaceIdToExport={workspace._id} onClose={() => setIsExportModalOpen(false)} />
      )}
      {isSettingsModalOpen && (
        <WorkspaceSettingsModal
          workspace={workspace}
          mockServer={mockServer}
          gitFilePath={gitFilePath}
          project={project}
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
          className="fixed left-0 top-0 z-10 flex h-[--visual-viewport-height] w-full items-center justify-center bg-black/30"
        >
          <Modal
            onOpenChange={() => {
              setIsDeleteRemoteWorkspaceModalOpen(false);
            }}
            className="max-h-full w-full max-w-2xl rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] p-[--padding-lg] text-[--color-font]"
          >
            <Dialog className="outline-none">
              {({ close }) => (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-2">
                    <Heading className="text-2xl">Delete {getWorkspaceLabel(workspace).singular}</Heading>
                    <Button
                      className="flex aspect-square h-6 flex-shrink-0 items-center justify-center rounded-sm text-sm text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                      onPress={close}
                    >
                      <Icon icon="x" />
                    </Button>
                  </div>
                  <deleteWorkspaceFetcher.Form
                    action={`/organization/${organizationId}/project/${workspace.parentId}/workspace/delete`}
                    method="POST"
                    className="flex flex-col gap-4"
                  >
                    <input type="hidden" name="workspaceId" value={workspace._id} />
                    <p>
                      This will permanently delete the{' '}
                      {<strong style={{ whiteSpace: 'pre-wrap' }}>{workspace?.name}</strong>}{' '}
                      {getWorkspaceLabel(workspace).singular} {isRemoteProject(project) ? 'remotely' : ''}.
                    </p>
                    {deleteWorkspaceFetcher.data && deleteWorkspaceFetcher.data.error && (
                      <p className="notice error margin-bottom-sm no-margin-top">{deleteWorkspaceFetcher.data.error}</p>
                    )}
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        className="rounded-sm border border-solid border-[--hl-md] bg-[--color-danger] px-3 py-2 text-[--color-font-danger] transition-colors hover:bg-opacity-90 hover:no-underline"
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
      {}
    </Fragment>
  );
};
