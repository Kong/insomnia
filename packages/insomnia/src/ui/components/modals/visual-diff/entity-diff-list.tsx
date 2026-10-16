import { type FC, useMemo } from 'react';
import { Button } from 'react-aria-components';

import { CookieJarDiffCard } from './cookie-jar-diff-card';
import { computeVisualDiff } from './diff-engine';
import { EnvironmentDiffCard } from './environment-diff-card';
import { GenericEntityDiffCard } from './generic-entity-diff-card';
import { GrpcDiffCard } from './grpc-diff-card';
import { McpDiffCard } from './mcp-diff-card';
import { MockRouteDiffCard } from './mock-route-diff-card';
import { RequestDiffCard } from './request-diff-card';
import { RequestGroupDiffCard } from './request-group-diff-card';
import { SocketIODiffCard } from './socket-io-diff-card';
import { WebSocketDiffCard } from './websocket-diff-card';

interface Props {
  before: string;
  after: string;
  // Switches the preview to the Text view, which shows exactly what git will commit.
  onShowTextView: () => void;
}

// Shown instead of cards when there are none to show; the Text view still has the full diff.
const TextViewHint: FC<{ message: string; onShowTextView: () => void }> = ({ message, onShowTextView }) => (
  <div className="flex h-full flex-1 items-center justify-center p-4 text-center text-(--hl)">
    <span>
      {message}{' '}
      <Button onPress={onShowTextView} className="cursor-pointer text-(--color-font) underline hover:brightness-125">
        Open the Text view
      </Button>{' '}
      to see the raw diff.
    </span>
  </div>
);

export const EntityDiffList: FC<Props> = ({ before, after, onShowTextView }) => {
  const { entities, unparseable } = useMemo(() => computeVisualDiff(before, after), [before, after]);

  if (unparseable) {
    return <TextViewHint message="Unable to parse this file for a visual diff." onShowTextView={onShowTextView} />;
  }

  if (entities.length === 0) {
    // Also covers metadata-only (eg. timestamps) and formatting-only changes, and non-Insomnia files
    // such as the project's .spectral.yaml lint ruleset — not just moves.
    return (
      <TextViewHint
        message="No requests, folders, environments or settings changed — this file only has changes the Visual view doesn't show, like moves, reordering, timestamps or formatting."
        onShowTextView={onShowTextView}
      />
    );
  }

  const summary = entities.reduce(
    (acc, entity) => {
      acc[entity.status] += 1;
      return acc;
    },
    { added: 0, removed: 0, modified: 0 },
  );

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 text-xs">
        <span className="font-semibold text-(--color-font)">
          {entities.length} {entities.length === 1 ? 'entity' : 'entities'} changed
        </span>
        {summary.added > 0 && <span className="text-(--color-success)">{summary.added} added</span>}
        {summary.modified > 0 && <span className="text-(--color-notice)">{summary.modified} modified</span>}
        {summary.removed > 0 && <span className="text-(--color-danger)">{summary.removed} removed</span>}
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {entities.map(diff => {
          switch (diff.type) {
            case 'request': {
              return <RequestDiffCard key={diff.id} diff={diff} />;
            }
            case 'request_group': {
              return <RequestGroupDiffCard key={diff.id} diff={diff} />;
            }
            case 'websocket_request': {
              return <WebSocketDiffCard key={diff.id} diff={diff} />;
            }
            case 'socketio_request': {
              return <SocketIODiffCard key={diff.id} diff={diff} />;
            }
            case 'grpc_request': {
              return <GrpcDiffCard key={diff.id} diff={diff} />;
            }
            case 'mcp_request': {
              return <McpDiffCard key={diff.id} diff={diff} />;
            }
            case 'mock_route': {
              return <MockRouteDiffCard key={diff.id} diff={diff} />;
            }
            case 'cookie_jar': {
              return <CookieJarDiffCard key={diff.id} diff={diff} />;
            }
            case 'environment': {
              return <EnvironmentDiffCard key={diff.id} diff={diff} />;
            }
            default: {
              return <GenericEntityDiffCard key={diff.id} diff={diff} />;
            }
          }
        })}
      </div>
    </div>
  );
};
