module.exports.config = {
  name: 'basic-auth',
  friendlyName: 'Basic Authentication',
  description: 'Provide JIT basic authentication for the user',
  version: '1.0.0',
  hooks: ['send::pre-flight'],
  menus: [{
    location: 'request.options',
    action: 'clear',
    label: 'Clear Saved Password',
    icon: 'trash-o',
  }]
};

module.exports.all = async function (hook, run) {
  switch (hook) {
    case 'basic-auth::clear':
      return _clearPassword(run);
    case 'send::pre-flight':
      return _preRequest(run);
  }
};

async function _clearPassword (run) {
  return run({
    command: 'storage.clear',
    scope: 'request',
    key: 'password',
  });
}

async function _preRequest (run) {
  let password;

  const result = await run({
    command: 'storage.get',
    scope: 'request',
    key: 'password',
  });

  if (result.password !== undefined) {
    // Found the password in storage. Return.
    password = result.password;
  } else {
    // Password was not stored, prompt the user for it
    const result = await run({
      command: 'user.prompt',
      inputs: [{
        name: 'password',
        label: 'Password',
        placeholder: '**********',
        type: 'password',
      }, {
        name: 'remember',
        label: 'Remember Password',
        type: 'checkbox',
      }]
    });

    password = result.password;

    if (result.remember) {
      // Store password if the user specifies to
      await run({
        command: 'storage.set',
        scope: 'request',
        key: 'password',
        value: result.password,
      })
    }
  }

  // Calculate basic auth header value
  const authHeader = `${username || ''}:${password || ''}`;
  const authString = new Buffer(authHeader, 'utf8').toString('base64');

  // Set auth header for the request
  await run({
    command: 'request.headers.set',
    name: 'Authorization',
    value: `Basic ${authString}`,
    overwriteExisting: false,
  });
}
