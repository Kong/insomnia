import type { Example, ExampleRequest, Request, Settings } from 'insomnia-data';
import { useCallback, useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { href, useNavigate, useParams } from 'react-router';

import { useRootLoaderData } from '~/root';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { ExampleRequestPane } from '~/ui/components/examples/example-request-pane';
import { ExampleResponsePane } from '~/ui/components/examples/example-response-pane';
import { OrganizationTabList } from '~/ui/components/tabs/tab-list';
import WorkspacePaneHeader from '~/ui/components/workspace/workspace-pane-header';
import { ExampleEditorContext } from '~/ui/context/example-editor-context';
import { useExampleQuery } from '~/ui/hooks/use-example-data';
import { isExampleDeletedInSession } from '~/ui/hooks/use-example-mutations';
import { useUpdateExample } from '~/ui/hooks/use-example-mutations';
import { useNotFoundRedirect } from '~/ui/hooks/use-not-found-redirect';
import { usePaneDirection } from '~/ui/hooks/use-pane-direction';

// Keys of the Example request snapshot that editor components may patch
const EXAMPLE_REQUEST_KEYS = [
  'method',
  'url',
  'parameters',
  'pathParameters',
  'headers',
  'body',
  'authentication',
] as const;

const buildExampleRequest = (parentRequest: Request, example: Example): Request => ({
  ...parentRequest,
  method: example.request.method,
  url: example.request.url,
  parameters: example.request.parameters,
  pathParameters: example.request.pathParameters ?? parentRequest.pathParameters,
  headers: example.request.headers,
  body: example.request.body,
  authentication: example.request.authentication as Request['authentication'],
  _id: example._id,
  name: example.name,
});

const ExampleRoute = () => {
  const { organizationId, projectId, workspaceId, requestId, exampleId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    requestId: string;
    exampleId: string;
  };
  const { settings } = useRootLoaderData()! as { settings: Settings };
  const { activeEnvironment } = useWorkspaceLoaderData()!;
  const updateExample = useUpdateExample();
  const exampleQuery = useExampleQuery(exampleId);
  const example = exampleQuery.data?.example;
  const parentRequest = exampleQuery.data?.parentRequest;
  const navigate = useNavigate();
  // The URL names a request/example pair, and nothing pre-validates it now:
  // once the query settles without data the example is gone or the URL is
  // stale, so fall back to the parent request.
  useNotFoundRedirect({
    isSettled: exampleQuery.isSuccess,
    isMissing: Boolean(
      exampleQuery.isSuccess && (!exampleQuery.data || exampleQuery.data.example.parentId !== requestId),
    ),
    to: href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId', {
      organizationId,
      projectId,
      workspaceId,
      requestId,
    }),
    message: `Example not found: ${exampleId}`,
    // Deleting the open example is not a stale URL; do not warn about it.
    silent: isExampleDeletedInSession(exampleId),
  });

  const direction = usePaneDirection(settings.forceVerticalLayout);

  const request = useMemo(
    () => (example && parentRequest ? buildExampleRequest(parentRequest, example) : undefined),
    [parentRequest, example],
  );

  const patchRequest = useCallback(
    (_exampleId: string, patch: Partial<Request>) => {
      if (!example) {
        return;
      }
      const requestPatch: Partial<ExampleRequest> = {};
      for (const key of EXAMPLE_REQUEST_KEYS) {
        if (key in patch) {
          requestPatch[key] = patch[key] as never;
        }
      }
      // Submit only the changed keys — the mutation shallow-merges onto the
      // current snapshot, so rapid successive edits never roll each other back
      // with stale full-snapshot values.
      updateExample.mutate({ exampleId: example._id, parentId: example.parentId, patch: { request: requestPatch } });
    },
    [example, updateExample],
  );

  const exampleEditorContextValue = useMemo(
    () =>
      example && request
        ? {
            exampleId: example._id,
            request,
            patchRequest,
          }
        : undefined,
    [example, patchRequest, request],
  );

  if (exampleQuery.isError) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-(--hl)">
        <span>Failed to load this example.</span>
        <button
          className="btn btn--clicky"
          onClick={() =>
            navigate(
              href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug/request/:requestId', {
                organizationId,
                projectId,
                workspaceId,
                requestId,
              }),
              { replace: true },
            )
          }
        >
          Back to request
        </button>
      </div>
    );
  }

  if (!example || !parentRequest || !request || !exampleEditorContextValue) {
    // Pending first paint (cache miss on a deep link) or a stale URL that the
    // effect above is redirecting away from.
    return (
      <div className="flex h-full w-full items-center justify-center text-(--hl)">
        {exampleQuery.isPending && <i className="fa fa-spinner fa-spin" />}
      </div>
    );
  }

  return (
    <ExampleEditorContext.Provider value={exampleEditorContextValue}>
      <div className="new-sidebar flex h-full w-full flex-col text-(--color-font)">
        <OrganizationTabList currentPage="debug" />
        <WorkspacePaneHeader hasSettings />
        <PanelGroup autoSaveId="insomnia-example-panels" className="min-h-0 flex-1 text-(--color-font)" direction={direction}>
          <Panel minSize={10} className="pane-one theme--pane">
            <ExampleRequestPane
              key={example._id}
              example={example}
              request={request}
              environmentId={activeEnvironment ? activeEnvironment._id : ''}
              settings={settings}
            />
          </Panel>
          <PanelResizeHandle
            className={direction === 'horizontal' ? 'h-full w-px bg-(--hl-md)' : 'h-px w-full bg-(--hl-md)'}
          />
          <Panel minSize={10} className="pane-two theme--pane">
            <ExampleResponsePane
              key={`${example._id}::response`}
              example={example}
            />
          </Panel>
        </PanelGroup>
      </div>
    </ExampleEditorContext.Provider>
  );
};

export default ExampleRoute;
