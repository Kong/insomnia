// @flow
import * as React from 'react';
import * as git from 'isomorphic-git';
import path from 'path';
import * as db from '../../common/database';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import {
  AUTOBIND_CFG,
  ACTIVITY_SPEC,
  ACTIVITY_DEBUG,
  getAppName,
  isWorkspaceActivity,
} from '../../common/constants';
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
import { trackEvent, trackSegmentEvent } from '../../common/analytics';
import YAML from 'yaml';
import TimeFromNow from './time-from-now';
import Highlight from './base/highlight';
import type { GlobalActivity } from '../../common/constants';

import { fuzzyMatchAll, isNotNullOrUndefined, pluralize } from '../../common/misc';
import type {
  HandleImportClipboardCallback,
  HandleImportFileCallback,
  HandleImportUriCallback,
  WrapperProps,
} from './wrapper';
import Notice from './notice';
import GitRepositorySettingsModal from '../components/modals/git-repository-settings-modal';
import PageLayout from './page-layout';
import { ForceToWorkspaceKeys } from '../redux/modules/helpers';
import coreLogo from '../images/insomnia-core-logo.png';
import { MemPlugin } from '../../sync/git/mem-plugin';
import {
  GIT_CLONE_DIR,
  GIT_INSOMNIA_DIR,
  GIT_INSOMNIA_DIR_NAME,
  GIT_INTERNAL_DIR,
} from '../../sync/git/git-vcs';
import { parseApiSpec } from '../../common/api-specs';
import RemoteWorkspacesDropdown from './dropdowns/remote-workspaces-dropdown';
import SettingsButton from './buttons/settings-button';
import AccountDropdown from './dropdowns/account-dropdown';
import { strings } from '../../common/strings';
import { WorkspaceScopeKeys } from '../../models/workspace';
import { descendingNumberSort } from '../../common/sorting';

type Props = {|
  wrapperProps: WrapperProps,
  handleImportFile: HandleImportFileCallback,
  handleImportUri: HandleImportUriCallback,
  handleImportClipboard: HandleImportClipboardCallback,
|};

type State = {|
  filter: string,
|};

