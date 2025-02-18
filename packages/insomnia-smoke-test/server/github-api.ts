import type { Application } from 'express';

export default (app: Application) => {
  app.get('/github-api/rest/user/repos', (_req, res) => {
    res.status(200).send([
      {
        id: 123456,
        full_name: 'kong-test/sleepless',
        clone_url: 'https://github.com/kong-test/sleepless.git',
        permissions: {
          push: true,
          pull: true,
        },
      },
    ]);
  });

  app.get('/github-api/rest/user/emails', (_req, res) => {
    res.status(200).send([
      {
        email: 'curtain@drape.net',
        primary: true,
      },
    ]);
  });

  app.get('/github-api/rest/user', (_req, res) => {
    res.status(200).send({
      name: 'Insomnia',
      login: 'insomnia-infra',
      email: null,
      avatar_url: 'https://github.com/insomnia-infra.png',
      url: 'https://api.github.com/users/insomnia-infra',
    });
  });

  app.post('/v1/oauth/github', (_req, res) => {
    res.status(200).send({
      'access_token': '123456789',
    });
  });

  app.post('/v1/oauth/github-app', (_req, res) => {
    res.status(200).send({
      'access_token': '123456789',
    });
  });
};
