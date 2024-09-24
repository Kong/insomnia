import { randomUUID } from 'crypto';
import type { Application } from 'express';
import { json } from 'express';

const currentPlan = {
  isActive: true,
  period: 'year',
  planId: 'team',
  price: 100,
  quantity: 10,
  type: 'team',
};

const projectsByOrgId = new Map(Object.entries({
  'org_7ef19d06-5a24-47ca-bc81-3dea011edec2': [
    {
      id: 'proj_org_7ef19d06-5a24-47ca-bc81-3dea011edec2',
      name: 'Personal Workspace',
    },
  ],
  'team_195a6ce0edb1427eb2e8ba7b986072e4': [
    {
      id: 'proj_team_195a6ce0edb1427eb2e8ba7b986072e4',
      name: 'Personal Workspace',
    },
  ],
}));

const organizations = [
  // Personal organization
  {
    'id': 'org_7ef19d06-5a24-47ca-bc81-3dea011edec2',
    'name': 'feb56ab4b19347c4b648c99bfa7db363',
    'display_name': 'Personal workspace',
    'branding': {
      'logo_url': '',
    },
    'metadata': {
      'organizationType': 'personal',
      'ownerAccountId': 'acct_64a477e6b59d43a5a607f84b4f73e3ce',
    },
  },
  // Team Organization: Was a team before the migration now looks like this:
  // Teams migrated to Organizations have an id that starts with team_ and the team id is the same as the organization id
  {
    'id': 'team_195a6ce0edb1427eb2e8ba7b986072e4',
    'name': '07df6d95b60e4593af0424c74d96637a-team',
    'display_name': '🦄 Magic',
    'branding': {
      'logo_url': '',
    },
    'metadata': {
      'organizationType': 'team',
      'ownerAccountId': 'acct_64a477e6b59d43a5a607f84b4f73e3ce',
    },
  },
];

const organizationFeatures = {
  features: {
    gitSync: {
      enabled: true,
    },
  },
};

const user = {
  'id': 'email|64f0dd619ab0786da330d83a',
  'email': 'insomnia-user@konghq.com',
  'name': 'Rick Morty',
  'picture': '',
  'bio': 'My BIO',
  'github': '',
  'linkedin': '',
  'twitter': '',
  'identities': null,
  'given_name': '',
  'family_name': '',
};