@autoBindMethodsForReact(AUTOBIND_CFG)
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

  async __actuallyCreate(patch: $Shape<Workspace>) {
    const workspace = await models.workspace.create(patch);
    const { handleSetActiveActivity } = this.props.wrapperProps;
    this.props.wrapperProps.handleSetActiveWorkspace(workspace._id);
    trackEvent('Workspace', 'Create');

    workspace.scope === WorkspaceScopeKeys.design
      ? handleSetActiveActivity(ACTIVITY_SPEC)
      : handleSetActiveActivity(ACTIVITY_DEBUG);
  }

  _handleDocumentCreate() {
    showPrompt({
      title: 'Create New Design Document',
      submitName: 'Create',
      placeholder: 'spec-name.yaml',
      onComplete: async name => {
        await this.__actuallyCreate({
          name,
          scope: WorkspaceScopeKeys.design,
        });
        trackSegmentEvent('Document Created');
      },
    });
  }

  _handleCollectionCreate() {
    showPrompt({
      title: 'Create New Request Collection',
      placeholder: 'My Collection',
      submitName: 'Create',
      onComplete: async name => {
        await this.__actuallyCreate({
          name,
          scope: WorkspaceScopeKeys.collection,
        });
        trackSegmentEvent('Collection Created');
      },
    });
  }

  _handleImportFile() {
    this.props.handleImportFile({ forceToWorkspace: ForceToWorkspaceKeys.new });
  }

  _handleImportClipBoard() {
    this.props.handleImportClipboard({ forceToWorkspace: ForceToWorkspaceKeys.new });
  }

  _handleImportUri() {
    showPrompt({
      title: 'Import document from URL',
      submitName: 'Fetch and Import',
      label: 'URL',
      placeholder: 'https://website.com/insomnia-import.json',
      onComplete: uri => {
        this.props.handleImportUri(uri, { forceToWorkspace: ForceToWorkspaceKeys.new });
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
            noGitSuffix: true,
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

  async _handleClickCard(id: string, defaultActivity: GlobalActivity) {
    const { handleSetActiveWorkspace, handleSetActiveActivity } = this.props.wrapperProps;

    const { activeActivity } = await models.workspaceMeta.getOrCreateByParentId(id);

    if (!activeActivity || !isWorkspaceActivity(activeActivity)) {
      handleSetActiveActivity(defaultActivity);
    } else {
      handleSetActiveActivity(activeActivity);
    }
    handleSetActiveWorkspace(id);
  }

  renderCard(workspace: Workspace): { card: React.Node, lastModifiedTimestamp: number } {
    const {
      apiSpecs,
      handleSetActiveWorkspace,
      workspaceMetas,
      workspaces,
    } = this.props.wrapperProps;

    const { filter } = this.state;

    const apiSpec = apiSpecs.find(s => s.parentId === workspace._id);

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
    const workspaceMeta = workspaceMetas.find(wm => wm.parentId === workspace._id);
    const lastActiveBranch = workspaceMeta ? workspaceMeta.cachedGitRepositoryBranch : null;
    const lastCommitAuthor = workspaceMeta ? workspaceMeta.cachedGitLastAuthor : null;
    const lastCommitTime = workspaceMeta ? workspaceMeta.cachedGitLastCommitTime : null;

    // WorkspaceMeta is a good proxy for last modified time
    const workspaceModified = workspaceMeta ? workspaceMeta.modified : workspace.modified;
    const modifiedLocally =
      apiSpec && workspace.scope === WorkspaceScopeKeys.design
        ? apiSpec.modified
        : workspaceModified;

    // Span spec, workspace and sync related timestamps for card last modified label and sort order
    const lastModifiedFrom = [
      workspace?.modified,
      workspaceMeta?.modified,
      apiSpec?.modified,
      workspaceMeta?.cachedGitLastCommitTime,
    ];
    const lastModifiedTimestamp = lastModifiedFrom
      .filter(isNotNullOrUndefined)
      .sort(descendingNumberSort)[0];

    let log = <TimeFromNow timestamp={lastModifiedTimestamp} />;
    let branch = lastActiveBranch;
    if (
      workspace.scope === WorkspaceScopeKeys.design &&
      lastCommitTime &&
      apiSpec?.modified > lastCommitTime
    ) {
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
          <TimeFromNow timestamp={lastCommitTime} /> {lastCommitAuthor && `by ${lastCommitAuthor}`}
        </React.Fragment>
      );
    }

    const docMenu = (
      <DocumentCardDropdown
        apiSpec={apiSpec}
        workspace={workspace}
        handleSetActiveWorkspace={handleSetActiveWorkspace}
        isLastWorkspace={workspaces.length === 1}>
        <SvgIcon icon="ellipsis" />
      </DocumentCardDropdown>
    );
    const version = spec?.info?.version || '';
    let label: string = strings.collection;
    let format: string = '';
    let labelIcon = <i className="fa fa-bars" />;
    let defaultActivity = ACTIVITY_DEBUG;
    let title = workspace.name;

    if (workspace.scope === WorkspaceScopeKeys.design) {
      label = strings.document;
      labelIcon = <i className="fa fa-file-o" />;
      if (specFormat === 'openapi') {
        format = `OpenAPI ${specFormatVersion}`;
      } else if (specFormat === 'swagger') {
        // NOTE: This is not a typo, we're labeling Swagger as OpenAPI also
        format = `OpenAPI ${specFormatVersion}`;
      }

      defaultActivity = ACTIVITY_SPEC;
      title = apiSpec.fileName || title;
    }

    // Filter the card by multiple different properties
    const matchResults = fuzzyMatchAll(filter, [title, label, branch, version], {
      splitSpace: true,
      loose: true,
    });

    // Return null if we don't match the filter
    if (filter && !matchResults) {
      return null;
    }

    const card = (
      <Card
        key={apiSpec._id}
        docBranch={branch && <Highlight search={filter} text={branch} />}
        docTitle={title && <Highlight search={filter} text={title} />}
        docVersion={version && <Highlight search={filter} text={`v${version}`} />}
        tagLabel={
          label && (
            <>
              <span className="margin-right-xs">{labelIcon}</span>
              <Highlight search={filter} text={label} />
            </>
          )
        }
        docLog={log}
        docMenu={docMenu}
        docFormat={format}
        onClick={() => this._handleClickCard(workspace._id, defaultActivity)}
      />
    );

    return {
      card,
      lastModifiedTimestamp,
    };
  }

  renderCreateMenu() {
    const button = (
      <Button variant="contained" bg="surprise" className="margin-left">
        Create
        <i className="fa fa-caret-down pad-left-sm" />
      </Button>
    );

    return (
      <Dropdown renderButton={button}>
        <DropdownDivider>New</DropdownDivider>
        <DropdownItem icon={<i className="fa fa-file-o" />} onClick={this._handleDocumentCreate}>
          Design Document
        </DropdownItem>
        <DropdownItem icon={<i className="fa fa-bars" />} onClick={this._handleCollectionCreate}>
          Request Collection
        </DropdownItem>
        <DropdownDivider>Import From</DropdownDivider>
        <DropdownItem icon={<i className="fa fa-plus" />} onClick={this._handleImportFile}>
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

  renderDashboardMenu() {
    const { vcs, workspaces } = this.props.wrapperProps;
    return (
      <div className="row row--right pad-left wide">
        <div
          className="form-control form-control--outlined no-margin"
          style={{ maxWidth: '400px' }}>
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
        <RemoteWorkspacesDropdown vcs={vcs} workspaces={workspaces} className="margin-left" />
        {this.renderCreateMenu()}
      </div>
    );
  }

  render() {
    const { workspaces, isLoading } = this.props.wrapperProps;
    const { filter } = this.state;

    // Render each card, removing all the ones that don't match the filter
    const cards = workspaces
      .map(this.renderCard)
      .filter(isNotNullOrUndefined)
      .sort((a, b) => descendingNumberSort(a.lastModifiedTimestamp, b.lastModifiedTimestamp))
      .map(c => c.card);

    const countLabel = cards.length > 1 ? pluralize(strings.document) : strings.document;

    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageHeader={() => (
          <Header
            className="app-header theme--app-header"
            gridLeft={
              <React.Fragment>
                <img src={coreLogo} alt="Insomnia" width="24" height="24" />
                <Breadcrumb className="breadcrumb" crumbs={[getAppName()]} />
                {isLoading ? <i className="fa fa-refresh fa-spin space-left" /> : null}
              </React.Fragment>
            }
            gridRight={
              <>
                <SettingsButton className="margin-left" />
                <AccountDropdown className="margin-left" />
              </>
            }
          />
        )}
        renderPageBody={() => (
          <div className="document-listing theme--pane layout-body">
            <div className="document-listing__body pad-bottom">
              <div className="row-spaced margin-top margin-bottom-sm">
                <h2 className="no-margin">Dashboard</h2>
                {this.renderDashboardMenu()}
              </div>
              <CardContainer>{cards}</CardContainer>
              {filter && cards.length === 0 && (
                <Notice color="subtle">
                  No documents found for <strong>{filter}</strong>
                </Notice>
              )}
            </div>
            <div className="document-listing__footer vertically-center">
              <span>
                {cards.length} {countLabel}
              </span>
            </div>
          </div>
        )}
      />
    );
  }
}

export default WrapperHome;
