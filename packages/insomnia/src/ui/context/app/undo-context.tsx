import { database, services } from 'insomnia-data';
import React, {
  createContext,
  type FC,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFetcher, useNavigate, useRevalidator } from 'react-router';

import {
  type DeleteEntry,
  finalizeTop,
  recordDelete as recordDeleteToStack,
  recordEdit as recordEditToStack,
  type RequestSubTab,
  type UndoEntry,
  type UndoLocation,
} from './undo-stack';

export { UNDO_MAX_SNAPSHOT_BYTES, UNDO_STACK_MAX } from './undo-stack';
export type { RequestSubTab } from './undo-stack';

const debugBaseUrl = (l: UndoLocation) =>
  `/organization/${l.organizationId}/project/${l.projectId}/workspace/${l.workspaceId}/debug`;
const debugRequestUrl = (l: UndoLocation) => `${debugBaseUrl(l)}/request/${l.requestId}`;

export interface RecordEditParams {
  organizationId: string;
  projectId: string;
  workspaceId: string;
  requestId: string;
  before: Record<string, any>;
  after: Record<string, any>;
}

export interface RecordDeleteParams {
  organizationId: string;
  projectId: string;
  workspaceId: string;
  requestId: string;
  requestDoc: Record<string, any>;
  metaDoc: Record<string, any> | null;
}

interface UndoContextValue {
  recordEdit: (params: RecordEditParams) => void;
  recordDelete: (params: RecordDeleteParams) => void;
  /** Ends the current coalescing group (called on blur, sub-tab switch, tab/route change). */
  finalizeGroup: () => void;
  /** request-pane reports which request + sub-tab is currently visible, and how to reveal a sub-tab. */
  registerActivePane: (requestId: string, subTab: RequestSubTab, reveal: (subTab: RequestSubTab) => void) => void;
  unregisterActivePane: (requestId: string) => void;
  /** request-pane consumes a queued cross-request reveal once it mounts the target request. */
  consumePendingReveal: (requestId: string) => RequestSubTab | null;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /**
   * Increments after an undo/redo write is revalidated. Consumers (request-pane) fold this into
   * their remount key so uncontrolled editors (OneLineEditor) refresh to the reverted value.
   */
  undoRevision: number;
  /** Set while undo/redo applies its own write so editors do not re-record it. */
  suppressed: React.MutableRefObject<boolean>;
}

const noop = () => {};

const UndoContext = createContext<UndoContextValue>({
  recordEdit: noop,
  recordDelete: noop,
  finalizeGroup: noop,
  registerActivePane: noop,
  unregisterActivePane: noop,
  consumePendingReveal: () => null,
  undo: noop,
  redo: noop,
  canUndo: false,
  canRedo: false,
  undoRevision: 0,
  suppressed: { current: false },
});

