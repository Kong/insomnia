import type { Application } from 'express';

export default (app: Application) => {
  app.post('/gitlab-api/api/graphql', (_req, res) => {
    res.status(200).send({
      'data': {
        'currentUser': {
          'publicEmail': null,
          'name': 'Mark Kim',
          'avatarUrl': null,
        },
      },
    });
  });

  app.get('/api/v1/oauth/gitlab/config', (_req, res) => {
    res.status(200).send({
      applicationId: 'gitlab-oauth-client-id',
      redirectUri: 'http://localhost:3000/not-implemented',
    });
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
};
