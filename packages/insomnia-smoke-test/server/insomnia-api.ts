import { randomUUID } from 'crypto';
import type { Application } from 'express';
import { json } from 'express';

import { Collaborator, CollaboratorType } from '../../insomnia/src/ui/routes/invite';
import { getRandomId, getTeamName, getUserEmail } from '../tests/smoke/test-utils';

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
  'publicKey': {
    'alg': 'RSA-OAEP-256',
    'e': 'AQAB',
    'ext': true,
    'key_ops': ['encrypt'],
    'kty': 'RSA',
    'n': 'pTQVaUaiqggIldSKm6ib6eFRLLoGj9W-2O4gTbiorR-2b8-ZmKUwQ0F-jgYX71AjYaFn5VjOHOHSP6byNAjN7WzJ6A_Z3tytNraLoZfwK8KdfflOCZiZzQeD3nO8BNgh_zEgCHStU61b6N6bSpCKjbyPkmZcOkJfsz0LJMAxrXvFB-I42WYA2vJKReTJKXeYx4d6L_XGNIoYtmGZit8FldT4AucfQUXgdlKvr4_OZmt6hgjwt_Pjcu-_jO7m589mMWMebfUhjte3Lp1jps0MqTOvgRb0FQf5eoBHnL01OZjvFPDKeqlvoz7II9wFNHIKzSvgAKnyemh6DiyPuIukyQ',
  },
  'encPrivateKey': {
    'iv': '3a1f2bdb8acbf15f469d57a2',
    't': '904d6b1bc0ece8e5df6fefb9efefda7c',
    'd': '2a7b0c4beb773fa3e3c2158f0bfa654a88c4041184c3b1e01b4ddd2da2c647244a0d66d258b6abb6a9385251bf5d79e6b03ef35bdfafcb400547f8f88adb8bceb7020f2d873d5a74fb5fc561e7bd67cea0a37c49107bf5c96631374dc44ddb1e4a8b5688dc6560fc6143294ed92c3ad8e1696395dfdf15975aa67b9212366dbfcb31191e4f4fe3559c89a92fb1f0f1cc6cbf90d8a062307fce6e7701f6f5169d9247c56dae79b55fba1e10fde562b971ca708c9a4d87e6e9d9e890b88fa0480360420e610c4e41459570e52ae72f349eadf84fc0a68153722de3280becf8a1762e7faebe964f0ad706991c521feda3440d3e1b22f2c221a80490359879bd47c0d059ace81213c74a1e192dbebd8a80cf58c9eb1fe461a971b88d3899baf4c4ef7141623c93fb4a54758f5e1cf9ee35cd00777fa89b24e4ded57219e770de2670619c6e971935c61ae72e3276cf8db49dfa0e91c68222f02d7e0c69b399af505de7e5a90852d83e0a30934b0362db986f3aaefaaf1a96fef3e8165287a3a7f0ee1e072d9dee3aefb86194e1d877d6b34529d45a70ec4573c35a7fe27833c77c3154b0ad02187e4fcecd408bcf4b29a85a5dc358cb479140f4983fcd936141f581764669651530af97d2b7d9416aea7de67e787f3e29ae3eba6672bcd934dc1e308783aa63a4ab46d48d213cf53ad6bd8828011f5bfa3aa5ee24551c694e829b54c93b1dda6c3ddda04756d68a28bec8d044c8af4147680dc5b972d0ca74299b0ab6306b9e7b99bf0557558df120455a272145b7aa792654730f3d670b76d72408f5ce1cf5fbd453d2903fa72cf26397437854ba8abbb731a8107f6a86a01fa98edc81bb42a4c1330f779e7a0fbd1820eaed78e03e40a996e03884b707556be06fd14ee8f4035469210d1d2bb8f58285fc2ab6de3d3cc0e4e1f40c6d9d24b50dc8e2e2374a0aff52031b3736c2982133bb19dd551ce1f953f4ba02b0cf53382c15752e202c138cb42b2322df103ff17fd886dfd5f992b711673cdf16048c4bff19038138b161c2e1783b85fc7b965a91ac4795fcbfebf827940cacdeae57946863aee027df43b36612f3cb8f34dc44396e87c564bf10f5b1a9dfbd6da3d7f4f65024b0b4f8ce51d01c230840941fc4523b17eb1c2522032f410e8328239a11a15ab755c32945ce52966d5bfb4666909ed2ca04d536e4bf92091563dd44d46cbb35e53c2481400058ab3b52a0280d262551073f61db125ee280e2cc1ec0bdf9c4817824261465011e34c2296411384f7f5e16742157c5520f137631edf498aa39c7c32b107e3634cbeb70feea19a233c8bd939d665135c9f7c1bb33cb47edc58bdbbcde9b0b9eb73a46642e4639289a62638fb7813e1eeaadd105c803de8357236f33c4bcf31a876b5867591af8f165eba0b35cf0b0886af17dab35a6a39f8f576387d6ffb9e677ee46fc0f11ff069a2a068fce441ff8f4125095fad228c2bf45c788d641941ed13c0a16fffcafd7c7eff11bb7550c0b7d54eebdbd2066e3bbdb47aaee2b5f1e499726324a40015458c7de1db0abe872594d8e6802deff7ea9518bdb3a3e46f07139267fd67dc570ba8ab04c2b37ce6a34ec73b802c7052a2eef0cae1b0979322ef86395535db80cf2a9a88aa7c2e5cc28a93612a8dafe1982f741d7cec28a866f6c09dba5b99ead24c3df0ca03c6c5afae41f3d39608a8f49b0d6a0b541a159409791c25ede103eb4f79cfbd0cc9c9aa6b591755c1e9fd07b5b9e38ed85b5939e65d127256f6a4c078f8c9d655c4f072f9cbcfb2e1e17eaa83dc62aaab2a6dc3735ee76ce7a215740f795f1fbe7136c7734ae3714438015e8fc383d63775a8abddb23cbc5f906c046bb0b5b31d492a7c151b40ea82c7c966e25820641c55b343b89d6378f90de5983fa76547e9d6c634effdf019a0fd9b6d3e488a5aa94f0710d517ba4f7c1ed82f9f3072612e953e036c0ec7f3c618368362f6da6f3af76056a66aef914805cc8b628f1c11695f760b535ded9ff66727273ae7e12d67a01243d75f22fec8ed1b043122a211c923aa92ecbbe01dd0d7195c3c0e09a2a6ab3eca354963122d5a0ec16e2b2b81b0ddce6ec0a312c492a96a4fd392f1deb6a1f3318541a3f87e5c9e73ee7edd3b855910f412789e25038108e1eaae04dcfb02b4d958c00c630dc8caa87a40798ce7156d2ade882e68832d39fe8f9bce6a995249a7383013a5093c4af55c3b7232de0f2593d82c30b8dabd0784455037f25f6bb66a6d0d8f72bc7be0dee2d0a8af44bb4e143257d873268d331722c3253ea5c004e72daf04c875e2054f2b4b2bca2979fd046a1e835600045edf2f159d851a540a91a1ab8fbcb64594d21942bbaa2160535d32496ba7ce4a76c6bdeb9bb4c5cab7bed1ae26564058d0be125803d7019b83b3953c4b0cc1f8299c4edcf6a5faa4765092412d368b277689900e71fb5d47581057adaa2dd494e0f66dc1aa16f3741973b0d9ffa1728aeafab84b777394a7afae0f8eabaa6b740f1c60ca26469f0c9356ec880ad6f4dc01b99bd14d7a4bb8afc97662a9e68b0155e4cdf3caa3402819ac6ce562c8fe06edb50a31cfd7a',
    'ad': '',
  },
  'symmetricKey': {
    'alg': 'A256GCM',
    'ext': true,
    'k': 'w62OJNWF4G8iWA8ZrTpModiY8dICyHI7ko1vMLb877g=',
    'key_ops': ['encrypt', 'decrypt'],
    'kty': 'oct',
  },
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

