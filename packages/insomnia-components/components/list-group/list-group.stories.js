// @flow
import React from 'react';
import ListGroupItem from './list-group-item';
import ListGroup from './list-group';
import UnitTestItem from './unit-test-item';
import UnitTestResultItem from './unit-test-result-item';

export default { title: 'Lists | List Group' };

export const _default = () => (
  <div style={{ width: '350px' }}>
    <ListGroup>
      <ListGroupItem>List</ListGroupItem>
      <ListGroupItem>of</ListGroupItem>
      <ListGroupItem>things...</ListGroupItem>
    </ListGroup>
  </div>
);

const unitTestResults = [
  {
    title: 'Title of my test',
    duration: '23',
    err: {
      message: '',
    },
  },
  {
    title: 'Title of my test',
    duration: '201',
    err: {
      message: 'expected 200 to equal 200',
    },
  },
  {
    title: 'Title of my test',
    duration: '87',
    err: {
      message: 'expected 200 to equal 200',
    },
  },
  {
    title: 'Title of my test',
    duration: '300',
    err: {
      message: 'expected 200 to equal 200',
    },
  },
];

const unitTests = [
  {
    _id: 'ut_2225a18649504b008b94d726f3dfa19A',
    type: 'UnitTest',
    parentId: 'uts_1ef3b15dbf844b349a309c41b652472a',
    modified: 1599660181045,
    created: 1598532257797,
    requestId: 'req_wrk_3f5704e2fc744ac8b1a3c343791dbee9f2d8c170',
    name: 'Returns 200',
    code:
      'const response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);\nconst response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);\nconst response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);\nconst response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);\nconst response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);',
  },
  {
    _id: 'ut_2225a18649504b008b94d726f3dfa19d',
    type: 'UnitTest',
    parentId: 'uts_1ef3b15dbf844b349a309c41b652472a',
    modified: 1599660181045,
    created: 1598532257797,
    requestId: 'req_wrk_3f5704e2fc744ac8b1a3c343791dbee9f2d8c170',
    name: 'Returns 200',
    code:
      'const response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);\nconst response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);\nconst response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);\nconst response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);\nconst response1 = await insomnia.send();\nexpect(response1.status).to.equal(404);',
  },
];

export const _unitTests = () => (
  <div style={{ width: '100%' }}>
    <ListGroup>
      {unitTests.map((test, i) => (
        <UnitTestItem item={test} key={i}>
          <div>Toggle Content...</div>
        </UnitTestItem>
      ))}
    </ListGroup>
  </div>
);

export const _unitTestResults = () => (
  <div style={{ width: '350px' }}>
    <ListGroup>
      {unitTestResults.map((test, i) => (
        <UnitTestResultItem item={test} key={i} />
      ))}
    </ListGroup>
  </div>
);
