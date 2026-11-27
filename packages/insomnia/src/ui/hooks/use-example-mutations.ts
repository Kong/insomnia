import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import type { Example, ExamplePatch, ExampleRequest, ExampleResponse } from 'insomnia-data';
import { services } from 'insomnia-data';
import { RESPONSE_CODE_REASONS } from 'insomnia-data/common';
import { useNavigate } from 'react-router';

import { showError } from '~/ui/components/modals';
import { useDBQueryClient } from '~/ui/context/app/insomnia-app-data-context';
import { buildResourceUrl } from '~/ui/hooks/use-insomnia-navigation';

/** Variables accepted by `useUpdateExample().mutate`. */
export interface UpdateExampleVariables {
  exampleId: string;
  patch: ExamplePatch;
}

/** Variables accepted by `useDeleteExample().mutate`. */
export interface DeleteExampleVariables {
  exampleId: string;
}

/** Variables accepted by `useDuplicateExample().mutate`. */
export interface DuplicateExampleVariables {
  exampleId: string;
  name?: string;
}

/** Variables accepted by `useCreateExample().mutate`. */
export interface CreateExampleVariables {
  requestId: string;
  // The request's own location, for post-create navigation.
  workspaceId: string;
  projectId: string;
  organizationId: string;
  name?: string;
  request?: Partial<ExampleRequest>;
  response?: Partial<ExampleResponse>;
}

// The default name mirrors the HTTP reason phrases used across the app
// ("404 Not Found"); the caller may override it.
const buildExampleName = (response: Pick<ExampleResponse, 'statusCode' | 'statusMessage'>) =>
  `${response.statusCode} ${response.statusMessage || RESPONSE_CODE_REASONS[response.statusCode] || ''}`.trim();

// Examples deleted during this session. The example route reads this to tell a
// user-initiated delete (return to the parent request quietly) from a stale URL
// (warn that the resource is gone).
const deletedExampleIds = new Set<string>();
// Bounded: the set only has to survive the redirect that follows a delete.
const DELETED_EXAMPLE_IDS_LIMIT = 100;

export const isExampleDeletedInSession = (exampleId: string) => deletedExampleIds.has(exampleId);

const markExampleDeleted = (exampleId: string) => {
  deletedExampleIds.add(exampleId);
  if (deletedExampleIds.size > DELETED_EXAMPLE_IDS_LIMIT) {
    const [oldest] = deletedExampleIds;
    deletedExampleIds.delete(oldest);
  }
};

// The mutations only report failures: an open document, the list rows and the
// closed-tab history all follow the database change events (`app-data.ts` patches
// an updated document in place and re-reads the list on insert and remove).
export const useUpdateExample = (): UseMutationResult<Example, Error, UpdateExampleVariables> => {
  const queryClient = useDBQueryClient();

  return useMutation(
    {
      mutationKey: ['example', 'update'],
      // Serialize example writes so rapid edits (typing, drag drops) queue
      // instead of interleaving read/merge/write rounds.
      scope: { id: 'example' },
      mutationFn: ({ exampleId, patch }: UpdateExampleVariables) => services.example.update(exampleId, patch),
      onError: error => showError({ error }),
    },
    queryClient,
  );
};

export const useDeleteExample = (): UseMutationResult<string, Error, DeleteExampleVariables> => {
  const queryClient = useDBQueryClient();

  return useMutation(
    {
      mutationKey: ['example', 'delete'],
      scope: { id: 'example' },
      mutationFn: async ({ exampleId }: DeleteExampleVariables) => {
        await services.example.remove(exampleId);
        return exampleId;
      },
      onSuccess: (_deleted, { exampleId }) => markExampleDeleted(exampleId),
      onError: error => showError({ error }),
    },
    queryClient,
  );
};

export const useDuplicateExample = (): UseMutationResult<Example, Error, DuplicateExampleVariables> => {
  const queryClient = useDBQueryClient();

  return useMutation(
    {
      mutationKey: ['example', 'duplicate'],
      scope: { id: 'example' },
      mutationFn: ({ exampleId, name }: DuplicateExampleVariables) =>
        services.example.duplicate(exampleId, name ? { name } : {}),
      onError: error => showError({ error }),
    },
    queryClient,
  );
};

/**
 * Create an example snapshotting an HTTP request, then navigate to its editor.
 * Snapshot assembly and creation invariants live in the service; the default name
 * ("200 OK") is a presentation concern and stays renderer-side.
 */
export const useCreateExample = (): UseMutationResult<Example, Error, CreateExampleVariables> => {
  const queryClient = useDBQueryClient();
  const navigate = useNavigate();

  return useMutation(
    {
      mutationKey: ['example', 'create'],
      scope: { id: 'example' },
      mutationFn: ({ requestId, name, request, response }: CreateExampleVariables) =>
        services.example.createFromRequest(requestId, {
          name:
            name ??
            buildExampleName({ statusCode: response?.statusCode ?? 200, statusMessage: response?.statusMessage ?? '' }),
          request,
          response,
        }),
      onSuccess: (created, { organizationId, projectId, workspaceId }) => {
        // Navigate using the request's own location from the variables, not the
        // calling component's route params: the sidebar can create an example for
        // a request in a different workspace.
        navigate(buildResourceUrl({ organizationId, projectId, workspaceId, resource: created }));
      },
      onError: error => showError({ error }),
    },
    queryClient,
  );
};