interface CollaboratorSearchResultItem {
  id: string;
  picture: string;
  type: CollaboratorType;
  name: string;
};

interface EmailsList {
  invitesCount: number;
  membersCount: number;
  groupsCount: number;
};

const getEmailsForInviteSearch = ({
  invitesCount = 0,
  membersCount = 0,
  groupsCount = 0,
}: EmailsList) => {
  const emails: CollaboratorSearchResultItem[] = [];

  for (let i = 0; i < groupsCount; i++) {
    emails.push({
      id: getRandomId(),
      picture: 'https://static.insomnia.rest/insomnia-coffee.png',
      type: 'group',
      name: getTeamName(),
    });
  }

  for (let i = 0; i < invitesCount; i++) {
    emails.push({
      id: getRandomId(),
      picture: 'https://static.insomnia.rest/insomnia-gorilla.png',
      type: 'invite',
      name: getUserEmail(),
    });
  }

  for (let i = 0; i < membersCount; i++) {
    emails.push({
      id: getRandomId(),
      picture: 'https://static.insomnia.rest/insomnia-gorilla.png',
      type: 'member',
      name: getUserEmail(),
    });
  }

  return emails;
};

const emailsAndGroupsToInvite = getEmailsForInviteSearch({
  invitesCount: 2,
  membersCount: 1,
  groupsCount: 1,
});

