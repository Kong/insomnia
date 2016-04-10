import networkRequest from 'request'
import render from './render'

export default function (request, callback) {
  const config = {
    url: request.url,
    method: request.method,
    body: request.body,
    headers: {}
  };

  if (request.authentication.username) {
    config.auth = {
      user: request.authentication.username,
      pass: request.authentication.password
    }
  }

  for (let i = 0; i < request.headers.length; i++) {
    let header = request.headers[i];
    config.headers[header.name] = header.value;
  }

  // SNEAKY HACK: Render nested object by converting it to JSON then rendering
  const context = {template_id: 'tem_WWq2w9uJNR6Pqk8APkvsS3'};
  const template = JSON.stringify(config);
  const renderedConfig = JSON.parse(render(template, context));

  networkRequest(renderedConfig, function (err, response) {
    if (err) {
      return callback(err);
    } else {
      return callback(null, {
        body: response.body,
        contentType: response.headers['content-type'],
        headers: response.headers,
        statusCode: response.statusCode
      });
    }
  });
}
