module.exports.config = {
  name: 'set-env',
  version: '1.0.0'
};

module.exports.listen = function (hook, run) {
  if (hook !== 'send::response') return;

  return run({command: 'response.body.get'}).then(rawBody => {
    const body = JSON.parse(rawBody);
    return run({
      command: 'environment.set',
      key: 'token',
      value: body.token,
    });
  });
};
