import React, { createContext, FC, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { ChangeBufferEvent, database } from '../../../common/database';
import * as models from '../../../models';
import { prepareSidebarEntities } from '../../../utils/create-sidebar';
import { Child } from '../../routes/workspace';

const WorkspaceContext = createContext({
  requestTree: [],
});
const sidebarModels = [models.request.type, models.requestGroup.type, models.grpcRequest.type, models.webSocketRequest.type];
export const WorkspaceProvider: FC<PropsWithChildren> = ({ children }) => {
  const {
    workspaceId,
  } = useParams() as {
    workspaceId: string;
  };
  const [requestTree, setRequestTree] = useState<Child[]>([]);
  useEffect(() => {
    const fn = async () => {
      const { requestTree } = await prepareSidebarEntities({ workspaceId });
      setRequestTree(requestTree);
    };
    fn();
  }, [workspaceId]);

  useEffect(() => {
    database.onChange(async (changes: ChangeBufferEvent[]) => {
      for (const change of changes) {
        const [event, doc] = change;
        // could make this more efficient by only updating the tree when a request is added/removed/renamed or moved
        if (sidebarModels.includes(doc.type)) {
          const { requestTree } = await prepareSidebarEntities({ workspaceId });
          setRequestTree(requestTree);
        }
      }
    });
  }, [workspaceId]);

  return (
    <WorkspaceContext.Provider
      value={{
        requestTree,
        // generating: loading || (progress.total > 0 && progress.progress < progress.total),
        // progress,
        // generateTests: () => {
        //   aiGenerateTestsFetcher.submit({}, {
        //     method: 'post',
        //     action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/ai/generate/tests`,
        //   });
        // },
        // generateTestsFromSpec: () => {
        //   aiGenerateTestsFromSpecFetcher.submit({}, {
        //     method: 'post',
        //     action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/ai/generate/collection-and-tests`,
        //   });
        // },
        // access: {
        //   enabled: isAIEnabled,
        //   loading: aiAccessFetcher.state !== 'idle',
        // },
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspaceContext = () => useContext(WorkspaceContext);
