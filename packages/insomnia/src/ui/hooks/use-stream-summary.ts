import { useMemo } from 'react';

import {
  computeStreamSummary,
  getCandidatePayloadsFromEvents,
  inferStreamSummaryPath,
  type StreamMessageEvent,
} from '~/common/stream-summary';
import type { CurlEvent } from '~/main/network/curl';
import {
  type RequestLoaderData,
  useRequestLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';

import { useRequestMetaPatcher } from './use-request';

const getCandidatePayloads = (events: CurlEvent[]): string[] => {
  const streamEvents: StreamMessageEvent[] = events.map(event => ({
    type: event.type,
    direction: 'direction' in event ? event.direction : '',
    data: 'data' in event ? event.data : '',
  }));
  return getCandidatePayloadsFromEvents(streamEvents);
};

export const useStreamSummary = ({
  requestId,
  url,
  events,
}: {
  requestId: string;
  url: string;
  events: CurlEvent[];
}) => {
  const { activeRequestMeta } = useRequestLoaderData() as RequestLoaderData;
  const patchRequestMeta = useRequestMetaPatcher();

  const inferredPath = useMemo(() => inferStreamSummaryPath(url), [url]);
  const resultPath = useMemo(() => {
    const path = activeRequestMeta.streamSummaryPath ?? inferredPath;
    return path?.trim() || null;
  }, [activeRequestMeta.streamSummaryPath, inferredPath]);

  const summary = useMemo(() => {
    if (!resultPath) {
      return { fragmentCount: 0, summary: '' };
    }
    return computeStreamSummary(getCandidatePayloads(events), resultPath);
  }, [events, resultPath]);

  const setResultPath = (path: string) => patchRequestMeta(requestId, { streamSummaryPath: path });
  const renderMarkdown = activeRequestMeta.streamSummaryRenderMarkdown;
  const setRenderMarkdown = (value: boolean) => patchRequestMeta(requestId, { streamSummaryRenderMarkdown: value });

  return { inferredPath, resultPath, summary, setResultPath, renderMarkdown, setRenderMarkdown };
};
