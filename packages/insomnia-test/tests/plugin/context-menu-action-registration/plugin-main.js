module.exports.requestActions = [{
  label: 'Show Item Info',
  action(context, { request }) {
    context.app.alert(request.name, `Type: Request (${request.method})`);
  },
}];

module.exports.requestGroupActions = [{
  label: 'Show Folder Info',
  action(context, { requestGroup }) {
    context.app.alert(requestGroup.name, 'Type: Folder');
  },
}];

module.exports.workspaceActions = [{
  label: 'Show Collection Info',
  action(context, { workspace }) {
    context.app.alert(workspace.name, 'Type: Collection / Document');
  },
}];