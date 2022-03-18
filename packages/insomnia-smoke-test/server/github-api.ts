import type { Application } from 'express';

export default (app: Application) => {
  app.post('/github-api/graphql', (_req, res) => {
    res.status(200).send({
      data: {
        viewer: {
          name: 'InsomniaUser',
          email: 'sleepyhead@email.com',
        },
      },
    });
  });

  app.post('/api/v1/oauth/github', (_req, res) => {
    res.status(200).send({
      'access_token': '123456789',
    });
  });
};
