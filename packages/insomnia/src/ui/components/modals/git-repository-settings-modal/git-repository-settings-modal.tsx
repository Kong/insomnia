import React, { forwardRef, Key, useImperativeHandle, useRef, useState } from 'react';

import { docsGitSync } from '../../../../common/documentation';
import type { GitRepository, OauthProviderName } from '../../../../models/git-repository';
import { deleteGitRepository } from '../../../../models/helpers/git-repository-operations';
import { Link } from '../../base/link';
import { type ModalHandle, Modal, ModalProps } from '../../base/modal';
import { ModalBody } from '../../base/modal-body';
import { ModalFooter } from '../../base/modal-footer';
import { ModalHeader } from '../../base/modal-header';
import { PanelContainer, TabItem, Tabs } from '../../base/tabs';
import { ErrorBoundary } from '../../error-boundary';
import { HelpTooltip } from '../../help-tooltip';
import { CustomRepositorySettingsFormGroup } from './custom-repository-settings-form-group';
import { GitHubRepositorySetupFormGroup } from './github-repository-settings-form-group';
import { GitLabRepositorySetupFormGroup } from './gitlab-repository-settings-form-group';

interface GitRepositorySettingsModalOptions {
  gitRepository: GitRepository | null;
  onSubmitEdits: (gitRepoPatch: Partial<GitRepository>) => Promise<void> | void;
}
export interface GitRepositorySettingsModalHandle {
  show: (options: GitRepositorySettingsModalOptions) => void;
  hide: () => void;
}
export const GitRepositorySettingsModal = forwardRef<GitRepositorySettingsModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<GitRepositorySettingsModalOptions>({
    gitRepository: null,
    onSubmitEdits: () => {},
  });

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: options => {
      setState(options);
      modalRef.current?.show();
    },
  }), []);

  const { gitRepository, onSubmitEdits } = state;
  return (
    <Modal ref={modalRef}>
      <ModalForm
        onSubmit={patch => {
          onSubmitEdits({ ...gitRepository, ...patch });
          modalRef.current?.hide();
        }}
        onReset={() => {
          gitRepository && deleteGitRepository(gitRepository);
          modalRef.current?.hide();
        }}
        gitRepository={gitRepository}
      />
    </Modal>
  );
});
GitRepositorySettingsModal.displayName = 'GitRepositorySettingsModal';

interface Props {
  gitRepository: GitRepository | null;
  onSubmit: (patch: Partial<GitRepository>) => void;
  onReset: () => void;
}

const oauth2Formats: OauthProviderName[] = ['github', 'gitlab', 'custom'];

const ModalForm = (props: Props) => {
  const { gitRepository, onSubmit, onReset } = props;

  const oauth2format =
    (gitRepository &&
      gitRepository.credentials &&
      'oauth2format' in gitRepository.credentials &&
      gitRepository.credentials.oauth2format) ||
    'custom';

  const initialTab = !gitRepository ? 'github' : oauth2format;

  const [selectedTab, setTab] = useState<OauthProviderName>(initialTab);

  return (
    <>
      <ModalHeader>
        Configure Repository{' '}
        <HelpTooltip>
          Sync and collaborate with Git
          <br />
          <Link href={docsGitSync}>Documentation {<i className="fa fa-external-link-square" />}</Link>
        </HelpTooltip>
      </ModalHeader>
      <ModalBody key={gitRepository ? gitRepository._id : 'new'}>
        <ErrorBoundary>
          <Tabs
            aria-label="Git repository settings tabs"
            selectedKey={selectedTab}
            onSelectionChange={(key: Key) => setTab(key as OauthProviderName)}
          >
            <TabItem key={oauth2Formats[0]} title={<><i className="fa fa-github" /> GitHub</>}>
              <PanelContainer className="pad pad-top-sm">
                <GitHubRepositorySetupFormGroup
                  uri={gitRepository?.uri}
                  onSubmit={onSubmit}
                />
              </PanelContainer>
            </TabItem>
            <TabItem key={oauth2Formats[1]} title={<><i className="fa fa-gitlab" /> GitLab</>}>
              <PanelContainer className="pad pad-top-sm">
                <GitLabRepositorySetupFormGroup
                  uri={gitRepository?.uri}
                  onSubmit={onSubmit}
                />
              </PanelContainer>
            </TabItem>
            <TabItem key={oauth2Formats[2]} title={<><i className="fa fa-code-fork" /> Git</>}>
              <PanelContainer className="pad pad-top-sm">
                <CustomRepositorySettingsFormGroup
                  gitRepository={gitRepository}
                  onSubmit={onSubmit}
                />
              </PanelContainer>
            </TabItem>
          </Tabs>
        </ErrorBoundary>
      </ModalBody>
      <ModalFooter>
        {gitRepository && (
          <div className="margin-left txt-xs faint monospace selectable">
            {gitRepository._id}
          </div>
        )}
        <div>
          {gitRepository !== null && (
            <button type="button" className="btn" onClick={onReset}>
              Reset
            </button>
          )}
          <button type="submit" form={selectedTab} className="btn" data-testid="git-repository-settings-modal__sync-btn">
            Sync
          </button>
        </div>
      </ModalFooter>
    </>
  );
};
