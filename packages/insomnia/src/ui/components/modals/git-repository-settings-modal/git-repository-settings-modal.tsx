import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';

import { AUTOBIND_CFG } from '../../../../common/constants';
import { docsGitSync } from '../../../../common/documentation';
import type { GitRepository } from '../../../../models/git-repository';
import { deleteGitRepository } from '../../../../models/helpers/git-repository-operations';
import { Link } from '../../base/link';
import { Modal } from '../../base/modal';
import { ModalBody } from '../../base/modal-body';
import { ModalFooter } from '../../base/modal-footer';
import { ModalHeader } from '../../base/modal-header';
import { ErrorBoundary } from '../../error-boundary';
import { HelpTooltip } from '../../help-tooltip';
import { CustomRepositorySettingsFormGroup } from './custom-repository-settings-form-group';
import { GitHubRepositorySetupFormGroup } from './github-repository-settings-form-group';
import { GitLabRepositorySetupFormGroup } from './gitlab-repository-settings-form-group';

interface State {
  gitRepository: GitRepository | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class GitRepositorySettingsModal extends PureComponent<{}, State> {
  modal: Modal | null = null;
  _onSubmitEdits?: ((repo: Partial<GitRepository>) => any) | null;

  state: State = {
    gitRepository: null,
  };

  _setModalRef(n: Modal) {
    this.modal = n;
  }

  show(options: {
    gitRepository: GitRepository | null;
    onSubmitEdits: (repo: Partial<GitRepository>) => any;
  }) {
    this._onSubmitEdits = options.onSubmitEdits;
    const { gitRepository } = options;

    this.setState({ gitRepository });
    this.modal?.show();
  }

  hide() {
    this.modal?.hide();
  }

  render() {
    const _handleReset = async () => {
      const { gitRepository } = this.state;

      if (!gitRepository) {
        // Nothing to do
        return;
      }

      await deleteGitRepository(gitRepository);
      this.hide();
    };

    const _handleSubmitEdit = async (patch: Partial<GitRepository>) => {
      if (this._onSubmitEdits) {
        this._onSubmitEdits({ ...this.state.gitRepository, ...patch });
      }

      this.hide();
    };

    return (
      <Modal ref={this._setModalRef} {...this.props}>
        <ModalForm
          onSubmit={patch => _handleSubmitEdit(patch)}
          onReset={_handleReset}
          gitRepository={this.state.gitRepository}
        />
      </Modal>
    );
  }
}

interface Props {
  gitRepository: GitRepository | null;
  onSubmit: (patch: Partial<GitRepository>) => void;
  onReset: () => void;
}

const oauth2Formats = ['github', 'gitlab', 'custom'];

const ModalForm = (props: Props) => {
  const { gitRepository, onSubmit, onReset } = props;

  const oauth2format =
    (gitRepository &&
      gitRepository.credentials &&
      'oauth2format' in gitRepository.credentials &&
      gitRepository.credentials.oauth2format) ||
    'custom';

  const initialTab = !gitRepository ? 'github' : oauth2format;

  const [selectedTab, setTab] = useState(initialTab);

  const selectedTabIndex = oauth2Formats.indexOf(selectedTab);
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
            className="react-tabs"
            onSelect={(index: number) => setTab(oauth2Formats[index])}
            selectedIndex={selectedTabIndex}
          >
            <TabList>
              <Tab>
                <button>
                  <i className="fa fa-github" /> GitHub
                </button>
              </Tab>
              <Tab>
                <button>
                  <i className="fa fa-gitlab" /> GitLab
                </button>
              </Tab>
              <Tab>
                <button>
                  <i className="fa fa-code-fork" /> Git
                </button>
              </Tab>
            </TabList>
            <TabPanel
              className="tabs__tab-panel"
              selectedClassName="pad pad-top-sm"
              style={{
                overflow: 'hidden',
              }}
            >
              <GitHubRepositorySetupFormGroup
                uri={gitRepository?.uri}
                onSubmit={onSubmit}
              />
            </TabPanel>
            <TabPanel
              className="tabs__tab-panel"
              selectedClassName="pad pad-top-sm"
              style={{
                overflow: 'hidden',
              }}
            >
              <GitLabRepositorySetupFormGroup
                uri={gitRepository?.uri}
                onSubmit={onSubmit}
              />
            </TabPanel>
            <TabPanel
              className="tabs__tab-panel scrollable"
              selectedClassName="pad pad-top-sm"
            >
              <CustomRepositorySettingsFormGroup
                gitRepository={gitRepository}
                onSubmit={onSubmit}
              />
            </TabPanel>
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
