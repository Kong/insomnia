# Migration: request flows (http, graphql, grpc, web-socket, socket-io, event-stream)

All `create(parent, request)` -> Promise<void> (was entity). Ends with workspacePage.requireItemNode(request, TreeNodeType.Request). Applies to http/graphql/grpc/web-socket/socket-io/event-stream.
Read-back replacement for `x = await flows.<proto>Request.create(...)` / `.get(name)`:
  const node = await pageManager.workspacePage.findItemNode({ name }, TreeNodeType.Request); // or requireItemNode(model, TreeNodeType.Request)
  await pageManager.workspacePage.openRequestNode(node);
  await pageManager.<x>RequestPage.navigate();   // event-stream: previously get() used eventStreamRequestPage.waitForPane(); navigate() is used elsewhere in this flow
  const data = await pageManager.<x>RequestPage.get();
  (<x>RequestPage = httpRequestPage | graphqlRequestPage | grpcRequestPage | webSocketRequestPage | socketIoRequestPage | eventStreamRequestPage)
  Old get() wrapped data as new XRequest({ name, id: node._id, ...data }); do that spec-side if a model is needed.

## HttpRequestFlow
- create(parent, request): Promise<HttpRequest> -> Promise<void>
- get(item): DELETED -> sequence above with httpRequestPage
- send(request): Promise<ResponseView> -> Promise<void>; then `await pageManager.responsePage.get()` (response pane already navigated)
- fetchOAuth2Tokens(request): Promise<OAuth2Tokens> -> void; then `await pageManager.httpRequestPage.auth.getOAuth2Tokens()`
- getResponseExportOptionState(option): DELETED -> `await pageManager.responsePage.getExportOptionState(option)` (returns { text, disabled })
- unchanged: setParamsBulk, exportResponse, saveResponseToFile

## GraphQLRequestFlow
- create -> void; get(item, parent?): DELETED (sequence above, graphqlRequestPage)
- send -> void; then `pageManager.responsePage.get()`
- fetchOAuth2Tokens -> void; then `pageManager.graphqlRequestPage.auth.getOAuth2Tokens()`
- unchanged: setAuthentication

## GrpcRequestFlow
- create -> void; get DELETED (sequence above, grpcRequestPage)
- exported interface `GrpcResponse` DELETED (spec-side build { status, message, messages } if needed)
- send/cancel/commit(request): Promise<GrpcResponse> -> Promise<void>; flow leaves gRPC response pane shown (responsePage.navigateGrpc() already called). Read with:
    const status = await pageManager.responsePage.getGrpcStatus();
    const messages = await pageManager.responsePage.getGrpcMessages();   // old `message` === messages[0]
- start/setBody/streamMessage: unchanged
- openRequest (private): now Promise<void>; specs needing the page use `pageManager.grpcRequestPage`

## WebSocketRequestFlow
- create -> void; get(item, parent?): DELETED (webSocketRequestPage)
- send(request, options?), disconnect(request, callback?, timeout?), sendMessage(request, body, callback?, timeout?): Promise<ResponseView> -> Promise<void>; then `pageManager.responsePage.get()`
- unchanged: setAuthentication

## SocketIORequestFlow
- create -> void; get(item, parent?): DELETED (socketIoRequestPage)
- disconnect(request, callback?, timeout?), sendMessage(request): Promise<ResponseView> -> Promise<void>; then `pageManager.responsePage.get()`
- unchanged: connect (was already void)

## EventStreamRequestFlow
- create -> void; get(item, parent?): DELETED (eventStreamRequestPage; old impl called eventStreamRequestPage.waitForPane() instead of navigate())
- send(request, options?): Promise<ResponseView> -> Promise<void>; then `pageManager.responsePage.get()`
- fetchOAuth2Tokens -> void; then `pageManager.eventStreamRequestPage.auth.getOAuth2Tokens()`
- unchanged: setAuthentication
