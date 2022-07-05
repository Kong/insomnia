import express from 'express';
import { graphqlHTTP } from 'express-graphql';

import { basicAuthRouter } from './basic-auth';
import githubApi from './github-api';
import gitlabApi from './gitlab-api';
import { root, schema } from './graphql';
import { startGRPCServer } from './grpc';
import { oauthRoutes } from './oauth';

const app = express();
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

app.use('/graphql', graphqlHTTP({
  schema: schema,
  rootValue: root,
  graphiql: true,
}));

startGRPCServer(grpcPort).then(() => {
  app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
  });
});