export const UndoProvider: FC<PropsWithChildren> = ({ children }) => {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const revalidator = useRevalidator();

  const undoStackRef = useRef<UndoEntry[]>([]);
  const redoStackRef = useRef<UndoEntry[]>([]);
  const suppressed = useRef(false);
  // The request-pane currently mounted: lets same-request undo reveal a sub-tab instantly.
  const activePaneRef = useRef<{
    requestId: string;
    subTab: RequestSubTab;
    reveal: (subTab: RequestSubTab) => void;
  } | null>(null);
  // A cross-request undo/redo queues the target sub-tab here; the request-pane applies it when it mounts.
  const pendingRevealRef = useRef<{ requestId: string; subTab: RequestSubTab } | null>(null);

  // Bump to re-render consumers of canUndo / canRedo.
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion(v => v + 1), []);

  // Remount key for uncontrolled editors after an undo/redo write is revalidated.
  const [undoRevision, setUndoRevision] = useState(0);
  const pendingBumpRef = useRef(false);
  useEffect(() => {
    // Once the undo/redo submit has been applied AND its loaders revalidated, the fetcher
    // returns to idle. Bump the revision then so editors remount with fresh, reverted values.
    if (fetcher.state === 'idle' && pendingBumpRef.current) {
      pendingBumpRef.current = false;
      setUndoRevision(r => r + 1);
    }
  }, [fetcher.state]);

  const applyPatch = useCallback(
    (location: UndoLocation, patch: Record<string, any>) => {
      suppressed.current = true;
      pendingBumpRef.current = true;
      const url = `${debugRequestUrl(location)}/update`;
      fetcher.submit(JSON.stringify(patch), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
      // Release the suppression on the next tick. This only guards against a synchronous
      // onChange firing during the submit-triggered re-render; the later remount (driven by
      // `undoRevision` once the fetcher goes idle) refreshes uncontrolled editors without
      // emitting onChange, so it does not need the guard.
      setTimeout(() => {
        suppressed.current = false;
      }, 0);
    },
    [fetcher],
  );

  const reveal = useCallback(
    async (location: UndoLocation) => {
      const active = activePaneRef.current;
      if (active && active.requestId === location.requestId) {
        active.reveal(location.subTab);
        return;
      }
      // Cross-request: queue the target sub-tab, then navigate. The request-pane consumes it on arrival.
      pendingRevealRef.current = { requestId: location.requestId, subTab: location.subTab };
      navigate(debugRequestUrl(location));
    },
    [navigate],
  );

  const consumePendingReveal = useCallback((requestId: string): RequestSubTab | null => {
    if (pendingRevealRef.current?.requestId === requestId) {
      const subTab = pendingRevealRef.current.subTab;
      pendingRevealRef.current = null;
      return subTab;
    }
    return null;
  }, []);

  const restoreRequest = useCallback(
    async (entry: DeleteEntry) => {
      await database.insert(entry.requestDoc as any);
      if (entry.metaDoc) {
        try {
          await database.insert(entry.metaDoc as any);
        } catch {
          // meta may already exist; ignore
        }
      }
      // Direct DB writes don't trigger React Router revalidation, so the sidebar loaders won't
      // show the restored request without an explicit revalidate. Do NOT navigate here — a
      // concurrent navigation supersedes the revalidation and leaves the debug layout (sidebar)
      // loader stale; revalidating in place reliably brings the request back into the tree.
      await revalidator.revalidate();
    },
    [revalidator],
  );

  const redeleteRequest = useCallback(
    async (entry: DeleteEntry) => {
      const req = await services.helpers.getRequestById(entry.location.requestId);
      if (req) {
        await services.helpers.removeRequest(req);
      }
      navigate(debugBaseUrl(entry.location));
      revalidator.revalidate();
    },
    [navigate, revalidator],
  );

  const finalizeGroup = useCallback(() => {
    finalizeTop(undoStackRef.current);
  }, []);

  const recordEdit = useCallback(
    ({ organizationId, projectId, workspaceId, requestId, before, after }: RecordEditParams) => {
      if (suppressed.current) {
        return;
      }
      const subTab = activePaneRef.current?.requestId === requestId ? activePaneRef.current.subTab : 'params';
      const location: UndoLocation = { organizationId, projectId, workspaceId, requestId, subTab };
      const { merged } = recordEditToStack(undoStackRef.current, { location, before, after, now: Date.now() });
      // Any fresh user edit invalidates the redo timeline.
      if (redoStackRef.current.length > 0) {
        redoStackRef.current = [];
      }
      if (!merged) {
        bump();
      }
    },
    [bump],
  );

  const recordDelete = useCallback(
    ({ organizationId, projectId, workspaceId, requestId, requestDoc, metaDoc }: RecordDeleteParams) => {
      const location: UndoLocation = { organizationId, projectId, workspaceId, requestId, subTab: 'params' };
      recordDeleteToStack(undoStackRef.current, { location, requestDoc, metaDoc, now: Date.now() });
      redoStackRef.current = [];
      bump();
    },
    [bump],
  );

  const undo = useCallback(async () => {
    const entry = undoStackRef.current.pop();
    if (!entry) {
      return;
    }
    if (entry.kind === 'patch') {
      await reveal(entry.location);
      applyPatch(entry.location, entry.before);
    } else {
      await restoreRequest(entry);
    }
    redoStackRef.current.push(entry);
    bump();
  }, [applyPatch, bump, restoreRequest, reveal]);

  const redo = useCallback(async () => {
    const entry = redoStackRef.current.pop();
    if (!entry) {
      return;
    }
    if (entry.kind === 'patch') {
      await reveal(entry.location);
      applyPatch(entry.location, entry.after);
    } else {
      await redeleteRequest(entry);
    }
    undoStackRef.current.push(entry);
    bump();
  }, [applyPatch, bump, redeleteRequest, reveal]);

  const registerActivePane = useCallback(
    (requestId: string, subTab: RequestSubTab, revealFn: (subTab: RequestSubTab) => void) => {
      activePaneRef.current = { requestId, subTab, reveal: revealFn };
    },
    [],
  );

  const unregisterActivePane = useCallback((requestId: string) => {
    if (activePaneRef.current?.requestId === requestId) {
      activePaneRef.current = null;
    }
  }, []);

  const value = useMemo<UndoContextValue>(
    () => ({
      recordEdit,
      recordDelete,
      finalizeGroup,
      registerActivePane,
      unregisterActivePane,
      consumePendingReveal,
      undo,
      redo,
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
      undoRevision,
      suppressed,
    }),
    // The `*Ref.current.length` deps are not reactive on their own; they are re-read only
    // because `bump()` (setVersion) forces the re-render that recomputes this memo, keeping
    // canUndo/canRedo in sync after every stack mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      recordEdit,
      recordDelete,
      finalizeGroup,
      registerActivePane,
      unregisterActivePane,
      consumePendingReveal,
      undo,
      redo,
      undoRevision,
      undoStackRef.current.length,
      redoStackRef.current.length,
    ],
  );

  return <UndoContext.Provider value={value}>{children}</UndoContext.Provider>;
};

export const useUndoContext = () => useContext(UndoContext);
