import { ipcRenderer } from 'electron';
import path from 'path';
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { parse as urlParse } from 'url';

import { database as db } from '../../common/database';
import { getDataDirectory } from '../../common/electron-helpers';
import {
  generateId,
} from '../../common/misc';
import * as models from '../../models';
import { GitRepository } from '../../models/git-repository';
import * as themes from '../../plugins/misc';
import { fsClient } from '../../sync/git/fs-client';
import { GIT_CLONE_DIR, GIT_INSOMNIA_DIR, GIT_INTERNAL_DIR, GitVCS } from '../../sync/git/git-vcs';
import { NeDBClient } from '../../sync/git/ne-db-client';
import { routableFSClient } from '../../sync/git/routable-fs-client';
import FileSystemDriver from '../../sync/store/drivers/file-system-driver';
import { type MergeConflict } from '../../sync/types';
import { VCS } from '../../sync/vcs/vcs';
import { ErrorBoundary } from '../components/error-boundary';
import { AlertModal } from '../components/modals/alert-modal';
import { showModal } from '../components/modals/index';
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
  selectActiveApiSpec,
  selectActiveCookieJar,
  selectActiveGitRepository,
  selectActiveProject,
  selectActiveWorkspace,
  selectActiveWorkspaceMeta,
  selectEnvironments,
  selectIsFinishedBooting,
  selectIsLoggedIn,
  selectSettings,
} from '../redux/selectors';
import { AppHooks } from './app-hooks';

interface State {
  isMigratingChildren: boolean;
}

function useVCS({
  workspaceId,
}: {
  workspaceId?: string;
}) {
  const vcsInstanceRef = useRef<VCS | null>(null);
  const [vcs, setVCS] = useState<VCS | null>(null);
  const updateVCSLock = useRef<boolean | string>(false);

  // Update VCS when the active workspace changes
  useEffect(() => {
    const lock = generateId();
    updateVCSLock.current = lock;

    // Set vcs to null while we update it
    setVCS(null);

    if (!vcsInstanceRef.current) {
      const driver = FileSystemDriver.create(getDataDirectory());

      vcsInstanceRef.current = new VCS(driver, async conflicts => {
        return new Promise(resolve => {
          showModal(SyncMergeModal, {
            conflicts,
            handleDone: (conflicts: MergeConflict[]) => resolve(conflicts),
          });
        });
      });
    }

    if (workspaceId) {
      vcsInstanceRef.current.switchProject(workspaceId);
    } else {
      vcsInstanceRef.current.clearBackendProject();
    }

    // Prevent a potential race-condition when _updateVCS() gets called for different workspaces in rapid succession
    if (updateVCSLock.current === lock) {
      setVCS(vcsInstanceRef.current);
    }
  }, [workspaceId]);

  return vcs;
}

function useGitVCS({
  workspaceId,
  projectId,
  gitRepository,
}: {
  workspaceId?: string;
  projectId: string;
  gitRepository?: GitRepository | null;
}) {
  const gitVCSInstanceRef = useRef<GitVCS | null>(null);
  const [gitVCS, setGitVCS] = useState<GitVCS | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Set the instance to null in the state while we update it
    if (gitVCSInstanceRef.current) {
      setGitVCS(null);
    }

    if (!gitVCSInstanceRef.current) {
      gitVCSInstanceRef.current = new GitVCS();
    }

    async function update() {
      if (workspaceId && gitRepository && gitVCSInstanceRef.current) {
        // Create FS client
        const baseDir = path.join(
          getDataDirectory(),
          `version-control/git/${gitRepository._id}`,
        );

        /** All app data is stored within a namespaced GIT_INSOMNIA_DIR directory at the root of the repository and is read/written from the local NeDB database */
        const neDbClient = NeDBClient.createClient(workspaceId, projectId);

        /** All git metadata in the GIT_INTERNAL_DIR directory is stored in a git/ directory on the filesystem */
        const gitDataClient = fsClient(baseDir);

        /** All data outside the directories listed below will be stored in an 'other' directory. This is so we can support files that exist outside the ones the app is specifically in charge of. */
        const otherDatClient = fsClient(path.join(baseDir, 'other'));

        /** The routable FS client directs isomorphic-git to read/write from the database or from the correct directory on the file system while performing git operations. */
        const routableFS = routableFSClient(otherDatClient, {
          [GIT_INSOMNIA_DIR]: neDbClient,
          [GIT_INTERNAL_DIR]: gitDataClient,
        });
        // Init VCS
        const { credentials, uri } = gitRepository;
        if (gitRepository.needsFullClone) {
          await models.gitRepository.update(gitRepository, {
            needsFullClone: false,
          });
          await gitVCSInstanceRef.current.initFromClone({
            url: uri,
            gitCredentials: credentials,
            directory: GIT_CLONE_DIR,
            fs: routableFS,
            gitDirectory: GIT_INTERNAL_DIR,
          });
        } else {
          await gitVCSInstanceRef.current.init({
            directory: GIT_CLONE_DIR,
            fs: routableFS,
            gitDirectory: GIT_INTERNAL_DIR,
          });
        }

        // Configure basic info
        const { author, uri: gitUri } = gitRepository;
        await gitVCSInstanceRef.current.setAuthor(author.name, author.email);
        await gitVCSInstanceRef.current.addRemote(gitUri);
      } else {
        // Create new one to un-initialize it
        gitVCSInstanceRef.current = new GitVCS();
      }

      isMounted && setGitVCS(gitVCSInstanceRef.current);
    }

    update();

    return () => {
      isMounted = false;
    };
  }, [workspaceId, projectId, gitRepository]);

  return gitVCS;
}

const App = () => {
  const [state, setState] = useState<State>({
    isMigratingChildren: false,
  });

  const activeProject = useSelector(selectActiveProject);
  const activeCookieJar = useSelector(selectActiveCookieJar);
  const activeApiSpec = useSelector(selectActiveApiSpec);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeGitRepository = useSelector(selectActiveGitRepository);
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);
  const environments = useSelector(selectEnvironments);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const isFinishedBooting = useSelector(selectIsFinishedBooting);
  const settings = useSelector(selectSettings);
  const dispatch = useDispatch();
  const handleCommand = dispatch(newCommand);
  const handleImportUri = dispatch(importUri);
  const vcs = useVCS({
    workspaceId: activeWorkspace?._id,
  });

  const gitVCS = useGitVCS({
    workspaceId: activeWorkspace?._id,
    projectId: activeProject?._id,
    gitRepository: activeGitRepository,
  });

  const wrapperRef = useRef<WrapperClass | null>(null);

  // Ensure Children: Make sure cookies, env, and meta models are created under this workspace
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

    // Prevent rendering of everything until we check the workspace has cookies, env, and meta
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
  }, [activeWorkspace?._id, handleCommand]);

  // Handle System Theme change
  useEffect(() => {
    const matches = window.matchMedia('(prefers-color-scheme: dark)');
    matches.addEventListener('change', () => themes.applyColorScheme(settings));
    return () => {
      matches.removeEventListener('change', () => themes.applyColorScheme(settings));
    };
  });

  // Global Drag and Drop for importing files
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
        const files = event.dataTransfer?.files || [];
        if (files.length === 0) {
          console.log('[drag] Ignored drop event because no files present');
          return;
        }
        const file = files[0];
        if (!file?.path) {
          return;
        }
        await showModal(AlertModal, {
          title: 'Confirm Data Import',
          message: (
            <span>
              Import <code>{file.path}</code>?
            </span>
          ),
          addCancel: true,
        });
        handleImportUri(`file://${file.path}`, { workspaceId: activeWorkspace?._id });
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
