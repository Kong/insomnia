import React, { useEffect } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useNavigation } from 'react-router-dom';

import type { GitRepository } from '../../../models/git-repository';
import type { Project } from '../../../models/project';
import type { StorageRules } from '../../routes/organization';
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
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30">
      <Modal
        className="max-w-3xl w-full rounded-md border border-solid border-[--hl-sm] max-h-[90dvh] min-h-[420px] bg-[--color-bg] text-[--color-font] flex flex-col overflow-hidden"
      >
        <Dialog
          aria-label='Create or update dialog'
          className="outline-none flex-1 gap-4 grid [grid-template-rows:min-content_1fr_min-content] pt-10 px-10"
        >
          {({ close }) => (
            <>
              <div className='flex gap-2 items-center justify-between'>
                <Heading slot="title" className='text-2xl'>{title}</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
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
