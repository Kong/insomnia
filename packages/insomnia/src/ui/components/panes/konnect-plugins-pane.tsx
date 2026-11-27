import type { Project, ResponseHeader, Workspace } from 'insomnia-data';
import { Button, Tooltip as AriaTooltip, TooltipTrigger } from 'react-aria-components';

import {
  type KonnectLinkedRequest,
  resolveKonnectSyncedRoute,
  selectApplicablePlugins,
} from '~/konnect/plugin-scope';
import {
  formatRateLimitObservation,
  type RateLimitObservation,
  readRateLimitObservation,
} from '~/konnect/response-diagnostics';
import { useKonnectRequestPlugins } from '~/ui/hooks/use-konnect-request-plugins';

import { Icon } from '../icon';

const RATE_LIMITING_PLUGINS: Record<string, true> = {
  'rate-limiting': true,
  'rate-limiting-advanced': true,
};

/** Plugin types the rate limit row is read from, disclosed in the tooltip. */
const SUPPORTED_PLUGINS = ['rate-limiting', 'rate-limiting-advanced'];

interface Props {
  activeRequest: KonnectLinkedRequest;
  activeResponse: { headers: ResponseHeader[]; statusCode: number; error?: string } | null;
  activeWorkspace: Pick<Workspace, 'konnectServiceId'> | null | undefined;
  activeProject: Pick<Project, 'konnectControlPlaneId' | 'konnectRegion' | 'name'> | null | undefined;
}

export interface KonnectPluginsPaneState {
  visible: boolean;
  /** What the response headers say rate limiting did, if anything. */
  observation: RateLimitObservation | null;
  /** A rate limiting plugin applies to the request but the response shows no evidence. */
  expectedWithoutEvidence: boolean;
  /** The configured instances may suppress the headers themselves. */
  headersHidable: boolean;
  /** The response shows rate limit evidence but no enabled rate limiting plugin applies. */
  drift: boolean;
}

/**
 * Derives what the response shows about the Konnect plugins on this request.
 * Everything displayed comes from the response; the plugin list is only used to
 * tell "nothing ran" apart from "ran, but left no headers".
 *
 * The route gate matters: rate limit headers are common outside Kong, and the pane
 * must never present another gateway's numbers as Konnect plugin evidence.
 */
export function useKonnectPluginsPane({
  activeRequest,
  activeResponse,
  activeWorkspace,
  activeProject,
}: Props): KonnectPluginsPaneState {
  const syncedRoute = resolveKonnectSyncedRoute(activeRequest, activeWorkspace, activeProject);
  const { status, plugins } = useKonnectRequestPlugins(syncedRoute);

  // A failed request persists an error response with no headers; it proves nothing about plugins.
  const response = activeResponse && !activeResponse.error ? activeResponse : null;
  const observation = syncedRoute && response ? readRateLimitObservation(response.headers) : null;
  const expected =
    syncedRoute && status === 'ready'
      ? selectApplicablePlugins(plugins, syncedRoute).plugins.filter(
          plugin => plugin.enabled && RATE_LIMITING_PLUGINS[plugin.name] === true,
        )
      : [];
  const expectedWithoutEvidence = observation === null && expected.length > 0;
  const headersHidable = expected.some(plugin => plugin.config?.hide_client_headers === true);
  const drift = observation !== null && status === 'ready' && expected.length === 0;

  return {
    visible: syncedRoute !== null && response !== null && (observation !== null || expectedWithoutEvidence),
    observation,
    expectedWithoutEvidence,
    headersHidable,
    drift,
  };
}

export const KonnectPluginsPane = ({
  state,
  statusCode,
  onHide,
}: {
  state: KonnectPluginsPaneState;
  statusCode: number;
  onHide: () => void;
}) => {
  const { observation } = state;
  const exhausted = statusCode === 429 && observation?.retryAfterSeconds != null;

  const detail = observation
    ? observation.windows.length > 0
      ? formatRateLimitObservation(observation)
      : 'No quota headers in this response.'
    : state.expectedWithoutEvidence
      ? 'No rate limit headers in this response.'
      : '';

  return (
    <section
      aria-label="Konnect plugins on this route"
      className="flex max-h-[150px] shrink-0 flex-col border-t border-solid border-(--hl-md)"
      data-testid="konnect-plugins-pane"
    >
      <div className="flex shrink-0 items-center justify-between border-b border-solid border-(--hl-md) px-4 py-1">
        <h3 className="text-xs font-bold text-(--hl) uppercase">Konnect plugins on this route</h3>
        <Button
          aria-label="Hide Konnect plugins"
          className="rounded-xs px-1 text-(--hl) hover:bg-(--hl-xs) hover:text-(--color-font)"
          onPress={onHide}
        >
          <Icon icon="xmark" className="size-3" />
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 py-2">
        <div className="flex items-baseline gap-2">
          <span className="font-medium">Rate limiting</span>
          <TooltipTrigger delay={400}>
            <Button
              aria-label="About this rate limit data"
              className="flex size-6 shrink-0 items-center justify-center rounded-xs text-(--hl) hover:text-(--color-font)"
            >
              <Icon icon="question-circle" className="size-3" />
            </Button>
            <AriaTooltip
              className="max-w-sm rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-3 py-2 text-xs text-(--color-font) shadow-lg"
              offset={8}
            >
              <div className="flex flex-col gap-1 text-left">
                <span>
                  {observation ? 'Inferred from the response headers.' : 'Nothing in this response confirms rate limiting.'}
                </span>
                <span>Read from:</span>
                {observation && observation.headersUsed.length > 0 ? (
                  <div className="flex flex-col">
                    {observation.headersUsed.map(name => (
                      <code className="whitespace-nowrap" key={name}>
                        {name}
                      </code>
                    ))}
                  </div>
                ) : (
                  <span>None of the supported headers are present.</span>
                )}
                <span>Supported plugins:</span>
                <div className="flex flex-col">
                  {SUPPORTED_PLUGINS.map(name => (
                    <code className="whitespace-nowrap" key={name}>
                      {name}
                    </code>
                  ))}
                </div>
                {state.drift && <span>No enabled rate-limiting plugin applies to this request.</span>}
                {!observation && state.expectedWithoutEvidence && state.headersHidable && (
                  <span>Configured instances can suppress these headers (hide_client_headers).</span>
                )}
              </div>
            </AriaTooltip>
          </TooltipTrigger>
          <span className="text-xs text-(--color-font)">{detail}</span>
          {observation && <span className="ml-auto shrink-0 text-xs text-(--hl)">inferred</span>}
        </div>
        {exhausted && (
          <span className="text-xs text-(--color-warning)">
            Quota exhausted, retry after {observation?.retryAfterSeconds}s.
          </span>
        )}
      </div>
    </section>
  );
};
