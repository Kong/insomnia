import {
  exportGlobalEnvironmentToFile,
  exportMcpClientToFile,
  exportMockServerToFile,
} from 'insomnia/src/ui/components/settings/import-export';
import React, { type FC, Fragment, useCallback, useState } from 'react';
import { Button, Dialog, Heading, Label, Modal, ModalOverlay, Radio, RadioGroup } from 'react-aria-components';
import { href, useParams } from 'react-router';

import type { ApiSpec, MockServer, Project, Workspace } from '~/insomnia-data';
import { models } from '~/insomnia-data';
import { useWorkspaceDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.delete';
import { useWorkspaceUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.update';
import { useTabNavigate } from '~/ui/hooks/use-insomnia-tab';

import { parseApiSpec } from '../../../common/api-specs';
import { getProductName } from '../../../common/constants';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
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
import { ImportModal } from '../modals/import-modal/import-modal';
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
    if (workspace.scope === models.workspace.WorkspaceScopeKeys.design) {
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
  const updateWorkspaceFetcher = useWorkspaceUpdateActionFetcher();
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isDeleteRemoteWorkspaceModalOpen, setIsDeleteRemoteWorkspaceModalOpen] = useState(false);
  const { organizationId, projectId } = useParams() as { organizationId: string; projectId: string };
  const tabNavigate = useTabNavigate();

  const openInNewTab = async () => {
    tabNavigate(
      {
        organization: organizationId,
        project: project,
        workspace: workspace,
        item: workspace,
      },
      {
        withTab: true,
        shouldNavigate: true,
      },
    );
  };

  const deleteWorkspaceFetcher = useWorkspaceDeleteActionFetcher();

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
            className="flex flex-1 items-center justify-center gap-2 rounded-xs px-4 py-1 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
          >
            <SvgIcon icon="ellipsis" />
          </Button>
        }
      >
        <DropdownItem aria-label="Open in New Tab">
          <ItemContent label="Open in New Tab" icon="external-link-alt" onClick={openInNewTab} />
        </DropdownItem>
        {!models.workspace.isMcp(workspace) && (
          <DropdownItem aria-label="Duplicate / Move">
            <ItemContent label="Duplicate / Move" icon="copy" onClick={() => setIsDuplicateModalOpen(true)} />
          </DropdownItem>
        )}
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
                  updateWorkspaceFetcher.submit({
                    organizationId,
                    projectId,
                    patch: {
                      name,
                      workspaceId: workspace._id,
                    },
                  }),
              });
            }}
          />
        </DropdownItem>
        <DropdownSection aria-label="Meta section">
          {!models.workspace.isMcp(workspace) ? (
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
          ) : null}
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
                if (workspace.scope === 'mcp') {
                  return exportMcpClientToFile(workspace);
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
          className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
        >
          <Modal
            onOpenChange={() => {
              setIsDeleteRemoteWorkspaceModalOpen(false);
            }}
            className="max-h-full w-full max-w-2xl rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)"
          >
            <Dialog className="outline-hidden">
              {({ close }) => (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-2">
                    <Heading className="text-2xl">Delete {getWorkspaceLabel(workspace).singular}</Heading>
                    <Button
                      className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                      onPress={close}
                    >
                      <Icon icon="x" />
                    </Button>
                  </div>
                  <deleteWorkspaceFetcher.Form
                    action={href(`/organization/:organizationId/project/:projectId/workspace/delete`, {
                      organizationId,
                      projectId: workspace.parentId,
                    })}
                    method="POST"
                    className="flex flex-col gap-4"
                  >
                    <input type="hidden" name="workspaceId" value={workspace._id} />
                    <div>
                      <p className="line-clamp-5">
                        This will permanently delete the{' '}
                        <strong className="break-all whitespace-pre-wrap">{workspace?.name}</strong>{' '}
                        {getWorkspaceLabel(workspace).singular}
                      </p>
                      {models.project.isRemoteProject(project) && (
                        <RadioGroup name="localOnly" defaultValue="true" className="mb-2 flex flex-col gap-2">
                          <Label className="text-sm text-(--hl)">How do you want to delete it?</Label>
                          <div className="flex gap-2">
                            <Radio
                              value="true"
                              aria-label="Remove Local Copy"
                              className="flex-1 rounded-sm border border-solid border-(--hl-md) p-4 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
                            >
                              <div>
                                <Heading className="text-lg font-bold">Remove Local Copy</Heading>
                                <p className="pt-2">The project will still exist on the Cloud.</p>
                              </div>
                            </Radio>
                            <Radio
                              value="false"
                              aria-label="Delete Permanently"
                              className="flex-1 rounded-sm border border-solid border-(--hl-md) p-4 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
                            >
                              <div>
                                <Heading className="text-lg font-bold">Delete Permanently</Heading>
                                <p className="pt-2">
                                  The project will be deleted everywhere. You cannot undo this action.
                                </p>
                              </div>
                            </Radio>
                          </div>
                        </RadioGroup>
                      )}
                    </div>
                    {deleteWorkspaceFetcher.data && deleteWorkspaceFetcher.data.error && (
                      <p className="notice error margin-bottom-sm no-margin-top">{deleteWorkspaceFetcher.data.error}</p>
                    )}
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        aria-label="Delete Workspace"
                        className="rounded-xs border border-solid border-(--hl-md) bg-(--color-danger) px-3 py-2 text-(--color-font-danger) transition-colors hover:bg-(--color-danger)/90 hover:no-underline"
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
