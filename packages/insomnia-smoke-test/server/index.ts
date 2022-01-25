import express from 'express';
import cors from 'git-http-mock-server/cors';
import createGitHTTPServerMiddleware from 'git-http-mock-server/middleware';
import * as path from 'path';

import { basicAuthRouter } from './basic-auth';
import { oauthRoutes } from './oauth';

const app = express();
const port = 4010;

/**
 * Add a git http server middleware.
 *
 * The cors middleware is needed because it accepts/adds specific cors headers for git https://github.com/isomorphic-git/git-http-mock-server/blob/main/http-server.js#L14
 */
app.use(
  cors(
    createGitHTTPServerMiddleware({
      root: path.resolve(
        process.cwd(),
        process.env.GIT_HTTP_MOCK_SERVER_ROOT ||
          path.join(__dirname, '..', 'fixtures', 'git-repos')
      ),
      glob: '*',
      route: process.env.GIT_HTTP_MOCK_SERVER_ROUTE || '/git/',
    })
  )
);

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

app.get('/delay/seconds/:duration', (req, res) => {
  const delaySec = Number.parseInt(req.params.duration || '2');
  setTimeout(function() {
    res.send(`Delayed by ${delaySec} seconds`);
  }, delaySec * 1000);
});

app.use('/oidc', oauthRoutes(port));

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
