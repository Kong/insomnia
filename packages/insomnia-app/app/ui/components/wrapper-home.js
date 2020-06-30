// @flow
import * as React from 'react';
import * as git from 'isomorphic-git';
import path from 'path';
import * as db from '../../common/database';
import autobind from 'autobind-decorator';
import type { Workspace } from '../../models/workspace';
import 'swagger-ui-react/swagger-ui.css';
import {
  Breadcrumb,
  Button,
  Card,
  CardContainer,
  Dropdown,
  DropdownDivider,
  DropdownItem,
  Header,
  SvgIcon,
} from 'insomnia-components';
import DocumentCardDropdown from './dropdowns/document-card-dropdown';
import KeydownBinder from './keydown-binder';
import { executeHotKey } from '../../common/hotkeys-listener';
import { hotKeyRefs } from '../../common/hotkeys';
import { showAlert, showError, showModal, showPrompt } from './modals';
import * as models from '../../models';
import { trackEvent } from '../../common/analytics';
import YAML from 'yaml';
import TimeFromNow from './time-from-now';
import Highlight from './base/highlight';
import type { GlobalActivity } from '../../common/constants';
import { ACTIVITY_DEBUG, ACTIVITY_HOME, ACTIVITY_SPEC } from '../../common/constants';
import { fuzzyMatchAll } from '../../common/misc';
import type { WrapperProps } from './wrapper';
import Notice from './notice';
import GitRepositorySettingsModal from '../components/modals/git-repository-settings-modal';
import PageLayout from './page-layout';
import type { ForceToWorkspace } from '../redux/modules/helpers';
import { ForceToWorkspaceKeys } from '../redux/modules/helpers';
import designerLogo from '../images/insomnia-designer-logo.svg';
import { MemPlugin } from '../../sync/git/mem-plugin';
import {
  GIT_CLONE_DIR,
  GIT_INSOMNIA_DIR,
  GIT_INSOMNIA_DIR_NAME,
  GIT_INTERNAL_DIR,
} from '../../sync/git/git-vcs';
import { parseApiSpec } from '../../common/api-specs';

type Props = {|
  wrapperProps: WrapperProps,
  handleImportFile: (forceToWorkspace: ForceToWorkspace) => void,
  handleImportUri: (uri: string, forceToWorkspace: ForceToWorkspace) => void,
  handleImportClipboard: (forceToWorkspace: ForceToWorkspace) => void,
|};

type State = {|
  filter: string,
|};

@autobind
class WrapperHome extends React.PureComponent<Props, State> {
  state = {
    filter: '',
  };

  _filterInput: ?HTMLInputElement;

  _setFilterInputRef(n: ?HTMLInputElement) {
    this._filterInput = n;
  }

  _handleFilterChange(e: SyntheticEvent<HTMLInputElement>) {
    this.setState({ filter: e.currentTarget.value });
  }

  _handleWorkspaceCreate() {
    showPrompt({
      title: 'New Document',
      submitName: 'Create',
      placeholder: 'spec-name.yaml',
      selectText: true,
      onComplete: async name => {
        await models.workspace.create({
          name,
          scope: 'spec',
        });

        trackEvent('Workspace', 'Create');
      },
    });
  }

  _handleImportFile() {
    this.props.handleImportFile(ForceToWorkspaceKeys.new);
  }

  _handleImportClipBoard() {
    this.props.handleImportClipboard(ForceToWorkspaceKeys.new);
  }

  _handleImportUri() {
    showPrompt({
      title: 'Import document from URL',
      submitName: 'Fetch and Import',
      label: 'URL',
      placeholder: 'https://website.com/insomnia-import.json',
      onComplete: uri => {
        this.props.handleImportUri(uri, ForceToWorkspaceKeys.new);
      },
    });
  }

