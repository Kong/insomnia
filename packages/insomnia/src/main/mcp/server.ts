/**
 * MCP Server Implementation with proper SDK integration
 *
 * Provides an HTTP-based MCP server using StreamableHTTPServerTransport
 * that exposes Insomnia's request operations as MCP tools.
 *
 * Features:
 * - Streamable HTTP transport with SSE support for MCP clients
 * - API key authentication via middleware
 * - Request operations filtered by organization/project
 * - Comprehensive logging and error handling
 */

import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import path from 'node:path';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { app, BrowserWindow } from 'electron';
import express, { type Request as ExpressRequest, type Response as ExpressResponse } from 'express';

import { getAppVersion } from '~/common/constants';
import { database } from '~/common/database';
import * as models from '~/models';
import { userSession } from '~/models';
import type { OrganizationsResponse } from '~/models/organization';
import type { Request } from '~/models/request';
import type { Workspace } from '~/models/workspace';
import { insomniaFetch } from '~/ui/insomnia-fetch';

export type McpServerStatus = 'stopped' | 'starting' | 'running' | 'error';

interface McpServerState {
  status: McpServerStatus;
  port?: number;
  error?: string;
  startedAt?: number;
}

let httpServer: HttpServer | null = null;
let mcpServer: Server | null = null;
let mcpServerLogStream: fs.WriteStream | null = null;
let serverState: McpServerState = { status: 'stopped' };

// Store active transport sessions
const activeSessions = new Map<string, StreamableHTTPServerTransport>();

interface McpServerLogEntry {
  timestamp: number;
  level: 'info' | 'error' | 'warn';
  event: string;
  data?: any;
  error?: string;
}

/**
 * Log an event to the MCP server log file
 */
function logMcpServerEvent(level: McpServerLogEntry['level'], event: string, data?: any, error?: Error) {
  const logEntry: McpServerLogEntry = {
    timestamp: Date.now(),
    level,
    event,
    data,
    error: error?.message,
  };

  console.log(`[MCP Server] ${level.toUpperCase()}: ${event}`, data || '');

  if (mcpServerLogStream && !mcpServerLogStream.writableEnded) {
    mcpServerLogStream.write(JSON.stringify(logEntry) + '\n');
  }
}

/**
 * Update server state and notify all renderer processes
 */
function updateServerState(newState: Partial<McpServerState>) {
  serverState = { ...serverState, ...newState };

  // Notify all renderer windows
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('mcpServer.statusChanged', serverState);
  });
}

/**
 * Show a toast notification in all renderer processes
 */
function showToast(title: string, description: string, status: 'info' | 'success' | 'warning' | 'error') {
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('show-toast', {
      content: {
        title,
        description,
        status,
        icon: status === 'error' ? 'exclamation-triangle' : status === 'success' ? 'check-circle' : 'info-circle',
      },
      options: {
        timeout: 3000,
      },
    });
  });
}

/**
 * Tool: list_organizations
 * Lists all organizations available in Insomnia
 */
async function handleListOrganizations() {
  logMcpServerEvent('info', 'list_organizations', {});
  const { id: sessionId } = await userSession.getOrCreate();
  const { organizations } = await insomniaFetch<OrganizationsResponse>({
    method: 'GET',
    path: '/v1/organizations',
    sessionId,
    onlyResolveOnSuccess: true,
  });

  // Get all organizations
  // Format organizations for response
  const formattedOrganizations = organizations.map(org => ({
    id: org.id,
    name: org.name,
  }));

  logMcpServerEvent('info', 'list_organizations_success', { count: formattedOrganizations.length });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ organizations: formattedOrganizations, total: formattedOrganizations.length }),
      },
    ],
  };
}

/**
 * Tool: list_projects
 * Lists all projects within an organization
 */
