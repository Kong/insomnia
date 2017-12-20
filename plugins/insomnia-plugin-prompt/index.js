module.exports.templateTags = [{
  displayName: 'Prompt',
  name: 'prompt',
  description: 'prompt user for input',
  args: [{
    displayName: 'Title',
    type: 'string'
  }, {
    displayName: 'Label',
    type: 'string'
  }, {
    displayName: 'Default Value',
    type: 'string',
    help: 'This value is used to pre-populate the prompt dialog, but is ALSO used ' +
    'when the app renders preview values (like the one below). This is to prevent the ' +
    'prompt from displaying too frequently during general app use.'
  }],
  run (context, title, label, defaultValue) {
    return context.app.prompt({title, label, defaultValue});
  }
}];
