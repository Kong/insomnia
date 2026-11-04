import type { PageManager } from "@package/pages/page-manager";

import { BaseFlow } from "./base.flow";
import type { FlowContext } from "./flow-context";
import type { WorkspaceFlow } from "./workspace.flow";

export class McpClientFlow extends BaseFlow {
  constructor(
    context: FlowContext,
    pageManager: PageManager,
    private readonly workspaceFlow: WorkspaceFlow,
  ) {
    super(context, pageManager);
  }














}
