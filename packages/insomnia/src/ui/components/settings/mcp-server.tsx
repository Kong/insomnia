import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { type FC, useCallback, useEffect, useState } from 'react';
import { Button, Heading, Tooltip, TooltipTrigger } from 'react-aria-components';

import { useRootLoaderData } from '~/root';
import { useMcpServerReadyState } from '~/ui/hooks/use-mcp-server-ready-state';
import { useSettingsPatcher } from '~/ui/hooks/use-request';

import { BooleanSetting } from './boolean-setting';
import { NumberSetting } from './number-setting';

/**
 * MCP Server Settings Component
 *
 * Provides UI for managing the MCP Server including:
 * - Auto-start toggle
 * - Manual start/stop controls
 * - Port configuration
 * - API key management (generation, display, regeneration)
 * - Real-time server status indicator
 * - Usage instructions for various MCP clients
 */
export const McpServerSettings: FC = () => {
  const { settings } = useRootLoaderData()!;
  const patchSettings = useSettingsPatcher();
  const serverState = useMcpServerReadyState();
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  // Generate API key if auto-start enabled but no key exists
  useEffect(() => {
    const generateInitialApiKey = async () => {
      if (settings.mcpServerAutoStart && !settings.mcpServerApiKey) {
        await generateNewApiKey();
      }
    };
    generateInitialApiKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.mcpServerAutoStart, settings.mcpServerApiKey]);

  // Start server on app launch if auto-start is enabled
  useEffect(() => {
    const handleAutoStart = async () => {
      if (settings.mcpServerAutoStart && serverState.status === 'stopped') {
        // Ensure API key exists before starting
        if (!settings.mcpServerApiKey) {
          console.log('[McpServerSettings] Waiting for API key generation...');
          return;
        }

        try {
          console.log('[McpServerSettings] Auto-starting MCP server...');
          await window.main.mcpServer.start(settings.mcpServerPort);
        } catch (error) {
          console.error('[McpServerSettings] Failed to auto-start server:', error);
        }
      }
    };

    handleAutoStart();
  }, [settings.mcpServerAutoStart, settings.mcpServerApiKey, settings.mcpServerPort, serverState.status]);

  const generateNewApiKey = useCallback(async () => {
    setIsGeneratingKey(true);
    try {
      // Generate a secure random API key
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      const apiKey = btoa(String.fromCodePoint(...array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      await patchSettings({ mcpServerApiKey: apiKey });

      // Restart server if it's running to apply new key
      if (serverState.status === 'running') {
        await window.main.mcpServer.restart(settings.mcpServerPort);
      }
    } catch (error) {
      console.error('[McpServerSettings] Failed to generate API key:', error);
    } finally {
      setIsGeneratingKey(false);
    }
  }, [patchSettings, serverState.status, settings.mcpServerPort]);

  const handleStartServer = useCallback(async () => {
    if (!settings.mcpServerApiKey) {
      await generateNewApiKey();
    }
    try {
      await window.main.mcpServer.start(settings.mcpServerPort);
    } catch (error) {
      console.error('[McpServerSettings] Failed to start server:', error);
    }
  }, [settings.mcpServerPort, settings.mcpServerApiKey, generateNewApiKey]);

  const handleStopServer = useCallback(async () => {
    try {
      await window.main.mcpServer.stop();
    } catch (error) {
      console.error('[McpServerSettings] Failed to stop server:', error);
    }
  }, []);

  const copyApiKeyToClipboard = useCallback(() => {
    if (settings.mcpServerApiKey) {
      window.clipboard.writeText(settings.mcpServerApiKey);
    }
  }, [settings.mcpServerApiKey]);

  const getStatusColor = () => {
    switch (serverState.status) {
      case 'running': {
        return 'text-(--color-success)';
      }
      case 'starting': {
        return 'text-(--color-warning)';
      }
      case 'error': {
        return 'text-(--color-danger)';
      }
      default: {
        return 'text-(--hl)';
      }
    }
  };

  const getStatusText = () => {
    switch (serverState.status) {
      case 'running': {
        return `Running on port ${serverState.port}`;
      }
      case 'starting': {
        return 'Starting...';
      }
      case 'error': {
        return `Error: ${serverState.error}`;
      }
      default: {
        return 'Stopped';
      }
    }
  };

  return (
    <div className="space-y-4">
      <Heading className="text-lg font-bold">MCP Server</Heading>

      <p className="text-(--hl)">
        The Model Context Protocol (MCP) server enables external applications to interact with Insomnia's requests
        programmatically. When enabled, the server exposes tools for listing, retrieving, and creating requests within
        your organizations and projects.
      </p>

      {/* Server Status Indicator */}
      <div className="flex items-center gap-3 rounded border border-(--hl-md) bg-(--hl-xs) p-3">
        <div className="flex items-center gap-2">
          <FontAwesomeIcon
            icon={serverState.status === 'starting' ? 'spinner' : 'circle'}
            className={`${getStatusColor()} ${serverState.status === 'starting' ? 'animate-spin' : ''}`}
          />
          <span className="font-medium">Server Status:</span>
        </div>
        <span className={getStatusColor()}>{getStatusText()}</span>
        {serverState.startedAt && (
          <span className="ml-auto text-sm text-(--hl)">
            Started {new Date(serverState.startedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Server Control Buttons */}
      <div className="flex items-center gap-2">
        <Button
          className="rounded border border-(--hl-md) px-4 py-2 hover:bg-(--hl-sm) disabled:opacity-50"
          onPress={handleStartServer}
          isDisabled={serverState.status === 'running' || serverState.status === 'starting'}
        >
          <FontAwesomeIcon icon="play" className="mr-2" />
          Start Server
        </Button>

        <Button
          className="rounded border border-(--hl-md) px-4 py-2 hover:bg-(--hl-sm) disabled:opacity-50"
          onPress={handleStopServer}
          isDisabled={serverState.status === 'stopped' || serverState.status === 'starting'}
        >
          <FontAwesomeIcon icon="stop" className="mr-2" />
          Stop Server
        </Button>
      </div>

      {/* Auto-start Setting */}
      <div className="form-row">
        <BooleanSetting
          label="Auto-start on Launch"
          setting="mcpServerAutoStart"
          help="Automatically start the MCP server when Insomnia launches."
        />
      </div>

      {/* Port Setting */}
      <div className="form-row">
        <NumberSetting
          label="Server Port"
          setting="mcpServerPort"
          help="The HTTP port on which the MCP server will listen. Requires server restart if changed while running."
          min={1024}
          max={65_535}
          step={1}
        />
      </div>

      {/* API Key Section */}
      {settings.mcpServerApiKey && (
        <div className="space-y-2">
          <label className="font-medium">API Key</label>
          <p className="text-sm text-(--hl)">
            Use this API key to authenticate requests to the MCP server. Include it in the Authorization header as:
            <code className="ml-1 rounded bg-(--hl-xs) px-1 py-0.5">Bearer YOUR_API_KEY</code>
          </p>

          <div className="flex items-center gap-2">
            <div className="flex-1 rounded border border-(--hl-md) bg-(--hl-xs) p-2 font-mono text-sm">
              {apiKeyVisible ? settings.mcpServerApiKey : '••••••••••••••••••••••••••••••••'}
            </div>

            <TooltipTrigger>
              <Button
                className="rounded border border-(--hl-md) px-3 py-2 hover:bg-(--hl-sm)"
                onPress={() => setApiKeyVisible(!apiKeyVisible)}
              >
                <FontAwesomeIcon icon={apiKeyVisible ? 'eye-slash' : 'eye'} />
              </Button>
              <Tooltip className="rounded border border-(--hl-md) bg-(--color-bg) px-2 py-1 text-sm">
                {apiKeyVisible ? 'Hide' : 'Show'} API Key
              </Tooltip>
            </TooltipTrigger>

            <TooltipTrigger>
              <Button
                className="rounded border border-(--hl-md) px-3 py-2 hover:bg-(--hl-sm)"
                onPress={copyApiKeyToClipboard}
              >
                <FontAwesomeIcon icon="copy" />
              </Button>
              <Tooltip className="rounded border border-(--hl-md) bg-(--color-bg) px-2 py-1 text-sm">
                Copy to Clipboard
              </Tooltip>
            </TooltipTrigger>

            <TooltipTrigger>
              <Button
                className="rounded border border-(--hl-md) px-3 py-2 hover:bg-(--hl-sm)"
                onPress={generateNewApiKey}
                isDisabled={isGeneratingKey}
              >
                <FontAwesomeIcon
                  icon={isGeneratingKey ? 'spinner' : 'sync-alt'}
                  className={isGeneratingKey ? 'animate-spin' : ''}
                />
              </Button>
              <Tooltip className="rounded border border-(--hl-md) bg-(--color-bg) px-2 py-1 text-sm">
                Regenerate API Key
              </Tooltip>
            </TooltipTrigger>
          </div>

          <p className="text-sm text-(--color-warning)">
            <FontAwesomeIcon icon="exclamation-triangle" className="mr-1" />
            Warning: Regenerating the API key will invalidate the current key and require updating all connected
            clients.
          </p>
        </div>
      )}

      {/* Available Tools Information */}
      <div className="space-y-2">
        <label className="font-medium">Available Tools</label>
        <div className="space-y-3 rounded border border-(--hl-md) bg-(--hl-xs) p-3">
          <div>
            <code className="font-mono text-sm font-semibold">list_organizations</code>
            <p className="mt-1 text-sm text-(--hl)">Lists all available organizations.</p>
          </div>

          <div>
            <code className="font-mono text-sm font-semibold">list_projects</code>
            <p className="mt-1 text-sm text-(--hl)">
              Lists projects within an organization. Requires <code>organizationId</code>.
            </p>
          </div>

          <div>
            <code className="font-mono text-sm font-semibold">list_workspaces</code>
            <p className="mt-1 text-sm text-(--hl)">
              Lists workspaces within a project. Requires <code>organizationId</code> and <code>projectId</code>.
            </p>
          </div>

          <div>
            <code className="font-mono text-sm font-semibold">list_requests</code>
            <p className="mt-1 text-sm text-(--hl)">
              Lists all requests within a project. Requires <code>organizationId</code> and <code>projectId</code>.
            </p>
          </div>

          <div>
            <code className="font-mono text-sm font-semibold">get_request</code>
            <p className="mt-1 text-sm text-(--hl)">
              Retrieves detailed information about a specific request. Requires <code>requestId</code>,{' '}
              <code>organizationId</code>, and <code>projectId</code>.
            </p>
          </div>

          <div>
            <code className="font-mono text-sm font-semibold">create_request</code>
            <p className="mt-1 text-sm text-(--hl)">
              Creates a new request in a workspace. Requires <code>organizationId</code>, <code>projectId</code>,{' '}
              <code>workspaceId</code>, <code>name</code>, <code>method</code> (GET/POST/PUT/DELETE/etc.), and{' '}
              <code>url</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Usage Instructions */}
      <div className="space-y-3">
        <label className="font-medium">MCP Client Setup</label>

        {/* VSCode with Cline */}
        <div className="rounded border border-(--hl-md) bg-(--hl-xs) p-3">
          <h4 className="mb-2 font-semibold">VSCode (Cline Extension)</h4>
          <p className="mb-2 text-sm text-(--hl)">
            Add the following to your{' '}
            <code>~/.config/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json</code>:
          </p>
          <pre className="overflow-x-auto rounded bg-(--hl-sm) p-2 text-xs">
            {`{
  "mcpServers": {
    "insomnia": {
      "url": "http://localhost:${settings.mcpServerPort}/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`}
          </pre>
        </div>

        {/* Claude Desktop */}
        <div className="rounded border border-(--hl-md) bg-(--hl-xs) p-3">
          <h4 className="mb-2 font-semibold">Claude Desktop</h4>
          <p className="mb-2 text-sm text-(--hl)">
            Add to <code>~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS):
          </p>
          <pre className="overflow-x-auto rounded bg-(--hl-sm) p-2 text-xs">
            {`{
  "mcpServers": {
    "insomnia": {
      "url": "http://localhost:${settings.mcpServerPort}/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}`}
          </pre>
        </div>

        {/* MCP Inspector */}
        <div className="rounded border border-(--hl-md) bg-(--hl-xs) p-3">
          <h4 className="mb-2 font-semibold">MCP Inspector</h4>
          <p className="mb-2 text-sm text-(--hl)">Connect using HTTP transport:</p>
          <pre className="overflow-x-auto rounded bg-(--hl-sm) p-2 text-xs">
            {`npx @modelcontextprotocol/inspector \\
  http://localhost:${settings.mcpServerPort}/mcp \\
  --header "Authorization: Bearer YOUR_API_KEY"`}
          </pre>
        </div>
      </div>

      {/* cURL Example */}
      <div className="space-y-2">
        <label className="font-medium">cURL Example</label>
        <pre className="overflow-x-auto rounded border border-(--hl-md) bg-(--hl-xs) p-3 text-sm">
          {`curl -X POST http://localhost:${settings.mcpServerPort}/mcp \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'`}
        </pre>
      </div>
    </div>
  );
};
