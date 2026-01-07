import React, { useEffect, useRef } from 'react';
import { OverlayContainer } from 'react-aria';
import { useParams } from 'react-router';

import { useGitProjectResetActionFetcher } from '~/routes/git.reset';
import { GitConnectionInfo } from '~/ui/components/git/connection-info';
import { useGitCredentials } from '~/ui/hooks/use-git-credentials';

import { docsGitSync } from '../../../../common/documentation';
import type { GitRepository } from '../../../../models/git-repository';
import { Link } from '../../base/link';
import { Modal, type ModalHandle, type ModalProps } from '../../base/modal';
import { ModalBody } from '../../base/modal-body';
import { ModalFooter } from '../../base/modal-footer';
import { ModalHeader } from '../../base/modal-header';
import { HelpTooltip } from '../../help-tooltip';

export const GitRepositorySettingsModal = ({
  gitRepository,
  ...modalProps
}: ModalProps & {
  gitRepository: GitRepository;
}) => {
  const { credentials, providers } = useGitCredentials();

  const selectedCredential = credentials.find(c => c._id === gitRepository.credentialsId);
  const selectedProvider = providers.find(p => p.type === selectedCredential?.provider);

  const { projectId, workspaceId } = useParams() as {
    projectId: string;
    workspaceId: string;
  };

  const modalRef = useRef<ModalHandle>(null);
  const resetGitRepositoryFetcher = useGitProjectResetActionFetcher();

  useEffect(() => {
    modalRef.current?.show();
  }, []);

  return (
    <OverlayContainer>
      <Modal ref={modalRef} {...modalProps}>
        <ModalHeader>
          Git repository information{' '}
          <HelpTooltip>
            Sync and collaborate with Git
            <br />
            <Link href={docsGitSync}>Documentation {<i className="fa fa-external-link-square" />}</Link>
          </HelpTooltip>
        </ModalHeader>
        <ModalBody>
          {selectedProvider && <GitConnectionInfo gitRepository={gitRepository} providerInfo={selectedProvider} />}
        </ModalBody>
        <ModalFooter>
          <div
            style={{
              display: 'flex',
              gap: 'var(--padding-md)',
            }}
          >
            <button
              className="btn"
              onClick={() => {
                resetGitRepositoryFetcher.submit({
                  projectId,
                  workspaceId,
                });
              }}
            >
              Disconnect git repository
            </button>
            <button
              type="button"
              onClick={() => modalRef.current?.hide()}
              className="btn"
              data-testid="git-repository-settings-modal__sync-btn-close"
            >
              Close
            </button>
          </div>
        </ModalFooter>
      </Modal>
    </OverlayContainer>
  );
};
