import { type QueryClient, type QueryKey, useMutation, type UseMutationResult } from '@tanstack/react-query';
import type {
  CollectionWorkspaceChildren,
  DesignWorkspaceChildren,
  Example,
  ExamplePatch,
  ExampleRequest,
  ExampleResponse,
  ExampleSummary,
  Request,
  WorkspaceChildren,
} from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { RESPONSE_CODE_REASONS } from 'insomnia-data/common';
import { useNavigate } from 'react-router';

import { exampleKeys, workspaceChildrenKeys } from '~/common/app-data';
import { showError } from '~/ui/components/modals';
import { useDBQueryClient } from '~/ui/context/app/insomnia-app-data-context';
import type { ExampleData } from '~/ui/hooks/use-example-data';
import { buildResourceUrl } from '~/ui/hooks/use-insomnia-navigation';

/** Variables accepted by `useUpdateExample().mutate`. */
export interface UpdateExampleVariables {
  exampleId: string;
  parentId: string;
  patch: ExamplePatch;
}

/** Variables accepted by `useDeleteExample().mutate`. */
export interface DeleteExampleVariables {
  exampleId: string;
  parentId: string;
}

// Examples deleted during this session. The example route reads this to tell a
// user-initiated delete (return to the parent request quietly) from a stale URL
// (warn that the resource is gone).
const deletedExampleIds = new Set<string>();

export const isExampleDeletedInSession = (exampleId: string) => deletedExampleIds.has(exampleId);

/** Variables accepted by `useDuplicateExample().mutate`. */
export interface DuplicateExampleVariables {
  exampleId: string;
  parentId: string;
  name?: string;
}

/** Variables accepted by `useCreateExample().mutate`. */
export interface CreateExampleVariables {
  requestId: string;
  // Target request's location, used both for the write and for post-create
  // navigation — never infer these from the calling component's route params.
  workspaceId: string;
  projectId: string;
  organizationId: string;
  name?: string;
  // Partial snapshot overriding the fields snapshotted from the parent request
  request?: Partial<ExampleRequest>;
  response?: Partial<ExampleResponse>;
}

/** Variables accepted by `useCreateRequestFromExample().mutate`. */
export interface CreateRequestFromExampleVariables {
  exampleId: string;
  parentId: string;
  // Target request's location, used for post-create navigation — never infer
  // these from the calling component's route params (the sidebar can trigger a
  // create for a request in a different workspace).
  workspaceId: string;
  projectId: string;
  organizationId: string;
}

// The default name mirrors the HTTP reason phrases used across the app
// ("404 Not Found"); creation payloads may override it.
const buildExampleName = (response: Pick<ExampleResponse, 'statusCode' | 'statusMessage'>) => {
  const reason = response.statusMessage || RESPONSE_CODE_REASONS[response.statusCode] || '';
  return `${response.statusCode} ${reason}`.trim();
};

/**
 * Apply a transform to the `examples` list of every cached workspace-children
 * query that holds it (collection and design scopes both carry examples).
 * Transforms must return the same array reference when nothing changed —
 * inserts, by returning a new array only for the workspace that actually owns
 * the document, leave every other cached workspace untouched.
 */
const mapCachedExampleLists = (
  queryClient: QueryClient,
  transform: (
    examples: ExampleSummary[],
    children: CollectionWorkspaceChildren['data'] | DesignWorkspaceChildren['data'],
  ) => ExampleSummary[],
) => {
  for (const [queryKey, data] of queryClient.getQueriesData<WorkspaceChildren>({
    queryKey: workspaceChildrenKeys.all,
  })) {
    if (!data || !('examples' in data.data)) {
      continue;
    }
    const nextExamples = transform(data.data.examples, data.data);
    if (nextExamples === data.data.examples) {
      continue;
    }
    queryClient.setQueryData<WorkspaceChildren>(queryKey, {
      ...data,
      data: { ...data.data, examples: nextExamples },
    } as WorkspaceChildren);
  }
};

/**
 * Snapshot of just the `examples` arrays, per query key — not the whole
 * WorkspaceChildren payload. Restoring only the examples array leaves any
 * sibling fields (requestsAndGroups, dataMetas, ...) that DB change events
 * patched during the optimistic window intact.
 */
