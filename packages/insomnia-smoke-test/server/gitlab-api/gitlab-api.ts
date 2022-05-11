import type { Application } from 'express';

import { gitrepo, graphqlPayload } from './gitlab-api.mock';

export default (app: Application) => {
  app.post('/gitlab-api/api/graphql', (_req, res) => {
    res.status(200).send(graphqlPayload);
  });

  app.post('/gitlab-api/oauth/token', (_req, res) => {
    res.status(200).send({
      'access_token': '123456789',
      'created_at': 1652246628,
      'expires_in': 6955,
      'refresh_token': '1234567891',
      scope: 'api read_user write_repository read_repository email',
      'token_type': 'Bearer',
    });
  });

  app.post('/gitlab-api/oauth/authorize', (_req, res) => {
    res.status(200).send({
      'access_token': '123456789',
    });
  });

  app.get('/gitlab-api/i3801/newnewnew.git/info/refs?service=git-upload-pack', (_req, res) => {
    res.status(200).send({
      data: gitrepo,
    });
  });
};
