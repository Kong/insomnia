import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import nodePath from 'node:path';

import * as bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import express from 'express';
import gitMiddleware from 'git-http-mock-server/middleware';
import { createHandler } from 'graphql-http/lib/use/http';

import { basicAuthRouter } from './basic-auth';
import cloudSyncApi from './cloud-sync-api';
import githubApi from './github-api';
import gitlabApi from './gitlab-api';
import { schema } from './graphql';
import { startGRPCServer } from './grpc';
import insomniaApi from './insomnia-api';
import { mtlsRouter } from './mtls';
import { oauthRoutes } from './oauth';
import simpleCrud from './simple-crud';
import { startSocketIOServer } from './socket-io';
import { startWebSocketServer } from './websocket';

const app = express();
app.use(cookieParser());
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} ${new Date().toISOString()}`);
  next();
});
const port = 4010;
const httpsPort = 4011;
const grpcPort = 50_051;
const rawParser = bodyParser.raw({
  inflate: true,
  type: '*/*',
});

app.get('/pets/:id', (req, res) => {
  res.status(200).send({ id: req.params.id });
});

app.get('/builds/check/*', (_req, res) => {
  res.status(200).send({
    url: 'https://github.com/Kong/insomnia/releases/download/core@2023.5.6/Insomnia.Core-2023.5.6.zip',
    name: '2099.1.0',
  });
});

async function echoHandler(req: any, res: any) {
  res.status(200).send({
    method: req.method,
    headers: req.headers,
    data: req.body.toString(),
    cookies: req.cookies,
  });
}

app.get('/echo', rawParser, echoHandler);
app.post('/echo', rawParser, echoHandler);

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
app.use('/protected', mtlsRouter);

githubApi(app);
gitlabApi(app);
insomniaApi(app);
simpleCrud(app);
cloudSyncApi(app);

app.get('/delay/seconds/:duration', (req, res) => {
  const delaySec = Number.parseInt(req.params.duration || '2');
  setTimeout(() => {
    res.send(`Delayed by ${delaySec} seconds`);
  }, delaySec * 1000);
});

oauthRoutes(port).then(router => app.use('/oidc', router));

app.get('/', (_req, res) => {
  res.status(200).send();
});

app.all('/graphqlTest', createHandler({ schema }));

app.use(express.json()); // Used to parse JSON bodies

// SSE routes
let subscribers: { id: string; response: express.Response }[] = [];
app.get('/events', (request, response) => {
  const headers = {
    'Content-Type': 'text/event-stream',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
  };
  response.writeHead(200, headers);
  const subscriberId = crypto.randomUUID();
  const data = `data: ${JSON.stringify({ id: subscriberId })}\n\n`;
  response.write(data);
  const subscriber = {
    id: subscriberId,
    response,
  };
  subscribers.push(subscriber);
  setInterval(() => {
    // const id = subscriberId;
    const data = JSON.stringify({ message: 'Time: ' + new Date().toISOString().slice(11, 19) });
    // response.write('id: ' + id + '\n');
    response.write('data: ' + data + '\n\n');
  }, 1000);
  request.on('close', () => {
    console.log(`${subscriberId} Connection closed`);
    subscribers = subscribers.filter(sub => sub.id !== subscriberId);
  });
});
app.post('/send-event', (request, response) => {
  // Requires middleware to parse JSON body
  console.log('Received event', request.body);
  subscribers.forEach(subscriber => subscriber.response.write(`data: ${JSON.stringify(request.body)}\n\n`));
  response.json({ success: true });
});
// auto update endpoints, use INSOMNIA_UPDATES_URL=http://localhost:4010 npm run dev for testing
app.get('/builds/check/mac', (request, response) => {
  return response.json({
    url: 'https://github.com/Kong/insomnia/releases/download/core@11.6.1/Insomnia.Core-11.6.1.dmg',
    name: '11.6.1',
  });
});
app.get('/updates/win', (request, response) => {
  return response.json({
    url: 'https://github.com/Kong/insomnia/releases/download/core@11.6.1/Insomnia.Core-11.6.1.zip',
    name: '11.6.1',
  });
});
// mock endpoint for azure oauth config, used in external vault integration test
app.get('/v1/oauth/azure/config', (_req, res) => {
  res.status(200).send({
    clientID: 'test_client_id',
    clientRedirectURI: 'https://login.microsoftonline.com',
  });
});

app.use(
  '/git',
  gitMiddleware({
    root: nodePath.join(__dirname, '../fixtures/git-repo'),
    glob: '*',
    route: '/',
  }),
);

startWebSocketServer(
  app.listen(port, '::', () => {
    console.log(`Listening at http://localhost:${port}`);
    console.log(`Listening at http://127.0.0.1:${port}`);
    console.log(`Listening at http://[::1]:${port}`);
    console.log(`Listening at ws://localhost:${port}`);
  }),
);

startWebSocketServer(
  createServer(
    {
      cert: readFileSync(nodePath.join(__dirname, '../fixtures/certificates/localhost.pem')),
      key: readFileSync(nodePath.join(__dirname, '../fixtures/certificates/localhost-key.pem')),
      ca: readFileSync(nodePath.join(__dirname, '../fixtures/certificates/rootCA.pem')),
      requestCert: true,
      rejectUnauthorized: false,
    },
    app,
  ).listen(httpsPort, '::', () => {
    console.log(`Listening at https://localhost:${httpsPort}`);
    console.log(`Listening at https://127.0.0.1:${httpsPort}`);
    console.log(`Listening at https://[::1]:${httpsPort}`);
    console.log(`Listening at wss://localhost:${httpsPort}`);
  }),
);

startSocketIOServer();

startGRPCServer(grpcPort);
