import networkRequest from 'request'

export default function (request, callback) {
  const config = {
    url: request.url,
    method: request.method
  };

  if (request.authentication.username) {
    config.auth = {
      user: request.authentication.username,
      pass: request.authentication.password
    }
  }

  if (request.body) {
    config.body = request.body;
  }

  networkRequest(config, function (err, response) {
    callback(err, response);
  });
}