type CachedExampleLists = [QueryKey, ExampleSummary[]][];

const snapshotExampleCaches = (queryClient: QueryClient): CachedExampleLists => {
  const snapshots: CachedExampleLists = [];
  for (const [queryKey, data] of queryClient.getQueriesData<WorkspaceChildren>({
    queryKey: workspaceChildrenKeys.all,
  })) {
    if (data && 'examples' in data.data) {
      snapshots.push([queryKey, data.data.examples]);
    }
  }
  return snapshots;
};

const restoreExampleCaches = (queryClient: QueryClient, snapshots: CachedExampleLists) => {
  for (const [queryKey, examples] of snapshots) {
    queryClient.setQueryData<WorkspaceChildren>(queryKey, previous => {
      // Do not resurrect a query that left the cache during the window.
      if (!previous || !('examples' in previous.data)) {
        return previous;
      }
      // TS cannot distribute this spread over the narrowed union, so the
      // result must be cast back to WorkspaceChildren.
      return { ...previous, data: { ...previous.data, examples } } as WorkspaceChildren;
    });
  }
};

/**
 * Update an example. The service layer owns the write invariants (identity
 * stripping, shallow merge, parent validation); the mutation optimistically
 * patches both caches that can hold the document — the editor's full-doc query
 * and the sidebar's summary list — and rolls them back on failure. The
 * authoritative result from the write replaces the optimistic value.
 */
export const useUpdateExample = (): UseMutationResult<Example, Error, UpdateExampleVariables> => {
  const queryClient = useDBQueryClient();

  return useMutation(
    {
      mutationKey: ['example', 'update'],
      // Serialize all example writes so rapid successive edits (typing, drag
      // drops) queue instead of interleaving read/merge/write rounds.
      scope: { id: 'example' },
      mutationFn: ({ exampleId, parentId, patch }: UpdateExampleVariables) =>
        services.example.update(exampleId, patch, parentId),
      onMutate: variables => {
        const listSnapshots = snapshotExampleCaches(queryClient);
        const detailKey = exampleKeys.byId(variables.exampleId);
        const previousDetail = queryClient.getQueryData<ExampleData>(detailKey);
        if (previousDetail) {
          const predicted = {
            ...previousDetail.example,
            ...models.example.applyExamplePatch(previousDetail.example, variables.patch),
          };
          queryClient.setQueryData<ExampleData>(detailKey, { ...previousDetail, example: predicted });
        }
        mapCachedExampleLists(queryClient, examples =>
          examples.map(example =>
            example._id === variables.exampleId
              ? models.example.applyExampleSummaryPatch(example, variables.patch)
              : example,
          ),
        );
        return { listSnapshots, detailKey, previousDetail };
      },
      onSuccess: (updated, { exampleId }) => {
        queryClient.setQueryData<ExampleData>(exampleKeys.byId(exampleId), previous =>
          previous ? { ...previous, example: updated } : previous,
        );
      },
      onError: (error, _variables, context) => {
        if (context) {
          restoreExampleCaches(queryClient, context.listSnapshots);
          if (context.previousDetail) {
            queryClient.setQueryData(context.detailKey, context.previousDetail);
          }
        }
        showError(error);
      },
    },
    queryClient,
  );
};

/**
 * Delete an example. The caches are reconciled only after the delete is
 * confirmed, so a queued or failed delete never reads as "already gone".
 * Navigation after a delete is owned by the layers that know the tab and route
 * state (tab close + the example route's not-found redirect); this mutation
 * stays data-only.
 */
export const useDeleteExample = (): UseMutationResult<string, Error, DeleteExampleVariables> => {
  const queryClient = useDBQueryClient();

  return useMutation(
    {
      mutationKey: ['example', 'delete'],
      scope: { id: 'example' },
      mutationFn: async ({ exampleId, parentId }: DeleteExampleVariables) => {
        await services.example.remove(exampleId, parentId);
        return exampleId;
      },
      onError: error => showError(error),
      onSuccess: (_deleted, { exampleId }) => {
        deletedExampleIds.add(exampleId);
        mapCachedExampleLists(queryClient, examples => {
          const next = examples.filter(candidate => candidate._id !== exampleId);
          return next.length === examples.length ? examples : next;
        });
        queryClient.removeQueries({ queryKey: exampleKeys.byId(exampleId) });
      },
    },
    queryClient,
  );
};

