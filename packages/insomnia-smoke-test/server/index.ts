import express from 'express';

import { basicAuthRouter } from './basic-auth';
import githubApi from './github-api';
import { oauthRoutes } from './oauth';

const app = express();
const port = 4010;

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

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