async function handleListProjects(args: any) {
  const { organizationId } = args;

  if (!organizationId) {
    throw new Error('organizationId is required');
  }

  logMcpServerEvent('info', 'list_projects', { organizationId });

  // Get all projects for the organization
  const projects = await database.find('Project', { parentId: organizationId });

  // Format projects for response
  const formattedProjects = projects.map(project => ({
    id: project._id,
    name: project.name,
    organizationId: project.parentId,
    created: project.created,
    modified: project.modified,
  }));

  logMcpServerEvent('info', 'list_projects_success', { count: formattedProjects.length });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ projects: formattedProjects, total: formattedProjects.length }),
      },
    ],
  };
}

/**
 * Tool: list_workspaces
 * Lists all workspaces within a project
 */
async function handleListWorkspaces(args: any) {
  const { organizationId, projectId } = args;

  if (!organizationId || !projectId) {
    throw new Error('Both organizationId and projectId are required');
  }

  logMcpServerEvent('info', 'list_workspaces', { organizationId, projectId });

  // Verify project belongs to organization
  const projects = await database.find('Project', { parentId: organizationId });
  const project = projects.find(p => p._id === projectId);

  if (!project) {
    throw new Error('Project not found or does not belong to the specified organization');
  }

  // Get all workspaces for the project
  const workspaces = await getWorkspacesForProject(projectId);

  // Format workspaces for response
  const formattedWorkspaces = workspaces.map(ws => ({
    id: ws._id,
    name: ws.name,
    projectId: ws.parentId,
    scope: ws.scope,
    created: ws.created,
    modified: ws.modified,
  }));

  logMcpServerEvent('info', 'list_workspaces_success', { count: formattedWorkspaces.length });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ workspaces: formattedWorkspaces, total: formattedWorkspaces.length }),
      },
    ],
  };
}

/**
 * Get all workspaces for a given project
 */
async function getWorkspacesForProject(projectId: string): Promise<Workspace[]> {
  return await database.find<Workspace>('Workspace', { parentId: projectId });
}

/**
 * Validate API key middleware for Express
 */
async function validateApiKey(req: ExpressRequest, res: ExpressResponse, next: () => void) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logMcpServerEvent('warn', 'unauthorized_request', { path: req.path, reason: 'missing_auth_header' });
    res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const settings = await models.settings.get();
  const storedApiKey = settings.mcpServerApiKey;

  if (!storedApiKey || token !== storedApiKey) {
    logMcpServerEvent('warn', 'unauthorized_request', { path: req.path, reason: 'invalid_api_key' });
    res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    return;
  }

  next();
}

/**
 * Create and configure the MCP Server instance
 */
