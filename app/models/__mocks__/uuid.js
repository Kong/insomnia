let v1Counter = 0;
let v4Counter = 0;

const v1UUIDs = [
  'f7272c80-f493-11e6-bc64-92361f002671',
  'f7272f0a-f493-11e6-bc64-92361f002671',
  'f72733a6-f493-11e6-bc64-92361f002671',
  'f72735c2-f493-11e6-bc64-92361f002671',
  'f7273798-f493-11e6-bc64-92361f002671',
  'f7273c3e-f493-11e6-bc64-92361f002671',
  'f7273dba-f493-11e6-bc64-92361f002671',
  'f7273eaa-f493-11e6-bc64-92361f002671',
  'f7273f7c-f493-11e6-bc64-92361f002671',
  'f7274300-f493-11e6-bc64-92361f002671',
];

const v4UUIDs = [
  'dd2ccc1a-2745-477a-881a-9e8ef9d42403',
  'e3e96e5f-dd68-4229-8b66-dee1f0940f3d',
  'a262d22b-5fa8-491c-9bd9-58fba03e301e',
  '2e7c2688-09ee-44b8-900d-5cbbaa7d3a19',
  'e7d698c4-c7d2-409c-90c6-22bcc94ba4ab',
  'fcef5ff8-4f78-4f16-bad4-9bdddc1c3daf',
  '7cc5b3e1-3333-4419-b370-6fcaa05c15ab',
  'd911be1d-69f6-4cb1-8312-2c3b7f0c647c',
  'ac47b0b9-aded-4968-b569-239598b7d7d1',
  '4093d252-02b6-464f-a723-494a35a7b862',
  '6d233089-e303-450b-9f1a-f6f6e6869e27',
  '874d55b5-2526-4476-8964-85f7cd685705',
  'e2a5848c-f908-4a0e-8b0a-727edbcafe89',
  '67884e55-155e-43fc-a7ad-97d23e853241',
  '130929e6-4953-45a5-9a25-b3df6fa8dca8',
  'd854aa77-5389-4690-be5e-52fd3c5c0551',
  'a5218a75-61c1-4f86-8f09-09c5c1831e7b',
  '5fd86b39-825e-4b12-a163-6dd5592b8172',
  '8c4b90c5-1cf7-4c28-a60b-ec156be97a7f',
  '3f913e38-c08e-4839-95f6-32788141951f',
  '884b5a86-5e6d-49ef-8bea-b5dcb7564cdc',
  '2fea36e5-4e92-4da6-8088-2821f580cf20',
  '1e310193-7209-430d-9ed2-f8d73ec932b5',
  '9996a7f7-ff6a-414e-9a75-2adadbde88a9',
  '562f0a86-0d2a-4137-b9c7-ff92b70939b4',
  'c62e98f8-def0-4560-bcb6-59ac1d64ac61',
  '548b6bbb-b224-408f-9f38-215b0c40bd71',
  'e2ee0259-98ca-4c0e-a7c4-3b29beae901c',
  '782c08cd-e725-4089-8023-ffce72d1c853',
  '9b176a7f-1e50-4ebd-8758-2d4c3197fb24',
  'e29ffcfc-d277-4302-92bf-d279e4b8d03f',
  'f6b81add-3e80-49dc-86ef-f2f43ad13f9d',
  'a5a9bb1e-67f4-4cfe-a3cd-cdf802378eb9',
  '95b2f335-87f7-4257-b069-197242408660',
  '9b5ad4fc-0b14-4d13-8d01-7e6fde1b48b7',
  'a37d9af3-1f60-47c0-a114-4ae345d3005c',
  'e5540caa-f250-42f7-b5a5-c4d60963569f',
  '7ea6be14-582f-4105-9905-a30f2be72ad8',
  '9fc10ee2-6135-454d-9aa8-b2a82b766c03',
  '40492eb7-a9c1-4d67-b49b-c7c6be8d9ccd',
  'c939099b-6b8c-4acd-9738-883c409b713c',
  'ed9adb1e-e27f-484c-9d32-3f351759c757',
  '73781cfd-6d55-47b2-8735-8e90ee8d8320',
  'd983abdb-ab5a-44f8-888a-2d98c123db54',
  '8acca410-43ec-4d75-b553-97ea0de8735f',
  '8a5a2550-1289-4bef-903c-9ce3c9c9d5c5',
  '041462ba-dbfc-4381-b34b-1d03c043f10e',
  'f7dd76f2-efd8-439b-a2d3-89f09570bea8',
  '9e4ccefd-5968-4dc2-83e3-b9a8e1815a1b',
  '9654696e-747c-4116-b197-94e31d2daaff',
  'eba603bc-a93c-4fa6-86d0-01a6dfccb3bd',
  '9d1b76df-8a02-4d86-ae0c-0423cf41e097',
  '38511ada-296b-4353-8fca-131b67283016',
  'f1a6d808-8b2b-4502-b42a-5ca4fcfa5b51',
  'a6d670f1-bbbd-45fa-8834-ffccb4292ee1',
  'c8a35834-c4a3-4950-915b-8ec0af8a957a',
  '23fcf651-d24e-4a5d-8631-f5f7d54143c5',
  '5d0dc5e0-a827-4b1a-b787-4050ab15deba',
  '32a1b905-15c5-48b3-b9a3-59c9f4f14b27',
  '97a340b2-91e3-4c9e-9040-e751291e533e',
  'c352d95b-c77a-4192-9e52-2b43e5d45c75',
  '65c46c7b-d7f9-4367-84af-51018a68beec',
  '304a7d57-9d08-4b8f-983f-14d69c49f8fe',
  '817124d8-e40b-400e-8165-ee6cb4459ffe',
  '033caad7-5765-426a-ac55-7d95f63550b6',
  '395177a1-b026-49c1-abf0-e95bcde88c3b',
  'af8642aa-ff28-4aca-b32e-02e6772d0399',
  '719fd155-a11b-415f-a042-6293c143793f',
  '46409dfc-a668-4922-8a6b-245588a363c6',
  'ff89d2bc-6781-4a09-a2fa-4c9fc9d8f539',
  '6d6e6070-c192-46dc-ae1a-4b819828fbae',
  '650345e6-73c5-49f1-92cc-b16f70dfabf0',
  '8d85d153-da68-4123-a3f8-03753be9c7e8',
  '185dc090-3fcc-44e3-8a17-4e2fa792f91a',
];

function v1 () {
  const uuid = v1UUIDs[v1Counter++];
  if (!uuid) {
    throw new Error('Not enough mocked v1 UUIDs to go around');
  }

  return uuid;
}

function v4 () {
  const uuid = v4UUIDs[v4Counter++];
  if (!uuid) {
    throw new Error('Not enough mocked v4 UUIDs to go around');
  }

  return uuid;
}

module.exports = () => v4();
module.exports.v4 = () => v4();
module.exports.v1 = () => v1();
