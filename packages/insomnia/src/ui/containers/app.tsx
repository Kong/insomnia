import { ipcRenderer } from 'electron';
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { parse as urlParse } from 'url';

import {
  ACTIVITY_HOME,
  getProductName,
  isDevelopment,
} from '../../common/constants';
import { database as db } from '../../common/database';
import { getDataDirectory } from '../../common/electron-helpers';
import {
  generateId,
} from '../../common/misc';
import * as models from '../../models';
import { isNotDefaultProject } from '../../models/project';
import * as plugins from '../../plugins';
import * as themes from '../../plugins/misc';
import { GitVCS } from '../../sync/git/git-vcs';
import FileSystemDriver from '../../sync/store/drivers/file-system-driver';
import { type MergeConflict } from '../../sync/types';
import { VCS } from '../../sync/vcs/vcs';
import * as templating from '../../templating/index';
import { ErrorBoundary } from '../components/error-boundary';
import { AskModal } from '../components/modals/ask-modal';
import { showAlert, showModal } from '../components/modals/index';
import { showSelectModal } from '../components/modals/select-modal';
import { SettingsModal, TAB_INDEX_SHORTCUTS } from '../components/modals/settings-modal';
import { SyncMergeModal } from '../components/modals/sync-merge-modal';
import { Toast } from '../components/toast';
import { type WrapperClass, Wrapper } from '../components/wrapper';
import withDragDropContext from '../context/app/drag-drop-context';
import { GrpcProvider } from '../context/grpc';
import { NunjucksEnabledProvider } from '../context/nunjucks/nunjucks-enabled-context';
import {
  newCommand,
} from '../redux/modules/global';
import { importUri } from '../redux/modules/import';
import {
  selectActiveActivity,
  selectActiveApiSpec,
  selectActiveCookieJar,
  selectActiveEnvironment,
  selectActiveProject,
  selectActiveRequest,
  selectActiveWorkspace,
  selectActiveWorkspaceMeta,
  selectActiveWorkspaceName,
  selectEnvironments,
  selectIsFinishedBooting,
  selectIsLoggedIn,
  selectSettings,
} from '../redux/selectors';
import { AppHooks } from './app-hooks';

interface State {
  vcs: VCS | null;
  gitVCS: GitVCS | null;
  forceRefreshCounter: number;
  forceRefreshHeaderCounter: number;
  isMigratingChildren: boolean;
}

ipcRenderer.on('toggle-preferences', () => {
  showModal(SettingsModal);
});

if (isDevelopment()) {
  ipcRenderer.on('clear-model', () => {
    const options = models
      .types()
      .filter(t => t !== models.settings.type) // don't clear settings
      .map(t => ({ name: t, value: t }));

    showSelectModal({
      title: 'Clear a model',
      message: 'Select a model to clear; this operation cannot be undone.',
      value: options[0].value,
      options,
      onDone: async type => {
        if (type) {
          const bufferId = await db.bufferChanges();
          console.log(`[developer] clearing all "${type}" entities`);
          const allEntities = await db.all(type);
          const filteredEntites = allEntities
            .filter(isNotDefaultProject); // don't clear the default project
          await db.batchModifyDocs({ remove: filteredEntites });
          db.flushChanges(bufferId);
        }
      },
    });
  });

  ipcRenderer.on('clear-all-models', () => {
    showModal(AskModal, {
      title: 'Clear all models',
      message: 'Are you sure you want to clear all models? This operation cannot be undone.',
      yesText: 'Yes',
      noText: 'No',
      onDone: async (yes: boolean) => {
        if (yes) {
          const bufferId = await db.bufferChanges();
          const promises = models
            .types()
            .filter(t => t !== models.settings.type) // don't clear settings
            .reverse().map(async type => {
              console.log(`[developer] clearing all "${type}" entities`);
              const allEntities = await db.all(type);
              const filteredEntites = allEntities
                .filter(isNotDefaultProject); // don't clear the default project
              await db.batchModifyDocs({ remove: filteredEntites });
            });
          await Promise.all(promises);
          db.flushChanges(bufferId);
        }
      },
    });
  });
}

async function reloadPlugins() {
  const settings = await models.settings.getOrCreate();
  await plugins.reloadPlugins();
  await themes.applyColorScheme(settings);
  templating.reload();
  console.log('[plugins] reloaded');
}

ipcRenderer.on('reload-plugins', reloadPlugins);

ipcRenderer.on('toggle-preferences-shortcuts', () => {
  showModal(SettingsModal, TAB_INDEX_SHORTCUTS);
});

