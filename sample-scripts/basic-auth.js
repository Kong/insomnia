module.exports.config = {
  name: 'basic-auth',
  version: '1.0.0',
  hooks: ['send::pre-flight']
};

module.exports.listen = function (hook, run) {
  if (hook !== 'send::pre-flight') return;

  return _promptForUsernamePassword(run).then(results => {
    // Calculate basic auth header value
    const {username, password} = results;
    const authHeader = `${username}:${password}`;
    const authString = new Buffer(authHeader, 'utf8').toString('base64');

    // Set auth header for the request
    return run({
      command: 'request.headers.set',
      name: 'Authorization',
      value: `Basic ${authString}`,
      overwriteExisting: false,
    });
  });
};

function _promptForUsernamePassword (run) {
  return run({
    command: 'user.prompt',
    inputs: [{
      name: 'password',
      label: 'Password',
      placeholder: '**********',
      type: 'password',
    }, {
      name: 'username',
      label: 'Username',
      placeholder: 'myUser',
    }]
  });
}
