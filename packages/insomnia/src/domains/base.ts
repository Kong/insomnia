import { useCallback } from 'react';
import { useFetcher } from 'react-router';
import { href } from 'react-router';

type VoidIfUndefined<T> = T extends void ? void : T;

export function useDomainAction<ActionTypes extends Record<string, any>, T extends keyof ActionTypes>(
  action: T,
  path: string,
) {
  const fetcher = useFetcher();
  const submit = useCallback(
    (payload: VoidIfUndefined<Parameters<ActionTypes[T]>[0]>) => {
      console.log('Submitting action', href(path, payload), payload);
      return fetcher.submit(JSON.stringify({ action, payload }), {
        method: 'POST',
        action: href(path, payload),
        encType: 'application/json',
      });
    },
    [fetcher.submit],
  );

  return { ...fetcher, submit };
}

export function createDomainActionHandler<ActionTypes extends Record<string, any>>(actions: ActionTypes) {
  return async function handleAction(request: Request) {
    const { action, payload } = (await request.json()) as { action: keyof ActionTypes; payload: any };
    if (typeof actions[action] !== 'function') {
      throw new TypeError(`Action ${action as string} is not defined`);
    }
    return actions[action](payload);
  };
}

export function createDomain<ActionTypes extends Record<string, any>>(actions: ActionTypes) {
  let actionPath: string | undefined;
  function createActionHandler(path: string) {
    actionPath = path;
    return createDomainActionHandler(actions);
  }

  function useAction<T extends keyof ActionTypes>(type: T) {
    if (!actionPath) {
      throw new Error('Please call createActionHandler to define client action first.');
    }
    return useDomainAction<ActionTypes, T>(type, actionPath);
  }

  return [createActionHandler, useAction] as const;
}
