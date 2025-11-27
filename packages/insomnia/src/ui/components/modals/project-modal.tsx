import React, { useEffect } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useNavigation } from 'react-router';

import type { StorageRules } from '~/models/organization';

import type { GitRepository } from '../../../models/git-repository';
import type { Project } from '../../../models/project';
import { Icon } from '../icon';
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

  const title = project ? 'Update project' : 'Create a new project';

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
    >
      <Modal className="flex max-h-[90dvh] min-h-[420px] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) text-(--color-font)">
        <Dialog
          aria-label="Create or update dialog"
          className="grid flex-1 grid-rows-[min-content_1fr_min-content] gap-4 px-10 pt-10 outline-hidden"
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
              <ProjectSettingsForm
                storageRules={storageRules}
                isGitSyncEnabled={isGitSyncEnabled}
                project={project}
                gitRepository={gitRepository}
                onCancel={close}
                onSuccessUpdate={() => onOpenChange(false)}
              />
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};