const emailsAndGroupsToSearch = getEmailsForInviteSearch({
  invitesCount: 6,
  membersCount: 4,
  groupsCount: 1,
}).concat(emailsAndGroupsToInvite);

const OWNER_ROLE_ID = 'role_b3cf4fed-9208-497a-93c6-ae1a82b7b889';
const ADMIN_ROLE_ID = 'role_1c7938bc-c53b-49a1-819e-72f0c3a5baa6';
const MEMBER_ROLE_ID = 'role_4c924f55-7706-4de8-94ab-0a2085890641';

const getCollaborators = ({
  invitesCount = 0,
  membersCount = 0,
  groupsCount = 0,
}: EmailsList) => {
  const collaborators: Collaborator[] = [];

  for (let i = 0; i < groupsCount; i++) {
    collaborators.push({
      id: getRandomId(),
      picture: 'https://static.insomnia.rest/insomnia-coffee.png',
      type: 'group',
      name: getTeamName(),
      createdAt: '2024-09-14T10:16:10.513Z',
      metadata: {
        groupId: getRandomId(),
        groupTotal: 3,
      },
    });
  }

  for (let i = 0; i < invitesCount; i++) {
    collaborators.push({
      id: getRandomId(),
      picture: 'https://static.insomnia.rest/insomnia-gorilla.png',
      type: 'invite',
      name: getUserEmail(),
      createdAt: '2024-09-14T10:16:10.513Z',
      metadata: {
        invitationId: getRandomId(),
        roleId: i % 2 === 0 ? MEMBER_ROLE_ID : ADMIN_ROLE_ID,
        email: getUserEmail(),
        expiresAt: '2077-09-21T10:16:10.513Z',
      },
    });
  }

  for (let i = 0; i < membersCount; i++) {
    collaborators.push({
      id: getRandomId(),
      picture: 'https://static.insomnia.rest/insomnia-gorilla.png',
      type: 'member',
      name: getUserEmail(),
      createdAt: '2024-09-14T10:16:10.513Z',
      metadata: {
        userId: getRandomId(),
        roleId: i === 0 ? OWNER_ROLE_ID : i % 2 === 0 ? ADMIN_ROLE_ID : MEMBER_ROLE_ID,
        email: getUserEmail(),
      },
    });
  }

  return {
    collaborators,
    start: 0,
    limit: 15,
    length: 0,
    total: invitesCount + membersCount + groupsCount,
    next: '',
  };
};

const collaboratorsList = getCollaborators({
  invitesCount: 6,
  membersCount: 4,
  groupsCount: 1,
});