const whoami = {
  'sessionExpiry': 4838400,
  'publicKey': '{"alg":"RSA-OAEP-256","e":"AQAB","ext":true,"key_ops":["encrypt"],"kty":"RSA","n":"pTQVaUaiqggIldSKm6ib6eFRLLoGj9W-2O4gTbiorR-2b8-ZmKUwQ0F-jgYX71AjYaFn5VjOHOHSP6byNAjN7WzJ6A_Z3tytNraLoZfwK8KdfflOCZiZzQeD3nO8BNgh_zEgCHStU61b6N6bSpCKjbyPkmZcOkJfsz0LJMAxrXvFB-I42WYA2vJKReTJKXeYx4d6L_XGNIoYtmGZit8FldT4AucfQUXgdlKvr4_OZmt6hgjwt_Pjcu-_jO7m589mMWMebfUhjte3Lp1jps0MqTOvgRb0FQf5eoBHnL01OZjvFPDKeqlvoz7II9wFNHIKzSvgAKnyemh6DiyPuIukyQ"}',
  'encPrivateKey': '{"iv":"4a09fba2c412d7ea205b6168","t":"a4fa1a524e89e668444de654f1bd1ba8","d":"b695b6ec7d41327b723e395b3788cc08c89dcf7b4db0811c3e91af4aa9ed1c9cb8132b591fe24498ffcc48c0055c1c0985a48d9e96962961c049cea508b6c38e83dfc831a4b1a82ad3e79a26d6ed3c1c9b73043a0e266cfe6eac661a75f4b9862afe2a81362d640bb2fdb6d0015204d04c322f1cb7f33faa593b538b58bda75b0c5e56583d5a55eea89e74d96ce29d862614414ee298f56105ea3dbc479aea9330618ba3e94efe874b33cd99954b12f27d7ff9e7f981310381fa0b3f1a05fbac71862ecc67ddbf7062f718d1d8bbf03f35afc3a8b1b36b177f278ab8dd12c14c862bca52a2c63bca05c7fc9bd8f1000ddc328ad1b5a72b96f110c3443294129db416bd385d19c73a1b342b4887feffa17639cc96b7b7154903c2de183f73d3116d98c8d32ea8b9627d0a5200da98d28c89c34008d4e6fa4cfbd7e1b7e1f36cfec6d0020b306c7def8d24c6091252764bde2eef74f35bdaa605dc27fcd302d179fcf65d6c7d18d3dd36cf6380bd40a29198a0398a6cb1ab79a71be00f7783b6559a146f1f825d25a990162e923e2dbfdd1ee868c8b63844f9394415ebab9f397c8d78608de00369728744b8344724e5c2f1e4ba95522406bd7042fc271793af32bfa1c2724defc8a88185cc5c2825c0453fcb39dc5ac9147d3ba60006fccca855678521da06b426dfd04333511b7d8184a8960dadefb1ef89f5fa648304adcd79734fea763f7dbd0c2788c64ea302f8e33602ab041aec619661167b2f167a4b2cadc6b7cf0c22867fcdd73528fb5585b9d13f6d90ab36c5ef231bd4f2464650e541e6dead1753487b45a8ade3fe46e2327fd0e32d8adafd4e1d2ffcb2df1ed50718d0d29829f8bf4bc33da524640388b0cb9f640b70f9ef0a1d073bc80abdf975fe77b35f07aee5135e2924661d26e5d299a432c563a3bbc5ff21d1fde07ff2336b32b17067c01adc6697568aabf3ff4882530763f77d96cef2fcc7336e3f8e4a2b8de5df42aaeaeccd9e3681604e677fad555148ced6057d99cab03389bb566b27cc4ea3946a640f05593e5944c74adf5d0649941b8032dc6959bdef917fd7d2da3139b1d3770d411b52752c9299f789ce5de64e802740a8210e1c70e0ffb8aa45a3647b837e2c5d1a7dd676b238268ac7c060bcc771285f21a283c2f0eefb54254086770a4f09140f7b6a118a7df1e06445379080c2cb6a8840b9d70411521107b47751634e3ff6437974ac2e5897e7e15ac8bdbb5325bb1dd09c20f8ac37fa1eaf2765671fd1434460cbf3cc97bf67b19f88b2bfbde99836c27c338b7f19fc20aad90b91e268c87b81aa17026ac5ac74f47c3525fd2d0d584d3b1d75dd360f105f78b2831481802b6a40e88938660d1598947ffb4e7cf75cd67308d6f910be2fb9beafb68d5ea7c3d2f79c3b66223d610a70a6f9ce3c3447bc0acf74e84687c2da5a137b6c14631971e19133a61bfa94c247ae99d771d8efc11d983e2ea904dab4ca479fa00be3b0372e100225311ffb5b95faed4c32b5794cc618ded1027e6f2a54328a5cd322da6c6ef91151cacfa456680547adf18cde5323869bc03b2c7edd731f5e5c9b9eaa7b2f57d4246d324047482a48d7472650b8d0614a0e133e849a09d37bc9f7921d05397b98e398cd3411dde80d9bd6be4384289a2d1a0416cd914e7520cae962493d31b652a520a9fca7d7e6e9e5df53d719e518125b73ea49af30b720a6d0a71089dcaf04da9ee05c4ede6d0ba376c86282293248a4b36a2ac07a3297d569ad4e958c918317a4d526dae47b07f8c6615a77f5831d146c063b88246e2b3ce7b8f4b75291c339c317e3fbc84563694cd749f021b1e0c076521d685f87497831f19cba89601a344c5d1d08f12b2de9d5d068daf760bf87993e89a2912ab29e3fc79af39db18e982bfe0ee0374c84487cabc1f59bc216d71c38654805cddbc338fc8c14413849ea3ef79444ac6078fb2403ecd84de5b678538be0b2580ecb1926e03643ff29464f943cd729ad386daf1f81ea385e79260cdf78d579281adb72946692d54e94a2fd8530dfb8e5923ce642ec92ccee28f6b21efdff24ec820b4eff26f493278acb485af055881e077cdf3017bc6104b2394fee39343b7c71c20cbf7a3ea96b0c7b603a2ff998d27b16833b028bf30ab668041c8d82225d58bd95f9246de742815067046adbf55eddfddfbc30fea3b8c6659d2756c702f2012395245035bf5338427051b4eb392225aa10179d8b042ba77bc1a37cd66a655ec03aa3aa3c75e05aad4ad38240ee0e6c5af85bc7813f2c0de6eccf5cfba2f6295daf448c042c50c6eba6127f170848cc2034bd61698747a3bee155146d2ab73ba79d969cffcba737bd85b20123a5e3080edba483d831c38c9a4aee9a2fdeb0819665cf28aab91f2317f77d22b29f49d6dbd4ae5b82f9529fb208824f22fdd48666dfc0abe4a9d00dd7d552f4bf6fade29b63ad080614bfe04d9fdca7cff96378e201f6e71cc665e6ae8abd64d125a8c222b03f9153824251db960b4eae41280b681a9fa6c1ec76e94bcd9656aa3df3b57f2da9","ad":""}',
  'encSymmetricKey': '{"iv":"0146bfcc7b89a3aa055bedae","t":"7559a4ef7ca495c9605516cc846007a3","d":"4de3ab37e73dd6fc294257fe4cb1af26229434297ecdd309e93a941bd1f9913b5916dfe55d62f0d4015c46f66d8fdf4c84ab88c22e4d24428d5fe6c1affce1e14b33760a382b67b4a37262f9ca5a44cb9760b151bbd0748fc18f8f438545df356d99a66c74ff22b623b2b67d9765f80ac6f18af01684e6e3efbce947832ac0bea010c1cde00390e1f3d2187286ff00a43aef8ddc13a98d8f4f771bba1694712623b115f0b2c0e891eccd074ade0b551737b915d0f1242ffcbc1c65555ff7","ad":""}',
  'email': 'insomnia-user@konghq.com',
  'accountId': 'acct_64a477e6b59d43a5a607f84b4f73e3ce',
  'firstName': 'Rick',
  'lastName': 'Morty',
};

