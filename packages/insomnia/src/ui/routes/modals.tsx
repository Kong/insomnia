import React, { type FC } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { ErrorBoundary } from '../components/error-boundary';
import { registerModal } from '../components/modals';
import { AddKeyCombinationModal } from '../components/modals/add-key-combination-modal';
import { AlertModal } from '../components/modals/alert-modal';
import { AskModal } from '../components/modals/ask-modal';
import { CodePromptModal } from '../components/modals/code-prompt-modal';
import { ErrorModal } from '../components/modals/error-modal';
import { FilterHelpModal } from '../components/modals/filter-help-modal';
import { GenerateCodeModal } from '../components/modals/generate-code-modal';
import { NunjucksModal } from '../components/modals/nunjucks-modal';
import { PromptModal } from '../components/modals/prompt-modal';
import { RequestRenderErrorModal } from '../components/modals/request-render-error-modal';
import { ResponseDebugModal } from '../components/modals/response-debug-modal';
import { SelectModal } from '../components/modals/select-modal';
import { SettingsModal } from '../components/modals/settings-modal';
import { SyncMergeModal } from '../components/modals/sync-merge-modal';
import { UpgradeModal } from '../components/modals/upgrade-modal';
import { WrapperModal } from '../components/modals/wrapper-modal';
import type { WorkspaceLoaderData } from './workspace';

const Modals: FC = () => {
  const workspaceData = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData | undefined;
  const { activeWorkspace, activeEnvironment } = workspaceData || {};

  return (
    <div key="modals" className="modals">
      <ErrorBoundary showAlert>
        <AlertModal ref={instance => registerModal(instance, 'AlertModal')} />
        <ErrorModal ref={instance => registerModal(instance, 'ErrorModal')} />
        <PromptModal
          ref={instance => registerModal(instance, 'PromptModal')}
        />
        <WrapperModal
          ref={instance => registerModal(instance, 'WrapperModal')}
        />
        <AskModal ref={instance => registerModal(instance, 'AskModal')} />
        <SelectModal
          ref={instance => registerModal(instance, 'SelectModal')}
        />
        <FilterHelpModal
          ref={instance => registerModal(instance, 'FilterHelpModal')}
        />
        <RequestRenderErrorModal
          ref={instance => registerModal(instance, 'RequestRenderErrorModal')}
        />

        <CodePromptModal
          ref={instance => registerModal(instance, 'CodePromptModal')}
        />

        {activeWorkspace ? (
          <>
            <NunjucksModal
              ref={instance => registerModal(instance, 'NunjucksModal')}
              workspace={activeWorkspace}
            />
          </>
        ) : null}

        <GenerateCodeModal
          ref={instance => registerModal(instance, 'GenerateCodeModal')}
          environmentId={activeEnvironment ? activeEnvironment._id : 'n/a'}
        />

        <SettingsModal
          ref={instance => registerModal(instance, 'SettingsModal')}
        />

        <ResponseDebugModal
          ref={instance => registerModal(instance, 'ResponseDebugModal')}
        />

        <AddKeyCombinationModal
          ref={instance => registerModal(instance, 'AddKeyCombinationModal')}
        />

        <SyncMergeModal
          ref={instance => registerModal(instance, 'SyncMergeModal')}
        />

        <UpgradeModal
          ref={instance => registerModal(instance, 'UpgradeModal')}
        />

      </ErrorBoundary>
    </div>
  );
};

export default Modals;
