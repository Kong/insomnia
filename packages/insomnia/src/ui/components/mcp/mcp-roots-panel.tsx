import type { Root } from '@modelcontextprotocol/sdk/types.js';
import { useState } from 'react';
import { Button, Heading, ListBox, ListBoxItem, Toolbar } from 'react-aria-components';

import type { McpReadyState } from '~/main/mcp/types';
import type { McpRequest } from '~/models/mcp-request';
import { PromptButton } from '~/ui/components/base/prompt-button';
import { useRequestPatcher } from '~/ui/hooks/use-request';

interface McpRootsPanelProps {
  request: McpRequest;
  readyState: McpReadyState;
}

const rootPrefix = 'file://';

export const McpRootsPanel = ({ request, readyState }: McpRootsPanelProps) => {
  const [rootUri, setRootUri] = useState(rootPrefix);
  const [roots, setRoots] = useState<Root[]>(request.roots);
  const [isInvalidRoot, setIsInvalidRoot] = useState(true);
  const patchRootsRequest = useRequestPatcher();
  const requestId = request._id;
  const isConnected = readyState === 'connected';

  const addRoot = () => {
    const parsedRoot = rootUri.trim();
    if (parsedRoot.startsWith(rootPrefix) && parsedRoot.length > rootPrefix.length) {
      setRoots(currentRoots => {
        const newRoots = [...currentRoots, { uri: rootUri.trim() }];
        patchRootsRequest(requestId, { roots: newRoots });
        return newRoots;
      });
      setRootUri(rootPrefix);
      setIsInvalidRoot(true);
    } else {
      setIsInvalidRoot(false);
    }
  };

  const removeRoot = (rootIdx: number) => {
    setRoots(currentRoots => {
      const newRoots = currentRoots.filter((_, i) => i !== rootIdx);
      patchRootsRequest(requestId, { roots: newRoots });
      return newRoots;
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-2">
      <Toolbar className="flex h-(--line-height-sm) w-full shrink-0 items-center justify-between gap-2 px-2 py-2">
        <Heading className="text-sm font-bold text-(--hl)">Configure Roots</Heading>
        <Button
          className="rounded-sm bg-(--color-surprise) px-(--padding-md) text-center text-(--color-font-surprise)"
          onClick={() => {
            window.main.mcp.notification.rootListChange({ requestId });
          }}
          isDisabled={!isConnected}
        >
          Notify Roots
        </Button>
      </Toolbar>

      <ListBox aria-label="data folders" className="margin-top-sm flex w-full flex-col overflow-y-auto">
        {roots.map(({ uri }, idx) => {
          const key = `${uri}-${idx}`;
          return (
            <ListBoxItem
              key={key}
              id={key}
              textValue={uri}
              className="my-1 flex min-h-[30px] justify-between gap-2 rounded-xs p-2 outline-hidden odd:bg-(--hl-xs)"
            >
              <span className="flex min-w-[70%] grow items-center break-all" data-testid="cookie-domain">
                <span>{uri || ''}</span>
              </span>
              <div className="flex min-w-[10%] items-center justify-end gap-1">
                <PromptButton
                  className="flex min-w-[15px] items-center gap-2 px-2 py-1 text-sm font-semibold text-(--color-font) transition-all aria-pressed:bg-(--hl-sm)"
                  confirmMessage=""
                  doneMessage=""
                  onClick={() => removeRoot(idx)}
                  title="Delete cookie"
                >
                  <i className="fa fa-trash-o" />
                </PromptButton>
              </div>
            </ListBoxItem>
          );
        })}
      </ListBox>

      <div className="mt-5 flex justify-between gap-1 px-2">
        <input
          value={rootUri}
          onChange={e => setRootUri(e.target.value)}
          type={'text'}
          className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
        />
        <button className="btn btn--outlined btn--super-compact flex items-center gap-2" onClick={addRoot}>
          Add Root
        </button>
      </div>
      {!isInvalidRoot && (
        <div className="mt-5 px-2">
          <p className="notice error margin-bottom-sm mt-2 w-full">{`Invalid root, please config root directory and must be start with ${rootPrefix}`}</p>
        </div>
      )}
    </div>
  );
};