  async _handleWorkspaceClone() {
    // This is a huge flow and we don't really have anywhere to put something like this. I guess
    // it's fine here for now (?)
    showModal(GitRepositorySettingsModal, {
      gitRepository: null,
      onSubmitEdits: async repoSettingsPatch => {
        trackEvent('Git', 'Clone');

        const core = Math.random() + '';

        // Create in-memory filesystem to perform clone
        const plugins = git.cores.create(core);
        const fsPlugin = MemPlugin.createPlugin();
        plugins.set('fs', fsPlugin);

        // Pull settings returned from dialog and shallow-clone the repo
        const { credentials, uri: url } = repoSettingsPatch;
        try {
          await git.clone({
            core,
            dir: GIT_CLONE_DIR,
            gitdir: GIT_INTERNAL_DIR,
            singleBranch: true,
            url,
            ...credentials,
            depth: 1,
          });
        } catch (err) {
          showError({ title: 'Error Cloning Repository', message: err.message, error: err });
          return false;
        }

        const f = fsPlugin.promises;
        const ensureDir = async (base: string, name: string): Promise<boolean> => {
          const rootDirs = await f.readdir(base);
          if (rootDirs.includes(name)) {
            return true;
          }

          showAlert({
            title: 'Clone Problem',
            message: (
              <React.Fragment>
                Could not locate{' '}
                <code>
                  {base}/{name}
                </code>{' '}
                directory in repository.
              </React.Fragment>
            ),
          });

          return false;
        };

        if (!(await ensureDir(GIT_CLONE_DIR, GIT_INSOMNIA_DIR_NAME))) {
          return;
        }

        if (!(await ensureDir(GIT_INSOMNIA_DIR, models.workspace.type))) {
          return;
        }

        const workspaceBase = path.join(GIT_INSOMNIA_DIR, models.workspace.type);
        const workspaceDirs = await f.readdir(workspaceBase);

        if (workspaceDirs.length > 1) {
          return showAlert({
            title: 'Clone Problem',
            message: 'Multiple workspaces found in repository',
          });
        }

        if (workspaceDirs.length === 0) {
          return showAlert({
            title: 'Clone Problem',
            message: 'No workspaces found in repository',
          });
        }

        const workspacePath = path.join(workspaceBase, workspaceDirs[0]);
        const workspaceJson = await f.readFile(workspacePath);
        const workspace = YAML.parse(workspaceJson.toString());

        // Check if the workspace already exists
        const existingWorkspace = await models.workspace.getById(workspace._id);

        if (existingWorkspace) {
          return showAlert({
            title: 'Clone Problem',
            okLabel: 'Done',
            message: (
              <React.Fragment>
                Workspace <strong>{existingWorkspace.name}</strong> already exists. Please delete it
                before cloning.
              </React.Fragment>
            ),
          });
        }

        // Prompt user to confirm importing the workspace
        showAlert({
          title: 'Project Found',
          okLabel: 'Import',
          message: (
            <React.Fragment>
              Workspace <strong>{workspace.name}</strong> found in repository. Would you like to
              import it?
            </React.Fragment>
          ),

          // Import all docs to the DB
          onConfirm: async () => {
            const {
              wrapperProps: { handleSetActiveWorkspace },
            } = this.props;

            // Stop the DB from pushing updates to the UI temporarily
            const bufferId = await db.bufferChanges();

            // Loop over all model folders in root
            for (const modelType of await f.readdir(GIT_INSOMNIA_DIR)) {
              const modelDir = path.join(GIT_INSOMNIA_DIR, modelType);

              // Loop over all documents in model folder and save them
              for (const docFileName of await f.readdir(modelDir)) {
                const docPath = path.join(modelDir, docFileName);
                const docYaml = await f.readFile(docPath);
                const doc = YAML.parse(docYaml.toString());
                await db.upsert(doc);
              }
            }

            // Store GitRepository settings and set it as active
            const newRepo = await models.gitRepository.create({
              ...repoSettingsPatch,
              needsFullClone: true,
            });
            const meta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
            await models.workspaceMeta.update(meta, { gitRepositoryId: newRepo._id });

            // Activate the workspace after importing everything
            await handleSetActiveWorkspace(workspace._id);

            // Flush DB changes
            await db.flushChanges(bufferId);
          },
        });
      },
    });
  }

  _handleKeyDown(e) {
    executeHotKey(e, hotKeyRefs.FILTER_DOCUMENTS, () => {
      if (this._filterInput) {
        this._filterInput.focus();
      }
    });
  }

  async _handleSetActiveWorkspace(id: string, defaultActivity: GlobalActivity) {
    const { handleSetActiveWorkspace, handleSetActiveActivity } = this.props.wrapperProps;

    const { activeActivity } = await models.workspaceMeta.getOrCreateByParentId(id);

    if (!activeActivity || activeActivity === ACTIVITY_HOME) {
      handleSetActiveActivity(defaultActivity);
    } else {
      handleSetActiveActivity(activeActivity);
    }

    handleSetActiveWorkspace(id);
  }

