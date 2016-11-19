let counter = 0;

const uuids = [
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
  '9996a7f7-ff6a-414e-9a75-2adadbde88a9'
];

function v4 () {
  const uuid = uuids[counter++];
  if (!uuid) {
    throw new Error('Not enough mocked UUIDs to go around');
  }

  return uuid;
}

module.exports = () => v4();
module.exports.v4 = () => v4();
