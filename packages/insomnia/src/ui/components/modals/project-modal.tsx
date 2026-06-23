import type { StorageRules } from 'insomnia-api';
import type { GitRepository, Project } from 'insomnia-data';
import React, { useEffect, useRef, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { useNavigation } from 'react-router';

import { useActiveView } from '~/ui/components/project/utils';
import { UnsavedChangesGuard } from '~/ui/components/unsaved-changes-guard';
import { useGitCredentials } from '~/ui/hooks/use-git-credentials';

import { Icon } from '../icon';
import { ProjectCreateForm } from '../project/project-create-form';
import { ProjectSettingsForm } from '../project/project-settings-form';

export const ProjectModal = ({
  isOpen,
  onOpenChange,
  storageRules,
  project,
  gitRepository,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  storageRules: StorageRules;
  project?: Project;
  gitRepository?: GitRepository;
}) => {
  // Close the modal when a navigation happens
  const activeNavigation = useNavigation();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

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

  const { credentials, providers } = useGitCredentials();

  const onDirtyChange = (dirty: boolean) => setHasUnsavedChanges(dirty);

  return (
    <UnsavedChangesGuard hasUnsavedChanges={hasUnsavedChanges} onClose={() => onOpenChange(false)} parentRef={modalRef}>
      {({ requestClose }) => (
        <ModalOverlay
          isOpen={isOpen}
          onOpenChange={open => {
            if (!open) requestClose();
          }}
          isDismissable={false}
          className="fixed top-0 right-0 bottom-0 left-0 z-10 flex items-start justify-center bg-black/30 pt-[200px]"
        >
          <Modal
            ref={modalRef}
            className="flex max-h-[calc(var(--visual-viewport-height)-140px)] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) text-(--color-font)"
          >
            <Dialog
              aria-label="Create or update dialog"
              className="grid flex-1 grid-rows-[min-content_1fr_min-content] gap-4 overflow-hidden p-10 outline-hidden"
            >
              <>
                <div className="flex items-center justify-between gap-2">
                  <Heading slot="title" className="text-2xl">
                    {title}
                  </Heading>
                  <Button
                    className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                    data-test-id="project-modal-close-button"
                    onPress={requestClose}
                  >
                    <Icon icon="x" />
                  </Button>
                </div>
                {project ? (
                  <ProjectSettingsForm
                    storageRules={storageRules}
                    project={project}
                    gitRepository={gitRepository}
                    onCancel={requestClose}
                    onSuccessUpdate={() => onOpenChange(false)}
                    credentials={credentials}
                    providers={providers}
                    onDirtyChange={onDirtyChange}
                  />
                ) : (
                  <ProjectCreateForm
                    storageRules={storageRules}
                    onCancel={requestClose}
                    activeViewObj={activeViewObj}
                    credentials={credentials}
                    providers={providers}
                    onDirtyChange={onDirtyChange}
                  />
                )}
              </>
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </UnsavedChangesGuard>
  );
};
