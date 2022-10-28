import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Outlet } from 'react-router-dom';

import { database as db } from '../../common/database';
import * as models from '../../models';
import { ErrorBoundary } from '../components/error-boundary';
import { Toast } from '../components/toast';
import { AppHooks } from '../containers/app-hooks';
import withDragDropContext from '../context/app/drag-drop-context';
import { GrpcProvider } from '../context/grpc';
import { NunjucksEnabledProvider } from '../context/nunjucks/nunjucks-enabled-context';
import {
  selectActiveApiSpec,
  selectActiveCookieJar,
  selectActiveWorkspace,
  selectActiveWorkspaceMeta,
  selectEnvironments,
  selectIsFinishedBooting,
  selectIsLoggedIn,
} from '../redux/selectors';
import Modals from './modals';

interface State {
  isMigratingChildren: boolean;
}

const Root = () => {
  const [state, setState] = useState<State>({
    isMigratingChildren: false,
  });

  const activeCookieJar = useSelector(selectActiveCookieJar);
  const activeApiSpec = useSelector(selectActiveApiSpec);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);
  const environments = useSelector(selectEnvironments);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const isFinishedBooting = useSelector(selectIsFinishedBooting);

  // Ensure Children: Make sure cookies, env, and meta models are created under this workspace
  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }
    const baseEnvironments = environments.filter(environment => environment.parentId === activeWorkspace._id);
    const workspaceHasChildren = baseEnvironments.length && activeCookieJar && activeApiSpec && activeWorkspaceMeta;
    if (workspaceHasChildren) {
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
            <Modals />
            <Outlet />
          </ErrorBoundary>

          <ErrorBoundary showAlert>
            <Toast />
          </ErrorBoundary>
        </div>
      </NunjucksEnabledProvider>
    </GrpcProvider>
  );
};

export default withDragDropContext(Root);
