import express from 'express';
import expressWs from 'express-ws';

import { basicAuthRouter } from './basic-auth';
import githubApi from './github-api';
import gitlabApi from './gitlab-api';
import { startGRPCServer } from './grpc';
import { oauthRoutes } from './oauth';

const appBase = express();
const wsInstance = expressWs(appBase);
const { app } = wsInstance;

const port = 4010;
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

app.ws('/echo', ws => {

  ws.on('connection', () => {
    console.debug('WebSocket connection was opened');
  });

  ws.on('message', msg => {
    ws.send(msg);
  });

  ws.on('close', () => {
    console.debug('WebSocket connection was closed');
  });
});

startGRPCServer(grpcPort).then(() => {
  app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
    console.log(`Listening at ws://localhost:${port}/echo`);
  });
});