function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'insomnia-mcp-server',
      version: getAppVersion(),
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // Register list_tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logMcpServerEvent('info', 'tools_list_requested', {});
    return {
      tools: [
        {
          name: 'list_organizations',
          description:
            'List all organizations available in Insomnia. Returns organization summaries including ID and name.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'list_projects',
          description: 'List all projects within an organization. Returns project summaries including ID and name.',
          inputSchema: {
            type: 'object',
            properties: {
              organizationId: {
                type: 'string',
                description: 'The organization ID to filter projects',
              },
            },
            required: ['organizationId'],
          },
        },
        {
          name: 'list_workspaces',
          description: 'List all workspaces within a project. Returns workspace summaries including ID and name.',
          inputSchema: {
            type: 'object',
            properties: {
              organizationId: {
                type: 'string',
                description: 'The organization ID for authorization',
              },
              projectId: {
                type: 'string',
                description: 'The project ID to filter workspaces',
              },
            },
            required: ['organizationId', 'projectId'],
          },
        },
        {
          name: 'list_requests',
          description:
            'List all requests within an organization and project. Returns request summaries including ID, name, method, URL, and description.',
          inputSchema: {
            type: 'object',
            properties: {
              organizationId: {
                type: 'string',
                description: 'The organization ID to filter requests',
              },
              projectId: {
                type: 'string',
                description: 'The project ID to filter requests',
              },
            },
            required: ['organizationId', 'projectId'],
          },
        },
        {
          name: 'get_request',
          description: 'Get detailed information about a specific request by ID.',
          inputSchema: {
            type: 'object',
            properties: {
              requestId: { type: 'string', description: 'The ID of the request' },
              organizationId: { type: 'string', description: 'Organization ID for authorization' },
              projectId: { type: 'string', description: 'Project ID for authorization' },
            },
            required: ['requestId', 'organizationId', 'projectId'],
          },
        },
        {
          name: 'create_request',
          description: 'Create a new request in a workspace.',
          inputSchema: {
            type: 'object',
            properties: {
              organizationId: {
                type: 'string',
                description: 'Organization ID for authorization',
              },
              projectId: {
                type: 'string',
                description: 'Project ID for authorization',
              },
              workspaceId: {
                type: 'string',
                description: 'The workspace ID where the request will be created',
              },
              name: {
                type: 'string',
                description: 'The name of the request',
              },
              method: {
                type: 'string',
                enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
                description: 'HTTP method for the request',
              },
              url: {
                type: 'string',
                description: 'The URL for the request',
              },
              description: {
                type: 'string',
                description: 'Optional description of the request',
              },
              headers: {
                type: 'array',
                description: 'Optional array of request headers',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    value: { type: 'string' },
                  },
                },
              },
              body: {
                type: 'object',
                description: 'Optional request body',
                properties: {
                  mimeType: { type: 'string' },
                  text: { type: 'string' },
                },
              },
            },
            required: ['organizationId', 'projectId', 'workspaceId', 'name', 'method', 'url'],
          },
        },
      ],
    };
  });

  // Register call_tool handler
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args } = request.params;

    logMcpServerEvent('info', 'tool_call', { name, args });

    try {
      switch (name) {
        case 'list_organizations': {
          return await handleListOrganizations();
        }
        case 'list_projects': {
          return await handleListProjects(args || {});
        }
        case 'list_workspaces': {
          return await handleListWorkspaces(args || {});
        }
        case 'list_requests': {
          return await handleListRequests(args || {});
        }
        case 'get_request': {
          return await handleGetRequest(args || {});
        }
        case 'create_request': {
          return await handleCreateRequest(args || {});
        }
        default: {
          throw new Error(`Unknown tool: ${name}`);
        }
      }
    } catch (error) {
      logMcpServerEvent('error', 'tool_call_error', { name, args }, error as Error);
      throw error;
    }
  });

  return server;
}

/**
 * Tool: list_requests
 * Lists all requests within an organization and project
 */
async function handleListRequests(args: any) {
  const { organizationId, projectId } = args;

  if (!organizationId || !projectId) {
    throw new Error('Both organizationId and projectId are required');
  }

  logMcpServerEvent('info', 'list_requests', { organizationId, projectId });

  // Get all workspaces for the project
  const workspaces = await getWorkspacesForProject(projectId);
  const workspaceIds = workspaces.map(w => w._id);

  if (workspaceIds.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ requests: [], total: 0 }),
        },
      ],
    };
  }

  // Get all requests in those workspaces
  const requests = await database.find<Request>('Request', {
    parentId: { $in: workspaceIds },
  });

  // Format requests for response
  const formattedRequests = requests.map(req => ({
    id: req._id,
    name: req.name,
    method: req.method,
    url: req.url,
    description: req.description,
    workspaceId: req.parentId,
    created: req.created,
    modified: req.modified,
  }));

  logMcpServerEvent('info', 'list_requests_success', { count: formattedRequests.length });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ requests: formattedRequests, total: formattedRequests.length }),
      },
    ],
  };
}

/**
 * Tool: get_request
 * Gets details of a specific request by ID
 */
