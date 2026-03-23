import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InitializeRequestSchema, type JSONRPCRequest } from '@modelcontextprotocol/sdk/types.js';
import { shellPath } from 'shell-path';
import { parse } from 'shell-quote';

import { type McpResponse, services } from '~/insomnia-data';
import { type ConnectionContext, writeTimeline } from '~/main/mcp/common';
import type { OpenMcpStdioClientConnectionOptions } from '~/main/mcp/types';
import * as models from '~/models';

export const createStdioTransport = async (
  context: ConnectionContext,
  options: OpenMcpStdioClientConnectionOptions,
) => {
  const { responseId, environmentId, timelinePath, eventLogPath } = context;
  const { url, requestId, env } = options;
  if (!url) {
    throw new Error('Command is required for STDIO transport');
  }
  const parseResult = parse(url);
  if (parseResult.find(arg => typeof arg !== 'string')) {
    throw new Error('Invalid command format');
  }
  const [command, ...args] = parseResult as string[];

  const initialTimelines = [
    { value: `Preparing request to STDIO: ${url}`, name: 'Text', timestamp: Date.now() },
    { value: `Current time is ${new Date().toISOString()}`, name: 'Text', timestamp: Date.now() },
  ];
  // Add stdio-specific timeline info
  initialTimelines.push({
    value: `Run command: ${url}`,
    name: 'HeaderOut',
    timestamp: Date.now(),
  });
  const pathEnv = (await shellPath()) || process.env.PATH || '';
  // Filter out empty keys from env
  const filteredEnv = Object.fromEntries(Object.entries(env).filter(([key]) => key.trim().length));
  const finalEnv = {
    PATH: pathEnv,
    ...filteredEnv,
  };
  const stringifiedEnv = Object.entries(finalEnv)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ')
    .trim();
  if (stringifiedEnv) {
    initialTimelines.push({
      value: `With env: ${stringifiedEnv}`,
      name: 'HeaderOut',
      timestamp: Date.now(),
    });
  }
  initialTimelines.map(t => writeTimeline(context, JSON.stringify(t)));

  const start = performance.now();
  const transport = new StdioClientTransport({
    command,
    args,
    env: finalEnv,
    stderr: 'pipe',
  });

  // Capture stderr logs for debugging
  const stderrStream = transport.stderr;
  stderrStream?.on('data', (chunk: Buffer) => {
    const stderrData = chunk.toString().trim();
    if (!stderrData) return; // Skip empty lines

    // Log stderr output to timeline with appropriate categorization
    writeTimeline(
      context,
      JSON.stringify({
        value: stderrData,
        name: 'HeaderIn',
        timestamp: Date.now(),
      }),
    );
  });
  // Wrap the original send method to log outgoing requests for stdio transport
  const originalSend = transport.send.bind(transport);
  transport.send = async (message: JSONRPCRequest) => {
    const isInitializedMessage = InitializeRequestSchema.safeParse(message).success;
    // Create response model for initialize message and add process status timeline
    if (isInitializedMessage) {
      // Add process started timeline (similar to HTTP response timeline)
      writeTimeline(
        context,
        JSON.stringify({ value: 'Process started and ready', name: 'Text', timestamp: Date.now() }),
      );

      const responsePatch: Partial<McpResponse> = {
        _id: responseId,
        parentId: requestId,
        environmentId,
        url,
        status: 'success',
        elapsedTime: performance.now() - start,
        timelinePath,
        eventLogPath,
        transportType: models.mcpRequest.TRANSPORT_TYPES.STDIO,
      };
      const settings = await services.settings.get();
      const res = await services.mcpResponse.updateOrCreate(responsePatch, settings.maxHistoryResponses);
      models.requestMeta.updateOrCreateByParentId(requestId, { activeResponseId: res._id });
    }

    return originalSend(message);
  };
  return transport;
};
