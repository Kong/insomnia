import React, { useEffect } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useNavigation } from 'react-router';

import type { StorageRules } from '~/models/organization';
import { useActiveView } from '~/ui/components/project/utils';

import type { GitRepository } from '../../../models/git-repository';
import type { Project } from '../../../models/project';
import { Icon } from '../icon';
import { ProjectCreateForm } from '../project/project-create-form';
import { ProjectSettingsForm } from '../project/project-settings-form';

export const ProjectModal = ({
  isOpen,
  onOpenChange,
  storageRules,
  isGitSyncEnabled,
  project,
  gitRepository,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  storageRules: StorageRules;
  isGitSyncEnabled: boolean;
  project?: Project;
  gitRepository?: GitRepository;
}) => {
  // Close the modal when a navigation happens
  const activeNavigation = useNavigation();

  useEffect(() => {
    if (activeNavigation && activeNavigation.state !== 'idle' && activeNavigation.location && isOpen) {
      onOpenChange(false);
    }
  }, [activeNavigation, isOpen, onOpenChange]);

  const activeViewObj = useActiveView();

  let title = '';
  if (project) {
    title = 'Project settings';
  } else {
    title = activeViewObj.activeView === 'git-results' ? 'Create Git Sync project' : 'Create project';
  }

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed top-0 right-0 bottom-0 left-0 z-10 flex items-start justify-center bg-black/30 pt-[70px]"
    >
      <Modal className="flex max-h-[calc(var(--visual-viewport-height)-140px)] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) text-(--color-font)">
        <Dialog
          aria-label="Create or update dialog"
          className="grid flex-1 grid-rows-[min-content_1fr] gap-4 overflow-hidden p-10 outline-hidden"
        >
          {({ close }) => (
            <>
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="text-2xl">
                  {title}
                </Heading>
                <Button
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              {project ? (
                <ProjectSettingsForm
                  storageRules={storageRules}
                  isGitSyncEnabled={isGitSyncEnabled}
                  project={project}
                  gitRepository={gitRepository}
                  onCancel={close}
                  onSuccessUpdate={close}
                />
              ) : (
                <ProjectCreateForm
                  storageRules={storageRules}
                  isGitSyncEnabled={isGitSyncEnabled}
                  onCancel={close}
                  activeViewObj={activeViewObj}
                />
              )}
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