emailsAndGroupsToInvite.forEach((collaborator, index) => {
  collaboratorsList.collaborators.push({
    ...collaborator,
    createdAt: '2024-09-14T10:16:10.513Z',
    metadata: {
      invitationId: getRandomId(),
      roleId: index % 2 === 0 ? MEMBER_ROLE_ID : ADMIN_ROLE_ID,
      email: collaborator.name,
      expiresAt: '2077-09-21T10:16:10.513Z',
    },
  });
});

collaboratorsList.total = collaboratorsList.collaborators.length + emailsAndGroupsToInvite.length;

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

  app.get('/v1/desktop/organizations/:organizationId/collaborators', (_req, res) => {
    res.json(collaboratorsList);
  });

  app.post('/v1/desktop/organizations/:organizationId/collaborators/start-adding', (_req, res) => {
    res.json({
      'acct_2346c8e88dae47e2a1a5cae04dc68ea3': {
        'accountId': 'acct_2346c8e88dae47e2a1a5cae04dc68ea3',
        'publicKey': '{"alg":"RSA-OAEP-256","e":"AQAB","ext":true,"key_ops":["encrypt"],"kty":"RSA","n":"o7QI0X9cue5ErinBTTz24YuTXGCbQQfhuqXKEq8xpBinqL8lW0CgTe3HqDDyGN6Ip3kE2wCCBLNTTheSS3FB0172VhsqE2mnlBsopfGWbNmFT-cT517464u9yrsFK2ywVDURDDjdh2BSl1T-3axy1P74BjvcOz7nzlAMNfT8Wp41Dwzb5o9-HPU_1nJQYzOb1zJlV1pwKzeufq81tNecT7td1QB3mnXhJAFFbRINiGu-uIaP7gl-J4ICOTh0Tjzzn7fKC-3EUbfLRvFUZBtRcZncWa5OjuGB5DhgHj8mcWvGyP_3gKzvOB2b4piE6N3NnbwO9-skIw5MdY-kQMvJLQ=="}',
        'autoLinked': false,
      },
      'acct_2a1f5086018442b98fbb15120b75a27e': {
        'accountId': 'acct_2a1f5086018442b98fbb15120b75a27e',
        'publicKey': '{"alg":"RSA-OAEP-256","e":"AQAB","ext":true,"key_ops":["encrypt"],"kty":"RSA","n":"nvmA4jWOAUiopX7Ct9Z5mH6mmTB7I4SlSgDNCMtVxHKjEEegXuxTqkScklHnrZCT7ohmWY-6ouJW4ocjln3Falu8lxxB0V7YqBrxgf81lKlDIGr5f0VYp-R9JSBtR6btVj3xV-3I3APGH5lRBW0VGTdgrBaRAl7o9_4hy7xLSy_hqgqdH2-CS2gEZfRjN-1kjSI4nvqD1BSMfyWhu-pbhP6WdhmOa3JkWLPRtxQInv14Kp1-gWjsAfXYOEvldTH4DvCGYkvEBYvSr9FQ6NQKJFOHho4NAyXJhagvuqwc134XuwiFDgCmK0bh1jXR2fy-OR255S0NseArZPkY3l2Tjw=="}',
        'autoLinked': false,
      },
      'acct_6694e55cce2c4dacb69c86844ba92d91': {
        'accountId': 'acct_6694e55cce2c4dacb69c86844ba92d91',
        'publicKey': '{"alg":"RSA-OAEP-256","e":"AQAB","ext":true,"key_ops":["encrypt"],"kty":"RSA","n":"wCd42bJqAZz5lRMk8MdMoF35ga9yhIjirMUhUXXKvA29LUYGsT6J_LxF6pXWV7CSZdxZPrf8Ur8L2AC7gz0ESHfV-uAVPBFnPrGBTiiHTBCDAtkt8tW3hqullJxfLS8PsGL6IYGYloq9gbKXiz-u37ba282vYQbbzkWO_382QJKS6eYAlE5JOpxmtNl7r5a3Okxz8JekBN5WhZrxEQzOv7ov7zmmRZPBgCm3Xo7RzAuUpBam1EkO5UvGL3DEjnc_Kx7R9jVbmLgDcryJDooKiCVLWv-tyg9H5QYMVd76uxAcQE9fJNoxSX-UU-Tu78-6CHk68IyTa2Rf4BwvSZJw-Q=="}',
        'autoLinked': false,
      },
      'acct_72196d3295b243b48ea4de15391873b7': {
        'accountId': 'acct_72196d3295b243b48ea4de15391873b7',
        'publicKey': '{"alg":"RSA-OAEP-256","e":"AQAB","ext":true,"key_ops":["encrypt"],"kty":"RSA","n":"94S0IWkw5RgnhJy1Dspynt1gsRnOrG_A5UqI2sbp8fNCdlU9Z0M-r9O-ern0Wgupxxqt8s3xpQzaRYSPcCOK4z9F-w2MT6wIKn7EKKWCpXa94pra4J5abVukwtbPILIi9-uKu8RisnaeYT82OfZKAaQi-J24yzRI7qYLyS0GCrSxWgr1-wVzeRrE8gnwQU677TVAyGDTioz3EQ2-pB4fTkXdrBlVZ8qQkruwcTJ--rr550MD1cRK95J0jT1qGn8e0bTMW5lHP3dZH7vveFj1RP3cD7jnO6b3pD7jhDaMLJqXw0Nvxru__lToP-_r054Ea8ffEWVjygtqvplxq4R3Cw=="}',
        'autoLinked': false,
      },
      'acct_fe023b1398ab48fd8f9d3dfb622f5bf6': {
        'accountId': 'acct_fe023b1398ab48fd8f9d3dfb622f5bf6',
        'publicKey': '{"alg":"RSA-OAEP-256","e":"AQAB","ext":true,"key_ops":["encrypt"],"kty":"RSA","n":"s0W6IbaPmPaMgzf2-rGOffm4tNg8_ZykiX2C6ZgFdC-GsMGiF08pSjD7UfGTPSTIWFv4Ncz6D0J8wbFBa87IYTuIZhewbNAqRcX1eu_g0-4dNIw9KqhvIoy_O-r-MT1T11TuU5gWWyHw8mY2Aax9Z_JDdDMQc-dP_FqxGCTIHfe52xQNaCL3AgMp0nU5sDUp_vo3YXSWk0yuERqQ9TMcB9l27hQhbHZHDfsdHTodXutbBG5MwpcDBppriBVlMVjY8M7QHt61C7KF5mhgniEd2msF0bAZZaVz1ibZ9QNdFHHPrdfLLQvPyZFD4m8a7Wt0Qcq9FfrFubWv1208Ocet3Q=="}',
        'autoLinked': false,
      },
    });
  });

  app.get('/v1/organizations/:organizationId/my-project-keys', (_req, res) => {
    res.json({ 'projectKeys': [], 'members': [] });
  });

  app.post('/v1/organizations/:organizationId/reconcile-keys', (_req, res) => {
    res.json(null);
  });

  app.post('/v1/desktop/organizations/:organizationId/collaborators/finish-adding', (_req, res) => {
    res.json(null);
  });

  app.get('/v1/desktop/organizations/:organizationId/collaborators/search/*', (_req, res) => {
    res.json(emailsAndGroupsToSearch);
  });

  app.post('/v1/organizations/:organizationId/invites/:invitationId/reinvite', (_req, res) => {
    res.json({ enabled: true });
  });

  app.patch('/v1/organizations/:organizationId/members/:accountId/roles', (_req, res) => {
    res.json({ enabled: true });
  });

  app.patch('/v1/organizations/:organizationId/invites/:invitationId', (_req, res) => {
    res.json({ enabled: true });
  });

  app.delete('/v1/organizations/:organizationId/members/:userId', (_req, res) => {
    res.json(null);
  });

  app.delete('/v1/organizations/:organizationId/invites/:invitationId', (_req, res) => {
    res.json(null);
  });

  app.delete('/v1/desktop/organizations/:organizationId/collaborators/:collaboratorId/unlink', (_req, res) => {
    res.json(null);
  });
};
