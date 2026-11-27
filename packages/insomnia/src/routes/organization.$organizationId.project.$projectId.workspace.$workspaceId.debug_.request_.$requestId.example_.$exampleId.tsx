import type { Example, ExamplePatch, ExampleRequest, ExampleResponse, Request, Settings } from 'insomnia-data';
import { models } from 'insomnia-data';
import { useCallback, useMemo, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { href, useNavigate, useParams } from 'react-router';

import { exampleKeys } from '~/common/app-data';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { ExampleRequestPane } from '~/ui/components/examples/example-request-pane';
import { ExampleResponsePane } from '~/ui/components/examples/example-response-pane';
import { OrganizationTabList } from '~/ui/components/tabs/tab-list';
import WorkspacePaneHeader from '~/ui/components/workspace/workspace-pane-header';
import { useDBQueryClient } from '~/ui/context/app/insomnia-app-data-context';
import { ExampleEditorContext } from '~/ui/context/example-editor-context';
import { useDebouncedCallback } from '~/ui/hooks/use-debounced-callback';
import { useExampleQuery } from '~/ui/hooks/use-example-data';
import { isExampleDeletedInSession, useUpdateExample } from '~/ui/hooks/use-example-mutations';
import { useNotFoundRedirect } from '~/ui/hooks/use-not-found-redirect';
import { usePaneDirection } from '~/ui/hooks/use-pane-direction';
import { useRootLoaderData } from '~/ui/hooks/use-root-loader-data';

/**
 * Request-shaped view of the example's snapshot for the shared HTTP editors. The
 * snapshot records the request's content; the settings and scripts it does not
 * record follow the parent request, with `init()` covering a parent that is not
 * in the loaded collection yet. Authentication is not part of a snapshot, so it
 * keeps the model default and the parent's config cannot leak into the URL
 * preview.
 */
const buildExampleRequest = (example: Example, parentRequest?: Request): Request => {
  const { authentication, ...requestDefaults } = models.request.init();
  return {
    ...requestDefaults,
    ...parentRequest,
    ...example.request,
    authentication,
    _id: example._id,
    parentId: example.parentId,
    type: models.request.type,
    name: example.name,
    created: example.created,
    modified: example.modified,
  };
};

const ExampleRoute = () => {
  const { organizationId, projectId, workspaceId, requestId, exampleId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
    requestId: string;
    exampleId: string;
  };
  const { settings } = useRootLoaderData()! as { settings: Settings };
  const { collection } = useWorkspaceLoaderData()!;
  // The mutation object is recreated per render; the bound `mutate` is stable,
  // which keeps the flush callback (and its unmount effect) stable too.
  const { mutate: updateExample } = useUpdateExample();
  const queryClient = useDBQueryClient();
  const exampleQuery = useExampleQuery(exampleId);
  const example = exampleQuery.data;
  const navigate = useNavigate();
  // The URL names a request/example pair, and nothing pre-validates it now:
  // once the query settles without data the example is gone or the URL is
  // stale, so fall back to the parent request.
  useNotFoundRedirect({
    isSettled: exampleQuery.isSuccess,
    isMissing: Boolean(
      exampleQuery.isSuccess && (!exampleQuery.data || exampleQuery.data.parentId !== requestId),
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

  const parentRequest = useMemo(() => {
    const doc = collection.find(item => item.doc._id === requestId)?.doc;
    return doc && models.request.isRequest(doc) ? doc : undefined;
  }, [collection, requestId]);
  const request = useMemo(
    () => (example ? buildExampleRequest(example, parentRequest) : undefined),
    [example, parentRequest],
  );

  // A debounced write still lands after the example is gone (the panes flush their
  // pending writes on unmount); the cache entry is the live answer to "is it still
  // there".
  const writeExample = useCallback(
    (targetExampleId: string, patch: ExamplePatch) => {
      if (!queryClient.getQueryData(exampleKeys.byId(targetExampleId))) {
        return;
      }
      updateExample({ exampleId: targetExampleId, patch });
    },
    [queryClient, updateExample],
  );
  const patchExample = useCallback(
    (patch: ExamplePatch) => example && writeExample(example._id, patch),
    [example, writeExample],
  );
  const patchResponse = useCallback(
    (patch: Partial<ExampleResponse>) => example && writeExample(example._id, { response: patch }),
    [example, writeExample],
  );

  const pendingRef = useRef<{ exampleId: string; patch: Partial<ExampleRequest> } | null>(null);

  const writePendingRequestPatch = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) {
      writeExample(pending.exampleId, { request: pending.patch });
    }
  }, [writeExample]);
  // Typing patches the snapshot on every keystroke; one write per keystroke would
  // rewrite the whole document, canned response body included. The hook coalesces
  // edits into one write per pause and flushes the last one on unmount.
  const scheduleRequestPatch = useDebouncedCallback(writePendingRequestPatch);

  const patchRequest = useCallback(
    (patch: Partial<Request>) => {
      if (!example) {
        return;
      }
      // Only the snapshot's own keys: an editor may hand over a whole Request patch.
      const requestPatch: Partial<ExampleRequest> = {};
      for (const key of Object.keys(models.example.baseExampleRequestSchema.shape) as (keyof ExampleRequest)[]) {
        if (key in patch) {
          requestPatch[key] = patch[key] as never;
        }
      }
      if (Object.keys(requestPatch).length === 0) {
        return;
      }
      // Apply the edit to the cache right away so the controlled editors render
      // it; only the database write is deferred.
      queryClient.setQueryData<Example>(exampleKeys.byId(example._id), previous =>
        previous ? { ...previous, request: { ...previous.request, ...requestPatch } } : previous,
      );
      // A pending write belongs to the example it was made on: write it before the
      // queue changes owner.
      if (pendingRef.current && pendingRef.current.exampleId !== example._id) {
        writePendingRequestPatch();
      }
      const previousPatch = pendingRef.current?.patch;
      pendingRef.current = {
        exampleId: example._id,
        patch: previousPatch ? { ...previousPatch, ...requestPatch } : { ...requestPatch },
      };
      scheduleRequestPatch();
    },
    [example, queryClient, scheduleRequestPatch, writePendingRequestPatch],
  );

  const exampleEditorContextValue = useMemo(
    () =>
      example && request
        ? {
            exampleId: example._id,
            description: example.description,
            request,
            response: example.response,
            patchExample,
            patchRequest,
            patchResponse,
          }
        : undefined,
    [example, patchExample, patchRequest, patchResponse, request],
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

  if (!example || !request || !exampleEditorContextValue) {
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
            <ExampleRequestPane key={example._id} />
          </Panel>
          <PanelResizeHandle
            className={direction === 'horizontal' ? 'h-full w-px bg-(--hl-md)' : 'h-px w-full bg-(--hl-md)'}
          />
          <Panel minSize={10} className="pane-two theme--pane">
            <ExampleResponsePane key={`${example._id}::response`} />
          </Panel>
        </PanelGroup>
      </div>
    </ExampleEditorContext.Provider>
  );
};

export default ExampleRoute;