async function handleGetRequest(args: any) {
  const { requestId, organizationId, projectId } = args;

  if (!requestId) {
    throw new Error('requestId is required');
  }

  if (!organizationId || !projectId) {
    throw new Error('Both organizationId and projectId are required for authorization');
  }

  logMcpServerEvent('info', 'get_request', { requestId, organizationId, projectId });

  // Get the request
  const request = await models.request.getById(requestId);

  if (!request) {
    throw new Error(`Request not found: ${requestId}`);
  }

  // Verify the request belongs to the specified organization/project
  const workspaces = await getWorkspacesForProject(projectId);
  const workspaceIds = workspaces.map(w => w._id);

  if (!workspaceIds.includes(request.parentId)) {
    throw new Error('Request does not belong to the specified organization/project');
  }

  // Format detailed request data
  const formattedRequest = {
    id: request._id,
    name: request.name,
    method: request.method,
    url: request.url,
    description: request.description,
    workspaceId: request.parentId,
    headers: request.headers,
    parameters: request.parameters,
    pathParameters: request.pathParameters,
    body: request.body,
    authentication: request.authentication,
    created: request.created,
    modified: request.modified,
  };

  logMcpServerEvent('info', 'get_request_success', { requestId });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(formattedRequest),
      },
    ],
  };
}

/**
 * Tool: create_request
 * Creates a new request in a workspace
 */
async function handleCreateRequest(args: any) {
  const { organizationId, projectId, workspaceId, name, method, url, description, headers, body } = args;

  if (!organizationId || !projectId || !workspaceId) {
    throw new Error('organizationId, projectId, and workspaceId are required');
  }

  if (!name || !method || !url) {
    throw new Error('name, method, and url are required');
  }

  logMcpServerEvent('info', 'create_request', { organizationId, projectId, workspaceId, name, method, url });

  // Verify workspace belongs to the project
  const workspaces = await getWorkspacesForProject(projectId);
  const workspace = workspaces.find(w => w._id === workspaceId);

  if (!workspace) {
    throw new Error('Workspace not found or does not belong to the specified project');
  }

  // Create the request
  const newRequest = await models.request.create({
    parentId: workspaceId,
    name,
    method: method.toUpperCase(),
    url,
    description: description || '',
    headers: headers || [],
    body: body || {},
  });

  logMcpServerEvent('info', 'create_request_success', { requestId: newRequest._id });

  const formattedRequest = {
    id: newRequest._id,
    name: newRequest.name,
    method: newRequest.method,
    url: newRequest.url,
    description: newRequest.description,
    workspaceId: newRequest.parentId,
    created: newRequest.created,
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(formattedRequest),
      },
    ],
  };
}

/**
 * Start the MCP server with proper SDK integration
 */
