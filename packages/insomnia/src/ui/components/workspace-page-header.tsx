import React, { FC, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { ACTIVITY_DEBUG, ACTIVITY_HOME, ACTIVITY_SPEC, ACTIVITY_UNIT_TEST, GlobalActivity } from '../../common/constants';
import { importRaw } from '../../common/import';
import { initializeSpectral, isLintError } from '../../common/spectral';
import * as models from '../../models';
import { isRemoteProject } from '../../models/project';
import { isCollection, isDesign } from '../../models/workspace';
import { useGitVCS } from '../hooks/use-git-vcs';
import { useVCS } from '../hooks/use-vcs';
import { setActiveActivity } from '../redux/modules/global';
import { selectActiveActivity, selectActiveApiSpec, selectActiveGitRepository, selectActiveProject, selectActiveProjectName, selectActiveWorkspace, selectIsLoggedIn } from '../redux/selectors';
import { ActivityToggle } from './activity-toggle/activity-toggle';
import { AppHeader } from './app-header';
import { GitSyncDropdown } from './dropdowns/git-sync-dropdown';
import { SyncDropdown } from './dropdowns/sync-dropdown';
import { WorkspaceDropdown } from './dropdowns/workspace-dropdown';
import { showModal } from './modals';
import { AlertModal } from './modals/alert-modal';

export type HandleActivityChange = (options: {
  workspaceId?: string;
  nextActivity: GlobalActivity;
}) => Promise<void>;

// TODO(jackkav): find the right place to initializeSpectral
const spectral = initializeSpectral();
export const WorkspacePageHeader: FC = () => {
  const activeApiSpec = useSelector(selectActiveApiSpec);
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeActivity = useSelector(selectActiveActivity);
  const dispatch = useDispatch();

  const handleActivityChange: HandleActivityChange = useCallback(async ({ workspaceId, nextActivity }) => {
    // Remember last activity on workspace for later, but only if it isn't HOME
    if (workspaceId && nextActivity !== ACTIVITY_HOME) {
      await models.workspaceMeta.updateByParentId(workspaceId, {
        activeActivity: nextActivity,
      });
    }
    const editingASpec = activeActivity === ACTIVITY_SPEC;
    if (!editingASpec) {
      dispatch(setActiveActivity(nextActivity));
      return;
    }
    if (!activeApiSpec || !workspaceId) {
      return;
    }
    const goingToDebugOrTest = nextActivity === ACTIVITY_DEBUG || nextActivity === ACTIVITY_UNIT_TEST;
    // If editing a spec and not going to debug or test, don't regenerate anything
    if (editingASpec && !goingToDebugOrTest) {
      dispatch(setActiveActivity(nextActivity));
      return;
    }
    // Handle switching away from the spec design activity. For this, we want to generate
    // requests that can be accessed from debug or test.
    // If there are errors in the spec, show the user a warning first
    const results = (await spectral.run(activeApiSpec.contents)).filter(isLintError);
    if (activeApiSpec.contents && results && results.length) {
      showModal(AlertModal, {
        title: 'Error Generating Configuration',
        message: 'Some requests may not be available due to errors found in the specification. We recommend fixing errors before proceeding.',
        okLabel: 'Proceed',
        addCancel: true,
        onConfirm: () => {
          dispatch(setActiveActivity(nextActivity));
        },
      });
      return;
    }

    // TODO(gatzjames): make import on navigation optional
    // Delaying generation so design to debug mode is smooth
    dispatch(setActiveActivity(nextActivity));
    setTimeout(() => {
      importRaw(activeApiSpec.contents, {
        getWorkspaceId: () => Promise.resolve(workspaceId),
        enableDiffBasedPatching: true,
        enableDiffDeep: true,
        bypassDiffProps: {
          url: true,
        },
      });
    }, 1000);
  }, [activeActivity, activeApiSpec, dispatch]);

  const activeProjectName = useSelector(selectActiveProjectName);
  const activeProject = useSelector(selectActiveProject);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const activeGitRepository = useSelector(selectActiveGitRepository);

  const vcs = useVCS({
    workspaceId: activeWorkspace?._id,
  });

  const gitVCS = useGitVCS({
    workspaceId: activeWorkspace?._id,
    projectId: activeProject?._id,
    gitRepository: activeGitRepository,
  });
  const isTeamSync = isLoggedIn && activeWorkspace && isCollection(activeWorkspace) && isRemoteProject(activeProject) && vcs;
  const isGitSync = activeWorkspace && gitVCS && isDesign(activeWorkspace);
  if (!activeWorkspace || !activeApiSpec || !activeActivity) {
    return null;
  }

  const crumbs = [
    { id: 'project', node: activeProjectName, onClick: () => handleActivityChange({ workspaceId: activeWorkspace?._id, nextActivity: ACTIVITY_HOME }) },
    { id: 'workspace', node: <WorkspaceDropdown key="workspace-dd" /> },
  ];

  return (
    <AppHeader
      breadcrumbProps={{ crumbs }}
      gridCenter={
        <ActivityToggle
          workspace={activeWorkspace}
          activity={activeActivity}
          handleActivityChange={handleActivityChange}
        />
      }
      gridRight={isTeamSync ? <SyncDropdown
        workspace={activeWorkspace}
        project={activeProject}
        vcs={vcs}
      /> : isGitSync ? <GitSyncDropdown
        className="margin-left"
        workspace={activeWorkspace}
        vcs={gitVCS}
      /> : null}
    />
  );
};
