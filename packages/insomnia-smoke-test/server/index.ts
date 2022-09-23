import express from 'express';
import { graphqlHTTP } from 'express-graphql';
import { readFileSync } from 'fs';
import { createServer } from 'https';
import { join } from 'path';

import { basicAuthRouter } from './basic-auth';
import githubApi from './github-api';
import gitlabApi from './gitlab-api';
import { root, schema } from './graphql';
import { startGRPCServer } from './grpc';
import { oauthRoutes } from './oauth';
import { startWebSocketServer } from './websocket';

const app = express();
const port = 4010;
const httpsPort = 4011;
const grpcPort = 50051;

app.get('/pets/:id', (req, res) => {
  res.status(200).send({ id: req.params.id });
});

app.get('/sleep', (_req, res) => {
  res.status(200).send({ sleep: true });
});

app.get('/cookies', (_req, res) => {
  res
    .status(200)
    .header('content-type', 'text/plain')
    .cookie('insomnia-test-cookie', 'value123')
    .send(`${_req.headers['cookie']}`);
});

app.use('/file', express.static('fixtures/files'));

app.use('/auth/basic', basicAuthRouter);

githubApi(app);
gitlabApi(app);

app.get('/delay/seconds/:duration', (req, res) => {
  const delaySec = Number.parseInt(req.params.duration || '2');
  setTimeout(function() {
    res.send(`Delayed by ${delaySec} seconds`);
  }, delaySec * 1000);
});

app.use('/oidc', oauthRoutes(port));

app.get('/', (_req, res) => {
  res.status(200).send();
});

app.use('/graphql', graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true,
}));

startGRPCServer(grpcPort).then(() => {
  const server = app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
    console.log(`Listening at ws://localhost:${port}`);
  });

  const httpsServer = createServer({
    cert: readFileSync(join(__dirname, '../fixtures/certificates/localhost.pem')),
    ca: readFileSync(join(__dirname, '../fixtures/certificates/rootCA.pem')),
    key: readFileSync(join(__dirname, '../fixtures/certificates/localhost-key.pem')),
    // Only allow connections using valid client certificates
    requestCert: true,
    rejectUnauthorized: true,
  }, app);
  httpsServer.listen(httpsPort, () => {
    console.log(`Listening at https://localhost:${httpsPort}`);
    console.log(`Listening at wss://localhost:${httpsPort}`);
  });

  startWebSocketServer(server);
  startWebSocketServer(httpsServer);
});
