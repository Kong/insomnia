import type { CommandSearchResult } from 'insomnia-data';
import { models, services } from 'insomnia-data';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseCommandSearchParams {
  accountId: string;
  organizationId: string;
  projectId: string;
  workspaceId: string;
}

interface UseCommandSearchReturn {
  results: CommandSearchResult | null;
  isSearching: boolean;
  inputValue: string;
  search: (filter?: string) => void;
  abort: () => void;
}

const TOMBSTONE = 'CLOSED';

export function useCommandSearch({
  accountId,
  organizationId,
  projectId,
  workspaceId,
}: UseCommandSearchParams): UseCommandSearchReturn {
  const currentRequestIdRef = useRef<string>('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasReceivedResultsRef = useRef(false);
  const [results, setResults] = useState<CommandSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const runSearch = useCallback(
    async (filter?: string) => {
      const prevRequestId = currentRequestIdRef.current;
      const requestId = crypto.randomUUID();
      currentRequestIdRef.current = requestId;
      setIsSearching(true);

      // Don't abort the initial search — ComboBox needs baseline items or it hides the menu permanently.
      if (prevRequestId && prevRequestId !== TOMBSTONE && hasReceivedResultsRef.current) {
        services.helpers.abortCommandSearch(prevRequestId).catch(() => {});
      }

      const cachedOrganizations: { id: string; name: string }[] = JSON.parse(
        localStorage.getItem(`${accountId}:spaces`) || '[]',
      );
      // The Konnect organization is local-only so it is never in the cached list, and search scopes
      // projects by organization id — without it Konnect projects are unreachable.
      const allOrganizations = [
        ...cachedOrganizations,
        {
          id: models.organization.getKonnectOrganizationId(accountId),
          name: models.organization.KONNECT_ORGANIZATION_NAME,
        },
      ];

      try {
        const result = await services.helpers.commandSearch({
          allOrganizations,
          organizationId,
          projectId,
          workspaceId,
          filter,
          requestId,
        });
        if (result.requestId === currentRequestIdRef.current) {
          setResults(result);
          setIsSearching(false);
          hasReceivedResultsRef.current = true;
        } else if (!hasReceivedResultsRef.current) {
          // Warm baseline — CommandPalette sets defaultFilter={() => true}, so filtering is done server-side via fuzzy match.
          setResults(result);
          hasReceivedResultsRef.current = true;
        }
      } catch (err) {
        if (!(err instanceof Error && err.name === 'AbortError')) {
          console.error('[command-search] unexpected error:', err);
        }
        if (currentRequestIdRef.current === requestId) {
          setIsSearching(false);
        }
      }
    },
    [accountId, organizationId, projectId, workspaceId],
  );

  // Clear scheduled debounce when runSearch identity changes to avoid stale closures.
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [runSearch]);

  const search = useCallback(
    (filter?: string) => {
      setInputValue(filter ?? '');
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => runSearch(filter), 250);
    },
    [runSearch],
  );

  const abort = useCallback(() => {
    const prev = currentRequestIdRef.current;
    currentRequestIdRef.current = TOMBSTONE;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (prev && prev !== TOMBSTONE) {
      services.helpers.abortCommandSearch(prev).catch(() => {});
    }
  }, []);

  // Fire initial search immediately on mount; abort and cleanup on unmount.
  useEffect(() => {
    runSearch();
    return () => {
      const prev = currentRequestIdRef.current;
      currentRequestIdRef.current = TOMBSTONE;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (prev && prev !== TOMBSTONE) {
        services.helpers.abortCommandSearch(prev).catch(() => {});
      }
    };
  }, [runSearch]);

  return { results, isSearching, inputValue, search, abort };
}
