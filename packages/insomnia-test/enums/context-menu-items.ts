export enum ContextMenuItem {
  // Renamed from "Collection" — INS-3528 unified Collection/Document
  // workspaces under the single "API Collection" label.
  Collection = "API Collection",
  HttpRequest = "HTTP Request",
  Folder = "New Folder",
  EventStreamRequest = "Event Stream Request (SSE)",
  GraphQLRequest = "GraphQL Request",
  WebSocketRequest = "WebSocket Request",
  GrpcRequest = "gRPC Request",
  SocketIORequest = "Socket.IO Request",
  // "Document" was removed as its own creation-menu entry by INS-3528 —
  // creating a Document is now just creating an API Collection.
  McpClient = "MCP Client",
  MockServer = "Mock Server",
  Environment = "Environment",
  Import = "Import",
  Settings = "Settings",
  Sort = "Sort",
  // Renamed from "Run Collection" — INS-3528.
  RunCollection = "Run API Collection",
  Delete = "Delete",
  Rename = "Rename",
  Duplicate = "Duplicate",
  Pin = "Pin",
  OpenInNewTab = "Open in New Tab",
  Export = "Export",
  GenerateCode = "Generate Code",
}
