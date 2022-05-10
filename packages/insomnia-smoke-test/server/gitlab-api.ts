import type { Application } from 'express';

export default (app: Application) => {
  app.post('/graphql', (_req, res) => {
    res.status(200).send({
      data: {
        viewer: {
          name: 'InsomniaUser',
          email: 'sleepyhead@email.com',
        },
      },
    });
  });

  app.post('/oauth/token', (_req, res) => {
    res.status(200).send({
      'access_token': '123456789',
    });
  });

  app.post('/oauth/authorize', (_req, res) => {
    res.status(200).send({
      'access_token': '123456789',
    });
  });
};