/**
 * Duplicate an example. The copy's id is unknown until the write lands, so
 * there is no optimistic insert; the duplicated document is added to the
 * workspace under its parent request.
 */
export const useDuplicateExample = (): UseMutationResult<Example, Error, DuplicateExampleVariables> => {
  const queryClient = useDBQueryClient();

  return useMutation(
    {
      mutationKey: ['example', 'duplicate'],
      scope: { id: 'example' },
      mutationFn: ({ exampleId, parentId, name }: DuplicateExampleVariables) =>
        services.example.duplicate(exampleId, name ? { name } : {}, parentId),
      onSuccess: duplicated => {
        // Insert only into the workspace whose children actually contain the
        // parent request — other cached workspaces must stay untouched.
        mapCachedExampleLists(queryClient, (examples, children) => {
          if (!children.requestsAndGroups.some(request => request._id === duplicated.parentId)) {
            return examples;
          }
          // The DB change listener may have refetched this workspace first;
          // appending blindly would render the row twice.
          return examples.some(item => item._id === duplicated._id)
            ? examples
            : [...examples, models.example.toExampleSummary(duplicated)];
        });
      },
      onError: error => showError(error),
    },
    queryClient,
  );
};

/**
 * Create an example snapshotting an HTTP request, then navigate to its editor.
 * Snapshot assembly and creation invariants live in the service; the default
 * name ("200 OK") is a presentation concern and stays renderer-side. The
 * variables carry the target request's org/project/workspace ids so the
 * post-create navigation always lands on the created example's own location.
 */
export const useCreateExample = (): UseMutationResult<Example, Error, CreateExampleVariables> => {
  const queryClient = useDBQueryClient();
  const navigate = useNavigate();

  return useMutation(
    {
      mutationKey: ['example', 'create'],
      scope: { id: 'example' },
      mutationFn: async ({ requestId, workspaceId, name, request, response }: CreateExampleVariables) => {
        const created = await services.example.createFromRequest(
          requestId,
          { name: name ?? buildExampleName({ statusCode: response?.statusCode ?? 200, statusMessage: response?.statusMessage ?? '' }), request, response },
          workspaceId,
        );
        return created;
      },
      onSuccess: (created, variables) => {
        // Insert only into the workspace whose children actually contain the
        // parent request — other cached workspaces must stay untouched.
        mapCachedExampleLists(queryClient, (examples, children) => {
          if (!children.requestsAndGroups.some(request => request._id === created.parentId)) {
            return examples;
          }
          // Same race as duplicate: a refetch may have inserted the row first.
          return examples.some(item => item._id === created._id)
            ? examples
            : [...examples, models.example.toExampleSummary(created)];
        });
        // Navigate using the target request's own location from the variables,
        // not the calling component's route params (the sidebar can trigger a
        // create for a request in a different workspace, and project-level
        // routes leave workspaceId undefined).
        navigate(
          buildResourceUrl({
            organizationId: variables.organizationId,
            projectId: variables.projectId,
            workspaceId: variables.workspaceId,
            resource: created,
          }),
        );
      },
      onError: error => showError(error),
    },
    queryClient,
  );
};

/**
 * Promote an example back into a first-class request, then navigate to the
 * new request. The service owns the sibling sort-key placement.
 */
export const useCreateRequestFromExample = (): UseMutationResult<Request, Error, CreateRequestFromExampleVariables> => {
  const queryClient = useDBQueryClient();
  const navigate = useNavigate();

  return useMutation(
    {
      mutationKey: ['example', 'create-request'],
      scope: { id: 'example' },
      mutationFn: ({ exampleId, parentId }: CreateRequestFromExampleVariables) =>
        services.request.createFromExample(exampleId, parentId),
      onSuccess: (created, variables) => {
        // The created request enters the sidebar via the DB change listener
        // (insert events invalidate the workspace children); navigate to it.
        navigate(
          buildResourceUrl({
            organizationId: variables.organizationId,
            projectId: variables.projectId,
            workspaceId: variables.workspaceId,
            resource: created,
          }),
        );
      },
      onError: error => showError(error),
    },
    queryClient,
  );
};