const App = () => {
  const [state, setState] = useState<State>({
    vcs: null,
    gitVCS: null,
    forceRefreshCounter: 0,
    forceRefreshHeaderCounter: 0,
    isMigratingChildren: false,
  });
  const activeActivity = useSelector(selectActiveActivity);
  const activeProject = useSelector(selectActiveProject);
  const activeApiSpec = useSelector(selectActiveApiSpec);
  const activeWorkspaceName = useSelector(selectActiveWorkspaceName);
  const activeCookieJar = useSelector(selectActiveCookieJar);
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const activeRequest = useSelector(selectActiveRequest);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);
  const environments = useSelector(selectEnvironments);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const isFinishedBooting = useSelector(selectIsFinishedBooting);
  const settings = useSelector(selectSettings);
  const dispatch = useDispatch();
  const handleCommand = dispatch(newCommand);
  const handleImportUri = dispatch(importUri);

  const updateVCSLock = useRef<boolean | string>(false);
  const wrapperRef = useRef<WrapperClass | null>(null);

  // Update document title
  useEffect(() => {
    let title;

    if (activeActivity === ACTIVITY_HOME) {
      title = getProductName();
    } else if (activeWorkspace && activeWorkspaceName) {
      title = activeProject.name;
      title += ` - ${activeWorkspaceName}`;

      if (activeEnvironment) {
        title += ` (${activeEnvironment.name})`;
      }

      if (activeRequest) {
        title += ` – ${activeRequest.name}`;
      }
    }

    document.title = title || getProductName();
  }, [activeActivity, activeEnvironment, activeProject.name, activeRequest, activeWorkspace, activeWorkspaceName]);

  // let gitVCS = state.gitVCS;
  // useEffect(() => {
  //   // Get the vcs and set it to null in the state while we update it

  //   // if (gitVCS) {
  //   //   setState(state => ({
  //   //     ...state,
  //   //     gitVCS: null,
  //   //   }));
  //   // }

  //   if (!gitVCS) {
  //     gitVCS = new GitVCS();
  //   }

  //   async function update() {
  //     if (activeWorkspace && activeGitRepository && gitVCS) {
  //       // Create FS client
  //       const baseDir = path.join(
  //         getDataDirectory(),
  //         `version-control/git/${activeGitRepository._id}`,
  //       );

  //       /** All app data is stored within a namespaced GIT_INSOMNIA_DIR directory at the root of the repository and is read/written from the local NeDB database */
  //       const neDbClient = NeDBClient.createClient(activeWorkspace._id, activeProject._id);

  //       /** All git metadata in the GIT_INTERNAL_DIR directory is stored in a git/ directory on the filesystem */
  //       const gitDataClient = fsClient(baseDir);

  //       /** All data outside the directories listed below will be stored in an 'other' directory. This is so we can support files that exist outside the ones the app is specifically in charge of. */
  //       const otherDatClient = fsClient(path.join(baseDir, 'other'));

  //       /** The routable FS client directs isomorphic-git to read/write from the database or from the correct directory on the file system while performing git operations. */
  //       const routableFS = routableFSClient(otherDatClient, {
  //         [GIT_INSOMNIA_DIR]: neDbClient,
  //         [GIT_INTERNAL_DIR]: gitDataClient,
  //       });
  //       // Init VCS
  //       const { credentials, uri } = activeGitRepository;
  //       if (activeGitRepository.needsFullClone) {
  //         await models.gitRepository.update(activeGitRepository, {
  //           needsFullClone: false,
  //         });
  //         await gitVCS.initFromClone({
  //           url: uri,
  //           gitCredentials: credentials,
  //           directory: GIT_CLONE_DIR,
  //           fs: routableFS,
  //           gitDirectory: GIT_INTERNAL_DIR,
  //         });
  //       } else {
  //         await gitVCS.init({
  //           directory: GIT_CLONE_DIR,
  //           fs: routableFS,
  //           gitDirectory: GIT_INTERNAL_DIR,
  //         });
  //       }

  //       // Configure basic info
  //       const { author, uri: gitUri } = activeGitRepository;
  //       await gitVCS.setAuthor(author.name, author.email);
  //       await gitVCS.addRemote(gitUri);
  //     } else {
  //       // Create new one to un-initialize it
  //       gitVCS = new GitVCS();
  //     }

  //     setState(state => ({
  //       ...state,
  //       gitVCS,
  //     }));
  //   }

  //   update();
  // }, [activeGitRepository, activeProject._id, activeWorkspace, gitVCS]);

  // Update VCS when the active workspace changes
  useEffect(() => {
    const lock = generateId();
    updateVCSLock.current = lock;

    // Get the vcs and set it to null in the state while we update it
    let vcs = state.vcs;
    setState(state => ({
      ...state,
      vcs: null,
    }));

    if (!vcs) {
      const driver = FileSystemDriver.create(getDataDirectory());

      vcs = new VCS(driver, async conflicts => {
        return new Promise(resolve => {
          showModal(SyncMergeModal, {
            conflicts,
            handleDone: (conflicts: MergeConflict[]) => resolve(conflicts),
          });
        });
      });
    }

    if (activeWorkspace?._id) {
      vcs.switchProject(activeWorkspace._id);
    } else {
      vcs.clearBackendProject();
    }

    // Prevent a potential race-condition when _updateVCS() gets called for different workspaces in rapid succession
    if (updateVCSLock.current === lock) {
      setState(state => ({ ...state, vcs }));
    }
  }, [activeWorkspace?._id, state.vcs]);

  // Ensure Children: Make sure all the models exist or whatever
  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }

    const baseEnvironments = environments.filter(environment => environment.parentId === activeWorkspace._id);

    // Nothing to do
    if (baseEnvironments.length && activeCookieJar && activeApiSpec && activeWorkspaceMeta) {
      return;
    }

    // We already started migrating. Let it finish.
    if (state.isMigratingChildren) {
      return;
    }

    // Prevent rendering of everything
    setState(state => ({ ...state, isMigratingChildren: true }));
    async function update() {
      if (activeWorkspace) {
        const flushId = await db.bufferChanges();
        await models.workspace.ensureChildren(activeWorkspace);
        await db.flushChanges(flushId);
        setState(state => ({ ...state, isMigratingChildren: false }));
      }
    }

    update();
  }, [activeApiSpec, activeCookieJar, activeWorkspace, activeWorkspaceMeta, environments, state.isMigratingChildren]);

  // Force app refresh if login state changes
  useEffect(() => {
    setState(state => ({
      ...state,
      forceRefreshCounter: state.forceRefreshCounter + 1,
    }));
  }, [isLoggedIn]);

  // Give it a bit before letting the backend know it's ready
  useEffect(() => {
    setTimeout(() => ipcRenderer.send('window-ready'), 500);
  }, []);

  // Handle Application Commands
  useEffect(() => {
    ipcRenderer.on('run-command', (_, commandUri) => {
      const parsed = urlParse(commandUri, true);
      const command = `${parsed.hostname}${parsed.pathname}`;
      const args = JSON.parse(JSON.stringify(parsed.query));
      args.workspaceId = args.workspaceId || activeWorkspace?._id;
      handleCommand(command, args);
    });
  }, []);

  // Handle System Theme change
  useEffect(() => {
    const matches = window.matchMedia('(prefers-color-scheme: dark)');

    matches.addEventListener('change', () => themes.applyColorScheme(settings));

    return () => {
      matches.removeEventListener('change', () => themes.applyColorScheme(settings));
    };
  });

  // Global Drag and Drop
  useEffect(() => {
    // NOTE: This is required for "drop" event to trigger.
    document.addEventListener(
      'dragover',
      event => {
        event.preventDefault();
      },
      false,
    );

    document.addEventListener(
      'drop',
      async event => {
        event.preventDefault();

        if (!activeWorkspace) {
          return;
        }

        // @ts-expect-error -- TSCONVERSION
        if (event.dataTransfer.files.length === 0) {
          console.log('[drag] Ignored drop event because no files present');
          return;
        }

        // @ts-expect-error -- TSCONVERSION
        const file = event.dataTransfer.files[0];
        const { path } = file;
        const uri = `file://${path}`;
        await showAlert({
          title: 'Confirm Data Import',
          message: (
            <span>
              Import <code>{path}</code>?
            </span>
          ),
          addCancel: true,
        });
        handleImportUri(uri, { workspaceId: activeWorkspace?._id });
      },
      false,
    );
  });

  if (state.isMigratingChildren) {
    console.log('[app] Waiting for migration to complete');
    return null;
  }

  if (!isFinishedBooting) {
    console.log('[app] Waiting to finish booting');
    return null;
  }

  const {
    gitVCS,
    vcs,
  } = state;
  const uniquenessKey = `${isLoggedIn}::${activeWorkspace?._id || 'n/a'}`;

  return (
    <GrpcProvider>
      <NunjucksEnabledProvider>
        <AppHooks />
        <div className="app" key={uniquenessKey}>
          <ErrorBoundary showAlert>
            <Wrapper
              ref={wrapperRef}
              vcs={vcs}
              gitVCS={gitVCS}
            />
          </ErrorBoundary>

          <ErrorBoundary showAlert>
            <Toast />
          </ErrorBoundary>
        </div>
      </NunjucksEnabledProvider>
    </GrpcProvider>
  );
};

export default withDragDropContext(App);
