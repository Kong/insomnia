import type { Application } from 'express';

const organizations = [{ 'id': 'org_7ef19d06-5a24-47ca-bc81-3dea011edec2', 'name': 'feb56ab4b19347c4b648c99bfa7db363', 'display_name': 'Personal workspace', 'branding': { 'logo_url': 'https://s.gravatar.com/avatar/a7f1c636e9ee9096b4539a20da8bd3e9?s=480&r=pg&d=https%3A%2F%2Fcdn.auth0.com%2Favatars%2Fja.png' }, 'metadata': { 'organizationType': 'personal', 'ownerAccountId': 'acct_64a477e6b59d43a5a607f84b4f73e3ce' } }, { 'id': 'org_31a76a2b-6e1a-4318-9b9c-36c81299a8bf', 'name': '07df6d95b60e4593af0424c74d96637a-team', 'display_name': '🦄 Magic', 'branding': { 'logo_url': 'https://d2evto68nv31gd.cloudfront.net/org_98e187f8-a753-4abf-b0b2-58cdb852eba6' }, 'metadata': { 'organizationType': 'team', 'ownerAccountId': 'acct_64a477e6b59d43a5a607f84b4f73e3ce' } }, { 'id': 'org_4856369d-c116-41e2-a5ba-f257d7afb03d', 'name': '7fa2e000dfad4cbbacb9257ea21dc709-team', 'display_name': '🦄 Unicorn CO', 'branding': { 'logo_url': 'https://d2evto68nv31gd.cloudfront.net/org_98e187f8-a753-4abf-b0b2-58cdb852eba6' }, 'metadata': { 'organizationType': 'team', 'ownerAccountId': 'acct_64a477e6b59d43a5a607f84b4f73e3ce' } }];
const user = { 'id': 'email|64f0dd619ab0786da330d83a', 'email': '', 'name': 'James Gatz', 'picture': 'https://d2evto68nv31gd.cloudfront.net/acct_64a477e6b59d43a5a607f84b4f73e3ce', 'bio': 'My BIO', 'github': 'https://github.com/gatzjames', 'linkedin': '', 'twitter': '', 'identities': null, 'given_name': '', 'family_name': '' };

export default (app: Application) => {
  app.post('/api/graphql', (_req, res) => {
    res.status(200).send({
      data: {
        viewer: {
          name: 'InsomniaUser',
          email: 'sleepyhead@email.com',
        },
      },
    });
  });

  app.post('/api', (_req, res) => {
    res.status(200).send({
      'access_token': '123456789',
    });
  });
};
