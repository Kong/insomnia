// @flow
import * as React from 'react';
import * as git from 'isomorphic-git';
import path from 'path';
import * as db from '../../common/database';
import autobind from 'autobind-decorator';
import type { Workspace } from '../../models/workspace';
import 'swagger-ui-react/swagger-ui.css';
import { Breadcrumb, Card, CardContainer, Header, SvgIcon } from 'insomnia-components';
import DocumentCardDropdown from './dropdowns/document-card-dropdown';
import KeydownBinder from './keydown-binder';
import { executeHotKey } from '../../common/hotkeys-listener';
import { hotKeyRefs } from '../../common/hotkeys';
import { showAlert, showModal, showPrompt } from './modals';
import * as models from '../../models';
import { trackEvent } from '../../common/analytics';
import YAML from 'yaml';
import TimeFromNow from './time-from-now';
import Highlight from './base/highlight';
import type { GlobalActivity } from './activity-bar/activity-bar';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC } from './activity-bar/activity-bar';
import { fuzzyMatch } from '../../common/misc';
import type { WrapperProps } from './wrapper';
import Notice from './notice';
import GitRepositorySettingsModal from '../components/modals/git-repository-settings-modal';
import PageLayout from './page-layout';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from './base/dropdown';
import type { ForceToWorkspace } from '../redux/modules/helpers';
import { ForceToWorkspaceKeys } from '../redux/modules/helpers';
import designerLogo from '../images/insomnia-designer-logo.svg';
import { MemPlugin } from '../../sync/git/mem-plugin';
import GitVCS, { GIT_NAMESPACE_DIR } from '../../sync/git/git-vcs';
import { parseApiSpec } from '../../common/api-specs';

type Props = {|
  wrapperProps: WrapperProps,
  handleImportFile: (forceToWorkspace: ForceToWorkspace) => void,
  handleImportUri: (uri: string, forceToWorkspace: ForceToWorkspace) => void,
  handleImportClipboard: (forceToWorkspace: ForceToWorkspace) => void,
  gitVCS: GitVCS | null,
|};

type State = {|
  filter: string
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
        const rootDir = path.join('/', GIT_NAMESPACE_DIR);

        // Create in-memory filesystem to perform clone
        const plugins = git.cores.create(core);
        const fsPlugin = MemPlugin.createPlugin();
        plugins.set('fs', fsPlugin);

        // Pull settings returned from dialog and shallow-clone the repo
        const { credentials, uri: url } = repoSettingsPatch;
        const token = credentials ? credentials.token : null;
        await git.clone({ core, dir: '/', singleBranch: true, url, token, depth: 1 });

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

        if (!(await ensureDir('/', GIT_NAMESPACE_DIR))) {
          return;
        }

        if (!(await ensureDir(rootDir, models.workspace.type))) {
          return;
        }

        const workspaceBase = path.join(rootDir, models.workspace.type);
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
                Workspace <strong>{existingWorkspace.name}</strong> already exists. Please
                delete it before cloning.
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
            const { handleSetActiveWorkspace } = this.props;

            // Stop the DB from pushing updates to the UI temporarily
            const bufferId = await db.bufferChanges();

            // Loop over all model folders in root
            for (const modelType of await f.readdir(rootDir)) {
              const modelDir = path.join(rootDir, modelType);

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

  _filterWorkspaces(): Array<Workspace> {
    const { workspaces } = this.props.wrapperProps;
    const { filter } = this.state;

    if (!filter) {
      return workspaces;
    }

    return workspaces.filter(w => {
      const result = fuzzyMatch(filter, w.name, {
        splitSpace: true,
        loose: true,
      });

      return !!result;
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

    const selectedWorkspaceMeta = await models.workspaceMeta.getOrCreateByParentId(id);
    handleSetActiveActivity(selectedWorkspaceMeta.activeActivity || defaultActivity);

    handleSetActiveWorkspace(id);
  }

  renderWorkspace(w: Workspace) {
    const {
      apiSpecs,
      handleDuplicateWorkspaceById,
      handleRenameWorkspace,
      handleDeleteWorkspaceById,
      workspaceMetas,
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
        workspaceId={w._id}
        apiSpec={apiSpec}
        handleDuplicateWorkspaceById={handleDuplicateWorkspaceById}
        handleRenameWorkspaceById={handleRenameWorkspace}
        handleDeleteWorkspaceById={handleDeleteWorkspaceById}
      ><SvgIcon icon="ellipsis"/></DocumentCardDropdown>
    );

    if (spec || w.scope === 'spec') {
      let label: string = 'Unknown';
      if (specFormat === 'openapi') {
        label = `OpenAPI ${specFormatVersion}`;
      } else if (specFormat === 'swagger') {
        // NOTE: This is not a typo, we're labeling Swagger as OpenAPI also
        label = `OpenAPI ${specFormatVersion}`;
      }

      const version = (spec && spec.info && spec.info.version) ? spec.info.version : null;
      return (
        <Card
          key={w._id}
          docBranch={branch}
          docLog={log}
          docTitle={<Highlight search={filter} text={w.name} />}
          docVersion={version}
          onClick={() => this._handleSetActiveWorkspace(w._id, ACTIVITY_SPEC)}
          tagLabel={label}
          docMenu={docMenu}
        />
      );
    }

    return (
      <Card
        key={w._id}
        docBranch={branch}
        docLog={log}
        docTitle={<Highlight search={filter} text={w.name} />}
        docVersion=""
        onClick={() => this._handleSetActiveWorkspace(w._id, ACTIVITY_DEBUG)}
        tagLabel="Insomnia"
        docMenu={docMenu}
      />
    );
  }

  renderMenu() {
    return (
      <Dropdown outline>
        <DropdownButton className="margin-left btn-utility btn-create">
          Create <i className="fa fa-caret-down" />
        </DropdownButton>
        <DropdownDivider>From</DropdownDivider>
        <DropdownItem onClick={this._handleWorkspaceCreate}>
          <i className="fa fa-pencil" />
          Scratch
        </DropdownItem>
        <DropdownItem onClick={this._handleImportFile}>
          <i className="fa fa-file" />
          File
        </DropdownItem>
        <DropdownItem onClick={this._handleImportUri}>
          <i className="fa fa-link" />
          URL
        </DropdownItem>
        <DropdownItem onClick={this._handleImportClipBoard}>
          <i className="fa fa-clipboard" />
          Clipboard
        </DropdownItem>
        <DropdownItem onClick={this._handleWorkspaceClone}>
          <i className="fa fa-code-fork" />
          Git Clone
        </DropdownItem>
      </Dropdown>
    );
  }

  render() {
    const { filter } = this.state;
    const filteredWorkspaces = this._filterWorkspaces();

    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageHeader={() => (
          <Header
              className="app-header"
              gridLeft={
                <React.Fragment>
                    <img src={designerLogo} alt="Insomnia" width="24" height="24" />
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
                      className="no-margin workspace-filter"
                    />
                    <span className="fa fa-search filter-icon"></span>
                  </KeydownBinder>
                </div>
              }
              gridRight={this.renderMenu()}
          />
        )}
        renderPageBody={() => (
            <div className="document-listing theme--pane layout-body pad-top">
              <div className="document-listing__body">
                <CardContainer>
                  {filteredWorkspaces.map(this.renderWorkspace)}
                </CardContainer>
                {filteredWorkspaces.length === 0 && (
                  <Notice color="subtle">
                    No workspaces found for <strong>{filter}</strong>
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