const allRoles = [
  {
    'id': 'role_d32b9d6c-1fb2-4ac1-b780-b4c15074d6cb',
    'name': 'owner',
    'description': 'Owner can manage the organization and also delete it.',
  },
  {
    'id': 'role_013aeb67-15c9-42c5-bcd0-5c70a33f8719',
    'name': 'admin',
    'description': 'Admin can only manage the organization.',
  },
  {
    'id': 'role_3fbb17e4-249c-47d5-a5ee-b7f1f43a9c63',
    'name': 'member',
    'description': 'Member cannot manage the organization.',
  },
];

const userPermissions = {
  'create:enterprise_connection': false,
  'create:invitation': true,
  'create:team_project': true,
  'delete:enterprise_connection': false,
  'delete:file': true,
  'delete:invitation': true,
  'delete:membership': true,
  'delete:organization': true,
  'delete:team_project': true,
  'get:organization:transfers': true,
  'own:organization': true,
  'read:enterprise_connection': false,
  'read:invitation': true,
  'read:membership': true,
  'read:organization': true,
  'read:team_project': true,
  'revoke:organization:transfer': true,
  'start:organization:transfer': true,
  'update:enterprise_connection': false,
  'update:membership': true,
  'update:organization': true,
  'update:team_project': true,
};

const orgInfo = {
  'id': 'org_3d314c35-b9ca-4aec-b57d-04cea38da05c',
  'name': 'Sync',
  'display_name': 'Sync',
  'branding': {
    'logo_url': 'https://d2evto68nv31gd.cloudfront.net/org_98e187f8-a753-4abf-b0b2-58cdb852eba6',
  },
  'metadata': {
    'organizationType': 'team',
    'ownerAccountId': 'acct_e9cf786dc67b4dbc8c002359b3cc3d70',
  },
};

const currentRole = {
  'roleId': 'role_d32b9d6c-1fb2-4ac1-b780-b4c15074d6cb',
  'name': 'owner',
  'description': 'Owner can manage the organization and also delete it.',
};

const storageRule = { 'storage': 'cloud_plus_local', 'isOverridden': false };

const members = {
  'start': 0,
  'limit': 0,
  'length': 0,
  'total': 2,
  'next': '',
  'members': [
    {
      'user_id': 'acct_e9cf786dc67b4dbc8c002359b3cc3d70',
      'picture': 'https://s.gravatar.com/avatar/5301bf735ebace330bb801abb593dc78?s=480\u0026r=pg\u0026d=https%3A%2F%2Fcdn.auth0.com%2Favatars%2Fwe.png',
      'name': 'wei.yao+2@konghq.com ',
      'email': 'wei.yao+2@konghq.com',
      'role_name': 'owner',
      'created': '2024-08-28T07:02:04.341983Z',
    },
    {
      'user_id': 'acct_f883f98dbb9945fba7bb23925361e02a',
      'picture': 'https://s.gravatar.com/avatar/fe822a9c78b8154da82635055895e6e6?s=480\u0026r=pg\u0026d=https%3A%2F%2Fcdn.auth0.com%2Favatars%2Fwe.png',
      'name': 'wei.yao+3@konghq.com ',
      'email': 'wei.yao+3@konghq.com',
      'role_name': 'member',
      'created': '2024-09-12T11:40:43.168144Z',
    },
  ],
};