export async function startMcpServer(port?: number): Promise<void> {
  if (httpServer) {
    throw new Error('MCP Server is already running');
  }

  updateServerState({ status: 'starting' });

  try {
    const settings = await models.settings.get();
    const serverPort = port || settings.mcpServerPort || 3000;
    const apiKey = settings.mcpServerApiKey;

    if (!apiKey) {
      throw new Error('MCP Server API key is not configured');
    }

    // Setup logging
    const logPath = path.join(app.getPath('userData'), 'mcp-server.log');
    mcpServerLogStream = fs.createWriteStream(logPath, { flags: 'a' });

    logMcpServerEvent('info', 'starting_server', { port: serverPort });

    // Create MCP Server instance
    mcpServer = createMcpServer();

    // Create Express app
    const expressApp = express();
    expressApp.use(express.json());

    // Health check endpoint (no auth required)
    expressApp.get('/health', (_req, res) => {
      res.json({ status: 'ok', version: getAppVersion() });
    });

    // MCP endpoint with StreamableHTTPServerTransport
    // This handles both GET (SSE) and POST (messages) requests
    expressApp.all('/mcp', validateApiKey, async (req, res) => {
      if (!mcpServer) {
        res.status(500).json({ error: 'MCP Server not initialized' });
        return;
      }

      try {
        // Extract session ID from header if present
        const sessionId = req.headers['mcp-session-id'] as string | undefined;

        // Check if we have an existing session
        let transport = sessionId ? activeSessions.get(sessionId) : undefined;

        if (!transport) {
          // Create a new transport for new sessions
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: newSessionId => {
              logMcpServerEvent('info', 'session_initialized', { sessionId: newSessionId });
              activeSessions.set(newSessionId, transport!);
            },
            onsessionclosed: closedSessionId => {
              logMcpServerEvent('info', 'session_closed', { sessionId: closedSessionId });
              activeSessions.delete(closedSessionId);
            },
          });

          // Connect the transport to the MCP server
          await mcpServer.connect(transport);
          logMcpServerEvent('info', 'new_transport_connected', {});
        }

        // Handle the request through the transport
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        logMcpServerEvent('error', 'transport_error', { path: req.path }, error as Error);

        if (!res.headersSent) {
          res.status(500).json({
            error: 'Internal server error',
            message: (error as Error).message,
          });
        }
      }
    });

    // Create HTTP server
    httpServer = createServer(expressApp);

    // Start listening
    await new Promise<void>((resolve, reject) => {
      httpServer!
        .listen(serverPort, () => {
          logMcpServerEvent('info', 'server_started', { port: serverPort });
          updateServerState({ status: 'running', port: serverPort, error: undefined, startedAt: Date.now() });
          showToast('MCP Server Started', `Server is running on port ${serverPort}`, 'success');
          resolve();
        })
        .on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            const errorMsg = `Port ${serverPort} is already in use`;
            logMcpServerEvent('error', 'server_start_error', { port: serverPort }, new Error(errorMsg));
            updateServerState({ status: 'error', error: errorMsg });
            showToast('MCP Server Error', errorMsg, 'error');
            reject(new Error(errorMsg));
          } else {
            logMcpServerEvent('error', 'server_start_error', { port: serverPort }, err);
            updateServerState({ status: 'error', error: err.message });
            showToast('MCP Server Error', err.message, 'error');
            reject(err);
          }
        });
    });
  } catch (error) {
    const errorMsg = (error as Error).message;
    logMcpServerEvent('error', 'server_initialization_error', undefined, error as Error);
    updateServerState({ status: 'error', error: errorMsg });
    showToast('MCP Server Error', errorMsg, 'error');

    // Cleanup on error
    mcpServer = null;
    httpServer = null;

    throw error;
  }
}

/**
 * Stop the MCP server
 */
export async function stopMcpServer(): Promise<void> {
  if (!httpServer) {
    return;
  }

  logMcpServerEvent('info', 'stopping_server', {});

  // Close all active sessions
  for (const [sessionId, transport] of activeSessions.entries()) {
    try {
      await transport.close();
      logMcpServerEvent('info', 'session_closed_on_shutdown', { sessionId });
    } catch (error) {
      logMcpServerEvent('error', 'session_close_error', { sessionId }, error as Error);
    }
  }
  activeSessions.clear();

  // Close the MCP server
  if (mcpServer) {
    try {
      await mcpServer.close();
    } catch (error) {
      logMcpServerEvent('error', 'mcp_server_close_error', {}, error as Error);
    }
    mcpServer = null;
  }

  // Close the HTTP server
  await new Promise<void>(resolve => {
    httpServer!.close(() => {
      logMcpServerEvent('info', 'server_stopped', {});
      mcpServerLogStream?.end();
      mcpServerLogStream = null;
      httpServer = null;
      updateServerState({ status: 'stopped', port: undefined, error: undefined, startedAt: undefined });
      showToast('MCP Server Stopped', 'Server has been stopped', 'info');
      resolve();
    });
  });
}

/**
 * Get current server status
 */
export function getMcpServerStatus(): McpServerState {
  return serverState;
}

/**
 * Register IPC handlers for MCP server management
 */
export function registerMcpServerHandlers() {
  const { ipcMainHandle } = require('../ipc/electron');

  ipcMainHandle('mcpServer.start', async (_event: any, port?: number) => {
    await startMcpServer(port);
    return getMcpServerStatus();
  });

  ipcMainHandle('mcpServer.stop', async () => {
    await stopMcpServer();
    return getMcpServerStatus();
  });

  ipcMainHandle('mcpServer.getStatus', async () => {
    return getMcpServerStatus();
  });

  ipcMainHandle('mcpServer.restart', async (_event: any, port?: number) => {
    if (httpServer) {
      await stopMcpServer();
    }
    await startMcpServer(port);
    return getMcpServerStatus();
  });
}