  renderCard(w: Workspace) {
    const {
      apiSpecs,
      handleSetActiveWorkspace,
      workspaceMetas,
      workspaces,
    } = this.props.wrapperProps;

    const { filter } = this.state;

    const apiSpec = apiSpecs.find(s => s.parentId === w._id);

    let spec = null;
    let specFormat = null;
    let specFormatVersion = null;
    try {
      const result = parseApiSpec(apiSpec.contents);
      spec = result.contents;
      specFormat = result.format;
      specFormatVersion = result.formatVersion;
    } catch (err) {
      // Assume there is no spec
      // TODO: Check for parse errors if it's an invalid spec
    }

    // Get cached branch from WorkspaceMeta
    const workspaceMeta = workspaceMetas.find(wm => wm.parentId === w._id);
    const lastActiveBranch = workspaceMeta ? workspaceMeta.cachedGitRepositoryBranch : null;
    const lastCommitAuthor = workspaceMeta ? workspaceMeta.cachedGitLastAuthor : null;
    const lastCommitTime = workspaceMeta ? workspaceMeta.cachedGitLastCommitTime : null;

    // WorkspaceMeta is a good proxy for last modified time
    const workspaceModified = workspaceMeta ? workspaceMeta.modified : w.modified;
    const modifiedLocally = apiSpec ? apiSpec.modified : workspaceModified;

    let log = <TimeFromNow timestamp={modifiedLocally} />;
    let branch = lastActiveBranch;
    if (apiSpec && lastCommitTime && apiSpec.modified > lastCommitTime) {
      // Show locally unsaved changes for spec
      // NOTE: this doesn't work for non-spec workspaces
      branch = lastActiveBranch + '*';
      log = (
        <React.Fragment>
          <TimeFromNow className="text-danger" timestamp={modifiedLocally} /> (unsaved)
        </React.Fragment>
      );
    } else if (lastCommitTime) {
      // Show last commit time and author
      branch = lastActiveBranch;
      log = (
        <React.Fragment>
          <TimeFromNow timestamp={lastCommitTime} /> by {lastCommitAuthor}
        </React.Fragment>
      );
    }

    const docMenu = (
      <DocumentCardDropdown
        apiSpec={apiSpec}
        workspace={w}
        handleSetActiveWorkspace={handleSetActiveWorkspace}
        isLastWorkspace={workspaces.length === 1}>
        <SvgIcon icon="ellipsis" />
      </DocumentCardDropdown>
    );
    const version = spec?.info?.version || '';
    let label: string = 'Insomnia';
    let defaultActivity = ACTIVITY_DEBUG;

    if (spec || w.scope === 'spec') {
      label = '';
      if (specFormat === 'openapi') {
        label = `OpenAPI ${specFormatVersion}`;
      } else if (specFormat === 'swagger') {
        // NOTE: This is not a typo, we're labeling Swagger as OpenAPI also
        label = `OpenAPI ${specFormatVersion}`;
      }

      defaultActivity = ACTIVITY_SPEC;
    }

    // Filter the card by multiple different properties
    const matchResults = fuzzyMatchAll(filter, [apiSpec.fileName, label, branch, version], {
      splitSpace: true,
      loose: true,
    });

    // Return null if we don't match the filter
    if (filter && !matchResults) {
      return null;
    }

    return (
      <Card
        key={apiSpec._id}
        docBranch={branch && <Highlight search={filter} text={branch} />}
        docTitle={apiSpec.fileName && <Highlight search={filter} text={apiSpec.fileName} />}
        docVersion={version && <Highlight search={filter} text={version} />}
        tagLabel={label && <Highlight search={filter} text={label} />}
        docLog={log}
        docMenu={docMenu}
        onClick={() => this._handleSetActiveWorkspace(w._id, defaultActivity)}
      />
    );
  }

  renderMenu() {
    return (
      <Dropdown
        renderButton={() => (
          <Button variant="contained" bg="surprise" className="margin-left">
            Create <i className="fa fa-caret-down" />
          </Button>
        )}>
        <DropdownDivider>New</DropdownDivider>
        <DropdownItem icon={<i className="fa fa-pencil" />} onClick={this._handleWorkspaceCreate}>
          Blank Document
        </DropdownItem>
        <DropdownDivider>Import From</DropdownDivider>
        <DropdownItem icon={<i className="fa fa-file" />} onClick={this._handleImportFile}>
          File
        </DropdownItem>
        <DropdownItem icon={<i className="fa fa-link" />} onClick={this._handleImportUri}>
          URL
        </DropdownItem>
        <DropdownItem
          icon={<i className="fa fa-clipboard" />}
          onClick={this._handleImportClipBoard}>
          Clipboard
        </DropdownItem>
        <DropdownItem icon={<i className="fa fa-code-fork" />} onClick={this._handleWorkspaceClone}>
          Git Clone
        </DropdownItem>
      </Dropdown>
    );
  }

  render() {
    const { workspaces } = this.props.wrapperProps;
    const { filter } = this.state;

    // Render each card, removing all the ones that don't match the filter
    const cards = workspaces.map(this.renderCard).filter(c => c !== null);

    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageHeader={() => (
          <Header
            className="app-header"
            gridLeft={
              <React.Fragment>
                <img src={designerLogo} alt="Insomnia" width="32" height="32" />
                <Breadcrumb className="breadcrumb" crumbs={['Documents']} />
              </React.Fragment>
            }
            gridCenter={
              <div className="form-control form-control--outlined no-margin">
                <KeydownBinder onKeydown={this._handleKeyDown}>
                  <input
                    ref={this._setFilterInputRef}
                    type="text"
                    placeholder="Filter..."
                    onChange={this._handleFilterChange}
                    className="no-margin"
                  />
                  <span className="fa fa-search filter-icon" />
                </KeydownBinder>
              </div>
            }
            gridRight={this.renderMenu()}
          />
        )}
        renderPageBody={() => (
          <div className="document-listing theme--pane layout-body pad-top">
            <div className="document-listing__body">
              <CardContainer>{cards}</CardContainer>
              {filter && cards.length === 0 && (
                <Notice color="subtle">
                  No documents found for <strong>{filter}</strong>
                </Notice>
              )}
            </div>
          </div>
        )}
      />
    );
  }
}

export default WrapperHome;