const invites = {
  'start': 0,
  'limit': 3,
  'length': 0,
  'total': 3,
  'next': '',
  'invitations': [
    {
      'id': 'uinv_1dmvK1rTehbiBV85',
      'inviter': {
        'name': 'wei.yao+2@konghq.com ',
      },
      'invitee': {
        'email': 'wei.yao@konghq.com',
      },
      'created_at': '2024-09-14T10:16:10.513Z',
      'expires_at': '2024-09-21T10:16:10.513Z',
      'roles': [
        'member',
      ],
    },
    {
      'id': 'uinv_T9uaMMeoRQQVKF2E',
      'inviter': {
        'name': 'wei.yao+2@konghq.com ',
      },
      'invitee': {
        'email': 'wei.yao+6@konghq.com',
      },
      'created_at': '2024-09-12T10:33:45.320Z',
      'expires_at': '2024-09-19T10:33:45.320Z',
      'roles': [
        'member',
      ],
    },
    {
      'id': 'uinv_TIYVQQC2aH7Ev5hW',
      'inviter': {
        'name': 'wei.yao+2@konghq.com ',
      },
      'invitee': {
        'email': 'wei.yao+4@konghq.com',
      },
      'created_at': '2024-09-12T10:03:51.638Z',
      'expires_at': '2024-09-19T10:03:51.638Z',
      'roles': [
        'member',
      ],
    },
  ],
};

export default (app: Application) => {
  // User
  app.get('/v1/user/profile', (_req, res) => {
    console.log('GET *');
    res.status(200).send(user);
  });

  app.get('/auth/whoami', (_req, res) => {
    res.status(200).send(whoami);
  });

  // Billing
  app.get('/v1/billing/current-plan', json(), (_req, res) => {
    res.status(200).send(currentPlan);
  });

  // Organizations
  app.get('/v1/organizations', (_req, res) => {
    res.status(200).send({
      organizations: organizations,
    });
  });

  app.get('/v1/organizations/:orgId/features', (_req, res) => {
    res.status(200).send(organizationFeatures);
  });

  // Projects
  app.get('/v1/organizations/:orgId/team-projects', (_req, res) => {
    res.status(200).send({
      data: projectsByOrgId.get(_req.params.orgId),
    });
  });

  app.delete('/v1/organizations/:orgId/team-projects/:projectId', json(), (_req, res) => {
    const projects = projectsByOrgId.get(_req.params.orgId)?.filter(project => project.id !== _req.params.projectId);
    if (!projects) {
      res.status(500).send();
      return;
    }
    projectsByOrgId.set(_req.params.orgId, projects);
    res.status(200).send();
  });

  app.patch('/v1/organizations/:orgId/team-projects/:projectId', json(), (_req, res) => {
    const updatedProjects = projectsByOrgId.get(_req.params.orgId)?.map(project => {
      if (project.id === _req.params.projectId) {
        return {
          ...project,
          name: _req.body.name,
        };
      }
      return project;
    });

    updatedProjects && projectsByOrgId.set(_req.params.orgId, updatedProjects);
    res.status(200).send();
  });

  app.post('/v1/organizations/:organizationId/team-projects', json(), (_req, res) => {
    const { organizationId } = _req.params;

    if (organizationId === 'personal') {
      const personalOrg = organizations.find(org => org.metadata.organizationType === 'personal');

      if (!personalOrg) {
        res.status(500).send();
        return;
      }

      const newProject = {
        id: `proj_${randomUUID()}`,
        name: _req.body.name,
      };

      const projects = [
        ...(projectsByOrgId.get(personalOrg.id) || []),
        newProject,
      ];

      projectsByOrgId.set(personalOrg.id, projects);
      res.status(200).send({ ...newProject, organizationId: personalOrg.id });
      return;
    }

    const organization = organizations.find(org => org.id === organizationId);

    if (!organization) {
      res.status(500).send();
      return;
    }

    const newProject = {
      id: `proj_${randomUUID()}`,
      name: _req.body.name,
    };

    const projects = [
      ...(projectsByOrgId.get(organization.id) || []),
      newProject,
    ];

    projectsByOrgId.set(organization.id, projects);
    res.status(200).send({ ...newProject, organizationId: organization.id });
  });

  app.post('/v1/organizations/:organizationId/collaborators', (_req, res) => {
    res.json({ 'data': [] });
  });

  app.get('/v1/organizations/roles', (_req, res) => {
    res.json(allRoles);
  });

  app.get('/v1/organizations/:organizationId/user-permissions', (_req, res) => {
    res.json(userPermissions);
  });

  app.get('/v1/organizations/:organizationId', (_req, res) => {
    res.json(orgInfo);
  });

  app.get('/v1/organizations/:organizationId/members/:accountId/roles', (_req, res) => {
    res.json(currentRole);
  });

  app.get('/v1/organizations/:organizationId/storage-rule', (_req, res) => {
    res.json(storageRule);
  });

  app.get('/v1/organizations/:organizationId/members', (_req, res) => {
    res.json(members);
  });

  app.get('/v1/organizations/:organizationId/invites', (_req, res) => {
    res.json(invites);
  });
};
