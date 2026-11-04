export enum ContextMenuItem {
  // Renamed from "Collection" — INS-3528 unified Collection/Document
  // workspaces under the single "API Collection" label.
  Collection = "API Collection",
  HttpRequest = "HTTP Request",
  Folder = "New Folder",
  // "Document" was removed as its own creation-menu entry by INS-3528 —
  // creating a Document is now just creating an API Collection.
  Environment = "Environment",
  // Renamed from "Run Collection" — INS-3528.
  Rename = "Rename",
  Duplicate = "Duplicate",
  // The sidebar's workspace-level dropdown (Collection/Environment/MCP
  // Client rows) labels this action "Duplicate / Move"; requests and
  // folders use the plain "Duplicate" above.
  Pin = "Pin",
  // The request context menu's Pin action relabels to "Unpin" once the
  // request is already pinned.
  Unpin = "Unpin",
}
